---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Editor — PRD (1-min)

- **Problem.** Teachers need to attach graded exercises to a lesson. Without a dedicated editor, building a multi-question exercise means clicking through a generic CMS form per question — slow enough that teachers either skip exercises or paste them into the wrong field.
- **Primary user.** Teacher authoring or revising exercises inside a lesson.
- **Outcome.** A single full-screen editor where a teacher can draft an exercise (title + type) and a list of questions in one sitting, including a paste-a-numbered-list shortcut for migrating existing question banks.
- **Success metric.** Median time to publish a 10-question exercise drops below 3 minutes; >40% of new exercises use Fast Create within 30 days of launch. *(Source spec did not state metrics — TBD; numbers are author's proposal.)*
- **Scope (in).** Create + edit modes for one component, two question types (`MULTIPLE_CHOICE`, `TEXT_ANSWER`), Fast Create bulk import, unsaved-changes guard, distraction-free layout (navbar hidden).
- **Scope (out).** Image/audio attachments, drag-to-reorder questions, per-question scoring weights, AI-generated questions, multi-answer (multi-correct) MC.
- **Target date.** TBD.
- **Status.** Implemented (see `contract.yaml`).
- **Read next.** [`prd-5min.md`](./prd-5min.md), [`design-1min.md`](./design-1min.md).
