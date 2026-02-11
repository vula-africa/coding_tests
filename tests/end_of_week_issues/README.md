# It’s Friday 6:30 PM:

Within 20 mins, API latency has spiked 200%.
3 lenders in Kenya are reporting timeouts when approving SME funding requests.
We’ve attached a mock API log file.

## Your Challenge

**Analyze the logs below and provide:**

1. **Root Cause Analysis**

   - What's causing the slowdown?
   - Supporting evidence from the logs

2. **Immediate Action** (next 10 minutes)

   - One quick fix you'd implement right now

3. **Prevention**

   - One long-term improvement to prevent recurrence

4. **Retrospective Notes**

   - 3-4 bullet points for next team retro

**Expected time: 10-25 minutes**

## Output

Please record a loom video discussing the challenge outputs

### Mock Log File

```
[
  { "timestamp": "2025-08-01T18:05:00Z", "endpoint": "/risk-score", "responseTimeMs": 120, "status": "OK", "modelVersion": "v1.2" },
  { "timestamp": "2025-08-01T18:06:00Z", "endpoint": "/risk-score", "responseTimeMs": 750, "status": "Timeout", "modelVersion": "v1.3" },
  { "timestamp": "2025-08-01T18:06:10Z", "endpoint": "/funding-approve", "responseTimeMs": 680, "status": "OK", "modelVersion": "v1.3" },
  { "timestamp": "2025-08-01T18:06:20Z", "endpoint": "/risk-score", "responseTimeMs": 820, "status": "Timeout", "modelVersion": "v1.3" },
  { "timestamp": "2025-08-01T18:06:30Z", "endpoint": "/risk-score", "responseTimeMs": 90,  "status": "OK", "modelVersion": "v1.2" },
  { "timestamp": "2025-08-01T18:06:40Z", "endpoint": "/funding-approve", "responseTimeMs": 700, "status": "Timeout", "modelVersion": "v1.3" }
  { "timestamp": "2025-08-01T18:07:00Z", "endpoint": "/risk-score", "responseTimeMs": 95, "status":
   "OK", "modelVersion": "v1.2" },
  { "timestamp": "2025-08-01T18:07:15Z", "endpoint": "/risk-score", "responseTimeMs": 890,
  "status": "Timeout", "modelVersion": "v1.3" }
]
```
---

# API Latency Incident – Root Cause Analysis

**Scenario**  
**Time:** Friday, 6:30 PM  
**Incident:** API latency spiked ~200% within 20 minutes.  
**Impact:** 3 lenders in Kenya reporting timeouts while approving SME funding requests.

This document analyzes the provided mock API logs and outlines root cause, immediate mitigation, long-term prevention, and retrospective notes.

---

## 1. Root Cause Analysis

### What’s causing the slowdown?

The slowdown is caused by the **newly deployed model version `v1.3`**, which introduces significantly higher response times and frequent timeouts, particularly on the `/risk-score` endpoint. Since `/funding-approve` depends on risk scoring, the latency cascades into funding approval failures.

### Supporting Evidence from the Logs

- **Clear performance regression between model versions**
  - `v1.2` responses:
    - `/risk-score` at `18:05:00Z` → **120ms (OK)**
    - `/risk-score` at `18:06:30Z` → **90ms (OK)**
    - `/risk-score` at `18:07:00Z` → **95ms (OK)**
  - `v1.3` responses:
    - `/risk-score` at `18:06:00Z` → **750ms (Timeout)**
    - `/risk-score` at `18:06:20Z` → **820ms (Timeout)**
    - `/risk-score` at `18:07:15Z` → **890ms (Timeout)**

- **Downstream impact**
  - `/funding-approve` using `v1.3` shows elevated latency and timeouts:
    - `680ms (OK)` at `18:06:10Z`
    - `700ms (Timeout)` at `18:06:40Z`

- **Mixed versions in production**
  - Requests are being served by both `v1.2` and `v1.3`, suggesting a partial rollout or canary deployment where `v1.3` is unhealthy.

**Conclusion:**  
`v1.3` introduces a performance regression (likely heavier computation, blocking I/O, or unoptimized model inference), causing timeouts and increased latency.

---

## 2. Immediate Action (Next 10 Minutes)

### One Quick Fix to Implement Right Now

**Rollback or disable model version `v1.3` and route all traffic to `v1.2`.**

Why this works:
- `v1.2` is consistently fast (<120ms) and stable.
- Rolling back immediately restores SLA for lenders.
- Requires minimal investigation and is reversible.

Optional fast follow-up:
- Temporarily increase timeout thresholds for `/funding-approve` to reduce user-facing failures while rollback propagates.

---

## 3. Prevention (Long-Term Improvement)

### One Long-Term Improvement

**Introduce automated performance gating in the deployment pipeline for ML/model versions.**

Specifically:
- Enforce **latency and timeout SLO checks** during canary deployments.
- Automatically abort or rollback a release if:
  - p95 latency exceeds baseline (e.g., +20%)
  - Timeout rate crosses a defined threshold
- Separate **model rollout** from **API rollout**, with explicit observability per model version.

This ensures regressions like `v1.3` never reach a majority of production traffic.

---

## 4. Retrospective Notes (For Team Retro)

- We detected functional correctness but **missed performance regression** during `v1.3` validation.
- Canary signals were available but **not wired to automated rollback**.
- Mixed model versions in production increased debugging complexity.
- We need clearer ownership and runbooks for **model-induced incidents**, especially during off-hours.
