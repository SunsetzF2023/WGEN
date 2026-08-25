# 🌐 WorldForge

**一个交互式的世界观知识图谱工具。**

**English** | [中文](./README.md)

用气泡节点和连线构建实体之间的关系网络。每个实体——人物、势力、地点、功法——都是一个气泡，通过关联关系连接。点击任何链接字段即可深入探索。

## ✨ 功能

- **力导向图谱** — D3.js 驱动，支持缩放、平移、拖拽
- **8 种实体类型** — 人物、势力、地点、功法、事件、物品、境界、自定义
- **自定义类型标签** — 自定义实体类型（如"概念"、"种族"）拥有独立筛选标签
- **无限嵌套** — 每个字段都可以链接到另一个实体，点击即可跳转
- **字段拖拽排序** — 在编辑器中拖动重新排列实体字段
- **多媒体** — 支持为实体添加图片和音频 URL
- **云端同步** — GitHub 登录后数据保存到 Supabase，未登录时存 localStorage
- **云世界浏览** — 只读浏览其他用户公开的世界观
- **多语言界面** — 简体中文、繁体中文、英文
- **示例数据** — 内置玄幻世界种子数据（境界体系、青云宗、人物等）

## 🛠 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- D3.js（力导向图谱）
- Supabase（PostgreSQL + GitHub OAuth）

## 🚀 开发

```bash
# 克隆并安装
git clone https://github.com/SunsetzF2023/WGEN.git
cd WGEN
npm install

# 配置环境变量（可选 — 内置默认值）
cp .env.example .env
# 编辑 .env 填入你的 Supabase 凭据（如果想用自己的后端）

# 启动开发服务器
npm run dev
```

## 📦 部署（GitHub Pages）

仓库包含 GitHub Actions 工作流，每次推送到 `main` 分支时自动构建并部署到 GitHub Pages。

### 设置

1. 进入 **Settings → Pages → Build and deployment → Source → GitHub Actions**
2. 推送到 `main` — 工作流会自动处理

### Supabase 配置（用于云端同步）

1. 在 [Supabase](https://supabase.com) 创建项目
2. 在 SQL Editor 中运行 `supabase/schema.sql`
3. 在 Authentication → Providers 中启用 GitHub OAuth
4. 将项目 URL 和 anon key 复制到 `.env`：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **注意：** Supabase anon key 可以安全地暴露在前端代码中 — 行级安全（RLS）策略会保护你的数据。切勿在前端代码中使用 service role key。

## 📄 开源协议

[MIT](./LICENSE)
