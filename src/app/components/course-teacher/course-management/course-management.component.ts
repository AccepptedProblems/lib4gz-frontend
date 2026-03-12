import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CourseService,
  ModuleService,
  LessonService,
  EnrollmentService,
  ExerciseService,
  SubmissionService,
} from '../../../services';
import {
  CourseResponse,
  ModuleResponse,
  LessonResponse,
  ExerciseResponse,
  EnrollmentResponse,
  EnrollmentStatus,
  SubmissionResponse,
  SubmissionStatus,
} from '../../../shared/models';
import {
  ButtonComponent,
  SpinnerComponent,
  SkeletonComponent,
  BadgeComponent,
  DialogComponent,
  TextareaComponent,
} from '../../../shared/components';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { LessonDetailManagementComponent } from './lesson-detail-management/lesson-detail-management.component';
import { EnrollmentManagementComponent } from './enrollment-management/enrollment-management.component';

type ScreenState = 'loading' | 'loaded' | 'error';
type ActiveView = 'course-material' | 'enrollment' | 'submissions';
type MaterialSubView = 'module-list' | 'lesson-detail';

interface ModuleWithLessons {
  module: ModuleResponse;
  lessons: LessonResponse[];
  expanded: boolean;
  lessonsLoaded: boolean;
}

interface SelectedLesson {
  lesson: LessonResponse;
  moduleTitle: string;
}

interface SidebarNavItem {
  id: ActiveView;
  label: string;
  icon: string;
  badge: number | null;
}

interface SubmissionWithExercise extends SubmissionResponse {
  exerciseTitle: string;
}

