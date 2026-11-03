import { Injectable } from '@angular/core';

interface DatabaseEntry<T> {
  key: string;
  value: T;
}

@Injectable({ providedIn: 'root' })
export class OfflineDatabaseService {
  private databasePromise?: Promise<IDBDatabase>;

  read<T>(key: string): Promise<T | undefined> {
    return this.openDatabase().then((database) => new Promise<T | undefined>((resolve, reject) => {
      const request = database.transaction('records', 'readonly')
        .objectStore('records')
        .get(key) as IDBRequest<DatabaseEntry<T> | undefined>;
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error ?? new Error('Could not read offline data.'));
    }));
  }

  write<T>(key: string, value: T): Promise<void> {
    return this.writeMany([{ key, value }]);
  }

  writeMany(entries: Array<{ key: string; value: unknown }>): Promise<void> {
    return this.writeAndRemove(entries, []);
  }

  writeAndRemove(entries: Array<{ key: string; value: unknown }>, keysToRemove: string[]): Promise<void> {
    return this.openDatabase().then((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      for (const entry of entries) store.put(entry);
      for (const key of keysToRemove) store.delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save offline data.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving offline data was interrupted.'));
    }));
  }

  remove(key: string): Promise<void> {
    return this.openDatabase().then((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      transaction.objectStore('records').delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove offline data.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Removing offline data was interrupted.'));
    }));
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!globalThis.indexedDB) {
      return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
    }

    this.databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open('inspectra-offline-data', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('records', { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'));
      request.onblocked = () => reject(new Error('Offline storage is blocked by another open app tab.'));
    }).catch((error: unknown) => {
      this.databasePromise = undefined;
      throw error;
    });

    return this.databasePromise;
  }
}
