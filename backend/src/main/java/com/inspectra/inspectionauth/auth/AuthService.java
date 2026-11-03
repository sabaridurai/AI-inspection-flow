package com.inspectra.inspectionauth.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.inspectra.inspectionauth.user.AppUser;
import com.inspectra.inspectionauth.user.AppUserRepository;
import com.inspectra.inspectionauth.user.MailSenderCredential;
import com.inspectra.inspectionauth.user.MailSenderCredentialRepository;

@Service
public class AuthService {
    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;
    private final AppUserRepository users;
    private final MailSenderCredentialRepository mailCredentials;
    private final MailCredentialEncryption mailCredentialEncryption;
    private final PasswordEncoder passwordEncoder;
    private final String issuer;
    private final long accessTokenMinutes;

    public AuthService(
            AuthenticationManager authenticationManager,
            JwtEncoder jwtEncoder,
            AppUserRepository users,
            MailSenderCredentialRepository mailCredentials,
            MailCredentialEncryption mailCredentialEncryption,
            PasswordEncoder passwordEncoder,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.access-token-minutes}") long accessTokenMinutes) {
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
        this.users = users;
        this.mailCredentials = mailCredentials;
        this.mailCredentialEncryption = mailCredentialEncryption;
        this.passwordEncoder = passwordEncoder;
        this.issuer = issuer;
        this.accessTokenMinutes = accessTokenMinutes;
    }

    public LoginResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, request.password()));
        } catch (AuthenticationException exception) {
            throw new InvalidCredentialsException();
        }

        if (!(authentication.getPrincipal() instanceof AppUser user)) {
            throw new AuthenticationServiceException("Authentication returned an unexpected principal.");
        }

        return createLoginResponse(user);
    }

    @Transactional
    public LoginResponse signup(SignupRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException();
        }
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new InvalidSignupRequestException("Password must be at most 72 UTF-8 bytes.");
        }

        AppUser user = new AppUser(
                email,
                passwordEncoder.encode(request.password()),
                request.fullName().trim());
        try {
            user = users.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new EmailAlreadyRegisteredException();
        }
        return createLoginResponse(user);
    }

    @Transactional
    public LoginResponse updateProfile(String currentEmail, UpdateProfileRequest request) {
        AppUser user = users.findByEmail(currentEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile was not found."));
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (!email.equals(user.getEmail()) && users.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException();
        }

        user.updateProfile(email, request.fullName().trim());
        try {
            user = users.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new EmailAlreadyRegisteredException();
        }
        return createLoginResponse(user);
    }

    @Transactional(readOnly = true)
    public NotificationPreferencesResponse getNotificationPreferences(String email) {
        AppUser user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile was not found."));
        return notificationPreferencesResponse(user);
    }

    @Transactional
    public NotificationPreferencesResponse updateNotificationPreferences(
            String email,
            NotificationPreferencesRequest request) {
        AppUser user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile was not found."));
        user.updateNotificationPreferences(
                request.inspectionReminders(),
                request.weeklySummary(),
                request.criticalAlerts());
        users.save(user);
        return notificationPreferencesResponse(user);
    }

    private NotificationPreferencesResponse notificationPreferencesResponse(AppUser user) {
        return new NotificationPreferencesResponse(
                user.isInspectionRemindersEnabled(),
                user.isWeeklySummaryEnabled(),
                user.isCriticalAlertsEnabled());
    }

    @Transactional(readOnly = true)
    public MailSenderCredentialsResponse getMailSenderCredentials(String email) {
        AppUser user = findUser(email);
        return mailCredentials.findByAppUserId(user.getId())
                .map(credentials -> new MailSenderCredentialsResponse(credentials.getSenderEmail(), true))
                .orElseGet(() -> new MailSenderCredentialsResponse("", false));
    }

    @Transactional
    public MailSenderCredentialsResponse saveMailSenderCredentials(
            String email,
            MailSenderCredentialsRequest request) {
        AppUser user = findUser(email);
        String senderEmail = request.senderEmail().trim().toLowerCase(Locale.ROOT);
        String encryptedPassword = mailCredentialEncryption.encrypt(request.appPassword());
        MailSenderCredential credentials = mailCredentials.findByAppUserId(user.getId())
                .orElseGet(() -> new MailSenderCredential(user.getId(), senderEmail, encryptedPassword));
        credentials.update(senderEmail, encryptedPassword);
        mailCredentials.save(credentials);
        return new MailSenderCredentialsResponse(senderEmail, true);
    }

    @Transactional
    public void deleteMailSenderCredentials(String email) {
        AppUser user = findUser(email);
        mailCredentials.findByAppUserId(user.getId()).ifPresent(mailCredentials::delete);
    }

    private AppUser findUser(String email) {
        return users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile was not found."));
    }

    private LoginResponse createLoginResponse(AppUser user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(accessTokenMinutes, ChronoUnit.MINUTES);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(user.getEmail())
                .claim("name", user.getFullName())
                .claim("roles", user.getAuthorities().stream()
                        .map(authority -> authority.getAuthority())
                        .toList())
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        return new LoginResponse(token, "Bearer", expiresAt, user.getFullName());
    }
}
