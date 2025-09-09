# Unsubmitted Forms Cleanup – From Original to Final Implementation

This document explains, in plain language, what the original job did, what was wrong with it, and exactly what we changed and why. It also defines all the relevant terms so you can internalize the reasoning and tell the story clearly during review or your Loom recording.

## What the job does (business intent)
- When a visitor starts a public form, we create a token and an associated entity to hold the in-progress answers.
- If the form is never submitted, this stale data should be deleted after 7 days so the database doesn’t grow indefinitely.

## Original implementation (summarized)
- Calculated “7 days ago” incorrectly (seconds instead of milliseconds).
- Queried only a 24-hour window (between 7 and 6 days ago), not “older than 7 days”.
- Gated cleanup on the existence of a `relationship` record with `status: "new"`.
- For every token, ran a separate transaction (N+1 pattern).
- Used empty-string fallbacks for IDs when deleting (risky).
- Deleted in an order that could break foreign key constraints under realistic schemas.

## High-level fixes we made
- Correct time math and switch to a strict “older than” filter.
- Use a UTC midnight cutoff 7 days ago to prevent delayed-run drift.
- Paginate in consistent, deterministic order using a composite cursor `(createdAt, token)`.
- Batch work and run one transaction per batch (not per token).
- Delete dependent data first, then tokens, then entities (FK-safe order).
- Delete entities only if they are not referenced by any non-expired token (safe entity deletion).
- Make relationship cleanup optional and non-blocking.
- Add logging and job-status updates for observability.

## Exact code locations to anchor the explanation

- Batch size: choose a reasonable chunk to limit DB pressure.
```29:31:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
// Process cleanup in manageable chunks to reduce DB load and memory footprint
const BATCH_SIZE = 500;
```

- UTC midnight cutoff 7 days ago (prevents delayed-run drift).
```38:45:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
await update_job_status(job.id, "in_progress");
// Use UTC midnight cutoff 7 days ago to avoid drift when the job runs late
const cutoff = new Date();
cutoff.setUTCHours(0, 0, 0, 0);
cutoff.setUTCDate(cutoff.getUTCDate() - 7);
```

- Composite-cursor pagination (stable ordering across ties).
```50:76:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
const expiredTokensPage = await prisma.publicFormsTokens.findMany({
  where: {
    createdAt: { lt: cutoff },
    ...(lastCreatedAt
      ? {
          OR: [
            { createdAt: { gt: lastCreatedAt } },
            { AND: [{ createdAt: lastCreatedAt }, { token: { gt: lastToken as string } }] },
          ],
        }
      : {}),
  },
  select: {
    token: true,
    entityId: true,
    productId: true,
    createdAt: true,
  },
  orderBy: [
    { createdAt: "asc" },
    { token: "asc" },
  ],
  take: BATCH_SIZE,
});
```

- Safe entity deletion (only if no non-expired tokens still point to it).
```88:104:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
// Determine which entities are safe to delete (no other unexpired tokens reference them)
let entityIdsSafeToDelete: string[] = [];
if (entityIdsInBatch.length > 0) {
  const entitiesWithOtherTokens = await prisma.publicFormsTokens.findMany({
    where: {
      entityId: { in: entityIdsInBatch },
      token: { notIn: tokenIdsInBatch },
      // If any other token exists for this entity that is NOT expired by cutoff, keep the entity
      createdAt: { gte: cutoff },
    },
    select: { entityId: true },
    distinct: ["entityId"],
  });
  const toKeep = new Set(entitiesWithOtherTokens.map((e) => e.entityId!).filter(Boolean));
  entityIdsSafeToDelete = entityIdsInBatch.filter((id) => !toKeep.has(id));
}
```

- FK-safe deletion order and optional relationship cleanup inside a single batch transaction.
```106:136:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
const ops = [] as Parameters<typeof prisma.$transaction>[0];
// 1) Delete dependent data first
if (entityIdsSafeToDelete.length > 0) {
  ops.push(
    prisma.new_corpus.deleteMany({ where: { entity_id: { in: entityIdsSafeToDelete } } })
  );
}
// 2) Delete tokens in the batch
ops.push(
  prisma.publicFormsTokens.deleteMany({ where: { token: { in: tokenIdsInBatch } } })
);
// 3) Delete entities that are safe to delete
if (entityIdsSafeToDelete.length > 0) {
  ops.push(prisma.entity.deleteMany({ where: { id: { in: entityIdsSafeToDelete } } }));
}
// Optional: cleanup relationships with status "new" scoped to products in this batch
const productIdsInBatch = [
  ...new Set(expiredTokensPage.map((t) => t.productId).filter(Boolean) as string[]),
];
if (productIdsInBatch.length > 0) {
  ops.push(
    prisma.relationship.deleteMany({
      where: {
        product_id: { in: productIdsInBatch },
        status: "new",
        // entity_id: { in: entityIdsSafeToDelete }
      },
    })
  );
}
```

- Completion and logging.
```153:161:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
await update_job_status(job.id, "completed");
console.log(
  `[Cleanup Job ${job.id}] Completed in ${new Date().getTime() - jobStartTime.getTime()}ms. Deleted tokens: ${totalDeletedTokens}. Failed chunks: ${totalFailedChunks}.`
);
```

