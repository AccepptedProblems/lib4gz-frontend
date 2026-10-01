import { Component, inject, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonComponent, InputComponent, ToastService } from '../../../shared/components';
import { AuthService } from '../../../services/auth.service';
import { RegistrationFlowService } from '../../../services/registration-flow.service';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';

/** Sign-up step 3: choose a username (fixed from here on), a display name, and, on the email path, a password. */
@Component({
  selector: 'app-register-complete',
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, AuthBrandComponent],
  templateUrl: './register-complete.component.html',
  styleUrl: '../register/register.component.scss',
})
export class RegisterCompleteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly flow = inject(RegistrationFlowService);

  readonly registration = this.flow.registration()!;
  readonly requiresPassword = this.registration.requiresPassword;

  isLoading = signal(false);
  errorMessage = signal('');
  /** Server-side username problem (409 taken), shown under the field. */
  usernameServerError = signal<string | null>(null);

  form = this.fb.nonNullable.group(
    {
      email: [{ value: this.registration.email, disabled: true }],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9]+$/)]],
      name: [this.registration.name ?? '', [Validators.maxLength(255)]],
      password: ['', this.requiresPassword ? [Validators.required, Validators.minLength(8)] : []],
      confirmPassword: ['', this.requiresPassword ? [Validators.required] : []],
    },
    { validators: this.requiresPassword ? passwordMatchValidator : null },
  );

  constructor() {
    this.form.controls.username.valueChanges.subscribe(() => this.usernameServerError.set(null));
  }

  getFieldError(fieldName: 'username' | 'name' | 'password' | 'confirmPassword'): string | null {
    if (fieldName === 'username' && this.usernameServerError()) {
      return this.usernameServerError();
    }
    const control = this.form.get(fieldName);
    if (!control?.touched || !control.invalid) return null;

    if (control.hasError('required')) return `${FIELD_LABELS[fieldName]} is required`;
    if (control.hasError('minlength')) return `Minimum ${control.getError('minlength').requiredLength} characters required`;
    if (control.hasError('maxlength')) return `Maximum ${control.getError('maxlength').requiredLength} characters`;
    if (control.hasError('pattern')) return 'Only letters and digits allowed';
    if (control.hasError('passwordMismatch')) return 'Passwords do not match';
    return null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { username, name, password } = this.form.getRawValue();
    this.authService.completeRegistration({
      registrationId: this.registration.registrationId,
      username,
      name,
      ...(this.requiresPassword ? { password } : {}),
    }).subscribe({
      next: () => {
        this.flow.reset();
        this.router.navigate(['/']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const message = apiErrorMessage(err, 'Could not create the account. Please try again.');
        if (err.status === 409 && message.toLowerCase().includes('username')) {
          this.usernameServerError.set(message);
        } else if (err.status === 404 || err.status === 409) {
          // Expired, or the email got an account meanwhile: this sign-up can never finish.
          this.toast.error(err.status === 404 ? 'This sign-up expired. Please start again.' : message);
          this.flow.reset();
          this.router.navigate(['/register']);
        } else {
          this.errorMessage.set(message);
        }
      },
    });
  }
}

const FIELD_LABELS = {
  username: 'Username',
  name: 'Display name',
  password: 'Password',
  confirmPassword: 'Confirm password',
};

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  if (!password || !confirmPassword) return null;
  if (password.value !== confirmPassword.value) {
    confirmPassword.setErrors({ ...confirmPassword.errors, passwordMismatch: true });
    return { passwordMismatch: true };
  }
  if (confirmPassword.hasError('passwordMismatch')) {
    const { passwordMismatch, ...rest } = confirmPassword.errors!;
    confirmPassword.setErrors(Object.keys(rest).length ? rest : null);
  }
  return null;
}
