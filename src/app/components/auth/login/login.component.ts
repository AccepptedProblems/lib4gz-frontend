import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent, InputComponent } from '../../../shared/components';
import { AuthService } from '../../../services/auth.service';
import { RegistrationFlowService } from '../../../services/registration-flow.service';
import { LoginRequest } from '../../../shared/models';
import { AuthBrandComponent } from '../auth-brand/auth-brand.component';
import { GoogleSignInComponent } from '../google-sign-in/google-sign-in.component';
import { apiErrorMessage } from '../../../shared/utils/api-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent, AuthBrandComponent, GoogleSignInComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly registrationFlow = inject(RegistrationFlowService);

  isLoading = signal(false);
  errorMessage = signal('');

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.loginForm.getRawValue();
    const request: LoginRequest = { username: email, password };

    this.authService.login(request).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          apiErrorMessage(err, 'Invalid credentials. Please try again.')
        );
      },
    });
  }

  onGoogle(idToken: string): void {
    this.errorMessage.set('');
    this.authService.googleSignIn(idToken).subscribe({
      next: response => {
        if (response.login) {
          this.registrationFlow.reset();
          this.router.navigate(['/']);
        } else if (response.registration) {
          this.registrationFlow.setRegistration(response.registration);
          this.router.navigate(['/register/complete']);
        }
      },
      error: err => this.errorMessage.set(apiErrorMessage(err, 'Google sign-in failed. Please try again.')),
    });
  }
}
