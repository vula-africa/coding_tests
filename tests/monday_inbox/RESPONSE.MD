# Vula Head of Engineering Assessment - Response

**Candidate:** Adewumi Adebayo  
**Date:** Thursday 19th of Feb 2026 
**Role:** Head of Engineering Assessment

---

# QUESTION 1

# Inbox Prioritization (Monday Madness)

---

## My Lens: Impact vs Noise

My primary goals:
1. **Eliminate blockers fast**
2. **Protect production and client trust**
3. **Free up my uplines** (Alex should focus on strategy, not operational noise)
4. **Create clarity around ownership and decision-making**
5. **Build systems** so next Monday is more controlled

### How I Think About It
- Production and client issues → Immediate action
- Core architectural decisions → High attention, low distraction
- Mid-sprint scope changes → Slow down, clarify urgency
- Technical implementation details → Delegate to domain owners
- People signals (career, morale) → Never ignore, be intentional
- Tooling and process ideas → Encourage, but evaluate deliberately

---


## Rank

| Rank | Item                   | Label                                 | Justification                                                                                                                         |
| ---- | ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | #6 Client Unhappy      | NOW (Handle Myself)                   | Revenue/relationship. Check Jira, agree realistic ETA with owners, craft response to Sumeya. Too sensitive to delegate.               |
| 2    | #1 Production Issue    | NOW (Delegate to Semir)               | Semir owns reliability, was first responder. Need post-mortem Today. Before Kenya pilot Wednesday.                                    |
| 3    | #11 Mystery Meeting    | NOW (Cancel/Clarify This Morning)     | 5 people × 1 hour == Inefficient. Ask Niko for agenda or cancel by 10am. Likely redundant with PR review.                             |
| 4    | #13 AWS Cost Spike     | TODAY (Handle Myself, Loop Alex)      | 40% spike, CEO asking, Finance needs EOD. Business-technical bridge. Loop Alex for context but I'll respond directly.                 |
| 5    | #4 Missing AC          | TODAY (Delegate to Spencer + Product) | Spencer blocked in-sprint. Escalate to product owner NOW. Fix process at Thursday Town Hall.                                          |
| 6    | #3 CEO Feature Request | TODAY (Handle Myself)                 | Protect sprint integrity while negotiating with Nic. Need to scope and offer alternatives today.                                      |
| 7    | #2 Architecture PR     | CLARIFY TODAY, REVIEW TUESDAY         | Clarify urgency/blockers with Niko this morning. Deep review Tuesday gives 24hrs before Wednesday merge without rushing during fires. |
| 8    | #15 CTO Discussion     | WAIT FOR ALEX (Today)                 | Strategic alignment. Prep thoughts on MS Graph to make 20 mins high-value for Alex.                                                   |
| 9    | #12 Grafana Alert      | DELEGATE (Semir)                      | Non-critical, reliability domain. Semir can investigate as part of on-call duties.                                                    |
| 10   | #8 Bug (5MB Upload)    | DELEGATE (File Upload Owner)          | High severity. Owner investigates root cause first. If simple fix, can loop junior dev for implementation learning.                   |
| 11   | #7 Redis Decision      | DELEGATE (Patrick)                    | Low risk at 10k/day. Empower Patrick to decide, consider spikes/burst, document in PR.                                                |
| 12   | #14 Code Standard      | DELEGATE (Niko), WAIT FOR THURSDAY    | Good initiative. Start conversation Async in #engineering, Niko drafts ADR, team discusses at Town Hall. Not urgent.                  |
| 13   | #5 Career 1:1          | THIS WEEK (Friday) SCHEDULE TODAY     | Important but not urgent. Schedule Meeting on Friday with prep for growth discussion.                                                 |
| 14   | #9 Documentation       | DELEGATE (Junior + Niko)              | Mentorship opportunity. Not urgent today.                                                                                             |
| 15   | #10 AutoClaude         | WAIT FOR SHOWCASE, DELEGATE (Biruk)   | Tooling affects everyone. Demo at Thursday Showcase. Avoid shiny object syndrome during pilot week.                                   |

---

## 2. Key Responses (notes only)

---

### #6 Client Unhappy (Emerald Africa)

**To: Sumeya (Slack DM)**

Hey Sumeya - I see the Emerald Africa escalation and I'm on it. Give me 30 minutes to talk to the team and I'll get you a concrete update you can share with them. Back to you by 10am with status, realistic timeline, and daily update plan.

[After checking with team - 30 mins later]

OK here's what I have for Emerald Africa:
Provide a Realistic delivery time: Thursday EOD. [Dev Name] is on this full-time and we've now got their data volume replicated in staging, so I'm confident in Thursday barring surprises.

[Dev Name] will send you daily EOD updates starting today - what shipped, any blockers, and confidence level on Thursday.

For next time: I'm adding "client deliverables at risk" to our Thursday check-ins so you hear about delays before clients do. We should have flagged this to you last week.

Let me know if they want me to jump on a call with the client to explain directly.

---

### #3 CEO Feature Request (Bulk Approve)

**To: Nic (Slack DM)**

Hey Nic - definitely want to help with bulk approve. Three partners asking is a real signal. Before I figure out the timing, can you help me understand the pain point?

Are partners manually approving hundreds of applications and it's eating hours of their time? And is this blocking them today or just making their work slower?

Want to make sure I understand the problem before I propose solutions.

[After Nic responds - if urgent:]

Got it - let me scope this today and I'll come back with what it would take to build, the risk to Kenya if we add it mid-sprint, and any quick workarounds to unblock them this week.

We can decide together if it's worth the trade-off. Should have answers by EOD.

[After Nic responds - if not blocking today:]

Makes sense. Here's what I'm thinking:

