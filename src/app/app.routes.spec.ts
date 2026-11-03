import { routes } from './app.routes';
import { authGuard, guestGuard } from './core/auth/auth.guard';

const workspacePaths = [
  'dashboard',
  'inspections',
  'inspections/:id',
  'checklist-builder',
  'reports',
  'settings',
];

describe('routes', () => {
  it('sends direct visits to the guarded dashboard which checks the stored JWT', () => {
    expect(routes.find((route) => route.path === '')?.redirectTo).toBe('dashboard');
  });

  it('redirects authenticated users away from login and keeps its auth layout for guests', () => {
    const loginRoute = routes.find((route) => route.path === 'login');

    expect(loginRoute?.data?.['layout']).toBe('auth');
    expect(loginRoute?.canActivate).toContain(guestGuard);
  });

  it('protects the inspection workspace behind the authentication guard', () => {
    const workspaceRoutes = routes.filter((route) => workspacePaths.includes(route.path ?? ''));

    expect(workspaceRoutes).toHaveLength(workspacePaths.length);
    expect(workspaceRoutes.every((route) => route.canActivate?.includes(authGuard))).toBe(true);
  });
});
