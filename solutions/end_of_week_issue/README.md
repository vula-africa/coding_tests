# Incident Analysis: API Latency Spike

This document provides a root cause analysis, immediate actions, and preventative measures for the API latency incident that occurred on Friday evening.

### 1. Root Cause Analysis

**What is causing the slowdown?**
The immediate root cause of the latency spike and timeouts is the **deployment of a new model, `modelVersion: "v1.3"`**.

**Supporting Evidence from the Logs:**
A clear pattern in the logs demonstrates that all API calls using the previous model version (`v1.2`) are fast and successful, while calls involving the new version (`v1.3`) are extremely slow and result in timeouts.

-   **Stable Performance (v1.2):**
    -   `{"responseTimeMs": 120, "status": "OK", "modelVersion": "v1.2" }`
    -   `{"responseTimeMs": 90, "status": "OK", "modelVersion": "v1.2" }`
    -   These responses are consistently fast (around 100ms) and successful.

-   **Degraded Performance (v1.3):**
    -   `{"responseTimeMs": 750, "status": "Timeout", "modelVersion": "v1.3" }`
    -   `{responseTimeMs": 820, "status": "Timeout", "modelVersion": "v1.3" }`
    -   These responses are **7-8x slower** and are consistently failing. The new model version is either unable to handle the production load or has a critical performance bug.

### 2. Immediate Action (Next 10 Minutes)

**One quick fix:**
The most critical and immediate action is to **roll back the deployment to the last known stable version, `v1.2`**. This will immediately restore service for the affected lenders and prevent further business impact. The priority is always to stabilize the system, especially on a Friday evening.

### 3. Prevention (Long-Term Improvement)

**One long-term improvement:**
To prevent this from recurring, we must implement a **canary release strategy** for deploying new models. Instead of deploying `v1.3` to 100% of traffic at once, a canary release would route a small percentage of traffic (e.g., 1-5%) to the new version first. We can then monitor performance and error rates in a controlled way. If metrics remain healthy, we can gradually increase traffic. This would have caught the `v1.3` slowdown immediately and automatically triggered a rollback before it impacted a significant number of users.

### 4. Retrospective Notes

Here are key points for the next team retrospective:

* **Deployment Process:** Why was a poorly performing model deployed to production, especially on a Friday evening? We need to review our pre-deployment checklist and performance testing protocols.
* **Monitoring & Alerting:** Our monitoring systems failed to automatically detect and alert on the 200% latency spike. We need to configure proactive alerts that trigger on significant deviations from performance baselines.
* **Rollback Procedure:** Was our rollback procedure fast and simple? We should document and automate the rollback process to ensure it can be executed in under 5 minutes by any engineer on call.