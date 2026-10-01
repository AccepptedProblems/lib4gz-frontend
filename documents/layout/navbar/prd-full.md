---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Navbar — PRD (Full)

Standalone full-detail PRD. For the short reads, see [`prd-1min.md`](./prd-1min.md) and [`prd-5min.md`](./prd-5min.md).

## 1. Acceptance criteria

### A. Visibility

- A1. The navbar is rendered on every route guarded by `authGuard` **except** the routes listed in A2.
- A2. The navbar is **not** rendered on:
  - `/login`, `/login?...`
  - `/register`, `/register?...`
  - `/register/complete`
  - `/course/:courseId/manage/exercise/...` (exercise editor)
  - `/course/:courseId/lesson/:lessonId/attempt...` (exercise attempt)
- A3. Visibility is controlled centrally by `AppComponent.showNavbar` — individual screens do not toggle the navbar themselves.

### B. Layout & dimensions

- B1. The navbar height is exactly **70px**.
- B2. Horizontal padding is `var(--spacing-xl)` on screens ≥768px and `var(--spacing-md)` below 768px.
- B3. The navbar is a flex row with `justify-content: space-between` — brand on the far left, action cluster on the far right.
- B4. The navbar uses `z-index: var(--z-index-sticky)` so it sits above page content.

### C. Brand

- C1. Brand is the literal text `Lib4GZ` rendered as an anchor element with `routerLink="/"`.
- C2. Brand uses the `text-title-medium` typography step (see [`design-system/typography.yaml`](../../design-system/typography.yaml)).
- C3. Brand color is `var(--nav-bar-text-color)` (white in the active theme); no underline.
- C4. Clicking the brand navigates to `/` regardless of which authenticated screen the user is on.

### D. Notifications icon

- D1. Rendered as a `<button type="button">` with `aria-label="Notifications"`.
- D2. The icon is the Material Symbols Outlined glyph `notifications`, sized 24px.
- D3. The button is positioned to the **left** of the avatar, separated by `var(--spacing-md)`.
- D4. The button has no functional click handler today; clicking it does nothing.
- D5. An unread-count badge is **not** rendered today (planned — see open questions in `design-full.md`).

### E. User avatar

- E1. Rendered as a `<button>` with `aria-label="User menu"` and a dynamic `aria-expanded` that mirrors `avatarMenuOpen()`.
- E2. The avatar is a 36×36 circle (`border-radius: var(--radius-full)`) with background `var(--nav-bar-button-bg-color)` and text color `var(--nav-bar-button-text-color)`.
- E3. The avatar text is `AuthService.userInitial()` — the **first character** of the display name (username when the name is blank), uppercased. If empty, the literal `U` is shown.
- E5. When the navbar mounts and `AuthService.isAuthenticated()` is true, it calls `MeService.getMe()` once and passes the result to `AuthService.setCurrentUser`. Errors are ignored silently. Name and initial update reactively.
- E4. Clicking the avatar toggles `avatarMenuOpen` (open ↔ closed). Click events stop propagation so the document-level click-outside handler does not immediately re-close the menu.

### F. Avatar dropdown menu

- F1. The menu is rendered only while `avatarMenuOpen() === true`.
- F2. The menu is absolutely positioned at `top: calc(100% + var(--spacing-xs))`, `right: 0` — i.e. anchored to the avatar's bottom-right corner.
- F3. Menu container uses `role="menu"`, white background (`var(--neutral-color-0)`), `border-radius: var(--radius-md)`, and a soft elevation shadow `0 4px 16px rgba(0,0,0,0.12)` — **no border**, per the Elevation-Over-Borders design principle.
- F4. Minimum width is 160px; the menu may grow to fit content.
- F5. The first row is the name label — `AuthService.userName()`, font-weight 600, with a `1px solid var(--neutral-color-3)` bottom divider. The label is text only — clicking it does nothing.
- F6. The second row is an `<a role="menuitem" routerLink="/profile">` with the Material Symbols `person` icon and the literal text `Profile` (no underline). Clicking it navigates to `/profile` and closes the menu.
- F6b. The third row is a `<button role="menuitem">` containing the Material Symbols `logout` icon and the literal text `Log out`. On hover, menu items get background `var(--neutral-color-1)`.
- F7. Clicking **Log out** runs, in order: `AuthService.logout()`, then `Router.navigate(['/login'])`. The menu closes implicitly because the navbar unmounts on the new route.
- F8. The menu closes when:
  - The user clicks the avatar a second time (toggle).
  - The user clicks anywhere outside the menu (`document:click` host listener on the navbar component).
  - The user selects **Profile** (`closeMenu()`).
  - The user selects **Log out**.

