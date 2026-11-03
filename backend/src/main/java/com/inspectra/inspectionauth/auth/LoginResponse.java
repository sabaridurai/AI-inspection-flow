package com.inspectra.inspectionauth.auth;

import java.time.Instant;

public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, String name) {
}
