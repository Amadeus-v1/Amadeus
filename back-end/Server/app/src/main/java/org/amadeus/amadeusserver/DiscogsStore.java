package org.amadeus.amadeusserver;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.GZIPInputStream;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

import org.json.JSONObject;

public class DiscogsStore {
    private static final String DB_URL = System.getProperty("amadeus.discogs.db.url", "jdbc:sqlite:discogsCatalog.db");
    private static final int BATCH_SIZE = 1000;
    private static boolean initialized = false;

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static synchronized void initialize() throws SQLException {
        if (initialized) {
            return;
        }
        
        String releasesSql = """
                CREATE TABLE IF NOT EXISTS discogs_releases (
                    releaseId TEXT NOT NULL,
                    barcode TEXT NOT NULL,
                    barcodeNorm TEXT NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT,
                    mediaType TEXT NOT NULL,
                    format TEXT,
                    year INTEGER,
                    label TEXT,
                    source TEXT NOT NULL DEFAULT 'discogs',
                    PRIMARY KEY (releaseId, barcodeNorm)
                );
                """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(releasesSql);
            statement.execute("CREATE INDEX IF NOT EXISTS idx_discogs_releases_barcode_norm ON discogs_releases(barcodeNorm);");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_discogs_releases_title ON discogs_releases(title);");
        }
        initialized = true;
    }

    public static JSONObject lookupByBarcode(String barcode) {
        String barcodeNorm = normalizeBarcode(barcode);
        if (barcodeNorm.isBlank()) {
            return null;
        }

        try {
            initialize();
            String sql = """
                    SELECT releaseId, barcode, title, artist, mediaType, format, year, label
                    FROM discogs_releases
                    WHERE barcodeNorm = ?
                    ORDER BY title ASC
                    LIMIT 1;
                    """;

            try (Connection connection = getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, barcodeNorm);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        return null;
                    }

                    JSONObject result = new JSONObject();
                    result.put("success", true);
                    result.put("source", "discogs");
                    result.put("discogsReleaseId", resultSet.getString("releaseId"));
                    result.put("barcode", resultSet.getString("barcode"));
                    result.put("title", resultSet.getString("title"));
                    result.put("artist", resultSet.getString("artist"));
                    result.put("mediaType", resultSet.getString("mediaType"));
                    result.put("format", resultSet.getString("format"));
                    result.put("year", resultSet.getInt("year"));
                    result.put("label", resultSet.getString("label"));
                    return result;
                }
            }
        } catch (SQLException e) {
            System.err.println("[DiscogsStore] Lookup failed: " + e.getMessage());
            return null;
        }
    }

    public static int importReleases(Path releasesDumpPath) throws IOException, XMLStreamException, SQLException {
        initialize();

        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);

        try (InputStream input = openDumpStream(releasesDumpPath);
             Connection connection = getConnection()) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA journal_mode = WAL;");
                statement.execute("PRAGMA synchronous = NORMAL;");
            }
            connection.setAutoCommit(false);

            String sql = """
                    INSERT INTO discogs_releases (releaseId, barcode, barcodeNorm, title, artist, mediaType, format, year, label, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'discogs')
                    ON CONFLICT(releaseId, barcodeNorm) DO UPDATE SET
                        barcode = excluded.barcode,
                        title = excluded.title,
                        artist = excluded.artist,
                        mediaType = excluded.mediaType,
                        format = excluded.format,
                        year = excluded.year,
                        label = excluded.label;
                    """;

            XMLStreamReader reader = factory.createXMLStreamReader(input);
            int imported = 0;
            int pending = 0;
            try (PreparedStatement insert = connection.prepareStatement(sql)) {
                while (reader.hasNext()) {
                    if (reader.next() == XMLStreamConstants.START_ELEMENT && "release".equals(reader.getLocalName())) {
                        ReleaseRecord release = readRelease(reader);
                        if (release.title.isBlank() || release.barcodes.isEmpty()) {
                            continue;
                        }

                        for (String barcode : release.barcodes) {
                            String barcodeNorm = normalizeBarcode(barcode);
                            if (barcodeNorm.isBlank()) {
                                continue;
                            }

                            insert.setString(1, release.releaseId);
                            insert.setString(2, barcode);
                            insert.setString(3, barcodeNorm);
                            insert.setString(4, release.title);
                            insert.setString(5, String.join(", ", release.artists));
                            insert.setString(6, release.mediaType());
                            insert.setString(7, String.join(", ", release.formats));
                            insert.setInt(8, release.year);
                            insert.setString(9, release.labels.isEmpty() ? "" : release.labels.get(0));
                            insert.addBatch();
                            imported++;
                            pending++;
                        }

                        if (pending >= BATCH_SIZE) {
                            insert.executeBatch();
                            connection.commit();
                            pending = 0;
                        }
                    }
                }

                if (pending > 0) {
                    insert.executeBatch();
                    connection.commit();
                }
            } finally {
                reader.close();
            }

            return imported;
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            System.err.println("Usage: DiscogsStore <discogs_releases.xml|discogs_releases.xml.gz>");
            System.exit(1);
        }

        Path dumpPath = Path.of(args[0]);
        if (!Files.isRegularFile(dumpPath)) {
            System.err.println("Discogs release dump not found: " + dumpPath.toAbsolutePath());
            System.err.println("Replace the example path with the real downloaded Discogs releases XML or XML.GZ file.");
            System.exit(2);
        }

        int imported = importReleases(dumpPath);
        System.out.println("Imported " + imported + " Discogs barcode entries.");
    }

    private static InputStream openDumpStream(Path path) throws IOException {
        InputStream input = new BufferedInputStream(Files.newInputStream(path));
        if (path.getFileName().toString().toLowerCase().endsWith(".gz")) {
            return new GZIPInputStream(input);
        }
        return input;
    }

    private static ReleaseRecord readRelease(XMLStreamReader reader) throws XMLStreamException {
        ReleaseRecord release = new ReleaseRecord();
        release.releaseId = attr(reader, "id");
        boolean inArtists = false;
        boolean inFormats = false;
        boolean inLabels = false;

        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                String name = reader.getLocalName();
                if ("artists".equals(name)) {
                    inArtists = true;
                } else if ("formats".equals(name)) {
                    inFormats = true;
                } else if ("labels".equals(name)) {
                    inLabels = true;
                } else if ("title".equals(name)) {
                    release.title = reader.getElementText().trim();
                } else if ("name".equals(name) && inArtists) {
                    addUnique(release.artists, reader.getElementText().trim());
                } else if ("year".equals(name)) {
                    release.year = parseYear(reader.getElementText());
                } else if ("label".equals(name) && inLabels) {
                    addUnique(release.labels, attr(reader, "name"));
                } else if ("format".equals(name) && inFormats) {
                    addUnique(release.formats, attr(reader, "name"));
                } else if ("identifier".equals(name) && "barcode".equalsIgnoreCase(attr(reader, "type"))) {
                    addUnique(release.barcodes, attr(reader, "value"));
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                String name = reader.getLocalName();
                if ("artists".equals(name)) {
                    inArtists = false;
                } else if ("formats".equals(name)) {
                    inFormats = false;
                } else if ("labels".equals(name)) {
                    inLabels = false;
                } else if ("release".equals(name)) {
                    return release;
                }
            }
        }

        return release;
    }

    private static String attr(XMLStreamReader reader, String name) {
        String value = reader.getAttributeValue(null, name);
        return value == null ? "" : value.trim();
    }

    private static int parseYear(String text) {
        try {
            return Integer.parseInt(text.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private static String normalizeBarcode(String barcode) {
        if (barcode == null) {
            return "";
        }
        return barcode.replaceAll("[^0-9]", "");
    }

    private static void addUnique(Collection<String> values, String value) {
        if (value == null || value.isBlank() || values.contains(value)) {
            return;
        }
        values.add(value);
    }

    private static class ReleaseRecord {
        String releaseId = "";
        String title = "";
        int year = 0;
        List<String> artists = new ArrayList<>();
        List<String> formats = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        Set<String> barcodes = new LinkedHashSet<>();

        String mediaType() {
            String formatText = String.join(" ", formats).toLowerCase();
            if (formatText.contains("vinyl")) {
                return "Vinyl";
            }
            if (formatText.contains("cassette")) {
                return "Cassette";
            }
            if (formatText.contains("dvd")) {
                return "DVD";
            }
            if (formatText.contains("blu-ray") || formatText.contains("bluray")) {
                return "Blu-ray";
            }
            if (formatText.contains("cd")) {
                return "CD";
            }
            return "Music";
        }
    }
}
