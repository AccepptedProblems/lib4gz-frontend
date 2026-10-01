import { TestBed } from '@angular/core/testing';
import { RegistrationFlowService } from './registration-flow.service';
import { RegistrationStartedResponse } from '../shared/models';

const KEY = 'registration_flow';

const registration: RegistrationStartedResponse = {
  registrationId: 'reg_1',
  email: 'new@x.com',
  name: 'New Person',
  avatarUrl: null,
  requiresPassword: true,
};

describe('RegistrationFlowService', () => {
  beforeEach(() => {
    sessionStorage.removeItem(KEY);
    TestBed.configureTestingModule({});
  });

  afterEach(() => sessionStorage.removeItem(KEY));

  it('setters mirror the flow into sessionStorage', () => {
    const flow = TestBed.inject(RegistrationFlowService);

    flow.startEmail('new@x.com');
    flow.setRegistration(registration);

    const stored = JSON.parse(sessionStorage.getItem(KEY)!);
    expect(stored.email).toBe('new@x.com');
    expect(stored.registration.registrationId).toBe('reg_1');
  });

  it('a new instance picks up the stored flow', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ email: 'new@x.com', registration, cooldownUntil: 0 }));

    const flow = new RegistrationFlowService();

    expect(flow.email()).toBe('new@x.com');
    expect(flow.registration()?.registrationId).toBe('reg_1');
  });

  it('reset clears the signals and the stored flow', () => {
    const flow = TestBed.inject(RegistrationFlowService);
    flow.startEmail('new@x.com');
    flow.setRegistration(registration);

    flow.reset();

    expect(flow.email()).toBeNull();
    expect(flow.registration()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('reports the remaining cooldown and none once it has passed', () => {
    const flow = TestBed.inject(RegistrationFlowService);

    flow.startCooldown(60);
    expect(flow.cooldownRemaining()).toBeGreaterThan(55);
    expect(flow.cooldownRemaining()).toBeLessThanOrEqual(60);

    flow.cooldownUntil.set(Date.now() - 1000);
    expect(flow.cooldownRemaining()).toBe(0);
  });

  it('a new registration setting the email from the response replaces the typed one', () => {
    const flow = TestBed.inject(RegistrationFlowService);

    flow.setRegistration({ ...registration, email: 'google@x.com' });

    expect(flow.email()).toBe('google@x.com');
  });
});
