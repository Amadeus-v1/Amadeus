package org.amadeus.amadeusserver;

import java.io.IOException;

import org.json.JSONObject;

import com.sun.net.httpserver.HttpExchange;

public class ClientCom {
    public static String processQuery(String query, String valueName) {
        String value = null;

        if (query != null) {
            query = "&" + query; 

            if (query.contains("&" + valueName + "=")) {
                value = query.substring(query.indexOf("&" + valueName + "=") + valueName.length() + 2); // 3. Changed +1 to +2 to account for the extra '&' character length
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
        System.out.println("Sending response [" + statusCode + "]: " + responseString);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, responseString.getBytes().length);
        exchange.getResponseBody().write(responseString.getBytes());
        exchange.close();
    }
    
    // Template: Handle endpoint with required parameter validation
    public static void handleRequiredParameterEndpoint(HttpExchange exchange, String paramName, String successMessageTemplate, String errorMessage) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        System.out.println("Received request: " + exchange.getRequestURI() + " Query: " + query);
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
        System.out.println("Received request: " + exchange.getRequestURI() + " Query: " + query);
        JSONObject jsonResponse = new JSONObject();
        
        if (query != null) {
            String[][] allQueryParams = processAllQuery(query);
            for (String[] param : allQueryParams) {
                if (param.length == 2) {
                    jsonResponse.put(param[0], param[1]);
                } else if (param.length == 1) {
                    jsonResponse.put(param[0], "");
                }
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
}