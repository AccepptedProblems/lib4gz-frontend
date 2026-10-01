---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Not Found (404) — Design 5-min

## What we're building
`NotFoundComponent` (standalone) at `src/app/components/not-found/`, lazy-loaded on route `**`. No guard, no API call.

## System context
```
app.routes.ts
  ├── /login, /register          (public)
  ├── /, /course/:id, ...        (authGuard)
  └── **  →  NotFoundComponent   (no guard) ← must stay last
```
Navbar/footer are owned by `AppComponent` and visible here (not `/login`, not `/register`).

## Data flow
- No HTTP. No signals beyond local component state.
- `AuthService.isAuthenticated()` is read **on click**, not on init — keeps the template free of conditional bindings and avoids a stale snapshot if the user signs out in another tab.

## Key tradeoffs
| Choice | Picked | Rejected | Why |
|---|---|---|---|
| Auth check timing | On-click | On-init signal | Simpler; one branch in one method; no template `@if`. |
| Back behavior | `history.back()` with fallback | Always `router.navigate(['/'])` | History is what the user expects; fallback covers fresh tabs. |
| Illustration | Static SVG asset | Inline component / Lottie | No animation budget; SVG is cacheable and accessible. |
| CTA component | `lib-button` | Native `<button>` | Consistency with the rest of the app's button styling. |

## Scope
**In:** layout, copy, auth-aware CTA, back link, responsive sizing.
**Out:** support link, analytics, suggested routes.

## Failure modes
| Failure | UI behavior |
|---|---|
| Illustration asset 404s | Hidden via `alt` + CSS; heading + message still centered. |
| `AuthService` throws | Treat as unauthenticated; CTA goes to `/login`. |
| `history.back()` lands on another 404 (loop) | Acceptable in v1; user clicks primary CTA. |
| Catch-all moved above another route | Real routes stop matching. Mitigation: lint/code-review note in `app.routes.ts`. |
