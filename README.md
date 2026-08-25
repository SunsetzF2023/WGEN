# 🌐 WorldForge

**A bilingual interactive worldbuilding knowledge graph tool.**

[中文](./README.zh-CN.md) | **English**

Build your world's lore as an interconnected node graph. Every entity — characters, factions, locations, techniques — is a bubble, connected by relationships. Click any linked field to dive deeper into the rabbit hole.

## ✨ Features

- **Force-directed graph** — Powered by D3.js, with zoom, pan, and drag support
- **8 entity types** — Character, Faction, Location, Technique, Event, Item, Realm, Custom
- **Custom type tabs** — Custom entity types (e.g. "Concept", "Race") get their own filter tabs
- **Infinite nesting** — Every field can link to another entity; click to jump through the chain
- **Drag-and-drop fields** — Reorder entity fields in the editor
- **Multimedia** — Attach image and audio URLs to any entity
- **Cloud sync** — Sign in with GitHub to save to Supabase; offline mode uses localStorage
- **Cloud World browsing** — Browse other users' public worlds in read-only mode
- **Bilingual UI** — Simplified Chinese, Traditional Chinese, and English
- **Seed data** — Built-in xianxia world sample (cultivation realms, Qingyun Sect, characters, etc.)

## 🛠 Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- D3.js (force-directed graph)
- Supabase (PostgreSQL + GitHub OAuth)

## 🚀 Development

```bash
# Clone and install
git clone https://github.com/SunsetzF2023/WGEN.git
cd WGEN
npm install

# Set up environment variables (optional — defaults are built in)
cp .env.example .env
# Edit .env with your Supabase credentials if you want your own backend

# Start dev server
npm run dev
```

## 📦 Deployment (GitHub Pages)

The repo includes a GitHub Actions workflow that automatically builds and deploys to GitHub Pages on every push to `main`.

### Setup

1. Go to **Settings → Pages → Build and deployment → Source → GitHub Actions**
2. Push to `main` — the workflow handles the rest

### Supabase Setup (for cloud sync)

1. Create a project on [Supabase](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Enable GitHub OAuth in Authentication → Providers
4. Copy your project URL and anon key to `.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note:** The Supabase anon key is safe to expose in frontend code — Row Level Security (RLS) policies protect your data. Never use the service role key in frontend code.

## 📄 License

[MIT](./LICENSE)
