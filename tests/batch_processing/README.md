# Batch Processing Challenge

We’re planning for the next 12 months of growth, expecting a **10x increase in SME funding applications** flowing through our Node.js + TypeScript + PostgreSQL backend. Right now, the monolithic service that handles disbursement requests and AI‑driven risk scoring is **showing signs of performance bottlenecks** during peak traffic.

# Task

### 1. Core Implementation

Implement a **minimal Node.js + TypeScript function or endpoint** that:

- Accepts a batch of funding applications (JSON array)
- Flags **high-risk applications** where `fundAmount > 50000` OR `borrowerName` is missing
- Returns a summary object with the structure shown below

### 2. Input/Output Specification

**Sample Input:**

```typescript
interface FundingApplication {
  id: string;
  borrowerName?: string;
  fundAmount: number;
  // other fields optional for this task
}
```

Expected Output:

```
{
  totalApplications: number;
  flaggedApplications: number;
  averageAmount: number; // average of ALL applications, not just flagged ones
}
```

We’re looking for clean reasoning, well commented, clear architecture thinking, and code that your team would respect.

### 3. Deliverables

- Working TypeScript function/endpoint
- Brief comments explaining your approach
- Bonus: 1-2 sentences on optimizing for 1M records
- 3-5 minute Loom video explaining approach and trade-offs

Setup & Environment

- Node.js 18+ and TypeScript 4.5+
- You may use Express.js if creating an endpoint
- Include basic error handling
- No external dependencies required beyond standard Node.js/TS
