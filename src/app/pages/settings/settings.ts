import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize } from 'rxjs';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, LucideDynamicIcon],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  private readonly auth = inject(Auth);
  readonly initials = this.auth.initials;
  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly loadingPreferences = signal(true);
  readonly preferencesLoaded = signal(false);
  readonly savingPreferences = signal(false);
  readonly preferencesSaved = signal(false);
  readonly preferencesError = signal('');
  readonly loadingMailCredentials = signal(true);
  readonly mailCredentialsConfigured = signal(false);
  readonly savingMailCredentials = signal(false);
  readonly mailCredentialsSaved = signal(false);
  readonly mailCredentialsError = signal('');
  readonly profileForm = new FormGroup({
    name: new FormControl(this.auth.displayName(), { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl(this.auth.userSubject() ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });
  readonly notificationForm = new FormGroup({
    inspectionReminders: new FormControl(true, { nonNullable: true }),
    weeklySummary: new FormControl(false, { nonNullable: true }),
    criticalAlerts: new FormControl(true, { nonNullable: true }),
  });
  readonly mailCredentialsForm = new FormGroup({
    senderEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    appPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.loadNotificationPreferences();
    this.loadMailSenderCredentials();
  }

  loadNotificationPreferences(): void {
    this.loadingPreferences.set(true);
    this.preferencesError.set('');
    this.auth.getNotificationPreferences()
      .pipe(finalize(() => this.loadingPreferences.set(false)))
      .subscribe({
        next: (preferences) => {
          this.notificationForm.setValue(preferences);
          this.preferencesLoaded.set(true);
        },
        error: () => this.preferencesError.set('Could not load notification preferences. Please try again.'),
      });
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.saving()) return;

    this.saved.set(false);
    this.errorMessage.set('');
    this.saving.set(true);
    const { name, email } = this.profileForm.getRawValue();
    this.auth.updateProfile({ fullName: name.trim(), email: email.trim() })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.saved.set(true),
        error: (error: unknown) => {
          const apiMessage = error instanceof HttpErrorResponse
            && typeof error.error === 'object'
            && error.error !== null
            && 'error' in error.error
            && typeof error.error.error === 'string'
            ? error.error.error
            : null;
          this.errorMessage.set(apiMessage ?? 'Could not update your profile. Please try again.');
        },
      });
  }

  saveNotificationPreferences(): void {
    if (!this.preferencesLoaded() || this.loadingPreferences() || this.savingPreferences()
      || this.notificationForm.invalid) return;

    this.preferencesSaved.set(false);
    this.preferencesError.set('');
    this.savingPreferences.set(true);
    this.auth.updateNotificationPreferences(this.notificationForm.getRawValue())
      .pipe(finalize(() => this.savingPreferences.set(false)))
      .subscribe({
        next: (preferences) => {
          this.notificationForm.setValue(preferences);
          this.preferencesSaved.set(true);
        },
        error: () => this.preferencesError.set('Could not save notification preferences. Please try again.'),
      });
  }

  loadMailSenderCredentials(): void {
    this.loadingMailCredentials.set(true);
    this.mailCredentialsError.set('');
    this.auth.getMailSenderCredentials()
      .pipe(finalize(() => this.loadingMailCredentials.set(false)))
      .subscribe({
        next: (credentials) => {
          this.mailCredentialsForm.controls.senderEmail.setValue(credentials.senderEmail);
          this.mailCredentialsConfigured.set(credentials.configured);
        },
        error: () => this.mailCredentialsError.set('Could not load saved sender details. Please try again.'),
      });
  }

  saveMailSenderCredentials(): void {
    if (this.mailCredentialsForm.invalid || this.loadingMailCredentials() || this.savingMailCredentials()) return;

    this.mailCredentialsSaved.set(false);
    this.mailCredentialsError.set('');
    this.savingMailCredentials.set(true);
    const { senderEmail, appPassword } = this.mailCredentialsForm.getRawValue();
    this.auth.saveMailSenderCredentials({ senderEmail: senderEmail.trim(), appPassword })
      .pipe(finalize(() => this.savingMailCredentials.set(false)))
      .subscribe({
        next: (credentials) => {
          this.mailCredentialsForm.controls.senderEmail.setValue(credentials.senderEmail);
          this.mailCredentialsForm.controls.appPassword.setValue('');
          this.mailCredentialsConfigured.set(credentials.configured);
          this.mailCredentialsSaved.set(true);
        },
        error: (error: unknown) => this.mailCredentialsError.set(
          this.getApiErrorMessage(error)
            ?? 'Could not save sender credentials. Check the email and server encryption-key configuration.',
        ),
      });
  }

  deleteMailSenderCredentials(): void {
    if (!this.mailCredentialsConfigured() || this.savingMailCredentials()) return;

    this.mailCredentialsSaved.set(false);
    this.mailCredentialsError.set('');
    this.savingMailCredentials.set(true);
    this.auth.deleteMailSenderCredentials()
      .pipe(finalize(() => this.savingMailCredentials.set(false)))
      .subscribe({
        next: () => {
          this.mailCredentialsForm.reset({ senderEmail: '', appPassword: '' });
          this.mailCredentialsConfigured.set(false);
          this.mailCredentialsSaved.set(false);
        },
        error: () => this.mailCredentialsError.set('Could not remove saved sender credentials. Please try again.'),
      });
  }

  private getApiErrorMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse) || typeof error.error !== 'object' || error.error === null) {
      return null;
    }
    if ('error' in error.error && typeof error.error.error === 'string') return error.error.error;
    if ('message' in error.error && typeof error.error.message === 'string') return error.error.message;
    return null;
  }
}
