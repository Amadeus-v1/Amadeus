package org.amadeus.amadeusserver;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.json.JSONObject;

import com.sun.net.httpserver.HttpExchange;

public class ClientCom {
    private static final String USER_STORAGE_FILE = "userAccounts.json";

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

        List<JSONObject> users = ModifyStorage.readJsonArrayList("users", USER_STORAGE_FILE);

        JSONObject user = users.stream()
                .filter(u -> (username != null && username.equals(u.optString("username")))
                        || (email != null && email.equals(u.optString("email"))))
                .findFirst()
                .orElse(null);

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

        List<JSONObject> users = ModifyStorage.readJsonArrayList("users", USER_STORAGE_FILE);

        if (users.stream().anyMatch(user -> user.optString("username").equals(username))) {
            sendError(exchange, 400, "Username already in use");
            return;
        }

        createdUser.put("email", email);
        createdUser.put("passwordHash", passwordHash);
        createdUser.put("passwordSalt", passwordSalt);

        // Generate a unique ID for the user
        while (true) {
            String newId = UUID.randomUUID().toString();
            if (users.stream().noneMatch(user -> user.optString("id").equals(newId))) {
                createdUser.put("id", newId);
                break;
            }
        }

        // Append the new user into the users array inside userAccounts.json
        ModifyStorage.appendToArray("users", createdUser, "userAccounts.json");

        JSONObject responseUser = new JSONObject();
        responseUser.put("id", createdUser.optString("id"));
        responseUser.put("username", createdUser.optString("username"));
        responseUser.put("email", createdUser.optString("email"));

        JSONObject response = new JSONObject();
        response.put("message", "User created");
        response.put("user", responseUser);
        sendJsonResponse(exchange, 201, response);
    }
}