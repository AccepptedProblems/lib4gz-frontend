# Review Answer — UI Design Draft — Lib4GZ LMS

**Author:** grug (Claude)
**Date:** 2026-08-02
**Scope:** Frontend UI (`lib4gz-fe/`) — teacher per-answer review in the submissions drawer
**Status:** Draft — UI design only, not yet approved. Backend/API changes summarized in §7, detailed in a separate plan.

---

## Executive Summary

### The problem

Teachers can open the submissions drawer (`/course/:id/lesson/:lessonId/submissions` → expand exercise → click question → `lib-side-sheet`) and read every student's answer to a question, but they can do nothing with what they read. The drawer is read-only by spec (`documents/screens/course-dashboard/prd-full.md`, AC-6.7). The backend already stores a per-answer `teacherComment` and `SubmissionService.addComment()` exists in the frontend, but no component calls it.

### The fix in one sentence

Add a **per-answer action bar** (correct / incorrect / partially correct / write review) inside each answer card of the existing drawer, tint the answer card by **judgment**, and render the saved **teacher review** as a visually distinct block below the answer — no new routes, no new screens.

### Core invariants

- Review actions render **only** when `isTeacher()` (per-course `EnrollmentRole.TEACHER`, same gate as the Submissions tab). Server enforces regardless.
- Judgment is **nullable and reversible**. An un-reviewed answer looks exactly like today's answer card — old data renders unchanged.
- The answer card and the review block are visually distinct: the answer is student content (tinted surface), the review is teacher content (sunken surface, labeled).
- Status tints follow the existing badge/chip pairing convention: `--surface-{status}-subtle` background + `--{status}-color-8` text/icon.
- All mutations go through `SubmissionService` and call `bustFreshness()` (existing cache contract).

### Decisions taken

1. **Extend the existing drawer** instead of building a new `/manage` review screen.
   *Rejected:* dedicated screen under `/course/:id/manage`. More routes, duplicate data flow, and the drawer already has the exercise → question → answers drill-down the flow describes.
2. **Partially-correct uses the warning (amber) slot.**
   *Rejected:* a new custom yellow ramp. Warning is the only unused semantic color in the answer-review context, and amber already means "not fully OK" elsewhere (NEEDS_REVISION chip).
3. **Hover-reveal on fine pointers, always-visible on coarse pointers**, via `@media (hover: hover) and (pointer: fine)`. Keyboard users get the bar via `:focus-within`.
   *Rejected:* always-visible everywhere (simplest, zero media queries) — viable fallback if the hover pattern feels fussy in review; noted as open question. This is the first hover-reveal pattern in the app.
4. **Clicking the active judgment button again clears it** (back to un-reviewed). No separate "clear" control.
5. **Review text edits inline** below the answer with `lib-textarea` + Save/Cancel, not in a dialog.
   *Rejected:* dialog — breaks the reading flow when reviewing many answers in sequence.
6. **Define the missing status surface tokens** (`--surface-success-subtle`, `--surface-warning-subtle`, `--surface-error-subtle`, `--surface-sunken`) in `theme/theme-mint.scss`. They are consumed with inline fallbacks all over the app but never actually defined; this feature leans on them, so define them once.

---

## 1. Where the UI lives

One component changes: `src/app/components/course/lesson-submissions/lesson-submissions.component.{ts,html,scss}`.

The insertion point is the existing `@for (sub of drawerSubmissions())` loop — each `.submission-message` card gains judgment tinting, an action bar, a review block, and an inline review editor.

No route, guard, or layout changes.

## 2. Answer card anatomy and states

```
┌─────────────────────────────────────────────────┐
│ Nguyen Van A                       [SUBMITTED]  │ ← header, unchanged
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ The past tense of "go" is "goed" because…   │ │ ← answer surface,
│ │                                             │ │   tinted by judgment
│ │                          [✓] [✕] [◐] [✎]    │ │ ← action bar, bottom-right
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌ TEACHER REVIEW ─────────────────────────────┐ │
│ │ Irregular verb — "went". Review unit 3.     │ │ ← review block, sunken
│ └─────────────────────────────────────────────┘ │   surface, labeled
└─────────────────────────────────────────────────┘
```

### Judgment states

