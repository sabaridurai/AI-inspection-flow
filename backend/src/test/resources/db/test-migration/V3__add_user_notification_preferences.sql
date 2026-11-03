ALTER TABLE app_users
    ADD COLUMN inspection_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE app_users
    ADD COLUMN weekly_summary_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE app_users
    ADD COLUMN critical_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
