# ZGQ's Blog - Full Stack Jekyll Automation System

这是一个基于 Jekyll 与 Cloudflare 的现代化全栈静态博客系统，旨在提供高性能、美观且功能丰富的博客体验。

## 🌟 主要功能 (Features)

- **高性能静态生成**：使用 Jekyll 引擎构建，极速加载，SEO 友好。
- **现代化 UI 设计**：
  - 采用现代网页设计语言（毛玻璃特效、平滑过渡动画，拟态风格等）。
  - 内置符合 Material Design 3 (MD3) 规范的沉浸式视频/音频播放器及图片灯箱（Lightbox）。
- **Cloudflare 全栈支持**：
  - **Pages**：自动托管并全球加速静态网页。
  - **Workers**：提供无服务器后端 API 服务。
  - **D1 数据库**：持久化存储文章数据、评论与动态。
  - **R2 对象存储**：分布式存储媒体资源（图片、附件等）。
- **Telegram 深度集成**：通过 Bot Webhook，支持从 Telegram 快捷管理博客，支持 Markdown 图文推送、实时接收评论通知等。
- **自动化 CI/CD**：依托 GitHub Actions 实现自动化部署，代码 Push 即可触发全站自动生成和更新。

## 🚀 部署指南 (全命令模式)

本项目推荐在具有 Node.js 环境及 `wrangler` CLI 的终端下完成初始化。你也可以运行项目中内置的 `scripts/init-cloudflare.bat` (Windows) 或 `scripts/init-cloudflare.sh` (Linux/macOS) 自动完成相关操作，以下为详细拆解的命令全流程：

### 1. 准备工作

克隆本项目到本地，并进入项目目录：
```bash
git clone https://github.com/ZGQ-inc/jekyll-blog.git
cd jekyll-blog
```

### 2. 初始化 Cloudflare 资源

确保你已经全局安装了 wrangler 工具 (`npm i -g wrangler`)，并登录了你的 Cloudflare 账户 (`wrangler login`)。

**创建 D1 数据库：**
```bash
npx wrangler d1 create blog-db
```
*(注：创建成功后，记录终端输出的 `database_id`，并将其替换到 `worker/wrangler.toml` 文件中的 `PLACEHOLDER_D1_DATABASE_ID` 处)*

**创建 R2 存储桶：**
```bash
npx wrangler r2 bucket create blog-assets
```

**初始化数据库表结构：**
```bash
npx wrangler d1 execute blog-db --file="./worker/schema.sql"
```

**配置 Worker 密钥 (Secrets)：**
在终端依次执行以下命令，根据提示分别粘贴你的机密信息：
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --name blog-worker
npx wrangler secret put TELEGRAM_CHANNEL_ID --name blog-worker
npx wrangler secret put GITHUB_TOKEN --name blog-worker
npx wrangler secret put NOTIFY_SECRET --name blog-worker
npx wrangler secret put WEBHOOK_SECRET --name blog-worker
```
*(注：NOTIFY_SECRET 和 WEBHOOK_SECRET 请自行生成并在本地记录，建议使用高强度随机字符串)*

### 3. 部署服务端 (Worker)

进入 Worker 目录，安装依赖并发布到 Cloudflare：
```bash
cd worker
npm install
npx wrangler deploy
cd ..
```

### 4. 设置 GitHub Actions 自动部署

在你的 GitHub 仓库的 **Settings > Secrets and variables > Actions** 中添加以下 Repository Secrets：
- `CF_API_TOKEN`：Cloudflare API 令牌（需具备对 Pages、Workers 和 D1 的相应编辑权限）
- `CF_ACCOUNT_ID`：你的 Cloudflare Account ID
- `CF_PAGES_PROJECT_NAME`：要部署到 Cloudflare Pages 的项目名称
- `WORKER_API_URL`：上一步部署成功后 Cloudflare 提供的 Worker API 域名（如 `https://api.zgqinc.gq`）
- `NOTIFY_SECRET`：此处必须与上述设置到 Wrangler 中的密钥完全一致

配置完毕后，只需将代码提交并 Push 到 GitHub 仓库：
```bash
git add .
git commit -m "Initial deploy"
git push origin main
```
GitHub Actions 会自动接管，将站点的最新内容打包并部署到 Cloudflare Pages！

### 5. 后续配置 (进阶)

1. **R2 域名绑定**：在 Cloudflare Dashboard 对应的 R2 存储桶设置中，绑定自定义域名（如 `assets.zgqinc.gq`），以便外网能够以常规 HTTP 协议访问图片。
2. **Telegram Webhook**：在浏览器访问或通过 cURL 触发以下链接来注册 Webhook，使其自动监听 Telegram Bot 的消息以处理评论回复/内容发布（替换对应参数）：
   ```text
   https://api.telegram.org/bot{你的BOT_TOKEN}/setWebhook?url={你的WORKER_API_URL}/webhook/telegram&secret_token={你的WEBHOOK_SECRET}
   ```
3. **BotFather 命令菜单配置**：为了方便使用 Bot 操作博客，建议前往 Telegram 找到 [@BotFather](https://t.me/BotFather)，输入 `/setcommands` 选择你的 Bot，然后粘贴以下内容：
   ```text
   new - 创建新文章草稿
   link - 推送文章到频道
   sync - 同步更新频道信息
   cancel - 取消频道关联
   help - 显示使用帮助
   ```

## 📄 许可证 (License)

本项目采用 [MIT License](LICENSE) 许可协议。