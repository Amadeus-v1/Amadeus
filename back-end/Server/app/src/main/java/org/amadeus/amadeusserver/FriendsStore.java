package org.amadeus.amadeusserver;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import org.json.JSONArray;
import org.json.JSONObject;

public class FriendsStore {
    private static final String FRIENDS_DB_URL = System.getProperty(
            "amadeus.friends.db.url",
            System.getProperty("amadeus.media.db.url", "jdbc:sqlite:mediaCatalog.db")
    );

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(FRIENDS_DB_URL);
    }

    public static void initialize() throws SQLException {
        String sql = """
                CREATE TABLE IF NOT EXISTS friendships (
                    userId TEXT NOT NULL,
                    friendId TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'accepted',
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (userId, friendId)
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    public static JSONObject addFriend(String userId, String friendId) {
        if (userId == null || userId.isBlank() || friendId == null || friendId.isBlank()) {
            throw new IllegalArgumentException("userId and friendId are required");
        }
        if (userId.equals(friendId)) {
            throw new IllegalArgumentException("A user cannot follow themselves");
        }

        try {
            initialize();
            
            // Check if already friends
            String checkSql = "SELECT status FROM friendships WHERE userId = ? AND friendId = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(checkSql)) {
                statement.setString(1, userId);
                statement.setString(2, friendId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (resultSet.next()) {
                        return new JSONObject().put("userId", userId).put("friendId", friendId).put("status", resultSet.getString("status"));
                    }
                }
            }

            // For now, we'll auto-accept requests (Following model)
            String sql = """
                    INSERT INTO friendships (userId, friendId, status)
                    VALUES (?, ?, 'accepted');
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setString(2, friendId);
                statement.executeUpdate();
            }

            JSONObject result = new JSONObject();
            result.put("userId", userId);
            result.put("friendId", friendId);
            result.put("status", "accepted");
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to add friend", e);
        }
    }

    public static JSONArray listFriends(String userId) {
        try {
            initialize();
            String sql = """
                    SELECT friendId, status, createdAt
                    FROM friendships
                    WHERE userId = ?
                    ORDER BY createdAt DESC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray friends = new JSONArray();
                    while (resultSet.next()) {
                        String fId = resultSet.getString("friendId");
                        JSONObject friend = new JSONObject();
                        friend.put("friendId", fId);
                        
                        // Resolve username from UserStore
                        JSONObject user = UserStore.findById(fId);
                        if (user != null) {
                            friend.put("username", user.optString("username", "Unknown User"));
                        } else {
                            // Fallback if user not found in userAccounts.db
                            friend.put("username", "User (" + (fId.length() > 8 ? fId.substring(0, 8) : fId) + ")");
                        }
                        
                        friend.put("accepted", "accepted".equals(resultSet.getString("status")));
                        friend.put("status", resultSet.getString("status"));
                        friend.put("createdAt", resultSet.getString("createdAt"));
                        friends.put(friend);
                    }
                    return friends;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list friends", e);
        }
    }

    public static boolean isFriend(String userId, String friendId) {
        try {
            initialize();
            String sql = "SELECT status FROM friendships WHERE userId = ? AND friendId = ? AND status = 'accepted'";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setString(2, friendId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    return resultSet.next();
                }
            }
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Deprecated: User wants to hide recent activity feed in favor of direct friend collection viewing.
     * Returns an empty array to satisfy "Dont show recent items in the friends page" requirement.
     */
    public static JSONArray getFriendsCollections(String userId) {
        return new JSONArray();
    }
}
