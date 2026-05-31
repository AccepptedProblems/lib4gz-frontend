import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CourseService,
  ModuleService,
  LessonService,
} from '../../../services';
import {
  LessonResponse,
  ModuleResponse,
  SyllabusModule,
} from '../../../shared/models';
import {
  ButtonComponent,
  SkeletonComponent,
  DialogComponent,
  EmptyStateComponent,
} from '../../../shared/components';
import { ToastService } from '../../../shared/components/toast/toast.component';

/**
 * Teacher screen for managing modules and lessons.
 *
 * Initial load uses the syllabus aggregate (`GET /v1/courses/{id}/syllabus`) so all
 * modules and their lessons arrive in a single response — no lazy expand-time fetch.
 * Mutations still hit the granular endpoints (module create/update/delete, lesson
 * create/update/delete) because they need their own validation and idempotency
 * semantics — we deliberately did not merge them.
 */
interface ModuleWithLessons {
  module: ModuleResponse;
  lessons: LessonResponse[];
  expanded: boolean;
}

@Component({
  selector: 'app-course-material',
  imports: [
    FormsModule,
    ButtonComponent,
    SkeletonComponent,
    DialogComponent,
    EmptyStateComponent,
  ],
  templateUrl: './course-material.component.html',
  styleUrl: './course-material.component.scss',
})
export class CourseMaterialComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly courseService = inject(CourseService);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly toast = inject(ToastService);

  courseId = signal('');
  modulesWithLessons = signal<ModuleWithLessons[]>([]);
  loading = signal(true);

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

  deleteDialogOpen = signal(false);
  deleteType = signal<'module' | 'lesson'>('module');
  deleteEntityName = signal('');
  deleteEntityId = signal('');
  deleteModuleId = signal('');
  deleting = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadSyllabus(id);
      }
    });
  }

  toggleModule(index: number): void {
    this.modulesWithLessons.update(mods => {
      const next = [...mods];
      next[index] = { ...next[index], expanded: !next[index].expanded };
      return next;
    });
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
        this.modulesWithLessons.update(mods => {
          const next = [...mods];
          next[moduleIndex] = { ...next[moduleIndex], module: updated };
          return next;
        });
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
        this.modulesWithLessons.update(mods => {
          const next = [...mods];
          next[moduleIndex] = {
            ...next[moduleIndex],
            lessons: [...next[moduleIndex].lessons, newLesson],
          };
          return next;
        });
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
        this.modulesWithLessons.update(mods => {
          const next = [...mods];
          const lessons = [...next[moduleIndex].lessons];
          lessons[lessonIndex] = updated;
          next[moduleIndex] = { ...next[moduleIndex], lessons };
          return next;
        });
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

  enterLessonDetail(lesson: LessonResponse): void {
    this.router.navigate(['lesson', lesson.id], { relativeTo: this.route });
  }

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

  /**
   * Single round-trip: course + all modules + all lessons.
   * Replaces the previous `listByCourse` + per-module lazy load.
   */
  private loadSyllabus(courseId: string): void {
    this.loading.set(true);
    this.courseService.getSyllabus(courseId).subscribe({
      next: ({ modules }) => {
        this.modulesWithLessons.set(modules.map((m, i) => toRow(m, i === 0)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}

function toRow(module: SyllabusModule, expanded: boolean): ModuleWithLessons {
  return {
    module: {
      id: module.id,
      courseId: module.courseId,
      title: module.title,
      orderIndex: module.orderIndex,
      lessonCount: module.lessonCount,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    },
    lessons: module.lessons,
    expanded,
  };
}
