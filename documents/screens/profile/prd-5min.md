---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-16
review_cadence: per-release
---

# Profile — PRD (5 min)

The signed-in user's own account page at `/profile`.

## Problem & outcome

| | |
|---|---|
| **Before** | The email could be changed by a 6-digit code, but the Google account connected to the user could not. After a change, the old Google account still signed the person in and the new one was refused as "linked to a different Google account". |
| **After** | The email is read-only and is the connected Google account's address. A Google button under the field connects an account (also verifying the email) or switches to another. Display name edits stay as they were. |

## Primary user

- **Any signed-in user.** Wants to fix a display name, or move the account to another Google identity.
- **Password user with an unconfirmed email.** Connects Google to verify the address and get one-click sign-in.

## User stories (in scope)

1. As a user, I open the avatar menu → **Profile** and see my avatar, display name, and `@username`.
2. As a user, I change my display name, click **Save changes**, see "Profile saved", and the navbar shows the new name.
3. As a user without Google, I see my email read-only with an **Unverified** (or **Verified**) badge and, under it, a button reading **Connect a Google account** (with "Connecting a Google account also verifies your email." below it while the address is unverified). Picking a Google account connects it: the email becomes that account's address, the badge turns **Verified**, the avatar comes from Google, and I see "Google account connected".
4. As a user with Google connected, the button reads "Connect other Google account". Picking a different account switches to it (email and avatar follow; "Google account changed"). Picking the same one again refreshes address and avatar. There is no confirmation step.
5. As a user, if the Google account is already connected to someone else, or its address is already used by another account, I see the server's reason under the form and nothing changes.
6. As a user, I cannot edit my username or type into the email field.

## Scope

**In scope**

- Read-only username and email; required display name (max 255).
- Email badge: **Verified** / **Unverified** from `emailVerified`.
- Google button under the email wearing our label (`app-google-sign-in` with `[label]`, 280px), hint below it while unverified.
- Toasts for saved / connected / changed.
- Single centered column, max width 520px.

**Out of scope (this iteration, not "never")**

- Disconnecting Google (needs a password on the account to avoid lock-out).
- Confirming before a switch (Google's own chooser is the confirmation; the switch is reversible).
- Avatar upload, password change/reset, account deletion, username change.

## Key assumptions

- Google renders the button and only offers its own four labels, so our wording is drawn over it and Google's invisible button keeps the clicks. Its language comes from `?hl=en` on the script tag; the `locale` render option is ignored.
- The server sets `email`, `emailVerified`, `googleConnected` and `avatarUrl` from the token in one transaction and returns the whole user; the page never derives them locally.
- The server mails the old address when the email changes; the page shows nothing about that.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Google script blocked or offline | No button; the person cannot connect | `app-google-sign-in` hides itself and logs a warning; the caption still explains what the button would do |
| Cached `user` from before this release lacks `googleConnected` | Caption briefly says "Connect" for a connected account | `getMe()` on init replaces the cached user |
| Accidental switch to another Google account | Sign-in moves to the new account | Reversible by connecting the old one again; the old address is mailed by the server |

## Dependencies

- `AuthService.connectGoogle` → `auth.google-connect`; `MeService.getMe` / `updateMe` → `me.get` / `me.update`. See [`network/api-endpoints.yaml`](../../network/api-endpoints.yaml).
- `AuthService.currentUser` / `setCurrentUser` to keep navbar and localStorage in sync.
- `app-google-sign-in` (shared with `/login` and `/register`, see [`screens/auth/`](../auth/prd-5min.md)).
- Shared components: `lib-input`, `lib-button`, `lib-avatar`, `lib-badge`, `lib-toast`, `lib-spinner`.
