package org.amadeus.amadeusserver;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * BarcodeService provides barcode lookup functionality for media items.
 * Queries multiple sources including local database, offline Discogs dump, and online APIs.
 */
public class BarcodeService {

    // Increased timeout to 7.5 seconds as requested for deeper searching
    private static final int TIMEOUT_MS = 7500; 
    private static final String USER_AGENT = "Amadeus-MediaCollector/1.0";

    /**
     * Search for media item by barcode (ISBN, UPC, EAN)
     * Returns metadata from various sources, prioritizing local/offline sources for speed.
     */
    public static JSONObject searchByBarcode(String barcode) {
        JSONObject result = new JSONObject();
        
        if (barcode == null || barcode.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "Barcode cannot be empty");
            return result;
        }

        // Clean up the barcode
        barcode = barcode.trim()
            .replaceAll("-", "")
            .replaceAll(" ", "")
            .replaceAll("_", "")
            .replaceAll("\\.", "");

        System.out.println("[BarcodeService] Searching for barcode: " + barcode);

        // 1. Check local catalog first (Instant - Indexed SQLite)
        // If the user already has it, we don't need the network.
        JSONObject localResult = lookupLocalCatalog(barcode);
        if (localResult != null && localResult.optBoolean("success", false)) {
            System.out.println("[BarcodeService] Found in local catalog");
            return localResult;
        }

        // 2. Try the locally imported Discogs full release dump (Fast - Local SQLite)
        // This covers millions of music items without network lag.
        JSONObject discogsResult = DiscogsStore.lookupByBarcode(barcode);
        if (discogsResult != null && discogsResult.optBoolean("success", false)) {
            System.out.println("[BarcodeService] Found in local Discogs store");
            return discogsResult;
        }

        // 3. Try ISBN lookup (Network - Open Library)
        // Only run for barcodes that look like ISBNs (10 or 13 digits)
        if (barcode.length() == 10 || barcode.length() == 13) {
            JSONObject isbnResult = lookupISBN(barcode);
            if (isbnResult != null && isbnResult.optBoolean("success", false)) {
                return isbnResult;
            }
        }

        // 4. Try MusicBrainz (Network)
        JSONObject musicBrainzResult = lookupMusicBrainz(barcode);
        if (musicBrainzResult != null && musicBrainzResult.optBoolean("success", false)) {
            return musicBrainzResult;
        }

        // 5. Try Open Food Facts (Network - Catch-all for other products)
        JSONObject foodFactsResult = lookupOpenFoodFacts(barcode);
        if (foodFactsResult != null && foodFactsResult.optBoolean("success", false)) {
            return foodFactsResult;
        }

