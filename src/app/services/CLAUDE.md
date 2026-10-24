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
- A new endpoint under `/v1/auth/` must be checked against two lists: the public list in
  `../interceptors/jwt.interceptor.ts` (no token is sent) and the refresh exception in
  `../interceptors/error.interceptor.ts`.
- A 401 from a non-auth call starts a token refresh. The backend's refresh endpoint is an
  empty stub, so today that ends in logout and `/login`. A permission failure is a 403 and
  reaches the screen.
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
  `SubmissionService.createOrUpdate`, deliberately does not.
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
`registration-flow.service.spec.ts`. The other services have none.
