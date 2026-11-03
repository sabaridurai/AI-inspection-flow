package com.inspectra.inspectionauth.inspection;

import java.time.Instant;

public record InspectionSyncResponse(String clientId, Instant updatedAt) {
}
