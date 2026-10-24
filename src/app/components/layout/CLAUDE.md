# layout

Owns: the navbar. `footer/` and `sidebar/` are unused stubs: the app has no footer, and the
real sidebars live in `components/course/course-layout/` and
`components/course-teacher/manage-layout/`.

## Rules

- The navbar is removed and recreated whenever a navbar-hidden route is entered or left
  (see `hiddenRoutes` and `hiddenRoutePatterns` in `src/app/app.component.ts`). Its
  `getMe` refresh therefore runs on every mount. That refresh is how a newly granted role
  reaches the stored user.
- The navbar is 64px high, and that number is repeated as a literal in
  `course-layout.component.scss` and `manage-layout.component.scss`. Change all three
  together.
- The avatar click must call `stopPropagation`, or the `document:click` listener closes the
  menu in the same click.
