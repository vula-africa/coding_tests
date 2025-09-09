# fix(cleanup): UTC cutoff, composite-cursor batching, safe entity deletion, FK-safe order

## Summary
This PR corrects and hardens the scheduled cleanup job for unsubmitted public forms. It fixes time math and date filtering, adds deterministic pagination and batching, protects entities from accidental deletion, and enforces an FK-safe deletion order. It also improves observability via job status updates and structured logs.

- Baseline reference (current main): [tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts](https://github.com/vula-africa/coding_tests/blob/main/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts)

## Context / Problem
The original job had several correctness and reliability issues:
- Subtracted seconds instead of milliseconds (virtually no records matched).
- Narrow 24-hour window (7 to 6 days ago) instead of “older than 7 days.”
- Per-token transactions (N+1 round-trips, poor performance).
- Risky deletes (entities removed even if still referenced; unsafe FK order).
- Relationship dependency could block valid cleanups.
- Limited observability for debugging and operations.

## What changed
- Correct date handling with a UTC midnight cutoff 7 days ago (prevents delayed-run drift).
- Deterministic, scalable pagination using a composite cursor (createdAt, token).
- Batching: single transaction per batch instead of per-token.
- Safe entity deletion: only delete entities not referenced by any non-expired tokens.
- FK-safe order: delete dependent data → tokens → entities.
- Optional relationship cleanup (non-blocking) for status "new".
- Job status transitions and structured logs with counters.

## Key implementation details
- **UTC cutoff**:
  - Compute midnight in UTC, subtract 7 days; filter uses `createdAt < cutoff`.
- **Composite-cursor pagination (createdAt, token)**:
  - `orderBy createdAt asc, token asc`; next page where `createdAt > lastCreatedAt` OR (`createdAt == lastCreatedAt` AND `token > lastToken`).
- **Safe entity deletion**:
  - Before deleting entities in a batch, check for any tokens with `createdAt ≥ cutoff` referencing those entities; if found, keep the entity.
- **Transaction content and order per batch**:
  - `new_corpus.deleteMany` (children) → `publicFormsTokens.deleteMany` → `entity.deleteMany` (parents).
  - Optional `relationship.deleteMany` for `product_id IN` batch and `status = "new"` (can be scoped further by `entity_id` if schema requires).

## Files changed
- `tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts`
- `tests/unsubmitted_forms/README.md` (design/ops notes)
- `tests/unsubmitted_forms/EXPLAINER.md` (original → final walkthrough, definitions)
- `tests/unsubmitted_forms/BRAINLIFT.md` (cursor-ready citations)
- `tests/unsubmitted_forms/PRESENTATION.md` (3–5 min script)

## Why this approach
- **Correctness**: captures all records strictly older than the retention boundary regardless of job start time.
- **Performance**: avoids N+1 transactions; minimizes round-trips; keeps memory bounded.
- **Data safety**: prevents deleting entities still needed by other in-progress or newer tokens.
- **Integrity**: FK constraints respected by delete order.
- **Operations**: better logs, counters, and job status transitions.

## Assumptions
- `update_job_status(jobId, status)` exists and updates job state in the scheduler.
- Schema has:
  - `publicFormsTokens`: `token`, `entityId`, `productId`, `createdAt`.
  - `new_corpus` referencing entities via `entity_id`.
  - `entity` with primary key `id`.
  - Optional `relationship` with `product_id` (and optionally `entity_id`) and `status`.
- If your schema tracks submission flags (e.g., `submittedAt` or `isSubmitted`), you can add those filters to the where clause as an extra guard.

## Operational guidance
- **Batch size**: default 500; tune based on DB capacity.
- **Indexes recommended**:
  - `publicFormsTokens(createdAt)`
  - `publicFormsTokens(entityId)`
- **Idempotency**: re-runs are safe; deletes skip missing rows without failing.

## How to test locally
1. Seed tokens:
   - Older than cutoff (should be deleted).
   - Newer than or equal to cutoff (must be kept).
   - Multiple tokens referencing the same entity (ensure entity only deleted if no non-expired tokens exist).
2. Run the job and observe logs:
   - “Deleted tokens … Deleted entities … Failed chunks …”
   - Ensure job transitions `in_progress → completed`.
3. Validate DB:
   - All tokens with `createdAt < cutoff` are gone.
   - Entities without any non-expired token references are gone; entities referenced by non-expired tokens remain.
   - Any optional relationships with status "new" tied to products in the batch are removed if enabled.

## Trade-offs considered
- **Batching vs one mega-transaction**:
  - Batching limits blast radius and avoids long locks/timeouts; slightly more code, much better reliability.
- **Extra safe-entity check**:
  - Adds a small query cost, but vastly reduces risk of data loss.
- **UTC cutoff**:
  - Opinionated, but eliminates “delayed-run” gaps and keeps retention calendar-accurate.

## Future work (optional)
- Configurable retention days and batch size via env.
- Metrics and alerting (e.g., Prometheus counters, error budgets).
- Hardening optional relationship scoping by `entity_id` if schema requires.

## Checklist
- [x] Correct date math and cutoff boundary
- [x] Composite-cursor pagination and batching
- [x] Safe entity deletion and FK-safe order
- [x] Optional relationship cleanup non-blocking
- [x] Logs and job status transitions
- [x] Docs updated (README, EXPLAINER, scripts)

## Reference
- Baseline file on main: [tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts](https://github.com/vula-africa/coding_tests/blob/main/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts)

