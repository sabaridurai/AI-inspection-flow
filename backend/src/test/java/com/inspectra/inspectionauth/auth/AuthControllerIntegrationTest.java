package com.inspectra.inspectionauth.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.mock.web.MockMultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inspectra.inspectionauth.inspection.InspectionEvidenceRepository;
import com.inspectra.inspectionauth.inspection.InspectionRepository;
import com.inspectra.inspectionauth.user.AppUser;
import com.inspectra.inspectionauth.user.AppUserRepository;
import com.inspectra.inspectionauth.user.MailSenderCredentialRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private MailSenderCredentialRepository mailSenderCredentials;

    @Autowired
    private InspectionRepository inspections;

    @Autowired
    private InspectionEvidenceRepository inspectionEvidence;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createTestUser() {
        inspectionEvidence.deleteAll();
        inspections.deleteAll();
        mailSenderCredentials.deleteAll();
        users.deleteAll();
        users.save(new AppUser(
                "inspector@example.com",
                passwordEncoder.encode("correct-password"),
                "Test Inspector"));
    }

    @Test
    void inspectionOutboxUpsertPersistsRecordAndPhotoIdempotentlyForAuthenticatedUser() throws Exception {
        String token = loginToken();
        String payload = """
                {
                  "id":"IN-outbox-test",
                  "asset":"Loading dock lift",
                  "assetType":"Hydraulic freight elevator",
                  "location":"Warehouse B",
                  "inspector":"Test Inspector",
                  "date":"Nov 2, 2026",
                  "status":"Completed",
                  "defects":0,
                  "criticalDefects":0,
                  "checklist":[{"id":"c1","section":"Safety","label":"Check interlock","result":"pass","comment":"","evidence":[{"id":"evidence-1","name":"interlock.png","mediaType":"image/png"}]}],
                  "checklistContext":[]
                }
                """;
        MockMultipartFile inspection = new MockMultipartFile(
                "inspection", "", MediaType.APPLICATION_JSON_VALUE, payload.getBytes());
        byte[] photoBytes = new byte[1_100_000];
        photoBytes[0] = 42;
        MockMultipartFile photo = new MockMultipartFile(
                "files", "evidence-1", MediaType.IMAGE_PNG_VALUE, photoBytes);

        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                            .multipart("/api/inspections/IN-outbox-test")
                            .file(inspection)
                            .file(photo)
                            .with(request -> {
                                request.setMethod("PUT");
                                return request;
                            })
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.clientId").value("IN-outbox-test"))
                    .andExpect(jsonPath("$.updatedAt").isNotEmpty());
        }

        org.assertj.core.api.Assertions.assertThat(inspections.count()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(inspectionEvidence.count()).isEqualTo(1);

        mockMvc.perform(get("/api/inspections").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("IN-outbox-test"))
                .andExpect(jsonPath("$[0].asset").value("Loading dock lift"));
        mockMvc.perform(get("/api/inspections/IN-outbox-test/evidence/evidence-1")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(photoBytes));
    }

    @Test
    void inspectionSyncRequiresAuthentication() throws Exception {
        MockMultipartFile inspection = new MockMultipartFile(
                "inspection", "", MediaType.APPLICATION_JSON_VALUE, "{}".getBytes());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/inspections/IN-unauthenticated")
                        .file(inspection)
                        .with(request -> {
                            request.setMethod("PUT");
                            return request;
                        }))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/inspections"))
                .andExpect(status().isUnauthorized());
    }

    private String loginToken() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"inspector@example.com","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    @Test
    void loginReturnsBearerTokenAndAllowsAuthenticatedProfileLookup() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"INSPECTOR@example.com","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Test Inspector"))
                .andReturn();

        String token = objectMapper.readTree(login.getResponse().getContentAsString())
                .get("accessToken").asText();

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("inspector@example.com"))
                .andExpect(jsonPath("$.fullName").value("Test Inspector"));
    }

    @Test
    void profileUpdatePersistsNameAndEmailAndReturnsAUsableUpdatedToken() throws Exception {
        String token = loginToken();
        MvcResult update = mockMvc.perform(put("/api/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Updated Inspector","email":"UPDATED@example.com"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Inspector"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();

        String updatedToken = objectMapper.readTree(update.getResponse().getContentAsString())
                .get("accessToken").asText();
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + updatedToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("updated@example.com"))
                .andExpect(jsonPath("$.fullName").value("Updated Inspector"));

        org.assertj.core.api.Assertions.assertThat(users.findByEmail("updated@example.com"))
                .isPresent()
                .get()
                .extracting(AppUser::getFullName)
                .isEqualTo("Updated Inspector");
        org.assertj.core.api.Assertions.assertThat(users.findByEmail("inspector@example.com")).isEmpty();
    }

    @Test
    void profileUpdateRejectsAnEmailAlreadyOwnedByAnotherUser() throws Exception {
        users.save(new AppUser(
                "another@example.com",
                passwordEncoder.encode("correct-password"),
                "Another Inspector"));

        mockMvc.perform(put("/api/auth/me")
                        .header("Authorization", "Bearer " + loginToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Updated Inspector","email":"another@example.com"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("An account with this email address already exists."));

        org.assertj.core.api.Assertions.assertThat(users.findByEmail("inspector@example.com"))
                .isPresent()
                .get()
                .extracting(AppUser::getFullName)
                .isEqualTo("Test Inspector");
    }

    @Test
    void notificationPreferencesLoadAndPersistForAuthenticatedUser() throws Exception {
        String token = loginToken();

        mockMvc.perform(get("/api/auth/me/notifications")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inspectionReminders").value(true))
                .andExpect(jsonPath("$.weeklySummary").value(false))
                .andExpect(jsonPath("$.criticalAlerts").value(true));

        mockMvc.perform(put("/api/auth/me/notifications")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inspectionReminders":false,"weeklySummary":true,"criticalAlerts":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inspectionReminders").value(false))
                .andExpect(jsonPath("$.weeklySummary").value(true))
                .andExpect(jsonPath("$.criticalAlerts").value(false));

        AppUser saved = users.findByEmail("inspector@example.com").orElseThrow();
        org.assertj.core.api.Assertions.assertThat(saved.isInspectionRemindersEnabled()).isFalse();
        org.assertj.core.api.Assertions.assertThat(saved.isWeeklySummaryEnabled()).isTrue();
        org.assertj.core.api.Assertions.assertThat(saved.isCriticalAlertsEnabled()).isFalse();
    }

    @Test
    void mailSenderCredentialsAreEncryptedSavedAndNeverReturnedByApi() throws Exception {
        String token = loginToken();
        String appPassword = "secret-app-password";

        MvcResult savedResponse = mockMvc.perform(put("/api/auth/me/notifications/mail")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new MailSenderCredentialsRequest("REPORTS@example.com", appPassword))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.senderEmail").value("reports@example.com"))
                .andExpect(jsonPath("$.configured").value(true))
                .andReturn();
        org.assertj.core.api.Assertions.assertThat(savedResponse.getResponse().getContentAsString())
                .doesNotContain(appPassword);

        AppUser user = users.findByEmail("inspector@example.com").orElseThrow();
        var storedCredentials = mailSenderCredentials.findByAppUserId(user.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(storedCredentials.getEncryptedAppPassword())
                .doesNotContain(appPassword)
                .startsWith("v1:");

        mockMvc.perform(get("/api/auth/me/notifications/mail")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.senderEmail").value("reports@example.com"))
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(result -> org.assertj.core.api.Assertions
                        .assertThat(result.getResponse().getContentAsString())
                        .doesNotContain(appPassword));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/auth/me/notifications/mail")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        org.assertj.core.api.Assertions.assertThat(mailSenderCredentials.findByAppUserId(user.getId())).isEmpty();
    }

    @Test
    void loginRejectsIncorrectPasswordWithoutRevealingWhetherEmailExists() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"inspector@example.com","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Email or password is incorrect."));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"missing@example.com","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Email or password is incorrect."));
    }

    @Test
    void loginRejectsInvalidRequestAndProtectedEndpointRejectsMissingToken() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email","password":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void signupCreatesAccountReturnsTokenAndAllowsLogin() throws Exception {
        MvcResult signup = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"New Inspector","email":"NEW@example.com","password":"strong-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.name").value("New Inspector"))
                .andReturn();

        String token = objectMapper.readTree(signup.getResponse().getContentAsString())
                .get("accessToken").asText();
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.fullName").value("New Inspector"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"new@example.com","password":"strong-password"}
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void signupRejectsDuplicateEmailAndInvalidPassword() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Another Inspector","email":"INSPECTOR@example.com","password":"strong-password"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("An account with this email address already exists."));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Another Inspector","email":"another@example.com","password":"short"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aiChecklistEndpointsRequireAuthenticationAndReportWhenAiIsDisabled() throws Exception {
        String request = """
                {"assetType":"Elevator","asset":"Freight Elevator","location":"North Tower","inspector":"Taylor","date":"2026-10-30"}
                """;
        mockMvc.perform(post("/api/ai/checklist/questions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isUnauthorized());

        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"inspector@example.com","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(login.getResponse().getContentAsString())
                .get("accessToken").asText();

        mockMvc.perform(post("/api/ai/checklist/questions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value(
                        "Groq AI is not configured. Set SPRING_AI_MODEL_CHAT=openai and GROQ_API_KEY in the backend terminal, then restart the backend."));
    }
}