@Component({
  selector: 'app-course-management',
  imports: [
    FormsModule,
    DatePipe,
    ButtonComponent,
    SpinnerComponent,
    SkeletonComponent,
    BadgeComponent,
    DialogComponent,
    TextareaComponent,
    LessonDetailManagementComponent,
    EnrollmentManagementComponent,
  ],
  templateUrl: './course-management.component.html',
  styleUrl: './course-management.component.scss',
})
export class CourseManagementComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseService = inject(CourseService);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly submissionService = inject(SubmissionService);
  private readonly toast = inject(ToastService);

  readonly Math = Math;
  readonly SubmissionStatus = SubmissionStatus;

  // Core state
  courseId = signal('');
  screenState = signal<ScreenState>('loading');
  errorMessage = signal('');
  activeView = signal<ActiveView>('course-material');
  materialSubView = signal<MaterialSubView>('module-list');

  // Data
  course = signal<CourseResponse | null>(null);
  modulesWithLessons = signal<ModuleWithLessons[]>([]);
  enrollments = signal<EnrollmentResponse[]>([]);
  submissions = signal<SubmissionWithExercise[]>([]);
  submissionsLoaded = signal(false);
  submissionsLoading = signal(false);

  // Lesson detail sub-view
  selectedLesson = signal<SelectedLesson | null>(null);
  private pendingLessonId = signal<string | null>(null);

  // Mobile sidebar
  sidebarOpen = signal(false);

  // Content — inline forms
  showAddModuleForm = signal(false);
  newModuleTitle = signal('');
  addingModule = signal(false);

  editingModuleId = signal<string | null>(null);
  editModuleTitle = signal('');
  savingModule = signal(false);

  addingLessonModuleId = signal<string | null>(null);
  newLessonTitle = signal('');
  addingLesson = signal(false);

  editingLessonId = signal<string | null>(null);
  editLessonTitle = signal('');
  savingLesson = signal(false);

  // Delete dialog
  deleteDialogOpen = signal(false);
  deleteType = signal<'module' | 'lesson'>('module');
  deleteEntityName = signal('');
  deleteEntityId = signal('');
  deleteModuleId = signal('');
  deleting = signal(false);

  // Submissions
  submissionExerciseFilter = signal<string>('All');
  submissionStatusFilter = signal<string>('All');
  submissionPage = signal(1);
  readonly submissionPageSize = 20;

  // Course edit mode
  editingCourse = signal(false);
  editCourseTitle = signal('');
  editCourseDescription = signal('');
  savingCourse = signal(false);

  // Computed: pending enrollment count for badge
  pendingEnrollmentCount = computed(() =>
    this.enrollments().filter(e => e.status === EnrollmentStatus.PENDING).length
  );

  // Computed: sidebar nav items
  navItems = computed<SidebarNavItem[]>(() => [
    { id: 'course-material', label: 'Course Material', icon: 'menu_book', badge: null },
    { id: 'enrollment', label: 'Enrollment', icon: 'group', badge: this.pendingEnrollmentCount() || null },
    { id: 'submissions', label: 'Submissions', icon: 'assignment', badge: null },
  ]);

  totalLessonCount = computed(() => {
    return this.modulesWithLessons().reduce((sum, m) => sum + (m.module.lessonCount ?? m.lessons.length), 0);
  });

  totalSubmissionCount = computed(() => {
    return this.submissions().length;
  });

  // Computed: all exercises (for submission filter)
  allExercises = computed(() => {
    return this._allLoadedExercises();
  });

  // Internal store of all loaded exercises across modules
  private _allLoadedExercises = signal<ExerciseResponse[]>([]);

  // Computed: filtered submissions
  filteredSubmissions = computed(() => {
    let list = this.submissions();
    const exerciseFilter = this.submissionExerciseFilter();
    const statusFilter = this.submissionStatusFilter();

    if (exerciseFilter !== 'All') {
      list = list.filter(s => s.exerciseId === exerciseFilter);
    }
    if (statusFilter !== 'All') {
      list = list.filter(s => s.status === statusFilter);
    }
    return list;
  });

  paginatedSubmissions = computed(() => {
    const all = this.filteredSubmissions();
    const start = (this.submissionPage() - 1) * this.submissionPageSize;
    return all.slice(start, start + this.submissionPageSize);
  });

  submissionTotalPages = computed(() => Math.ceil(this.filteredSubmissions().length / this.submissionPageSize) || 1);

  ngOnInit(): void {
    // Check for incoming lessonId from router state (e.g., back from exercise editor)
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras.state ?? history.state;
    if (state?.['lessonId']) {
      this.pendingLessonId.set(state['lessonId']);
    }

    const parentRoute = this.route.parent;
    const paramMap = parentRoute?.paramMap ?? this.route.paramMap;

    paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadInitialData(id);
      }
    });
  }

  // ── View Navigation ─────────────────────────────────────────────
  switchView(viewId: ActiveView): void {
    this.activeView.set(viewId);
    if (viewId === 'course-material') {
      this.materialSubView.set('module-list');
      this.selectedLesson.set(null);
    }
    if (viewId === 'submissions' && !this.submissionsLoaded()) {
      this.loadSubmissions();
    }
    this.closeSidebar();
  }

  // ── Sidebar ──────────────────────────────────────────────────────
  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  // ── Course Edit ──────────────────────────────────────────────────
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

  // ── Module CRUD ──────────────────────────────────────────────────
  toggleModule(index: number): void {
    const modules = [...this.modulesWithLessons()];
    const m = modules[index];
    modules[index] = { ...m, expanded: !m.expanded };

    if (!m.expanded && !m.lessonsLoaded) {
      this.modulesWithLessons.set(modules);
      this.loadLessonsForModule(index, m.module.id);
      return;
    }
    this.modulesWithLessons.set(modules);
  }

  showAddModule(): void {
    this.showAddModuleForm.set(true);
    this.newModuleTitle.set('');
  }

  cancelAddModule(): void {
    this.showAddModuleForm.set(false);
    this.newModuleTitle.set('');
  }

  submitAddModule(): void {
    const title = this.newModuleTitle().trim();
    if (!title) return;
    this.addingModule.set(true);
    this.moduleService.create(this.courseId(), { title }).subscribe({
      next: newModule => {
        this.modulesWithLessons.update(mods => [...mods, {
          module: newModule,
          lessons: [],
          expanded: false,
          lessonsLoaded: true,
        }]);
        this.showAddModuleForm.set(false);
        this.newModuleTitle.set('');
        this.addingModule.set(false);
        this.toast.success('Module created');
      },
      error: () => {
        this.addingModule.set(false);
        this.toast.error('Failed to create module');
      },
    });
  }

  startEditModule(moduleId: string, currentTitle: string): void {
    this.editingModuleId.set(moduleId);
    this.editModuleTitle.set(currentTitle);
  }

  cancelEditModule(): void {
    this.editingModuleId.set(null);
  }

  saveEditModule(moduleId: string, moduleIndex: number): void {
    const title = this.editModuleTitle().trim();
    if (!title) return;
    this.savingModule.set(true);
    this.moduleService.update(moduleId, { title }).subscribe({
      next: updated => {
        const modules = [...this.modulesWithLessons()];
        modules[moduleIndex] = { ...modules[moduleIndex], module: updated };
        this.modulesWithLessons.set(modules);
        this.editingModuleId.set(null);
        this.savingModule.set(false);
        this.toast.success('Module updated');
      },
      error: () => {
        this.savingModule.set(false);
        this.toast.error('Failed to update module');
      },
    });
  }

  // ── Lesson CRUD ──────────────────────────────────────────────────
  showAddLesson(moduleId: string): void {
    this.addingLessonModuleId.set(moduleId);
    this.newLessonTitle.set('');
  }

  cancelAddLesson(): void {
    this.addingLessonModuleId.set(null);
    this.newLessonTitle.set('');
  }

  submitAddLesson(moduleId: string, moduleIndex: number): void {
    const title = this.newLessonTitle().trim();
    if (!title) return;
    this.addingLesson.set(true);
    this.lessonService.create(moduleId, { title }).subscribe({
      next: newLesson => {
        const modules = [...this.modulesWithLessons()];
        modules[moduleIndex] = {
          ...modules[moduleIndex],
          lessons: [...modules[moduleIndex].lessons, newLesson],
        };
        this.modulesWithLessons.set(modules);
        this.addingLessonModuleId.set(null);
        this.newLessonTitle.set('');
        this.addingLesson.set(false);
        this.toast.success('Lesson created');
      },
      error: () => {
        this.addingLesson.set(false);
        this.toast.error('Failed to create lesson');
      },
    });
  }

  startEditLesson(lessonId: string, currentTitle: string): void {
    this.editingLessonId.set(lessonId);
    this.editLessonTitle.set(currentTitle);
  }

  cancelEditLesson(): void {
    this.editingLessonId.set(null);
  }

  saveEditLesson(lessonId: string, moduleIndex: number, lessonIndex: number): void {
    const title = this.editLessonTitle().trim();
    if (!title) return;
    this.savingLesson.set(true);
    this.lessonService.update(lessonId, { title }).subscribe({
      next: updated => {
        const modules = [...this.modulesWithLessons()];
        const lessons = [...modules[moduleIndex].lessons];
        lessons[lessonIndex] = updated;
        modules[moduleIndex] = { ...modules[moduleIndex], lessons };
        this.modulesWithLessons.set(modules);
        this.editingLessonId.set(null);
        this.savingLesson.set(false);
        this.toast.success('Lesson updated');
      },
      error: () => {
        this.savingLesson.set(false);
        this.toast.error('Failed to update lesson');
      },
    });
  }

  // ── Lesson Detail Sub-View ─────────────────────────────────────
  enterLessonDetail(lesson: LessonResponse, moduleTitle: string): void {
    this.materialSubView.set('lesson-detail');
    this.selectedLesson.set({ lesson, moduleTitle });
  }

  backToModules(): void {
    this.materialSubView.set('module-list');
    this.selectedLesson.set(null);
  }

  onLessonUpdated(updated: LessonResponse): void {
    // Update the lesson in the module list
    this.modulesWithLessons.update(mods => mods.map(m => ({
      ...m,
      lessons: m.lessons.map(l => l.id === updated.id ? updated : l),
    })));
    // Update the selected lesson reference
    const sel = this.selectedLesson();
    if (sel && sel.lesson.id === updated.id) {
      this.selectedLesson.set({ ...sel, lesson: updated });
    }
  }

  onExerciseDeleted(exerciseId: string): void {
    this._allLoadedExercises.update(list => list.filter(e => e.id !== exerciseId));
  }

  // ── Delete ───────────────────────────────────────────────────────
  confirmDeleteModule(moduleId: string, name: string): void {
    this.deleteType.set('module');
    this.deleteEntityName.set(name);
    this.deleteEntityId.set(moduleId);
    this.deleteDialogOpen.set(true);
  }

  confirmDeleteLesson(lessonId: string, name: string, moduleId: string): void {
    this.deleteType.set('lesson');
    this.deleteEntityName.set(name);
    this.deleteEntityId.set(lessonId);
    this.deleteModuleId.set(moduleId);
    this.deleteDialogOpen.set(true);
  }

  cancelDelete(): void {
    this.deleteDialogOpen.set(false);
  }

  executeDelete(): void {
    this.deleting.set(true);
    const id = this.deleteEntityId();
    const type = this.deleteType();

    const actions: Record<string, () => void> = {
      module: () => this.moduleService.delete(id).subscribe({
        next: () => {
          this.modulesWithLessons.update(mods => mods.filter(m => m.module.id !== id));
          this.finishDelete('Module deleted');
        },
        error: () => this.failDelete('Failed to delete module'),
      }),
      lesson: () => this.lessonService.delete(id).subscribe({
        next: () => {
          this.modulesWithLessons.update(mods => mods.map(m => ({
            ...m,
            lessons: m.lessons.filter(l => l.id !== id),
          })));
          // If in lesson detail for this lesson, go back
          if (this.selectedLesson()?.lesson.id === id) {
            this.backToModules();
          }
          this.finishDelete('Lesson deleted');
        },
        error: () => this.failDelete('Failed to delete lesson'),
      }),
    };

    actions[type]();
  }

  private finishDelete(msg: string): void {
    this.deleting.set(false);
    this.deleteDialogOpen.set(false);
    this.toast.success(msg);
  }

  private failDelete(msg: string): void {
    this.deleting.set(false);
    this.toast.error(msg);
  }

  // ── Enrollment events (from child) ──────────────────────────────
  onEnrollmentUpdated(updated: EnrollmentResponse): void {
    this.enrollments.update(list =>
      list.map(e => e.id === updated.id ? updated : e)
    );
  }

  onEnrollmentRemoved(enrollmentId: string): void {
    this.enrollments.update(list => list.filter(e => e.id !== enrollmentId));
  }

  // ── Submission filters ───────────────────────────────────────────
  setSubmissionExerciseFilter(event: Event): void {
    this.submissionExerciseFilter.set((event.target as HTMLSelectElement).value);
    this.submissionPage.set(1);
  }

  setSubmissionStatusFilter(event: Event): void {
    this.submissionStatusFilter.set((event.target as HTMLSelectElement).value);
    this.submissionPage.set(1);
  }

  // ── Navigation ───────────────────────────────────────────────────
  navigateBackToCourse(): void {
    this.router.navigate(['/course', this.courseId()]);
  }

  // ── Badge variant helpers ────────────────────────────────────────
  getSubmissionBadgeVariant(status: SubmissionStatus): 'success' | 'warning' | 'error' | 'neutral' {
    const map: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
      [SubmissionStatus.APPROVED]: 'success',
      [SubmissionStatus.SUBMITTED]: 'warning',
      [SubmissionStatus.NEEDS_REVISION]: 'error',
      [SubmissionStatus.DRAFT]: 'neutral',
    };
    return map[status] ?? 'neutral';
  }

  // ── Retry ────────────────────────────────────────────────────────
  retry(): void {
    this.loadInitialData(this.courseId());
  }

  // ── Data Loading ─────────────────────────────────────────────────
  private loadInitialData(courseId: string): void {
    this.screenState.set('loading');
    this.errorMessage.set('');

    forkJoin({
      course: this.courseService.get(courseId),
      modules: this.moduleService.listByCourse(courseId),
      enrollments: this.enrollmentService.listByCourse(courseId).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ course, modules, enrollments }) => {
        this.course.set(course);
        this.enrollments.set(enrollments);

        const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
        const modulesWithLessons: ModuleWithLessons[] = sorted.map((m, i) => ({
          module: m,
          lessons: [],
          expanded: i === 0,
          lessonsLoaded: false,
        }));
        this.modulesWithLessons.set(modulesWithLessons);
        this.screenState.set('loaded');

        // Load lessons — if returning to a specific lesson, load all modules
        if (this.pendingLessonId() && sorted.length > 0) {
          sorted.forEach((m, i) => this.loadLessonsForModule(i, m.id));
        } else if (sorted.length > 0) {
          this.loadLessonsForModule(0, sorted[0].id);
        }
      },
      error: err => {
        this.errorMessage.set(err.error?.message || 'Failed to load course data. Please try again.');
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
          lessonsLoaded: true,
        };
        this.modulesWithLessons.set(modules);

        // Auto-select lesson if returning from exercise editor
        const pending = this.pendingLessonId();
        if (pending) {
          const match = sorted.find(l => l.id === pending);
          if (match) {
            this.pendingLessonId.set(null);
            this.enterLessonDetail(match, modules[moduleIndex].module.title);
          }
        }
      },
      error: () => {
        const modules = [...this.modulesWithLessons()];
        modules[moduleIndex] = { ...modules[moduleIndex], lessonsLoaded: true };
        this.modulesWithLessons.set(modules);
      },
    });
  }

  private loadSubmissions(): void {
    this.submissionsLoading.set(true);

    // First collect all exercises across all loaded modules
    const exerciseRequests: Record<string, { title: string; observable: ReturnType<SubmissionService['listByExercise']> }> = {};

    // We need exercises from all modules - load them if not already loaded
    const modules = this.modulesWithLessons();
    const lessonIds: string[] = [];
    for (const m of modules) {
      for (const l of m.lessons) {
        lessonIds.push(l.id);
      }
    }

    if (lessonIds.length === 0) {
      this.submissionsLoaded.set(true);
      this.submissionsLoading.set(false);
      return;
    }

    // Fetch exercises for all lessons, then fetch submissions
    const exerciseCalls = lessonIds.reduce((acc, lessonId) => {
      acc[lessonId] = this.exerciseService.listByLesson(lessonId).pipe(catchError(() => of([])));
      return acc;
    }, {} as Record<string, ReturnType<ExerciseService['listByLesson']>>);

    forkJoin(exerciseCalls).subscribe({
      next: exerciseResults => {
        const allExercises: ExerciseResponse[] = [];
        for (const lessonId of lessonIds) {
          const exercises = exerciseResults[lessonId] as ExerciseResponse[];
          allExercises.push(...exercises);
        }
        this._allLoadedExercises.set(allExercises);

        if (allExercises.length === 0) {
          this.submissionsLoaded.set(true);
          this.submissionsLoading.set(false);
          return;
        }

        const subCalls = allExercises.reduce((acc, ex) => {
          acc[ex.id] = this.submissionService.listByExercise(ex.id).pipe(catchError(() => of([])));
          return acc;
        }, {} as Record<string, ReturnType<SubmissionService['listByExercise']>>);

        forkJoin(subCalls).subscribe({
          next: results => {
            const allSubs: SubmissionWithExercise[] = [];
            for (const ex of allExercises) {
              const subs = results[ex.id] as SubmissionResponse[];
              for (const s of subs) {
                allSubs.push({ ...s, exerciseTitle: ex.title });
              }
            }
            allSubs.sort((a, b) => (b.submittedAt ?? b.createdAt) - (a.submittedAt ?? a.createdAt));
            this.submissions.set(allSubs);
            this.submissionsLoaded.set(true);
            this.submissionsLoading.set(false);
          },
          error: () => {
            this.submissionsLoaded.set(true);
            this.submissionsLoading.set(false);
          },
        });
      },
      error: () => {
        this.submissionsLoaded.set(true);
        this.submissionsLoading.set(false);
      },
    });
  }
}
