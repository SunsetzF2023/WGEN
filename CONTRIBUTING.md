# Contributing to WorldForge

## Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/SunsetzF2023/WGEN.git
cd WGEN

# 2. Install dependencies
npm install

# 3. Create your env file
cp .env.example .env
# Edit .env with your Supabase credentials (or use the built-in defaults)

# 4. Start dev server
npm run dev
```

## Project Structure

```
WGEN/
├── src/
│   ├── App.tsx              # Main app component, state management
│   ├── main.tsx             # React entry point
│   ├── types.ts             # TypeScript type definitions
│   ├── components/          # UI components (Sidebar, GraphView, EntityDetail, EntityEditor)
│   └── lib/                 # Business logic (dataStore, supabase, i18n, seedData, entityLink)
├── supabase/
│   └── schema.sql           # Database schema + RLS policies
├── docs/                    # Documentation
└── .github/workflows/       # CI/CD (deploy + quality check)
```

## Coding Standards

- **TypeScript strict mode** — no `any` types, use proper interfaces
- **Functional components** — React hooks, no class components
- **Tailwind CSS** — utility-first, no custom CSS files (except index.css/App.css for global styles)
- **i18n** — all user-facing strings go through `useI18n()` / `t()` function
- **2-space indentation** — enforced by `.editorconfig`

## Commit Convention

Use descriptive commit messages:

```
feat: add cloud world browsing
fix: entity detail not closing on tag click
refactor: extract dataStore from App.tsx
docs: update README with env setup
chore: update dependencies
```

## Pull Request Checklist

- [ ] `npm run lint` passes
- [ ] `npm run build` passes (includes type check)
- [ ] No secrets or API keys in committed code
- [ ] New user-facing strings are added to all 3 languages (zh-CN, zh-TW, en)

## Security

- **Never commit `.env` files** — they are gitignored
- Supabase anon key is safe to expose in frontend code (RLS protects data)
- Service role keys must NEVER be used in frontend code
- Report security issues privately, do not open public issues
