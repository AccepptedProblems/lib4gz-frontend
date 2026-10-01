import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error';

function httpError(body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status: 400, error: body });
}

describe('apiErrorMessage', () => {
  it('reads the backend envelope reason', () => {
    const err = httpError({ errors: [{ type: 'SystemError', reason: 'Username already taken' }] });
    expect(apiErrorMessage(err, 'fallback')).toBe('Username already taken');
  });

  it('falls back to an input error message', () => {
    const err = httpError({ errors: [{ type: 'InputError', field: 'email', message: 'Missing or invalid' }] });
    expect(apiErrorMessage(err, 'fallback')).toBe('Missing or invalid');
  });

  it('falls back to a top-level message', () => {
    expect(apiErrorMessage(httpError({ message: 'Top level' }), 'fallback')).toBe('Top level');
  });

  it('falls back to the given text when the body has nothing usable', () => {
    expect(apiErrorMessage(httpError(null), 'Something went wrong')).toBe('Something went wrong');
    expect(apiErrorMessage(new Error('network'), 'Something went wrong')).toBe('Something went wrong');
  });
});
