# The Monday Morning Inbox

## Overview

This test simulates the real operational challenges of being Vula's Head of Engineering. You'll need to demonstrate prioritization, delegation, communication, and systems thinking - the skills that will actually give the CTO time back to focus on strategic work.

---

## Company Context

**Your Role**: Head of Engineering, reporting to Alex (CTO)

**Team Structure** (16 engineers):

**Senior Engineers**:
- **Niko** - Backend lead, Prisma/PostgreSQL expert, 3 years at Vula
- **Semir** - Infrastructure & reliability, currently on-call rotation
- **Biruk** - Full-stack, AI/tooling enthusiast, strong product sense
- **Patrick** - Backend specialist, works on vula-backend core services

**Mid-Level Engineers**:
- **Spencer** - Backend, works on matching algorithms and ML features
- **Adona** - Full-stack, mostly on partner-portal-frontend, 1 year at Vula
- **Bilen** - Frontend specialist, design systems and UI
- **Junior dev** (new hire, 3 months) - Rotating across projects, learning the stack

**Other Key People**:
- **Alex (CTO)** - Your manager, does deep technical work + strategy
- **Nic (CEO)** - Founder, client-facing, makes final product calls
- **Sumeya** - Client Success lead, main touchpoint for partners/funders

**Regular Communication Cadence**:
- **Daily**: Automated Slack standups in relevant channels
- **Tuesday**: TLC (Team, Learning, Connection) meetings - team bonding, no work talk
- **Every 2 weeks (alternating Thursday)**:
  - **Town Hall & Retro** - team-wide retrospective and planning
  - **Showcase** - demos of completed work, celebrate wins

**Current Sprint**: Day 3 of 5 (started Friday, ends Thursday)

**Tech Stack**: Bun, TypeScript, Prisma, PostgreSQL, Redis, React (see main CLAUDE.md for full details)

---

## The Scenario

It's Monday 9 AM. You've just opened Slack after a weekend away. Here's your inbox:

---

**1. 🔴 Production Issue** (Slack, Friday 11:47 PM)
```
@channel - vula-backend API responding slowly on /risk-score endpoint.
Restarted the service, seems stable now but not sure what caused it.
Logs in #incidents. - Semir (on-call)
```

**2. 💬 Architecture Review Request** (GitHub PR notification)
```
@head-of-eng - Can you review this? I've refactored how we handle
entity relationships to support the new multi-entity feature.
Changed 12 files, 430 lines. Needs to merge by Wednesday for the
Kenya pilot. - Niko
```

**3. 📊 Feature Request from CEO** (Slack DM from Nic)
```
Hey! Quick q - can we add a "bulk approve" button for funders reviewing
applications? Three partners asked for it last week. Can we squeeze
into this sprint? Only 3 days left but seems simple?
```

