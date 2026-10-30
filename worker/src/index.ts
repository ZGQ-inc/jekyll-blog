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
  CHANNELS_CONFIG?: string;
  ADMIN_USERS?: string;
  ADMIN_USER?: string;
  TELEGRAM_IV_RHASH?: string;
  // Secrets
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL_ID: string;
  GITHUB_TOKEN: string;
  NOTIFY_SECRET: string;
  WEBHOOK_SECRET: string;
  VAULT_KEY?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
  callback_query?: TgCallbackQuery;
}

interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  sender_chat?: TgChat;
  is_automatic_forward?: boolean;
  reply_to_message?: TgMessage;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgDocument;
  video?: TgVideo;
  audio?: TgAudio;
  date: number;
  // Service / System message fields
  pinned_message?: any;
  new_chat_members?: any[];
  left_chat_member?: any;
  new_chat_title?: string;
  new_chat_photo?: any[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  message_auto_delete_timer_changed?: any;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  forum_topic_created?: any;
  forum_topic_edited?: any;
  forum_topic_closed?: any;
  forum_topic_reopened?: any;
  video_chat_started?: any;
  video_chat_ended?: any;
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
  is_bot?: boolean;
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

interface NotifyPayload {
  post_id: string;
  title: string;
  summary: string;
  tags: string[];
  image?: string;
  slug: string;
  date: string;
  restricted?: boolean;
}

function generateVaultToken(userId: number, env?: Env): string {
  const key = env?.VAULT_KEY;
  if (!key) {
    throw new Error('VAULT_KEY secret is not configured in Cloudflare Worker');
  }
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const nonce = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const payload = {
    k: key,
    exp: expiresAt,
    uid: userId,
    nonce: nonce
  };
  const jsonStr = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(jsonStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

      // Query TG comments for a post (parsed as clean JSON)
      const commentsQuery = path.match(/^\/api\/posts\/([^/]+)\/comments$/);
      if (commentsQuery && method === 'GET') {
        return handleGetPostComments(commentsQuery[1], request, env);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (err) {
      console.error('Unhandled error:', err);
      return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
  }
};

// Helper to calculate Beijing Time (UTC+8)
function getBeijingTime(): { today: string; dateStr: string; yearMonth: string } {
  const beijingMs = Date.now() + 8 * 60 * 60 * 1000;
  const beijingDate = new Date(beijingMs);
  const iso = beijingDate.toISOString();
  const today = iso.split('T')[0];
  const dateStr = iso.replace('T', ' ').substring(0, 19);
  const yearMonth = today.substring(0, 7);
  return { today, dateStr, yearMonth };
}

// ================================================================
// Authorization Helper
// ================================================================

function isAuthorizedAdmin(
  user: { id?: number | string; username?: string; first_name?: string } | undefined,
  env: Env
): boolean {
  if (!user) return false;

  // Read admin list from env (ADMIN_USERS or ADMIN_USER), fallback to 'ZGQinc' for backward compatibility
  const rawAdmins = env.ADMIN_USERS || env.ADMIN_USER || 'ZGQinc';
  const adminList = rawAdmins
    .split(',')
    .map(s => s.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  const username = (user.username || '').toLowerCase().replace(/^@/, '');
  const userId = String(user.id || '');

  return adminList.some(admin => admin === username || admin === userId);
}

/**
 * Record or update subscriber interaction in D1.
 * Admin users are recorded with is_active = 0 to guarantee they never receive broadcasts.
 * Regular users are recorded with is_active = 1 by default, preserving preference on update.
 */
async function recordSubscriber(user: TgUser | undefined, env: Env): Promise<void> {
  if (!user || user.is_bot) return;
  const isAdmin = isAuthorizedAdmin(user, env);
  try {
    if (isAdmin) {
      await env.DB.prepare(
        `INSERT INTO bot_subscribers (user_id, username, first_name, is_active, updated_at)
         VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           username = excluded.username,
           first_name = excluded.first_name,
           is_active = 0,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(
        user.id,
        user.username || null,
        user.first_name || null
      ).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO bot_subscribers (user_id, username, first_name, is_active, updated_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           username = excluded.username,
           first_name = excluded.first_name,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(
        user.id,
        user.username || null,
        user.first_name || null
      ).run();
    }
  } catch (err) {
    console.error('[recordSubscriber] Failed to record subscriber:', err);
  }
}

// ================================================================

/**
 * Update subscriber active preference in D1.
 */
async function setSubscriberActive(
  user: { id: number | string; username?: string | null; first_name?: string | null },
  isActive: boolean,
  env: Env
): Promise<void> {
  const numId = Number(user.id);
  if (!numId) return;
  try {
    if (isActive) {
      await env.DB.prepare(
        `INSERT INTO bot_subscribers (user_id, username, first_name, is_active, updated_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           username = excluded.username,
           first_name = excluded.first_name,
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(numId, user.username || null, user.first_name || null).run();
    } else {
      await env.DB.prepare(
        `UPDATE bot_subscribers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).bind(numId).run();
    }
  } catch (err) {
    console.error('[setSubscriberActive] Failed:', err);
  }
}

/**
 * Send vault access unlock token card to user.
 */
async function sendUnlockCard(
  chatId: number,
  user: { id: number; first_name?: string },
  env: Env
): Promise<void> {
  const token = generateVaultToken(user.id, env);
  const blogUrl = env.BLOG_URL || 'https://blog.zgqinc.gq';
  const unlockUrl = `${blogUrl}/about/#access_token=${token}`;

  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: chatId,
    text: [
      '🔐 <b>受限文章解密凭证已就绪</b>',
      '',
      `读者 <b>${escapeHtml(user.first_name || '读者')}</b>，您的专属访问令牌已生成（30 天有效）。`,
      '',
      '点击下方专属凭证链接即可自动解锁博客的所有机密与受限文章：',
      '',
      `🔗 <a href="${unlockUrl}">👉 点击立即前往博客自动解锁</a>`,
      '',
      '💡 <i>安全说明：本链接通过 URL Hash (#) 传递端到端 AES 解密参数，解密过程全部在您的浏览器本地 Web Crypto 中完成，服务器不记录明文密钥。到期后可随时再次点击按钮或发送 /unlock 自动刷新 30 天。</i>'
    ].join('\n'),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 立即前往博客解锁 (30天有效)', url: unlockUrl }]
      ]
    }
  });
}

/**
 * Build standard Telegram message URL for a channel post
 */
function buildTelegramMessageUrl(channel: string, messageId: number | string): string {
  const clean = channel.replace('@', '');
  if (!clean || !messageId) return '';
  if (clean.startsWith('-100')) {
    return `https://t.me/c/${clean.substring(4)}/${messageId}`;
  }
  return `https://t.me/${clean}/${messageId}`;
}

/**
 * Format post tags and Instant View zero-width ghost link
 */
function formatPostTagsAndIv(
  env: Env,
  opts: { id: string; postUrl: string; tags?: string[] }
): { tagsLine: string; ivUrl: string | null; ghostLink: string } {
  const { id, postUrl, tags } = opts;
  const idTag = `#ID_${id.replace(/-/g, '_')}`;
  const otherTags = (tags || []).map(t => `#${t.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`).join(' ');
  const tagsLine = [idTag, otherTags].filter(Boolean).join(' ');

  const ivUrl = env.TELEGRAM_IV_RHASH
    ? `https://t.me/iv?url=${encodeURIComponent(postUrl)}&rhash=${env.TELEGRAM_IV_RHASH}`
    : null;
  const ghostLink = ivUrl ? `<a href="${ivUrl}">&#8203;</a>` : '';

  return { tagsLine, ivUrl, ghostLink };
}

let botCommandsConfigured = false;
async function ensureBotCommands(token: string): Promise<void> {
  if (botCommandsConfigured) return;
  await setupBotCommands(token);
  botCommandsConfigured = true;
}

// ZGQ Blog Cloudflare Worker - Telegram Webhook
// Trigger CF Worker CI Test
// ================================================================

async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  // Verify secret token header
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const update: TgUpdate = await request.json();
  
  if (update.callback_query) {
    if (update.callback_query.from) {
      await recordSubscriber(update.callback_query.from, env);
    }

    const cbData = update.callback_query.data || '';
    if (cbData === 'user_unsubscribe') {
      const user = update.callback_query.from;
      await setSubscriberActive(user, false, env);

      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
        callback_query_id: update.callback_query.id,
        text: '🔕 已退订新文章私信推送'
      });

      if (update.callback_query.message?.chat?.id) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
          chat_id: update.callback_query.message.chat.id,
          text: '🔕 <b>已退订新文章私信推送</b>\n\n您将不会再收到新文章私信推送。随时发送 <code>/subscribe</code> 或点击下方按钮即可重新订阅。',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔔 重新订阅推送', callback_data: 'user_subscribe' }]
            ]
          }
        });
      }
      return jsonResponse({ ok: true });
    }

    if (cbData === 'user_subscribe') {
      const user = update.callback_query.from;
      await setSubscriberActive(user, true, env);

      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
        callback_query_id: update.callback_query.id,
        text: '🔔 已恢复订阅新文章推送！'
      });

      if (update.callback_query.message?.chat?.id) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
          chat_id: update.callback_query.message.chat.id,
          text: '🔔 <b>已恢复订阅新文章私信推送！</b>\n\n新文章发布时将第一时间同步通知您。',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔕 退订推送', callback_data: 'user_unsubscribe' }]
            ]
          }
        });
      }
      return jsonResponse({ ok: true });
    }

    if (cbData === 'user_unlock') {
      const user = update.callback_query.from;
      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
        callback_query_id: update.callback_query.id,
        text: '✅ 凭证已生成，正在发送解锁链接...'
      });

      if (update.callback_query.message?.chat?.id) {
        await sendUnlockCard(update.callback_query.message.chat.id, user, env);
      }
      return jsonResponse({ ok: true });
    }

    if (!isAuthorizedAdmin(update.callback_query.from, env)) {
      console.warn(`Unauthorized callback_query from @${update.callback_query.from?.username} (ID: ${update.callback_query.from?.id})`);
      try {
        await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
          callback_query_id: update.callback_query.id,
          text: '⛔ 该操作仅限博客管理员。',
          show_alert: true
        });
      } catch (e) {}
      return jsonResponse({ ok: true });
    }
    await handleCallbackQuery(update.callback_query, env);
    return jsonResponse({ ok: true });
  }

  const message = update.message;

  if (!message) {
    return jsonResponse({ ok: true });
  }

  // 1. 过滤特殊消息与系统服务消息，防止误触发或向群组/频道刷屏
  // 1.1 自动转发消息 (如频道发布后自动转发到关联讨论组的消息)
  if (message.is_automatic_forward) {
    return jsonResponse({ ok: true });
  }

  // 1.2 Telegram 官方系统账号 (777000) 消息
  if (message.from?.id === 777000) {
    return jsonResponse({ ok: true });
  }

  // 1.3 来自其他 Bot 的消息，防止 Bot 间相互唤醒或循环触发
  if (message.from?.is_bot) {
    return jsonResponse({ ok: true });
  }

  // 1.4 系统服务事件消息 (置顶、加群、退群、修改群名、群创建等无内容消息)
  const isServiceMessage = !!(
    message.pinned_message ||
    message.new_chat_members ||
    message.left_chat_member ||
    message.new_chat_title ||
    message.new_chat_photo ||
    message.delete_chat_photo ||
    message.group_chat_created ||
    message.supergroup_chat_created ||
    message.channel_chat_created ||
    message.message_auto_delete_timer_changed ||
    message.migrate_to_chat_id ||
    message.migrate_from_chat_id ||
    message.forum_topic_created ||
    message.forum_topic_edited ||
    message.forum_topic_closed ||
    message.forum_topic_reopened ||
    message.video_chat_started ||
    message.video_chat_ended
  );
  if (isServiceMessage) {
    return jsonResponse({ ok: true });
  }

  // 1.5 空内容消息 (既无文本、图文说明，也无任何媒体附件)
  const hasContent = !!(
    message.text ||
    message.caption ||
    message.photo ||
    message.video ||
    message.audio ||
    message.document
  );
  if (!hasContent) {
    return jsonResponse({ ok: true });
  }

  const isPrivateChat = message.chat?.type === 'private';
  const text = message.text || message.caption || '';
  const isCommandOrBotAction = text.startsWith('/') || 
    text.startsWith('📁') || 
    text === '❌ 取消创建' || 
    !!(message.reply_to_message?.from?.is_bot);

  // 记录订阅者（用户私聊或发送指令）
  if (message.from && (isPrivateChat || message.text?.startsWith('/'))) {
    await recordSubscriber(message.from, env);
  }

  // 1.6 允许任意 Telegram 用户通过 /unlock、/getkey、/vault 获取受限文章解锁凭证
  const trimmedText = text.trim();
  const isUnlockCmd = /^\/(unlock|getkey|access|vault)(\s+.*)?$/i.test(trimmedText) ||
                      /^\/start\s+(unlock|vault|access)/i.test(trimmedText);

  if (isUnlockCmd && message.from && message.chat) {
    await sendUnlockCard(message.chat.id, message.from, env);
    return jsonResponse({ ok: true });
  }

  // 1.6.1 处理 /subscribe 订阅指令
  const isSubscribeCmd = /^\/subscribe(?:@\w+)?(?:\s|$)/i.test(trimmedText);
  if (isSubscribeCmd && message.from && message.chat) {
    await setSubscriberActive(message.from, true, env);
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: [
        '🔔 <b>已成功订阅博客新文章推送！</b>',
        '',
        '每当博主发布新文章并推送到频道时，Bot 会第一时间私信向您推送精选摘要与阅读直达链接。',
        '',
        '💡 <i>如需退订，可随时发送 <code>/unsubscribe</code> 或点击推送底部的退订按钮。</i>'
      ].join('\n'),
      parse_mode: 'HTML'
    });
    return jsonResponse({ ok: true });
  }

  // 1.6.2 处理 /unsubscribe 退订指令
  const isUnsubscribeCmd = /^\/unsubscribe(?:@\w+)?(?:\s|$)/i.test(trimmedText);
  if (isUnsubscribeCmd && message.from && message.chat) {
    await setSubscriberActive(message.from, false, env);
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: [
        '🔕 <b>已退订新文章私信推送</b>',
        '',
        '您将不会再收到新文章私信通知。',
        '',
        '💡 <i>您可以继续使用 <code>/unlock</code> 获取受限文章解锁令牌，随时发送 <code>/subscribe</code> 即可重新订阅。</i>'
      ].join('\n'),
      parse_mode: 'HTML'
    });
    return jsonResponse({ ok: true });
  }

  // 1.7 处理 /privacy 指令
  const isPrivacy = /^\/privacy(?:@\w+)?(?:\s|$)/i.test(trimmedText);
  if (isPrivacy && message.chat) {
    const blogUrl = env.BLOG_URL || 'https://blog.zgqinc.gq';
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: [
        '🔒 <b>隐私保护政策 / Privacy Policy</b>',
        '',
        '<b>1. 信息收集与使用</b>',
        '本助手（@zgqinc_blog_bot）仅收集您的 Telegram User ID、用户名及昵称，用于：',
        '• 接收博客最新文章私信通知（<code>/subscribe</code>）',
        '• 生成 30 天加密文章临时访问凭据（<code>/unlock</code>）',
        '',
        '<b>2. 绝不获取个人敏感隐私</b>',
        '我们<b>绝不</b>获取或存储您的手机号、真实姓名、个人通讯录、私人聊天记录或地理位置。',
        '',
        '<b>3. 自由退订与数据删除</b>',
        '您可以随时发送 <code>/unsubscribe</code> 立即停止一切私信推送，并不再接收任何广播。',
        '',
        '<b>4. 安全保障</b>',
        '所有数据与服务由 Cloudflare 边缘计算与加密传输保障，零第三方商业数据出售。'
      ].join('\n'),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📖 在博客查阅完整隐私政策', url: `${blogUrl}/privacy/` }
          ]
        ]
      }
    });
    return jsonResponse({ ok: true });
  }

  // 1.8 处理 /setupbot 指令（管理员专用：立即向 Telegram 同步注册官方资料与菜单）
  const isSetupBot = /^\/(setupbot|initbot)(?:@\w+)?(?:\s|$)/i.test(trimmedText);
  if (isSetupBot && message.chat) {
    if (!isAuthorizedAdmin(message.from, env)) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: '🔒 抱歉，只有博主/管理员可以执行此指令。'
      });
      return jsonResponse({ ok: true });
    }

    await setupBotCommands(env.TELEGRAM_BOT_TOKEN);
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: [
        '✅ <b>机器人官方资料与指令菜单已同步更新到 Telegram！</b>',
        '',
        '• <b>名称 (Name)</b>: ZGQ Inc.\'s Blog 博客助手',
        '• <b>关于 (About)</b>: ZGQ Inc. 个人博客官方助手。博客地址： blog.zgqinc.gq',
        '• <b>主描述 (Description)</b>: 已设置欢迎卡片与功能说明',
        '• <b>官方指令</b>: unlock, subscribe, unsubscribe, new, link, sync, cancel, bind, help',
        '',
        '<i>注：Telegram 客户端通常会在数分钟内刷新显示。</i>'
      ].join('\n'),
      parse_mode: 'HTML'
    });
    return jsonResponse({ ok: true });
  }

  // 1.9 处理 /start 与 /help 指令（区分管理员与普通读者）
  const isStartOrHelp = /^\/(start|help)(?:@\w+)?(?:\s|$)/i.test(trimmedText);
  if (isStartOrHelp && message.chat) {
    await ensureBotCommands(env.TELEGRAM_BOT_TOKEN);
    const blogUrl = env.BLOG_URL || 'https://blog.zgqinc.gq';
    const channelName = env.TELEGRAM_CHANNEL_ID ? env.TELEGRAM_CHANNEL_ID.replace('@', '') : 'CopyRightZGQInc';
    const channelUrl = `https://t.me/${channelName}`;

    if (isAuthorizedAdmin(message.from, env)) {
      // 管理员控制台视图
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: [
          '👑 <b>博主控制中心 / Admin Dashboard</b>',
          '',
          `欢迎回来，<b>${escapeHtml(message.from?.first_name || '博主')}</b>！`,
          '',
          '📝 <b>快捷管理指令：</b>',
          '• <code>/new [标题]</code> — 新建文章草稿并提交到 GitHub',
          '• <code>/link &lt;id&gt; [摘要]</code> — 关联发布到 Telegram 频道',
          '• <code>/sync &lt;id&gt;</code> — 重新同步文章内容与摘要',
          '• <code>/bind &lt;id&gt; &lt;url&gt;</code> — 手动绑定已有频道消息',
          '• <code>/cancel &lt;id&gt;</code> — 取消草稿并清理分支',
          '• 直接发送媒体（图片/视频/文档）可直传 R2 图床',
          '',
          '🔑 <b>读者功能测试：</b>',
          '• <code>/unlock</code> — 测试生成 30 天受限文章解密令牌'
        ].join('\n'),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔑 测试生成解锁凭证', callback_data: 'user_unlock' }
            ],
            [
              { text: '🌐 访问博客首页', url: blogUrl },
              { text: '📢 前往博客频道', url: channelUrl }
            ]
          ]
        }
      });
      return jsonResponse({ ok: true });
    } else {
      // 普通读者欢迎卡片
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: [
          `👋 <b>您好，${escapeHtml(message.from?.first_name || '朋友')}！欢迎使用 Blog 助手</b>`,
          '',
          '本机器人是 <b>ZGQ Inc. 个人博客</b>的官方服务助手。',
          '',
          '✨ <b>核心服务功能：</b>',
          '• 🔐 <b>受限文章访问凭证</b>：本站部分底层逆向与深度系统安全文章已启用端到端加密保护。点击下方按钮即可一键获取 <b>30 天有效</b>的专属解密链接。',
          '• 📢 <b>频道订阅与讨论</b>：最新技术干货发布时将自动推送摘要至频道，支持一键前往讨论区。',
          '• 🌐 <b>博客内容与导航</b>：随时直达博客主页、分类标签与归档。',
          '',
          '👇 <b>请点击下方按钮选择所需操作：</b>'
        ].join('\n'),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔑 获取受限文章解锁凭证 (30天)', callback_data: 'user_unlock' }
            ],
            [
              { text: '🌐 访问博客首页', url: blogUrl },
              { text: '📢 前往 Telegram 频道', url: channelUrl }
            ],
            [
              { text: '🔔 订阅新文章推送', callback_data: 'user_subscribe' },
              { text: '🔕 退订新文章推送', callback_data: 'user_unsubscribe' }
            ],
            [
              { text: '🔒 隐私政策', url: `${blogUrl}/privacy/` },
              { text: '👤 关于本站 / 凭证状态', url: `${blogUrl}/about/` }
            ]
          ]
        }
      });
      return jsonResponse({ ok: true });
    }
  }

  // 2. 权限校验（非管理员尝试使用管理指令时的提示）
  if (!isAuthorizedAdmin(message.from, env)) {
    const fromDesc = message.from
      ? `${message.from.first_name || ''} (@${message.from.username || '无用户名'}, ID: ${message.from.id})`
      : '未知用户';
    console.warn(`Unauthorized access attempt from ${fromDesc} in chat ${message.chat?.id} (${message.chat?.type})`);

    if (isPrivateChat && message.chat?.id) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: [
          '🔒 <b>权限受限 / Admin Only</b>',
          '',
          '抱歉，此功能为博客管理员专用操作命令。',
          '',
          '💡 如果您希望阅读博客的受限机密技术文章，请发送 <code>/unlock</code> 或点击下方按钮获取 30 天有效解密链接：'
        ].join('\n'),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔑 获取受限文章解锁凭证', callback_data: 'user_unlock' }
            ],
            [
              { text: '🌐 访问博客首页', url: env.BLOG_URL || 'https://blog.zgqinc.gq' }
            ]
          ]
        }
      });
    }
    return jsonResponse({ ok: true });
  }

  // 3. 在非私聊群组中，如果不是针对 Bot 的指令或操作，也予以静默忽略，不干扰正常群聊
  if (!isPrivateChat && !isCommandOrBotAction) {
    return jsonResponse({ ok: true });
  }

  // Handle Cancel from Reply Keyboard Menu
  if (text === '❌ 取消创建') {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: '已取消创建草稿。',
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true }
    });
    return jsonResponse({ ok: true });
  }

  // Handle Channel Selection from Reply Keyboard Menu (e.g. "📁 主频道 (ZGQincLiqun)" or "📁 个人频道 (CopyRightZGQInc)")
  const channelMenuMatch = text.match(/^📁\s*(.+?)(?:\s*\((.+?)\))?$/);
  if (channelMenuMatch) {
    let channels: any[] = [];
    try {
      channels = JSON.parse(env.CHANNELS_CONFIG || '[]');
    } catch (e) {}

    const selectedNameOrFolder = (channelMenuMatch[2] || channelMenuMatch[1]).trim();
    const matchedChannel = channels.find((c: any) => c.folder === selectedNameOrFolder || c.name === channelMenuMatch[1].trim());
    const folder = matchedChannel ? matchedChannel.folder : selectedNameOrFolder;

    // Extract title from replied message if available
    let title = '未命名文章';
    const repliedText = message.reply_to_message?.text || '';
    const titleMatch = repliedText.match(/文章标题[:：]\s*(.+)/) || repliedText.match(/请从下方.+?文章标题.+?<code>(.+?)<\/code>/s);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    await createDraftAndCommit(env, title, folder, message.chat.id);
    return jsonResponse({ ok: true });
  }

  // Parse /new command (支持 /new 或群聊中的 /new@BotName)
  const newMatch = text.match(/^\/new(?:@\w+)?(?:\s+(.+)|$)/s);
  if (newMatch) {
    const title = newMatch[1] ? newMatch[1].trim() : '未命名文章';
    await handleNewCommand(message, title, env);
    return jsonResponse({ ok: true });
  }

  // Parse /link command
  const linkMatch = text.match(/^\/link(?:@\w+)?\s+([a-zA-Z0-9_-]+)(?:\s+(.+))?$/s);
  if (linkMatch) {
    await handleLinkCommand(message, linkMatch[1], linkMatch[2] || '', env);
    return jsonResponse({ ok: true });
  }

  // Parse /sync command
  const syncMatch = text.match(/^\/sync(?:@\w+)?\s+([a-zA-Z0-9_-]+)(?:\s+(.+))?$/s);
  if (syncMatch) {
    await handleSyncCommand(message, syncMatch[1], syncMatch[2] || '', env);
    return jsonResponse({ ok: true });
  }

  // Parse /cancel command
  const cancelMatch = text.match(/^\/cancel(?:@\w+)?\s+([a-zA-Z0-9_-]+)$/s);
  if (cancelMatch) {
    await handleCancelCommand(message, cancelMatch[1], env);
    return jsonResponse({ ok: true });
  }

  // Parse /bind command
  const bindMatch = text.match(/^\/bind(?:@\w+)?\s+([a-zA-Z0-9_-]+)\s+(https?:\/\/t\.me\/(?:c\/)?([a-zA-Z0-9_]+)\/(\d+))/s);
  if (bindMatch) {
    await handleBindCommand(message, bindMatch[1], bindMatch[2], bindMatch[3], bindMatch[4], env);
    return jsonResponse({ ok: true });
  }

  // Handle Media Uploads
  if (message.photo || message.video || message.audio || message.document) {
    await handleMediaUpload(message, env);
    return jsonResponse({ ok: true });
  }


  return jsonResponse({ ok: true });
}

