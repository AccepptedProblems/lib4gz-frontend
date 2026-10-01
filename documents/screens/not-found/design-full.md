---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Not Found (404) — Design Full

## Component map
- `NotFoundComponent` — standalone, no inputs, no outputs.
  - Injects `Router`, `AuthService`.
  - Methods: `goToDashboard()`, `goBack()`.
  - Template uses `lib-button` (primary CTA) and a plain anchor/button for "Go Back".
- No child components beyond shared `lib-button`.

File paths: see `contract.yaml`.

## Routing
```ts
// app.routes.ts — last entry, no guard
{ path: '**', loadComponent: () =>
    import('./components/not-found/not-found.component')
      .then(m => m.NotFoundComponent) }
```
Lazy-loaded so the static page (and its illustration) doesn't ship in the main bundle for users who never hit it.

## Behavior contracts

### `goToDashboard()`
```
if (authService.isAuthenticated()) router.navigate(['/'])
else                                router.navigate(['/login'])
```
Auth check is performed at click time, not at component init.

### `goBack()`
```
if (window.history.length > 1) window.history.back()
else                            goToDashboard()
```
Falls back to the auth-aware destination so a fresh tab still has an exit.

## Layout
Single column, vertically centered within the viewport minus navbar/footer. Order: illustration, heading (`<h1>`), message, primary CTA, secondary back link.

Responsive breakpoints (consume `design-system/breakpoints.yaml`):
- `> 768px` — illustration ~300px, actions inline.
- `≤ 768px` — illustration ~200px, actions stack.
- `≤ 576px` — reduced vertical padding, compact spacing.

Design-system refs: `text-headline-large` (heading), `text-body-large` (message), primary theme color (CTA), neutral text color (message + back link). No new tokens.

## Failure modes (full)
| Failure | Detection | UI behavior |
|---|---|---|
| Illustration asset missing (404 on `/assets/...`) | Network | `<img>` is hidden via CSS `img:not([src])` or `onerror`; layout stays centered. |
| `AuthService.isAuthenticated()` throws | Try/catch in `goToDashboard` | Default to unauthenticated path. |
| `window.history.length` is `1` (fresh tab) | Runtime check | `goBack()` calls `goToDashboard()`. |
| Catch-all not last in routes | Build/runtime — real routes 404 | Caught by smoke test on `/login`, `/`, and a known deep route. |
| Navbar leaks an authenticated state for an unauthenticated user | Owned by `AppComponent`, not this screen | Out of scope here. |

## Decision log
| Date | Decision | Alternatives | Why |
|---|---|---|---|
| 2026-05-06 | Auth check on click, not on init | Signal-based `isAuthenticated()` in template | Avoids template branching; matches the rest of the codebase's "do it once at interaction time" pattern. |
| 2026-05-06 | No support link in v1 | Include "Contact Support" CTA | Source spec listed it but no support channel exists yet. Add when a destination URL is decided. |
| 2026-05-06 | Lazy-load via `loadComponent` | Eager import in `app.routes.ts` | Same lazy pattern as the rest of the routes; saves a few KB on the main bundle. |
| 2026-05-06 | Static SVG illustration | Lottie / animated | No animation budget; perceived performance better. |

## Open questions
- Final illustration asset and copy tone (product call). Placeholder acceptable for scaffold.
- Should `goBack()` also check `document.referrer` to avoid same-origin loops? Defer until reported.
