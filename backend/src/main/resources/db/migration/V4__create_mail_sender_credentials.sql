CREATE TABLE mail_sender_credentials (
    app_user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    sender_email VARCHAR(320) NOT NULL,
    encrypted_app_password VARCHAR(1024) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
