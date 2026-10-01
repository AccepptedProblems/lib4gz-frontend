---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-16
review_cadence: per-release
---

# Profile — PRD (Full)

Standalone full-detail PRD. For the short reads, see [`prd-1min.md`](./prd-1min.md) and [`prd-5min.md`](./prd-5min.md). Code: `src/app/components/profile/`.

## 1. Acceptance criteria

### A. Entry & loading

- A1. `/profile` requires a session (`authGuard`); signed-out users go to `/login`.
- A2. The navbar avatar menu has a **Profile** item above **Log out** that opens `/profile`.
- A3. If a user is already stored locally, the page renders it immediately, then refreshes from the server.
- A4. With no stored user, a spinner shows until the server responds. If loading fails, "Could not load your profile." (or the server reason) is shown.

### B. Identity header

- B1. Avatar (`lib-avatar`, large) uses the stored avatar URL, else the display name's initials.
- B2. Display name, then `@username` in muted text.

### C. Form

- C1. **Username** — read-only (disabled) input.
- C2. **Display name** — required, max 255. Errors: "Display name is required" / "Maximum 255 characters" (after touch).
- C3. **Email** — read-only (disabled) input holding the account's address. No validation, no typing.
- C4. **Save changes** is disabled while the display name is invalid or unchanged, and shows a loading state while saving.
- C5. The request carries the trimmed name only. The email never travels through `me.update`; it changes only through `auth.google-connect`.
- C6. Save success → toast "Profile saved".
- C7. Save failure → server reason (or "Could not save your profile. Please try again.") under the form, `role="alert"`.
- C8. After any successful call that returns the user, the navbar name, initial and avatar update without reload.

### D. Email badge and Google row

Under the email field, in this order: the badge, then Google's button carrying our own label (`app-google-sign-in` with `[label]`, width 280, height 40), then the hint where one applies. Google's real button lies invisible over the label and takes the clicks.

| Account state | Badge | Caption |
|---|---|---|
| `googleConnected` | Success "Verified" | "Connect other Google account" |
| not connected, `emailVerified` | Success "Verified" | "Connect a Google account" |
| not connected, not verified | Warning "Unverified" | "Connect a Google account to verify your email" |

- D1. While the connect call is in flight the button reads "Connecting…". Google's button cannot be disabled; a second token during the flight starts a second call, which the server answers the same way.
- D2. Success → the returned user is applied (email field, badge, avatar, navbar, localStorage), toast "Google account connected" when the account had no Google before, else "Google account changed".
- D3. Failure → server reason (or "Could not connect the Google account. Please try again.") under the form, `role="alert"`. Nothing on the page changes.
- D4. No confirmation dialog before a switch. Connecting the same Google account again is a normal success (address and avatar refreshed from Google).

## 2. Edge cases

1. **Google account connected to another user.** Server 409 "That Google account is already connected to another account"; reason under the form.
2. **Google address used by another account.** Server 409 "Email already in use"; reason under the form.
3. **Google reports the address unverified.** Server 401 "Google account email is not verified"; reason under the form (the interceptor does not treat this one as an expired session, see design D-3).
4. **Session expired during connect.** 401 from the token filter → `errorInterceptor` refresh path → logout → `/login`.
5. **Stored user from before this release** lacks `googleConnected`: read as not connected until `getMe()` answers on init.
6. **Google script blocked.** No button renders at all, label included, so nothing invites a press that cannot work. Nothing else on the page depends on Google.

## 3. Accessibility

- All fields labelled through `lib-input`; the name error wired via its `[error]` input.
- Server errors use `role="alert"`.
- The Google button is Google's own iframe button, keyboard-operable and focusable. Our label is `aria-hidden` decoration over it, so assistive technology announces Google's wording ("Continue with Google"), not "Connect other Google account". That is the accepted cost of the custom label.
- Badges carry visible text, not colour alone.

## 4. Open questions

- Should the button or hint name the connected Google address once the server exposes it separately from `email`? Today they are the same value.
- Worth revisiting the OAuth code flow (`initCodeClient`), which would give a real button with a real accessible name instead of the overlay.
- Disconnect Google for accounts that have a password.

## 5. Decision log

| ID | Date | Decision | Rationale |
|---|---|---|---|
| P-1 | 2026-09 | Username read-only on Profile | Username is chosen once at sign-up and appears in URLs/mentions. |
| P-2 | 2026-09 | New email applies only after its code | Superseded by P-7. |
| P-3 | 2026-09 | No avatar upload, password change, or deletion here | Each needs its own flow; keeps this screen small. |
| P-4 | 2026-09 | Code entered in the same dialog as sign-up | Superseded by P-7: the profile has no code dialog. |
| P-5 | 2026-09-15 | Badge follows the typed address | Superseded by P-7: the address cannot be typed. |
| P-6 | 2026-09-15 | Email change is its own request | Superseded by P-7. |
| P-7 | 2026-09-16 | Email read-only; connecting a Google account sets id, email, verified flag and avatar; switching accounts is the same button | Sign-in identity is the Google id, not the address. Changing the address alone stranded people on the old Google account. One explicit, signed-in action replaces the code flow and the automatic link on sign-in. |
| P-8 | 2026-09-16 | No confirmation before a switch | Google's chooser is the confirmation; a mistake is undone by connecting the old account again; the server mails the old address. |
| P-9 | 2026-09-16 | Caption + Google button below the field, not inline | Google's button has a fixed minimum width; an inline row wrapped badly at phone width. |
