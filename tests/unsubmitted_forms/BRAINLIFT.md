# Brainlift: Unsubmitted Forms Cleanup Walkthrough

## Quick context
- Job: `unsubmitted_forms/cleanup_unsubmitted_forms.ts`
- Goal: delete unsubmitted public form tokens older than 7 days and safely clean related data.

## Snippet citations to show on screen

1) Imports and batch size
```24:31:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

// Process cleanup in manageable chunks to reduce DB load and memory footprint
const BATCH_SIZE = 500;
```

2) UTC midnight cutoff (delayed-run safe)
```38:45:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
await update_job_status(job.id, "in_progress");
// Use UTC midnight cutoff 7 days ago to avoid drift when the job runs late
const cutoff = new Date();
cutoff.setUTCHours(0, 0, 0, 0);
cutoff.setUTCDate(cutoff.getUTCDate() - 7);

console.log(`[Cleanup Job ${job.id}] Starting. Deleting tokens created before (UTC cutoff) ${cutoff.toISOString()}`);
```

3) Composite-cursor pagination (createdAt, token)
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

4) Safe entity determination (keep if referenced by non-expired tokens)
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

5) FK-safe delete order in a batch transaction
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

6) Optional relationship cleanup (non-blocking)
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

7) Progress bookkeeping and cursors
```138:151:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
await prisma.$transaction(ops);
// ...
lastCreatedAt = expiredTokensPage[expiredTokensPage.length - 1].createdAt;
lastToken = expiredTokensPage[expiredTokensPage.length - 1].token;
```

8) Job completion and metrics log
```153:161:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
await update_job_status(job.id, "completed");
console.log(
  `[Cleanup Job ${job.id}] Completed in ${new Date().getTime() - jobStartTime.getTime()}ms. Deleted tokens: ${totalDeletedTokens}. Failed chunks: ${totalFailedChunks}.`
);
```

## Demo flow cues
- Start at snippet (2): explain UTC cutoff and why local-time midnight can be wrong.
- Move to snippet (3): show createdAt < cutoff and composite cursor.
- Jump to snippet (4): explain safe entity logic with a quick example (entity has newer token ⇒ keep).
- Snippet (5): point out delete order.
- Snippet (6): optional relationships are non-blocking.
- Snippet (7) and (8): show cursors and completion logs.


