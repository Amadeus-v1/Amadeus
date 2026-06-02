package org.amadeus.amadeusserver;

import java.io.IOException;
import java.net.InetSocketAddress;

import com.sun.net.httpserver.HttpServer;

public class API {
    
    public static void setUpServer() throws IOException {
        // Changed port from 8080 to 8081 to avoid "Address already in use" errors
        HttpServer server = HttpServer.create(new InetSocketAddress(8081), 0);

        server.createContext("/api/hello", exchange -> ClientCom.handleHelloRequest(exchange));
        server.createContext("/api/return", exchange -> ClientCom.handleReturnRequest(exchange));

        server.start();
    }
}
