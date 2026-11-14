# Aubrey Undi Phiri — Portfolio

A static portfolio for GitHub Pages with three parts:

| Part | Path | What it does |
| --- | --- | --- |
| **Site** | `/` | Dark/light editorial design, bento project grid, project drawer with live GitHub stats, demo room, events, about, contact. |
| **Undi, the AI agent** | `assets/js/agent.js` | A tool-calling agent on GitHub Models. It scrolls the page, filters and opens projects, reads live repos and READMEs, plays demos, switches the theme and drafts emails. With no model endpoint set, an offline rule-based agent uses the same tools. |
| **Studio (admin)** | `/admin/` | A CMS backed by git. Edit every section, upload images, import repos from GitHub, preview drafts, then publish. Publishing commits `content.json`, and Pages redeploys. |

All content lives in **`content.json`**. You don't need to edit HTML.

## Run locally

```bash
npx serve .            # or: python -m http.server 8080
```

The site has to be served over HTTP, because opening `index.html` directly can't load `content.json`.

## Deploy (GitHub Pages)

The repo is named `AubreyUndiPhiri.github.io`, so GitHub Pages serves it at **https://aubreyundiphiri.github.io/** from the `main` branch. No build step is needed. If you use a different repo name, turn Pages on under **Settings → Pages → Deploy from a branch → main / root**.

## Use the admin (Studio)

1. Go to `https://aubreyundiphiri.github.io/admin/`.
2. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only this repository** and these permissions: **Contents: Read & write** and **Pages: Read**.
3. Paste the token and sign in. Edit, preview, then press **Publish**. The site updates in about a minute.

The token stays in your browser (session storage, or local storage if you tick "Remember"). Without the token the admin page is useless to anyone else, because every write goes through GitHub's permissions.

## Turn on the AI model (free, GitHub Models)

The browser can't hold your GitHub token safely, so a tiny proxy holds it instead. See [`worker/README.md`](worker/README.md). It takes about 5 minutes on Cloudflare's free tier. Then paste the worker URL into **Studio → AI agent → Agent endpoint** and publish.
