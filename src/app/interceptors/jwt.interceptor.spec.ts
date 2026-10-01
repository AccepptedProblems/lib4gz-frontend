import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { jwtInterceptor } from './jwt.interceptor';
import { environment } from '../../environments/environment';

/** The public list is matched by substring, so a new path can silently fall into it. */
describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('access_token', 'jwt');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([jwtInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('access_token');
  });

  function tokenSentTo(url: string): string | null {
    http.post(url, {}).subscribe();
    const req = httpMock.expectOne(url);
    req.flush({});
    return req.request.headers.get('access_token');
  }

  it('attaches the token to google:connect, which acts on the signed-in account', () => {
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/google:connect`)).toBe('jwt');
  });

  it('leaves the sign-in and sign-up calls unauthenticated', () => {
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/google:sign-in`)).toBeNull();
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/login`)).toBeNull();
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/register/email`)).toBeNull();
  });

  it('attaches the token to everything else', () => {
    expect(tokenSentTo(`${environment.apiUrl}/v1/users/me`)).toBe('jwt');
  });
});
