import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  UserCreationRequest,
  UserResponse,
  LoginRequest,
  LoginResponse,
  Token
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/auth`;

  register(request: UserCreationRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.baseUrl}/register`, request);
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
    localStorage.removeItem('user_name');
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
    return localStorage.getItem('user_name') ?? '';
  }

  private storeLoginData(response: LoginResponse): void {
    this.storeToken(response.accessToken);
    localStorage.setItem('user_name', response.user.username);
  }

  private storeToken(token: Token): void {
    localStorage.setItem('access_token', token.token);
    localStorage.setItem('token_expiry', token.expiredAt.toString());
  }
}
