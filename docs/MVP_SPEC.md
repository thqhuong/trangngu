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
5. The server leaves obvious notation and technical-only blocks untouched, then Gemini translates prose and meaningful labels using a strict JSON response schema and a second preserve-unneeded-content instruction.
6. The review workspace overlays translated blocks on page previews and flags uncertain or overflowing text.
7. The user can correct wording, resize a translated text box by dragging its green corner or using width and height controls, change the text point size, or keep the original source area untouched.
8. The user downloads a searchable fixed-layout PDF containing only the reviewed translation blocks and layout choices.

The demo magic moment is a scanned page becoming Vietnamese in place while columns, table lines, images, and page geometry remain aligned in a before/after comparison.

The homepage includes a pre-tested, balanced one-page sample so a visitor can drag a reveal line or switch to side-by-side mode before spending quota. The translated sample is reviewed Gemini output, not a browser-only mock. Sample download buttons are intentionally omitted so the section demonstrates the outcome without distracting from the upload workflow.

## Limits and supported targets

- PDF only
- 25 MB maximum upload size
- 15 pages per job
- Three jobs and 45 pages per requester per UTC day
- 900 scanned pages reserved globally per calendar month by the application
- 30-minute review/export session
- Vietnamese, English, Simplified Chinese, Japanese, Korean, Thai, Indonesian, French, German, Spanish, Portuguese, and Hindi targets

Embedded-text pages do not consume the Document AI scanned-page counter. A salted hash, not a raw IP address, identifies an unauthenticated requester for abuse controls. This is a pragmatic MVP limit, not a durable user identity.

The owner can authenticate through the private dashboard and enable testing mode for the current browser tab. Owner mode bypasses only the three-job/45-page daily requester counters; it does not change per-job limits, the monthly OCR guardrail, provider quotas, Cloud Run scaling, or the Gemini tier.

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
- A valid digital, scanned, or mixed PDF completes upload, translation, review, wording/box-size correction, and export.
- A user can make the selected translated box larger or smaller with a drag handle or precise controls, change/reset its text size, keep/restore the original source area, and export the adjusted layout.
- The server rejects unknown, malformed, or page-escaping box adjustments, unknown keep-original IDs, and invalid point sizes.
- Music chord symbols such as `Bbmaj7`, notation-only blocks, and page numbers do not create translation overlays; mixed blocks still preserve these tokens within translated prose.
- Gemini returns every expected block ID exactly once, and the server rejects malformed, missing, duplicated, or extra blocks.
- Invalid, encrypted, oversized, over-page-limit, quota-limited, and timed-out requests receive actionable messages.
- The exported PDF remains readable on desktop and mobile, preserves recognizable structure, and contains selectable translated text.
- Double submissions are blocked and transient retries do not repeat successful work.
- No secret or document content appears in browser assets or logs.
- Type checking, linting, unit/integration tests, Playwright tests, and production build pass.
- One real Gemini request and one real Document AI request pass locally and after authorized Cloud Run deployment.
- The stable demo finishes in under three minutes without a mocked AI response.
- The owner can inspect aggregate pages, jobs, exports, OCR allowance, failures, and observed Gemini quota errors without exposing document content.
- An authenticated owner can exceed the public daily requester allowance for production testing, while an unauthenticated or invalid-key request remains subject to the normal limits.

## Current implementation status

The repository implements the upload/review UI, API routes, PDF inspection/export, Gemini and Document AI adapters, signed sessions, Firestore/memory quota stores, and automated tests. The public Cloud Run deployment, mixed digital/scanned fixture, real Gemini translation, Document AI OCR, uncorrected PDF export, and public MIT-licensed GitHub repository were verified on 2026-08-29. The public AI Studio share link, YouTube demo, and social post remain submission tasks.

## Related

- [Architecture](ARCHITECTURE.md)
- [Privacy](PRIVACY.md)
- [Demo script](DEMO_SCRIPT.md)
