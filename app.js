/* ================================
   Basura CDMX — app.js (v1.2)
   - Root-ready (rutas absolutas)
   - Sin doble registro de SW (lo hace index.html)
   - Fix esc() chaining
   - Fetch compatible con SW cache
   ================================ */

const content = document.getElementById("content");
const searchInput = document.getElementById("searchInput");

// Root (más estable para PWA/TWA)
const DB_URL = "/db.json";

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

  // Fallback por si el motor no soporta \p{Diacritic}
  try {
    return base.replace(/\p{Diacritic}/gu, "");
  } catch {
    return base.replace(/[\u0300-\u036f]/g, "");
  }
}

function setHTML(html) {
  content.innerHTML = html;
}

function homeView() {
  const rulesHtml = (quickRules || [])
    .map(r => {
      const bulletsList = (r.bullets || [])
        .map(b => `• ${esc(b)}`)
        .join("<br>");

      return `
        <li style="margin-bottom: 1rem;">
          <strong>${esc(r.title)}</strong>
          <div class="note" style="margin-top: 0.4rem; padding-left: 0.5rem; line-height: 1.4;">
            ${bulletsList}
          </div>
        </li>
      `;
    })
    .join("");

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
      ${meta.disclaimer ? `<p class="note" style="margin-top:1rem; border-top:1px solid #ddd; padding-top:0.5rem; font-size:0.9em;">⚠️ ${esc(meta.disclaimer)}</p>` : ""}
    </div>
  ` : "";

  setHTML(`
    <div class="card">
      <h3>Reglas rápidas</h3>
      <ul class="rules" style="list-style: none; padding-left: 0;">
        ${rulesHtml || "<li>Cargando reglas...</li>"}
      </ul>
      <p class="note" style="margin-top:1rem; border-top:1px solid rgba(0,0,0,0.12); padding-top:0.6rem;">
        💡 <strong>Tip:</strong> si dudas, busca por material (ej. “tubo”, “laminado”, “hidrocoloide”, “filtro”).
      </p>
    </div>

    <div class="card">
      <h3>Preguntas frecuentes</h3>
      ${faqHtml || "<p class='note'>—</p>"}
    </div>

    ${credits}
  `);
}

// ---------- init ----------
async function initApp() {
  try {
    setHTML(`<p class="hint">Cargando base de datos…</p>`);

    // Importante: sin cache:"no-store" para no pelearte con el SW
    const res = await fetch(DB_URL);
    if (!res.ok) throw new Error(`No se pudo cargar ${DB_URL} (HTTP ${res.status}).`);

    const data = await res.json();
    if (!data || !Array.isArray(data.categories)) {
      throw new Error("db.json no tiene el formato esperado: { categories: [...] }");
    }

    meta = data.meta || null;
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
function createCard(item) {
  const div = document.createElement("div");
  div.className = `card border-${item.categoryColor || "gris"}`;

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

function renderList(items) {
  content.innerHTML = "";
  if (!items || items.length === 0) {
    setHTML(`<p class="hint">No se encontraron resultados.</p>`);
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach(item => frag.appendChild(createCard(item)));
  content.appendChild(frag);
}

// ---------- actions ----------
function filterByCategory(categoryId) {
  if (searchInput) searchInput.value = "";

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
  const q = normalize(term).trim();
  if (q.length < 2) return;

  const results = flatItems.filter(item => {
    const hayName = normalize(item.name).includes(q);
    const hayExamples = item.examples?.some(ex => normalize(ex).includes(q));
    const hayNotes = normalize(item.notes).includes(q);
    return hayName || hayExamples || hayNotes;
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

// Nota: NO registramos SW aquí. Se registra en index.html (root).
initApp();
