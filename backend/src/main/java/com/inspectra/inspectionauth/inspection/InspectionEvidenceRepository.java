package com.inspectra.inspectionauth.inspection;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InspectionEvidenceRepository extends JpaRepository<InspectionEvidenceEntity, Long> {
    void deleteByUserEmailAndInspectionClientId(String userEmail, String inspectionClientId);
    Optional<InspectionEvidenceEntity> findByUserEmailAndInspectionClientIdAndEvidenceId(
            String userEmail, String inspectionClientId, String evidenceId);
}
