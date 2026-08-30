<div align="center">

# TrangNgữ

![TrangNgữ — Translate the words. Keep the page.](public/og.png)

### Dịch chuẩn từ ngữ, giữ trọn trang in.

Translate your PDF documents while keeping columns, tables, images, and page structure exactly where they belong.

**[🌐 Try it now](https://trangngu-6m6au2eisq-as.a.run.app)** · **[📺 Watch the demo](#demo)** · **[💻 Source code](https://github.com/thqhuong/trangngu)**

</div>

---

## The problem

You have a PDF report, textbook, or manual in a foreign language. You copy the text into a translator and get back... a wall of plain text. The columns are gone. The tables are scrambled. The images disappeared. And if the PDF is a scan? You can't even select the text to begin with.

## What TrangNgữ does

TrangNgữ translates your PDF **in place**. The translated words go right back where the original ones were — same columns, same tables, same layout. You get a new PDF that looks just like the original, but in your language.

![TrangNgữ desktop translation workspace](outputs/trangngu-desktop-preview.png)

### How it works (the short version)

1. **Upload** any PDF (digital or scanned) — no account needed.
2. **Pick your language** — Vietnamese, English, Chinese, Japanese, Korean, and 7 more.
3. **Wait a few seconds** — TrangNgữ reads the page structure, translates the text, and puts everything back.
4. **Review & adjust** — slide between original and translated views, edit any word, resize text boxes.
5. **Download** — get a clean, searchable PDF with your translated text.

### What makes it different

- 📄 **Works on scanned PDFs too** — uses Google Document AI to read text from images.
- 📐 **Keeps the layout** — columns, tables, icons, and page geometry stay in place.
- 🔤 **Auto-fits text** — Vietnamese is often 30–50% longer than English. TrangNgữ automatically adjusts the font size so nothing overflows or overlaps.
- 🎵 **Knows what NOT to translate** — chord symbols like `Bbmaj7`, formulas, URLs, and product codes are left untouched.
- ✏️ **You stay in control** — edit translations, resize boxes, or keep the original with one click.
- 🔒 **Private by design** — no login, no stored documents. Your files are processed and forgotten.

### Limits

- Up to **25 MB** and **15 pages** per PDF.
- **3 translations per day** (free tier).
- 12 target languages supported.

## Demo

> 🎥 *Demo video coming soon on YouTube.*

You can try it yourself right now with the included [sample PDF](outputs/trangngu-demo-flood-guide.pdf) — a two-page emergency guide with one digital page and one scanned page.

## Privacy

TrangNgữ does not store your documents. Files are processed in memory and discarded. No account is required.

The translation is powered by Google's Gemini API (free tier), which means submitted content may be used to improve Google products. **Do not upload confidential or sensitive documents.**

See [full privacy details](docs/PRIVACY.md).

---

## Built with Google

| Technology | What it does in TrangNgữ |
|---|---|
| **Gemini API** | Translates text blocks with structured JSON output |
| **Cloud Document AI** | Reads text from scanned PDF pages (OCR) |
| **Cloud Run** | Hosts the live app (auto-scaling, serverless) |
| **Cloud Secret Manager** | Keeps API keys safe on the server |
| **AI Studio** | Used for prompt design and testing |

> 🏆 Built for [AI Riser Vietnam 2026: #BuildwithGoogleAI](https://rsvp.withgoogle.com/events/airiservietnam)

---

<details>
<summary><h2>🔧 For developers</h2></summary>

### Architecture

```text
Browser (React + Vite)
        |
        | HTTPS multipart / NDJSON / PDF
        v
Fastify API on Cloud Run
  |-- PDF.js / Poppler: inspect and render PDFs
  |-- Document AI: OCR scan-like pages
  |-- Gemini API: schema-constrained block translation
  |-- Firestore: privacy-preserving usage counters only
  `-- pdf-lib + Noto fonts: fixed-layout export
```

See [Architecture](docs/ARCHITECTURE.md) and [MVP specification](docs/MVP_SPEC.md).

### Local setup

**Prerequisites:** Node.js 22+, npm 10+, Poppler and Noto fonts for PDF export, Google Cloud credentials for Document AI / Firestore, and a Gemini API key.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Fastify on port 8787.

The app starts without cloud credentials (translation preview is clearly labeled as non-AI). Real translation and scanned-page OCR require the provider values below.

### Environment variables

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `GEMINI_API_KEY` | Yes | — | Server-only Gemini Developer API key |
| `GEMINI_MODEL` | Yes | `gemini-3.5-flash-lite` | Configurable model |
| `GOOGLE_CLOUD_PROJECT` | Yes | — | Project with Document AI and Firestore |
| `DOCUMENT_AI_LOCATION` | For scans | `asia-southeast1` | OCR processor location |
| `DOCUMENT_AI_PROCESSOR_ID` | For scans | — | Enterprise Document OCR processor ID |
| `SESSION_SIGNING_SECRET` | Yes | — | ≥32 chars; signs review sessions |
| `IP_HASH_SALT` | Yes | — | ≥16 chars; salts requester IDs |
| `ADMIN_DASHBOARD_TOKEN` | For admin | — | ≥24 chars; owner access key |
| `MAX_PDF_BYTES` | No | `26214400` | 25 MB upload limit |
| `MAX_PAGES_PER_JOB` | No | `15` | Max pages per PDF |
| `DAILY_JOB_LIMIT` | No | `3` | Jobs per requester per day |
| `DAILY_PAGE_LIMIT` | No | `45` | Pages per requester per day |
| `MONTHLY_OCR_PAGE_CAP` | No | `900` | Global scanned-page guardrail |

For local Google Cloud authentication:

```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### Testing

```bash
npm run typecheck
npm run lint
npm test          # 35 unit/integration tests
npm run build
npm run check     # all of the above in sequence
```

### Cloud Run deployment

Follow [Deployment guide](docs/DEPLOYMENT.md). The [Cloud Build config](cloudbuild.yaml) builds the [multi-stage Dockerfile](Dockerfile), pushes to Artifact Registry, and deploys to Cloud Run.

After deployment:

```bash
node scripts/smoke-production.mjs https://YOUR_CLOUD_RUN_URL
```

### Current deployment

- **Service:** `trangngu` on Cloud Run (`asia-southeast1`)
- **Revision:** `trangngu-00018-xnm` (100% traffic)
- **OCR Processor:** `e0a3a06f46f66a72` (Enterprise Document OCR)
- **Cost controls:** ₫100,000/month budget alert, 900-page monthly OCR cap, scale-to-zero

### Documentation

- [MVP specification](docs/MVP_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Privacy](docs/PRIVACY.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

</details>

<details>
<summary><h2>📝 Competition submission</h2></summary>

- [Demo script](docs/DEMO_SCRIPT.md)
- [Google AI Studio prompt & schema](docs/AI_STUDIO.md)
- [Social post draft](docs/SOCIAL_POST.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)
- [Sample PDF fixture](outputs/trangngu-demo-flood-guide.pdf)

</details>

---

## License

MIT. See [LICENSE](LICENSE).
