---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Summary View — Tech Design (5 min)

## What we're building

A content-only Angular standalone component (`SummaryViewComponent`) that renders a lesson's sanitized summary plus a navigation footer (Prev / Mark Complete / Next). It is slotted into `course-layout` via `<router-outlet>`, so the sidebar, breadcrumb, and mobile drawer come from the parent.

## System context

```
+----------------- CourseLayoutComponent (parent) ----------------+
|  Breadcrumb                                                     |
|  +----------------+  +---------------------------------------+  |
|  | Course sidebar |  | <router-outlet>                       |  |
|  | (modules+      |  |   -> SummaryViewComponent (this)      |  |
|  |  lessons)      |  |     - fetch summary by lessonId       |  |
|  |                |  |     - render content                  |  |
|  |                |  |     - footer: prev / complete / next  |  |
|  +----------------+  +---------------------------------------+  |
+-----------------------------------------------------------------+
```

- **Parent owns**: sidebar tree (from `ModuleService.listByCourse`), breadcrumb, mobile drawer, current-lesson highlight.
- **This component owns**: summary fetch, content render (with sanitization + linkify), footer buttons, completion toggle.
- Communication is via route params (`courseId`, `lessonId`) and a shared signal-based course-state service. No double fetching of modules.

## Data flow

| Source | Purpose | Trigger |
|---|---|---|
| `SummaryService.get(lessonId)` | Lesson summary HTML/Markdown | On `lessonId` route-param change. |
| `LessonService.get(lessonId)` | Lesson title + completion flag | On `lessonId` change. |
| Parent course-state signal | Module/lesson order, sidebar state | Read-only (computed for prev/next). |
| `LessonService.markComplete(lessonId)` *(TBD endpoint)* | Persist toggle | Mark Complete click — optimistic, rollback on error. |

State is signal-based (`signal()`, `computed()`), per the project's Angular conventions. `toSignal()` wraps the route-param observable.

## Key tradeoffs / decisions

| Decision | Why | Rejected alternative |
|---|---|---|
| **Render inside `course-layout` via router-outlet.** | Reuses sidebar + breadcrumb; keeps state (selected module, drawer open) consistent across lessons. | Standalone page that re-renders sidebar — guaranteed drift + double fetches. |
| **Manual Mark Complete only.** | No auto-complete heuristic to maintain; explicit user action is unambiguous. | Scroll-based completion — false positives, accessibility issues. |
| **Optimistic UI for Mark Complete.** | The action feels instant; rollback on error is simple. | Pessimistic update — adds 200–500ms feedback delay for a one-bit toggle. |
| **`lib-button` for footer controls.** | Already themed via design tokens; matches Course Dashboard. | Hand-rolled buttons — re-implements states, tokens, a11y. |
| **DomSanitizer + LinkifyPipe.** | Standard Angular path, plus existing pipe. | Custom sanitizer — security risk, no upside. |
| **Defer to backend on HTML vs. Markdown.** | One render path can handle either after sanitization. | Pick now and re-do later — premature. |

## Route shape — open question

Source spec specifies `/course/:courseId/lesson/:lessonId/summary`. The live router (see `src/app/app.routes.ts`) uses `/course/:id/lesson/:lessonId` rendered by `course-lesson.component.ts`. Three plausible resolutions:

1. **Replace** `course-lesson.component` with `summary-view` at `/course/:id/lesson/:lessonId`. Simplest if a lesson page is just "summary + tabs later."
2. **Add `/summary` sub-route** under the existing lesson route — matches the source spec but adds a redundant URL segment for the default view.
3. **Tab inside `course-lesson`** — `course-lesson` hosts tabs (Summary, Exercises), summary-view is the default tab content.

Option 3 aligns with the Course Dashboard PRD's "tabbed Summary / Exercises / Submissions" intent. **Recommended: option 3** — but requires sign-off; track in `design-full.md` decision log.

## Scope

**In scope:** content fetch + render, prev/next navigation, manual Mark Complete (UI + service call), loading/error/empty states, responsive behavior delegated to parent layout.

**Out of scope:** authoring/editing, auto-complete heuristics, comments/notes/highlights, analytics, server-side progress bars.

## Failure modes (summary)

- Summary 404 → "No content yet" state.
- Summary 5xx / network → error state with retry.
- 401 from any call → handled by global `errorInterceptor` → redirect to `/login`.
- Mark Complete failure → rollback + inline error.
- Invalid `lessonId` → error state.

Full table in [design-full.md](./design-full.md).
