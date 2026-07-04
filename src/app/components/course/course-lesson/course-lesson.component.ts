import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LessonService, ProgressService } from '../../../services';
import { LessonResponse } from '../../../shared/models';
import { ButtonComponent, SkeletonComponent } from '../../../shared/components';
import { CourseLayoutComponent } from '../course-layout/course-layout.component';

/** Flattened syllabus entry used for linear Previous/Next navigation. */
interface LessonNavEntry {
  lesson: LessonResponse;
  prefix: string;
}

@Component({
  selector: 'app-course-lesson',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ButtonComponent,
    SkeletonComponent,
  ],
  templateUrl: './course-lesson.component.html',
  styleUrl: './course-lesson.component.scss',
})
export class CourseLessonComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lessonService = inject(LessonService);
  private readonly progressService = inject(ProgressService);
  private readonly courseLayout = inject(CourseLayoutComponent);

  courseId = computed(() => this.courseLayout.courseId());
  isTeacher = computed(() => this.courseLayout.isTeacher());

  lessonId = signal('');
  lesson = signal<LessonResponse | null>(null);
  lessonLoading = signal(true);
  lessonPrefix = signal('');

  exerciseCount = computed(() => this.lesson()?.exerciseCount ?? 0);

  /** Syllabus flattened to module order → lesson order; the linear learn path. */
  private flattenedLessons = computed<LessonNavEntry[]>(() => {
    const entries: LessonNavEntry[] = [];
    this.courseLayout.modulesWithLessons().forEach((mwl, i) => {
      mwl.lessons.forEach((lesson, j) => {
        entries.push({ lesson, prefix: `${i + 1}.${j + 1}` });
      });
    });
    return entries;
  });

  private currentLessonIndex = computed(() =>
    this.flattenedLessons().findIndex(e => e.lesson.id === this.lessonId())
  );

  previousLesson = computed<LessonNavEntry | null>(() => {
    const i = this.currentLessonIndex();
    return i > 0 ? this.flattenedLessons()[i - 1] : null;
  });

  nextLesson = computed<LessonNavEntry | null>(() => {
    const i = this.currentLessonIndex();
    const all = this.flattenedLessons();
    return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
  });

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

  navigateToEntry(entry: LessonNavEntry): void {
    this.router.navigate(['/course', this.courseId(), 'lesson', entry.lesson.id], {
      queryParams: { prefix: entry.prefix },
    });
  }

  private loadLesson(lessonId: string): void {
    this.lessonLoading.set(true);
    this.lessonService.get(lessonId, { courseId: this.courseId() }).subscribe({
      next: lesson => {
        this.lesson.set(lesson);
        this.lessonLoading.set(false);
        this.trackProgress(lesson);
      },
      error: () => {
        this.lessonLoading.set(false);
      },
    });
  }

  /**
   * Client-side progress interim (UX plan 1.2/1.5): remember where the learner is
   * for the dashboard resume card, and mark exercise-less lessons complete on visit
   * (exercise-backed lessons complete via submission — see LessonExercises/ExerciseAttempt).
   */
  private trackProgress(lesson: LessonResponse): void {
    if (this.isTeacher()) return;
    const course = this.courseLayout.course();
    if (!course) return;

    this.progressService.recordVisit({
      courseId: course.id,
      courseTitle: course.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      prefix: this.lessonPrefix() || null,
    });

    if ((lesson.exerciseCount ?? 0) === 0) {
      this.progressService.markLessonCompleted(course.id, lesson.id);
    }
  }
}
