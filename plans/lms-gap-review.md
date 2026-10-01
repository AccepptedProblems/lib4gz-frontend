# LMS Gap Review — Lib4GZ vs Top-Tier LMS

**Author:** grug (Claude)
**Date:** 2026-09-05
**Scope:** Backend (`lib4gz/`) + Frontend (`lib4gz-fe/`)
**Status:** Review only. No code changed. Priority order proposed in §4, not yet approved.
**Basis:** Code read of both repos (routes, controllers, entities, services, specs, plans). App was not run or used live.

---

## Executive Summary

Lib4GZ has a solid skeleton: clean design system, spec-driven screens, module → lesson tree, enrollment gate, progress loop, client cache with server freshness tokens. What it lacks is the muscle every serious LMS has: a **grading loop**, **rich content**, **deadlines**, **notifications**, and **working auth basics**.

The single biggest hole: a teacher can read student answers but cannot act on them from the UI. Backend endpoints for approve / needs-revision / per-answer comment exist. Nothing on the frontend calls them. Until that closes, Lib4GZ is a content shelf, not a learning system.

---

## 1. What App Has Today

### Backend (`lib4gz/`)

| Area | Endpoints / entities | Notes |
|---|---|---|
| Auth | `POST /v1/auth/register`, `/login`, `/refresh-token` | BCrypt, JWT via `access_token` header. **`refreshToken()` is an empty stub.** |
| Users | `POST /v1/users/{id}/grant-teacher` | ADMIN only. No user list, no profile edit, no password reset, no email verify. |
| Course | CRUD, `GET /code/{code}`, `GET /syllabus`, `GET /last-updates` | 10-digit join code, `visibility` PUBLIC / PRIVATE / UNLISTED, free-form `settings` map. Soft delete. |
| Enrollment | enroll, list, my-enrollment, update, approve, reject, delete | Roles LEARNER / TEACHER. Status PENDING / ACTIVE / REJECTED / INACTIVE. Tracks `lastVisitedLessonId`. |
| Module / Lesson | CRUD under course / module | `orderIndex` only. No lesson type, no duration, no release date. |
| Summary | `GET/POST /lessons/{id}/summary` | One plain-text `content` string per lesson, `version` counter. |
| Exercise | CRUD under lesson, `GET/POST/PATCH /questions` | Types: `TEXT_ANSWER`, `CODE`, `FILE_UPLOAD`, `MULTIPLE_CHOICE`, `PROJECT_LINK`. Free-form `settings` and question `meta`. |
| Submission | create, get, my-submission, list by exercise / lesson, `submit`, `approve`, `revision`, `answers/{id}/comment` | Status DRAFT / SUBMITTED / APPROVED / NEEDS_REVISION. `StudentAnswer.teacherComment` stored. **No score field anywhere.** |
| Progress | `POST /lessons/{id}/visit`, submission-derived `progress` on course payloads | Server-first since UX plan Phase 4. |
| Freshness | `CourseResourceFreshness` bump table + Hibernate listener | Backs the client IndexedDB cache. |
| Security | `security.json` | `permittedEndpoints` for auth + swagger only. **`authorizedEndpoints` is empty.** CORS `allowedOriginPatterns: ["*"]`. Role checks live in service code. |
| Tests | 3 files | App context + 2 freshness tests. No auth, course, or submission tests. |

### Frontend (`lib4gz-fe/`)

| Screen | Route | State |
|---|---|---|
| Login / Register | `/login`, `/register` | Done. Google button is UI-only placeholder. |
| User Dashboard | `/` | Done. My Courses / Teaching tabs, code search, resume card, progress %. |
| Course Layout + Home | `/course/:id` | Done. Sidebar module tree, course home. |
| Lesson Summary | `/course/:id/lesson/:lessonId/summary` | Done. Plain text + linkify pipe rendered via `innerHTML`. |
| Lesson Exercises | `.../exercises` | Done. List + entry to attempt. |
| Exercise Attempt | `.../attempt` | Done. Tabs per exercise, draft autosave, submit all. |
| Lesson Submissions (teacher) | `.../submissions` | **Read-only.** Drawer shows answers. No approve / revise / comment / score. |
| Manage: Material | `/course/:id/manage/material` | Done. Course edit, module / lesson CRUD. |
| Manage: Lesson Detail | `.../material/lesson/:lessonId` | Done. Summary textarea editor, exercise list. |
| Manage: Enrollment | `.../enrollment` | Done. Approve / reject with pending badge. |
| Exercise Editor | `.../exercise/new`, `.../exercise/:id/edit` | Done for `MULTIPLE_CHOICE` and `TEXT_ANSWER`. Fast Create paste import. Other three types unsupported in UI. |
| Not Found | `**` | Done. |

