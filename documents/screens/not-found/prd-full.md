---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Not Found (404) — PRD Full

## Problem & outcome
See `prd-1min.md` and `prd-5min.md`. This page exists to recover users from dead URLs with one click.

## Acceptance criteria

### Routing
- [ ] Catch-all route `**` is registered **last** in `src/app/app.routes.ts`.
- [ ] No guard. Page renders for both authenticated and unauthenticated users.
- [ ] Navbar/footer rendering follows the global rule (visible everywhere except `/login` and `/register`).

### Content
- [ ] Heading "Page Not Found" rendered as `<h1>` using `text-headline-large`.
- [ ] Message: "The page you're looking for doesn't exist or has been moved." Centered, max-width ~400px, `text-body-large`.
- [ ] Illustration ~300px, `alt="Page not found"`. If asset missing, headline + message must still center cleanly.

### Actions
- [ ] **Primary CTA.**
  - Authenticated: label "Go to Dashboard", navigates to `/`.
  - Unauthenticated: label "Sign In", navigates to `/login`.
  - Uses `lib-button` primary, size `md`.
- [ ] **Secondary "Go Back".**
  - If `window.history.length > 1` → `history.back()`.
  - Else → `router.navigate(['/'])` (auth) or `/login` (unauth).

### Responsive
- [ ] `> 768px`: illustration full size, secondary actions inline.
- [ ] `≤ 768px`: smaller illustration, secondary actions stack.
- [ ] `≤ 576px`: minimal padding, compact spacing; nothing clips.

### Accessibility
- [ ] Single `<h1>` on the page.
- [ ] Illustration `alt` is meaningful (not decorative `alt=""`).
- [ ] Buttons/links reachable via Tab, visible focus ring.
- [ ] Color contrast meets AA against the page surface.

## Edge cases
| Case | Expected behavior |
|---|---|
| User lands on 404 in a fresh tab (no history) | "Go Back" falls back to `/` or `/login`. |
| Auth token expires mid-session and user hits a bad URL | Treated as unauthenticated; CTA points to `/login`. |
| Deep-linked 404 from external referrer | Same UI; no special copy. |
| Direct hit on `/some-typo` | Catch-all renders, no flash of the target route. |

## Out of scope (deferred)
- "Did you mean…" suggestions.
- Support / contact link (the source spec listed this — dropped for v1; revisit if support requests it).
- Per-error-class copy (e.g., 403 vs 404).
- Analytics event on 404 hit with referrer.

## Analytics
None in v1. Add a single `route_not_found` event with `referrer` and `attempted_path` when analytics infra lands.
