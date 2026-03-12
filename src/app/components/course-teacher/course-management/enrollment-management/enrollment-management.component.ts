import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EnrollmentService,
} from '../../../../services';
import {
  EnrollmentResponse,
  EnrollmentStatus,
  EnrollmentRole,
} from '../../../../shared/models';
import {
  ButtonComponent,
  BadgeComponent,
  DialogComponent,
  ChipComponent,
  SpinnerComponent,
} from '../../../../shared/components';
import { ToastService } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-enrollment-management',
  imports: [
    DatePipe,
    ButtonComponent,
    BadgeComponent,
    DialogComponent,
    ChipComponent,
    SpinnerComponent,
  ],
  templateUrl: './enrollment-management.component.html',
  styleUrl: './enrollment-management.component.scss',
})
export class EnrollmentManagementComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly toast = inject(ToastService);

  readonly Math = Math;
  readonly EnrollmentStatus = EnrollmentStatus;
  readonly EnrollmentRole = EnrollmentRole;

  // Self-loading
  courseId = signal('');
  enrollments = signal<EnrollmentResponse[]>([]);
  loading = signal(true);

  // Filter / pagination state
  search = signal('');
  statusFilter = signal<string>('All');
  page = signal(1);
  readonly pageSize = 20;

  // Delete dialog
  deleteDialogOpen = signal(false);
  deleteEnrollmentId = signal('');
  deleteEnrollmentName = signal('');
  deleting = signal(false);

  // Role-change dialog
  roleDialogOpen = signal(false);
  roleChangeEnrollment = signal<EnrollmentResponse | null>(null);
  roleChangeTarget = signal<EnrollmentRole>(EnrollmentRole.LEARNER);
  changingRole = signal(false);

  // Computed
  pendingRequestCount = computed(() => {
    return this.enrollments().filter(e => e.status === EnrollmentStatus.PENDING).length;
  });

  filteredEnrollments = computed(() => {
    let list = this.enrollments();
    const searchTerm = this.search().toLowerCase().trim();
    const status = this.statusFilter();

    if (searchTerm) {
      list = list.filter(e =>
        e.user.name.toLowerCase().includes(searchTerm) ||
        e.user.email.toLowerCase().includes(searchTerm)
      );
    }
    if (status !== 'All') {
      list = list.filter(e => e.status === status);
    }
    return list;
  });

  paginatedEnrollments = computed(() => {
    const all = this.filteredEnrollments();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.filteredEnrollments().length / this.pageSize) || 1);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id && id !== this.courseId()) {
        this.courseId.set(id);
        this.loadEnrollments(id);
      }
    });
  }

  private loadEnrollments(courseId: string): void {
    this.loading.set(true);
    this.enrollmentService.listByCourse(courseId).subscribe({
      next: enrollments => {
        this.enrollments.set(enrollments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  // ── Filter actions ─────────────────────────────────────────────────
  onSearchChange(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  onChipFilter(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  // ── Enrollment actions ─────────────────────────────────────────────
  approveEnrollment(enrollment: EnrollmentResponse): void {
    this.enrollmentService.approve(enrollment.id).subscribe({
      next: updated => {
        this.enrollments.update(list =>
          list.map(e => e.id === updated.id ? updated : e)
        );
        this.toast.success('Enrollment approved');
      },
      error: () => this.toast.error('Failed to approve enrollment'),
    });
  }

  rejectEnrollment(enrollment: EnrollmentResponse): void {
    this.enrollmentService.reject(enrollment.id).subscribe({
      next: updated => {
        this.enrollments.update(list =>
          list.map(e => e.id === updated.id ? updated : e)
        );
        this.toast.success('Enrollment rejected');
      },
      error: () => this.toast.error('Failed to reject enrollment'),
    });
  }

  // ── Role change (with confirmation dialog) ──────────────────────────
  confirmRoleChange(enrollment: EnrollmentResponse): void {
    const newRole = enrollment.role === EnrollmentRole.LEARNER ? EnrollmentRole.TEACHER : EnrollmentRole.LEARNER;
    this.roleChangeEnrollment.set(enrollment);
    this.roleChangeTarget.set(newRole);
    this.roleDialogOpen.set(true);
  }

  cancelRoleChange(): void {
    this.roleDialogOpen.set(false);
  }

  executeRoleChange(): void {
    const enrollment = this.roleChangeEnrollment();
    if (!enrollment) return;
    this.changingRole.set(true);
    this.enrollmentService.update(enrollment.id, { role: this.roleChangeTarget() }).subscribe({
      next: updated => {
        this.roleDialogOpen.set(false);
        this.changingRole.set(false);
        this.enrollments.update(list =>
          list.map(e => e.id === updated.id ? updated : e)
        );
        this.toast.success(`Role changed to ${this.roleChangeTarget()}`);
      },
      error: () => {
        this.changingRole.set(false);
        this.toast.error('Failed to change role');
      },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────
  confirmRemove(enrollmentId: string, name: string): void {
    this.deleteEnrollmentId.set(enrollmentId);
    this.deleteEnrollmentName.set(name);
    this.deleteDialogOpen.set(true);
  }

  cancelDelete(): void {
    this.deleteDialogOpen.set(false);
  }

  executeDelete(): void {
    this.deleting.set(true);
    const id = this.deleteEnrollmentId();
    this.enrollmentService.delete(id).subscribe({
      next: () => {
        this.deleteDialogOpen.set(false);
        this.deleting.set(false);
        this.enrollments.update(list => list.filter(e => e.id !== id));
        this.toast.success('Enrollment removed');
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error('Failed to remove enrollment');
      },
    });
  }

  // ── Badge helpers ──────────────────────────────────────────────────
  getStatusBadgeVariant(status: EnrollmentStatus): 'success' | 'warning' | 'error' | 'neutral' {
    const map: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
      [EnrollmentStatus.ACTIVE]: 'success',
      [EnrollmentStatus.PENDING]: 'warning',
      [EnrollmentStatus.REJECTED]: 'error',
      [EnrollmentStatus.INACTIVE]: 'neutral',
    };
    return map[status] ?? 'neutral';
  }

  getRoleBadgeVariant(role: EnrollmentRole): 'primary' | 'neutral' {
    return role === EnrollmentRole.TEACHER ? 'primary' : 'neutral';
  }
}
