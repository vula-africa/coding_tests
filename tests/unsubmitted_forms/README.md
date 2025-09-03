# Unsubmitted Forms Challenge 

## Loom Video: https://www.loom.com/share/56869e22b00c412f9de54c957c28af87?sid=9ea7f8af-503b-4743-ad4c-6a631b931763

## Cleanup Unsubmitted Forms Job - Issues and Solutions

### Problems Found
- **Incorrect Date Calculation**: Used seconds instead of milliseconds (`7 * 24 * 60 * 60`). The 24-hour window (`gte` and `lt`) limited cleanup to one day.
- **Inefficient Queries (N+1)**: Looped through tokens with `findFirst` for relationships, making one DB call per token, slow for large datasets.
- **Unsafe Entity ID Handling**: Used `token.entityId || ""`, risking runtime errors in Prisma deletions for null/undefined IDs.
- **No Unsubmitted Form Check**: Did not explicitly verify forms were unsubmitted, risking deletion of submitted forms.
- **Single Relationship Deletion**: Only deleted the first relationship per token, leaving others behind if multiple existed.
- **Partial Failures**: Per-token transactions could fail mid-loop, leaving inconsistent database state.
- **Tokens Without Relationships Skipped**: Expired tokens without relationships were not cleaned, causing clutter.
- **Weak Error Handling**: Rethrew errors, risking job crashes; no per-token error handling.
- **Poor Logging/Status Updates**: Minimal logging; job status updated incorrectly if loop failed partially.

### Solutions Implemented
- **Fixed Date Calculation**: Used milliseconds with constants (`DAYS_TO_EXPIRE = 7`, `MS_PER_DAY = 24 * 60 * 60 * 1000`); simplified to `lte` for all tokens older than 7 days.
- **Optimized Performance**: Bulk-fetched tokens and relationships; used in-memory `Map` for O(1) lookups; used `deleteMany` for all 'new' relationships per product.
- **Safe ID Handling**: Filtered null/undefined `entityId` values; used conditional deletions to prevent errors.
- **Filtered Unsubmitted Forms**: Checked for 'new' relationships via `Map` to ensure only unsubmitted forms are deleted; logged skipped tokens.
- **Handled Multiple Relationships**: Used `deleteMany` to remove all 'new' relationships for a `productId`.
- **Resilient Transactions**: Implemented per-token transactions with try-catch for partial success; logged failures and continued processing.
- **Cleaned Skipped Tokens**: Logged tokens without 'new' relationships for monitoring; preserved original intent but noted potential cleanup extension.
- **Improved Error Handling**: Removed error rethrow; caught and logged per-token and critical errors without crashing.
- **Enhanced Logging/Status**: Added logs for early exits, success/failure/skip counts; job marked "completed" with partial failures (logged) or "failed" on critical errors.
