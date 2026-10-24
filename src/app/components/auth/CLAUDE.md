# auth screens

Owns: sign in, the two-step sign-up, and the Google button. Session state lives in
`services/auth.service.ts`; sign-up step state in `services/registration-flow.service.ts`.

## Rules

- Sign-up is two steps: `/register` (email, then the 6-digit code in
  `app-email-code-dialog`), then `/register/complete` (username, display name, and a
  password on the email path only), then automatic sign-in.
- A Google sign-in reply has two outcomes, and both `login` and `register` handle both: an
  existing account signs in and goes to `/`; a new one is stored in the flow service and
  goes to `/register/complete`.
- `register-complete` reads the stored registration at construction with a non-null
  assertion. It is safe only while its route keeps `registrationIdGuard`.
- A new auth path must be added to `hiddenRoutes` in `src/app/app.component.ts`, or the
  navbar shows on it.
- A 401 from a sign-in or sign-up call means bad credentials and is shown inline.

## Google button (`google-sign-in/`)

- With `[label]` set, the visible face is inert. Google's invisible iframe sits on top and
  takes every click, so the button cannot be disabled or given a click handler, and its
  size is fixed by `[width]` and 40px.
- Google's callback runs outside Angular's zone. Emit `credential` inside `zone.run`.
- The button's language comes only from `?hl=en` on the script tag in `src/index.html`.
  The `locale` option is ignored.
- If Google's script is blocked, the button never appears. Every screen must stay usable
  without it.

## Gotchas

- On account creation, a 409 counts as "username taken" only when the server's message
  contains the word "username". Rewording that message on the backend breaks the inline
  error.
- `register-complete` uses `register/register.component.scss`, so both templates share the
  `register-*` class names.
- Submitting the same email again during the resend cooldown reopens the code dialog
  without a request.

## Verify

No screen here has a spec. `guards/registration.guard.spec.ts` and
`services/registration-flow.service.spec.ts` cover the flow state.
