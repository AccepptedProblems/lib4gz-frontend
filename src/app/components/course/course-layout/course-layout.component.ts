import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { forkJoin } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CourseService,
  ModuleService,
  EnrollmentService,
  LessonService,
} from '../../../services';
import {
  CourseResponse,
  ModuleResponse,
  EnrollmentResponse,
  LessonResponse,
  EnrollmentRole,
  EnrollmentStatus,
} from '../../../shared/models';
import {
  ButtonComponent,
  SkeletonComponent,
  SpinnerComponent,
} from '../../../shared/components';

type ScreenState = 'loading' | 'loaded' | 'error';

interface ModuleWithLessons {
  module: ModuleResponse;
  lessons: LessonResponse[];
  expanded: boolean;
  lessonsLoading: boolean;
}

@Component({
  selector: 'app-course-layout',
  imports: [
    RouterOutlet,
    ButtonComponent,
    SkeletonComponent,
    SpinnerComponent,
  ],
  templateUrl: './course-layout.component.html',
  styleUrl: './course-layout.component.scss',
})
export class CourseLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseService = inject(CourseService);
  private readonly moduleService = inject(ModuleService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly lessonService = inject(LessonService);

  readonly EnrollmentRole = EnrollmentRole;

  courseId = signal('');
  screenState = signal<ScreenState>('loading');
  errorMessage = signal('');

  course = signal<CourseResponse | null>(null);
  modulesWithLessons = signal<ModuleWithLessons[]>([]);
  myEnrollment = signal<EnrollmentResponse | null>(null);

  // Track active lesson from URL
  activeLessonId = signal<string | null>(null);

  sidebarOpen = signal(false);

  isTeacher = computed(() => this.myEnrollment()?.role === EnrollmentRole.TEACHER);
  isEnrolled = computed(() => !!this.myEnrollment());
  isContentLocked = computed(() => {
    const enrollment = this.myEnrollment();
    if (!enrollment) return true;
    return enrollment.status !== EnrollmentStatus.ACTIVE;
  });

  enrollmentBadgeLabel = computed(() => {
    const status = this.myEnrollment()?.status;
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
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadCourse(id);
      }
    });

    // Watch router events to extract lessonId from URL
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(e => {
      this.extractLessonIdFromUrl(e.urlAfterRedirects);
    });

    // Also extract from current URL on init
    this.extractLessonIdFromUrl(this.router.url);
  }

  private extractLessonIdFromUrl(url: string): void {
    const match = url.match(/\/lesson\/([^/?]+)/);
    this.activeLessonId.set(match ? match[1] : null);
  }

  toggleModule(index: number): void {
    const modules = [...this.modulesWithLessons()];
    modules[index] = { ...modules[index], expanded: !modules[index].expanded };

    if (modules[index].expanded && modules[index].lessons.length === 0 && !modules[index].lessonsLoading) {
      modules[index] = { ...modules[index], lessonsLoading: true };
      this.modulesWithLessons.set(modules);
      this.loadLessonsForModule(index, modules[index].module.id);
      return;
    }

    this.modulesWithLessons.set(modules);
  }

  navigateToLesson(lesson: LessonResponse, moduleIndex: number, lessonIndex: number): void {
    if (this.isContentLocked()) return;
    const prefix = `${moduleIndex + 1}.${lessonIndex + 1}`;
    this.sidebarOpen.set(false);
    this.router.navigate(['lesson', lesson.id], {
      relativeTo: this.route,
      queryParams: { tab: 'summary', prefix },
    });
  }

  navigateToManage(): void {
    this.router.navigate(['/course', this.courseId(), 'manage']);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  retry(): void {
    this.loadCourse(this.courseId());
  }

  private loadCourse(courseId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');

    forkJoin({
      course: this.courseService.get(courseId),
      modules: this.moduleService.listByCourse(courseId),
      enrollment: this.enrollmentService.getMyEnrollment(courseId).pipe(
        catchError(() => of(null))
      ),
    }).subscribe({
      next: ({ course, modules, enrollment }) => {
        this.course.set(course);
        this.myEnrollment.set(enrollment);

        const sortedModules = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
        const modulesWithLessons: ModuleWithLessons[] = sortedModules.map((m, i) => ({
          module: m,
          lessons: [],
          expanded: i === 0,
          lessonsLoading: i === 0,
        }));
        this.modulesWithLessons.set(modulesWithLessons);
        this.screenState.set('loaded');

        if (sortedModules.length > 0) {
          this.loadLessonsForModule(0, sortedModules[0].id);
        }
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load course. Please try again.');
        this.screenState.set('error');
      },
    });
  }

  private loadLessonsForModule(moduleIndex: number, moduleId: string): void {
    this.lessonService.listByModule(moduleId).subscribe({
      next: lessons => {
        const sorted = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);
        const modules = [...this.modulesWithLessons()];
        modules[moduleIndex] = {
          ...modules[moduleIndex],
          lessons: sorted,
          lessonsLoading: false,
        };
        this.modulesWithLessons.set(modules);
      },
      error: () => {
        const modules = [...this.modulesWithLessons()];
        modules[moduleIndex] = { ...modules[moduleIndex], lessonsLoading: false };
        this.modulesWithLessons.set(modules);
      },
    });
  }
}
