# 1. Inbox Prioritization Plan

## Prioritization & Action Plan

- 15 items in 4 tiers: NOW (3), TODAY (6), THIS WEEK (3), DELEGATE (3)
- Impact vs Noise lens: eliminate blockers, protect client/production, free up CTO
- Time-sensitivity: delay changes outcome vs can sequence

---

## Key Responses (5 items)

- Client escalation: concrete timeline + accountability
- CEO pushback: diplomatic no with alternatives (protect sprint)
- Production delegation: structured questions, 5pm deadline
- Meeting cancellation: save 5 engineer-hours
- Tool evaluation: collaborative team approach

---

## Delegation Strategy

- Domain ownership: Semir (reliability), Patrick (backend), Niko (mentoring junior)
- Variable structure: high for Spencer (blocked), low for Patrick (empowered)
- NOT delegated: client (political), CEO (relationship), architecture review (strategic context)

---

## Systems Thinking

- 4 patterns: incomplete prep, unclear authority, doc gaps, reactive communication
- 3 fixes using existing meetings (zero new overhead):
  - Definition of Ready (team co-created at Town Hall)
  - Decision framework RACI (empower domain owners)
  - Client visibility (#client-success channel, not DMs)

---

## Loom Script (12-15 min walkthrough)

- Prioritization logic and diagnostic framework
- What I said NO to: scope creep, unnecessary meeting, being bottleneck
- Escalation: only Microsoft Graph to CTO (1/15 items)
- Hard trade-off: Adona 1:1 Friday (quality over speed)

---

## Key decisions

- Escalated 1/15 items to Alex (strategic technical counsel)
- Delegated 8 items to domain owners with clear structure
- Handled 4 myself (client, CEO, AWS costs, meeting hygiene)
- Canceled architecture sync (no agenda, wrong attendees)
- Empowered Patrick explicitly: 'no approval needed to merge'

---

# 2. End-of-Week Incident Response

## Root cause

- Model version regression: v1.3 shows 6–9x latency vs v1.2
- 100% correlation: all timeouts on v1.3 across `/risk-score` and `/funding-approve`

---

## Immediate action (next 10 minutes)

- Roll back traffic to v1.2
- Verify latency recovery and confirm lender impact is resolved
- Communicate status to stakeholders

---

## Prevention

- Add performance regression gates in CI/CD (p95/p99 thresholds)
- Canary deployments with auto-rollback on latency/error spikes
- Version-specific monitoring and alerts

---

## Retro notes

- Detection gap (customer-reported vs monitoring)
- Missing performance tests for model changes
- No canary safety net on rollout
- Need faster incident comms playbook

---