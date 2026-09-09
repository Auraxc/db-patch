---
title: "pg_wal 突然涨到 1TB，我查了这几个地方"
date: "2026-09-09"
excerpt: "一次 PostgreSQL 10 生产故障复盘：Flink CDC 的失活逻辑复制槽长期不推进，导致 WAL 无法回收、pg_wal 膨胀至 1TB 并写满磁盘。"
slug: "pg-wal-1tb"
translationKey: "pg-wal-1tb"
lang: zh
tags:
  - postgresql
  - operations
draft: false
sample: false
featured: true
category: "DATABASE / INCIDENT REVIEW"
context: "PostgreSQL 10 · 一主一备 · Flink CDC · 生产故障复盘"
---

![蓝天下的 PostgreSQL 大象与 WAL 日志文件，DB PATCH 文章封面](/images/pg-wal-1tb-cover.png)

这是一个平静的周五。白天刚做完检查，数据库、主备、磁盘都正常。我已经在等周六了：睡到自然醒，不看告警，最好连电脑都不开。

半夜电话响了。

“现场挂了，业务连不上数据库。”

明明刚检查过，怎么会突然挂？

## 先看磁盘

登录机器，数据库进程已经退出。`df` 一看，**数据库分区 100%**。

```bash
df -h
du -sh "$PGDATA"/* | sort -h
# 输出
1.0T    /data/pgsql/10/data/pg_wal
```

**`pg_wal` 涨到了 1TB。**

脑子里先过一遍：归档失败？备库断了？复制槽不推进？`wal_keep_segments` 被改过？还是最近有大批量写入？

现场是 PG10，一主一备，核心业务不能长时间停。先停业务写入，也停掉刚上线的 Flink 任务；清理确认无用的应用日志和系统日志，腾出空间后启动数据库。

WAL 日志是数据修改前先写下的日志，崩溃恢复和主备复制都要用。

> 这里清的是普通日志，不是 `pg_wal`。手工删 WAL，很可能把“磁盘满”变成“数据库再也起不来”。

## 最近上线了什么

库起来后，我先问现场：“最近改了什么？”

答复是刚上线了一套 Flink 业务。继续追问对数据库做改动了吗，答复为了做 CDC，业务让驻场人员把 `wal_level` 从 `replica` 改成了 `logical`，还建了逻辑复制槽。

改成 `logical` 本身没错，Flink 要做逻辑解码就需要它。问题是核心库被重启改了参数、加了持久化复制槽，DBA 到出事才知道，更别说监控和退出方案了。

## 我查了这几个地方

先确认实际配置。不要只看 `postgresql.conf`，查 `pg_settings` 才知道当前值从哪里来的：

```sql
SELECT name, setting, unit, source, pending_restart
FROM pg_settings
WHERE name IN ('wal_level', 'archive_mode', 'archive_command',
               'max_wal_size', 'min_wal_size',
               'wal_keep_segments', 'max_replication_slots')
ORDER BY name;
```

然后看归档和主备的情况：

```sql
SELECT archived_count, last_archived_time,
       failed_count, last_failed_wal, last_failed_time
FROM pg_stat_archiver;

SELECT application_name, client_addr, state, sync_state,
       sent_lsn, write_lsn, flush_lsn, replay_lsn
FROM pg_stat_replication;
```

归档没有卡住，主备延迟也解释不了这 1TB。最后查复制槽：

```sql
SELECT slot_name, slot_type, database, active, active_pid,
       restart_lsn, confirmed_flush_lsn,
       pg_size_pretty(
         pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)::bigint
       ) AS retained_wal
FROM pg_replication_slots
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
         DESC NULLS LAST;
```

Flink 的逻辑复制槽 `active = false`，**`restart_lsn` 很久没动，保留量接近 1TB**。找到了。

复制槽就是下游留在数据库里的读取位置。下游不推进，PostgreSQL 就不敢回收它可能还要用的 WAL。PG10 又没有复制槽保留上限，于是 Flink 不再消费，核心业务还在写，`pg_wal` 就一直涨到磁盘满。

`wal_level = logical` 会增加 WAL 量，但这次真正拖住回收的是复制槽。这个锅不能只甩给 PostgreSQL。

## 别看到槽就直接删

删除槽会丢掉原来的消费位置。先找业务确认：任务还要不要？能不能恢复消费？是否接受重新做全量？确认槽已经废弃或可以重建后，才能执行 `SELECT pg_drop_replication_slot('flink_slot_name');`。

根因解除并留出足够磁盘空间后，等待检查点回收旧 WAL；确有需要再由 DBA 执行 `CHECKPOINT;`。

> 不要为了省几分钟直接删 `pg_wal` 文件。

## 下次先查这四项

- 归档失败，或者归档速度赶不上 WAL 生成速度；
- 物理或逻辑复制槽落后，任务下线后槽却没删；
- `wal_keep_segments` 配得过大；
- 批量导入、更新、删除或频繁检查点，让 WAL 突然增多。

长事务会影响 VACUUM，但不会仅仅因为没提交就让旧 WAL 永远不能回收。这个问题很容易和表膨胀混在一起。

PG10 最大的麻烦是复制槽可以无限保留 WAL，`max_wal_size` 管不住。**PG13 才加入 `max_slot_wal_keep_size`**。它限制的是槽最多保留多少 WAL，不是槽本身的大小；默认值 `-1` 仍表示不限制。

我的做法很简单：监控每个槽保留了多少 WAL、位置是否推进，同时监控归档和磁盘；任务下线必须处理槽；PG10 靠外部告警兜底，并尽快升级。对核心库，确认任务已经废弃并准备好重建方案后，我宁愿主动处置不正常的复制槽，也不愿让失联的消费者拖死主库。

那晚最有用的问题不是哪条 SQL，而是：

**“最近上线了什么？”**

## 参考资料

- [PostgreSQL 10：WAL 配置](https://www.postgresql.org/docs/10/runtime-config-wal.html)
- [PostgreSQL 10：pg_replication_slots](https://www.postgresql.org/docs/10/view-pg-replication-slots.html)
- [PostgreSQL 13：max_slot_wal_keep_size](https://www.postgresql.org/docs/13/runtime-config-replication.html#GUC-MAX-SLOT-WAL-KEEP-SIZE)
