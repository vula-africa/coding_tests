# It’s Friday 6:30 PM:

Within 20 mins, API latency has spiked 200%.
3 lenders in Kenya are reporting timeouts when approving SME funding requests.
We’ve attached a mock API log file.

## Your Challenge

- Analyse the logs and identify the likely root cause of the slowdown.
- Suggest one immediate fix you would implement.
- Draft a 1–2 line SQL or pseudo‑code query to identify all affected funding requests.
- Suggest one long‑term technical improvement to prevent this from recurring.
- Note down the bullet points you would bring up at the next retro.

### Mock Log File

```
[
  { "timestamp": "2025-08-01T18:05:00Z", "endpoint": "/risk-score", "responseTimeMs": 120, "status": "OK", "modelVersion": "v1.2" },
  { "timestamp": "2025-08-01T18:06:00Z", "endpoint": "/risk-score", "responseTimeMs": 750, "status": "Timeout", "modelVersion": "v1.3" },
  { "timestamp": "2025-08-01T18:06:10Z", "endpoint": "/funding-approve", "responseTimeMs": 680, "status": "OK", "modelVersion": "v1.3" },
  { "timestamp": "2025-08-01T18:06:20Z", "endpoint": "/risk-score", "responseTimeMs": 820, "status": "Timeout", "modelVersion": "v1.3" },
  { "timestamp": "2025-08-01T18:06:30Z", "endpoint": "/risk-score", "responseTimeMs": 90,  "status": "OK", "modelVersion": "v1.2" },
  { "timestamp": "2025-08-01T18:06:40Z", "endpoint": "/funding-approve", "responseTimeMs": 700, "status": "Timeout", "modelVersion": "v1.3" }
]
```
