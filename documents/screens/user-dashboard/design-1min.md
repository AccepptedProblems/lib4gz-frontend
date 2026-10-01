---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# User Dashboard — Tech Design (1 min)

- **What we're building.** A single Angular standalone screen at `/` that fetches both the user's enrolled and taught course lists, lays them out in a responsive card grid behind two tabs, and offers a code-based course-finder with apply-flow.
- **Key decision.** Use **two tabs over the same data shape (`CourseResponse[]`)** rather than two screens. Both lists share layout, card style, and empty/error treatment; only the navigation target and badge differ. *Rejected:* (a) separate `/my-courses` and `/teaching` routes — doubles routing surface for the same UI; (b) one combined list with role chips — loses the "my role here" signal that drives whether to show the *Create* button.
- **Second decision.** Search is **prefix-filter on the already-loaded enrolled list, with `getByCode` only as Enter-fallback** — keeps typing snappy and avoids hitting the backend on every keystroke.
- **State.** Signals only — no `BehaviorSubject`s. Two list signals + a debounced `Subject` for search input. Matches the rest of the codebase.
- **Top risks.** (1) Two parallel list calls make first paint feel slow on cold cache → skeletons cover it. (2) The apply-flow has three close-then-reload-then-navigate paths; race conditions are easy to reintroduce on edits. (3) `getByCode` 404s vs. real network errors are not currently distinguished — user always sees "Course not found".
- **Reads more.** [`design-5min.md`](./design-5min.md), [`design-full.md`](./design-full.md), [`contract.yaml`](./contract.yaml).
