package com.inspectra.inspectionauth.inspection;

import java.util.Optional;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InspectionRepository extends JpaRepository<InspectionEntity, Long> {
    Optional<InspectionEntity> findByUserEmailAndClientId(String userEmail, String clientId);
    List<InspectionEntity> findAllByUserEmailOrderByUpdatedAtDesc(String userEmail);
}
