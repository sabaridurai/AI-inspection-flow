package com.inspectra.inspectionauth.auth;

public class MailCredentialConfigurationException extends RuntimeException {
    public MailCredentialConfigurationException(String message) {
        super(message);
    }

    public MailCredentialConfigurationException(String message, Throwable cause) {
        super(message, cause);
    }
}
