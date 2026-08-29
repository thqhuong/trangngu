# How to deploy TrangNgữ to Cloud Run

This guide builds and deploys the single TrangNgữ container to a public Cloud Run service in `asia-southeast1`. The record below documents the revision verified on 2026-08-29; repeating the guide does not prove a later revision until the verification steps pass again.

## Verified deployment record

| Item | Verified value |
|---|---|
| Project | `trangngu-ai-riser-2026`, separate from Doc2Do |
| Public URL | `https://trangngu-6m6au2eisq-as.a.run.app` |
| Service / revision | `trangngu` / `trangngu-00005-85v` |
| Traffic | 100% to the latest ready revision |
| Cloud Build | `8ffe8fdb-bc3b-47e9-8409-8ee41ea0205d` |
| Gemini | `gemini-3.5-flash-lite`, API-restricted key in an unbilled Gemini project |
| OCR | Enterprise Document OCR `e0a3a06f46f66a72` in `asia-southeast1` |
| Firestore | Native mode, `asia-southeast1`, free-tier database; salted quota counters and aggregate daily metrics only |
| Runtime | min 0, max 2, 1 CPU, 2 GiB, concurrency 2, timeout 600 seconds |
| Budget warning | ₫100,000/month; 50%, 90%, 100%, and 90%-forecast alerts |
| Automated verification | 19 tests and production build passed; 10 desktop/mobile Playwright checks passed |
| Real provider verification | Earlier production acceptance: two-page mixed PDF with 26 digital-page blocks and 19 scanned-page OCR blocks; Gemini translation and uncorrected PDF export passed. The final dashboard/sample revision did not bypass the already-reached daily app limit to repeat provider work. |
| Logs | No error-severity Cloud Run entries after final verification |

The final smoke test verified the public shell, health endpoint, four sample assets, protected dashboard boundary, authenticated aggregate response, and desktop/mobile browser behavior. Uploaded PDFs, extracted text, translations, API keys, and session tokens were not written to Firestore or application logs.

## Prerequisites and approval gate

You need the Google Cloud CLI, project-owner-approved billing, permission to manage the listed resources, and a dedicated Google Cloud project. The project must not be the Doc2Do project or service.

Creating Artifact Registry storage, Cloud Run, Firestore, Secret Manager, Document AI, and log data can create charges. The project owner must approve enabling these paid-capable services. Create a budget alert first; remember that an alert does not stop spend.

## 1. Confirm the project and billing alert

```bash
gcloud auth list
gcloud config get-value project
gcloud projects describe YOUR_PROJECT_ID --format='value(projectId,name,projectNumber)'
```

Stop if any value identifies the wrong project. Then set the intended project explicitly:

```bash
gcloud config set project YOUR_PROJECT_ID
```

Create a small project-scoped monthly warning budget and low threshold notifications with Cloud Console or `gcloud billing budgets create`. Do not describe this as a spending cap. The verified deployment uses ₫100,000/month with 50%, 90%, 100%, and 90%-forecast thresholds.

## 2. Enable approved services

After the owner approves the paid-capable resources:

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  documentai.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com
```

Create the Docker repository if it does not already exist:

```bash
gcloud artifacts repositories describe trangngu --location=asia-southeast1 || \
gcloud artifacts repositories create trangngu \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description='TrangNgu Cloud Run images'
```

## 3. Create Google integrations

### Document AI

In **Document AI > Processor Gallery**, create an **Enterprise Document OCR** processor in `asia-southeast1`. Record only its processor ID, not credentials. Confirm the location supports the selected processor and all demo languages at deployment time.

Document AI's public pricing currently lists the first 1,000 Enterprise OCR pages per month at no charge and usage-based pricing beyond that. The application reserves 900 scanned pages per month, but that counter does not stop calls made outside the app. Recheck the [official pricing page](https://cloud.google.com/products/document-ai/pricing).

### Firestore

Create a Firestore Native Mode database in a nearby supported location. This database stores usage counters only. Do not add uploaded PDFs, extracted text, or translations. Avoid enabling TTL solely for short-lived counters in the MVP; purge stale counter documents opportunistically.

### Gemini

Create or select a Google AI Studio API key for the intended project. Confirm the configured model is actually available on the free tier immediately before deployment. Do not switch the key or project to paid Gemini usage without explicit approval.

The checked-in default is `gemini-3.5-flash-lite`; it is configuration, not proof of current availability.

## 4. Create the runtime identity

```bash
gcloud iam service-accounts describe \
  trangngu-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com || \
