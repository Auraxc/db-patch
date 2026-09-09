---
title: "After a Successful Backup, Test the Restore"
date: "2026-09-03"
excerpt: "From having a backup to being able to recover: notes on running a restore drill."
slug: "backup-restore"
translationKey: "backup-restore"
lang: "en"
tags: ["postgresql","operations"]
draft: false
sample: true
featured: false
category: "DATABASE / OPERATIONS"
context: "An example approach to restore drills; exact steps depend on the backup type and PostgreSQL version."
---

A successful backup job tells you that the backup process finished. Whether the files are readable, the dependencies are available, and the restored state is acceptable to the business are separate questions.

## Define the recovery targets first

How much data loss is acceptable? How long can recovery take? Define the recovery point objective (RPO) and recovery time objective (RTO) first, then check whether the backup frequency, retention policy, and recovery method meet them.

Logical backups, physical backups, and WAL-based point-in-time recovery do not solve exactly the same problems. A drill should match the backup method actually in use.

## Run the full process in an isolated environment

Start the timer when you retrieve the backup. Include decryption, transfer, environment preparation, and validation. Restore to an isolated instance and confirm that the required versions, extensions, and permissions are available.

- Check restore logs and object integrity.
- Verify critical tables and business invariants.
- Run representative read-only queries through the application to confirm that the restored data is usable.

## Use the results to improve the next drill

Record the actual recovery time, dependencies you encountered, and steps that required human judgment. Update the runbook, and keep the date and results of each drill.

A useful runbook tells the next person where to start and how to determine that recovery is complete. It needs more than a sequence of commands.

## Further reading

- [PostgreSQL 16 · Backup and Restore](https://www.postgresql.org/docs/16/backup.html)
