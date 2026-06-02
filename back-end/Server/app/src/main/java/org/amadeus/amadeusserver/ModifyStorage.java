package org.amadeus.amadeusserver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONObject;

public class ModifyStorage {

    private static final Object FILE_LOCK = new Object();

    private static Path buildPath(String filePath) {
        return Paths.get(filePath).toAbsolutePath();
    }

    private static void ensureFileExists(Path path) throws IOException {
        if (Files.notExists(path)) {
            if (path.getParent() != null) {
                Files.createDirectories(path.getParent());
            }
            Files.writeString(path, new JSONObject().toString(), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
        }
    }

    private static JSONObject readRoot(Path path) throws IOException {
        ensureFileExists(path);
        String content = Files.readString(path, StandardCharsets.UTF_8);
        try {
            return new JSONObject(content);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static void writeRoot(Path path, JSONObject json) throws IOException {
        Path tempPath = path.resolveSibling(path.getFileName() + ".tmp");
        Files.writeString(tempPath, json.toString(2), StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        try {
            Files.move(tempPath, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(tempPath, path, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public static void update(JSONObject json, String filePath) {
        synchronized (FILE_LOCK) {
            try {
                Path path = buildPath(filePath);
                JSONObject existingJson = readRoot(path);

                for (String key : json.keySet()) {
                    existingJson.put(key, json.get(key));
                }

                writeRoot(path, existingJson);
                System.out.println("Data successfully updated in " + filePath);
            } catch (Exception e) {
                e.printStackTrace();
                System.out.println("Failed to update data in " + filePath);
            }
        }
    }

    public static void remove(JSONObject json, String filePath) {
        synchronized (FILE_LOCK) {
            try {
                Path path = buildPath(filePath);
                JSONObject existingJson = readRoot(path);

                for (String key : json.keySet()) {
                    existingJson.remove(key);
                }

                writeRoot(path, existingJson);
                System.out.println("Data successfully removed from " + filePath);
            } catch (Exception e) {
                e.printStackTrace();
                System.out.println("Failed to remove data from " + filePath);
            }
        }
    }

    public static void appendToArray(String arrayName, JSONObject value, String filePath) {
        synchronized (FILE_LOCK) {
            try {
                Path path = buildPath(filePath);
                JSONObject existingJson = readRoot(path);

                JSONArray array = existingJson.optJSONArray(arrayName);
                if (array == null) {
                    array = new JSONArray();
                }

                array.put(value);
                existingJson.put(arrayName, array);
                writeRoot(path, existingJson);
                System.out.println("Data successfully appended to array '" + arrayName + "' in " + filePath);
            } catch (Exception e) {
                e.printStackTrace();
                System.out.println("Failed to append data to array '" + arrayName + "' in " + filePath);
            }
        }
    }

    public static JSONArray readJsonArray(String arrayName, String filePath) {
        synchronized (FILE_LOCK) {
            try {
                Path path = buildPath(filePath);
                JSONObject existingJson = readRoot(path);
                JSONArray array = existingJson.optJSONArray(arrayName);
                return array != null ? array : new JSONArray();
            } catch (Exception e) {
                e.printStackTrace();
                System.out.println("Failed to read array '" + arrayName + "' from " + filePath);
                return new JSONArray();
            }
        }
    }

    public static List<JSONObject> readJsonArrayList(String arrayName, String filePath) {
        JSONArray array = readJsonArray(arrayName, filePath);
        List<JSONObject> list = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            Object element = array.get(i);
            if (element instanceof JSONObject) {
                list.add((JSONObject) element);
            }
        }
        return list;
    }

    public static JSONObject read(String filePath) {
        synchronized (FILE_LOCK) {
            try {
                Path path = buildPath(filePath);
                return readRoot(path);
            } catch (Exception e) {
                e.printStackTrace();
                System.out.println("Failed to read data from " + filePath);
                return new JSONObject();
            }
        }
    }

}