/**
 * Register Telegram official Command Menu List API (setMyCommands & setChatMenuButton)
 */
async function setupBotCommands(token: string): Promise<void> {
  try {
    // 1. 设置机器人显示名称 (Name)
    await callTelegramApi(token, 'setMyName', {
      name: "ZGQ Inc.'s Blog 博客助手"
    });

    // 2. 设置官方 9 个指令列表 (Commands)
    await callTelegramApi(token, 'setMyCommands', {
      commands: [
        { command: 'unlock', description: '获取解锁凭证' },
        { command: 'subscribe', description: '订阅新文章推送' },
        { command: 'unsubscribe', description: '退订新文章推送' },
        { command: 'new', description: '创建新文章草稿(仅限管理员)' },
        { command: 'link', description: '推送文章到频道(仅限管理员)' },
        { command: 'sync', description: '同步更新频道信息(仅限管理员)' },
        { command: 'cancel', description: '取消频道关联(仅限管理员)' },
        { command: 'bind', description: '手动绑定(仅限管理员)' },
        { command: 'help', description: '显示使用帮助' }
      ]
    });

    // 3. 启用左下角官方快捷指令菜单按钮
    await callTelegramApi(token, 'setChatMenuButton', {
      menu_button: { type: 'commands' }
    });

    // 4. 设置关于文本 (About / Short Description)
    await callTelegramApi(token, 'setMyShortDescription', {
      short_description: 'ZGQ Inc. 个人博客官方助手。\n博客地址： blog.zgqinc.gq'
    });

    // 5. 设置机器人欢迎主说明 (Description)
    await callTelegramApi(token, 'setMyDescription', {
      description: '👋 欢迎使用 ZGQ Blog 官方助手！\n\n本机器人是 ZGQ Inc. 个人博客 blog.zgqinc.gq 的配套服务 Bot。\n\n🔐 获取机密技术文章阅读凭证：\n针对博客中的敏感文章，点击下方 Start 并发送 /unlock，即可一键获取 30 天端到端解密授权。\n📢 频道订阅与动态讨论：\n文章发布即时推送，支持一键前往关联讨论组交流。'
    });
  } catch (e) {
    console.warn('Failed to setup bot commands menu:', e);
  }
}

