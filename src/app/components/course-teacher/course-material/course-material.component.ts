import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable, Subscription } from 'rxjs';
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
import { apiErrorMessage } from '../../../shared/utils/api-error';
import {
  NO_UNDO_WARNING,
  SubmissionCount,
  contentsWarning,
  submissionsWarning,
} from '../../../shared/utils/delete-warning';

/**
 * Teacher screen for managing modules and lessons.
 *
 * Initial load uses the syllabus aggregate (`GET /v1/courses/{id}/syllabus`) so all
 * modules and their lessons arrive in a single response — no lazy expand-time fetch.
 * Mutations still hit the granular endpoints (module create/update/delete/reorder, lesson
 * create/update/delete/reorder) because they need their own validation and idempotency
 * semantics — we deliberately did not merge them.
 */
interface ModuleWithLessons {
  module: ModuleResponse;
  lessons: LessonResponse[];
  expanded: boolean;
}

interface DeleteTarget {
  type: 'module' | 'lesson';
  id: string;
  name: string;
  /** Module only; 0 for a lesson. */
  lessonCount: number;
  exerciseCount: number;
  /** Lesson only. A lesson delete erases its summary for real; a module delete leaves them. */
  hasSummary: boolean;
}

@Component({
  selector: 'app-course-material',
  imports: [
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
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

  deleteTarget = signal<DeleteTarget | null>(null);
  deleteSubmissions = signal<SubmissionCount>('loading');
  deleting = signal(false);
  private countSub?: Subscription;

  savingOrder = signal(false);

  /** Dragging is off while a title is being edited or any save is in flight. */
  reorderLocked = computed(() =>
    this.editingModuleId() !== null ||
    this.editingLessonId() !== null ||
    this.savingOrder() ||
    this.savingModule() ||
    this.savingLesson() ||
    this.addingModule() ||
    this.addingLesson() ||
    this.deleting()
  );

  deleteContents = computed(() => {
    const t = this.deleteTarget();
    if (!t) return '';
    return t.type === 'module'
      ? contentsWarning([[t.lessonCount, 'lesson'], [t.exerciseCount, 'exercise']])
      : contentsWarning([[t.hasSummary, 'summary'], [t.exerciseCount, 'exercise']]);
  });

  deleteSubmissionsText = computed(() =>
    submissionsWarning(this.deleteSubmissions(), this.deleteTarget()?.type ?? 'module')
  );

  readonly noUndoWarning = NO_UNDO_WARNING;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadSyllabus(id);
      }
    });
    this.destroyRef.onDestroy(() => this.countSub?.unsubscribe());
  }

  toggleModule(index: number): void {
    const row = this.modulesWithLessons()[index];
    if (row.expanded) this.dropLessonEditIn(row);
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
      error: err => {
        this.addingModule.set(false);
        this.toast.error(apiErrorMessage(err, 'Failed to create module'));
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

  saveEditModule(moduleId: string): void {
    const title = this.editModuleTitle().trim();
    if (!title) return;
    this.savingModule.set(true);
    this.moduleService.update(moduleId, { title }).subscribe({
      next: updated => {
        this.updateRow(moduleId, row => ({ ...row, module: updated }));
        this.editingModuleId.set(null);
        this.savingModule.set(false);
        this.toast.success('Module updated');
      },
      error: err => {
        this.savingModule.set(false);
        this.toast.error(apiErrorMessage(err, 'Failed to update module'));
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

  submitAddLesson(moduleId: string): void {
    const title = this.newLessonTitle().trim();
    if (!title) return;
    this.addingLesson.set(true);
    this.lessonService.create(moduleId, { title }).subscribe({
      next: newLesson => {
        this.updateRow(moduleId, row => ({ ...row, lessons: [...row.lessons, newLesson] }));
        this.addingLessonModuleId.set(null);
        this.newLessonTitle.set('');
        this.addingLesson.set(false);
        this.toast.success('Lesson created');
      },
      error: err => {
        this.addingLesson.set(false);
        this.toast.error(apiErrorMessage(err, 'Failed to create lesson'));
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

  saveEditLesson(lessonId: string, moduleId: string): void {
    const title = this.editLessonTitle().trim();
    if (!title) return;
    this.savingLesson.set(true);
    this.lessonService.update(lessonId, { title }).subscribe({
      next: updated => {
        this.updateRow(moduleId, row => ({
          ...row,
          lessons: row.lessons.map(l => (l.id === lessonId ? updated : l)),
        }));
        this.editingLessonId.set(null);
        this.savingLesson.set(false);
        this.toast.success('Lesson updated');
      },
      error: err => {
        this.savingLesson.set(false);
        this.toast.error(apiErrorMessage(err, 'Failed to update lesson'));
      },
    });
  }

  enterLessonDetail(lesson: LessonResponse): void {
    this.router.navigate(['lesson', lesson.id], { relativeTo: this.route });
  }

  /**
   * Reorder is the one optimistic change on the teacher screens: the row moves at once, the
   * server's answer then sets the final order, and a failure puts the old order back.
   * Both only sort the rows on screen, so a row added or deleted while the save ran stays so.
   */
  dropModule(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex || this.reorderLocked()) return;
    const before = this.modulesWithLessons().map(row => row.module.id);
    const moved = [...this.modulesWithLessons()];
    moveItemInArray(moved, event.previousIndex, event.currentIndex);
    this.modulesWithLessons.set(moved);
    this.savingOrder.set(true);

    this.moduleService.reorder(this.courseId(), moved.map(row => row.module.id)).subscribe({
      next: modules => {
        this.modulesWithLessons.update(rows => sortByIds(rows, modules.map(m => m.id), row => row.module.id));
        this.savingOrder.set(false);
      },
      error: err => {
        this.modulesWithLessons.update(rows => sortByIds(rows, before, row => row.module.id));
        this.savingOrder.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not save the new order of modules'));
      },
    });
  }

  /** Keyboard path for a drag handle: arrow up or down moves the row one place. */
  moveModuleByKey(event: Event, index: number, step: number): void {
    event.preventDefault();
    const to = index + step;
    if (to < 0 || to >= this.modulesWithLessons().length) return;
    this.dropModule({ previousIndex: index, currentIndex: to } as CdkDragDrop<unknown>);
    keepFocus(event);
  }

  moveLessonByKey(event: Event, moduleId: string, index: number, step: number): void {
    event.preventDefault();
    const to = index + step;
    const count = this.modulesWithLessons().find(r => r.module.id === moduleId)?.lessons.length ?? 0;
    if (to < 0 || to >= count) return;
    this.dropLesson(moduleId, { previousIndex: index, currentIndex: to } as CdkDragDrop<unknown>);
    keepFocus(event);
  }

  dropLesson(moduleId: string, event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex || this.reorderLocked()) return;
    const row = this.modulesWithLessons().find(r => r.module.id === moduleId);
    if (!row) return;
    const before = row.lessons.map(l => l.id);
    const moved = [...row.lessons];
    moveItemInArray(moved, event.previousIndex, event.currentIndex);
    this.updateRow(moduleId, r => ({ ...r, lessons: moved }));
    this.savingOrder.set(true);

    this.lessonService.reorder(moduleId, moved.map(l => l.id)).subscribe({
      next: lessons => {
        this.updateRow(moduleId, r => ({ ...r, lessons: sortByIds(r.lessons, lessons.map(l => l.id), l => l.id) }));
        this.savingOrder.set(false);
      },
      error: err => {
        this.updateRow(moduleId, r => ({ ...r, lessons: sortByIds(r.lessons, before, l => l.id) }));
        this.savingOrder.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not save the new order of lessons'));
      },
    });
  }

  confirmDeleteModule(row: ModuleWithLessons): void {
    this.openDelete(
      {
        type: 'module',
        id: row.module.id,
        name: row.module.title,
        lessonCount: row.lessons.length,
        exerciseCount: row.lessons.reduce((sum, l) => sum + (l.exerciseCount ?? 0), 0),
        hasSummary: false,
      },
      this.moduleService.get(row.module.id, { expand: ['submissionCount'] })
    );
  }

  confirmDeleteLesson(lesson: LessonResponse): void {
    this.openDelete(
      {
        type: 'lesson',
        id: lesson.id,
        name: lesson.title,
        lessonCount: 0,
        exerciseCount: lesson.exerciseCount ?? 0,
        hasSummary: lesson.hasSummary,
      },
      this.lessonService.get(lesson.id, { expand: ['submissionCount'] })
    );
  }

  cancelDelete(): void {
    this.countSub?.unsubscribe();
    this.deleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deleteSubmissions() === 'loading') return;
    this.deleting.set(true);
    const id = target.id;

    if (target.type === 'module') {
      this.moduleService.delete(id).subscribe({
        next: () => {
          const row = this.modulesWithLessons().find(m => m.module.id === id);
          if (row) this.dropLessonEditIn(row);
          this.modulesWithLessons.update(mods => mods.filter(m => m.module.id !== id));
          this.finishDelete('Module deleted');
        },
        error: err => this.failDelete(apiErrorMessage(err, 'Failed to delete module')),
      });
    } else {
      this.lessonService.delete(id).subscribe({
        next: () => {
          this.modulesWithLessons.update(mods => mods.map(m => ({
            ...m,
            lessons: m.lessons.filter(l => l.id !== id),
          })));
          this.finishDelete('Lesson deleted');
        },
        error: err => this.failDelete(apiErrorMessage(err, 'Failed to delete lesson')),
      });
    }
  }

  /** Opens the confirm dialog and counts the student submissions inside. Delete waits for the count. */
  private openDelete(target: DeleteTarget, count$: Observable<{ submissionCount?: number | null }>): void {
    this.countSub?.unsubscribe();
    this.deleteTarget.set(target);
    this.deleteSubmissions.set('loading');
    this.countSub = count$.subscribe({
      next: item => this.deleteSubmissions.set(item.submissionCount ?? 'unknown'),
      error: () => this.deleteSubmissions.set('unknown'),
    });
  }

  private finishDelete(msg: string): void {
    this.deleting.set(false);
    this.deleteTarget.set(null);
    this.toast.success(msg);
  }

  private failDelete(msg: string): void {
    this.deleting.set(false);
    this.toast.error(msg);
  }

  /**
   * Ends a lesson title edit inside a row that is collapsing or going away. Its Cancel button
   * would be gone, and the edit would keep every drag handle locked.
   */
  private dropLessonEditIn(row: ModuleWithLessons): void {
    if (row.lessons.some(l => l.id === this.editingLessonId())) this.editingLessonId.set(null);
  }

  private updateRow(moduleId: string, change: (row: ModuleWithLessons) => ModuleWithLessons): void {
    this.modulesWithLessons.update(rows => rows.map(row => (row.module.id === moduleId ? change(row) : row)));
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

/** `rows` in the order of `ids`; rows whose id is not listed keep their place at the end. */
function sortByIds<T>(rows: T[], ids: string[], idOf: (row: T) => string): T[] {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (rank.get(idOf(a)) ?? ids.length) - (rank.get(idOf(b)) ?? ids.length));
}

/** A row moved by keyboard can be re-attached by the list, which drops focus; put it back. */
function keepFocus(event: Event): void {
  const handle = event.target as HTMLElement;
  setTimeout(() => handle.focus());
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
