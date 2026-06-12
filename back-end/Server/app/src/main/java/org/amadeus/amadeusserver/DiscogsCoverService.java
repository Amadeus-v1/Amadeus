package org.amadeus.amadeusserver;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Service that fetches and caches cover art images from the Discogs API.
 * Images are cached locally in covers/ directory to minimize API calls.
 * Works without auth (25 req/min) or with a personal access token (60 req/min).
 */
public class DiscogsCoverService {
    private static final String COVERS_DIR = "covers";
    private static final String DISCOGS_API_BASE = "https://api.discogs.com";
    private static final String USER_AGENT = "Amadeus/1.0";

    // Rate limiting
    private static long lastRequestTime = 0;
    private static final long MIN_REQUEST_INTERVAL_MS = 2500; // ~25 req/min without auth

    /**
     * Get the cover image path for a given Discogs release ID.
     * Returns the local file path if cached, fetches and caches if not.
     * Returns null if no image is available or fetch fails.
     */
    public static String getCoverPath(int discogsId) {
        // Ensure covers directory exists
        Path dir = Path.of(COVERS_DIR);
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            System.err.println("[CoverService] Cannot create covers dir: " + e.getMessage());
            return null;
        }

        // Check cache first
        Path cached = dir.resolve(discogsId + ".jpg");
        if (Files.exists(cached) && fileNotEmpty(cached)) {
            return cached.toString();
        }

        // Also check if we already tried and there's no image (marker file)
        Path noImage = dir.resolve(discogsId + ".noimg");
        if (Files.exists(noImage)) {
            return null;
        }

        // Fetch from Discogs API
        try {
            String imageUrl = fetchImageUrl(discogsId);
            if (imageUrl == null || imageUrl.isBlank()) {
                // Create marker to avoid re-fetching
                Files.writeString(noImage, "no-image");
                return null;
            }

            // Download the image
            downloadImage(imageUrl, cached);
            return cached.toString();
        } catch (Exception e) {
            System.err.println("[CoverService] Error fetching cover for " + discogsId + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * Serve the cover image bytes for a given Discogs release ID.
     * Returns null if no image available.
     */
    public static byte[] getCoverBytes(int discogsId) {
        String path = getCoverPath(discogsId);
        if (path == null) return null;

        try {
            return Files.readAllBytes(Path.of(path));
        } catch (IOException e) {
            System.err.println("[CoverService] Error reading cover file: " + e.getMessage());
            return null;
        }
    }

    /**
     * Fetch the primary image URL for a release from the Discogs API.
     */
    private static String fetchImageUrl(int discogsId) throws IOException {
        rateLimitWait();

        String urlStr = DISCOGS_API_BASE + "/releases/" + discogsId;
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(15000);

        // Add token if available
        String token = ConfigStore.get("discogs_api_token");
        if (token != null && !token.isBlank()) {
            conn.setRequestProperty("Authorization", "Discogs token=" + token);
        }

        lastRequestTime = System.currentTimeMillis();

        int responseCode = conn.getResponseCode();
        if (responseCode == 429) {
            // Rate limited — back off
            System.err.println("[CoverService] Rate limited by Discogs API");
            return null;
        }
        if (responseCode != 200) {
            return null;
        }

        String body = new String(conn.getInputStream().readAllBytes());
        JSONObject release = new JSONObject(body);

        // Try images array
        JSONArray images = release.optJSONArray("images");
        if (images != null && !images.isEmpty()) {
            // Prefer "primary" type
            for (int i = 0; i < images.length(); i++) {
                JSONObject img = images.getJSONObject(i);
                if ("primary".equals(img.optString("type"))) {
                    return img.optString("uri", img.optString("uri150", ""));
                }
            }
            // Fall back to first image
            JSONObject first = images.getJSONObject(0);
            return first.optString("uri", first.optString("uri150", ""));
        }

        // Try thumb field
        String thumb = release.optString("thumb", "");
        if (!thumb.isBlank()) return thumb;

        return null;
    }

    /**
     * Download an image from a URL and save it to the specified path.
     */
    private static void downloadImage(String imageUrl, Path destination) throws IOException {
        URL url = new URL(imageUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(15000);

        if (conn.getResponseCode() != 200) {
            throw new IOException("Image download failed: HTTP " + conn.getResponseCode());
        }

        try (InputStream in = conn.getInputStream();
             OutputStream out = Files.newOutputStream(destination)) {
            in.transferTo(out);
        }
    }

    /**
     * Simple rate limiter to avoid exceeding Discogs API limits.
     */
    private static synchronized void rateLimitWait() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastRequestTime;
        String token = ConfigStore.get("discogs_api_token");
        long interval = (token != null && !token.isBlank()) ? 1100 : MIN_REQUEST_INTERVAL_MS;
        
        if (elapsed < interval) {
            try {
                Thread.sleep(interval - elapsed);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private static boolean fileNotEmpty(Path path) {
        try {
            return Files.size(path) > 0;
        } catch (IOException e) {
            return false;
        }
    }
}
