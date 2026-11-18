# services

Owns: every HTTP call, the session, and the client cache. The guards in `../guards/`, the
interceptors in `../interceptors/` and `../shared/utils/api-error.ts` follow these rules too.

## Rules

- One service per backend resource. Each builds `${environment.apiUrl}/v1/...` itself.
- The API reference is the backend's generated document, served by a local backend at
  `http://localhost:8080/api/swagger-ui.html` when it runs with `API_DOCS_ENABLED=true`
  (the backend's local-run script sets that). The request and response types in
  `../shared/models/` are hand-kept copies of the backend payloads; change both together.
- Screens read server error text only through `apiErrorMessage(err, fallback)`. It returns
  the server's text for 4xx and 503 and `fallback` for everything else. Never read
  `err.error` in a component.
- The token travels in the `access_token` header.
- `token-store.ts` is the only code that reads or writes the token keys (`access_token`,
  `token_expiry`, `refresh_token`, `refresh_token_expiry`). It keeps no copy in memory: a tab
  must see the pair another tab just stored.
- A new endpoint under `/v1/auth/` must be checked against two lists: the public list in
  `../interceptors/jwt.interceptor.ts` (no token is sent) and the refresh exception in
  `../interceptors/error.interceptor.ts`.
- Refresh goes only through `AuthService.refreshSession`, which allows one request in flight.
  A refresh token is single use, so two refreshes with the same one waste a rotation.
- `jwtInterceptor` refreshes before a request when the access token has under 5 minutes left.
  `errorInterceptor` refreshes on a 401 from a non-auth call and retries once. `authGuard`
  refreshes before sending the person to `/login`.
- Only a 401 from refresh signs the person out. A network error or 5xx from refresh fails
  that one request and keeps the session. A permission failure is a 403 and reaches the
  screen.
- A refresh stores its new pair and user only if `getRefreshToken()` still returns the token
  it sent. Storage empty: it stores nothing, revokes the new refresh token and fails its
  callers with a 401. Another token in storage (another tab refreshed): it stores nothing,
  revokes the new refresh token and its callers get the reply.
- A refresh that fails with a 401 clears the session and revokes nothing. One that fails
  otherwise revokes the token it sent only if storage is empty by then; with a token in
  storage it does nothing.
- After `refreshSession()`, every caller sends with the access token `getAccessToken()`
  returns, never the one in the reply.
- `logout()` clears the session first, then revokes the stored refresh token. During a
  refresh it never revokes the token that refresh sent: it revokes the stored token only
  when that differs. A refresh counts as in flight until it settles, before its callers
  hear of it.
- Every revoke posts to `/logout` through `AuthService.revokeOnServer` and ignores the result.
- `refreshSession` stays `shareReplay({ bufferSize: 1, refCount: false })`: a refresh settles
  after every caller has unsubscribed.
- `AuthService.setCurrentUser` is the one place that stores the signed-in user.
- `roleGuard` always returns true. Gate the UI with `AuthService.hasRole`; only the server
  enforces roles.

## Client cache (`course-cache.service.ts`)

- Cached reads: the syllabus always; a lesson, a summary, a lesson's exercise list and a
  lesson's submissions only when the caller passes `courseId`. Lesson and exercise reads
  skip the cache whenever `expand` is used, because expanded payloads carry data for the
  caller alone (their draft, a teacher's submission count). Module reads are never cached.
- A screen opts in by passing `courseId` to the service method. It never uses
  `CourseCacheService` itself. The `courseId` must be the resource's real course.
- Every service method that changes course data (course, enrollment, module, lesson,
  summary, exercise, question, submission), reorders included, ends with
  `tap(() => this.cache.bustFreshness())`. A new one must too. The draft autosave,
  `SubmissionService.createOrUpdate`, deliberately does not. `RaceService` touches nothing
  the cache holds and does not bust it.
- Changing the shape of a cached response type needs a `DB_VERSION` bump. That drop is the
  only eviction besides logout.
- Cache entries are keyed by the `user_id` in localStorage and wiped on logout.
- `AuthService` injects `CourseCacheService`, never the reverse. `MeService` must not inject
  `AuthService`. Either would be an import cycle.
- Tokens are compared by equality only, never against the clock.

## Gotchas

- `ProgressService` keeps `lib4gz_progress` and `lib4gz_last_visited` in localStorage. They
  are not per user and logout does not clear them.
- `UserService` is an empty class.
- `src/environments/environment.ts` holds the absolute backend URL and is what production
  builds and `ng test` use. `/api` applies only to the development configuration.

## Verify

Specs: `auth.service.spec.ts`, `course-cache.service.spec.ts`,
`registration-flow.service.spec.ts`, `race.service.spec.ts` (the race calls' method, path and
body). The other services have none.
