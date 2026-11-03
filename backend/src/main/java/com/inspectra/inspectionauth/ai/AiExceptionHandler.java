package com.inspectra.inspectionauth.ai;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.ai.openai.api.common.OpenAiApiClientErrorException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.inspectra.inspectionauth.auth.ApiError;

@RestControllerAdvice
public class AiExceptionHandler {
    private static final Logger logger = LoggerFactory.getLogger(AiExceptionHandler.class);

    @ExceptionHandler(AiProviderUnavailableException.class)
    public ResponseEntity<ApiError> providerUnavailable(AiProviderUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError(exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(AiGenerationException.class)
    public ResponseEntity<ApiError> invalidProviderResponse(AiGenerationException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError(exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(OpenAiApiClientErrorException.class)
    public ResponseEntity<ApiError> groqRequestRejected(OpenAiApiClientErrorException exception) {
        logger.error("Groq rejected an AI checklist request: {}", exception.getMessage(), exception);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError(
                        "Groq rejected checklist generation. Check the backend log for the provider response and verify the API key, model, and account limits.",
                        Instant.now()));
    }
}