async function handleNewCommand(message: TgMessage, title: string, env: Env): Promise<void> {
  let channels: any[] = [];
  try {
    channels = JSON.parse(env.CHANNELS_CONFIG || '[]');
  } catch (e) {
    console.warn("Failed to parse CHANNELS_CONFIG", e);
  }

  if (channels.length === 0) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 未配置任何频道 (CHANNELS_CONFIG)，无法创建草稿。`,
      parse_mode: 'HTML'
    });
    return;
  }

  const isPrivateChat = message.chat?.type === 'private';
  if (!isPrivateChat) {
    // 群组模式：使用 Inline Keyboard (消息内嵌按钮)，避免 Reply Keyboard 污染整个群的输入栏
    const inlineKeyboard = {
      inline_keyboard: [
        ...channels.map((c: any) => ([{
          text: `📁 ${c.name} (${c.folder})`,
          callback_data: `new_draft:${c.folder}`
        }])),
        [{ text: '❌ 取消创建', callback_data: 'new_draft:cancel' }]
      ]
    };

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: [
        `请点击下方按钮选择目标发布频道：\n`,
        `📌 <b>文章标题</b>: <code>${escapeHtml(title)}</code>`
      ].join('\n'),
      parse_mode: 'HTML',
      reply_to_message_id: message.message_id,
      reply_markup: inlineKeyboard
    });
    return;
  }

  // 私聊模式：使用 Reply Keyboard (底部快捷菜单)
  const keyboard = channels.map((c: any) => ([{
    text: `📁 ${c.name} (${c.folder})`
  }]));
  keyboard.push([{ text: '❌ 取消创建' }]);

  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: [
      `请从下方<b>菜单列表</b>中选择目标发布频道：\n`,
      `📌 <b>文章标题</b>: <code>${escapeHtml(title)}</code>`
    ].join('\n'),
    parse_mode: 'HTML',
    reply_to_message_id: message.message_id,
    reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true,
      one_time_keyboard: true,
      input_field_placeholder: '点击下方菜单选择目标频道...'
    }
  });
}

async function handleCallbackQuery(callbackQuery: TgCallbackQuery, env: Env): Promise<void> {
  const data = callbackQuery.data;
  if (!data || !data.startsWith('new_draft:')) return;

  // Answer callback query immediately to dismiss client loading spinner
  try {
    await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
      callback_query_id: callbackQuery.id
    });
  } catch (e) {}

  if (data === 'new_draft:cancel') {
    if (callbackQuery.message) {
      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: '已取消创建草稿。',
        parse_mode: 'HTML'
      });
    }
    return;
  }

  const folder = data.replace('new_draft:', '').trim();

  // Extract title from bot message text
  let title = '未命名文章';
  const msgText = callbackQuery.message?.text || '';
  const titleMatch = msgText.match(/请选择要将\s*(.+?)\s*发布到哪个频道/) || msgText.match(/文章标题[:：]\s*(.+)/) || msgText.match(/文章标题.+?<code>(.+?)<\/code>/s);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  if (callbackQuery.message) {
    await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      text: `⏳ 正在为您创建草稿到 <code>${escapeHtml(folder || '默认')}</code>，请稍候...`,
      parse_mode: 'HTML'
    });

    await createDraftAndCommit(env, title, folder, callbackQuery.message.chat.id, callbackQuery.message.message_id);
  }
}

async function createDraftAndCommit(
  env: Env,
  title: string,
  folder: string,
  chatId: number,
  messageIdToEdit?: number
): Promise<void> {
  const id = Math.random().toString(36).substring(2, 8);
  const { today, dateStr } = getBeijingTime();
  const slug = `${today}-${id}`;

  try {
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
      `archive: false`,
      `comments: true`,
      `toc: true`,
      '---',
      '',
      '<!-- 正文内容 -->',
      ''
    ].join('\n');

    await commitToGitHub(env, slug, mdContent, folder);

    const successHtml = [
      `✅ <b>草稿已成功生成并提交至 GitHub！</b>\n`,
      `📁 <b>目标频道</b>: <code>${escapeHtml(folder || '默认')}</code>`,
      `📄 <b>文件名称</b>: <code>${escapeHtml(slug)}.md</code>`,
      `🆔 <b>文章 ID</b>: <code>${escapeHtml(id)}</code>\n`,
      `提交发布后，请使用以下命令关联 Telegram 频道：`,
      `<code>/link ${id} 文章摘要</code>`
    ].join('\n');

    if (messageIdToEdit) {
      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
        chat_id: chatId,
        message_id: messageIdToEdit,
        text: successHtml,
        parse_mode: 'HTML'
      });
    } else {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: chatId,
        text: successHtml,
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
      });
    }
  } catch (err) {
    console.error('Draft creation error:', err);
    const errorHtml = `❌ <b>草稿创建失败</b>: <code>${escapeHtml(String(err))}</code>`;
    if (messageIdToEdit) {
      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
        chat_id: chatId,
        message_id: messageIdToEdit,
        text: errorHtml,
        parse_mode: 'HTML'
      });
    } else {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: chatId,
        text: errorHtml,
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
      });
    }
  }
}

async function fetchPostInfoFromGitHub(id: string, env: Env): Promise<{ title: string; tags: string[]; summary: string; image: string; folder: string } | null> {
  try {
    const [owner, repo] = env.GITHUB_REPO.split('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${env.GITHUB_BRANCH}?recursive=1`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ZGQ-Blog-Worker/1.0'
      }
    });
    if (!res.ok) return null;
    const treeData = await res.json() as any;
    const file = treeData.tree.find((f: any) => 
      f.type === 'blob' && 
      f.path.startsWith(`${env.GITHUB_POSTS_PATH}/`) && 
      f.path.endsWith(`-${id}.md`)
    );
    if (!file) return null;

    let folder = '';
    const prefix = `${env.GITHUB_POSTS_PATH}/`;
    if (file.path.startsWith(prefix)) {
      const parts = file.path.substring(prefix.length).split('/');
      if (parts.length > 1) {
        folder = parts.slice(0, parts.length - 1).join('/');
      }
    }

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
    return { title, tags, summary, image, folder };
  } catch (e) {
    return null;
  }
}

