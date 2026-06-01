package org.amadeus.amadeusserver;
import java.nio.file.Files;
import java.nio.file.Paths;

import org.json.JSONObject;

public class ModifyStorage {

    // Adds new key-value pairs to the existing JSON file or updates existing keys with new values
    public static void update(JSONObject json, String filePath) {
        try {
            String content = new String(Files.readAllBytes(Paths.get(filePath)));
            JSONObject existingJson = new JSONObject(content);

            for (String key : json.keySet()) {
                existingJson.put(key, json.get(key));
            }

            Files.write(Paths.get(filePath), existingJson.toString().getBytes());
            System.out.println("Data successfully updated in " + filePath);
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("Failed to update data in " + filePath);
        }
    }

    // Removes specified keys from the existing JSON file
    public static void remove(JSONObject json, String filePath) {
        try {
            String content = new String(Files.readAllBytes(Paths.get(filePath)));
            JSONObject existingJson = new JSONObject(content);

            for (String key : json.keySet()) {
                existingJson.remove(key);
            }

            Files.write(Paths.get(filePath), existingJson.toString().getBytes());
            System.out.println("Data successfully removed from " + filePath);
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("Failed to remove data from " + filePath);
        }
    }

}
