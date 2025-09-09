### Supporting Evidence from the Logs

A clear pattern emerges from the provided logs, demonstrating a direct correlation between `modelVersion "v1.3"` and performance degradation:

| Timestamp           | Endpoint          | Response Time (ms) | Status    | Model Version | Observation                                       |
| :------------------ | :---------------- | :----------------- | :-------- | :------------ | :------------------------------------------------ |
| 2025-08-01T18:05:00Z | `/risk-score`     | 120                | `OK`      | `v1.2`        | **Baseline:** Fast, successful response.          |
| 2025-08-01T18:06:00Z | `/risk-score`     | 750                | `Timeout` | `v1.3`        | **Spike starts:** First `v1.3` request, immediate high latency and timeout. |
| 2025-08-01T18:06:10Z | `/funding-approve`| 680                | `OK`      | `v1.3`        | High latency even when `OK`, for critical endpoint. |
| 2025-08-01T18:06:20Z | `/risk-score`     | 820                | `Timeout` | `v1.3`        | Continued high latency and timeouts.              |
| 2025-08-01T18:06:30Z | `/risk-score`     | 90                 | `OK`      | `v1.2`        | **Normalcy returns:** `v1.2` still performs well. |
| 2025-08-01T18:06:40Z | `/funding-approve`| 700                | `Timeout` | `v1.3`        | High latency and timeout for funding approval.    |
| 2025-08-01T18:07:00Z | `/risk-score`     | 95                 | `OK`      | `v1.2`        | `v1.2` consistently fast and reliable.            |
| 2025-08-01T18:07:15Z | `/risk-score`     | 890                | `Timeout` | `v1.3`        | Persistent high latency and timeouts with `v1.3`. |

