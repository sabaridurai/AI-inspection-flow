import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	{ path: 'login', canActivate: [guestGuard], data: { layout: 'auth' }, loadComponent: () => import('./pages/login/login').then((page) => page.Login) },
	{ path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard').then((page) => page.Dashboard) },
	{ path: 'inspections', canActivate: [authGuard], loadComponent: () => import('./pages/inspections/inspections').then((page) => page.Inspections) },
	{ path: 'inspections/:id', canActivate: [authGuard], loadComponent: () => import('./pages/inspection-details/inspection-details').then((page) => page.InspectionDetails) },
	{ path: 'checklist-builder', canActivate: [authGuard], loadComponent: () => import('./pages/checklist-builder/checklist-builder').then((page) => page.ChecklistBuilder) },
	{ path: 'reports', canActivate: [authGuard], loadComponent: () => import('./pages/reports/reports').then((page) => page.Reports) },
	{ path: 'settings', canActivate: [authGuard], loadComponent: () => import('./pages/settings/settings').then((page) => page.Settings) },
	{ path: '**', redirectTo: 'login' },
];
