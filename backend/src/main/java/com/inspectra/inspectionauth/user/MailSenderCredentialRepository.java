package com.inspectra.inspectionauth.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MailSenderCredentialRepository extends JpaRepository<MailSenderCredential, Long> {
    Optional<MailSenderCredential> findByAppUserId(Long appUserId);
}
