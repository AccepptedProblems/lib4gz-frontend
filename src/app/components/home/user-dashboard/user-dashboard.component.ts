import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CourseService } from '../../../services/course.service';
import { EnrollmentService } from '../../../services/enrollment.service';
import { AuthService } from '../../../services/auth.service';
import { MeService } from '../../../services/me.service';
import { ProgressService, LastVisitedLesson } from '../../../services/progress.service';
import { CourseResponse, Visibility, UserRole } from '../../../shared/models';
import { ButtonComponent, CardComponent, EmptyStateComponent, InputComponent, ProgressBarComponent, SideSheetComponent, SkeletonComponent, TextareaComponent } from '../../../shared/components';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { apiErrorMessage } from '../../../shared/utils/api-error';

type Tab = 'enrolled' | 'created';

@Component({
  selector: 'app-user-dashboard',
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent, EmptyStateComponent, InputComponent, ProgressBarComponent, SideSheetComponent, SkeletonComponent, TextareaComponent],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss'
})
export class UserDashboardComponent implements OnInit {
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly meService = inject(MeService);
  private readonly progressService = inject(ProgressService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly visibilityOptions = Object.values(Visibility);

  userName = signal('');
  activeTab = signal<Tab>('enrolled');
  isLoading = signal(true);
  isCreating = signal(false);
  showCreateDialog = signal(false);
  createError = signal('');
  errorMessage = signal('');

  // Search by code
  searchCodeInput = signal('');
  showDropdown = signal(false);
  isSearching = signal(false);
  searchError = signal('');

  // Course preview dialog
  showCoursePreview = signal(false);
  previewCourse = signal<CourseResponse | null>(null);
  isApplying = signal(false);
  applyError = signal('');
  applySuccess = signal(false);

  canCreateCourse = computed(() => this.authService.hasRole(UserRole.TEACHER, UserRole.ADMIN));

  createForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    visibility: [Visibility.PUBLIC],
  });

  enrolledCourses = signal<CourseResponse[]>([]);
  createdCourses = signal<CourseResponse[]>([]);

  private readonly searchSubject = new Subject<string>();

  matchingEnrolledCourses = computed(() => {
    const input = this.searchCodeInput().trim();
    if (!input) return [];
    return this.enrolledCourses().filter(c => c.code.startsWith(input));
  });

  filteredCourses = computed(() => {
    return this.activeTab() === 'enrolled'
      ? this.enrolledCourses()
      : this.createdCourses();
  });

  /**
   * "Continue learning" resume card (UX plan 1.5). Server resume state
   * (`course.progress.lastVisited*`, cross-device) and this device's
   * localStorage entry are both candidates — the most recent one wins, so a
   * visit on another device surfaces here while a just-made local visit still
   * shows instantly without a refetch.
   */
  resumeInfo = computed(() => {
    let best: { visit: LastVisitedLesson; course: CourseResponse } | null = null;

    for (const course of this.enrolledCourses()) {
      const progress = course.progress;
      if (!progress?.lastVisitedLessonId || !progress.lastVisitedLessonTitle) continue;
      const visit: LastVisitedLesson = {
        courseId: course.id,
        courseTitle: course.title,
        lessonId: progress.lastVisitedLessonId,
        lessonTitle: progress.lastVisitedLessonTitle,
        prefix: null,
        updatedAt: progress.lastVisitedAt ?? 0,
      };
      if (!best || visit.updatedAt > best.visit.updatedAt) best = { visit, course };
    }

    const local = this.progressService.lastVisited();
    if (local) {
      const course = this.enrolledCourses().find(c => c.id === local.courseId);
      if (course && (!best || local.updatedAt > best.visit.updatedAt)) {
        best = { visit: local, course };
      }
    }

    if (!best) return null;
    return { ...best, percent: this.courseProgress(best.course) };
  });

  /**
   * Server-derived percent (done exercises over exercise-bearing lessons) when
   * available; localStorage-derived otherwise. `totalLessons === 0` means no
   * gradable content — show 0 rather than a fake 100.
   */
  courseProgress(course: CourseResponse): number {
    const progress = course.progress;
    if (progress && progress.totalLessons > 0) {
      return Math.min(100, Math.round((progress.completedLessons / progress.totalLessons) * 100));
    }
    return this.progressService.percent(course.id);
  }

  /**
   * Zero-asset card art (UX plan 3.1): a gradient + initials derived from the course
   * code hash, so every card is stable across sessions but visually distinct.
   */
  private static readonly CARD_GRADIENTS: ReadonlyArray<[string, string]> = [
    ['#00695c', '#26a69a'], // deep teal
    ['#00838f', '#4dd0e1'], // cyan
    ['#2e7d32', '#81c784'], // green
    ['#5c6bc0', '#9fa8da'], // indigo
    ['#00796b', '#80cbc4'], // mint
    ['#455a64', '#90a4ae'], // blue-grey
    ['#6d4c41', '#bcaaa4'], // warm brown
    ['#7b1fa2', '#ce93d8'], // plum
  ];

  courseGradient(course: CourseResponse): string {
    const hash = [...course.code].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const [from, to] = UserDashboardComponent.CARD_GRADIENTS[hash % UserDashboardComponent.CARD_GRADIENTS.length];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  courseInitials(course: CourseResponse): string {
    return course.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0].toUpperCase())
      .join('');
  }

  resumeLearning(): void {
    const info = this.resumeInfo();
    if (!info) return;
    this.router.navigate(['/course', info.visit.courseId, 'lesson', info.visit.lessonId], {
      queryParams: info.visit.prefix ? { prefix: info.visit.prefix } : {},
    });
  }

  ngOnInit(): void {
    this.userName.set(this.authService.getUserName());
    this.loadCourses();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => {
      this.searchCodeInput.set(query);
      this.searchError.set('');
      this.showDropdown.set(query.trim().length > 0);
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    const code = this.searchCodeInput().trim();
    if (!code) return;

    const matches = this.matchingEnrolledCourses();
    if (matches.length === 1 && matches[0].code === code) {
      this.navigateToCourse(matches[0]);
      return;
    }

    const exactEnrolled = this.enrolledCourses().find(c => c.code === code);
    if (exactEnrolled) {
      this.navigateToCourse(exactEnrolled);
      return;
    }

    this.showDropdown.set(false);
    this.isSearching.set(true);
    this.searchError.set('');
    this.courseService.getByCode(code).subscribe({
      next: course => {
        this.isSearching.set(false);
        const enrolled = this.enrolledCourses().find(c => c.id === course.id);
        if (enrolled) {
          this.router.navigate(['/course', course.id]);
        } else {
          this.previewCourse.set(course);
          this.showCoursePreview.set(true);
        }
      },
      error: () => {
        this.isSearching.set(false);
        this.searchError.set('Course not found');
      }
    });
  }

  selectDropdownCourse(course: CourseResponse): void {
    this.showDropdown.set(false);
    this.searchCodeInput.set('');
    this.searchSubject.next('');
    this.router.navigate(['/course', course.id]);
  }

  hideDropdown(): void {
    setTimeout(() => this.showDropdown.set(false), 150);
  }

  switchTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  navigateToCourse(course: CourseResponse): void {
    if (this.activeTab() === 'created') {
      this.router.navigate(['/course', course.id, 'manage']);
    } else {
      this.router.navigate(['/course', course.id]);
    }
  }

  openCreateDialog(): void {
    this.showCreateDialog.set(true);
  }

  onCreateCancel(): void {
    this.showCreateDialog.set(false);
    this.createForm.reset({ title: '', description: '', visibility: Visibility.PUBLIC });
    this.createError.set('');
  }

  onCreateConfirm(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const { title, description, visibility } = this.createForm.getRawValue();
    this.isCreating.set(true);
    this.createError.set('');
    this.courseService.create({
      title,
      description: description || null,
      visibility,
    }).subscribe({
      next: course => {
        this.isCreating.set(false);
        this.showCreateDialog.set(false);
        this.createForm.reset({ title: '', description: '', visibility: Visibility.PUBLIC });
        this.toast.success('Course created successfully');
        this.router.navigate(['/course', course.id, 'manage']);
      },
      error: err => {
        this.isCreating.set(false);
        this.createError.set(apiErrorMessage(err, 'Failed to create course. Please try again.'));
        this.toast.error('Failed to create course');
      }
    });
  }

  onApplyConfirm(): void {
    const course = this.previewCourse();
    if (!course) return;
    this.isApplying.set(true);
    this.applyError.set('');
    this.applySuccess.set(false);
    this.enrollmentService.enroll(course.id).subscribe({
      next: () => {
        this.isApplying.set(false);
        this.applySuccess.set(true);
        this.toast.success('Enrollment request sent');
        this.loadCourses();
        setTimeout(() => {
          this.showCoursePreview.set(false);
          this.previewCourse.set(null);
          this.applySuccess.set(false);
          this.searchCodeInput.set('');
          this.searchSubject.next('');
        }, 1500);
      },
      error: err => {
        this.isApplying.set(false);
        this.applyError.set(apiErrorMessage(err, 'Failed to apply. Please try again.'));
        this.toast.error('Failed to send enrollment request');
      }
    });
  }

  onPreviewCancel(): void {
    this.showCoursePreview.set(false);
    this.previewCourse.set(null);
    this.applyError.set('');
    this.applySuccess.set(false);
  }

  retry(): void {
    this.loadCourses();
  }

  clearSearch(): void {
    this.searchCodeInput.set('');
    this.searchSubject.next('');
    this.showDropdown.set(false);
    this.searchError.set('');
  }

  // One round-trip: `GET /v1/users/me/courses` returns both lists in a single response.
  private loadCourses(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.meService.getCourses().subscribe({
      next: ({ enrolled, created }) => {
        this.enrolledCourses.set(enrolled);
        this.createdCourses.set(created);
        if (enrolled.length === 0 && created.length > 0) {
          this.activeTab.set('created');
        }
        this.isLoading.set(false);
      },
      error: err => {
        this.errorMessage.set(apiErrorMessage(err, 'Failed to load courses. Please try again.'));
        this.isLoading.set(false);
      }
    });
  }
}
