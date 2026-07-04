# Paper Background + Forest Green Primary — Theme Migration Plan

> Status: **implemented 2026-07-04** (all three phases; see deviations below)
> Created: 2026-07-04
>
> **Deviations from plan, decided during implementation with the user:**
> 1. `--surface-raised` ended up **paper `#f4f1eb`, not white** — the user rejected
>    white-cards-on-cream ("exercise card still white", "course management detail still white").
>    The app is fully unified paper; only `--surface-input` stays white. Floating elements
>    (dialogs, dropdowns, sheets) separate by shadow.
> 2. Two extra tokens: `--surface-brand` (auth illustration panels) and `--surface-veil`
>    (spinner overlay, paper-tinted in theme).
> 3. `--surface-sunken` maps to `neutral-color-2`, not 1 (matches real well/track usage).
> 4. Guard shipped as `npm run check:surfaces`; decorative fills carry `// surface-ok` markers.
> 5. On paper, `neutral-2` borders are invisible — expandable/module outlines bumped to
>    `--border-color` (neutral-4), internal dividers to `neutral-3`.
> Visual comparison: https://claude.ai/code/artifact/71855e09-7411-4f6e-abd1-73be27469429
> Companion docs: [`look-and-feel-review.md`](look-and-feel-review.md), [`ux-improvement-plan.md`](ux-improvement-plan.md)

## Goal

Adopt the w4gz.com page background (`#f4f1eb`, warm cream "paper") as the Lib4GZ app background, and replace the cool mint/teal primary with a warm forest green that harmonizes with it. Keep the green identity.

## Findings

### The w4gz.com palette (extracted from its shipped CSS)

| Token | Value | Role |
|---|---|---|
| `--color-paper` | `#f4f1eb` | page background (`body { background-color: var(--color-paper) }`) |
| `--color-paper-dark` | `#ede9e0` | sunken/secondary surface |
| `--color-ink` | `#141414` | text |
| `--color-muted` | `#7a7872` | secondary text (warm gray) |
| `--color-amber` | `#9a6b00` | accent |

Warm, editorial "paper and ink" scheme. No green anywhere; every neutral has a warm undertone.

### Is the current teal suitable on paper? No.

Current primary is Material Teal (`theme-mint.scss`), hue ≈ 174° — a **cold, cyan-leaning green**. Paper is a **warm** near-white (hue ≈ 47°). Three concrete problems:

1. **Temperature clash.** Cold teal on warm cream reads clinical; the mid tones appear to float off the page instead of sitting on it.
2. **The light tints break hardest.** `primary-50 #f1f8f6` and `primary-100 #e0f2f1` are bluish near-whites. On white they read as fresh mint highlights; on cream they read as *dirty gray patches*. These tints back badges, hovers, and selected states everywhere.
3. **Contrast.** On `#f4f1eb`: teal-500 `#26a69a` = **2.66** (fails AA text), teal-600 = 3.83, teal-700 = 4.72 (barely passes). The whole ramp loses ~0.1–0.3 contrast vs white because paper is darker.

### Proposed replacement — "Forest" ramp

Same green family, hue shifted warm (~140°), light steps blended toward paper instead of pure white:

| Step | Hex | Contrast vs paper | White text on it |
|---|---|---|---|
| 50 | `#eef1e6` | — | — |
| 100 | `#dfe8d9` | — | — |
| 200 | `#c3d6c0` | — | — |
| 300 | `#9dbd9f` | — | — |
| 400 | `#6fa17f` | — | — |
| 500 | `#4d8763` | 3.75 (large text/UI) | 4.23 |
| 600 | `#3f7455` | **4.85 ✓ AA** | **5.47 ✓ AA** |
| 700 | `#336247` | **6.25 ✓ AA** | **7.05 ✓ AA** |
| 800 | `#29513a` | **7.99 ✓ AAA** | **9.00 ✓ AAA** |
| 900 | `#1d3a29` | ✓ | ✓ |

Better than the teal it replaces: the button step (600) and link step (700) pass AA both against paper and under white text, which teal-600 does not. Exact hex values may be fine-tuned during implementation once seen in the real app.

## Current state of the code

- Page background today is **browser-default white** — `styles.scss` sets no `body` background.
- **13 component SCSS files already reference `--surface-*` tokens** (`var(--surface-page, #ffffff)`, `var(--surface-hover, #f5f5f5)`, `var(--surface-sunken, ...)`, `var(--surface-success-subtle, #e8f5e9)`, …) — **but no `--surface-*` token is defined anywhere in the codebase.** Every reference silently falls through to its hardcoded fallback. The convention half-exists; only the definitions are missing.
- The fallbacks have drifted: `--surface-hover` falls back to `#f5f5f5`, `#f8f8f8`, *and* `var(--neutral-color-1)` in different files; `--surface-warning-subtle` to both `#fff8e1` and `#fff3e0`; one file falls back `--primary-color-100` to `#b2dfdb`, which is actually the 200 value. Same token, different colors — exactly the bug class central definitions eliminate.
- Beyond those, ~18 declarations use `var(--neutral-color-0)` directly as a background, ~15 use `neutral-1/2`, ~12 use `primary-50/100` tints, and 8 files contain raw hex/rgba backgrounds (`#fff`, `#f5f5f5`, `#ffebee`, `#e53935`, `rgba(0,0,0,.5)` scrims).
- Navbar/footer derive from `--primary-color-*` via token mixins (`navigation-bar-theme-by-primary-color-reverse`, `footer-theme-by-primary-color`) — they re-color automatically when the ramp changes.
- Neutrals are pure grays (`#f8f8f8` … `#333333`) — cool next to paper.

