import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfileComponent } from './profile.component';
import { GoogleSignInComponent } from '../auth/google-sign-in/google-sign-in.component';
import { environment } from '../../../environments/environment';
import { UserResponse, UserRole } from '../../shared/models';

const ME_URL = `${environment.apiUrl}/v1/users/me`;
const CONNECT_URL = `${environment.apiUrl}/v1/auth/google:connect`;

function user(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'usr_alice',
    username: 'alice',
    email: 'old@x.com',
    name: 'Alice',
    avatarUrl: null,
    role: UserRole.USER,
    emailVerified: false,
    googleConnected: false,
    ...overrides,
  };
}

describe('ProfileComponent email and Google account', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    ['user', 'user_name', 'user_role', 'user_id'].forEach(key => localStorage.removeItem(key));
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfileComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    ['user', 'user_name', 'user_role', 'user_id'].forEach(key => localStorage.removeItem(key));
  });

  /** Answers the profile load that ngOnInit issued. */
  function load(overrides: Partial<UserResponse> = {}): void {
    httpMock.expectOne(r => r.method === 'GET' && r.url === ME_URL).flush(user(overrides));
    fixture.detectChanges();
  }

  function emailInput(): HTMLInputElement {
    return el.querySelector<HTMLInputElement>('input[aria-label="Email"]')!;
  }

  function badgeText(): string {
    return el.querySelector('.profile__email-status')!.textContent!.trim();
  }

  function googleButton(): GoogleSignInComponent {
    return fixture.debugElement.query(By.directive(GoogleSignInComponent)).componentInstance;
  }

  /**
   * The wording drawn over Google's button. Read from the input, not the DOM: the face is painted
   * only once Google's real button exists, and the GIS script never loads under test.
   */
  function buttonLabel(): string {
    return googleButton().label() ?? '';
  }

  function hintText(): string {
    return el.querySelector('.profile__google-hint')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  /** Stands in for Google handing back a token after the person picked an account. */
  function googleReturns(idToken: string): void {
    googleButton().credential.emit(idToken);
    fixture.detectChanges();
  }

  it('shows the email read-only with an Unverified badge and offers to connect Google to verify it', () => {
    load();

    expect(emailInput().value).toBe('old@x.com');
    expect(emailInput().disabled).toBeTrue();
    expect(badgeText()).toBe('Unverified');
    expect(buttonLabel()).toBe('Connect a Google account');
    expect(hintText()).toBe('Connecting a Google account also verifies your email.');
  });

  it('a verified account without Google is offered a plain connect, with nothing left to explain', () => {
    load({ emailVerified: true });

    expect(badgeText()).toBe('Verified');
    expect(buttonLabel()).toBe('Connect a Google account');
    expect(hintText()).toBe('');
  });

  it('a connected account is offered a change of Google account', () => {
    load({ emailVerified: true, googleConnected: true });

    expect(badgeText()).toBe('Verified');
    expect(buttonLabel()).toBe('Connect other Google account');
    expect(hintText()).toBe('');
  });

  it('a token from Google connects the account and the page takes email, badge and avatar from the reply', () => {
    load();
    googleReturns('id-token');

    const connect = httpMock.expectOne(CONNECT_URL);
    expect(connect.request.body).toEqual({ idToken: 'id-token' });
    expect(buttonLabel()).toBe('Connecting…');
    connect.flush(user({ email: 'alice@gmail.com', emailVerified: true, googleConnected: true, avatarUrl: 'https://pic' }));
    fixture.detectChanges();

    expect(emailInput().value).toBe('alice@gmail.com');
    expect(badgeText()).toBe('Verified');
    expect(buttonLabel()).toBe('Connect other Google account');
    expect(el.querySelector<HTMLImageElement>('lib-avatar img')?.src).toBe('https://pic/');
    expect(JSON.parse(localStorage.getItem('user')!).email).withContext('navbar source').toBe('alice@gmail.com');
  });

  it('a refused connect shows the server message and changes nothing', () => {
    load({ emailVerified: true, googleConnected: true });
    googleReturns('id-token');

    httpMock.expectOne(CONNECT_URL).flush(
      { errors: [{ type: 'SystemError', reason: 'That Google account is already connected to another account' }] },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')!.textContent).toContain('That Google account is already connected to another account');
    expect(emailInput().value).toBe('old@x.com');
    expect(buttonLabel()).toBe('Connect other Google account');
  });

  it('"Save changes" sends the name only', () => {
    load({ emailVerified: true });
    const name = el.querySelector<HTMLInputElement>('input[aria-label="Display name"]')!;
    name.value = 'Alice B';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();

    const patch = httpMock.expectOne(r => r.method === 'PATCH' && r.url === ME_URL);
    expect(patch.request.body).toEqual({ name: 'Alice B' });
    patch.flush(user({ name: 'Alice B', emailVerified: true }));
    fixture.detectChanges();

    expect(emailInput().value).toBe('old@x.com');
  });
});
