# Physical Media Collection Backend

This backend is the initial core for a Discogs-style collection app focused on physical media ownership.

## Priority direction
1. Collection and cataloging of owned media
2. Search and discovery for albums, CDs, DVDs, and Blu-ray
3. Marketplace and trading as a later phase

## Current API

### Search catalog
GET /api/catalog/search?q=radiohead

Example response:
{
  "query": "radiohead",
  "items": [
    {
      "id": "...",
      "title": "OK Computer",
      "artist": "Radiohead",
      "mediaType": "record",
      "format": "LP",
      "year": 1997,
      "barcode": "...",
      "coverUrl": "...",
      "notes": "",
      "source": "manual"
    }
  ]
}

### Add an item to a user collection
POST /api/collection/add

Body:
{
  "userId": "user-123",
  "title": "OK Computer",
  "artist": "Radiohead",
  "mediaType": "record",
  "format": "LP",
  "year": 1997,
  "barcode": "123456789",
  "coverUrl": "https://example.com/cover.jpg",
  "notes": "Test press",
  "isTestPress": true,
  "collection": {
    "conditionLabel": "Near Mint",
    "ownIt": true,
    "notes": "Purchased in 2024"
  }
}

### List a user's collection
GET /api/collection/list?userId=user-123

### User account endpoints
POST /api/user/create
POST /api/user/login

## Notes for frontend integration
- The collection endpoints are intentionally simple and JSON-first.
- The catalog search returns a lightweight list for UI cards and scanner result views.
- Marketplace functionality is intentionally deferred until collection and catalog basics are stable.

### Barcode Scanner endpoint
POST /api/catalog/barcode

Body:
{
  "barcode": "9780544720435"
}

Example response (success):
{
  "success": true,
  "source": "isbn",
  "barcode": "9780544720435",
  "title": "The Great Gatsby",
  "artist": "F. Scott Fitzgerald",
  "mediaType": "Book",
  "year": 1925,
  "coverUrl": "https://covers.openlibrary.org/b/id/8239658-M.jpg"
}

Example response (not found):
{
  "success": false,
  "message": "No item found for barcode: 123456789",
  "barcode": "123456789"
}

Supports ISBN-10, ISBN-13, UPC, and EAN codes. See back-end/Server/docs/BARCODE_API.md for detailed documentation.
