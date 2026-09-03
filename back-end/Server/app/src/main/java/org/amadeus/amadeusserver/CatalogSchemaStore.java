package org.amadeus.amadeusserver;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

public class CatalogSchemaStore {
    private static final String DB_URL = System.getProperty("amadeus.catalog.db.url", "jdbc:sqlite:catalog.db");

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initialize() throws SQLException {
        String categoriesSql = """
                CREATE TABLE IF NOT EXISTS collection_categories (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'media',
                    description TEXT,
                    isSeeded INTEGER DEFAULT 0,
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String fieldsSql = """
                CREATE TABLE IF NOT EXISTS category_fields (
                    id TEXT PRIMARY KEY,
                    categoryId TEXT NOT NULL,
                    fieldName TEXT NOT NULL,
                    fieldType TEXT NOT NULL DEFAULT 'text',
                    required INTEGER DEFAULT 0,
                    defaultValue TEXT,
                    sortOrder INTEGER DEFAULT 0,
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String catalogSql = """
                CREATE TABLE IF NOT EXISTS catalog_items (
                    id TEXT PRIMARY KEY,
                    categoryId TEXT NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT,
                    edition TEXT,
                    format TEXT,
                    year INTEGER,
                    barcode TEXT,
                    status TEXT NOT NULL DEFAULT 'approved',
                    submittedBy TEXT,
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String variantsSql = """
                CREATE TABLE IF NOT EXISTS catalog_variants (
                    id TEXT PRIMARY KEY,
                    itemId TEXT NOT NULL,
                    variantName TEXT NOT NULL,
                    attributeJson TEXT,
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String userCollectionsSql = """
                CREATE TABLE IF NOT EXISTS user_collections (
                    id TEXT PRIMARY KEY,
                    userId TEXT NOT NULL,
                    itemId TEXT NOT NULL,
                    categoryId TEXT NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    visibility TEXT NOT NULL DEFAULT 'private',
                    notes TEXT,
                    acquiredAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String marketplaceSql = """
                CREATE TABLE IF NOT EXISTS marketplace_listings (
                    id TEXT PRIMARY KEY,
                    sellerId TEXT NOT NULL,
                    itemId TEXT NOT NULL,
                    listingType TEXT NOT NULL DEFAULT 'sale',
                    price DOUBLE DEFAULT 0,
                    currency TEXT DEFAULT 'USD',
                    status TEXT DEFAULT 'active',
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String reputationSql = """
                CREATE TABLE IF NOT EXISTS reputation_scores (
                    userId TEXT PRIMARY KEY,
                    score INTEGER DEFAULT 0,
                    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String reviewQueueSql = """
                CREATE TABLE IF NOT EXISTS review_queue (
                    id TEXT PRIMARY KEY,
                    itemId TEXT NOT NULL,
                    submittedBy TEXT NOT NULL,
                    reason TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(categoriesSql);
            statement.execute(fieldsSql);
            statement.execute(catalogSql);
            statement.execute(variantsSql);
            statement.execute(userCollectionsSql);
            statement.execute(marketplaceSql);
            statement.execute(reputationSql);
            statement.execute(reviewQueueSql);
            seedDefaults();
        }
    }

    private static void seedDefaults() {
        seedCategory("Records", "music", "Physical music records", new JSONArray()
                .put(new JSONObject().put("name", "Artist").put("type", "text"))
                .put(new JSONObject().put("name", "Release Year").put("type", "number"))
                .put(new JSONObject().put("name", "Edition").put("type", "text"))
                .put(new JSONObject().put("name", "Pressing").put("type", "text")));

        seedCategory("CDs", "music", "Compact discs", new JSONArray()
                .put(new JSONObject().put("name", "Artist").put("type", "text"))
                .put(new JSONObject().put("name", "Label").put("type", "text"))
                .put(new JSONObject().put("name", "Release Year").put("type", "number")));

        seedCategory("Vinyls", "music", "Vinyl records", new JSONArray()
                .put(new JSONObject().put("name", "Artist").put("type", "text"))
                .put(new JSONObject().put("name", "Color").put("type", "text"))
                .put(new JSONObject().put("name", "Pressing").put("type", "text"))
                .put(new JSONObject().put("name", "Edition").put("type", "text")));
    }

    private static void seedCategory(String name, String kind, String description, JSONArray fields) {
        try (Connection connection = getConnection()) {
            String categoryId = UUID.randomUUID().toString();
            String categorySql = """
                    INSERT OR IGNORE INTO collection_categories (id, name, kind, description, isSeeded)
                    VALUES (?, ?, ?, ?, 1);
                    """;
            try (PreparedStatement statement = connection.prepareStatement(categorySql)) {
                statement.setString(1, categoryId);
                statement.setString(2, name);
                statement.setString(3, kind);
                statement.setString(4, description);
                statement.executeUpdate();
            }

            String selectId = "SELECT id FROM collection_categories WHERE name = ? AND kind = ?;";
            try (PreparedStatement statement = connection.prepareStatement(selectId)) {
                statement.setString(1, name);
                statement.setString(2, kind);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (resultSet.next()) {
                        String actualId = resultSet.getString("id");
                        for (int i = 0; i < fields.length(); i++) {
                            JSONObject field = fields.getJSONObject(i);
                            String fieldSql = """
                                    INSERT OR IGNORE INTO category_fields (id, categoryId, fieldName, fieldType, required, defaultValue, sortOrder)
                                    VALUES (?, ?, ?, ?, ?, ?, ?);
                                    """;
                            try (PreparedStatement fieldStatement = connection.prepareStatement(fieldSql)) {
                                fieldStatement.setString(1, UUID.randomUUID().toString());
                                fieldStatement.setString(2, actualId);
                                fieldStatement.setString(3, field.optString("name", ""));
                                fieldStatement.setString(4, field.optString("type", "text"));
                                fieldStatement.setInt(5, field.optBoolean("required", false) ? 1 : 0);
                                fieldStatement.setString(6, field.optString("defaultValue", ""));
                                fieldStatement.setInt(7, i);
                                fieldStatement.executeUpdate();
                            }
                        }
                    }
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to seed catalog categories", e);
        }
    }

    public static JSONArray listCategories() {
        try {
            initialize();
            String sql = """
                    SELECT id, name, kind, description, isSeeded, createdAt
                    FROM collection_categories
                    ORDER BY name ASC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql);
                 ResultSet resultSet = statement.executeQuery()) {
                JSONArray categories = new JSONArray();
                while (resultSet.next()) {
                    JSONObject item = new JSONObject();
                    item.put("id", resultSet.getString("id"));
                    item.put("name", resultSet.getString("name"));
                    item.put("kind", resultSet.getString("kind"));
                    item.put("description", resultSet.getString("description"));
                    item.put("isSeeded", resultSet.getInt("isSeeded") == 1);
                    item.put("fields", listFields(resultSet.getString("id")));
                    categories.put(item);
                }
                return categories;
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list collection categories", e);
        }
    }

    public static JSONArray listFields(String categoryId) {
        try {
            String sql = """
                    SELECT id, categoryId, fieldName, fieldType, required, defaultValue, sortOrder
                    FROM category_fields
                    WHERE categoryId = ?
                    ORDER BY sortOrder ASC, fieldName ASC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, categoryId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray fields = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject field = new JSONObject();
                        field.put("id", resultSet.getString("id"));
                        field.put("name", resultSet.getString("fieldName"));
                        field.put("type", resultSet.getString("fieldType"));
                        field.put("required", resultSet.getInt("required") == 1);
                        field.put("defaultValue", resultSet.getString("defaultValue"));
                        field.put("sortOrder", resultSet.getInt("sortOrder"));
                        fields.put(field);
                    }
                    return fields;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list category fields", e);
        }
    }

    public static JSONObject createCategory(String name, String kind, JSONObject payload) {
        try {
            initialize();
            String id = UUID.randomUUID().toString();
            String sql = """
                    INSERT INTO collection_categories (id, name, kind, description, isSeeded)
                    VALUES (?, ?, ?, ?, ?);
                    """;
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, id);
                statement.setString(2, name);
                statement.setString(3, kind);
                statement.setString(4, payload.optString("description", ""));
                statement.setInt(5, 0);
                statement.executeUpdate();
            }

            JSONArray fields = payload.optJSONArray("fields");
            if (fields != null) {
                for (int i = 0; i < fields.length(); i++) {
                    JSONObject field = fields.getJSONObject(i);
                    String fieldId = UUID.randomUUID().toString();
                    String fieldSql = """
                            INSERT INTO category_fields (id, categoryId, fieldName, fieldType, required, defaultValue, sortOrder)
                            VALUES (?, ?, ?, ?, ?, ?, ?);
                            """;
                    try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(fieldSql)) {
                        statement.setString(1, fieldId);
                        statement.setString(2, id);
                        statement.setString(3, field.optString("name", ""));
                        statement.setString(4, field.optString("type", "text"));
                        statement.setInt(5, field.optBoolean("required", false) ? 1 : 0);
                        statement.setString(6, field.optString("defaultValue", ""));
                        statement.setInt(7, i);
                        statement.executeUpdate();
                    }
                }
            }

            JSONObject result = new JSONObject();
            result.put("id", id);
            result.put("name", name);
            result.put("kind", kind);
            result.put("description", payload.optString("description", ""));
            result.put("fields", fields != null ? fields : new JSONArray());
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to create collection category", e);
        }
    }

