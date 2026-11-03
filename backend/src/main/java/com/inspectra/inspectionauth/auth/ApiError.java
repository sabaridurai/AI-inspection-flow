package com.inspectra.inspectionauth.auth;

import java.time.Instant;

public record ApiError(String error, Instant timestamp) {
}
