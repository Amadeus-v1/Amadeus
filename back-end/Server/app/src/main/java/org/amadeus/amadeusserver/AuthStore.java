package org.amadeus.amadeusserver;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;

import org.json.JSONObject;

public class AuthStore {
    private static final String DB_URL = "jdbc:sqlite:auth.db";
    private static final SecureRandom RANDOM = new SecureRandom();

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initialize() throws SQLException {
        String authSql = """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id TEXT PRIMARY KEY,
                    userId TEXT NOT NULL,
                    accessToken TEXT NOT NULL,
                    refreshToken TEXT NOT NULL,
                    issuedAt TEXT NOT NULL,
                    expiresAt TEXT NOT NULL,
                    active INTEGER DEFAULT 1
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(authSql);
        }
    }

    public static JSONObject createSession(String userId) {
        try {
            initialize();
            String accessToken = randomToken("acc");
            String refreshToken = randomToken("ref");
            long now = Instant.now().getEpochSecond();
            long accessExpiry = now + 900;
            long refreshExpiry = now + 60 * 60 * 24 * 30;

            JSONObject session = new JSONObject();
            session.put("id", java.util.UUID.randomUUID().toString());
            session.put("userId", userId);
            session.put("accessToken", accessToken);
            session.put("refreshToken", refreshToken);
            session.put("issuedAt", Instant.ofEpochSecond(now).toString());
            session.put("expiresAt", Instant.ofEpochSecond(accessExpiry).toString());
            session.put("refreshExpiresAt", Instant.ofEpochSecond(refreshExpiry).toString());

            String sql = """
                    INSERT INTO auth_sessions (id, userId, accessToken, refreshToken, issuedAt, expiresAt, active)
                    VALUES (?, ?, ?, ?, ?, ?, 1);
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, session.getString("id"));
                statement.setString(2, userId);
                statement.setString(3, accessToken);
                statement.setString(4, refreshToken);
                statement.setString(5, session.getString("issuedAt"));
                statement.setString(6, session.getString("expiresAt"));
                statement.executeUpdate();
            }

            return session;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to create auth session", e);
        }
    }

    public static JSONObject refreshSession(String refreshToken) {
        try {
            initialize();
            String sql = "SELECT id, userId, accessToken, refreshToken, issuedAt, expiresAt FROM auth_sessions WHERE refreshToken = ? AND active = 1";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, refreshToken);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        return null;
                    }

                    String newAccessToken = randomToken("acc");
                    long now = Instant.now().getEpochSecond();
                    String expiresAt = Instant.ofEpochSecond(now + 900).toString();

                    String updateSql = "UPDATE auth_sessions SET accessToken = ?, issuedAt = ?, expiresAt = ? WHERE id = ?";
                    try (PreparedStatement update = connection.prepareStatement(updateSql)) {
                        update.setString(1, newAccessToken);
                        update.setString(2, Instant.ofEpochSecond(now).toString());
                        update.setString(3, expiresAt);
                        update.setString(4, resultSet.getString("id"));
                        update.executeUpdate();
                    }

                    JSONObject session = new JSONObject();
                    session.put("id", resultSet.getString("id"));
                    session.put("userId", resultSet.getString("userId"));
                    session.put("accessToken", newAccessToken);
                    session.put("refreshToken", refreshToken);
                    session.put("expiresAt", expiresAt);
                    return session;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to refresh auth session", e);
        }
    }

    private static String randomToken(String prefix) {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return prefix + java.util.HexFormat.of().formatHex(bytes);
    }
}
