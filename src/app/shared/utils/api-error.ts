import { HttpErrorResponse } from '@angular/common/http';

/**
 * Human-readable text from a failed API call, or `fallback`.
 *
 * The backend envelope is `{ errors: [{ reason }] }` (or `{ errors: [{ message }] }` for input errors).
 * Its text is used only for responses the server wrote for a person: 4xx business errors, and the 503
 * it returns when a code cannot be emailed. Anything else gets `fallback`. A 500's body is whatever the
 * server failed with, a network error has no body, and neither belongs on a screen.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof HttpErrorResponse) || !isWrittenForPeople(err.status)) return fallback;
  const first = err.error?.errors?.[0];
  const text = first?.reason ?? first?.message ?? err.error?.message;
  return typeof text === 'string' && text.trim() ? text : fallback;
}

function isWrittenForPeople(status: number): boolean {
  return (status >= 400 && status < 500) || status === 503;
}
