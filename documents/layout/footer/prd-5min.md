---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Footer — PRD (5-min)

## Problem

Authenticated screens currently end abruptly at the bottom of the main content. There is no consistent, themed closing element, and no shared place to surface copyright or future links (terms, privacy, support).

## Primary user

Every signed-in user (student, teacher) on every authenticated screen.

## Outcome

- A short, persistent footer below the main content on authenticated screens.
- Themed to match the navbar (teal background, white text) so the page reads as one product.
- Hidden where it would distract: `/login`, `/register`, and the focused exercise-editor route — same rule as the navbar.

## User stories

- *As a logged-in user* I see a copyright line at the bottom of every screen so the page feels finished.
- *As a user filling the login or register form* I see no footer chrome — just the form.
- *As a teacher writing an exercise* I see no footer; the editor takes the full viewport.

## Scope

**In:** single-row footer with centered copyright text. Visibility logic shared with navbar. Themed via the existing `footer-theme-by-primary-color` mixin. Responsive padding.

**Out (this iteration):** footer links (terms, privacy, support), language switcher, social icons, multi-column layouts, sticky behavior. Add later only if a user need is named.

## Assumptions

- Active theme stays Mint; no per-screen theme overrides.
- No localization in this iteration; copy is English.

## Risks

- **Layout shift / scroll traps.** A second fixed-height element below content can clip dashboards. Mitigation: footer flows in normal document order, not fixed-position.
- **Visibility drift.** Visibility rules must stay in sync with the navbar; if they diverge, screens get a footer but no navbar (or vice-versa). Mitigation: share one signal (see tech design).

## Dependencies

- Theme tokens in `documents/design-system/theme.yaml` (`footer-theme-by-primary-color`).
- Visibility signal currently named `showNavbar` in `app.component.ts` — will be generalized.

[1-min](./prd-1min.md) - [full](./prd-full.md) - [contract](./contract.yaml)
