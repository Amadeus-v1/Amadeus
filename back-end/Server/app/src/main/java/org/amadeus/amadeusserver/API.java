package org.amadeus.amadeusserver;

import java.io.IOException;
import java.net.InetSocketAddress;

import com.sun.net.httpserver.HttpServer;

public class API {

    public static void setUpServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        server.createContext("/api/hello", ClientCom::handleHelloRequest);
        server.createContext("/api/return", ClientCom::handleReturnRequest);
        server.createContext("/api/user/create", ClientCom::handleUserCreateRequest);
        server.createContext("/api/user/login", ClientCom::handleUserLoginRequest);

        server.start();
    }
}

