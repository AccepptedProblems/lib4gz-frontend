---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson View — Tech Design (full)

## 1. Component map

```
app-lesson-view (standalone)
  ├─ <header-bar>           inline — back link, "Lesson X of Y"
  ├─ <sidebar>              reused module accordion (same shape as course dashboard)
  ├─ <content-area>         max-width 800px, centered
  │    ├─ <type-badge>      Summary | Video | Exercise | Quiz
  │    ├─ <title>           text-headline-medium
  │    ├─ <body @switch>    Summary -> rich-text host
  │    │                    Video   -> player
  │    │                    Quiz    -> <app-quiz>
  │    │                    Exercise-> router.navigate(/exercise/:id), no body
  │    ├─ <resources>       optional — list of download links
  │    └─ <related>         optional — link list
  └─ <nav-footer>           lib-button x2 (Previous / Next)
```

All shared visual tokens come from the design system — type badge colors map to the Mint theme primary plus blue/purple/green/orange accents (see `documents/design-system/color.yaml`).

## 2. Data flow & signals

| Signal | Source | Notes |
|---|---|---|
| `courseId$`, `lessonId$` | `ActivatedRoute.paramMap` | Streamed so deep-link navigation between lessons updates state |
| `lesson()` | `toSignal(LessonService.get(lessonId$))` | `undefined` while loading |
| `modules()` | `toSignal(ModuleService.listByCourse(courseId$))` | Reused for sidebar + position |
| `position()` | `computed(...)` | `{ current, total }` from `modules()` |
| `prev() / next()` | `computed(...)` | Lesson refs or `null` at endpoints |
| `state()` | `computed(...)` | `'loading' \| 'loaded' \| 'error' \| 'not-found'` |

Position math (kept inline in the component, not a service):

```ts
function calcPosition(lessonId: string, modules: Module[]) {
  let current = 0, total = 0;
  for (const m of modules)
    for (const l of m.lessons) {
      total++;
      if (l.id === lessonId) current = total;
    }
  return { current, total };
}
```

## 3. Failure modes

| Failure | Detection | UI behavior |
|---|---|---|
| Lesson fetch network error | RxJS error in `LessonService.get` | `state = 'error'` — message + Retry + "Back to course" |
| Lesson 404 | HTTP 404 from `/lessons/:id` | `state = 'not-found'` — 404 message + "Back to course" |
| Lesson 401/403 | HTTP 401/403 | Global `errorInterceptor` redirects to login; component never sees it |
| Modules fetch error | RxJS error in `ModuleService.listByCourse` | Sidebar shows error stub; main content still renders if `lesson()` resolved |
| Lesson id not in module list | `position.current === 0 && total > 0` | Refetch modules once; if still missing, `state = 'not-found'` |
| Empty `lesson.body` | `lesson.body` falsy | Render title + badge + empty-state hint |
| Video player fails to load | Player error event | Show error inside player frame; don't blank the page |
| Quiz component throws | Caught at component boundary | Inline error + "Reload lesson" button |
| Exercise redirect target missing | Exercise route 404s | Falls back through `errorInterceptor` |

## 4. Auto-completion details

| Type | Trigger | Hook |
|---|---|---|
| Summary | Content area scrolled to ≥95% of scrollable height | `(scroll)` listener on the content container |
| Video | `currentTime / duration ≥ 0.9` | `timeupdate` event from the player |
| Exercise | n/a here | Handled on submission in the exercise screen |
| Quiz | n/a here | Handled on submission in `<app-quiz>` |

Completion writes go through whatever the existing course-dashboard completion endpoint is; this screen does not own that contract.

## 5. Decision log

| Date | Decision | Alternatives considered | Why |
|---|---|---|---|
| 2026-05-06 | Type-dispatched body in one component | Route per type | Prev/Next must work uniformly; a single route + URL shape is simpler for sharing & deep-link |
| 2026-05-06 | Client-side position math | Server-side `{position, total}` | Avoid an endpoint we don't yet need; modules are already fetched for the sidebar |
| 2026-05-06 | Exercise lessons redirect to the exercise attempt screen | Inline render | Avoid tangling submission lifecycle and routing into this screen |
| 2026-05-06 | Hide sidebar on mobile, no drawer | Drawer / hamburger | Out of scope this iteration; ship the smallest thing that meets AC9 |
| 2026-05-06 | Reuse the dashboard sidebar | Build a lesson-specific sidebar | One source of truth for the module tree |

## 6. Open questions
- **Rich-text sanitization.** Use Angular's `DomSanitizer` with `bypassSecurityTrustHtml` or a real allowlist? Blocked by author-tool decisions; not blocking the read-only path.
- **Video provider.** HTML5 native vs. third-party iframe (Vimeo / YouTube / Mux). Affects whether 90% auto-complete is reliable.
- **Sidebar component extraction.** Is the dashboard sidebar already a shared component, or do we extract it as part of this ticket? To verify against `src/app/components/course/course-dashboard/`.

## Links
[1-min](./design-1min.md) · [5-min](./design-5min.md) · [PRD](./prd-1min.md) · [contract](./contract.yaml)
