import {
  Component, inject, signal, computed, OnInit, DestroyRef, HostListener,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Subject, debounceTime } from 'rxjs';

import { ExerciseService, QuestionService } from '../../../services';
import { ToastService } from '../../../shared/components/toast/toast.component';
import {
  ExerciseResponse, QuestionResponse,
  ExerciseType, QuestionAction
} from '../../../shared/models';
import {
  ButtonComponent, DialogComponent,
  SkeletonComponent, TextareaComponent,
} from '../../../shared/components';

// ── Local interfaces ──────────────────────────────────────────────

export interface AnswerOption {
  text: string;
  isCorrect: boolean;
}

export interface EditorQuestion {
  id: string | null;
  content: string;
  orderIndex: number;
  meta: Record<string, any>;
  isNew: boolean;
  isEditing: boolean;
}

// ── Constants ────────────────────────────────────────────────────

/** Default answer options for a new MULTIPLE_CHOICE question. */
const DEFAULT_MC_OPTIONS: AnswerOption[] = [
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
];

@Component({
  selector: 'app-exercise-editor',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    DialogComponent,
    SkeletonComponent,
    TextareaComponent,
  ],
  templateUrl: './exercise-editor.component.html',
  styleUrl: './exercise-editor.component.scss'
})
export class ExerciseEditorComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exerciseService = inject(ExerciseService);
  private readonly questionService = inject(QuestionService);
  private readonly toast = inject(ToastService);

  // ── Route params ────────────────────────────────────────────────
  courseId = signal<string>('');
  exerciseId = signal<string | null>(null);
  lessonId = signal<string | null>(null);
  isEditMode = computed(() => !!this.exerciseId());

  // ── Screen state ────────────────────────────────────────────────
  screenState = signal<'loading' | 'loaded' | 'error'>('loaded');

  // ── Form state ──────────────────────────────────────────────────
  exerciseTitle = signal<string>('');
  exerciseType = signal<ExerciseType>(ExerciseType.TEXT_ANSWER);
  questions = signal<EditorQuestion[]>([]);
  originalQuestions = signal<EditorQuestion[]>([]);
  editingIndex = signal<number | null>(null);

  // ── Default/placeholder answers (exercise-level) ───────────────
  defaultOptions = signal<AnswerOption[]>(
    DEFAULT_MC_OPTIONS.map(o => ({ ...o }))
  );

  // ── Temp question edit state ────────────────────────────────────
  tempContent = signal<string>('');
  tempOptions = signal<AnswerOption[]>([]);

  // ── Save state ──────────────────────────────────────────────────
  isSaving = signal<boolean>(false);

  // ── Validation errors ───────────────────────────────────────────
  titleError = signal<string | null>(null);
  questionsError = signal<string | null>(null);
  questionErrors = signal<Map<number, string>>(new Map());
  questionOptionErrors = signal<Map<number, string>>(new Map());

  // ── Dialogs ─────────────────────────────────────────────────────
  showFastCreate = signal<boolean>(false);
  showUnsavedDialog = signal<boolean>(false);
  showTypeChangeDialog = signal<boolean>(false);
  pendingTypeChange = signal<ExerciseType | null>(null);

  // ── Fast Create ─────────────────────────────────────────────────
  fastCreateText = signal<string>('');
  parsedQuestions = signal<string[]>([]);
  private fastCreateInput$ = new Subject<string>();

  // ── Dirty tracking ──────────────────────────────────────────────
  private savedSnapshot = signal<string>('');
  isDirty = computed(() => {
    return this.currentSnapshot() !== this.savedSnapshot();
  });

  private currentSnapshot = computed(() => {
    return JSON.stringify({
      title: this.exerciseTitle(),
      type: this.exerciseType(),
      questions: this.questions().map(q => ({
        id: q.id,
        content: q.content,
        meta: q.meta,
      })),
    });
  });

  // ── Navigation guard ────────────────────────────────────────────
  private pendingNavigation: (() => void) | null = null;

  questionCount = computed(() => this.questions().length);

  // ── Exercise type options ───────────────────────────────────────
  readonly typeOptions = [
    { value: ExerciseType.TEXT_ANSWER, label: 'Text Answer' },
    { value: ExerciseType.MULTIPLE_CHOICE, label: 'Multiple Choice' },
  ];

  ExerciseType = ExerciseType;

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  ngOnInit(): void {
    // Extract route params (paramsInheritanceStrategy: 'always' makes ancestor params available)
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (id) this.courseId.set(id);
        const exerciseId = params.get('exerciseId');
        if (exerciseId) this.exerciseId.set(exerciseId);
      });

    // Get lessonId from query params
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        if (params['lessonId']) {
          this.lessonId.set(params['lessonId']);
        }
      });

    // Fast create debounce
    this.fastCreateInput$
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe(text => {
        this.parsedQuestions.set(this.parseQuestions(text));
      });

    // Load data if edit mode
    if (this.exerciseId()) {
      this.loadExercise();
    } else {
      this.takeSnapshot();
    }
  }

  // ── Data loading ────────────────────────────────────────────────

  private loadExercise(): void {
    const id = this.exerciseId()!;
    this.screenState.set('loading');

    forkJoin({
      exercise: this.exerciseService.get(id),
      questions: this.questionService.listByExercise(id),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exercise, questions }) => {
          this.exerciseTitle.set(exercise.title);
          this.exerciseType.set(exercise.type);
          this.lessonId.set(exercise.lessonId);
          const mapped = questions
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((q, i) => this.mapQuestionResponse(q, i));
          this.questions.set(mapped);
          this.originalQuestions.set(mapped.map(q => ({ ...q })));
          this.screenState.set('loaded');
          this.takeSnapshot();
        },
        error: () => {
          this.screenState.set('error');
          this.toast.error('Failed to load exercise');
        },
      });
  }

  private mapQuestionResponse(q: QuestionResponse, index: number): EditorQuestion {
    return {
      id: q.id,
      content: q.content,
      orderIndex: index,
      meta: q.meta ?? {},
      isNew: false,
      isEditing: false,
    };
  }

  private takeSnapshot(): void {
    this.savedSnapshot.set(this.currentSnapshot());
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /** Build initial meta for a question based on the current exercise type. */
  private buildDefaultMeta(): Record<string, any> {
    return this.exerciseType() === ExerciseType.MULTIPLE_CHOICE
      ? { options: this.defaultOptions().map(o => ({ ...o })) }
      : {};
  }

  /** Remove an error entry from a Map<number, string> signal by key. */
  private clearMapEntry(
    mapSignal: typeof this.questionErrors,
    key: number,
  ): void {
    mapSignal.update(m => { const n = new Map(m); n.delete(key); return n; });
  }

  onTitleInput(value: string): void {
    this.exerciseTitle.set(value);
    if (value.trim()) {
      this.titleError.set(null);
    }
  }

  getOptions(q: EditorQuestion): AnswerOption[] {
    return q.meta?.['options'] || [];
  }

  // ── Exercise type change ────────────────────────────────────────

  onTypeChange(newType: ExerciseType): void {
    const currentType = this.exerciseType();
    if (newType === currentType) return;

    // If switching away from MC and there are questions with options, confirm
    const hasOptions = this.questions().some(
      q => q.meta?.['options']?.length > 0
    );

    if (currentType === ExerciseType.MULTIPLE_CHOICE && hasOptions) {
      this.pendingTypeChange.set(newType);
      this.showTypeChangeDialog.set(true);
    } else {
      this.applyTypeChange(newType);
    }
  }

  confirmTypeChange(): void {
    const newType = this.pendingTypeChange();
    if (newType) {
      this.applyTypeChange(newType);
    }
    this.showTypeChangeDialog.set(false);
    this.pendingTypeChange.set(null);
  }

  cancelTypeChange(): void {
    this.showTypeChangeDialog.set(false);
    this.pendingTypeChange.set(null);
  }

  private applyTypeChange(newType: ExerciseType): void {
    this.exerciseType.set(newType);
    // Clear answer options from all questions
    if (newType === ExerciseType.TEXT_ANSWER) {
      this.questions.update(qs =>
        qs.map(q => ({ ...q, meta: {} }))
      );
    } else if (newType === ExerciseType.MULTIPLE_CHOICE) {
      this.questions.update(qs =>
        qs.map(q => ({
          ...q,
          meta: { options: DEFAULT_MC_OPTIONS.map(o => ({ ...o })) },
        }))
      );
    }
    // If currently editing, update temp options
    if (this.editingIndex() !== null) {
      const idx = this.editingIndex()!;
      const q = this.questions()[idx];
      this.tempOptions.set(q.meta?.['options'] ? [...q.meta['options']] : []);
    }
  }

  // ── Question CRUD ───────────────────────────────────────────────

  addQuestion(): void {
    this.saveOrDiscardCurrentEdit();

    const newQ: EditorQuestion = {
      id: null,
      content: '',
      orderIndex: this.questions().length,
      meta: this.buildDefaultMeta(),
      isNew: true,
      isEditing: true,
    };

    this.questions.update(qs => [...qs, newQ]);
    const idx = this.questions().length - 1;
    this.editingIndex.set(idx);
    this.tempContent.set('');
    this.tempOptions.set(
      newQ.meta?.['options'] ? newQ.meta['options'].map((o: AnswerOption) => ({ ...o })) : []
    );
  }

  editQuestion(index: number): void {
    if (this.editingIndex() === index) return;
    this.saveOrDiscardCurrentEdit();

    const q = this.questions()[index];
    this.editingIndex.set(index);
    this.tempContent.set(q.content);
    this.tempOptions.set(
      q.meta?.['options'] ? q.meta['options'].map((o: AnswerOption) => ({ ...o })) : []
    );
    this.questions.update(qs =>
      qs.map((item, i) => ({ ...item, isEditing: i === index }))
    );
  }

  saveQuestion(): void {
    const idx = this.editingIndex();
    if (idx === null) return;

    // Validate
    const content = this.tempContent().trim();
    if (!content) {
      this.questionErrors.update(m => {
        const next = new Map(m);
        next.set(idx, 'Question text is required');
        return next;
      });
      return;
    }

    if (this.exerciseType() === ExerciseType.MULTIPLE_CHOICE) {
      const options = this.tempOptions();
      const filledOptions = options.filter(o => o.text.trim());
      if (filledOptions.length < 2) {
        this.questionOptionErrors.update(m => {
          const next = new Map(m);
          next.set(idx, 'At least 2 answer options are required');
          return next;
        });
        return;
      }
      const emptyOption = options.find(o => !o.text.trim());
      if (emptyOption) {
        this.questionOptionErrors.update(m => {
          const next = new Map(m);
          next.set(idx, 'All answer options must have text');
          return next;
        });
        return;
      }
      const hasCorrect = options.some(o => o.isCorrect);
      if (!hasCorrect) {
        this.questionOptionErrors.update(m => {
          const next = new Map(m);
          next.set(idx, 'Select a correct answer');
          return next;
        });
        return;
      }
    }

    // Clear errors
    this.clearMapEntry(this.questionErrors, idx);
    this.clearMapEntry(this.questionOptionErrors, idx);

    // Apply changes
    this.questions.update(qs =>
      qs.map((q, i) => {
        if (i !== idx) return q;
        return {
          ...q,
          content,
          meta: this.exerciseType() === ExerciseType.MULTIPLE_CHOICE
            ? { options: this.tempOptions().map(o => ({ ...o })) }
            : {},
          isEditing: false,
          isNew: false,
        };
      })
    );
    this.editingIndex.set(null);
  }

  cancelQuestionEdit(): void {
    const idx = this.editingIndex();
    if (idx === null) return;

    const q = this.questions()[idx];

    // If new and no saved content, remove entirely
    if (q.isNew && !q.content) {
      this.questions.update(qs => qs.filter((_, i) => i !== idx));
    } else {
      this.questions.update(qs =>
        qs.map((item, i) => (i === idx ? { ...item, isEditing: false } : item))
      );
    }

    this.editingIndex.set(null);
    this.clearMapEntry(this.questionErrors, idx);
    this.clearMapEntry(this.questionOptionErrors, idx);
  }

  deleteQuestion(index: number): void {
    if (this.editingIndex() === index) {
      this.editingIndex.set(null);
    } else if (this.editingIndex() !== null && this.editingIndex()! > index) {
      this.editingIndex.update(i => i !== null ? i - 1 : null);
    }

    this.questions.update(qs =>
      qs.filter((_, i) => i !== index).map((q, i) => ({ ...q, orderIndex: i }))
    );
  }

  private saveOrDiscardCurrentEdit(): void {
    const idx = this.editingIndex();
    if (idx === null) return;

    const q = this.questions()[idx];
    const content = this.tempContent().trim();

    if (content) {
      // Auto-save if there's content
      this.questions.update(qs =>
        qs.map((item, i) => {
          if (i !== idx) return item;
          return {
            ...item,
            content,
            meta: this.exerciseType() === ExerciseType.MULTIPLE_CHOICE
              ? { options: this.tempOptions().map(o => ({ ...o })) }
              : {},
            isEditing: false,
            isNew: false,
          };
        })
      );
    } else if (q.isNew) {
      // Remove empty new question
      this.questions.update(qs => qs.filter((_, i) => i !== idx));
    } else {
      // Revert to previous state
      this.questions.update(qs =>
        qs.map((item, i) => (i === idx ? { ...item, isEditing: false } : item))
      );
    }

    this.editingIndex.set(null);
  }

  // ── Answer option editing ───────────────────────────────────────

  updateOptionText(optionIndex: number, text: string): void {
    this.tempOptions.update(opts =>
      opts.map((o, i) => (i === optionIndex ? { ...o, text } : o))
    );
  }

  setCorrectOption(optionIndex: number): void {
    this.tempOptions.update(opts =>
      opts.map((o, i) => ({ ...o, isCorrect: i === optionIndex }))
    );
  }

  addOption(): void {
    if (this.tempOptions().length >= 6) return;
    this.tempOptions.update(opts => [...opts, { text: '', isCorrect: false }]);
  }

  removeOption(optionIndex: number): void {
    if (this.tempOptions().length <= 2) return;
    const wasCorrect = this.tempOptions()[optionIndex].isCorrect;
    this.tempOptions.update(opts => opts.filter((_, i) => i !== optionIndex));
    // If removed option was correct, mark the first one as correct
    if (wasCorrect) {
      this.tempOptions.update(opts =>
        opts.map((o, i) => ({ ...o, isCorrect: i === 0 }))
      );
    }
  }

  // ── Default answer options (exercise-level placeholders) ────────

  updateDefaultOptionText(optionIndex: number, text: string): void {
    this.defaultOptions.update(opts =>
      opts.map((o, i) => (i === optionIndex ? { ...o, text } : o))
    );
  }

  setDefaultCorrectOption(optionIndex: number): void {
    this.defaultOptions.update(opts =>
      opts.map((o, i) => ({ ...o, isCorrect: i === optionIndex }))
    );
  }

  addDefaultOption(): void {
    if (this.defaultOptions().length >= 6) return;
    this.defaultOptions.update(opts => [...opts, { text: '', isCorrect: false }]);
  }

  removeDefaultOption(optionIndex: number): void {
    if (this.defaultOptions().length <= 2) return;
    const wasCorrect = this.defaultOptions()[optionIndex].isCorrect;
    this.defaultOptions.update(opts => opts.filter((_, i) => i !== optionIndex));
    if (wasCorrect) {
      this.defaultOptions.update(opts =>
        opts.map((o, i) => ({ ...o, isCorrect: i === 0 }))
      );
    }
  }

  // ── Fast Create ─────────────────────────────────────────────────

  openFastCreate(): void {
    this.fastCreateText.set('');
    this.parsedQuestions.set([]);
    this.showFastCreate.set(true);
  }

  onFastCreateInput(text: string): void {
    this.fastCreateText.set(text);
    this.fastCreateInput$.next(text);
  }

  confirmFastCreate(): void {
    const parsed = this.parsedQuestions();
    if (parsed.length === 0) return;

    this.saveOrDiscardCurrentEdit();

    const startIndex = this.questions().length;
    const newQuestions: EditorQuestion[] = parsed.map((text, i) => ({
      id: null,
      content: text,
      orderIndex: startIndex + i,
      meta: this.buildDefaultMeta(),
      isNew: true,
      isEditing: false,
    }));

    this.questions.update(qs => [...qs, ...newQuestions]);
    this.showFastCreate.set(false);
  }

  cancelFastCreate(): void {
    this.showFastCreate.set(false);
  }

  private parseQuestions(text: string): string[] {
    if (!text.trim()) return [];

    const lines = text.split('\n');
    const result: string[] = [];
    const numberedRegex = /^\s*(\d+)\s*[.)]\s*/;
    let current: string[] = [];

    for (const line of lines) {
      const match = numberedRegex.exec(line);
      if (match) {
        // Flush previous question
        const prev = current.join('\n').trim();
        if (prev) result.push(prev);
        // Start new question with the remainder after the number prefix
        current = [line.slice(match[0].length)];
      } else {
        // Continuation line — append to current question
        current.push(line);
      }
    }

    // Flush last question
    const last = current.join('\n').trim();
    if (last) result.push(last);

    return result;
  }

  // ── Validation ──────────────────────────────────────────────────

  private validate(): boolean {
    let valid = true;

    // Title
    if (!this.exerciseTitle().trim()) {
      this.titleError.set('Title is required');
      valid = false;
    } else {
      this.titleError.set(null);
    }

    // At least 1 question
    if (this.questions().length === 0) {
      this.questionsError.set('At least one question is required');
      valid = false;
    } else {
      this.questionsError.set(null);
    }

    // Each question
    const qErrors = new Map<number, string>();
    const qOptErrors = new Map<number, string>();

    this.questions().forEach((q, i) => {
      if (!q.content.trim()) {
        qErrors.set(i, `Question ${i + 1}: text is required`);
        valid = false;
      }
      if (this.exerciseType() === ExerciseType.MULTIPLE_CHOICE) {
        const options: AnswerOption[] = q.meta?.['options'] || [];
        if (options.length < 2) {
          qOptErrors.set(i, `Question ${i + 1}: at least 2 answer options required`);
          valid = false;
        } else {
          const emptyOpt = options.find(o => !o.text.trim());
          if (emptyOpt) {
            qOptErrors.set(i, `Question ${i + 1}: all answer options must have text`);
            valid = false;
          }
          if (!options.some(o => o.isCorrect)) {
            qOptErrors.set(i, `Question ${i + 1}: select a correct answer`);
            valid = false;
          }
        }
      }
    });

    this.questionErrors.set(qErrors);
    this.questionOptionErrors.set(qOptErrors);

    return valid;
  }

  // ── Save ────────────────────────────────────────────────────────

  saveExercise(): void {
    // First close any open editing
    this.saveOrDiscardCurrentEdit();

    if (!this.validate()) return;

    this.isSaving.set(true);
    const title = this.exerciseTitle().trim();
    const type = this.exerciseType();

    if (this.isEditMode()) {
      this.saveEdit(title, type);
    } else {
      this.saveCreate(title, type);
    }
  }

  private saveCreate(title: string, type: ExerciseType): void {
    const lid = this.lessonId();
    if (!lid) {
      this.toast.error('Lesson context is missing. Please go back and try again.');
      this.isSaving.set(false);
      return;
    }

    const questions = this.questions().map((q, i) => ({
      content: q.content,
      orderIndex: i,
      meta: q.meta,
    }));

    this.exerciseService.create(lid, { title, type, questions })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSaveSuccess(),
        error: () => this.onSaveError(),
      });
  }

  private saveEdit(title: string, type: ExerciseType): void {
    const eid = this.exerciseId()!;

    this.exerciseService.update(eid, { title, type })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const updateItems = this.buildUpdateItems();
          if (updateItems.length === 0) {
            this.onSaveSuccess();
            return;
          }

          this.questionService.batchUpdate(eid, { questions: updateItems })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.onSaveSuccess(),
              error: () => this.onSaveError(),
            });
        },
        error: () => this.onSaveError(),
      });
  }

  private buildUpdateItems(): any[] {
    const items: any[] = [];
    const current = this.questions();
    const originals = this.originalQuestions();

    // Build lookup of original questions by id
    const originalMap = new Map<string, EditorQuestion>();
    for (const oq of originals) {
      if (oq.id) originalMap.set(oq.id, oq);
    }

    // Collect ids still present in the editor
    const currentIds = new Set<string>();
    for (const q of current) {
      if (q.id) currentIds.add(q.id);
    }

    // Deleted questions: in original but not in current → DELETE
    for (const oq of originals) {
      if (oq.id && !currentIds.has(oq.id)) {
        items.push({
          action: QuestionAction.DELETE,
          questionId: oq.id,
        });
      }
    }

    // New and updated questions
    current.forEach((q, i) => {
      if (!q.id) {
        // New question → CREATE
        items.push({
          action: QuestionAction.CREATE,
          content: q.content,
          orderIndex: i,
          meta: q.meta,
        });
      } else {
        // Existing → UPDATE only if changed
        const orig = originalMap.get(q.id);
        if (orig &&
            orig.content === q.content &&
            orig.orderIndex === i &&
            JSON.stringify(orig.meta) === JSON.stringify(q.meta)) {
          return; // skip unchanged
        }
        items.push({
          action: QuestionAction.UPDATE,
          questionId: q.id,
          content: q.content,
          orderIndex: i,
          meta: q.meta,
        });
      }
    });

    return items;
  }

  private onSaveSuccess(): void {
    this.isSaving.set(false);
    this.takeSnapshot(); // Clear dirty state before navigation
    this.toast.success(this.isEditMode() ? 'Exercise updated successfully' : 'Exercise created successfully');
    if (this.lessonId()) {
      this.router.navigate(['/course', this.courseId(), 'manage', 'material', 'lesson', this.lessonId()]);
    } else {
      this.router.navigate(['/course', this.courseId(), 'manage', 'material']);
    }
  }

  private onSaveError(): void {
    this.isSaving.set(false);
    this.toast.error('Failed to save exercise. Please try again.');
  }

  // ── Navigation ──────────────────────────────────────────────────

  goBack(): void {
    const nav = () => {
      if (this.lessonId()) {
        this.router.navigate(['/course', this.courseId(), 'manage', 'material', 'lesson', this.lessonId()]);
      } else {
        this.router.navigate(['/course', this.courseId(), 'manage', 'material']);
      }
    };
    if (this.isDirty()) {
      this.pendingNavigation = nav;
      this.showUnsavedDialog.set(true);
    } else {
      nav();
    }
  }

  cancelExercise(): void {
    this.goBack();
  }

  confirmLeave(): void {
    this.showUnsavedDialog.set(false);
    this.takeSnapshot(); // Clear dirty before navigation
    if (this.pendingNavigation) {
      this.pendingNavigation();
      this.pendingNavigation = null;
    }
  }

  stayOnPage(): void {
    this.showUnsavedDialog.set(false);
    this.pendingNavigation = null;
  }
}