gcloud iam service-accounts create trangngu-runtime \
  --display-name='TrangNgu Cloud Run runtime'

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member='serviceAccount:trangngu-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com' \
  --role='roles/documentai.apiUser'

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member='serviceAccount:trangngu-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com' \
  --role='roles/datastore.user'
```

These roles allow OCR calls and Firestore counter access. Do not grant Owner or Editor.

## 5. Create secrets without printing them

Create the empty secret resources once:

```bash
for name in trangngu-gemini-api-key trangngu-session-signing-secret trangngu-ip-hash-salt trangngu-admin-dashboard-token; do
  gcloud secrets describe "$name" >/dev/null 2>&1 || \
    gcloud secrets create "$name" --replication-policy=automatic
done
```

Add the Gemini key through a hidden prompt. The value is piped to Secret Manager and is not placed in the command itself:

```bash
read -rsp 'Gemini API key: ' TRANGNGU_GEMINI_KEY; echo
printf %s "$TRANGNGU_GEMINI_KEY" | \
  gcloud secrets versions add trangngu-gemini-api-key --data-file=-
unset TRANGNGU_GEMINI_KEY
```

Generate signing material directly into Secret Manager:

```bash
openssl rand -base64 48 | \
  gcloud secrets versions add trangngu-session-signing-secret --data-file=-
openssl rand -base64 32 | \
  gcloud secrets versions add trangngu-ip-hash-salt --data-file=-
openssl rand -base64 32 | tr -d '\n' | \
  gcloud secrets versions add trangngu-admin-dashboard-token --data-file=-
```

Save the dashboard token in a password manager at creation time; Secret Manager will not show it in the app. Grant the runtime identity access to these four secrets only:

```bash
for name in trangngu-gemini-api-key trangngu-session-signing-secret trangngu-ip-hash-salt trangngu-admin-dashboard-token; do
  gcloud secrets add-iam-policy-binding "$name" \
    --member='serviceAccount:trangngu-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com' \
    --role='roles/secretmanager.secretAccessor'
done
```

Never run `gcloud secrets versions access` during a screen recording or paste secret values into Cloud Build substitutions.

## 6. Configure the build identity

The verified deployment uses the dedicated `trangngu-build@YOUR_PROJECT_ID.iam.gserviceaccount.com` account. Grant only the permissions needed to read the Cloud Build source object, push the image, deploy Cloud Run, write build logs, consume enabled APIs, and attach the runtime identity:

- Artifact Registry Writer (`roles/artifactregistry.writer`)
- Cloud Run Admin (`roles/run.admin`), or a narrower deployment role if your organization provides one
- Logs Writer (`roles/logging.logWriter`)
- Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`)
- Storage Object Viewer (`roles/storage.objectViewer`) on the project Cloud Build source bucket only
- Service Account User (`roles/iam.serviceAccountUser`) on `trangngu-runtime`

Do not grant the build identity access to secret payloads; Cloud Run references secret versions at deployment and the runtime service account reads them.

## 7. Build and deploy

Run the local quality gate first:

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
docker build --tag trangngu:local .
```

Submit the checked-in Cloud Build pipeline with the real processor ID:

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --service-account=projects/YOUR_PROJECT_ID/serviceAccounts/trangngu-build@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --substitutions=_DOCUMENT_AI_PROCESSOR_ID=YOUR_PROCESSOR_ID,_GEMINI_MODEL=YOUR_VERIFIED_FREE_TIER_MODEL \
  .
```

