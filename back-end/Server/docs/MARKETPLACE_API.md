# Marketplace API

The marketplace is now wired to support listing creation, listing query, and completed sales.

## Platform fee
Every completed sale applies a 3% platform fee.

- platformFee = grossPrice * 0.03
- payoutAmount = grossPrice - platformFee
- funds are directed to bank account: BANK-ACCOUNT-001

## Endpoints

### Create listing
POST /api/marketplace/create

Body:
{
  "sellerId": "user-123",
  "itemId": "item-456",
  "price": 49.99,
  "currency": "USD",
  "status": "active"
}

### List seller listings
GET /api/marketplace/list?sellerId=user-123

### Complete sale
POST /api/marketplace/sale

Body:
{
  "listingId": "listing-1",
  "sellerId": "user-123",
  "buyerId": "user-999",
  "price": 49.99
}

Response includes:
- grossPrice
- platformFeeRate
- platformFee
- payoutAmount
- bankAccount
