---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Footer — PRD (Full)

A footer is small. This document is small.

## Problem, user, outcome

See [prd-5min.md](./prd-5min.md). No new context to add.

## Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | Footer renders below `<router-outlet>` on every authenticated route. |
| AC-2 | Footer does **not** render on `/login` or `/register`. |
| AC-3 | Footer does **not** render on the exercise-editor route (`/course/:id/manage/exercise/:lessonId`) or the lesson-attempt route (`/course/:id/lesson/:lessonId/attempt`) — same hidden-route patterns as the navbar. |
| AC-4 | Footer uses `footer-theme-by-primary-color`: teal background, white text. |
| AC-5 | Copyright text reads `© 2026 Lib4GZ. All rights reserved.` — centered horizontally. |
| AC-6 | Footer is in document flow (not fixed-position). It does not overlap content. |
| AC-7 | At viewport ≤ 768px, horizontal padding reduces to `--spacing-md`. |
| AC-8 | Footer uses the semantic `<footer>` element. |

## Edge cases

- **Short pages.** On screens with little content, the footer sits directly below it (no forced bottom-of-viewport). Acceptable.
- **Long pages.** Footer appears after the user scrolls past content. Acceptable.
- **Slow auth resolution.** While `authGuard` is resolving, the footer should not render in a flash above the redirect. Mitigation: gate on the same signal that gates the navbar.

## Out of scope (deferred)

- Footer links (terms, privacy, support) — add when legal copy exists.
- Multi-column layout — add only when there are ≥ 3 link groups.
- i18n — add when a second locale is requested.
- Sticky / always-visible footer — no current user need.

## Analytics

None for this iteration. If footer links are added later, attach `data-analytics-id` per link.

## Wireframes

ASCII reference only — the footer is a single row.

```
+----------------------------------------------------------+
|              © 2026 Lib4GZ. All rights reserved.         |
+----------------------------------------------------------+
```

[1-min](./prd-1min.md) - [5-min](./prd-5min.md) - [contract](./contract.yaml)
