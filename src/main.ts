import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    if (!isDevMode() && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .catch((error: unknown) => console.error('Could not register the offline app shell.', error));
    }
  })
  .catch((err) => console.error(err));
