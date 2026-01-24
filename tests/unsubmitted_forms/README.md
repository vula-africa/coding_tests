# Cleanup Unsubmitted Forms - Solution

## Video Explanation

[Watch the Loom video](https://www.loom.com/share/3d0413ae4c2845cab8a3e3c93b62f9e3)

## Issues Found & Fixes

### 1. Date Calculation Bug
**Problem:** Missing `* 1000` for milliseconds conversion - was only subtracting ~10 minutes instead of 7 days.

**Fix:** Added `* 1000` to convert seconds to milliseconds.

### 2. Query Logic Error
**Problem:** Original query only found tokens from exactly 7 days ago (a 24-hour window), missing tokens that were 8, 9, 10+ days old.

**Fix:** Changed to `lt: sevenDaysAgo` to find all tokens older than 7 days.

### 3. Foreign Key Constraint Order
**Problem:** Deletion order could fail if corpus items reference entity_id.

**Fix:** Reordered deletions to delete corpus items before entities.

### 4. Orphaned Tokens Not Handled
**Problem:** If no relationship existed, the token was never deleted.

**Fix:** Always delete the token, conditionally delete relationship only if it exists.

### 5. Null EntityId Handling
**Problem:** Passing empty string `""` to delete queries when entityId is null would cause errors.

**Fix:** Only delete entity-related data if entityId actually exists.

### 6. N+1 Query Problem (Performance)
**Problem:** Loop with individual `findFirst` and `$transaction` per token would cause thousands of DB calls at scale.

**Fix:** Refactored to batch approach - collect all IDs upfront, use `deleteMany` with `{ in: [...] }` in a single transaction.

## Trade-offs Considered

- **Batch vs Loop:** Chose batch deletions for O(1) DB round-trips instead of O(N). Trade-off: for very large datasets (50k+ records), the `IN` clause could hit DB limits - would need chunking in production.

- **Memory:** Still loading all expired tokens into memory. For millions of records, would need cursor-based pagination.

- **Atomicity:** Single transaction means all-or-nothing. If one delete fails, everything rolls back - which is generally safer for data consistency.
