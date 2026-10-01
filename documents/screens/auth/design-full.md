---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Auth (Sign in + Sign up) — Full Design

> Implementation reference for the public auth screens. Code in `src/app/components/auth/` is the source of truth; this doc explains why it looks the way it does and what to do when it breaks.

## 1. Component map

| Concern | Login | Register | RegisterComplete |
|---|---|---|---|
| Selector | `app-login` | `app-register` | `app-register-complete` |
| Folder | `auth/login/` | `auth/register/` | `auth/register-complete/` |
| Styles | own | own (shared by both sign-up steps) | `../register/register.component.scss` |
| Form | `email`, `password` | `email` | `email` (disabled), `username`, `name`, `password`?, `confirmPassword`? |
| Signals | `isLoading`, `errorMessage` | + `emailInUse`, `codeDialogOpen`, `isVerifying`, `isResending`, `codeError` | + `usernameServerError` |
| Uses | `app-auth-brand`, `app-google-sign-in` | `app-auth-brand`, `app-google-sign-in`, `app-email-code-dialog`, `ToastService` | `app-auth-brand`, `ToastService` |

Supporting components:

| Component | File | Notes |
|---|---|---|
| `app-auth-brand` | `auth/auth-brand/auth-brand.component.ts` | Pure-CSS brand mark, mock course card, tagline. Styles from the `auth-brand-panel` mixin in `auth/_auth-brand.scss`. Placed inside each screen's `*-illustration` column. |
| `app-google-sign-in` | `auth/google-sign-in/google-sign-in.component.ts` | Inputs `text` (`'signin_with' \| 'signup_with' \| 'continue_with'`, default sign-in), `width` (default 320), `label` (default null). Output `credential` (ID token string). With `label` the component paints our own face and stretches Google's real button over it at zero opacity, so the clicks still belong to Google; `/profile` uses that, the auth screens do not. |
| `app-email-code-dialog` | `auth/email-code-dialog/email-code-dialog.component.ts` | `lib-dialog` (icon `mark_email_read`, width 440px, confirm "Verify", cancel "Cancel") around `lib-otp-input`. Inputs `open`, `email`, `title`, `loading`, `resending`, `error`, `cooldownUntil` (epoch ms). Outputs `verify(code)`, `resend`, `cancel`. Auto-submits on the sixth digit; a short code shows "Enter all 6 digits" locally; "Resend code" is disabled while `cooldownUntil` is ahead ("Resend code in {n}s", ticked every second). Boxes and errors reset on every open. No HTTP inside. Also used by `app-profile`. |

Shared dependencies:

- **`AuthService`** (`services/auth.service.ts`) — `login`, `googleSignIn`, `startEmailRegistration`, `verifyEmailRegistration`, `completeRegistration`, `setCurrentUser`, `currentUser`/`userName`/`userInitial` signals, `logout`.
- **`RegistrationFlowService`** (`services/registration-flow.service.ts`) — see §3.
- **Guard** (`guards/registration.guard.ts`) — `registrationIdGuard` needs `registration()`; else `UrlTree` to `/register`. (`registrationEmailGuard` was removed with the `/register/verify` route.)
- **`apiErrorMessage`** (`shared/utils/api-error.ts`) — `errors[0].reason` → `errors[0].message` → `message` → fallback.
- **Models** (`shared/models/auth.model.ts`) — `LoginRequest`, `LoginResponse`, `OtpSentResponse`, `RegistrationStartedResponse`, `CompleteRegistrationRequest`, `GoogleSignInResponse`.
- **Shared UI** — `lib-input`, `lib-button`, `lib-toast` (via `ToastService`), `lib-dialog`, `lib-otp-input` (`shared/components/otp-input/`; six boxes, `ControlValueAccessor`, `completed` output, `error` input; spec `otp-input.component.spec.ts`).

## 2. Forms

| Screen | Control | Validators |
|---|---|---|
| Login | `email` (label "Email or username") | required — no email validator; sent as `LoginRequest.username` |
| Login | `password` | required |
| Register | `email` | required, email; initial value `flow.email() ?? ''` |
| Code dialog | `code` (`FormControl` bound to `lib-otp-input`) | `/^\d{6}$/` checked in `submit()`; no Angular validator |
| Complete | `email` | disabled, value from registration |
| Complete | `username` | required, minLength 3, `/^[a-zA-Z0-9]+$/`; starts empty |
| Complete | `name` | maxLength 255; starts with `registration.name ?? ''` |
| Complete | `password` / `confirmPassword` | required + minLength 8 / required — only when `requiresPassword`; form-level `passwordMatchValidator` sets and clears `passwordMismatch` on `confirmPassword` |