// ================================================================
// Readiness Poller: 确保文章在 Cloudflare Pages 部署就绪 (HTTP 200)
// ================================================================

interface WaitForPostResult {
  ready: boolean;
  attempts: number;
  elapsedMs: number;
  finalStatus?: number;
}

/**
 * 轮询检查文章 URL 是否已在 Cloudflare Pages 上成功部署并返回 HTTP 200
 * @param url 文章的目标 URL (例如 https://blog.zgqinc.gq/posts/b4c50y/)
 * @param maxWaitMs 最大等待时间（毫秒），默认 180,000ms (3分钟)
 * @param intervalMs 轮询间隔（毫秒），默认 5,000ms (5秒)
 * @param onProgress 进度回调函数，用于实时向 Telegram 用户更新状态
 */
async function waitForPostReady(
  url: string,
  maxWaitMs = 180000,
  intervalMs = 5000,
  onProgress?: (attempts: number, elapsedSec: number, status?: number) => Promise<void>
): Promise<WaitForPostResult> {
  const startTime = Date.now();
  let attempts = 0;
  let finalStatus: number | undefined;

  console.log(`[waitForPostReady] 开始轮询检查文章上线状态: ${url}`);

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    try {
      // 附加随机防缓存参数并设置 Cache-Control，杜绝边缘节点缓存旧的 404
      const cacheBustUrl = url.includes('?') ? `${url}&_check_t=${Date.now()}` : `${url}?_check_t=${Date.now()}`;
      const res = await fetch(cacheBustUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ZGQBlogBot/1.0; +https://blog.zgqinc.gq)',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      finalStatus = res.status;
      if (res.status === 200) {
        const elapsedMs = Date.now() - startTime;
        console.log(`[waitForPostReady] 文章已成功上线 (HTTP 200)！耗时 ${elapsedMs}ms (${attempts} 次重试)`);
        return { ready: true, attempts, elapsedMs, finalStatus: 200 };
      }
      console.log(`[waitForPostReady] 第 ${attempts} 次检查: HTTP ${res.status}，等待 ${intervalMs}ms 重试...`);
    } catch (err) {
      console.warn(`[waitForPostReady] 第 ${attempts} 次检查网络异常:`, err);
    }

    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    if (onProgress && attempts % 3 === 0) {
      try {
        await onProgress(attempts, elapsedSec, finalStatus);
      } catch (e) {}
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  const elapsedMs = Date.now() - startTime;
  console.warn(`[waitForPostReady] 轮询超时！文章未能就绪: ${url} (耗时 ${elapsedMs}ms, 最终状态: ${finalStatus})`);
  return { ready: false, attempts, elapsedMs, finalStatus };
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
        text: `❌ 请提供摘要内容。文章头部未找到 summary 字段。\n格式: <code>/link ${escapeHtml(id)} 摘要</code>`,
        parse_mode: 'HTML'
      });
      return;
    }
    
    const folder = postInfo ? postInfo.folder : '';

    let channels: any[] = [];
    try {
      channels = JSON.parse(env.CHANNELS_CONFIG || '[]');
    } catch(e) {}

    let targetChannel = env.TELEGRAM_CHANNEL_ID;
    const matchedChannel = channels.find(c => c.folder === folder);
    if (matchedChannel) {
      targetChannel = matchedChannel.id;
    }

    const postUrl = `${env.BLOG_URL}/posts/${id}/`;

    // 预检文章是否已在 Cloudflare Pages 上部署就绪 (HTTP 200)
    let checkResult = await waitForPostReady(postUrl, 6000, 3000);
    if (!checkResult.ready) {
      // 提示管理员正在等待构建
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `⏳ 检测到文章尚未在博客上线（HTTP ${checkResult.finalStatus || 404}），正在等待 Cloudflare Pages 构建部署就绪（最长等待 3 分钟）...`,
        parse_mode: 'HTML'
      });
      // 轮询等待就绪
      checkResult = await waitForPostReady(postUrl, 180000, 5000);
    }

    if (!checkResult.ready) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `❌ <b>关联中断</b>：文章在 3 分钟内仍未返回 HTTP 200 (当前状态: ${checkResult.finalStatus || '未知'})。\n为避免 Telegram 抓取 404 并缓存错误预览，本次未向频道推送。\n请确认 Cloudflare Pages 构建成功后重新发送：\n<code>/link ${escapeHtml(id)}</code>`,
        parse_mode: 'HTML'
      });
      return;
    }

    const tgResult = await publishToChannel(env, {
      id,
      title,
      summary,
      tags,
      postUrl,
      targetChannel
    });

    if (tgResult && tgResult.message_id) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO post_tg_map
         (post_id, tg_message_id, tg_channel_id, post_title, post_url, post_slug, published_via)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        tgResult.message_id,
        targetChannel,
        title,
        postUrl,
        id,
        'telegram_manual'
      ).run();

      const tgPostUrl = buildTelegramMessageUrl(targetChannel, tgResult.message_id);
      const channelLink = tgPostUrl ? `\n<b>频道</b>: ${tgPostUrl}` : '';

      // 同步推送给除作者外的所有订阅者
      const broadcastResult = await broadcastNewPostToSubscribers(env, {
        id,
        title,
        summary,
        tags,
        postUrl,
        tgPostUrl
      });

      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `✅ 关联成功！已推送到频道。\n\n<b>文章</b>: ${escapeHtml(title)}\n<b>博客</b>: ${postUrl}${channelLink}\n\n📢 <b>订阅者同步推送</b>: 成功 ${broadcastResult.sent} 人，跳过管理员 ${broadcastResult.skippedAdmins} 人`,
        parse_mode: 'HTML'
      });
    } else {
      throw new Error(`Failed to send to channel: ${tgResult?.error || 'Unknown error'}`);
    }
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 关联失败: <code>${escapeHtml(String(err))}</code>`,
      parse_mode: 'HTML'
    });
  }
}

async function handleSyncCommand(message: TgMessage, id: string, providedSummary: string, env: Env): Promise<void> {
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: `⏳ 正在查询数据库和 GitHub 以同步文章信息...`,
    parse_mode: 'HTML'
  });

  try {
    const row = await env.DB.prepare(`SELECT tg_message_id, tg_channel_id FROM post_tg_map WHERE post_id = ?`).bind(id).first();
    if (!row) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `⚠️ 找不到 ID 为 <code>${escapeHtml(id)}</code> 的关联频道消息，请确认是否已发布过。`,
        parse_mode: 'HTML'
      });
      return;
    }
    const tgMessageId = row.tg_message_id as number;

    const postInfo = await fetchPostInfoFromGitHub(id, env);
    if (!postInfo) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `❌ 在 GitHub 上找不到 ID 为 <code>${escapeHtml(id)}</code> 的文章源文件。`,
        parse_mode: 'HTML'
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
        text: `❌ 文章头部未找到 summary，且未提供新摘要。\n格式: <code>/sync ${escapeHtml(id)} 这是一段新摘要</code>`,
        parse_mode: 'HTML'
      });
      return;
    }

    const postUrl = `${env.BLOG_URL}/posts/${id}/`;
    
    // 检查文章是否在线 (HTTP 200)
    const checkResult = await waitForPostReady(postUrl, 6000, 3000);
    if (!checkResult.ready) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `⚠️ <b>提示</b>：文章链接 <code>${postUrl}</code> 目前返回 HTTP ${checkResult.finalStatus || 404}。\n若刚发布，建议等待 Cloudflare Pages 构建完毕后再同步，以防 Telegram 抓取失败。正在继续尝试更新消息...`,
        parse_mode: 'HTML'
      });
    }

    // Formatting text (using shared helper)
    const { text, ivUrl } = buildPostMessageText(env, { id, title, summary, tags, postUrl });

    let chatId = (row.tg_channel_id as string) || env.TELEGRAM_CHANNEL_ID;
    if (!chatId.startsWith('@') && !chatId.startsWith('-')) {
      chatId = '@' + chatId;
    }

    // Try editMessageText first (for text messages)
    let editRes = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: tgMessageId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false, url: ivUrl || postUrl, prefer_large_media: true }
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
        text: `✅ 频道消息已成功同步更新！\n\n<b>文章</b>: ${escapeHtml(title)}`,
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
      text: `❌ 同步失败: <code>${escapeHtml(String(err))}</code>`,
      parse_mode: 'HTML'
    });
  }
}

async function handleCancelCommand(message: TgMessage, id: string, env: Env): Promise<void> {
  try {
    const row = await env.DB.prepare(`SELECT tg_message_id FROM post_tg_map WHERE post_id = ?`).bind(id).first();
    if (!row) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: message.chat.id,
        text: `⚠️ 找不到 ID 为 <code>${escapeHtml(id)}</code> 的关联频道消息。`,
        parse_mode: 'HTML'
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
        text: `✅ 关联已成功取消！你现在可以重新使用 <code>/link</code> 命令关联新的频道消息了。`,
        parse_mode: 'HTML'
      });
    } else {
      throw new Error(delRes.description || 'Unknown Telegram API error');
    }
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 取消关联失败: <code>${escapeHtml(String(err))}</code>`,
      parse_mode: 'HTML'
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
    case 'xls': case 'xlsx': case 'csv': return 'table';
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
    const { today, yearMonth } = getBeijingTime();
    if (uploadMatch) {
      postId = uploadMatch[1];
    } else {
      postId = yearMonth;
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
    const ext = fileName.split('.').pop() || '';
    const icon = getFileIcon(ext);
    const safeName = fileName.replace(/"/g, '\\"');
    // Liquid file download card format
    const liquidSnippet = [
      `{% include file_download.html`,
      `   name="${safeName}"`,
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

  // 规范化文章 slug：Jekyll permalink 规则为 /posts/:slug/
  // 若传入带有日期前缀的 slug（如 2026-10-13-b4c50y），需去除日期前缀；若有 post_id 则优先使用 post_id
  const cleanSlug = post_id || (slug ? slug.replace(/^\d{4}-\d{2}-\d{2}-/, '') : '');
  const postUrl = `${env.BLOG_URL}/posts/${cleanSlug}/`;

  // 轮询检查文章是否已在 Cloudflare Pages 上成功部署并返回 HTTP 200（最多等待 3 分钟）
  console.log(`[handleNotify] 正在等待文章在 Cloudflare Pages 部署就绪: ${postUrl}`);
  const checkResult = await waitForPostReady(postUrl, 180000, 5000);

  if (!checkResult.ready) {
    console.warn(`[handleNotify] 警告: 文章在 ${checkResult.elapsedMs}ms 内未返回 HTTP 200 (最终状态: ${checkResult.finalStatus})，仍将尝试发布`);
  }

  // Publish to Telegram channel
  const tgResult = await publishToChannel(env, {
    id: post_id,
    title,
    summary,
    tags: tags || [],
    postUrl,
    image
  });

  if (!tgResult || !tgResult.message_id) {
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
    cleanSlug,
    'git'
  ).run();

  // 构造频道消息链接
  const tgPostUrl = buildTelegramMessageUrl(env.TELEGRAM_CHANNEL_ID || '', tgResult.message_id);

  // 同步推送给除作者外的所有订阅者
  const broadcastResult = await broadcastNewPostToSubscribers(env, {
    id: post_id,
    title,
    summary,
    tags: tags || [],
    postUrl,
    image,
    tgPostUrl
  });

  return jsonResponse({
    ok: true,
    message_id: tgResult.message_id,
    post_url: postUrl,
    wait_time_ms: checkResult.elapsedMs,
    ready: checkResult.ready,
    broadcast: broadcastResult
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
    ok: true,
    post_id: row.post_id,
    tg_message_id: row.tg_message_id,
    tg_channel_id: row.tg_channel_id,
    tg_post_url: tgPostUrl,
    post_url: row.post_url,
    created_at: row.created_at
  });
}

// ================================================================
// Handler: Get Post Comments from Telegram Discussion
// ================================================================

async function handleGetPostComments(postId: string, request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const paramChannel = url.searchParams.get('channel');
  const paramMsgId = url.searchParams.get('msg_id');
  const before = url.searchParams.get('before');
  const isDownload = url.searchParams.get('download') === '1' || url.searchParams.get('download') === 'json';

  let tgMessageId: number | null = null;
  let tgChannelId: string | null = null;

  if (paramChannel && paramMsgId) {
    tgChannelId = paramChannel;
    tgMessageId = Number(paramMsgId);
  } else {
    const row = await env.DB.prepare(
      `SELECT post_id, tg_message_id, tg_channel_id, post_url
       FROM post_tg_map WHERE post_id = ?`
    ).bind(postId).first();

    if (row) {
      tgMessageId = Number(row.tg_message_id);
      tgChannelId = String(row.tg_channel_id);
    }
  }

  if (!tgMessageId || !tgChannelId) {
    return jsonResponse({ error: 'Discussion not found for this post', count: 0, comments: [] }, 404);
  }

  const cleanChannel = tgChannelId.replace('@', '');
  const isPrivateChannel = cleanChannel.startsWith('-100') || cleanChannel.startsWith('c/');
  const privateChatId = cleanChannel.replace(/^(-100|c\/)/, '');
  const tgPostUrl = isPrivateChannel 
    ? `https://t.me/c/${privateChatId}/${tgMessageId}`
    : `https://t.me/${cleanChannel}/${tgMessageId}`;

  if (isPrivateChannel) {
    // Private channels/groups do not support public web comments embedding via widget
    try {
      const archived = await env.DB.prepare(
        `SELECT comments_json FROM post_comments_archive WHERE post_id = ?`
      ).bind(postId).first();
      if (archived && archived.comments_json) {
        const parsedArchive = JSON.parse(String(archived.comments_json));
        return jsonResponse({ ok: true, post_id: postId, tg_post_url: tgPostUrl, ...parsedArchive, archived: true }, 200);
      }
    } catch (e) {}
    return jsonResponse({
      ok: false,
      error: 'Private channel does not support public web discussion embedding',
      post_id: postId,
      tg_post_url: tgPostUrl,
      count: 0,
      comments: []
    }, 200);
  }

  // Fetch Telegram embed discussion page with comments_limit=100
  let tmeUrl = `https://t.me/${cleanChannel}/${tgMessageId}?embed=1&discussion=1&comments_limit=100`;
  if (before) {
    tmeUrl += `&before=${encodeURIComponent(before)}`;
  }

  try {
    const tmeRes = await fetch(tmeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: true
      }
    });

    if (!tmeRes.ok) {
      // Fallback: try reading from D1 archive
      try {
        const archived = await env.DB.prepare(
          `SELECT comments_json FROM post_comments_archive WHERE post_id = ?`
        ).bind(postId).first();
        if (archived && archived.comments_json) {
          const parsedArchive = JSON.parse(String(archived.comments_json));
          return jsonResponse({ ok: true, post_id: postId, tg_post_url: tgPostUrl, ...parsedArchive, archived: true }, 200);
        }
      } catch (e) {}

      return jsonResponse({
        ok: false,
        error: 'Failed to fetch discussion from Telegram',
        post_id: postId,
        tg_post_url: tgPostUrl,
        count: 0,
        comments: []
      }, 502);
    }

    const html = await tmeRes.text();
    const parsed = parseTelegramDiscussionHtml(html, cleanChannel);

    const resultData = {
      ok: true,
      post_id: postId,
      tg_post_url: tgPostUrl,
      tg_channel: cleanChannel,
      tg_message_id: tgMessageId,
      ...parsed,
      exported_at: new Date().toISOString()
    };

    // Asynchronously update D1 archive
    if (env.DB && parsed.comments.length > 0 && !before) {
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS post_comments_archive (
           post_id TEXT PRIMARY KEY,
           tg_message_id INTEGER,
           comments_count INTEGER,
           comments_json TEXT,
           updated_at TEXT
         )`
      ).run().then(() => {
        return env.DB.prepare(
          `INSERT INTO post_comments_archive (post_id, tg_message_id, comments_count, comments_json, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(post_id) DO UPDATE SET
             comments_count = excluded.comments_count,
             comments_json = excluded.comments_json,
             updated_at = datetime('now')`
        ).bind(postId, tgMessageId, parsed.count, JSON.stringify(resultData)).run();
      }).catch(err => console.warn('Failed to archive comments to D1:', err));
    }

    // If download requested, return downloadable JSON file
    if (isDownload) {
      return corsResponse(
        new Response(JSON.stringify(resultData, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${postId}-comments-archive.json"`
          }
        })
      );
    }

    return jsonResponse(resultData, 200);
  } catch (err) {
    console.error('Error fetching TG comments:', err);
    return jsonResponse({
      ok: false,
      error: 'Internal error while processing comments',
      post_id: postId,
      tg_post_url: tgPostUrl,
      count: 0,
      comments: []
    }, 500);
  }
}

