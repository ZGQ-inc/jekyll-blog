/**
 * ZGQ Blog - Cloudflare Worker
 * API Gateway + Telegram Bot Webhook Handler
 *
 * Routes:
 *   POST /webhook/telegram  - Telegram Bot webhook entry
 *   POST /api/notify        - GitHub Actions callback → push to TG channel
 *   GET  /api/posts/:id/tg  - Query TG message_id for a post
 *   GET  /health            - Health check
 */

// ================================================================
// Types
// ================================================================

interface Env {
  // D1 Database
  DB: D1Database;
  // R2 Bucket (optional until R2 is enabled in Dashboard)
  R2?: R2Bucket;
  // Environment vars
  BLOG_URL: string;
  ASSETS_URL: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  GITHUB_POSTS_PATH: string;
  // Secrets
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL_ID: string;
  GITHUB_TOKEN: string;
  NOTIFY_SECRET: string;
  WEBHOOK_SECRET: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
}

interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgDocument;
  video?: TgVideo;
  date: number;
}

interface TgChat {
  id: number;
  type: string;
  username?: string;
}

interface TgUser {
  id: number;
  username?: string;
  first_name: string;
}

interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TgDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TgVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TgFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface NotifyPayload {
  post_id: string;
  title: string;
  summary: string;
  tags: string[];
  image?: string;
  slug: string;
  date: string;
}

interface PostCommand {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  mediaFileId?: string;
  mediaType?: 'photo' | 'document' | 'video';
}

// ================================================================
// Main Router
// ================================================================

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }));
    }

    try {
      // Health check
      if (path === '/health' && method === 'GET') {
        return jsonResponse({ status: 'ok', ts: new Date().toISOString() });
      }

      // Telegram Webhook
      if (path === '/webhook/telegram' && method === 'POST') {
        return handleTelegramWebhook(request, env);
      }

      // GitHub Actions → TG notify
      if (path === '/api/notify' && method === 'POST') {
        return handleNotify(request, env);
      }

      // Query TG message ID for a post
      const tgQuery = path.match(/^\/api\/posts\/([^/]+)\/tg$/);
      if (tgQuery && method === 'GET') {
        return handleGetPostTg(tgQuery[1], env);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (err) {
      console.error('Unhandled error:', err);
      return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
  }
};

// ================================================================
// Handler: Telegram Webhook
// ================================================================

async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  // Verify secret token header
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const update: TgUpdate = await request.json();
  const message = update.message;

  if (!message) {
    return jsonResponse({ ok: true });
  }

  const text = message.text || message.caption || '';

  // Parse /new command
  const newMatch = text.match(/^\/new\s+(.+)/s) || text.match(/^\/new$/);
  if (newMatch) {
    const title = newMatch[1] ? newMatch[1].trim() : '未命名文章';
    await handleNewCommand(message, title, env);
    return jsonResponse({ ok: true });
  }

  // Parse /link command
  const linkMatch = text.match(/^\/link\s+([a-zA-Z0-9_-]+)(?:\s+(.+))?$/s);
  if (linkMatch) {
    await handleLinkCommand(message, linkMatch[1], linkMatch[2] || '', env);
    return jsonResponse({ ok: true });
  }

  // Parse /cancel command
  const cancelMatch = text.match(/^\/cancel\s+([a-zA-Z0-9_-]+)$/s);
  if (cancelMatch) {
    await handleCancelCommand(message, cancelMatch[1], env);
    return jsonResponse({ ok: true });
  }

  // Help command
  if (text.startsWith('/start') || text.startsWith('/help')) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: buildHelpText(),
      parse_mode: 'MarkdownV2'
    });
  }

  return jsonResponse({ ok: true });
}