Complete omits `password` from the request when `requiresPassword` is false. `username` `valueChanges` clears `usernameServerError`.

Register `onSubmit`: same address as `flow.email()` while `cooldownRemaining() > 0` → reopen the dialog, no request. Otherwise `startEmailRegistration` → `flow.startEmail` + `flow.startCooldown` → open dialog. `verifyCode` → `verifyEmailRegistration` → `flow.setRegistration` → `/register/complete`. `resendCode` → `startEmailRegistration` again → new cooldown + toast "A new code is on its way". Errors land in `codeError` (dialog stays open).

## 3. Sign-up state (`RegistrationFlowService`)

| Member | Notes |
|---|---|
| `email` | `signal<string \| null>` |
| `registration` | `signal<RegistrationStartedResponse \| null>` |
| `cooldownUntil` | `signal<number>` epoch ms |
| `startEmail(email)` | sets email, clears registration, persists |
| `setRegistration(reg)` | sets registration and `email = reg.email`, persists |
| `startCooldown(seconds)` | `cooldownUntil = now + s`, persists |
| `cooldownRemaining()` | whole seconds left, ≥ 0 |
| `reset()` | clears all and removes the sessionStorage key |

Hydrates from `sessionStorage['registration_flow']` on construction; corrupt JSON → empty state. Register passes `cooldownUntil()` straight to the dialog, which ticks its own `remaining` every second (interval cleared on destroy). A reload on `/register` keeps the email prefilled and the cooldown running but does not reopen the dialog.

## 4. Google Identity Services

- `src/index.html` loads `https://accounts.google.com/gsi/client?hl=en` (async, defer). `hl` is the only working language lever: `renderButton`'s `locale` option is ignored, so without it a Vietnamese browser renders a Vietnamese button.
- `environment.googleClientId` (both environment files) is the public OAuth Web client id.
- `shared/types/google-gsi.d.ts` declares the `google.accounts.id` namespace (`initialize`, `renderButton`, `disableAutoSelect`, config types). No npm package.
- `GoogleSignInComponent.ngAfterViewInit` polls every 100 ms, max 50 times, for `google.accounts.id`; then `initialize({ client_id, callback })` and `renderButton(host, { type: 'standard', theme: 'outline', size: 'large', text, shape: 'rectangular', width })`. In `label` mode it then stretches Google's inserted element to 100% x 100% and flips a `rendered` signal, which is what reveals the face.
- The GIS callback runs outside Angular's zone; the component emits `credential` inside `NgZone.run`.
- Script never loads → `console.warn`, host stays empty (min-height 44px).

## 5. Routing & chrome

- `app.routes.ts`: three lazy `loadComponent` entries; `registrationIdGuard` on `/register/complete` only.
- `AppComponent.hiddenRoutes` exact-matches `/login`, `/register`, `/register/complete`. A new auth route must be added there.
- `jwtInterceptor` public list `['/auth/login', '/auth/register', '/auth/google:sign-in']` (substring match covers `/auth/register/*`). `google:sign-in` is spelled in full because `/auth/google` would also match `/auth/google:connect`, which needs the token; `jwt.interceptor.spec.ts` pins that.
- `errorInterceptor` rethrows 401s from URLs containing `/v1/auth/` without trying a refresh, except `/v1/auth/google:connect`, the one authenticated call there, where a 401 means an expired session.

## 6. Layout

```
.{login|register}-page                 flex, min-height 100vh, --neutral-color-0
├── .{login|register}-illustration     flex:1, --primary-color-50, hidden ≤ 768px
│   └── app-auth-brand
└── .{login|register}-form-container   flex:1, centered, padding xl (md ≤ 768px)
    └── .{login|register}-form-wrapper max-width 400px; lib-button 100% width
        ├── heading + caption
        ├── form
        ├── .auth-divider "or"         (login, register)
        ├── app-google-sign-in         (login, register)
        └── link row
└── app-email-code-dialog              (register only; overlay, outside the columns)
```

- No border between columns; the tinted panel is the only separation.
- `.auth-divider` is defined in both `login.component.scss` and `register.component.scss`.

## 7. Failure modes

