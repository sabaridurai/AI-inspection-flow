package com.inspectra.inspectionauth.ai;

import java.util.List;

public record ChecklistQuestion(String key, String label, List<String> options) {
}