    public static JSONObject setReputation(String userId, int score) {
        try {
            initialize();
            String sql = """
                    INSERT INTO reputation_scores (userId, score)
                    VALUES (?, ?)
                    ON CONFLICT(userId) DO UPDATE SET score = excluded.score, updatedAt = CURRENT_TIMESTAMP;
                    """;
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setInt(2, score);
                statement.executeUpdate();
            }

            JSONObject result = new JSONObject();
            result.put("userId", userId);
            result.put("score", score);
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update reputation", e);
        }
    }

    public static int getReputation(String userId) {
        try {
            initialize();
            String sql = "SELECT score FROM reputation_scores WHERE userId = ?;";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    return resultSet.next() ? resultSet.getInt("score") : 0;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read reputation", e);
        }
    }

    public static JSONObject createCatalogItem(JSONObject payload) {
        try {
            initialize();
            String submittedBy = payload.optString("submittedBy", "system");
            int reputationScore = getReputation(submittedBy);
            String status = payload.optString("status", "");
            if (status.isBlank()) {
                status = reputationScore >= 50 ? "approved" : "pending";
            }

            String id = payload.optString("id", UUID.randomUUID().toString());
            String sql = """
                    INSERT INTO catalog_items (id, categoryId, title, artist, edition, format, year, barcode, status, submittedBy)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """;
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, id);
                statement.setString(2, payload.optString("categoryId", ""));
                statement.setString(3, payload.optString("title", ""));
                statement.setString(4, payload.optString("artist", ""));
                statement.setString(5, payload.optString("edition", ""));
                statement.setString(6, payload.optString("format", ""));
                statement.setInt(7, payload.optInt("year", 0));
                statement.setString(8, payload.optString("barcode", ""));
                statement.setString(9, status);
                statement.setString(10, submittedBy);
                statement.executeUpdate();
            }

            if ("pending".equalsIgnoreCase(status)) {
                queueReview(id, submittedBy, payload.optString("reviewReason", "Low reputation submission"));
            }

            JSONObject result = new JSONObject(payload.toMap());
            result.put("id", id);
            result.put("status", status);
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to create catalog item", e);
        }
    }

    public static JSONObject addUserCollection(JSONObject payload) {
        try {
            initialize();
            String id = payload.optString("id", UUID.randomUUID().toString());
            String sql = """
                    INSERT INTO user_collections (id, userId, itemId, categoryId, quantity, visibility, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                    """;
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, id);
                statement.setString(2, payload.optString("userId", ""));
                statement.setString(3, payload.optString("itemId", ""));
                statement.setString(4, payload.optString("categoryId", ""));
                statement.setInt(5, payload.optInt("quantity", 1));
                statement.setString(6, payload.optString("visibility", "private"));
                statement.setString(7, payload.optString("notes", ""));
                statement.executeUpdate();
            }

            JSONObject result = new JSONObject(payload.toMap());
            result.put("id", id);
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to add user collection entry", e);
        }
    }

    public static JSONObject updateCollectionVisibility(String entryId, String visibility) {
        try {
            initialize();
            String sql = "UPDATE user_collections SET visibility = ? WHERE id = ?;";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, visibility);
                statement.setString(2, entryId);
                statement.executeUpdate();
            }

            JSONObject result = new JSONObject();
            result.put("id", entryId);
            result.put("visibility", visibility);
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update collection visibility", e);
        }
    }

    public static JSONArray listUserCollections(String userId) {
        try {
            initialize();
            String sql = """
                    SELECT id, userId, itemId, categoryId, quantity, visibility, notes, acquiredAt
                    FROM user_collections
                    WHERE userId = ?
                    ORDER BY acquiredAt DESC;
                    """;
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("userId", resultSet.getString("userId"));
                        item.put("itemId", resultSet.getString("itemId"));
                        item.put("categoryId", resultSet.getString("categoryId"));
                        item.put("quantity", resultSet.getInt("quantity"));
                        item.put("visibility", resultSet.getString("visibility"));
                        item.put("notes", resultSet.getString("notes"));
                        item.put("acquiredAt", resultSet.getString("acquiredAt"));
                        items.put(item);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list user collections", e);
        }
    }

    private static void queueReview(String itemId, String submittedBy, String reason) {
        try {
            String sql = """
                    INSERT INTO review_queue (id, itemId, submittedBy, reason, status)
                    VALUES (?, ?, ?, ?, 'pending');
                    """;
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, UUID.randomUUID().toString());
                statement.setString(2, itemId);
                statement.setString(3, submittedBy);
                statement.setString(4, reason);
                statement.executeUpdate();
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to queue review", e);
        }
    }
}
