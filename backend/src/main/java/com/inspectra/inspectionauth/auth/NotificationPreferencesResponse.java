package com.inspectra.inspectionauth.auth;

public record NotificationPreferencesResponse(
        boolean inspectionReminders,
        boolean weeklySummary,
        boolean criticalAlerts) {
}
