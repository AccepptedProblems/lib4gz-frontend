---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-16
review_cadence: per-release
---

# Profile — Tech Design (Full)

Full implementation reference. For shorter reads, see [`design-1min.md`](./design-1min.md) and [`design-5min.md`](./design-5min.md).

## 1. Component map

```
app-profile  (.profile — max-width 520px, centered)
├─ h1 "Profile"
├─ @if (user(); as u)
│   ├─ .profile__identity
│   │   ├─ lib-avatar [src]=avatarUrl [name]=name size=lg
│   │   └─ name, @username
│   ├─ form (ngSubmit → save())
│   │   ├─ lib-input Username (disabled)
│   │   ├─ lib-input Display name
│   │   ├─ lib-input Email (disabled)
│   │   ├─ .profile__email-status
│   │   │   └─ lib-badge Verified | Unverified   (from u.emailVerified)
│   │   ├─ .profile__google
│   │   │   ├─ app-google-sign-in [label]=googleLabel() [width]=280 (credential)=connectGoogle($event)
│   │   │   └─ .profile__google-hint      googleHint()   (only while the email is unverified)
│   │   │   └─ app-google-sign-in text="continue_with" [width]=240 (credential)=connectGoogle($event)
│   │   ├─ .profile__error (role=alert)
│   │   └─ lib-button "Save changes"
├─ @else if (isLoading()) lib-spinner
└─ @else if (errorMessage()) .profile__error
```

Source files:

- TS: `src/app/components/profile/profile.component.ts`
- HTML: `src/app/components/profile/profile.component.html`
- SCSS: `src/app/components/profile/profile.component.scss`
- Spec: `src/app/components/profile/profile.component.spec.ts`
- Google button: `src/app/components/auth/google-sign-in/google-sign-in.component.ts` (documented in `screens/auth/design-full.md` §1; `text` input accepts `continue_with`)
- Service: `src/app/services/auth.service.ts` (`connectGoogle`)
- Interceptor: `src/app/interceptors/error.interceptor.ts` (`google:connect` exclusion)
- Route: `src/app/app.routes.ts` (`profile`, `canActivate: [authGuard]`)

## 2. State

| Name | Type | Notes |
|---|---|---|
| `user` | `signal<UserResponse \| null>` | Seeded from `AuthService.currentUser()` |
| `isLoading` | `signal<boolean>` | `true` until the first `getMe` settles |
| `isSaving`, `isConnecting` | `signal<boolean>` | Per-action loading |
| `errorMessage` | `signal<string>` | Load / save / connect errors |
| `googleLabel` | `computed<string>` | in flight → "Connecting…"; connected → "Connect other Google account"; else "Connect a Google account". Drawn over Google's button |
| `googleHint` | `computed<string>` | "Connecting a Google account also verifies your email." while unverified and unconnected; empty otherwise |
| `form` | `FormGroup` | `username` disabled; `name` required + max 255; `email` disabled |

## 3. Methods

| Method | Does |
|---|---|
| `ngOnInit` | `applyUser(cached)` if present; `getMe()` → `applyUser` + `resetForm` |
| `getNameError` | Touched + invalid → "Display name is required" / "Maximum 255 characters" |
| `save` | `updateMe({ name })` → `applyUser`, resets the name control only, toast "Profile saved" |
| `connectGoogle(idToken)` | Remembers `googleConnected`; `AuthService.connectGoogle` → `applyUser`, resets the email control, toast "Google account connected" or "Google account changed"; error → `errorMessage` |
| `applyUser` | Sets `user`, `AuthService.setCurrentUser`. Never touches the form |
| `resetForm` | `form.reset({ username, name, email })` on load only |

## 4. Styling notes

- Single column, `max-width: 520px`, `margin: 0 auto`, padding `--spacing-xl` / `--spacing-lg`. No sidebar, no panel backgrounds, no borders (Unified Surface, Breathing Room).
- `.profile__google` is a wrapping flex row, caption left (`flex: 1 1 200px`), Google button right; at phone width the button drops under the caption.
- No local `.link-button` any more (it went with the "Verify email" / "Enter code" links).

## 5. Failure modes

| Mode | Trigger | Behavior |
|---|---|---|
| Load fails, cache present | `getMe` error | Cached user stays; `errorMessage` shown under the form |
| Load fails, no cache | `getMe` error | Spinner replaced by error text |
| Google account connected elsewhere | `connectGoogle` 409 | `errorMessage` from server reason; page unchanged |
| Google address used by another account | `connectGoogle` 409 | same |
| Google-unverified address / invalid token | `connectGoogle` 401 | `errorMessage` from server reason |
| Blank name | `updateMe` 400 | Blocked client-side first; server reason if it slips through |
| Session expired | 401 from the JWT filter | `errorInterceptor` refresh → logout → `/login` (the `google:connect` exclusion keeps this path) |
| Google script blocked | — | `app-google-sign-in` renders nothing and warns; caption remains |

## 6. Decision log

| ID | Date | Decision | Alternatives rejected |
|---|---|---|---|
| D-1 | 2026-09 | Push every `UserResponse` through `AuthService.setCurrentUser` | Navbar polling `getMe`; `MeService` → `AuthService` injection (cycle) |
| D-2 … D-7 | 2026-09 | Email change by code (`pendingEmail`, code dialog, "Verify email") | Superseded by D-8 on 2026-09-16 |
| D-8 | 2026-09-16 | Email read-only; `auth.google-connect` sets id, email, verified flag and avatar; one Google button with a state-dependent caption | Keeping the code flow next to Google connect (two ways to verify, twice the UI); decoding the token in the browser for a confirm dialog (no dialog wanted) |
| D-9 | 2026-09-16 | `connectGoogle` lives on `AuthService` | `MeService` (wrong URL family; would need `AuthService` for `setCurrentUser`, a cycle) |
| D-10 | 2026-09-16 | `errorInterceptor` excludes `google:connect` from the `/v1/auth/` bad-credentials rule | Treat every `/v1/auth/` 401 alike (an expired session would show as a plain error on the profile) |
| D-11 | 2026-09-16 | Caption + button below the field | Inline next to the input (wraps badly under ~480px) |

## 7. Open questions

- Disconnect Google for accounts with a password.
- Drop the navbar's `getMe` when on `/profile` to avoid the duplicate request.

## 8. Test notes

- `profile.component.spec.ts` (6 cases): read-only email with Unverified badge and connect caption; verified account → plain connect caption; connected account → change caption; a `credential` from the child posts to `google:connect` and the page takes email, badge, avatar and localStorage from the reply; a 409 shows the server message and changes nothing; Save sends the name only. The Google child is driven by emitting `credential` on its instance (`By.directive(GoogleSignInComponent)`).
- `auth.service.spec.ts` covers `connectGoogle` replacing the stored user and the `google:sign-in` URL; error text extraction is in `src/app/shared/utils/api-error.spec.ts`.
- Manual: connect a second Google account → email, badge, avatar change and the navbar follows; sign out; Google sign-in with the second account works, with the first account starts a new registration.
