import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ModuleService, RaceService } from '../../../services';
import { ExerciseType, ModuleResponse, RaceQuestionItem, RaceQuestionResponse } from '../../../shared/models';
import {
  ButtonComponent, DialogComponent, SideSheetComponent, SkeletonComponent, TextareaComponent, ToastService,
} from '../../../shared/components';
import {
  MAX_OPTIONS, MIN_OPTIONS, WARN_TOO_FEW_OPTIONS, WARN_TOO_MANY_OPTIONS, parseFastCreate,
} from '../../../shared/utils/fast-create';

import { apiErrorMessage } from '../../../shared/utils/api-error';

type ScreenState = 'loading' | 'loaded' | 'error';

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 question ${one}` : `${n} questions ${many}`;
}

/**
 * The course's Lightning Kart question bank. Rows are the editor's state; a click on a row
 * opens a drawer on a copy, Done writes it back; the server is written only on Save, which
 * replaces the whole bank.
 */
@Component({
  selector: 'app-race-questions',
  imports: [ButtonComponent, DialogComponent, SideSheetComponent, SkeletonComponent, TextareaComponent],
  templateUrl: './race-questions.component.html',
  styleUrl: './race-questions.component.scss',
})
export class RaceQuestionsComponent implements OnInit {
  readonly maxOptions = MAX_OPTIONS;
  readonly minOptions = MIN_OPTIONS;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly moduleService = inject(ModuleService);
  private readonly raceService = inject(RaceService);
  private readonly toast = inject(ToastService);

  courseId = signal('');
  screenState = signal<ScreenState>('loading');
  errorMessage = signal('');

  modules = signal<ModuleResponse[]>([]);
  rows = signal<RaceQuestionItem[]>([]);
  private savedSnapshot = signal('');
  isDirty = computed(() => JSON.stringify(this.rows()) !== this.savedSnapshot());

  bulkText = signal('');
  bulkModuleId = signal('');
  /** What the last Add had to say, one line each. Cleared by the next Add. */
  addWarnings = signal<string[]>([]);

  isSaving = signal(false);
  showUnsavedDialog = signal(false);

  /** The row open in the drawer, or -1. `draft` is its working copy. */
  editIndex = signal(-1);
  draft = signal<RaceQuestionItem | null>(null);
  draftError = signal('');

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) event.preventDefault();
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.load(id);
      }
    });
  }

  private load(courseId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');
    forkJoin({
      modules: this.moduleService.listByCourse(courseId),
      questions: this.raceService.listQuestions(courseId),
    }).subscribe({
      next: ({ modules, questions }) => {
        this.modules.set(modules);
        if (!this.bulkModuleId() && modules[0]) this.bulkModuleId.set(modules[0].id);
        this.setRows(questions);
        this.screenState.set('loaded');
      },
      error: err => {
        this.errorMessage.set(apiErrorMessage(err, 'Failed to load race questions. Please try again.'));
        this.screenState.set('error');
      },
    });
  }

  private setRows(questions: RaceQuestionResponse[]): void {
    this.rows.set(questions.map(q => ({
      id: q.id, moduleId: q.moduleId, content: q.content, options: q.options, correctIndex: q.correctIndex,
    })));
    this.savedSnapshot.set(JSON.stringify(this.rows()));
  }

  /** Parses the paste, keeps every question with a correct option and no blank option, appends the rows. */
  addQuestions(): void {
    const moduleId = this.bulkModuleId();
    if (!moduleId) return;
    const parsed = parseFastCreate(ExerciseType.MULTIPLE_CHOICE, this.bulkText());
    this.addWarnings.set([]);
    if (parsed.length === 0) return;

    const added: RaceQuestionItem[] = [];
    let noCorrect = 0, tooFew = 0, blank = 0, trimmed = 0;
    for (const q of parsed) {
      const options: { text: string; isCorrect: boolean }[] = q.meta['options'];
      const correctIndex = options.findIndex(o => o.isCorrect);
      if (q.warnings.includes(WARN_TOO_MANY_OPTIONS)) trimmed++;
      if (correctIndex < 0) { noCorrect++; continue; }
      if (q.warnings.includes(WARN_TOO_FEW_OPTIONS)) { tooFew++; continue; }
      if (options.some(o => !o.text.trim())) { blank++; continue; }
      added.push({ id: null, moduleId, content: q.content, options: options.map(o => o.text), correctIndex });
    }

    const warnings: string[] = [];
    if (noCorrect > 0) warnings.push(`${plural(noCorrect, 'has', 'have')} no correct answer marked. The race needs one, so ${noCorrect === 1 ? 'it was' : 'they were'} not added.`);
    if (tooFew > 0) warnings.push(`${plural(tooFew, 'has', 'have')} fewer than ${MIN_OPTIONS} options and ${tooFew === 1 ? 'was' : 'were'} not added.`);
    if (blank > 0) warnings.push(`${plural(blank, 'has', 'have')} an empty option and ${blank === 1 ? 'was' : 'were'} not added.`);
    if (trimmed > 0) warnings.push(`${plural(trimmed, 'had', 'had')} more than ${MAX_OPTIONS} options; only the first ${MAX_OPTIONS} are kept.`);
    this.addWarnings.set(warnings);

    if (added.length) {
      this.rows.update(rows => [...rows, ...added]);
      this.bulkText.set('');
    }
  }

  setRowModule(index: number, moduleId: string): void {
    this.patchRow(index, r => ({ ...r, moduleId }));
  }

  /** Opens the drawer on a copy of the row; nothing reaches the table until Done. */
  openEditor(index: number): void {
    const row = this.rows()[index];
    this.editIndex.set(index);
    this.draft.set({ ...row, options: [...row.options] });
    this.draftError.set('');
  }

  closeEditor(): void {
    this.editIndex.set(-1);
    this.draft.set(null);
  }

  applyEditor(): void {
    const d = this.draft();
    const index = this.editIndex();
    if (!d || index < 0) return;
    if (!d.content.trim()) { this.draftError.set('The question text is empty.'); return; }
    if (d.options.some(o => !o.trim())) { this.draftError.set('Every option needs some text. Fill it in or remove it.'); return; }
    this.patchRow(index, () => ({ ...d, content: d.content.trim(), options: d.options.map(o => o.trim()) }));
    this.closeEditor();
  }

  setDraftContent(content: string): void {
    this.patchDraft(d => ({ ...d, content }));
  }

  setDraftOption(optionIndex: number, text: string): void {
    this.patchDraft(d => ({ ...d, options: d.options.map((o, i) => (i === optionIndex ? text : o)) }));
  }

  setDraftCorrect(correctIndex: number): void {
    this.patchDraft(d => ({ ...d, correctIndex }));
  }

  addDraftOption(): void {
    this.patchDraft(d => (d.options.length >= MAX_OPTIONS ? d : { ...d, options: [...d.options, ''] }));
  }

  /** Keeps the correct mark on the same option, or on the first one if that option is removed. */
  removeDraftOption(optionIndex: number): void {
    this.patchDraft(d => {
      if (d.options.length <= MIN_OPTIONS) return d;
      const options = d.options.filter((_, i) => i !== optionIndex);
      const correctIndex = d.correctIndex === optionIndex ? 0 : d.correctIndex > optionIndex ? d.correctIndex - 1 : d.correctIndex;
      return { ...d, options, correctIndex };
    });
  }

  private patchDraft(patch: (d: RaceQuestionItem) => RaceQuestionItem): void {
    this.draft.update(d => (d ? patch(d) : d));
  }

  private patchRow(index: number, patch: (r: RaceQuestionItem) => RaceQuestionItem): void {
    this.rows.update(rows => rows.map((r, i) => (i === index ? patch(r) : r)));
  }

  removeRow(index: number): void {
    this.rows.update(rows => rows.filter((_, i) => i !== index));
  }

  save(): void {
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.raceService.replaceQuestions(this.courseId(), { questions: this.rows() }).subscribe({
      next: questions => {
        this.isSaving.set(false);
        this.setRows(questions);
        this.toast.success('Race questions saved');
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'Could not save the race questions. Please try again.'));
      },
    });
  }

  cancel(): void {
    if (this.isDirty()) {
      this.showUnsavedDialog.set(true);
    } else {
      this.leave();
    }
  }

  confirmLeave(): void {
    this.showUnsavedDialog.set(false);
    this.savedSnapshot.set(JSON.stringify(this.rows()));
    this.leave();
  }

  stayOnPage(): void {
    this.showUnsavedDialog.set(false);
  }

  retry(): void {
    this.load(this.courseId());
  }

  private leave(): void {
    this.router.navigate(['/course', this.courseId(), 'manage', 'material']);
  }
}
