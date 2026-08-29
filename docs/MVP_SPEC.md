# TrangNgữ MVP specification

## Product definition

**Promise:** Upload a PDF, even a scan, and receive a translated, searchable PDF that keeps the original page structure recognizable.

TrangNgữ focuses on Vietnamese students, educators, nonprofits, and small teams translating foreign-language reports, manuals, forms, and public-information documents. The workflow remains useful for any supported language pair, but the competition story centers on access to information for Vietnamese users.

Existing free translators often lose page structure, fail on scans, or return text that must be manually rebuilt. General chat tools can translate passages but do not provide a dependable document workflow.

## Core workflow

1. The user opens the app without creating an account.
2. The user chooses one of 12 target languages and uploads a PDF.
3. The server validates the file, size, encryption state, and page count.
4. Digital pages use embedded text. Scan-like pages use Document AI OCR.
5. Gemini translates stable text blocks using a strict JSON response schema.
6. The review workspace overlays translated blocks on page previews and flags uncertain or overflowing text.
7. The user corrects flagged blocks and downloads a fixed-layout, searchable translated PDF.

The demo magic moment is a scanned page becoming Vietnamese in place while columns, table lines, images, and page geometry remain aligned in a before/after comparison.

## Limits and supported targets

- PDF only
- 25 MB maximum upload size
- 15 pages per job
- Three jobs and 45 pages per requester per UTC day
- 900 scanned pages reserved globally per calendar month by the application
- 30-minute review/export session
- Vietnamese, English, Simplified Chinese, Japanese, Korean, Thai, Indonesian, French, German, Spanish, Portuguese, and Hindi targets

Embedded-text pages do not consume the Document AI scanned-page counter. A salted hash, not a raw IP address, identifies an unauthenticated requester for abuse controls. This is a pragmatic MVP limit, not a durable user identity.

## MVP exclusions

- Password-protected or encrypted PDFs
- Handwriting-heavy documents
- Vertical or heavily rotated writing
- Text over complex artistic backgrounds where safe replacement is ambiguous
- Pixel-perfect font reproduction or fully editable source files
- Office documents, web pages, or image-only uploads
- Accounts, saved document history, collaboration, or direct Google Drive/Calendar access
- Background jobs for documents above 15 pages

The app should flag content it cannot fit safely instead of silently damaging the page.

## Acceptance criteria

- A new user understands the promise, limits, and privacy behavior immediately.
- A valid digital, scanned, or mixed PDF completes upload, translation, review, correction, and export.
- Gemini returns every expected block ID exactly once, and the server rejects malformed, missing, duplicated, or extra blocks.
- Invalid, encrypted, oversized, over-page-limit, quota-limited, and timed-out requests receive actionable messages.
- The exported PDF remains readable on desktop and mobile, preserves recognizable structure, and contains selectable translated text.
- Double submissions are blocked and transient retries do not repeat successful work.
- No secret or document content appears in browser assets or logs.
- Type checking, linting, unit/integration tests, Playwright tests, and production build pass.
- One real Gemini request and one real Document AI request pass locally and after authorized Cloud Run deployment.
- The stable demo finishes in under three minutes without a mocked AI response.

## Current implementation status

The repository implements the upload/review UI, API routes, PDF inspection/export, Gemini and Document AI adapters, signed sessions, Firestore/memory quota stores, and automated tests. The public Cloud Run deployment, mixed digital/scanned fixture, real Gemini translation, Document AI OCR, uncorrected PDF export, and public MIT-licensed GitHub repository were verified on 2026-08-29. The public AI Studio share link, YouTube demo, and social post remain submission tasks.

## Related

- [Architecture](ARCHITECTURE.md)
- [Privacy](PRIVACY.md)
- [Demo script](DEMO_SCRIPT.md)
