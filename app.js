/* ================================
   Basura CDMX — app.js (v1.3)
   - Root-ready (rutas absolutas)
   - Sin doble registro de SW (lo hace index.html)
   - Fix esc() chaining
   - Fetch compatible con SW cache
   - Staggered Side Menu & Grid Nav
   ================================ */

const content = document.getElementById("content");
const searchInput = document.getElementById("searchInput");

// Root (más estable para PWA/TWA)
const DB_URL = "db.json";

let dbCategories = [];
let flatItems = [];
let meta = null;
let quickRules = [];
let faq = [];

// ---------- util ----------
function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(s) {
  const base = String(s || "")
    .toLowerCase()
    .normalize("NFD");

  try {
    return base.replace(/\p{Diacritic}/gu, "");
  } catch {
    return base.replace(/[\u0300-\u036f]/g, "");
  }
}

function setHTML(html) {
  content.innerHTML = html;
}

// ---------- side menu ----------
const sideMenu = document.getElementById("sideMenu");
const sideMenuBackdrop = document.getElementById("sideMenuBackdrop");
const sideMenuContent = document.getElementById("sideMenuContent");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const appTitle = document.getElementById("appTitle");

function toggleMenu(show) {
  if (show) {
    sideMenu.classList.remove("hidden");
    sideMenuBackdrop.classList.remove("hidden");
    setTimeout(() => {
      sideMenu.classList.add("visible");
      sideMenuBackdrop.classList.add("visible");
    }, 10);
    renderRulesInMenu();
  } else {
    sideMenu.classList.remove("visible");
    sideMenuBackdrop.classList.remove("visible");
    setTimeout(() => {
      if (!sideMenu.classList.contains("visible")) {
        sideMenu.classList.add("hidden");
        sideMenuBackdrop.classList.add("hidden");
      }
    }, 400);
  }
}
window.toggleMenu = toggleMenu; // Global exposure for onclick

// ---------- Widget Logic ----------
function getDayName(dayIndex) {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return days[dayIndex];
}

function renderWidget() {
  const todayIndex = new Date().getDay();
  const todayName = getDayName(todayIndex);

  // Find which categories collect today
  const todaysCats = dbCategories.filter(cat =>
    cat.collection_days.includes(todayName)
  ).map(c => c.label);

  const message = todaysCats.length > 0
    ? `Toca: ${todaysCats.join(", ")}`
    : "Hoy no hay recolección oficial.";

  // Insert Widget at top of Content
  const widget = document.createElement("div");
  widget.className = "widget";
  widget.innerHTML = `
    <h2>📅 Hoy es ${todayName}</h2>
    <div class="today-info">${message}</div>
  `;

  // Prepend to content (or handle in homeView)
  return widget.outerHTML;
}


function renderRulesInMenu() {
  // Always render to be safe
  sideMenuContent.innerHTML = "";


  const rulesHtml = (quickRules || [])
    .map((r, i) => {
      const bulletsList = (r.bullets || [])
        .map(b => `• ${esc(b)}`)
        .join("<br>");

      const delay = i * 150; // Slower stagger for drama
      return `
        <div class="menu-item" style="transition-delay: ${delay}ms">
          <h4 style="margin:0 0 0.5rem 0; color:var(--green); font-size:1.1rem;">${esc(r.title)}</h4>
          <div class="note" style="line-height:1.5;">${bulletsList}</div>
          <hr style="border:0; border-bottom:1px solid #f0f0f0; margin:1.2rem 0;">
        </div>
      `;
    })
    .join("");

  sideMenuContent.innerHTML = rulesHtml;
}

function homeView() {
  updateNavState("home");

  const widgetHtml = renderWidget();

  const faqHtml = (faq || [])
    .map(item => `
      <details class="faq">
        <summary>${esc(item.q)}</summary>
        <div class="note" style="margin-top:0.5rem;">${esc(item.a)}</div>
      </details>
    `)
    .join("");

  const credits = meta ? `
    <div class="card" style="margin-top: 2rem; opacity: 0.9;">
      <h3>Sobre la App</h3>
      <p class="note"><strong>${esc(meta.jurisdiction || "CDMX")}</strong></p>
      <p class="note">${esc(meta.source_primary || "")}</p>
      ${meta.notes ? `<p class="note"><em>${esc(meta.notes)}</em></p>` : ""}
    </div>
  ` : "";

  setHTML(`
    ${widgetHtml}

    <div style="text-align:center; margin-bottom: 2rem;">
       <button id="openRulesBtn" class="btn green" style="width:auto; display:inline-flex; padding: 0.8rem 2rem; border-radius: 50px;">
          📜 Ver Consejos y Reglas
       </button>
    </div>

    <div class="card spacer-block">
      <h3>Preguntas frecuentes</h3>
      ${faqHtml || "<p class='note'>—</p>"}
    </div>

    ${credits}
  `);

  document.getElementById("openRulesBtn")?.addEventListener("click", () => toggleMenu(true));
  observeCards(); // Re-trigger observer
}

// ---------- Intersection Observer ----------
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
    }
  });
}, { threshold: 0.1 });

function observeCards() {
  document.querySelectorAll('.card').forEach(c => cardObserver.observe(c));
}