Shared components: avatar, badge, breadcrumb, button, card, chip, dialog, empty-state, input, progress-bar, side-sheet, skeleton, spinner, tabs, textarea, toast. ARIA coverage is good. 2 spec files.

Existing plans already cover: client cache (`client-cache-freshness.md`, done), UX loop (`ux-improvement-plan.md`, phases 0–3 done), teacher review drawer (`review-answer-ui-design.md`, draft, not built).

---

## 2. Gap Table

Reference set: Canvas, Moodle, Google Classroom, Coursera. "Hurt" = how much the gap blocks real teaching use, not how hard it is to build.

| Area | Top LMS has | Lib4GZ has | Hurt |
|---|---|---|---|
| **Grading** | Score per answer / exercise, rubrics, auto-grade MC, gradebook view, feedback text per answer, grade history | Pass / revise flag only. Teacher comment stored on backend, never surfaced. No score field. | **Very high** |
| **Content** | Rich text, images, video, PDF, file attachments, embeds, markdown | One plain-text string per lesson, auto-linkified. No media, no upload. | **Very high** |
| **Deadlines** | Due dates, late policy, calendar view, reminders, scheduled release of lessons | None. No `dueDate` field on any entity. | High |
| **Notifications** | Email + in-app bell: new grade, new lesson, enrollment approved, due soon | None. No notification entity, no email sender. | High |
| **Auth** | SSO / OAuth, password reset, email verification, session refresh, MFA | Password login only. Refresh stub empty. `emailVerified` flag exists but nothing sets it. Google button is decoration. | High |
| **Discussion** | Per-lesson threads, Q&A, announcements, @mentions | None. | High |
| **Teacher analytics** | Completion matrix (student × lesson), stuck-student flags, time on task, submission timeline | Submission list per lesson only. Progress data exists server-side but no teacher view. | High |
| **Assessment controls** | Timer, attempt limit, randomize order, question bank, partial credit, multi-correct MC | None. Single attempt, no timing, no bank. | Medium |
| **Certificates / badges** | Completion certificate PDF, badges, shareable | None. | Medium |
| **Mobile / offline** | Native app or PWA, offline reading | Responsive CSS (15 files with `@media`). No manifest, no service worker. | Medium |
| **Admin** | User list, role management, org / tenant, audit log, bulk import | Grant-teacher endpoint only. No admin UI at all. | Medium |
| **Security hardening** | Per-route role policy, locked CORS, rate limit, HTML sanitize | `authorizedEndpoints` empty, CORS `*`, summary rendered with `innerHTML` unsanitized on server side. | Medium |
| **Search** | Search across courses, lessons, content | Course code lookup only. | Low |
| **i18n** | Multi-language UI | English hardcoded. | Low for now |
| **AI** | Tutor chat, question generation, feedback drafts | None. | Low, hype heavy |
| **Tests** | CI with unit + integration + e2e | 2 FE specs, 3 BE tests. | Medium (compounds every other gap) |

---

## 3. Root Cause Pattern

Three patterns explain most gaps:

1. **Backend ahead of frontend.** Five exercise types, approve / revision / comment endpoints, `emailVerified`, `settings` maps: all exist in Kotlin, none reachable from Angular. Cheap wins live here.
2. **No "event" layer.** No due date, no notification, no announcement. All three need the same thing: a timestamped event table and one delivery channel. Build once, reuse thrice.
3. **Auth shipped as placeholder.** Refresh stub, empty role policy, wildcard CORS, fake Google button. Fine for demo. Trap for production.

---

## 4. Proposed Order (80/20)

Each step small. Each unlocks real teaching use. Later steps depend on earlier ones only where noted.

### Phase A — Close the grading loop (highest value, mostly frontend)

| # | Item | Why |
|---|---|---|
| A.1 | Build the review drawer per `review-answer-ui-design.md`: judgment buttons + review text per answer, wired to existing `comment`, `approve`, `revision` endpoints. | Endpoints exist. Plan exists. Zero new backend for the base version. |
| A.2 | Add `score: Int?` and `maxScore: Int?` to `StudentAnswer` and `Submission`. Expose in payloads. | LMS without a number is a suggestion box. Keep integer. Rubrics later, if ever. |
| A.3 | Auto-grade `MULTIPLE_CHOICE` on submit using answer key already in question `meta`. | Removes most teacher clicks. Answer key already stored. |
| A.4 | Student results view: score, judgment, teacher comment per answer. `ux-improvement-plan.md` Phase 4 already lists this as pending. | Feedback nobody sees is feedback nobody wrote. |

### Phase B — Rich content

