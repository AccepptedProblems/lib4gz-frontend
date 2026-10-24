# profile

Owns: the signed-in person's own profile at `/profile`.

## Rules

- `applyUser` is the single write path (page signal, navbar, localStorage) and never
  touches the form. The form is reset on load only; after a save only the name control is
  reset, and after a Google connect only the email control. This keeps an unsaved name edit
  alive through a connect.
- The email never travels in the save request. It changes only through
  `AuthService.connectGoogle`.
- The Google button cannot be disabled during a connect (see
  `components/auth/google-sign-in/`); only its label changes.

## Verify

`profile.component.spec.ts`