Short term: Is there a manual workaround we can document for them this week? Even if clunky, buys us time to build it properly.

Next sprint (starts Friday): We prioritize this at the top with proper design. Bulk operations have sneaky edge cases like partial failures and permissions that are easy to miss if we rush.

Does that timing work or is the pain high enough we should consider the Kenya risk?

---

### #10 AutoClaude Pilot Request

**To: Biruk (Slack DM)**

Hey Biruk, Love the initiative! I'm genuinely curious about AutoClaude - if it's matching your personal project experience, it could be a real boost for the team.

Can you demo it at Thursday's Showcase? Would be great to see a real before/after example where it 2x'd your velocity, plus where it works great and where it struggles. Also include research cost and security stuff (per-seat pricing, does code leave our systems, etc.) while you prep the demo.

If the team thinks it's promising after the demo, let's do a 2-week pilot with 3-4 volunteers to track actual velocity impact before we roll it out to everyone.

Sounds good? Really appreciate you bringing this forward.

---

### #1 Production Issue (Post-Mortem)

**To: Semir (Slack DM)**

Hey Semir - saw you handled the /risk-score slowdown Friday night.

Great response getting it stabilized. With Kenya deploying Wednesday, I want to make sure we understand what happened so it doesn't happen again under load.

Can you investigate today and let me know by 5pm?

* What triggered it? (DB query, external API, memory issue?),
* Could it happen again during Kenya launch or was it a one-time thing?
* Should we have caught it earlier with better monitoring?

A quick write-up in #incidents works - just need enough to know if we're at risk. Don't need a full deep-dive unless you think it's worth it. Let me know if 5pm doesn't work.

---

### #11 Architecture Meeting without Agenda

**To: Niko (Slack DM)**

Hey Niko - quick question about the 2pm Architecture Sync today.

Is this about your entity refactor PR? If so, I'd like to suggest we cancel and do an async review with detailed comments instead.

That way you can address feedback without everyone waiting, plus it saves 5 engineer-hours during sprint crunch.

If it's about something else, can you add an agenda so people know what to prep? Let me know by 10am so folks can reclaim the time if we're canceling?

---

## 3. Delegation Strategy

| What I'm Delegating    | To Whom                                | Why They're the Right Choice                                                                                                                                                    |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production post-mortem | Semir                                  | He was first responder Friday night and already has the logs. Reliability is his job, and he needs to tell me if this could blow up again during Kenya pilot.                   |
| Grafana alert          | Find who owns vula-scraper first       | The actual service owner should investigate, I suepect semir owns it.                                                                                                           |
| Redis decision         | Patrick                                | He works on vula-backend core where this lives. 10k/day is low enough that either choice works - I just need to tell him he's empowered to decide and doesn't need my approval. |
| Missing AC             | Spencer escalates, I step in if needed | Spencer needs to learn to unblock himself by going to product directly. But I'll give him a deadline (1pm) and tell him to ping me if product doesn't respond.                  |
| 5MB bug                | Identify file upload owner             | Need to know who actually owns this before I assign it.                                                                                                                         |
| API docs               | Junior + Niko (if Niko has time)       | Junior needs to learn our patterns anyway and Niko's the backend lead. But Niko's got the entity refactor this week, so I'll let him defer to next week if he's underwater.     |
| Zod discussion         | Niko                                   | He proposed it, he should own it. But he should get feedback in Slack standup today so it doesn't doesn't burn meeting time if everyone agrees.                                 |
| AutoClaude evaluation  | Biruk                                  | He's used it and loves it. he'll research cost/security and preps the demo. Team decides together at Showcase, not me or him alone.                                             |
| Architecture PR review | Me + Patrick both review               | I need to understand it (it's core data model), but Patrick works in vula-backend daily and should review for implementation. Two perspectives better than one.                 |
| AWS cost spike         | Semir gets data, I explain to Finance  | Semir knows what scaled on Render. I'll translate that into business terms for Finance/CEO. i'll use his expertise, I handle the communication.                                     |

---

## Patterns identified:

Incomplete work preparation - VUL-342 has no AC, architecture meeting has no agenda, CEO request has no scoping. This wastes sprint capacity.

Unclear decision-making authority - Patrick asking for 'Vula standard' suggests engineers uncertain about standards or don't feel empowered to decide within their domain.

Documentation gaps - Junior dev can't find API patterns or Bruno structure. Creates repetitive questions.

Reactive communication - Emerald Africa learned about delays reactively. Finance learned about costs from bill, not forecast.

---

## lightweight solutions using existing structure:

### 1. Definition of Ready Checklist

No story enters sprint without: AC, technical approach, dependencies, rough size

Propose at Thursday Town Hall for team input

Rotating weekly 'Ready Reviewer' flags incomplete stories to product

Prevents Spencer's situation, catches ambiguity before commitment

---

### 2. Decision-Making Framework (RASCI) – S is intentionally there in cases where support is needed

Three tiers: 'You decide' / 'Team discusses' / 'Escalate to HoE'

Examples: Patrick can decide Redis. Team discusses Zod standard. Escalate core data model changes.

Document in wiki, introduce at Thursday Town Hall

Empowers engineers, reduces bottleneck on me, makes escalation clear

---

### 3. Client Work Visibility in #client-success

Any external deadline = daily update in public channel: 'On track' or 'At risk: [blocker], new ETA'

Transparency - team sees status, builds shared context

Accountability - public updates create gentle pressure

Solves Emerald Africa - Sumeya would have seen dashboard slipping



## Loom Links

- https://www.loom.com/share/96b562c825374de18ead34579e14e742

- https://www.loom.com/share/2510d7f3f23d40b699163b627f22899e

- https://www.loom.com/share/321a2bb1843b4875ba3becb54ea67108
