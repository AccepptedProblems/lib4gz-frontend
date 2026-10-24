# course-teacher (manage screens)

Owns: the teacher's area under `/course/:id/manage`.

Live screens: `manage-layout/`, `course-material/`,
`course-management/lesson-detail-management/`, `course-management/enrollment-management/`,
`exercise-editor/`.

Dead code, not routed or imported anywhere: `course-management/course-management.component.ts`
with its template and stylesheet, and the stubs in `enrollment/` and `enrollment-requests/`.
Editing them changes nothing on screen.

## Rules

- The route's `roleGuard` does nothing. Only the server stops a non-teacher.
- Unlike `components/course/`, the child screens here do not inject the layout. Each loads its own data
  from the inherited `id` param.
- The exercise editor is routed outside the layout and hides the navbar through
  `hiddenRoutePatterns` in `src/app/app.component.ts`.
- Creating an exercise needs `?lessonId=`, set by the lesson detail screen. Without it the
  save stops.
- The editor's save compares `JSON.stringify(meta)` against `originalQuestions`, a shallow
  copy that shares each `meta` object. Always replace `meta`; a change made in place is
  not sent.
- Saving an edit is two calls, the exercise then the question changes, with no rollback.
- Fast Create parses through `shared/utils/fast-create.ts`, shared with Fast Fill in
  `components/course/exercise-attempt/`. The prompt it copies lives in
  `shared/utils/fast-create-prompts.ts` and must describe the format that parser reads.
- A multiple-choice question may have no correct option. The radio toggles off when the
  marked option is clicked again, and nothing pre-marks the first option.
- Screens change their state only after the server succeeds. The one exception is a
  drag-and-drop reorder in `course-material/`: the row moves at once, the server's answer
  then sets the order, and a failure puts the old order back.
- A reorder sends the full ordered id list of the course's modules or of one module's
  lessons. Each module's lessons are their own drop list, not connected to the others; the
  backend cannot move a lesson to another module.
- Rows drag only by their handle. Dragging is off while a title is being edited or any save
  is in flight. Collapsing or deleting a module ends a lesson edit inside it, or the hidden
  edit would keep every handle locked.
- The handles are buttons, so the keyboard can reorder: arrow up or down on a focused handle
  moves the row one place through the same reorder call. They are never `disabled` (that
  would drop focus mid-save); a locked handle ignores the keys.
- A reorder's answer only sorts the rows on screen. Rebuilding them from it would undo an
  add or delete that finished while the save ran.
- The delete dialogs for a module, lesson or exercise read the item with
  `?expand=submissionCount` and keep Delete disabled until that count arrives or fails. Their
  sentences come from `shared/utils/delete-warning.ts`.

## Gotchas

- The sidebar's pending-requests badge is the layout's own copy, loaded once. It does not
  change when the enrollment screen approves or rejects.
- The unsaved-changes warning covers the Cancel button and closing the tab. Breadcrumb
  links and the browser's Back button leave silently.
- Switching an exercise from multiple choice to text wipes every option, after a
  confirmation.
- The course edit form saves the title and description only.
- Load failures are swallowed: course material and enrollment show their "empty" message,
  and lesson detail renders nothing.

## Verify

Two screens have specs. The exercise editor's covers Fast Create alone: the paste, the hint,
the prompt copy, the placeholder, saving with no correct answer, the radio toggle. Course
material's covers reorder (the request, a drop in place, the lock, the rollback, real pointer
drags on the handle and the title, the arrow keys, an add during a save) and the module and
lesson delete dialogs.
