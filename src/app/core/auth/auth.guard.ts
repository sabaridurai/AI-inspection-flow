import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
