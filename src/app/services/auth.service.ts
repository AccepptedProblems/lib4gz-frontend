import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { CourseCacheService } from './course-cache.service';
import {
  CompleteRegistrationRequest,
  GoogleSignInResponse,
  UserResponse,
  LoginRequest,
  LoginResponse,
  OtpSentResponse,
  RegistrationStartedResponse,
  Token,
  UserRole
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  // One-way dependency: the cache service reads localStorage directly, never AuthService.
  private readonly courseCache = inject(CourseCacheService);
  private readonly baseUrl = `${environment.apiUrl}/v1/auth`;

  /** The signed-in user, so profile edits reach the navbar without a reload. */
  readonly currentUser = signal<UserResponse | null>(readStoredUser());
  readonly userName = computed(() => {
    const user = this.currentUser();
    return user ? user.name || user.username : '';
  });
  readonly userInitial = computed(() => this.userName().charAt(0).toUpperCase() || 'U');

  /** Sends a sign-up code. Calling it again is the resend. */
  startEmailRegistration(email: string): Observable<OtpSentResponse> {
    return this.http.post<OtpSentResponse>(`${this.baseUrl}/register/email`, { email });
  }

  verifyEmailRegistration(email: string, code: string): Observable<RegistrationStartedResponse> {
    return this.http.post<RegistrationStartedResponse>(`${this.baseUrl}/register/email/verify`, { email, code });
  }

  /** Creates the account and signs it in. */
  completeRegistration(request: CompleteRegistrationRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/register/complete`, request).pipe(
      tap(response => this.storeLoginData(response))
    );
  }

  /** Signs in a known Google account; a new one comes back as a registration to finish. */
  googleSignIn(idToken: string): Observable<GoogleSignInResponse> {
    return this.http.post<GoogleSignInResponse>(`${this.baseUrl}/google:sign-in`, { idToken }).pipe(
      tap(response => {
        if (response.login) this.storeLoginData(response.login);
      })
    );
  }

  /**
   * Connects (or switches) the signed-in user's Google account. The email, its verified flag and
   * the avatar come back from Google, so the returned user replaces the stored one.
   */
  connectGoogle(idToken: string): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.baseUrl}/google:connect`, { idToken }).pipe(
      tap(user => this.setCurrentUser(user))
    );
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, request).pipe(
      tap(response => this.storeLoginData(response))
    );
  }

  refreshToken(): Observable<Token> {
    return this.http.post<Token>(`${this.baseUrl}/refresh-token`, {}).pipe(
      tap(token => this.storeToken(token))
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('user');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    this.currentUser.set(null);
    // Shared-machine privacy: drop all cached course data for this user.
    this.courseCache.clearAll().catch(() => {});
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    const expiry = localStorage.getItem('token_expiry');

    if (!token || !expiry) {
      return false;
    }

    return Date.now() < parseInt(expiry, 10);
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getUserName(): string {
    return this.userName();
  }

  getUserRole(): UserRole {
    return this.currentUser()?.role ?? UserRole.USER;
  }

  hasRole(...roles: UserRole[]): boolean {
    return roles.includes(this.getUserRole());
  }

  setCurrentUser(user: UserResponse): void {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('user_name', user.name || user.username);
    localStorage.setItem('user_role', user.role);
    // Scopes CourseCacheService entries; sessions without it bypass the cache.
    localStorage.setItem('user_id', user.id);
    this.currentUser.set(user);
  }

  private storeLoginData(response: LoginResponse): void {
    this.storeToken(response.accessToken);
    this.setCurrentUser(response.user);
  }

  private storeToken(token: Token): void {
    localStorage.setItem('access_token', token.token);
    localStorage.setItem('token_expiry', token.expiredAt.toString());
  }
}

function readStoredUser(): UserResponse | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserResponse) : null;
  } catch {
    return null;
  }
}
