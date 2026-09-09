---
title: "Slow SQL? Start with EXPLAIN"
date: "2026-09-06"
excerpt: "What can an execution plan tell us? Follow scan methods, row estimates, and buffer hits to build a troubleshooting process grounded in evidence."
slug: "postgres-explain"
translationKey: "postgres-explain"
lang: "en"
tags: ["postgresql","query-optimization"]
draft: false
sample: true
featured: true
category: "DATABASE / QUERY OPTIMIZATION"
context: "PostgreSQL 16+ · SQL examples; not run against real business data."
---

When investigating a slow query, resist the urge to add an index straight away. First, see how the database plans to execute the SQL. Then work out whether the problem lies in the scan, the estimates, or the amount of data itself. An execution plan will not make the decision for you, but it gives you a sounder basis for the next step.

## Inspect the plan, then check execution

`EXPLAIN` shows the plan. Add `ANALYZE`, and the database actually executes the statement, adding observed row counts and timings to the plan. These answer different questions.

```sql
-- Step 1: inspect the plan without executing the query
EXPLAIN
SELECT id, created_at
FROM orders
WHERE customer_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

After checking the query and its environment, consider using `EXPLAIN (ANALYZE, BUFFERS)`. Even a SELECT can create substantial load or call functions with side effects. Putting EXPLAIN in front of a statement does not automatically make it harmless.

## Focus on a few useful signals

An execution tree contains plenty of numbers. Start with three signals to make them easier to interpret.

- **Estimated and actual rows:** if they differ greatly, check statistics, parameter distributions, and correlations between columns.
- **Loop counts:** actual time and row counts reported by a node are generally averages per loop. A small cost per execution can still matter when it is repeated many times.
- **Buffer statistics:** `shared hit` means a hit in PostgreSQL's shared buffers. A `shared read` does not necessarily mean a physical disk read: the operating system's cache may also be involved.

> A sequential scan is not necessarily a problem, and an index scan is not automatically efficient. Judge them against the fraction of rows returned, the access pattern, and the actual work performed.

## Change one condition at a time

Save the original SQL, parameters, and execution plan. Then change one condition and compare. You might update statistics, adjust the query, or design an index.

Record the data volume, PostgreSQL version, and cache state during testing. Do not treat a difference in one run as a lasting improvement. Production concurrency and parameter distributions can also change the result.

At the end of a slow-query investigation, keep more than the new statement. Leave a record of the reasoning that someone else can reproduce.

## Further reading

- [PostgreSQL 16 · Using EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html)
