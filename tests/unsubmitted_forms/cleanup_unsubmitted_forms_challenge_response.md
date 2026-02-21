
# Unsubmitted Forms Code Review Findings

## Below are the issues identified in the code.

---

## 1. Incorrect Date Calculation (Missing Milliseconds)

### ❌ Current Code
```ts
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60);
````

### 🚨 Issue

The calculation is missing conversion to milliseconds.

### ✅ Fix

```ts
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
```

---

## 2.  Unnecessary Variable (`sevenDaysAgoPlusOneDay`)

### ❌ Current Code

```ts
const sevenDaysAgoPlusOneDay = new Date(
  sevenDaysAgo.getTime() + 24 * 60 * 60 * 1000
);
```

#### 🚨 Issue

This variable is unnecessary. We can directly use `sevenDaysAgo` in the query.

### ✅ Fix

Remove `sevenDaysAgoPlusOneDay` entirely and simplify the query logic.

---

## 3.  Incorrect Query Logic for Unsubmitted Forms

### ❌ Current Query

```ts
{
  createdAt: {
    gte: sevenDaysAgo,
    lt: sevenDaysAgoPlusOneDay,
  },
}
```

### 🚨 Issues

* Logically incorrect for the intended purpose.
* Misses tokens older than 8 days.
* Allows data clutter to accumulate indefinitely.
* Does not explicitly check for unsubmitted forms.
* The query fetches all tokens older than 7 days without checking whether the form was actually submitted.

     This could:
     - Delete submitted tokens
     - Delete active entities
     - Cause irreversible data loss  


### 🎯 Intent

Delete forms that:

* Were created **more than 7 days ago**
* Have **not been submitted**

### ✅ Correct Query

```ts
{
  createdAt: { lt: sevenDaysAgo },
  submitted: false,
}
```

> ⚠️ Assumption: The `submitted` boolean field exists in the Prisma model to indicate whether the form has been submitted.

---

## 4.  Dangerous Fallback to Empty String on Delete

### 🚨 Issue

Falling back to an empty string (`""`) when `entityId` is null or missing is dangerous.

This can result in unintended deletions.

### ✅ Fix

Skip deletion entirely if `entityId` is null or undefined.

Additionally, implement early return when there are no expired token:

```ts
if (expiredTokens.length === 0) {
  await update_job_status(job.id, "completed");
  return;
}
```


---

## 5.  N+1 Query Problem (Inside Loop)

### 🚨 Issue

Fetching relationships inside a loop causes:

* One `findFirst` query per token
* Significant database load at scale
* Performance degradation

### ❌ Current Pattern

* Loop through tokens
* Query relationship inside each iteration

### ✅ Fix — Batch Fetch Relationships

```ts
const productIds = expiredTokens.map(t => t.productId);

const relationships = await prisma.relationship.findMany({
  where: {
    product_id: { in: productIds },
    status: "new",
  },
});

const relationshipMap = new Map(
  relationships.map(r => [r.product_id, r])
);
```

This eliminates the N+1 query issue.

---

## 6. Missing guards for Tokens with Missing `entityId`

### 🚨 Issue

Using `""` as fallback for missing `entityId` isn't safe.

### ✅ Fix

Add a guard and exit early:

```ts
if (!token.entityId) {
  continue;
}
```

---

# Trade-offs Considered

---
### Single Massive Transaction vs Per-Token Transaction
All delete operations could have been collected and run once:


✅ This would have been faster and efficient

❌ One bad record rolls back entire cleanup.

---

Instead, the per-token transaction cleanup was implemented

✅ Failure isolation

✅ Safer operationally

❌ Slightly more overhead

Given this is a cleanup job, safety is more important than micro-optimization.

---
## [Click here to view loom video](https://www.loom.com/share/efb964c2e20e491b8f984912801fa96f)