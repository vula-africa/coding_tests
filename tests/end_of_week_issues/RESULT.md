## 1. Root Cause Analysis

**What's causing the slowdown?**
Model version v1.3 is ~7x slower than v1.2.

**Supporting evidence:**

- v1.2 requests: 90ms, 95ms, 120ms → all OK
- v1.3 requests: 680ms, 700ms, 750ms, 820ms, 890ms → mostly timeouts
- Slowdown started at 18:06 when v1.3 requests first appeared

## 2. Immediate Action

Roll back to v1.2 via config/feature flag.

## 3. Prevention

Add automated performance testing to the deployment pipeline that blocks releases if latency exceeds acceptable thresholds.

## 4. Retrospective Notes

- v1.3 introduced a 7x performance regression that wasn't caught before deployment
- No canary/gradual rollout — 100% of traffic hit the slow model immediately
- Monitoring alerts took ~20 minutes to surface the issue
- Need a fast rollback mechanism for model versions
