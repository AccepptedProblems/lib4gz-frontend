import { Component, inject, signal, computed, effect, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CourseService, ProgressService } from '../../../services';
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
  ProgressBarComponent,
  SkeletonComponent,
} from '../../../shared/components';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { apiErrorMessage } from '../../../shared/utils/api-error';

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
    ProgressBarComponent,
    SkeletonComponent,
  ],
  templateUrl: './course-layout.component.html',
  styleUrl: './course-layout.component.scss',
})
export class CourseLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseService = inject(CourseService);
  private readonly progressService = inject(ProgressService);
  private readonly toast = inject(ToastService);

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

  /**
   * Lesson ids the caller has completed: the syllabus payload's server-derived
   * `completed` flags (submission truth, cross-device) unioned with the local
   * optimistic store, so a submission made this session checks off instantly
   * before any refetch corroborates it.
   */
  completedLessonIds = computed<Set<string>>(() => {
    const ids = new Set<string>();
    for (const mwl of this.modulesWithLessons()) {
      for (const lesson of mwl.lessons) {
        if (lesson.completed) ids.add(lesson.id);
      }
    }
    const progress = this.progressService.progressByCourse()[this.courseId()];
    for (const id of progress?.completedLessonIds ?? []) ids.add(id);
    return ids;
  });

  /**
   * Progress counts only exercise-bearing ("gradable") lessons — same
   * denominator the server uses for CourseResponse.progress, so the sidebar
   * header, module counters, and dashboard percentages all agree.
   */
  totalLessonCount = computed(() =>
    this.modulesWithLessons().reduce((sum, mwl) => sum + this.gradableLessons(mwl).length, 0)
  );

  completedLessonCount = computed(() => {
    const completed = this.completedLessonIds();
    return this.modulesWithLessons().reduce(
      (sum, mwl) => sum + this.gradableLessons(mwl).filter(l => completed.has(l.id)).length,
      0,
    );
  });

  courseProgressPercent = computed(() => {
    const total = this.totalLessonCount();
    if (total === 0) return 0;
    return Math.round((this.completedLessonCount() / total) * 100);
  });

  /** Progress UI is a learner concern — hide it for the course's teacher. */
  showProgress = computed(() => this.isEnrolled() && !this.isTeacher() && !this.isContentLocked());

  enrollmentBadgeLabel = computed(() => {
    const status = this.myEnrollment()?.status;
    switch (status) {
      case EnrollmentStatus.ACTIVE: return 'Enrolled';
      case EnrollmentStatus.PENDING: return 'Pending Approval';
      case EnrollmentStatus.REJECTED: return 'Rejected';
      default: return 'Not Enrolled';
    }
  });

  /** Full-screen check animation for the course-completion moment (UX plan 3.4). */
  celebrating = signal(false);

  private previousModuleCompletion = new Map<string, boolean>();
  private previousCourseComplete: boolean | null = null;

  constructor() {
    // Celebration is reserved for milestones: fires only when a module/course
    // *transitions* to complete during this session, never on load.
    effect(() => {
      const mods = this.modulesWithLessons();
      const completed = this.completedLessonIds();
      if (mods.length === 0) return;

      const courseComplete =
        this.totalLessonCount() > 0 && this.completedLessonCount() === this.totalLessonCount();

      if (this.showProgress()) {
        for (const mwl of mods) {
          const gradable = this.gradableLessons(mwl);
          const done = gradable.length > 0 && gradable.every(l => completed.has(l.id));
          const prev = this.previousModuleCompletion.get(mwl.module.id);
          if (prev === false && done && !courseComplete) {
            this.toast.success(`Module "${mwl.module.title}" completed!`);
          }
          this.previousModuleCompletion.set(mwl.module.id, done);
        }

        if (this.previousCourseComplete === false && courseComplete) {
          this.toast.success(`Congratulations — you completed "${this.course()?.title}"!`);
          this.celebrating.set(true);
          setTimeout(() => this.celebrating.set(false), 2600);
        }
      }
      this.previousCourseComplete = courseComplete;
    });
  }

  gradableLessons(mwl: ModuleWithLessons): LessonResponse[] {
    return mwl.lessons.filter(l => (l.exerciseCount ?? 0) > 0);
  }

  moduleGradableCount(mwl: ModuleWithLessons): number {
    return this.gradableLessons(mwl).length;
  }

  moduleCompletedCount(mwl: ModuleWithLessons): number {
    const completed = this.completedLessonIds();
    return this.gradableLessons(mwl).filter(l => completed.has(l.id)).length;
  }

  isLessonCompleted(lessonId: string): boolean {
    return this.completedLessonIds().has(lessonId);
  }

  /**
   * Sidebar marker state: 'full' when every exercise in the lesson is
   * submitted, 'half' when some are, null when none are — or when the lesson
   * has no exercises at all (nothing gradable, so no mark).
   * Server counts (`completedExerciseCount`) and this session's optimistic
   * store are merged so a just-made submission shows without a refetch.
   */
  lessonMark(lesson: LessonResponse): 'full' | 'half' | null {
    const total = lesson.exerciseCount ?? 0;
    if (total === 0) return null;
    if (this.completedLessonIds().has(lesson.id)) return 'full';
    const done = Math.max(
      lesson.completedExerciseCount ?? 0,
      this.progressService.submittedExerciseCount(this.courseId(), lesson.id),
    );
    if (done >= total) return 'full';
    return done > 0 ? 'half' : null;
  }

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
        this.progressService.setTotalLessons(
          courseId,
          modules.reduce((sum, m) => sum + m.lessons.length, 0),
        );
        this.screenState.set('loaded');
      },
      error: err => {
        this.errorMessage.set(apiErrorMessage(err, 'Failed to load course. Please try again.'));
        this.screenState.set('error');
      },
    });
  }
}
