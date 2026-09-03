# Authentication backend foundation

This backend now includes a token-based authentication foundation for frontend use:

- POST /api/auth/session
  - Creates an access token and refresh token for a user
  - Tokens are stored in the backend database for later validation
- POST /api/auth/refresh
  - Refreshes the access token using the refresh token

The browser-cookie part is intentionally left to the frontend, but the backend primitives are now in place for that integration.