async function handleNewCommand(message: TgMessage, title: string, env: Env): Promise<void> {
  const id = Math.random().toString(36).substring(2, 8); // e.g. 4f9a2b
  const today = new Date().toISOString().split('T')[0];
  const slug = `${today}-${id}`;
  
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: `⏳ 正在 GitHub 创建草稿，请稍候...`,
  });

  try {
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const mdContent = [
      '---',
      `layout: post`,
      `title: "${title.replace(/"/g, '\\"')}"`,
      `id: "${id}"`,
      `date: ${dateStr}`,
      `summary: ""`,
      `tags: []`,
      `comments: true`,
      '---',
      '',
      '<!-- 请在 VSCode 中编辑此草稿的正文内容 -->',
      ''
    ].join('\n');

    await commitToGitHub(env, slug, mdContent);

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `✅ 草稿已生成！\n\n**文件名**: \`${slug}.md\`\n**文章 ID**: \`${id}\`\n\n请在本地 VSCode 拉取代码并编辑该文件。提交发布后，请使用以下命令关联到频道：\n\n\`/link ${id} 你的文章摘要内容\``,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 草稿创建失败: ${String(err)}`
    });
  }
}

async function fetchPostInfoFromGitHub(id: string, env: Env): Promise<{ title: string; tags: string[] } | null> {
  try {
    const [owner, repo] = env.GITHUB_REPO.split('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${env.GITHUB_POSTS_PATH}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ZGQ-Blog-Worker/1.0'
      }
    });
    if (!res.ok) return null;
    const files = await res.json() as any[];
    const file = files.find((f: any) => f.name.endsWith(`-${id}.md`));
    if (!file) return null;

    const fileRes = await fetch(file.url, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ZGQ-Blog-Worker/1.0'
      }
    });
    if (!fileRes.ok) return null;
    const fileData = await fileRes.json() as any;
    const content = decodeURIComponent(escape(atob(fileData.content)));
    
    // Parse front matter
    const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    const title = titleMatch ? titleMatch[1] : '新文章';
    const tagsMatch = content.match(/^tags:\s*\[(.*?)\]/m);
    let tags: string[] = [];
    if (tagsMatch && tagsMatch[1]) {
      tags = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''));
    }
    return { title, tags };
  } catch (e) {
    return null;
  }
}

async function handleLinkCommand(message: TgMessage, id: string, summary: string, env: Env): Promise<void> {
  if (!summary) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 请提供摘要内容。格式: \`/link ${id} 这是摘要\``,
      parse_mode: 'Markdown'
    });
    return;
  }

  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: `⏳ 正在查询文章信息...`,
  });

  try {
    const postInfo = await fetchPostInfoFromGitHub(id, env);
    const title = postInfo ? postInfo.title : '新文章发布';
    const tags = postInfo ? postInfo.tags : [];
    
    const postUrl = `${env.BLOG_URL}/posts/${id}/`;
    const tgResult = await publishToChannel(env, {
      id,
      title,
      summary,
      tags,
      postUrl
    });

    if (tgResult) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO post_tg_map
         (post_id, tg_message_id, tg_channel_id, post_title, post_url, post_slug, published_via)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        tgResult.message_id,
        env.TELEGRAM_CHANNEL_ID,
        title,
        postUrl,
        id,
        'telegram_manual'
      ).run();

      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `✅ 关联成功！已推送到频道。\n\n**文章**: ${title}\n**链接**: ${postUrl}`,
        parse_mode: 'Markdown'
      });
    } else {
      throw new Error('Failed to send to channel');
    }
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 关联失败: ${String(err)}`
    });
  }
}

async function handleCancelCommand(message: TgMessage, id: string, env: Env): Promise<void> {
  try {
    const row = await env.DB.prepare(`SELECT tg_message_id FROM post_tg_map WHERE post_id = ?`).bind(id).first();
    if (!row) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `⚠️ 找不到 ID 为 \`${id}\` 的关联频道消息。`,
        parse_mode: 'Markdown'
      });
      return;
    }

    const tgMessageId = row.tg_message_id as number;
    const delRes = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'deleteMessage', {
      chat_id: env.TELEGRAM_CHANNEL_ID,
      message_id: tgMessageId
    });

    if (delRes.ok || (delRes.description && delRes.description.includes('message to delete not found'))) {
      await env.DB.prepare(`DELETE FROM post_tg_map WHERE post_id = ?`).bind(id).run();
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `✅ 已撤销！频道消息已删除，数据库记录已清除。`,
      });
    } else {
      throw new Error(delRes.description || 'Unknown Telegram API error');
    }
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 撤销失败: ${String(err)}`
    });
  }
}

// ================================================================
// Handler: GitHub Actions Notify
// ================================================================

async function handleNotify(request: Request, env: Env): Promise<Response> {
  // Verify Bearer token
  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.NOTIFY_SECRET}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const payload: NotifyPayload = await request.json();
  const { post_id, title, summary, tags, image, slug } = payload;

  if (!post_id || !title || !summary) {
    return jsonResponse({ error: 'Missing required fields: post_id, title, summary' }, 400);
  }

  const postUrl = `${env.BLOG_URL}/posts/${slug}/`;

  // Publish to Telegram channel
  const tgResult = await publishToChannel(env, {
    id: post_id,
    title,
    summary,
    tags: tags || [],
    postUrl,
    image
  });

  if (!tgResult) {
    return jsonResponse({ error: 'Failed to send Telegram message' }, 500);
  }

  // Save to D1
  await env.DB.prepare(
    `INSERT OR REPLACE INTO post_tg_map
     (post_id, tg_message_id, tg_channel_id, post_title, post_url, post_slug, published_via)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    post_id,
    tgResult.message_id,
    env.TELEGRAM_CHANNEL_ID,
    title,
    postUrl,
    slug,
    'git'
  ).run();

  return jsonResponse({
    ok: true,
    message_id: tgResult.message_id,
    post_url: postUrl
  });
}

