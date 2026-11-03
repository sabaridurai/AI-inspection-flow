package com.inspectra.inspectionauth.inspection;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "inspection_evidence", uniqueConstraints = @UniqueConstraint(
        name = "uq_inspection_evidence_user_item",
        columnNames = { "user_email", "inspection_client_id", "evidence_id" }))
public class InspectionEvidenceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false, length = 320)
    private String userEmail;

    @Column(name = "inspection_client_id", nullable = false, length = 100)
    private String inspectionClientId;

    @Column(name = "evidence_id", nullable = false, length = 100)
    private String evidenceId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "media_type", nullable = false, length = 255)
    private String mediaType;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] content;

    protected InspectionEvidenceEntity() {
    }

    InspectionEvidenceEntity(
            String userEmail,
            String inspectionClientId,
            String evidenceId,
            String fileName,
            String mediaType,
            byte[] content) {
        this.userEmail = userEmail;
        this.inspectionClientId = inspectionClientId;
        this.evidenceId = evidenceId;
        this.fileName = fileName;
        this.mediaType = mediaType;
        this.content = content;
    }

    public String getMediaType() {
        return mediaType;
    }

    public byte[] getContent() {
        return content;
    }
}
