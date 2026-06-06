# Contributing

Thanks for helping improve Grad Research Hub. The project is intentionally small: it should be a research workflow hub, not a full replacement for Zotero, MLflow, DVC, Logseq, Obsidian, or project-management suites.

## Local Setup

Use PostgreSQL locally or connect to the same managed database style used by Vercel.

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

## Development Checks

Run these before opening a pull request:

```bash
npm run lint
npm run build
```

When database schema changes, also update `prisma/schema.prisma` and the matching SQL migration under `prisma/migrations/`.

## Contribution Guidelines

- Prefer integrations with mature tools over rebuilding their full feature set.
- Keep the default flow useful for a single Vercel-hosted graduate student.
- Keep UI dense, calm, Chinese-first, and workbench-like.
- Put deployment parameters and secrets in environment variables, not everyday forms.
- Avoid committing real research data, API keys, database exports, PDFs, or generated logs.
