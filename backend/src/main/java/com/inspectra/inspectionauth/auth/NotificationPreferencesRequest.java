package com.inspectra.inspectionauth.auth;

public record NotificationPreferencesRequest(
        boolean inspectionReminders,
        boolean weeklySummary,
        boolean criticalAlerts) {
}
