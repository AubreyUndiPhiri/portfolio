/* Studio — a git-backed CMS for the portfolio.
   Reads and commits /content.json (and uploads to /assets/uploads) through the GitHub REST API.
   The token never leaves this browser except in requests to api.github.com. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = "") => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const API = "https://api.github.com";
  const CONTENT_PATH = "content.json";
  const UPLOAD_DIR = "assets/uploads";
  const ART = ["asthma", "breast", "mobility", "neural", "face", "dna", "stats"];
  const FILTERS = [["ai", "AI & ML"], ["health", "Health"], ["data", "Data & stats"]];

  const S = { cfg: null, data: null, remoteText: "", remoteSha: null, offline: false, tab: "overview", open: {} };

  /* ------------------------------------------------------------ utilities */
  const toB64 = str => { const bytes = new TextEncoder().encode(str); let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin); };
  const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), c => c.charCodeAt(0)));
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
  const pretty = s => String(s).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
  const ago = d => { const s = (Date.now() - new Date(d)) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
  const getPath = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
  function setPath(o, p, v) { const ks = p.split("."); const last = ks.pop(); const t = ks.reduce((a, k) => a[k] ??= {}, o); t[last] = v; }
  const preview = src => !src ? "" : /^(https?:|data:)/.test(src) ? src : "../" + src.replace(/^\.?\//, "");

  let toastTimer;
  function toast(msg, error) {
    const t = $("[data-toast]");
    t.textContent = msg; t.classList.toggle("is-error", !!error); t.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("is-on"), error ? 6000 : 3200);
  }

  async function gh(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(S.cfg?.token ? { Authorization: `Bearer ${S.cfg.token}` } : {}), ...(opts.body ? { "Content-Type": "application/json" } : {}), ...opts.headers }
    });
    if (!res.ok) { const e = new Error(`${res.status} ${(await res.text()).slice(0, 180)}`); e.status = res.status; throw e; }
    return res.status === 204 ? null : res.json();
  }
  const repoPath = p => `/repos/${encodeURIComponent(S.cfg.owner)}/${encodeURIComponent(S.cfg.repo)}${p}`;
  const siteUrl = () => {
    const o = (S.cfg?.owner || "").toLowerCase();
    return (S.cfg?.repo || "").toLowerCase() === `${o}.github.io` ? `https://${o}.github.io/` : `https://${o}.github.io/${S.cfg?.repo}/`;
  };

  /* ---------------------------------------------------------------- state */
  const text = () => JSON.stringify(S.data, null, 2) + "\n";
  const dirty = () => text() !== S.remoteText;
  let draftTimer;
  function changed() {
    const st = $("[data-save-state]");
    const d = dirty();
    st.textContent = S.offline ? "Offline — export JSON when done" : d ? "Unpublished changes · draft saved locally" : "All changes published";
    st.classList.toggle("is-dirty", d);
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => { try { localStorage.setItem("aup-draft", JSON.stringify(S.data)); } catch {} }, 250);
  }

  /* ---------------------------------------------------------------- login */
  async function initLogin() {
    let defaults = { repoOwner: "AubreyUndiPhiri", repoName: "portfolio", branch: "main" };
    try { const c = await fetch("../content.json", { cache: "no-cache" }).then(r => r.json()); defaults = { ...defaults, ...c.site }; S.local = c; } catch {}
    const f = $("[data-login]");
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem("aup-studio") || localStorage.getItem("aup-studio") || "null"); } catch {}
    f.owner.value = saved?.owner || defaults.repoOwner;
    f.repo.value = saved?.repo || defaults.repoName;
    f.branch.value = saved?.branch || defaults.branch;
    if (saved?.token) { S.cfg = saved; signIn(true).catch(() => {}); }

    f.addEventListener("submit", async e => {
      e.preventDefault();
      S.cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || "main", token: f.token.value.trim() };
      const store = f.remember.checked ? localStorage : sessionStorage;
      try { await signIn(); store.setItem("aup-studio", JSON.stringify(S.cfg)); }
      catch (err) { $("[data-login-error]").textContent = err.message; }
    });
    $("[data-offline]").addEventListener("click", async () => {
      S.offline = true; S.cfg = { owner: f.owner.value, repo: f.repo.value, branch: f.branch.value };
      S.data = structuredClone(S.local || {}); S.remoteText = text();
      restoreDraft(); enterApp();
    });
  }

  async function signIn(silent) {
    const btn = $("[data-login] button[type=submit]");
    btn.disabled = true; btn.textContent = "Checking access…";
    try {
      const repo = await gh(repoPath("")).catch(e => { throw new Error(e.status === 404 ? "Repository not found, or the token can't see it." : e.status === 401 ? "That token was rejected by GitHub." : e.message); });
      if (repo.permissions && !repo.permissions.push) throw new Error("This token can read but not write to the repository.");
      S.user = await gh("/user").catch(() => null);
      await loadRemote();
      restoreDraft();
      enterApp();
    } catch (e) {
      if (silent) { sessionStorage.removeItem("aup-studio"); localStorage.removeItem("aup-studio"); }
      throw e;
    } finally { btn.disabled = false; btn.textContent = "Sign in with GitHub"; }
  }

  async function loadRemote() {
    try {
      const f = await gh(repoPath(`/contents/${CONTENT_PATH}?ref=${encodeURIComponent(S.cfg.branch)}`));
      S.remoteSha = f.sha;
      S.data = JSON.parse(fromB64(f.content));
    } catch (e) {
      if (e.status !== 404) throw e;
      S.remoteSha = null;
      S.data = structuredClone(S.local || {});
      toast("content.json isn't in the repo yet — publishing will create it.");
    }
    S.remoteText = text();
  }

  function restoreDraft() {
    try {
      const d = localStorage.getItem("aup-draft");
      if (d && JSON.stringify(JSON.parse(d), null, 2) + "\n" !== S.remoteText && confirm("You have unpublished changes from a previous session. Restore them?")) S.data = JSON.parse(d);
    } catch {}
  }

  function enterApp() {
    $("[data-view=login]").hidden = true;
    $("[data-view=app]").hidden = false;
    $("[data-repo-label]").textContent = S.offline ? "Offline mode" : `${S.cfg.owner}/${S.cfg.repo}`;
    $("[data-user]").innerHTML = S.user ? `<img src="${esc(S.user.avatar_url)}" alt=""><span>${esc(S.user.login)}</span>` : "";
    $("[data-publish]").textContent = S.offline ? "Export JSON" : "Publish";
    for (const k of ["profile", "projects", "clientWork", "demos", "events", "assistant", "site"]) S.data[k] ??= (k === "profile" || k === "assistant" || k === "site") ? {} : [];
    render(); changed();
  }

  /* --------------------------------------------------------------- fields */
  function field(f, base) {
    const path = base ? `${base}.${f.key}` : f.key;
    const v = getPath(S.data, path);
    const cls = f.full ? "full" : "";
    const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : "";
    switch (f.type) {
      case "textarea": return `<label class="${cls}">${esc(f.label)}<textarea data-path="${path}" rows="${f.rows || 4}">${esc(v ?? "")}</textarea>${hint}</label>`;
      case "lines": return `<label class="${cls}">${esc(f.label)}<textarea data-path="${path}" data-kind="lines" rows="${f.rows || 3}">${esc((v || []).join("\n"))}</textarea><span class="hint">${esc(f.hint || "One per line")}</span></label>`;
      case "paragraphs": return `<label class="${cls}">${esc(f.label)}<textarea data-path="${path}" data-kind="paragraphs" rows="${f.rows || 7}">${esc((v || []).join("\n\n"))}</textarea><span class="hint">Separate paragraphs with a blank line</span></label>`;
      case "csv": return `<label class="${cls}">${esc(f.label)}<input data-path="${path}" data-kind="csv" value="${esc((v || []).join(", "))}"><span class="hint">${esc(f.hint || "Comma separated")}</span></label>`;
      case "bool": return `<label class="check ${cls}"><input type="checkbox" data-path="${path}" data-kind="bool" ${v ? "checked" : ""}> ${esc(f.label)}</label>`;
      case "select": return `<label class="${cls}">${esc(f.label)}<select data-path="${path}">${f.options.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>${hint}</label>`;
      case "filters": return `<div class="${cls}"><label>${esc(f.label)}</label><div class="checks">${FILTERS.map(([k, l]) => `<label class="check"><input type="checkbox" data-path="${path}" data-kind="multi" data-value="${k}" ${(v || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</div></div>`;
      case "image": return `<label class="${cls}">${esc(f.label)}<div class="image-field"><input data-path="${path}" value="${esc(v ?? "")}" placeholder="assets/uploads/… or https://…"><button class="button button-ghost" type="button" data-upload="${path}">Upload</button></div>${v ? `<img class="image-preview" src="${esc(preview(v))}" alt="">` : ""}${hint}</label>`;
      case "images": return `<label class="${cls}">${esc(f.label)}<textarea data-path="${path}" data-kind="lines" rows="3">${esc((v || []).join("\n"))}</textarea><span class="hint">One image URL per line · <button class="link-button" type="button" data-upload="${path}" data-append>upload & append</button></span></label>`;
      default: return `<label class="${cls}">${esc(f.label)}<input type="${f.type === "url" ? "url" : "text"}" data-path="${path}" value="${esc(v ?? "")}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}>${hint}</label>`;
    }
  }
  const fields = (list, base) => `<div class="grid">${list.map(f => field(f, base)).join("")}</div>`;

  function readInput(el) {
    const path = el.dataset.path;
    switch (el.dataset.kind) {
      case "lines": return el.value.split("\n").map(s => s.trim()).filter(Boolean);
      case "paragraphs": return el.value.split(/\n\s*\n/).map(s => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
      case "csv": return el.value.split(",").map(s => s.trim()).filter(Boolean);
      case "bool": return el.checked;
      case "multi": return $$(`[data-path="${path}"][data-kind=multi]`).filter(c => c.checked).map(c => c.dataset.value);
      default: return el.value;
    }
  }

  /* ------------------------------------------------------------- schemas */
  const SCHEMA = {
    projects: {
      title: "Projects", blurb: "Starred projects appear as large cards in the bento grid (in this order). The rest go into the “More from the lab” list.",
      label: p => p.title || "Untitled project", sub: p => `${p.category || "—"} · ${p.repo || "no repo"}`, thumb: p => p.image ? `<img src="${esc(preview(p.image))}" alt="">` : "", star: p => p.featured,
      blank: () => ({ id: "project-" + Date.now().toString(36), title: "New project", repo: "", category: "", year: String(new Date().getFullYear()), description: "", highlights: [], tags: [], filters: ["ai"], art: "stats", image: "", featured: false, fork: false }),
      fields: [
        { key: "title", label: "Title" }, { key: "repo", label: "GitHub repository name", hint: "Exact repo name under your account" },
        { key: "category", label: "Category line" }, { key: "year", label: "Year" },
        { key: "description", label: "Description", type: "textarea", full: true, rows: 3 },
        { key: "highlights", label: "Highlights", type: "lines", full: true },
        { key: "tags", label: "Tags", type: "csv" }, { key: "filters", label: "Filters", type: "filters" },
        { key: "art", label: "Generated artwork", type: "select", options: ART, hint: "Used when no image is set" },
        { key: "image", label: "Cover image (optional)", type: "image" },
        { key: "featured", label: "Featured in the bento grid", type: "bool" }, { key: "fork", label: "This is a forked repo", type: "bool" },
        { key: "id", label: "ID (used in links & by the agent)", hint: "Lowercase, unique" }
      ]
    },
    clientWork: {
      title: "Client work", blurb: "Real-world builds. The last word of the title is rendered in italic accent.",
      label: c => c.title || "Untitled", sub: c => c.kicker || "", thumb: c => c.images?.[0] ? `<img src="${esc(preview(c.images[0]))}" alt="" referrerpolicy="no-referrer">` : "",
      blank: () => ({ id: "client-" + Date.now().toString(36), title: "New client build", kicker: "", lead: "", description: "", features: [], date: "", link: "", secondaryLink: "", images: [] }),
      fields: [
        { key: "title", label: "Title" }, { key: "kicker", label: "Kicker", placeholder: "Live in hospitality · Zambia" },
        { key: "lead", label: "Lead sentence", type: "textarea", full: true, rows: 2 },
        { key: "description", label: "Description", type: "textarea", full: true },
        { key: "features", label: "Feature chips", type: "lines" }, { key: "date", label: "Date line", placeholder: "Launched · 29 April 2026" },
        { key: "link", label: "Main link", type: "url" }, { key: "secondaryLink", label: "Secondary link", type: "url" },
        { key: "images", label: "Gallery images (first two are shown)", type: "images", full: true },
        { key: "id", label: "ID" }
      ]
    },
    demos: {
      title: "Demo room", blurb: "Paste a YouTube, Vimeo or Loom link — the play button lights up automatically.",
      label: d => d.title || "Untitled demo", sub: d => d.embedUrl ? "▶ Video ready" : "Coming soon",
      blank: () => ({ id: "demo-" + Date.now().toString(36), title: "New demo", detail: "", embedUrl: "", art: "neural" }),
      fields: [
        { key: "title", label: "Title" }, { key: "art", label: "Thumbnail artwork", type: "select", options: ART },
        { key: "detail", label: "Caption", full: true },
        { key: "embedUrl", label: "Video link", type: "url", full: true, hint: "e.g. https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=…" },
        { key: "id", label: "ID" }
      ]
    },
    events: {
      title: "Events & training", blurb: "The featured event spans the full width at the top.",
      label: e => e.title || "Untitled", sub: e => e.type || "", star: e => e.featured,
      blank: () => ({ id: "event-" + Date.now().toString(36), type: "Training", title: "New event", description: "", link: "", featured: false }),
      fields: [
        { key: "title", label: "Title" }, { key: "type", label: "Type", placeholder: "Training / AI event · hosted" },
        { key: "description", label: "Description", type: "textarea", full: true, rows: 3 },
        { key: "link", label: "Link (LinkedIn post, etc.)", type: "url" }, { key: "featured", label: "Featured", type: "bool" },
        { key: "id", label: "ID" }
      ]
    }
  };

  /* --------------------------------------------------------------- panels */
  const TITLES = { overview: "Overview", profile: "Profile & hero", projects: "Projects", clientWork: "Client work", demos: "Demo room", events: "Events & training", assistant: "AI agent", media: "Media library", json: "Raw JSON" };

  function render() {
    $$("[data-tab]").forEach(b => b.classList.toggle("is-active", b.dataset.tab === S.tab));
    $("[data-title]").textContent = TITLES[S.tab];
    const p = $("[data-panel]");
    if (SCHEMA[S.tab]) p.innerHTML = listPanel(S.tab);
    else p.innerHTML = ({ overview: overviewPanel, profile: profilePanel, assistant: assistantPanel, media: mediaPanel, json: jsonPanel })[S.tab]();
    if (S.tab === "overview") loadOverview();
    if (S.tab === "media") loadMedia();
  }

  function overviewPanel() {
    const d = S.data;
    return `
      <div class="kpis">
        <div class="kpi"><strong>${d.projects.length}</strong><span>Projects</span></div>
        <div class="kpi"><strong>${d.projects.filter(p => p.featured).length}</strong><span>Featured</span></div>
        <div class="kpi"><strong>${d.demos.filter(x => x.embedUrl).length}/${d.demos.length}</strong><span>Demos with video</span></div>
        <div class="kpi"><strong>${d.events.length}</strong><span>Events & trainings</span></div>
      </div>
      <div class="box">
        <h2>Live site</h2>
        <p class="muted">Publishing commits <code>content.json</code> to <strong>${esc(S.cfg.branch)}</strong>; GitHub Pages rebuilds in about a minute.</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
          <a class="button button-ghost" href="${esc(siteUrl())}" target="_blank" rel="noopener">${esc(siteUrl())} ↗</a>
          <span class="pill" data-deploy>${S.offline ? "Offline mode" : "Checking deploy status…"}</span>
          <span class="pill ${d.assistant?.endpoint ? "" : "warn"}">${d.assistant?.endpoint ? "AI agent online" : "AI agent in offline mode — add an endpoint"}</span>
        </div>
      </div>
      <div class="box"><h2>Recent changes</h2><p class="muted">Latest commits touching your content.</p><ul class="feed" data-feed>${S.offline ? "<li>Sign in to see history.</li>" : "<li>Loading…</li>"}</ul></div>
      <div class="box"><h2>Quick actions</h2><p class="muted">Common edits, one click away.</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <button class="button button-ghost" type="button" data-go="projects" data-then="import">Import a repo from GitHub</button>
          <button class="button button-ghost" type="button" data-go="demos">Add a demo video</button>
          <button class="button button-ghost" type="button" data-go="profile">Update availability</button>
          <button class="button button-ghost" type="button" data-go="assistant">Tune the AI agent</button>
        </div>
      </div>`;
  }

  async function loadOverview() {
    if (S.offline) return;
    gh(repoPath(`/commits?path=${CONTENT_PATH}&sha=${encodeURIComponent(S.cfg.branch)}&per_page=6`)).then(list => {
      const el = $("[data-feed]"); if (!el) return;
      el.innerHTML = list.length ? list.map(c => `<li><span>${esc(c.commit.message.split("\n")[0])}</span><span>${ago(c.commit.author.date)}</span></li>`).join("") : "<li>No commits yet.</li>";
    }).catch(() => { const el = $("[data-feed]"); if (el) el.innerHTML = "<li>Couldn't load history.</li>"; });
    deployStatus();
  }

  async function deployStatus() {
    const el = $("[data-deploy]"); if (!el || S.offline) return null;
    try {
      const b = await gh(repoPath("/pages/builds/latest"));
      const label = { built: "✓ Deployed", building: "◌ Building…", queued: "◌ Queued…", errored: "✕ Build failed" }[b.status] || b.status;
      el.textContent = `${label} · ${ago(b.updated_at || b.created_at)}`;
      el.classList.toggle("warn", b.status === "errored");
      return b.status;
    } catch { el.textContent = "Deploy status needs Pages: read permission"; return null; }
  }

  function profilePanel() {
    const stats = S.data.profile.stats || [];
    return `
      <div class="box"><h2>Hero</h2><p class="muted">The first thing visitors read.</p>${fields([
        { key: "availability", label: "Availability badge", full: true },
        { key: "headline", label: "Headline" }, { key: "headlineAccent", label: "Headline accent (italic)" },
        { key: "intro", label: "Intro", type: "textarea", full: true, rows: 3 },
        { key: "role", label: "Role line" }, { key: "location", label: "Location line" }
      ], "profile")}</div>
      <div class="box"><h2>Identity & contact</h2><p class="muted">Used across the site, the footer and by the AI agent.</p>${fields([
        { key: "name", label: "Full name" }, { key: "shortName", label: "Short name" },
        { key: "email", label: "Email" }, { key: "linkedin", label: "LinkedIn URL", type: "url" },
        { key: "github", label: "GitHub URL", type: "url" }
      ], "profile")}</div>
      <div class="box"><h2>About</h2><p class="muted">The “person behind the projects” section.</p>${fields([
        { key: "aboutTitle", label: "Title" }, { key: "aboutAccent", label: "Accent line (italic)" },
        { key: "about", label: "Paragraphs", type: "paragraphs", full: true },
        { key: "skills", label: "Skills (marquee & cloud)", type: "csv", full: true }
      ], "profile")}</div>
      <div class="box"><h2>Highlight stats</h2><p class="muted">The four numbers under the hero.</p>
        <div class="sub-list">${stats.map((s, i) => `<div class="sub-row"><input data-path="profile.stats.${i}.value" value="${esc(s.value)}" aria-label="Value"><input data-path="profile.stats.${i}.label" value="${esc(s.label)}" aria-label="Label"><button type="button" data-stat-remove="${i}" aria-label="Remove">×</button></div>`).join("")}</div>
        <button class="button button-ghost" type="button" data-stat-add style="margin-top:12px">+ Add stat</button>
      </div>`;
  }

  function assistantPanel() {
    return `
      <div class="box"><h2>Personality</h2><p class="muted">How Undi greets visitors and what extra context it knows.</p>${fields([
        { key: "name", label: "Agent name" },
        { key: "greeting", label: "Greeting", type: "textarea", full: true, rows: 3 },
        { key: "suggestions", label: "Suggested prompts", type: "lines", full: true },
        { key: "knowledge", label: "Extra knowledge & rules", type: "textarea", full: true, rows: 6, hint: "Rates, availability, preferred projects — anything the agent should know that isn't elsewhere on the site." }
      ], "assistant")}</div>
      <div class="box"><h2>Model connection</h2><p class="muted">URL of your Cloudflare Worker proxy (see <code>worker/README.md</code>). It holds your GitHub Models token so it's never exposed. Leave empty to run the built-in offline agent.</p>
        ${fields([{ key: "endpoint", label: "Agent endpoint URL", type: "url", full: true, placeholder: "https://undi-agent.<you>.workers.dev" }], "assistant")}
        <div style="display:flex;gap:10px;align-items:center;margin-top:14px"><button class="button button-ghost" type="button" data-test-agent>Test connection</button><span class="muted" data-test-result></span></div>
      </div>`;
  }

  function listPanel(key) {
    const sc = SCHEMA[key], items = S.data[key] || [];
    return `
      <div class="list-head"><p>${esc(sc.blurb)}</p>
        <div style="display:flex;gap:8px">${key === "projects" ? '<button class="button button-ghost" type="button" data-import>Import from GitHub</button>' : ""}<button class="button button-primary" type="button" data-add="${key}">+ Add</button></div>
      </div>
      <div class="items">${items.map((it, i) => `
        <details class="item" data-index="${i}" ${S.open[key] === i ? "open" : ""}>
          <summary>
            ${sc.thumb ? `<span class="item-thumb">${sc.thumb(it)}</span>` : ""}
            <span class="item-title"><strong>${sc.star?.(it) ? '<span class="star">★</span> ' : ""}<span data-live-title>${esc(sc.label(it))}</span></strong><span>${esc(sc.sub(it))}</span></span>
            <span class="item-tools">
              ${sc.star ? `<button type="button" data-act="star" title="Toggle featured" aria-label="Toggle featured">★</button>` : ""}
              <button type="button" data-act="up" title="Move up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
              <button type="button" data-act="down" title="Move down" aria-label="Move down" ${i === items.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" data-act="dup" title="Duplicate" aria-label="Duplicate">⧉</button>
              <button type="button" data-act="del" class="danger" title="Delete" aria-label="Delete">🗑</button>
            </span>
          </summary>
          <div class="item-body">${fields(sc.fields, `${key}.${i}`)}</div>
        </details>`).join("") || '<p class="muted">Nothing here yet.</p>'}
      </div>`;
  }

  function mediaPanel() {
    return `<label class="dropzone" data-drop><strong>Drop images here or click to upload</strong><span class="hint">PNG, JPG, WEBP, GIF or SVG · up to 5 MB · saved to ${UPLOAD_DIR}/</span><input type="file" accept="image/*" multiple hidden data-media-input></label>
      <div class="media-grid" data-media>${S.offline ? '<p class="muted">Sign in to manage media.</p>' : '<p class="muted">Loading…</p>'}</div>`;
  }

  async function loadMedia() {
    if (S.offline) return;
    const el = $("[data-media]");
    try {
      const files = (await gh(repoPath(`/contents/${UPLOAD_DIR}?ref=${encodeURIComponent(S.cfg.branch)}`))).filter(f => f.type === "file" && !f.name.startsWith("."));
      el.innerHTML = files.length ? files.map(f => `<div class="media"><img src="${esc(f.download_url)}" alt="" loading="lazy"><div><span title="${esc(f.path)}">${esc(f.name)}</span><button type="button" data-copy-path="${esc(f.path)}">Copy</button><button type="button" data-delete-media="${esc(f.path)}" data-sha="${esc(f.sha)}" style="color:var(--coral)">Delete</button></div></div>`).join("") : '<p class="muted">No uploads yet.</p>';
    } catch (e) { el.innerHTML = e.status === 404 ? '<p class="muted">No uploads yet.</p>' : `<p class="muted">Couldn't load media: ${esc(e.message)}</p>`; }
  }

  function jsonPanel() {
    return `<div class="box"><h2>Raw content</h2><p class="muted">Power-user mode. Edit, then apply. You can also import or export the whole file.</p>
      <textarea class="json-editor" data-json spellcheck="false">${esc(text())}</textarea>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">
        <button class="button button-primary" type="button" data-json-apply>Apply JSON</button>
        <button class="button button-ghost" type="button" data-export>Download content.json</button>
        <label class="button button-ghost" style="display:inline-flex">Import file<input type="file" accept="application/json,.json" hidden data-import-file></label>
      </div></div>`;
  }

  /* --------------------------------------------------------------- upload */
  function pickFile(accept = "image/*") {
    return new Promise(res => { const i = Object.assign(document.createElement("input"), { type: "file", accept }); i.onchange = () => res(i.files[0]); i.click(); });
  }

  async function upload(file) {
    if (S.offline) throw new Error("Sign in with GitHub to upload files.");
    if (!file.type.startsWith("image/")) throw new Error("Only images can be uploaded.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB.");
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${UPLOAD_DIR}/${slug(file.name.replace(/\.[^.]+$/, ""))}-${Date.now().toString(36)}.${ext}`;
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
    toast("Uploading " + file.name + "…");
    await gh(repoPath(`/contents/${path}`), { method: "PUT", body: JSON.stringify({ message: `media: upload ${file.name}`, content: b64, branch: S.cfg.branch }) });
    toast("Uploaded ✓  (visible on the live site after the next deploy)");
    return path;
  }

  /* -------------------------------------------------------------- publish */
  function validate() {
    for (const k of ["projects", "clientWork", "demos", "events"]) {
      const ids = new Set();
      for (const it of S.data[k] || []) {
        if (!it.id) return `Every item in ${k} needs an ID.`;
        if (ids.has(it.id)) return `Duplicate ID “${it.id}” in ${k}.`;
        ids.add(it.id);
      }
    }
    if (!S.data.profile?.name) return "Profile name is required.";
    return "";
  }

  function exportJson() {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text()], { type: "application/json" })), download: "content.json" });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function publish() {
    const err = validate();
    if (err) return toast(err, true);
    if (S.offline) { exportJson(); return toast("Exported content.json — replace the file in your repo."); }
    if (!dirty()) return toast("Nothing new to publish.");
    const btn = $("[data-publish]");
    btn.disabled = true; btn.textContent = "Publishing…";
    try {
      let sha = null;
      try { sha = (await gh(repoPath(`/contents/${CONTENT_PATH}?ref=${encodeURIComponent(S.cfg.branch)}`))).sha; } catch (e) { if (e.status !== 404) throw e; }
      if (sha && S.remoteSha && sha !== S.remoteSha && !confirm("content.json changed on GitHub since you opened Studio. Overwrite it with your version?")) return;
      const msg = prompt("Describe this update (commit message):", "content: update via Studio");
      if (msg === null) return;
      const res = await gh(repoPath(`/contents/${CONTENT_PATH}`), { method: "PUT", body: JSON.stringify({ message: msg || "content: update via Studio", content: toB64(text()), branch: S.cfg.branch, ...(sha ? { sha } : {}) }) });
      S.remoteSha = res.content.sha; S.remoteText = text();
      try { localStorage.removeItem("aup-draft"); } catch {}
      changed();
      toast("Published ✓ — the site will update in about a minute.");
      watchDeploy();
    } catch (e) {
      toast("Publish failed: " + e.message, true);
    } finally { btn.disabled = false; btn.textContent = "Publish"; }
  }

  function watchDeploy() {
    let n = 0;
    const tick = async () => {
      if (S.tab !== "overview" || ++n > 30) return;
      const st = await deployStatus();
      if (st && st !== "built" && st !== "errored") setTimeout(tick, 5000);
      else if (n < 3) setTimeout(tick, 5000);
    };
    setTimeout(tick, 4000);
  }

  /* --------------------------------------------------------------- import */
  async function openImport() {
    const dlg = $("[data-import-dialog]");
    dlg.showModal();
    const listEl = $("[data-import-list]");
    let repos;
    try { repos = await gh(`/users/${encodeURIComponent(S.cfg.owner)}/repos?per_page=100&sort=updated`); }
    catch (e) { listEl.innerHTML = `<p class="muted">Couldn't load repos: ${esc(e.message)}</p>`; return; }
    const have = new Set(S.data.projects.map(p => p.repo));
    const draw = q => {
      listEl.innerHTML = repos.filter(r => !q || r.name.toLowerCase().includes(q)).map(r => `
        <div class="import-row"><div><strong>${esc(pretty(r.name))}</strong><span>${esc(r.name)} · ${esc(r.language || "—")} · ${r.fork ? "fork · " : ""}updated ${esc(r.updated_at.slice(0, 10))}</span></div>
        ${have.has(r.name) ? '<span class="pill">Added</span>' : `<button class="button button-ghost" type="button" data-import-repo="${esc(r.name)}">Add</button>`}</div>`).join("");
    };
    draw("");
    $("[data-import-filter]").oninput = e => draw(e.target.value.toLowerCase());
    listEl.onclick = e => {
      const b = e.target.closest("[data-import-repo]"); if (!b) return;
      const r = repos.find(x => x.name === b.dataset.importRepo);
      S.data.projects.push({ ...SCHEMA.projects.blank(), id: slug(r.name), title: pretty(r.name), repo: r.name, description: r.description || "", year: r.updated_at.slice(0, 4), tags: r.language ? [r.language] : [], fork: r.fork });
      have.add(r.name); b.outerHTML = '<span class="pill">Added</span>';
      S.open.projects = S.data.projects.length - 1;
      changed(); render();
      toast(`Added “${pretty(r.name)}” — fill in the details below.`);
    };
  }

  /* --------------------------------------------------------------- events */
  document.addEventListener("input", e => {
    const el = e.target.closest("[data-path]");
    if (!el) return;
    setPath(S.data, el.dataset.path, readInput(el));
    const item = el.closest(".item");
    if (item && /\.(title)$/.test(el.dataset.path)) $("[data-live-title]", item).textContent = el.value || "Untitled";
    changed();
  });
  document.addEventListener("change", e => { if (e.target.matches("[data-kind=bool],[data-kind=multi],select")) e.target.dispatchEvent(new Event("input", { bubbles: true })); });

  document.addEventListener("click", async e => {
    const t = e.target;
    const tab = t.closest("[data-tab]");
    if (tab) { S.tab = tab.dataset.tab; render(); scrollTo(0, 0); return; }
    const go = t.closest("[data-go]");
    if (go) { S.tab = go.dataset.go; render(); if (go.dataset.then === "import") openImport(); return; }
    if (t.closest("[data-theme-toggle]")) { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; try { localStorage.setItem("aup-theme", n); } catch {} return; }
    if (t.closest("[data-publish]")) return publish();
    if (t.closest("[data-discard]")) { if (dirty() && confirm("Discard all unpublished changes?")) { S.data = JSON.parse(S.remoteText); try { localStorage.removeItem("aup-draft"); } catch {} render(); changed(); } return; }
    if (t.closest("[data-signout]")) { sessionStorage.removeItem("aup-studio"); localStorage.removeItem("aup-studio"); location.reload(); return; }
    if (t.closest("[data-close]")) { t.closest("dialog").close(); return; }
    if (t.closest("[data-import]")) return openImport();

    const add = t.closest("[data-add]");
    if (add) { const k = add.dataset.add; S.data[k].push(SCHEMA[k].blank()); S.open[k] = S.data[k].length - 1; changed(); render(); $(".item[open]")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    const act = t.closest("[data-act]");
    if (act) {
      e.preventDefault();
      const k = S.tab, list = S.data[k], i = +act.closest(".item").dataset.index;
      if (act.dataset.act === "up" && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; S.open[k] = i - 1; }
      if (act.dataset.act === "down" && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; S.open[k] = i + 1; }
      if (act.dataset.act === "dup") { list.splice(i + 1, 0, { ...structuredClone(list[i]), id: list[i].id + "-copy", title: (list[i].title || "") + " (copy)" }); S.open[k] = i + 1; }
      if (act.dataset.act === "star") list[i].featured = !list[i].featured;
      if (act.dataset.act === "del") { if (!confirm(`Delete “${list[i].title || "this item"}”?`)) return; list.splice(i, 1); S.open[k] = -1; }
      changed(); render(); return;
    }
    const sum = t.closest(".item > summary");
    if (sum) { const d = sum.parentElement; setTimeout(() => { S.open[S.tab] = d.open ? +d.dataset.index : -1; }); }

    if (t.closest("[data-stat-add]")) { (S.data.profile.stats ||= []).push({ value: "", label: "" }); changed(); render(); return; }
    const sr = t.closest("[data-stat-remove]");
    if (sr) { S.data.profile.stats.splice(+sr.dataset.statRemove, 1); changed(); render(); return; }

    const up = t.closest("[data-upload]");
    if (up) {
      const file = await pickFile(); if (!file) return;
      try {
        const path = await upload(file);
        const cur = getPath(S.data, up.dataset.upload);
        setPath(S.data, up.dataset.upload, up.hasAttribute("data-append") ? [...(cur || []), path] : path);
        changed(); render();
      } catch (err) { toast(err.message, true); }
      return;
    }
    const cp = t.closest("[data-copy-path]");
    if (cp) { navigator.clipboard?.writeText(cp.dataset.copyPath); toast("Path copied — paste it into any image field."); return; }
    const dm = t.closest("[data-delete-media]");
    if (dm) {
      if (!confirm("Delete this file from the repository?")) return;
      try { await gh(repoPath(`/contents/${dm.dataset.deleteMedia}`), { method: "DELETE", body: JSON.stringify({ message: `media: delete ${dm.dataset.deleteMedia}`, sha: dm.dataset.sha, branch: S.cfg.branch }) }); toast("Deleted."); loadMedia(); }
      catch (err) { toast(err.message, true); }
      return;
    }
    if (t.closest("[data-json-apply]")) {
      try { S.data = JSON.parse($("[data-json]").value); changed(); toast("JSON applied."); } catch (err) { toast("Invalid JSON: " + err.message, true); }
      return;
    }
    if (t.closest("[data-export]")) return exportJson();
    if (t.closest("[data-test-agent]")) {
      const out = $("[data-test-result]"), url = S.data.assistant.endpoint;
      if (!url) { out.textContent = "Add an endpoint first."; return; }
      out.textContent = "Testing…";
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Reply with the single word: pong" }] }) });
        const j = await r.json();
        out.textContent = r.ok ? `✓ Connected · ${j.model} replied “${(j.choices?.[0]?.message?.content || "").slice(0, 40)}”` : `✕ ${r.status}: ${j.error || ""} ${j.detail || ""}`.slice(0, 200);
      } catch (err) { out.textContent = "✕ " + err.message + " (check ALLOWED_ORIGINS in the worker)"; }
    }
  });

  document.addEventListener("change", async e => {
    if (e.target.matches("[data-media-input]")) {
      for (const f of e.target.files) { try { await upload(f); } catch (err) { toast(err.message, true); } }
      loadMedia();
    }
    if (e.target.matches("[data-import-file]")) {
      try { S.data = JSON.parse(await e.target.files[0].text()); changed(); render(); toast("Imported."); } catch (err) { toast("Invalid file: " + err.message, true); }
    }
  });
  document.addEventListener("dragover", e => { const d = e.target.closest?.("[data-drop]"); if (d) { e.preventDefault(); d.classList.add("is-over"); } });
  document.addEventListener("dragleave", e => e.target.closest?.("[data-drop]")?.classList.remove("is-over"));
  document.addEventListener("drop", async e => {
    const d = e.target.closest?.("[data-drop]"); if (!d) return;
    e.preventDefault(); d.classList.remove("is-over");
    for (const f of e.dataTransfer.files) { try { await upload(f); } catch (err) { toast(err.message, true); } }
    loadMedia();
  });
  addEventListener("beforeunload", e => { if (S.data && !S.offline && dirty()) e.preventDefault(); });

  initLogin();
})();