The deployment target is fixed to:

- Service `trangngu`
- Region `asia-southeast1`
- Public unauthenticated access
- Minimum instances 0; maximum instances 2
- 1 CPU; 2 GiB memory; concurrency 2
- 600-second request timeout
- 25 MB, 15 pages/job, three jobs/day, 45 pages/day, and 900 scanned pages/month

## 8. Verify production

Resolve the actual URL and revision:

```bash
TRANGNGU_URL="$(gcloud run services describe trangngu \
  --region=asia-southeast1 \
  --format='value(status.url)')"
gcloud run services describe trangngu \
  --region=asia-southeast1 \
  --format='yaml(status.latestReadyRevisionName,status.traffic,status.url,spec.template.spec.serviceAccountName)'
```

Verify the public shell and health endpoint:

```bash
node scripts/smoke-production.mjs "$TRANGNGU_URL"
PLAYWRIGHT_BASE_URL="$TRANGNGU_URL" npm run test:e2e
```

Also confirm `/#/admin` rejects a missing or wrong access key, accepts the Secret Manager value over HTTPS, and reports only aggregate counters. A submitted key must not appear in local storage, cookies, page source, logs, or screenshots. Gemini does not provide an authoritative remaining free-tier quota through this application API; verify that the dashboard labels this limitation and links to the provider quota console.

Then perform the acceptance test that scripts cannot replace:

1. Open the real URL on desktop and a mobile-sized screen.
2. Upload the two-page demo PDF containing one digital and one scanned page.
3. Translate to Vietnamese with a real Gemini response.
4. Inspect the comparison view, correct one flagged block, and export.
5. Open the result, zoom both pages, and select/copy translated text.
6. Repeat one invalid-input case and one double-submission attempt.
7. Confirm the latest ready revision receives 100% of traffic.
8. Inspect Cloud Run logs by request ID. Confirm no document text, token, or secret appears and no provider errors remain.
9. Verify the homepage sample loads, the comparison line responds to pointer and keyboard input, both PDF downloads open, and the private dashboard works.

Record the URL, revision, test date, model, processor, desktop/mobile result, real translation result, and expected cost risk in the submission notes. If any step fails, report the failure; do not claim deployment completion.

## 9. Roll back safely

List revisions and identify the last verified one:

```bash
gcloud run revisions list --service=trangngu --region=asia-southeast1
```

Only after confirming its exact name, route traffic back:

```bash
gcloud run services update-traffic trangngu \
  --region=asia-southeast1 \
  --to-revisions=LAST_VERIFIED_REVISION=100
```

Rollback restores code but does not undo Firestore records, secret versions, IAM changes, or provider usage. Investigate and clean those separately with explicit targets.

## Troubleshooting

- **Container starts but `/` returns 404:** confirm Fastify serves `dist/client` in production and the Docker build contains both `dist/client` and `dist/server`.
- **`PERMISSION_DENIED` from Document AI:** verify processor project/location/ID and `roles/documentai.apiUser` on the runtime identity.
- **Firestore permission failure:** verify Application Default Credentials and `roles/datastore.user`; do not work around it with broad Editor access.
- **Secret not found:** confirm secret names, versions, and per-secret accessor binding in the same project.
- **504 before translation completes:** inspect per-stage durations and abort upstream work before the 600-second deadline. Do not increase the timeout until the slow stage is understood.
- **Quota or billing warning:** stop real-provider tests, inspect usage and pricing, and obtain approval before raising an application cap or changing billing tier.

## Related

- [Architecture](ARCHITECTURE.md)
- [Privacy](PRIVACY.md)
- [Submission checklist](SUBMISSION_CHECKLIST.md)
