# Cleanup Job – From Original State to Final Design

This document explains, from the original implementation, what we changed, why we changed it, and how the new version works. It is written to help you internalize the design and to serve as a clear narrative for reviewers.

## Executive summary
- Original code deleted almost nothing (time math bug) and, when it did, it risked data loss and poor performance (per-token transactions, wrong filter window, unsafe entity deletes).
- Final solution uses:
  - A UTC midnight cutoff 7 days ago
  - Composite-cursor pagination on `(createdAt, token)`
  - Batched transactions with FK-safe delete order
  - Safe entity deletion guard (keep entity if any non-expired token exists)
  - Optional, non-blocking relationship cleanup
  - Clear logging and job status transitions

## Original implementation (what we started with)
```typescript
// Key parts of the original for reference
// Wrong time math and 1-day window
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60);
const sevenDaysAgoPlusOneDay = new Date(
  sevenDaysAgo.getTime() + 24 * 60 * 60 * 1000
);

const expiredTokens = await prisma.publicFormsTokens.findMany({
  where: {
    createdAt: {
      gte: sevenDaysAgo,   // from ~now (10 min earlier)!
      lt: sevenDaysAgoPlusOneDay, // narrow 24-hour window
    },
  },
});

for (const token of expiredTokens) {
  const relationship = await prisma.relationship.findFirst({
    where: {
      product_id: token.productId,
      status: "new",
    },
  });

  if (relationship) {
    await prisma.$transaction([
      prisma.relationship.delete({ where: { id: relationship.id } }),
      prisma.publicFormsTokens.delete({ where: { token: token.token } }),
      prisma.new_corpus.deleteMany({ where: { entity_id: token.entityId || "" } }),
      prisma.entity.delete({ where: { id: token.entityId || "" } }),
    ]);
  }
}
```

### Problems in the original
1) Incorrect time math (seconds, not milliseconds) – almost no tokens matched.
2) Wrong filter window – captured only items between 6 and 7 days ago, not “older than 7 days”.
3) Relationship dependency – tokens deleted only if a `relationship(status="new")` existed; this violates the requirement.
4) Unsafe `entityId || ""` fallbacks – can target invalid IDs and hide nulls.
5) N+1 pattern – one transaction per token → high load, long runtimes.
6) Referential-integrity risk – delete order didn’t clearly ensure children before parents in all cases.
7) No pagination – one large query could exhaust memory/timeout.
8) Limited observability – minimal counters and status signaling.
9) No explicit “unsubmitted” check – schema-dependent; at minimum, the age cutoff must be correct.
10) Entity deletion risk – could delete entities still referenced by other unexpired tokens.

## Final design (what we implemented)
The final implementation lives in `unsubmitted_forms/cleanup_unsubmitted_forms.ts`. Below are exact citations you can show while explaining.

### UTC midnight cutoff (eliminates delayed-run drift)
```38:45:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
await update_job_status(job.id, "in_progress");
// Use UTC midnight cutoff 7 days ago to avoid drift when the job runs late
const cutoff = new Date();
cutoff.setUTCHours(0, 0, 0, 0);
cutoff.setUTCDate(cutoff.getUTCDate() - 7);
```
- Why: If the job runs late (e.g., 01:10), a relative “now − 7 days” misses the hour between midnight and 01:10. UTC‑midnight cutoff aligns retention to calendar days.

### Composite-cursor pagination on (createdAt, token)
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
  select: { token: true, entityId: true, productId: true, createdAt: true },
  orderBy: [{ createdAt: "asc" }, { token: "asc" }],
  take: BATCH_SIZE,
});
```
- Why: Stable ordering avoids duplicates/skips when many rows share the same `createdAt`.

### Safe entity deletion guard
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
- Why: Prevents deleting an entity that is still referenced by a non-expired token.

### FK-safe delete order within a batch transaction
```106:120:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
const ops = [] as Parameters<typeof prisma.$transaction>[0];
// Delete dependent data first
if (entityIdsSafeToDelete.length > 0) {
  ops.push(
    prisma.new_corpus.deleteMany({ where: { entity_id: { in: entityIdsSafeToDelete } } })
  );
}
// Delete tokens in batch
ops.push(
  prisma.publicFormsTokens.deleteMany({ where: { token: { in: tokenIdsInBatch } } })
);
// Delete entities that are safe to delete
if (entityIdsSafeToDelete.length > 0) {
  ops.push(prisma.entity.deleteMany({ where: { id: { in: entityIdsSafeToDelete } } }));
}
```
- Why: Children first, then parents, to satisfy referential constraints.

### Optional relationship cleanup (non-blocking)
```121:136:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
// Optional: clean up relationships with status "new" tied to these entities or products
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
- Why: Keeps the domain tidy without blocking the primary cleanup logic.

### Progress bookkeeping and completion logs
```138:161:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
await prisma.$transaction(ops);
// ... accumulate counters and advance cursors ...
await update_job_status(job.id, "completed");
console.log(
  `[Cleanup Job ${job.id}] Completed in ${new Date().getTime() - jobStartTime.getTime()}ms. Deleted tokens: ${totalDeletedTokens}. Failed chunks: ${totalFailedChunks}.`
);
```
- Why: Strong observability and clear job lifecycle states.

## Before → After mapping
- Time logic:
  - Before: `Date.now() - 7 * 24 * 60 * 60` (seconds) + 1-day window.
  - After: UTC midnight cutoff 7 days ago; filter `createdAt < cutoff` to match “older than 7 days”.
- Querying:
  - Before: single bulk `findMany`, then per-token transactions.
  - After: paginated `findMany` in batches, one transaction per batch.
- Safety:
  - Before: delete entity unconditionally using `entityId || ""`.
  - After: delete entities only when they are not referenced by any non-expired token.
- Integrity:
  - Before: unclear order could violate FKs.
  - After: children → tokens → entities.
- Scope:
  - Before: gated by `relationship(status="new")`.
  - After: relationship cleanup is optional and non-blocking.
- Observability:
  - Before: minimal logs and status.
  - After: counters, progress logs, and `in_progress/completed/failed` status transitions.

## Trade-offs considered
- Batching vs. one big transaction: batching chosen to limit blast radius and avoid timeouts.
- Safe-entity guard vs. fewer queries: chose data safety over minimal queries (small extra query per batch).
- UTC cutoff vs. relative rolling time: chose UTC cutoff to align with calendar retention and avoid delayed-run gaps.

## Testing guide (how to gain confidence)
1) Seed: create tokens across boundaries – 8 days ago, exactly 7 days ago at 00:00 UTC, 6 days ago, and today; mix multiple tokens for the same entity.
2) Run job: verify only `createdAt < cutoff` tokens deleted.
3) Entity safety: ensure entities referenced by any token with `createdAt >= cutoff` remain.
4) FK order: temporarily add FKs (if not already) and confirm no violations during batch deletes.
5) Pagination: seed > BATCH_SIZE records and confirm no skips/dupes by comparing counts across runs.
6) Observability: assert counters and status transitions are logged as expected.

## Operational notes
- Batch size is `500` by default; tune per DB capacity.
- Add indexes: `publicFormsTokens(createdAt)` and `publicFormsTokens(entityId)` for the queries we run most.
- If your schema has explicit submission markers (`submittedAt` or `isSubmitted`), add them to the `where` clause to be even stricter about “unsubmitted”.

---
This document, combined with `BRAINLIFT.md` and `PRESENTATION.md`, should equip you to explain the motivation, implementation, and trade-offs confidently.




