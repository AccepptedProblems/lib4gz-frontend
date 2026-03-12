import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ModuleService,
  LessonService,
  EnrollmentService,
} from '../../../services';
import {
  EnrollmentResponse,
  EnrollmentStatus,
} from '../../../shared/models';
import {
  ButtonComponent,
  SpinnerComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-course-home',
  imports: [ButtonComponent, SpinnerComponent],
  templateUrl: './course-home.component.html',
  styleUrl: './course-home.component.scss',
})
export class CourseHomeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly enrollmentService = inject(EnrollmentService);

  courseId = signal('');
  enrollment = signal<EnrollmentResponse | null>(null);
  enrollmentLoading = signal(true);
  enrolling = signal(false);

  isContentLocked = computed(() => {
    const enrollment = this.enrollment();
    if (!enrollment) return true;
    return enrollment.status !== EnrollmentStatus.ACTIVE;
  });

  isEnrolled = computed(() => !!this.enrollment());

  enrollmentBadgeLabel = computed(() => {
    const status = this.enrollment()?.status;
    switch (status) {
      case EnrollmentStatus.ACTIVE: return 'Enrolled';
      case EnrollmentStatus.PENDING: return 'Pending Approval';
      case EnrollmentStatus.REJECTED: return 'Rejected';
      default: return 'Not Enrolled';
    }
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.courseId.set(id);
        this.checkEnrollmentAndRedirect(id);
      }
    });
  }

  enrollInCourse(): void {
    this.enrolling.set(true);
    this.enrollmentService.enroll(this.courseId()).subscribe({
      next: enrollment => {
        this.enrollment.set(enrollment);
        this.enrolling.set(false);
      },
      error: () => {
        this.enrolling.set(false);
      },
    });
  }

  private checkEnrollmentAndRedirect(courseId: string): void {
    this.enrollmentLoading.set(true);
    this.enrollmentService.getMyEnrollment(courseId).pipe(
      catchError(() => of(null))
    ).subscribe(enrollment => {
      this.enrollment.set(enrollment);
      this.enrollmentLoading.set(false);

      if (enrollment && enrollment.status === EnrollmentStatus.ACTIVE) {
        this.redirectToFirstLesson(courseId);
      }
    });
  }

  private redirectToFirstLesson(courseId: string): void {
    this.moduleService.listByCourse(courseId).subscribe(modules => {
      const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
      if (sorted.length === 0) return;

      this.lessonService.listByModule(sorted[0].id).subscribe(lessons => {
        const sortedLessons = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);
        if (sortedLessons.length > 0) {
          this.router.navigate(['lesson', sortedLessons[0].id], {
            relativeTo: this.route.parent,
            queryParams: { tab: 'summary', prefix: '1.1' },
            replaceUrl: true,
          });
        }
      });
    });
  }
}
