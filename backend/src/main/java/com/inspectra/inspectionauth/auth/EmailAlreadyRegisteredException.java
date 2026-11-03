package com.inspectra.inspectionauth.auth;

public class EmailAlreadyRegisteredException extends RuntimeException {
    public EmailAlreadyRegisteredException() {
        super("An account with this email address already exists.");
    }
}
