# Look & Feel Review — Rendered UI

> Status: findings · Created: 2026-07-03
> Method: app run locally (`npm run start:dev`) and driven with headless Chromium at 1440×900
> and 390×844, with all `/api` responses mocked client-side (realistic course/lesson/exercise
> data; no calls reached the backend). Screenshots in [`screenshots/`](screenshots/).
> Companion doc: [`ux-improvement-plan.md`](ux-improvement-plan.md) — the actionable plan derived
> from these findings + the Coursera analysis.

## Overall impression

Clean, calm, consistent — the mint navbar, whitespace discipline, and typography give a credible
"real product" base, and the Unified Surface rule is respected everywhere it was checked. But the
app currently reads **sterile and unfinished** rather than minimal: almost no elevation, identical
placeholder imagery, hardcoded zeros, and several dead-end flows. A good design system waiting for
its product moments.

Strengths to keep: sidebar navigation pattern, tab bars, skeleton usage on the dashboard, chip/badge
language, focus rings, mobile drawer behavior.

---

## Per-screen findings

### Login / Register — `screenshots/login.png`, `screenshots/register.png`

| Severity | Finding |
|---|---|
| High | Left illustration panel is an empty pale rectangle — the first screen every user sees looks unfinished. |
| Med | Google button is decorative (no wired OAuth); dead controls erode trust. |
| Med | Disabled-gray Login button is the most visually prominent element on first paint. |
| Low | Tagline ("đẳng cấp"-est writer…) reads as placeholder copy for an LMS. |

### Dashboard — `screenshots/dashboard.png`

| Severity | Finding |
|---|---|
| High | Every course card shows the identical mint book-icon thumbnail — nothing scannable distinguishes courses. |
| High | Every progress bar is hardcoded `0%` (`user-dashboard.component.html`, `aria-valuenow="0"`). |
| High | No "continue where you left off" — the screen answers *what do I have*, not *what do I do now*. |
| Med | Course-code search floats detached top-right; at 1440px the right third of the grid is dead space. |
| — | Strongest screen otherwise: good hierarchy, tab counts, role chips. |

### Course / lesson (Summary tab) — `screenshots/course-summary.png`

| Severity | Finding |
|---|---|
| **Bug** | **Summary content loses all line breaks**: `[innerHTML]="… | linkify"` with no `white-space: pre-line` in `lesson-summary.component.scss` — paragraphs and `- ` bullets collapse into one flat wall of text. This is the core content students read. |
| High | No completion checkmarks in the sidebar; no per-module progress counts. |
| High | No Next/Previous lesson buttons — the sidebar is the *only* way to move through content. |
| Med | Bare teal instructor name under the course description — no label or avatar. |
| — | Sidebar itself is genuinely good: unified white surface, clear active state, numbered modules. |

### Exercises tab — `screenshots/course-exercises.png`

| Severity | Finding |
|---|---|
| Med | Single detached "Do Exercise" button sits *below* all exercise cards — ambiguous which exercise it starts. Cards themselves don't look/act clickable. |
| — | Cards are clean; "Approved" status chip + "Multiple Choice · 2 Questions" metadata work well. |

### Exercise attempt — `screenshots/exercise-attempt.png`

| Severity | Finding |
|---|---|
| High | Header says just "Exercise" — zero course/lesson context on a full-screen route (no breadcrumb). |
| Med | Submit/Cancel exist only top-right and scroll out of view on long exercises; no sticky footer. |
| Med | No per-exercise progress ("Question 1 of 2"). |
| Med | "⚡ Fast Fill Answer" looks like a debug/cheat tool but is prominent in the student UI. |
| — | Centered ~800px form column and question spacing are good. |

### Mobile 390px — `screenshots/course-mobile.png`

| Severity | Finding |
|---|---|
| — | Better than expected: hamburger drawer, readable content, sensible tab bar. |
| Med | The summary flat-paragraph bug hurts most at this width. |

---

## Cross-cutting (from code + rendered UI)

- `--shadow-sm/md/lg` referenced app-wide but **never defined** — every use falls back to a
  per-component inline default, so elevation is inconsistent ("Elevation Over Borders" principle
  unrealized).
- No `prefers-reduced-motion` support anywhere (hover lifts + infinite shimmer with no opt-out) —
  the only significant a11y gap; ARIA/keyboard/focus are otherwise strong.
- Loading strategy is split: skeletons on dashboard/lists, full-screen spinners on
  `course-layout`, `course-home`, `exercise-attempt`, `manage-layout`.
- Planned-but-unbuilt shared components (`lib-card`, `lib-progress-bar`, `lib-breadcrumb`,
  `lib-pagination`, `lib-dropdown-menu`) force per-screen hand-rolling → visual drift.
- Navbar notifications bell is unwired.
