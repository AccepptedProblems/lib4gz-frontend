import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonComponent, InputComponent, ToastService } from '../../../shared/components';
import { AuthService } from '../../../services/auth.service';
import { RegistrationFlowService } from '../../../services/registration-flow.service';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';
import { GoogleSignInComponent } from '../google-sign-in/google-sign-in.component';
import { EmailCodeDialogComponent } from '../email-code-dialog/email-code-dialog.component';

/** Sign-up step 1: an email address (a code is sent and entered in a dialog), or Google. */
@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    InputComponent,
    AuthBrandComponent,
    GoogleSignInComponent,
    EmailCodeDialogComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly flow = inject(RegistrationFlowService);

  isLoading = signal(false);
  errorMessage = signal('');
  /** The address already belongs to an account: offer sign-in instead. */
  emailInUse = signal(false);

  codeDialogOpen = signal(false);
  isVerifying = signal(false);
  isResending = signal(false);
  codeError = signal<string | null>(null);

  registerForm = this.fb.nonNullable.group({
    email: [this.flow.email() ?? '', [Validators.required, Validators.email]],
  });

  getEmailError(): string | null {
    const control = this.registerForm.controls.email;
    if (!control.touched || !control.invalid) return null;
    return control.hasError('required') ? 'Email is required' : 'Please enter a valid email';
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const email = this.registerForm.getRawValue().email.trim().toLowerCase();
    // Same address while the cooldown runs: the code is already in their inbox.
    if (email === this.flow.email() && this.flow.cooldownRemaining() > 0) {
      this.openCodeDialog();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.emailInUse.set(false);

    this.authService.startEmailRegistration(email).subscribe({
      next: sent => {
        this.isLoading.set(false);
        this.flow.startEmail(sent.email);
        this.flow.startCooldown(sent.cooldownSeconds);
        this.openCodeDialog();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 409) {
          this.emailInUse.set(true);
        } else {
          this.errorMessage.set(apiErrorMessage(err, 'Could not send the code. Please try again.'));
        }
      },
    });
  }

  verifyCode(code: string): void {
    this.isVerifying.set(true);
    this.codeError.set(null);
    this.authService.verifyEmailRegistration(this.flow.email()!, code).subscribe({
      next: registration => {
        this.flow.setRegistration(registration);
        this.router.navigate(['/register/complete']);
      },
      error: err => {
        this.isVerifying.set(false);
        this.codeError.set(apiErrorMessage(err, 'Could not verify the code. Please try again.'));
      },
    });
  }

  resendCode(): void {
    this.isResending.set(true);
    this.codeError.set(null);
    this.authService.startEmailRegistration(this.flow.email()!).subscribe({
      next: sent => {
        this.isResending.set(false);
        this.flow.startCooldown(sent.cooldownSeconds);
        this.toast.success('A new code is on its way');
      },
      error: err => {
        this.isResending.set(false);
        this.codeError.set(apiErrorMessage(err, 'Could not send a new code. Please try again.'));
      },
    });
  }

  closeCodeDialog(): void {
    this.codeDialogOpen.set(false);
  }

  onGoogle(idToken: string): void {
    this.errorMessage.set('');
    this.emailInUse.set(false);
    this.authService.googleSignIn(idToken).subscribe({
      next: response => {
        if (response.login) {
          this.flow.reset();
          this.router.navigate(['/']);
        } else if (response.registration) {
          this.flow.setRegistration(response.registration);
          this.router.navigate(['/register/complete']);
        }
      },
      error: err => this.errorMessage.set(apiErrorMessage(err, 'Google sign-in failed. Please try again.')),
    });
  }

  private openCodeDialog(): void {
    this.codeError.set(null);
    this.codeDialogOpen.set(true);
  }
}
