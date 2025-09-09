# Presentation Script: Unsubmitted Forms Cleanup (3–5 minutes)

## 0:00 – 0:20 Intro
- Purpose: nightly job to delete unsubmitted tokens older than 7 days and clean up related data.
- Risks we fixed: wrong time math, narrow date window, N+1 transactions, unsafe entity deletions, FK issues, lack of batching/observability.

## 0:20 – 0:50 Correctness: UTC Cutoff
- Show code: cutoff creation
```38:45:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
const cutoff = new Date();
cutoff.setUTCHours(0, 0, 0, 0);
cutoff.setUTCDate(cutoff.getUTCDate() - 7);
```
Talking points:
- UTC midnight avoids “job ran at 01:10” drift; retention aligns to calendar days.

## 0:50 – 1:30 Scalable pagination
- Show code: composite cursor query
```50:76:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
createdAt: { lt: cutoff },
orderBy: [{ createdAt: "asc" }, { token: "asc" }],
// OR/AND composite gating using lastCreatedAt + lastToken
```
Talking points:
- Stable ordering across ties on createdAt; no duplicates/skips; take=BATCH_SIZE.

## 1:30 – 2:10 Data safety first
- Show code: decide safe entities
```88:104:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
createdAt: { gte: cutoff }, // keep entity if any non-expired token exists
```
Talking points:
- Only delete entity when no other active/unexpired tokens reference it.

## 2:10 – 2:40 Integrity-preserving deletes
- Show code: ops order in transaction
```106:120:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
new_corpus.deleteMany → publicFormsTokens.deleteMany → entity.deleteMany
```
Talking points:
- Children first then parents to satisfy FKs.

## 2:40 – 3:10 Optional relationship cleanup
- Show code
```121:136:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
relationship.deleteMany({ product_id IN ..., status: "new" })
```
Talking points:
- Non-blocking; can scope further by entity_id if schema requires.

## 3:10 – 3:40 Observability & completion
- Show code
```153:161:/Users/leewelmwangi/Development/V/coding_tests/tests/unsubmitted_forms/cleanup_unsubmitted_forms.ts
update_job_status(... "completed");
console.log(... totals ...);
```
Talking points:
- Status transitions: in_progress → completed/failed; counters for tokens and failed chunks.

## 3:40 – 4:30 Trade-offs
- Batching over single mega-transaction for resilience.
- Extra query for safe-entity guard is acceptable to prevent data loss.
- Index guidance: add `publicFormsTokens(createdAt)`, `publicFormsTokens(entityId)`.

## 4:30 – 5:00 Close
- Result: Correct, safe, and scalable cleanup; clear logs; minimal DB contention.
- Next steps: configurable retention days, metrics/alerts.


