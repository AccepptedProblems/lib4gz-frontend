---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# User Dashboard — Tech Design (Full)

Full implementation reference. For shorter reads, see [`design-1min.md`](./design-1min.md) and [`design-5min.md`](./design-5min.md).

## 1. Component map

```
app-user-dashboard
├─ Header
│   ├─ Welcome message            (h2 .welcome-message)
│   └─ Search wrapper
│       ├─ Search input           (aria-label="Search course by code")
│       ├─ Search clear (×) | Spinner
│       ├─ Inline search-error
│       └─ Search dropdown        (rendered when matches > 0)
├─ Tab navigation                 (role=tablist)
│   ├─ My Courses tab             (role=tab)
│   ├─ Teaching tab               (role=tab)
│   └─ + Create Course button     (lib-button, role-gated)
├─ Grid region (one-of)
│   ├─ Loading: 6 skeleton cards
│   ├─ Error: error-state with Retry (lib-button)
│   ├─ Empty: empty-state with role-aware subtitle
│   └─ Loaded: course-grid of course-card
└─ Dialogs (siblings of .dashboard)
    ├─ Create Course dialog       (lib-dialog wrapping ReactiveForm)
    │   ├─ lib-input (Title)
    │   ├─ lib-textarea (Description)
    │   └─ native <select> Visibility (PUBLIC/PRIVATE/UNLISTED)
    └─ Course Preview dialog      (lib-dialog)
        ├─ Title, optional description
        ├─ 3-col meta grid (Instructor / Modules / Students)
        └─ Inline success or error feedback badge
```

Source files:

- TS: `src/app/components/home/user-dashboard/user-dashboard.component.ts`
- HTML: `src/app/components/home/user-dashboard/user-dashboard.component.html`
- SCSS: `src/app/components/home/user-dashboard/user-dashboard.component.scss`

## 2. State (signals + computeds)

| Name | Type | Notes |
|---|---|---|
| `userName` | `signal<string>` | from `AuthService.getUserName()` on init |
| `activeTab` | `signal<'enrolled' \| 'created'>` | default `'enrolled'`; auto-flips to `'created'` if enrolled is empty after load |
| `isLoading` | `signal<boolean>` | drives skeletons |
| `errorMessage` | `signal<string>` | drives error state |
| `enrolledCourses` | `signal<CourseResponse[]>` | source of grid + dropdown matches |
| `createdCourses` | `signal<CourseResponse[]>` | source of grid |
| `filteredCourses` | `computed` | switches by `activeTab` |
| `searchCodeInput` | `signal<string>` | debounced via Subject |
| `showDropdown` | `signal<boolean>` | controlled by Subject pipeline + blur delay |
| `isSearching` | `signal<boolean>` | true during `getByCode` |
| `searchError` | `signal<string>` | inline "Course not found" |
| `matchingEnrolledCourses` | `computed` | `enrolledCourses.filter(c => c.code.startsWith(input))` |
| `showCoursePreview` / `previewCourse` | signals | preview-dialog state |
| `isApplying` / `applyError` / `applySuccess` | signals | enrollment outcome |
| `showCreateDialog` / `isCreating` / `createError` | signals | create-dialog state |
| `canCreateCourse` | `computed` | `AuthService.hasRole(TEACHER, ADMIN)` |
| `createForm` | `FormGroup` (nonNullable) | `{ title, description, visibility }` |

## 3. Routing & guards

- Route: `/` — declared in `src/app/app.routes.ts`, lazy-loaded via `loadComponent`.
- Guard: `authGuard` only. No role guard — the Teaching tab is visible to everyone, but the *+ Create Course* button is gated by `canCreateCourse`.
- Outbound navigation:
  - Card click on My Courses → `/course/{id}`.
  - Card click on Teaching → `/course/{id}/manage`.
  - Successful course creation → `/course/{id}/manage`.
  - Search-driven navigation → `/course/{id}`.

## 4. Data flow

| Action | Service call | Outcome |
|---|---|---|
| ngOnInit | `CourseService.list('enrolled')` + `CourseService.list('created')` (parallel) | Populate two signals; clear loading when both resolve |
| Type into search | local `Subject<string>` debounce 300ms → `searchCodeInput.set` | Triggers `matchingEnrolledCourses` computed |
| Press Enter on search | maybe `CourseService.getByCode(code)` | Navigate / open preview / inline error |
| Click dropdown row | none | `router.navigate(['/course', id])` |
| Apply in preview | `EnrollmentService.enroll(courseId)` | Success badge → reload courses → close after 1500ms |
| Submit create | `CourseService.create(payload)` | Navigate to manage page on success |
| Click Retry on error state | re-run `loadCourses()` | Re-fetch both lists |

