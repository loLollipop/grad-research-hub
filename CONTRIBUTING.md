# Contributing

Thanks for helping improve Grad Research Hub. The project is intentionally small: it should be a research workflow hub, not a full replacement for Zotero, MLflow, DVC, Logseq, or project-management suites.

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

## Development Checks

Run these before opening a pull request:

```bash
npm run lint
npm run build
```

When database schema changes, also run:

```bash
npm run db:init
```

## Contribution Guidelines

- Prefer integrations with mature tools over rebuilding their full feature set.
- Keep the default flow useful for a single self-hosted graduate student.
- Keep UI dense, calm, and workbench-like.
- Avoid committing real research data, API keys, database files, PDFs, or generated logs.
- Add schema changes to both `prisma/schema.prisma` and `prisma/migrations/0001_init/migration.sql` while the manual SQLite init path is used.
