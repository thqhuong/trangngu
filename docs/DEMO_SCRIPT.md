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
- **Voiceover (Tiếng Việt):** "Hàng triệu học sinh, nhà nghiên cứu và doanh nghiệp tại Việt Nam mỗi ngày phải tiếp cận các tài liệu, cẩm nang quốc tế dưới định dạng PDF. Tuy nhiên, các công cụ dịch thông thường luôn làm vỡ nát bố cục trang, và hoàn toàn bất lực trước các tài liệu scan không thể copy chữ."
- **Subtitles (English):** *Every day, students, educators, and organizations in Vietnam need to read foreign PDFs. But standard translation breaks page layouts, and scanned documents have no selectable text.*
- **Show:** TrangNgữ landing/workbench with the promise and privacy notice visible.

### 0:20–0:45 — Input
- **Voiceover (Tiếng Việt):** "Đó là lý do TrangNgữ ra đời — với tôn chỉ: 'Dịch chuẩn từ ngữ, giữ trọn trang in'. TrangNgữ xử lý cả PDF số lẫn PDF scan mà không cần đăng ký tài khoản, hoàn toàn tôn trọng quyền riêng tư."
- **Subtitles (English):** *That is why we built TrangNgữ — 'Translate the words, keep the page'. It handles both digital and scanned PDFs with zero login required and absolute data privacy.*
- **Show:** Choose Vietnamese, upload the two-page guide (`trangngu-demo-flood-guide.pdf`), and point out the 25 MB, 15-page limit. Click "Translate PDF".

### 0:45–1:15 — Real processing & Google Tech Stack
- **Voiceover (Tiếng Việt):** "Hệ thống tự động phân tích trang: Với trang PDF thường, TrangNgữ trích xuất văn bản trực tiếp. Với trang scan, Google Cloud Document AI nhận diện từng khối chữ với tọa độ chuẩn xác. Toàn bộ nội dung được Google Gemini dịch thuật thông minh theo JSON Schema nghiêm ngặt, giữ trọn ngữ cảnh mà không làm lộ dữ liệu."
- **Subtitles (English):** *The engine extracts digital text directly and routes scans to Google Document AI for coordinate OCR. Google Gemini translates structured blocks via strict JSON Schema, preserving context while keeping secrets server-side.*
- **Show:** Real validation, Document AI OCR, Gemini translation, and preparation progress.

### 1:15–1:45 — Magic moment & Bidirectional Auto-Fit
- **Voiceover (Tiếng Việt):** "Và đây là điều kỳ diệu: Bố cục 2 cột, bảng biểu và biểu tượng vẫn giữ nguyên vị trí hoàn hảo. Đặc biệt, tính năng Auto-Fit thông minh tự động tinh chỉnh cỡ chữ vừa khít từng ô — tiếng Việt dài hơn tiếng Anh nhưng tuyệt đối không bị tràn hay đè chữ."
- **Subtitles (English):** *Here is the magic moment: Columns, tables, and icons remain perfectly aligned. Our bidirectional Auto-Fit algorithm automatically scales text to fit within its designated space without overflowing.*
- **Show:** Drag the original/translated comparison slider across page 2 and page 1.

### 1:45–2:05 — Human control & Live Review
- **Voiceover (Tiếng Việt):** "TrangNgữ trao quyền kiểm soát cho bạn. Bạn có thể chỉnh sửa trực tiếp câu từ, kéo giãn khung chữ, hoặc chọn 'Giữ nguyên' cho các ký hiệu chuyên ngành. Mọi tinh chỉnh đều cập nhật tức thì trên bản xem trước."
- **Subtitles (English):** *TrangNgữ puts users in full control. You can edit translation text, resize boxes with live font scaling, or preserve original notations with a single click.*
- **Show:** Click on a translation block, edit wording, drag green resize handle, and toggle "Keep original".

### 2:05–2:25 — Searchable PDF Export & Close
- **Voiceover (Tiếng Việt):** "Chỉ trong tích tắc, bạn nhận về tệp PDF hoàn chỉnh: sắc nét, giữ nguyên bố cục và lớp chữ tiếng Việt có thể tìm kiếm, bôi đen và sao chép dễ dàng. TrangNgữ được xây dựng bằng Google AI Studio, Gemini, Document AI và đang chạy trực tiếp trên Google Cloud Run."
- **Subtitles (English):** *In seconds, you download a complete, searchable Vietnamese PDF with layout intact. Built with Google AI Studio, Gemini, Document AI, and deployed live on Google Cloud Run.*
- **Show:** Download, open the PDF in viewer, select/copy Vietnamese sentence, and return to the live Cloud Run URL.

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
