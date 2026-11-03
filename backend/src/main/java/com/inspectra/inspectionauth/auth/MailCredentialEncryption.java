package com.inspectra.inspectionauth.auth;

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MailCredentialEncryption {
    private static final int NONCE_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private final String encodedKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public MailCredentialEncryption(
            @Value("${app.mail-credentials.encryption-key:}") String encodedKey) {
        this.encodedKey = encodedKey;
    }

    public String encrypt(String plaintext) {
        byte[] nonce = new byte[NONCE_LENGTH];
        secureRandom.nextBytes(nonce);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(
                    ByteBuffer.allocate(nonce.length + ciphertext.length).put(nonce).put(ciphertext).array());
        } catch (GeneralSecurityException exception) {
            throw new MailCredentialConfigurationException("Could not encrypt mail sender credentials.", exception);
        }
    }

    public String decrypt(String encrypted) {
        if (!encrypted.startsWith("v1:")) {
            throw new IllegalStateException("Stored mail sender credentials use an unsupported format.");
        }
        byte[] payload;
        try {
            payload = Base64.getDecoder().decode(encrypted.substring(3));
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Stored mail sender credentials are invalid.", exception);
        }
        if (payload.length <= NONCE_LENGTH) {
            throw new IllegalStateException("Stored mail sender credentials are incomplete.");
        }

        ByteBuffer buffer = ByteBuffer.wrap(payload);
        byte[] nonce = new byte[NONCE_LENGTH];
        buffer.get(nonce);
        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
            return new String(cipher.doFinal(ciphertext), java.nio.charset.StandardCharsets.UTF_8);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException(
                    "Could not decrypt mail sender credentials. Check MAIL_CREDENTIALS_ENCRYPTION_KEY.", exception);
        }
    }

    private SecretKeySpec key() {
        if (encodedKey.isBlank()) {
            throw new MailCredentialConfigurationException(
                    "MAIL_CREDENTIALS_ENCRYPTION_KEY must be configured before saving mail credentials.");
        }
        final byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException exception) {
            throw new MailCredentialConfigurationException("MAIL_CREDENTIALS_ENCRYPTION_KEY must be Base64 encoded.", exception);
        }
        if (keyBytes.length != 32) {
            throw new MailCredentialConfigurationException(
                    "MAIL_CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes.");
        }
        return new SecretKeySpec(keyBytes, "AES");
    }
}
