# design system

Owns: the global styles and every design token. The values in these files are the truth;
no other document lists them.

## How it loads

`src/styles.scss` uses `_design.scss`, which loads in this order: theme
(`theme/_theme_index.scss`, which uses `theme/theme-mint.scss`), `ui-style/ui-style-default.scss`,
`tokens/_token.scss` (mixins only), `_typography.scss`, `_component.scss` (button, input),
`_form.scss`. Nothing loads `_color.scss`.

## Rules

- One theme, Mint, is compiled in and applied to `:root`. There is no runtime switch. To
  change theme, point `theme/_theme_index.scss` at another file that defines the primary and
  neutral ramps and the three status colours, then includes `default-configuration`,
  `interaction-tokens`, one navigation-bar mixin and one footer mixin.
- A token exists only if it is defined in `theme/theme-mint.scss`, `tokens/_token.scss` or
  the `:root` block of `_typography.scss`. Check before using one.
- Components use `var(--token)` directly. The only Sass file a component may import is
  `_breakpoint.scss` (variables only), by relative path. Importing `typography`,
  `component`, `form` or `design` copies global CSS into that component's stylesheet and
  counts against its 8 kB warning and 12 kB error budget.
- Media queries are `max-width` with the variables in `_breakpoint.scss`.
- Type scale in templates: the global classes
  `text-{display|headline|title|body|label}-{large|medium|small}`. Text colour is set in
  SCSS with `var(--text-primary-color)` or `var(--text-secondary-color)`.

## Design principles

1. **Unified surface.** A sidebar and its content share one background. No `background`,
   `background-color`, `border-left` or `border-right` on a desktop sidebar; separate the
   columns with space only. If you see one, it is a bug: remove it.
2. **The mobile drawer is the exception.** At `$mobile-large-breakpoint` (768px) and below,
   a sidebar becomes a fixed drawer. It must have a background and sit at the drawer level
   (`--z-index-drawer`, 400) above a backdrop, and a visible hamburger toggle must appear. A two-column screen with no
   toggle on mobile is a bug.
3. **Breathing room.** Content padding is at least `--spacing-lg` (24px), and never below
   `--spacing-md` (16px) on mobile. Centred content uses `max-width` with auto margins.
4. **Elevation over borders.** Distinguish with `--shadow-sm`, `--shadow-md` or
   `--shadow-lg`. Borders are for form inputs, table rows and dividers inside one column.
5. **Hierarchy through type.** Use the type scale and the two text colours, not background
   colour, to show importance.
6. **Quiet interaction.** A selected item uses `--primary-color-50` with a 3px left accent
   in `--primary-color-600`. Hover uses `--duration-normal`, expand and collapse
   `--duration-slow`.

## Gotchas

- The global `button` rule in `components/_button.scss` hits every `<button>`: flex
  centring, 36px minimum height, no border, white text, a 2px lift on hover. A raw button
  must reset what it does not want.
- Everything is `border-box`. `h1` to `h6` and `p` get the type scale and a 16px bottom
  margin globally.
- These names are used in the code but defined nowhere: every `--surface-*`,
  `--border-default`, `--border-subtle`, `--border-strong`, `--shadow-xs`, `--shadow-xl`,
  `--spacing-2`, `--text-color`, and the template classes `text-primary` and
  `text-secondary`. Where a `var()` has a fallback, the fallback is what renders.
- `.text-body-small` is bold.
- `[data-ui="default"]` in `ui-style/ui-style-default.scss` never matches; nothing sets
  that attribute.
- Each status colour (warning, success, error) has a single shade.
