---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Footer — Tech Design (5-min)

## What we're building

A standalone Angular component (`app-footer`, selector `app-footer`, files under `src/app/components/layout/footer/`) rendered once in `AppComponent` after `<router-outlet>`. It shows a single centered copyright line and respects the same visibility rules as the navbar.

## System context

```
AppComponent template
  ├── @if (showNavbar()) <app-navbar />
  ├── <router-outlet />
  └── @if (showFooter()) <app-footer />
```

`showFooter` is a `computed()` over the current URL signal. Today the same logic lives in `showNavbar` (`app.component.ts`). This work generalises that signal so navbar and footer share one route-classification.

## Data flow

The footer is **stateless and dataless**. It reads no signals, calls no services, and emits no events. Theme tokens come from CSS custom properties applied at the `<body>` level by the active theme.

## Key decisions and tradeoffs

| Decision | Alternative rejected | Why |
|---|---|---|
| Reuse navbar visibility signal | Independent route-pattern list per layout component | Two lists drift; one source of truth is cheaper than syncing two. |
| In-flow `<footer>` (not fixed) | `position: fixed` always-visible footer | Fixed footers fight with form drawers and small viewports; no user need for always-visible. |
| Render in `AppComponent` (not per-screen) | Each screen template includes `<app-footer>` | Forces every screen to remember; the visibility rule already lives in `AppComponent`. |
| No content beyond copyright | Multi-column links + social | PRD says nothing else is requested; YAGNI. |

## Scope

**In:** component scaffold, mount in `AppComponent`, visibility computed, theme application, responsive padding at 768px.

**Out:** links, i18n, sticky behavior, analytics.

## Failure modes

| Mode | Behavior |
|---|---|
| User loads `/login` | Both navbar and footer hidden; form-only layout. |
| User loads exercise-editor route | Both hidden; full-viewport editor. |
| Theme tokens fail to load (no `--footer-bg-color`) | Browser falls back to user-agent default; footer text still legible because `text-body-small` class is independent. Acceptable degradation. |
| Auth redirect mid-navigation | Visibility signal reads the post-redirect URL; footer state matches the destination, not the source. |

[1-min](./design-1min.md) - [full](./design-full.md) - [contract](./contract.yaml)
