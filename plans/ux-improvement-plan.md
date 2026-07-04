# UX Improvement Plan — Coursera-informed

> Status: phases 0–3 implemented (2026-07-03) · Phase 4 backend progress API implemented (2026-07-04):
> `Enrollment.lastVisited*` + `POST /v1/lessons/{id}/visit` + submission-derived `CourseResponse.progress`
> / `LessonResponse.completed` in the lib4gz repo, consumed server-first with localStorage as optimistic
> cache. Still pending: results/review screen, notifications bell. · Created: 2026-07-03
> Basis: analysis of Coursera's design system & learning UX, plus a rendered-UI review of
> Lib4GZ (screenshots of login, register, dashboard, course/lesson, exercises, attempt, mobile).

## Guiding insight

Coursera's core design bet: **a learner should never have to think about where to go next.**
Progress is omnipresent but quiet (thin bars, checkmarks, "Resume" everywhere), consumption is
linear by default (Next → at the bottom of every item) with a persistent sidebar map, and motion
is small, functional, and consistent (skeletons, 150–250ms ease-out, state-change feedback).

Lib4GZ already has the shell for this (curriculum sidebar, tokens, skeletons, ARIA). What's
missing is the **loop**: progress state, forward navigation, and resume.

---

## Phase 0 — Foundations & bug fixes (no backend needed, ~1 day)

| # | Item | Reasoning |
|---|------|-----------|
| 0.1 | **Define `--shadow-sm/md/lg` tokens** in `_typography.scss` (or a new `_elevation.scss`). Tint shadows toward teal, e.g. `0 1px 2px rgba(0,40,35,.06)` / `0 2px 8px rgba(0,40,35,.08)` / `0 8px 24px rgba(0,40,35,.12)`. Remove per-component inline fallbacks. | Tokens are referenced app-wide but **never defined** — every component silently uses its own fallback, so elevation is inconsistent and the "Elevation Over Borders" principle is unrealized. Coursera tints grays/shadows with brand color for cohesion. |
| 0.2 | **Fix summary formatting**: add `white-space: pre-line` to `.summary-content` (`lesson-summary.component.scss`) as an immediate fix; longer term render summaries as markdown. | Confirmed rendered bug: newlines and list dashes in summary content collapse into one flat paragraph — the main content students read is the least readable thing in the app. |
| 0.3 | **Global `prefers-reduced-motion: reduce`** block in `styles.scss` neutralizing animations/transitions. | Only real a11y gap found (ARIA/focus/keyboard are strong). Hover lifts + infinite shimmer with no opt-out. |
| 0.4 | **`lib-card` shared component** (spec already `planned` in `shared-components/index.yaml`): `--shadow-sm` base, hover `--shadow-md` + `translateY(-2px)`, `--radius-lg`. Migrate dashboard + exercise cards. | Cards are re-hand-rolled per screen → visual drift; the planned spec exists but was never implemented. |

## Phase 1 — Progress & momentum loop (the Coursera core, highest impact)

| # | Item | Reasoning |
|---|------|-----------|
| 1.1 | **`lib-progress-bar`** (spec planned): 6–8px track `--neutral-color-2`, fill `--primary-color-600`, `radius-full`, `transition: width var(--duration-slow) var(--easing-ease-out)`. | Reusable primitive for dashboard cards, course sidebar header, module headers. Animated width = free "delight" on every value change. |
| 1.2 | **Completion model**: derive per-lesson completion client-side first (exercise `mySubmissionStatus` ∈ SUBMITTED/APPROVED ⇒ done; lessons w/o exercises: mark-visited via localStorage), then move to a backend completion record. | Dashboard progress is hardcoded `0%` (`user-dashboard.component.html`) and the sidebar has no state. A client-side derivation ships value now; flag backend API (`GET /v1/me/progress` or per-syllabus fields) to the `lib4gz` repo. |
| 1.3 | **Sidebar completion UI** in `course-layout`: filled check-circle on done lessons, outline circle otherwise, per-module "2/5" counts; checkmark pops in with ~200ms scale using `--easing-spring`. | The single most satisfying LMS micro-interaction; makes the sidebar a progress map, not just navigation. |
| 1.4 | **Next / Previous lesson buttons** at the bottom of `course-lesson`: secondary "← Previous", primary "Next: {title} →", computed from flattened syllabus order. | Currently the *only* way forward is the sidebar — the linear learn-flow that defines Coursera is absent. Biggest single navigation win. |
| 1.5 | **"Continue learning" resume card** at top of dashboard: last-visited course + lesson (localStorage until backend supports), progress bar, one "Resume" CTA deep-linking to that lesson. | Coursera's dashboard leads with resume; Lib4GZ's dashboard currently answers "what do I have" but not "what do I do now". Also fills the dead right-hand whitespace. |
| 1.6 | **Real % on dashboard course cards** from 1.2. | Replaces the placeholder-feeling "0%" on every card. |

