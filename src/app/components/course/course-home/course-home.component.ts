import { Component, inject, signal, computed, OnInit, DestroyRef, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EnrollmentService } from '../../../services';
import {
  EnrollmentStatus,
} from '../../../shared/models';
import {
  ButtonComponent,
  SkeletonComponent,
} from '../../../shared/components';
import { CourseLayoutComponent } from '../course-layout/course-layout.component';

/**
 * Course landing page (no lesson selected).
 *
 * Reads `myEnrollment` and the module/lesson tree from {@link CourseLayoutComponent}
 * — the layout already loaded them via the syllabus call. This component therefore
 * issues zero HTTP reads of its own.
 */
@Component({
  selector: 'app-course-home',
  imports: [ButtonComponent, SkeletonComponent],
  templateUrl: './course-home.component.html',
  styleUrl: './course-home.component.scss',
})
export class CourseHomeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly layout = inject(CourseLayoutComponent);

  courseId = computed(() => this.layout.courseId());

  // Parent layout owns enrollment state; we just project it.
  private readonly enrollment = this.layout.myEnrollment;
  enrollmentLoading = computed(() => this.layout.screenState() === 'loading');
  enrolling = signal(false);

  isContentLocked = computed(() => this.layout.isContentLocked());
  isEnrolled = computed(() => this.layout.isEnrolled());
  enrollmentBadgeLabel = computed(() => this.layout.enrollmentBadgeLabel());

  private redirectedFor = signal<string | null>(null);

  constructor() {
    // When the parent finishes loading and the user is ACTIVE-enrolled, redirect to
    // the first lesson. Use an effect so we react to state changes from the parent.
    effect(() => {
      if (this.enrollmentLoading()) return;
      const enrollment = this.enrollment();
      const courseId = this.courseId();
      if (!enrollment) return;
      if (enrollment.status !== EnrollmentStatus.ACTIVE) return;
      if (this.redirectedFor() === courseId) return;
      this.redirectToFirstLesson();
      this.redirectedFor.set(courseId);
    });
  }

  ngOnInit(): void {
    // Route param is observed by the parent layout; nothing to do here.
  }

  enrollInCourse(): void {
    this.enrolling.set(true);
    this.enrollmentService.enroll(this.courseId()).subscribe({
      next: () => {
        this.enrolling.set(false);
        // Refresh the layout's syllabus to pull updated `myEnrollment`.
        this.layout.retry();
      },
      error: () => {
        this.enrolling.set(false);
      },
    });
  }

  private redirectToFirstLesson(): void {
    const modules = this.layout.modulesWithLessons();
    const firstModule = modules[0];
    if (!firstModule) return;
    const firstLesson = firstModule.lessons[0];
    if (!firstLesson) return;
    this.router.navigate(['lesson', firstLesson.id], {
      relativeTo: this.route.parent,
      queryParams: { prefix: '1.1' },
      replaceUrl: true,
    });
  }
}