interface ParsedComment {
  id: string;
  author: string;
  author_url: string;
  avatar: string;
  initial: string;
  bg_class: string;
  is_channel: boolean;
  text_html: string;
  text_plain: string;
  datetime: string;
  time: string;
  reply_to?: {
    reply_id: string;
    author: string;
    text: string;
  } | null;
  media: {
    type: 'sticker' | 'photo' | 'video' | 'audio' | 'document';
    src?: string;
    thumb?: string;
    title?: string;
  }[];
}

function parseTelegramDiscussionHtml(html: string, channelName: string): {
  header: string;
  count: number;
  has_more: boolean;
  before_cursor: string | null;
  comments: ParsedComment[];
} {
  // Extract header (e.g. "15 comments on this post")
  const headerMatch = html.match(/<span class="js-header">([^<]+)<\/span>/);
  const header = headerMatch ? headerMatch[1].trim() : '';

  // Extract count from header
  let count = 0;
  const countMatch = header.match(/(\d+)/);
  if (countMatch) {
    count = parseInt(countMatch[1], 10);
  }

  // Extract "Show more comments" pagination cursor
  const moreMatch = html.match(/<div class="[^"]*tme_messages_more[^"]*"[^>]*data-before="([^"]+)"/);
  const has_more = Boolean(moreMatch);
  const before_cursor = moreMatch ? moreMatch[1] : null;

  const comments: ParsedComment[] = [];

  // Split messages by `.tgme_widget_message_wrap`
  const chunks = html.split('<div class="tgme_widget_message_wrap');
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Message ID
    const idMatch = chunk.match(/data-post-id="([^"]+)"/);
    const id = idMatch ? idMatch[1] : `msg_${i}`;

    // Author
    const authorMatch = chunk.match(/<a class="tgme_widget_message_author_name"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) ||
                        chunk.match(/<div class="tgme_widget_message_author[^"]*"><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    let author_url = '';
    let author = 'Anonymous';
    if (authorMatch) {
      author_url = authorMatch[1];
      author = authorMatch[2].replace(/<[^>]+>/g, '').trim();
    }

    // Avatar (video poster / img / initial letter)
    let avatar = '';
    const videoPoster = chunk.match(/<video[^>]*poster="([^"]+)"/);
    const videoSrc = chunk.match(/<video[^>]*src="([^"]+)"/);
    const imgSrc = chunk.match(/<i class="tgme_widget_message_user_photo[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/);
    if (videoPoster) avatar = videoPoster[1];
    else if (imgSrc) avatar = imgSrc[1];
    else if (videoSrc) avatar = videoSrc[1];

    const initialMatch = chunk.match(/<i class="tgme_widget_message_user_photo([^"]*)"[^>]*data-content="([^"]*)"/);
    let initial = '';
    let bg_class = 'bgcolor5';
    if (initialMatch) {
      initial = initialMatch[2].trim();
      const classes = initialMatch[1];
      const bgMatch = classes.match(/bgcolor\d+/);
      if (bgMatch) bg_class = bgMatch[0];
    }

    // Reply-to quote (distinct from actual message body)
    let reply_to = null;
    const replyChunkMatch = chunk.match(/<div class="[^"]*tgme_widget_message_reply_template[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*js-message_text/);
    if (replyChunkMatch) {
      const replyChunk = replyChunkMatch[1];
      const replyIdMatch = replyChunk.match(/name="reply_to_id"\s+value="([^"]+)"/);
      const replyAuthorMatch = replyChunk.match(/<span[^>]*class="[^"]*tgme_widget_message_author_name[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      const replyTextMatch = replyChunk.match(/<div[^>]*class="[^"]*js-message_reply_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      reply_to = {
        reply_id: replyIdMatch ? replyIdMatch[1] : '',
        author: replyAuthorMatch ? replyAuthorMatch[1].replace(/<[^>]+>/g, '').trim() : '',
        text: replyTextMatch ? replyTextMatch[1].replace(/<[^>]+>/g, '').trim() : ''
      };
    }

    // Actual Message text (specifically matching js-message_text)
    const textMatch = chunk.match(/<div[^>]*class="[^"]*js-message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let text_html = '';
    let text_plain = '';
    if (textMatch) {
      text_html = textMatch[1].trim();
      text_plain = text_html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    }

    // Date & Time
    const timeMatch = chunk.match(/<time datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/);
    const datetime = timeMatch ? timeMatch[1] : '';
    const time = timeMatch ? timeMatch[2].trim() : '';

    // Media (stickers, photos, video, audio)
    const media: ParsedComment['media'] = [];

    // Sticker
    const stickerMatch = chunk.match(/<div class="tgme_widget_message_sticker[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
    if (stickerMatch) {
      media.push({ type: 'sticker', src: stickerMatch[1] });
    }

    // Photo
    const photoMatches = chunk.matchAll(/background-image:\s*url\('([^']+)'\)/g);
    for (const pm of photoMatches) {
      media.push({ type: 'photo', src: pm[1] });
    }

    // Audio / Voice
    const voiceMatch = chunk.match(/class="tgme_widget_message_voice/);
    if (voiceMatch) {
      media.push({ type: 'audio', title: '语音消息' });
    }

    const is_channel = author_url.includes(channelName) || author.includes('ZGQ');

    if (author || text_plain || media.length > 0) {
      comments.push({
        id,
        author,
        author_url,
        avatar,
        initial,
        bg_class,
        is_channel,
        text_html,
        text_plain,
        datetime,
        time,
        reply_to,
        media
      });
    }
  }

  return {
    header,
    count: count || comments.length,
    has_more,
    before_cursor,
    comments
  };
}

// ================================================================
// Telegram API Helpers
// ================================================================

function buildPostMessageText(
  env: Env,
  opts: { id: string; title: string; summary: string; tags: string[]; postUrl: string }
): { text: string; ivUrl: string | null } {
  const { id, title, summary, tags, postUrl } = opts;
  const { tagsLine, ivUrl, ghostLink } = formatPostTagsAndIv(env, { id, postUrl, tags });

  // "查看全文" directly points to the blog's own domain, while Telegram natively attaches the ⚡️ Instant View button
  const text = [
    `${ghostLink}<b>${escapeHtml(title)}</b>`,
    '',
    escapeHtml(summary),
    '',
    `📖 <a href="${postUrl}">查看全文</a>`,
    '',
    tagsLine
  ].join('\n');

  return { text, ivUrl };
}

async function publishToChannel(
  env: Env,
  opts: { id: string; title: string; summary: string; tags: string[]; postUrl: string; image?: string; targetChannel?: string }
): Promise<{ message_id: number; error?: string } | null> {
  const { id, title, summary, tags, postUrl, image } = opts;

  let chatId = opts.targetChannel || env.TELEGRAM_CHANNEL_ID;
  if (!chatId.startsWith('@') && !chatId.startsWith('-')) {
    chatId = '@' + chatId;
  }

  const { text, ivUrl } = buildPostMessageText(env, { id, title, summary, tags, postUrl });

  // If Instant View is NOT enabled but an image is provided, fallback to legacy sendPhoto
  if (image && !ivUrl) {
    const res = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'sendPhoto', {
      chat_id: chatId,
      photo: image,
      caption: text,
      parse_mode: 'HTML'
    });
    if (res.ok) return { message_id: res.result.message_id as number };
    console.error('Failed to send photo:', res);
  }

  // Send text message with link preview options:
  // With prefer_large_media: true, Telegram renders the article cover image full-width
  // AND displays the native ⚡️ Instant View button!
  const result = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: {
      is_disabled: false,
      url: ivUrl || postUrl,
      prefer_large_media: true
    }
  });

  if (!result.ok) {
    console.error('sendMessage failed:', result);
    return { message_id: 0, error: result.description || 'API Error' };
  }

  return { message_id: result.result.message_id as number };
}

