import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CourseService } from '../../../services';
import {
  CourseResponse,
  EnrollmentSummary,
  EnrollmentRole,
  EnrollmentStatus,
  LessonResponse,
  SyllabusModule,
} from '../../../shared/models';
import {
  ButtonComponent,
  SpinnerComponent,
} from '../../../shared/components';

type ScreenState = 'loading' | 'loaded' | 'error';

/**
 * Sidebar-side view of a module with expand/collapse state for the navigation tree.
 * Lessons are eagerly loaded by `GET /courses/{id}/syllabus`.
 */
interface ModuleWithLessons {
  module: SyllabusModule;
  lessons: LessonResponse[];
  expanded: boolean;
}

@Component({
  selector: 'app-course-layout',
  imports: [
    RouterOutlet,
    ButtonComponent,
    SpinnerComponent,
  ],
  templateUrl: './course-layout.component.html',
  styleUrl: './course-layout.component.scss',
})
export class CourseLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseService = inject(CourseService);

  readonly EnrollmentRole = EnrollmentRole;

  courseId = signal('');
  screenState = signal<ScreenState>('loading');
  errorMessage = signal('');

  course = signal<CourseResponse | null>(null);
  modulesWithLessons = signal<ModuleWithLessons[]>([]);

  /**
   * Caller's enrollment, exposed for children (CourseHome, CourseLesson). Reads from
   * `course().myEnrollment` so we have one source of truth — no parallel fetches.
   */
  myEnrollment = computed<EnrollmentSummary | null>(() => this.course()?.myEnrollment ?? null);

  activeLessonId = signal<string | null>(null);
  sidebarOpen = signal(false);

  isTeacher = computed(() => this.myEnrollment()?.role === EnrollmentRole.TEACHER);
  isEnrolled = computed(() => !!this.myEnrollment());
  isContentLocked = computed(() => {
    const enrollment = this.myEnrollment();
    if (!enrollment) return true;
    return enrollment.status !== EnrollmentStatus.ACTIVE;
  });

  enrollmentBadgeLabel = computed(() => {
    const status = this.myEnrollment()?.status;
    switch (status) {
      case EnrollmentStatus.ACTIVE: return 'Enrolled';
      case EnrollmentStatus.PENDING: return 'Pending Approval';
      case EnrollmentStatus.REJECTED: return 'Rejected';
      default: return 'Not Enrolled';
    }
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadSyllabus(id);
      }
    });

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(e => {
      this.extractLessonIdFromUrl(e.urlAfterRedirects);
    });

    this.extractLessonIdFromUrl(this.router.url);
  }

  private extractLessonIdFromUrl(url: string): void {
    const match = url.match(/\/lesson\/([^/?]+)/);
    this.activeLessonId.set(match ? match[1] : null);
  }

  toggleModule(index: number): void {
    this.modulesWithLessons.update(mods => {
      const next = [...mods];
      next[index] = { ...next[index], expanded: !next[index].expanded };
      return next;
    });
  }

  navigateToLesson(lesson: LessonResponse, moduleIndex: number, lessonIndex: number): void {
    if (this.isContentLocked()) return;
    const prefix = `${moduleIndex + 1}.${lessonIndex + 1}`;
    this.sidebarOpen.set(false);
    this.router.navigate(['lesson', lesson.id], {
      relativeTo: this.route,
      queryParams: { prefix },
    });
  }

  navigateToManage(): void {
    this.router.navigate(['/course', this.courseId(), 'manage']);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  retry(): void {
    this.loadSyllabus(this.courseId());
  }

  /**
   * Single round-trip: course + my enrollment + modules + all lessons.
   * Replaces the previous 4-call `forkJoin({course, modules, enrollment})` + the
   * lazy-loaded `lessons[0]` follow-up.
   */
  private loadSyllabus(courseId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');

    this.courseService.getSyllabus(courseId).subscribe({
      next: ({ course, modules }) => {
        this.course.set(course);
        this.modulesWithLessons.set(
          modules.map((module, i) => ({
            module,
            lessons: module.lessons,
            expanded: i === 0,
          }))
        );
        this.screenState.set('loaded');
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load course. Please try again.');
        this.screenState.set('error');
      },
    });
  }
}
