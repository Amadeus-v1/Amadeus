# Barcode Scanner Integration - Implementation Guide

## Overview

This guide explains the complete barcode scanner integration for Amadeus, including architecture, components, deployment, and usage.

## Table of Contents
1. [Architecture](#architecture)
2. [Backend Components](#backend-components)
3. [Frontend Components](#frontend-components)
4. [How It Works](#how-it-works)
5. [Integration Points](#integration-points)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)

---

## Architecture

### System Overview

```
User Interface (Frontend)
    ↓
Barcode Input → API Call
    ↓
Backend API Gateway (/api/catalog/barcode)
    ↓
BarcodeService (Java)
    ↓
Multiple Data Sources:
  - Open Library API (ISBN lookup)
  - Open Food Facts API (Product lookup)
  - Local MediaStore (Catalog search)
    ↓
Return Results → Frontend Display
    ↓
User Action: Add to Collection
    ↓
/api/collection/add endpoint
```

### Data Flow

**User enters barcode** → **Frontend validates** → **Sends to /api/catalog/barcode** → **BarcodeService.searchByBarcode()** → **Attempts three lookup sources** → **Returns best match** → **Frontend displays results** → **User clicks "Add to Collection"** → **Item added via /api/collection/add**

---

## Backend Components

### 1. BarcodeService.java

**Location:** `back-end/Server/app/src/main/java/org/amadeus/amadeusserver/BarcodeService.java`

**Purpose:** Orchestrates barcode lookups from multiple sources

**Key Methods:**

#### `searchByBarcode(String barcode)`
- Main entry point
- Validates barcode format
- Orchestrates search across sources
- Returns JSONObject with results

```java
JSONObject result = BarcodeService.searchByBarcode("9780544720435");
// Returns:
// {
//   "success": true,
//   "source": "isbn",
//   "title": "The Great Gatsby",
//   ...
// }
```

#### `lookupISBN(String isbn)`
- Queries Open Library API
- Handles ISBN-10 and ISBN-13
- Extracts book metadata
- Returns `null` if not found

#### `lookupOpenFoodFacts(String barcode)`
- Queries Open Food Facts API
- Attempts media type detection
- Returns product information
- Returns `null` if not found

#### `lookupLocalCatalog(String barcode)`
- Searches MediaStore database
- Uses existing Amadeus catalog
- Returns first matching item
- Returns `null` if not found

#### `detectMediaType(String description)`
- Analyzes product description
- Identifies media type keywords
- Returns media type string or null

**Key Constants:**
```java
private static final int TIMEOUT_MS = 5000;           // API timeout
private static final String USER_AGENT = "Amadeus-MediaCollector/1.0";
```

### 2. ClientCom.java - Handler Method

**Location:** `back-end/Server/app/src/main/java/org/amadeus/amadeusserver/ClientCom.java`

**Method:** `handleBarcodeSearchRequest()`

```java
public static void handleBarcodeSearchRequest(HttpExchange exchange) throws IOException {
    // 1. Validate POST method
    if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
        sendError(exchange, 405, "Method Not Allowed");
        return;
    }

    // 2. Parse request body
    JSONObject requestJson;
    try {
        requestJson = readJsonBody(exchange);
    } catch (Exception e) {
        sendError(exchange, 400, "Invalid JSON");
        return;
    }

    // 3. Extract and validate barcode
    String barcode = requestJson.optString("barcode", "").trim();
    if (barcode.isBlank()) {
        sendError(exchange, 400, "Missing barcode");
        return;
    }

    // 4. Call BarcodeService
    JSONObject result = BarcodeService.searchByBarcode(barcode);
    
    // 5. Return appropriate status code
    int statusCode = result.optBoolean("success", false) ? 200 : 404;
    sendJsonResponse(exchange, statusCode, result);
}
```

### 3. API.java - Route Registration

**Location:** `back-end/Server/app/src/main/java/org/amadeus/amadeusserver/API.java`

**Registration:**
```java
server.createContext("/api/catalog/barcode", addCORSHeaders(ClientCom::handleBarcodeSearchRequest));
```

---

## Frontend Components

### 1. barcode.html

**Location:** `front-end/barcode.html`

**Purpose:** Dedicated barcode scanner interface

**Key Features:**
- Text input for barcode entry
- Search button
- Real-time results display
- "Add to Collection" functionality
- Error/success messaging
- Optional camera section (for future enhancement)

**Main Sections:**
```html
<!-- Scanner Input Section -->
<input id="barcodeInput" type="text" placeholder="Enter or scan barcode...">
<button id="scanButton">Search</button>

<!-- Results Section -->
<div id="resultsSection">
  <!-- Dynamic result items added by JS -->
</div>

<!-- Messages -->
<div id="errorMessage" class="error-message"></div>
<div id="successMessage" class="success-message"></div>
```

### 2. barcode.js

**Location:** `front-end/barcode.js`

**Purpose:** Handle barcode scanning logic and UI interactions

**Key Functions:**

#### `handleBarcodeScan()`
- Gets barcode from input field
- Calls API endpoint
- Displays results or error

#### `displayResults(results)`
- Formats and displays search results
- Shows item details (title, artist, media type, year, etc.)
- Provides action buttons

#### `addItemFromBarcode(itemData)`
- Calls /api/collection/add endpoint
- Prepares collection metadata
- Redirects to collection on success

#### `clearResults()`
- Resets form
- Clears results display
- Focuses input for next scan

**Event Handlers:**
- `Enter key` in input → trigger scan
- `Click Search button` → trigger scan
- `Click Add to Collection` → add item
- `Click Scan Again` → clear results

### 3. Integration in add-item.html

**Quick Barcode Lookup Section:**
```html
<div class="barcode-quick-lookup">
    <h3>⚡ Quick Barcode Lookup</h3>
    <p>Have a barcode? Use our scanner for instant item lookup</p>
    <a href="barcode.html" class="btn btn-primary">📱 Go to Barcode Scanner</a>
</div>
```

### 4. Integration in dashboard.html

**New Quick Action Buttons:**
```html
<button class="action-card" id="barcodeBtn">
    <span class="action-icon">📱</span>
    <span class="action-title">Barcode Scanner</span>
</button>

<button class="action-card" id="addItemBtn">
    <span class="action-icon">➕</span>
    <span class="action-title">Add Item</span>
</button>
```

**Dashboard.js Handler:**
```javascript
document.getElementById('barcodeBtn').addEventListener('click', () => {
    window.location.href = 'barcode.html';
});
```

---

## How It Works

### Step-by-Step User Flow

1. **User opens Barcode Scanner** (dashboard or add-item page)
   - Frontend loads `barcode.html`
   - Page authenticates user
   - Input field automatically focused

2. **User enters/scans barcode**
   - Manually types barcode
   - Or uses physical barcode scanner device
   - Barcode data appears in input field

3. **User clicks Search or presses Enter**
   - `handleBarcodeScan()` is triggered
   - Frontend shows loading spinner
   - Calls `POST /api/catalog/barcode` with barcode

4. **Backend processes barcode**
   - `ClientCom.handleBarcodeSearchRequest()` receives request
   - Validates barcode is provided
   - Calls `BarcodeService.searchByBarcode()`

5. **BarcodeService searches sources in order**
   - **If 10 or 13 digits:** Try `lookupISBN()`
   - **If not found:** Try `lookupOpenFoodFacts()`
   - **If still not found:** Try `lookupLocalCatalog()`
   - **Return:** Best match or "not found" response

6. **Frontend receives response**
   - If successful: Display item details
     - Cover image
     - Title, Artist/Author
     - Media type, Year
     - Source, Barcode
   - If not found: Show "not found" message
     - Option to add manually

7. **User reviews item information**
   - Can see all metadata from source
   - Can click "Add to Collection"
   - Or "Scan Again" to search another barcode

8. **User clicks "Add to Collection"**
   - Frontend prepares collection data
   - Calls `POST /api/collection/add`
   - Includes:
     - userId
     - Item metadata (title, type, artist, etc.)
     - Barcode reference
     - Condition (default: "Good")
     - Quantity (default: 1)

9. **Backend adds item to collection**
   - `ClientCom.handleCollectionAddRequest()` processes
   - MediaStore stores media item
   - Associates with user's collection
   - Returns confirmation

10. **Frontend redirects to collection**
    - Shows success message
    - Redirects to `collection.html` after 1.5 seconds
    - User sees newly added item

### Lookup Sequence Details

#### ISBN Lookup (Open Library)
```
Input: "9780544720435" (13-digit ISBN)
↓
API: https://openlibrary.org/api/books?bibkeys=ISBN:9780544720435&jscmd=data&format=json
↓
Extract:
- title: "The Great Gatsby"
- authors[0].name: "F. Scott Fitzgerald"
- publish_date: "1925"
- cover.medium: "https://covers.openlibrary.org/..."
- publishers[0]: "Scribner"
- number_of_pages: 180
↓
Return: Complete book metadata
```

#### Open Food Facts Lookup
```
Input: "5099750066429" (UPC/EAN)
↓
API: https://world.openfoodfacts.org/api/v0/product/5099750066429.json
↓
Extract:
- product_name: "Movie Title DVD"
- brands: "Studio Name"
- image_url: "..."
- categories: "DVDs, Media"
↓
Detect media type from name/categories
↓
Return: Product information with detected type
```

#### Local Catalog Lookup
```
Input: Any barcode
↓
Query: SELECT * FROM media_items WHERE barcode LIKE ?
↓
Return: First matching item from database
```

---

## Integration Points

### 1. With Collection Management

**Before:** User had to manually enter all information on `add-item.html`

**After:** 
- Barcode scanner pre-fills information
- User reviews and adds to collection
- Reduces data entry friction

**Connection:**
```
barcode.html → handleBarcodeScan() → /api/catalog/barcode → displayResults()
→ addItemFromBarcode() → /api/collection/add → collection.html
```

### 2. With Dashboard Navigation

**Before:** Dashboard showed basic action options

**After:** Dashboard includes:
- Direct Barcode Scanner link
- Direct Add Item link (manual entry)
- Both workflows equally accessible

**File:** `dashboard.js` additions

### 3. With Add Item Form

**Before:** Add Item was manual-only entry

**After:** Quick link to barcode scanner at top of form
- Users with barcodes get faster path
- Users without can still enter manually

**File:** `add-item.html` quick lookup section

### 4. Error Handling

**API Level:**
- Invalid JSON → HTTP 400
- Missing barcode → HTTP 400
- Item not found → HTTP 404 (still success:false)
- Network timeout → Error message to user

**Frontend Level:**
- Network errors → Error message display
- Validation errors → Clear error message
- Not found → "Add manually?" suggestion

---

## Testing & Verification

### Manual Testing Checklist

#### Barcode Scanner Page
- [ ] Page loads without errors
- [ ] User greeting displays
- [ ] Input field auto-focused
- [ ] Can type barcode manually
- [ ] Search button works
- [ ] Enter key triggers search
- [ ] Loading spinner appears during search
- [ ] Results display correctly
- [ ] Can add item to collection
- [ ] Redirects to collection after add
- [ ] "Scan Again" clears form

#### Integration Points
- [ ] Dashboard → Barcode Scanner button works
- [ ] Dashboard → Add Item button works
- [ ] Add Item page has barcode scanner link
- [ ] Barcode scanner link navigates correctly

#### API Endpoint
- [ ] POST request accepted
- [ ] GET request rejected (405)
- [ ] Missing barcode returns 400
- [ ] Invalid JSON returns 400
- [ ] Found item returns 200
- [ ] Not found item returns 404

#### Data Sources
- [ ] ISBN lookup works (test: 9780544720435)
- [ ] OpenFoodFacts lookup works (test: 5099750066429)
- [ ] Local catalog lookup works
- [ ] Correct source indicated in response

#### Error Handling
- [ ] Network timeout handled gracefully
- [ ] Empty barcode shows error
- [ ] Malformed JSON shows error
- [ ] Not found shows helpful message

### API Testing

#### Test with curl
```bash
# Successful ISBN lookup
curl -X POST http://localhost:8080/api/catalog/barcode \
  -H "Content-Type: application/json" \
  -d '{"barcode": "9780544720435"}'

# Not found
curl -X POST http://localhost:8080/api/catalog/barcode \
  -H "Content-Type: application/json" \
  -d '{"barcode": "0000000000000"}'

# Missing barcode
curl -X POST http://localhost:8080/api/catalog/barcode \
  -H "Content-Type: application/json" \
  -d '{}'

# Wrong method
curl -X GET http://localhost:8080/api/catalog/barcode
```

#### Test Barcodes
| Type | Value | Expected Item |
|------|-------|---------------|
| ISBN-13 | 9780544720435 | The Great Gatsby |
| ISBN-13 | 9780451524935 | 1984 |
| ISBN-13 | 9781250127426 | Six of Crows |
| UPC | 5099750066429 | (Product from Open Food Facts) |

---

## Troubleshooting

### Issue: "Network timeout" error

**Cause:** External API taking too long to respond

**Solution:**
- Check internet connectivity
- Verify external APIs are accessible:
  - `openlibrary.org`
  - `openfoodfacts.org`
- Increase timeout in BarcodeService.TIMEOUT_MS if needed
- Check backend logs for detailed error

### Issue: Barcode not found in any source

**Causes:**
1. Barcode format not recognized
2. Item not in Open Library or Food Facts database
3. Barcode doesn't exist in local catalog

**Solution:**
- User can add item manually from `add-item.html`
- Consider adding to local catalog for future lookups
- Try different barcode format if alternative exists

### Issue: API returns 500 error

**Cause:** Unhandled exception in Java backend

**Solution:**
- Check server logs for stack trace
- Verify barcode parameter is properly formatted string
- Test with simpler barcode values
- Restart backend server

### Issue: Frontend not loading

**Cause:** JavaScript error or missing file

**Solution:**
- Check browser console for errors
- Verify `barcode.js` and `barcode.html` exist
- Check API_BASE_URL is correct
- Verify user is authenticated

### Issue: Item added but shows wrong data

**Cause:** Wrong data source precedence or API response

**Solution:**
- Check which source returned data (shown in response)
- Verify external API is returning correct data
- For Open Library: Check ISBN format (13 digits)
- For Food Facts: May return partial data, edit after adding

### Issue: Cover image not loading

**Cause:** External image URL broken or slow

**Solution:**
- This is non-critical (fallback to gray box)
- User can add cover image manually later
- Not a blocker for item addition

---

## Future Enhancements

### Phase 1 (Current)
✓ Text-based barcode entry
✓ Multi-source lookup
✓ Basic item metadata

### Phase 2 (Planned)
- [ ] Physical barcode scanner device integration
- [ ] Barcode image recognition (camera)
- [ ] QR code support
- [ ] Barcode validation (check digits)

### Phase 3 (Future)
- [ ] Dedicated media database (MusicBrainz, IGDB, etc.)
- [ ] Barcode caching for performance
- [ ] User-submitted barcode data
- [ ] Barcode marketplace integration
- [ ] Mobile app with native scanning

---

## Summary

The barcode scanner integration provides:
✓ Quick item lookup from multiple sources
✓ Seamless integration with collection management
✓ User-friendly interface
✓ Fallback to manual entry
✓ Foundation for future enhancements

All components work together to provide a streamlined experience for adding items to collections.
