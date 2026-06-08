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
 * Queries multiple sources including Open Library and local catalog.
 */
public class BarcodeService {

    private static final int TIMEOUT_MS = 5000;
    private static final String USER_AGENT = "Amadeus-MediaCollector/1.0";

    /**
     * Search for media item by barcode (ISBN, UPC, EAN)
     * Returns metadata from various sources
     */
    public static JSONObject searchByBarcode(String barcode) {
        JSONObject result = new JSONObject();
        
        if (barcode == null || barcode.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "Barcode cannot be empty");
            return result;
        }

        // Clean up the barcode: remove hyphens, spaces, and other common formatting
        barcode = barcode.trim()
            .replaceAll("-", "")      // Remove hyphens
            .replaceAll(" ", "")      // Remove spaces
            .replaceAll("_", "")      // Remove underscores
            .replaceAll("\\.", "");   // Remove dots

        System.out.println("[BarcodeService] Cleaned barcode: " + barcode);

        // Try ISBN lookup first (for books)
        if (barcode.length() == 10 || barcode.length() == 13) {
            JSONObject isbnResult = lookupISBN(barcode);
            if (isbnResult != null && isbnResult.optBoolean("success", false)) {
                return isbnResult;
            }
        }

        // Try Open Food Facts for media with barcodes
        JSONObject foodFactsResult = lookupOpenFoodFacts(barcode);
        if (foodFactsResult != null && foodFactsResult.optBoolean("success", false)) {
            return foodFactsResult;
        }

        // Try MusicBrainz for music CDs/Vinyl
        JSONObject musicBrainzResult = lookupMusicBrainz(barcode);
        if (musicBrainzResult != null && musicBrainzResult.optBoolean("success", false)) {
            return musicBrainzResult;
        }

        // Check local catalog
        JSONObject localResult = lookupLocalCatalog(barcode);
        if (localResult != null && localResult.optBoolean("success", false)) {
            return localResult;
        }

