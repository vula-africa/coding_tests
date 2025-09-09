Cleanup: Unsubmitted Public Forms

Overview
- This scheduled job removes public form tokens and associated data older than 7 days to prevent database clutter.

Key Fixes
- Correct 7-day threshold calculation (milliseconds).
- UTC midnight cutoff to prevent delayed-run drift.
- Composite-cursor pagination by `createdAt, token` to avoid ordering edge cases.
- Replace N+1 per-token deletes with paginated batch processing.
- Safe entity deletion only when no other unexpired tokens reference the entity.
- FK-safe deletion order: dependent data -> tokens -> entities.
- Optional cleanup of `relationship` rows with status "new" related to the batch.
- Improved observability: job status updates and structured logs.

Assumptions
- `publicFormsTokens`: fields include `token`, `entityId`, `productId`, `createdAt`.
- `new_corpus` rows reference entities via `entity_id`.
- `entity` table has `id` matching `publicFormsTokens.entityId`.
- Optional relationship cleanup references `product_id` and `status`.
- If your schema tracks submission (`submittedAt` or `isSubmitted`), filter for unsubmitted tokens.

Operational Notes
- BATCH_SIZE is set to 500 to balance throughput and transaction size.
- The job logs progress per batch and totals upon completion.
- Failures in one batch do not stop the entire job; failed chunks are logged.

How it works (high level)
1. Compute a UTC midnight cutoff for 7 days ago.
2. Page through tokens with `createdAt < cutoff`, ordered by `createdAt, token`.
3. For each batch:
   - Identify entities still referenced by unexpired tokens and keep them.
   - Delete dependent `new_corpus` for entities safe to delete.
   - Delete tokens in the batch.
   - Delete entities safe to delete.
   - Optionally delete `relationship` rows with status "new" tied to products in batch.

Local Testing Guidance
- Stub prisma methods or point to a test database.
- Seed tokens older than 7 days and some newer tokens referencing the same entity to verify entity safety.
- Verify logs and counts for deleted tokens/entities.

PR Hygiene
- Branch name: `bug-fix/cleanup-unsubmitted-forms`.
- Commit messages are atomic and follow conventional commits.
- This README documents design decisions and assumptions for reviewers.


