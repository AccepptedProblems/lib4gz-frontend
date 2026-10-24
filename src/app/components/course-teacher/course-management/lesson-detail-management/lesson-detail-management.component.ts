import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import {
  LessonService,
  ExerciseService,
  SummaryService,
} from '../../../../services';
import {
  LessonResponse,
  ExerciseResponse,
  SummaryResponse,
  ExerciseType,
} from '../../../../shared/models';
import {
  ButtonComponent,
  SkeletonComponent,
  BadgeComponent,
  DialogComponent,
  TextareaComponent,
} from '../../../../shared/components';
import { LinkifyPipe } from '../../../../shared/pipes';
import { ToastService } from '../../../../shared/components/toast/toast.component';
import { apiErrorMessage } from '../../../../shared/utils/api-error';
import {
  NO_UNDO_WARNING,
  SubmissionCount,
  contentsWarning,
  submissionsWarning,
} from '../../../../shared/utils/delete-warning';

/**
 * Teacher lesson detail page.
 *
 * Single round-trip via `GET /v1/lessons/{id}?expand=summary,exercises`. The lesson
 * row also carries the denormalized `moduleTitle`, so no separate module fetch is
 * needed — the previous 4-call chain becomes 1 call.
 */
@Component({
  selector: 'app-lesson-detail-management',
  imports: [
    ButtonComponent,
    SkeletonComponent,
    BadgeComponent,
    DialogComponent,
    TextareaComponent,
    LinkifyPipe,
  ],
  templateUrl: './lesson-detail-management.component.html',
  styleUrl: './lesson-detail-management.component.scss',
})
export class LessonDetailManagementComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lessonService = inject(LessonService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly summaryService = inject(SummaryService);
  private readonly toast = inject(ToastService);

  courseId = signal('');
  lessonId = signal('');

  lesson = signal<LessonResponse | null>(null);
  moduleTitle = signal('');
  summary = signal<SummaryResponse | null>(null);
  summaryLoading = signal(true);
  exercises = signal<ExerciseResponse[]>([]);
  exercisesLoaded = signal(false);
  loading = signal(true);

  editingTitle = signal(false);
  editTitleValue = signal('');
  savingTitle = signal(false);

  editingSummary = signal(false);
  editSummaryValue = signal('');
  savingSummary = signal(false);

  deleteDialogOpen = signal(false);
  deleteExerciseId = signal('');
  deleteExerciseName = signal('');
  deleteQuestionCount = signal(0);
  deleteSubmissions = signal<SubmissionCount>('loading');
  deleting = signal(false);
  private countSub?: Subscription;

  deleteContents = computed(() => contentsWarning([[this.deleteQuestionCount(), 'question']]));
  deleteSubmissionsText = computed(() => submissionsWarning(this.deleteSubmissions(), 'exercise'));
  readonly noUndoWarning = NO_UNDO_WARNING;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const courseId = params.get('id');
      const lessonId = params.get('lessonId');
      if (courseId) this.courseId.set(courseId);
      if (lessonId && lessonId !== this.lessonId()) {
        this.lessonId.set(lessonId);
        this.loadLessonData(lessonId);
      }
    });
    this.destroyRef.onDestroy(() => this.countSub?.unsubscribe());
  }

  /**
   * One round-trip pulls lesson metadata, summary, and exercises together.
   */
  private loadLessonData(lessonId: string): void {
    this.loading.set(true);
    this.summary.set(null);
    this.summaryLoading.set(true);
    this.exercises.set([]);
    this.exercisesLoaded.set(false);
    this.editingTitle.set(false);
    this.editingSummary.set(false);

    this.lessonService.get(lessonId, { expand: ['summary', 'exercises'] }).subscribe({
      next: lesson => {
        this.lesson.set(lesson);
        this.moduleTitle.set(lesson.moduleTitle ?? lesson.module?.title ?? '');
        this.summary.set(lesson.summary ?? null);
        this.exercises.set(
          [...(lesson.exercises ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
        );
        this.summaryLoading.set(false);
        this.exercisesLoaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
        this.exercisesLoaded.set(true);
        this.loading.set(false);
      },
    });
  }

  startEditTitle(): void {
    const lesson = this.lesson();
    if (lesson) {
      this.editTitleValue.set(lesson.title);
      this.editingTitle.set(true);
    }
  }

  cancelEditTitle(): void {
    this.editingTitle.set(false);
  }

  saveTitle(): void {
    const title = this.editTitleValue().trim();
    if (!title) return;
    this.savingTitle.set(true);
    this.lessonService.update(this.lessonId(), { title }).subscribe({
      next: updated => {
        this.lesson.set(updated);
        this.editingTitle.set(false);
        this.savingTitle.set(false);
        this.toast.success('Lesson updated');
      },
      error: err => {
        this.savingTitle.set(false);
        this.toast.error(apiErrorMessage(err, 'Failed to update lesson'));
      },
    });
  }

  /** Opens the confirm dialog and counts the student submissions inside. Delete waits for the count. */
  confirmDeleteExercise(exercise: ExerciseResponse): void {
    this.countSub?.unsubscribe();
    this.deleteExerciseId.set(exercise.id);
    this.deleteExerciseName.set(exercise.title);
    this.deleteQuestionCount.set(exercise.questionCount ?? 0);
    this.deleteSubmissions.set('loading');
    this.deleteDialogOpen.set(true);
    this.countSub = this.exerciseService.get(exercise.id, { expand: ['submissionCount'] }).subscribe({
      next: ex => {
        this.deleteQuestionCount.set(ex.questionCount ?? this.deleteQuestionCount());
        this.deleteSubmissions.set(ex.submissionCount ?? 'unknown');
      },
      error: () => this.deleteSubmissions.set('unknown'),
    });
  }

  cancelDelete(): void {
    this.countSub?.unsubscribe();
    this.deleteDialogOpen.set(false);
  }

  executeDelete(): void {
    if (this.deleteSubmissions() === 'loading') return;
    this.deleting.set(true);
    const id = this.deleteExerciseId();
    this.exerciseService.delete(id).subscribe({
      next: () => {
        this.exercises.update(list => list.filter(e => e.id !== id));
        this.deleteDialogOpen.set(false);
        this.deleting.set(false);
        this.toast.success('Exercise deleted');
      },
      error: err => {
        this.deleting.set(false);
        this.toast.error(apiErrorMessage(err, 'Failed to delete exercise'));
      },
    });
  }

  startEditSummary(): void {
    this.editSummaryValue.set(this.summary()?.content ?? '');
    this.editingSummary.set(true);
  }

  saveSummary(): void {
    const content = this.editSummaryValue().trim();
    this.savingSummary.set(true);
    this.summaryService.createOrUpdate(this.lessonId(), { content }).subscribe({
      next: updated => {
        this.summary.set(updated);
        this.editingSummary.set(false);
        this.savingSummary.set(false);
        this.toast.success('Summary saved');
      },
      error: err => {
        this.savingSummary.set(false);
        this.toast.error(apiErrorMessage(err, 'Failed to save summary'));
      },
    });
  }

  navigateToExerciseEditor(exerciseId?: string): void {
    if (exerciseId) {
      this.router.navigate(['/course', this.courseId(), 'manage', 'exercise', exerciseId, 'edit'], {
        queryParams: { lessonId: this.lessonId() },
      });
    } else {
      this.router.navigate(['/course', this.courseId(), 'manage', 'exercise', 'new'], {
        queryParams: { lessonId: this.lessonId() },
      });
    }
  }

  onBack(): void {
    this.router.navigate(['/course', this.courseId(), 'manage', 'material']);
  }

  getExerciseTypeLabel(type: ExerciseType): string {
    const map: Record<string, string> = {
      [ExerciseType.TEXT_ANSWER]: 'Text',
      [ExerciseType.CODE]: 'Code',
      [ExerciseType.FILE_UPLOAD]: 'File',
      [ExerciseType.MULTIPLE_CHOICE]: 'MCQ',
      [ExerciseType.PROJECT_LINK]: 'Project',
    };
    return map[type] ?? type;
  }
}
