---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Dashboard — Tech Design (full)

> Standalone reference for an implementer or future maintainer. Use [design-1min.md](./design-1min.md) and [design-5min.md](./design-5min.md) for the overview; this document is the detail map.

## 1. Component map

| Concern | File | Notes |
|---|---|---|
| Component class | `src/app/components/course/course-dashboard/course-dashboard.component.ts` | Standalone. Owns all signals, services, drawer viewChild. |
| Template | `src/app/components/course/course-dashboard/course-dashboard.component.html` | Sidebar + tabbed content + `mat-drawer-container`. |
| Styles | `src/app/components/course/course-dashboard/course-dashboard.component.scss` | Sidebar, tabs, drawer overrides via `::ng-deep`. |
| Route registration | `src/app/app.routes.ts` (parent `course/:id`, child path `''`) | `loadComponent` lazy import. Parent applies `authGuard`. |
| Auth guard | `src/app/guards/auth.guard.ts` | Functional guard on parent route. |
| Services | `src/app/services/` (`course.service.ts`, `module.service.ts`, `lesson.service.ts`, `summary.service.ts`, `exercise.service.ts`, `submission.service.ts`, `enrollment.service.ts`, `question.service.ts`) | Imported individually; barrel: `src/app/services/index.ts`. |
| Models | `src/app/shared/models/` — `course.model.ts`, `module.model.ts`, `lesson.model.ts`, `summary.model.ts`, `exercise.model.ts`, `submission.model.ts`, `enrollment.model.ts`, `enums.ts`, `common.model.ts` | Schema source: `documents/network/models.yaml`. |
| Pipes | `src/app/shared/pipes/linkify.pipe.ts` | Auto-linkifies URLs in summary HTML. |
| Shared components | `lib-button`, `lib-badge`, `lib-chip`, `lib-skeleton`, `lib-spinner` (see `documents/design-system/shared-components/`). |
| Material | `@angular/material/sidenav` — `MatDrawer`, `MatDrawerContainer`, `MatDrawerContent` | Imported in component `imports: [...]`. |

## 2. Signals & methods (full inventory)

### Signals owned by the component

- `course: CourseResponse | null`
- `modules: ModuleResponse[]`
- `lessonsByModule: Map<string, LessonResponse[]>`
- `expandedModules: Set<string>`
- `myEnrollment: EnrollmentResponse | null`
- `selectedLesson: LessonResponse | null`
- `selectedLessonPrefix: string`
- `activeTab: 'summary' | 'exercises' | 'submissions'`
- `summary: SummaryResponse | null`
- `exercises: ExerciseResponse[]`
- `perExerciseSubmission: Map<string, SubmissionResponse | 'none'>`
- `exerciseSubmissions: Map<string, SubmissionResponse[]>`
- `exerciseStatusesLoading | submissionsLoading | exerciseStatusesLoaded | submissionsLoaded`
- `expandedExerciseId: string | null`
- `exerciseQuestions: Map<string, QuestionResponse[]>`
- `exerciseQuestionsLoading: Set<string>`
- `submissionDrawer = viewChild<MatDrawer>('submissionDrawer')`
- `drawerQuestionId | drawerQuestionContent | drawerExerciseId`
- `drawerSubmissions: SubmissionResponse[]`
- `drawerLoading: boolean`
- `loading | error` — page-level

### Computed signals

- `isTeacher = computed(() => myEnrollment()?.role === EnrollmentRole.TEACHER)`
- `sortedExercises = computed(() => exercises().slice().sort((a, b) => a.orderIndex - b.orderIndex))`

### Methods

- `selectLesson(lesson, modulePosition, lessonPosition)` — sets selected lesson, prefix, resets `activeTab`, fetches summary.
- `setActiveTab(tab)` — fetches per-tab data on first activation.
- `toggleModuleExpand(module)` — accordion behavior (other modules stay open); fetches lessons on first expand.
- `toggleExerciseExpand(exercise)` — Submissions tab; closes any open drawer; fetches questions on first expand.
- `openQuestionDrawer(question, exercise)` — sets drawer signals, runs `forkJoin(submissions.map(s => SubmissionService.get(s.id)))`, opens drawer.
- `closeSubmissionDrawer()` — programmatic close.
- `onDrawerClosed()` — clears drawer signals (bound to `(closed)` event).
- `getAnswerForQuestion(sub)` — finds matching `answer` in `sub.answers`.
- `enroll()` — not-enrolled CTA path.
- `retry()` — page-level retry.

## 3. Data flow per surface

| Surface | Trigger | Calls | Cached? |
|---|---|---|---|
| Init | `ngOnInit` | `courses.get`, `modules.list-by-course`, `enrollments.my-enrollment` | n/a |
| Auto-select first lesson | After init | `lessons.list-by-module(module[0].id)`, `summaries.get(lesson.id)` | Module-1 lessons cached. |
| Click module header | User | `lessons.list-by-module(moduleId)` if not cached | Per module. |
| Click lesson | User | `summaries.get(lessonId)` | Refetch each click (cheap, summary is small). |
| Switch to Exercises | User | `exercises.list-by-lesson(lessonId)` then per-exercise `submissions.my-submission` | Per `(lessonId, tab)` pair via `*StatusesLoaded` flag. |
| Switch to Submissions (teacher) | User | `exercises.list-by-lesson` (if not loaded) + per-exercise `submissions.list-by-exercise` | Per `(lessonId, tab)` pair via `submissionsLoaded`. |
| Expand exercise (Submissions) | User | `questions.list-by-exercise(exerciseId)` | Cached in `exerciseQuestions` map. |
| Click question | User | `forkJoin(submission ids → submissions.get)` | Not cached (drawer reopen refetches). |
| Click Enroll | User | `enrollments.enroll(courseId)` | n/a |