---

## Definitions and assumptions (plain language)

- **Assumption: `update_job_status`**
  - We assume a function `update_job_status(jobId: string | number, status: "in_progress" | "completed" | "failed")` exists and updates the scheduler’s job status.

- **What is “drift” (in scheduling)?**
  - The cleanup runs at midnight, but sometimes it starts late (e.g., 01:10). If we naively compute “now - 7 days” at 01:10, we exclude the first 70 minutes of the target day 7 days ago. That gap is “drift.”
  - Using a UTC midnight cutoff for 7 days ago eliminates this gap, so retention aligns to calendar days regardless of when the job starts.

- **Composite-cursor pagination**
  - Think of ordering by two keys: `createdAt` then `token`. After we read a page, we remember the last row’s `(createdAt, token)`.
  - Next page: fetch items where `createdAt > lastCreatedAt` OR (`createdAt == lastCreatedAt` AND `token > lastToken`).
  - This guarantees no duplicates and no missing rows, even if many tokens share the same `createdAt` timestamp.

- **What is a “corpus”?**
  - Here it’s auxiliary data tied to the entity (for example, processed snippets, extracted fields, or any derived artifacts). It references the entity via `entity_id`. We delete it before the entity to satisfy foreign keys.

- **Seven days math and the “* 1000”**
  - 1 second = 1000 milliseconds.
  - 1 day = 24 hours × 60 minutes × 60 seconds = 86,400 seconds.
  - 7 days in milliseconds = `7 × 24 × 60 × 60 × 1000 = 604,800,000` ms.
  - The original code forgot the `× 1000`, subtracting only ~10 minutes from now instead of 7 days.

- **What are N+1 per-token deletes?**
  - If we have `N` expired tokens and we run a separate DB transaction for each token, we execute `N` round-trips (plus the first query) → “N+1.”
  - That’s slow and can overload the database. We fixed this by batching tokens and using a single transaction per batch.

- **What is safe entity deletion?**
  - Only delete an entity if no non-expired token still points to it. Otherwise, you’d delete a record another active/in-progress form still needs.

- **What is FK and FK-safe deletion?**
  - FK = Foreign Key: a constraint saying “child rows must reference an existing parent row.”
  - FK-safe deletion means we delete children first (e.g., `new_corpus`), then the parent (the `entity`) so we do not violate constraints.

## Before vs After – precise changes and why they matter

1) Correct time math and retention boundary
   - Before: `new Date(Date.now() - 7 * 24 * 60 * 60)` (seconds). Also filtered a 24-hour window `(gte 7 days ago AND lt 7 days ago + 1 day)`.
   - After: UTC midnight cutoff 7 days ago; query uses `createdAt < cutoff` to capture all items strictly older than 7 days.
   - Why: prevents missing truly old records and avoids delayed-run drift.

2) Pagination and batching
   - Before: fetched everything at once and then looped per token.
   - After: `take: BATCH_SIZE` with stable `orderBy` and composite-cursor where clause.
   - Why: reduces memory, prevents timeouts, and avoids duplicates/omissions across pages.

3) Transaction strategy
   - Before: one transaction per token (N+1 pattern).
   - After: one transaction per batch including all relevant deletes.
   - Why: far fewer DB round-trips and smaller failure blast radius (one batch fails, rest proceeds).

4) Data safety
   - Before: deleted entities unconditionally (with risky empty-string fallbacks).
   - After: compute `entityIdsSafeToDelete` by checking if any non-expired tokens still reference the entity. Delete only safe ones.
   - Why: prevents accidental data loss.

5) Referential integrity (FK-safe)
   - Before: delete order could violate foreign keys under real schemas.
   - After: delete dependent data → tokens → entities.
   - Why: guarantees schema constraints aren’t violated.

6) Relationship cleanup
   - Before: cleanup was conditional on finding a `relationship` with status `"new"`.
   - After: deletion of tokens/entities is independent; relationship cleanup is optional and non-blocking.
   - Why: aligns with the requirement “delete unsubmitted tokens older than 7 days,” regardless of relationships.

7) Observability
   - Before: minimal logging, only a global try/catch.
   - After: job status transitions (in_progress → completed/failed) and per-batch logs and counters.
   - Why: operational clarity and easier troubleshooting.

## End-to-end flow (mental model)
1. Compute UTC midnight cutoff 7 days ago.
2. Loop: fetch a page of tokens with `createdAt < cutoff` ordered by `(createdAt, token)`.
3. For the page:
   - Derive `entityIdsSafeToDelete` by checking for other tokens with `createdAt >= cutoff`.
   - In one transaction: delete dependent data for safe entities → delete the page’s tokens → delete safe entities → optionally delete `relationship` rows.
4. Move the composite cursor forward and repeat until no more records.
5. Mark job completed; log totals.

## Practical tips
- Indexes: add `publicFormsTokens(createdAt)` and `publicFormsTokens(entityId)` for performance.
- Batch size: start with 500, monitor DB load; tune up or down.
- Idempotency: re-running the job shouldn’t error (deletes are resilient if rows are already gone).

---

With this, you can explain not only what changed but why each change directly improves correctness, performance, and safety.




