import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LessonService } from '../../../services';
import { LessonResponse } from '../../../shared/models';
import { SpinnerComponent } from '../../../shared/components';
import { CourseLayoutComponent } from '../course-layout/course-layout.component';

@Component({
  selector: 'app-course-lesson',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SpinnerComponent,
  ],
  templateUrl: './course-lesson.component.html',
  styleUrl: './course-lesson.component.scss',
})
export class CourseLessonComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lessonService = inject(LessonService);
  private readonly courseLayout = inject(CourseLayoutComponent);

  courseId = computed(() => this.courseLayout.courseId());
  isTeacher = computed(() => this.courseLayout.isTeacher());

  lessonId = signal('');
  lesson = signal<LessonResponse | null>(null);
  lessonLoading = signal(true);
  lessonPrefix = signal('');

  exerciseCount = computed(() => this.lesson()?.exerciseCount ?? 0);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const lessonId = params.get('lessonId');
      if (lessonId && lessonId !== this.lessonId()) {
        this.lessonId.set(lessonId);
        this.loadLesson(lessonId);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const prefix = params.get('prefix');
      if (prefix) this.lessonPrefix.set(prefix);
    });
  }

  private loadLesson(lessonId: string): void {
    this.lessonLoading.set(true);
    this.lessonService.get(lessonId).subscribe({
      next: lesson => {
        this.lesson.set(lesson);
        this.lessonLoading.set(false);
      },
      error: () => {
        this.lessonLoading.set(false);
      },
    });
  }
}
