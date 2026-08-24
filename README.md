# WorldForge · 世界观生成器

一个交互式的世界观知识图谱工具。用气泡节点和连线构建实体之间的关系网络，支持无限嵌套关联。

## 功能

- **力导向图谱**：D3.js 驱动的交互式节点图，支持缩放、拖拽
- **实体类型**：人物、势力、地点、功法、事件、物品、境界、自定义
- **无限关联**：每个字段都可以链接到另一个实体，点击即可跳转
- **多媒体**：支持图片和音频 URL
- **云端同步**：GitHub 登录后数据保存到 Supabase，未登录时存 localStorage
- **示例数据**：内置玄幻世界种子数据（境界体系、青云宗、人物等）

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS v4
- D3.js (force-directed graph)
- Supabase (PostgreSQL + GitHub OAuth)

## 开发

```bash
npm install
npm run dev
```

## 部署

1. 在 Supabase 创建项目
2. 运行 `supabase/schema.sql` 中的 SQL
3. 在 Supabase 启用 GitHub OAuth
4. 修改 `src/lib/supabase.ts` 中的 URL 和 Key
5. `npm run build` 后部署到 GitHub Pages / Netlify
