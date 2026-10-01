---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Auth (Sign in + Sign up) — 1-min PRD

- **Problem.** Lib4GZ is gated. Returning users need a fast way back in; new users need an account with an email that is really theirs. The old open username/password form never checked emails, and email login never worked.
- **Users.** **Returning users** (`/login`) and **new users** (`/register` → code dialog → `/register/complete`). All arrive signed out.
- **Outcome.**
  - Sign in with **email or username + password**, or **Sign in with Google**.
  - Sign up with **email + 6-digit code** (typed into a dialog on the same page), or **Google**. Both end on one "Set up your account" screen (username, display name, and a password on the email path). The account is created and signed in on submit.
  - Google on a known account signs straight in; on a new Google account it jumps to "Set up your account".
- **Why one doc set.** All three screens share the brand panel, layout, Google button, and `AuthService`. The code dialog is shared with Profile.
- **Success metrics.**
  - Sign-in success ≥ 95% on valid credentials.
  - Sign-up completion (code sent → signed in) ≥ 70%.
  - Every 4xx shows a readable message on the same screen.
- **Status.** Implemented, including live Google sign-in.
- **Out of scope.** Forgot/reset password, refresh tokens, MFA.
- See [`prd-5min.md`](./prd-5min.md) for scope and risks, [`prd-full.md`](./prd-full.md) for acceptance criteria.
