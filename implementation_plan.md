# Telegram Bot Multi-Channel Support

This plan implements multi-channel support for the ZGQ Blog Telegram Bot, allowing posts to be routed to different Telegram channels and organized into corresponding subfolders in the `_posts` directory.

## Open Questions

None. The requirements provided perfectly outline a clear and stateless approach to multi-channel routing.

## Proposed Changes

### `worker/wrangler.toml`

#### [MODIFY] [wrangler.toml](file:///C:/Users/ZGQ/Documents/antigravity/jekyll/worker/wrangler.toml)
- Add a new `CHANNELS_CONFIG` environment variable in the `[vars]` section. This will be a JSON string defining the available channels and their corresponding GitHub subfolders:
  ```toml
  CHANNELS_CONFIG = '[{"id": "@ZGQincLiqun", "name": "主频道", "folder": "ZGQincLiqun"}, {"id": "@CopyRightZGQInc", "name": "个人频道", "folder": "CopyRightZGQInc"}]'
  ```

### `worker/src/index.ts`

#### [MODIFY] [index.ts](file:///C:/Users/ZGQ/Documents/antigravity/jekyll/worker/src/index.ts)
- **Environment Interface**:
  - Add `CHANNELS_CONFIG: string;` to `Env`.
- **Command `/new` (Interactive Channel Selection)**:
  - Modify `handleNewCommand` to **not** immediately create the draft. Instead, it will reply to the user's message with an Inline Keyboard containing buttons for each configured channel.
  - The callback data will be structured as `new_draft:<folder>`.
- **Webhook Router**:
  - Add a handler for `callback_query`. When a `new_draft:<folder>` callback is received, the bot will extract the requested title from `callback_query.message.reply_to_message.text`, generate the draft in `_posts/<folder>/...md`, and edit the inline keyboard message to show the success status.
- **Command `/link` (Automatic Channel Detection)**:
  - Modify `fetchPostInfoFromGitHub` to return the `folder` path in addition to the post content. It will detect if the post is inside a subfolder (e.g., `_posts/CopyRightZGQInc/`) or the root `_posts/`.
  - In `handleLinkCommand`, use the detected `folder` to look up the target channel ID from `CHANNELS_CONFIG`. If a match is found, route the message to that channel.
- **GitHub Actions Notifier (`/api/notify`)**:
  - Similarly, update the `/api/notify` handler to query the post's folder or accept an optional `folder` parameter in the payload, so automated publishes route to the correct channel.
- **Helper Methods**:
  - Update `commitToGitHub` to accept the `folder` parameter so it can place the file correctly. (GitHub's API automatically creates directories if they don't exist).

## Verification Plan

### Automated Tests
- Type checking: run `npx tsc --noEmit` locally in the worker directory to verify TypeScript logic.

### Manual Verification
- Execute `/new 测试文章` in Telegram.
- Verify that an Inline Keyboard appears asking to select the channel.
- Click "个人频道".
- Verify that the bot creates the draft in `_posts/CopyRightZGQInc/yyyy-mm-dd-xxxxxx.md`.
- Execute `/link xxxxxx 测试摘要`.
- Verify that the bot automatically queries GitHub, detects the folder `CopyRightZGQInc`, and successfully publishes the message to the `@CopyRightZGQInc` Telegram channel without the user manually specifying it.