// ---------- init ----------
async function initApp() {
  try {
    setHTML(`<p class="hint">Cargando base de datos…</p>`);

    const res = await fetch(DB_URL);
    if (!res.ok) throw new Error(`No se pudo cargar ${DB_URL} (HTTP ${res.status}).`);

    const data = await res.json();
    if (!data || !Array.isArray(data.categories)) {
      throw new Error("db.json no tiene el formato esperado: { categories: [...] }");
    }

    meta = data.metadata || data.meta || null;
    quickRules = Array.isArray(data.quick_rules) ? data.quick_rules : [];
    faq = Array.isArray(data.faq) ? data.faq : [];

    dbCategories = data.categories;

    flatItems = dbCategories.flatMap(cat => {
      const catMeta = {
        categoryId: cat.id,
        categoryLabel: cat.label,
        categoryColor: cat.color,
        collectionDays: Array.isArray(cat.collection_days) ? cat.collection_days : []
      };

      const items = Array.isArray(cat.items) ? cat.items : [];
      return items.map(item => ({
        name: item.name || "",
        search_terms: Array.isArray(item.search_terms) ? item.search_terms : [],
        examples: Array.isArray(item.examples) ? item.examples : [],
        notes: item.notes || "",
        ...catMeta
      }));
    });

    homeView();
  } catch (err) {
    console.error(err);
    setHTML(`
      <div class="error">
        <p><strong>Error cargando datos.</strong></p>
        <p>${esc(err.message)}</p>
        <p class="note">Verifica que <code>db.json</code> esté en el root junto a <code>index.html</code>.</p>
      </div>
    `);
  }
}

// ---------- render ----------
function createCard(item, index = 0) {
  const div = document.createElement("div");
  div.className = `card border-${item.categoryColor || "gris"}`;

  div.style.animationDelay = `${index * 0.05}s`;

  const examplesText = item.examples?.length ? esc(item.examples.join(", ")) : "—";
  const notesText = item.notes ? esc(item.notes) : "";
  const daysText = item.collectionDays?.length ? esc(item.collectionDays.join(" · ")) : "—";

  div.innerHTML = `
    <div class="card-header">
      <h3>${esc(item.name)}</h3>
      <span class="badge ${esc(item.categoryColor || "")}">${esc(item.categoryLabel || "")}</span>
    </div>
    <p><strong>Ejemplos:</strong> ${examplesText}</p>
    ${notesText ? `<p class="note">${notesText}</p>` : ""}
    <div class="days"><small>🗓️ ${daysText}</small></div>
  `;
  return div;
}

const AVATAR_EXPLANATIONS = {
  "organicos": "¡Hola! Aquí van residuos de origen natural que se descomponen. Úsalos para composta. 🌱",
  "reciclables": "Estos materiales pueden tener una segunda vida. ¡Recuerda entregarlos limpios, secos y aplastados! ♻️",
  "no_reciclables": "Residuos difíciles de reciclar o muy contaminados. Van directo al relleno sanitario o coprocesamiento. 🟠",
  "manejo_especial": "¡Cuidado! Estos objetos requieren un tratamiento especial por su tamaño o componentes. No los tires con lo demás. 🛋️"
};

function renderList(items) {
  content.innerHTML = "";

  // Show Avatar if rendering a specific category
  if (items.length > 0 && items[0].categoryId && AVATAR_EXPLANATIONS[items[0].categoryId]) {
    const catId = items[0].categoryId;
    const explanation = AVATAR_EXPLANATIONS[catId];

    // Trash Can Avatar HTML
    const avatarHtml = `
      <div class="avatar-container">
        <div class="avatar-face">🗑️</div>
        <div class="speech-bubble">
          <strong>Tip del Bote:</strong><br>
          ${explanation}
        </div>
      </div>
    `;
    // Insert simple string wrapper
    const wrapper = document.createElement("div");
    wrapper.innerHTML = avatarHtml;
    content.appendChild(wrapper);
  }

  if (!items || items.length === 0) {
    setHTML(`<p class="hint">No se encontraron resultados.</p>`);
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach((item, index) => frag.appendChild(createCard(item, index)));
  content.appendChild(frag);
  observeCards();
}

// ---------- acts ----------
function updateNavState(activeId) {
  document.querySelectorAll("nav button").forEach(btn => {
    const btnId = btn.dataset.cat;
    if (activeId === btnId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function filterByCategory(categoryId) {
  if (searchInput) searchInput.value = "";
  updateNavState(categoryId);

  if (categoryId === "home") { homeView(); return; }
  if (categoryId === "all") { renderList(flatItems); return; }

  const categoryData = dbCategories.find(c => c.id === categoryId);
  if (!categoryData) { setHTML(`<p class="hint">Categoría no encontrada.</p>`); return; }

  const items = (categoryData.items || []).map(item => ({
    name: item.name || "",
    examples: Array.isArray(item.examples) ? item.examples : [],
    notes: item.notes || "",
    categoryId: categoryData.id,
    categoryLabel: categoryData.label,
    categoryColor: categoryData.color,
    collectionDays: Array.isArray(categoryData.collection_days) ? categoryData.collection_days : []
  }));

  renderList(items);
}

function searchItems(term) {
  updateNavState(null);
  const q = normalize(term).trim();

  if (q.length === 0) { homeView(); return; }

  const results = flatItems.filter(item => {
    const hayName = normalize(item.name).includes(q);
    const hayExamples = item.examples?.some(ex => normalize(ex).includes(q));
    const hayTerms = item.search_terms?.some(t => normalize(t).includes(q));
    const hayNotes = normalize(item.notes).includes(q);
    return hayName || hayExamples || hayNotes || hayTerms;
  });

  renderList(results);
}

// ---------- listeners ----------
document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.id || btn.dataset.cat;
    if (!id) return;
    filterByCategory(id);
  });
});

if (searchInput) {
  searchInput.addEventListener("input", e => {
    const term = e.target.value || "";
    if (term.trim().length === 0) { homeView(); return; }
    searchItems(term);
  });
}

// Side Menu Listeners
closeMenuBtn?.addEventListener("click", () => toggleMenu(false));
sideMenuBackdrop?.addEventListener("click", () => toggleMenu(false));
appTitle?.addEventListener("click", () => homeView());

initApp();