| # | Item | Why |
|---|---|---|
| B.1 | Markdown for summary. Render with a small sanitizing markdown lib on FE. Keep `content` string as-is, no schema change. | `ux-improvement-plan.md` 0.2 already flagged flat-paragraph bug. Markdown fixes it and adds headings, lists, code. |
| B.2 | Image upload to Supabase Storage. One `POST /v1/uploads` returning URL. Insert as markdown image. | Supabase already in stack. Boring. |
| B.3 | YouTube / video URL embed in markdown render. | Covers 90% of video need with zero hosting. |
| B.4 | Enable `FILE_UPLOAD` exercise type in editor + attempt using B.2 upload endpoint. | Backend enum already there. |

### Phase C — Auth and security basics (before any real users)

| # | Item | Why |
|---|---|---|
| C.1 | Implement `refresh-token` for real, or delete the endpoint and the FE call. | Empty stub is worse than no stub. |
| C.2 | Password reset + email verification via one email sender (Resend or Supabase Auth email). | `emailVerified` field already exists. This sender is reused in Phase D. |
| C.3 | Fill `authorizedEndpoints` in `security.json` for `/manage`-class routes. Lock CORS to real origins. | Whitelist file exists for exactly this. Currently unused. |
| C.4 | Sanitize summary HTML on backend or render markdown only (B.1 makes this moot). | `innerHTML` with unsanitized teacher content. |
| C.5 | Real Google OAuth, or remove the button. | Credentials already in `secret/`. Fake button erodes trust. |

### Phase D — Deadlines and notifications (one event layer)

| # | Item | Why |
|---|---|---|
| D.1 | `dueAt: Long?` on `Exercise`. Show in exercise list, attempt header, dashboard "due soon". Mark late submissions. | Smallest possible deadline. No late policy yet. |
| D.2 | `Notification` entity: `userId`, `type`, `payload`, `readAt`. Bell in navbar. Types: grade returned, enrollment approved, new lesson, due soon. | `ux-improvement-plan.md` already lists the bell as pending. |
| D.3 | Email on grade returned and enrollment approved, via C.2 sender. | Two emails cover most re-engagement. |
| D.4 | Teacher announcement: reuse D.2 with type `ANNOUNCEMENT`, one textarea on course home. | Announcement is a notification with a body. No new screen. |

### Phase E — Teacher visibility

| # | Item | Why |
|---|---|---|
| E.1 | Gradebook table at `/course/:id/manage/grades`: rows students, columns lessons, cells completion + score. | Progress and score data exist after Phase A. One table, one endpoint. |
| E.2 | "Stuck" flag: student with no visit in N days or repeated NEEDS_REVISION. | Derived from existing `lastVisitedAt` and submission status. |

### Phase F — Tests (run alongside A–C, not after)

| # | Item | Why |
|---|---|---|
| F.1 | Backend integration tests for auth, enrollment gate, submission state machine. | Grading state machine is the thing that must not regress. |
| F.2 | FE spec for `ProgressService`, `SubmissionService`, review drawer. | Cache + optimistic layers are where silent bugs hide. |

---

## 5. What To Skip For Now

| Skip | Reason |
|---|---|
| Discussion forums | Moderation cost high, usage often low. Announcements (D.4) cover the broadcast case. Revisit when users ask. |
| AI tutor / question generation | Shiny. Build after grading works. Nothing to feed it until then. |
| Native mobile app | PWA manifest + service worker is one day and covers offline reading. |
| i18n | Only when a second-language customer exists. |
| Multi-tenant / org admin | One school, one deployment. Add when second school signs. |
| Rubrics, partial credit, question bank | Integer score (A.2) covers most real classes. Complexity demon lives here. |

---

## 6. Self Check

- **Reference set may be too big.** Canvas and Moodle serve universities. If Lib4GZ targets one teacher group, Phases A–C are the whole gap. D–E are nice.
- **Not run live.** All findings from code. Some "none" rows may exist in a branch grug did not see.
- **Service bodies not read deeply.** Grug grepped controllers, entities, and `security.json`. Validation and role checks inside `*Service.kt` may be stronger than the empty `authorizedEndpoints` suggests. Worth a focused check before Phase C.
- **`settings` and `meta` maps not inspected.** Answer key location for A.3 is assumed from the exercise editor, not verified against the stored shape.
- **Confidence:** high on the feature inventory, medium on the ordering. Order changes if the real user is a single teacher (skip D) or a school (pull E forward).

---

## 7. Open Questions

1. Who is the target user in the next 6 months: one teacher group, or many schools? Decides D vs E priority and whether admin is needed at all.
2. Is a numeric score acceptable, or does the teaching model need pass / revise only? Decides A.2.
3. Supabase Storage vs another bucket for uploads? Decides B.2 shape.
4. Keep Google OAuth or drop it? Decides C.5.
