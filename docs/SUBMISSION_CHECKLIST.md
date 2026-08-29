# AI Riser Vietnam 2026 submission checklist

Do not mark an item complete from configuration or a mocked test. Attach the real URL, revision, timestamp, or test evidence where applicable.

## Product quality

- [ ] A first-time visitor understands TrangNgữ and its limits without help.
- [x] Digital, scanned, and mixed PDF processing passes through the mixed fixture end to end.
- [x] The stable two-page fixture translates to Vietnamese in production in under three minutes.
- [ ] The result preserves recognizable columns, table lines, images, and page geometry.
- [ ] Translated text is selectable/searchable in the downloaded PDF.
- [ ] Flagged-block editing changes the export without repeating OCR or translation.
- [ ] Point-size changes and keep-original choices change the export without repeating OCR or translation.
- [ ] The 15-page music fixture preserves chord symbols/page numbers while translating prose and meaningful labels.
- [ ] Invalid type, 25 MB, 15-page, encryption, quota, timeout, and provider errors are understandable.
- [ ] Double submission is blocked.
- [x] Desktop and mobile layouts pass.
- [x] Homepage sample uses a balanced layout and supports reveal and side-by-side comparison plus keyboard input; distracting sample download buttons are intentionally absent.
- [x] Admin dashboard exposes aggregate counters only and rejects unauthenticated requests.
- [x] Owner testing accepts the configured admin key, bypasses only daily requester limits, clears on refresh/lock, and leaves monthly/provider limits active.

## Engineering evidence

- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes.
- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `npm run test:e2e` passes in desktop and mobile projects.
- [x] A repository and built-asset secret scan passes.
- [ ] A real Gemini schema-valid request passes locally and in production.
- [ ] A real Document AI OCR request passes locally and in production.
- [x] Cloud Run logs contain no source text, translations, PDFs, secrets, raw IPs, or session tokens.

## Google Cloud

- [x] Active project is the dedicated TrangNgữ project, not Doc2Do.
- [x] Budget alert is configured; owner understands it does not cap spending.
- [x] Runtime identity is dedicated and least-privilege.
- [x] Gemini key, signing values, and admin dashboard key are in Secret Manager and absent from source/build arguments.
- [x] Document AI processor ID and `asia-southeast1` location are verified.
- [x] Firestore contains counters only and access is server-side.
- [x] Cloud Run service `trangngu` is public in `asia-southeast1`.
- [x] Minimum instances 0, maximum 2, CPU 1, memory 2 GiB, concurrency 2, timeout 600 seconds.
- [x] Latest ready revision receives 100% of traffic.
- [x] `/api/health`, homepage, mobile/desktop, export, and real provider path pass against the public URL.
- [x] Public URL: `https://trangngu-6m6au2eisq-as.a.run.app`
- [x] Verified revision and test date: `trangngu-00010-544` on 2026-08-29 (shell, assets, health, locked admin boundary, desktop/mobile)
- [ ] Resolve the supplied 15-page music PDF's `UNSAFE_RESPONSE`; owner mode passed the daily guardrail and reached the real providers, but no successful output is claimed.

## Privacy and cost

- [x] Upload notice says files are temporary and Google providers process content.
- [x] Free-tier Gemini data-use warning is visible before upload.
- [x] Users are told not to upload sensitive documents.
- [x] No original PDF or translation persists after request/session processing.
- [x] Daily and monthly counters match the documented 3 jobs, 45 pages, and 900 scanned pages.
- [x] Current Gemini and Document AI pricing/quotas were rechecked on 2026-08-29; recheck again on submission day.
- [x] The demo file, repository, and logs contain no private or copyrighted-without-permission material; the unpublished video still needs its own check.

## Required public assets

- [ ] Google AI Studio project opens: `[PUBLIC_AI_STUDIO_URL]`
- [ ] YouTube demo is public: `[PUBLIC_YOUTUBE_URL]`
- [ ] Social post is published: `[PUBLIC_SOCIAL_POST_URL]`
- [x] Cloud Run application is public: `https://trangngu-6m6au2eisq-as.a.run.app`
- [x] GitHub repository is public: https://github.com/thqhuong/trangngu
- [x] README setup, architecture, environment, tests, deployment, privacy, cost, and demo instructions match the code.
- [ ] Submission form product name, description, technologies, and links match the deployed product.

## Final demo dry run

- [x] Fixture rights confirmed and filename is presentation-safe.
- [x] Target language begins as Vietnamese.
- [ ] Browser cache/session state does not hide first-run behavior.
- [ ] Comparison slider, one known review flag, wording correction, text-box resize/reset, and download are stable.
- [ ] Backup fixture is available, but no AI response is faked.
- [ ] Recording hides notifications, credentials, project identifiers where unnecessary, and private tabs.
- [ ] Spoken claims match what the viewer sees.

## Related

- [Deployment guide](DEPLOYMENT.md)
- [Demo script](DEMO_SCRIPT.md)
- [Social post](SOCIAL_POST.md)
