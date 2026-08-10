#!/usr/bin/env bash

set -e

WORKER_DIR="$(dirname "$0")/../worker"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "  Cloudflare 初始化"
echo ""

echo -e "${YELLOW}[1/5] 创建 D1 数据库 blog-db ...${NC}"
DB_OUTPUT=$(npx wrangler d1 create blog-db 2>&1)
echo "$DB_OUTPUT"

DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || true)
if [ -n "$DB_ID" ]; then
  echo -e "${GREEN}✓ D1 数据库已创建，ID: $DB_ID${NC}"
  echo -e "${YELLOW}⚠ 请将以下 database_id 填入 worker/wrangler.toml:${NC}"
  echo -e "  database_id = \"${DB_ID}\""
  sed -i.bak "s/PLACEHOLDER_D1_DATABASE_ID/${DB_ID}/" "$WORKER_DIR/wrangler.toml" 2>/dev/null && \
    echo -e "${GREEN}✓ 已自动更新 wrangler.toml${NC}" || true
else
  echo -e "${YELLOW}⚠ 无法自动提取 database_id，请手动填入 wrangler.toml${NC}"
fi
echo ""

echo -e "${YELLOW}[2/5] 创建 R2 存储桶 blog-assets ...${NC}"
npx wrangler r2 bucket create blog-assets
echo -e "${GREEN}✓ R2 存储桶已创建${NC}"
echo ""

echo -e "${YELLOW}[3/5] 初始化 D1 数据库表结构 ...${NC}"
npx wrangler d1 execute blog-db --file="$WORKER_DIR/schema.sql"
echo -e "${GREEN}✓ 数据库表已创建${NC}"
echo ""

echo -e "${YELLOW}[4/5] 配置 Worker Secrets ...${NC}"
echo -e "请依次输入以下密钥 (直接回车可跳过，稍后手动设置):"
echo ""

read -p "TELEGRAM_BOT_TOKEN (从 @BotFather 获取): " TG_TOKEN
[ -n "$TG_TOKEN" ] && echo "$TG_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN --name blog-worker

read -p "TELEGRAM_CHANNEL_ID (频道 ID 或 @username): " TG_CHANNEL
[ -n "$TG_CHANNEL" ] && echo "$TG_CHANNEL" | npx wrangler secret put TELEGRAM_CHANNEL_ID --name blog-worker

read -p "GITHUB_TOKEN (Personal Access Token, repo scope): " GH_TOKEN
[ -n "$GH_TOKEN" ] && echo "$GH_TOKEN" | npx wrangler secret put GITHUB_TOKEN --name blog-worker

read -p "NOTIFY_SECRET (随机字符串，用于 GitHub Actions 调用): " NOTIFY_S
[ -n "$NOTIFY_S" ] && echo "$NOTIFY_S" | npx wrangler secret put NOTIFY_SECRET --name blog-worker

read -p "WEBHOOK_SECRET (随机字符串，用于 TG Webhook 验证): " WEBHOOK_S
[ -n "$WEBHOOK_S" ] && echo "$WEBHOOK_S" | npx wrangler secret put WEBHOOK_SECRET --name blog-worker

echo -e "${GREEN}✓ Secrets 配置完成${NC}"
echo ""

echo -e "${YELLOW}[5/5] 部署 Worker ...${NC}"
cd "$WORKER_DIR"
npm install
npx wrangler deploy
echo -e "${GREEN}✓ Worker 部署完成${NC}"
echo ""

echo -e "${YELLOW}[可选] 设置 Telegram Webhook ...${NC}"
if [ -n "$TG_TOKEN" ] && [ -n "$WEBHOOK_S" ]; then
  echo ""
  read -p "是否自动设置 TG Webhook? 请输入你的 WORKER_API_URL (如 https://api.yourdomain.com，直接回车跳过): " WORKER_URL
  if [ -n "$WORKER_URL" ]; then
    WEBHOOK_RESP=$(curl -s "https://api.telegram.org/bot${TG_TOKEN}/setWebhook" \
      -d "url=${WORKER_URL}/webhook/telegram" \
      -d "secret_token=${WEBHOOK_S}" \
      -d "allowed_updates=[\"message\"]")
    echo "TG Webhook 响应: $WEBHOOK_RESP"
    echo -e "${GREEN}✓ Telegram Webhook 已设置${NC}"
  else
    echo -e "${YELLOW}已跳过自动设置 Webhook。请后续参考 README 手动配置。${NC}"
  fi
fi

echo ""
echo -e "  初始化完成！"
echo ""
echo -e "后续步骤:"
echo -e "  1. 在 GitHub 仓库 Settings → Secrets 中添加:"
echo -e "     CF_API_TOKEN / CF_ACCOUNT_ID / CF_PAGES_PROJECT_NAME"
echo -e "     WORKER_API_URL / NOTIFY_SECRET"
echo -e "  2. 在 Cloudflare Dashboard 中为 R2 配置自定义域名 assets.yourdomain.com"
echo -e "  3. Push 代码到 GitHub main 分支触发首次部署"
