# The Monday Morning Inbox

## Overview

This test simulates the real operational challenges of being Vula's Head of Engineering. You'll need to demonstrate prioritization, delegation, communication, and systems thinking - the skills that will actually give the CTO time back to focus on strategic work.

---

## Company Context

**Your Role**: Head of Engineering, reporting to Alex (CTO)

**Team Structure** (16 engineers):

**Engineers**:
Note: These are our real team members and is roughly right but I have modified their roles and experience to fit the test!

- **Niko** - Backend, Prisma/PostgreSQL expert, 3 years at Vula
- **Semir** - Infrastructure & reliability, currently on-call rotation
- **Patrick** - Backend, works on vula-backend core services
- **Spencer** - Backend, works on matching algorithms and ML features
- **Adona** - Full-stack, partner portal focused, 2 years at Vula
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

**Tech Stack**: Bun, TypeScript, Prisma, PostgreSQL, Redis, React

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

**3. 🤷 Story Without Acceptance Criteria** (Slack, #engineering)

```
@here - I'm working on VUL-342 "Improve grant matching algorithm"
but there's literally no acceptance criteria in Jira. Just says
"make it better". What does done look like here? - Spencer
```

**4. 👤 Career Growth 1:1 Request** (Slack DM)

```
Hey, do you have time this week for a 1:1? I want to talk about my
career path here. Feeling a bit stuck on just bug fixes lately. - Adona
```

**5. 😟 Client Unhappy** (Slack, #client-success, from Sumeya)

```
@eng-team - FYI Emerald Africa is not happy with progress on the
custom reporting dashboard. They expected it last week and we're
still working on the data export piece. Can someone give me an update
I can share? They're asking pointed questions.
```

**6. 📚 Documentation Question** (Slack, #engineering)

```
Where do we document our API patterns? I'm adding endpoints to
partner-portal-frontend and want to follow the standard but can't
find docs. Also our Bruno collections are a mess - is there an
org structure I should follow? - Junior dev
```

**7. ⏰ Calendar Invite** (Email)

```
Meeting: "Architecture Sync - Entity Model Discussion"
Time: Today, 2-3 PM
Attendees: You, Niko, Patrick, Spencer, Bilen
Agenda: (none)
```

**8. 💰 Infrastructure Cost Question** (Slack DM from Finance)

```
Hey, AWS bill jumped 40% last month (Render costs). Can you help me
understand what changed? CEO is asking. Need breakdown by end of day
if possible.
```

**9. 📝 Code Standard Proposal** (Slack, #engineering)

```
@here - Proposal: Can we standardize on Zod for all API validation?
We're currently mixing Joi, Zod, and manual checks. I'll create the
ADR if we agree. Thoughts? - Niko
```

**10. 🎯 CTO Feature Discussion Request** (Slack DM from Alex)

```
Hey, when you have 15-20 min today, want to talk through the Microsoft
Graph integration for the partner portal? Thinking about calendar sync
+ document sharing. Want your take on architecture before I start
building. Also curious if we should be using their SDK or REST directly.
```

---

## What You Need to Deliver

Walk us through your Monday. Starting at 9 AM, what do you actually do with each of these — and in what order? We want to see how you work, not just what you'd prioritise. Some of these might take 30 seconds, others might take the whole day. Show us how you think about that difference.

A few sentences per item is fine. We want to understand how you think, not read a polished essay.

Then please film a Loom or recording of yourself talking us through it.

---

## What We're Looking For

✅ **Prioritization under pressure** - Can you separate urgent from important?
✅ **Judgement** - Do you escalate appropriately or try to handle everything?
✅ **Technical depth** - Do you engage with architecture decisions intelligently?
✅ **People awareness** - Do you handle career growth and team dynamics sensitively?
✅ **Autonomy** - Do you make decisions or punt everything to the CTO?
