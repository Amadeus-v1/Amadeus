package org.amadeus.amadeusserver;

import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.zip.GZIPInputStream;

import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;

import org.xml.sax.Attributes;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

import org.json.JSONObject;

/**
 * Downloads and imports Discogs monthly data dumps into a local SQLite database.
 * Uses SAX streaming to handle the massive XML files without loading them into memory.
 */
public class DiscogsImporter {

    private static final String DB_URL = "jdbc:sqlite:discogs.db";
    private static final String BASE_URL = "https://data.discogs.com/";
    private static final int BATCH_SIZE = 5000;

    // Import state tracking
    private static final AtomicBoolean importing = new AtomicBoolean(false);
    private static final AtomicInteger progressCount = new AtomicInteger(0);
    private static final AtomicLong totalBytes = new AtomicLong(0);
    private static volatile String importStatus = "idle";
    private static volatile String importError = null;

    public static boolean isImporting() {
        return importing.get();
    }

    public static JSONObject getImportStatus() {
        JSONObject status = new JSONObject();
        status.put("importing", importing.get());
        status.put("status", importStatus);
        status.put("recordsProcessed", progressCount.get());
        if (importError != null) {
            status.put("error", importError);
        }
        return status;
    }

    /**
     * Determine the most recent Discogs releases dump URL.
     * Uses current year/month, falling back to previous months.
     */
    public static String getLatestReleasesUrl() {
        java.time.LocalDate now = java.time.LocalDate.now();
        int year = now.getYear();
        int month = now.getMonthValue();

        // Try current month first, then go backwards up to 12 months
        for (int i = 0; i < 12; i++) {
            int m = month - i;
            int y = year;
            while (m <= 0) { m += 12; y--; }
            String dateStr = String.format("%d%02d01", y, m);
            String url = BASE_URL + "?download=data/" + y + "/discogs_" + dateStr + "_releases.xml.gz";
            return url; // Return the most recent expected URL
        }
        // Fallback to June 2026
        return BASE_URL + "?download=data/2026/discogs_20260601_releases.xml.gz";
    }

    /**
     * Start the import process in a background thread.
     * Returns immediately with status.
     */
    public static JSONObject startImport() {
        if (importing.compareAndSet(false, true)) {
            progressCount.set(0);
            importStatus = "starting";
            importError = null;

            Thread importThread = new Thread(() -> {
                try {
                    String url = getLatestReleasesUrl();
                    System.out.println("[DiscogsImporter] Starting import from: " + url);
                    importStatus = "downloading";

                    Path gzFile = Path.of("discogs_releases.xml.gz");

                    // Download if not already present
                    if (!Files.exists(gzFile) || Files.size(gzFile) < 1_000_000) {
                        downloadFile(url, gzFile);
                    } else {
                        System.out.println("[DiscogsImporter] Using existing download: " + gzFile);
                    }

                    importStatus = "parsing";
                    System.out.println("[DiscogsImporter] Parsing XML and importing to SQLite...");

                    initializeDatabase();
                    parseAndImport(gzFile);

                    buildFtsIndex();

                    importStatus = "complete";
                    System.out.println("[DiscogsImporter] Import complete! Total records: " + progressCount.get());
                } catch (Exception e) {
                    importStatus = "error";
                    importError = e.getMessage();
                    System.err.println("[DiscogsImporter] Import failed: " + e.getMessage());
                    e.printStackTrace();
                } finally {
                    importing.set(false);
                }
            }, "discogs-importer");
            importThread.setDaemon(true);
            importThread.start();

            JSONObject result = new JSONObject();
            result.put("message", "Import started in background");
            result.put("status", "starting");
            return result;
        } else {
            JSONObject result = new JSONObject();
            result.put("message", "Import already in progress");
            result.put("status", importStatus);
            result.put("recordsProcessed", progressCount.get());
            return result;
        }
    }

    private static void downloadFile(String url, Path target) throws Exception {
        System.out.println("[DiscogsImporter] Downloading: " + url);
        System.out.println("[DiscogsImporter] This file is ~10 GB, please be patient...");

        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", "AmadeusMediaCatalog/1.0")
                .GET()
                .build();

        HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() != 200) {
            throw new IOException("Download failed with status: " + response.statusCode());
        }

