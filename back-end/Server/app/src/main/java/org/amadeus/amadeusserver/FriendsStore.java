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
            String sql = """
                    INSERT INTO friendships (userId, friendId, status)
                    VALUES (?, ?, 'accepted')
                    ON CONFLICT(userId, friendId) DO UPDATE SET status = excluded.status;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setString(2, friendId);
                statement.executeUpdate();
            }

            JSONObject result = new JSONObject();
            result.put("userId", userId);
            result.put("friendId", friendId);
            result.put("accepted", true);
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
                        JSONObject friend = new JSONObject();
                        friend.put("friendId", resultSet.getString("friendId"));
                        friend.put("accepted", "accepted".equals(resultSet.getString("status")));
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

    public static JSONArray getFriendsCollections(String userId) {
        try {
            initialize();
            String sql = """
                    SELECT f.friendId,
                           m.id,
                           m.title,
                           m.artist,
                           m.mediaType,
                           m.format,
                           m.year,
                           m.coverUrl,
                           c.conditionLabel,
                           c.ownIt,
                           c.notes,
                           c.addedAt
                    FROM friendships f
                    JOIN collection_items c ON c.userId = f.friendId
                    JOIN media_items m ON m.id = c.itemId
                    WHERE f.userId = ? AND f.status = 'accepted'
                    ORDER BY c.addedAt DESC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("friendId", resultSet.getString("friendId"));
                        item.put("id", resultSet.getString("id"));
                        item.put("title", resultSet.getString("title"));
                        item.put("artist", resultSet.getString("artist"));
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("coverUrl", resultSet.getString("coverUrl"));
                        item.put("conditionLabel", resultSet.getString("conditionLabel"));
                        item.put("ownIt", resultSet.getInt("ownIt") == 1);
                        item.put("notes", resultSet.getString("notes"));
                        item.put("addedAt", resultSet.getString("addedAt"));
                        items.put(item);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to fetch friends' collections", e);
        }
    }
}
