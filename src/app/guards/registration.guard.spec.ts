import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { registrationIdGuard } from './registration.guard';
import { RegistrationFlowService } from '../services/registration-flow.service';

describe('registrationIdGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  beforeEach(() => {
    sessionStorage.removeItem('registration_flow');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => sessionStorage.removeItem('registration_flow'));

  function run(guard: typeof registrationIdGuard) {
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  function expectRedirectToRegister(result: unknown) {
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/register');
  }

  it('registrationIdGuard allows the create-account step once a registration exists', () => {
    TestBed.inject(RegistrationFlowService).setRegistration({
      registrationId: 'reg_1', email: 'new@x.com', name: null, avatarUrl: null, requiresPassword: true,
    });
    expect(run(registrationIdGuard)).toBeTrue();
  });

  it('registrationIdGuard sends a visitor without a registration back to /register', () => {
    TestBed.inject(RegistrationFlowService).startEmail('new@x.com');
    expectRedirectToRegister(run(registrationIdGuard));
  });
});
