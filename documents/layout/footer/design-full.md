---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Footer — Tech Design (Full)

The footer is a single component with no state. This document is intentionally short; padding it out would invent complexity that doesn't exist.

## Component map

| Element | Path |
|---|---|
| Component | `src/app/components/layout/footer/footer.component.ts` |
| Template | `src/app/components/layout/footer/footer.component.html` |
| Styles | `src/app/components/layout/footer/footer.component.scss` |
| Mount point | `src/app/app.component.html` (after `<router-outlet>`) |
| Visibility signal | `src/app/app.component.ts` (`showFooter` computed) |
| Theme mixin | `documents/design-system/theme.yaml#/token_mixins/footer_mixins` (`footer-theme-by-primary-color`) |
| Typography class | `text-body-small` (from `_typography.scss`) |

## Visibility rule (authoritative)

Mirror the navbar. Hide on:

- exact paths: `/login`, `/register`
- regex patterns: `^/course/[^/]+/manage/exercise/`, `^/course/[^/]+/lesson/[^/]+/attempt`

Show everywhere else (post-`authGuard`).

If the navbar's hidden-route list changes, the footer's must change with it. Because both read the same `computed()` in `AppComponent`, this is automatic.

## Failure modes

| Mode | Detection | Behavior |
|---|---|---|
| Theme CSS not yet applied on first paint | Visual flash | Acceptable; resolves on next frame. |
| URL contains query string (e.g. `/login?next=...`) | `showFooter` computed | Hidden — match uses `startsWith(route + '?')` parity with navbar. |
| Deep-linked unauthenticated load | `authGuard` redirects to `/login` | Footer hidden because URL becomes `/login`. |

## Open questions

- Will legal copy add a links row before end-of-year? If yes, revisit `prd-full.md` "Out of scope" before that release.
- Should the year auto-update (`new Date().getFullYear()`) or stay hard-coded? **Decision pending product.** Default: hard-coded for now to match the source spec; cheap to swap.

## Decision log

| Date | Decision | Notes |
|---|---|---|
| 2026-05-06 | Migrate footer docs from single `spec.yaml` to PRD/design/contract triad. | Aligns with `_document-workflow.md`. |
| 2026-05-06 | Reuse navbar's visibility computation rather than introducing a parallel one. | Prevents drift; cost is renaming `showNavbar` -> `showChrome` (or adding `showFooter` alias). |
| 2026-05-06 | Hard-code copyright year for v1. | Matches existing template; revisit if product asks. |

[1-min](./design-1min.md) - [5-min](./design-5min.md) - [contract](./contract.yaml)
