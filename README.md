# 🌐 WorldForge

**A bilingual interactive worldbuilding knowledge graph tool.**

[中文](./README.zh-CN.md) | **English**

Build your world's lore as an interconnected node graph. Every entity — characters, factions, locations, techniques — is a bubble, connected by relationships. Click any linked field to dive deeper into the rabbit hole.

## ✨ Features

- **Force-directed graph** — Powered by D3.js, with zoom, pan, and drag support
- **8 entity types** — Character, Faction, Location, Technique, Event, Item, Realm, Custom
- **Infinite nesting** — Every field can link to another entity; click to jump through the chain
- **Multimedia** — Attach image and audio URLs to any entity
- **Cloud sync** — Sign in with GitHub to save to Supabase; offline mode uses localStorage
- **Seed data** — Built-in xianxia world sample (cultivation realms, Qingyun Sect, characters, etc.)

## 🛠 Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- D3.js (force-directed graph)
- Supabase (PostgreSQL + GitHub OAuth)

## 🚀 Development

```bash
npm install
npm run dev
```

## 📦 Deployment (GitHub Pages)

The repo includes a GitHub Actions workflow that automatically builds and deploys to GitHub Pages on every push to `main`.

### Setup

1. Go to **Settings → Pages → Build and deployment → Source → GitHub Actions**
2. Push to `main` — the workflow handles the rest

### Manual Supabase Setup (optional, for cloud sync)

1. Create a project on [Supabase](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Enable GitHub OAuth in Authentication → Providers
4. Update `src/lib/supabase.ts` with your project URL and anon key

## 📄 License

MIT