        // No match found
        result.put("success", false);
        result.put("message", "No item found for barcode: " + barcode);
        result.put("barcode", barcode);
        return result;
    }

    private static JSONObject lookupISBN(String isbn) {
        try {
            String apiUrl = "https://openlibrary.org/api/books?bibkeys=ISBN:" + isbn + "&jscmd=data&format=json";
            JSONObject apiResponse = fetchJSON(apiUrl);
            
            if (apiResponse == null || apiResponse.length() == 0) return null;

            String key = "ISBN:" + isbn;
            if (!apiResponse.has(key)) return null;

            JSONObject bookData = apiResponse.getJSONObject(key);
            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("source", "isbn");
            result.put("barcode", isbn);

            if (bookData.has("title")) result.put("title", bookData.getString("title"));

            if (bookData.has("authors") && bookData.getJSONArray("authors").length() > 0) {
                JSONObject firstAuthor = bookData.getJSONArray("authors").getJSONObject(0);
                if (firstAuthor.has("name")) {
                    result.put("artist", firstAuthor.getString("name"));
                    result.put("mediaType", "Book");
                }
            }

            if (bookData.has("publish_date")) {
                String pubDate = bookData.getString("publish_date");
                try {
                    int year = Integer.parseInt(pubDate.split(",")[0].trim().replaceAll("[^0-9]", ""));
                    result.put("year", year);
                } catch (Exception e) {}
            }

            if (bookData.has("cover") && bookData.getJSONObject("cover").has("medium")) {
                result.put("coverUrl", bookData.getJSONObject("cover").getString("medium"));
            }

            result.put("format", "Hardcover");
            return result;
        } catch (Exception e) {
            return null;
        }
    }

    private static JSONObject lookupOpenFoodFacts(String barcode) {
        try {
            String apiUrl = "https://world.openfoodfacts.org/api/v0/product/" + barcode + ".json";
            JSONObject apiResponse = fetchJSON(apiUrl);
            if (apiResponse == null || apiResponse.optInt("status", 0) != 1) return null;

            JSONObject product = apiResponse.optJSONObject("product");
            if (product == null) return null;

            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("source", "openfoodfacts");
            result.put("barcode", barcode);

            if (product.has("product_name")) result.put("title", product.getString("product_name"));
            if (product.has("brands")) result.put("artist", product.getString("brands"));

            String productName = product.optString("product_name", "").toLowerCase();
            String categories = product.optString("categories", "").toLowerCase();
            String detectedType = detectMediaType(productName + " " + categories);
            result.put("mediaType", detectedType != null ? detectedType : "Other");

            if (product.has("image_url")) result.put("coverUrl", product.getString("image_url"));

            return result;
        } catch (Exception e) {
            return null;
        }
    }

    private static JSONObject lookupLocalCatalog(String barcode) {
        try {
            // Using direct lookup instead of general search for speed
            JSONObject result = MediaStore.lookupByBarcode(barcode);
            if (result != null && result.optBoolean("success", false)) {
                return result;
            }
        } catch (Exception e) {
            // Fallback to search if direct lookup isn't available
            try {
                JSONArray searchResults = MediaStore.search(barcode);
                if (searchResults.length() > 0) {
                    JSONObject item = searchResults.getJSONObject(0);
                    item.put("success", true);
                    item.put("source", "local");
                    return item;
                }
            } catch (Exception e2) {}
        }
        return null;
    }

    private static JSONObject lookupMusicBrainz(String barcode) {
        try {
            String apiUrl = "https://musicbrainz.org/ws/2/release?query=barcode:" + barcode + "&fmt=json&limit=1";
            JSONObject apiResponse = fetchJSON(apiUrl);
            if (apiResponse == null) return null;

            JSONArray releases = apiResponse.optJSONArray("releases");
            if (releases == null || releases.length() == 0) return null;

            JSONObject release = releases.getJSONObject(0);
            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("source", "musicbrainz");
            result.put("barcode", barcode);

            if (release.has("title")) result.put("title", release.getString("title"));

            if (release.has("artist-credit") && release.getJSONArray("artist-credit").length() > 0) {
                JSONObject artistCredit = release.getJSONArray("artist-credit").getJSONObject(0);
                if (artistCredit.has("artist") && artistCredit.getJSONObject("artist").has("name")) {
                    result.put("artist", artistCredit.getJSONObject("artist").getString("name"));
                }
            }

            if (release.has("date")) {
                try { result.put("year", Integer.parseInt(release.getString("date").substring(0, 4))); } catch (Exception e) {}
            }

            if (release.has("media") && release.getJSONArray("media").length() > 0) {
                String format = release.getJSONArray("media").getJSONObject(0).optString("format", "");
                String detectedType = detectMediaTypeFromFormat(format);
                if (detectedType != null) result.put("mediaType", detectedType);
            }

            if (!result.has("mediaType")) result.put("mediaType", "CD");
            return result;
        } catch (Exception e) {
            return null;
        }
    }

    private static String detectMediaTypeFromFormat(String format) {
        if (format == null) return null;
        format = format.toLowerCase();
        if (format.contains("cd")) return "CD";
        if (format.contains("vinyl") || format.contains("lp")) return "Vinyl";
        if (format.contains("cassette") || format.contains("tape")) return "Cassette";
        if (format.contains("dvd")) return "DVD";
        if (format.contains("blu-ray") || format.contains("bluray")) return "Blu-ray";
        return null;
    }

    private static String detectMediaType(String description) {
        description = description.toLowerCase();
        if (description.contains("cd") || description.contains("audio cd")) return "CD";
        if (description.contains("dvd")) return "DVD";
        if (description.contains("blu-ray") || description.contains("bluray")) return "Blu-ray";
        if (description.contains("vinyl") || description.contains("record")) return "Vinyl";
        if (description.contains("cassette")) return "Cassette";
        if (description.contains("book")) return "Book";
        if (description.contains("game") || description.contains("video game")) return "Video Game";
        return null;
    }

    private static JSONObject fetchJSON(String urlString) {
        try {
            URL url = URI.create(urlString).toURL();
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("User-Agent", USER_AGENT);
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);

            if (connection.getResponseCode() != 200) return null;

            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder jsonString = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) jsonString.append(line);
            reader.close();

            return new JSONObject(jsonString.toString());
        } catch (Exception e) {
            return null;
        }
    }
}
