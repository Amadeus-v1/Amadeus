package org.amadeus.amadeusserver;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Provides search and lookup functionality for the Discogs releases database.
 * Uses FTS5 full-text search for fast queries across millions of records.
 */
public class DiscogsStore {
    private static final String DB_URL = "jdbc:sqlite:discogs.db";

    private static Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(DB_URL);
        try (Statement s = conn.createStatement()) {
            s.execute("PRAGMA journal_mode=WAL");
            s.execute("PRAGMA cache_size=-50000"); // 50MB cache for reads
        }
        return conn;
    }

    /**
     * Check if the Discogs database is available and populated.
     */
    public static boolean isAvailable() {
        if (!Files.exists(Path.of("discogs.db"))) {
            return false;
        }
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM discogs_releases LIMIT 1")) {
            return rs.next() && rs.getInt(1) > 0;
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Get total record count in the Discogs database.
     */
    public static int getRecordCount() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM discogs_releases")) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException e) {
            return 0;
        }
    }

    /**
     * Full-text search across the Discogs releases database.
     * Searches title, artist, genres, labels, and barcode.
     */
    public static JSONArray search(String query, int limit) {
        if (!isAvailable()) return new JSONArray();

        JSONArray results = new JSONArray();
        if (query == null || query.isBlank()) return results;

        if (!hasFtsTable()) {
            return searchFallback(query, limit);
        }

        // Sanitize FTS5 query: escape special characters and add prefix matching
        String ftsQuery = sanitizeFtsQuery(query);
        if (ftsQuery.isBlank()) return results;

        String sql = """
            SELECT r.id, r.title, r.artist, r.year, r.country, r.genres, r.styles, 
                   r.formats, r.labels, r.barcode, r.master_id
            FROM discogs_releases r
            JOIN discogs_fts f ON r.id = f.rowid
            WHERE discogs_fts MATCH ?
            ORDER BY rank
            LIMIT ?;
        """;

        JSONArray rawResults = new JSONArray();
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, ftsQuery);
            stmt.setInt(2, Math.min(limit * 5, 200));

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    rawResults.put(releaseFromResultSet(rs));
                }
            }
        } catch (SQLException e) {
            // If FTS fails, fall back to LIKE search
            System.err.println("[DiscogsStore] FTS search failed, falling back to LIKE: " + e.getMessage());
            return searchFallback(query, limit);
        }

        // Java-side deduplicate by master_id
        java.util.HashSet<Integer> seenMasters = new java.util.HashSet<>();
        for (int i = 0; i < rawResults.length() && results.length() < limit; i++) {
            JSONObject release = rawResults.getJSONObject(i);
            int masterId = release.optInt("masterId", 0);
            if (masterId > 0) {
                if (!seenMasters.contains(masterId)) {
                    seenMasters.add(masterId);
                    results.put(release);
                }
            } else {
                results.put(release);
            }
        }

        return results;
    }

    /**
     * Filtered search with pagination for the Explore page.
     * Supports query text, genre, format, year range, country, and offset/limit.
     */
    public static JSONObject searchWithFilters(String query, String artist, String genre, String format,
                                                int yearFrom, int yearTo, String country,
                                                int offset, int limit) {
        if (!isAvailable()) {
            JSONObject empty = new JSONObject();
            empty.put("results", new JSONArray());
            empty.put("total", 0);
            empty.put("offset", offset);
            empty.put("limit", limit);
            return empty;
        }

        StringBuilder where = new StringBuilder();
        java.util.List<Object> params = new java.util.ArrayList<>();
        boolean useFts = query != null && !query.isBlank() && hasFtsTable();

        if (query != null && !query.isBlank()) {
            if (useFts) {
                String ftsQuery = sanitizeFtsQuery(query);
                if (!ftsQuery.isBlank()) {
                    where.append("discogs_fts MATCH ?");
                    params.add(ftsQuery);
                } else {
                    useFts = false;
                }
            }
            if (!useFts) {
                String term = "%" + query.toLowerCase().trim() + "%";
                where.append("(lower(r.title) LIKE ? OR lower(r.artist) LIKE ? OR lower(r.barcode) LIKE ?)");
                params.add(term);
                params.add(term);
                params.add(term);
            }
        }

        if (artist != null && !artist.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("lower(r.artist) LIKE ?");
            params.add("%" + artist.toLowerCase().trim() + "%");
        }

        if (genre != null && !genre.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("lower(r.genres) LIKE ?");
            params.add("%" + genre.toLowerCase() + "%");
        }

        if (format != null && !format.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("lower(r.formats) LIKE ?");
            params.add("%" + format.toLowerCase() + "%");
        }

        if (yearFrom > 0) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("r.year >= ?");
            params.add(yearFrom);
        }

        if (yearTo > 0) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("r.year <= ?");
            params.add(yearTo);
        }

        if (country != null && !country.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("lower(r.country) = ?");
            params.add(country.toLowerCase());
        }

        // Build query
        String fromClause;
        if (useFts) {
            fromClause = "FROM discogs_releases r JOIN discogs_fts f ON r.id = f.rowid";
        } else {
            fromClause = "FROM discogs_releases r";
        }

        String whereClause = where.isEmpty() ? "" : "WHERE " + where;
        String orderBy = useFts ? "ORDER BY rank" : "ORDER BY r.year DESC, r.title ASC";

        // Fetch candidate window without SQL-level group by (performance bottleneck)
        int candidateLimit = Math.min(limit * 5, 200);
        int dbOffset = offset * 2; // Rough database offset mapping

        String dataSql = "SELECT r.id, r.title, r.artist, r.year, r.country, r.genres, r.styles, " +
                          "r.formats, r.labels, r.barcode, r.master_id " +
                          fromClause + " " + whereClause + " " + orderBy +
                          " LIMIT ? OFFSET ?";

        JSONArray rawResults = new JSONArray();
        try (Connection conn = getConnection();
             PreparedStatement dataStmt = conn.prepareStatement(dataSql)) {
            for (int i = 0; i < params.size(); i++) {
                Object p = params.get(i);
                if (p instanceof String) dataStmt.setString(i + 1, (String) p);
                else if (p instanceof Integer) dataStmt.setInt(i + 1, (Integer) p);
            }
            dataStmt.setInt(params.size() + 1, candidateLimit);
            dataStmt.setInt(params.size() + 2, dbOffset);

            try (ResultSet rs = dataStmt.executeQuery()) {
                while (rs.next()) {
                    rawResults.put(releaseFromResultSet(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] Filtered search failed: " + e.getMessage());
        }

        // Java-side deduplicate by master_id
        java.util.HashSet<Integer> seenMasters = new java.util.HashSet<>();
        JSONArray deduplicated = new JSONArray();
        for (int i = 0; i < rawResults.length(); i++) {
            JSONObject release = rawResults.getJSONObject(i);
            int masterId = release.optInt("masterId", 0);
            if (masterId > 0) {
                if (!seenMasters.contains(masterId)) {
                    seenMasters.add(masterId);
                    deduplicated.put(release);
                }
            } else {
                deduplicated.put(release);
            }
        }

        // Slice results for safe limit
        JSONArray slicedResults = new JSONArray();
        int safeLimit = Math.min(limit, 50);
        for (int i = 0; i < deduplicated.length() && slicedResults.length() < safeLimit; i++) {
            slicedResults.put(deduplicated.get(i));
        }

        // Slice pagination metadata
        boolean hasMore = rawResults.length() == candidateLimit;
        int total = offset + slicedResults.length() + (hasMore ? 100 : 0);

        JSONObject result = new JSONObject();
        result.put("results", slicedResults);
        result.put("total", total);
        result.put("offset", offset);
        result.put("limit", safeLimit);
        return result;
    }

    /**
     * Search all releases by a specific artist name.
     */
    public static JSONArray searchByArtist(String artistName, int limit) {
        if (!isAvailable() || artistName == null || artistName.isBlank()) return new JSONArray();

        JSONArray results = new JSONArray();
        String sql = """
            SELECT MIN(id) as id, title, artist, MIN(year) as year, country, genres, styles, formats, labels, barcode, master_id
            FROM discogs_releases
            WHERE lower(artist) = ? OR lower(artist) LIKE ?
            GROUP BY COALESCE(NULLIF(master_id, 0), -id)
            ORDER BY MIN(year) ASC, title ASC
            LIMIT ?;
        """;

        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, artistName.toLowerCase().trim());
            stmt.setString(2, "%" + artistName.toLowerCase().trim() + "%");
            stmt.setInt(3, Math.min(limit, 200));
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    results.put(releaseFromResultSet(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] Artist search failed: " + e.getMessage());
        }
        return results;
    }

    /**
     * Get distinct genres from the database for filter dropdowns.
     */
    public static JSONArray getDistinctGenres() {
        JSONArray genres = new JSONArray();
        if (!isAvailable()) return genres;

        // Genres are stored as comma-separated, so we do a grouped query on the raw column
        // and split client-side, but for performance we return the top unique genre strings
        String sql = """
            SELECT genres, COUNT(*) as cnt
            FROM discogs_releases
            WHERE genres IS NOT NULL AND genres != ''
            GROUP BY genres
            ORDER BY cnt DESC
            LIMIT 200;
        """;

        java.util.LinkedHashSet<String> uniqueGenres = new java.util.LinkedHashSet<>();
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                String raw = rs.getString("genres");
                if (raw != null) {
                    for (String g : raw.split(",")) {
                        String trimmed = g.trim();
                        if (!trimmed.isEmpty()) uniqueGenres.add(trimmed);
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] getDistinctGenres failed: " + e.getMessage());
        }

        for (String g : uniqueGenres) {
            genres.put(g);
        }
        return genres;
    }

    /**
     * Get distinct countries from the database for filter dropdowns.
     */
    public static JSONArray getDistinctCountries() {
        JSONArray countries = new JSONArray();
        if (!isAvailable()) return countries;

        String sql = """
            SELECT DISTINCT country
            FROM discogs_releases
            WHERE country IS NOT NULL AND country != ''
            ORDER BY country ASC;
        """;

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                countries.put(rs.getString("country"));
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] getDistinctCountries failed: " + e.getMessage());
        }
        return countries;
    }

    /**
     * Fallback LIKE-based search when FTS is not available.
     */
    private static JSONArray searchFallback(String query, int limit) {
        JSONArray results = new JSONArray();
        String sql = """
            SELECT id, title, artist, year, country, genres, styles, formats, labels, barcode, master_id
            FROM discogs_releases
            WHERE lower(title) LIKE ? OR lower(artist) LIKE ? OR lower(barcode) LIKE ?
            ORDER BY year DESC
            LIMIT ?;
        """;

        String term = "%" + query.toLowerCase().trim() + "%";
        JSONArray rawResults = new JSONArray();
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, term);
            stmt.setString(2, term);
            stmt.setString(3, term);
            stmt.setInt(4, Math.min(limit * 5, 200));

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    rawResults.put(releaseFromResultSet(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] Fallback search failed: " + e.getMessage());
        }

        // Java-side deduplicate by master_id
        java.util.HashSet<Integer> seenMasters = new java.util.HashSet<>();
        for (int i = 0; i < rawResults.length() && results.length() < limit; i++) {
            JSONObject release = rawResults.getJSONObject(i);
            int masterId = release.optInt("masterId", 0);
            if (masterId > 0) {
                if (!seenMasters.contains(masterId)) {
                    seenMasters.add(masterId);
                    results.put(release);
                }
            } else {
                results.put(release);
            }
        }

        return results;
    }

    /**
     * Get a single release by its Discogs ID.
     */
    public static JSONObject getById(int discogsId) {
        if (!isAvailable()) return null;

        String sql = """
            SELECT id, title, artist, year, country, genres, styles, formats, labels, barcode, master_id
            FROM discogs_releases
            WHERE id = ?;
        """;

        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, discogsId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return releaseFromResultSet(rs);
                }
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] Error fetching release " + discogsId + ": " + e.getMessage());
        }

        return null;
    }

    /**
     * Get all releases that share the same master_id (i.e., all pressings/versions of an album).
     */
    public static JSONArray getRelatedReleases(int masterId, int limit) {
        if (!isAvailable() || masterId == 0) return new JSONArray();

        JSONArray results = new JSONArray();
        String sql = """
            SELECT id, title, artist, year, country, genres, styles, formats, labels, barcode, master_id
            FROM discogs_releases
            WHERE master_id = ?
            ORDER BY year ASC
            LIMIT ?;
        """;

        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, masterId);
            stmt.setInt(2, Math.min(limit, 100));

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    results.put(releaseFromResultSet(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] Error fetching related releases: " + e.getMessage());
        }

        return results;
    }

    /**
     * Convert a ResultSet row to a JSONObject.
     */
    private static JSONObject releaseFromResultSet(ResultSet rs) throws SQLException {
        JSONObject item = new JSONObject();
        item.put("discogsId", rs.getInt("id"));
        item.put("title", rs.getString("title"));
        item.put("artist", rs.getString("artist"));
        item.put("year", rs.getInt("year"));
        item.put("country", rs.getString("country"));
        item.put("genres", rs.getString("genres"));
        item.put("styles", rs.getString("styles"));
        item.put("formats", rs.getString("formats"));
        item.put("labels", rs.getString("labels"));
        item.put("barcode", rs.getString("barcode"));
        item.put("masterId", rs.getInt("master_id"));
        return item;
    }

    /**
     * Check if the FTS search table is available in the database.
     */
    private static boolean hasFtsTable() {
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                 "SELECT 1 FROM sqlite_master WHERE type='table' AND name='discogs_fts'")) {
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Sanitize a user query for FTS5 matching.
     * Escapes special characters and adds prefix matching for the last term.
     */
    private static String sanitizeFtsQuery(String query) {
        // Remove FTS5 special characters
        String cleaned = query.replaceAll("[\"*^(){}\\[\\]:!+\\-]", " ").trim();
        if (cleaned.isBlank()) return "";

        String[] terms = cleaned.split("\\s+");
        StringBuilder fts = new StringBuilder();
        for (int i = 0; i < terms.length; i++) {
            if (i > 0) fts.append(" ");
            fts.append("\"").append(terms[i]).append("\"");
            // Add prefix matching on last term for autocomplete-style search
            if (i == terms.length - 1 && terms[i].length() >= 2) {
                fts.append("*");
            }
        }
        return fts.toString();
    }
}
