import { Component, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter } from 'rxjs';
import { SummaryService } from '../../../services';
import { LessonResponse, SummaryResponse } from '../../../shared/models';
import { SkeletonComponent } from '../../../shared/components';
import { LinkifyPipe } from '../../../shared/pipes';
import { CourseLessonComponent } from '../course-lesson/course-lesson.component';

@Component({
  selector: 'app-lesson-summary',
  imports: [SkeletonComponent, LinkifyPipe],
  templateUrl: './lesson-summary.component.html',
  styleUrl: './lesson-summary.component.scss',
})
export class LessonSummaryComponent {
  private readonly parent = inject(CourseLessonComponent);
  private readonly summaryService = inject(SummaryService);
  private readonly destroyRef = inject(DestroyRef);

  summary = signal<SummaryResponse | null>(null);
  loading = signal(false);
  error = signal(false);

  constructor() {
    toObservable(this.parent.lesson)
      .pipe(
        filter((l): l is LessonResponse => !!l),
        distinctUntilChanged((a, b) => a.id === b.id),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(lesson => this.loadFor(lesson));
  }

  private loadFor(lesson: LessonResponse): void {
    if (!lesson.hasSummary) {
      this.summary.set(null);
      this.loading.set(false);
      this.error.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.summaryService.get(lesson.id, this.parent.courseId()).subscribe({
      next: s => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
