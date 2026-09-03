package org.amadeus.amadeusserver;

import java.sql.*;

import org.json.JSONObject;

/**
 * Simple key-value config store for admin-settable server configuration.
 * Stores settings like the Discogs API token in a SQLite database.
 */
public class ConfigStore {
    private static final String DB_URL = "jdbc:sqlite:config.db";

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initialize() throws SQLException {
        String sql = """
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        }
    }

    public static String get(String key) {
        try {
            initialize();
            String sql = "SELECT value FROM config WHERE key = ?";
            try (Connection conn = getConnection(); PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, key);
                try (ResultSet rs = stmt.executeQuery()) {
                    return rs.next() ? rs.getString("value") : null;
                }
            }
        } catch (SQLException e) {
            System.err.println("[ConfigStore] Error reading key '" + key + "': " + e.getMessage());
            return null;
        }
    }

    public static void set(String key, String value) {
        try {
            initialize();
            String sql = """
                    INSERT INTO config (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP;
                    """;
            try (Connection conn = getConnection(); PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, key);
                stmt.setString(2, value);
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("[ConfigStore] Error setting key '" + key + "': " + e.getMessage());
        }
    }

    public static void delete(String key) {
        try {
            initialize();
            String sql = "DELETE FROM config WHERE key = ?";
            try (Connection conn = getConnection(); PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, key);
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("[ConfigStore] Error deleting key '" + key + "': " + e.getMessage());
        }
    }

    /**
     * Get all config entries as a JSON object.
     */
    public static JSONObject getAll() {
        JSONObject config = new JSONObject();
        try {
            initialize();
            String sql = "SELECT key, value FROM config";
            try (Connection conn = getConnection();
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql)) {
                while (rs.next()) {
                    String key = rs.getString("key");
                    String value = rs.getString("value");
                    // Mask sensitive values
                    if (key.toLowerCase().contains("token") || key.toLowerCase().contains("secret")) {
                        config.put(key, value.length() > 4 ? "***" + value.substring(value.length() - 4) : "****");
                    } else {
                        config.put(key, value);
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("[ConfigStore] Error reading all config: " + e.getMessage());
        }
        return config;
    }
}
