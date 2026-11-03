import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize } from 'rxjs';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, LucideDynamicIcon],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  readonly mode = signal<'login' | 'signup'>('login');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly loginForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly fullName = this.loginForm.controls.fullName;
  readonly email = this.loginForm.controls.email;
  readonly password = this.loginForm.controls.password;

  constructor() {
    const authMessage = this.router.getCurrentNavigation()?.extras.state?.['authMessage'];
    if (typeof authMessage === 'string') this.errorMessage.set(authMessage);
  }

  toggleMode(): void {
    const nextMode = this.mode() === 'login' ? 'signup' : 'login';
    this.mode.set(nextMode);
    this.errorMessage.set('');
    this.fullName.setValidators(nextMode === 'signup'
      ? [Validators.required, Validators.maxLength(120)]
      : []);
    this.password.setValidators(nextMode === 'signup'
      ? [Validators.required, Validators.minLength(8)]
      : [Validators.required]);
    this.fullName.updateValueAndValidity();
    this.password.updateValueAndValidity();
  }

  signIn(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);
    const { email, password } = this.loginForm.getRawValue();
    this.auth.login({ email, password }).pipe(
      finalize(() => this.submitting.set(false)),
    ).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: (error: unknown) => this.errorMessage.set(this.getErrorMessage(error)),
    });
  }

  signUp(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);
    this.auth.signup(this.loginForm.getRawValue()).pipe(
      finalize(() => this.submitting.set(false)),
    ).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: (error: unknown) => this.errorMessage.set(this.getErrorMessage(error)),
    });
  }

  submit(): void {
    if (this.mode() === 'signup') {
      this.signUp();
      return;
    }
    this.signIn();
  }

  private getErrorMessage(error: unknown): string {
    const action = this.mode() === 'signup' ? 'create your account' : 'sign in';
    if (!(error instanceof HttpErrorResponse)) return `Unable to ${action}. Please try again.`;
    if (error.status === 0) return 'Cannot reach the authentication service. Check that the backend is running.';
    if (error.status === 401) return 'Email or password is incorrect.';
    if (error.status === 409) return 'An account with this email already exists.';
    if (error.status === 400 && this.mode() === 'signup') return 'Check your details and use a password with at least 8 characters.';
    return `Unable to ${action}. Please try again later.`;
  }
}
