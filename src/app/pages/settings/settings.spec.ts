import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { Settings } from './settings';
import { appConfig } from '../../app.config';
import { Auth, NotificationPreferences } from '../../services/auth';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;
  const updateProfile = vi.fn(() => of({
    accessToken: 'updated-token',
    tokenType: 'Bearer' as const,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    name: 'Taylor Morgan',
  }));
  const notificationPreferences = {
    inspectionReminders: true,
    weeklySummary: false,
    criticalAlerts: true,
  };
  const getNotificationPreferences = vi.fn(() => of(notificationPreferences));
  const updateNotificationPreferences = vi.fn((preferences: NotificationPreferences) => of(preferences));
  const mailCredentialsResponse = { senderEmail: '', configured: false };
  const getMailSenderCredentials = vi.fn(() => of(mailCredentialsResponse));
  const saveMailSenderCredentials = vi.fn((credentials: {
    senderEmail: string;
    appPassword: string;
  }) => of({ senderEmail: credentials.senderEmail, configured: true }));
  const deleteMailSenderCredentials = vi.fn(() => of(void 0));

  beforeEach(async () => {
    updateProfile.mockClear();
    getNotificationPreferences.mockClear();
    updateNotificationPreferences.mockClear();
    getMailSenderCredentials.mockClear();
    saveMailSenderCredentials.mockClear();
    deleteMailSenderCredentials.mockClear();
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        ...appConfig.providers,
        {
          provide: Auth,
          useValue: {
            displayName: signal('Taylor Morgan'),
            initials: signal('TM'),
            userSubject: signal('taylor@example.com'),
            updateProfile,
            getNotificationPreferences,
            updateNotificationPreferences,
            getMailSenderCredentials,
            saveMailSenderCredentials,
            deleteMailSenderCredentials,
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the signed-in profile and omits unsupported role and time zone fields', () => {
    const text = fixture.nativeElement.textContent;
    const inputs = fixture.nativeElement.querySelectorAll('input');

    expect(text).toContain('TM');
    expect(text).not.toContain('Time zone');
    expect(text).not.toContain('Role');
    expect(text).not.toContain('Jordan Davis');
    expect(text).not.toContain('Northstar Operations');
    expect(text).not.toContain('Professional');
    expect(text).not.toContain('Local mock data');
    expect(inputs[0].value).toBe('Taylor Morgan');
    expect(inputs[1].value).toBe('taylor@example.com');
  });

  it('saves the profile and displays a success confirmation', () => {
    component.profileForm.setValue({
      name: 'Taylor Morgan',
      email: 'taylor@example.com',
    });

    component.saveProfile();
    fixture.detectChanges();

    expect(updateProfile).toHaveBeenCalledWith({
      fullName: 'Taylor Morgan',
      email: 'taylor@example.com',
    });
    expect(fixture.nativeElement.textContent).toContain('Profile updated');
  });

  it('loads saved notification preferences and persists changes separately', () => {
    expect(getNotificationPreferences).toHaveBeenCalledOnce();
    expect(component.notificationForm.getRawValue()).toEqual(notificationPreferences);

    component.notificationForm.setValue({
      inspectionReminders: false,
      weeklySummary: true,
      criticalAlerts: false,
    });
    component.saveNotificationPreferences();
    fixture.detectChanges();

    expect(updateNotificationPreferences).toHaveBeenCalledWith({
      inspectionReminders: false,
      weeklySummary: true,
      criticalAlerts: false,
    });
    expect(fixture.nativeElement.textContent).toContain('Preferences saved');
  });

  it('saves sender credentials and clears the password from the form afterward', () => {
    component.mailCredentialsForm.setValue({
      senderEmail: 'reports@example.com',
      appPassword: 'test-app-password',
    });

    component.saveMailSenderCredentials();
    fixture.detectChanges();

    expect(saveMailSenderCredentials).toHaveBeenCalledWith({
      senderEmail: 'reports@example.com',
      appPassword: 'test-app-password',
    });
    expect(component.mailCredentialsForm.controls.appPassword.value).toBe('');
    expect(component.mailCredentialsConfigured()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Sender credentials saved');
  });
});
