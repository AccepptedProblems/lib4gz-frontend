---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Not Found (404) — PRD 5-min

## Problem
Unmatched routes currently render a placeholder. Users get stuck — no signal that the URL is wrong, no exit.

## Users
All visitors. Two states matter:
- **Authenticated** — likely followed a stale internal link.
- **Unauthenticated** — likely shared/bookmarked link or typo.

## Outcome
One screen, one obvious next step. The CTA depends on auth state; everything else is identical.

## User stories
- As a logged-in user, when I hit a dead link, I want a one-click route back to my dashboard.
- As a guest, when I hit a dead link, I want a one-click route to sign in / home.
- As any user, I want a "go back" affordance in case the previous page was fine.

## Scope
**In:** static layout, headline, message, primary CTA (auth-aware), back link, responsive sizing.
**Out:** support contact link, illustration sourcing/animation, search, analytics on referrer URL, custom messages per error class. All deferred — none block launch.

## Assumptions
- `AuthService.isAuthenticated()` is reliable on the catch-all route (no guard runs).
- `window.history.length > 1` is acceptable as the heuristic for "can go back."

## Risks
- **Low.** Worst case: user lands on the page and clicks the CTA — no data loss possible.
- Sole risk: catch-all must remain the **last** route in `app.routes.ts` or it shadows real routes.

## Dependencies
None beyond `AuthService` and `Router`.
