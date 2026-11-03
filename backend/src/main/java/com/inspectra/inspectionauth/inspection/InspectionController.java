package com.inspectra.inspectionauth.inspection;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {
    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @GetMapping
    public List<JsonNode> list(@AuthenticationPrincipal Jwt jwt) {
        return inspectionService.findAll(jwt.getSubject());
    }

    @GetMapping("/{clientId}/evidence/{evidenceId}")
    public ResponseEntity<byte[]> evidence(
            @PathVariable String clientId,
            @PathVariable String evidenceId,
            @AuthenticationPrincipal Jwt jwt) {
        InspectionEvidenceEntity file = inspectionService.findEvidence(jwt.getSubject(), clientId, evidenceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inspection evidence was not found."));
        MediaType contentType;
        try {
            contentType = MediaType.parseMediaType(file.getMediaType());
        } catch (IllegalArgumentException exception) {
            contentType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(contentType)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(file.getContent());
    }

    @PutMapping(path = "/{clientId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InspectionSyncResponse sync(
            @PathVariable String clientId,
            @RequestPart("inspection") JsonNode payload,
            MultipartHttpServletRequest multipartRequest,
            @AuthenticationPrincipal Jwt jwt) {
        MultiValueMap<String, MultipartFile> files = multipartRequest.getMultiFileMap();
        List<MultipartFile> evidence = files.getOrDefault("files", List.of());
        if (files.keySet().stream().anyMatch(key -> !key.equals("files") && !key.equals("inspection"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unexpected inspection upload part.");
        }
        return inspectionService.upsert(jwt.getSubject(), clientId, payload, evidence);
    }
}
