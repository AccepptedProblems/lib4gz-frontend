import { Component, inject, signal, computed, OnInit, DestroyRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';
import {
  LessonService,
  SummaryService,
  ExerciseService,
  SubmissionService,
  QuestionService,
  EnrollmentService,
} from '../../../services';
import {
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

type TabId = 'summary' | 'exercises' | 'submissions';

@Component({
  selector: 'app-course-lesson',
  imports: [
    ButtonComponent,
    SkeletonComponent,
    SpinnerComponent,
    ChipComponent,
    MatDrawer,
    MatDrawerContainer,
    MatDrawerContent,
  ],
  templateUrl: './course-lesson.component.html',
  styleUrl: './course-lesson.component.scss',
})
export class CourseLessonComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lessonService = inject(LessonService);
  private readonly summaryService = inject(SummaryService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly submissionService = inject(SubmissionService);
  private readonly questionService = inject(QuestionService);
  private readonly enrollmentService = inject(EnrollmentService);

  readonly ExerciseType = ExerciseType;

  courseId = signal('');
  lessonId = signal('');
  lessonPrefix = signal('');
  lesson = signal<LessonResponse | null>(null);
  lessonLoading = signal(true);

  summary = signal<SummaryResponse | null>(null);
  exercises = signal<ExerciseResponse[]>([]);
  summaryLoading = signal(false);
  summaryError = signal(false);

  activeTab = signal<TabId>('summary');
  perExerciseSubmission = signal<Map<string, SubmissionResponse | null>>(new Map());
  exerciseSubmissions = signal<Map<string, SubmissionResponse[]>>(new Map());
  exerciseStatusesLoading = signal(false);
  submissionsLoading = signal(false);
  private exerciseStatusesLoaded = signal(false);
  private submissionsLoaded = signal(false);

  // Teacher check
  isTeacher = signal(false);

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

  hasExercises = computed(() => {
    const lesson = this.lesson();
    return lesson && (lesson.exerciseCount ?? 0) > 0;
  });

  sortedExercises = computed(() =>
    [...this.exercises()].sort((a, b) => a.orderIndex - b.orderIndex)
  );

  ngOnInit(): void {
    // Read courseId from inherited params
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id) this.courseId.set(id);

      const lessonId = params.get('lessonId');
      if (lessonId && lessonId !== this.lessonId()) {
        this.lessonId.set(lessonId);
        this.resetState();
        this.loadLesson(lessonId);
      }
    });

    // Read tab and prefix from query params
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const tab = params.get('tab') as TabId | null;
      if (tab && ['summary', 'exercises', 'submissions'].includes(tab)) {
        this.activeTab.set(tab);
        if (tab === 'exercises' && !this.exerciseStatusesLoaded()) {
          this.loadExerciseStatuses();
        }
        if (tab === 'submissions' && !this.submissionsLoaded()) {
          this.loadExerciseSubmissions();
        }
      }
      const prefix = params.get('prefix');
      if (prefix) this.lessonPrefix.set(prefix);
    });
  }

  switchTab(tab: TabId): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
    if (tab === 'exercises' && !this.exerciseStatusesLoaded()) {
      this.loadExerciseStatuses();
    }
    if (tab === 'submissions' && !this.submissionsLoaded()) {
      this.loadExerciseSubmissions();
    }
  }

  navigateToExercise(): void {
    const lesson = this.lesson();
    if (lesson) {
      const prefix = this.lessonPrefix();
      this.router.navigate(
        ['/course', this.courseId(), 'lesson', lesson.id, 'attempt'],
        { queryParams: prefix ? { prefix } : {} }
      );
    }
  }

  toggleExerciseExpand(exercise: ExerciseResponse): void {
    if (this.expandedExerciseId() === exercise.id) {
      this.expandedExerciseId.set(null);
      this.closeSubmissionDrawer();
      return;
    }

    this.expandedExerciseId.set(exercise.id);
    this.closeSubmissionDrawer();

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

  private resetState(): void {
    this.activeTab.set('summary');
    this.exerciseStatusesLoaded.set(false);
    this.submissionsLoaded.set(false);
    this.perExerciseSubmission.set(new Map());
    this.exerciseSubmissions.set(new Map());
    this.expandedExerciseId.set(null);
    this.exerciseQuestions.set(new Map());
    this.exerciseQuestionsLoading.set(new Set());
    this.closeSubmissionDrawer();
  }

  private loadLesson(lessonId: string): void {
    this.lessonLoading.set(true);
    this.lessonService.get(lessonId).subscribe({
      next: lesson => {
        this.lesson.set(lesson);
        this.lessonLoading.set(false);
        this.loadLessonContent(lesson);
        // Check teacher status
        const courseId = this.courseId();
        if (courseId) {
          this.enrollmentService.getMyEnrollment(courseId).pipe(
            catchError(() => of(null))
          ).subscribe(enrollment => {
            this.isTeacher.set(enrollment?.role === EnrollmentRole.TEACHER);
          });
        }
      },
      error: () => {
        this.lessonLoading.set(false);
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