        long downloaded = 0;
        try (InputStream in = response.body();
             OutputStream out = new BufferedOutputStream(new FileOutputStream(target.toFile()), 1024 * 1024)) {
            byte[] buffer = new byte[1024 * 1024]; // 1MB buffer
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                downloaded += read;
                totalBytes.set(downloaded);
                if (downloaded % (100 * 1024 * 1024) == 0) { // Log every 100MB
                    System.out.printf("[DiscogsImporter] Downloaded: %.1f MB%n", downloaded / 1_048_576.0);
                }
            }
        }

        System.out.printf("[DiscogsImporter] Download complete: %.1f MB%n", downloaded / 1_048_576.0);
    }

    private static Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(DB_URL);
        try (Statement s = conn.createStatement()) {
            s.execute("PRAGMA journal_mode=WAL");
            s.execute("PRAGMA synchronous=NORMAL");
            s.execute("PRAGMA cache_size=-200000"); // 200MB cache
            s.execute("PRAGMA temp_store=MEMORY");
            s.execute("PRAGMA busy_timeout=10000");
        }
        return conn;
    }

    private static Connection getImportConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(DB_URL);
        try (Statement s = conn.createStatement()) {
            s.execute("PRAGMA journal_mode=WAL");
            s.execute("PRAGMA synchronous=OFF");
            s.execute("PRAGMA cache_size=-500000"); // 500MB cache
            s.execute("PRAGMA temp_store=MEMORY");
            s.execute("PRAGMA busy_timeout=10000");
        }
        return conn;
    }

    private static void initializeDatabase() throws SQLException {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS discogs_releases (
                    id INTEGER PRIMARY KEY,
                    title TEXT NOT NULL,
                    artist TEXT,
                    year INTEGER,
                    country TEXT,
                    genres TEXT,
                    styles TEXT,
                    formats TEXT,
                    labels TEXT,
                    barcode TEXT,
                    master_id INTEGER,
                    data_quality TEXT
                );
            """);

            // Index for common lookups
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_discogs_title ON discogs_releases(title);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_discogs_artist ON discogs_releases(artist);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_discogs_barcode ON discogs_releases(barcode);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_discogs_master ON discogs_releases(master_id);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_discogs_year ON discogs_releases(year);");
        }
    }

    private static void buildFtsIndex() throws SQLException {
        System.out.println("[DiscogsImporter] Building full-text search index...");
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            // Drop and rebuild FTS table
            stmt.execute("DROP TABLE IF EXISTS discogs_fts;");
            stmt.execute("""
                CREATE VIRTUAL TABLE discogs_fts USING fts5(
                    title, artist, genres, labels, barcode,
                    content='discogs_releases',
                    content_rowid='id'
                );
            """);
            stmt.execute("""
                INSERT INTO discogs_fts(rowid, title, artist, genres, labels, barcode)
                SELECT id, COALESCE(title,''), COALESCE(artist,''), COALESCE(genres,''), COALESCE(labels,''), COALESCE(barcode,'')
                FROM discogs_releases;
            """);
        }
        System.out.println("[DiscogsImporter] FTS index built successfully.");
    }

    private static void parseAndImport(Path gzFile) throws Exception {
        SAXParserFactory factory = SAXParserFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        SAXParser parser = factory.newSAXParser();

        java.util.concurrent.BlockingQueue<ReleaseDto> queue = new java.util.concurrent.ArrayBlockingQueue<>(100000);
        java.util.concurrent.atomic.AtomicReference<Exception> dbError = new java.util.concurrent.atomic.AtomicReference<>();

        Thread dbWriterThread = new Thread(() -> {
            try (Connection conn = getImportConnection();
                 PreparedStatement insertStmt = conn.prepareStatement("""
                     INSERT OR REPLACE INTO discogs_releases 
                     (id, title, artist, year, country, genres, styles, formats, labels, barcode, master_id, data_quality)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 """)) {

                conn.setAutoCommit(false);
                int batchCount = 0;
                int commitCount = 0;
                int totalWritten = 0;
                long start = System.currentTimeMillis();

                while (true) {
                    ReleaseDto dto = queue.take();
                    if (dto == POISON_PILL) {
                        break;
                    }

                    insertStmt.setInt(1, dto.id);
                    insertStmt.setString(2, dto.title);
                    insertStmt.setString(3, dto.artist);
                    insertStmt.setInt(4, dto.year);
                    insertStmt.setString(5, dto.country);
                    insertStmt.setString(6, dto.genres);
                    insertStmt.setString(7, dto.styles);
                    insertStmt.setString(8, dto.formats);
                    insertStmt.setString(9, dto.labels);
                    insertStmt.setString(10, dto.barcode);
                    insertStmt.setInt(11, dto.masterId);
                    insertStmt.setString(12, dto.dataQuality);
                    insertStmt.addBatch();

                    batchCount++;
                    commitCount++;
                    totalWritten++;

                    if (batchCount >= 10000) {
                        insertStmt.executeBatch();
                        batchCount = 0;
                    }

                    if (commitCount >= 100000) {
                        if (batchCount > 0) {
                            insertStmt.executeBatch();
                            batchCount = 0;
                        }
                        conn.commit();
                        commitCount = 0;

                        long elapsed = System.currentTimeMillis() - start;
                        if (elapsed > 0) {
                            double rps = (totalWritten * 1000.0) / elapsed;
                            System.out.printf("[DiscogsImporter] Database written: %,d releases (%.1f/sec)...%n", 
                                totalWritten, rps);
                        }
                    }
                }

                if (batchCount > 0) {
                    insertStmt.executeBatch();
                }
                conn.commit();

            } catch (Exception e) {
                dbError.set(e);
                System.err.println("[DiscogsImporter] DB Writer crashed: " + e.getMessage());
                e.printStackTrace();
            }
        }, "discogs-db-writer");

        dbWriterThread.start();

        try (InputStream fileIn = new BufferedInputStream(new FileInputStream(gzFile.toFile()), 1024 * 1024);
             InputStream gzIn = new GZIPInputStream(fileIn, 1024 * 1024)) {

            ReleaseHandler handler = new ReleaseHandler(queue, dbWriterThread);
            parser.parse(new XmlCleanInputStream(gzIn), handler);

        } finally {
            queue.put(POISON_PILL);
        }

        dbWriterThread.join();

        if (dbError.get() != null) {
            throw dbError.get();
        }
    }

    /**
     * Data carrier object for release records to be passed from parsing thread to writer thread.
     */
    private static class ReleaseDto {
        final int id;
        final String title;
        final String artist;
        final int year;
        final String country;
        final String genres;
        final String styles;
        final String formats;
        final String labels;
        final String barcode;
        final int masterId;
        final String dataQuality;

        ReleaseDto(int id, String title, String artist, int year, String country,
                   String genres, String styles, String formats, String labels,
                   String barcode, int masterId, String dataQuality) {
            this.id = id;
            this.title = title;
            this.artist = artist;
            this.year = year;
            this.country = country;
            this.genres = genres;
            this.styles = styles;
            this.formats = formats;
            this.labels = labels;
            this.barcode = barcode;
            this.masterId = masterId;
            this.dataQuality = dataQuality;
        }
    }

    private static final ReleaseDto POISON_PILL = new ReleaseDto(-1, "", "", 0, "", "", "", "", "", "", 0, "");

    /**
     * SAX handler that extracts release data from the Discogs XML dump.
     */
    private static class ReleaseHandler extends DefaultHandler {
        private final java.util.concurrent.BlockingQueue<ReleaseDto> queue;
        private final Thread writerThread;

        // Current release state
        private boolean inRelease = false;
        private int releaseId = 0;
        private String title = "";
        private final List<String> artists = new ArrayList<>();
        private int year = 0;
        private String country = "";
        private final List<String> genres = new ArrayList<>();
        private final List<String> styles = new ArrayList<>();
        private final List<String> formats = new ArrayList<>();
        private final List<String> labels = new ArrayList<>();
        private final List<String> barcodes = new ArrayList<>();
        private int masterId = 0;
        private String dataQuality = "";

        // Parsing state
        private final StringBuilder currentText = new StringBuilder();
        private boolean inArtists = false;
        private boolean inLabels = false;
        private boolean inFormats = false;
        private boolean inGenres = false;
        private boolean inStyles = false;
        private boolean inIdentifiers = false;
        private boolean inMasterId = false;
        private String currentElementName = "";

        ReleaseHandler(java.util.concurrent.BlockingQueue<ReleaseDto> queue, Thread writerThread) {
            this.queue = queue;
            this.writerThread = writerThread;
        }

        @Override
        public void startElement(String uri, String localName, String qName, Attributes attributes) {
            currentText.setLength(0);
            currentElementName = qName;

            switch (qName) {
                case "release" -> {
                    inRelease = true;
                    releaseId = Integer.parseInt(attributes.getValue("id"));
                    title = "";
                    artists.clear();
                    year = 0;
                    country = "";
                    genres.clear();
                    styles.clear();
                    formats.clear();
                    labels.clear();
                    barcodes.clear();
                    masterId = 0;
                    dataQuality = "";
                }
                case "artists" -> { if (inRelease) inArtists = true; }
                case "labels" -> { if (inRelease) inLabels = true; }
                case "formats" -> { if (inRelease) inFormats = true; }
                case "genres" -> { if (inRelease) inGenres = true; }
                case "styles" -> { if (inRelease) inStyles = true; }
                case "identifiers" -> { if (inRelease) inIdentifiers = true; }
                case "master_id" -> { if (inRelease) inMasterId = true; }
                case "label" -> {
                    if (inRelease && inLabels) {
                        String name = attributes.getValue("name");
                        if (name != null && !name.isBlank()) labels.add(name);
                    }
                }
                case "format" -> {
                    if (inRelease && inFormats) {
                        String name = attributes.getValue("name");
                        String qty = attributes.getValue("qty");
                        if (name != null) {
                            formats.add(qty != null && !qty.equals("1") ? qty + "x" + name : name);
                        }
                    }
                }
                case "identifier" -> {
                    if (inRelease && inIdentifiers) {
                        String type = attributes.getValue("type");
                        String value = attributes.getValue("value");
                        if ("Barcode".equals(type) && value != null && !value.isBlank()) {
                            barcodes.add(value.replaceAll("[^0-9]", ""));
                        }
                    }
                }
            }
        }

        @Override
        public void characters(char[] ch, int start, int length) {
            currentText.append(ch, start, length);
        }

        @Override
        public void endElement(String uri, String localName, String qName) throws SAXException {
            if (!inRelease) return;

            String text = currentText.toString().trim();

            switch (qName) {
                case "title" -> {
                    if (!inArtists && !inLabels) title = text;
                }
                case "name" -> {
                    if (inArtists && !text.isBlank()) artists.add(text);
                }
                case "year" -> {
                    if (!inRelease) break;
                    // Only set year from the release-level <year>, not nested
                    if (!inArtists && !inLabels && !inFormats && !inGenres && !inStyles) {
                        try { year = Integer.parseInt(text); } catch (NumberFormatException ignored) {}
                    }
                }
                case "country" -> country = text;
                case "genre" -> { if (inGenres) genres.add(text); }
                case "style" -> { if (inStyles) styles.add(text); }
                case "data_quality" -> dataQuality = text;
                case "master_id" -> {
                    if (inMasterId) {
                        try { masterId = Integer.parseInt(text); } catch (NumberFormatException ignored) {}
                        inMasterId = false;
                    }
                }
                case "artists" -> inArtists = false;
                case "labels" -> inLabels = false;
                case "formats" -> inFormats = false;
                case "genres" -> inGenres = false;
                case "styles" -> inStyles = false;
                case "identifiers" -> inIdentifiers = false;
                case "release" -> {
                    inRelease = false;
                    insertRelease();
                }
            }
        }

        private void insertRelease() throws SAXException {
            ReleaseDto dto = new ReleaseDto(
                releaseId,
                title,
                String.join(", ", artists),
                year,
                country,
                String.join(", ", genres),
                String.join(", ", styles),
                String.join(", ", formats),
                String.join(", ", labels),
                barcodes.isEmpty() ? "" : String.join(", ", barcodes),
                masterId,
                dataQuality
            );

            try {
                while (true) {
                    if (queue.offer(dto, 500, java.util.concurrent.TimeUnit.MILLISECONDS)) {
                        break;
                    }
                    if (writerThread != null && !writerThread.isAlive()) {
                        throw new SAXException("Database writer thread terminated unexpectedly.");
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new SAXException("Queue put interrupted", e);
            }

            int total = progressCount.incrementAndGet();
            if (total % 100000 == 0) {
                System.out.printf("[DiscogsImporter] Parsed %,d releases...%n", total);
            }
        }
    }

    /**
     * An InputStream wrapper that strips invalid XML 1.0 control characters on the fly
     * to prevent SAXParseException when encountering unclean characters in the data dump.
     */
    private static class XmlCleanInputStream extends InputStream {
        private final InputStream in;

        public XmlCleanInputStream(InputStream in) {
            this.in = in;
        }

        @Override
        public int read() throws IOException {
            int c = in.read();
            if (c == -1) return -1;
            // Replace invalid ASCII control characters (0x00-0x1F except 0x09, 0x0A, 0x0D) with space
            if (c < 32 && c != 9 && c != 10 && c != 13) {
                return ' ';
            }
            return c;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            int n = in.read(b, off, len);
            if (n == -1) return -1;
            for (int i = off; i < off + n; i++) {
                int c = b[i] & 0xFF;
                if (c < 32 && c != 9 && c != 10 && c != 13) {
                    b[i] = ' '; // Replace with space
                }
            }
            return n;
        }

        @Override
        public void close() throws IOException {
            in.close();
        }
    }
}
