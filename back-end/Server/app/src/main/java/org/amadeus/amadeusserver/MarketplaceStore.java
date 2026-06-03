package org.amadeus.amadeusserver;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import org.json.JSONArray;
import org.json.JSONObject;

public class MarketplaceStore {
    private static final String DB_URL = "jdbc:sqlite:marketplace.db";
    private static final double PLATFORM_FEE_RATE = 0.03;
    private static final String PLATFORM_BANK_ACCOUNT = "BANK-ACCOUNT-001";

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initialize() throws SQLException {
        String listingsSql = """
                CREATE TABLE IF NOT EXISTS listings (
                    id TEXT PRIMARY KEY,
                    sellerId TEXT NOT NULL,
                    itemId TEXT NOT NULL,
                    price DOUBLE NOT NULL,
                    currency TEXT DEFAULT 'USD',
                    status TEXT DEFAULT 'active',
                    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        String salesSql = """
                CREATE TABLE IF NOT EXISTS sales (
                    id TEXT PRIMARY KEY,
                    listingId TEXT NOT NULL,
                    sellerId TEXT NOT NULL,
                    buyerId TEXT NOT NULL,
                    grossPrice DOUBLE NOT NULL,
                    platformFee DOUBLE NOT NULL,
                    payoutAmount DOUBLE NOT NULL,
                    bankAccount TEXT NOT NULL,
                    status TEXT DEFAULT 'completed',
                    completedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(listingsSql);
            statement.execute(salesSql);
        }
    }

    public static JSONObject createListing(JSONObject payload) {
        try {
            initialize();
            String sql = """
                    INSERT INTO listings (id, sellerId, itemId, price, currency, status)
                    VALUES (?, ?, ?, ?, ?, ?);
                    """;

            String id = payload.optString("id", java.util.UUID.randomUUID().toString());
            payload.put("id", id);

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, payload.getString("id"));
                statement.setString(2, payload.optString("sellerId", ""));
                statement.setString(3, payload.optString("itemId", ""));
                statement.setDouble(4, payload.optDouble("price", 0.0));
                statement.setString(5, payload.optString("currency", "USD"));
                statement.setString(6, payload.optString("status", "active"));
                statement.executeUpdate();
            }

            return payload;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to create listing", e);
        }
    }

    public static JSONArray listListings(String sellerId) {
        try {
            initialize();
            String sql = """
                    SELECT id, sellerId, itemId, price, currency, status, createdAt
                    FROM listings
                    WHERE sellerId = ?
                    ORDER BY createdAt DESC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, sellerId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        JSONObject item = new JSONObject();
                        item.put("id", resultSet.getString("id"));
                        item.put("sellerId", resultSet.getString("sellerId"));
                        item.put("itemId", resultSet.getString("itemId"));
                        item.put("price", resultSet.getDouble("price"));
                        item.put("currency", resultSet.getString("currency"));
                        item.put("status", resultSet.getString("status"));
                        item.put("createdAt", resultSet.getString("createdAt"));
                        items.put(item);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list marketplace listings", e);
        }
    }

    public static JSONObject completeSale(JSONObject payload) {
        try {
            initialize();
            String listingId = payload.getString("listingId");
            double grossPrice = payload.optDouble("price", 0.0);
            double platformFee = grossPrice * PLATFORM_FEE_RATE;
            double payoutAmount = grossPrice - platformFee;

            String saleId = payload.optString("saleId", java.util.UUID.randomUUID().toString());
            JSONObject result = new JSONObject();
            result.put("saleId", saleId);
            result.put("listingId", listingId);
            result.put("sellerId", payload.optString("sellerId", ""));
            result.put("buyerId", payload.optString("buyerId", ""));
            result.put("grossPrice", grossPrice);
            result.put("platformFeeRate", PLATFORM_FEE_RATE);
            result.put("platformFee", platformFee);
            result.put("payoutAmount", payoutAmount);
            result.put("bankAccount", PLATFORM_BANK_ACCOUNT);
            result.put("status", "completed");

            String sql = """
                    INSERT INTO sales (id, listingId, sellerId, buyerId, grossPrice, platformFee, payoutAmount, bankAccount, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, saleId);
                statement.setString(2, listingId);
                statement.setString(3, payload.optString("sellerId", ""));
                statement.setString(4, payload.optString("buyerId", ""));
                statement.setDouble(5, grossPrice);
                statement.setDouble(6, platformFee);
                statement.setDouble(7, payoutAmount);
                statement.setString(8, PLATFORM_BANK_ACCOUNT);
                statement.setString(9, "completed");
                statement.executeUpdate();
            }

            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to complete sale", e);
        }
    }
}
