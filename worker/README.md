# Undi agent proxy (Cloudflare Worker → GitHub Models)

This proxy keeps your GitHub token off the public site. The browser sends the conversation and tool definitions here, and the worker forwards them to `https://models.github.ai/inference/chat/completions`, which is free with rate limits.

## 1. Create a GitHub Models token
1. Open https://github.com/settings/personal-access-tokens/new.
2. Repository access: **Public repositories (read-only)**.
3. Account permissions: **Models → Read-only**.
4. Generate the token and copy it.

## 2. Deploy the worker (free Cloudflare account)
```bash
cd worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN     # paste the token
npx wrangler deploy
```
Wrangler prints a URL like `https://undi-agent.<your-subdomain>.workers.dev`.

## 3. Connect it
1. Open **Studio → AI agent**, paste the URL into **Agent endpoint**, then press **Test connection**.
2. Press **Publish**. The chat header then shows "Online · powered by GitHub Models".

## Settings (`wrangler.toml`)
- `ALLOWED_ORIGINS`: the sites allowed to call the proxy. If you add a custom domain, add it here.
- `MODEL` / `FALLBACK_MODEL`: any chat model in the [GitHub Models catalog](https://github.com/marketplace/models) that supports tool calling.
- Basic abuse limits are built in: 40 requests per IP per 10 minutes, a size limit, and an origin allow-list.
