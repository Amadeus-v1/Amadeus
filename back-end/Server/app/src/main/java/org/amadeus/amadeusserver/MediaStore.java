package org.amadeus.amadeusserver;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import javax.imageio.ImageIO;

import org.json.JSONArray;
import org.json.JSONObject;

public class MediaStore {
    private static final String DB_URL = "jdbc:sqlite:mediaCatalog.db";
    private static boolean initialized = false;

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static synchronized void initialize() throws SQLException {
        if (initialized) return;
        
        String mediaSql = """
                CREATE TABLE IF NOT EXISTS media_items (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    artist TEXT,
                    mediaType TEXT NOT NULL,
                    format TEXT,
                    year INTEGER,
                    barcode TEXT,
                    coverUrl TEXT,
                    coverPath TEXT,
                    coverHash TEXT,
                    ocrHint TEXT,
                    notes TEXT,
                    source TEXT DEFAULT 'manual',
                    isTestPress INTEGER DEFAULT 0
                );
                """;

        String collectionSql = """
                CREATE TABLE IF NOT EXISTS collection_items (
                    userId TEXT NOT NULL,
                    itemId TEXT NOT NULL,
                    conditionLabel TEXT,
                    ownIt INTEGER DEFAULT 1,
                    notes TEXT,
                    quantity INTEGER DEFAULT 1,
                    estimatedValue REAL DEFAULT 0.0,
                    visibility TEXT DEFAULT 'public',
                    addedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (userId, itemId)
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(mediaSql);
            statement.execute(collectionSql);
            statement.execute("CREATE INDEX IF NOT EXISTS idx_media_items_barcode ON media_items(barcode);");
            
            // Migration: Add columns if they don't exist
            addColumnIfNotExists(connection, "collection_items", "quantity", "INTEGER", "1");
            addColumnIfNotExists(connection, "collection_items", "estimatedValue", "REAL", "0.0");
            addColumnIfNotExists(connection, "collection_items", "visibility", "TEXT", "'public'");
        }
        initialized = true;
    }

    private static void addColumnIfNotExists(Connection conn, String table, String column, String type, String defaultValue) {
        try {
            Set<String> columns = new HashSet<>();
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("PRAGMA table_info(" + table + ")")) {
                while (rs.next()) {
                    columns.add(rs.getString("name").toLowerCase());
                }
            }
            
            if (!columns.contains(column.toLowerCase())) {
                try (Statement stmt = conn.createStatement()) {
                    String sql = "ALTER TABLE " + table + " ADD COLUMN " + column + " " + type + " DEFAULT " + defaultValue + ";";
                    stmt.execute(sql);
                    System.out.println("[Migration] Successfully added column " + column + " to " + table);
                }
            }
        } catch (SQLException e) {
            System.err.println("[Migration] Error checking/adding column " + column + ": " + e.getMessage());
        }
    }

    public static JSONArray search(String query) {
        try {
            initialize();
            String sql = """
                    SELECT id, title, artist, mediaType, format, year, barcode, coverUrl, notes, source, isTestPress
                    FROM media_items
                    WHERE lower(title) LIKE ? OR lower(artist) LIKE ? OR lower(barcode) LIKE ?
                    ORDER BY title ASC
                    LIMIT 25;
                    """;

            String term = "%" + query.toLowerCase() + "%";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, term);
                statement.setString(2, term);
                statement.setString(3, term);

                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("title", resultSet.getString("title"));
                        item.put("artist", resultSet.getString("artist"));
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("barcode", resultSet.getString("barcode"));
                        item.put("coverUrl", resultSet.getString("coverUrl"));
                        item.put("notes", resultSet.getString("notes"));
                        item.put("source", resultSet.getString("source"));
                        item.put("isTestPress", resultSet.getInt("isTestPress") == 1);
                        items.put(item);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to search media catalog", e);
        }
    }

    public static JSONObject lookupByBarcode(String barcode) {
        try {
            initialize();
            String sql = """
                    SELECT id, title, artist, mediaType, format, year, barcode, coverUrl, notes, source, isTestPress
                    FROM media_items
                    WHERE barcode = ?
                    LIMIT 1;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, barcode);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("title", resultSet.getString("title"));
                        item.put("artist", resultSet.getString("artist"));
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("barcode", resultSet.getString("barcode"));
                        item.put("coverUrl", resultSet.getString("coverUrl"));
                        item.put("notes", resultSet.getString("notes"));
                        item.put("source", resultSet.getString("source"));
                        item.put("isTestPress", resultSet.getInt("isTestPress") == 1);
                        item.put("success", true);
                        item.put("source", "local");
                        return item;
                    }
                }
            }
            return null;
        } catch (SQLException e) {
            return null;
        }
    }

    public static JSONObject addItem(JSONObject item) {
        try {
            initialize();
            String sql = """
                    INSERT INTO media_items (id, title, artist, mediaType, format, year, barcode, coverUrl, coverPath, coverHash, ocrHint, notes, source, isTestPress)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        title = excluded.title,
                        artist = excluded.artist,
                        mediaType = excluded.mediaType,
                        format = excluded.format,
                        year = excluded.year,
                        barcode = excluded.barcode,
                        coverUrl = excluded.coverUrl,
                        notes = excluded.notes;
                    """;

            String id = item.optString("id", item.optString("itemId", java.util.UUID.randomUUID().toString()));
            item.put("id", id);

            String coverPath = null;
            String coverHash = null;
            String ocrHint = item.optString("ocrHint", "");
            String coverUrl = item.optString("coverUrl", "");

            if (!coverUrl.isBlank()) {
                try {
                    coverPath = downloadCoverAsset(id, coverUrl);
                    coverHash = computeHash(coverPath);
                    if (ocrHint.isBlank()) {
                        ocrHint = item.optString("title", "") + " " + item.optString("artist", "");
                    }
                } catch (IOException e) {
                    coverPath = null;
                    coverHash = null;
                }
            }

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, id);
                statement.setString(2, item.optString("title", ""));
                statement.setString(3, item.optString("artist", item.optString("artistAuthor", "")));
                statement.setString(4, item.optString("mediaType", "Other"));
                statement.setString(5, item.optString("format", ""));
                statement.setInt(6, item.optInt("year", item.optInt("releaseYear", 0)));
                statement.setString(7, item.optString("barcode", item.optString("isbn", "")));
                statement.setString(8, coverUrl);
                statement.setString(9, coverPath);
                statement.setString(10, coverHash);
                statement.setString(11, ocrHint);
                statement.setString(12, item.optString("notes", item.optString("description", "")));
                statement.setString(13, item.optString("source", "manual"));
                statement.setInt(14, item.optBoolean("isTestPress", false) ? 1 : 0);
                statement.executeUpdate();
            }

            return item;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to add media item", e);
        }
    }

    public static JSONObject addToCollection(String userId, String itemId, JSONObject details) {
        try {
            initialize();
            String sql = """
                    INSERT INTO collection_items (userId, itemId, conditionLabel, ownIt, notes, quantity, estimatedValue, visibility)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(userId, itemId) DO UPDATE SET
                        conditionLabel = excluded.conditionLabel,
                        ownIt = excluded.ownIt,
                        notes = excluded.notes,
                        quantity = excluded.quantity,
                        estimatedValue = excluded.estimatedValue,
                        visibility = excluded.visibility;
                    """;

            System.out.println("[CollectionAdd] Storing details: " + details.toString());

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setString(2, itemId);
                statement.setString(3, details.optString("condition", details.optString("conditionLabel", "")));
                statement.setInt(4, details.optBoolean("ownIt", true) ? 1 : 0);
                statement.setString(5, details.optString("description", details.optString("notes", "")));
                statement.setInt(6, details.optInt("quantity", 1));
                statement.setDouble(7, details.optDouble("estimatedValue", 0.0));
                statement.setString(8, details.optString("visibility", "public"));
                statement.executeUpdate();
            }

            return details;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to add item to collection", e);
        }
    }

    public static JSONObject updateItem(String itemId, JSONObject updates) {
        try {
            initialize();
            
            try (Connection connection = getConnection()) {
                // 1. Update media_items table (only if media fields are provided)
                StringBuilder mediaSql = new StringBuilder("UPDATE media_items SET ");
                List<Object> mediaParams = new ArrayList<>();
                if (updates.has("title")) { mediaSql.append("title = ?, "); mediaParams.add(updates.getString("title")); }
                if (updates.has("artist") || updates.has("artistAuthor")) { 
                    mediaSql.append("artist = ?, "); 
                    mediaParams.add(updates.optString("artist", updates.optString("artistAuthor"))); 
                }
                if (updates.has("mediaType")) { mediaSql.append("mediaType = ?, "); mediaParams.add(updates.getString("mediaType")); }
                if (updates.has("format")) { mediaSql.append("format = ?, "); mediaParams.add(updates.getString("format")); }
                if (updates.has("year")) { mediaSql.append("year = ?, "); mediaParams.add(updates.getInt("year")); }
                if (updates.has("barcode")) { mediaSql.append("barcode = ?, "); mediaParams.add(updates.getString("barcode")); }
                if (updates.has("coverUrl")) { mediaSql.append("coverUrl = ?, "); mediaParams.add(updates.getString("coverUrl")); }
                if (updates.has("notes") || updates.has("description")) { 
                    mediaSql.append("notes = ?, "); 
                    mediaParams.add(updates.optString("notes", updates.optString("description"))); 
                }
                
                if (!mediaParams.isEmpty()) {
                    String sql = mediaSql.substring(0, mediaSql.length() - 2) + " WHERE id = ?;";
                    try (PreparedStatement statement = connection.prepareStatement(sql)) {
                        for (int i = 0; i < mediaParams.size(); i++) {
                            statement.setObject(i + 1, mediaParams.get(i));
                        }
                        statement.setString(mediaParams.size() + 1, itemId);
                        statement.executeUpdate();
                    }
                }

                // 2. Update collection_items table if userId is present
                String userId = updates.optString("userId");
                if (userId != null && !userId.isBlank()) {
                    StringBuilder collectionSql = new StringBuilder("UPDATE collection_items SET ");
                    List<Object> collParams = new ArrayList<>();
                    
                    if (updates.has("condition") || updates.has("conditionLabel")) {
                        collectionSql.append("conditionLabel = ?, ");
                        collParams.add(updates.optString("condition", updates.optString("conditionLabel")));
                    }
                    if (updates.has("quantity")) {
                        collectionSql.append("quantity = ?, ");
                        collParams.add(updates.getInt("quantity"));
                    }
                    if (updates.has("estimatedValue")) {
                        collectionSql.append("estimatedValue = ?, ");
                        collParams.add(updates.getDouble("estimatedValue"));
                    }
                    if (updates.has("notes") || updates.has("description")) {
                        collectionSql.append("notes = ?, ");
                        collParams.add(updates.optString("notes", updates.optString("description")));
                    }
                    if (updates.has("visibility")) {
                        collectionSql.append("visibility = ?, ");
                        collParams.add(updates.getString("visibility"));
                    }
                    
                    if (!collParams.isEmpty()) {
                        String sql = collectionSql.substring(0, collectionSql.length() - 2) + " WHERE userId = ? AND itemId = ?;";
                        try (PreparedStatement statement = connection.prepareStatement(sql)) {
                            for (int i = 0; i < collParams.size(); i++) {
                                statement.setObject(i + 1, collParams.get(i));
                            }
                            statement.setString(collParams.size() + 1, userId);
                            statement.setString(collParams.size() + 2, itemId);
                            statement.executeUpdate();
                        }
                    }
                }
            }

            return getItemById(itemId, updates.optString("userId"));
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update media item", e);
        }
    }

    public static JSONObject getItemById(String itemId, String userId) {
        try {
            initialize();
            String sql = """
                    SELECT m.id, m.title, m.artist, m.mediaType, m.format, m.year, m.barcode, m.coverUrl, m.notes as media_notes,
                           c.conditionLabel, c.quantity, c.estimatedValue, c.visibility, c.notes as collection_notes
                    FROM media_items m
                    LEFT JOIN collection_items c ON m.id = c.itemId AND c.userId = ?
                    WHERE m.id = ?;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setString(2, itemId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("title", resultSet.getString("title"));
                        item.put("artist", resultSet.getString("artist"));
                        item.put("artistAuthor", resultSet.getString("artist"));
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("barcode", resultSet.getString("barcode"));
                        item.put("coverUrl", resultSet.getString("coverUrl"));
                        item.put("condition", resultSet.getString("conditionLabel"));
                        item.put("quantity", resultSet.getInt("quantity"));
                        item.put("estimatedValue", resultSet.getDouble("estimatedValue"));
                        item.put("visibility", resultSet.getString("visibility"));
                        item.put("notes", resultSet.getString("collection_notes"));
                        item.put("description", resultSet.getString("collection_notes"));
                        return item;
                    }
                }
            }
            return null;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to get media item", e);
        }
    }

    public static void deleteFromCollection(String userId, String itemId) {
        try {
            initialize();
            String sql = """
                    DELETE FROM collection_items
                    WHERE userId = ? AND itemId = ?;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setString(2, itemId);
                statement.executeUpdate();
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to delete item from collection", e);
        }
    }

    private static String downloadCoverAsset(String itemId, String coverUrl) throws IOException {
        Path dir = Path.of("covers");
        Files.createDirectories(dir);
        String fileName = itemId + "-cover.png";
        Path target = dir.resolve(fileName);

        try {
            try (var input = new URI(coverUrl).toURL().openStream(); var output = new FileOutputStream(target.toFile())) {
                input.transferTo(output);
            }
        } catch (URISyntaxException e) {
            throw new IOException("Invalid cover URL", e);
        }

        return target.toString();
    }

    private static String computeHash(String imagePath) throws IOException {
        BufferedImage image = ImageIO.read(new File(imagePath));
        if (image == null) {
            return null;
        }

        BufferedImage scaled = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        var g = scaled.createGraphics();
        g.drawImage(image, 0, 0, 8, 8, null);
        g.dispose();

        long hash = 0L;
        int avg = 0;
        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                int rgb = scaled.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                int g2 = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                avg += (r + g2 + b) / 3;
            }
        }
        avg /= 64;

        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                int rgb = scaled.getRGB(x, y);
                int lum = ((rgb >> 16) & 0xff + (rgb >> 8) & 0xff + rgb & 0xff) / 3;
                hash = (hash << 1) | (lum >= avg ? 1L : 0L);
            }
        }

        return Long.toHexString(hash);
    }

    public static JSONArray findSimilarItems(String coverHash, String textHint) {
        try {
            initialize();
            String sql = """
                    SELECT id, title, artist, mediaType, format, year, barcode, coverUrl, coverHash, ocrHint
                    FROM media_items
                    WHERE (? IS NULL OR coverHash = ?) OR lower(ocrHint) LIKE ? OR lower(title) LIKE ? OR lower(artist) LIKE ?
                    ORDER BY id ASC
                    LIMIT 10;
                    """;

            String term = "%" + (textHint == null ? "" : textHint.toLowerCase(Locale.ROOT)) + "%";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, coverHash);
                statement.setString(2, coverHash);
                statement.setString(3, term);
                statement.setString(4, term);
                statement.setString(5, term);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("title", resultSet.getString("title"));
                        item.put("artist", resultSet.getString("artist"));
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("barcode", resultSet.getString("barcode"));
                        item.put("coverUrl", resultSet.getString("coverUrl"));
                        item.put("coverHash", resultSet.getString("coverHash"));
                        item.put("ocrHint", resultSet.getString("ocrHint"));
                        items.put(item);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to find similar items", e);
        }
    }

    public static JSONArray listCollection(String userId) {
        try {
            initialize();
            String sql = """
                    SELECT m.id, m.title, m.artist, m.mediaType, m.format, m.year, m.barcode, m.coverUrl,
                           c.conditionLabel, c.ownIt, c.notes, c.addedAt, c.quantity, c.estimatedValue, c.visibility
                    FROM collection_items c
                    JOIN media_items m ON m.id = c.itemId
                    WHERE c.userId = ?
                    ORDER BY c.addedAt DESC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("title", resultSet.getString("title"));
                        item.put("artist", resultSet.getString("artist"));
                        item.put("artistAuthor", resultSet.getString("artist"));
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("barcode", resultSet.getString("barcode"));
                        item.put("coverUrl", resultSet.getString("coverUrl"));
                        item.put("condition", resultSet.getString("conditionLabel"));
                        item.put("conditionLabel", resultSet.getString("conditionLabel"));
                        item.put("ownIt", resultSet.getInt("ownIt") == 1);
                        item.put("notes", resultSet.getString("notes"));
                        item.put("description", resultSet.getString("notes"));
                        item.put("addedAt", resultSet.getString("addedAt"));
                        item.put("quantity", resultSet.getInt("quantity"));
                        item.put("estimatedValue", resultSet.getDouble("estimatedValue"));
                        item.put("visibility", resultSet.getString("visibility"));
                        items.put(item);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list collection", e);
        }
    }

    public static JSONArray listPublicCollection(String userId) {
        try {
            initialize();
            String sql = """
                    SELECT m.id, m.title, m.artist, m.mediaType, m.format, m.year, m.barcode, m.coverUrl,
                           c.conditionLabel, c.ownIt, c.notes, c.addedAt, c.quantity, c.estimatedValue, c.visibility
                    FROM collection_items c
                    JOIN media_items m ON m.id = c.itemId
                    WHERE c.userId = ? AND c.visibility = 'public'
                    ORDER BY c.addedAt DESC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("title", resultSet.getString("title"));
                        item.put("artist", resultSet.getString("artist"));
                        item.put("artistAuthor", resultSet.getString("artist"));
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("barcode", resultSet.getString("barcode"));
                        item.put("coverUrl", resultSet.getString("coverUrl"));
                        item.put("condition", resultSet.getString("conditionLabel"));
                        item.put("conditionLabel", resultSet.getString("conditionLabel"));
                        item.put("ownIt", resultSet.getInt("ownIt") == 1);
                        item.put("notes", resultSet.getString("notes"));
                        item.put("description", resultSet.getString("notes"));
                        item.put("addedAt", resultSet.getString("addedAt"));
                        item.put("quantity", resultSet.getInt("quantity"));
                        item.put("estimatedValue", resultSet.getDouble("estimatedValue"));
                        item.put("visibility", resultSet.getString("visibility"));
                        items.put(item);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list public collection", e);
        }
    }
}
