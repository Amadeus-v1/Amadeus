package org.amadeus.amadeusserver;

import org.junit.jupiter.api.Test;
import java.sql.*;

public class FtsTest {

    @Test
    public void testOptimizeFts() {
        String dbUrl = "jdbc:sqlite:../../../discogs.db";
        try (Connection conn = DriverManager.getConnection(dbUrl);
             Statement stmt = conn.createStatement()) {
            
            System.out.println("Running FTS optimize command on real database...");
            long start = System.currentTimeMillis();
            stmt.execute("INSERT INTO discogs_fts(discogs_fts) VALUES('optimize');");
            long end = System.currentTimeMillis();
            System.out.println("FTS optimize completed in: " + (end - start) + " ms");

            // Measure search time after optimization
            String query = "\"Beatles\"*";
            System.out.println("\nQuerying FTS MATCH '\"Beatles\"*' after optimize...");
            start = System.currentTimeMillis();
            try (PreparedStatement searchStmt = conn.prepareStatement("""
                SELECT r.id, r.title, r.artist 
                FROM discogs_releases r
                JOIN discogs_fts f ON r.id = f.rowid
                WHERE discogs_fts MATCH ?
                ORDER BY rank
                LIMIT 25;
            """)) {
                searchStmt.setString(1, query);
                try (ResultSet rs = searchStmt.executeQuery()) {
                    int fetched = 0;
                    while (rs.next()) fetched++;
                    System.out.println("Fetched " + fetched + " rows.");
                }
            }
            end = System.currentTimeMillis();
            System.out.println("FTS query with ORDER BY rank took: " + (end - start) + " ms");

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