        // No match found
        result.put("success", false);
        result.put("message", "No item found for barcode: " + barcode);
        result.put("barcode", barcode);
        return result;
    }

    /**
     * Lookup book by ISBN using Open Library API
     */
    private static JSONObject lookupISBN(String isbn) {
        try {
            // Remove hyphens from ISBN
            isbn = isbn.replaceAll("-", "");
            
            String apiUrl = "https://openlibrary.org/api/books?bibkeys=ISBN:" + isbn + "&jscmd=data&format=json";
            System.out.println("[BarcodeService] Looking up ISBN: " + isbn);
            System.out.println("[BarcodeService] URL: " + apiUrl);
            
            JSONObject apiResponse = fetchJSON(apiUrl);
            System.out.println("[BarcodeService] API Response: " + (apiResponse == null ? "null" : "received"));
            
            if (apiResponse == null || apiResponse.length() == 0) {
                System.out.println("[BarcodeService] ISBN lookup returned no results");
                return null;
            }

            String key = "ISBN:" + isbn;
            if (!apiResponse.has(key)) {
                System.out.println("[BarcodeService] Key '" + key + "' not found in response");
                return null;
            }

            JSONObject bookData = apiResponse.getJSONObject(key);
            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("source", "isbn");
            result.put("barcode", isbn);

            // Extract title
            if (bookData.has("title")) {
                result.put("title", bookData.getString("title"));
            }

            // Extract author(s)
            if (bookData.has("authors") && bookData.getJSONArray("authors").length() > 0) {
                JSONObject firstAuthor = bookData.getJSONArray("authors").getJSONObject(0);
                if (firstAuthor.has("name")) {
                    result.put("artist", firstAuthor.getString("name"));
                    result.put("mediaType", "Book");
                }
            }

            // Extract publish date
            if (bookData.has("publish_date")) {
                String pubDate = bookData.getString("publish_date");
                // Try to extract year
                try {
                    int year = Integer.parseInt(pubDate.split(",")[0].trim());
                    result.put("year", year);
                } catch (Exception e) {
                    // Ignore parsing errors
                }
            }

            // Extract cover URL
            if (bookData.has("cover") && bookData.getJSONObject("cover").has("medium")) {
                result.put("coverUrl", bookData.getJSONObject("cover").getString("medium"));
            }

            // Extract publisher
            if (bookData.has("publishers") && bookData.getJSONArray("publishers").length() > 0) {
                Object pubObj = bookData.getJSONArray("publishers").get(0);
                if (pubObj instanceof String) {
                    result.put("publisher", (String) pubObj);
                } else if (pubObj instanceof JSONObject) {
                    JSONObject pubJsonObj = (JSONObject) pubObj;
                    if (pubJsonObj.has("name")) {
                        result.put("publisher", pubJsonObj.getString("name"));
                    }
                }
            }

            // Extract number of pages
            if (bookData.has("number_of_pages")) {
                result.put("pages", bookData.getInt("number_of_pages"));
            }

            result.put("format", "Hardcover");
            System.out.println("[BarcodeService] Successfully found book: " + result.optString("title"));
            return result;

        } catch (Exception e) {
            // Log error but don't fail - try next source
            System.err.println("[BarcodeService] ISBN lookup error: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Lookup product by barcode using Open Food Facts API
     * (Useful for media with barcodes like CDs, DVDs, games)
     */
    private static JSONObject lookupOpenFoodFacts(String barcode) {
        try {
            String apiUrl = "https://world.openfoodfacts.org/api/v0/product/" + barcode + ".json";
            
            JSONObject apiResponse = fetchJSON(apiUrl);
            if (apiResponse == null) {
                return null;
            }

            int status = apiResponse.optInt("status", 0);
            if (status != 1) {
                // Product not found
                return null;
            }

            JSONObject product = apiResponse.optJSONObject("product");
            if (product == null) {
                return null;
            }

            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("source", "openfoodfacts");
            result.put("barcode", barcode);

            // Extract name as title
            if (product.has("product_name")) {
                result.put("title", product.getString("product_name"));
            }

            // Extract brand as artist
            if (product.has("brands")) {
                result.put("artist", product.getString("brands"));
            }

            // Try to detect media type from product info
            String productName = product.optString("product_name", "").toLowerCase();
            String categories = product.optString("categories", "").toLowerCase();
            
            String detectedType = detectMediaType(productName + " " + categories);
            if (detectedType != null) {
                result.put("mediaType", detectedType);
            } else {
                result.put("mediaType", "Other");
            }

            // Extract image URL
            if (product.has("image_url")) {
                result.put("coverUrl", product.getString("image_url"));
            }

            return result;

        } catch (Exception e) {
            // Log error but don't fail - try next source
            return null;
        }
    }

    /**
     * Lookup in local media catalog
     */
    private static JSONObject lookupLocalCatalog(String barcode) {
        try {
            JSONArray searchResults = MediaStore.search(barcode);
            if (searchResults.length() > 0) {
                JSONObject result = new JSONObject();
                result.put("success", true);
                result.put("source", "local");
                result.put("barcode", barcode);

                // Return first matching item
                JSONObject item = searchResults.getJSONObject(0);
                result.put("title", item.optString("title", ""));
                result.put("artist", item.optString("artist", ""));
                result.put("mediaType", item.optString("mediaType", ""));
                result.put("year", item.optInt("year", 0));
                result.put("coverUrl", item.optString("coverUrl", ""));
                
                return result;
            }
        } catch (Exception e) {
            // Ignore errors
        }
        return null;
    }

    /**
     * Lookup music/media by barcode using MusicBrainz API
     * (Good for CDs, Vinyl, and other music media)
     */
    private static JSONObject lookupMusicBrainz(String barcode) {
        try {
            // Try to lookup by EAN/barcode
            String apiUrl = "https://musicbrainz.org/ws/2/release?query=barcode:" + barcode + "&fmt=json&limit=1";
            System.out.println("[BarcodeService] Looking up barcode with MusicBrainz: " + barcode);
            
            JSONObject apiResponse = fetchJSON(apiUrl);
            if (apiResponse == null) {
                return null;
            }

            JSONArray releases = apiResponse.optJSONArray("releases");
            if (releases == null || releases.length() == 0) {
                System.out.println("[BarcodeService] MusicBrainz: No releases found");
                return null;
            }

            JSONObject release = releases.getJSONObject(0);
            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("source", "musicbrainz");
            result.put("barcode", barcode);

            // Extract title
            if (release.has("title")) {
                result.put("title", release.getString("title"));
            }

            // Extract artist/album artist
            if (release.has("artist-credit") && release.getJSONArray("artist-credit").length() > 0) {
                JSONObject artistCredit = release.getJSONArray("artist-credit").getJSONObject(0);
                if (artistCredit.has("artist")) {
                    JSONObject artist = artistCredit.getJSONObject("artist");
                    if (artist.has("name")) {
                        result.put("artist", artist.getString("name"));
                    }
                }
            }

            // Extract date
            if (release.has("date")) {
                String date = release.getString("date");
                try {
                    int year = Integer.parseInt(date.substring(0, 4));
                    result.put("year", year);
                } catch (Exception e) {
                    // Ignore parsing errors
                }
            }

            // Detect media type from release format
            if (release.has("media") && release.getJSONArray("media").length() > 0) {
                JSONObject media = release.getJSONArray("media").getJSONObject(0);
                if (media.has("format")) {
                    String format = media.getString("format");
                    String detectedType = detectMediaTypeFromFormat(format);
                    if (detectedType != null) {
                        result.put("mediaType", detectedType);
                        result.put("format", format);
                    }
                }
            }

            if (!result.has("mediaType")) {
                result.put("mediaType", "CD");
            }

            System.out.println("[BarcodeService] Successfully found via MusicBrainz: " + result.optString("title"));
            return result;

        } catch (Exception e) {
            System.err.println("[BarcodeService] MusicBrainz lookup error: " + e.getMessage());
            return null;
        }
    }

    /**
     * Helper method to detect media type from MusicBrainz format string
     */
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

    /**
     * Helper method to detect media type from description
     */
    private static String detectMediaType(String description) {
        description = description.toLowerCase();
        
        if (description.contains("cd") || description.contains("audio cd")) {
            return "CD";
        } else if (description.contains("dvd")) {
            return "DVD";
        } else if (description.contains("blu-ray") || description.contains("bluray")) {
            return "Blu-ray";
        } else if (description.contains("vinyl") || description.contains("record")) {
            return "Vinyl";
        } else if (description.contains("cassette")) {
            return "Cassette";
        } else if (description.contains("book")) {
            return "Book";
        } else if (description.contains("game") || description.contains("video game")) {
            return "Video Game";
        }
        
        return null;
    }

    /**
     * Fetch JSON from a URL with timeout
     */
    private static JSONObject fetchJSON(String urlString) {
        try {
            URL url = URI.create(urlString).toURL();
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("User-Agent", USER_AGENT);
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);

            int responseCode = connection.getResponseCode();
            if (responseCode != 200) {
                System.err.println("[BarcodeService] API returned status " + responseCode + " for URL: " + urlString);
                return null;
            }

            BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
            );
            
            StringBuilder jsonString = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                jsonString.append(line);
            }
            reader.close();

            return new JSONObject(jsonString.toString());

        } catch (Exception e) {
            // Network or JSON parsing error
            System.err.println("[BarcodeService] Error fetching from URL: " + urlString);
            System.err.println("[BarcodeService] Exception: " + e.getClass().getName() + " - " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
}
