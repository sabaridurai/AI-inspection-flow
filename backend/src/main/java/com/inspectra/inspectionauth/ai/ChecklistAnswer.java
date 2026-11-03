package com.inspectra.inspectionauth.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChecklistAnswer(
        @NotBlank @Size(max = 120) String label,
        @NotBlank @Size(max = 500) String value) {
}
