# Social post draft

Use this only after the links and claims are true. Replace every bracketed placeholder and delete any sentence describing a feature that did not pass production testing.

## Short version

I built **TrangNgữ** for AI Riser Vietnam 2026: #BuildwithGoogleAI.

Many useful reports and guides are hard to translate because their layout matters, and scanned PDFs may not contain selectable text. TrangNgữ turns a digital or scanned PDF into a translated, searchable PDF while keeping columns, tables, images, and page structure recognizable.

The workflow uses Google Document AI to recover text from scans, Gemini to translate validated document blocks, and Google Cloud Run for the public app. My favorite moment is sliding between the original scan and the Vietnamese page, then correcting one flagged block before download.

Try it: https://trangngu-6m6au2eisq-as.a.run.app

Demo: [PUBLIC_YOUTUBE_URL]

Code: https://github.com/thqhuong/trangngu

Build notes: I kept the MVP account-free, limited processing to 15 pages per job and 45 pages per requester per day, and designed it not to retain uploaded PDFs. The Gemini free-tier disclosure means users should not upload sensitive documents.

#BuildwithGoogleAI #AIRiserVietnam2026 #GeminiAPI #GoogleCloud #DocumentAI #Vietnam

## Build-journey version

What looked like “translate a PDF” became three harder problems: finding words in a scan, translating them without losing their block identity, and fitting longer Vietnamese text back into the original geometry.

For AI Riser Vietnam 2026, I focused on one complete workflow instead of another chat box. **TrangNgữ** extracts embedded text when possible, uses Google Document AI only for scan-like pages, sends stable blocks to Gemini with a strict JSON schema, and flags text that cannot fit safely. The result is a downloadable PDF with recognizable structure and a searchable translated text layer.

The biggest product decision was human review. A translator should not silently shrink or overlap important text. TrangNgữ calls out uncertain and cramped blocks so the user stays in control.

Live app: https://trangngu-6m6au2eisq-as.a.run.app
Demo: [PUBLIC_YOUTUBE_URL]
Repository: https://github.com/thqhuong/trangngu
AI Studio: [PUBLIC_AI_STUDIO_URL]

#BuildwithGoogleAI #AIRiserVietnam2026 #GeminiAPI #GoogleCloudRun #DocumentAI

## Publication check

- The Cloud Run URL loads publicly and a real production translation passes.
- The video and repository are public and contain no secret or private content.
- The AI Studio link opens without account-specific permissions beyond competition requirements.
- Privacy and retention claims match the implemented behavior.
- Alt text or a short description accompanies screenshots.
- No Google logo or competition branding is used in a misleading way.

## Related

- [Demo script](DEMO_SCRIPT.md)
- [Privacy](PRIVACY.md)
- [Submission checklist](SUBMISSION_CHECKLIST.md)
