---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Navbar — PRD (1 min)

- **Problem.** Authenticated users need a constant anchor — somewhere to confirm they are logged in, jump back to home, and sign out — without hunting through individual screens.
- **Primary user.** Every authenticated user (student, teacher, admin). The navbar is the only persistent UI on `/`, `/profile`, `/course/**`, and the manage screens.
- **Outcome.** A 70px-tall bar at the top of every authenticated screen with the **Lib4GZ** brand link on the left and a notifications bell + user avatar on the right. Clicking the avatar reveals the user's display name, **Profile**, and **Log out**.
- **Always current name.** Display name and initial come from live `AuthService` signals, so a Profile edit shows at once. On mount the navbar refreshes the user from the server.
- **Hidden where it would distract.** Sign-in, both sign-up screens, the exercise editor, and the exercise attempt screen render no navbar — those pages own the full viewport.
- **Logout flow.** Avatar click → menu opens → **Log out** → `AuthService.logout()` clears tokens → navigate to `/login`. Clicking outside the menu closes it.
- **Theming.** Uses `navigation-bar-theme-by-primary-color-reverse` — teal background, white text — so the navbar reads as the app's primary surface, not a chrome accent.
- **Status.** Implemented. Notifications icon is UI-only — clicking does nothing today; unread badge is planned but not wired.
- **Reads more.** [`prd-5min.md`](./prd-5min.md), [`prd-full.md`](./prd-full.md), [`design-1min.md`](./design-1min.md), [`contract.yaml`](./contract.yaml).
