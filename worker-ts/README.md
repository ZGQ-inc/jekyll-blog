# Cloudflare Worker for ZGQ Blog (Legacy TypeScript)

这是本博客服务端的**历史 TypeScript 单文件版本**（`src/index.ts`，约 2,700 行）。

> ⚠️ **归档提示**：当前生产环境已切换为全新的模块化 Python 版本（位于 [`worker/`](../worker/) 目录）。本目录完整保留了原有的 TypeScript 源码、类型定义与依赖配置，仅供历史对照、参考与备用回退。

---

## 📁 目录文件

```text
worker-ts/
├── package.json        # 原始 npm 依赖配置
├── package-lock.json   # 锁定版本
├── tsconfig.json       # TypeScript 编译配置
├── wrangler.toml       # 原始 Wrangler 配置 (main = "src/index.ts")
├── schema.sql          # D1 数据库 Schema
└── src/
    └── index.ts        # 单文件全量业务实现 (2715 lines)
```

如需临时回退或在此目录下运行：
```bash
cd worker-ts
npm install
npx wrangler dev
```
