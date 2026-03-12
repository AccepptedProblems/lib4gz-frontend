import { Component, inject, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent, InputComponent } from '../../../shared/components';
import { AuthService } from '../../../services/auth.service';
import { UserCreationRequest } from '../../../shared/models';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal('');

  registerForm = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      terms: [false, [Validators.requiredTrue]],
    },
    { validators: this.passwordMatchValidator },
  );

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  getFieldError(fieldName: string): string | null {
    const control = this.registerForm.get(fieldName);
    if (!control?.touched || !control?.invalid) return null;

    if (control.hasError('required')) {
      return `${this.getFieldLabel(fieldName)} is required`;
    }
    if (control.hasError('email')) {
      return 'Please enter a valid email';
    }
    if (control.hasError('minlength')) {
      const minLength = control.getError('minlength').requiredLength;
      return `Minimum ${minLength} characters required`;
    }
    if (control.hasError('pattern')) {
      return 'Only alphanumeric characters allowed';
    }
    if (control.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }
    return null;
  }

  private getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      email: 'Email',
      username: 'Username',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      terms: 'Terms acceptance',
    };
    return labels[fieldName] || fieldName;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { email, username, password } = this.registerForm.getRawValue();
    const request: UserCreationRequest = { email, username, password };

    this.authService.register(request).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Registration failed. Please try again.',
        );
      },
    });
  }
}
