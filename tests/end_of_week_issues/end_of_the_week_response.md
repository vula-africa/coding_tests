# End of Week Issue

---

## 🚨 Incident Summary

**Scenario:**  
Within 20 minutes, API latency spiked by **200%**.  
Three lenders in Kenya reported timeouts while approving SME funding requests.

---

## 🔍 Root Cause Analysis

### ❓ What’s causing the slowdown?

From log analysis, **API version v1.3** is responsible for the latency spike.

- Every timeout and degraded response is attributed to **v1.3**
- **v1.2** remained stable throughout the incident
- v1.2 consistently responded in **under 120ms**
- The latency affected both:
  - `/risk-score`
  - `/funding-approve`

Since multiple endpoints were impacted, this rules out an endpoint-specific issue and strongly indicates that the **model version (v1.3)** is the root cause.

---

## 📊 Supporting Evidence from Logs

| Version  | Avg Response Time | Requests | Timeouts |
|----------|-------------------|----------|----------|
| v1.2     | ~102ms            | 3        | 0        |
| v1.3     | ~760ms            | 5        | 4        |

**Observation:**  
v1.3 shows a ~7x latency increase and a high timeout rate.

---

## ⚡ Immediate Action (Next 10 Minutes)

### ❓ One quick fix to implement immediately

- Roll back deployment from **v1.3 → v1.2**
- Verify next **2–3 requests** return to <150ms latency
- Confirm resolution with the 3 affected lenders

---

## 🛡️ Prevention Strategy

### ❓ One long-term improvement to prevent recurrence

#### ✅ Performance Benchmarking Before Any Release

Every new model version must pass a **response time SLA gate** before deployment.

Example SLA Requirement:
- API latency must be **<150ms** under simulated production load

If v1.3 had been benchmarked against this threshold in a pre-production environment, the regression would have been detected before impacting lenders.

---

## 🔁 Retrospective Notes

- We deployed to production without staging validation. response time for v1.3 was not tested against production-like traffic before rollout. 
- We should have had a response time testing and sign-off before any model version change reaches lenders.
- We had no performance gate in our pipeline. There was nothing stopping a slower model from shipping. A latency regression check in CI/CD would have caught this automatically before deployment even completed.
- Our monitoring was reactive, not proactive. Alerts didn't fire — lender complaints did. We need per-model-version latency dashboards with automatic alerting so we're never the last to know when something breaks.


---

## 📌 Key Takeaway

Production releases must be gated by measurable performance benchmarks.  
If it cannot pass in staging under realistic load, it should never reach lenders.

---

## [Click here to view loom video](https://www.loom.com/share/b9d673dfae9448e095a70ac68930a5b4)
