---
title: "Asking AI to Review SQL? Define the Boundaries First"
date: "2026-08-29"
excerpt: "Provide context and constraints. Use AI to assist a review, not just generate statements."
slug: "ai-sql-review"
translationKey: "ai-sql-review"
lang: "en"
tags: ["ai"]
draft: false
sample: true
featured: false
category: "AI LAB / ENGINEERING"
context: "An example assisted-review workflow, not a model evaluation or a production-validated result."
---

SQL is difficult to assess without its schema, data distribution, and access patterns. Before asking AI for help, define the scope of the problem. That is often more useful than adding another request to analyze it carefully.

## Provide enough context

Provide sanitized schemas, indexes, query goals, and version details. For a performance problem, an execution plan is more useful than SQL alone.

State what must remain unchanged, such as result semantics, ordering requirements, transaction boundaries, and application compatibility. Do not include production connection details or real personal data in the prompt.

## Ask for evidence, not just a conclusion

Ask the model to distinguish known facts, assumptions, and missing information. Specific suggestions are easier to verify and make misunderstandings easier to spot.

```text
Review this SQL. Do not rewrite it yet.
1. Restate the query's result semantics.
2. List the issues you can confirm and the evidence for each.
3. Separately list assumptions caused by missing context.
4. Give verification steps for each recommendation.
Do not execute SQL or guess actual execution times.
```

## Verify the suggestions in the database

The model's output is a set of suggestions to verify. Check returned results with sample data, and use execution plans in a controlled environment to assess changes in the work performed.

Confirm semantics before assessing performance. A cleaner-looking rewrite that silently changes how NULL values or duplicate rows are handled cannot be merged as-is.
