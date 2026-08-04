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
  audio?: TgAudio;
  date: number;
}

interface TgAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
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

  // Authentication check
  if (message.from?.username !== 'ZGQinc') {
    console.warn(`Unauthorized access attempt from @${message.from?.username} (ID: ${message.from?.id})`);
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

  // Parse /sync command
  const syncMatch = text.match(/^\/sync\s+([a-zA-Z0-9_-]+)(?:\s+(.+))?$/s);
  if (syncMatch) {
    await handleSyncCommand(message, syncMatch[1], syncMatch[2] || '', env);
    return jsonResponse({ ok: true });
  }

  // Parse /cancel command
  const cancelMatch = text.match(/^\/cancel\s+([a-zA-Z0-9_-]+)$/s);
  if (cancelMatch) {
    await handleCancelCommand(message, cancelMatch[1], env);
    return jsonResponse({ ok: true });
  }

  // Handle Media Uploads
  if (message.photo || message.video || message.audio || message.document) {
    await handleMediaUpload(message, env);
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
    text: `⏳ 正在创建草稿，请稍候...`,
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
      `image: ""`,
      `categories: []`,
      `tags: []`,
      `comments: true`,
      `toc: true`,
      '---',
      '',
      '<!-- 请在 VSCode 中编辑此草稿的正文内容 -->',
      ''
    ].join('\n');

    await commitToGitHub(env, slug, mdContent);

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `✅ 草稿已生成！\n\n**文件名**: \`${slug}.md\`\n**文章 ID**: \`${id}\`\n\n提交发布后，请使用以下命令关联到频道：\n\n\`/link ${id} 文章摘要\``,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 草稿创建失败: ${String(err)}`
    });
  }
}

async function fetchPostInfoFromGitHub(id: string, env: Env): Promise<{ title: string; tags: string[]; summary: string; image: string } | null> {
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
    const summaryMatch = content.match(/^summary:\s*(.+)$/m);
    let summary = '';
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
      if ((summary.startsWith('"') && summary.endsWith('"')) || (summary.startsWith("'") && summary.endsWith("'"))) {
        summary = summary.substring(1, summary.length - 1);
      }
    }
    const imageMatch = content.match(/^image:\s*(.+)$/m);
    let image = '';
    if (imageMatch) {
      image = imageMatch[1].trim();
      if ((image.startsWith('"') && image.endsWith('"')) || (image.startsWith("'") && image.endsWith("'"))) {
        image = image.substring(1, image.length - 1);
      }
    }
    return { title, tags, summary, image };
  } catch (e) {
    return null;
  }
}

async function handleLinkCommand(message: TgMessage, id: string, providedSummary: string, env: Env): Promise<void> {
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: `⏳ 正在查询文章信息...`,
  });

  try {
    const postInfo = await fetchPostInfoFromGitHub(id, env);
    const title = postInfo ? postInfo.title : '新文章发布';
    const tags = postInfo ? postInfo.tags : [];
    let summary = providedSummary.trim();

    if (!summary && postInfo && postInfo.summary) {
      summary = postInfo.summary;
    }

    if (!summary) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `❌ 请提供摘要内容。文章头部未找到 summary 字段。格式: \`/link ${id} 摘要\``,
        parse_mode: 'Markdown'
      });
      return;
    }
    
    const postUrl = `${env.BLOG_URL}/posts/${id}/`;
    const tgResult = await publishToChannel(env, {
      id,
      title,
      summary,
      tags,
      postUrl
    });

    if (tgResult && tgResult.message_id) {
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

      let channelLink = '';
      if (env.TELEGRAM_CHANNEL_ID.startsWith('@')) {
        channelLink = `\n<b>频道</b>: https://t.me/${env.TELEGRAM_CHANNEL_ID.substring(1)}/${tgResult.message_id}`;
      } else if (env.TELEGRAM_CHANNEL_ID.startsWith('-100')) {
        channelLink = `\n<b>频道</b>: https://t.me/c/${env.TELEGRAM_CHANNEL_ID.substring(4)}/${tgResult.message_id}`;
      }

      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `✅ 关联成功！已推送到频道。\n\n<b>文章</b>: ${title}\n<b>博客</b>: ${postUrl}${channelLink}`,
        parse_mode: 'HTML'
      });
    } else {
      throw new Error(`Failed to send to channel: ${tgResult?.error || 'Unknown error'}`);
    }
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 关联失败: ${String(err)}`
    });
  }
}

async function handleSyncCommand(message: TgMessage, id: string, providedSummary: string, env: Env): Promise<void> {
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: `⏳ 正在查询数据库和 GitHub 以同步文章信息...`,
  });

  try {
    const row = await env.DB.prepare(`SELECT tg_message_id FROM post_tg_map WHERE post_id = ?`).bind(id).first();
    if (!row) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `⚠️ 找不到 ID 为 \`${id}\` 的关联频道消息，请确认是否已发布过。`,
        parse_mode: 'Markdown'
      });
      return;
    }
    const tgMessageId = row.tg_message_id as number;

    const postInfo = await fetchPostInfoFromGitHub(id, env);
    if (!postInfo) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `❌ 在 GitHub 上找不到 ID 为 \`${id}\` 的文章源文件。`,
        parse_mode: 'Markdown'
      });
      return;
    }

    const title = postInfo.title;
    const tags = postInfo.tags;
    let summary = providedSummary.trim();
    if (!summary && postInfo.summary) {
      summary = postInfo.summary;
    }
    if (!summary) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `❌ 文章头部未找到 summary，且未提供新摘要。格式: \`/sync ${id} 这是一段新摘要\``,
        parse_mode: 'Markdown'
      });
      return;
    }

    const postUrl = `${env.BLOG_URL}/posts/${id}/`;
    
    // Formatting text (keep exactly same as publishToChannel)
    const idTag = `#ID_${id.replace(/-/g, '_')}`;
    const otherTags = tags.map(t => `#${t.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`).join(' ');
    const tagsLine = [idTag, otherTags].filter(Boolean).join(' ');

    const text = [
      `<b>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>`,
      '',
      summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      '',
      `📖 <a href="${postUrl}">阅读完整文章</a>`,
      '',
      tagsLine
    ].join('\n');

    let chatId = env.TELEGRAM_CHANNEL_ID;
    if (!chatId.startsWith('@') && !chatId.startsWith('-')) {
      chatId = '@' + chatId;
    }

    // Try editMessageText first (for text messages)
    let editRes = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: tgMessageId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false, url: postUrl, prefer_large_media: !!postInfo.image }
    });

    // If it fails because the original message is a Media message (like sent with sendPhoto previously)
    if (!editRes.ok && (editRes.description?.includes('there is no text in the message to edit') || editRes.description?.includes('message is not modified'))) {
      if (editRes.description?.includes('message is not modified')) {
         // Nothing to update
         editRes = { ok: true } as any;
      } else {
        // Fallback to editMessageCaption for legacy photo messages
        editRes = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageCaption', {
          chat_id: chatId,
          message_id: tgMessageId,
          caption: text,
          parse_mode: 'HTML'
        });
      }
    }

    if (editRes.ok) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `✅ 频道消息已成功同步更新！\n\n<b>文章</b>: ${title}`,
        parse_mode: 'HTML'
      });
      // Optionally update local DB title
      await env.DB.prepare(`UPDATE post_tg_map SET post_title = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?`)
        .bind(title, id).run();
    } else {
      throw new Error(editRes.description || 'Unknown Telegram API error');
    }
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 同步失败: ${String(err)}`
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
        text: `✅ 关联已成功取消！你现在可以重新使用 \`/link\` 命令关联新的频道消息了。`,
        parse_mode: 'Markdown'
      });
    } else {
      throw new Error(delRes.description || 'Unknown Telegram API error');
    }
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 取消关联失败: ${String(err)}`
    });
  }
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'pdf': return 'picture_as_pdf';
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return 'folder_zip';
    case 'doc': case 'docx': return 'description';
    case 'xls': case 'xlsx': case 'csv': return 'table_chart'; // 'table_chart' or 'table', 'table' might not exist in standard MD3, usually it's table_chart or table_view. The user said "table", let's use "table". Wait, they explicitly said "table". I will use "table" to exactly match their template.
    case 'ppt': case 'pptx': return 'co_present';
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg': case 'webp': case 'ico': return 'image';
    case 'mp3': case 'wav': case 'flac': case 'ogg': return 'audio_file';
    case 'mp4': case 'mkv': case 'avi': case 'webm': case 'mov': return 'video_file';
    case 'exe': case 'msi': case 'dmg': case 'apk': case 'bat': case 'ps1': case 'sh': return 'terminal';
    case 'txt': case 'md': case 'rtf': return 'article';
    case 'json': case 'xml': case 'yml': case 'yaml': case 'conf': case 'reg': case 'ini': return 'data_object';
    case 'torrent': return 'cloud_download';
    case 'mcpack': case 'save': case 'mcworld': return 'extension';
    case 'js': case 'ts': case 'py': case 'rb': case 'go': case 'java': case 'c': case 'cpp': case 'rs': case 'php': case 'html': case 'css': case 'scss': case 'cs': case 'swift': case 'kt': case 'dart': case 'lua': case 'sql': return 'code';
    default: return 'description';
  }
}

// User specified 'table', I will override the case for xls above to ensure it uses exactly what they asked.
function getExactFileIcon(ext: string): string {
  const e = ext.toLowerCase();
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'table';
  return getFileIcon(e);
}

async function handleMediaUpload(message: TgMessage, env: Env): Promise<void> {
  const loadingMsg = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
    chat_id: message.chat.id,
    text: `⏳ 正在上传文件至 R2 存储，请稍候...`
  });

  try {
    let fileId = '';
    let mimeType = '';
    let fileName = '';
    let fileSize = 0;

    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      fileId = largestPhoto.file_id;
      mimeType = 'image/jpeg';
      fileName = `photo_${Date.now()}.jpg`;
      fileSize = largestPhoto.file_size || 0;
    } else if (message.video) {
      fileId = message.video.file_id;
      mimeType = message.video.mime_type || 'video/mp4';
      fileName = message.video.file_name || `video_${Date.now()}.mp4`;
      fileSize = message.video.file_size || 0;
    } else if (message.audio) {
      fileId = message.audio.file_id;
      mimeType = message.audio.mime_type || 'audio/mpeg';
      fileName = message.audio.file_name || `audio_${Date.now()}.mp3`;
      fileSize = message.audio.file_size || 0;
    } else if (message.document) {
      fileId = message.document.file_id;
      mimeType = message.document.mime_type || 'application/octet-stream';
      fileName = message.document.file_name || `file_${Date.now()}.bin`;
      fileSize = message.document.file_size || 0;
    } else {
      throw new Error('不支持的文件类型');
    }

    let postId = 'shared';
    const caption = message.caption || '';
    const uploadMatch = caption.match(/^\/upload\s+([a-zA-Z0-9_-]+)/s);
    if (uploadMatch) {
      postId = uploadMatch[1];
    } else {
      const date = new Date();
      postId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const r2Url = await uploadMediaToR2(env, postId, fileId, mimeType, fileName);

    try {
      // DB insert might fail if postId doesn't exist in post_tg_map due to FOREIGN KEY constraint
      await env.DB.prepare(
        `INSERT INTO media_uploads (post_id, tg_file_id, r2_key, r2_url, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(uploadMatch ? postId : null, fileId, r2Url.replace(env.ASSETS_URL + '/', ''), r2Url, mimeType, fileSize).run();
    } catch (dbErr) {
      console.warn("Failed to insert media_uploads record, probably foreign key constraint:", dbErr);
    }

    const formattedSize = formatBytes(fileSize);
    const today = new Date().toISOString().split('T')[0];
    const ext = fileName.split('.').pop() || '';
    const icon = getExactFileIcon(ext);
    
    // Liquid file download card format
    const liquidSnippet = [
      `{% include file_download.html`,
      `   name="${fileName}"`,
      `   size="${formattedSize}"`,
      `   date="${today}"`,
      `   icon="${icon}"`,
      `   url="${r2Url}" %}`
    ].join('\n');

    let replyText = `✅ **文件上传成功！**\n\n📥 **访问直链**:\n\`${r2Url}\`\n\n📝 **下载卡片代码 (Liquid)**:\n\`\`\`liquid\n${liquidSnippet}\n\`\`\``;

    if (mimeType.startsWith('image/')) {
      replyText += `\n\n🖼 **普通图片引用**:\n\`![](${r2Url})\``;
    }

    await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
      chat_id: message.chat.id,
      message_id: loadingMsg.result.message_id as number,
      text: replyText,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
      chat_id: message.chat.id,
      message_id: loadingMsg.result.message_id as number,
      text: `❌ 上传失败: ${String(err)}`
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
): Promise<{ message_id: number; error?: string } | null> {
  const { id, title, summary, tags, postUrl, image } = opts;

  let chatId = env.TELEGRAM_CHANNEL_ID;
  if (!chatId.startsWith('@') && !chatId.startsWith('-')) {
    chatId = '@' + chatId;
  }

  // Build MarkdownV2 text
  // Format tag ID: 2026-001 → #ID_2026_001
  const idTag = `#ID_${id.replace(/-/g, '_')}`;
  const otherTags = tags.map(t => `#${t.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`).join(' ');
  const tagsLine = [idTag, otherTags].filter(Boolean).join(' ');

  const text = [
    `<b>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>`,
    '',
    summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    '',
    `📖 <a href="${postUrl}">阅读完整文章</a>`,
    '',
    tagsLine
  ].join('\n');

  // Send text message with link preview options
  // With prefer_large_media: true, the OpenGraph image (og:image) of the post will be rendered at the bottom!
  const result = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: false, url: postUrl, prefer_large_media: !!image }
  });

  if (!result.ok) {
    console.error('sendMessage failed:', result);
    return { message_id: 0, error: result.description || 'API Error' };
  }

  return { message_id: result.result.message_id as number };
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

function isMimeAllowed(mime?: string): boolean {
  return true; // 允许所有类型上传
}

async function uploadMediaToR2(
  env: Env,
  postId: string,
  fileId: string,
  mimeType?: string,
  fileName?: string
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
  const r2Key = fileName ? `images/${postId}/${fileName}` : `images/${postId}/${Date.now()}.${ext}`;

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
    '*使用帮助*',
    '',
    '1\\. 创建草稿: `/new [文章标题]`',
    '2\\. 关联频道: `/link <id> [摘要内容]`',
    '3\\. 更新频道: `/sync <id> [新摘要]`',
    '4\\. 撤销发布: `/cancel <id>`',
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
