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
    private static final double PLATFORM_FEE_RATE = 0.01;
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
                    WHERE (? IS NULL OR sellerId = ?)
                    ORDER BY createdAt DESC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, sellerId);
                statement.setString(2, sellerId);
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
    
    public static JSONArray listAllActiveListings() {
        try {
            initialize();
            String sql = """
                    SELECT id, sellerId, itemId, price, currency, status, createdAt
                    FROM listings
                    WHERE status = 'active'
                    ORDER BY createdAt DESC;
                    """;

            try (Connection connection = getConnection(); Statement statement = connection.createStatement(); 
                 ResultSet resultSet = statement.executeQuery(sql)) {
                JSONArray items = new JSONArray();
                while (resultSet.next()) {
                    String itemId = resultSet.getString("itemId");
                    String sellerId = resultSet.getString("sellerId");
                    
                    JSONObject listing = new JSONObject();
                    listing.put("id", resultSet.getString("id"));
                    listing.put("sellerId", sellerId);
                    listing.put("itemId", itemId);
                    listing.put("price", resultSet.getDouble("price"));
                    listing.put("currency", resultSet.getString("currency"));
                    listing.put("createdAt", resultSet.getString("createdAt"));
                    
                    // Resolve Item Details
                    JSONObject itemDetails = MediaStore.getItemById(itemId, sellerId);
                    if (itemDetails != null) {
                        listing.put("title", itemDetails.optString("title", "Unknown"));
                        listing.put("artist", itemDetails.optString("artist", ""));
                        listing.put("coverUrl", itemDetails.optString("coverUrl", ""));
                        listing.put("mediaType", itemDetails.optString("mediaType", ""));
                        listing.put("condition", itemDetails.optString("condition", ""));
                    }
                    
                    // Resolve Seller Username
                    JSONObject seller = UserStore.findById(sellerId);
                    listing.put("sellerUsername", seller != null ? seller.optString("username", "Unknown") : "Unknown");
                    
                    items.put(listing);
                }
                return items;
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list active marketplace listings", e);
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
            
            // Mark listing as sold
            String updateListingSql = "UPDATE listings SET status = 'sold' WHERE id = ?";
            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(updateListingSql)) {
                statement.setString(1, listingId);
                statement.executeUpdate();
            }

            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to complete sale", e);
        }
    }

    public static JSONObject cancelListing(String listingId, String sellerId) {
        try {
            initialize();
            // Verify ownership
            String checkSql = "SELECT sellerId, status FROM listings WHERE id = ?";
            try (Connection connection = getConnection(); PreparedStatement stmt = connection.prepareStatement(checkSql)) {
                stmt.setString(1, listingId);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (!rs.next()) {
                        throw new RuntimeException("Listing not found");
                    }
                    if (!rs.getString("sellerId").equals(sellerId)) {
                        throw new RuntimeException("You can only cancel your own listings");
                    }
                    if (!"active".equals(rs.getString("status"))) {
                        throw new RuntimeException("Only active listings can be cancelled");
                    }
                }
            }

            String sql = "UPDATE listings SET status = 'cancelled' WHERE id = ? AND sellerId = ?";
            try (Connection connection = getConnection(); PreparedStatement stmt = connection.prepareStatement(sql)) {
                stmt.setString(1, listingId);
                stmt.setString(2, sellerId);
                stmt.executeUpdate();
            }

            JSONObject result = new JSONObject();
            result.put("listingId", listingId);
            result.put("status", "cancelled");
            return result;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to cancel listing", e);
        }
    }

    public static JSONArray getListingsWithDetails(String userId) {
        try {
            initialize();
            String sql = """
                    SELECT id, sellerId, itemId, price, currency, status, createdAt
                    FROM listings
                    WHERE sellerId = ?
                    ORDER BY createdAt DESC;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, userId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    JSONArray items = new JSONArray();
                    while (resultSet.next()) {
                        String itemId = resultSet.getString("itemId");
                        String sellerId = resultSet.getString("sellerId");

                        JSONObject listing = new JSONObject();
                        listing.put("id", resultSet.getString("id"));
                        listing.put("sellerId", sellerId);
                        listing.put("itemId", itemId);
                        listing.put("price", resultSet.getDouble("price"));
                        listing.put("currency", resultSet.getString("currency"));
                        listing.put("status", resultSet.getString("status"));
                        listing.put("createdAt", resultSet.getString("createdAt"));

                        // Resolve Item Details
                        JSONObject itemDetails = MediaStore.getItemById(itemId, sellerId);
                        if (itemDetails != null) {
                            listing.put("title", itemDetails.optString("title", "Unknown"));
                            listing.put("artist", itemDetails.optString("artist", ""));
                            listing.put("coverUrl", itemDetails.optString("coverUrl", ""));
                            listing.put("mediaType", itemDetails.optString("mediaType", ""));
                            listing.put("condition", itemDetails.optString("condition", ""));
                        }

                        items.put(listing);
                    }
                    return items;
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list user marketplace listings", e);
        }
    }
}
