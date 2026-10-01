---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Footer — Tech Design (1-min)

- **What.** Standalone `app-footer` component rendered once in `AppComponent`, below `<router-outlet>`. Single row, centered copyright text.
- **Key decision.** Reuse the existing visibility signal that hides the navbar — rename it from `showNavbar` to `showChrome` (or add a sibling `showFooter` that points at the same computed). Avoids two parallel route-pattern lists drifting apart.
- **Theme.** Applied via `footer-theme-by-primary-color` mixin already declared in `theme.yaml`. No new tokens.
- **Risk.** Visibility logic must stay in lockstep with the navbar. Mitigation: one source of truth in `AppComponent`.

[5-min](./design-5min.md) - [full](./design-full.md) - [contract](./contract.yaml)
