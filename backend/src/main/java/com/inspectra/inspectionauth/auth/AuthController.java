package com.inspectra.inspectionauth.auth;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/signup")
    public LoginResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    @GetMapping("/me")
    public CurrentUserResponse currentUser(@AuthenticationPrincipal Jwt jwt) {
        return new CurrentUserResponse(jwt.getSubject(), jwt.getClaimAsString("name"));
    }

    @PutMapping("/me")
    public LoginResponse updateProfile(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile(jwt.getSubject(), request);
    }

    @GetMapping("/me/notifications")
    public NotificationPreferencesResponse notificationPreferences(@AuthenticationPrincipal Jwt jwt) {
        return authService.getNotificationPreferences(jwt.getSubject());
    }

    @PutMapping("/me/notifications")
    public NotificationPreferencesResponse updateNotificationPreferences(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody NotificationPreferencesRequest request) {
        return authService.updateNotificationPreferences(jwt.getSubject(), request);
    }

    @GetMapping("/me/notifications/mail")
    public MailSenderCredentialsResponse mailSenderCredentials(@AuthenticationPrincipal Jwt jwt) {
        return authService.getMailSenderCredentials(jwt.getSubject());
    }

    @PutMapping("/me/notifications/mail")
    public MailSenderCredentialsResponse saveMailSenderCredentials(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody MailSenderCredentialsRequest request) {
        return authService.saveMailSenderCredentials(jwt.getSubject(), request);
    }

    @DeleteMapping("/me/notifications/mail")
    public void deleteMailSenderCredentials(@AuthenticationPrincipal Jwt jwt) {
        authService.deleteMailSenderCredentials(jwt.getSubject());
    }
}
