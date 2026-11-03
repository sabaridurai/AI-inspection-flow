package com.inspectra.inspectionauth.user;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "mail_sender_credentials")
public class MailSenderCredential {
    @Id
    @Column(name = "app_user_id")
    private Long appUserId;

    @Column(name = "sender_email", nullable = false, length = 320)
    private String senderEmail;

    @Column(name = "encrypted_app_password", nullable = false, length = 1024)
    private String encryptedAppPassword;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MailSenderCredential() {
    }

    public MailSenderCredential(Long appUserId, String senderEmail, String encryptedAppPassword) {
        this.appUserId = appUserId;
        this.senderEmail = senderEmail;
        this.encryptedAppPassword = encryptedAppPassword;
    }

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = Instant.now();
    }

    public Long getAppUserId() {
        return appUserId;
    }

    public String getSenderEmail() {
        return senderEmail;
    }

    public String getEncryptedAppPassword() {
        return encryptedAppPassword;
    }

    public void update(String senderEmail, String encryptedAppPassword) {
        this.senderEmail = senderEmail;
        this.encryptedAppPassword = encryptedAppPassword;
    }
}
