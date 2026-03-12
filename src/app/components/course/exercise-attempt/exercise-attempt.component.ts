import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExerciseService, QuestionService, SubmissionService } from '../../../services';
import {
  ExerciseResponse,
  QuestionResponse,
  SubmissionResponse,
  AnswerRequest,
  ExerciseType,
} from '../../../shared/models';
import {
  ButtonComponent,
  SpinnerComponent,
  DialogComponent,
  TextareaComponent,
} from '../../../shared/components';

type ScreenState = 'loading' | 'loaded' | 'error' | 'no-exercises';

@Component({
  selector: 'app-exercise-attempt',
  imports: [
    ButtonComponent,
    SpinnerComponent,
    DialogComponent,
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
  private readonly questionService = inject(QuestionService);
  private readonly submissionService = inject(SubmissionService);

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

  headerTitle = computed(() =>
    this.lessonPrefix() ? 'Exercise ' + this.lessonPrefix() : 'Exercise'
  );

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
        this.navigateBack();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.showSubmitDialog.set(false);
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
    this.router.navigate(['/course', this.courseId(), 'lesson', this.lessonId()], {
      queryParams: { tab: 'exercises', prefix: this.lessonPrefix() || undefined },
    });
  }

  private loadExercises(lessonId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');

    this.exerciseService.listByLesson(lessonId).subscribe({
      next: exercises => {
        const sorted = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);
        if (sorted.length === 0) {
          this.screenState.set('no-exercises');
          return;
        }
        this.exercises.set(sorted);
        this.activeExerciseIndex.set(0);
        this.loadQuestionsAndSubmissions(sorted);
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load exercises. Please try again.');
        this.screenState.set('error');
      },
    });
  }

  private loadQuestionsAndSubmissions(exercises: ExerciseResponse[]): void {
    const questionCalls: Record<string, ReturnType<QuestionService['listByExercise']>> = {};
    const submissionCalls: Record<string, Observable<SubmissionResponse | null>> = {};

    exercises.forEach(ex => {
      questionCalls[ex.id] = this.questionService.listByExercise(ex.id);
      submissionCalls[ex.id] = this.submissionService.getMySubmission(ex.id).pipe(
        catchError(() => of(null))
      );
    });

    forkJoin({
      questions: forkJoin(questionCalls),
      submissions: forkJoin(submissionCalls),
    }).subscribe({
      next: ({ questions, submissions }) => {
        // Populate questionsMap
        const qMap = new Map<string, QuestionResponse[]>();
        Object.entries(questions).forEach(([exId, qs]) => {
          const sorted = [...(qs as QuestionResponse[])].sort((a, b) => a.orderIndex - b.orderIndex);
          qMap.set(exId, sorted);
        });
        this.questionsMap.set(qMap);

        // Populate answersMap and submissionIds from existing submissions
        const aMap = new Map<string, Map<string, string>>();
        const sIds = new Map<string, string>();

        Object.entries(submissions).forEach(([exId, sub]) => {
          const typedSub = sub as SubmissionResponse | null;
          if (typedSub) {
            sIds.set(exId, typedSub.id);
            // Populate answers from any existing submission so learners
            // always see their previous answers when re-attempting
            if (typedSub.answers) {
              const answerMap = new Map<string, string>();
              typedSub.answers.forEach(a => {
                if (a.answer !== null) {
                  answerMap.set(a.questionId, a.answer);
                }
              });
              aMap.set(exId, answerMap);
            }
          }
        });
        this.answersMap.set(aMap);
        this.submissionIds.set(sIds);
        this.screenState.set('loaded');
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load questions. Please try again.');
        this.screenState.set('error');
      },
    });
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
