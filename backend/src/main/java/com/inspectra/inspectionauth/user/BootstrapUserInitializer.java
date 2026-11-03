package com.inspectra.inspectionauth.user;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BootstrapUserInitializer implements CommandLineRunner {
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public BootstrapUserInitializer(
            AppUserRepository users,
            PasswordEncoder passwordEncoder,
            @Value("${app.auth.bootstrap-email:}") String email,
            @Value("${app.auth.bootstrap-password:}") String password) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(String... args) {
        if (email.isBlank() && password.isBlank()) {
            return;
        }
        if (email.isBlank() || password.isBlank()) {
            throw new IllegalStateException("Set both AUTH_BOOTSTRAP_EMAIL and AUTH_BOOTSTRAP_PASSWORD, or neither.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("AUTH_BOOTSTRAP_PASSWORD must be at most 72 UTF-8 bytes.");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (!users.existsByEmail(normalizedEmail)) {
            users.save(new AppUser(normalizedEmail, passwordEncoder.encode(password), "Inspection Demo User"));
        }
    }
}
