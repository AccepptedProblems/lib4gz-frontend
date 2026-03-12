import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CourseService,
  EnrollmentService,
} from '../../../services';
import {
  CourseResponse,
  EnrollmentResponse,
  EnrollmentStatus,
} from '../../../shared/models';
import {
  ButtonComponent,
  SpinnerComponent,
  TextareaComponent,
} from '../../../shared/components';
import { ToastService } from '../../../shared/components/toast/toast.component';

type ScreenState = 'loading' | 'loaded' | 'error';

type ActiveView = 'material' | 'enrollment' | 'submissions';

interface SidebarNavItem {
  id: ActiveView;
  label: string;
  icon: string;
  badge: number | null;
  routePath: string;
}

@Component({
  selector: 'app-manage-layout',
  imports: [
    RouterOutlet,
    FormsModule,
    ButtonComponent,
    SpinnerComponent,
    TextareaComponent,
  ],
  templateUrl: './manage-layout.component.html',
  styleUrl: './manage-layout.component.scss',
})
export class ManageLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly toast = inject(ToastService);

  courseId = signal('');
  screenState = signal<ScreenState>('loading');
  errorMessage = signal('');

  course = signal<CourseResponse | null>(null);
  enrollments = signal<EnrollmentResponse[]>([]);

  sidebarOpen = signal(false);

  // Active view determined by URL
  activeView = signal<ActiveView>('material');

  // Course edit mode
  editingCourse = signal(false);
  editCourseTitle = signal('');
  editCourseDescription = signal('');
  savingCourse = signal(false);

  pendingEnrollmentCount = computed(() =>
    this.enrollments().filter(e => e.status === EnrollmentStatus.PENDING).length
  );

  navItems = computed<SidebarNavItem[]>(() => [
    { id: 'material', label: 'Course Material', icon: 'menu_book', badge: null, routePath: 'material' },
    { id: 'enrollment', label: 'Enrollment', icon: 'group', badge: this.pendingEnrollmentCount() || null, routePath: 'enrollment' },
    { id: 'submissions', label: 'Submissions', icon: 'assignment', badge: null, routePath: 'submissions' },
  ]);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadInitialData(id);
      }
    });

    // Watch router events to determine active view from URL
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(e => {
      this.updateActiveView(e.urlAfterRedirects);
    });

    this.updateActiveView(this.router.url);
  }

  private updateActiveView(url: string): void {
    if (url.includes('/enrollment')) {
      this.activeView.set('enrollment');
    } else if (url.includes('/submissions')) {
      this.activeView.set('submissions');
    } else {
      this.activeView.set('material');
    }
  }

  switchView(item: SidebarNavItem): void {
    this.router.navigate([item.routePath], { relativeTo: this.route });
    this.closeSidebar();
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  startEditCourse(): void {
    const c = this.course();
    if (!c) return;
    this.editCourseTitle.set(c.title);
    this.editCourseDescription.set(c.description ?? '');
    this.editingCourse.set(true);
  }

  cancelEditCourse(): void {
    this.editingCourse.set(false);
  }

  saveEditCourse(): void {
    const title = this.editCourseTitle().trim();
    if (!title) return;
    this.savingCourse.set(true);
    this.courseService.update(this.courseId(), {
      title,
      description: this.editCourseDescription().trim() || null,
    }).subscribe({
      next: updated => {
        this.course.set(updated);
        this.editingCourse.set(false);
        this.savingCourse.set(false);
        this.toast.success('Course updated');
      },
      error: () => {
        this.savingCourse.set(false);
        this.toast.error('Failed to update course');
      },
    });
  }

  navigateBackToCourse(): void {
    this.router.navigate(['/course', this.courseId()]);
  }

  retry(): void {
    this.loadInitialData(this.courseId());
  }

  private loadInitialData(courseId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');

    forkJoin({
      course: this.courseService.get(courseId),
      enrollments: this.enrollmentService.listByCourse(courseId).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ course, enrollments }) => {
        this.course.set(course);
        this.enrollments.set(enrollments);
        this.screenState.set('loaded');
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load course data. Please try again.');
        this.screenState.set('error');
      },
    });
  }
}
