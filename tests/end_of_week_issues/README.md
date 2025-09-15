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

   My Four Bulleted Retrospective
   - An issue was resported following a deployment that happened for v1.3 and seems testing was improper
   - A need to work on a deployment strategy that is behind an automated rolback configurations in the event of a issues
   - A need to discuss and work on monitory, alerts and notifications to pick up on issues before clients do 

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
