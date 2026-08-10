@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ==================================
echo   ZGQ Blog - Cloudflare 初始化
echo   (Windows 版)
echo ==================================
echo.

set WORKER_DIR=%~dp0..\worker

REM ----------------------------------------------------------------
REM Step 1: 创建 D1 数据库
REM ----------------------------------------------------------------
echo [1/5] 创建 D1 数据库 blog-db ...
npx wrangler d1 create blog-db
echo.
echo 请将上方输出的 database_id 填入 worker\wrangler.toml 中的对应位置
echo 将 PLACEHOLDER_D1_DATABASE_ID 替换为实际的 ID
pause
echo.

REM ----------------------------------------------------------------
REM Step 2: 创建 R2 存储桶
REM ----------------------------------------------------------------
echo [2/5] 创建 R2 存储桶 blog-assets ...
npx wrangler r2 bucket create blog-assets
echo.

REM ----------------------------------------------------------------
REM Step 3: 执行建表 SQL
REM ----------------------------------------------------------------
echo [3/5] 初始化 D1 数据库表结构 ...
npx wrangler d1 execute blog-db --file="%WORKER_DIR%\schema.sql"
echo.

REM ----------------------------------------------------------------
REM Step 4: 设置 Secrets (逐个交互输入)
REM ----------------------------------------------------------------
echo [4/5] 配置 Worker Secrets ...
echo 以下命令将逐一要求你粘贴密钥值，直接按 Ctrl+C 可跳过单项

echo.
echo --- TELEGRAM_BOT_TOKEN ---
npx wrangler secret put TELEGRAM_BOT_TOKEN --name blog-worker

echo.
echo --- TELEGRAM_CHANNEL_ID ---
npx wrangler secret put TELEGRAM_CHANNEL_ID --name blog-worker

echo.
echo --- GITHUB_TOKEN ---
npx wrangler secret put GITHUB_TOKEN --name blog-worker

echo.
echo --- NOTIFY_SECRET (随机字符串) ---
npx wrangler secret put NOTIFY_SECRET --name blog-worker

echo.
echo --- WEBHOOK_SECRET (随机字符串) ---
npx wrangler secret put WEBHOOK_SECRET --name blog-worker

echo.

REM ----------------------------------------------------------------
REM Step 5: 安装依赖并部署 Worker
REM ----------------------------------------------------------------
echo [5/5] 安装 npm 依赖并部署 Worker ...
cd "%WORKER_DIR%"
npm install
npx wrangler deploy
echo.

echo ==================================
echo   初始化完成！
echo ==================================
echo.
echo 后续步骤:
echo   1. 在 GitHub 仓库 Settings ^> Secrets 中添加:
echo      CF_API_TOKEN / CF_ACCOUNT_ID / CF_PAGES_PROJECT_NAME
echo      WORKER_API_URL / NOTIFY_SECRET
echo   2. 在 Cloudflare Dashboard 为 R2 配置自定义域名 assets.yourdomain.com
echo   3. 手动设置 Telegram Webhook:
echo      https://api.telegram.org/bot{TOKEN}/setWebhook?url={你的WORKER_API_URL}/webhook/telegram^&secret_token={SECRET}
echo   4. Push 代码到 GitHub 触发首次部署
echo.
pause