## Phase 2 — Wayfinding & context

| # | Item | Reasoning |
|---|------|-----------|
| 2.1 | **`lib-breadcrumb`** (spec planned) on deep pages, esp. `exercise-attempt` and `exercise-editor`. | The attempt page header currently says just "Exercise" — zero course/lesson context on a full-screen route. |
| 2.2 | **Attempt page context & progress**: replace "Exercise" heading with lesson title + exercise name; show "Question 1 of 2"; add bottom Submit (sticky footer) in addition to top-right. | On long exercises the submit action scrolls away; users orient by content, not by the route they came from. |
| 2.3 | **Per-card action on exercises tab**: each exercise card gets its own "Start" / "Review" button (or the whole card is clickable); remove the single ambiguous "Do Exercise" button below the list. | Rendered UI shows one detached button under multiple cards — unclear what it launches. |
| 2.4 | **Lesson metadata in sidebar**: type icon + count ("Exercise · 2 questions"), extending the existing has-summary icon. | Coursera's item rows set expectations (type + effort) before the click. |
| 2.5 | **Dashboard layout**: connect the course-code search to the header area (or move into an explicit "Join a course" affordance next to the tabs). | Search box currently floats detached top-right; on 1440px the grid leaves a dead right third. |
| 2.6 | **Review Fast-Fill visibility**: gate "⚡ Fast Fill Answer" behind a dev flag or teacher role. | It reads as a debug/cheat tool but is prominent in the student attempt UI. |

## Phase 3 — Visual polish & motion

| # | Item | Reasoning |
|---|------|-----------|
| 3.1 | **Deterministic course-card art**: gradient / tint + initials (or icon) derived from course code hash, replacing the identical pale-mint book placeholder. | Rendered dashboard shows three visually identical cards — nothing scannable distinguishes courses. Coursera uses partner imagery; a code-derived gradient is the zero-asset equivalent. |
| 3.2 | **Skeletons everywhere, spinners nowhere** (screen loads): replace full-screen spinners in `course-layout`, `course-home`, `exercise-attempt`, `manage-layout` with layout-shaped `lib-skeleton` compositions (dashboard already does this). Keep spinners for inline button loading. | Skeletons preserve layout and feel faster; the mixed strategy makes some routes feel slower than others. |
| 3.3 | **Motion pass** using existing duration/easing tokens: animate module accordion expand/collapse (grid-rows trick) + chevron; staggered 30–40ms fade+rise on dashboard card grid; animated progress fill (1.1); checkmark pop (1.3). | The tokens exist and are good; they're just underused. Small, cheap, very visible. |
| 3.4 | **One celebration moment**: module or course completion → animated check + toast (optional small confetti). Rare by design so it stays meaningful. | Coursera reserves celebration for milestones; it's the emotional payoff of the progress loop. |
| 3.5 | **Auth screen finish**: put a real illustration/brand composition in the empty left panel; wire or remove the decorative Google button; reconsider the tagline copy. | The empty rounded rectangle + dead Google button read as unfinished on the first screen every user sees. |
| 3.6 | **Toast upgrades**: `info`/`warning` tones + optional action button ("Submitted — View result"). | Currently success/error only; actions turn notifications into navigation. |

## Phase 4 — Later / needs backend

- **Results & review screen** after exercise submission (score, per-question correctness) — submission currently ends with no payoff; this is where learning happens.
- **Backend progress API**: lesson-completion records, course % in `MeCoursesResponse`, `lastVisitedLessonId` — replaces the localStorage interim from 1.2/1.5.
- Wire the navbar notifications bell (or hide it until real).
- Optional gamification (streaks) — only after the progress loop exists.

## What NOT to copy from Coursera

- Keep the mint identity; don't chase Coursera blue.
- Skip upsell banners / dense enterprise dashboards — "Breathing Room" is already a strength.
- Don't add gamification before progress tracking exists.

## Suggested execution order

0.1 → 0.2 → 0.3 (hours) → 0.4 → 1.1 → 1.2 → 1.3 → 1.4 → 1.6 → 1.5 → 2.x → 3.x

Each phase is independently shippable; Phase 1 is the one that changes how the product feels.