## Plan

### Phase 1 — surface-token refactor (zero visual change)

Define every background through a semantic token whose initial value equals today's rendered color. The app looks pixel-identical after this phase; the paper/forest swap then becomes a values-only edit in one file.

1. **Define the canonical surface set** in `tokens/_token.scss` (inside `default-configuration`, so themes can override):

   ```scss
   --surface-page: var(--neutral-color-0);        // app/page background
   --surface-raised: var(--neutral-color-0);      // cards, dropdowns, side-sheets, modals
   --surface-input: var(--neutral-color-0);       // form fields
   --surface-sunken: var(--neutral-color-1);      // wells, progress tracks, code blocks
   --surface-hover: var(--neutral-color-1);       // hover rows/items
   --surface-selected: var(--primary-color-50);   // selected nav/list items
   --surface-primary-subtle: var(--primary-color-100);  // tinted chips/banners
   --surface-success-subtle: #e8f5e9;
   --surface-warning-subtle: #fff8e1;
   --surface-error-subtle: #ffebee;
   --surface-overlay: rgba(0, 0, 0, var(--opacity-backdrop, 0.5));  // modal scrims
   ```

2. **Sweep every component SCSS background** to the right token and **delete the per-file fallbacks** (`var(--surface-page, #ffffff)` → `var(--surface-page)`). Fallbacks were the previous single-source-of-truth escape hatch; once tokens are defined they only hide missing definitions. Mapping:

   | Today | Becomes |
   |---|---|
   | `var(--neutral-color-0)` / `#fff` / `white` as bg | `--surface-raised` or `--surface-input` by context |
   | `var(--neutral-color-1/2)` as bg, `#f5f5f5`, `#f8f8f8` | `--surface-sunken` or `--surface-hover` by context |
   | `var(--primary-color-50)` as bg | `--surface-selected` |
   | `var(--primary-color-100/200)` as bg | `--surface-primary-subtle` |
   | `#e8f5e9`, `#ffebee`, `#fff8e1`, `#fff3e0`, `#e53935` | semantic `--surface-*-subtle` / `--error-color` |
   | `rgba(0,0,0,.5)` scrims | `--surface-overlay` |
   | `--error-bg` / `--success-bg` / `--warning-color-bg` (also undefined) | fold into the `--surface-*-subtle` set |

   Solid semantic fills (`background: var(--success-color)` on badges) already go through tokens — leave them.

3. **`src/styles.scss`**: `body { background-color: var(--surface-page); }` — makes the page background themeable at all.
4. **Guard (cheap, optional):** an npm script that greps component SCSS for `background[^;]*(#|rgba?\(|neutral-color|primary-color)` and fails CI, so hardcoded backgrounds can't creep back. No stylelint dependency needed.

### Phase 2 — theme swap (now a values-only edit)

5. **`theme/theme-mint.scss`** (or rename to `theme-forest.scss` + update `_theme_index.scss`):
   - Replace the ten `--primary-color-*` values with the Forest ramp.
   - Override surfaces: `--surface-page: #f4f1eb`, `--surface-raised: #ffffff`, `--surface-input: #ffffff`, `--surface-sunken: #ede9e0`, `--surface-hover: #ede9e0`.
   - Warm the neutrals: text end `--neutral-color-9: #141414` (ink), `--neutral-color-7: #6f6d66` (warm muted); light end toward paper (`#f8f8f8 → #f7f5f0`, `#e4e4e4 → #e5e1d8`-ish) so dividers/scrollbars don't look blue-gray on cream. Tune by eye.
6. Navbar + footer pick up forest automatically via the existing mixins (verify the mixin lands on a dark-enough step — target 700/800).

### Phase 3 — visual pass + spec updates

7. Screen-by-screen visual pass at desktop + mobile (same method as `look-and-feel-review.md`). Watch for:
   - **Full-bleed sections that assumed a white page** (login/register panels, dashboard bands) — remove backgrounds that existed only to "match the page".
   - Cards/inputs now white-on-cream (intended: free elevation, principle 3) — adjust shadows/spacing where the inversion looks off.
8. `documents/design-system/` — update color tokens, theme, and **`design-principles.yaml`**: principle 1 currently says multi-column layouts "share the same background color (**white**)" — becomes *paper*. The Unified Surface rule itself is unchanged: sidebar and content still share one background, now cream. Document the new surface-token set as the required way to set any background.
9. Update `current_styles` blocks in affected screen specs as they are touched.

## Risks / open questions

- **Success color collision.** `--success-color: #388e3c` is itself a warm green — with a forest primary, "success" and "brand" become near-neighbors. Options: darken/shift success, or accept (many green-brand products do). Decide during phase 2 visual pass.
- **White images/illustrations** (course covers, empty-state art with white backgrounds) will show visible boxes on cream. Audit during phase 2.
- **Cards go white-on-cream** — this *inverts* today's look (colored nothing, white everything). Screens that relied on the page itself being white may need spacing/shadow adjustments.
- Mint teal disappears entirely. If any attachment to teal remains, it could survive as a secondary/info hue — but recommendation is a clean swap; two greens plus teal gets muddy.

## Effort

- Phase 1 (tokenize): ~2–3 hours — mechanical sweep across ~20 SCSS files, zero visual diff to verify.
- Phase 2 (theme swap): ~1 hour — values-only edits in theme + token files.
- Phase 3 (visual pass + specs): half a day including the screen-by-screen check.
