# Changelog

All notable changes to TrangNgữ are recorded here.

## [0.1.0] - 2026-08-29

### Added

- Account-free translation for digital, scanned, and mixed PDFs up to 15 pages and 25 MB.
- Server-only Gemini translation with schema-constrained JSON and exact block-ID validation.
- Google Document AI OCR routing for scan-like pages.
- Side-by-side layout review, optional block corrections, and searchable fixed-layout PDF export.
- Firestore-backed daily and monthly usage controls without saving uploaded documents.
- A single-container React and Fastify deployment for Google Cloud Run.

### Verified

- Deployed `trangngu-00002-h2h` publicly in `asia-southeast1` with 100% traffic.
- Completed the two-page mixed demo through real OCR, translation, review, and export.
- Passed the local quality gate and desktop/mobile production browser checks.