| Mode | Trigger | Behavior | Recovery |
|---|---|---|---|
| Bad credentials | `auth.login` 401 | Reason inline; interceptor does not refresh | Retry |
| Email in use | `auth.register-email` 409 | `emailInUse` message with Sign in link | Go to `/login` |
| Resend too soon | `auth.register-email` 400 | Reason under the code boxes | Wait for countdown |
| Mail failure | 503 | Reason inline (or under the boxes on resend) | Retry later |
| Wrong / expired code, too many attempts | `auth.register-email-verify` 400 | Reason under the code boxes; dialog stays open | Resend, or Cancel and use another email |
| Username taken | `auth.register-complete` 409 containing "username" | Under Username | Choose another |
| Email taken meanwhile | `auth.register-complete` 409 (not about username) | Toast with reason, `reset()`, `/register` | Sign in instead |
| Registration expired / unknown | `auth.register-complete` 404 | Toast, `reset()`, `/register` | Start again |
| Google token invalid / Google email unverified | `auth.google-sign-in` 401 | Reason inline | Use email path |
| Existing account with that email (Google not connected to it) | `auth.google-sign-in` 400 | "An account with this email already exists. Sign in with your password, then connect Google on your profile." | Password login → Profile → Connect a Google account |
| GIS blocked | Script missing | No button, console warning | Email paths |
| Missing flow state | Direct nav / new tab | Guard → `/register` | Start again |
| sessionStorage corrupt | JSON parse fails | Empty state | Start again |
| Session already present | User opens `/login` | Form renders; new sign-in replaces session | — |

## 8. Decision log

| ID | Date | Decision | Alternatives rejected |
|---|---|---|---|
| D-1 | 2025 | Reactive Forms + local signals | Template-driven; NgRx |
| D-2 | 2025 | Single "Email or username" input on login | Two inputs / toggle |
| D-3 | 2025 | No "remember me" | Decorative checkbox |
| D-4 | 2025 | Unified surface, 50/50 columns, panel hidden ≤ 768px | Bordered panels; `visibility: hidden` |
| D-5 | 2026-09 | Remove username/password registration; email + code or Google | Keep open form with optional verification |
| D-6 | 2026-09 | Own route for the final step, guarded | Stepper component |
| D-12 | 2026-09 | Code entered in `app-email-code-dialog` on `/register`; `/register/verify`, `RegisterVerifyComponent`, `registrationEmailGuard` removed | Keep a verify page (extra hop, duplicated the Profile code block) |
| D-13 | 2026-09 | Shared `lib-otp-input` (six boxes, paste/autofill spread) instead of one text field | Single `lib-input` with a 6-digit pattern |
| D-7 | 2026-09 | `RegistrationFlowService` in sessionStorage | Router state; query params; localStorage |
| D-8 | 2026-09 | GIS button + ID token to backend | Redirect OAuth; server session |
| D-9 | 2026-09 | Auto sign-in after completion (`completeRegistration` stores login) | Redirect to `/login` |
| D-10 | 2026-09 | Extract `app-auth-brand` | Duplicate panel markup per screen |
| D-11 | 2026-09 | `errorInterceptor` skips `/v1/auth/` | Refresh-then-logout on every 401 |

## 9. Tests

- `shared/utils/api-error.spec.ts` — reason → message → top-level message → fallback.
- `services/auth.service.spec.ts` — `setCurrentUser` storage + signals, name fallback, logout, hydration, `googleSignIn` stores only on `login`, `completeRegistration` signs in.
- `services/registration-flow.service.spec.ts` — persistence, hydration, reset, cooldown.
- `guards/registration.guard.spec.ts` — `registrationIdGuard`: `true` with a registration, `UrlTree('/register')` without.
- `shared/components/otp-input/otp-input.component.spec.ts` — six boxes, digit advance, non-digits ignored, Backspace, paste and autofill spread, control reset.
- No auth screen specs; `GoogleSignInComponent` is verified manually. Its Profile usage (connecting a Google account) is covered by `components/profile/profile.component.spec.ts`, which emits `credential` on the child directly.

## 10. Cross-references

- PRD: [`prd-1min.md`](./prd-1min.md), [`prd-5min.md`](./prd-5min.md), [`prd-full.md`](./prd-full.md)
- Contract: [`contract.yaml`](./contract.yaml)
- API: `documents/network/api-endpoints.yaml` (`auth.*`)
- Models: `documents/network/models.yaml` (`auth`)
- Networking: `documents/network/networking.yaml` (interceptors, guards, external scripts)
- Profile (email confirmation for existing accounts): `documents/screens/profile/`
