# Telegram Instant View (即时预览) 模板

本项目为 Jekyll 博客专属定制了 Telegram Instant View 2.0 模板，使博客文章能够在 Telegram 手机与桌面客户端中实现毫秒级秒开、纯净优雅的原生排版阅读。

---

## 📁 目录内容

- `rules.xpath`：经过完整调试并通过实测的 Telegram Instant View 2.0 XPath 规则源码。

---

## 🚀 部署到你自己的域名

如果你 Fork 了本项目或使用自己的独立域名，请按以下步骤将规则部署到你的 Telegram 账号：

1. 打开 [https://instantview.telegram.org/my/](https://instantview.telegram.org/my/) 并登录你的 Telegram 账号。
2. 在输入框中输入你的域名或文章链接（例如 `https://yourdomain.com/posts/example/`），进入三栏编辑器。
3. 将 `rules.xpath` 中的全部内容复制并粘贴到中间的 **RULES** 编辑器中。
4. 点击右上角的 **Save**，然后点击 **TRACK CHANGES**。
5. 成功后，复制右上角 **VIEW IN TELEGRAM** 按钮生成的链接，其中形如 `rhash=xxxxxxxxxxxxxx` 的字符串即为你的专属 `rhash`。
6. 将该 `rhash` 分别配置到：
   - 博客根目录 `_config.yml`：`telegram_iv_rhash: "你的rhash"`
   - `worker/wrangler.toml`：`TELEGRAM_IV_RHASH = "你的rhash"`

---

## 💡 为什么需要 `rhash`？

Telegram 对第三方独立博客不会自动全局默认开启即时预览。Telegram 官方推荐的方式是通过带有 `rhash` 的凭证链接唤起即时预览：

```text
https://t.me/iv?url=文章绝对地址&rhash=你的rhash
```

在频道推送与文章分享时，系统已自动内置此逻辑。
