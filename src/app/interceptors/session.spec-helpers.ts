import { LoginResponse, UserRole } from '../shared/models';

/** Stores a signed-in session whose access token expires in [accessMsLeft]. */
export function storeSession(accessMsLeft: number, withRefreshToken = true): void {
  localStorage.setItem('access_token', 'old-jwt');
  localStorage.setItem('token_expiry', String(Date.now() + accessMsLeft));
  if (withRefreshToken) {
    localStorage.setItem('refresh_token', 'old-rt');
    localStorage.setItem('refresh_token_expiry', String(Date.now() + 86_400_000));
  }
  localStorage.setItem('user_id', 'usr_alice');
}

/** What another tab's renewal leaves in the storage every tab shares. */
export function storeAnotherTabsPair(): void {
  localStorage.setItem('access_token', 'other-jwt');
  localStorage.setItem('token_expiry', String(Date.now() + 3_600_000));
  localStorage.setItem('refresh_token', 'other-rt');
  localStorage.setItem('refresh_token_expiry', String(Date.now() + 86_400_000));
}

export const SESSION_KEYS = [
  'access_token', 'token_expiry', 'refresh_token', 'refresh_token_expiry', 'user', 'user_name', 'user_role', 'user_id',
];

export function clearSessionKeys(): void {
  SESSION_KEYS.forEach(key => localStorage.removeItem(key));
}

export function renewedSession(): LoginResponse {
  return {
    user: {
      id: 'usr_alice', username: 'alice', email: 'alice@x.com', name: 'Alice', avatarUrl: null,
      role: UserRole.USER, emailVerified: true, googleConnected: false, raceAppearance: null,
    },
    accessToken: { token: 'new-jwt', expiredAt: Date.now() + 3_600_000 },
    refreshToken: { token: 'new-rt', expiredAt: Date.now() + 86_400_000 },
  };
}

export const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };
export const SERVER_ERROR = { status: 500, statusText: 'Server Error' };
