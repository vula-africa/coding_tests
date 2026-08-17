---
title: Cleanup Unsubmitted forms
description: Daily job that deletes public-form tokens older than 7 days, plus linked unsubmitted entity data.
---

# Cleanup unsubmitted forms

Scheduled job: `cleanup_unsubmitted_forms`.

Runs every day at midnight. Deletes public-form sessions that were started but never submitted and are older than 7 days, along with the unused entity data they created.

## Why it exists

When a user opens a public form, the system stores a **token**. That token identifies the session and links answers to an **entity** — a Vula profile for a business or individual, separate from a login.

If the user never submits, those rows are unused. This job removes them so tokens and entities do not accumulate.

## What it deletes

For each token with `createdAt` **older than 7 days**:

| Token state | Deleted |
| --- | --- |
| No `entityId` | Token only |
| `entityId` set, matching `new` relationship | Relationship, token, corpus rows, entity |
| `entityId` set, no matching `new` relationship | Token, corpus rows, entity |

The relationship match is `product_id` + `entity_id` + `status: "new"`, so another entity on the same product is not removed.

Deletes for a single token run in one Prisma transaction.

## Job status

| Outcome | Status |
| --- | --- |
| Every token cleaned successfully | `completed` |
| One or more tokens failed (logged; others continue) | `failed` |
| Unexpected error (for example the initial query) | `failed`, error rethrown |

## Performance

- Cutoff is `Date.now() - 7 * 24 * 60 * 60 * 1000` (milliseconds).
- Filter is `createdAt < cutoff`, so a missed run still picks up older tokens.
- Tokens are processed in batches of 100.
- Relationships for each batch are loaded with one `findMany`, then looked up in a `Map`.
