---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Navbar — Tech Design (1 min)

- **What we're building.** A standalone Angular component (`app-navbar`) rendered by `AppComponent` whenever the current URL is **not** in a small allow-deny list. The navbar has three slots — brand link, notifications icon, avatar with a dropdown menu — and reads the name and initial from `AuthService` signals.
- **Key decision.** **Visibility is decided in `AppComponent`, not in the navbar itself.** A `showNavbar` `computed()` watches `Router.events` (NavigationEnd) and matches against a literal-route list (`/login`, `/register`, `/register/complete`) plus two regex patterns (exercise editor, exercise attempt). *Rejected:* per-screen flags, route-data property (`hideNavbar: true`) — both require every new screen to remember to opt in/out. Centralizing the rule keeps the deny-list visible in one file.
- **Second decision.** **Avatar menu state is component-local signals + a `document:click` host listener** — no overlay service, no CDK menu. The menu is one of two siblings of the avatar wrapper, so a click-outside is simply "any document click while open".
- **State.** `avatarMenuOpen` (component-local), `AuthService.userName` / `userInitial` (computed from `currentUser`, so Profile edits show at once), and the URL signal in `AppComponent`. On mount, if authenticated, `MeService.getMe()` → `AuthService.setCurrentUser` refreshes the stored user (role grants, sessions stored before the full user was kept).
- **Top risks.** (1) Adding a new full-screen route requires updating `hiddenRoutePatterns` in `AppComponent` — easy to forget. (2) The `document:click` listener fires for every click on every authenticated screen; the body of the handler is cheap but it is a global subscription. (3) Notifications button is rendered with no behavior, which can confuse users. (4) The `getMe` refresh runs on every navbar mount (e.g. after leaving a full-screen route), not strictly once per app load.
- **Reads more.** [`design-5min.md`](./design-5min.md), [`design-full.md`](./design-full.md), [`contract.yaml`](./contract.yaml).
