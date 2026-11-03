import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  const logout = vi.fn();
  const navigateByUrl = vi.fn();
  const isAuthenticated = vi.fn(() => true);

  beforeEach(() => {
    logout.mockReset();
    navigateByUrl.mockReset();
    isAuthenticated.mockReset().mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { accessToken: signal('expired-token'), logout, isAuthenticated } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  it('clears an invalid session and redirects to login on an API 401', () => {
    const apiUrl = `${environment.apiBaseUrl}/ai/checklist`;
    client.post(apiUrl, {}).subscribe({ error: () => undefined });
    const request = http.expectOne(apiUrl);
    expect(request.request.headers.get('Authorization')).toBe('Bearer expired-token');

    request.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/login', {
      state: { authMessage: 'Your session expired. Please sign in again.' },
    });
  });

  it('does not clear the session for other API errors', () => {
    const apiUrl = `${environment.apiBaseUrl}/ai/checklist`;
    client.post(apiUrl, {}).subscribe({
      error: (error: unknown) => expect(error).toBeInstanceOf(HttpErrorResponse),
    });
    const request = http.expectOne(apiUrl);

    request.flush({ error: 'Provider unavailable' }, { status: 502, statusText: 'Bad Gateway' });

    expect(logout).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not send the JWT to another origin even if its URL contains an API path', () => {
    client.get('https://untrusted.example/api/data').subscribe();
    const request = http.expectOne('https://untrusted.example/api/data');

    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
