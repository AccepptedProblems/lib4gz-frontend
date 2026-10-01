---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: quarterly
---

# Design Principles (full)

Core visual design principles for Lib4GZ. These override default component-level styling choices when there is a conflict. Every screen and layout spec must conform.

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

## 1. Unified Surface

**Priority:** high
**ID:** `unified-surface`

### Description

Multi-column layouts (sidebar + content, two-pane views) share the same background color. Columns are never visually separated by borders, dividers, or differing background colors. Separation is achieved exclusively through **negative space** (padding, margin, gap) and content density contrast.

### Rationale

Premium applications (Linear, Notion, Vercel, Stripe Dashboard) avoid hard visual dividers between primary layout regions. A single unified surface creates a calm, spacious feel and lets content hierarchy do the work. Borders and color splits add visual noise and make the UI feel segmented rather than cohesive.

### Rules

- **Same background color** on sidebar and main content (`--surface-page`, paper `#f4f1eb`).
- **No `border-right`, `border-left`,** or any visible border between layout columns.
- **No differing background colors** to distinguish columns.
- **Generous gap** between columns (minimum 24px) creates breathing room.
- **Internal dividers within a single column** (e.g., between sidebar sections) are allowed but should be subtle (`--border-subtle` or spacing-only).

### Applies to

- Two-column layouts (sidebar + content)
- Three-column layouts
- Split-pane views

### Exceptions

- **Mobile drawer overlays** may use `--shadow-lg` since they float above content.
- **Modal / dialog surfaces** may differ from the page background.

---

## 2. Breathing Room

**Priority:** high
**ID:** `breathing-room`

### Description

Generous whitespace is a feature, not wasted space. Every layout region should have comfortable internal padding and external margins so that content never feels cramped.

### Rules

- **Content padding** at least `--spacing-lg` (24px).
- **Sidebar internal padding** at least `--spacing-md` (16px).
- **Between major sections** within a column, use `--spacing-lg` (24px) or more.
- **Centered content** (e.g., lesson detail) uses `max-width` with auto margins for optimal line length.

---

## 3. Elevation Over Borders

**Priority:** medium
**ID:** `elevation-over-borders`

### Description

When visual distinction between elements is needed, prefer subtle elevation (box-shadow) over hard borders. Cards and floating elements use low-opacity multi-layer shadows for a refined, premium feel.

### Rules

- **Cards at rest** use `--shadow-xs`; on hover use `--shadow-md` with a slight `translateY` lift.
- **Avoid 1px solid borders** as the primary visual separator between layout regions.
- **Borders are acceptable** for form inputs (`--border-strong`), table rows (`--border-subtle`), and internal section dividers within a column.

---

## 4. Content Hierarchy Through Typography

**Priority:** medium
**ID:** `content-hierarchy`

### Description

Use the typography scale and text color tokens to establish hierarchy rather than relying on background color changes or heavy borders.

### Rules

- **Primary content** uses `text-primary`; secondary / supporting content uses `text-secondary`.
- **Section headings** use the title scale (`text-title-large`, `text-title-medium`).
- **Body content** uses `text-body-medium` for readability.
- **Never signal importance with background color alone** — pair with typography weight or size.

---

## 5. Subtle Interaction States

**Priority:** medium
**ID:** `subtle-interactions`

### Description

Hover, active, and focus states should be understated and refined. Use soft background tints and gentle transitions rather than bold color changes.

### Rules

- **Hover** uses `--surface-hover` (a barely perceptible tint), not strong color changes.
- **Active / selected items** use `--primary-color-50` background with a small left accent border (3px `--primary-color-600`).
- **Transitions** use `--duration-normal` (200ms) for hover, `--duration-slow` (300ms) for expand/collapse.

---

## 6. Global Box Model

**Priority:** high
**ID:** `global-box-model`

### Description

The entire application uses border-box sizing globally. This prevents layout overflow bugs where padding extends an element beyond its declared width, especially in flex and grid layouts.

### Rules

- **All elements MUST use `box-sizing: border-box`** via the global reset (`*, *::before, *::after`).
- **Do NOT rely on `content-box`** for any layout calculation.
- **`width: 100%` on a padded element** includes the padding inside the width — this is the expected behavior.

### Implementation

Applied in `_typography.scss` as a global CSS reset alongside other global rules (body font, heading resets).

---

## 7. Responsive Two-Column Sidebar Layout

**Priority:** high
**ID:** `responsive-sidebar-layout`

### Description

All screens using a two-column sidebar + content layout must follow a consistent responsive pattern. On desktop the sidebar is visible alongside the content. On mobile (≤768px) the sidebar collapses into a fixed off-screen drawer, and a clearly visible toggle bar must appear at the top of the layout for users to open/close the sidebar.

### Rules

- **Mobile breakpoint:** at `max-width: $mobile-large-breakpoint` (768px), the sidebar MUST collapse to a fixed drawer.
- **Hamburger button is mandatory on mobile.** It uses the Material Icons `menu` icon and is NOT full-width — it is a small icon-only button positioned at the top-left of the content area with padding matching the content padding (16px).
- **Hamburger styling:** no background color, no border. Sits inline at the start of the content flow as an icon button — 40x40 tap target, `border-radius: 8px`, transparent background, `--surface-hover` on hover.
- **Drawer background is mandatory.** The sidebar drawer MUST have an explicit background color (`--surface-page` / `#ffffff`) so its content is readable when overlaid on the page. Without this, the drawer is transparent and content behind bleeds through.
- **Content padding minimum.** Content areas MUST maintain at least `--spacing-md` (16px) padding at all viewport widths so content never touches the viewport edge.
- **Mobile padding floor.** On mobile, content padding reduces to 16px but MUST NOT be zero.
- **z-index:** drawer uses `--z-index-drawer` (400) with a backdrop overlay at z-index 399.

### Applies to

- `course-management` (teacher view)
- `course-dashboard` (student view)
- Any future screen with a sidebar + content layout

### Hard check

> NEVER allow a two-column layout screen to have an invisible or missing sidebar toggle on mobile. If the sidebar is collapsed but no hamburger button is visible, this is a bug — add a visible hamburger icon button immediately. The sidebar drawer MUST have a background color — if the drawer is transparent, it is a bug.
