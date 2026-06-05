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
import java.util.Locale;

import javax.imageio.ImageIO;

import org.json.JSONArray;
import org.json.JSONObject;

public class MediaStore {
    private static final String DB_URL = "jdbc:sqlite:mediaCatalog.db";

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initialize() throws SQLException {
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
                    addedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (userId, itemId)
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(mediaSql);
            statement.execute(collectionSql);
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

    public static JSONObject addItem(JSONObject item) {
        try {
            initialize();
            String sql = """
                    INSERT INTO media_items (id, title, artist, mediaType, format, year, barcode, coverUrl, coverPath, coverHash, ocrHint, notes, source, isTestPress)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """;

            String id = item.optString("id", java.util.UUID.randomUUID().toString());
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
                statement.setString(1, item.getString("id"));
                statement.setString(2, item.optString("title", ""));
                statement.setString(3, item.optString("artist", ""));
                statement.setString(4, item.optString("mediaType", "record"));
                statement.setString(5, item.optString("format", ""));
                statement.setInt(6, item.optInt("year", 0));
                statement.setString(7, item.optString("barcode", ""));
                statement.setString(8, coverUrl);
                statement.setString(9, coverPath);
                statement.setString(10, coverHash);
                statement.setString(11, ocrHint);
                statement.setString(12, item.optString("notes", ""));
                statement.setString(13, item.optString("source", "manual"));
                statement.setInt(14, item.optBoolean("isTestPress", false) ? 1 : 0);
                statement.executeUpdate();
            }

            item.put("coverPath", coverPath);
            item.put("coverHash", coverHash);
            item.put("ocrHint", ocrHint);
            return item;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to add media item", e);
        }
    }

    public static JSONObject addToCollection(String userId, String itemId, JSONObject details) {
        try {
            initialize();
            String sql = """
                    INSERT INTO collection_items (userId, itemId, conditionLabel, ownIt, notes)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(userId, itemId) DO UPDATE SET
                        conditionLabel = excluded.conditionLabel,
                        ownIt = excluded.ownIt,
                        notes = excluded.notes;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                statement.setString(2, itemId);
                statement.setString(3, details.optString("conditionLabel", ""));
                statement.setInt(4, details.optBoolean("ownIt", true) ? 1 : 0);
                statement.setString(5, details.optString("notes", ""));
                statement.executeUpdate();
            }

            JSONObject result = new JSONObject();
            result.put("userId", userId);
            result.put("itemId", itemId);
            result.put("conditionLabel", details.optString("conditionLabel", ""));
            result.put("ownIt", details.optBoolean("ownIt", true));
            result.put("notes", details.optString("notes", ""));
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to add item to collection", e);
        }
    }

    public static JSONObject updateItem(String itemId, JSONObject updates) {
        try {
            initialize();
            String sql = """
                    UPDATE media_items
                    SET title = ?, artist = ?, mediaType = ?, format = ?, year = ?, barcode = ?, coverUrl = ?, notes = ?
                    WHERE id = ?;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, updates.optString("title", ""));
                statement.setString(2, updates.optString("artist", ""));
                statement.setString(3, updates.optString("mediaType", ""));
                statement.setString(4, updates.optString("format", ""));
                statement.setInt(5, updates.optInt("year", 0));
                statement.setString(6, updates.optString("barcode", ""));
                statement.setString(7, updates.optString("coverUrl", ""));
                statement.setString(8, updates.optString("notes", ""));
                statement.setString(9, itemId);
                
                int rowsUpdated = statement.executeUpdate();
                if (rowsUpdated == 0) {
                    throw new RuntimeException("Item not found: " + itemId);
                }
            }

            // Return the updated item
            return getItemById(itemId);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update media item", e);
        }
    }

    public static JSONObject getItemById(String itemId) {
        try {
            initialize();
            String sql = """
                    SELECT id, title, artist, mediaType, format, year, barcode, coverUrl, notes
                    FROM media_items
                    WHERE id = ?;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, itemId);
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
                           c.conditionLabel, c.ownIt, c.notes, c.addedAt
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
                        item.put("mediaType", resultSet.getString("mediaType"));
                        item.put("format", resultSet.getString("format"));
                        item.put("year", resultSet.getInt("year"));
                        item.put("barcode", resultSet.getString("barcode"));
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
            throw new RuntimeException("Failed to list collection", e);
        }
    }
}
