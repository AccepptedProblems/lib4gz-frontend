---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: quarterly
---

# Design Principles (1-min)

Seven rules that override component-level styling. Every screen and layout spec must conform.

- **Unified Surface** — Sidebar and main content share one background; no borders or color splits between columns, only negative space.
- **Breathing Room** — Generous whitespace is a feature; content padding is at least 24px, sidebar padding at least 16px.
- **Elevation Over Borders** — Use subtle multi-layer shadows for distinction; reserve borders for inputs, table rows, and intra-column dividers.
- **Content Hierarchy Through Typography** — Establish hierarchy with the type scale and text-color tokens, not background fills.
- **Subtle Interaction States** — Hover and active states use soft tints and gentle 200ms transitions, never bold color jumps.
- **Global Box Model** — All elements use `box-sizing: border-box` via the global reset; padding is always inside width.
- **Responsive Two-Column Sidebar Layout** — Below 768px the sidebar collapses to a fixed drawer with a visible hamburger toggle and an explicit page background (`--surface-page`).

## Hard checks (anti-patterns to fix on sight)

- **Sidebar with `background-color`, `background`, or `border-right` / `border-left`** in a two-column layout — bug, remove it.
- **Two-column screen on mobile with no visible hamburger toggle** — bug, add a 40x40 icon-only menu button.
- **Mobile sidebar drawer with transparent background** — bug, set `--surface-page` (#ffffff) so content doesn't bleed through.

See `design-principles-5min.md` for rules per principle, `design-principles-full.md` for full rationale and exceptions.
