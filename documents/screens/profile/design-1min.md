---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-16
review_cadence: per-release
---

# Profile — Tech Design (1 min)

- **What we're building.** One standalone component, `app-profile`, lazy-loaded at `/profile` behind `authGuard`. A reactive form (username and email read-only, display name editable) plus `app-google-sign-in` (shared with sign-in) under the email field, whose `credential` output is posted to `auth.google-connect`.
- **Key decision.** **The server owns the email.** The page never edits it; `AuthService.connectGoogle(idToken)` returns the whole user with `email`, `emailVerified`, `googleConnected`, `avatarUrl` set from Google, and `applyUser` pushes it into the page, the navbar and localStorage. *Rejected:* decoding the Google token in the browser to preview the address (no confirm step, so nothing to preview).
- **Second decision.** **Our wording on Google's button.** Google allows only its four labels, so `app-google-sign-in` takes a `[label]` and paints that face under Google's own button, which is stretched over it at zero opacity and keeps every click (its iframe is cross-origin, a click cannot be forwarded in). `googleLabel` is a `computed`: connected → "Connect other Google account"; else "Connect a Google account". `googleHint` adds "Connecting a Google account also verifies your email." only while the address is unverified. *Cost:* screen readers announce Google's label, not ours.
- **Network.** `me.get`, `me.update`, `auth.google-connect`. Errors via `apiErrorMessage`. `errorInterceptor` excludes `google:connect` from its "401 under /v1/auth/ is bad credentials" rule so an expired session logs out.
- **Top risks.** (1) The face and Google's button must stay the same size (both pinned to 280x40) or clicks miss; (2) Google's button cannot be disabled while a connect is in flight (the face reads "Connecting…"). (2) A stale cached user lacks `googleConnected` until `getMe()` answers. (3) Profile and navbar both refresh the user on load (two `GET /v1/users/me` calls).
