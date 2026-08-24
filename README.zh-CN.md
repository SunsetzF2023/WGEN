# 🌐 WorldForge

**一个交互式的世界观知识图谱工具。**

**English** | [中文](./README.md)

用气泡节点和连线构建实体之间的关系网络。每个实体——人物、势力、地点、功法——都是一个气泡，通过关联关系连接。点击任何链接字段即可深入探索。

## ✨ 功能

- **力导向图谱** — D3.js 驱动，支持缩放、平移、拖拽
- **8 种实体类型** — 人物、势力、地点、功法、事件、物品、境界、自定义
- **无限嵌套** — 每个字段都可以链接到另一个实体，点击即可跳转
- **多媒体** — 支持为实体添加图片和音频 URL
- **云端同步** — GitHub 登录后数据保存到 Supabase，未登录时存 localStorage
- **示例数据** — 内置玄幻世界种子数据（境界体系、青云宗、人物等）

## 🛠 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- D3.js（力导向图谱）
- Supabase（PostgreSQL + GitHub OAuth）

## 🚀 开发

```bash
npm install
npm run dev
```

## 📦 部署（GitHub Pages）

仓库包含 GitHub Actions 工作流，每次推送到 `main` 分支时自动构建并部署到 GitHub Pages。

### 设置

1. 进入 **Settings → Pages → Build and deployment → Source → GitHub Actions**
2. 推送到 `main` — 工作流会自动处理

### Supabase 配置（可选，用于云端同步）

1. 在 [Supabase](https://supabase.com) 创建项目
2. 在 SQL Editor 中运行 `supabase/schema.sql`
3. 在 Authentication → Providers 中启用 GitHub OAuth
4. 修改 `src/lib/supabase.ts` 中的项目 URL 和 anon key

## 📄 开源协议

MIT
