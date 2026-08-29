# TrangNgữ privacy notice and engineering policy

## Plain-language notice

TrangNgữ is designed to translate a PDF during the current request and not save the original file or translated result. You must download the result before the review session expires.

Your document content is sent to Google services when needed:

- Google Cloud Document AI reads scan-like pages to recover text and layout.
- The Gemini Developer API translates extracted text blocks.

The Gemini free tier currently states that submitted content may be used to improve Google products. Do not upload confidential, personal, regulated, or otherwise sensitive documents. Review the [official Gemini pricing and data-use disclosure](https://ai.google.dev/gemini-api/docs/pricing) because terms can change.

## Data handled

| Data | Purpose | Planned retention by TrangNgữ |
|---|---|---|
| Original PDF | Extraction, OCR, preview, and export | Request lifetime only; temporary files deleted after processing |
| Extracted and translated text | Translation and review | Request/session response only; not stored in Firestore or logs |
| Corrected block text | Final export | Export request only |
| Document SHA-256 hash | Bind export to the reviewed source | Inside the 30-minute signed session, not a document database |
| Salted requester hash | Daily abuse limits | Counter records only; no raw IP stored |
| Job, page, and OCR counts | Quota and cost controls | Daily/monthly Firestore counter records |
| Request ID, stage, duration, status class | Production diagnosis | Cloud logging retention configured by the project owner |

The app does not require an account, save a document history, or request Google Drive, Gmail, or Calendar access in the MVP.

## Logging rules

Logs may contain a generated request ID, processing stage, duration, page count, extraction method, provider HTTP/status class, and sanitized application error code.

Logs must never contain PDFs, extracted or translated text, filenames when avoidable, correction content, raw IP addresses, Gemini prompts/responses, provider credentials, signed session tokens, authorization headers, or secret values.

## Deletion and failure handling

- Store temporary files in a unique per-request directory outside the application source tree.
- Delete temporary input, rendered pages, OCR artifacts, and output in a `finally` block on success, validation failure, provider failure, client disconnect, or timeout.
- Do not rely only on a successful response handler for cleanup.
- Do not persist an upload to Cloud Storage for the synchronous MVP.
- Expired signed sessions cannot be exported; the user must process the PDF again.
- If temporary-file deletion fails, emit a sanitized cleanup error without a path derived from user input and allow platform instance cleanup as a backstop.

## User choices and limitations

The upload screen must show the provider/data-use warning before submission. The user can cancel before upload and can download or discard the translated result. There is no server-side saved result to delete.

The salted-IP limit is not an identity system. People sharing an internet connection can share an allowance, and changing networks may produce another allowance. This limitation should be explained if a user reaches the daily cap.

## Before public launch

- Verify this notice against the implemented storage and logging behavior.
- Recheck current Gemini, Document AI, Firestore, and Cloud Logging data-use and retention terms.
- Configure Cloud Logging retention appropriately and restrict project access.
- Run a repository and built-asset secret scan.
- Confirm no uploaded content appears in error reporting, analytics, screenshots, or the demo video.
- Add a contact method and jurisdiction-appropriate terms if the app moves beyond a competition demo.

## Related

- [Architecture](ARCHITECTURE.md)
- [Deployment guide](DEPLOYMENT.md)
