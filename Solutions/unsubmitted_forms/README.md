# Cleanup Unsubmitted Forms - Solution

## Overview
Fixed a scheduled job that cleans up unsubmitted forms older than 7 days. The original code had multiple critical bugs that prevented it from working correctly.

## Issues Fixed

### Critical Bugs
1. **Date calculation error** - Missing `* 1000` multiplier (was calculating 7 seconds instead of 7 days)
2. **Incorrect date range** - Used `gte/lt` range that only matched tokens from exactly 7 days ago, missing all older tokens
3. **Transaction syntax** - Used array syntax instead of callback, causing operations to run in parallel instead of sequentially
4. **Deletion order** - Wrong order could violate foreign key constraints
5. **Missing null checks** - Could crash when `entityId` is null

### Performance & Reliability
6. **N+1 query problem** - Fixed by batching relationship queries
7. **Error handling** - Added per-token error handling so one failure doesn't stop the entire job
8. **Logging** - Added metrics for processed, deleted, and error counts

## Key Changes
- Fixed date calculation: `Date.now() - 7 * 24 * 60 * 60 * 1000`
- Changed query to `lt: sevenDaysAgo` to find all tokens older than 7 days
- Batched relationship lookups to avoid N+1 queries
- Used proper transaction callback syntax
- Added validation for `entityId` before deletion
- Improved error handling and observability

## Result
The job now correctly identifies and deletes all expired unsubmitted forms with proper error handling and performance optimizations.
