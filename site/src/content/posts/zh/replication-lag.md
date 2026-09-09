---
title: "主从复制延迟，该从哪里看起？"
date: "2026-08-16"
excerpt: "把 WAL 发送、写入与回放拆开观察，让延迟有一个具体的位置。"
slug: "replication-lag"
translationKey: "replication-lag"
lang: "zh"
tags: ["postgresql","operations"]
draft: false
sample: true
featured: false
category: "DATABASE / REPLICATION"
context: "PostgreSQL 16+ · 物理流复制观察示例，字段需结合实例角色解释。"
---

看到复制延迟，先别把所有原因都归到网络。WAL 从生成到被备库回放，要经过几个阶段；每个阶段都可能排队。

## 沿着 WAL 的路径看

在主库侧检查发送、写入、刷盘和回放位置。LSN 差值可以帮助定位积压，但字节差不等同于时间差，二者要分开解释。

## 把复制状态放回负载里

下面的只读查询用于查看主库上已连接备库的复制状态。

```sql
SELECT application_name, state,
       sent_lsn, write_lsn, flush_lsn, replay_lsn
FROM pg_stat_replication;
```

结合 WAL 生成速率、网络吞吐和备库 I/O 观察变化。空闲期间的 lag 字段也不能简单解释为还需要等待多久。

## 检查是否持续追不上

一次写入峰值造成的短暂积压，与长期回放速度不足，需要不同处理。记录积压是否收敛，再调查备库资源、长查询冲突和配置。

告警应该帮助判断业务影响，而不是只报告一个孤立的数字。

## 参考资料

- [PostgreSQL 16 · Monitoring Database Activity](https://www.postgresql.org/docs/16/monitoring-stats.html)
