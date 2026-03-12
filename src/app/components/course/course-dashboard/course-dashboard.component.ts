import { Component, inject, signal, computed, OnInit, DestroyRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';
import {
  CourseService,
  ModuleService,
  EnrollmentService,
  LessonService,
  SummaryService,
  ExerciseService,
  SubmissionService,
  QuestionService,
} from '../../../services';
import {
  CourseResponse,
  ModuleResponse,
  EnrollmentResponse,
  LessonResponse,
  SummaryResponse,
  ExerciseResponse,
  SubmissionResponse,
  StudentAnswerResponse,
  QuestionResponse,
  EnrollmentRole,
  EnrollmentStatus,
  ExerciseType,
  SubmissionStatus,
} from '../../../shared/models';

import {
  ButtonComponent,
  SkeletonComponent,
  SpinnerComponent,
  ChipComponent,
} from '../../../shared/components';
import { ChipVariant } from '../../../shared/components/chip/chip.component';

type ScreenState = 'loading' | 'loaded' | 'error';
type TabId = 'summary' | 'exercises' | 'submissions';

interface ModuleWithLessons {
  module: ModuleResponse;
  lessons: LessonResponse[];
  expanded: boolean;
  lessonsLoading: boolean;
}

@Component({
  selector: 'app-course-dashboard',
  imports: [
    ButtonComponent,
    SkeletonComponent,
    SpinnerComponent,
    ChipComponent,
    MatDrawer,
    MatDrawerContainer,
    MatDrawerContent,
  ],
  templateUrl: './course-dashboard.component.html',
  styleUrl: './course-dashboard.component.scss',
})
export class CourseDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseService = inject(CourseService);
  private readonly moduleService = inject(ModuleService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly lessonService = inject(LessonService);
  private readonly summaryService = inject(SummaryService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly submissionService = inject(SubmissionService);
  private readonly questionService = inject(QuestionService);

  // Expose enums for template
  readonly EnrollmentRole = EnrollmentRole;
  readonly ExerciseType = ExerciseType;

  // Core state
  courseId = signal('');
  screenState = signal<ScreenState>('loading');
  errorMessage = signal('');

  // Data
  course = signal<CourseResponse | null>(null);
  modulesWithLessons = signal<ModuleWithLessons[]>([]);
  myEnrollment = signal<EnrollmentResponse | null>(null);

  // Selected lesson state
  selectedLesson = signal<LessonResponse | null>(null);
  selectedLessonPrefix = signal('');
  summary = signal<SummaryResponse | null>(null);
  exercises = signal<ExerciseResponse[]>([]);
  summaryLoading = signal(false);
  summaryError = signal(false);

  // Tab state
  activeTab = signal<TabId>('summary');
  perExerciseSubmission = signal<Map<string, SubmissionResponse | null>>(new Map());
  exerciseSubmissions = signal<Map<string, SubmissionResponse[]>>(new Map());
  exerciseStatusesLoading = signal(false);
  submissionsLoading = signal(false);
  private exerciseStatusesLoaded = signal(false);
  private submissionsLoaded = signal(false);

  // Exercise expand (Submissions tab)
  expandedExerciseId = signal<string | null>(null);
  exerciseQuestions = signal<Map<string, QuestionResponse[]>>(new Map());
  exerciseQuestionsLoading = signal<Set<string>>(new Set());

  // Question answers drawer
  submissionDrawer = viewChild<MatDrawer>('submissionDrawer');
  drawerQuestionId = signal<string | null>(null);
  drawerQuestionContent = signal('');
  drawerExerciseId = signal<string | null>(null);
  drawerSubmissions = signal<SubmissionResponse[]>([]);
  drawerLoading = signal(false);

  // Mobile sidebar
  sidebarOpen = signal(false);

  // Enrollment action
  enrolling = signal(false);

  // Computed
  isTeacher = computed(() => this.myEnrollment()?.role === EnrollmentRole.TEACHER);
  isEnrolled = computed(() => !!this.myEnrollment());
  isActiveEnrollment = computed(() => this.myEnrollment()?.status === EnrollmentStatus.ACTIVE);
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

  hasExercises = computed(() => {
    const lesson = this.selectedLesson();
    return lesson && (lesson.exerciseCount ?? 0) > 0;
  });

  sortedExercises = computed(() =>
    [...this.exercises()].sort((a, b) => a.orderIndex - b.orderIndex)
  );

  ngOnInit(): void {
    const parentRoute = this.route.parent;
    const paramMap = parentRoute?.paramMap ?? this.route.paramMap;

    paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadCourse(id);
      }
    });
  }

  toggleModule(index: number): void {
    const modules = [...this.modulesWithLessons()];
    modules[index] = { ...modules[index], expanded: !modules[index].expanded };

    if (modules[index].expanded && modules[index].lessons.length === 0 && !modules[index].lessonsLoading) {
      modules[index] = { ...modules[index], lessonsLoading: true };
      this.modulesWithLessons.set(modules);
      this.loadLessonsForModule(index, modules[index].module.id);
      return;
    }

    this.modulesWithLessons.set(modules);
  }

  selectLesson(lesson: LessonResponse, moduleIndex?: number, lessonIndex?: number): void {
    if (this.isContentLocked()) return;
    this.selectedLesson.set(lesson);
    if (moduleIndex !== undefined && lessonIndex !== undefined) {
      this.selectedLessonPrefix.set(`${moduleIndex + 1}.${lessonIndex + 1}`);
    }
    this.sidebarOpen.set(false);
    this.activeTab.set('summary');
    this.exerciseStatusesLoaded.set(false);
    this.submissionsLoaded.set(false);
    this.perExerciseSubmission.set(new Map());
    this.exerciseSubmissions.set(new Map());
    this.expandedExerciseId.set(null);
    this.exerciseQuestions.set(new Map());
    this.exerciseQuestionsLoading.set(new Set());
    this.closeSubmissionDrawer();
    this.loadLessonContent(lesson);
  }

  switchTab(tab: TabId): void {
    this.activeTab.set(tab);
    if (tab === 'exercises' && !this.exerciseStatusesLoaded()) {
      this.loadExerciseStatuses();
    }
    if (tab === 'submissions' && !this.submissionsLoaded()) {
      this.loadExerciseSubmissions();
    }
  }

  navigateToExercise(): void {
    const lesson = this.selectedLesson();
    if (lesson) {
      const prefix = this.selectedLessonPrefix();
      this.router.navigate(
        ['/course', this.courseId(), 'lesson', lesson.id, 'attempt'],
        { queryParams: prefix ? { prefix } : {} }
      );
    }
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

  toggleExerciseExpand(exercise: ExerciseResponse): void {
    if (this.expandedExerciseId() === exercise.id) {
      this.expandedExerciseId.set(null);
      this.closeSubmissionDrawer();
      return;
    }

    this.expandedExerciseId.set(exercise.id);
    this.closeSubmissionDrawer();

    // Fetch questions if not cached
    if (!this.exerciseQuestions().has(exercise.id)) {
      const loading = new Set(this.exerciseQuestionsLoading());
      loading.add(exercise.id);
      this.exerciseQuestionsLoading.set(loading);

      this.questionService.listByExercise(exercise.id).subscribe({
        next: questions => {
          const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
          const map = new Map(this.exerciseQuestions());
          map.set(exercise.id, sorted);
          this.exerciseQuestions.set(map);

          const l = new Set(this.exerciseQuestionsLoading());
          l.delete(exercise.id);
          this.exerciseQuestionsLoading.set(l);
        },
        error: () => {
          const map = new Map(this.exerciseQuestions());
          map.set(exercise.id, []);
          this.exerciseQuestions.set(map);

          const l = new Set(this.exerciseQuestionsLoading());
          l.delete(exercise.id);
          this.exerciseQuestionsLoading.set(l);
        },
      });
    }
  }

  openQuestionDrawer(question: QuestionResponse, exercise: ExerciseResponse): void {
    this.drawerQuestionId.set(question.id);
    this.drawerQuestionContent.set(question.content);
    this.drawerExerciseId.set(exercise.id);
    this.drawerLoading.set(true);
    this.drawerSubmissions.set([]);
    this.submissionDrawer()?.open();

    const subs = this.exerciseSubmissions().get(exercise.id) ?? [];
    if (subs.length === 0) {
      this.drawerLoading.set(false);
      return;
    }

    const calls: Record<string, Observable<SubmissionResponse>> = {};
    subs.forEach(sub => {
      calls[sub.id] = this.submissionService.get(sub.id).pipe(
        catchError(() => of(sub))
      );
    });
    forkJoin(calls).subscribe({
      next: results => {
        this.drawerSubmissions.set(Object.values(results));
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerSubmissions.set(subs);
        this.drawerLoading.set(false);
      },
    });
  }

  getAnswerForQuestion(sub: SubmissionResponse): StudentAnswerResponse | null {
    const qId = this.drawerQuestionId();
    if (!qId || !sub.answers) return null;
    return sub.answers.find(a => a.questionId === qId) ?? null;
  }

  closeSubmissionDrawer(): void {
    this.submissionDrawer()?.close();
  }

  onDrawerClosed(): void {
    this.drawerQuestionId.set(null);
    this.drawerQuestionContent.set('');
    this.drawerExerciseId.set(null);
    this.drawerSubmissions.set([]);
  }

  enrollInCourse(): void {
    this.enrolling.set(true);
    this.enrollmentService.enroll(this.courseId()).subscribe({
      next: enrollment => {
        this.myEnrollment.set(enrollment);
        this.enrolling.set(false);
      },
      error: () => {
        this.enrolling.set(false);
      },
    });
  }

  retry(): void {
    this.loadCourse(this.courseId());
  }

  getExerciseTypeLabel(type: ExerciseType): string {
    switch (type) {
      case ExerciseType.MULTIPLE_CHOICE: return 'Multiple Choice';
      case ExerciseType.TEXT_ANSWER: return 'Text Answer';
      case ExerciseType.CODE: return 'Code';
      case ExerciseType.FILE_UPLOAD: return 'File Upload';
      case ExerciseType.PROJECT_LINK: return 'Project Link';
      default: return type;
    }
  }

  getSubmissionStatusLabel(sub: SubmissionResponse | null | undefined): string {
    if (!sub) return '';
    switch (sub.status) {
      case SubmissionStatus.DRAFT: return 'Draft';
      case SubmissionStatus.SUBMITTED: return 'Submitted';
      case SubmissionStatus.APPROVED: return 'Approved';
      case SubmissionStatus.NEEDS_REVISION: return 'Needs Revision';
      default: return '';
    }
  }

  getSubmissionChipVariant(sub: SubmissionResponse | null | undefined): ChipVariant {
    if (!sub) return 'neutral';
    switch (sub.status) {
      case SubmissionStatus.DRAFT: return 'neutral';
      case SubmissionStatus.SUBMITTED: return 'default';
      case SubmissionStatus.APPROVED: return 'success';
      case SubmissionStatus.NEEDS_REVISION: return 'warning';
      default: return 'neutral';
    }
  }

  private loadCourse(courseId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');

    forkJoin({
      course: this.courseService.get(courseId),
      modules: this.moduleService.listByCourse(courseId),
      enrollment: this.enrollmentService.getMyEnrollment(courseId).pipe(
        catchError(() => of(null))
      ),
    }).subscribe({
      next: ({ course, modules, enrollment }) => {
        this.course.set(course);
        this.myEnrollment.set(enrollment);

        const sortedModules = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
        const modulesWithLessons: ModuleWithLessons[] = sortedModules.map((m, i) => ({
          module: m,
          lessons: [],
          expanded: i === 0,
          lessonsLoading: i === 0,
        }));
        this.modulesWithLessons.set(modulesWithLessons);
        this.screenState.set('loaded');

        if (sortedModules.length > 0) {
          this.loadLessonsForModule(0, sortedModules[0].id);
        }
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load course. Please try again.');
        this.screenState.set('error');
      },
    });
  }

  private loadLessonsForModule(moduleIndex: number, moduleId: string): void {
    this.lessonService.listByModule(moduleId).subscribe({
      next: lessons => {
        const sorted = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);
        const modules = [...this.modulesWithLessons()];
        modules[moduleIndex] = {
          ...modules[moduleIndex],
          lessons: sorted,
          lessonsLoading: false,
        };
        this.modulesWithLessons.set(modules);

        if (moduleIndex === 0 && sorted.length > 0 && !this.selectedLesson()) {
          this.selectLesson(sorted[0], 0, 0);
        }
      },
      error: () => {
        const modules = [...this.modulesWithLessons()];
        modules[moduleIndex] = { ...modules[moduleIndex], lessonsLoading: false };
        this.modulesWithLessons.set(modules);
      },
    });
  }

  private loadLessonContent(lesson: LessonResponse): void {
    this.summaryLoading.set(true);
    this.summaryError.set(false);
    this.summary.set(null);
    this.exercises.set([]);

    if (lesson.hasSummary) {
      this.summaryService.get(lesson.id).subscribe({
        next: s => {
          this.summary.set(s);
          this.summaryLoading.set(false);
        },
        error: () => {
          this.summaryLoading.set(false);
          this.summaryError.set(true);
        },
      });
    } else {
      this.summaryLoading.set(false);
    }

    if ((lesson.exerciseCount ?? 0) > 0) {
      this.exerciseService.listByLesson(lesson.id).subscribe({
        next: exs => this.exercises.set(exs),
        error: () => {},
      });
    }
  }

  private loadExerciseStatuses(): void {
    const exs = this.exercises();
    if (exs.length === 0) {
      this.exerciseStatusesLoaded.set(true);
      return;
    }
    this.exerciseStatusesLoading.set(true);
    const calls: Record<string, Observable<SubmissionResponse | null>> = {};
    exs.forEach(ex => {
      calls[ex.id] = this.submissionService.getMySubmission(ex.id).pipe(
        catchError(() => of(null))
      );
    });
    forkJoin(calls).subscribe({
      next: results => {
        const map = new Map<string, SubmissionResponse | null>();
        Object.entries(results).forEach(([id, sub]) => map.set(id, sub));
        this.perExerciseSubmission.set(map);
        this.exerciseStatusesLoading.set(false);
        this.exerciseStatusesLoaded.set(true);
      },
      error: () => {
        this.exerciseStatusesLoading.set(false);
        this.exerciseStatusesLoaded.set(true);
      },
    });
  }

  private loadExerciseSubmissions(): void {
    const exs = this.exercises();
    if (exs.length === 0) {
      this.submissionsLoaded.set(true);
      return;
    }
    this.submissionsLoading.set(true);
    const calls: Record<string, Observable<SubmissionResponse[]>> = {};
    exs.forEach(ex => {
      calls[ex.id] = this.submissionService.listByExercise(ex.id).pipe(
        catchError(() => of([] as SubmissionResponse[]))
      );
    });
    forkJoin(calls).subscribe({
      next: results => {
        const map = new Map<string, SubmissionResponse[]>();
        Object.entries(results).forEach(([id, subs]) => map.set(id, subs as SubmissionResponse[]));
        this.exerciseSubmissions.set(map);
        this.submissionsLoading.set(false);
        this.submissionsLoaded.set(true);
      },
      error: () => {
        this.submissionsLoading.set(false);
        this.submissionsLoaded.set(true);
      },
    });
  }
}