// ================================================================
// Handler: Get Post TG Info
// ================================================================

async function handleGetPostTg(postId: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT post_id, tg_message_id, tg_channel_id, post_url, created_at
     FROM post_tg_map WHERE post_id = ?`
  ).bind(postId).first();

  if (!row) {
    return jsonResponse({ error: 'Post not found' }, 404);
  }

  // Build Telegram channel post URL
  const channelId = String(row.tg_channel_id).replace('@', '');
  const tgPostUrl = `https://t.me/${channelId}/${row.tg_message_id}`;

  return jsonResponse({
    post_id: row.post_id,
    tg_message_id: row.tg_message_id,
    tg_channel_id: row.tg_channel_id,
    tg_post_url: tgPostUrl,
    post_url: row.post_url,
    created_at: row.created_at
  });
}

// ================================================================
// Telegram API Helpers
// ================================================================

async function publishToChannel(
  env: Env,
  opts: { id: string; title: string; summary: string; tags: string[]; postUrl: string; image?: string }
): Promise<{ message_id: number } | null> {
  const { id, title, summary, tags, postUrl, image } = opts;

  // Build MarkdownV2 text
  // Format tag ID: 2026-001 → #ID_2026_001
  const idTag = `#ID_${id.replace(/-/g, '_')}`;
  const otherTags = tags.map(t => `#${t.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`).join(' ');
  const tagsLine = [idTag, otherTags].filter(Boolean).join(' ');

  const text = [
    `📌 *${escapeMdV2(title)}*`,
    '',
    escapeMdV2(summary),
    '',
    tagsLine
  ].join('\n');

  const inlineKeyboard = {
    inline_keyboard: [[
      { text: '📖 阅读完整文章', url: postUrl }
    ]]
  };

  // If image provided, send photo with caption; otherwise text message
  if (image) {
    const result = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'sendPhoto', {
      chat_id: env.TELEGRAM_CHANNEL_ID,
      photo: image,
      caption: text,
      parse_mode: 'MarkdownV2',
      reply_markup: inlineKeyboard
    });
    if (result.ok) return { message_id: result.result.message_id };
    // Fallback to text if photo fails
    console.warn('sendPhoto failed, falling back to text:', result.description);
  }

  const result = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
    chat_id: env.TELEGRAM_CHANNEL_ID,
    text,
    parse_mode: 'MarkdownV2',
    link_preview_options: { is_disabled: false, url: postUrl },
    reply_markup: inlineKeyboard
  });

  if (!result.ok) {
    console.error('sendMessage failed:', result);
    return null;
  }

  return { message_id: result.result.message_id };
}

async function sendTelegramMessage(
  token: string,
  params: Record<string, unknown>
): Promise<void> {
  await callTelegramApi(token, 'sendMessage', params);
}

async function callTelegramApi(
  token: string,
  method: string,
  params: Record<string, unknown>
): Promise<{ ok: boolean; result: Record<string, unknown>; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return res.json() as Promise<{ ok: boolean; result: Record<string, unknown>; description?: string }>;
}

// ================================================================
// R2 Upload Helpers
// ================================================================

// ================================================================
// R2 Cost Controls
// ================================================================
const R2_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB 单文件上限（保护免费额度）

