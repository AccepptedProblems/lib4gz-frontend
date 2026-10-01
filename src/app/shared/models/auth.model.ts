import { UserRole } from './enums';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface Token {
  token: string;
  expiredAt: number;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  /** Falls back to the username on the server when blank. */
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  emailVerified: boolean;
  /** A Google account signs this user in; the email is that account's address. */
  googleConnected: boolean;
}

export interface UpdateMeRequest {
  name?: string;
}

export interface LoginResponse {
  user: UserResponse;
  accessToken: Token;
}

export interface StartEmailRegistrationRequest {
  email: string;
}

export interface VerifyEmailRegistrationRequest {
  email: string;
  code: string;
}

export interface CompleteRegistrationRequest {
  registrationId: string;
  username: string;
  name?: string;
  /** Required on the email path; omitted on the Google path. */
  password?: string;
}

export interface OtpSentResponse {
  email: string;
  cooldownSeconds: number;
}

/** An unfinished sign-up. `registrationId` is the only credential for finishing it. */
export interface RegistrationStartedResponse {
  registrationId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  requiresPassword: boolean;
}

export interface GoogleSignInRequest {
  idToken: string;
}

/** Exactly one of `login` (known account) or `registration` (new account) is set. */
export interface GoogleSignInResponse {
  login: LoginResponse | null;
  registration: RegistrationStartedResponse | null;
}
