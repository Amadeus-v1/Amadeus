# Image scanning and catalog matching

The backend now supports a first-pass image scanning workflow:

- POST /api/catalog/scan
  - Accepts an image as base64 (`imageBase64`)
  - Optional text hint (`textHint`) can be supplied by the frontend
  - Uses a simple fingerprint + text-hint similarity search against the catalog database

Implementation notes:
- This is a backend-first matching layer for album-cover recognition.
- It can be upgraded later to full OCR or machine-learning similarity scoring.
- The current path uses a lightweight image fingerprint and catalog text hints to rank likely matches.
