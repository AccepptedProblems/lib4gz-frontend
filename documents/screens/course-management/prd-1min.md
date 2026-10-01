---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Management — PRD (1-min)

- **Problem.** Teachers need one place to shape a course end-to-end — edit identity, build the module/lesson tree, and handle enrollment requests — without bouncing between screens or losing context.
- **Primary user.** Course teacher/owner (role gated; only the course's teachers reach this screen).
- **Outcome.** A single hub at `/course/:id/manage` with a sticky course identity sidebar plus a centered work area that switches between **Course Material** and **Enrollment** views.
- **Why it matters now.** Replaces a tab-only layout that hid the course title on scroll and split enrollment management across two routes, slowing down day-to-day teaching tasks.
- **Success metric.** Time-to-first-meaningful-action (e.g., add a module or approve a pending request) under 5 seconds from screen load on broadband. Pending-enrollment turnaround within one work session for >80% of incoming requests.
- **Pending requests are visible.** A red badge on the Enrollment nav item shows the pending count whenever it's >0 — teachers don't have to dig to discover them.
- **Scope (in).** Two-column layout, view switcher, course edit, module/lesson CRUD, lesson-detail entry point, embedded enrollment management.
- **Scope (out).** Summary editor screen (separate spec, TODO), exercise editor (separate screen), course creation, course delete UI surface (API exists; no surface here yet).
- **Target.** Phase: scaffold → implementation; ships alongside the lesson-detail and enrollment child components.

[5-min](./prd-5min.md) · [Full](./prd-full.md) · [Tech design](./design-1min.md)
