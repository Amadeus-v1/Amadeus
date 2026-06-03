# Backend implementation plan

## Current backend scope
The backend now covers the main core areas of the app:

1. User accounts and authentication foundations
   - user creation and login
   - session creation and refresh-token support

2. Physical media catalog and ownership
   - search for albums, CDs, DVDs, Blu-ray
   - add and list user collection items
   - cover metadata and image fingerprint support

3. Marketplace foundation
   - create listings
   - list seller listings
   - complete sales with a 3% platform fee
   - payout metadata routed to the configured bank account

4. Image scanning and catalog matching
   - image-to-catalog matching using image fingerprints
   - optional text-hint matching for cover-based lookup

## Architecture summary
- API layer: API.java and ClientCom.java
- Data storage:
  - UserStore.java for account data
  - AuthStore.java for session + refresh-token primitives
  - MediaStore.java for catalog and collection storage
  - MarketplaceStore.java for marketplace listings and sales
- Matching layer:
  - ImageMatchService.java for image fingerprint analysis

## Frontend integration notes
- The auth token/session layer is backend-ready for cookie-based frontend storage.
- The image-scanning route is exposed for frontend image upload and result display.
- Marketplace endpoints are JSON-first and ready for a frontend UI.

## Recommended next phase
1. Add real OCR and image similarity scoring.
2. Add user identity and ownership validation for marketplace listings.
3. Add listing search, pagination, and filtering.
4. Add payment callback + payout ledger auditing.
5. Add social/friends collection sharing. ✅ Implemented via /api/friends/add, /api/friends/list, and /api/friends/collections.
