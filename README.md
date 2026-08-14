# ZGQ Inc's Blog

这是一个基于 Jekyll 与 Cloudflare 的现代化全栈静态博客系统，旨在提供高性能、美观且功能丰富的博客体验。

## 🌟 主要功能

- **高性能静态生成**：使用 Jekyll 引擎构建，极速加载，SEO 友好。
- **现代化 UI 设计**：
  - 符合 Material Design 3 (MD3) 规范。
  - 现代网页设计语言（毛玻璃特效、平滑过渡动画，拟态风格等）。
- **PWA (Progressive Web App) 支持**：
  - **跨平台安装**：支持在 Android 和 PC端（Firefox/Chrome/Edge 等）将博客作为独立应用安装至桌面或主屏幕。
  - **秒开与断网保护**：利用 Service Worker 进行静态资源深度缓存，极大提升二次访问速度，并在无网络时提供优雅的离线回退页面。
- **Cloudflare 全栈支持**：
  - **Pages**：自动托管并全球加速静态网页。
  - **Workers**：提供无服务器后端 API 服务。
  - **D1 数据库**：持久化存储文章数据、评论与动态。
  - **R2 对象存储**：分布式存储媒体资源（图片、附件等）。
- **Telegram 深度集成**：通过 Bot Webhook，支持从 Telegram 快捷管理博客，支持 Markdown 图文推送、实时接收评论通知等。
- **自动化 CI/CD**：依托 GitHub Actions 实现自动化部署，代码 Push 即可触发全站自动生成和更新。

## 🚀 部署指南

本项目推荐在具有 Node.js 环境及 `wrangler` CLI 的终端下完成初始化。你也可以运行项目中内置的 `scripts/init-cloudflare.bat` (Windows) 或 `scripts/init-cloudflare.sh` (Linux) 自动完成相关操作，以下为详细拆解的命令全流程：

### 1. 准备工作

