---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Navbar — Tech Design (Full)

Full implementation reference. For shorter reads, see [`design-1min.md`](./design-1min.md) and [`design-5min.md`](./design-5min.md).

## 1. Component map

```
AppComponent (src/app/app.component.ts)
├─ @if (showNavbar()) <app-navbar />
└─ <router-outlet />

app-navbar  (src/app/components/layout/navbar/)
└─ <nav aria-label="Main navigation">
    ├─ <a routerLink="/">Lib4GZ</a>            (.navbar-brand .text-title-medium)
    └─ .navbar-actions
        ├─ <button aria-label="Notifications"> (.navbar-icon-btn)
        │     └─ Material Symbols: notifications
        └─ .avatar-wrapper
            ├─ <button aria-label="User menu"  (.navbar-avatar)
            │          [aria-expanded]="avatarMenuOpen()"
            │          (click)="toggleAvatarMenu($event)">
            │     └─ <span>{{ userInitial() }}</span>
            └─ @if (avatarMenuOpen()) {
                  <div role="menu" (click)="$event.stopPropagation()">  (.avatar-menu)
                    ├─ <span>{{ userName() }}</span>                     (.avatar-menu-username)
                    ├─ <a role="menuitem" routerLink="/profile"
                    │     (click)="closeMenu()">                         (.avatar-menu-item)
                    │     ├─ Material Symbols: person
                    │     └─ "Profile"
                    └─ <button role="menuitem" (click)="logout()">       (.avatar-menu-item)
                          ├─ Material Symbols: logout
                          └─ "Log out"
                  </div>
               }
   </nav>
```

Source files:

- TS: `src/app/components/layout/navbar/navbar.component.ts`
- HTML: `src/app/components/layout/navbar/navbar.component.html`
- SCSS: `src/app/components/layout/navbar/navbar.component.scss`
- Host (visibility decision): `src/app/app.component.ts`

## 2. State (signals + properties)

| Name | Owner | Type | Notes |
|---|---|---|---|
| `userInitial` | NavbarComponent (alias of `AuthService.userInitial`) | `Signal<string>` | First char of `userName()`, uppercased, else `'U'`. |
| `userName` | NavbarComponent (alias of `AuthService.userName`) | `Signal<string>` | `currentUser.name \|\| currentUser.username`. |
| `avatarMenuOpen` | NavbarComponent | `signal<boolean>` | Drives the `@if` for the dropdown and the avatar's `aria-expanded`. |
| `currentUrl` | AppComponent | `Signal<string>` via `toSignal(...)` | Latest `urlAfterRedirects` from `NavigationEnd`. |
| `showNavbar` | AppComponent | `computed<boolean>` | `true` unless `currentUrl` matches `hiddenRoutes` or `hiddenRoutePatterns`. |
| `hiddenRoutes` | AppComponent | `string[]` | `['/login', '/register', '/register/complete']`. |
| `hiddenRoutePatterns` | AppComponent | `RegExp[]` | `[/^\/course\/[^/]+\/manage\/exercise\//, /^\/course\/[^/]+\/lesson\/[^/]+\/attempt/]`. |

## 3. Routing & guards

The navbar is not a routed component. It is mounted in `AppComponent`'s template, outside `<router-outlet>`. There are no guards — visibility is decided in code.

- **Brand `routerLink`:** `/` (the user dashboard).
- **Profile link:** `routerLink="/profile"` (authGuard route).
- **Logout target:** `/login` via `Router.navigate(['/login'])` after `AuthService.logout()`.
- **Hidden routes:** see §2 (`hiddenRoutes` literal list and `hiddenRoutePatterns` regex list).

## 4. Behaviour

| Action | Code path | Outcome |
|---|---|---|
| Page navigation | `AppComponent.currentUrl` updates → `showNavbar` recomputed | Navbar mounts/unmounts according to URL match |
| Navbar mounts | `ngOnInit`: if `isAuthenticated()`, `MeService.getMe()` → `AuthService.setCurrentUser` | Name/initial refresh; errors ignored |
| Click **Profile** | `routerLink="/profile"` + `closeMenu()` | Menu closes; router navigates to `/profile` |
| Click brand | `routerLink="/"` | Router navigates to `/`; navbar persists |
| Click notifications icon | No handler bound | Nothing happens (intentional — UI-only) |
| Click avatar | `toggleAvatarMenu($event)` | `event.stopPropagation()`; toggle `avatarMenuOpen` |
| Click inside menu container | `(click)="$event.stopPropagation()"` on `.avatar-menu` | Click is consumed; `document:click` host listener does not fire |
| Click outside menu (anywhere on the page) | `@HostListener('document:click') closeAvatarMenu()` | If `avatarMenuOpen()`, set to `false` |
| Click **Log out** | `logout()` | `AuthService.logout()` → `Router.navigate(['/login'])`; navbar unmounts on the new URL |

## 5. Failure modes

