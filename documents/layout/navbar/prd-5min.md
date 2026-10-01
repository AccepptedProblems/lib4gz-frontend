---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Navbar — PRD (5 min)

The persistent top bar on every authenticated screen. It exists so the user always knows which app they are in, can jump home, can confirm which account is active, and can log out without searching for a settings page.

## Problem & outcome

| | |
|---|---|
| **Today** | Without a top-level chrome, users would lose orientation between screens and have no consistent way to log out. |
| **After this ships** | Every authenticated screen carries the same 70px-tall teal bar: brand on the left, notifications + avatar on the right. The avatar opens a menu showing the active account, a Profile link, and a Log out action. |

## Primary user

- **Any authenticated user** (USER, TEACHER, ADMIN). Everyone needs the same brand link and logout path.
- **Returning user.** Confirms which account is signed in via the display name inside the avatar menu.

## User stories (in scope)

1. As an authenticated user, I see **Lib4GZ** in the top-left on every screen so I can click it to return to my dashboard.
2. As an authenticated user, I see a circular avatar with my initial in the top-right so I can locate the account menu at a glance.
3. As an authenticated user, I click the avatar and see my display name, **Profile**, and **Log out**.
4. As an authenticated user, I click **Profile** and land on `/profile`; the menu closes.
5. As an authenticated user, after I change my display name on Profile, the navbar name and initial update without a reload.
6. As an authenticated user on the avatar menu, I click **Log out** and land back on `/login` with my session cleared.
7. As a keyboard user, I can tab to the avatar button, activate it with Enter/Space, and the menu's `aria-expanded` reflects the open state.
8. As a user on a focus-heavy screen (sign-in, sign-up steps, exercise editor, exercise attempt), I do **not** see the navbar — the screen owns the viewport.

## Scope

**In scope (this iteration)**

- Brand text link to `/`.
- Notification bell icon (visual only — no panel, no live count).
- User avatar with first character of the display name (or username), uppercased; falls back to `U` if empty.
- Avatar dropdown menu with name label, **Profile** link, and **Log out** action.
- Silent user refresh from the server on mount (picks up role grants and name changes made elsewhere).
- Click-outside / second-click closes the menu.
- Hidden on `/login`, `/register`, `/register/complete`, exercise editor (`/course/:id/manage/exercise/...`), and exercise attempt (`/course/:id/lesson/:id/attempt...`).
- Mint theme primary-reverse styling (teal background, white text).
- Mobile padding reduction at <768px.

**Out of scope (this iteration, not "never")**

- Notifications panel and live unread count badge.
- Settings entries beyond Profile inside the avatar menu.
- Search bar in the navbar (search lives inside individual screens, e.g. user dashboard).
- Localization / language switcher.
- Tenant or workspace switcher.
- Keyboard shortcut to focus the brand link (e.g. `g h`).

## Key assumptions

- `AuthService.userName()` (name, else username) is non-empty for signed-in users; an empty value falls back to `U` for the avatar initial.
- The list of routes where the navbar must be hidden is small and stable — encoding it as a literal list + two regex patterns in `AppComponent` is acceptable.
- The Mint theme is the only active theme; theme switching is not a current product feature.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| New full-screen routes added without updating `AppComponent.hiddenRoutePatterns` | Navbar appears on a screen that was supposed to own the viewport | Document the list here and in `design-full.md`; add a new pattern when introducing a new full-screen route. |
| Username overflows the dropdown width (160px min) | Truncated label / awkward wrap | Allow the menu to grow to fit the longest line; cap at 240px in a future iteration if names get pathological. |
| `document:click` host listener intercepts clicks inside the menu | Menu closes immediately when user clicks the username label | Menu container calls `event.stopPropagation()` on its own click handler. |
| Notification icon looks interactive but does nothing | User confusion / loss of trust | Either ship the panel before launch, or visibly disable the button until the feature is ready (TBD — see open questions). |

## Dependencies

- `AuthService.userName` / `userInitial` signals, `isAuthenticated`, `setCurrentUser`, `logout`.
- `MeService.getMe` (`me.get`) for the on-mount refresh.
- Angular `Router` / `RouterLink` for `/login`, `/profile`, and the brand link.
- Material Symbols icon font for the bell and logout glyphs.
- Design system tokens — see [`design-system/tokens.yaml`](../../design-system/tokens.yaml) for spacing, radius, and z-index.
- Theme mixin `navigation-bar-theme-by-primary-color-reverse` — see [`design-system/theme.yaml`](../../design-system/theme.yaml).
