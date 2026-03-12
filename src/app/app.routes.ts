import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  // Auth (no guard)
  { path: 'login', loadComponent: () => import('./components/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./components/auth/register/register.component').then(m => m.RegisterComponent) },

  // Dashboard at root
  {
    path: '',
    loadComponent: () => import('./components/home/user-dashboard/user-dashboard.component').then(m => m.UserDashboardComponent),
    canActivate: [authGuard],
    pathMatch: 'full'
  },

  // Course routes (student)
  {
    path: 'course/:id',
    canActivate: [authGuard],
    children: [
      // Exercise attempt — placed before layout so it renders without sidebar
      {
        path: 'lesson/:lessonId/attempt',
        loadComponent: () => import('./components/course/exercise-attempt/exercise-attempt.component').then(m => m.ExerciseAttemptComponent),
      },
      // Layout with sidebar + router-outlet for lesson content
      {
        path: '',
        loadComponent: () => import('./components/course/course-layout/course-layout.component').then(m => m.CourseLayoutComponent),
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./components/course/course-home/course-home.component').then(m => m.CourseHomeComponent) },
          { path: 'lesson/:lessonId', loadComponent: () => import('./components/course/course-lesson/course-lesson.component').then(m => m.CourseLessonComponent) },
        ]
      },
    ]
  },

  // Course routes (teacher)
  {
    path: 'course/:id/manage',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['teacher'] },
    children: [
      // Exercise editor — placed before layout so it renders without sidebar
      { path: 'exercise/new', loadComponent: () => import('./components/course-teacher/exercise-editor/exercise-editor.component').then(m => m.ExerciseEditorComponent) },
      { path: 'exercise/:exerciseId/edit', loadComponent: () => import('./components/course-teacher/exercise-editor/exercise-editor.component').then(m => m.ExerciseEditorComponent) },
      // Layout with sidebar + router-outlet
      {
        path: '',
        loadComponent: () => import('./components/course-teacher/manage-layout/manage-layout.component').then(m => m.ManageLayoutComponent),
        children: [
          { path: '', redirectTo: 'material', pathMatch: 'full' },
          { path: 'material', loadComponent: () => import('./components/course-teacher/course-material/course-material.component').then(m => m.CourseMaterialComponent) },
          { path: 'material/lesson/:lessonId', loadComponent: () => import('./components/course-teacher/course-management/lesson-detail-management/lesson-detail-management.component').then(m => m.LessonDetailManagementComponent) },
          { path: 'enrollment', loadComponent: () => import('./components/course-teacher/course-management/enrollment-management/enrollment-management.component').then(m => m.EnrollmentManagementComponent) },
          { path: 'submissions', loadComponent: () => import('./components/course-teacher/manage-submissions/manage-submissions.component').then(m => m.ManageSubmissionsComponent) },
        ]
      },
    ]
  },

  // 404
  { path: '**', loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent) }
];