**准备 Telegram Bot 与评论区：**
1. **创建 Bot**：在 Telegram 中找到 [@BotFather](https://t.me/BotFather)，发送 `/newbot` 按照提示创建机器人。完成后，你会得到一段 **Bot Token**（这就是后续配置中的 `TELEGRAM_BOT_TOKEN`）。
2. **建立频道与评论区**：
   - 在 Telegram 创建一个新的公开频道，设置一个公开链接（例如 `@my_blog_channel`，这就是 `TELEGRAM_CHANNEL_ID`）。
   - 进入该频道的设置页面，创建或者绑定一个关联群组。
   - **⚠️ 非常重要**：务必将你刚刚创建的 Bot 邀请进频道和群组，并且设置为 **管理员** 具备发布消息的权限，否则 Bot 无法向频道推送文章。

**获取代码：**
克隆本项目到本地，并进入项目目录：
```bash
git clone https://github.com/ZGQ-inc/jekyll-blog.git
cd jekyll-blog
```

在开始部署或使用之前，你需要先将项目中的默认配置修改为你自己的信息：
1. **全局站点配置**：编辑根目录下的 `_config.yml`，修改 `title`, `email`, `description`, `url` 等字段为你自己的博客基础信息。尤其注意 `social` 下的 `github`, `telegram`, `telegram_channel`, `navigation` 等社交链接字段。
2. **Worker 环境变量**：编辑 `worker/wrangler.toml`，找到 `[vars]` 区块，修改 `BLOG_URL`（博客域名）、`ASSETS_URL`（R2 图床域名）以及 `GITHUB_REPO`（你的 GitHub 仓库名）。

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

> [!TIP]
> **可选项**：因为本项目配置了 GitHub Actions 工作流，当你在第 4 步中配置好仓库的机密信息（Secrets）并推送代码到 Github 后，工作流会自动帮你部署 Worker。如果你不想配置 GitHub Actions，或者你想在本地先部署一次验证功能，可以通过以下命令手动发布：

进入 Worker 目录，安装依赖并发布到 Cloudflare：
```bash
cd worker
npm install
npx wrangler deploy
cd ..
```

### 4. 设置 GitHub Actions 与 Cloudflare Pages 自动部署

本项目完全依赖 **Cloudflare Pages 原生的 GitHub 继承**来自动构建和部署博客静态页面。
1. 前往 Cloudflare Dashboard，选择 **Pages**，点击 **Connect to Git**。
2. 授权你的 GitHub 账户，选择你克隆的 `jekyll-blog` 仓库。
3. 在构建设置中：
   - 框架预设：选择 `Jekyll`
   - 构建命令：`bundle exec jekyll build --strict_front_matter`
   - 输出目录：`_site`
4. 环境变量（可选）：设置 `JEKYLL_ENV` 为 `production`。
5. 点击保存并部署。以后每次你向 GitHub 推送代码，Cloudflare 就会**全自动**为你编译并部署网页。

同时，本项目包含 GitHub Actions 工作流（用于后台运行 Worker 自动发布与 Telegram 通知等逻辑）。请在你的 GitHub 仓库的 **Settings > Secrets and variables > Actions** 中添加以下 Repository Secrets：
- `CF_API_TOKEN`：Cloudflare API 令牌（需具备对 Workers 和 D1 的相应编辑权限）
- `CF_ACCOUNT_ID`：你的 Cloudflare Account ID
- `WORKER_API_URL`：上一步部署成功后 Cloudflare 提供的 Worker API 域名（如 `https://api.yourdomain.com`）
- `NOTIFY_SECRET`：此处必须与上述设置到 Wrangler 中的密钥完全一致

配置完毕后，只需将代码提交并 Push 到 GitHub 仓库：
```bash
git add .
git commit -m "Initial deploy"
git push origin main
```

### 5. 后续配置

1. **R2 域名绑定**：在 Cloudflare Dashboard 对应的 R2 存储桶设置中，绑定自定义域名（如 `assets.yourdomain.com`），以便外网能够以常规 HTTP 协议访问图片。
2. **Telegram Webhook**：在浏览器访问或通过 cURL 触发以下链接来注册 Webhook，使其自动监听 Telegram Bot 的消息以处理评论回复/内容发布（替换对应参数）：
   ```text
   https://api.telegram.org/bot{你的BOT_TOKEN}/setWebhook?url={你的WORKER_API_URL}/webhook/telegram&secret_token={你的WEBHOOK_SECRET}
   ```
3. **BotFather 命令菜单配置**：为了方便使用 Bot 操作博客，建议前往 Telegram 找到 [@BotFather](https://t.me/BotFather)，输入 `/setcommands` 选择你的 Bot，然后粘贴以下内容：
   ```text
   new - 新建草稿
   link - 关联到频道
   sync - 同步频道消息
   cancel - 取消关联
   bind - 手动绑定
   help - 显示使用说明帮助
   ```

## ✍️ 写作发布

依托 Telegram Bot 与 GitHub Actions，日常的写作与发布体验极为顺畅，完整流程如下：

1. **创建草稿**：在你的 Telegram 机器人中输入 `/new [文章标题]`，系统会自动在 GitHub 仓库生成一篇 Markdown 格式的草稿（含标准头部 Front Matter），并触发网站构建。
2. **编辑文章**：使用你最喜欢的支持 Git 的编辑器（如 VS Code、Obsidian 等）拉取最新代码，编辑刚刚生成的 Markdown 文章。
   - 各种文字排版、多媒体格式的 Markdown 语法规范，请严格参考此示例文章：[Jekyll 完整 Markup 语法展示](https://blog.zgqinc.gq/posts/npg6ht/)。
3. **上传图床文件**：在写作过程中如果需要插图、上传附件、放置音视频等，无需寻找第三方图床，**直接将文件或图片发送给你的 Telegram Bot**！Bot 会自动将其存入 R2 存储并返回可以直接复制使用的 Markdown 代码或下载卡片代码。
4. **推送更新**：在本地完成文章编写后，使用 `git commit` 与 `git push` 推送到 GitHub，博客网站将自动更新。
5. **发布到频道**：网站更新完成后，在 Telegram 机器人中输入 `/link <文章ID> [摘要内容]`。Bot 会自动提取头图，并将这篇文章排版成精美的卡片推送至你的公开频道（图片在下、文字在上、自带链接预览），同时触发自动关联频道评论区！
   - *补充说明：后续如果修改了文章封面或摘要，可直接发送 `/sync <文章ID>`，Bot 会同步更新频道里那条历史消息的展示内容。*

## 📄 许可证 (License)

本项目采用 [MIT License](LICENSE) 许可协议。