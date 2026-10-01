---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Footer — PRD (1-min)

- **Problem.** Authenticated screens have no closing element. Pages bleed into the browser chrome and there is nowhere to surface copyright or future legal links.
- **User.** Every signed-in user (student, teacher) on every authenticated screen.
- **Outcome.** A persistent, themed footer terminates page content and shows copyright. Hidden on auth screens and the focused exercise editor so they stay distraction-free.
- **Success metric.** Footer renders on 100% of authenticated routes; never appears on `/login`, `/register`, or the exercise-editor route. Zero user reports of layout shift caused by the footer.
- **Target.** Ship with the navbar visibility refactor (current release).

Continue: [prd-5min.md](./prd-5min.md) - [prd-full.md](./prd-full.md) - [contract](./contract.yaml)
