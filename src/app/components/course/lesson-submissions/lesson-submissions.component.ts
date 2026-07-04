import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter } from 'rxjs';
import { SubmissionService } from '../../../services';
import {
  ExerciseSubmissionsGroup,
  LessonResponse,
  QuestionResponse,
  StudentAnswerResponse,
  SubmissionResponse,
  ExerciseType,
  SubmissionStatus,
} from '../../../shared/models';
import {
  ChipComponent,
  EmptyStateComponent,
  SideSheetComponent,
  SkeletonComponent,
} from '../../../shared/components';
import { ChipVariant } from '../../../shared/components/chip/chip.component';
import { CourseLessonComponent } from '../course-lesson/course-lesson.component';

/**
 * Teacher review queue, rendered inside a lesson page.
 *
 * One round-trip via `GET /v1/lessons/{id}/submissions?expand=answers,questions`
 * fully populates the screen. The previous pattern (`1 + 3N + M` round-trips with a
 * per-submission re-fetch on drawer open) is gone.
 */
@Component({
  selector: 'app-lesson-submissions',
  imports: [
    ChipComponent,
    EmptyStateComponent,
    SideSheetComponent,
    SkeletonComponent,
  ],
  templateUrl: './lesson-submissions.component.html',
  styleUrl: './lesson-submissions.component.scss',
})
export class LessonSubmissionsComponent {
  private readonly parent = inject(CourseLessonComponent);
  private readonly submissionService = inject(SubmissionService);
  private readonly destroyRef = inject(DestroyRef);

  isTeacher = computed(() => this.parent.isTeacher());

  // Single source of truth: the composite payload from the server.
  private exerciseGroups = signal<ExerciseSubmissionsGroup[]>([]);
  loading = signal(false);

  expandedExerciseId = signal<string | null>(null);

  drawerOpen = signal(false);
  drawerQuestionId = signal<string | null>(null);
  drawerQuestionContent = signal('');
  drawerExerciseId = signal<string | null>(null);

  sortedExercises = computed(() =>
    [...this.exerciseGroups()].sort((a, b) => a.orderIndex - b.orderIndex)
  );

  /** All submissions for the currently expanded exercise. */
  drawerSubmissions = computed<SubmissionResponse[]>(() => {
    const exId = this.drawerExerciseId();
    if (!exId) return [];
    const group = this.exerciseGroups().find(g => g.id === exId);
    return group?.submissions ?? [];
  });

  constructor() {
    toObservable(this.parent.lesson)
      .pipe(
        filter((l): l is LessonResponse => !!l),
        distinctUntilChanged((a, b) => a.id === b.id),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(lesson => this.loadFor(lesson));
  }

  toggleExerciseExpand(exercise: { id: string }): void {
    if (this.expandedExerciseId() === exercise.id) {
      this.expandedExerciseId.set(null);
      this.closeDrawer();
      return;
    }
    this.expandedExerciseId.set(exercise.id);
    this.closeDrawer();
  }

  questionsFor(exerciseId: string): QuestionResponse[] {
    const group = this.exerciseGroups().find(g => g.id === exerciseId);
    return group?.questions ?? [];
  }

  submissionsCount(exerciseId: string): number {
    const group = this.exerciseGroups().find(g => g.id === exerciseId);
    return group?.submissions.length ?? 0;
  }

  openQuestionDrawer(question: QuestionResponse, exercise: { id: string }): void {
    this.drawerQuestionId.set(question.id);
    this.drawerQuestionContent.set(question.content);
    this.drawerExerciseId.set(exercise.id);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    this.drawerQuestionId.set(null);
    this.drawerQuestionContent.set('');
    this.drawerExerciseId.set(null);
  }

  getAnswerForQuestion(sub: SubmissionResponse): StudentAnswerResponse | null {
    const qId = this.drawerQuestionId();
    if (!qId || !sub.answers) return null;
    return sub.answers.find(a => a.questionId === qId) ?? null;
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

  /**
   * Fetch the entire review queue in a single request when the lesson changes.
   * Teachers only; the server enforces.
   */
  private loadFor(lesson: LessonResponse): void {
    this.expandedExerciseId.set(null);
    this.closeDrawer();
    this.exerciseGroups.set([]);

    if (!this.isTeacher()) return;
    if ((lesson.exerciseCount ?? 0) === 0) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.submissionService.listByLesson(lesson.id, { expand: ['answers', 'questions'], courseId: this.parent.courseId() }).subscribe({
      next: ({ exercises }) => {
        this.exerciseGroups.set(exercises);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
