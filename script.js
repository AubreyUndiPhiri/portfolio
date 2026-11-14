const projects = [
  {
    number: "01",
    title: "Kutola — AI expense tracker",
    category: "AI & everyday life",
    description: "Automates receipt processing from PDFs and images, then logs expenses in a clean, reviewable sheet.",
    tags: ["AI", "Receipt processing", "HTML"],
    filters: ["ai"],
    art: "expenses",
    repo: "ai-expense-tracker-kutola"
  },
  {
    number: "02",
    title: "Finding signals in DNA",
    category: "Machine learning · bioinformatics",
    description: "A CNN and K-means feature exploration for predicting transcription-factor binding sites in DNA sequences.",
    tags: ["CNN", "K-means", "Bioinformatics"],
    filters: ["ai", "health"],
    art: "dna",
    repo: "DNA_Transcription_Factor--Binding-Predictor-Using-CNN-and-KMeans-Features"
  },
  {
    number: "03",
    title: "Mobility, at scale",
    category: "Big data · Apache Spark",
    description: "A hands-on look at processing and analyzing mobility data with Apache Spark.",
    tags: ["Apache Spark", "Big data", "Jupyter"],
    filters: ["data"],
    art: "mobility",
    repo: "Mobility-Big-Data-Analysis-and-processing-with-Apache-Spark-projects"
  },
  {
    number: "04",
    title: "Listening for asthma",
    category: "Health data · audio",
    description: "Exploring breathing audio with signal features, persistent entropy, Betti numbers, and other topological tools.",
    tags: ["Audio signals", "Topological data", "Health"],
    filters: ["data", "health"],
    art: "asthma",
    repo: "Asthma-detection-from-human-breathing-Audio-Dataset-"
  }
];

const demos = [
  { number: "01", title: "Nkosi AI, in action", detail: "Meet the AI concierge at Nkhosi Livingstone Lodge and Spa.", project: "Nkosi AI", embedUrl: "", art: "expenses" },
  { number: "02", title: "Kutola, up close", detail: "Automated receipt processing and expense logging.", project: "Kutola", embedUrl: "", art: "expenses" },
  { number: "03", title: "Inside the DNA model", detail: "From sequences to useful signals.", project: "DNA project", embedUrl: "", art: "dna" },
  { number: "04", title: "A Spark of scale", detail: "Mobility data, in motion.", project: "Apache Spark", embedUrl: "", art: "mobility" }
];

const projectArt = {
  expenses: `<div class="project-visual visual-expenses" aria-hidden="true">
    <div class="mini-window-top"><span>RECEIPT INTAKE</span><b>AI</b></div>
    <div class="receipt-flow"><span class="receipt-file">PDF</span><span class="receipt-flow-arrow">→</span><span class="receipt-file receipt-image">IMG</span><span class="receipt-flow-arrow">→</span><span class="receipt-log">EXPENSE<br>LOGGED</span></div>
    <div class="receipt-status"><i></i> READY TO REVIEW</div>
  </div>`,
  dna: `<div class="project-visual visual-dna" aria-hidden="true">
    <span class="dna-strand"></span><i class="dna-rung"></i><i class="dna-rung"></i><i class="dna-rung"></i><i class="dna-rung"></i><i class="dna-rung"></i>
  </div>`,
  mobility: `<div class="project-visual visual-mobility" aria-hidden="true">
    <span class="map-grid"></span><svg class="map-route" viewBox="0 0 165 100" preserveAspectRatio="none"><path d="M8 77C28 76 27 26 55 38s24 46 45 34 19-53 54-57"/></svg><i class="map-pin pin-a"></i><i class="map-pin pin-b"></i>
  </div>`,
  asthma: `<div class="project-visual visual-asthma" aria-hidden="true">
    <svg class="waveform" viewBox="0 0 200 70" preserveAspectRatio="none"><path d="M0 37h15l8-6 7 12 9-27 10 40 11-27 10 11h15l8-15 9 31 9-43 9 38 9-19 8 6h13l9-10 8 14 8-7h17"/><path class="wave-secondary" d="M0 44h22l7-5 7 8 8-17 8 24 10-19 10 9h20l10-12 8 22 9-28 9 25 10-17 8 7h15l8-5 8 9 8-5h17"/></svg>
  </div>`
};

