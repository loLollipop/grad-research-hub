# Security Policy

Grad Research Hub is currently an MVP for personal server/self-hosted use. It does not yet include multi-user authorization, upload scanning, or full production hardening.

## Reporting

Please do not publish security issues publicly before maintainers have a chance to respond. Open a private advisory if GitHub security advisories are enabled, or contact the maintainer listed in the repository profile.

## Current Scope

- API keys must stay server-side. AI keys saved in the settings center are encrypted before being stored.
- Public deployments should set `APP_PASSWORD`; otherwise anyone with the URL can access research data and export endpoints.
- Do not commit `.env`, `prisma/dev.db`, exported JSON, PDFs, or private research data.
- `/api/export` and `/api/export/bibtex` are intended for trusted self-hosted deployments.
- Public deployments should add authentication before exposing the app on the internet.