| Mode | Detection | UX | Notes |
|---|---|---|---|
| No stored user (old session) | `currentUser()` null | Avatar shows `U` until `getMe` resolves | Self-heals on the on-mount refresh. |
| `getMe` fails | `error: () => {}` | No change | 401 still flows through `errorInterceptor` (refresh → logout). |
| `document:click` fires while menu is closed | `closeAvatarMenu()` early-returns because `avatarMenuOpen()` is false | No-op | Cheap; runs on every click but does nothing when the menu is closed. |
| Avatar `(click)` does **not** stop propagation (regression) | `closeAvatarMenu()` would set `avatarMenuOpen` to `false` immediately after `toggleAvatarMenu` flipped it | Menu would never appear to open | Guarded by the `event.stopPropagation()` call in `toggleAvatarMenu`. |
| New full-screen route is added but `hiddenRoutePatterns` is not updated | Navbar appears on top of the new screen | Visual bug only | Caught at review time; documented in `prd-full.md` Risks. |
| Logout fired while offline | `AuthService.logout()` synchronously clears storage; `Router.navigate(['/login'])` is client-side | `/login` renders normally | Login itself will fail until the device is back online. |
| Component destroyed mid-listener | Angular tears down `@HostListener` automatically | No leak | Standard Angular semantics. |

## 6. Decision log

| Date | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| 2026-04 | **`showNavbar` lives in `AppComponent`, not in route data or per-screen flags** | (a) Add `data: { hideNavbar: true }` to each affected route and read it via `ActivatedRoute`; (b) per-screen `*ngIf` toggling. | (a) requires every new route author to remember the flag and the `ActivatedRoute` plumbing; (b) duplicates logic across screens. A central deny-list is the smallest readable solution. |
| 2026-04 | **Notifications icon ships visual-only with no panel** | Hide the icon until the feature is ready; ship it disabled with a tooltip. | The bell signals "this app has notifications" and reserves the layout slot. The risk of confusion is acknowledged in `prd-5min.md` Risks; revisit before public launch. |
| 2026-04 | **Plain `<button> + @if` dropdown — no CDK Overlay, no `mat-menu`** | Angular Material `mat-menu`; CDK Overlay with `OverlayRef`. | The menu had two rows and one anchor (three rows since Profile was added, 2026-09). Material adds a dependency and styling layer we'd then have to override to match the design system. Hand-rolled CSS is shorter. |
| 2026-04 | **`document:click` host listener for click-outside** | CDK `Overlay` with backdrop click; an explicit invisible backdrop element. | The host listener is one decorator and one method. The cost is a global click handler on every authenticated screen, which we accept. |
| 2026-04 | ~~Username and initial read once on construct~~ | — | Superseded 2026-09 below. |
| 2026-09 | **Name and initial bound to `AuthService` computed signals** | Keep read-once; navbar re-fetch on navigation. | Profile can change the display name; the shared signal shows it at once with no subscription code. |
| 2026-09 | **Profile item above Log out** | Separate settings page link; name label clickable. | One explicit menu item is clearer; Log out stays last. |
| 2026-09 | **`getMe` refresh on navbar mount** | Refresh only at login; refresh in `AuthService` constructor. | Picks up role grants and fills sessions stored before `user` JSON existed; `AuthService` cannot inject `MeService` (cycle). |
| 2026-04 | **Avatar fallback character is the literal `U`** | A generic icon (e.g. user silhouette); the literal `?`. | Matches the visual language of letter-based avatars used elsewhere in the app and degrades gracefully when names are missing. |
| 2026-04 | **Navbar is hidden on exercise editor and exercise attempt** | Always show the navbar. | Both screens are full-bleed editing/learning surfaces where the navbar would steal vertical space and visual attention. |

## 7. Open questions

1. **Notifications panel.** When does this ship? Until then, should the bell button be visibly disabled (cursor: not-allowed, lower opacity) instead of looking active?
2. **Duplicate `getMe` on `/profile`.** Navbar and Profile both refresh the user on load. Acceptable for now; skip one if it matters.
3. **Logout while inside the exercise editor / attempt screens.** The navbar is hidden, so the user has no way to log out without leaving. Is that a feature (focus protection) or a bug?
4. **Refresh frequency.** `getMe` runs on every navbar mount (e.g. returning from the exercise editor), not once per app load. Move to a one-shot flag if request volume matters.
5. **Keyboard navigation inside the menu.** Tab works; arrow keys do not cycle between menu items. Acceptable with two actions (Profile, Log out); revisit before adding more.
6. **Mobile menu width.** Today the menu has `min-width: 160px` and grows to fit content. For very long names the menu could overflow the right edge. Cap at, say, `min(240px, calc(100vw - var(--spacing-md) * 2))` if we see real users hit it.
7. **Theme switching.** The navbar reads `var(--nav-bar-*)` tokens, so theme switches at runtime would just work — but we have not validated this with a non-Mint theme. Out of scope for now.
