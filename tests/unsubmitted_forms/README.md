# Cleanup Unsubmitted Forms - Solution

## Video Explanation

[Watch the Loom video](https://www.loom.com/share/3d0413ae4c2845cab8a3e3c93b62f9e3)

## Issues Found & Fixes

### 1. Date Calculation Bug
**Problem:** Missing `* 1000` for milliseconds conversion - was only subtracting ~10 minutes instead of 7 days.

**Fix:** Added `* 1000` to convert seconds to milliseconds.

### 2. Query Logic Error
**Problem:** Original query only found tokens from exactly 7 days ago (a 24-hour window), missing tokens that were 8, 9, 10+ days old.

**Fix:** Changed to `lt: cutoffDate` to find all tokens older than 7 days.

### 3. Missing Submission Status Check
**Problem:** Query fetched all old tokens regardless of whether the form was submitted, risking deletion of valid submitted data.

**Fix:** Added `submittedAt: null` filter to only fetch unsubmitted tokens.

### 4. Wrong Relationship Deletion
**Problem:** Relationship query only filtered by `product_id` and `status`, which could accidentally delete relationships belonging to other valid tokens that share the same product.

**Fix:** Added `entity_id: { in: entityIds }` to the relationship query to ensure we only delete relationships tied to the specific expired entities.

### 5. Foreign Key Constraint Order
**Problem:** Deletion order could fail if child records reference parent tables.

**Fix:** Reordered deletions: relationships → corpus items → tokens → entities (children before parents).

### 6. Null EntityId Handling
**Problem:** Passing null/undefined values to delete queries would cause errors.

**Fix:** Filter out null values using `filter((id): id is string => Boolean(id))` before batch operations.

### 7. N+1 Query Problem (Performance)
**Problem:** Loop with individual `findFirst` and `$transaction` per token would cause thousands of DB calls at scale.

**Fix:** Refactored to batch approach using `deleteMany` with `{ in: [...] }` in a single transaction.

### 8. Memory Issues with Large Datasets

**Problem:** Loading all expired tokens at once could crash the process with Out of Memory errors.

**Fix:** Implemented batching with `take: BATCH_SIZE` (1000 records) in a while loop to process in chunks.

### 9. Duplicate IDs in Queries

**Problem:** Multiple tokens could share the same entityId/productId, causing unnecessary parameter bloat in IN clauses.

**Fix:** Deduplicate IDs using `[...new Set(...)]` before batch operations.

## Final Solution Features

- **Configurable constants:** `BATCH_SIZE` and `RETENTION_DAYS` at the top for easy adjustment
- **Batched processing:** Handles millions of records without memory issues
- **Safe relationship deletion:** Only deletes relationships tied to expired entities
- **Atomic transactions:** Each batch is processed in a single transaction
- **Observability:** Logs total counts of deleted records for monitoring

## Trade-offs Considered

- **Batching:** Chose 1000 records per batch as a balance between performance and memory. Could be tuned based on server resources.

- **Extra query for relationships:** Added a `findMany` to get relationship IDs before deletion. This adds one query per batch but ensures we never delete the wrong relationships.

- **Atomicity per batch:** Each batch is atomic, not the entire job. If the job fails mid-way, some batches will have been committed. This is acceptable for a cleanup job - it can safely be re-run.