| Judgment | Answer surface | Icon/border accent | Active button |
|---|---|---|---|
| *(none)* | `--surface-sunken` (today's neutral well) | none | none |
| `CORRECT` | `var(--surface-success-subtle, #e8f5e9)` | `var(--success-color-8, #2e7d32)` | check filled |
| `INCORRECT` | `var(--surface-error-subtle, #ffebee)` | `var(--error-color-8, #c62828)` | close filled |
| `PARTIAL` | `var(--surface-warning-subtle, #fff8e1)` | `var(--warning-color-8, #e86722)` | filled |

Tint is background-only — no hard border around the answer (design principle: elevation/tint over borders). A small judgment icon + label ("Correct", "Incorrect", "Partially correct") renders top-right inside the answer surface so the state is legible for color-blind users, not color-only.

### Review block (distinct from answer)

- Sits **below** the answer surface, inside the same `.submission-message` card.
- `background: var(--surface-sunken, #f7f7f7)`, `border-left: 3px solid var(--primary-color-600)` (internal divider — allowed by the border rule), `border-radius: var(--radius-sm)`.
- `TEACHER REVIEW` label in `text-label-small text-secondary`, review text in `text-body-small`.
- The contrast rule: answer = judgment tint (green/red/amber/neutral), review = always neutral sunken + primary accent. The two never look alike.

## 3. Action bar behavior

Markup reuses the app's `.icon-btn` convention (`course-material`, `enrollment-management`):

```html
<div class="answer-actions" role="group" aria-label="Review answer">
  <button class="icon-btn answer-actions__correct"   [class.is-active]="…" aria-pressed="…" title="Mark correct"><span class="material-icons">check</span></button>
  <button class="icon-btn answer-actions__incorrect" … title="Mark incorrect"><span class="material-icons">close</span></button>
  <button class="icon-btn answer-actions__partial"   … title="Mark partially correct"><span class="material-icons">contrast</span></button>
  <button class="icon-btn answer-actions__review"    … title="Write review"><span class="material-icons">rate_review</span></button>
</div>
```

- Position: absolute, bottom-right of the answer surface, on a small `--surface-page` pill with `--shadow-sm` so icons stay readable over tints.
- **Desktop (`hover: hover) and (pointer: fine`)**: bar hidden (`opacity: 0`, `pointer-events: none`), revealed on `.submission-message__answer:hover` and `:focus-within`, `--duration-*` fade.
- **Mobile / touch (everything else)**: bar always visible. No tap-to-reveal state machine — a first tap that only reveals buttons costs every action two taps and needs outside-tap-to-dismiss logic. Buttons use `--icon-btn-size-lg` (44px) hit area on coarse pointers.
- Active judgment button: filled with its status color, `aria-pressed="true"`. Clicking it again clears the judgment.
- While a review request is in flight: bar disabled, no spinner theater — responses are fast, optimistic tint applies immediately and rolls back on error (existing `errorInterceptor` toasts).

## 4. Review editor

Tapping ✎ (or clicking the rendered review block) opens the inline editor in place of the review block:

```
┌ TEACHER REVIEW ─────────────────────────────┐
│ [lib-textarea, autofocus, 2–4 rows]         │
│                        [Cancel]  [Save]     │
└─────────────────────────────────────────────┘
```

- One editor open at a time (`editingAnswerId` signal); opening another closes the first (unsaved text discarded — Cancel semantics, same as drawer close).
- Save disabled when text unchanged. Empty text + Save clears the review.
- Escape = Cancel.

## 5. Colors and tokens

Add to `src/assets/design-system/theme/theme-mint.scss` (`:root`), matching the values the fallbacks already ship:

```scss
--surface-success-subtle: #e8f5e9;
--surface-warning-subtle: #fff8e1;
--surface-error-subtle:   #ffebee;
--surface-sunken:         #f7f7f7;
```

Component SCSS keeps the `var(--token, fallback)` form regardless. No new ramps, no new component styles outside `lesson-submissions.component.scss`.

## 6. Component changes (`LessonSubmissionsComponent`)

New signals / methods (names indicative):

```ts
editingAnswerId = signal<string | null>(null);   // which answer's review editor is open
pendingAnswerId = signal<string | null>(null);   // in-flight mutation guard

setJudgment(answer: StudentAnswerResponse, judgment: AnswerJudgment): void
  // toggles: same value → send null. Calls submissionService.reviewAnswer(),
  // patches the returned SubmissionResponse back into exerciseGroups signal.

openReviewEditor(answer): void
saveReview(answer, text: string): void            // reviewAnswer({ comment })
cancelReview(): void

judgmentClass(answer): string                     // '' | 'is-correct' | 'is-incorrect' | 'is-partial'
```

State update: every mutation returns the full `SubmissionResponse`; replace the matching submission inside the matching `ExerciseSubmissionsGroup` in the `exerciseGroups` signal. No refetch of the whole lesson.

## 7. What the UI needs from the API (summary — detail in backend plan)

- `StudentAnswerResponse` gains `judgment: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | null`. Nullable → old submissions and old clients unaffected.
- One new endpoint: `POST /v1/answers/{answerId}/review` with `{ judgment?: AnswerJudgment | null, comment?: string | null }`, teacher-only (in-service check, same as `addComment`), returns `SubmissionResponse`. Existing `POST /v1/answers/{answerId}/comment` stays untouched for compatibility.
- Frontend model additions: `AnswerJudgment` enum in `shared/models/enums.ts`, `AnswerReviewRequest` in `submission.model.ts`, `SubmissionService.reviewAnswer()` with `bustFreshness()`.

## 8. Accessibility

- Judgment buttons: `aria-pressed`, descriptive `aria-label` including student name ("Mark Nguyen Van A's answer correct").
- Judgment state never color-only: icon + text label inside the tinted surface.
- Hover-reveal bar also reveals on `:focus-within` — full keyboard path.
- 44px touch targets on coarse pointers (`--icon-btn-size-lg`).
- Review editor: `lib-textarea` focus on open, Escape closes.

## 9. Open questions

1. Hover-reveal vs always-visible on desktop — hover matches the request, but always-visible is simpler and consistent with every other action row in the app. Ship hover per request; revisit if it tests poorly.
2. Should setting any judgment nudge `Submission.status` (e.g. all-answers-judged → suggest Approve)? Out of scope for v1; approve/revision buttons stay submission-level and separate.
3. Spec debt: `documents/screens/course-dashboard/prd-full.md` AC-6.7 ("drawer is read-only") must be amended, plus a new US + ACs and `documents/network/` entries, before implementation per `_document-workflow.md`.
