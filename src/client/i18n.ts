import { languageOptions, type PublicConfig } from "../shared/contracts";
import { ApiError } from "./api";

export type Locale = "en" | "vi";

export const DEFAULT_CONFIG: PublicConfig = {
  maxPdfBytes: 25 * 1024 * 1024,
  maxPagesPerJob: 15,
  dailyJobLimit: 3,
  dailyPageLimit: 45,
  languages: [...languageOptions],
  privacyNotice: "Files are processed temporarily and are not stored by TrangNgữ.",
};

export const copy = {
  en: {
    badge: "Built for real-world documents", heroTitleA: "Translate the words.", heroTitleB: "Keep the page.",
    heroBody: "Turn text-based or scanned PDFs into readable translations while preserving columns, tables, images, and page structure.",
    signUp: "No account needed", deleted: "Files are not retained", worksScans: "Works with scanned PDFs",
    uploadTitle: "Drop a PDF here", uploadHint: "or choose a file from your device", chooseFile: "Choose PDF",
    pdfOnly: "PDF only", fileLimit: "Up to 25 MB", pageLimit: "Up to 15 pages", selected: "Ready to translate",
    checking: "Checking your PDF…", pages: "pages", remove: "Remove file", targetLabel: "Translate into", granularityLabel: "Translation Mode",
    granularityByBlock: "By block (Default)", granularityByLine: "By line",
    granularityByBlockHint: "Best for overall document look & flow, but minor incorrections can be harder to isolate.",
    granularityByLineHint: "Translates each line independently. Fits line bounding boxes, but font size per line may vary.",
    translate: "Translate PDF", preparingUpload: "Checking file…", dailyLimit: "3 jobs or 45 pages per day",
    ownerMode: "Owner testing", disableOwnerMode: "Disable owner testing", ownerLimitBypass: "Owner testing · daily limit bypassed",
    privacyTitle: "Before you upload",
    privacyBody: "Your file is processed temporarily by Google Document AI and Gemini, then discarded. Free-tier Gemini processing may be used by Google to improve its products.",
    privacyWarning: "Do not upload confidential, private, or sensitive documents.",
    howTitle: "From scan to structured translation", stepOne: "Read every page",
    stepOneBody: "Embedded text is extracted; scanned pages use OCR.", stepTwo: "Translate in context",
    stepTwoBody: "Gemini translates complete layout blocks, not isolated words.", stepThree: "Review and export",
    stepThreeBody: "Correct flagged text and download a searchable PDF.", processingEyebrow: "Translation in progress",
    processingTitle: "Rebuilding your document", processingBody: "Keep this tab open. A 15-page scanned PDF can take several minutes.",
    cancel: "Cancel", validating: "Checking file safety and limits", extracting: "Reading text and page structure",
    translating: "Translating layout blocks", preparing: "Preparing your review", errorTitle: "We could not finish this PDF",
    tryAgain: "Try again", chooseAnother: "Choose another file", requestId: "Request ID",
    reviewEyebrow: "Translation ready for review", reviewTitle: "Compare, correct, download", newDocument: "New document",
    flagged: "flagged for review", edited: "edits made", autoPreserved: "notation blocks auto-preserved", keptOriginalCount: "kept original", expires: "Review session expires", splitView: "Side by side",
    revealView: "Reveal slider", original: "Original", translated: "Translated", reveal: "Translation reveal", dragHint: "Drag across the page to compare original & translated",
    previousPage: "Previous page", nextPage: "Next page", page: "Page", reviewPanel: "Text review",
    reviewPanelBody: "Edit wording, text size, or layout. Chords and technical notation are left untouched automatically.", noBlocks: "No translatable text blocks were found on this page.",
    noReview: "No issues flagged on this page", lowConfidence: "Check this translation", layoutWarning: "Layout warning", layoutOverflowWarning: "May need a shorter phrasing or a larger text box", layoutOverlapWarning: "Text boxes overlap - download is still available", originalText: "Original text",
    translationText: "Translation", restore: "Restore AI translation", confidence: "confidence",
    textBoxSize: "PDF text box", textBoxHint: "Drag the green corner in the preview, or fine-tune here.", boxWidth: "Width", boxHeight: "Height", restoreBox: "Reset size",
    fontSize: "Text size", resetFontSize: "Reset text size", autoFit: "Auto fit text", autoFitActive: "Auto fitted", keepOriginal: "Keep original - do not translate", restoreTranslationBlock: "Restore translation block",
    originalKept: "Original preserved", originalKeptHint: "This area will not be covered or changed in the exported PDF.",
    download: "Download translated PDF", exporting: "Building your PDF…", downloadReady: "Your translated PDF was downloaded.",
    downloadError: "The PDF could not be exported. Your edits are still here.",
    outputNote: "Searchable PDF · original layout · your corrections included", documentAi: "Scanned / OCR",
    embedded: "Embedded text", localPreview: "Original pages are rendered locally in your browser for review.",
    previewUnavailable: "Preview unavailable, but you can still review extracted text.",
    footerPrivacy: "Temporary processing. No document storage.", footerTech: "Powered by Gemini + Google Document AI",
  },
  vi: {
    badge: "Dành cho tài liệu thực tế", heroTitleA: "Dịch nội dung.", heroTitleB: "Giữ nguyên trang.",
    heroBody: "Biến PDF có chữ hoặc bản quét thành bản dịch dễ đọc mà vẫn giữ cột, bảng, hình ảnh và cấu trúc trang.",
    signUp: "Không cần tài khoản", deleted: "Không lưu giữ tệp", worksScans: "Hỗ trợ PDF bản quét",
    uploadTitle: "Thả tệp PDF vào đây", uploadHint: "hoặc chọn tệp từ thiết bị", chooseFile: "Chọn PDF",
    pdfOnly: "Chỉ PDF", fileLimit: "Tối đa 25 MB", pageLimit: "Tối đa 15 trang", selected: "Sẵn sàng dịch",
    checking: "Đang kiểm tra PDF…", pages: "trang", remove: "Xóa tệp", targetLabel: "Dịch sang", granularityLabel: "Chế độ dịch",
    granularityByBlock: "Theo khối (Mặc định)", granularityByLine: "Theo dòng",
    granularityByBlockHint: "Bố cục đẹp & tự nhiên hơn, nhưng khó tinh chỉnh khi có lỗi nhỏ.",
    granularityByLineHint: "Dịch từng dòng độc lập, bám sát từng dòng nhưng cỡ chữ các dòng có thể khác nhau.",
    translate: "Dịch PDF", preparingUpload: "Đang kiểm tra tệp…", dailyLimit: "3 lượt hoặc 45 trang mỗi ngày",
    ownerMode: "Chế độ chủ sở hữu", disableOwnerMode: "Tắt chế độ chủ sở hữu", ownerLimitBypass: "Kiểm thử chủ sở hữu · bỏ qua giới hạn ngày",
    privacyTitle: "Trước khi tải lên",
    privacyBody: "Tệp được Google Document AI và Gemini xử lý tạm thời rồi xóa. Nội dung gửi tới Gemini gói miễn phí có thể được Google dùng để cải thiện sản phẩm.",
    privacyWarning: "Không tải lên tài liệu mật, riêng tư hoặc nhạy cảm.",
    howTitle: "Từ bản quét đến bản dịch đúng cấu trúc", stepOne: "Đọc từng trang",
    stepOneBody: "Trích xuất chữ có sẵn; dùng OCR cho trang bản quét.", stepTwo: "Dịch theo ngữ cảnh",
    stepTwoBody: "Gemini dịch trọn khối bố cục, không dịch từng từ rời rạc.", stepThree: "Kiểm tra và xuất tệp",
    stepThreeBody: "Sửa phần được đánh dấu và tải PDF có thể tìm kiếm.", processingEyebrow: "Đang dịch tài liệu",
    processingTitle: "Đang dựng lại tài liệu", processingBody: "Giữ tab này mở. PDF quét 15 trang có thể mất vài phút.",
    cancel: "Hủy", validating: "Kiểm tra tệp và giới hạn", extracting: "Đọc chữ và cấu trúc trang",
    translating: "Dịch các khối nội dung", preparing: "Chuẩn bị bản xem lại", errorTitle: "Không thể hoàn tất PDF này",
    tryAgain: "Thử lại", chooseAnother: "Chọn tệp khác", requestId: "Mã yêu cầu",
    reviewEyebrow: "Bản dịch đã sẵn sàng", reviewTitle: "So sánh, chỉnh sửa, tải xuống", newDocument: "Tài liệu mới",
    flagged: "phần cần kiểm tra", edited: "chỉnh sửa", autoPreserved: "khối ký hiệu tự động giữ nguyên", keptOriginalCount: "giữ nguyên", expires: "Phiên xem lại hết hạn lúc", splitView: "Hai bên",
    revealView: "Thanh so sánh", original: "Bản gốc", translated: "Bản dịch", reveal: "Mức hiển thị bản dịch", dragHint: "Kéo ngang qua trang để so sánh bản gốc & bản dịch",
    previousPage: "Trang trước", nextPage: "Trang sau", page: "Trang", reviewPanel: "Kiểm tra nội dung",
    reviewPanelBody: "Sửa câu chữ, cỡ chữ hoặc bố cục. Hợp âm và ký hiệu kỹ thuật được tự động giữ nguyên.", noBlocks: "Không tìm thấy khối chữ cần dịch trên trang này.",
    noReview: "Trang này không có lỗi cần kiểm tra", lowConfidence: "Hãy kiểm tra bản dịch này", layoutWarning: "Cảnh báo bố cục", layoutOverflowWarning: "Có thể cần rút gọn câu hoặc tăng kích thước hộp văn bản", layoutOverlapWarning: "Các hộp văn bản chồng lên nhau - vẫn có thể tải xuống", originalText: "Nội dung gốc",
    translationText: "Bản dịch", restore: "Khôi phục bản dịch AI", confidence: "độ tin cậy",
    textBoxSize: "Hộp chữ PDF", textBoxHint: "Kéo góc xanh trên bản xem trước hoặc tinh chỉnh tại đây.", boxWidth: "Chiều rộng", boxHeight: "Chiều cao", restoreBox: "Đặt lại",
    fontSize: "Cỡ chữ", resetFontSize: "Đặt lại cỡ chữ", autoFit: "Tự động vừa khung", autoFitActive: "Tự động vừa khung", keepOriginal: "Giữ nguyên - không dịch", restoreTranslationBlock: "Khôi phục khối dịch",
    originalKept: "Đã giữ nguyên bản gốc", originalKeptHint: "Vùng này sẽ không bị che hoặc thay đổi trong PDF xuất ra.",
    download: "Tải PDF đã dịch", exporting: "Đang tạo PDF…", downloadReady: "PDF đã dịch đã được tải xuống.",
    downloadError: "Không thể xuất PDF. Các chỉnh sửa của bạn vẫn còn.",
    outputNote: "PDF có thể tìm kiếm · giữ bố cục · gồm các chỉnh sửa của bạn", documentAi: "Bản quét / OCR",
    embedded: "Chữ có sẵn", localPreview: "Trang gốc được hiển thị cục bộ trong trình duyệt để bạn kiểm tra.",
    previewUnavailable: "Không thể xem trang, nhưng bạn vẫn có thể kiểm tra phần chữ đã trích xuất.",
    footerPrivacy: "Xử lý tạm thời. Không lưu tài liệu.", footerTech: "Vận hành bởi Gemini + Google Document AI",
  },
} as const;

