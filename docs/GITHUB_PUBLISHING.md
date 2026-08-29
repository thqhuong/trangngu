# GitHub publishing guide

Use this checklist when creating the public repository. No remote repository was configured when this guide was written, so none of these external settings is claimed as complete.

## Recommended repository metadata

- **Name:** `trangngu`
- **Description:** `Translate digital and scanned PDFs while preserving their page structure.`
- **Website:** `https://trangngu-6m6au2eisq-as.a.run.app`
- **Topics:** `gemini-api`, `document-ai`, `cloud-run`, `pdf-translation`, `ocr`, `vietnam`, `react`, `typescript`
- **Social preview:** upload `public/og.png`

Keep the repository public for the competition only after the secret scan passes and a license decision is made. The current repository intentionally has no license.

## Repository settings

1. Enable Issues and the checked-in issue forms.
2. Enable private vulnerability reporting under **Security**.
3. Enable dependency graph, Dependabot alerts, and security updates.
4. Enable secret scanning and push protection when available.
5. Protect `main`: require a pull request, require the `CI / quality` check, dismiss stale approvals, and block force pushes and branch deletion.
6. Keep GitHub Actions permissions read-only by default. Grant write permissions only to a workflow that proves it needs them.

The checked-in CI workflow does not use provider credentials. It exercises the development fallback, builds the app, scans known credential formats, and runs browser checks. Real Gemini and Document AI verification remains a deliberate production preflight.

## Publication sequence

1. Choose and add the license.
2. Run `npm run check` and `npm run test:e2e` in an unrestricted local environment.
3. Confirm `git status` contains only intended public files.
4. Create the public repository and push `main`.
5. Wait for CI to pass, then apply branch protection using the exact check name shown by GitHub.
6. Verify README images, local links, issue forms, and the live application link on GitHub.
7. Add the public repository URL to the submission checklist, video description, and social post.
8. Create the `v0.1.0` release only after its tag, changelog, and deployed revision agree.

Do not paste a Gemini key into GitHub Actions. If a future workflow needs cloud deployment, prefer Workload Identity Federation and a dedicated deployment identity over a long-lived service-account key.
