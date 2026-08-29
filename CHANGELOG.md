# Changelog

All notable changes to TrangNgữ are recorded here.

## [0.1.0] - 2026-08-29

### Added

- Account-free translation for digital, scanned, and mixed PDFs up to 15 pages and 25 MB.
- Server-only Gemini translation with schema-constrained JSON and exact block-ID validation.
- Google Document AI OCR routing for scan-like pages.
- Side-by-side layout review, optional wording corrections, drag/slider text-box resizing, and searchable fixed-layout PDF export.
- Firestore-backed daily and monthly usage controls without saving uploaded documents.
- A single-container React and Fastify deployment for Google Cloud Run.
- A private, Secret Manager-protected owner dashboard for privacy-safe aggregate usage, reliability, OCR allowance, and observed Gemini quota signals.
- A balanced one-page sample and accessible drag-to-reveal/side-by-side homepage comparison using reviewed Gemini output, with the distracting download controls removed.
- Conservative music/technical-token filtering before Gemini, with model instructions to preserve remaining non-translatable blocks unchanged.
- Per-block point-size controls and a keep-original/restore action that leaves excluded source regions untouched in exported PDFs.
- OCR-aware initial typography sizing for dense CJK paragraphs and a homepage-logo favicon.
- Smaller Gemini batches for dense, image-only music PDFs so schema-valid output is not truncated by the response token ceiling.

### Verified

- Deployed `trangngu-00008-n48` publicly in `asia-southeast1` with 100% traffic.
- Completed the two-page mixed demo through real OCR, translation, review, and export.
- Passed the local quality gate and desktop/mobile production browser checks.
- Exercised the supplied 15-page image-only music PDF in production; the first run exposed and informed the dense-output batching fix, while the post-fix rerun remains pending the normal daily-quota reset.
