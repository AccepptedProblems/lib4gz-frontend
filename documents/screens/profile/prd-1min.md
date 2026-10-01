---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-16
review_cadence: per-release
---

# Profile — PRD (1 min)

- **Problem.** Changing the email by code left the account's Google identity behind: after a change, only the *old* Google account could still sign in, and the new address's Google account was refused. The change looked broken.
- **Outcome.** One screen to change the display name and to connect or switch the Google account. The email is read-only: it is the connected Google account's address. Connecting also verifies the email and takes the picture from Google.
- **Success metric.** A person who connects a new Google account signs in with it on the next visit; navbar shows a new display name or picture without a reload.
- **Out of scope.** Typing an email, confirming it by code, disconnecting Google, password change/reset, avatar upload, deletion, username change.
