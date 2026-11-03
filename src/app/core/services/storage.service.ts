import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type StorageReadResult<T> =
  | { status: 'missing'; value: null }
  | { status: 'valid'; value: T }
  | { status: 'invalid'; value: null; error: string }
  | { status: 'unavailable'; value: null; error: string };

export interface StorageWriteResult {
  success: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly lastError = signal<string | null>(null);

  read<T>(key: string, validate: (value: unknown) => value is T): StorageReadResult<T> {
    if (!isPlatformBrowser(this.platformId)) return { status: 'unavailable', value: null, error: 'Browser storage is not available during server rendering.' };

    try {
      const saved = globalThis.localStorage.getItem(key);
      if (saved === null) return { status: 'missing', value: null };

      let parsed: unknown;
      try {
        parsed = JSON.parse(saved);
      } catch {
        const error = `Saved application data for "${key}" is not valid JSON. Seed data is being used for this session.`;
        this.lastError.set(error);
        return { status: 'invalid', value: null, error };
      }

      if (!validate(parsed)) {
        const error = `Saved application data for "${key}" has an unsupported schema. Seed data is being used for this session.`;
        this.lastError.set(error);
        return { status: 'invalid', value: null, error };
      }

      this.lastError.set(null);
      return { status: 'valid', value: parsed };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'Browser storage access was denied.';
      const message = `Could not read saved application data: ${detail}`;
      this.lastError.set(message);
      return { status: 'unavailable', value: null, error: message };
    }
  }

  write<T>(key: string, value: T): StorageWriteResult {
    if (!isPlatformBrowser(this.platformId)) {
      const error = 'Browser storage is not available during server rendering.';
      this.lastError.set(error);
      return { success: false, error };
    }

    try {
      globalThis.localStorage.setItem(key, JSON.stringify(value));
      this.lastError.set(null);
      return { success: true, error: null };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'Browser storage access was denied.';
      const message = `Could not save application data: ${detail}`;
      this.lastError.set(message);
      return { success: false, error: message };
    }
  }

  remove(key: string): StorageWriteResult {
    if (!isPlatformBrowser(this.platformId)) {
      const error = 'Browser storage is not available during server rendering.';
      this.lastError.set(error);
      return { success: false, error };
    }

    try {
      globalThis.localStorage.removeItem(key);
      this.lastError.set(null);
      return { success: true, error: null };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'Browser storage access was denied.';
      const message = `Could not remove saved application data: ${detail}`;
      this.lastError.set(message);
      return { success: false, error: message };
    }
  }
}
