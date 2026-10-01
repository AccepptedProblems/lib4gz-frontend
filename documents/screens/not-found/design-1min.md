---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Not Found (404) — Design 1-min

- **What we're building.** A standalone Angular component on route `**` with a centered illustration, heading, message, and one auth-aware CTA.
- **Key decision.** Auth-aware CTA computed at click time via `AuthService.isAuthenticated()` — no guard, no resolver. The route must stay public.
- **Why not a guard.** A guard would force a redirect away from `**`, defeating the page.
- **Why not a resolver.** No data to fetch; static page.
- **Risk.** Catch-all must remain the **last** entry in `app.routes.ts` or it shadows everything below it.

See `design-5min.md`, `design-full.md`.
