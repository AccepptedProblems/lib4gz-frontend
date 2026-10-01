import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DialogComponent, OtpInputComponent } from '../../../shared/components';

/**
 * "Enter the code we emailed you" dialog: six boxes, auto-submit when full, resend with cooldown.
 * The parent owns the server calls and passes back `loading`, `error`, and `cooldownUntil`.
 */
@Component({
  selector: 'app-email-code-dialog',
  imports: [DialogComponent, OtpInputComponent, ReactiveFormsModule],
  template: `
    <lib-dialog
      [open]="open()"
      [title]="title()"
      icon="mark_email_read"
      iconClass="code-dialog__icon"
      width="440px"
      confirmLabel="Verify"
      cancelLabel="Cancel"
      [loading]="loading()"
      (confirm)="submit()"
      (cancel)="cancel.emit()"
    >
      <p class="code-dialog__hint">
        Enter the 6-digit code we sent to <strong>{{ email() }}</strong>. You can paste it.
      </p>
      <lib-otp-input [formControl]="code" [error]="shownError()" (completed)="submit()" />
      <p class="code-dialog__resend text-body-small">
        Didn't get it?
        <button
          type="button"
          class="link-button"
          [disabled]="remaining() > 0 || resending()"
          (click)="resend.emit()"
        >
          @if (remaining() > 0) {
            Resend code in {{ remaining() }}s
          } @else {
            Resend code
          }
        </button>
      </p>
    </lib-dialog>
  `,
  styles: `
    .code-dialog__hint {
      margin: 0 0 var(--spacing-lg);
      color: var(--neutral-color-6);

      strong {
        color: var(--text-primary-color);
        font-weight: 600;
      }
    }

    .code-dialog__resend {
      margin: var(--spacing-lg) 0 0;
      text-align: center;
      color: var(--neutral-color-6);
    }

    .link-button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: var(--primary-color);
      font-weight: 500;

      &:hover:not(:disabled) { text-decoration: underline; }

      &:disabled {
        color: var(--neutral-color-5);
        cursor: default;
      }
    }
  `,
})
export class EmailCodeDialogComponent {
  open = input<boolean>(false);
  email = input<string>('');
  title = input<string>('Confirm your email');
  loading = input<boolean>(false);
  resending = input<boolean>(false);
  /** Server-side problem with the last code, shown under the boxes. */
  error = input<string | null>(null);
  /** Epoch millis until which "Resend code" stays disabled. */
  cooldownUntil = input<number>(0);

  verify = output<string>();
  resend = output<void>();
  cancel = output<void>();

  code = new FormControl('', { nonNullable: true });
  private localError = signal<string | null>(null);
  shownError = computed(() => this.localError() ?? this.error());

  private readonly now = signal(Date.now());
  remaining = computed(() => Math.max(0, Math.ceil((this.cooldownUntil() - this.now()) / 1000)));

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Every opening starts with empty boxes.
    effect(() => {
      if (this.open()) {
        this.code.reset('');
        this.localError.set(null);
      }
    });
    this.code.valueChanges.subscribe(() => this.localError.set(null));
  }

  submit(): void {
    if (this.loading()) return;
    const code = this.code.value;
    if (!/^\d{6}$/.test(code)) {
      this.localError.set('Enter all 6 digits');
      return;
    }
    this.verify.emit(code);
  }
}
