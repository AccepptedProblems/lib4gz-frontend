# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lib4GZ is a Learning Management System (LMS) frontend built with Angular 19, TypeScript 5.5, and SCSS. It supports two user roles: **students** (enroll, view content, complete exercises) and **teachers** (create courses, manage enrollments, review submissions).

## Commands

- `npm start` - Dev server (no proxy)
- `npm run start:local` - Dev server with local backend proxy (localhost:8080)
- `npm run start:dev` - Dev server with dev backend proxy
- `npm run build` - Production build (output: `dist/lib4gz-fe/`)
- `npm test` - Run tests (Karma + Jasmine)

## Architecture

### Design System (Spec-Driven)

The project uses a comprehensive **OpenSpec YAML document system** in `documents/` that defines every screen, component, and design token. Always consult the relevant spec before implementing or modifying a component:

- `documents/openspec.yaml` - Project index with all screen specs, routes, and phases
- `documents/design-system/` - Tokens, colors, typography, components, theme, breakpoints
- `documents/design-system/design-principles.yaml` - **Core design principles (MUST follow)**
- `documents/layout/` - Navbar and footer specs
- `documents/screens/` - Per-screen specs (structure, states, acceptance criteria)
- `documents/network/` - API endpoints, data models, networking config

Each spec YAML includes `current_implementation`, `current_template`, and `current_styles` sections showing the exact code that should exist. Treat these as the source of truth.

### SCSS Design System Layers

Global styles are imported via `src/styles.scss` -> `src/assets/design-system/_design.scss` in this order:

1. **Theme** (`theme/theme-mint.scss`) - Color palette overrides (Mint/Teal), font-family
2. **UI Style** (`ui-style/ui-style-default.scss`) - Button padding/radius data-attribute overrides
3. **Tokens** (`tokens/_token.scss`) - Semantic CSS custom property mixins (navbar, footer, button, input)
4. **Typography** (`_typography.scss`) - 15-level type scale, spacing/radius/z-index/elevation tokens
5. **Components** (`_component.scss`, `components/`) - Button, input, select, checkbox, table styles
6. **Form** (`_form.scss`) - Form layout

Active theme: **Mint** with `navigation-bar-theme-by-primary-color-reverse` (teal bg, white text) and `footer-theme-by-primary-color`.

### Design Principles (see `documents/design-system/design-principles.yaml`)

These principles apply to **all screens and components**:

1. **Unified Surface** — Multi-column layouts (sidebar + content) share the same background color (white). No borders or background-color differences between columns. Separation via negative space only. **HARD CHECK: Never add `background`, `background-color`, or `border-right`/`border-left` to sidebar elements in two-column layouts. If you see `background: var(--surface-sunken)` or `border-right: 1px solid` on a sidebar, it is a bug — remove it immediately.**
2. **Breathing Room** — Generous whitespace; content areas use at least 24px padding, centered content uses max-width + auto margins.
3. **Elevation Over Borders** — Prefer subtle box-shadow over hard borders for visual distinction. Borders are for form inputs, table rows, and internal section dividers only.
4. **Content Hierarchy Through Typography** — Use type scale and text color tokens, not background color, to establish hierarchy.
5. **Subtle Interaction States** — Hover/active states use soft tints and gentle transitions.

### Angular Patterns

- **Standalone components** throughout (no NgModules)
- **Lazy-loaded routes** via `loadComponent` in `src/app/app.routes.ts`
- **Functional guards**: `authGuard` (checks JWT in localStorage), `roleGuard` (checks route data roles)
- **Functional interceptors**: `jwtInterceptor` (attaches `access_token` header), `errorInterceptor`
- **Signal-based state**: Uses `toSignal()`, `computed()`, `signal()` - not legacy `BehaviorSubject` patterns
- **Barrel exports**: Services via `src/app/services/index.ts`, models via `src/app/shared/models/index.ts`, shared components via `src/app/shared/components/index.ts`
- Component prefix: `app-` for page/layout components, `lib-` for shared components

### Auth Flow

- JWT stored in `localStorage` as `access_token` with `token_expiry`
- `AuthService.isAuthenticated()` checks token existence and expiry
- Unauthenticated users redirect to `/login`
- Navbar/footer hidden on `/login` and `/register` routes (controlled by `AppComponent.showNavbar` signal)

### API

- Base URL from `src/environments/environment.ts`: `environment.apiUrl` + `/v1/`
- Proxy configs in `proxy-conf/` forward `/api` to backend
- File replacements swap environment files for dev builds

### Route Structure

- `/login`, `/register` - Public auth screens
- `/` - User dashboard (authGuard)
- `/course/:id` - Student course views (authGuard)
- `/course/:id/manage` - Teacher management views (authGuard + roleGuard with `roles: ['teacher']`)
- `**` - 404 not-found
