-- ================================================================
-- Blog D1 Database Schema
-- blog-db / Cloudflare D1
-- ================================================================

-- 文章 <-> Telegram 消息映射表
CREATE TABLE IF NOT EXISTS post_tg_map (
  post_id         TEXT     PRIMARY KEY,          -- Front Matter 中的 id 字段 (如 "2026-001")
  tg_message_id   INTEGER  NOT NULL,             -- Telegram 频道消息 ID
  tg_channel_id   TEXT     NOT NULL,             -- Telegram 频道 ID (如 "@mychannel")
  post_title      TEXT,                          -- 文章标题（冗余存储，便于查询）
  post_url        TEXT,                          -- 文章完整 URL
  post_slug       TEXT,                          -- URL Slug（归档记录用）
  published_via   TEXT     DEFAULT 'git',        -- 发布方式: 'git' | 'telegram'
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 媒体文件记录表（通过 TG Bot 上传到 R2 的文件）
CREATE TABLE IF NOT EXISTS media_uploads (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  post_id         TEXT     REFERENCES post_tg_map(post_id),
  tg_file_id      TEXT     NOT NULL,             -- Telegram 原始 file_id
  r2_key          TEXT     NOT NULL,             -- R2 存储路径 (如 "images/2026-001/cover.jpg")
  r2_url          TEXT     NOT NULL,             -- 公开访问 URL
  mime_type       TEXT,
  file_size       INTEGER,
  uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_post_tg_map_tg_message ON post_tg_map(tg_message_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_post_id  ON media_uploads(post_id);
