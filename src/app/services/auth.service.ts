import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CourseCacheService } from './course-cache.service';
import { accessTokenMsLeft, clearTokens, getAccessToken, getRefreshToken, storeTokens } from './token-store';
import {
  CompleteRegistrationRequest,
  GoogleSignInResponse,
  UserResponse,
  LoginRequest,
  LoginResponse,
  OtpSentResponse,
  RefreshTokenRequest,
  RegistrationStartedResponse,
  UserRole
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  // One-way dependency: the cache service reads localStorage directly, never AuthService.
  private readonly courseCache = inject(CourseCacheService);
  private readonly baseUrl = `${environment.apiUrl}/v1/auth`;
  /** The refresh in flight, shared by every caller until it settles. */
  private refreshing: Observable<LoginResponse> | null = null;
  /** The refresh token the refresh in flight sent, null when none is in flight. */
  private sentRefreshToken: string | null = null;

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

  /**
   * Trades the refresh token for a new pair. One request at a time: callers during a refresh share it.
   * The pair is stored only while storage still holds the token sent; otherwise the new refresh token
   * is revoked on the server, and the callers get a 401 (the session cleared) if storage is empty or
   * the reply if another tab stored its own pair (they read the access token from storage, never from
   * the reply).
   * A 401 means the sign-in is over, so the session is cleared; any other failure (no network,
   * server down) keeps the session, because the refresh token is still good.
   */
  refreshSession(): Observable<LoginResponse> {
    if (this.refreshing) return this.refreshing;
    const sent = getRefreshToken();
    if (!sent) {
      this.clearSession();
      return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'No refresh token' }));
    }
    this.sentRefreshToken = sent;
    const body: RefreshTokenRequest = { refreshToken: sent };
    this.refreshing = this.http.post<LoginResponse>(`${this.baseUrl}/refresh-token`, body).pipe(
      // Both branches mark the refresh settled before the callers hear of it, so a sign-out in a
      // caller's own callback is not a sign-out during the refresh, and a refresh asked for there
      // starts a new, tracked one instead of getting this finished one back (shareReplay resets
      // on error, so subscribing to it again would post the same token again).
      catchError((error: HttpErrorResponse) => {
        this.sentRefreshToken = null;
        this.refreshing = null;
        if (error.status === 401) this.clearSession();
        else if (!getRefreshToken()) this.revokeOnServer(sent);
        return throwError(() => error);
      }),
      map(response => {
        this.sentRefreshToken = null;
        this.refreshing = null;
        const stored = getRefreshToken();
        if (stored === sent) {
          this.storeLoginData(response);
          return response;
        }
        this.revokeOnServer(response.refreshToken.token);
        if (!stored) {
          // Signed out meanwhile, or the refresh token expired in flight: either way the sign-in is over.
          this.clearSession();
          throw new HttpErrorResponse({ status: 401, statusText: 'Signed out during the refresh' });
        }
        return response;
      }),
      // Not ref-counted: once sent, the refresh completes and settles even if every caller has
      // gone, because the server has already revoked the old token.
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.refreshing;
  }

  /**
   * Signs out here at once, network or not, then asks the server to revoke the stored refresh token.
   * During a refresh it never revokes the token in flight (the refresh revokes its own new one when
   * it settles); it revokes the stored token only when another tab's refresh stored it.
   */
  logout(): void {
    const stored = getRefreshToken();
    const inFlight = this.sentRefreshToken;
    this.clearSession();
    if (stored && stored !== inFlight) this.revokeOnServer(stored);
  }

  /** True while a request can be made: an unexpired access token, or a refresh token to renew it. */
  isAuthenticated(): boolean {
    return accessTokenMsLeft() > 0 || getRefreshToken() !== null;
  }

  getToken(): string | null {
    return getAccessToken();
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
    storeTokens(response.accessToken, response.refreshToken);
    this.setCurrentUser(response.user);
  }

  /** Asks the server to revoke [refreshToken]. The answer does not matter: this browser is done with it. */
  private revokeOnServer(refreshToken: string): void {
    const body: RefreshTokenRequest = { refreshToken };
    this.http.post(`${this.baseUrl}/logout`, body).subscribe({ error: () => {} });
  }

  private clearSession(): void {
    clearTokens();
    localStorage.removeItem('user');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    this.currentUser.set(null);
    // Shared-machine privacy: drop all cached course data for this user.
    this.courseCache.clearAll().catch(() => {});
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
