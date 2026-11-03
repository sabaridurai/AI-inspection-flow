import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AUTH_SESSION_STORAGE_KEY, Auth } from './auth';
import { environment } from '../../environments/environment';

describe('Auth', () => {
  let service: Auth;
  let http: HttpTestingController;
  const storedValues = new Map<string, string>();
  const navigateByUrl = vi.fn();
  const localStorageMock = {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
    removeItem: (key: string) => storedValues.delete(key),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    storedValues.clear();
    navigateByUrl.mockReset();
    vi.stubGlobal('localStorage', localStorageMock);
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    service = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('persists the access token after a successful login and clears it on logout', () => {
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    service.login({ email: 'demo@example.com', password: 'secret' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      expiresAt,
      name: 'Test Inspector',
    });

    expect(service.authenticated()).toBe(true);
    expect(service.accessToken()).toBe('signed-token');
    expect(service.displayName()).toBe('Test Inspector');
    expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY) ?? '{}')).toEqual({
      accessToken: 'signed-token',
      expiresAt,
      name: 'Test Inspector',
    });

    service.logout();
    expect(service.authenticated()).toBe(false);
    expect(service.displayName()).toBe('Inspector');
    expect(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('stores the access token after successful signup', () => {
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const encodedClaims = btoa(JSON.stringify({ sub: 'new@example.com', name: 'New Inspector' }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    service.signup({ fullName: 'Test Inspector', email: 'demo@example.com', password: 'strong-pass' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/signup`).flush({
      accessToken: `header.${encodedClaims}.signature`,
      tokenType: 'Bearer',
      expiresAt,
      name: 'New Inspector',
    });

    expect(service.authenticated()).toBe(true);
    expect(service.accessToken()).toBe(`header.${encodedClaims}.signature`);
    expect(service.displayName()).toBe('New Inspector');
    expect(service.userSubject()).toBe('new@example.com');
    expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY) ?? '{}').accessToken)
      .toBe(`header.${encodedClaims}.signature`);
  });

  it('saves an updated profile and replaces the session token', () => {
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const encodedClaims = btoa(JSON.stringify({ sub: 'updated@example.com', name: 'Updated Inspector' }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    service.updateProfile({ fullName: 'Updated Inspector', email: 'updated@example.com' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({
      accessToken: `header.${encodedClaims}.signature`,
      tokenType: 'Bearer',
      expiresAt,
      name: 'Updated Inspector',
    });

    expect(service.displayName()).toBe('Updated Inspector');
    expect(service.userSubject()).toBe('updated@example.com');
    expect(service.accessToken()).toBe(`header.${encodedClaims}.signature`);
  });

  it('loads and saves notification preferences through the authenticated API', () => {
    const preferences = {
      inspectionReminders: false,
      weeklySummary: true,
      criticalAlerts: false,
    };

    service.getNotificationPreferences().subscribe((result) => {
      expect(result).toEqual(preferences);
    });
    http.expectOne(`${environment.apiBaseUrl}/auth/me/notifications`).flush(preferences);

    service.updateNotificationPreferences(preferences).subscribe((result) => {
      expect(result).toEqual(preferences);
    });
    http.expectOne(`${environment.apiBaseUrl}/auth/me/notifications`).flush(preferences);
  });

  it('saves sender credentials and only retrieves non-secret status', () => {
    const saved = { senderEmail: 'reports@example.com', configured: true };
    service.getMailSenderCredentials().subscribe((result) => {
      expect(result).toEqual({ senderEmail: '', configured: false });
    });
    http.expectOne(`${environment.apiBaseUrl}/auth/me/notifications/mail`).flush({
      senderEmail: '',
      configured: false,
    });

    service.saveMailSenderCredentials({
      senderEmail: 'reports@example.com',
      appPassword: 'secret-app-password',
    }).subscribe((result) => {
      expect(result).toEqual(saved);
    });
    const request = http.expectOne(`${environment.apiBaseUrl}/auth/me/notifications/mail`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      senderEmail: 'reports@example.com',
      appPassword: 'secret-app-password',
    });
    request.flush(saved);
  });

  it('restores a valid session from local storage after service recreation', () => {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
      accessToken: 'restored-token',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      name: 'Restored Inspector',
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });

    const restoredService = TestBed.inject(Auth);

    expect(restoredService.authenticated()).toBe(true);
    expect(restoredService.accessToken()).toBe('restored-token');
    expect(restoredService.displayName()).toBe('Restored Inspector');
  });

  it('discards an expired session from local storage', () => {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
      accessToken: 'expired-token',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });

    const restoredService = TestBed.inject(Auth);

    expect(restoredService.authenticated()).toBe(false);
    expect(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('expires an active JWT and requires the user to sign in again', async () => {
    const expiresAt = new Date(Date.now() + 1_000).toISOString();
    service.login({ email: 'demo@example.com', password: 'secret' }).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      accessToken: 'short-lived-token',
      tokenType: 'Bearer',
      expiresAt,
      name: 'Test Inspector',
    });

    expect(service.isAuthenticated()).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/login', {
      state: { authMessage: 'Your session expired. Please sign in again.' },
    });
  });
});
