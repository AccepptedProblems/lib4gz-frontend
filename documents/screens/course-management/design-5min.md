---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Management — Tech Design (5-min)

## What we're building

`app-course-management` (standalone Angular component) rendered at `/course/:id/manage`. Two-column layout: 280px sidebar + centered content (max-width 960px). The sidebar holds course identity and a 2-item nav. The content area swaps between Course Material and Enrollment.

## System context

```mermaid
flowchart LR
  Route[/course/:id/manage] -->|authGuard + roleGuard| CM[app-course-management]
  CM -- enrollments[] --> EM[app-enrollment-management]
  CM -- lesson + moduleTitle + courseId --> LDM[app-lesson-detail-management]
  CM --> CourseSvc(CourseService)
  CM --> ModuleSvc(ModuleService)
  CM --> LessonSvc(LessonService)
  CM --> EnrollSvc(EnrollmentService)
  LDM --> SummarySvc(SummaryService)
  LDM --> ExerciseSvc(ExerciseService)
  LDM --> Router((Router)) -- /course/:id/manage/exercise/* --> ExEditor[app-exercise-editor]
```

- Parent route `course/:id` already applies `authGuard`. This route adds `roleGuard` with `data: { roles: ['teacher'] }`.
- The screen sits next to the student `course-dashboard` and shares its sidebar layout language.

## Data flow

- **On init** (parallel via `forkJoin`):
  - `CourseService.get(id)`
  - `ModuleService.listByCourse(id)`
  - `EnrollmentService.listByCourse(id)`
- **On module expand** (lazy, per module): `LessonService.listByModule(moduleId)`.
- **Lesson detail** owns its own loading via `app-lesson-detail-management` effect on `lesson` input change (`SummaryService.get`, `ExerciseService.listByLesson`).
- **Mutations:** parent owns module/lesson/course mutations; children own their own mutations and emit reconciliation events upward.

## Key signals (parent component)

- `course: Signal<CourseResponse | null>`
- `modulesWithLessons: Signal<ModuleWithLessons[]>`
- `enrollments: Signal<EnrollmentResponse[]>`
- `activeView: Signal<'course-material' | 'enrollment'>`
- `materialSubView: Signal<'module-list' | 'lesson-detail'>`
- `selectedLessonContext: Signal<SelectedLessonContext | null>`
- `pendingEnrollmentCount: Computed<number>` — derived from `enrollments`, filtered by `EnrollmentStatus.PENDING`. Drives the sidebar red badge.

## Tradeoffs

| Decision | Got | Gave up |
|---|---|---|
| Sidebar nav over tabs | Persistent course identity, room for badges | More layout work, mobile drawer needed |
| Inline enrollment view (no separate route) | Faster pending-request response, fewer routes | Heavier single screen; Enrollment data loads even if teacher only edits content |
| Optimistic updates for CRUD | Snappy UX | Rollback complexity on failure |
| Lazy lesson loading per module | Faster initial paint for large courses | Slight latency on first expand |
| Inline summary editing in child | No screen hop | No rich-text editor in v1 |

## Scope

**In:** layout, view switching, course edit (sidebar), module/lesson CRUD, lesson-detail entry, embed of `app-enrollment-management`, sidebar pending badge, mobile drawer.

**Out:** summary editor (separate spec, TODO), exercise editor (separate screens), course creation, course deletion UI, drag-drop reorder, deep-link to a lesson.

## Failure modes (top-level)

| Mode | UI behavior |
|---|---|
| Initial `forkJoin` rejects | Full-screen error with retry |
| Module list ok, lessons fetch fails on expand | Inline error inside module body, retry icon |
| Mutation 4xx/5xx | Toast error + rollback optimistic change |
| User loses teacher role mid-session | Next protected call returns 403; auth interceptor redirects to `/login` |
| Pending badge stale | Acceptable; refresh on screen entry only in v1 |

[1-min](./design-1min.md) · [Full](./design-full.md) · [Contract](./contract.yaml) · [PRD](./prd-5min.md)
