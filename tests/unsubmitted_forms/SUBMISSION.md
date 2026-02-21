
---

##  Issue Breakdown

### 1. Logic & Correctness (The "Silent Killers")

* **Timestamp Unit Mismatch:** The calculation `Date.now() - 7 * 24 * 60 * 60` subtracted **seconds** instead of **milliseconds**, targeting 10 minutes ago instead of 7 days.
* **The "Window" Leak:** Using `gte` and `lt` for a specific 24-hour slice meant if a job failed once, those records became "orphans" that would never be caught again.
* **State Ignorance:** The script failed to verify if a form was actually *unsubmitted*, risking the deletion of active production data.

### 2. Performance & Scalability

* **The N+1 Explosion:** Executing `findFirst` and a `$transaction` inside a `for` loop creates  database roundtrips. At scale, this causes connection pool exhaustion and application timeouts.
* **Memory Pressure:** Loading all expired tokens into a single array without selection filters or pagination creates an OOM (Out of Memory) risk.

### 3. Data Integrity & Safety

* **Ambiguous Scoping:** Deleting relationships based solely on `product_id` without an `entity_id` check could delete unrelated business data.
* **The Empty String Trap:** Using `|| ""` as a fallback for a null `entityId` is dangerous; it risks executing delete operations against empty or malformed identifiers.
* **Incomplete Cleanup:** If a `relationship` wasn't found, the script skipped the `token` and `entity` deletion entirely, leaving the database cluttered.

---

## Architectural Trade-off: Hard vs. Soft Delete

For this implementation, we have moved forward with a **Hard Delete** approach to satisfy the requirement of "preventing database clutter," but it is important to acknowledge the trade-offs:

### Hard Delete (Current Implementation)

**Pros:**

* **Efficiency:** Keeps the database lean and reduces storage costs.
* **Simplicity:** No need for `where: { deletedAt: null }` filters on every single application query.
* **Performance:** Better long-term index performance and smaller table sizes.

**Cons:**

* **No Safety Net:** Once the job runs, data is unrecoverable without a full database restore.
* **Zero Audit Trail:** Harder to debug historical issues or user complaints regarding "disappearing" forms.

### Soft Delete (Alternative Considered)

**Pros:**

* **Recoverable:** Accidental deletions can be reversed in seconds by nullifying a timestamp.
* **Auditable:** Provides a clear history of when and why a record was retired.

**Cons:**

* **Complexity:** Requires consistent filtering across the entire codebase to avoid showing "deleted" data to users.
* **Storage:** The database continues to grow indefinitely unless a secondary "Hard Delete" archival job is created.

---

## The Optimized Solution

### Key Improvements:

1. **Atomic Batching:** Replaced the loop with a single `prisma.$transaction` containing `deleteMany` operations.
2. **Absolute Expiry:** Changed logic to `createdAt: { lt: sevenDaysAgo }` to ensure no record is ever left behind.
3. **Filtered Selection:** Only querying the specific fields needed (`token`, `entityId`) to reduce fetch payload.
4. **Existence Guarding:** Added `filter(Boolean)` to ensure we only attempt to delete valid, non-null IDs.

---

## Loom Video

https://www.loom.com/share/12be85d4fc264ccba2527874010f8f6a
