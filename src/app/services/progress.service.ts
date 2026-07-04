import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Progress store — server-backed since UX plan Phase 4:
 *
 * - Server truth: `CourseResponse.progress` (dashboard/syllabus payloads) and
 *   `LessonResponse.completed` (syllabus) carry submission-derived completion;
 *   `recordVisit` POSTs `/v1/lessons/{id}/visit` so resume state follows the
 *   user across devices.
 * - This service keeps the localStorage layer as an optimistic cache: visits and
 *   completions apply instantly in the UI (sidebar checkmark pop, resume card)
 *   without waiting for a refetch; server payloads corroborate on next load.
 */

export interface CourseProgress {
  /** Total lessons in the course, recorded when the syllabus loads. */
  totalLessons: number;
  completedLessonIds: string[];
  /**
   * lessonId → exercise ids the caller has submitted this session (optimistic
   * layer under the server's `completedExerciseCount`). Optional: entries
   * persisted before this field existed simply don't have it.
   */
  submittedExercisesByLesson?: Record<string, string[]>;
  updatedAt: number;
}

export interface LastVisitedLesson {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  prefix: string | null;
  updatedAt: number;
}

const PROGRESS_KEY = 'lib4gz_progress';
const LAST_VISITED_KEY = 'lib4gz_last_visited';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private readonly state = signal<Record<string, CourseProgress>>(this.loadProgress());

  /** courseId → CourseProgress. Read-only reactive snapshot for computed() consumers. */
  readonly progressByCourse = this.state.asReadonly();

  readonly lastVisited = signal<LastVisitedLesson | null>(this.loadLastVisited());

  /** Record the course's lesson total so percentages can be computed on the dashboard. */
  setTotalLessons(courseId: string, totalLessons: number): void {
    const current = this.state()[courseId];
    if (current?.totalLessons === totalLessons) return;
    this.update(courseId, {
      totalLessons,
      completedLessonIds: current?.completedLessonIds ?? [],
      submittedExercisesByLesson: current?.submittedExercisesByLesson,
      updatedAt: Date.now(),
    });
  }

  markLessonCompleted(courseId: string, lessonId: string): void {
    const current = this.state()[courseId];
    if (current?.completedLessonIds.includes(lessonId)) return;
    this.update(courseId, {
      totalLessons: current?.totalLessons ?? 0,
      completedLessonIds: [...(current?.completedLessonIds ?? []), lessonId],
      submittedExercisesByLesson: current?.submittedExercisesByLesson,
      updatedAt: Date.now(),
    });
  }

  isLessonCompleted(courseId: string, lessonId: string): boolean {
    return this.state()[courseId]?.completedLessonIds.includes(lessonId) ?? false;
  }

  /** Record that specific exercises now have submissions (partial-progress marker). */
  markExercisesSubmitted(courseId: string, lessonId: string, exerciseIds: string[]): void {
    if (exerciseIds.length === 0) return;
    const current = this.state()[courseId];
    const byLesson = { ...(current?.submittedExercisesByLesson ?? {}) };
    const merged = new Set([...(byLesson[lessonId] ?? []), ...exerciseIds]);
    if (merged.size === (byLesson[lessonId]?.length ?? 0)) return;
    byLesson[lessonId] = [...merged];
    this.update(courseId, {
      totalLessons: current?.totalLessons ?? 0,
      completedLessonIds: current?.completedLessonIds ?? [],
      submittedExercisesByLesson: byLesson,
      updatedAt: Date.now(),
    });
  }

  submittedExerciseCount(courseId: string, lessonId: string): number {
    return this.state()[courseId]?.submittedExercisesByLesson?.[lessonId]?.length ?? 0;
  }

  /** Completion percentage (0–100); 0 until the course syllabus has been visited once. */
  percent(courseId: string): number {
    const progress = this.state()[courseId];
    if (!progress || progress.totalLessons === 0) return 0;
    return Math.min(100, Math.round((progress.completedLessonIds.length / progress.totalLessons) * 100));
  }

  recordVisit(visit: Omit<LastVisitedLesson, 'updatedAt'>): void {
    const entry: LastVisitedLesson = { ...visit, updatedAt: Date.now() };
    this.lastVisited.set(entry);
    this.persist(LAST_VISITED_KEY, entry);

    // Fire-and-forget server resume marker. The backend no-ops for callers
    // without an active enrollment, and a failure only means resume falls back
    // to this device's localStorage — never block or surface it.
    this.http
      .post<void>(`${this.apiUrl}/v1/lessons/${visit.lessonId}/visit`, {})
      .subscribe({ error: () => {} });
  }

  private update(courseId: string, progress: CourseProgress): void {
    const next = { ...this.state(), [courseId]: progress };
    this.state.set(next);
    this.persist(PROGRESS_KEY, next);
  }

  private loadProgress(): Record<string, CourseProgress> {
    return this.read<Record<string, CourseProgress>>(PROGRESS_KEY) ?? {};
  }

  private loadLastVisited(): LastVisitedLesson | null {
    return this.read<LastVisitedLesson>(LAST_VISITED_KEY);
  }

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private persist(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full/unavailable — progress simply isn't persisted this session.
    }
  }
}
