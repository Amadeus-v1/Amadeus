package org.amadeus.amadeusserver;

import java.io.IOException;
import java.net.InetSocketAddress;

import com.sun.net.httpserver.HttpServer;

public class API {

    public static void setUpServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        server.createContext("/api/hello", ClientCom::handleHelloRequest);
        server.createContext("/api/return", ClientCom::handleReturnRequest);
        server.createContext("/api/catalog/search", ClientCom::handleCatalogSearchRequest);
        server.createContext("/api/collection/add", ClientCom::handleCollectionAddRequest);
        server.createContext("/api/collection/list", ClientCom::handleCollectionListRequest);
        server.createContext("/api/friends/add", ClientCom::handleFriendsAddRequest);
        server.createContext("/api/friends/list", ClientCom::handleFriendsListRequest);
        server.createContext("/api/friends/collections", ClientCom::handleFriendsCollectionsRequest);
        server.createContext("/api/marketplace/list", ClientCom::handleMarketplaceListRequest);
        server.createContext("/api/marketplace/create", ClientCom::handleMarketplaceCreateListingRequest);
        server.createContext("/api/marketplace/sale", ClientCom::handleMarketplaceSaleRequest);
        server.createContext("/api/auth/session", ClientCom::handleAuthCreateSessionRequest);
        server.createContext("/api/auth/refresh", ClientCom::handleAuthRefreshRequest);
        server.createContext("/api/catalog/scan", ClientCom::handleCatalogScanRequest);
        server.createContext("/api/user/create", ClientCom::handleUserCreateRequest);
        server.createContext("/api/user/login", ClientCom::handleUserLoginRequest);

        server.start();
    }
}

