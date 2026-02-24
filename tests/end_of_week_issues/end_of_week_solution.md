# End of Week Issues - Solution

Loom Video:  https://www.loom.com/share/c9586d8335274441ae2cf762201f7093

## Problem Summary

**Situation:** Friday 6:30 PM - API latency spiked 200% within 20 minutes. 3 lenders in Kenya reporting timeouts on SME funding approvals.

**Timeline:** Issues started around 18:06:00 when `modelVersion: "v1.3"` was deployed to 100% traffic.

---

## 1. Root Cause Analysis

### What's Causing the Slowdown?

**Primary Cause:** `modelVersion: "v1.3"` is causing severe performance degradation (6-10x slower than v1.2).

### Supporting Evidence from Logs

**Performance Comparison:**

- **v1.2 requests:** 90-120ms response time, 100% success rate (3/3 requests)
- **v1.3 requests:** 680-890ms response time, 80% timeout rate (4/5 requests timed out)

**Timeline Analysis:**

- `18:05:00` - v1.2 working normally (120ms, OK)
- `18:06:00` - v1.3 appears, first timeout (750ms, Timeout)
- `18:06:30` - v1.2 still working fine (90ms, OK)
- `18:07:15` - v1.3 continues timing out (890ms, Timeout)

**Key Observations:**

- All v1.2 requests: Fast and successful
- All v1.3 requests: Slow with high timeout rate
- No correlation with endpoint type (`/risk-score` vs `/funding-approve`)
- Strong correlation with model version

**Conclusion:** v1.3 was deployed to 100% traffic without performance validation, causing immediate system degradation.

---

## 2. Immediate Action (Next 10 Minutes)

### Step-by-Step Rollback Procedure

#### Step 1: Rollback Configuration (2 minutes)

- Change configuration to route 100% traffic to `modelVersion: "v1.2"`
- Verify config change is applied and propagated to all instances

#### Step 2: Verify Recovery (3 minutes)

- Monitor logs for next 2-3 requests
- Confirm response times return to ~100ms range
- Confirm status returns to "OK" (no more timeouts)

#### Step 3: Communicate Resolution (2 minutes)

- Notify Kenya lenders: "Issue resolved, system restored to previous stable version"
- Update internal incident channel with resolution status

#### Step 4: Monitor Stability (3 minutes)

- Watch for 5-10 minutes to ensure stability
- Check error rates and latency metrics return to baseline
- Confirm no new timeouts occur

**Expected Outcome:** System latency returns to normal (~100ms), timeout rate drops to 0%.

---

## 3. Prevention (Long-Term Improvement)

### Implement Canary Deployments with Automatic Rollback

Since v1.3 went to 100% traffic immediately without validation, implement:

#### 1. Gradual Rollout Strategy

- Deploy to 5% traffic → monitor 10 minutes → promote to 25% → monitor 10 minutes → 50% → monitor 15 minutes → 100%
- Only promote to next tier if all metrics remain healthy

#### 2. Automatic Rollback Triggers

- If average response time > 200ms (2x baseline of ~100ms)
- If timeout rate > 5%
- If error rate > 2%
- If p95 latency increases > 50%

#### 3. Pre-Deployment Validation

- Load test new model versions in staging with production-like traffic patterns
- Performance regression tests comparing new version vs current version
- Validate response times, error rates, and resource utilization

#### 4. Monitoring & Alerting

- Real-time dashboards showing performance metrics by model version
- Automated alerts for performance degradation by model version
- Alert on-call engineer when thresholds are breached

#### Benefits

- Prevents deploying slow model versions to all traffic
- Catches performance issues early with minimal user impact
- Provides data-driven decisions for promotion vs rollback

---

## 4. Retrospective Notes

### Key Learnings for Next Team Retro

- **Model Deployment Process:** v1.3 was deployed to 100% traffic without gradual rollout or performance validation. Need to implement canary deployments with automatic rollback mechanisms.

- **Pre-Deployment Testing:** No load testing or performance regression tests were conducted before production deployment. Should add mandatory performance benchmarks in staging environment before any production rollout.

- **Monitoring & Alerting Gaps:** No alerts triggered for model version performance degradation. Need to add real-time alerts for response time increases by model version, with automatic escalation when thresholds are breached.

- **Friday Evening Deployments:** Critical model changes were deployed on Friday afternoon without proper on-call coverage. Should establish "no-deploy Fridays" policy or require explicit on-call approval for Friday deployments, especially for high-risk changes like model versions.

---