package com.inspectra.inspectionauth.auth;

public class InvalidSignupRequestException extends RuntimeException {
    public InvalidSignupRequestException(String message) {
        super(message);
    }
}
