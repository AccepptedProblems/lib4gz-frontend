import { Token } from '../shared/models';

// The only code that touches these keys. No in-memory copy: tabs share localStorage, and a tab
// must see the pair another tab just stored.
const ACCESS_TOKEN = 'access_token';
const ACCESS_EXPIRY = 'token_expiry';
const REFRESH_TOKEN = 'refresh_token';
const REFRESH_EXPIRY = 'refresh_token_expiry';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN);
}

/** Milliseconds until the access token expires: zero or less once expired, -Infinity with none. */
export function accessTokenMsLeft(): number {
  const expiry = Number(localStorage.getItem(ACCESS_EXPIRY));
  if (!localStorage.getItem(ACCESS_TOKEN) || !expiry) return -Infinity;
  return expiry - Date.now();
}

/** The refresh token, or null when there is none or it has expired. */
export function getRefreshToken(): string | null {
  const token = localStorage.getItem(REFRESH_TOKEN);
  const expiry = Number(localStorage.getItem(REFRESH_EXPIRY));
  return token && expiry > Date.now() ? token : null;
}

/** Stores a new pair, replacing whatever pair was stored. */
export function storeTokens(access: Token, refresh: Token): void {
  localStorage.setItem(ACCESS_TOKEN, access.token);
  localStorage.setItem(ACCESS_EXPIRY, access.expiredAt.toString());
  localStorage.setItem(REFRESH_TOKEN, refresh.token);
  localStorage.setItem(REFRESH_EXPIRY, refresh.expiredAt.toString());
}

export function clearTokens(): void {
  [ACCESS_TOKEN, ACCESS_EXPIRY, REFRESH_TOKEN, REFRESH_EXPIRY].forEach(key => localStorage.removeItem(key));
}
