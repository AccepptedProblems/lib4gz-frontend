---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Editor — Tech Design (1-min)

- **What we're building.** A single Angular standalone component (`ExerciseEditorComponent`) that handles both create and edit routes for an exercise plus its questions, with a Fast Create paste-to-questions shortcut.
- **Key architectural decision — one component, two routes.** Both `/exercise/new` and `/exercise/:id/edit` mount the same component; mode is derived from `route.params.exerciseId`. **Alternative rejected:** two components sharing a base class — duplicated wiring, two places to evolve, no real reuse benefit because the state shapes are identical.
- **Key architectural decision — diff-on-save in edit mode.** The editor snapshots the loaded questions and on save sends only CREATE / UPDATE / DELETE deltas via `questions.batch-update`. **Alternative rejected:** "always replace all questions" — simpler to implement but loses question IDs and breaks any future submission references.
- **Key architectural decision — single regex delimiter for Fast Create.** Only `^\s*\d+\s*[.)]\s*` triggers a question split; everything else is verbatim content. **Alternative rejected:** smart heuristics (blank-line-as-separator, dash-as-bullet) — they are wrong about half the time on real teacher input (chat transcripts, lists), and the failure mode is silent (questions get merged or split incorrectly).
- **Risk summary.**
  - The diff relies on `JSON.stringify(meta)` equality — sensitive to key order. *(Mitigation: `meta` is built from a fixed shape locally.)*
  - Type-switch wipes options globally; teacher gets one confirmation only. *(Mitigation: explicit dialog.)*
  - `beforeunload` is best-effort across browsers. *(Accepted.)*
- **Read next.** [`design-5min.md`](./design-5min.md), [`design-full.md`](./design-full.md), [`contract.yaml`](./contract.yaml).
