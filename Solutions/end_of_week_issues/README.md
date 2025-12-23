# End of Week Issues - Solution

## 1. Root Cause Analysis

**What's causing the slowdown?**

The performance degradation is directly correlated with `modelVersion: "v1.3"`. All requests using v1.3 are experiencing severe latency (680-890ms) and timing out, while v1.2 requests remain fast (90-120ms) and successful.

**Supporting evidence from the logs:**

- **v1.2 requests**: 120ms (OK), 90ms (OK), 95ms (OK) - all successful
- **v1.3 requests**: 750ms (Timeout), 820ms (Timeout), 700ms (Timeout), 890ms (Timeout) - all failing
- `/risk-score` and `/funding-approve` endpoints both affected when using v1.3

**Conclusion**: A recent deployment of model version v1.3 introduced a significant performance regression, likely due to increased computational complexity, inefficient model architecture, or resource contention.

## 2. Immediate Action (next 10 minutes)

**Quick fix**: Rollback to v1.2 immediately

1. Update the model version routing/configuration to default all traffic back to v1.2
2. Disable v1.3 in the feature flag or model selection service
3. Verify traffic is flowing to v1.2 and monitor response times return to normal (<150ms)

This should restore service within minutes and stop the timeouts affecting Kenyan lenders.

## 3. Prevention

**Long-term improvement**: Implement automated performance regression testing and gradual rollout

- **Pre-deployment**: Add automated performance benchmarks that must pass before model deployment (e.g., p95 latency < 200ms, p99 < 500ms)
- **Gradual rollout**: Use canary deployments with traffic splitting (1% → 5% → 25% → 100%) and automatic rollback triggers if latency exceeds thresholds
- **Real-time monitoring**: Set up alerts for model version performance metrics with automatic rollback if degradation detected

## 4. Retrospective Notes

- **Model versioning process**: Need stricter performance gates before promoting models to production; v1.3 should not have been deployed without performance validation
- **Monitoring gaps**: Missing real-time alerts on model version performance; should have caught this within minutes, not after 20+ minutes and multiple lender reports
- **Rollback procedures**: Document and automate rollback process for model versions to enable sub-5-minute recovery
- **Testing strategy**: Add load testing and latency benchmarks to model deployment pipeline; v1.3 likely would have failed in staging if properly tested

