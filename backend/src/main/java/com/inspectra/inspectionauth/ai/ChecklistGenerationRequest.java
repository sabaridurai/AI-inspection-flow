package com.inspectra.inspectionauth.ai;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChecklistGenerationRequest(
        @NotBlank @Size(max = 120) String assetType,
        @Size(max = 120) String asset,
        @Size(max = 200) String location,
        @Size(max = 120) String inspector,
        @Size(max = 40) String date,
        @Valid @Size(max = 12) List<ChecklistAnswer> answers) {
}
