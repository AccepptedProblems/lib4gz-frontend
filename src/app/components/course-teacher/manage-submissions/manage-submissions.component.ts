import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ModuleService,
  LessonService,
  ExerciseService,
  SubmissionService,
} from '../../../services';
import {
  ExerciseResponse,
  SubmissionResponse,
  SubmissionStatus,
} from '../../../shared/models';
import {
  SkeletonComponent,
  BadgeComponent,
} from '../../../shared/components';

interface SubmissionWithExercise extends SubmissionResponse {
  exerciseTitle: string;
}

@Component({
  selector: 'app-manage-submissions',
  imports: [
    DatePipe,
    SkeletonComponent,
    BadgeComponent,
  ],
  templateUrl: './manage-submissions.component.html',
  styleUrl: './manage-submissions.component.scss',
})
export class ManageSubmissionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly submissionService = inject(SubmissionService);

  readonly Math = Math;
  readonly SubmissionStatus = SubmissionStatus;

  courseId = signal('');
  submissions = signal<SubmissionWithExercise[]>([]);
  submissionsLoaded = signal(false);
  submissionsLoading = signal(true);
  allExercises = signal<ExerciseResponse[]>([]);

  submissionExerciseFilter = signal<string>('All');
  submissionStatusFilter = signal<string>('All');
  submissionPage = signal(1);
  readonly submissionPageSize = 20;

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
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadSubmissions(id);
      }
    });
  }

  setSubmissionExerciseFilter(event: Event): void {
    this.submissionExerciseFilter.set((event.target as HTMLSelectElement).value);
    this.submissionPage.set(1);
  }

  setSubmissionStatusFilter(event: Event): void {
    this.submissionStatusFilter.set((event.target as HTMLSelectElement).value);
    this.submissionPage.set(1);
  }

  getSubmissionBadgeVariant(status: SubmissionStatus): 'success' | 'warning' | 'error' | 'neutral' {
    const map: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
      [SubmissionStatus.APPROVED]: 'success',
      [SubmissionStatus.SUBMITTED]: 'warning',
      [SubmissionStatus.NEEDS_REVISION]: 'error',
      [SubmissionStatus.DRAFT]: 'neutral',
    };
    return map[status] ?? 'neutral';
  }

  private loadSubmissions(courseId: string): void {
    this.submissionsLoading.set(true);

    this.moduleService.listByCourse(courseId).subscribe({
      next: modules => {
        const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
        if (sorted.length === 0) {
          this.submissionsLoaded.set(true);
          this.submissionsLoading.set(false);
          return;
        }

        // Load lessons for all modules
        const lessonCalls = sorted.reduce((acc, m) => {
          acc[m.id] = this.lessonService.listByModule(m.id).pipe(catchError(() => of([])));
          return acc;
        }, {} as Record<string, ReturnType<typeof this.lessonService.listByModule>>);

        forkJoin(lessonCalls).subscribe({
          next: lessonResults => {
            const lessonIds: string[] = [];
            for (const moduleId of Object.keys(lessonResults)) {
              for (const lesson of lessonResults[moduleId] as any[]) {
                lessonIds.push(lesson.id);
              }
            }

            if (lessonIds.length === 0) {
              this.submissionsLoaded.set(true);
              this.submissionsLoading.set(false);
              return;
            }

            const exerciseCalls = lessonIds.reduce((acc, lessonId) => {
              acc[lessonId] = this.exerciseService.listByLesson(lessonId).pipe(catchError(() => of([])));
              return acc;
            }, {} as Record<string, ReturnType<typeof this.exerciseService.listByLesson>>);

            forkJoin(exerciseCalls).subscribe({
              next: exerciseResults => {
                const allExercises: ExerciseResponse[] = [];
                for (const lessonId of lessonIds) {
                  allExercises.push(...(exerciseResults[lessonId] as ExerciseResponse[]));
                }
                this.allExercises.set(allExercises);

                if (allExercises.length === 0) {
                  this.submissionsLoaded.set(true);
                  this.submissionsLoading.set(false);
                  return;
                }

                const subCalls = allExercises.reduce((acc, ex) => {
                  acc[ex.id] = this.submissionService.listByExercise(ex.id).pipe(catchError(() => of([])));
                  return acc;
                }, {} as Record<string, ReturnType<typeof this.submissionService.listByExercise>>);

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