## 5. Failure modes

| Mode | Detection | UX | Notes |
|---|---|---|---|
| Network down on initial load | First list `error` callback | Screen-level error state with *Retry* | Both list errors set the same `errorMessage`; only first wins (intentional). |
| 401 on any call | Global `errorInterceptor` | Redirect to `/login` | Not handled inside this component. |
| `getByCode` 404 vs. 5xx | `error` callback | Always renders `Course not found` | TODO: distinguish 5xx — see open questions. |
| `enroll` 409 (already enrolled) | `error` callback | Inline error in preview dialog | Backend message is surfaced verbatim. |
| Race: rapid Enter presses while a `getByCode` is in flight | Multiple subscriptions could resolve out of order | UI may briefly toggle between states | Acceptable; mitigated by hiding dropdown when `isSearching` flips on. Documented as a known small risk. |
| Component destroyed during in-flight call | Signal `set` on a dead component | No-op | Currently only the search Subject uses `takeUntilDestroyed`; list/create/enroll do not. See open questions. |
| `setTimeout(1500ms)` survives unmount after apply | Possible callback firing after destroy | `signal.set` is a no-op; `router.navigate` is intentionally not called on success | Effectively safe. |
| Dialog backdrop click during `isApplying` | Cancel handler runs while a request is open | Request resolves but dialog state already cleared, so success badge is suppressed | Acceptable. |

## 6. Decision log

| Date | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| 2026-04 | **Tabs share one route at `/`** | Two routes (`/my-courses`, `/teaching`); a single mixed list with role chips | Same data shape, same layout, same empty state. Extra routes add navigation surface for no UX gain. Mixed list loses the "I'm a teacher here" affordance that gates *Create Course*. |
| 2026-04 | **Code search is prefix-filter on already-loaded list, with `getByCode` only on Enter** | Server-side search-as-you-type | Codes are unique 10-digit strings — meaningful matching only happens at full length. Server-side per-keystroke would be wasteful and laggy. |
| 2026-04 | **Apply does not auto-navigate to the course on success** | Navigate to `/course/{id}` immediately after enroll | Enrollment may be pending instructor approval; landing on a course you cannot yet open is worse than a confirmation badge. |
| 2026-04 | **Auto-switch to Teaching tab if user has no enrolled courses** | Always default to *My Courses* | TEACHER-only users would otherwise hit an empty list every login. The fallback is one-shot (after first load) — manual tab switching is preserved afterwards. |
| 2026-04 | **`canCreateCourse` is a computed off `AuthService.hasRole(TEACHER, ADMIN)`** | Route-level role guard | Teaching tab is visible to everyone (a USER can still see courses they were given a teaching seat on); only the create action is gated. A route guard would over-restrict. |
| 2026-04 | **Inline success/error badge in the preview dialog** | Toast notification | The dialog already owns user attention; toast adds a global UI layer we don't otherwise need on this screen. |
| 2026-04 | **Two parallel list calls accepted, no caching layer** | Sequential calls; cache via service | Both lists are needed for tab counts and the auto-fallback rule. Caching adds invalidation work for negligible win at this scale. |
| 2026-04 | **Skeletons over a spinner during load** | Single centered spinner | Skeletons preserve the layout and prevent the page from "jumping" when content arrives. |

## 7. Open questions

1. **User-problem framing.** The original `spec.yaml` did not state the user problem explicitly. The PRD inferred it as "after login, users have no central place to see their courses" — confirm with product before the next review.
2. **Analytics provider.** Event names in `prd-full.md` §4 are proposals; no analytics SDK is wired in the app yet.
3. **Distinguish `getByCode` 404 from 5xx.** Today both render "Course not found". Should 5xx render a generic error and offer retry?
4. **Memory hygiene for in-flight requests.** Only the search Subject uses `takeUntilDestroyed`. Should `list/create/enroll` subscriptions also use it for consistency? Functionally a no-op because of signals, but stylistically inconsistent.
5. **Real progress %, thumbnails, last-activity timestamp.** Tracked as out-of-scope in the PRD; no design here yet.
6. **Tab badge counts.** Currently rendered as raw counts next to each label. Is this an intentional product feature or incidental? If intentional, it needs an entry in acceptance criteria and a max-count rule (e.g. `99+`).
7. **Pagination.** What happens when a teacher has 200+ courses? The grid will render all of them. Out of scope for scaffold but needs revisiting before scale.
8. **Cleanup of the post-apply timer.** The 1500ms `setTimeout` after a successful enroll is not cancelled on early unmount. Low-risk today; revisit if the dialog ever owns more state.
