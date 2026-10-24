# Lib4GZ frontend

The web app for Lib4GZ, a learning platform for small teaching groups. Angular 19
(standalone components, signals), TypeScript 5.5, SCSS, hosted on Firebase.

What the product does: `../docs/README.md`. Contract with the backend: `../CLAUDE.md`.

## Run

- `npm run start:local` serves `http://localhost:4200` and proxies `/api` to a backend on
  `localhost:8080`.
- `npm run start:dev` does the same against the deployed backend.
- `npm start` has no proxy, so no API call works. Use one of the two above.
- `npm run build` makes the production build in `dist/lib4gz-fe/browser`. It calls the
  absolute backend URL in `src/environments/environment.ts`.

## Verify

- `npm run build` passes. It also enforces the style budget: 8 kB warning and 12 kB error
  per component stylesheet.
- Tests, once and without watching:
  `CHROME_BIN="<path to a Chromium browser>" npm test -- --watch=false --browsers=ChromeHeadless`.
  Plain `npm test` watches and never exits. `CHROME_BIN` is needed when Google Chrome is not
  installed; any Chromium browser works.
- `scripts/check-docs.sh` fails when a `CLAUDE.md` names a file that no longer exists, and
  lists folders whose code changed without their doc.
- Specs cover the app shell, the auth, cache and sign-up flow services, the registration
  guard, the token interceptor, `apiErrorMessage`, the Fast Create parser, the code input,
  the profile screen, the exercise editor's Fast Create sheet, and the course material
  screen's reorder and delete dialogs. The rest of the course and teacher screens have none,
  so a change there is not verified by the tests; say so.

## Deploy

Do not run `deploy/deploy-dev.sh` unless the owner asks for a deploy. It runs `npm ci`,
switches to `production` and merges `main`, commits everything with `git add -A`, pushes,
and deploys to Firebase.

## Map

Every folder below has its own `CLAUDE.md`, which loads when you open a file there. Read it
before changing that folder.

| Folder under `src/` | Owns |
| --- | --- |
| `app/services/` | HTTP calls, session, client cache; guards and interceptors |
| `app/shared/components/` | The reusable `lib-` components and pipes |
| `assets/design-system/` | Global styles, tokens, the design principles |
| `app/components/auth/` | Sign in, sign up, the Google button |
| `app/components/home/` | The dashboard |
| `app/components/course/` | Student course screens and the exercise attempt |
| `app/components/course-teacher/` | Teacher manage screens and the exercise editor |
| `app/components/layout/` | The navbar |
| `app/components/profile/` | Own profile |

Routes are in `src/app/app.routes.ts`. Design documents for work in this repository alone live
in a plans folder at the root; a plan is deleted when its work is done and its lasting rules
have moved to a module `CLAUDE.md`. `app/components/not-found/` is an unstyled stub.

## Rules that cross folders

- Standalone components only. Routes lazy-load with `loadComponent`.
- State is signals: `signal()`, `computed()`, `toSignal()`.
- Selector prefix `app-` for screens and layout, `lib-` for shared components.
- Import services, models and shared components from their barrels: `app/services/index.ts`,
  `app/shared/models/index.ts`, `app/shared/components/index.ts`.
- The course id route param is `id`, not `courseId`. A child screen reads it from its own
  route, which works only because of `paramsInheritanceStrategy: 'always'` in
  `src/app/app.config.ts`.
- A full-screen screen, with no sidebar and no navbar, needs two things: its route declared
  before the layout route, and a pattern in `hiddenRoutePatterns` in
  `src/app/app.component.ts` (or, for a fixed path, an entry in `hiddenRoutes` there).
- `roleGuard` always returns true, so `data: { roles }` on a route does nothing. Only the
  server enforces roles.
- Read server error text only with `apiErrorMessage`. Never read `err.error` in a component.
- Never add a background or a side border to a desktop sidebar.
- IDs from the backend are opaque strings. Never parse them.

## Before you finish

- `npm run build` passes and the tests pass.
- The `CLAUDE.md` in every folder you changed still tells the truth, and
  `scripts/check-docs.sh` is clean.
- `../docs/features/` is updated if a user-visible feature changed.
- No commit, push, or deploy unless the user asked for one.
