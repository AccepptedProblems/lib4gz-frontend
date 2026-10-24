# course (student screens)

Owns: the course shell with its sidebar, the lesson tabs (summary, exercises, submissions),
and the exercise attempt screen.

## Rules

- Child screens get their data by injecting the parent component (`CourseLayoutComponent`,
  `CourseLessonComponent`). They work only as its routed children and make no requests of
  their own for the course, the enrollment or the modules. The layout renders its outlet
  only after it has loaded.
- `exercise-attempt` is routed outside the layout so it has no sidebar. It cannot inject the
  layout and loads what it needs itself.
- The lesson number ("1.2") is positional and travels only as the `prefix` query param.
  Every navigation into a lesson or the attempt must pass it, and tab links keep
  `queryParamsHandling="preserve"`.
- `?exercise=<n>` is an index into the lesson's exercises sorted by `orderIndex`. The
  exercise list and the attempt screen must sort the same way.
- "Teacher" means two things. In these screens it is the enrollment role in this course.
  Fast Fill uses the platform role of the signed-in user.
- Progress counts only lessons with `exerciseCount > 0`, the same denominator as the
  server. A lesson is complete when the server says so or the local store does. Progress is
  hidden for the course's teacher and for locked content, and a teacher's visits and
  completions are not recorded.
- Celebrations fire only when something becomes complete during the session, never on load.
- The attempt's autosave is one stream debounced by 2 seconds with one dirty flag for all
  exercises. Switching tab must save the current exercise first.
- Submit saves drafts first, then submits only the exercises that have a submission.
- A lesson tab skips its request when the lesson payload says there is nothing to load
  (`hasSummary` false, `exerciseCount` 0).

## Gotchas

- The summary is bound with `[innerHTML]` through `LinkifyPipe`, which bypasses Angular's
  sanitizer. Whatever HTML the server returns is rendered.
- The attempt screen reads `question.meta.options` as strings. The exercise editor saves
  them as `{ text, isCorrect }` objects. The two disagree today.
- Load errors on the lesson, the exercises tab and the submissions tab are swallowed and
  show a blank or "No exercises". Only the summary tab shows an error line.
- The layout height is the viewport minus a literal 64px navbar. `course-lesson` centres its
  column with a literal 312px (280 sidebar plus 32 padding).
- A locked course blocks lesson clicks in the sidebar. Nothing in the client blocks a direct
  lesson URL; the server refuses the data.
- Only MULTIPLE_CHOICE and TEXT_ANSWER exercises render an answer input.

## Verify

No screen here has a spec.