### G. Theming

- G1. The navbar uses the `navigation-bar-theme-by-primary-color-reverse` mixin (see [`design-system/theme.yaml`](../../design-system/theme.yaml)). In the active Mint theme this resolves to teal background, white text.
- G2. The token mappings used inside the navbar (background, text color, button background, button text color, active item color) are owned by the theme mixin — the navbar component itself only references the resolved CSS custom properties.

### H. Responsive

- H1. <768px: horizontal padding shrinks to `var(--spacing-md)`. Brand and action sizes are unchanged.
- H2. The avatar menu's right-anchor position keeps it inside the viewport on mobile because the menu is wider than the avatar but still narrower than the viewport.

### I. Accessibility

- I1. The root `<nav>` element has `aria-label="Main navigation"`.
- I2. The brand is a real `<a>` with meaningful text content.
- I3. The notifications button has `aria-label="Notifications"`.
- I4. The avatar button has `aria-label="User menu"` and `aria-expanded` reflecting the menu state.
- I5. The avatar menu uses `role="menu"`; the Profile link and logout button use `role="menuitem"`.
- I6. All interactive elements are reachable via Tab, in DOM order: brand → notifications → avatar → (when open) Profile → logout.
- I7. Color contrast for white-on-teal text in the brand and avatar areas meets WCAG AA at the `text-title-medium` step.

## 2. Edge cases

| Case | Expected behavior |
|---|---|
| User is logged in but no user is stored yet (session from before the full user was stored) | Avatar shows `U` until the on-mount `getMe` fills `currentUser`, then updates. |
| User edits display name on `/profile` | Navbar name and initial update immediately (shared `currentUser` signal). |
| Username contains a leading non-letter (digit, emoji, accented char) | The first character (whatever it is), uppercased via `String#toUpperCase()`, is rendered. No special handling. |
| User clicks the avatar repeatedly | Menu toggles; no animation queue. |
| User opens the avatar menu, then navigates via the brand link | The navbar persists across the navigation, but the menu state is recreated on the new view → menu is closed. (`avatarMenuOpen` is component-local and resets on remount.) |
| User clicks **Log out** while offline | `AuthService.logout()` clears local tokens regardless of network state. Navigation to `/login` succeeds because it is a client-side route. |
| User is on `/login` or any `/register` step | Navbar is not rendered. The avatar menu cannot exist. |
| User is in the exercise editor or exercise attempt | Navbar is not rendered. To log out, the user must first leave the screen. (See open questions — should we expose logout inside those screens?) |
| Click on the avatar fires the `document:click` listener | The avatar's own click handler calls `event.stopPropagation()` so the host listener does not see it; the toggle happens correctly. |
| Two consecutive clicks on **Log out** | The second click resolves on a different route (`/login`) where the navbar is not rendered — it cannot fire. |

## 3. Error matrix

The navbar makes one API call, the on-mount `getMe` refresh. Logout is synchronous local-storage clearing.

| Source | Triggered when | UI surface | Recovery |
|---|---|---|---|
| `MeService.getMe()` fails | Network error, 404, or 401 | None — error swallowed; stored user keeps rendering. A 401 still goes through `errorInterceptor` (refresh → logout). | Next mount retries. |
| `AuthService.logout()` throws (very unlikely — it is synchronous storage clearing) | Browser blocks `localStorage` access (e.g. private mode quota) | No visible error; the navigation to `/login` still runs. | The login screen will fail to find a valid token and show its normal unauthenticated state. |

## 4. Analytics (proposed)

The navbar is a low-traffic UI; analytics are nice-to-have rather than required for this iteration.

- `navbar_brand_clicked` — when the brand link is activated. Payload: `{ from: <currentUrl> }`.
- `navbar_avatar_menu_opened` — when the avatar menu transitions to open. Payload: `{ from: <currentUrl> }`.
- `navbar_logout_clicked` — when **Log out** is selected. Payload: `{ from: <currentUrl> }`.

No tracking SDK is wired in the app yet — these are placeholders, not commitments.
