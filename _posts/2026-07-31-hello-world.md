---
layout: post
title: "Jekyll + Cloudflare + Telegram 博客系统上线了！"
id: "2026-001"
date: 2026-07-31 10:00:00 +0800
summary: "记录本博客的搭建过程：Jekyll SSG + Cloudflare Pages/Worker/D1/R2 + Telegram Bot 全自动联动，实现 Git Push 即发布、TG Bot 直接写稿的双向工作流。"
tags: [Tech, Jekyll, Cloudflare, Telegram, Serverless]
comments: true
---

## 为什么做这个？

一直想要一个真正「属于自己」的博客，不依赖任何第三方平台，数据完全掌控在手里。同时，作为一个重度 Telegram 用户，希望能在 TG 频道里也能看到博客更新，甚至直接在 Telegram 里发文章。

于是就有了这套系统。

## 技术架构

### 前端

- **Jekyll**：静态网站生成器，Markdown 写作，Git 管理
- **Material Design 3**：Google 最新设计规范，完整 Monet 色彩系统
- **Glassmorphism**：毛玻璃效果侧边栏 + 顶部导航
- **Cloudflare Pages**：全球 CDN 托管，秒级部署

### 后端

- **Cloudflare Worker**：TypeScript 编写，处理所有 API 请求
- **Cloudflare D1**：SQLite 兼容的 Serverless 数据库，存储文章与 TG 消息的映射
- **Cloudflare R2**：对象存储，保存 Telegram 上传的媒体文件

### 自动化

```yaml
# 发布流程 (Git Push → Telegram)
Push to GitHub
  → GitHub Actions: Jekyll Build
  → Cloudflare Pages: 静态部署
  → Worker /api/notify: 推送 TG 频道
  → D1: 记录 post_id ↔ message_id
```

## 双向发布工作流

### 方式一：VS Code + Git Push（标准流程）

1. 在 `_posts/` 目录下创建 Markdown 文件
2. Front Matter 填写 `id`, `summary`, `tags`
3. `git push` 触发 GitHub Actions
4. Actions 自动部署 + 推送 TG 摘要

### 方式二：Telegram Bot 直发

```
/post 2026-002|文章标题|这是摘要|Tag1,Tag2
```

Bot 会自动：
- 如果附带图片/文件 → 上传到 R2
- 生成 Markdown 文件 → 提交到 GitHub
- 推送摘要到 TG 频道
- 写入 D1 数据库

## 主题系统

支持 **6 种 Monet 色彩方案** + 亮/暗/跟随系统三种模式：

| 方案 | 主色 |
|------|------|
| 🔵 海洋蓝 | #0061A4 |
| 💜 紫色梦境 | #6750A4 |
| 🌿 森林绿意 | #006E2C |
| 🍊 秋日橙光 | #9D4000 |
| 🌹 玫瑰红 | #B3261E |
| 🩵 青色清风 | #006A6A |

点击右上角调色板图标即可切换，设置持久化到 localStorage。

## 接下来

- [ ] 搜索功能优化（algolia 或 pagefind）
- [ ] 文章阅读量统计（D1 + Worker）
- [ ] 更多 Telegram Bot 指令
- [ ] RSS to TG 频道自动转发

欢迎在 Telegram 频道留言交流！
