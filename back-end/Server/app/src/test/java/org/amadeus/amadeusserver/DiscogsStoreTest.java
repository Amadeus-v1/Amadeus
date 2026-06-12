package org.amadeus.amadeusserver;

import java.nio.file.Files;
import java.nio.file.Path;

import org.json.JSONObject;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import org.junit.jupiter.api.Test;

class DiscogsStoreTest {

    @Test
    void importsDiscogsReleaseDumpAndLooksUpBarcode() throws Exception {
        Path dbPath = Files.createTempFile("discogs-store-test-", ".db");
        Files.deleteIfExists(dbPath);
        System.setProperty("amadeus.discogs.db.url", "jdbc:sqlite:" + dbPath.toAbsolutePath());

        Path dumpPath = Files.createTempFile("discogs-releases-test-", ".xml");
        Files.writeString(dumpPath, """
                <?xml version="1.0" encoding="UTF-8"?>
                <releases>
                  <release id="12345">
                    <artists>
                      <artist>
                        <name>Sample Artist</name>
                      </artist>
                    </artists>
                    <title>Sample Album</title>
                    <labels>
                      <label name="Sample Label"/>
                    </labels>
                    <formats>
                      <format name="Vinyl" qty="1"/>
                    </formats>
                    <year>1977</year>
                    <identifiers>
                      <identifier type="Barcode" value="0 12345 67890 5"/>
                    </identifiers>
                  </release>
                </releases>
                """);

        int imported = DiscogsStore.importReleases(dumpPath);
        JSONObject result = DiscogsStore.lookupByBarcode("012345678905");

        assertEquals(1, imported);
        assertNotNull(result);
        assertEquals("discogs", result.getString("source"));
        assertEquals("Sample Album", result.getString("title"));
        assertEquals("Sample Artist", result.getString("artist"));
        assertEquals("Vinyl", result.getString("mediaType"));
        assertEquals(1977, result.getInt("year"));
    }
}