interface BroadcastPostOpts {
  id: string;
  title: string;
  summary: string;
  tags?: string[];
  postUrl: string;
  image?: string;
  tgPostUrl?: string;
}

interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  skippedAdmins: number;
}

/**
 * 广播新文章至所有活跃订阅者（严格排除博主/管理员本人）
 */
async function broadcastNewPostToSubscribers(
  env: Env,
  opts: BroadcastPostOpts
): Promise<BroadcastResult> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT user_id, username, first_name FROM bot_subscribers WHERE is_active = 1`
    ).all<{ user_id: number; username: string | null; first_name: string | null }>();

    if (!results || results.length === 0) {
      console.log('[broadcastNewPostToSubscribers] 无活跃订阅者，跳过广播。');
      return { total: 0, sent: 0, failed: 0, skippedAdmins: 0 };
    }

    // 严格过滤博主/管理员账号，确保博主不会收到自己文章的推送
    const targetSubscribers: Array<{ user_id: number; username: string | null; first_name: string | null }> = [];
    let skippedAdmins = 0;

    for (const sub of results) {
      if (isAuthorizedAdmin({ id: sub.user_id, username: sub.username || undefined, first_name: sub.first_name || '' }, env)) {
        skippedAdmins++;
        continue;
      }
      targetSubscribers.push(sub);
    }

    console.log(`[broadcastNewPostToSubscribers] 数据库订阅者: ${results.length}，过滤管理员: ${skippedAdmins}，实际发送目标: ${targetSubscribers.length}`);

    if (targetSubscribers.length === 0) {
      return { total: results.length, sent: 0, failed: 0, skippedAdmins };
    }

    const { id, title, summary, tags, postUrl, tgPostUrl } = opts;
    const { tagsLine, ivUrl, ghostLink } = formatPostTagsAndIv(env, { id, postUrl, tags });

    const messageText = [
      `${ghostLink}📢 <b>博主发布了新文章！</b>`,
      '',
      `📌 <b>${escapeHtml(title)}</b>`,
      '',
      escapeHtml(summary),
      '',
      tagsLine ? `${tagsLine}\n` : '',
      `💡 <i>若该文章属于受限文章，可在本机器人直接发送 /unlock 获取 30 天解密凭证。</i>`
    ].filter(line => line !== '').join('\n');

    const inlineKeyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [
      [
        { text: '📖 在博客阅读全文', url: postUrl }
      ]
    ];

    if (tgPostUrl) {
      inlineKeyboard[0].push({ text: '💬 频道讨论区', url: tgPostUrl });
    }

    inlineKeyboard.push([
      { text: '🔑 快速获取解锁凭证', callback_data: 'user_unlock' },
      { text: '🔕 退订推送', callback_data: 'user_unsubscribe' }
    ]);

    let sent = 0;
    let failed = 0;

    // 分批并发发送（每批 10 个，批次间休眠 50ms 防止触发 Telegram API 429 速率限制）
    const BATCH_SIZE = 10;
    for (let i = 0; i < targetSubscribers.length; i += BATCH_SIZE) {
      const batch = targetSubscribers.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (sub) => {
          try {
            const res = await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
              chat_id: sub.user_id,
              text: messageText,
              parse_mode: 'HTML',
              link_preview_options: {
                is_disabled: false,
                url: ivUrl || postUrl,
                prefer_large_media: true
              },
              reply_markup: {
                inline_keyboard: inlineKeyboard
              }
            });

            if (res.ok) {
              sent++;
            } else {
              failed++;
              const desc = (res.description || '').toLowerCase();
              // 若用户已拉黑 Bot 或已注销账号，自动将其设为 is_active = 0
              if (
                desc.includes('bot was blocked by the user') ||
                desc.includes('user is deactivated') ||
                desc.includes('chat not found')
              ) {
                console.log(`[broadcast] 用户 ${sub.user_id} 已拉黑机器人或停用，标记 is_active = 0`);
                await env.DB.prepare(
                  `UPDATE bot_subscribers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
                ).bind(sub.user_id).run();
              }
            }
          } catch (e: any) {
            failed++;
            console.error(`[broadcast] 向用户 ${sub.user_id} 发送失败:`, e);
          }
        })
      );

      if (i + BATCH_SIZE < targetSubscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`[broadcastNewPostToSubscribers] 广播完成。总订阅者: ${results.length}，成功发送: ${sent}，失败: ${failed}，跳过管理员: ${skippedAdmins}`);
    return { total: results.length, sent, failed, skippedAdmins };
  } catch (err) {
    console.error('[broadcastNewPostToSubscribers] 广播异常:', err);
    return { total: 0, sent: 0, failed: 0, skippedAdmins: 0 };
  }
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

