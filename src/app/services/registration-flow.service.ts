import { Injectable, signal } from '@angular/core';
import { RegistrationStartedResponse } from '../shared/models';

const STORAGE_KEY = 'registration_flow';

interface StoredFlow {
  email: string | null;
  registration: RegistrationStartedResponse | null;
  cooldownUntil: number;
}

/**
 * State shared by the three sign-up screens (email → code → create account).
 * Kept in sessionStorage so a reload keeps the step, while a new tab starts over.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationFlowService {
  private readonly stored = readStoredFlow();

  readonly email = signal<string | null>(this.stored.email);
  readonly registration = signal<RegistrationStartedResponse | null>(this.stored.registration);
  /** Epoch millis until which "Resend code" stays disabled. */
  readonly cooldownUntil = signal<number>(this.stored.cooldownUntil);

  startEmail(email: string): void {
    this.email.set(email);
    this.registration.set(null);
    this.persist();
  }

  setRegistration(registration: RegistrationStartedResponse): void {
    this.email.set(registration.email);
    this.registration.set(registration);
    this.persist();
  }

  startCooldown(seconds: number): void {
    this.cooldownUntil.set(Date.now() + seconds * 1000);
    this.persist();
  }

  /** Whole seconds left on the resend cooldown; 0 when a new code may be requested. */
  cooldownRemaining(): number {
    return Math.max(0, Math.ceil((this.cooldownUntil() - Date.now()) / 1000));
  }

  reset(): void {
    this.email.set(null);
    this.registration.set(null);
    this.cooldownUntil.set(0);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private persist(): void {
    const flow: StoredFlow = {
      email: this.email(),
      registration: this.registration(),
      cooldownUntil: this.cooldownUntil(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
  }
}

function readStoredFlow(): StoredFlow {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredFlow>;
      return {
        email: parsed.email ?? null,
        registration: parsed.registration ?? null,
        cooldownUntil: parsed.cooldownUntil ?? 0,
      };
    }
  } catch {
    // Corrupt entry: start over.
  }
  return { email: null, registration: null, cooldownUntil: 0 };
}
