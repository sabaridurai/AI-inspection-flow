package com.inspectra.inspectionauth.user;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_users")
public class AppUser implements UserDetails {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 320)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "inspection_reminders_enabled", nullable = false)
    private boolean inspectionRemindersEnabled = true;

    @Column(name = "weekly_summary_enabled", nullable = false)
    private boolean weeklySummaryEnabled;

    @Column(name = "critical_alerts_enabled", nullable = false)
    private boolean criticalAlertsEnabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AppUser() {
    }

    public AppUser(String email, String passwordHash, String fullName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
    }

    @PrePersist
    void setCreatedAt() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }

    public void updateProfile(String email, String fullName) {
        this.email = email;
        this.fullName = fullName;
    }

    public boolean isInspectionRemindersEnabled() {
        return inspectionRemindersEnabled;
    }

    public boolean isWeeklySummaryEnabled() {
        return weeklySummaryEnabled;
    }

    public boolean isCriticalAlertsEnabled() {
        return criticalAlertsEnabled;
    }

    public void updateNotificationPreferences(
            boolean inspectionReminders,
            boolean weeklySummary,
            boolean criticalAlerts) {
        this.inspectionRemindersEnabled = inspectionReminders;
        this.weeklySummaryEnabled = weeklySummary;
        this.criticalAlertsEnabled = criticalAlerts;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }
}
