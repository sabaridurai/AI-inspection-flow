import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { StorageService } from '../core/services/storage.service';
import { environment } from '../../environments/environment';

export const AUTH_SESSION_STORAGE_KEY = 'inspectra.auth.session';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest extends LoginRequest {
  fullName: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
}

export interface NotificationPreferences {
  inspectionReminders: boolean;
  weeklySummary: boolean;
  criticalAlerts: boolean;
}

export interface MailSenderCredentials {
  senderEmail: string;
  configured: boolean;
}

export interface SaveMailSenderCredentialsRequest {
  senderEmail: string;
  appPassword: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  name: string;
}

interface StoredAuthSession {
  accessToken: string;
  expiresAt: string;
  name?: string;
}

function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return typeof session['accessToken'] === 'string'
    && session['accessToken'].length > 0
    && typeof session['expiresAt'] === 'string'
    && Number.isFinite(Date.parse(session['expiresAt']))
    && (session['name'] === undefined || typeof session['name'] === 'string');
}

function getNameFromToken(token: string): string | null {
  const claims = getClaimsFromToken(token);
  return typeof claims?.['name'] === 'string' && claims['name'].trim() ? claims['name'].trim() : null;
}

function getSubjectFromToken(token: string): string | null {
  const subject = getClaimsFromToken(token)?.['sub'];
  return typeof subject === 'string' && subject.trim() ? subject.trim() : null;
}

function getClaimsFromToken(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims === 'object' && claims !== null ? claims as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly restoredSession = this.restoreSession();
  private readonly accessTokenState = signal<string | null>(this.restoredSession?.accessToken ?? null);
  private readonly expiresAtState = signal<number | null>(
    this.restoredSession ? Date.parse(this.restoredSession.expiresAt) : null,
  );
  private readonly displayNameState = signal(this.restoredSession?.name ?? 'Inspector');
  private readonly userSubjectState = signal(
    this.restoredSession ? getSubjectFromToken(this.restoredSession.accessToken) : null,
  );
  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  readonly authenticated = computed(() => {
    const expiresAt = this.expiresAtState();
    return this.accessTokenState() !== null && expiresAt !== null && expiresAt > Date.now();
  });
  readonly accessToken = this.accessTokenState.asReadonly();
  readonly displayName = this.displayNameState.asReadonly();
  readonly userSubject = this.userSubjectState.asReadonly();
  readonly initials = computed(() => {
    const parts = this.displayNameState().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'IN';
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  });
  readonly firstName = computed(() => this.displayNameState().trim().split(/\s+/)[0] || 'Inspector');

  constructor() {
    this.scheduleExpiration(this.expiresAtState());
  }

  isAuthenticated(): boolean {
    const expiresAt = this.expiresAtState();
    if (this.accessTokenState() && (expiresAt === null || expiresAt <= Date.now())) {
      this.expireSession();
    }
    return this.accessTokenState() !== null;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, credentials).pipe(
      tap((response) => this.saveSession(response)),
    );
  }

  signup(details: SignupRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/signup`, details).pipe(
      tap((response) => this.saveSession(response)),
    );
  }

  updateProfile(profile: UpdateProfileRequest): Observable<LoginResponse> {
    return this.http.put<LoginResponse>(`${environment.apiBaseUrl}/auth/me`, profile).pipe(
      tap((response) => this.saveSession(response)),
    );
  }

  getNotificationPreferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(`${environment.apiBaseUrl}/auth/me/notifications`);
  }

  updateNotificationPreferences(preferences: NotificationPreferences): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(
      `${environment.apiBaseUrl}/auth/me/notifications`,
      preferences,
    );
  }

  getMailSenderCredentials(): Observable<MailSenderCredentials> {
    return this.http.get<MailSenderCredentials>(`${environment.apiBaseUrl}/auth/me/notifications/mail`);
  }

  saveMailSenderCredentials(credentials: SaveMailSenderCredentialsRequest): Observable<MailSenderCredentials> {
    return this.http.put<MailSenderCredentials>(
      `${environment.apiBaseUrl}/auth/me/notifications/mail`,
      credentials,
    );
  }

  deleteMailSenderCredentials(): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/auth/me/notifications/mail`);
  }

  logout(): void {
    if (this.expirationTimer !== null) clearTimeout(this.expirationTimer);
    this.expirationTimer = null;
    this.accessTokenState.set(null);
    this.expiresAtState.set(null);
    this.displayNameState.set('Inspector');
    this.userSubjectState.set(null);
    this.storage.remove(AUTH_SESSION_STORAGE_KEY);
  }

  private restoreSession(): StoredAuthSession | null {
    const saved = this.storage.read(AUTH_SESSION_STORAGE_KEY, isStoredAuthSession);
    if (saved.status !== 'valid') {
      if (saved.status === 'invalid') this.storage.remove(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    if (Date.parse(saved.value.expiresAt) <= Date.now()) {
      this.storage.remove(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    return {
      ...saved.value,
      name: saved.value.name?.trim() || getNameFromToken(saved.value.accessToken) || 'Inspector',
    };
  }

  private saveSession(response: LoginResponse): void {
    if (!response.accessToken || !Number.isFinite(Date.parse(response.expiresAt))
      || Date.parse(response.expiresAt) <= Date.now()) {
      throw new Error('The authentication service returned an invalid or expired session.');
    }

    const name = response.name?.trim() || getNameFromToken(response.accessToken) || 'Inspector';
    const saved = this.storage.write(AUTH_SESSION_STORAGE_KEY, {
      accessToken: response.accessToken,
      expiresAt: response.expiresAt,
      name,
    });
    if (!saved.success) {
      throw new Error(saved.error ?? 'Could not save the authentication session.');
    }
    this.accessTokenState.set(response.accessToken);
    this.expiresAtState.set(Date.parse(response.expiresAt));
    this.displayNameState.set(name);
    this.userSubjectState.set(getSubjectFromToken(response.accessToken));
    this.scheduleExpiration(this.expiresAtState());
  }

  private scheduleExpiration(expiresAt: number | null): void {
    if (this.expirationTimer !== null) clearTimeout(this.expirationTimer);
    this.expirationTimer = null;
    if (expiresAt === null) return;

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      this.expireSession();
      return;
    }

    const maxTimeout = 2_147_000_000;
    this.expirationTimer = setTimeout(() => {
      if (expiresAt <= Date.now()) {
        this.expireSession();
      } else {
        this.scheduleExpiration(expiresAt);
      }
    }, Math.min(remaining, maxTimeout));
  }

  private expireSession(): void {
    if (!this.accessTokenState()) return;
    this.logout();
    void this.router.navigateByUrl('/login', {
      state: { authMessage: 'Your session expired. Please sign in again.' },
    });
  }
}
