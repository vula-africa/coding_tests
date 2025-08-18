We’re planning for the next 12 months of growth, expecting a **10x increase in SME funding applications** flowing through our Node.js + TypeScript + PostgreSQL backend. Right now, the monolithic service that handles disbursement requests and AI‑driven risk scoring is **showing signs of performance bottlenecks** during peak traffic.

- Implement a **minimal Node.js + TypeScript function or endpoint** that:
  - Accepts a batch of funding applications (JSON array).
  - Flags **high-risk applications** where `fundAmount > 50000` or `borrowerName` is missing.
  - Returns a **summary object**:
    ```tsx
    ts;
    CopyEdit;
    {
      totalApplications: number;
      flaggedApplications: number;
      averageAmount: number;
    }
    ```
- **Bonus:** In 1–2 lines, explain **how you’d optimise this for 1M records**.

We’re looking for **clean reasoning, clear architecture thinking, and code that your team would respect**.
