package com.inspectra.inspectionauth.inspection;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class InspectionService {
    private final InspectionRepository inspections;
    private final InspectionEvidenceRepository evidence;
    private final ObjectMapper objectMapper;

    public InspectionService(
            InspectionRepository inspections,
            InspectionEvidenceRepository evidence,
            ObjectMapper objectMapper) {
        this.inspections = inspections;
        this.evidence = evidence;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public InspectionSyncResponse upsert(
            String userEmail,
            String clientId,
            JsonNode payload,
            List<MultipartFile> files) {
        Set<String> expectedEvidenceIds = extractEvidenceIds(payload, clientId);
        Set<String> uploadedEvidenceIds = new HashSet<>();
        for (MultipartFile file : files) {
            String evidenceId = file.getOriginalFilename();
            if (evidenceId == null || !expectedEvidenceIds.contains(evidenceId)
                    || !uploadedEvidenceIds.add(evidenceId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid inspection evidence upload.");
            }
        }
        if (!uploadedEvidenceIds.equals(expectedEvidenceIds)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inspection evidence files are incomplete.");
        }

        String serializedPayload;
        try {
            serializedPayload = objectMapper.writeValueAsString(payload);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not serialize inspection data.", exception);
        }

        InspectionEntity inspection = inspections.findByUserEmailAndClientId(userEmail, clientId)
                .map(existing -> {
                    existing.updatePayload(serializedPayload);
                    return existing;
                })
                .orElseGet(() -> new InspectionEntity(userEmail, clientId, serializedPayload));
        inspection = inspections.saveAndFlush(inspection);

        evidence.deleteByUserEmailAndInspectionClientId(userEmail, clientId);
        evidence.flush();
        List<InspectionEvidenceEntity> uploadedFiles = files.stream().map(file -> {
            try {
                JsonNode metadata = findEvidence(payload, file.getOriginalFilename());
                return new InspectionEvidenceEntity(
                        userEmail,
                        clientId,
                        file.getOriginalFilename(),
                        metadata.path("name").asText(),
                        metadata.path("mediaType").asText("application/octet-stream"),
                        file.getBytes());
            } catch (IOException exception) {
                throw new IllegalStateException("Could not read inspection evidence.", exception);
            }
        }).toList();
        evidence.saveAll(uploadedFiles);
        return new InspectionSyncResponse(inspection.getClientId(), inspection.getUpdatedAt());
    }

    @Transactional(readOnly = true)
    public List<JsonNode> findAll(String userEmail) {
        return inspections.findAllByUserEmailOrderByUpdatedAtDesc(userEmail).stream().map(inspection -> {
            try {
                return objectMapper.readTree(inspection.getPayload());
            } catch (IOException exception) {
                throw new IllegalStateException("Could not read stored inspection data.", exception);
            }
        }).toList();
    }

    @Transactional(readOnly = true)
    public Optional<InspectionEvidenceEntity> findEvidence(String userEmail, String clientId, String evidenceId) {
        return evidence.findByUserEmailAndInspectionClientIdAndEvidenceId(userEmail, clientId, evidenceId);
    }

    private Set<String> extractEvidenceIds(JsonNode payload, String clientId) {
        if (!clientId.equals(payload.path("id").asText())
                || !payload.path("checklist").isArray()
                || !payload.path("asset").isTextual()
                || !payload.path("assetType").isTextual()
                || !payload.path("location").isTextual()
                || !payload.path("inspector").isTextual()
                || !payload.path("date").isTextual()
                || !payload.path("status").isTextual()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inspection data is incomplete or invalid.");
        }

        Set<String> evidenceIds = new HashSet<>();
        for (JsonNode item : payload.path("checklist")) {
            JsonNode evidenceList = item.path("evidence");
            if (!evidenceList.isArray()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inspection evidence metadata is invalid.");
            }
            for (JsonNode itemEvidence : evidenceList) {
                String evidenceId = itemEvidence.path("id").asText();
                if (evidenceId.isBlank() || !itemEvidence.path("name").isTextual()
                        || !itemEvidence.path("mediaType").isTextual() || !evidenceIds.add(evidenceId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inspection evidence metadata is invalid.");
                }
            }
        }
        return evidenceIds;
    }

    private JsonNode findEvidence(JsonNode payload, String evidenceId) {
        for (JsonNode item : payload.path("checklist")) {
            for (JsonNode itemEvidence : item.path("evidence")) {
                if (evidenceId.equals(itemEvidence.path("id").asText())) return itemEvidence;
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inspection evidence metadata was not found.");
    }
}
