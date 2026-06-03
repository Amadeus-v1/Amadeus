# Amadeus
Collection management and marketplace.

## Backend scope
This project now includes:
- physical media catalog/search endpoints
- user collection add/list endpoints
- friend follow and friend-collection viewing endpoints
- initial backend documentation in back-end/Server/docs/BACKEND_API.md

## Next priority
1. Collection and ownership tracking
2. Search and catalogue enrichment
3. Marketplace and trading features

## Marketplace fee policy
Every completed sale applies a 3% platform fee and routes the payout to the configured bank account.
See back-end/Server/docs/MARKETPLACE_API.md for the API contract.

## Backend foundations now included
- auth session and refresh-token primitives: back-end/Server/docs/AUTH_API.md
- image scanning / catalog matching foundation: back-end/Server/docs/IMAGE_SCANNING_API.md
