package com.inspectra.inspectionauth.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.ai.chat.model.ChatModel;

import com.fasterxml.jackson.databind.ObjectMapper;

class AiGenerationServiceTest {
    private final AiGenerationService service = new AiGenerationService(
            mock(ObjectProvider.class),
            new ObjectMapper(),
            "test-key");

    @Test
    void normalizesOptionalOptionsAndInvalidQuestionKeys() {
        ChecklistQuestionsResponse response = new ChecklistQuestionsResponse(List.of(
                new ChecklistQuestion("asset_type", "What type of asset is this?", null),
                new ChecklistQuestion("assetName", "What is the asset model?", List.of()),
                new ChecklistQuestion("powerSource", "What powers the asset?", List.of(" Electric ", "Fuel")),
                new ChecklistQuestion("operatingUse", "How is the asset used?", List.of())));

        ChecklistQuestionsResponse normalized = service.normalizeQuestions(response);

        assertEquals("whatTypeOfAssetIsThis", normalized.questions().get(0).key());
        assertEquals(List.of(), normalized.questions().get(0).options());
        assertEquals(List.of("Electric", "Fuel"), normalized.questions().get(2).options());
    }

    @Test
    void rejectsQuestionsWithoutAUsableLabel() {
        ChecklistQuestionsResponse response = new ChecklistQuestionsResponse(List.of(
                new ChecklistQuestion("assetType", " ", List.of()),
                new ChecklistQuestion("assetName", "What is the model?", List.of()),
                new ChecklistQuestion("powerSource", "What powers it?", List.of()),
                new ChecklistQuestion("operatingUse", "How is it used?", List.of())));

        assertThrows(AiGenerationException.class, () -> service.normalizeQuestions(response));
    }
}
