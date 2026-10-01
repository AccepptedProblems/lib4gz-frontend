import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService, CourseService, ExerciseService, LessonService, ProgressService, SubmissionService } from '../../../services';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import {
  ExerciseResponse,
  QuestionResponse,
  AnswerRequest,
  ExerciseType,
  UserRole,
} from '../../../shared/models';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
  ButtonComponent,
  DialogComponent,
  SideSheetComponent,
  SkeletonComponent,
  TextareaComponent,
} from '../../../shared/components';

type ScreenState = 'loading' | 'loaded' | 'error' | 'no-exercises';

@Component({
  selector: 'app-exercise-attempt',
  imports: [
    BreadcrumbComponent,
    ButtonComponent,
    DialogComponent,
    SideSheetComponent,
    SkeletonComponent,
    TextareaComponent,
  ],
  templateUrl: './exercise-attempt.component.html',
  styleUrl: './exercise-attempt.component.scss',
})
export class ExerciseAttemptComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exerciseService = inject(ExerciseService);
  private readonly lessonService = inject(LessonService);
  private readonly courseService = inject(CourseService);
  private readonly submissionService = inject(SubmissionService);
  private readonly progressService = inject(ProgressService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  // Expose enum
  readonly ExerciseType = ExerciseType;

  // Route params
  courseId = signal('');
  lessonId = signal('');
  lessonPrefix = signal('');

  // State
  screenState = signal<ScreenState>('loading');
  errorMessage = signal('');

  // Data
  exercises = signal<ExerciseResponse[]>([]);
  activeExerciseIndex = signal(0);
  questionsMap = signal<Map<string, QuestionResponse[]>>(new Map());
  answersMap = signal<Map<string, Map<string, string>>>(new Map());
  submissionIds = signal<Map<string, string>>(new Map());

  // Flags
  isDirty = signal(false);
  isSubmitting = signal(false);
  showSubmitDialog = signal(false);
  showCancelDialog = signal(false);
  showFastFillDialog = signal(false);

  // Exercise tab requested via `?exercise=<index>` (per-card action on the exercises tab)
  private requestedExerciseIndex: number | null = null;

  // Fast Fill Answer
  fastFillText = signal('');
  parsedAnswers = signal<string[]>([]);
  private fastFillInput$ = new Subject<string>();

  // Auto-save subject
  private saveSubject = new Subject<string>();

  // Computed
  activeExercise = computed(() => this.exercises()[this.activeExerciseIndex()] ?? null);

  activeQuestions = computed(() =>
    this.questionsMap().get(this.activeExercise()?.id ?? '') ?? []
  );

  activeAnswers = computed(() =>
    this.answersMap().get(this.activeExercise()?.id ?? '') ?? new Map<string, string>()
  );

  totalQuestions = computed(() => {
    let total = 0;
    this.questionsMap().forEach(questions => total += questions.length);
    return total;
  });

  answeredCount = computed(() => {
    let count = 0;
    this.answersMap().forEach(answers => {
      answers.forEach(answer => {
        if (answer && answer.trim().length > 0) count++;
      });
    });
    return count;
  });

  unansweredCount = computed(() => this.totalQuestions() - this.answeredCount());

  unansweredByExercise = computed(() => {
    const result: { exerciseIndex: number; unansweredCount: number }[] = [];
    this.exercises().forEach((exercise, i) => {
      const questions = this.questionsMap().get(exercise.id) ?? [];
      const answers = this.answersMap().get(exercise.id);
      const answeredForExercise = questions.filter(q => {
        const answer = answers?.get(q.id);
        return answer && answer.trim().length > 0;
      }).length;
      const unanswered = questions.length - answeredForExercise;
      if (unanswered > 0) {
        result.push({ exerciseIndex: i + 1, unansweredCount: unanswered });
      }
    });
    return result;
  });

  // Wayfinding context (UX plan 2.1/2.2) — loaded alongside the exercises.
  lessonTitle = signal('');
  courseTitle = signal('');

  headerTitle = computed(() => {
    const lesson = this.lessonTitle();
    if (!lesson) return 'Exercise';
    return this.lessonPrefix() ? `${this.lessonPrefix()} ${lesson}` : lesson;
  });

  breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const prefixParams = this.lessonPrefix() ? { prefix: this.lessonPrefix() } : undefined;
    return [
      { label: 'Dashboard', routerLink: '/' },
      { label: this.courseTitle() || 'Course', routerLink: ['/course', this.courseId()] },
      {
        label: this.lessonTitle() || 'Lesson',
        routerLink: ['/course', this.courseId(), 'lesson', this.lessonId(), 'exercises'],
        queryParams: prefixParams,
      },
      { label: 'Exercise Attempt' },
    ];
  });

  /** Fast Fill is a grading shortcut, not a student feature — teachers/admins only (UX plan 2.6). */
  canFastFill = computed(() => this.authService.hasRole(UserRole.TEACHER, UserRole.ADMIN));

  ngOnInit(): void {
    // Extract route params (paramsInheritanceStrategy: 'always' makes ancestor params available)
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id) this.courseId.set(id);

      const lessonId = params.get('lessonId');
      if (lessonId && lessonId !== this.lessonId()) {
        this.lessonId.set(lessonId);
        this.loadExercises(lessonId);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.lessonPrefix.set(params.get('prefix') ?? '');
      const exercise = params.get('exercise');
      this.requestedExerciseIndex = exercise !== null ? Number(exercise) : null;
    });

    // Auto-save pipeline
    this.saveSubject.pipe(
      debounceTime(2000),
      switchMap(exerciseId => this.saveDraft(exerciseId)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();

    // Fast Fill Answer debounced parsing
    this.fastFillInput$.pipe(
      debounceTime(200),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(text => {
      this.parsedAnswers.set(this.parseAnswers(text));
    });
  }

  switchExerciseTab(index: number): void {
    if (index === this.activeExerciseIndex()) return;
    // Save current exercise if dirty
    if (this.isDirty()) {
      const currentExercise = this.activeExercise();
      if (currentExercise) {
        this.saveDraft(currentExercise.id).subscribe();
      }
    }
    this.activeExerciseIndex.set(index);
  }

  updateAnswer(questionId: string, answer: string): void {
    const exerciseId = this.activeExercise()?.id;
    if (!exerciseId) return;

    const currentMap = new Map(this.answersMap());
    const exerciseAnswers = new Map(currentMap.get(exerciseId) ?? new Map<string, string>());
    exerciseAnswers.set(questionId, answer);
    currentMap.set(exerciseId, exerciseAnswers);
    this.answersMap.set(currentMap);
    this.isDirty.set(true);

    // Trigger auto-save
    this.saveSubject.next(exerciseId);
  }

  onTextInput(event: Event, questionId: string): void {
    const target = event.target as HTMLTextAreaElement;
    this.updateAnswer(questionId, target.value);
  }

  onTextChange(questionId: string, value: string): void {
    this.updateAnswer(questionId, value);
  }

  onRadioSelect(questionId: string, option: string): void {
    this.updateAnswer(questionId, option);
  }

  getAnswer(questionId: string): string {
    return this.activeAnswers().get(questionId) ?? '';
  }

  getOptions(question: QuestionResponse): string[] {
    return (question.meta?.['options'] as string[]) ?? [];
  }

  handleCancel(): void {
    if (this.isDirty()) {
      // Save draft first, then show dialog
      const currentExercise = this.activeExercise();
      if (currentExercise) {
        this.saveDraft(currentExercise.id).subscribe({
          complete: () => this.showCancelDialog.set(true),
          error: () => this.showCancelDialog.set(true),
        });
      } else {
        this.showCancelDialog.set(true);
      }
    } else {
      this.navigateBack();
    }
  }

  confirmCancel(): void {
    this.showCancelDialog.set(false);
    this.navigateBack();
  }

  dismissCancelDialog(): void {
    this.showCancelDialog.set(false);
  }

  // ── Fast Fill Answer ────────────────────────────────────────────

  openFastFill(): void {
    this.fastFillText.set('');
    this.parsedAnswers.set([]);
    this.showFastFillDialog.set(true);
  }

  onFastFillInput(text: string): void {
    this.fastFillText.set(text);
    this.fastFillInput$.next(text);
  }

  confirmFastFill(): void {
    const answers = this.parsedAnswers();
    if (answers.length === 0) return;

    const exercise = this.activeExercise();
    if (!exercise) return;

    const questions = this.activeQuestions();
    const currentMap = new Map(this.answersMap());
    const exerciseAnswers = new Map(currentMap.get(exercise.id) ?? new Map<string, string>());

    for (let i = 0; i < Math.min(answers.length, questions.length); i++) {
      const question = questions[i];
      let answer = answers[i];

      // For MC exercises, match against available options (case-insensitive)
      if (exercise.type === ExerciseType.MULTIPLE_CHOICE) {
        const options = this.getOptions(question);
        const matched = options.find(
          opt => opt.toLowerCase().trim() === answer.toLowerCase().trim()
        );
        if (matched) answer = matched;
      }

      exerciseAnswers.set(question.id, answer);
    }

    currentMap.set(exercise.id, exerciseAnswers);
    this.answersMap.set(currentMap);
    this.isDirty.set(true);
    this.saveSubject.next(exercise.id);
    this.showFastFillDialog.set(false);
  }

  cancelFastFill(): void {
    this.showFastFillDialog.set(false);
  }

  handleSubmit(): void {
    if (this.isDirty()) {
      // Save all drafts first
      this.saveAllDrafts().subscribe({
        next: () => this.showSubmitDialog.set(true),
        error: () => this.showSubmitDialog.set(true),
      });
    } else {
      this.showSubmitDialog.set(true);
    }
  }

  confirmSubmit(): void {
    this.isSubmitting.set(true);
    const submissionIdMap = this.submissionIds();
    const submitCalls: Record<string, ReturnType<SubmissionService['submit']>> = {};

    submissionIdMap.forEach((subId, _exerciseId) => {
      submitCalls[subId] = this.submissionService.submit(subId);
    });

    if (Object.keys(submitCalls).length === 0) {
      this.isSubmitting.set(false);
      this.showSubmitDialog.set(false);
      this.navigateBack();
      return;
    }

    forkJoin(submitCalls).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showSubmitDialog.set(false);
        // Partial progress feeds the sidebar's half-mark; the lesson counts as
        // complete only when every exercise got a submission (UX plan 1.2).
        this.progressService.markExercisesSubmitted(
          this.courseId(),
          this.lessonId(),
          [...submissionIdMap.keys()],
        );
        if (this.exercises().every(ex => submissionIdMap.has(ex.id))) {
          this.progressService.markLessonCompleted(this.courseId(), this.lessonId());
        }
        this.toast.success('Answers submitted');
        this.navigateBack();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.showSubmitDialog.set(false);
        this.toast.error('Failed to submit answers. Please try again.');
      },
    });
  }

  dismissSubmitDialog(): void {
    this.showSubmitDialog.set(false);
  }

  goBack(): void {
    this.navigateBack();
  }

  private navigateBack(): void {
    this.router.navigate(['/course', this.courseId(), 'lesson', this.lessonId(), 'exercises'], {
      queryParams: { prefix: this.lessonPrefix() || undefined },
    });
  }

  /**
   * Single round-trip: each exercise arrives with its questions and the caller's
   * draft submission (if any). Replaces the previous 1 + 2N fan-out.
   */
  /** Best-effort context fetch for the breadcrumb/heading — never blocks the exercises. */
  private loadContext(lessonId: string): void {
    this.lessonService.get(lessonId).pipe(catchError(() => of(null))).subscribe(lesson => {
      if (lesson) this.lessonTitle.set(lesson.title);
    });
    this.courseService.get(this.courseId()).pipe(catchError(() => of(null))).subscribe(course => {
      if (course) this.courseTitle.set(course.title);
    });
  }

  private loadExercises(lessonId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');
    this.loadContext(lessonId);

    this.exerciseService
      .listByLesson(lessonId, { expand: ['questions', 'mySubmission'] })
      .subscribe({
        next: exercises => {
          const sorted = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);
          if (sorted.length === 0) {
            this.screenState.set('no-exercises');
            return;
          }
          this.exercises.set(sorted);
          const requested = this.requestedExerciseIndex;
          this.activeExerciseIndex.set(
            requested !== null && Number.isInteger(requested)
              ? Math.max(0, Math.min(sorted.length - 1, requested))
              : 0,
          );
          this.hydrateFromExpandedExercises(sorted);
          this.screenState.set('loaded');
        },
        error: err => {
          this.errorMessage.set(apiErrorMessage(err, 'Failed to load exercises. Please try again.'));
          this.screenState.set('error');
        },
      });
  }

  /**
   * Splits the composite exercise payload into the three local maps the screen
   * already uses (questionsMap, answersMap, submissionIds). Keeping the same data
   * shapes minimises ripple through the rest of the component.
   */
  private hydrateFromExpandedExercises(exercises: ExerciseResponse[]): void {
    const qMap = new Map<string, QuestionResponse[]>();
    const aMap = new Map<string, Map<string, string>>();
    const sIds = new Map<string, string>();

    exercises.forEach(ex => {
      const questions = (ex.questions ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);
      qMap.set(ex.id, questions);

      const sub = ex.mySubmission ?? null;
      if (sub) {
        sIds.set(ex.id, sub.id);
        if (sub.answers) {
          const answerMap = new Map<string, string>();
          sub.answers.forEach(a => {
            if (a.answer !== null) {
              answerMap.set(a.questionId, a.answer);
            }
          });
          aMap.set(ex.id, answerMap);
        }
      }
    });

    this.questionsMap.set(qMap);
    this.answersMap.set(aMap);
    this.submissionIds.set(sIds);
  }

  private saveDraft(exerciseId: string) {
    const exerciseAnswers = this.answersMap().get(exerciseId);
    const questions = this.questionsMap().get(exerciseId) ?? [];

    const answers: AnswerRequest[] = questions.map(q => ({
      questionId: q.id,
      answer: exerciseAnswers?.get(q.id) ?? null,
    }));

    return this.submissionService.createOrUpdate(exerciseId, { answers }).pipe(
      catchError(() => of(null)),
      switchMap(result => {
        if (result) {
          const ids = new Map(this.submissionIds());
          ids.set(exerciseId, result.id);
          this.submissionIds.set(ids);
          this.isDirty.set(false);
        }
        return of(result);
      }),
    );
  }

  private saveAllDrafts() {
    const exercises = this.exercises();
    const calls: Record<string, ReturnType<typeof this.saveDraft>> = {};

    exercises.forEach(ex => {
      const exerciseAnswers = this.answersMap().get(ex.id);
      if (exerciseAnswers && exerciseAnswers.size > 0) {
        calls[ex.id] = this.saveDraft(ex.id);
      }
    });

    if (Object.keys(calls).length === 0) {
      return of({});
    }

    return forkJoin(calls);
  }

  private parseAnswers(text: string): string[] {
    if (!text.trim()) return [];

    const lines = text.split('\n');
    const result: string[] = [];
    const numberedRegex = /^\s*(\d+)\s*[.)]\s*/;
    let current: string[] = [];

    for (const line of lines) {
      const match = numberedRegex.exec(line);
      if (match) {
        const prev = current.join('\n').trim();
        if (prev) result.push(prev);
        current = [line.replace(numberedRegex, '')];
      } else {
        current.push(line);
      }
    }

    const last = current.join('\n').trim();
    if (last) result.push(last);

    return result;
  }
}
