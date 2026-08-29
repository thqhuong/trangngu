# TrangNgữ architecture

## The problem

Translation changes text length. Scanned PDFs may have no embedded text at all. A useful result must recover words and their positions, translate without following instructions hidden in a document, fit the new text into constrained regions, and produce a readable PDF without retaining the source file.

## One-service approach

```text
React browser
  |  upload PDF + target language
  v
Fastify on Cloud Run
  |-- validation and request ID
  |-- PDF.js embedded-text extraction
  |-- Document AI OCR fallback for scan-like pages
  |-- block normalization and reading order
  |-- Gemini structured block translation
  |-- signed review session
  `-- pdf-lib/Poppler/Noto fixed-layout export
          |
          `-- translated PDF response

Firestore <---- salted usage counters only
Secret Manager -> server credentials only
```

The built React assets and API share one container and origin. This avoids cross-origin configuration and keeps the competition deployment easy to explain. Long documents and background queues are excluded so a request can finish inside one bounded Cloud Run operation.

## Planned request flow

### Translation

`POST /api/translations` accepts a PDF and target language as multipart data. The server streams newline-delimited JSON progress events for validation, extraction, translation, and review preparation. A successful final event contains page geometry, translated blocks, review flags, and a short-lived signed session token.

1. Reject a non-PDF signature, encrypted file, file over 25 MB, or document outside 1–15 pages.
2. Reserve the job/page allowance in a Firestore transaction before paid-capable provider work.
3. Extract embedded glyphs where they form a usable text layer. Route only scan-like pages to Enterprise Document OCR.
4. Normalize text into stable blocks with page-relative geometry, reading order, approximate style, and confidence.
5. Batch blocks within the selected Gemini model's tested request/output limits.
6. Treat every source block as untrusted data. Require an exact ID mapping and validate the JSON before use.
7. Return the review model and an HMAC-signed token that binds the document hash, geometry, target language, and expiry.

### Export

`POST /api/exports` accepts the original PDF again, the signed token, and corrections keyed by existing block ID. The server verifies the token and SHA-256 document hash, rejects unknown IDs, and rebuilds the PDF without another OCR or Gemini call.

The exporter rasterizes each source page, covers recognized text regions conservatively, and draws searchable translated text using bundled Noto fonts. Text first wraps within its original box, then may shrink to 50% of the inferred source size with a 3.5-point floor. Remaining overflow requires review.

## Security and privacy boundaries

- Gemini and Google Cloud calls occur only on the backend.
- Secret Manager injects the Gemini key and signing materials at runtime.
- Uploaded text is data, never a prompt instruction. The system prompt explicitly forbids following instructions from blocks.
- Source PDFs, text, translations, session tokens, and secrets are excluded from logs.
- Temporary files use per-request directories and are removed in a `finally` path.
- Firestore stores daily/monthly counters, not PDFs or translated content.
- Raw IP addresses are salted and hashed before counter storage.
- The browser cannot modify geometry through the correction map; it can replace text only for signed block IDs.
- Timeouts and one transient retry bound provider work. Validation, safety, and quota failures are not retried.

## Reliability and cost controls

- 25 MB, 15 pages/job, three jobs/day, and 45 pages/day limit worst-case work.
- A Firestore transaction reserves scanned pages before OCR and enforces the 900-page monthly application cap.
- UI submission locking prevents accidental duplicate requests.
- Cloud Run scales from zero to at most two 1-CPU, 2-GiB instances with concurrency two.
- Request identifiers connect browser errors to sanitized structured logs.
- Embedded text avoids OCR cost. Small translation batches limit Gemini output and isolate retry failures.

Application counters and budget alerts are guardrails, not provider billing caps. Provider quotas and pricing must be checked before launch.

## Trade-offs

- **Synchronous work over a queue:** simpler demo and no stored files, but jobs stop at 15 pages and can approach the 600-second request timeout.
- **Fixed-layout output over editable PDF reconstruction:** more faithful visual structure, but the result is not a design-source document.
- **Hashed IP allowance over accounts:** no sign-up friction, but shared networks can share a limit and users can change networks.
- **Raster background plus text layer over direct PDF object editing:** works across digital and scanned inputs, but may increase output size and cannot perfectly reconstruct complex backgrounds.
- **Free-tier Gemini over paid data handling:** lowers cost, but the official free-tier disclosure says content may be used to improve Google products, so sensitive documents must be refused by policy and warning.

## Public interfaces

| Interface | Status | Purpose |
|---|---|---|
| `GET /api/health` | Implemented | Returns non-secret service health |
| `GET /api/config` | Implemented | Returns non-secret limits, languages, and privacy notice |
| `POST /api/translations` | Implemented and production-verified | Validates, extracts/OCRs, translates, and streams review data |
| `POST /api/exports` | Implemented and production-verified | Verifies source/session/corrections and returns a PDF |

The shared contracts define normalized boxes, approximate text style, translation blocks, page layouts, sessions, correction maps, progress events, and public configuration. API documentation must be updated if implementation changes those schemas.

## Related

- [MVP specification](MVP_SPEC.md)
- [AI Studio prompt and schema](AI_STUDIO.md)
- [Deployment guide](DEPLOYMENT.md)
