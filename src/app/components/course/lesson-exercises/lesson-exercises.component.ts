import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter } from 'rxjs';
import { ExerciseService } from '../../../services';
import {
  ExerciseResponse,
  LessonResponse,
  ExerciseType,
  SubmissionStatus,
} from '../../../shared/models';
import {
  ButtonComponent,
  ChipComponent,
  SkeletonComponent,
} from '../../../shared/components';
import { ChipVariant } from '../../../shared/components/chip/chip.component';
import { CourseLessonComponent } from '../course-lesson/course-lesson.component';

/**
 * Student-facing exercise list under a lesson.
 *
 * Reads `mySubmissionStatus` directly off each exercise row — populated by the backend
 * via Phase 1 denormalization. The per-exercise `getMySubmission` fan-out is gone.
 */
@Component({
  selector: 'app-lesson-exercises',
  imports: [ButtonComponent, ChipComponent, SkeletonComponent],
  templateUrl: './lesson-exercises.component.html',
  styleUrl: './lesson-exercises.component.scss',
})
export class LessonExercisesComponent {
  private readonly parent = inject(CourseLessonComponent);
  private readonly router = inject(Router);
  private readonly exerciseService = inject(ExerciseService);
  private readonly destroyRef = inject(DestroyRef);

  exercises = signal<ExerciseResponse[]>([]);
  loading = signal(false);

  sortedExercises = computed(() =>
    [...this.exercises()].sort((a, b) => a.orderIndex - b.orderIndex)
  );

  constructor() {
    toObservable(this.parent.lesson)
      .pipe(
        filter((l): l is LessonResponse => !!l),
        distinctUntilChanged((a, b) => a.id === b.id),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(lesson => this.loadFor(lesson));
  }

  navigateToExercise(): void {
    const lesson = this.parent.lesson();
    if (!lesson) return;
    const prefix = this.parent.lessonPrefix();
    this.router.navigate(
      ['/course', this.parent.courseId(), 'lesson', lesson.id, 'attempt'],
      { queryParams: prefix ? { prefix } : {} }
    );
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

  getSubmissionStatusLabel(status: SubmissionStatus | null | undefined): string {
    if (!status) return '';
    switch (status) {
      case SubmissionStatus.DRAFT: return 'Draft';
      case SubmissionStatus.SUBMITTED: return 'Submitted';
      case SubmissionStatus.APPROVED: return 'Approved';
      case SubmissionStatus.NEEDS_REVISION: return 'Needs Revision';
      default: return '';
    }
  }

  getSubmissionChipVariant(status: SubmissionStatus | null | undefined): ChipVariant {
    if (!status) return 'neutral';
    switch (status) {
      case SubmissionStatus.DRAFT: return 'neutral';
      case SubmissionStatus.SUBMITTED: return 'default';
      case SubmissionStatus.APPROVED: return 'success';
      case SubmissionStatus.NEEDS_REVISION: return 'warning';
      default: return 'neutral';
    }
  }

  /**
   * Single round-trip via `GET /v1/lessons/{id}/exercises`. Each row already carries
   * `mySubmissionStatus` — no per-row fan-out.
   */
  private loadFor(lesson: LessonResponse): void {
    this.exercises.set([]);

    if ((lesson.exerciseCount ?? 0) === 0) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.exerciseService.listByLesson(lesson.id).subscribe({
      next: exs => {
        this.exercises.set(exs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