**4. 🤷 Story Without Acceptance Criteria** (Slack, #engineering)
```
@here - I'm working on VUL-342 "Improve grant matching algorithm"
but there's literally no acceptance criteria in Jira. Just says
"make it better". What does done look like here? - Spencer
```

**5. 👤 Career Growth 1:1 Request** (Slack DM)
```
Hey, do you have time this week for a 1:1? I want to talk about my
career path here. Feeling a bit stuck on just bug fixes lately. - Adona
```

**6. 😟 Client Unhappy** (Slack, #client-success, from Sumeya)
```
@eng-team - FYI Emerald Africa is not happy with progress on the
custom reporting dashboard. They expected it last week and we're
still working on the data export piece. Can someone give me an update
I can share? They're asking pointed questions.
```

**7. 🔧 Technical Decision Needed** (Slack, #engineering)
```
For the notification queue, should we use Redis or just in-memory?
We're talking ~10k notifications/day. I can see arguments both ways.
What's the Vula standard? - Patrick
```

**8. 🐛 Bug Report** (Jira notification)
```
VUL-890: "Business owners can't upload documents over 5MB"
Severity: High | Reporter: Sumeya | Could be the new file service
OR could be users trying to upload phone photos (which are huge).
Not sure yet.
```

**9. 📚 Documentation Question** (Slack, #engineering)
```
Where do we document our API patterns? I'm adding endpoints to
partner-portal-frontend and want to follow the standard but can't
find docs. Also our Bruno collections are a mess - is there an
org structure I should follow? - Junior dev
```

**10. 🤖 AutoClaude Pilot Request** (Slack DM)
```
I've been using AutoClaude for the past week on my personal projects
and it's incredible. Can we trial it for the team? I think it could
2x our velocity on boilerplate. Happy to champion the rollout. - Biruk
```

**11. ⏰ Calendar Invite** (Email)
```
Meeting: "Architecture Sync - Entity Model Discussion"
Time: Today, 2-3 PM
Attendees: You, Niko, Patrick, Spencer, Bilen
Agenda: (none)
```

**12. 📉 Grafana Alert** (Email, 8:34 AM)
```
Alert: vula-scraper error rate above threshold
Current: 12% (threshold: 10%)
Duration: 45 minutes
Service: Non-critical batch job
```

**13. 💰 Infrastructure Cost Question** (Slack DM from Finance)
```
Hey, AWS bill jumped 40% last month (Render costs). Can you help me
understand what changed? CEO is asking. Need breakdown by end of day
if possible.
```

**14. 📝 Code Standard Proposal** (Slack, #engineering)
```
@here - Proposal: Can we standardize on Zod for all API validation?
We're currently mixing Joi, Zod, and manual checks. I'll create the
ADR if we agree. Thoughts? - Niko
```

**15. 🎯 CTO Feature Discussion Request** (Slack DM from Alex)
```
Hey, when you have 15-20 min today, want to talk through the Microsoft
Graph integration for the partner portal? Thinking about calendar sync
+ document sharing. Want your take on architecture before I start
building. Also curious if we should be using their SDK or REST directly.
```

---

## What You Need to Deliver

**1. Prioritization & Action Plan**
- Rank/group all 15 items with your reasoning
- Label each with: NOW / TODAY / THIS WEEK / WAIT FOR [meeting] / DELEGATE TO [person]
- Brief notes on your thinking for each

**2. Key Responses (notes only)**
- Pick 5 items and write notes on how you'd respond
- Bullet points are fine - we want your thinking, not polished prose
- Show us when you're pushing back, deferring, or escalating

**3. Delegation Strategy**
- What are you delegating and to whom specifically?
- Why is that person the right choice?

**4. Systems Thinking**
- What patterns do you see in this chaos?
- Propose 2-3 lightweight processes/changes to prevent recurring issues
- Can leverage existing meetings or suggest new rituals

**5. Loom Video (10-15 min)**
Walk through your prioritization:
- How you decided what needs you vs what doesn't
- What you said "no" to and why
- What you escalated to Alex vs handled yourself
- How you used (or didn't use) existing meeting structure
- One hard trade-off you made

---

## What We're Looking For

✅ **Prioritization under pressure** - Can you separate urgent from important?
✅ **Communication style** - Are responses clear, empathetic, actionable?
✅ **Meeting hygiene** - Do you create new meetings or use existing rhythms?
✅ **Judgment** - Do you escalate appropriately or try to handle everything?
✅ **Pushback ability** - Can you say "no" diplomatically?
✅ **Systems thinking** - Do you see patterns and build preventative structure?
✅ **Technical depth** - Do you engage with architecture decisions intelligently?
✅ **People awareness** - Do you handle career growth and team dynamics sensitively?
✅ **Autonomy** - Do you make decisions or punt everything to the CTO?
✅ **Cultural fit** - Do you respect and leverage Vula's existing rituals?

---

## Time Expectations

**No time limit.** Take as long as you need to think it through properly. We value thoughtful prioritization over speed.

Most candidates spend 2-4 hours on the written portion and 10-15 minutes on the video.

---

## Example Delegation Thinking

A strong candidate might note:
- "Grafana alert → Semir (he's on-call, owns reliability, this is his swim lane)"
- "AutoClaude pilot → Could delegate to Biruk (he proposed it) but I'd want to be involved in tooling decisions"
- "PR review → Niko has context on entity model, but I should review too since it's architectural"
- "Bulk approve feature → Need to discuss with Nic first before delegating to anyone"

This shows understanding of:
- **Organizational dynamics** (who reports to whom)
- **Technical depth** (who has what expertise)
- **When to stay involved** vs truly delegate
- **Political sensitivity** (CEO requests, client escalations)
