---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: quarterly
---

# Design Principles (5-min)

Seven principles. They override component-level styling when there is a conflict. Priority shown per principle.

| # | Principle | Priority |
|---|---|---|
| 1 | Unified Surface | high |
| 2 | Breathing Room | high |
| 3 | Elevation Over Borders | medium |
| 4 | Content Hierarchy Through Typography | medium |
| 5 | Subtle Interaction States | medium |
| 6 | Global Box Model | high |
| 7 | Responsive Two-Column Sidebar Layout | high |

---

## 1. Unified Surface (high)

Multi-column layouts share one background. Separation comes from negative space, never borders or color splits.

- **Same background** on sidebar and content (`--surface-page`, paper `#f4f1eb`).
- **No `border-right` / `border-left`** between layout columns.
- **No differing background colors** to distinguish columns.
- **Minimum 24px gap** between columns for breathing room.
- **Internal sub-section dividers** within a single column are allowed but must be subtle (`--border-subtle` or spacing-only).

**Exceptions:** mobile drawer overlays may use `--shadow-lg` (they float above content); modal/dialog surfaces may differ from page background.

---

## 2. Breathing Room (high)

Whitespace is a feature, not waste.

- **Content padding** at least `--spacing-lg` (24px).
- **Sidebar internal padding** at least `--spacing-md` (16px).
- **Between major sections** in a column, use `--spacing-lg` (24px) or more.
- **Centered content** (e.g., lesson detail) uses `max-width` with auto margins for optimal line length.

---

## 3. Elevation Over Borders (medium)

Prefer subtle shadow over hard borders for distinction.

- **Cards at rest** use `--shadow-xs`; on hover use `--shadow-md` with a small `translateY` lift.
- **Avoid 1px solid borders** as the primary separator between layout regions.
- **Borders are still acceptable** for form inputs (`--border-strong`), table rows (`--border-subtle`), and intra-column section dividers.

---

## 4. Content Hierarchy Through Typography (medium)

Use type scale and text-color tokens, not background fills, to establish hierarchy.

- **Primary content** uses `text-primary`; secondary uses `text-secondary`.
- **Section headings** use the title scale (`text-title-large`, `text-title-medium`).
- **Body content** uses `text-body-medium` for readability.
- **Never signal importance with background alone** — pair with weight or size.

---

## 5. Subtle Interaction States (medium)

Hover, active, focus stay understated.

- **Hover** uses `--surface-hover`, a barely perceptible tint — not a strong color change.
- **Active / selected** items use `--primary-color-50` background plus a 3px left accent in `--primary-color-600`.
- **Transitions** use `--duration-normal` (200ms) for hover, `--duration-slow` (300ms) for expand/collapse.

---

## 6. Global Box Model (high)

The whole app sizes with `border-box`.

- **Global reset** applies `box-sizing: border-box` to `*, *::before, *::after`.
- **Never rely on `content-box`** for layout calculation.
- **`width: 100%` on a padded element** includes the padding inside the width — this is intentional.

---

## 7. Responsive Two-Column Sidebar Layout (high)

Every sidebar+content screen follows the same responsive pattern.

- **Below 768px** (`$mobile-large-breakpoint`) the sidebar collapses to a fixed drawer.
- **Hamburger toggle is mandatory on mobile** — Material `menu` icon, 40x40 icon-only button, `border-radius: 8px`, transparent background, `--surface-hover` on hover, sits inline at top-left of content with 16px padding. Not full-width.
- **Drawer must have an explicit background** (`--surface-page` / `#ffffff`) — without it, page content bleeds through.
- **Content padding never drops to zero** — minimum `--spacing-md` (16px) at every viewport, including mobile.
- **z-index:** drawer at `--z-index-drawer` (400), backdrop at 399.

**Hard check:** on mobile, no hamburger or a transparent drawer is a bug — fix immediately.

**Applies to:** course-management (teacher), course-dashboard (student), any future sidebar+content screen.
