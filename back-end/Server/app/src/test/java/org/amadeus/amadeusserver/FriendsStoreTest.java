package org.amadeus.amadeusserver;

import java.nio.file.Files;
import java.nio.file.Path;

import org.json.JSONArray;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class FriendsStoreTest {

    @Test
    void addFriendAndListFriendsWorks() throws Exception {
        Path dbPath = Files.createTempFile("friends-test-", ".db");
        Files.deleteIfExists(dbPath);
        System.setProperty("amadeus.friends.db.url", "jdbc:sqlite:" + dbPath.toAbsolutePath());
        System.setProperty("amadeus.media.db.url", "jdbc:sqlite:" + dbPath.toAbsolutePath());

        FriendsStore.initialize();
        FriendsStore.addFriend("user-1", "user-2");

        JSONArray friends = FriendsStore.listFriends("user-1");

        assertEquals(1, friends.length());
        assertEquals("user-2", friends.getJSONObject(0).getString("friendId"));
        assertTrue(friends.getJSONObject(0).getBoolean("accepted"));
    }
}
