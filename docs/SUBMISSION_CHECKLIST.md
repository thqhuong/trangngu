# AI Riser Vietnam 2026 submission checklist

Do not mark an item complete from configuration or a mocked test. Attach the real URL, revision, timestamp, or test evidence where applicable.

## Product quality

- [ ] A first-time visitor understands TrangNgữ and its limits without help.
- [ ] Digital, scanned, and mixed PDF workflows pass end to end.
- [ ] The stable two-page fixture translates to Vietnamese in production in under three minutes.
- [ ] The result preserves recognizable columns, table lines, images, and page geometry.
- [ ] Translated text is selectable/searchable in the downloaded PDF.
- [ ] Flagged-block editing changes the export without repeating OCR or translation.
- [ ] Invalid type, 25 MB, 15-page, encryption, quota, timeout, and provider errors are understandable.
- [ ] Double submission is blocked.
- [ ] Desktop and mobile layouts pass.

## Engineering evidence

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` passes in desktop and mobile projects.
- [ ] A repository and built-asset secret scan passes.
- [ ] A real Gemini schema-valid request passes locally and in production.
- [ ] A real Document AI OCR request passes locally and in production.
- [ ] Cloud Run logs contain no source text, translations, PDFs, secrets, raw IPs, or session tokens.

## Google Cloud

- [ ] Active project is the dedicated TrangNgữ project, not Doc2Do.
- [ ] Budget alert is configured; owner understands it does not cap spending.
- [ ] Runtime identity is dedicated and least-privilege.
- [ ] Gemini key and signing values are in Secret Manager and absent from source/build arguments.
- [ ] Document AI processor ID and `asia-southeast1` location are verified.
- [ ] Firestore contains counters only and access is server-side.
- [ ] Cloud Run service `trangngu` is public in `asia-southeast1`.
- [ ] Minimum instances 0, maximum 2, CPU 1, memory 2 GiB, concurrency 2, timeout 600 seconds.
- [ ] Latest ready revision receives 100% of traffic.
- [ ] `/api/health`, homepage, mobile/desktop, export, and real provider path pass against the public URL.
- [ ] Public URL: `[ADD_AFTER_VERIFICATION]`
- [ ] Verified revision and test date: `[ADD_AFTER_VERIFICATION]`

## Privacy and cost

- [ ] Upload notice says files are temporary and Google providers process content.
- [ ] Free-tier Gemini data-use warning is visible before upload.
- [ ] Users are told not to upload sensitive documents.
- [ ] No original PDF or translation persists after request/session processing.
- [ ] Daily and monthly counters match the documented 3 jobs, 45 pages, and 900 scanned pages.
- [ ] Current Gemini and Document AI pricing/quotas were rechecked on submission day.
- [ ] Demo file, video, repository, and logs contain no private or copyrighted-without-permission material.

## Required public assets

- [ ] Google AI Studio project opens: `[PUBLIC_AI_STUDIO_URL]`
- [ ] YouTube demo is public: `[PUBLIC_YOUTUBE_URL]`
- [ ] Social post is published: `[PUBLIC_SOCIAL_POST_URL]`
- [ ] Cloud Run application is public: `[PUBLIC_CLOUD_RUN_URL]`
- [ ] GitHub repository is public: `[PUBLIC_GITHUB_URL]`
- [ ] README setup, architecture, environment, tests, deployment, privacy, cost, and demo instructions match the code.
- [ ] Submission form product name, description, technologies, and links match the deployed product.

## Final demo dry run

- [ ] Fixture rights confirmed and filename is presentation-safe.
- [ ] Target language begins as Vietnamese.
- [ ] Browser cache/session state does not hide first-run behavior.
- [ ] Comparison slider, one known review flag, correction, and download are stable.
- [ ] Backup fixture is available, but no AI response is faked.
- [ ] Recording hides notifications, credentials, project identifiers where unnecessary, and private tabs.
- [ ] Spoken claims match what the viewer sees.

## Related

- [Deployment guide](DEPLOYMENT.md)
- [Demo script](DEMO_SCRIPT.md)
- [Social post](SOCIAL_POST.md)
