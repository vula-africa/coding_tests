# Incident Response Analysis - API Latency Spike

## Root Cause Analysis

**What's causing the slowdown?**

Model version v1.3 has a critical performance regression. Every request using v1.3 is experiencing 680-890ms response times and timing out, while v1.2 requests maintain healthy 90-120ms response times.

**Supporting Evidence:**
- **100% correlation**: All timeout events occur exclusively on modelVersion v1.3
- **Performance degradation**: v1.3 requests are 6-9x slower than v1.2 (750-890ms vs 90-120ms)
- **Consistent pattern**: v1.2 shows 0% failure rate with sub-120ms responses
- **Both endpoints affected**: `/risk-score` and `/funding-approve` both fail on v1.3
- **Timing**: Issue began at 18:06:00Z, exactly when v1.3 traffic started appearing

---

## Immediate Action (Next 10 Minutes)

**ROLLBACK to model version v1.2 immediately**

**Execution:**
1. **Min 0-2**: Route 100% traffic to v1.2 instances OR rollback deployment to previous version
2. **Min 2-4**: Verify latency returns to <150ms baseline across all endpoints
3. **Min 4-6**: Confirm with Kenya lenders that funding approvals are processing
4. **Min 6-10**: Document incident timeline, notify stakeholders (product, customer success, management)

**Why this action:**
- Restores service in <5 minutes vs hours of debugging
- Eliminates customer impact immediately
- v1.2 is proven stable (no issues in logs)
- We debug v1.3 in non-production environment after service restoration


---

## Prevention (Long-term Improvement)

**Implement automated performance regression testing in CI/CD pipeline**

**Specific measures:**

1. **Pre-deployment performance gates:**
   - Mandatory load tests comparing new version vs current production baseline
   - Auto-fail deployment if p95 latency increases >20% or p99 >50% (Locust is a great tool that can help)
   - Require 1000+ test requests across all critical endpoints

2. **Canary deployment strategy:**
   - Route 5% traffic to new version for 30 minutes
   - Auto-rollback if error rate >1% or latency SLA breach
   - Gradual ramp: 5% → 25% → 50% → 100% with monitoring gates

3. **Enhanced monitoring:**
   - Real-time alerting on p95/p99 latency by model version
   - Automatic alerts at 50% threshold breach (Introduce automatic tools,  Prometheus we should NOT wait for customer reports)
   - Dashboard showing version-specific performance metrics

4. **Model-specific benchmarks:**
   - ML models require compute profiling before deployment
   - Document expected latency, memory, CPU usage per model version
   - Regression tests that compare resource consumption between versions

---

## Retrospective Notes

**For next team retro:**

- **Detection gap**: We learned about the issue from customer reports, not our monitoring. Our alerting thresholds are too high or not version-specific. We need alerts that trigger at 50% latency increase, not after complete service degradation.

- **Testing blind spot**: v1.3 passed all pre-deployment checks without catching a 6-9x performance regression. Our current testing doesn't include realistic load testing or version comparison. We need mandatory performance benchmarking as a deployment gate.

- **Deployment risk**: We deployed v1.3 to 100% of traffic immediately, giving us zero safety net. Implementing canary deployments with automatic rollback would have limited customer impact to minutes instead of the full incident window.

- **Communication SLA**: How quickly did we notify affected lenders after detection? We need a defined incident communication playbook - who gets notified, when, and through what channels within the first 15 minutes of P0 incidents.

---

## Expected Timeline Summary

- **18:05:00Z** - Normal operations (v1.2)
- **18:06:00Z** - v1.3 deployment begins, immediate latency spike
- **18:30:00Z** - Detection (current time, 24 minutes after issue started)
- **18:32:00Z** - Rollback decision made
- **18:35:00Z** - Service restored to v1.2
- **18:40:00Z** - Confirmation of resolution + stakeholder notification

**Customer impact**: ~30-35 minutes of degraded service affecting Kenyan SME funding approvals.


## Loom Video

- https://www.loom.com/share/0d0649fe5e2c44ec906e7438dd93a98f