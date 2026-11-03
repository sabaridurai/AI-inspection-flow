ALTER TABLE app_users
    ADD COLUMN inspection_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN weekly_summary_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN critical_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
