package org.amadeus.amadeusserver;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import org.json.JSONObject;

public class UserStore {
    private static final String DB_URL = "jdbc:sqlite:userAccounts.db";
    private static boolean initialized = false;

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    private static synchronized void initialize() throws SQLException {
        if (initialized) return;
        
        String sql = """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    passwordHash TEXT NOT NULL,
                    passwordSalt TEXT NOT NULL,
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    displayName TEXT,
                    bio TEXT,
                    avatarUrl TEXT,
                    favoriteGenres TEXT,
                    profileTheme TEXT DEFAULT 'default'
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(sql);
            // Add new columns if they don't exist (for existing databases)
            safeAddColumn(statement, "displayName", "TEXT", "''");
            safeAddColumn(statement, "bio", "TEXT", "''");
            safeAddColumn(statement, "avatarUrl", "TEXT", "''");
            safeAddColumn(statement, "favoriteGenres", "TEXT", "''");
            safeAddColumn(statement, "profileTheme", "TEXT", "'default'");
        }
        initialized = true;
    }

    private static void safeAddColumn(Statement stmt, String column, String type, String defaultValue) {
        try {
            stmt.execute("ALTER TABLE users ADD COLUMN " + column + " " + type + " DEFAULT " + defaultValue);
        } catch (SQLException e) {
            // Column already exists — ignore
        }
    }

    public static boolean usernameExists(String username) {
        try {
            initialize();
            String sql = "SELECT 1 FROM users WHERE username = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, username);
                try (ResultSet resultSet = statement.executeQuery()) {
                    return resultSet.next();
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to check username", e);
        }
    }

    public static JSONObject findById(String id) {
        try {
            initialize();
            String sql = "SELECT id, username, email, passwordHash, passwordSalt, displayName, bio, avatarUrl, favoriteGenres, profileTheme, createdAt FROM users WHERE id = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, id);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        return null;
                    }
                    return userFromResultSet(resultSet);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query user by id", e);
        }
    }

    public static JSONObject findByUsername(String username) {
        try {
            initialize();
            String sql = "SELECT id, username, email, passwordHash, passwordSalt, displayName, bio, avatarUrl, favoriteGenres, profileTheme, createdAt FROM users WHERE username = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, username);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        return null;
                    }
                    return userFromResultSet(resultSet);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query user by username", e);
        }
    }

    public static JSONObject findByUsernameOrEmail(String username, String email) {
        try {
            initialize();
            String sql = "SELECT id, username, email, passwordHash, passwordSalt, displayName, bio, avatarUrl, favoriteGenres, profileTheme, createdAt FROM users WHERE username = ? OR email = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, username);
                statement.setString(2, email);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        return null;
                    }
                    return userFromResultSet(resultSet);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query user", e);
        }
    }

    public static void createUser(JSONObject user) {
        try {
            initialize();
            String sql = "INSERT INTO users (id, username, email, passwordHash, passwordSalt) VALUES (?, ?, ?, ?, ?)";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, user.getString("id"));
                statement.setString(2, user.getString("username"));
                statement.setString(3, user.getString("email"));
                statement.setString(4, user.getString("passwordHash"));
                statement.setString(5, user.getString("passwordSalt"));
                statement.executeUpdate();
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to create user", e);
        }
    }

    /**
     * Update profile fields for a user.
     */
    public static void updateProfile(String userId, JSONObject profileData) {
        try {
            initialize();
            String sql = """
                UPDATE users SET
                    displayName = ?,
                    bio = ?,
                    avatarUrl = ?,
                    favoriteGenres = ?,
                    profileTheme = ?
                WHERE id = ?;
            """;
            try (Connection connection = getConnection(); PreparedStatement stmt = connection.prepareStatement(sql)) {
                stmt.setString(1, profileData.optString("displayName", ""));
                stmt.setString(2, profileData.optString("bio", ""));
                stmt.setString(3, profileData.optString("avatarUrl", ""));
                stmt.setString(4, profileData.optString("favoriteGenres", ""));
                stmt.setString(5, profileData.optString("profileTheme", "default"));
                stmt.setString(6, userId);
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update profile", e);
        }
    }

    /**
     * Get public profile data (no password/sensitive fields).
     */
    public static JSONObject getPublicProfile(String userId) {
        JSONObject user = findById(userId);
        if (user == null) return null;
        
        JSONObject pub = new JSONObject();
        pub.put("id", user.getString("id"));
        pub.put("username", user.getString("username"));
        pub.put("displayName", user.optString("displayName", ""));
        pub.put("bio", user.optString("bio", ""));
        pub.put("avatarUrl", user.optString("avatarUrl", ""));
        pub.put("favoriteGenres", user.optString("favoriteGenres", ""));
        pub.put("profileTheme", user.optString("profileTheme", "default"));
        pub.put("createdAt", user.optString("createdAt", ""));
        return pub;
    }

    /**
     * Get public profile data by username.
     */
    public static JSONObject getPublicProfileByUsername(String username) {
        JSONObject user = findByUsername(username);
        if (user == null) return null;
        return getPublicProfile(user.getString("id"));
    }

    private static JSONObject userFromResultSet(ResultSet rs) throws SQLException {
        JSONObject user = new JSONObject();
        user.put("id", rs.getString("id"));
        user.put("username", rs.getString("username"));
        user.put("email", rs.getString("email"));
        user.put("passwordHash", rs.getString("passwordHash"));
        user.put("passwordSalt", rs.getString("passwordSalt"));
        // Profile fields (may be null for old records)
        String displayName = rs.getString("displayName");
        user.put("displayName", displayName != null ? displayName : "");
        String bio = rs.getString("bio");
        user.put("bio", bio != null ? bio : "");
        String avatarUrl = rs.getString("avatarUrl");
        user.put("avatarUrl", avatarUrl != null ? avatarUrl : "");
        String favoriteGenres = rs.getString("favoriteGenres");
        user.put("favoriteGenres", favoriteGenres != null ? favoriteGenres : "");
        String profileTheme = rs.getString("profileTheme");
        user.put("profileTheme", profileTheme != null ? profileTheme : "default");
        String createdAt = rs.getString("createdAt");
        user.put("createdAt", createdAt != null ? createdAt : "");
        return user;
    }
}
