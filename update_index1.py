import re

with open('worker/src/index.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Env
code = re.sub(
    r'(GITHUB_POSTS_PATH: string;\n)(\s*// Secrets)',
    r'\1  CHANNELS_CONFIG?: string;\n\2',
    code, count=1
)

# 2. TgUpdate
code = re.sub(
    r'(interface TgUpdate \{\n.*?channel_post\?: TgMessage;\n)\}',
    r'\1  callback_query?: TgCallbackQuery;\n}\n\ninterface TgCallbackQuery {\n  id: string;\n  from: TgUser;\n  message?: TgMessage;\n  inline_message_id?: string;\n  chat_instance: string;\n  data?: string;\n}',
    code, flags=re.DOTALL, count=1
)

# 3. Webhook Router
code = re.sub(
    r'(const update: TgUpdate = await request.json\(\);\n\s*const message = update\.message;\n\n\s*if \(!message\) \{)',
    r'const update: TgUpdate = await request.json();\n\n  if (update.callback_query) {\n    await handleCallbackQuery(update.callback_query, env);\n    return jsonResponse({ ok: true });\n  }\n\n  const message = update.message;\n\n  if (!message) {',
    code, flags=re.DOTALL, count=1
)

# 4. handleNewCommand and handleCallbackQuery
new_cmd = '''async function handleNewCommand(message: TgMessage, title: string, env: Env): Promise<void> {
  let channels: any[] = [];
  try {
    channels = JSON.parse(env.CHANNELS_CONFIG || '[]');
  } catch (e) {
    console.warn("Failed to parse CHANNELS_CONFIG", e);
  }

  if (channels.length === 0) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: message.chat.id,
      text: ❌ 未配置任何频道 (CHANNELS_CONFIG)，无法创建草稿。
    });
    return;
  }

  const buttons = channels.map((c: any) => ([{
    text: ${c.name} (),
    callback_data: 
ew_draft:
  }]));

  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: message.chat.id,
    text: 请选择要将 <b></b> 发布到哪个频道：,
    parse_mode: 'HTML',
    reply_to_message_id: message.message_id,
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

async function handleCallbackQuery(callbackQuery: TgCallbackQuery, env: Env): Promise<void> {
  const data = callbackQuery.data;
  if (!data || !data.startsWith('new_draft:')) return;

  const folder = data.split(':')[1];
  const originalMessage = callbackQuery.message?.reply_to_message?.text || '';
  
  const newMatch = originalMessage.match(/^\\/new\\s+(.+)/s) || originalMessage.match(/^\\/new$/);
  const title = newMatch && newMatch[1] ? newMatch[1].trim() : '未命名文章';

  await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', {
    callback_query_id: callbackQuery.id
  });

  if (callbackQuery.message) {
    await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      text: ⏳ 正在为您创建草稿到 \\${folder}\\，请稍候...,
      parse_mode: 'Markdown'
    });
  }

  const id = Math.random().toString(36).substring(2, 8);
  const today = new Date().toISOString().split('T')[0];
  const slug = ${today}-;
  
  try {
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const mdContent = [
      '---',
      layout: post,
      	itle: "",
      id: "",
      date: ,
      summary: "",
      image: "",
      categories: [],
      	ags: [],
      rchive: false,
      comments: true,
      	oc: true,
      '---',
      '',
      '<!-- 正文内容 -->',
      ''
    ].join('\\n');

    await commitToGitHub(env, slug, mdContent, folder);

    if (callbackQuery.message) {
      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: ✅ 草稿已生成！\\n\\n**频道**: \\${folder}\\\\n**文件名**: \\${slug}.md\\\\n**文章 ID**: \\${id}\\\\n\\n提交发布后，请使用以下命令关联：\\n\\n\\/link  文章摘要\\`,
        parse_mode: 'Markdown'
      });
    }
  } catch (err) {
    if (callbackQuery.message) {
      await callTelegramApi(env.TELEGRAM_BOT_TOKEN, 'editMessageText', {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: ❌ 草稿创建失败: 
      });
    }
  }
}
'''

code = re.sub(
    r'async function handleNewCommand\(message: TgMessage, title: string, env: Env\): Promise<void> \{.*?\n\}\n\nasync function fetchPostInfoFromGitHub',
    new_cmd + '\n\nasync function fetchPostInfoFromGitHub',
    code, flags=re.DOTALL, count=1
)

with open('worker/src/index.ts', 'w', encoding='utf-8') as f:
    f.write(code)
