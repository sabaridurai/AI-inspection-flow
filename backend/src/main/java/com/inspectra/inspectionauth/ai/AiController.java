package com.inspectra.inspectionauth.ai;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/checklist")
public class AiController {
    private final AiGenerationService aiGenerationService;

    public AiController(AiGenerationService aiGenerationService) {
        this.aiGenerationService = aiGenerationService;
    }

    @PostMapping("/questions")
    public ChecklistQuestionsResponse generateQuestions(@Valid @RequestBody ChecklistGenerationRequest request) {
        return aiGenerationService.generateQuestions(request);
    }

    @PostMapping
    public ChecklistItemsResponse generateChecklist(@Valid @RequestBody ChecklistGenerationRequest request) {
        return aiGenerationService.generateChecklist(request);
    }
}