const R2_ALLOWED_MIME_PREFIXES = [
  'image/',   // jpg/png/gif/webp
  'video/',   // mp4/mov
  'audio/',   // mp3/ogg
  'application/pdf',
];

function isMimeAllowed(mime?: string): boolean {
  if (!mime) return true; // 未知类型放行，由文件扩展名推断
  return R2_ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p));
}

async function uploadMediaToR2(
  env: Env,
  postId: string,
  fileId: string,
  mimeType?: string
): Promise<string> {
  // R2 可用性检查
  if (!env.R2) {
    throw new Error('R2 存储桶未绑定，请检查 wrangler.toml 配置后重新部署。');
  }

  // MIME 类型白名单
  if (mimeType && !isMimeAllowed(mimeType)) {
    throw new Error(`不支持的文件类型: ${mimeType}。仅允许图片/视频/音频/PDF。`);
  }
  // Step 1: Get file path from Telegram
  const fileInfo = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'getFile', { file_id: fileId });
  if (!fileInfo.ok || !fileInfo.result.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  const filePath = fileInfo.result.file_path as string;
  const ext = filePath.split('.').pop() || 'bin';

  // Step 2: Download from Telegram
  const dlUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const dlRes = await fetch(dlUrl);
  if (!dlRes.ok) throw new Error(`Failed to download file: ${dlRes.status}`);

  const blob = await dlRes.arrayBuffer();

  // ⚠️ R2 免费额度保护：单文件不超过 20MB
  if (blob.byteLength > R2_MAX_FILE_SIZE) {
    throw new Error(
      `文件过大 (${(blob.byteLength / 1024 / 1024).toFixed(1)}MB)。` +
      `为保护 R2 免费额度，单文件限制 20MB。`
    );
  }

  // Step 3: Upload to R2
  const timestamp = Date.now();
  const r2Key = `images/${postId}/${timestamp}.${ext}`;

  await env.R2.put(r2Key, blob, {
    httpMetadata: {
      contentType: mimeType || 'application/octet-stream',
      cacheControl: 'public, max-age=31536000'
    }
  });

  return `${env.ASSETS_URL}/${r2Key}`;
}

// ================================================================
// GitHub API Helpers
// ================================================================

async function commitToGitHub(env: Env, slug: string, content: string): Promise<void> {
  const [owner, repo] = env.GITHUB_REPO.split('/');
  const filePath = `${env.GITHUB_POSTS_PATH}/${slug}.md`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  // Check if file exists (to get SHA for update)
  let sha: string | undefined;
  const checkRes = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ZGQ-Blog-Worker/1.0'
    }
  });
  if (checkRes.ok) {
    const existing = await checkRes.json() as { sha: string };
    sha = existing.sha;
  }

  const body: Record<string, unknown> = {
    message: `post: add ${slug}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: env.GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'ZGQ-Blog-Worker/1.0'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
}

// ================================================================
// Markdown Builder
// ================================================================

function buildMarkdownFile(opts: {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  image?: string;
  date: string;
  slug: string;
}): string {
  const { id, title, summary, tags, image, date, slug } = opts;
  const tagsYaml = tags.length > 0 ? `[${tags.map(t => `"${t}"`).join(', ')}]` : '[]';

  const frontMatter = [
    '---',
    `layout: post`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    `id: "${id}"`,
    `date: ${date}`,
    `summary: "${summary.replace(/"/g, '\\"')}"`,
    `tags: ${tagsYaml}`,
    image ? `image: "${image}"` : null,
    `comments: true`,
    `published_via: telegram`,
    '---',
  ].filter(Boolean).join('\n');

  return `${frontMatter}\n\n${summary}\n\n<!-- 由 Telegram Bot 自动发布 -->\n`;
}

// ================================================================
// Utility Functions
// ================================================================

/** Escape special characters for Telegram MarkdownV2 */
function escapeMdV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

function buildHelpText(): string {
  return [
    '*ZGQ Blog Bot 使用帮助*',
    '',
    '1\\. 创建草稿: `/new [文章标题]`',
    '2\\. 关联频道: `/link <id> <摘要内容>`',
    '3\\. 撤销发布: `/cancel <id>`',
  ].join('\n');
}

function jsonResponse(data: unknown, status = 200): Response {
  return corsResponse(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  );
}

function corsResponse(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(res.body, { status: res.status, headers });
}
