# Contributing to TrangNgữ

Thanks for helping make translated documents more useful and accessible. TrangNgữ is a focused competition MVP, so contributions should strengthen the PDF translation workflow rather than turn it into a general chatbot or document platform.

## Start locally

You need Node.js 22 or later, npm, Poppler, and a Unicode font such as Noto Sans. Cloud credentials are optional for interface work and automated tests.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Development mode uses a clearly labelled non-AI translation fallback when Gemini is not configured.

Never commit `.env`, API keys, signed session tokens, uploaded PDFs, extracted text, or provider responses. Use rights-safe fixtures with no personal or confidential information.

## Quality gates

Run the complete local gate before opening a pull request:

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

`npm run check` covers TypeScript, ESLint, unit/integration tests, production builds, Markdown links, and known credential formats. Playwright checks both desktop Chromium and a Pixel 7-sized viewport.

Changes to PDF extraction, OCR routing, translation validation, quotas, signing, or export should include focused automated tests. Mocked providers are appropriate for pull requests; real Gemini and Document AI tests belong in an authorized deployment preflight and must use non-sensitive fixtures.

## Pull requests

Keep each pull request focused and explain the user-visible outcome. Include:

- The problem and the chosen approach.
- Tests run and their results.
- Screenshots for visible changes at desktop and mobile sizes.
- Any privacy, quota, provider, or Cloud Run impact.
- Documentation updates for changed configuration or behavior.

Do not change page limits, provider billing tiers, OAuth scopes, retention behavior, or Cloud resources without explicit project-owner approval.

## Reporting problems

Use the issue templates for reproducible bugs and focused feature proposals. Do not attach private PDFs. For vulnerabilities or possible secret exposure, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
