---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Auth (Sign in + Sign up) — 1-min Design

- **What we're building.** Three lazy-loaded standalone screens — `app-login` (`/login`), `app-register` (`/register`), `app-register-complete` (`/register/complete`) — plus three supporting components: `app-auth-brand` (left panel), `app-google-sign-in` (Google's button), and `app-email-code-dialog` (the 6-digit code, opened on `/register` and reused by Profile; built on shared `lib-dialog` + `lib-otp-input`).
- **Key decision.** **Sign-up state lives in `RegistrationFlowService`** (root signals `email`, `registration`, `cooldownUntil`, mirrored to `sessionStorage['registration_flow']`). The functional guard `registrationIdGuard` reads it and bounces `/register/complete` to `/register`. *Rejected:* router state / query params (lost on reload, leaks the registration id into the URL); one component with steps (no deep links, one giant template).
- **Third decision.** **The code is entered in a dialog, not on its own route.** `/register/verify` and `RegisterVerifyComponent` are gone; the email stays on screen while the code is typed, and the same dialog serves Profile. *Rejected:* a separate verify page (extra navigation, separate guard, duplicated in Profile).
- **Second decision.** **Google via Google Identity Services, not a redirect flow.** The GIS button gives an ID token; `AuthService.googleSignIn` posts it; the response is either `login` (stored) or `registration` (→ `/register/complete`). No client secret, no redirect URIs.
- **Session.** `AuthService.storeLoginData` stores the token and calls `setCurrentUser`, which writes `user` (JSON), `user_name`, `user_role`, `user_id` and updates the `currentUser` signal. Used by login, complete-registration, and Google login.
- **Errors.** `apiErrorMessage(err, fallback)` reads `errors[0].reason`. `errorInterceptor` skips refresh for `/v1/auth/` URLs so a wrong password stays on the screen.
- **Risks.** (1) GIS script blocked → no Google button. (2) Pending sign-up expires (15 min) → 404 → restart. (3) Three hidden routes are listed literally in `AppComponent`; a new auth route must be added there. (4) A reload on `/register` keeps the email and cooldown but not the open dialog; pressing Continue again reopens it.
- See [`design-5min.md`](./design-5min.md) for context + tradeoffs, [`design-full.md`](./design-full.md) for failure modes and decision log.
