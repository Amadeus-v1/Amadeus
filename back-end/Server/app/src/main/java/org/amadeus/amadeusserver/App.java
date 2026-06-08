package org.amadeus.amadeusserver;

import java.io.IOException;

/**
 * Main entry point for the Amadeus server.
 */
public class App {

    public static void main(String[] args) {
        try {
            API.setUpServer();
            System.out.println("Press Ctrl+C to stop");
            
            // Keep the main thread alive
            Thread.currentThread().join();
        } catch (IOException e) {
            System.err.println("✗ Failed to start server");
            e.printStackTrace();
        } catch (InterruptedException e) {
            System.out.println("Server stopped");
        }
    }
}
