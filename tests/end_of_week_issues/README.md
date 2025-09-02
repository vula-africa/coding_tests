# API Latency Spike – RCA and Action Plan

## Root Cause Analysis
The slowdown is caused by the deployment of **model version v1.3**, likely due to unoptimized model inference or increased computational complexity.  
This caused SME funding delays, risking lender trust.

**Supporting evidence from logs:**
- Calls using **v1.2** return fast (90–120 ms) and succeed.
- Calls using **v1.3** show extreme latency (680–890 ms) and repeated timeouts across `/risk-score` and `/funding-approve`.
- The spike started at **18:06**, exactly when v1.3 requests appear.

👉 **Conclusion:** The new model version introduced heavy processing or resource contention.

---

## Immediate Action (next 10 minutes)
**Quick fix:** DevOps team to **roll back traffic from v1.3 → v1.2** immediately (via feature flag, routing rule, or deployment rollback).  
Monitor latency post-rollback to confirm stability.

This will restore stability for lenders in Kenya and stop timeout errors.

---

## Prevention
**Long-term improvements:**
- Adopt a **canary release process**: send only a small % of traffic to new model versions first.
- **Mandate load testing in staging** for new model versions to catch latency issues early.
- Add **automated alerts on p95/p99 latency** per model version.
- Ensure monitoring dashboards track **latency/errors per version**.

---

## Retrospective Notes
Topics for next retro:
- Why v1.3 was deployed without detecting latency regressions.
- Gaps in monitoring (latency only noticed after lender complaints).
- Need for **model version–specific dashboards/alerts**.
- Review communication between **data science and engineering** to ensure performance SLAs are defined for new models.
- Agreement to enforce **canary + rollback** as standard release practice.
