package org.amadeus.amadeusserver;

import java.io.IOException;
import java.net.InetSocketAddress;

import com.sun.net.httpserver.HttpServer;

public class API {
    
    public static void setUpServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        server.createContext("/api/hello", exchange -> ClientCom.handleHelloRequest(exchange));
        server.createContext("/api/return", exchange -> ClientCom.handleReturnRequest(exchange));
        server.createContext("/api/user/create", exchange -> ClientCom.handleUserCreateRequest(exchange));

        server.start();
    }
}