function isMimeAllowed(_mime?: string): boolean {
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
      cacheControl: 'public, max-age=31536000',
      contentDisposition: fileName ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}` : undefined
    }
  });

  // Keep Chinese/Unicode characters readable, but encode spaces as %20 so Liquid and Markdown syntax won't break
  const cleanBase = env.ASSETS_URL.replace(/\/+$/, '');
  const friendlyPath = r2Key.split('/').map(segment => {
    let clean = segment;
    try {
      clean = decodeURIComponent(segment);
    } catch {
      clean = segment;
    }
    return clean.replace(/ /g, '%20');
  }).join('/');

  return `${cleanBase}/${friendlyPath}`;
}

// ================================================================
// GitHub API Helpers
// ================================================================

async function commitToGitHub(env: Env, slug: string, content: string, folder: string = ''): Promise<void> {
  const [owner, repo] = env.GITHUB_REPO.split('/');
  const pathPrefix = folder ? `${env.GITHUB_POSTS_PATH}/${folder}` : env.GITHUB_POSTS_PATH;
  const filePath = `${pathPrefix}/${slug}.md`;
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



// ================================================================
// Utility Functions
// ================================================================

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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



async function handleBindCommand(message: TgMessage, id: string, fullUrl: string, channel: string, msgIdStr: string, env: Env): Promise<void> {
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: `⏳ 正在绑定信息...`,
  });

  try {
    const postInfo = await fetchPostInfoFromGitHub(id, env);
    if (!postInfo) {
      throw new Error(`未能在仓库中找到对应的文章信息 (ID: ${id})。`);
    }

    const msgId = parseInt(msgIdStr, 10);
    let formattedChannel = channel;
    
    if (/^\d+$/.test(channel)) {
      formattedChannel = `-100${channel}`;
    } else if (!channel.startsWith('@')) {
      formattedChannel = `@${channel}`;
    }

    const postUrl = `${env.BLOG_URL}/posts/${id}/`;

    await env.DB.prepare(
      `INSERT OR REPLACE INTO post_tg_map
       (post_id, tg_message_id, tg_channel_id, post_title, post_url, post_slug, published_via)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      msgId,
      formattedChannel,
      postInfo.title,
      postUrl,
      id,
      'telegram_manual_bind'
    ).run();

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `✅ 手动绑定成功！\n\n<b>文章</b>: ${postInfo.title}\n<b>频道消息</b>: ${fullUrl}`,
      parse_mode: 'HTML'
    });
  } catch (err) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: `❌ 绑定失败: ${String(err)}`
    });
  }
}


