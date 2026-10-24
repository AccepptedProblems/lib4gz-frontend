# home (dashboard)

Owns: the dashboard at `/`: the "My Courses" and "Teaching" tabs, joining by code, creating
a course, and the resume card.

## Rules

- One request fills both tabs and their counts.
- A card's destination depends on the active tab, not on the course: Teaching opens the
  manage area, My Courses opens the course.
- The Teaching tab is shown to everyone. Only "Create Course" is gated, by the platform
  role.
- Typing in the code box only filters courses already joined, with no request. A lookup is
  sent only on Enter when no joined course matches exactly, and any failure shows "Course
  not found".
- After applying to a course there is deliberately no navigation into it: the request may
  be pending.
- The resume card takes the newer of the server's last-visited data and this device's
  entry. The local entry is ignored unless its course is in the enrolled list.
- Progress percent uses the server's numbers when `totalLessons > 0`, else the local
  fallback. A course with no gradable lessons shows 0, never 100.