## 4. Failure modes

| Mode | Detection | UI | Recovery |
|---|---|---|---|
| Init request fails | Any of `courses.get` / `modules.list-by-course` rejects | Page-level error + Retry. | `retry()` re-runs init. |
| `enrollments.my-enrollment` 404 | HTTP 404 | Treated as `null` enrollment → not-enrolled state. | User clicks Enroll. |
| `enrollments.my-enrollment` non-404 error | Any other status | Page-level error. | Retry. |
| `summaries.get` 404 | HTTP 404 | "No summary available." placeholder in Summary tab. | None — empty state. |
| `summaries.get` other error | Any other status | "Failed to load summary." inline. | Switching lesson re-fetches. |
| `exercises.list-by-lesson` fails | HTTP non-2xx | "Couldn't load exercises." + retry icon. | Tab-local retry. |
| Per-exercise `getMySubmission` 404 | HTTP 404 | Status chip = "Not attempted". | n/a — not an error. |
| Per-exercise `getMySubmission` other error | HTTP non-2xx | Status chip = "—" with tooltip "Couldn't load status". | Tab-local retry. |
| `submissions.list-by-exercise` fails (teacher) | HTTP non-2xx | Per-card error inside Submissions tab. | Per-card retry. |
| `questions.list-by-exercise` fails on expand | HTTP non-2xx | "Couldn't load questions." inside expanded card; expand stays open. | Click again to retry. |
| `forkJoin(submissions.get)` partial fail | Some inner observables error | Render successful results; banner inside drawer "N answers couldn't be loaded". | Reopen drawer. |
| `enrollments.enroll` fails | HTTP non-2xx | Inline error under CTA; CTA stays clickable. | User retries. |
| Mobile drawer focus escape | `keydown` Tab outside drawer | Focus trap inside drawer while open; close returns focus to hamburger. | n/a |
| Window resize across 768 px | `(window:resize)` | Reset `mobileSidebarOpen` to false; desktop sidebar takes over. | n/a |

## 5. Decision log

| Date | Decision | Alternatives considered | Why |
|---|---|---|---|
| 2025-Q4 | **Two-column layout replaces standalone course-header section.** | Keep header strip + content below. | Coursera-style sidebar keeps course identity in view at all times; reduces vertical scroll on lesson reads. |
| 2025-Q4 | **Lesson selection is component state, not a child route.** | Child route `/course/:id/lesson/:lessonId`. | Avoids router churn for what is in-page navigation. Deep-linking deferred. |
| 2025-Q4 | **`MatDrawer` mode="side" for per-question answers.** | Dialog overlay; bottom sheet; new `/manage`-side route. | Side mode preserves the lesson context behind the drawer; dialog covered context; bottom sheet read poorly on desktop. |
| 2025-Q4 | **Hierarchical numbering is purely positional.** | Persist `displayNumber` on entities. | Numbers must always reflect current sort; persisting them creates drift after edits. |
| 2025-Q4 | **Teacher gating in template, not via `roleGuard`.** | Separate teacher route. | Same screen serves both roles; route-level gating would force a duplicate. |
| 2026-05 | **Unified Surface (no sidebar bg / border) is a hard-rule design check.** | Tinted sidebar (`--surface-sunken`) like the legacy mixin suggests. | Visual hierarchy via type/whitespace, not panels — matches `documents/design-system/design-principles.yaml`. The legacy `sidebar-theme-default` mixin in `theme.yaml` is intentionally **not** applied here. |
| 2026-05 | **Plain-text URLs in summary content are linkified at render via `LinkifyPipe`.** | Server-side enrichment; Markdown rendering. | Cheapest fix that meets the user need; no schema change. |

## 6. Open questions

1. **Drawer perf at scale.** `forkJoin` of `submissions.get` is N requests per question open. At ~50 students × multiple opens, this is wasteful. Options to evaluate: a single `submissions.list-by-exercise?include=answers` endpoint, or a per-question endpoint. Owner: backend lead. Date raised: 2026-05.
2. **Deep-linking to lesson.** Out of scope this iteration but a likely follow-up. If we add it, do we use a query param (`?lesson=…`) or a child route segment? Recommendation: query param to avoid restructuring the route.
3. **Persist sidebar expansion state.** Currently lost on reload. Worth `localStorage` per `(userId, courseId)`?
4. **Inferred user problem.** The source spec did not state the user problem explicitly; it was inferred as "students need persistent course identity + in-place lesson nav" and "teachers need per-question answer comparison". Validate with PM before sign-off. (Per writing guidelines: flagged.)
5. **Analytics ownership.** Events are listed in `prd-full.md` §6 but no instrumentation exists yet. Who owns wiring?
6. **Empty-module placeholder copy.** "No modules yet" / "No lessons yet" need product-approved copy.
