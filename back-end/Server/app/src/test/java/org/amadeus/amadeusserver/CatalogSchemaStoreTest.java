package org.amadeus.amadeusserver;

import java.nio.file.Files;
import java.nio.file.Path;

import org.json.JSONArray;
import org.json.JSONObject;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class CatalogSchemaStoreTest {

    @Test
    void seedsCategoriesAndStoresCustomFields() throws Exception {
        Path dbPath = Files.createTempFile("catalog-schema-test-", ".db");
        Files.deleteIfExists(dbPath);
        System.setProperty("amadeus.catalog.db.url", "jdbc:sqlite:" + dbPath.toAbsolutePath());

        CatalogSchemaStore.initialize();
        JSONArray seeded = CatalogSchemaStore.listCategories();

        assertTrue(seeded.length() >= 3);

        JSONObject records = seeded.toList().stream()
                .map(item -> new JSONObject((java.util.Map<?, ?>) item))
                .filter(item -> "Records".equals(item.getString("name")))
                .findFirst()
                .orElseThrow();

        assertEquals("music", records.getString("kind"));

        CatalogSchemaStore.createCategory("Books", "media", new JSONObject()
                .put("fields", new JSONArray()
                        .put(new JSONObject().put("name", "Author").put("type", "text"))
                        .put(new JSONObject().put("name", "Print Date").put("type", "text"))));

        JSONArray books = CatalogSchemaStore.listCategories();
        assertTrue(books.toList().stream()
                .map(item -> new JSONObject((java.util.Map<?, ?>) item))
                .anyMatch(item -> "Books".equals(item.getString("name"))));

        CatalogSchemaStore.setReputation("user-low", 10);
        JSONObject item = CatalogSchemaStore.createCatalogItem(new JSONObject()
                .put("categoryId", "records")
                .put("title", "Sample LP")
                .put("artist", "Demo Artist")
                .put("edition", "Standard")
                .put("format", "Vinyl")
                .put("status", "pending")
                .put("submittedBy", "user-low"));

        assertEquals("pending", item.getString("status"));

        CatalogSchemaStore.addUserCollection(new JSONObject()
                .put("userId", "user-1")
                .put("itemId", item.getString("id"))
                .put("categoryId", "records")
                .put("visibility", "public"));

        JSONArray collection = CatalogSchemaStore.listUserCollections("user-1");
        assertTrue(collection.length() >= 1);
        assertEquals("public", collection.getJSONObject(0).getString("visibility"));
    }
}
