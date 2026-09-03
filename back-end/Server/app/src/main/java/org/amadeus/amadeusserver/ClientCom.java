package org.amadeus.amadeusserver;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import com.sun.net.httpserver.HttpExchange;

public class ClientCom {

    public static String processQuery(String query, String valueName) {
        String value = null;

        if (query != null) {
            query = "&" + query;

            if (query.contains("&" + valueName + "=")) {
                value = query.substring(query.indexOf("&" + valueName + "=") + valueName.length() + 2);
                value = value.split("&")[0];
            }
        }
        return value;
    }

    public static String[][] processAllQuery(String query) {
        String[] querySplitTemp = query.split("&");
        String[][] parsedQuery = new String[querySplitTemp.length][2];
        for (int i = 0; i < querySplitTemp.length; i++) {
            parsedQuery[i] = querySplitTemp[i].split("=");
        }
        return parsedQuery;
    }
    
    public static void sendJsonResponse(HttpExchange exchange, int statusCode, JSONObject response) throws IOException {
        String responseString = response.toString();
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, responseString.getBytes().length);
        exchange.getResponseBody().write(responseString.getBytes());
        exchange.close();
    }
    
    public static void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        JSONObject error = new JSONObject();
        error.put("message", message);
        sendJsonResponse(exchange, statusCode, error);
    }
    
    public static JSONObject readJsonBody(HttpExchange exchange) throws IOException {
        InputStream body = exchange.getRequestBody();
        String text = new String(body.readAllBytes(), StandardCharsets.UTF_8);
        return new JSONObject(text);
    }
    
    // Template: Handle endpoint with required parameter validation
    public static void handleRequiredParameterEndpoint(HttpExchange exchange, String paramName, String successMessageTemplate, String errorMessage) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        JSONObject jsonResponse = new JSONObject();
        
        if (query != null && query.contains(paramName + "=") && query.length() > paramName.length() + 1) {
            String paramValue = processQuery(query, paramName);
            jsonResponse.put("message", successMessageTemplate.replace("{value}", paramValue));
            sendJsonResponse(exchange, 200, jsonResponse);
        } else {
            jsonResponse.put("message", errorMessage);
            sendJsonResponse(exchange, 400, jsonResponse);
        }
    }
    
    // Template: Handle endpoint that returns all query parameters
    public static void handleAllParametersEndpoint(HttpExchange exchange) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        JSONObject jsonResponse = new JSONObject();
        
        if (query != null) {
            String[][] allQueryParams = processAllQuery(query);
            for (String[] param : allQueryParams) {
                jsonResponse.put(param[0], param[1]);
            }
            sendJsonResponse(exchange, 200, jsonResponse);
        } else {
            jsonResponse.put("message", "No query parameters provided");
            sendJsonResponse(exchange, 400, jsonResponse);
        }
    }
    
    // Specific endpoint implementation using template
    public static void handleHelloRequest(HttpExchange exchange) throws IOException {
        handleRequiredParameterEndpoint(exchange, "name", "Hello {value}!", "No name provided");
    }
    
    // Specific endpoint implementation using template
    public static void handleReturnRequest(HttpExchange exchange) throws IOException {
        handleAllParametersEndpoint(exchange);
    }

    public static void handleCatalogSearchRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String query = processQuery(exchange.getRequestURI().getQuery(), "q");
        if (query == null || query.isBlank()) {
            sendError(exchange, 400, "Missing q parameter");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("query", query);
        response.put("items", MediaStore.search(query));
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleCollectionCategoryCreateRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String name = requestJson.optString("name", "");
        String kind = requestJson.optString("kind", "media");
        if (name.isBlank()) {
            sendError(exchange, 400, "Missing category name");
            return;
        }

        JSONObject category = CatalogSchemaStore.createCategory(name, kind, requestJson);
        sendJsonResponse(exchange, 201, new JSONObject().put("message", "Category created").put("category", category));
    }

    public static void handleCollectionCategoryListRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        sendJsonResponse(exchange, 200, new JSONObject().put("categories", CatalogSchemaStore.listCategories()));
    }

    public static void handleCatalogItemCreateRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        if (requestJson.optString("title", "").isBlank()) {
            sendError(exchange, 400, "Missing title");
            return;
        }

        JSONObject item = CatalogSchemaStore.createCatalogItem(requestJson);
        sendJsonResponse(exchange, 201, new JSONObject().put("message", "Catalog item created").put("item", item));
    }

    public static void handleUserCollectionListRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String userId = processQuery(exchange.getRequestURI().getQuery(), "userId");
        if (userId == null || userId.isBlank()) {
            sendError(exchange, 400, "Missing userId parameter");
            return;
        }

        sendJsonResponse(exchange, 200, new JSONObject().put("userId", userId)
                .put("collections", CatalogSchemaStore.listUserCollections(userId)));
    }

    public static void handleUserCollectionVisibilityRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String entryId = requestJson.optString("entryId", "");
        String visibility = requestJson.optString("visibility", "private");
        if (entryId.isBlank()) {
            sendError(exchange, 400, "Missing entryId");
            return;
        }

        JSONObject result = CatalogSchemaStore.updateCollectionVisibility(entryId, visibility);
        sendJsonResponse(exchange, 200, new JSONObject().put("message", "Visibility updated").put("entry", result));
    }

    public static void handleCollectionAddRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        try {
            String userId = requestJson.optString("userId", "");
            String title = requestJson.optString("title", "");
            if (userId.isBlank() || title.isBlank()) {
                sendError(exchange, 400, "Missing userId or title");
                return;
            }

            System.out.println("[CollectionAdd] Adding item: " + title + " for user: " + userId);
            
            JSONObject item = MediaStore.addItem(requestJson);
            System.out.println("[CollectionAdd] Item created with ID: " + item.optString("id"));
            
            MediaStore.addToCollection(userId, item.getString("id"), requestJson.optJSONObject("collection") != null
                    ? requestJson.getJSONObject("collection")
                    : new JSONObject());
            
            System.out.println("[CollectionAdd] Item added to collection successfully");

            JSONObject response = new JSONObject();
            response.put("message", "Item added to collection");
            response.put("item", item);
            sendJsonResponse(exchange, 201, response);
        } catch (Exception e) {
            System.err.println("[CollectionAdd] Error adding item: " + e.getMessage());
            e.printStackTrace();
            sendError(exchange, 500, "Error adding item: " + e.getMessage());
        }
    }

    public static void handleCollectionListRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String userId = processQuery(exchange.getRequestURI().getQuery(), "userId");
        if (userId == null || userId.isBlank()) {
            sendError(exchange, 400, "Missing userId parameter");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("userId", userId);
        response.put("items", MediaStore.listCollection(userId));
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleCollectionUpdateRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        try {
            String itemId = requestJson.optString("itemId", "");
            String userId = requestJson.optString("userId", "");
            
            if (itemId.isBlank() || userId.isBlank()) {
                sendError(exchange, 400, "Missing itemId or userId");
                return;
            }

            System.out.println("[CollectionUpdate] Updating item: " + itemId + " for user: " + userId);
            
            JSONObject updatedItem = MediaStore.updateItem(itemId, requestJson);
            System.out.println("[CollectionUpdate] Item updated successfully");

            JSONObject response = new JSONObject();
            response.put("message", "Item updated successfully");
            response.put("item", updatedItem);
            sendJsonResponse(exchange, 200, response);
        } catch (Exception e) {
            System.err.println("[CollectionUpdate] Error updating item: " + e.getMessage());
            e.printStackTrace();
            sendError(exchange, 500, "Error updating item: " + e.getMessage());
        }
    }

    public static void handleCollectionDeleteRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        try {
            String itemId = requestJson.optString("itemId", "");
            String userId = requestJson.optString("userId", "");
            
            if (itemId.isBlank() || userId.isBlank()) {
                sendError(exchange, 400, "Missing itemId or userId");
                return;
            }

            System.out.println("[CollectionDelete] Deleting item: " + itemId + " for user: " + userId);
            
            MediaStore.deleteFromCollection(userId, itemId);
            System.out.println("[CollectionDelete] Item deleted successfully");

            JSONObject response = new JSONObject();
            response.put("message", "Item deleted from collection");
            sendJsonResponse(exchange, 200, response);
        } catch (Exception e) {
            System.err.println("[CollectionDelete] Error deleting item: " + e.getMessage());
            e.printStackTrace();
            sendError(exchange, 500, "Error deleting item: " + e.getMessage());
        }
    }

    public static void handleFriendsAddRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String userId = requestJson.optString("userId", "");
        String friendId = requestJson.optString("friendId", "");
        String friendUsername = requestJson.optString("friendUsername", "");

        if (userId.isBlank()) {
            sendError(exchange, 400, "Missing userId");
            return;
        }

        if (friendId.isBlank() && !friendUsername.isBlank()) {
            JSONObject friend = UserStore.findByUsernameOrEmail(friendUsername, friendUsername);
            if (friend != null) {
                friendId = friend.getString("id");
            } else {
                sendError(exchange, 404, "User not found");
                return;
            }
        }

        if (friendId.isBlank()) {
            sendError(exchange, 400, "Missing friendId or friendUsername");
            return;
        }

        if (userId.equals(friendId)) {
            sendError(exchange, 400, "You cannot add yourself as a friend");
            return;
        }

        try {
            JSONObject result = FriendsStore.addFriend(userId, friendId);
            sendJsonResponse(exchange, 201, new JSONObject().put("message", "Friend added successfully").put("friend", result));
        } catch (Exception e) {
            sendError(exchange, 400, e.getMessage());
        }
    }

    public static void handleFriendsListRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String userId = processQuery(exchange.getRequestURI().getQuery(), "userId");
        if (userId == null || userId.isBlank()) {
            sendError(exchange, 400, "Missing userId parameter");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("userId", userId);
        response.put("friends", FriendsStore.listFriends(userId));
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleFriendsCollectionsRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String userId = processQuery(exchange.getRequestURI().getQuery(), "userId");
        if (userId == null || userId.isBlank()) {
            sendError(exchange, 400, "Missing userId parameter");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("userId", userId);
        response.put("items", FriendsStore.getFriendsCollections(userId));
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleFriendCollectionRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String userId = processQuery(exchange.getRequestURI().getQuery(), "userId");
        String friendId = processQuery(exchange.getRequestURI().getQuery(), "friendId");

        if (userId == null || friendId == null) {
            sendError(exchange, 400, "Missing userId or friendId parameter");
            return;
        }

        if (!FriendsStore.isFriend(userId, friendId)) {
            sendError(exchange, 403, "You are not friends with this user");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("friendId", friendId);
        response.put("items", MediaStore.listPublicCollection(friendId));
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleMarketplaceCreateListingRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        if (requestJson.optString("sellerId", "").isBlank() || requestJson.optString("itemId", "").isBlank()) {
            sendError(exchange, 400, "Missing sellerId or itemId");
            return;
        }

        JSONObject listing = MarketplaceStore.createListing(requestJson);
        sendJsonResponse(exchange, 201, new JSONObject().put("message", "Listing created").put("listing", listing));
    }

    public static void handleMarketplaceListRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String sellerId = processQuery(exchange.getRequestURI().getQuery(), "sellerId");
        if (sellerId == null || sellerId.isBlank()) {
            sendError(exchange, 400, "Missing sellerId parameter");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("sellerId", sellerId);
        response.put("listings", MarketplaceStore.listListings(sellerId));
        sendJsonResponse(exchange, 200, response);
    }
    
    public static void handleMarketplaceActiveListingsRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("listings", MarketplaceStore.listAllActiveListings());
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleMarketplaceSaleRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        if (requestJson.optString("listingId", "").isBlank()) {
            sendError(exchange, 400, "Missing listingId");
            return;
        }

        JSONObject sale = MarketplaceStore.completeSale(requestJson);
        sendJsonResponse(exchange, 201, new JSONObject().put("message", "Sale completed").put("sale", sale));
    }

    public static void handleAuthCreateSessionRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String userId = requestJson.optString("userId", "");
        if (userId.isBlank()) {
            sendError(exchange, 400, "Missing userId");
            return;
        }

        JSONObject session = AuthStore.createSession(userId);
        sendJsonResponse(exchange, 201, new JSONObject().put("message", "Session created").put("session", session));
    }

    public static void handleAuthRefreshRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String refreshToken = requestJson.optString("refreshToken", "");
        if (refreshToken.isBlank()) {
            sendError(exchange, 400, "Missing refreshToken");
            return;
        }

        JSONObject session = AuthStore.refreshSession(refreshToken);
        if (session == null) {
            sendError(exchange, 401, "Invalid refresh token");
            return;
        }

        sendJsonResponse(exchange, 200, new JSONObject().put("message", "Token refreshed").put("session", session));
    }

    public static void handleCatalogScanRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String base64Image = requestJson.optString("imageBase64", "");
        String textHint = requestJson.optString("textHint", "");
        if (base64Image.isBlank()) {
            sendError(exchange, 400, "Missing imageBase64");
            return;
        }

        JSONObject analysis = ImageMatchService.analyze(base64Image, textHint);
        sendJsonResponse(exchange, 200, analysis);
    }

    public static void handleBarcodeSearchRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String barcode = requestJson.optString("barcode", "").trim();
        if (barcode.isBlank()) {
            sendError(exchange, 400, "Missing barcode");
            return;
        }

        JSONObject result = BarcodeService.searchByBarcode(barcode);
        
        // Return 200 even if not found, but include success flag
        int statusCode = result.optBoolean("success", false) ? 200 : 404;
        sendJsonResponse(exchange, statusCode, result);
    }

    public static void handleUserLoginRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String username = requestJson.optString("username", null);
        String email = requestJson.optString("email", null);
        String password = requestJson.optString("password", null);

        if ((username == null || username.isBlank()) && (email == null || email.isBlank())) {
            sendError(exchange, 400, "Missing username or email");
            return;
        }
        if (password == null || password.isBlank()) {
            sendError(exchange, 400, "Missing password");
            return;
        }

        JSONObject user = UserStore.findByUsernameOrEmail(username, email);

        if (user == null) {
            sendError(exchange, 401, "Invalid username or password");
            return;
        }

        String storedHash = user.optString("passwordHash", "");
        String storedSalt = user.optString("passwordSalt", "");

        if (PasswordHash.verifyPassword(password, storedSalt, storedHash)) {
            JSONObject responseUser = new JSONObject();
            responseUser.put("id", user.optString("id"));
            responseUser.put("username", user.optString("username"));
            responseUser.put("email", user.optString("email"));

            JSONObject response = new JSONObject();
            response.put("message", "Login successful");
            response.put("user", responseUser);
            sendJsonResponse(exchange, 200, response);
        } else {
            sendError(exchange, 401, "Invalid username or password");
        }
    }

    public static void handleUserCreateRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        // TODO: validate user fields here
        String username = requestJson.optString("username", null);
        String email = requestJson.optString("email", null);
        String password = requestJson.optString("password", null);

        
        if (username == null || username.isBlank()) {
            sendError(exchange, 400, "Missing username");
            return;
        }
        if (email == null || email.isBlank()) {
            sendError(exchange, 400, "Missing email");
            return;
        }
        if (password == null || password.isBlank()) {
            sendError(exchange, 400, "Missing password");
            return;
        }

        String passwordSalt = PasswordHash.generateSalt();
        String passwordHash = PasswordHash.hashPassword(password, passwordSalt);

        JSONObject createdUser = new JSONObject();
        createdUser.put("username", username);

        if (UserStore.usernameExists(username)) {
            sendError(exchange, 400, "Username already in use");
            return;
        }

        createdUser.put("email", email);
        createdUser.put("passwordHash", passwordHash);
        createdUser.put("passwordSalt", passwordSalt);

        // Generate a unique ID for the user
        while (true) {
            String newId = UUID.randomUUID().toString();
            if (UserStore.findById(newId) == null) {
                createdUser.put("id", newId);
                break;
            }
        }

        UserStore.createUser(createdUser);

        JSONObject responseUser = new JSONObject();
        responseUser.put("id", createdUser.optString("id"));
        responseUser.put("username", createdUser.optString("username"));
        responseUser.put("email", createdUser.optString("email"));

        JSONObject response = new JSONObject();
        response.put("message", "User created");
        response.put("user", responseUser);
        sendJsonResponse(exchange, 201, response);
    }

    // ===== Discogs Data Handlers =====

    public static void handleDiscogsSearchRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String query = processQuery(exchange.getRequestURI().getQuery(), "q");
        if (query == null || query.isBlank()) {
            sendError(exchange, 400, "Missing q parameter");
            return;
        }

        String limitStr = processQuery(exchange.getRequestURI().getQuery(), "limit");
        int limit = 25;
        try { if (limitStr != null) limit = Integer.parseInt(limitStr); } catch (NumberFormatException ignored) {}

        // URL-decode the query
        query = java.net.URLDecoder.decode(query, java.nio.charset.StandardCharsets.UTF_8);

        JSONObject response = new JSONObject();
        response.put("query", query);
        response.put("results", DiscogsStore.search(query, limit));
        response.put("source", "discogs");
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleDiscogsStatusRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("available", DiscogsStore.isAvailable());
        response.put("recordCount", DiscogsStore.getRecordCount());
        response.put("importStatus", DiscogsImporter.getImportStatus());
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleDiscogsImportRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject result = DiscogsImporter.startImport();
        sendJsonResponse(exchange, 202, result);
    }

    public static void handleDiscogsRebuildFtsRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject result = DiscogsImporter.startRebuildFts();
        sendJsonResponse(exchange, 202, result);
    }

    public static void handleDiscogsReleaseRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String idStr = processQuery(exchange.getRequestURI().getQuery(), "id");
        if (idStr == null || idStr.isBlank()) {
            sendError(exchange, 400, "Missing id parameter");
            return;
        }

        int discogsId;
        try {
            discogsId = Integer.parseInt(idStr);
        } catch (NumberFormatException e) {
            sendError(exchange, 400, "Invalid id parameter");
            return;
        }

        JSONObject release = DiscogsStore.getById(discogsId);
        if (release == null) {
            sendError(exchange, 404, "Release not found");
            return;
        }

        sendJsonResponse(exchange, 200, new JSONObject().put("release", release));
    }

    public static void handleDiscogsRelatedRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String masterIdStr = processQuery(exchange.getRequestURI().getQuery(), "masterId");
        if (masterIdStr == null || masterIdStr.isBlank()) {
            sendError(exchange, 400, "Missing masterId parameter");
            return;
        }

        int masterId;
        try {
            masterId = Integer.parseInt(masterIdStr);
        } catch (NumberFormatException e) {
            sendError(exchange, 400, "Invalid masterId parameter");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("masterId", masterId);
        response.put("releases", DiscogsStore.getRelatedReleases(masterId, 50));
        sendJsonResponse(exchange, 200, response);
    }

    // ===== Additional Marketplace Handlers =====

    public static void handleMarketplaceCancelRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String listingId = requestJson.optString("listingId", "");
        String sellerId = requestJson.optString("sellerId", "");

        if (listingId.isBlank() || sellerId.isBlank()) {
            sendError(exchange, 400, "Missing listingId or sellerId");
            return;
        }

        try {
            JSONObject result = MarketplaceStore.cancelListing(listingId, sellerId);
            sendJsonResponse(exchange, 200, new JSONObject().put("message", "Listing cancelled").put("listing", result));
        } catch (RuntimeException e) {
            sendError(exchange, 400, e.getMessage());
        }
    }

    public static void handleMarketplaceUserListingsRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String userId = processQuery(exchange.getRequestURI().getQuery(), "userId");
        if (userId == null || userId.isBlank()) {
            sendError(exchange, 400, "Missing userId parameter");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("userId", userId);
        response.put("listings", MarketplaceStore.getListingsWithDetails(userId));
        sendJsonResponse(exchange, 200, response);
    }

    // ===== Explore & Discovery Handlers =====

    public static void handleDiscogsExploreRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String queryStr = exchange.getRequestURI().getQuery();
        String q = processQuery(queryStr, "q");
        String artist = processQuery(queryStr, "artist");
        String genre = processQuery(queryStr, "genre");
        String format = processQuery(queryStr, "format");
        String country = processQuery(queryStr, "country");
        int yearFrom = 0, yearTo = 0, offset = 0, limit = 20;

        try {
            String yf = processQuery(queryStr, "yearFrom");
            if (yf != null && !yf.isBlank()) yearFrom = Integer.parseInt(yf);
            String yt = processQuery(queryStr, "yearTo");
            if (yt != null && !yt.isBlank()) yearTo = Integer.parseInt(yt);
            String off = processQuery(queryStr, "offset");
            if (off != null && !off.isBlank()) offset = Integer.parseInt(off);
            String lim = processQuery(queryStr, "limit");
            if (lim != null && !lim.isBlank()) limit = Integer.parseInt(lim);
        } catch (NumberFormatException ignored) {}

        JSONObject result = DiscogsStore.searchWithFilters(q, artist, genre, format, yearFrom, yearTo, country, offset, limit);
        sendJsonResponse(exchange, 200, result);
    }

    public static void handleDiscogsArtistRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String name = processQuery(exchange.getRequestURI().getQuery(), "name");
        if (name == null || name.isBlank()) {
            sendError(exchange, 400, "Missing name parameter");
            return;
        }

        String limitStr = processQuery(exchange.getRequestURI().getQuery(), "limit");
        int limit = 100;
        try { if (limitStr != null) limit = Integer.parseInt(limitStr); } catch (NumberFormatException ignored) {}

        JSONArray releases = DiscogsStore.searchByArtist(name, limit);
        JSONObject response = new JSONObject();
        response.put("artist", name);
        response.put("releases", releases);
        response.put("count", releases.length());
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleDiscogsGenresRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }
        JSONObject response = new JSONObject();
        response.put("genres", DiscogsStore.getDistinctGenres());
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleDiscogsCountriesRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }
        JSONObject response = new JSONObject();
        response.put("countries", DiscogsStore.getDistinctCountries());
        sendJsonResponse(exchange, 200, response);
    }

    // ===== Cover Art Handler =====

    public static void handleCoverRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        // Extract discogs ID from path: /api/covers/{id}
        String path = exchange.getRequestURI().getPath();
        String idStr = path.substring(path.lastIndexOf('/') + 1);
        int discogsId;
        try {
            discogsId = Integer.parseInt(idStr);
        } catch (NumberFormatException e) {
            sendError(exchange, 400, "Invalid release ID");
            return;
        }

        byte[] imageData = DiscogsCoverService.getCoverBytes(discogsId);
        if (imageData == null) {
            sendError(exchange, 404, "No cover image available");
            return;
        }

        exchange.getResponseHeaders().set("Content-Type", "image/jpeg");
        exchange.getResponseHeaders().set("Cache-Control", "public, max-age=86400");
        exchange.sendResponseHeaders(200, imageData.length);
        try (var os = exchange.getResponseBody()) {
            os.write(imageData);
        }
    }

    // ===== User Profile Handlers =====

    public static void handleUserProfileRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String userId = processQuery(exchange.getRequestURI().getQuery(), "userId");
        if (userId == null || userId.isBlank()) {
            sendError(exchange, 400, "Missing userId parameter");
            return;
        }

        JSONObject profile = UserStore.getPublicProfile(userId);
        if (profile == null) {
            sendError(exchange, 404, "User not found");
            return;
        }

        sendJsonResponse(exchange, 200, profile);
    }

    public static void handleUserProfileUpdateRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String userId = requestJson.optString("userId", "");
        if (userId.isBlank()) {
            sendError(exchange, 400, "Missing userId");
            return;
        }

        UserStore.updateProfile(userId, requestJson);
        JSONObject response = new JSONObject();
        response.put("message", "Profile updated");
        response.put("profile", UserStore.getPublicProfile(userId));
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleUserPublicProfileRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        String username = processQuery(exchange.getRequestURI().getQuery(), "username");
        if (username == null || username.isBlank()) {
            sendError(exchange, 400, "Missing username parameter");
            return;
        }

        JSONObject profile = UserStore.getPublicProfileByUsername(username);
        if (profile == null) {
            sendError(exchange, 404, "User not found");
            return;
        }

        sendJsonResponse(exchange, 200, profile);
    }

    // ===== Admin Config Handlers =====

    public static void handleAdminConfigRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject response = new JSONObject();
        response.put("config", ConfigStore.getAll());
        sendJsonResponse(exchange, 200, response);
    }

    public static void handleAdminConfigSetRequest(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method Not Allowed");
            return;
        }

        JSONObject requestJson;
        try {
            requestJson = readJsonBody(exchange);
        } catch (Exception e) {
            sendError(exchange, 400, "Invalid JSON");
            return;
        }

        String key = requestJson.optString("key", "");
        String value = requestJson.optString("value", "");
        if (key.isBlank()) {
            sendError(exchange, 400, "Missing key");
            return;
        }

        if (value.isBlank()) {
            ConfigStore.delete(key);
        } else {
            ConfigStore.set(key, value);
        }

        JSONObject response = new JSONObject();
        response.put("message", "Config updated");
        response.put("key", key);
        sendJsonResponse(exchange, 200, response);
    }
}
