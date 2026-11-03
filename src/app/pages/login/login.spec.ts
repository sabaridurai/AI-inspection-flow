import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Auth } from '../../services/auth';
import { Login } from './login';

describe('Login', () => {
  const navigateByUrl = vi.fn();
  const getCurrentNavigation = vi.fn(() => null);
  const login = vi.fn();
  const signup = vi.fn();

  beforeEach(async () => {
    navigateByUrl.mockReset();
    login.mockReset();
    signup.mockReset();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: Router, useValue: { navigateByUrl, getCurrentNavigation } },
        { provide: Auth, useValue: { login, signup } },
      ],
    }).compileComponents();
  });

  it('shows validation errors and does not call the API with invalid input', () => {
    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;

    component.signIn();

    expect(component.loginForm.invalid).toBe(true);
    expect(component.email.touched).toBe(true);
    expect(component.password.touched).toBe(true);
    expect(login).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('continues to the workspace after the API accepts valid credentials', () => {
    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;
    login.mockReturnValue(of({ accessToken: 'token', tokenType: 'Bearer', expiresAt: '2026-01-01T00:15:00Z', name: 'Demo Inspector' }));
    component.loginForm.setValue({ fullName: '', email: 'demo@example.com', password: 'demo-password' });

    component.signIn();

    expect(login).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'demo-password' });
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows an error and stays on login when the API rejects credentials', () => {
    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    component.loginForm.setValue({ fullName: '', email: 'demo@example.com', password: 'wrong-password' });

    component.signIn();

    expect(component.errorMessage()).toBe('Email or password is incorrect.');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('creates an account and continues to the workspace', () => {
    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;
    signup.mockReturnValue(of({ accessToken: 'token', tokenType: 'Bearer', expiresAt: '2026-01-01T00:15:00Z', name: 'New Inspector' }));
    component.toggleMode();
    component.loginForm.setValue({
      fullName: 'New Inspector',
      email: 'new@example.com',
      password: 'strong-password',
    });

    component.submit();

    expect(signup).toHaveBeenCalledWith({
      fullName: 'New Inspector',
      email: 'new@example.com',
      password: 'strong-password',
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a useful error when the signup email is already registered', () => {
    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;
    signup.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.toggleMode();
    component.loginForm.setValue({
      fullName: 'New Inspector',
      email: 'existing@example.com',
      password: 'strong-password',
    });

    component.submit();

    expect(component.errorMessage()).toBe('An account with this email already exists.');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
