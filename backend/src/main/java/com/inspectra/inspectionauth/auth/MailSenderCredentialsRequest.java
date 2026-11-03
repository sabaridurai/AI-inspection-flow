package com.inspectra.inspectionauth.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MailSenderCredentialsRequest(
        @NotBlank @Email @Size(max = 320) String senderEmail,
        @NotBlank @Size(max = 512) String appPassword) {
}
