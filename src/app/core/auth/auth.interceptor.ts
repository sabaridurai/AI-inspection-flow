import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Auth } from '../../services/auth';
import { environment } from '../../../environments/environment';

function isConfiguredApiRequest(url: string): boolean {
  const apiBase = new URL(environment.apiBaseUrl);
  const requestUrl = new URL(url, apiBase);
  const apiPath = apiBase.pathname.replace(/\/+$/, '');
  return requestUrl.origin === apiBase.origin
    && (requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(`${apiPath}/`));
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return next(request);
  const token = auth.accessToken();
  if (!token || !isConfiguredApiRequest(request.url)) return next(request);

  return next(request.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  })).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      auth.logout();
      void router.navigateByUrl('/login', {
        state: { authMessage: 'Your session expired. Please sign in again.' },
      });
    }
    return throwError(() => error);
  }));
};
