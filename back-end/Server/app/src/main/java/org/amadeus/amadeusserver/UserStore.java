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

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    private static void initialize() throws SQLException {
        String sql = """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    passwordHash TEXT NOT NULL,
                    passwordSalt TEXT NOT NULL,
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(sql);
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
            String sql = "SELECT id, username, email, passwordHash, passwordSalt FROM users WHERE id = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, id);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        return null;
                    }

                    JSONObject user = new JSONObject();
                    user.put("id", resultSet.getString("id"));
                    user.put("username", resultSet.getString("username"));
                    user.put("email", resultSet.getString("email"));
                    user.put("passwordHash", resultSet.getString("passwordHash"));
                    user.put("passwordSalt", resultSet.getString("passwordSalt"));
                    return user;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query user by id", e);
        }
    }

    public static JSONObject findByUsernameOrEmail(String username, String email) {
        try {
            initialize();
            String sql = "SELECT id, username, email, passwordHash, passwordSalt FROM users WHERE username = ? OR email = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, username);
                statement.setString(2, email);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        return null;
                    }

                    JSONObject user = new JSONObject();
                    user.put("id", resultSet.getString("id"));
                    user.put("username", resultSet.getString("username"));
                    user.put("email", resultSet.getString("email"));
                    user.put("passwordHash", resultSet.getString("passwordHash"));
                    user.put("passwordSalt", resultSet.getString("passwordSalt"));
                    return user;
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
}
