import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CourseService } from '../../../services/course.service';
import { EnrollmentService } from '../../../services/enrollment.service';
import { AuthService } from '../../../services/auth.service';
import { CourseResponse, Visibility, UserRole } from '../../../shared/models';
import { ButtonComponent, DialogComponent, InputComponent, TextareaComponent } from '../../../shared/components';

type Tab = 'enrolled' | 'created';

@Component({
  selector: 'app-user-dashboard',
  imports: [ReactiveFormsModule, ButtonComponent, DialogComponent, InputComponent, TextareaComponent],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss'
})
export class UserDashboardComponent implements OnInit {
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

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
        this.router.navigate(['/course', course.id, 'manage']);
      },
      error: err => {
        this.isCreating.set(false);
        this.createError.set(err.error?.message || 'Failed to create course. Please try again.');
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
        this.applyError.set(err.error?.message || 'Failed to apply. Please try again.');
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

  private loadCourses(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    let enrolledDone = false;
    let createdDone = false;
    const checkDone = () => {
      if (enrolledDone && createdDone) {
        this.isLoading.set(false);
        if (this.enrolledCourses().length === 0 && this.createdCourses().length > 0) {
          this.activeTab.set('created');
        }
      }
    };

    this.courseService.list('enrolled').subscribe({
      next: courses => {
        this.enrolledCourses.set(courses);
        enrolledDone = true;
        checkDone();
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load courses. Please try again.');
        this.isLoading.set(false);
      }
    });

    this.courseService.list('created').subscribe({
      next: courses => {
        this.createdCourses.set(courses);
        createdDone = true;
        checkDone();
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load courses. Please try again.');
        this.isLoading.set(false);
      }
    });
  }
}
