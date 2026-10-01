import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { GoogleSignInResponse, LoginResponse, UserResponse, UserRole } from '../shared/models';

const AUTH_KEYS = ['access_token', 'token_expiry', 'user', 'user_name', 'user_role', 'user_id'];

function user(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'usr_alice',
    username: 'alice',
    email: 'alice@x.com',
    name: 'Alice B',
    avatarUrl: null,
    role: UserRole.TEACHER,
    emailVerified: false,
    googleConnected: false,
    ...overrides,
  };
}

function createService(): AuthService {
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  beforeEach(() => {
    AUTH_KEYS.forEach(key => localStorage.removeItem(key));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => AUTH_KEYS.forEach(key => localStorage.removeItem(key)));

  it('setCurrentUser stores the user and updates the name signals', () => {
    const service = createService();

    service.setCurrentUser(user());

    expect(JSON.parse(localStorage.getItem('user')!).id).toBe('usr_alice');
    expect(localStorage.getItem('user_role')).toBe('TEACHER');
    expect(localStorage.getItem('user_id')).toBe('usr_alice');
    expect(service.userName()).toBe('Alice B');
    expect(service.userInitial()).toBe('A');
    expect(service.getUserRole()).toBe(UserRole.TEACHER);
  });

  it('uses the username when the name is blank', () => {
    const service = createService();

    service.setCurrentUser(user({ name: '', username: 'zed' }));

    expect(service.userName()).toBe('zed');
    expect(service.userInitial()).toBe('Z');
  });

  it('logout clears the user signal and the stored keys', () => {
    const service = createService();
    service.setCurrentUser(user());

    service.logout();

    expect(service.currentUser()).toBeNull();
    expect(service.userName()).toBe('');
    ['user', 'user_role', 'user_id', 'user_name'].forEach(key => expect(localStorage.getItem(key)).toBeNull());
  });

  it('hydrates a stored user on construction', () => {
    localStorage.setItem('user', JSON.stringify(user({ name: 'Stored' })));

    const service = createService();

    expect(service.userName()).toBe('Stored');
  });

  describe('sign-in and sign-up calls', () => {
    const login: LoginResponse = { user: user(), accessToken: { token: 'jwt', expiredAt: Date.now() + 60_000 } };
    let httpMock: HttpTestingController;

    beforeEach(() => (httpMock = TestBed.inject(HttpTestingController)));
    afterEach(() => httpMock.verify());

    it('googleSignIn stores the session when the account is known', () => {
      const service = createService();
      const body: GoogleSignInResponse = { login, registration: null };

      service.googleSignIn('id-token').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/v1/auth/google:sign-in`);
      expect(req.request.body).toEqual({ idToken: 'id-token' });
      req.flush(body);

      expect(localStorage.getItem('access_token')).toBe('jwt');
      expect(service.userName()).toBe('Alice B');
    });

    it('googleSignIn stores nothing when a registration must be finished first', () => {
      const service = createService();
      const body: GoogleSignInResponse = {
        login: null,
        registration: { registrationId: 'reg_1', email: 'a@x.com', name: 'A', avatarUrl: null, requiresPassword: false },
      };

      service.googleSignIn('id-token').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/v1/auth/google:sign-in`).flush(body);

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(service.currentUser()).toBeNull();
    });

    it('connectGoogle replaces the stored user with the reply', () => {
      const service = createService();
      service.setCurrentUser(user());

      service.connectGoogle('id-token').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/v1/auth/google:connect`);
      expect(req.request.body).toEqual({ idToken: 'id-token' });
      req.flush(user({ email: 'alice@gmail.com', emailVerified: true, googleConnected: true }));

      expect(service.currentUser()?.email).toBe('alice@gmail.com');
      expect(JSON.parse(localStorage.getItem('user')!).googleConnected).toBeTrue();
    });

    it('completeRegistration signs the new user in', () => {
      const service = createService();

      service.completeRegistration({ registrationId: 'reg_1', username: 'alice', password: 'longenough' }).subscribe();
      httpMock.expectOne(`${environment.apiUrl}/v1/auth/register/complete`).flush(login);

      expect(localStorage.getItem('access_token')).toBe('jwt');
      expect(service.currentUser()?.id).toBe('usr_alice');
    });
  });
});
