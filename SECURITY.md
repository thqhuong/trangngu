# Security policy

## Supported version

Security fixes currently target the latest commit on `main` and the public Cloud Run deployment documented in the README. Older local builds and unverified revisions are not supported.

## Report a vulnerability privately

Do not open a public issue for vulnerabilities, exposed credentials, sensitive logs, or a document-isolation problem.

After the repository is published, use GitHub's **Security → Report a vulnerability** flow if private vulnerability reporting is enabled. If it is unavailable, contact the repository owner privately through their GitHub profile without including exploit details in a public message.

Include the affected route or revision, impact, minimal reproduction steps using non-sensitive data, and a request ID when available. Never send API keys, session tokens, private PDFs, or copied production document content.

## If a secret may be exposed

Treat the value as compromised: stop using it, rotate or disable it in the owning Google project, create a new Secret Manager version, deploy a verified revision, and inspect sanitized logs. Removing a secret from the latest commit is not enough because Git history and caches may retain it.
