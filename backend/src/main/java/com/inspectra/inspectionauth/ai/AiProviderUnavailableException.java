package com.inspectra.inspectionauth.ai;

public class AiProviderUnavailableException extends RuntimeException {
    public AiProviderUnavailableException() {
        super("Groq AI is not configured. Set SPRING_AI_MODEL_CHAT=openai and GROQ_API_KEY in the backend terminal, then restart the backend.");
    }
}
