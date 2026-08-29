# TrangNgữ demo script

Target length: 2 minutes 30 seconds. Keep a 30-second buffer for network variance. Use a real, pre-tested Gemini response; do not substitute a recorded or hard-coded result while presenting it as live.

## Stable demo fixture

Use the checked-in rights-safe [two-page English community flood-preparedness guide](../outputs/trangngu-demo-flood-guide.pdf):

- Page 1: embedded text, two columns, heading, icons, short bullet list, and a small supply table.
- Page 2: a clean 200–300 DPI scan of a printed page with no embedded text.
- No personal, confidential, copyrighted-without-permission, or safety-critical claims.
- Total file size below 3 MB so upload speed does not dominate the demo.
- Page 1 intentionally uses a compact warning/table layout; confirm during production preflight that at least one translated block is flagged. If model wording changes and no block is flagged, revise the rights-safe source fixture rather than faking a review state.

The fixture was created specifically for TrangNgữ, contains no personal information, and is safe to keep in the public repository.

## Preflight

Run this on the deployed revision, not only locally:

1. Confirm the Cloud Run URL is public and `/api/health` returns `{ "status": "ok" }`.
2. Confirm 100% traffic targets the latest tested revision.
3. Run the two-page fixture to Vietnamese twice and inspect both exports.
4. Confirm page 2 used Document AI and the translation used the configured Gemini model through sanitized diagnostics, not visible document logs.
5. Confirm the result opens, both pages render, and Vietnamese text can be selected/copied.
6. Test the comparison control, flagged correction, text-box drag/resize/reset, point-size control, keep-original/restore control, download, desktop layout, and mobile layout.
7. Clear any visible test filenames or private browser tabs before recording.
8. Have a second rights-safe fixture ready. If providers fail live, state the failure honestly rather than showing a fake response.

## Spoken and screen sequence

### 0:00–0:20 — Problem

**Say:** “Many useful reports and guides reach Vietnamese readers as PDFs. Ordinary translators often lose the layout, and scanned pages may have no text to copy at all.”

**Show:** TrangNgữ landing/workbench with the promise and privacy notice visible.

### 0:20–0:40 — Input

**Say:** “TrangNgữ translates the words while keeping the page recognizable. It accepts digital and scanned PDFs without an account.”

**Show:** Choose Vietnamese, upload the two-page guide, and point out the 25 MB, 15-page limit. Submit once.

### 0:40–1:10 — Real processing

**Say:** “It extracts normal PDF text first and sends only scan-like pages to Google Document AI. Gemini translates structured text blocks on the server, where the API key stays private.”

**Show:** Real validation, extraction/OCR, translation, and preparation progress. Do not cut to a simulated result.

### 1:10–1:45 — Magic moment

**Say:** “The scanned page is now Vietnamese in place. The columns, table, icons, and page geometry still line up.”

**Show:** Drag the original/translated comparison control across page 2, zoom the table, then switch briefly to page 1.

### 1:45–2:05 — Human control

**Say:** “Translation expansion can make a block too tight, while notation such as chord symbols should not be translated at all. TrangNgữ gives people control instead of silently breaking the page.”

**Show:** Open the pre-tested review flag, shorten the translated wording, then drag the green corner and adjust point size. Use “Keep original” on a notation-only block, restore it once, and briefly show the width/height reset action.

### 2:05–2:25 — Useful output and impact

**Say:** “The downloaded PDF keeps the visual structure and adds searchable translated text. That can make foreign-language learning and public information much easier to use in Vietnam.”

**Show:** Download, open the PDF, select a Vietnamese sentence, and zoom out to both pages.

### 2:25–2:30 — Close

**Say:** “TrangNgữ is built with Gemini and Google Document AI and runs publicly on Google Cloud Run.”

**Show:** Return to the verified public URL. Use this line only after deployment and production tests actually pass.

## Recording notes

- Keep the browser zoom and pointer large enough for mobile video viewers.
- Blur the project number or other identifiers if they appear; never show secret names next to secret values.
- Do not open logs containing uploaded content. Production logs should be sanitized before recording anyway.
- Add captions and put the public URL, GitHub repository, and AI Studio link in the video description only after each is public.
- The final video must be public, not unlisted, if competition rules require public visibility.

## Related

- [MVP specification](MVP_SPEC.md)
- [AI Studio prompt](AI_STUDIO.md)
- [Submission checklist](SUBMISSION_CHECKLIST.md)
