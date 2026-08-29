/* global AbortSignal, Blob, FormData, fetch */
import console from "node:console";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig } from "../src/server/config.ts";
import { exportTranslatedPdf } from "../src/server/pdf.ts";
import { createBackendServices, translatePdf } from "../src/server/workflow.ts";

const mode = process.argv[2] === "--fallback" ? "fallback" : process.argv[2] === "--recovered" ? "recovered" : "production";
const serviceUrl = mode === "production" ? new URL(process.argv[2] ?? "https://trangngu-6m6au2eisq-as.a.run.app") : null;
if (serviceUrl && serviceUrl.protocol !== "https:" && serviceUrl.hostname !== "localhost") throw new Error("Refusing to send the sample to a non-HTTPS remote service.");

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "public", "sample", "trangngu-sample-original.pdf");
const outputPath = mode !== "fallback"
  ? join(root, "public", "sample", "trangngu-sample-translated.pdf")
  : join(root, "tmp", "pdfs", "trangngu-sample-fallback-export.pdf");
const source = await readFile(sourcePath);
const file = new Blob([source], { type: "application/pdf" });
const config = loadConfig({
  ...process.env,
  NODE_ENV: "development",
  SESSION_SIGNING_SECRET: "s".repeat(32),
  IP_HASH_SALT: "i".repeat(16),
});

const recoveredTranslations = new Map(Object.entries({
  "COMMUNITY QUICK GUIDE": "HƯỚNG DẪN NHANH CHO CỘNG ĐỒNG",
  "FLOOD READY": "SẴN SÀNG CHỐNG LŨ",
  "Three calm steps before the water rises": "Ba bước bình tĩnh trước khi nước dâng",
  "USE THIS PAGE": "SỬ DỤNG TRANG NÀY",
  "Share one simple plan with your household. Keep it visible, review it together, and follow official local alerts.": "Chia sẻ một kế hoạch đơn giản với gia đình. Giữ cho kế hoạch dễ thấy, cùng nhau xem lại và tuân theo các thông báo chính thức của địa phương.",
  "BEFORE THE RAIN": "TRƯỚC KHI TRỜI MƯA",
  "Pack, plan, protect": "Đóng gói, lên kế hoạch, bảo vệ",
  "Pack essentials": "Đóng gói vật dụng thiết yếu",
  "Water, medicine, torch, radio, chargers, and copies": "Nước, thuốc men, đèn pin, đài, bộ sạc và bản sao",
  "of key documents.": "của các tài liệu quan trọng.",
  "Choose two routes": "Chọn hai tuyến đường",
  "Plan a main exit and a backup route to higher": "Lên kế hoạch cho lối thoát chính và tuyến đường dự phòng đến nơi",
  "ground.": "cao ráo.",
  "Protect documents": "Bảo vệ tài liệu",
  "Seal important papers in a waterproof bag you can": "Niêm phong giấy tờ quan trọng trong túi chống nước có thể",
  "carry.": "mang theo.",
  "WHEN WATER RISES": "KHI NƯỚC DÂNG",
  "Move early, stay informed": "Di chuyển sớm, cập nhật thông tin",
  "Follow official alerts": "Theo dõi thông báo chính thức",
  "Use trusted local channels. Do not rely on forwarded": "Sử dụng các kênh địa phương đáng tin cậy. Không dựa vào tin đồn",
  "rumors.": "lan truyền.",
  "Avoid moving water": "Tránh khu vực nước chảy",
  "Never walk, cycle, or drive through floodwater.": "Tuyệt đối không đi bộ, đạp xe hoặc lái xe qua vùng nước lũ.",
  "Help safely": "Hỗ trợ an toàn",
  "Check on neighbors only when doing so does not": "Kiểm tra tình hình hàng xóm chỉ khi việc đó không",
  "put you at risk.": "đặt bạn vào rủi ro.",
  "Household meeting point": "Điểm tập trung của gia đình",
  "Primary location": "Địa điểm chính",
  "Backup location": "Địa điểm dự phòng",
  "REMEMBER": "GHI NHỚ",
  "Go to high ground": "Di chuyển lên vùng đất cao",
  "If officials ask you to leave, take your": "Nếu nhà chức trách yêu cầu rời đi, hãy mang theo",
  "emergency bag and move before": "túi cứu hộ và di chuyển trước khi",
  "routes become unsafe.": "các tuyến đường trở nên không an toàn.",
  "SAMPLE DOCUMENT - CREATED FOR TRANGNGU - NO PERSONAL DATA": "TÀI LIỆU MẪU - TẠO CHO TRANGNGU - KHÔNG CÓ DỮ LIỆU CÁ NHÂN",
  "SOURCE SAMPLE / ENGLISH": "MẪU NGUỒN / TIẾNG ANH",
  "For demonstration only. In an emergency, follow current guidance from local authorities.": "Chỉ dành cho mục đích minh họa. Trong trường hợp khẩn cấp, hãy tuân theo hướng dẫn hiện tại từ cơ quan chức năng địa phương.",
}));

let session;
if (mode !== "production") {
  const services = createBackendServices(config, {
    translator: {
      async translate(blocks) {
        return new Map(blocks.map((block) => {
          if (mode === "fallback" || /^\d+$/.test(block.originalText)) return [block.id, block.originalText];
          const translated = recoveredTranslations.get(block.originalText);
          if (!translated) throw new Error(`No recovered Gemini translation for block ${block.id}.`);
          return [block.id, translated];
        }));
      },
    },
  });
  session = await translatePdf({
    file: source,
    fileName: "trangngu-sample-original.pdf",
    targetLanguage: "vi",
    requesterIp: "127.0.0.1",
  }, config, services, () => undefined);
} else {
  const translationForm = new FormData();
  translationForm.set("file", file, "trangngu-sample-original.pdf");
  translationForm.set("targetLanguage", "vi");
  const translationResponse = await fetch(new URL("/api/translations", serviceUrl), {
    method: "POST",
    headers: { Accept: "application/x-ndjson" },
    body: translationForm,
    signal: AbortSignal.timeout(240_000),
  });
  if (!translationResponse.ok) throw new Error(`Translation returned HTTP ${translationResponse.status}`);

  const events = (await translationResponse.text()).trim().split(/\r?\n/).map((line) => JSON.parse(line));
  const failure = events.find((event) => event.type === "error");
  if (failure) throw new Error(`Translation failed with ${String(failure.code ?? "UNKNOWN")}`);
  const ready = events.findLast((event) => event.type === "ready");
  if (!ready?.session?.sessionToken || ready.session.pageCount !== 1) throw new Error("The production service did not return the expected one-page session.");
  session = ready.session;
}

const output = await exportTranslatedPdf(source, session, {}, config);
if (output.subarray(0, 5).toString() !== "%PDF-") throw new Error("Export did not return a PDF.");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
console.log(`Created ${mode} one-page sample export (${output.length} bytes, request ${session.requestId}).`);
