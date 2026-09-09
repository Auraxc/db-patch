---
title: "Where to Start with Primary–Standby Replication Lag"
date: "2026-08-16"
excerpt: "Observe WAL sending, writing, and replay separately to locate where replication falls behind."
slug: "replication-lag"
translationKey: "replication-lag"
lang: "en"
tags: ["postgresql","operations"]
draft: false
sample: true
featured: false
category: "DATABASE / REPLICATION"
context: "PostgreSQL 16+ · An example for observing physical streaming replication; interpret fields in the context of the instance's role."
---

When replication lags, do not blame the network straight away. WAL passes through several stages between generation and replay on the standby. Work can queue at any of them.

## Follow the path of WAL

On the primary, inspect the sent, written, flushed, and replayed positions. LSN differences can help locate a backlog, but a difference in bytes is not a difference in time. Interpret them separately.

## Read replication state alongside the workload

This read-only query shows the replication state of standbys connected to the primary.

```sql
SELECT application_name, state,
       sent_lsn, write_lsn, flush_lsn, replay_lsn
FROM pg_stat_replication;
```

Observe changes alongside WAL generation rate, network throughput, and standby I/O. During idle periods, lag fields cannot simply be read as the time left to wait either.

## Check whether the standby catches up

A brief backlog after a write spike needs different treatment from a persistent shortage of replay capacity. Record whether the backlog shrinks, then investigate standby resources, conflicts with long-running queries, and configuration.

An alert should help you assess business impact, rather than report an isolated number.

## Further reading

- [PostgreSQL 16 · Monitoring Database Activity](https://www.postgresql.org/docs/16/monitoring-stats.html)
