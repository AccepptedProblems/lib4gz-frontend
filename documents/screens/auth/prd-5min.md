---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Auth (Sign in + Sign up) — 5-min PRD

> The public entry points to Lib4GZ: one sign-in screen and a two-step sign-up (email + code dialog, then account setup). Treated as one feature because they share layout, the brand panel, the Google button, and `AuthService`.

## Problem

- Login said "Email or username" but only usernames worked.
- Registration accepted any email without checking it, so accounts could not be recovered or matched to Google.
- There was no Google sign-in.

## Primary users

| Role | Screens | Goal |
|---|---|---|
| Returning user | `/login` | Get to the dashboard with the fewest steps. |
| New user (email) | `/register` (code dialog) → `/register/complete` | Prove the email, pick a username and password, land signed in. |
| New user (Google) | `/login` or `/register` → Google → `/register/complete` | Pick a username, land signed in. No password. |

All three screens are public; the last one needs state from the previous step (a guard bounces to `/register`).

## User stories

**Sign in**
- I enter **email or username** + password → **Login** → `/`.
- Wrong credentials show "Invalid username or password" on the same screen.
- I click **Sign in with Google**: known account → `/`; new account → "Set up your account".
- An existing account whose email is unconfirmed shows the server's "Sign in with your password and verify your email in Profile first".
- "Don't have an account? **Create one**" → `/register`.

**Sign up — step 1 (`/register`)**
- I type my email → **Continue with email** → a code is sent → a "Check your email" dialog opens on the same page.
- If the email already has an account I see "This email already has an account. **Sign in** instead."
- Or I use **Sign up with Google**.

**Sign up — the code dialog (still on `/register`)**
- "Enter the 6-digit code we sent to {email}". I type or paste it into six boxes; the sixth digit submits on its own (or I press **Verify**) → step 2.
- **Resend code** unlocks after a 60 s countdown. **Cancel** (or Escape) closes the dialog; I can edit the email and press Continue again. Same email during the cooldown just reopens the dialog.

**Sign up — step 2 (`/register/complete`)**
- Email shown read-only. I choose a **username** (not prefilled, can't change later) and a **display name** (prefilled from Google).
- On the email path I also set **password** + **confirm**.
- **Create account** → signed in → `/`.
- A taken username shows under the username field. An expired sign-up, or an email that got an account meanwhile, shows a toast and returns me to `/register`.

## Scope

**In scope**
- Three routes, split layout (brand panel left, form right; panel hidden ≤ 768px).
- Email-or-username login; email + code sign-up (code in a dialog); Google sign-in/up via Google's own button.
- Sign-up state survives a reload in the same tab (sessionStorage), not a new tab. The dialog itself does not reopen after a reload.
- Auto sign-in after account creation.
- Navbar/footer hidden on all three routes.

**Out of scope (this iteration)**
- Forgot / reset password (planned, by code).
- Refresh tokens (session ends at token expiry).
- Other social providers, MFA, captcha, terms page.
- Redirecting already-signed-in users away from these screens.

## Key assumptions

- Server sends codes that last 10 minutes, allow 5 wrong tries, and enforce a 60 s resend cooldown.
- An unfinished sign-up lasts 15 minutes; its id is the only credential the browser holds.
- Server errors arrive as `errors[0].reason`; `apiErrorMessage` reads them.
- Google matches existing accounts by Google id, else by **confirmed** email.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Google script blocked (ad blocker, offline) | No Google button | Button area stays empty; email paths still work. |
| Code email lands in spam / slow | Drop-off at the code dialog | Resend after cooldown; Cancel, edit the email, Continue again. |
| Sign-up expires between steps | Lost progress | 404 → toast + back to `/register`. |
| 401 on wrong password triggered logout-refresh loop | Looked broken | `errorInterceptor` skips `/v1/auth/` URLs. |

## Dependencies

- `AuthService`, `RegistrationFlowService`, `registrationIdGuard`.
- Endpoints `auth.login`, `auth.register-email`, `auth.register-email-verify`, `auth.register-complete`, `auth.google` ([`network/api-endpoints.yaml`](../../network/api-endpoints.yaml)).
- Google Identity Services script and `environment.googleClientId`.
- `app-email-code-dialog` (shared with Profile). Shared: `lib-input`, `lib-button`, `lib-toast`, `lib-dialog`, `lib-otp-input`.

See [`prd-full.md`](./prd-full.md) for per-screen acceptance criteria.
