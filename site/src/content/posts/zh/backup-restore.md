---
title: "备份成功之后，别忘了试一次恢复"
date: "2026-09-03"
excerpt: "把“有备份”变成“能恢复”：一份恢复演练的检查笔记。"
slug: "backup-restore"
translationKey: "backup-restore"
lang: "zh"
tags: ["postgresql","operations"]
draft: false
sample: true
featured: false
category: "DATABASE / OPERATIONS"
context: "恢复演练思路示例；具体步骤取决于备份类型与 PostgreSQL 版本。"
---

备份任务显示成功，只能说明备份流程走到了终点。需要恢复的时候，文件能否读取、依赖是否齐全、业务能否接受恢复后的状态，是另一组问题。

## 先写清楚恢复目标

可以接受丢失多少数据？允许多长的恢复时间？先明确 RPO 与 RTO，再判断现有备份频率、保留策略和恢复方式是否匹配。

逻辑备份、物理备份和基于 WAL 的时间点恢复，解决的问题并不完全相同。演练方案需要与实际备份方式一致。

## 在隔离环境里走完流程

从取回备份开始计时，把解密、传输、准备环境和验证都算进去。恢复到隔离实例，确认版本、扩展和权限这些依赖都存在。

- 检查恢复日志与对象完整性。
- 核对关键表和业务不变量。
- 由应用发起代表性只读查询，验证恢复后的数据能被使用。

## 把结果变成下一次的起点

记录实际恢复耗时、遇到的依赖和需要人工判断的步骤。修订运行手册，并给每次演练留下日期与结果。

一份可靠的手册，应当能让接手的人知道从哪里开始，如何判断完成，而不是只保存一串命令。

## 参考资料

- [PostgreSQL 16 · Backup and Restore](https://www.postgresql.org/docs/16/backup.html)
