package com.inspectra.inspectionauth.inspection;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "inspections", uniqueConstraints = @UniqueConstraint(
        name = "uq_inspections_user_client",
        columnNames = { "user_email", "client_id" }))
public class InspectionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false, length = 320)
    private String userEmail;

    @Column(name = "client_id", nullable = false, length = 100)
    private String clientId;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected InspectionEntity() {
    }

    InspectionEntity(String userEmail, String clientId, String payload) {
        this.userEmail = userEmail;
        this.clientId = clientId;
        this.payload = payload;
    }

    void updatePayload(String payload) {
        this.payload = payload;
    }

    @PrePersist
    void setCreatedAt() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void setUpdatedAt() {
        updatedAt = Instant.now();
    }

    public String getClientId() {
        return clientId;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