function renderProjects(filter = "all") {
  const grid = document.querySelector("#project-grid");
  const visibleProjects = projects.filter(project => filter === "all" || project.filters.includes(filter));
  grid.innerHTML = visibleProjects.map(project => `
    <article class="project-card">
      <div class="project-art art-${project.art}">
        <span class="project-index">PROJECT ${project.number}</span>
        <a class="project-open" href="https://github.com/AubreyUndiPhiri/${project.repo}" target="_blank" rel="noreferrer" aria-label="View ${project.title} on GitHub">↗</a>
        ${projectArt[project.art]}
      </div>
      <div class="project-content">
        <p class="project-kicker">${project.category}</p>
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <div class="project-tags">${project.tags.map(tag => `<span>${tag}</span>`).join("")}</div>
      </div>
    </article>
  `).join("");
}

function renderDemos() {
  const grid = document.querySelector("#demo-grid");
  grid.innerHTML = demos.map(demo => {
    const ready = Boolean(demo.embedUrl.trim());
    return `
      <article class="demo-card">
        <div class="demo-thumb demo-art-${demo.art}">
          <div class="demo-window" aria-hidden="true">
            <div class="window-dots"><i></i><i></i><i></i></div>
            <div class="demo-graphic">${Array.from({ length: 10 }, (_, index) => `<i style="--bar:${35 + ((index * 29 + 19) % 64)}%"></i>`).join("")}</div>
          </div>
          <button class="demo-play${ready ? " is-ready" : ""}" type="button" ${ready ? `data-demo="${demo.number}" aria-label="Play ${demo.title}"` : "disabled aria-label=\"Video coming soon\""}>${ready ? "▶" : "▶"}</button>
        </div>
        <div class="demo-info">
          <div><h3>${demo.title}</h3><p>${demo.detail}</p></div>
          <span class="demo-number">${demo.number} / ${String(demos.length).padStart(2, "0")}</span>
        </div>
      </article>
    `;
  }).join("");
}

function getAllowedEmbedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const allowedHosts = ["www.youtube-nocookie.com", "www.youtube.com", "player.vimeo.com"];
    return url.protocol === "https:" && allowedHosts.includes(url.hostname) ? url.href : "";
  } catch {
    return "";
  }
}

const demoDialog = document.querySelector(".video-dialog");
const videoFrame = document.querySelector(".video-frame");
document.querySelector("#project-grid").addEventListener("click", event => {
  const link = event.target.closest("a");
  if (link) link.rel = "noopener noreferrer";
});
document.querySelector("#demo-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-demo]");
  if (!button) return;
  const demo = demos.find(item => item.number === button.dataset.demo);
  const embedUrl = demo && getAllowedEmbedUrl(demo.embedUrl);
  if (!demo || !embedUrl) return;
  const frame = document.createElement("iframe");
  frame.src = embedUrl;
  frame.title = `${demo.title} video`;
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  videoFrame.replaceChildren(frame);
  document.querySelector(".video-caption").textContent = demo.title;
  demoDialog.showModal();
});

document.querySelector(".dialog-close").addEventListener("click", () => demoDialog.close());
demoDialog.addEventListener("close", () => videoFrame.replaceChildren());
demoDialog.addEventListener("click", event => {
  if (event.target === demoDialog) demoDialog.close();
});
document.querySelectorAll(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(".filter-button.is-active")?.classList.remove("is-active");
    document.querySelector(".filter-button[aria-pressed='true']")?.setAttribute("aria-pressed", "false");
    button.classList.add("is-active");
    button.setAttribute("aria-pressed", "true");
    renderProjects(button.dataset.filter);
  });
});

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  navigation.classList.toggle("is-open", !isOpen);
});
navigation.addEventListener("click", event => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
renderProjects();
renderDemos();
