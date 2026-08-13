# Task Tracker

- `[x]` Modify `wrangler.toml` to include `CHANNELS_CONFIG`
- `[x]` Update `Env` interface in `worker/src/index.ts`
- `[x]` Implement CallbackQuery handling for `/new` command
- `[x]` Update `fetchPostInfoFromGitHub` to detect and return folder paths
- `[x]` Update `handleLinkCommand` and `handleSyncCommand` to route to correct channel based on folder
- `[x]` Update `commitToGitHub` to accept target folder parameter
- `[x]` Compile worker (`npx tsc --noEmit`) to verify types
- `[x]` Deploy Cloudflare worker or commit code