export function formatBytes(bytes: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "unit", unit: "megabyte", unitDisplay: "short", maximumFractionDigits: 1,
  }).format(bytes / 1024 / 1024);
}

export function getFriendlyError(error: unknown, locale: Locale) {
  const code = error instanceof ApiError ? error.code : "REQUEST_FAILED";
  const messages: Record<Locale, Record<string, string>> = {
    en: {
      INVALID_PDF: "This file is not a readable PDF. Try exporting it as a new PDF first.",
      PAGE_LIMIT: "This PDF has more than 15 pages. Split it into smaller files and try again.",
      FILE_TOO_LARGE: "This PDF is larger than 25 MB.", OCR_CAP_REACHED: "The monthly scanned-page allowance has been used. Text-based PDFs still work.",
      MODEL_QUOTA: "Gemini is temporarily at its free-tier limit. Please try again later.", MODEL_TIMEOUT: "The translation took too long. Try a shorter PDF.",
      DOCUMENT_AI_TIMEOUT: "The scanned pages took too long to read. Try a clearer or shorter PDF.", UNSAFE_RESPONSE: "The translation could not be safely validated. Try another document.",
      RATE_LIMITED: "Today’s free allowance has been used from this connection.", TOKEN_EXPIRED: "This review session expired. Translate the document again to export it.",
      REQUEST_FAILED: "Something interrupted the request. Check your connection and try again.",
    },
    vi: {
      INVALID_PDF: "Tệp này không phải PDF có thể đọc. Hãy thử xuất lại thành PDF mới.", PAGE_LIMIT: "PDF có hơn 15 trang. Hãy chia thành các tệp nhỏ hơn rồi thử lại.",
      FILE_TOO_LARGE: "PDF lớn hơn 25 MB.", OCR_CAP_REACHED: "Đã dùng hết hạn mức trang quét tháng này. PDF có chữ vẫn hoạt động.",
      MODEL_QUOTA: "Gemini đang chạm hạn mức miễn phí. Vui lòng thử lại sau.", MODEL_TIMEOUT: "Quá trình dịch mất quá nhiều thời gian. Hãy thử PDF ngắn hơn.",
      DOCUMENT_AI_TIMEOUT: "Đọc trang quét mất quá nhiều thời gian. Hãy thử bản rõ hoặc ngắn hơn.", UNSAFE_RESPONSE: "Không thể xác thực bản dịch an toàn. Hãy thử tài liệu khác.",
      RATE_LIMITED: "Kết nối này đã dùng hết hạn mức miễn phí hôm nay.", TOKEN_EXPIRED: "Phiên xem lại đã hết hạn. Hãy dịch lại tài liệu để xuất tệp.",
      REQUEST_FAILED: "Yêu cầu bị gián đoạn. Hãy kiểm tra kết nối và thử lại.",
    },
  };
  const fallback = error instanceof Error ? error.message : messages[locale].REQUEST_FAILED;
  return { code, message: messages[locale][code] ?? fallback, requestId: error instanceof ApiError ? error.requestId : undefined };
}
