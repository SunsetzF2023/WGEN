# Phase 2 — 云世界浏览界面

> 接续 Phase 1（多项目支持）的下一步。API 已就绪，只需加 UI。

## 目标

用户可以浏览其他用户公开的世界观项目（只读），不覆盖自己的数据。

## 已就绪的 API（dataStore.ts）

- `loadPublicProjects(excludeUserId?)` — 获取所有公开项目（排除自己的）
- `loadCloudEntitiesByProject(projectId)` — 获取某个项目的所有实体（只读）

## 要做的改动

### 1. Sidebar — 加"云世界"入口

**文件**: `src/components/Sidebar.tsx`

在"我的世界观"区域下方加一个"云世界"区域：
- 一个按钮/标签切换到云世界视图
- 仅登录用户可见（离线模式没有云世界）
- 点击后调用 `loadPublicProjects` 加载公开项目列表
- 显示项目卡片：图标 + 名称 + 描述 + 实体数量
- 点击项目 → 进入只读浏览模式

### 2. App.tsx — 云世界浏览状态

**文件**: `src/App.tsx`

新增状态：
- `cloudView: 'none' | 'list' | 'browsing'` — 当前是否在浏览云世界
- `cloudProjects: WorldProject[]` — 公开项目列表
- `cloudEntities: Entity[]` — 正在浏览的云项目的实体
- `browsingCloudProjectId: string | null` — 正在浏览的云项目 ID

逻辑：
- 进入云世界浏览时，`filteredEntities` 用 `cloudEntities` 而不是 `projectEntities`
- 浏览模式下隐藏"新建实体"按钮、隐藏编辑/删除按钮
- EntityDetail 的"编辑实体"按钮在浏览模式下隐藏
- 顶栏显示正在浏览的云项目名称 + "返回我的世界观"按钮

### 3. EntityDetail — 只读模式

**文件**: `src/components/EntityDetail.tsx`

- 新增 `readOnly?: boolean` prop
- `readOnly` 为 true 时隐藏"编辑实体"按钮
- 其余展示功能不变（标签点击、关联跳转等照常工作）

### 4. GraphView — 只读模式

**文件**: `src/components/GraphView.tsx`

- 浏览云世界时节点不可拖拽（或可拖拽但不保存位置）
- 点击节点仍然可以打开详情面板
- 最简单做法：传一个 `readOnly` prop，跳过 `onPositionChange` 调用

### 5. i18n — 新增文案

**文件**: `src/lib/i18n.tsx`

已有：`cloudWorld`、`noCloudProjects`、`loadingCloud`、`browseCloud`、`backToMyProjects`

可能需要补充：
- `cloudEntityCount` — "N 个实体"
- `cloudByUser` — "作者：{username}"（如果能获取到用户名）
- `enterCloudWorld` — "进入浏览"
- `exitCloudWorld` — "返回我的世界观"

### 6. Sidebar props 变更

```typescript
interface SidebarProps {
  // ... 现有 props
  cloudView: 'none' | 'list' | 'browsing';
  cloudProjects: WorldProject[];
  browsingCloudProjectId: string | null;
  onEnterCloud: () => void;        // 切换到云世界列表
  onBrowseCloudProject: (id: string) => void;  // 浏览某个云项目
  onExitCloud: () => void;         // 返回我的世界观
  isLoggedIn: boolean;
}
```

## 交互流程

```
用户打开侧边栏
  ├── 我的世界观（项目列表，可切换/创建/删除）
  └── 云世界（仅登录可见）
        └── 点击 → 加载公开项目列表
              └── 点击某个项目 → 只读浏览模式
                    ├── 顶栏显示 "🌐 [项目名] · 只读" + "返回"按钮
                    ├── 图谱正常显示，可点击节点看详情
                    ├── 详情面板正常显示，但无"编辑"按钮
                    └── 点击"返回" → 回到我的世界观
```

## 注意事项

- 云世界浏览不需要切换 `currentProjectId`，用独立的 `cloudEntities` 状态
- 浏览云世界时，自己的项目数据不受影响
- `loadPublicProjects` 需要传当前用户 ID 来排除自己的公开项目（避免重复）
- 获取云项目作者用户名：Supabase auth.users 表不直接可查，可以考虑在 projects 表加一个 `owner_name` 冗余字段，或者在 project 对象里只显示项目信息不显示作者
- 离线模式（未登录）不显示云世界入口

## 验证清单

- [ ] 登录后侧边栏出现"云世界"入口
- [ ] 点击后加载公开项目列表
- [ ] 点击项目进入只读浏览
- [ ] 图谱正常显示，可点击节点
- [ ] 详情面板正常显示，无编辑按钮
- [ ] 返回后自己的项目数据完好
- [ ] 离线模式不显示云世界入口
- [ ] 类型检查 + 构建通过
