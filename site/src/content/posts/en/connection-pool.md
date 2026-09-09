---
title: "Bigger Is Not Always Better for Connection Pools"
date: "2026-08-22"
excerpt: "From waiting requests to database load: a closer look at connection counts."
slug: "connection-pool"
translationKey: "connection-pool"
lang: "en"
tags: ["postgresql","backend"]
draft: false
sample: true
featured: false
category: "BACKEND / RELIABILITY"
context: "An example approach to pool tuning; settings depend on the driver, pool implementation, and representative load tests."
---

A connection pool lets an application reuse database connections. It also limits how much work can enter the database at once. Enlarging the pool may simply move the wait from the application into the database.

## Count every application instance

A pool limit usually applies to one application process. With multiple instances, those connection budgets add up. You also need to reserve connections for operations, background jobs, and other services.

List every source of connections before deciding how much of the budget each pool can use.

## Identify where the wait happens

Watch pool wait time, connection hold time, transaction duration, and database resource usage. A long wait for a pooled connection does not automatically mean there are too few connections.

- Slow transactions keep connections occupied.
- Lock contention can leave more connections waiting together.
- When the database is close to a resource bottleneck, greater concurrency can worsen tail latency.

## Find a useful range through small experiments

Adjust connection counts gradually under representative load. Observe throughput, tail latency, and remaining resource capacity. Check connection acquisition timeouts, statement timeouts, and transaction boundaries too.

Keep before-and-after records. You should be able to explain a setting, rather than doubling it because the default looks small.
