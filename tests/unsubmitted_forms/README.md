# Cleanup Unsubmitted Forms – Design & Improvements

## Overview

This scheduled job runs daily to clean up **public forms that were started but never submitted** and are **older than 7 days**.

When a user visits a public form:
- A **token** is created
- An **entity** is created to own the data
- Answers, corpus items, and relationships are associated via that entity

If the form is never submitted, this data should be cleaned up to prevent database clutter and potential data inconsistencies.

---

## Problems in the Original Implementation

### 1. Incorrect Time Window Logic
- The original code queried tokens created in a **24-hour window exactly 7 days ago**
- This caused many expired tokens to never be deleted

✅ **Fix**: Use `createdAt < sevenDaysAgo` to correctly capture *all* expired records.

---

### 2. Entity Deletion Was Unsafe
- Entities were deleted **without checking if submitted forms existed**
- This could lead to **data loss** when:
  - An entity had both submitted and unsubmitted forms
  - The cleanup removed the entity entirely

✅ **Fix**:  
Before deleting an entity, check if **any submitted forms exist**.

---

### 3. Race Conditions & Inconsistent Reads
- Checks and deletions were done using the global Prisma client
- Between the check and delete:
  - A form could be submitted
  - The entity could still be deleted

✅ **Fix**:  
Run **all checks and deletions inside a single Prisma transaction** using the same transaction client (`tx`).

This guarantees:
- Atomicity
- Consistent reads
- Safe deletion logic

---

### 4. Redundant Work & Poor Scalability
- The job looped over tokens instead of entities
- This caused:
  - Duplicate deletes
  - Unnecessary queries

✅ **Fix**:  
Group expired tokens by `entityId` and clean up **once per entity**.

---

### 5. Weak Observability & Debuggability
- Minimal logging
- No visibility into:
  - Why an entity was skipped
  - How many records were deleted
  - Where failures occurred

✅ **Fix**:  
Add structured, contextual logs:
- Job lifecycle (start / success / failure)
- Entity-level decisions
- Transaction-level failures

---

## Assumptions Made

Due to the absence of a complete database schema, the following assumptions were made:

- `publicFormsTokens.submittedAt !== null` indicates a submitted form
- Tokens, corpus items, and relationships are all tied to `entityId`
- Deleting an entity cascades **only when it is safe to do so**

These assumptions are documented explicitly to avoid hidden behavior.

---

## Future Improvements

### 1. Partial Cleanup Strategy
Instead of skipping entities with submitted forms:
- Delete **only unsubmitted tokens**
- Retain the entity and submitted data

This would reduce storage usage while preserving valid user data.

---

### 2. Soft Deletes
Introduce `deletedAt` fields for:
- Entities
- Tokens
- Related records

This would:
- Allow recovery
- Improve auditability
- Reduce risk

---

### 3. Batch Deletion
Replace per-entity transactions with:
- Batched deletes
- Controlled concurrency

This would improve performance for large datasets.

---

### 4. Metrics & Monitoring
Add:
- Counters for deleted entities/tokens
- Alerts for abnormal deletion rates
- Job duration tracking

---

### 5. Schema-Level Constraints
- Foreign keys with `ON DELETE CASCADE`
- Indexes on `createdAt`, `entityId`, `submittedAt`

These would simplify logic and improve performance.

---