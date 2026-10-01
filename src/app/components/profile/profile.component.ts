import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  InputComponent,
  SpinnerComponent,
  ToastService,
} from '../../shared/components';
import { AuthService, MeService } from '../../services';
import { UserResponse } from '../../shared/models';
import { apiErrorMessage } from '../../shared/utils/api-error';
import { GoogleSignInComponent } from '../auth/google-sign-in/google-sign-in.component';

/**
 * The signed-in user's profile. "Save changes" updates the display name only. The email is
 * read-only: it is the address of the connected Google account. The Google button under the field
 * connects an account (which also verifies the email) or switches to another one. Username is
 * read-only.
 */
@Component({
  selector: 'app-profile',
  imports: [
    ReactiveFormsModule,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    InputComponent,
    SpinnerComponent,
    GoogleSignInComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly meService = inject(MeService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly user = signal<UserResponse | null>(this.authService.currentUser());
  isLoading = signal(true);
  isSaving = signal(false);
  isConnecting = signal(false);
  errorMessage = signal('');

  form = this.fb.nonNullable.group({
    username: [{ value: '', disabled: true }],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: [{ value: '', disabled: true }],
  });

  /** Drawn over Google's button (see GoogleSignInComponent). Kept short: the button is 280px wide. */
  readonly googleLabel = computed(() => {
    const u = this.user();
    if (!u) return '';
    if (this.isConnecting()) return 'Connecting…';
    return u.googleConnected ? 'Connect other Google account' : 'Connect a Google account';
  });

  /** Says what connecting is *for*, and only when that is not obvious from the button. */
  readonly googleHint = computed(() => {
    const u = this.user();
    if (!u || u.googleConnected) return '';
    return u.emailVerified ? '' : 'Connecting a Google account also verifies your email.';
  });

  ngOnInit(): void {
    const cached = this.user();
    if (cached) {
      this.applyUser(cached);
      this.resetForm(cached);
    }
    this.meService.getMe().subscribe({
      next: user => {
        this.isLoading.set(false);
        this.applyUser(user);
        this.resetForm(user);
      },
      error: err => {
        this.isLoading.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'Could not load your profile.'));
      },
    });
  }

  getNameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched || !control.invalid) return null;
    if (control.hasError('required')) return 'Display name is required';
    if (control.hasError('maxlength')) return 'Maximum 255 characters';
    return null;
  }

  /** Saves the display name. The email never travels here; see connectGoogle. */
  save(): void {
    const nameControl = this.form.controls.name;
    if (nameControl.invalid || !this.user()) {
      nameControl.markAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.meService.updateMe({ name: nameControl.value.trim() }).subscribe({
      next: user => {
        this.isSaving.set(false);
        this.applyUser(user);
        nameControl.reset(user.name);
        this.toast.success('Profile saved');
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'Could not save your profile. Please try again.'));
      },
    });
  }

  /** Google returned a token for the chosen account: connect it. Email and avatar come back from the server. */
  connectGoogle(idToken: string): void {
    const wasConnected = this.user()?.googleConnected ?? false;
    this.isConnecting.set(true);
    this.errorMessage.set('');
    this.authService.connectGoogle(idToken).subscribe({
      next: user => {
        this.isConnecting.set(false);
        this.applyUser(user);
        this.form.controls.email.reset(user.email);
        this.toast.success(wasConnected ? 'Google account changed' : 'Google account connected');
      },
      error: err => {
        this.isConnecting.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'Could not connect the Google account. Please try again.'));
      },
    });
  }

  /** The one write path for the user: page state, navbar, and localStorage. */
  private applyUser(user: UserResponse): void {
    this.user.set(user);
    this.authService.setCurrentUser(user);
  }

  private resetForm(user: UserResponse): void {
    this.form.reset({
      username: user.username,
      name: user.name,
      email: user.email,
    });
  }
}
