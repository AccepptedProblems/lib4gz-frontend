# shared components

Owns: the `lib-` components every screen reuses. `../pipes/` follows the same rules.

## Rules

- A shared component is standalone, has a `lib-` selector, uses signal `input()` and
  `output()` only, styles itself with CSS custom properties (no Sass imports), and imports
  nothing from `services/` or `components/`.
- A new one adds its line to `index.ts`. Screens import from that barrel.
- Screens do not rebuild buttons, confirm dialogs, toasts, skeletons or spinners.
- `lib-button`: its colours and sizes come from the global
  `src/assets/design-system/components/_button.scss`, not from `button.component.scss`. It
  emits `(buttonClick)`, and `type` defaults to `button`, so a form needs `type="submit"`.
- Toasts: `<lib-toast />` is mounted once in `src/app/app.component.html`. A screen injects
  `ToastService` and never renders the component.
- `lib-dialog` is a confirm dialog with a fixed Cancel and Confirm footer; the parent owns
  `open`, `loading` and `confirmDisabled`. For custom content with a footer, use
  `lib-side-sheet`.
- `lib-input` works only as a form control (`ngModel` or a form control). `label` is
  required and `error` is a string the parent supplies.

## Gotchas

- `LinkifyPipe` returns `bypassSecurityTrustHtml` over its raw input. Anything bound through
  it renders as HTML, unsanitized.
- Badge, chip, toast and dialog name status tokens that do not exist, so the literal
  fallback after the comma is what renders. A theme change does not recolour them.
- `lib-spinner` wraps Angular Material's spinner and no Material theme is loaded. Only
  `color="inherit"` sets a stroke colour.
- There is no `lib-pagination` and no `lib-dropdown-menu`.

## Verify

Only `otp-input` has a spec.
