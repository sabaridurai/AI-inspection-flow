package com.inspectra.inspectionauth.auth;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiError> invalidCredentials(InvalidCredentialsException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError(exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ResponseEntity<ApiError> emailAlreadyRegistered(EmailAlreadyRegisteredException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(InvalidSignupRequestException.class)
    public ResponseEntity<ApiError> invalidSignupRequest(InvalidSignupRequestException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiError(exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> invalidRequest() {
        return ResponseEntity.badRequest()
                .body(new ApiError("Request validation failed. Please check the required fields and their formats.", Instant.now()));
    }

    @ExceptionHandler(MailCredentialConfigurationException.class)
    public ResponseEntity<ApiError> mailCredentialConfiguration(
            MailCredentialConfigurationException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError(
                        "Mail credential encryption is not configured. Check app.mail-credentials.encryption-key in backend/application-local.properties, then restart Spring.",
                        Instant.now()));
    }
}
