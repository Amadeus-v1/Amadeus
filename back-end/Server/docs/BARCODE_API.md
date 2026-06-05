# Barcode Scanner API

The Barcode Scanner feature allows users to quickly lookup and add media items to their collection by entering or scanning product barcodes (ISBN, UPC, EAN, etc.).

## Overview

The barcode scanner integrates with multiple data sources to provide fast and accurate item lookup:
- **Open Library API** - For book ISBNs (10 or 13 digits)
- **Open Food Facts API** - For product barcodes with media-related items
- **Local Catalog** - Searches existing items in the Amadeus catalog

## API Endpoint

### POST /api/catalog/barcode

Search for media items by barcode.

**Request:**
```json
{
  "barcode": "9780544720435"
}
```

**Parameters:**
- `barcode` (required): The barcode to search. Supports:
  - ISBN-10: 10 digits
  - ISBN-13: 13 digits
  - UPC/EAN: Variable length
  - Any product barcode

**Response (Success):**
```json
{
  "success": true,
  "source": "isbn",
  "barcode": "9780544720435",
  "title": "The Great Gatsby",
  "artist": "F. Scott Fitzgerald",
  "mediaType": "Book",
  "year": 1925,
  "coverUrl": "https://covers.openlibrary.org/b/id/8239658-M.jpg",
  "publisher": "Scribner",
  "pages": 180,
  "format": "Hardcover"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "message": "No item found for barcode: 123456789",
  "barcode": "123456789"
}
```

**Status Codes:**
- `200` - Item found successfully
- `404` - Item not found
- `400` - Invalid barcode format
- `405` - Method not allowed (only POST accepted)

## Barcode Sources

### 1. ISBN Lookup (Open Library)
- Supports ISBN-10 and ISBN-13 formats
- Returns comprehensive book metadata
- Source field: `"isbn"`

**Example ISBN-13:** 9780544720435

### 2. Open Food Facts
- Provides product information via UPC/EAN
- Can identify media formats (CD, DVD, Blu-ray, Video Game)
- Source field: `"openfoodfacts"`

**Example UPC:** 5099750066429

### 3. Local Catalog
- Searches existing Amadeus media catalog
- Fallback option when external APIs don't match
- Source field: `"local"`

## Frontend Integration

### Dedicated Barcode Scanner Page

**Location:** `/front-end/barcode.html`

Features:
- Text input for manual barcode entry
- Real-time search capability
- Displays complete item metadata
- One-click "Add to Collection" functionality
- Automatic redirect to collection on successful add

### Quick Barcode Lookup

Integrated into the Add Item form on `/front-end/add-item.html`:
- Quick link to barcode scanner
- Streamlined workflow for users with barcodes

### Dashboard Integration

Dashboard includes quick action buttons for:
- Barcode Scanner (`/barcode.html`)
- Manual Item Entry (`/add-item.html`)

## Response Fields Explained

- **success**: Boolean indicating if item was found
- **source**: Where the item data came from (isbn, openfoodfacts, local)
- **barcode**: The barcode that was searched
- **title**: Name/title of the media item
- **artist**: Creator/author/brand
- **mediaType**: Type of media (Book, CD, DVD, Vinyl, Cassette, Video Game, etc.)
- **year**: Release/publication year
- **coverUrl**: URL to item cover image
- **publisher**: Publisher/manufacturer name
- **pages**: Number of pages (books)
- **format**: Specific format (Hardcover, Remaster, etc.)

## Error Handling

### Empty Barcode
```json
{
  "success": false,
  "message": "Barcode cannot be empty"
}
```

### Invalid JSON Request
```
HTTP 400
{
  "message": "Invalid JSON"
}
```

### Method Not Allowed
```
HTTP 405
{
  "message": "Method Not Allowed"
}
```

## Backend Service: BarcodeService

**Location:** `/back-end/Server/app/src/main/java/org/amadeus/amadeusserver/BarcodeService.java`

### Key Methods

#### `searchByBarcode(String barcode)`
Main entry point that:
1. Validates the barcode
2. Attempts ISBN lookup for 10 or 13-digit codes
3. Falls back to Open Food Facts
4. Searches local catalog
5. Returns best match or "not found" response

#### `lookupISBN(String isbn)`
- Queries Open Library API
- Extracts title, author, publication date, cover image
- Returns Book media type

#### `lookupOpenFoodFacts(String barcode)`
- Queries Open Food Facts API
- Detects media type from product description
- Extracts product information

#### `lookupLocalCatalog(String barcode)`
- Searches MediaStore for matching barcode
- Returns first matching item

#### `detectMediaType(String description)`
- Analyzes text to identify media type
- Recognizes: CD, DVD, Blu-ray, Vinyl, Cassette, Book, Video Game

## Usage Examples

### Example 1: Looking up a Book by ISBN
```bash
curl -X POST http://localhost:8080/api/catalog/barcode \
  -H "Content-Type: application/json" \
  -d '{"barcode": "9780544720435"}'
```

### Example 2: Looking up a DVD by UPC
```bash
curl -X POST http://localhost:8080/api/catalog/barcode \
  -H "Content-Type: application/json" \
  -d '{"barcode": "5099750066429"}'
```

### Example 3: Frontend Integration
```javascript
const response = await fetch('http://localhost:8080/api/catalog/barcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: '9780544720435' })
});

const result = await response.json();

if (result.success) {
    console.log(`Found: ${result.title} by ${result.artist}`);
    // Pre-fill add-item form with result data
} else {
    console.log('Item not found');
}
```

## Configuration

### API Timeouts
- Default timeout: 5000ms (5 seconds)
- Configurable in `BarcodeService.TIMEOUT_MS`

### User Agent
- Requests identify as: `Amadeus-MediaCollector/1.0`
- Helps external APIs provide appropriate responses

## Limitations & Future Enhancements

### Current Limitations
- ISBN lookup limited to 13-digit format validation
- Open Food Facts not specifically tuned for media
- No barcode image recognition (text entry only)
- Limited to three data sources

### Potential Enhancements
1. Add dedicated media barcode database (MusicBrainz, VideoGameDB)
2. Implement barcode image scanning/recognition
3. Crowd-source barcode data from user submissions
4. Add caching for frequently-looked-up barcodes
5. Support QR codes for future marketplace integration
6. Add barcode validation (check digits)

## Testing

### Manual Testing
1. Navigate to `http://localhost:3000/barcode.html` (or equivalent frontend URL)
2. Enter a known ISBN-13 (e.g., 9780544720435)
3. Click "Search"
4. Verify results display correctly
5. Click "Add to Collection"

### API Testing
Use the API Tester endpoint or curl commands to test directly with various barcode formats.

### Test Barcodes
- ISBN-13 (Book): `9780544720435` (The Great Gatsby)
- ISBN-10 (Book): `9876543210` (may not exist)
- Generic UPC: `5099750066429`
