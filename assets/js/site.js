/* Aubrey Undi Phiri — portfolio runtime.
   All content comes from /content.json (edited through /admin). */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u = "") => {
    const s = String(u).trim();
    if (!s) return "";
    if (/^(assets\/|\.\/|\/)/.test(s) && !s.startsWith("//")) return s;
    try { const url = new URL(s); return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
  };
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

  /* --------------------------------------------------------------- content */
  async function loadContent() {
    const params = new URLSearchParams(location.search);
    if (params.get("preview") === "draft") {
      try {
        const draft = JSON.parse(localStorage.getItem("aup-draft") || "null");
        if (draft) { showPreviewBanner(); return draft; }
      } catch {}
    }
    const res = await fetch("content.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("content.json " + res.status);
    return res.json();
  }

  function showPreviewBanner() {
    const b = document.createElement("div");
    b.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;padding:10px 18px;border-radius:99px;background:#ff7a5c;color:#1a0d08;font:600 13px Inter,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)";
    b.textContent = "Previewing unpublished draft";
    document.body.append(b);
  }

  /* ------------------------------------------------------- generative art */
  function rng(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }

  function art(key, seed = key) {
    const r = rng(seed);
    const W = 400, H = 260;
    let inner = "";
    switch (key) {
      case "asthma": {
        const wave = (amp, off, freq) => {
          let d = `M0 ${H / 2}`;
          for (let x = 0; x <= W; x += 8) {
            const env = Math.sin((x / W) * Math.PI);
            const y = H / 2 + Math.sin(x * freq + off) * amp * env * (0.75 + 0.25 * Math.sin(x * .021 + off * 3 + r() * .4));
            d += ` L${x} ${y.toFixed(1)}`;
          }
          return d;
        };
        inner = `<path class="s wave-anim" d="${wave(60, 0, .09)}"/><path class="s2 wave-anim" style="animation-delay:.3s" d="${wave(38, 2, .13)}"/>
          ${Array.from({ length: 22 }, (_, i) => `<rect class="f float" opacity="${(.15 + r() * .35).toFixed(2)}" x="${30 + i * 16}" y="${210 - r() * 26}" width="6" height="${8 + r() * 26}" rx="3"/>`).join("")}
          <text class="txt" x="24" y="40">INHALE · EXHALE</text><text class="txt" x="300" y="40">WHEEZE?</text>`;
        break;
      }
      case "breast": {
        let cells = "";
        for (let i = 0; i < 18; i++) {
          const x = 30 + r() * 340, y = 30 + r() * 200, s = 12 + r() * 24, bad = r() > .72;
          cells += `<g class="float"><circle cx="${x}" cy="${y}" r="${s}" class="${bad ? "f3" : "f2"}" opacity=".16"/><circle cx="${x}" cy="${y}" r="${s}" fill="none" stroke="var(${bad ? "--coral" : "--sky"})" stroke-width="1.3" opacity=".7"/><circle cx="${x + s * .2}" cy="${y - s * .15}" r="${s * .32}" class="${bad ? "f3" : "f"}" opacity=".9"/></g>`;
        }
        inner = `${cells}<text class="txt" x="24" y="244">P(MALIGNANT | X) = σ(βᵀX)</text>`;
        break;
      }
      case "mobility": {
        let grid = "";
        for (let x = 0; x <= W; x += 32) grid += `<path class="s3" d="M${x} 0V${H}"/>`;
        for (let y = 0; y <= H; y += 32) grid += `<path class="s3" d="M0 ${y}H${W}"/>`;
        const pts = Array.from({ length: 6 }, (_, i) => [30 + i * 68, 50 + r() * 160]);
        const d = pts.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ");
        const pts2 = Array.from({ length: 5 }, (_, i) => [10 + i * 95, 40 + r() * 180]);
        inner = `${grid}<path class="s dash" d="${d}"/><path class="s2 dash" style="animation-direction:reverse" d="${pts2.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ")}"/>
          ${pts.map(p => `<circle class="f" cx="${p[0]}" cy="${p[1]}" r="5"/><circle cx="${p[0]}" cy="${p[1]}" r="12" fill="none" stroke="var(--accent)" opacity=".35" class="blink"/>`).join("")}
          <text class="txt" x="24" y="244">SPARK · MAP → REDUCE</text>`;
        break;
      }
      case "neural": {
        const layers = [4, 6, 6, 3];
        const nodes = layers.map((n, li) => Array.from({ length: n }, (_, i) => [60 + li * 95, H / 2 + (i - (n - 1) / 2) * 36]));
        let edges = "";
        for (let l = 0; l < nodes.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) if (r() > .35) edges += `<path class="s3" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" opacity="${(.4 + r() * .6).toFixed(2)}"/>`;
        const path = nodes.map(L => L[Math.floor(r() * L.length)]);
        inner = `${edges}<path class="s dash" d="${path.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ")}"/>
          ${nodes.flat().map((p, i) => `<circle class="${i % 5 === 0 ? "fv" : "f2"} float" cx="${p[0]}" cy="${p[1]}" r="${6 + r() * 3}" opacity=".9"/>`).join("")}
          <text class="txt" x="24" y="30">∂L/∂w</text>`;
        break;
      }
      case "face": {
        const cx = 200, cy = 130;
        const marks = [[-34, -18], [34, -18], [-22, -22], [22, -22], [0, 8], [-14, 22], [0, 30], [14, 22], [-46, 0], [46, 0], [0, -48], [-30, 44], [30, 44], [0, 60]];
        inner = `<ellipse cx="${cx}" cy="${cy}" rx="70" ry="92" fill="none" stroke="var(--line-strong)" stroke-width="1.2"/>
          <path class="s3" d="${marks.map((m, i) => (i ? "L" : "M") + (cx + m[0]) + " " + (cy + m[1])).join(" ")}" opacity=".7"/>
          ${marks.map(m => `<circle class="f blink" style="animation-delay:${(r() * 2).toFixed(2)}s" cx="${cx + m[0]}" cy="${cy + m[1]}" r="3"/>`).join("")}
          <path class="s" d="M110 40h-22v22M290 40h22v22M110 220h-22v-22M290 220h22v-22"/>
          <rect class="scan" x="88" y="40" width="224" height="2" fill="var(--accent)" opacity=".7"/>
          <text class="txt" x="232" y="34" style="fill:var(--accent)">MATCH 0.97</text>`;
        break;
      }
      case "dna": {
        let a = "M0 130", b = "M0 130", rungs = "";
        for (let x = 0; x <= W; x += 10) {
          const y1 = H / 2 + Math.sin(x / 34) * 70, y2 = H / 2 - Math.sin(x / 34) * 70;
          a += ` L${x} ${y1.toFixed(1)}`; b += ` L${x} ${y2.toFixed(1)}`;
          if (x % 20 === 0) rungs += `<path stroke="var(${["--accent", "--sky", "--coral", "--violet"][Math.floor(r() * 4)]})" stroke-width="3" stroke-linecap="round" opacity=".55" d="M${x} ${y1.toFixed(1)}L${x} ${y2.toFixed(1)}"/>`;
        }
        inner = `${rungs}<path class="s" d="${a}"/><path class="s2" d="${b}"/><text class="txt" x="24" y="244">ACGTTGCA… → BINDS?</text>`;
        break;
      }
      default: { // stats
        let bars = "";
        for (let i = 0; i < 12; i++) { const h = 30 + r() * 140; bars += `<rect class="${i % 4 === 0 ? "f" : "f2"} float" opacity="${i % 4 === 0 ? .9 : .35}" x="${36 + i * 28}" y="${220 - h}" width="16" height="${h}" rx="4"/>`; }
        inner = `<path class="s3" d="M30 220H380M30 30V220"/>${bars}<path class="s" d="M30 220 C60 80 140 46 380 34"/><path class="s3" d="M30 220 L380 34" stroke-dasharray="4 6"/><text class="txt" x="300" y="210">AUC</text>`;
      }
    }
    return `<div class="art art-bg-${esc(key)}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg></div>`;
  }

  /* --------------------------------------------------------------- render */
  let content = null;
  const ghUrl = p => `https://github.com/${encodeURIComponent(content.site?.repoOwner || "AubreyUndiPhiri")}/${encodeURIComponent(p.repo || "")}`;
  const projectVisual = p => (p.image && safeUrl(p.image)) ? `<img src="${esc(safeUrl(p.image))}" alt="" loading="lazy">` : art(p.art || "stats", p.id);

  function renderBindings() {
    $$("[data-bind]").forEach(el => { const v = get(content, el.dataset.bind); if (v != null) el.textContent = v; });
    $$("[data-bind-href]").forEach(el => { const v = safeUrl(get(content, el.dataset.bindHref)); if (v) el.href = v; });
    $$("[data-bind-mailto]").forEach(el => { const v = get(content, el.dataset.bindMailto); if (v) el.href = "mailto:" + v; });
    const p = content.profile || {};
    $("[data-stats]").innerHTML = (p.stats || []).map(s => `<div class="stat reveal"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join("");
    const skills = p.skills || [];
    $("[data-marquee]").innerHTML = [...skills, ...skills].map(s => `<span>${esc(s)}</span>`).join("");
    $("[data-skills]").innerHTML = skills.map(s => `<span>${esc(s)}</span>`).join("");
    $("[data-about]").innerHTML = (p.about || []).map(t => `<p>${esc(t)}</p>`).join("");
    if (p.name) document.title = `${p.name} — Data, made useful.`;
  }

  function renderProjects() {
    const featured = (content.projects || []).filter(p => p.featured);
    // Grid is 6 columns: first card spans 4, the rest span 2; a lone/paired tail row stretches to fill.
    const tail = (featured.length - 2) % 3;
    const size = i => i === 0 ? "is-hero" : (tail && i >= featured.length - tail) ? (tail === 1 ? "is-full" : "is-wide") : "";
    $("#project-grid").innerHTML = featured.map((p, i) => `
      <article class="card reveal ${size(i)}" data-project="${esc(p.id)}" data-filters="${esc((p.filters || []).join(" "))}" tabindex="0" role="button" aria-label="Open ${esc(p.title)}">
        <div class="card-art">
          <div class="card-badges"><span class="badge">${p.fork ? '<span class="sr-only">Forked repository, </span>Fork · ' : ""}${esc(p.year || "")}</span><span class="card-open" aria-hidden="true">↗</span></div>
          ${projectVisual(p)}
        </div>
        <div class="card-body">
          <p class="card-kicker">${esc(p.category)}</p>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
          <div class="tags">${(p.tags || []).map(t => `<span>${esc(t)}</span>`).join("")}</div>
        </div>
      </article>`).join("");

    const rest = (content.projects || []).filter(p => !p.featured);
    $("#archive-list").innerHTML = rest.map((p, i) => `
      <li class="archive-row" data-project="${esc(p.id)}" data-filters="${esc((p.filters || []).join(" "))}" tabindex="0" role="button">
        <span class="num">${String(featured.length + i + 1).padStart(2, "0")}</span>
        <strong>${esc(p.title)}</strong>
        <span class="cat">${esc(p.category)}</span>
        <span class="yr">${esc(p.year || "")}</span>
        <span class="go" aria-hidden="true">↗</span>
      </li>`).join("");
    $(".archive").hidden = rest.length === 0;
  }

  function renderClients() {
    $("#client-list").innerHTML = (content.clientWork || []).map(c => {
      const imgs = (c.images || []).map(safeUrl).filter(Boolean);
      const words = String(c.title || "").split(" ");
      const last = words.pop();
      return `
      <article class="client reveal">
        <div class="client-story">
          <span class="client-kicker"><span class="live-dot"></span>${esc(c.kicker)}</span>
          <h3>${esc(words.join(" "))} <em>${esc(last)}.</em></h3>
          <p class="client-lead">${esc(c.lead)}</p>
          <p class="client-desc">${esc(c.description)}</p>
          <div class="client-features">${(c.features || []).map(f => `<span>${esc(f)}</span>`).join("")}</div>
          <div class="client-foot">
            <span class="client-date">${esc(c.date)}</span>
            ${safeUrl(c.link) ? `<a class="button button-primary" href="${esc(safeUrl(c.link))}" target="_blank" rel="noopener noreferrer">See the launch story ↗</a>` : ""}
          </div>
        </div>
        <div class="client-gallery">
          ${imgs.slice(0, 2).map((src, i) => `<a href="${esc(safeUrl(i ? c.secondaryLink || c.link : c.link))}" target="_blank" rel="noopener noreferrer" aria-label="Open launch post">
              <span class="fallback">${art(i ? "face" : "neural", c.id + i)}</span>
              <img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">
              <span class="badge cap">${i ? "The story" : "The launch"} ↗</span></a>`).join("")}
        </div>
      </article>`;
    }).join("");
  }

  function embedUrl(raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:") return "";
      if (["www.youtube-nocookie.com", "www.youtube.com", "player.vimeo.com", "www.loom.com"].includes(u.hostname)) return u.href;
      if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname) && u.searchParams.get("v")) return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(u.searchParams.get("v"));
      if (u.hostname === "youtu.be") return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(u.pathname.slice(1));
      return "";
    } catch { return ""; }
  }

  function renderDemos() {
    $("#demo-grid").innerHTML = (content.demos || []).map(d => {
      const ready = Boolean(embedUrl(d.embedUrl || ""));
      return `<article class="demo reveal">
        <div class="demo-thumb">${art(d.art || "stats", d.id)}
          <button class="demo-play" type="button" data-demo="${esc(d.id)}" ${ready ? `aria-label="Play ${esc(d.title)}"` : 'disabled aria-label="Video coming soon"'}>▶</button>
          ${ready ? "" : '<span class="badge demo-soon">Coming soon</span>'}
        </div>
        <div class="demo-info"><h3>${esc(d.title)}</h3><p>${esc(d.detail)}</p></div>
      </article>`;
    }).join("");
  }

  function renderEvents() {
    $("#event-list").innerHTML = (content.events || []).map(e => `
      <a class="event reveal ${e.featured ? "is-featured" : ""}" href="${esc(safeUrl(e.link) || "#")}" target="_blank" rel="noopener noreferrer">
        ${e.featured ? '<span class="event-ring" aria-hidden="true"></span>' : ""}
        <div><span class="type">${esc(e.type)}</span><h3>${esc(e.title)}</h3>${e.featured ? `<p style="margin-top:12px;max-width:520px">${esc(e.description)}</p>` : ""}</div>
        ${e.featured ? "" : `<p>${esc(e.description)}</p>`}
        <span class="go button button-ghost">Read the story ↗</span>
      </a>`).join("");
  }

  function renderAll() {
    renderBindings(); renderProjects(); renderClients(); renderDemos(); renderEvents();
    observeReveals(); bindSpotlight();
  }

  /* ----------------------------------------------------------- behaviour */
  function filterProjects(filter = "all", query = "") {
    const q = String(query || "").toLowerCase().trim();
    let count = 0;
    $$("[data-project]").forEach(el => {
      const p = content.projects.find(x => x.id === el.dataset.project);
      const hay = p ? [p.title, p.category, p.description, ...(p.tags || [])].join(" ").toLowerCase() : "";
      const show = (filter === "all" || el.dataset.filters.split(" ").includes(filter)) && (!q || q.split(/\s+/).some(w => hay.includes(w)));
      el.classList.toggle("is-hidden", !show);
      if (show) count++;
    });
    $$(".filter").forEach(b => { const on = b.dataset.filter === filter; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
    return count;
  }

  const repoCache = new Map();
  async function repoStats(repo) {
    if (repoCache.has(repo)) return repoCache.get(repo);
    const p = fetch(`https://api.github.com/repos/${encodeURIComponent(content.site?.repoOwner || "AubreyUndiPhiri")}/${encodeURIComponent(repo)}`)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    repoCache.set(repo, p);
    return p;
  }

  function openProject(id, { beside = false } = {}) {
    const p = (content.projects || []).find(x => x.id === id);
    if (!p) return false;
    const drawer = $("#project-drawer");
    $(".drawer-body", drawer).innerHTML = `
      <div class="drawer-art">${projectVisual(p)}</div>
      <div class="drawer-content">
        <p class="card-kicker">${esc(p.category)} · ${esc(p.year || "")}${p.fork ? " · Forked repo" : ""}</p>
        <h2 id="drawer-title">${esc(p.title)}</h2>
        <p>${esc(p.description)}</p>
        ${(p.highlights || []).length ? `<h4>What's inside</h4><ul>${p.highlights.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
        <h4>Live from GitHub</h4>
        <div class="repo-live" data-repo-live><div><strong>…</strong><span>Stars</span></div><div><strong>…</strong><span>Language</span></div><div><strong>…</strong><span>Last push</span></div></div>
        <div class="tags">${(p.tags || []).map(t => `<span>${esc(t)}</span>`).join("")}</div>
        <div class="drawer-actions">
          ${p.repo ? `<a class="button button-primary" href="${esc(ghUrl(p))}" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>` : ""}
          <button class="button button-ghost" type="button" data-open-agent data-agent-prompt="Explain the ${esc(p.title)} project to me in plain language.">Ask Undi about it ✳</button>
        </div>
      </div>`;
    // When the agent opens a project on wide screens, show the drawer beside the chat (non-modal) so the conversation stays usable.
    if (drawer.open && drawer.classList.contains("is-beside") !== beside) drawer.close();
    drawer.classList.toggle("is-beside", beside);
    if (!drawer.open) beside ? drawer.show() : drawer.showModal();
    drawer.scrollTop = 0;
    if (p.repo) repoStats(p.repo).then(d => {
      const box = $("[data-repo-live]", drawer);
      if (!box) return;
      if (!d) { box.innerHTML = `<div style="grid-column:1/-1"><span>GitHub stats unavailable right now.</span></div>`; return; }
      const when = d.pushed_at ? new Date(d.pushed_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—";
      box.innerHTML = `<div><strong>${esc(d.stargazers_count)}</strong><span>Stars</span></div><div><strong>${esc(d.language || "—")}</strong><span>Language</span></div><div><strong>${esc(when)}</strong><span>Last push</span></div>`;
    });
    return true;
  }

  function navigate(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    return true;
  }

  function highlightProject(id) {
    const el = $(`.card[data-project="${CSS.escape(id)}"], .archive-row[data-project="${CSS.escape(id)}"]`);
    if (!el) return false;
    el.classList.remove("is-hidden");
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
    return true;
  }

  function playDemo(id) {
    const d = (content.demos || []).find(x => x.id === id);
    const src = d && embedUrl(d.embedUrl || "");
    if (!src) return false;
    const dlg = $(".video-dialog");
    const frame = document.createElement("iframe");
    frame.src = src; frame.title = d.title; frame.allowFullscreen = true;
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    $(".video-frame", dlg).replaceChildren(frame);
    $(".video-caption", dlg).textContent = d.title;
    dlg.showModal();
    return true;
  }

  function setTheme(mode) {
    const next = mode === "toggle" || !mode ? (document.documentElement.dataset.theme === "dark" ? "light" : "dark") : mode;
    document.documentElement.dataset.theme = next;
    $('meta[name="theme-color"]').content = next === "dark" ? "#0b0f0d" : "#f5f3ec";
    try { localStorage.setItem("aup-theme", next); } catch {}
    return next;
  }

  /* -------------------------------------------------------------- effects */
  let revealObserver;
  function observeReveals() {
    if (!("IntersectionObserver" in window) || reduceMotion) { $$(".reveal").forEach(el => el.classList.add("is-in")); return; }
    revealObserver ||= new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); revealObserver.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    $$(".reveal:not(.is-in)").forEach((el, i) => { el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`; revealObserver.observe(el); });
  }

  function bindSpotlight() {
    $$(".card").forEach(card => card.addEventListener("pointermove", e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }));
  }

  function magnetic() {
    if (reduceMotion || matchMedia("(pointer: coarse)").matches) return;
    $$(".magnetic").forEach(el => {
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  function scrollEffects() {
    const header = $("[data-header]");
    const bar = $(".scroll-progress");
    let lastY = scrollY, ticking = false;
    const sections = ["work", "client-work", "demos", "community", "about"].map(id => document.getElementById(id));
    const update = () => {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
      header.classList.toggle("is-hidden", y > lastY && y > 400 && !$(".site-nav.is-open"));
      lastY = y;
      const current = sections.filter(Boolean).findLast(s => s.getBoundingClientRect().top < innerHeight * .4);
      $$(".site-nav a").forEach(a => a.classList.toggle("is-current", current && a.getAttribute("href") === "#" + current.id));
      ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
  }

  function heroCanvas() {
    const canvas = $(".hero-canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w, h, pts, raf, mouse = { x: -999, y: -999 };
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25 }));
    };
    const draw = () => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c6f36b";
      const line = getComputedStyle(document.documentElement).getPropertyValue("--line-strong").trim();
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 140) { p.x += dx / d * .6; p.y += dy / d * .6; }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 130) { ctx.strokeStyle = line; ctx.globalAlpha = 1 - d / 130; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      for (const [i, p] of pts.entries()) { ctx.fillStyle = i % 7 === 0 ? accent : line; ctx.beginPath(); ctx.arc(p.x, p.y, i % 7 === 0 ? 2.4 : 1.6, 0, 7); ctx.fill(); }
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };
    resize(); draw();
    addEventListener("resize", () => { cancelAnimationFrame(raf); resize(); draw(); });
    $(".hero").addEventListener("pointermove", e => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting && !reduceMotion) draw(); }).observe(canvas);
  }

  function bindUI() {
    $("[data-filters]").addEventListener("click", e => { const b = e.target.closest(".filter"); if (b) filterProjects(b.dataset.filter); });
    document.addEventListener("click", e => {
      const proj = e.target.closest("[data-project]");
      if (proj && !e.target.closest("a")) openProject(proj.dataset.project);
      const demo = e.target.closest("[data-demo]");
      if (demo) playDemo(demo.dataset.demo);
      if (e.target.closest("[data-theme-toggle]")) setTheme("toggle");
      const closer = e.target.closest("[data-close]");
      if (closer) closer.closest("dialog").close();
      if (e.target.matches("dialog")) e.target.close();
    });
    document.addEventListener("keydown", e => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-project]")) { e.preventDefault(); openProject(e.target.dataset.project); }
    });
    $(".video-dialog").addEventListener("close", () => $(".video-frame").replaceChildren());
    const toggle = $(".menu-toggle"), nav = $(".site-nav");
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", open);
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
    });
    nav.addEventListener("click", e => {
      if (e.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        nav.classList.remove("is-open");
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        nav.classList.remove("is-open");
        toggle.focus();
      }
    });
    $("#year").textContent = new Date().getFullYear();
  }

  /* ----------------------------------------------------------------- boot */
  window.AUP = {
    esc, safeUrl, art,
    get content() { return content; },
    api: { navigate, filterProjects, openProject, highlightProject, playDemo, setTheme, repoStats },
    ready: null
  };

  window.AUP.ready = loadContent().then(data => {
    content = data;
    renderAll(); bindUI(); scrollEffects(); magnetic(); heroCanvas();
    document.dispatchEvent(new CustomEvent("aup:ready", { detail: content }));
    return content;
  }).catch(err => {
    console.error(err);
    $("#project-grid").innerHTML = `<p style="color:var(--muted)">Content failed to load. If you opened this file directly, serve the folder over HTTP (e.g. <code>npx serve</code>).</p>`;
    $$(".reveal").forEach(el => el.classList.add("is-in"));
  });
})();
