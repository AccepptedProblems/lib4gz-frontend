---
owner: ntn071000@gmail.com
last_reviewed: 2026-09-14
review_cadence: per-release
---

# Network Reference

The `network/` folder is the source of truth for how the Lib4GZ frontend talks to the backend. It holds three single-version YAML reference docs (no 1min/5min/full split per `_writing-guidelines.md` section 3): the HTTP contract, the TypeScript model shapes, and the runtime networking config. Open the YAML for the exact spec; this README is the 1-minute orientation.

## Files

| File | Purpose | Groups |
|---|---|---|
| [`api-endpoints.yaml`](./api-endpoints.yaml) | REST contract — paths, methods, request/response shapes, auth requirements per endpoint. | Auth, Users, Me, Courses, Enrollments, Modules, Lessons, Summaries, Exercises, Questions, Submissions |
| [`models.yaml`](./models.yaml) | TypeScript interfaces and enums under `src/app/shared/models/`. | common, auth, user, course, enrollment, module, lesson, summary, exercise, question, submission |
| [`networking.yaml`](./networking.yaml) | HTTP client config, environments, external scripts, interceptors, guards. | environment, external_scripts, interceptors, guards |

## Base URL

All endpoints resolve to `environment.apiUrl + '/v1/'` (e.g. `http://localhost:8080/api/v1/...` for local dev). The `/api` prefix matches the Spring Boot servlet context-path; per-endpoint versioning is documented in `api-endpoints.yaml` under `info.versioning`.

## Runtime wiring (see [`networking.yaml`](./networking.yaml) for detail)

- **`jwtInterceptor`** — attaches the `access_token` header from `localStorage` to every request except the public sign-in/sign-up/Google calls.
- **`errorInterceptor`** — on 401 tries a token refresh, then logs out to `/login`; 401s from `/v1/auth/` calls go straight back to the screen.
- **`authGuard`** — blocks routes when no valid JWT is present in `localStorage`.
- **`registrationIdGuard`** — `/register/complete` needs a registration from the code dialog or Google; missing state sends the user to `/register`.
- **`roleGuard`** — checks `route.data.roles` against the user's role (e.g. `['teacher']` for `/course/:id/manage`).

## When to update

Bump `last_reviewed` and ping the owner whenever you add, remove, or change an endpoint, model, interceptor, or guard. Reference docs drift silently — keep them tight.
