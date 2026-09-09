---
title: "一条慢 SQL，从 EXPLAIN 开始说起"
date: "2026-09-06"
excerpt: "执行计划里藏着什么？从扫描方式、行数估计到缓冲区命中，建立一条有迹可循的排查路径。"
slug: "postgres-explain"
translationKey: "postgres-explain"
lang: "zh"
tags: ["postgresql","query-optimization"]
draft: false
sample: true
featured: true
category: "DATABASE / QUERY OPTIMIZATION"
context: "PostgreSQL 16+ · SQL 示例；未在真实业务数据上运行。"
---

排查慢查询，先别急着加索引。先看数据库打算怎样执行这条 SQL，再判断问题出在扫描、估计，还是数据量本身。执行计划不会替你作决定，但会让下一步更有依据。

## 先看计划，再验证执行

`EXPLAIN` 展示计划；加上 `ANALYZE` 后，数据库会实际执行语句，并把观测到的行数和时间放进计划里。两者回答的是不同的问题。

```sql
-- 第一步：只看计划，不执行查询
EXPLAIN
SELECT id, created_at
FROM orders
WHERE customer_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

确认查询与环境后，再考虑使用 `EXPLAIN (ANALYZE, BUFFERS)`。即使是 SELECT，也可能产生较大负载或调用带副作用的函数。不要因为前面多了一个 EXPLAIN，就把它当作没有影响的操作。

## 关注关键的几组信息

执行树上的数字很多，先抓住三条线索，通常更容易建立判断。

- **估计行数和实际行数**：相差很大时，检查统计信息、参数分布，以及列之间的相关性。
- **循环次数**：节点报告的实际时间和行数通常按循环取平均。看见较小的单次开销，也要留意它重复了多少次。
- **缓冲区统计**：`shared hit` 表示命中 PostgreSQL 共享缓冲区；`shared read` 不等于每次都从物理磁盘读取，操作系统缓存也会参与。

> 顺序扫描不一定是问题，索引扫描也不自动等于高效。判断要回到返回比例、访问模式和实际工作量。

## 一次只改变一个条件

保存原始 SQL、参数和执行计划，再改变一个条件进行对比。可能是更新统计信息，可能是调整查询写法，也可能需要设计索引。

测试时记录数据规模、PostgreSQL 版本和缓存状态。不要把一次运行的差异直接当作稳定收益；业务中的并发和参数分布，也可能改变结论。

一条慢 SQL 的排查结束，最好留下的不只是新的语句，还有一段别人能复现的判断过程。

## 参考资料

- [PostgreSQL 16 · Using EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html)
