# Cloudflare Worker for ZGQ Blog (Python)

基于 Cloudflare Workers 原生 Python 运行时（Pyodide / CPython 3.12+ / `python_workers`）构建的博客服务端 API 网关与 Telegram Bot Webhook 处理器。

> 💡 **版本说明**：原有的 TypeScript 单文件版本已完整归档至 [`worker-ts/`](../worker-ts/) 目录，作为备用参考与回退方案。

---

## 📁 目录结构与架构

```text
worker/
├── pyproject.toml              # Python 项目声明与包配置
├── wrangler.toml               # Cloudflare Worker 配置文件 (开启 python_workers)
├── schema.sql                  # D1 数据库初始化与索引定义 (blog-db)
├── package.json                # Wrangler CLI 本地运行与 CI 依赖
└── src/
    ├── entry.py                # WorkerEntrypoint 核心路由分发器 (CORS, 健康检查, Webhook, API)
    ├── config.py               # 环境变量、Secrets、管理员白名单与频道映射解析
    ├── d1.py                   # D1 数据库操作封装 (异步 SQL 执行、字典转换、订阅/评论归档)
    ├── vault.py                # 密码库 Vault Token 签发 (30天有效期加密凭据)
    ├── turnstile.py            # Cloudflare Turnstile 人机安全验证与 D1 访问限流防刷
    ├── github.py               # GitHub API 交互 (Commit, 文章抓取, Pages 构建就绪轮询)
    └── telegram/
        ├── client.py           # Telegram Bot API 客户端与官方命令菜单注册
        ├── formatters.py       # HTML 转义、文件大小图标计算、Instant View 链接生成
        ├── media.py            # 管理员私聊上传多媒体至 R2 并生成 Liquid 下载卡片
        ├── callbacks.py        # 内联键盘交互回调 (订阅/退订/解锁/草稿创建)
        └── handlers.py         # 命令集中分派 (/start, /new, /link, /sync, /cancel, /bind, /vault)
```

---

## 🚀 路由清单 (API Routes)

| 请求方式 | 路径 | 功能说明 |
| :--- | :--- | :--- |
| `GET` | `/health` | 健康检查探针，返回当前时间戳与运行时状态 |
| `POST` | `/webhook/telegram` | Telegram Bot Webhook，处理命令、媒体上传与按钮交互 |
| `POST` | `/api/notify` | GitHub Actions 构建完成回调，自动推送到频道与订阅者 |
| `GET` | `/api/posts/:id/tg` | 查询文章关联的 Telegram 频道消息 ID 与讨论链接 |
| `GET` | `/api/posts/:id/comments`| 获取文章对应的 Telegram 讨论区评论（支持实时抓取与 D1 归档） |
| `POST` | `/api/turnstile/verify` | Cloudflare Turnstile 人机验证与防爆破限流 |
| `POST` | `/api/vault/verify` | 受限机密文章人机验证与 Vault 解密凭证获取 |

---

## 🛠 本地开发与调试

```bash
# 安装 Wrangler
npm install

# 本地开发服务器 (连接云端 D1 / R2 或本地模拟)
npm run dev

# 手动发布部署
npm run deploy

# 部署至 Staging 预发环境
npm run deploy:staging
```
