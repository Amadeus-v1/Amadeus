package org.amadeus.amadeusserver;

import java.io.IOException;
import java.net.InetSocketAddress;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

public class API {

    // Add CORS headers to all responses
    private static HttpHandler addCORSHeaders(HttpHandler handler) {
        return exchange -> {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
            } else {
                handler.handle(exchange);
            }
        };
    }

    public static void setUpServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        server.createContext("/api/hello", addCORSHeaders(ClientCom::handleHelloRequest));
        server.createContext("/api/return", addCORSHeaders(ClientCom::handleReturnRequest));
        server.createContext("/api/catalog/search", addCORSHeaders(ClientCom::handleCatalogSearchRequest));
        server.createContext("/api/collection/add", addCORSHeaders(ClientCom::handleCollectionAddRequest));
        server.createContext("/api/collection/list", addCORSHeaders(ClientCom::handleCollectionListRequest));
        server.createContext("/api/collection/update", addCORSHeaders(ClientCom::handleCollectionUpdateRequest));
        server.createContext("/api/collection/delete", addCORSHeaders(ClientCom::handleCollectionDeleteRequest));
        server.createContext("/api/friends/add", addCORSHeaders(ClientCom::handleFriendsAddRequest));
        server.createContext("/api/friends/list", addCORSHeaders(ClientCom::handleFriendsListRequest));
        server.createContext("/api/friends/collections", addCORSHeaders(ClientCom::handleFriendsCollectionsRequest));
        server.createContext("/api/marketplace/list", addCORSHeaders(ClientCom::handleMarketplaceListRequest));
        server.createContext("/api/marketplace/create", addCORSHeaders(ClientCom::handleMarketplaceCreateListingRequest));
        server.createContext("/api/marketplace/sale", addCORSHeaders(ClientCom::handleMarketplaceSaleRequest));
        server.createContext("/api/auth/session", addCORSHeaders(ClientCom::handleAuthCreateSessionRequest));
        server.createContext("/api/auth/refresh", addCORSHeaders(ClientCom::handleAuthRefreshRequest));
        server.createContext("/api/catalog/scan", addCORSHeaders(ClientCom::handleCatalogScanRequest));
        server.createContext("/api/catalog/barcode", addCORSHeaders(ClientCom::handleBarcodeSearchRequest));
        server.createContext("/api/user/create", addCORSHeaders(ClientCom::handleUserCreateRequest));
        server.createContext("/api/user/login", addCORSHeaders(ClientCom::handleUserLoginRequest));

        server.start();
    }
}

