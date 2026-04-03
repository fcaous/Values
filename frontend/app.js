/* CSU VALUE LIST v2 — app.js | Made by Aousisgood1 */

const API = window.location.origin;

// ── State ──────────────────────────────────────────────────────────
let allPets       = [];
let filteredPets  = [];
let variantFilter = 'all';
let adminSession  = null;
let ownerPw       = '';
let ownerAuthed   = false;
let adminPets     = [];
let searchDebounce = null;

// ── AI State ───────────────────────────────────────────────────────
let aiUserId      = null;
let aiChats       = [];
let currentChatId = null;
let aiStreaming    = false;
let aiSidebarOpen = false;

// ── Settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  accentColor: 'blue', gridDensity: 'normal', sortOrder: 'oc_first',
  defaultVariant: 'all', showRate: true, showCat: true, showPower: true,
  showDemand: true, showLastEdited: false, animationsEnabled: true,
  compactAdminView: false, showValueOnHover: false,
};
let settings = { ...DEFAULT_SETTINGS };

const ACCENT_DARK = {
  blue:   { '--accent':'#4da6d8','--accent-med':'#62b8e6','--accent-light':'#80caef','--accent-dim':'rgba(77,166,216,.18)','--accent-pale':'rgba(77,166,216,.09)' },
  teal:   { '--accent':'#2ec4b6','--accent-med':'#3dd9ca','--accent-light':'#5ee8da','--accent-dim':'rgba(46,196,182,.18)','--accent-pale':'rgba(46,196,182,.09)' },
  purple: { '--accent':'#a78bfa','--accent-med':'#c4abfc','--accent-light':'#d8c5ff','--accent-dim':'rgba(167,139,250,.18)','--accent-pale':'rgba(167,139,250,.09)' },
  amber:  { '--accent':'#f0a832','--accent-med':'#f7c055','--accent-light':'#fbd07a','--accent-dim':'rgba(240,168,50,.18)','--accent-pale':'rgba(240,168,50,.09)' },
  rose:   { '--accent':'#f06080','--accent-med':'#f57d98','--accent-light':'#f8a0b3','--accent-dim':'rgba(240,96,128,.18)','--accent-pale':'rgba(240,96,128,.09)' },
};

const DEMAND_CONFIG = {
  'Very High': { color: '#ff4d4d', bg: 'rgba(255,77,77,.15)',   border: 'rgba(255,77,77,.35)',   icon: '🔥' },
  'High':      { color: '#ff8c00', bg: 'rgba(255,140,0,.15)',   border: 'rgba(255,140,0,.35)',   icon: '📈' },
  'Medium':    { color: '#f0c030', bg: 'rgba(240,192,48,.15)',  border: 'rgba(240,192,48,.35)',  icon: '➡️' },
  'Low':       { color: '#4da6d8', bg: 'rgba(77,166,216,.15)',  border: 'rgba(77,166,216,.35)',  icon: '📉' },
  'Very Low':  { color: '#566d85', bg: 'rgba(86,109,133,.15)',  border: 'rgba(86,109,133,.35)',  icon: '❄️' },
};

const THINKING_PHRASES = [
  'Thinking...', 'Analyzing pet values...', 'Checking the database...',
  'Calculating trade ratios...', 'Comparing demand levels...',
  'Looking up price history...', 'Evaluating rarity...',
  'Processing your question...', 'Crunching numbers...',
  'Assessing market trends...', 'Reviewing existence rates...',
  'Consulting the value list...', 'Almost there...',
];

try { const s = localStorage.getItem('vx_admin_session'); if (s) adminSession = JSON.parse(s); } catch {}

// ── AI User ID ─────────────────────────────────────────────────────
function getAiUserId() {
  if (aiUserId) return aiUserId;
  let id = localStorage.getItem('csu_ai_user_id');
  if (!id) {
    id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('csu_ai_user_id', id);
  }
  aiUserId = id;
  return id;
}

// ══════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════
function loadSettings() {
  try {
    const s = localStorage.getItem('csu_settings');
    if (s) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch {}
}
function saveSettings() {
  const g = id => document.getElementById(id);
  if (g('set-sort'))        settings.sortOrder        = g('set-sort').value;
  if (g('set-variant'))     settings.defaultVariant   = g('set-variant').value;
  if (g('set-showrate'))    settings.showRate         = g('set-showrate').checked;
  if (g('set-showcat'))     settings.showCat          = g('set-showcat').checked;
  if (g('set-showpower'))   settings.showPower        = g('set-showpower').checked;
  if (g('set-showdemand'))  settings.showDemand       = g('set-showdemand').checked;
  if (g('set-showedited'))  settings.showLastEdited   = g('set-showedited').checked;
  if (g('set-animations'))  settings.animationsEnabled = g('set-animations').checked;
  if (g('set-compactadmin'))settings.compactAdminView = g('set-compactadmin').checked;
  if (g('set-hoverval'))    settings.showValueOnHover = g('set-hoverval').checked;
  try { localStorage.setItem('csu_settings', JSON.stringify(settings)); } catch {}
  renderPetGrid();
}
function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  settings = { ...DEFAULT_SETTINGS };
  try { localStorage.removeItem('csu_settings'); } catch {}
  applySettingsToUI(); applyDensity('normal'); applyAccentColor('blue'); renderPetGrid();
  toast('Settings reset');
}
function applySettingsToUI() {
  const g = id => document.getElementById(id);
  if (g('set-density'))     g('set-density').value       = settings.gridDensity;
  if (g('set-sort'))        g('set-sort').value          = settings.sortOrder;
  if (g('set-variant'))     g('set-variant').value       = settings.defaultVariant;
  if (g('set-showrate'))    g('set-showrate').checked    = settings.showRate;
  if (g('set-showcat'))     g('set-showcat').checked     = settings.showCat;
  if (g('set-showpower'))   g('set-showpower').checked   = settings.showPower;
  if (g('set-showdemand'))  g('set-showdemand').checked  = settings.showDemand;
  if (g('set-showedited'))  g('set-showedited').checked  = settings.showLastEdited;
  if (g('set-animations'))  g('set-animations').checked  = settings.animationsEnabled;
  if (g('set-compactadmin'))g('set-compactadmin').checked= settings.compactAdminView;
  if (g('set-hoverval'))    g('set-hoverval').checked    = settings.showValueOnHover;
  if (g('sort-filter'))     g('sort-filter').value       = settings.sortOrder;
  document.querySelectorAll('.accent-swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.accent === settings.accentColor));
  const nv = g('nav-version'), vd = g('settings-ver-display');
  if (nv && vd) vd.textContent = nv.textContent;
}
function applyDensity(val) {
  settings.gridDensity = val;
  document.body.classList.remove('density-compact', 'density-normal', 'density-spacious');
  document.body.classList.add('density-' + val);
  const el = document.getElementById('set-density');
  if (el) el.value = val;
  try { localStorage.setItem('csu_settings', JSON.stringify(settings)); } catch {}
}
function applyAccentColor(color) {
  settings.accentColor = color;
  const preset = ACCENT_DARK[color];
  if (!preset) return;
  Object.entries(preset).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  document.querySelectorAll('.accent-swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.accent === color));
  try { localStorage.setItem('csu_settings', JSON.stringify(settings)); } catch {}
}
function setAccent(color) { applyAccentColor(color); }

// ══════════════════════════════════════════════════════════════════
//  FAVORITES
// ══════════════════════════════════════════════════════════════════
function getFavs() {
  try { return new Set(JSON.parse(localStorage.getItem('csu_favs') || '[]')); } catch { return new Set(); }
}
function saveFavs(set) {
  try { localStorage.setItem('csu_favs', JSON.stringify([...set])); } catch {}
}
function isFav(id) { return getFavs().has(id); }
function toggleFav(id, e) {
  e?.stopPropagation();
  const favs = getFavs();
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  saveFavs(favs); applyVariantFilter(); updateFavCount();
  toast(favs.has(id) ? '⭐ Added to favorites' : 'Removed from favorites');
}
function updateFavCount() {
  const el = document.getElementById('ft-fav-count');
  const c = getFavs().size;
  if (el) el.textContent = c > 0 ? ' ' + c : '';
}

// ══════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════
function isOC(v) {
  if (v === null || v === undefined || v === '') return false;
  const s = String(v).toLowerCase().trim();
  return s === 'o/c' || s === 'oc' || s.startsWith('o/c');
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function fmtNum(n) {
  n = parseFloat(n) || 0;
  if (n >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,'') + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(1);
}
function fmtVal(v) {
  if (isOC(v)) return 'O/C';
  const n = parseFloat(v);
  if (!isNaN(n)) return fmtNum(n);
  return String(v || '—');
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 60000)     return 'just now';
  if (diff < 3600000)   return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000)  return Math.floor(diff/3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff/86400000) + 'd ago';
  return d.toLocaleDateString([], { month:'short', day:'numeric' });
}
function todayISO() { return new Date().toISOString().slice(0, 16); }

async function apiFetch(method, path, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok && data.error) throw new Error(data.error);
  return data;
}
async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); toast('📋 Copied!'); }
  catch { toast('⚠ Could not copy'); }
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.style.display = 'block'; el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; }, 300);
  }, 2400);
}
function showModal(html) {
  const bg = document.getElementById('modal-bg'), box = document.getElementById('modal-box');
  if (!bg || !box) return;
  box.innerHTML = html; bg.classList.add('open');
}
function closeModal() { document.getElementById('modal-bg')?.classList.remove('open'); }
function toggleMobileNav() {
  document.getElementById('mobile-nav-overlay')?.classList.toggle('open');
  document.getElementById('nav-hamburger')?.classList.toggle('open');
}
function closeMobileNav() {
  document.getElementById('mobile-nav-overlay')?.classList.remove('open');
  document.getElementById('nav-hamburger')?.classList.remove('open');
}

// ══════════════════════════════════════════════════════════════════
//  DEMAND HELPERS
// ══════════════════════════════════════════════════════════════════
function demandBadgeHTML(demand, size) {
  if (!demand) return '';
  const cfg = DEMAND_CONFIG[demand] || { color:'#8a9db5', bg:'rgba(138,157,181,.15)', border:'rgba(138,157,181,.35)', icon:'❓' };
  const cls = size === 'lg' ? 'demand-badge demand-badge-lg' : 'demand-badge';
  return `<span class="${cls}" style="color:${cfg.color};background:${cfg.bg};border-color:${cfg.border};">${cfg.icon} ${esc(demand)}</span>`;
}

// ══════════════════════════════════════════════════════════════════
//  LINE CHART
// ══════════════════════════════════════════════════════════════════
function buildChartSVG(points, width, height) {
  width  = width  || 520;
  height = height || 240;

  const validPoints = points
    .filter(p => !isNaN(parseFloat(p.token_value)))
    .map(p => ({ ...p, num: parseFloat(p.token_value), date: new Date(p.recorded_at) }))
    .sort((a, b) => a.date - b.date);

  if (validPoints.length === 0)
    return '<div class="chart-empty">No numeric data points yet</div>';
  if (validPoints.length === 1)
    return '<div class="chart-empty">Add at least 2 points to show a chart — current: ' + fmtVal(validPoints[0].token_value) + '</div>';

  const pad = { top: 32, right: 30, bottom: 48, left: 70 };
  const w   = width  - pad.left - pad.right;
  const h   = height - pad.top  - pad.bottom;

  const nums    = validPoints.map(p => p.num);
  const minVal  = Math.min(...nums);
  const maxVal  = Math.max(...nums);
  const padding = (maxVal - minVal) * 0.12 || maxVal * 0.1 || 100;
  const lo      = minVal - padding;
  const hi      = maxVal + padding;
  const valRange = hi - lo || 1;

  const minDate  = validPoints[0].date.getTime();
  const maxDate  = validPoints[validPoints.length - 1].date.getTime();
  const dateRange = maxDate - minDate || 1;
  const spanDays  = (maxDate - minDate) / 86400000;

  const px = d  => pad.left + ((d.getTime() - minDate) / dateRange) * w;
  const py = n  => pad.top  + (1 - (n - lo) / valRange) * h;

  // ── Smooth bezier path ──────────────────────────────────────────
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${px(pts[0].date).toFixed(2)},${py(pts[0].num).toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], curr = pts[i];
      const cpx1 = (px(prev.date) + px(curr.date)) / 2;
      const cpy1 = py(prev.num);
      const cpx2 = (px(prev.date) + px(curr.date)) / 2;
      const cpy2 = py(curr.num);
      d += ` C ${cpx1.toFixed(2)},${cpy1.toFixed(2)} ${cpx2.toFixed(2)},${cpy2.toFixed(2)} ${px(curr.date).toFixed(2)},${py(curr.num).toFixed(2)}`;
    }
    return d;
  }

  const linePath = smoothPath(validPoints);
  const lastPt   = validPoints[validPoints.length - 1];
  const areaPath = linePath +
    ` L ${px(lastPt.date).toFixed(2)},${(pad.top + h).toFixed(2)}` +
    ` L ${pad.left},${(pad.top + h).toFixed(2)} Z`;

  // ── Y Grid + labels (5 ticks) ───────────────────────────────────
  const gradId = 'cg' + Math.random().toString(36).slice(2, 7);
  let yHTML = '';
  for (let i = 0; i <= 4; i++) {
    const v    = lo + (valRange * i / 4);
    const yPos = py(v).toFixed(2);
    yHTML += `<line x1="${pad.left}" y1="${yPos}" x2="${pad.left + w}" y2="${yPos}"
      stroke="rgba(255,255,255,0.04)" stroke-width="1" stroke-dasharray="5,4"/>`;
    yHTML += `<text x="${pad.left - 8}" y="${(parseFloat(yPos) + 4).toFixed(1)}"
      text-anchor="end" fill="#4a6380" font-size="10.5"
      font-family="'Share Tech Mono',monospace">${fmtVal(v)}</text>`;
  }

  // ── X labels (max 6) ────────────────────────────────────────────
  let xHTML = '';
  const step = Math.max(1, Math.ceil(validPoints.length / 6));
  validPoints.forEach((p, i) => {
    if (i % step !== 0 && i !== validPoints.length - 1) return;
    const xPos = px(p.date).toFixed(2);
    let label;
    if (spanDays < 1)       label = p.date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    else if (spanDays < 60) label = p.date.toLocaleDateString([], { month:'short', day:'numeric' });
    else                    label = p.date.toLocaleDateString([], { month:'short', year:'2-digit' });
    xHTML += `<text x="${xPos}" y="${(pad.top + h + 20).toFixed(1)}" text-anchor="middle"
      fill="#4a6380" font-size="10.5" font-family="'Share Tech Mono',monospace">${label}</text>`;
  });

  // ── Dots ────────────────────────────────────────────────────────
  let dotsHTML = '';
  validPoints.forEach((p, i) => {
    const cx = px(p.date).toFixed(2), cy = py(p.num).toFixed(2);
    const tipDate  = p.date.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' });
    const tipLabel = p.label ? ` · ${p.label}` : '';
    const isLast   = i === validPoints.length - 1;
    dotsHTML += `
      <circle cx="${cx}" cy="${cy}" r="${isLast ? 6 : 5}"
        fill="${isLast ? 'var(--accent)' : 'var(--card)'}"
        stroke="var(--accent)" stroke-width="${isLast ? 2.5 : 2.5}" class="chart-dot">
        <title>${fmtVal(p.token_value)} tokens — ${tipDate}${tipLabel}</title>
      </circle>`;
    if (isLast) {
      dotsHTML += `<circle cx="${cx}" cy="${cy}" r="12"
        fill="var(--accent)" opacity="0.12" class="chart-dot-pulse"/>`;
    }
  });

  // ── Latest value label ──────────────────────────────────────────
  const lx = parseFloat(px(lastPt.date).toFixed(2));
  const ly = parseFloat(py(lastPt.num).toFixed(2));
  const labelAnchor = lx + 60 > pad.left + w ? 'end' : 'start';
  const labelOffset = labelAnchor === 'end' ? -10 : 10;
  const labelHTML = `<text x="${(lx + labelOffset).toFixed(1)}" y="${(ly - 11).toFixed(1)}"
    text-anchor="${labelAnchor}" fill="var(--accent)" font-size="12"
    font-family="'Share Tech Mono',monospace" font-weight="700">${fmtVal(lastPt.token_value)}</text>`;

  // ── Trend indicator ─────────────────────────────────────────────
  let trendHTML = '';
  if (validPoints.length >= 2) {
    const first = validPoints[0].num, last = lastPt.num;
    const pct   = ((last - first) / (first || 1) * 100).toFixed(1);
    const up    = last >= first;
    const color = up ? '#34d399' : '#f87171';
    const arrow = up ? '▲' : '▼';
    trendHTML = `<text x="${pad.left + w}" y="${pad.top - 12}" text-anchor="end"
      fill="${color}" font-size="11" font-family="'Share Tech Mono',monospace">
      ${arrow} ${Math.abs(pct)}%</text>`;
  }

  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg"
    xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${height}px;display:block;">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.35"/>
        <stop offset="75%"  stop-color="var(--accent)" stop-opacity="0.07"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.00"/>
      </linearGradient>
      <filter id="glow-${gradId}">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    ${trendHTML}
    ${yHTML}

    <!-- Axes -->
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + h}"
      stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <line x1="${pad.left}" y1="${pad.top + h}" x2="${pad.left + w}" y2="${pad.top + h}"
      stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

    <!-- Area fill -->
    <path d="${areaPath}" fill="url(#${gradId})"/>

    <!-- Line (shadow) -->
    <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="4"
      stroke-linejoin="round" stroke-linecap="round" opacity="0.18"/>

    <!-- Line (main) -->
    <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.5"
      stroke-linejoin="round" stroke-linecap="round"
      filter="url(#glow-${gradId})"/>

    ${xHTML}
    ${labelHTML}
    ${dotsHTML}
  </svg>`;
}

// ══════════════════════════════════════════════════════════════════
//  PAGE ROUTER
// ══════════════════════════════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const pg = document.getElementById('page-' + id); if (pg) pg.classList.add('active');
  const nl = document.getElementById('nl-'   + id); if (nl) nl.classList.add('active');
  window.scrollTo(0, 0); closeModal();
  if (id === 'credits')  loadCredits();
  if (id === 'admin')    initAdmin();
  if (id === 'owner')    initOwner();
  if (id === 'settings') applySettingsToUI();
  if (id === 'ai')       initAiPage();
}

// ══════════════════════════════════════════════════════════════════
//  STATUS
// ══════════════════════════════════════════════════════════════════
async function checkStatus() {
  try {
    const data = await apiFetch('GET', '/api/status');
    document.getElementById('status-pill')?.classList.add('online');
    document.getElementById('status-pill-mobile')?.classList.add('online');
    setEl('status-text', 'ONLINE'); setEl('mob-status-text', 'ONLINE');
    if (data.version) setEl('nav-version', 'v' + data.version);
  } catch {
    setEl('status-text', 'OFFLINE'); setEl('mob-status-text', 'OFFLINE');
  }
}

// ══════════════════════════════════════════════════════════════════
//  PETS
// ══════════════════════════════════════════════════════════════════
async function loadPets() {
  const search = val('search-input'), category = document.getElementById('cat-filter')?.value || '';
  try {
    let q = '/api/pets?';
    if (search)   q += 'search='   + encodeURIComponent(search)   + '&';
    if (category) q += 'category=' + encodeURIComponent(category) + '&';
    allPets = await apiFetch('GET', q);
    setEl('pet-counter', allPets.length + ' pets');
    setEl('pet-counter-mobile', allPets.length + ' pets');
    updateFavCount(); applyVariantFilter();
  } catch (e) {
    const g = document.getElementById('pet-grid');
    if (g) g.innerHTML = '<div class="grid-loading">Failed to load pets: ' + esc(e.message) + '</div>';
  }
}
function getSortOrder() { return document.getElementById('sort-filter')?.value || settings.sortOrder || 'oc_first'; }
function onSortChange() {
  settings.sortOrder = getSortOrder();
  try { localStorage.setItem('csu_settings', JSON.stringify(settings)); } catch {}
  applyVariantFilter();
}
function sortPets(list) {
  const order = getSortOrder(), copy = [...list];
  const getRaw = p => variantFilter === 'gold' ? p.gold_value : variantFilter === 'rainbow' ? p.rainbow_value : p.normal_value;
  const getNum = p => parseFloat(getRaw(p)) || 0;
  const ocPets = copy.filter(p =>  isOC(getRaw(p)));
  const nonOC  = copy.filter(p => !isOC(getRaw(p)));
  ocPets.sort((a, b) => a.name.localeCompare(b.name));
  if (order === 'oc_first' || order === 'expensive') nonOC.sort((a, b) => getNum(b) - getNum(a));
  else if (order === 'cheap') nonOC.sort((a, b) => getNum(a) - getNum(b));
  else if (order === 'az')    nonOC.sort((a, b) => a.name.localeCompare(b.name));
  else if (order === 'za')    nonOC.sort((a, b) => b.name.localeCompare(a.name));
  return [...ocPets, ...nonOC];
}
function applyVariantFilter() {
  const favs = getFavs();
  if      (variantFilter === 'fav')     filteredPets = allPets.filter(p => favs.has(p.id));
  else if (variantFilter === 'gold')    filteredPets = allPets.filter(p => p.has_gold);
  else if (variantFilter === 'rainbow') filteredPets = allPets.filter(p => p.has_rainbow);
  else                                  filteredPets = allPets;
  filteredPets = sortPets(filteredPets);
  setEl('result-count', filteredPets.length + ' result' + (filteredPets.length !== 1 ? 's' : ''));
  renderPetGrid();
}
function setVariantFilter(f) {
  variantFilter = f;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  const map = { all:'ft-all', gold:'ft-gold', rainbow:'ft-rainbow', fav:'ft-fav' };
  document.getElementById(map[f])?.classList.add('active');
  applyVariantFilter();
}

function renderPetGrid() {
  const grid = document.getElementById('pet-grid');
  if (!grid) return;
  if (variantFilter === 'fav' && !filteredPets.length) {
    grid.innerHTML = '<div class="no-results">No favorites yet — star a pet to save it ⭐</div>'; return;
  }
  if (!filteredPets.length) { grid.innerHTML = '<div class="no-results">No pets found 🔍</div>'; return; }

  const showRate   = document.getElementById('set-showrate')?.checked   ?? settings.showRate;
  const showCat    = document.getElementById('set-showcat')?.checked    ?? settings.showCat;
  const showPower  = document.getElementById('set-showpower')?.checked  ?? settings.showPower;
  const showDemand = document.getElementById('set-showdemand')?.checked ?? settings.showDemand;
  const showEdited = document.getElementById('set-showedited')?.checked ?? settings.showLastEdited;
  const favs       = getFavs();

  grid.innerHTML = '';
  filteredPets.forEach(pet => {
    const rawVal = variantFilter === 'gold' ? pet.gold_value : variantFilter === 'rainbow' ? pet.rainbow_value : pet.normal_value;
    const faved  = favs.has(pet.id);
    const oc     = isOC(rawVal);
    const imgContent = pet.image_url
      ? `<img src="${esc(pet.image_url)}" alt="${esc(pet.name)}" onerror="this.parentElement.innerHTML='🐾'"/>`
      : '🐾';
    const demandCfg = pet.demand ? (DEMAND_CONFIG[pet.demand] || null) : null;

    const card = document.createElement('div');
    card.className = 'pet-card' + (oc ? ' is-oc' : '') + (faved ? ' is-fav' : '');
    card.onclick = () => openPetModal(pet);
    card.innerHTML =
      `<div class="pet-card-img">${imgContent}</div>` +
      (showCat ? `<div class="pet-cat-tag">${esc(pet.category || 'standard')}</div>` : '') +
      `<button class="pet-fav-btn" onclick="toggleFav('${esc(pet.id)}',event)">${faved ? '⭐' : '☆'}</button>` +
      `<div class="pet-card-body">` +
        `<div class="pet-card-name">${esc(pet.name)}</div>` +
        (showRate && pet.existence_rate ? `<div class="pet-card-rate">${esc(pet.existence_rate)}</div>` : '') +
        `<div class="pet-card-value${oc ? ' oc-val' : ''}">` +
          (oc ? '👑 ' : '') + fmtVal(rawVal) +
          (oc ? '' : '<span class="val-unit">tokens</span>') +
        `</div>` +
        `<div class="pet-card-meta-row">` +
          (showPower  && pet.pet_power ? `<div class="pet-card-power">⚡ ${esc(String(pet.pet_power))}</div>` : '') +
          (showDemand && demandCfg     ?
            `<div class="pet-card-demand" style="color:${demandCfg.color};background:${demandCfg.bg};border-color:${demandCfg.border};">` +
            `${demandCfg.icon} ${esc(pet.demand)}</div>` : '') +
        `</div>` +
        (showEdited && pet.updated_at ? `<div class="pet-last-edited">✎ ${fmtDateShort(pet.updated_at)}</div>` : '') +
        `<div class="pet-variants">` +
          (oc ? '<span class="pv-badge oc">O/C</span>' : '') +
          (!oc && pet.has_gold    ? '<span class="pv-badge gold">GOLD</span>'    : '') +
          (!oc && pet.has_rainbow ? '<span class="pv-badge rainbow">RAINBOW</span>' : '') +
        `</div>` +
      `</div>`;
    grid.appendChild(card);
  });
}

function onSearch() {
  const input = document.getElementById('search-input'), clear = document.getElementById('search-clear');
  if (clear) clear.style.display = input?.value ? 'block' : 'none';
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadPets, 250);
}
function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  const clear = document.getElementById('search-clear');
  if (clear) clear.style.display = 'none';
  loadPets();
}

// ══════════════════════════════════════════════════════════════════
//  PET MODAL
// ══════════════════════════════════════════════════════════════════
function openPetModal(pet) {
  window._modalPet = pet;
  const nv = pet.normal_value, gv = pet.gold_value, rv = pet.rainbow_value;
  const nvNum = parseFloat(nv)||0, gvNum = parseFloat(gv)||0, rvNum = parseFloat(rv)||0;
  const goldMult = nvNum > 0 && pet.has_gold    && !isOC(gv) ? (gvNum/nvNum).toFixed(1)+'x' : null;
  const rbMult   = nvNum > 0 && pet.has_rainbow && !isOC(rv) ? (rvNum/nvNum).toFixed(1)+'x' : null;
  const faved    = getFavs().has(pet.id);
  const demandHTML = pet.demand ? demandBadgeHTML(pet.demand, 'lg') : '';
  const imgHtml  = pet.image_url
    ? `<img src="${esc(pet.image_url)}" alt="${esc(pet.name)}" onerror="this.style.display='none'"/>`
    : '<span style="font-size:5rem;">🐾</span>';

  const statCard = (cls, icon, label, v, mult, locked) => {
    const oc = isOC(v);
    return `<div class="stat-card ${cls}${locked?' locked':''}">` +
      `<span class="stat-icon">${icon}</span>` +
      `<span class="stat-variant-name">${label}</span>` +
      (locked
        ? '<span class="stat-value" style="font-size:.9rem;">N/A</span><span class="stat-unavail">no variant</span>'
        : oc
          ? '<span class="stat-value oc-stat-val">👑 O/C</span><span class="stat-unit">owner\'s choice</span>'
          : `<span class="stat-value">${fmtVal(v)}</span><span class="stat-unit">tokens</span>` +
            (mult ? `<span class="stat-multiplier">${mult}</span>` : '')) +
      `</div>`;
  };

  showModal(
    `<button class="modal-close" onclick="closeModal()">✕</button>
    <div class="pet-modal-img">${imgHtml}</div>
    <div class="pet-modal-body">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.3rem;">
        <div class="pet-modal-name">${esc(pet.name)}</div>
        <button class="modal-fav-btn" id="modal-fav-toggle" onclick="toggleFavModal('${esc(pet.id)}')">
          ${faved ? '⭐ Saved' : '☆ Save'}
        </button>
      </div>
      <div class="pet-modal-cat">${esc(pet.category || 'Standard')}</div>
      <div class="pet-modal-info-grid">
        <div class="pet-modal-rate">
          <span class="rate-label">EXISTENCE RATE</span>
          <span class="rate-value">${esc(pet.existence_rate || 'Unknown')}</span>
        </div>
        ${pet.demand ? `<div class="pet-modal-rate">${demandHTML}</div>` : ''}
      </div>
      <div class="pet-modal-info-grid">
        ${pet.pet_power ? `<div class="pet-modal-rate"><span class="rate-label">⚡ PET POWER</span><span class="rate-value" style="color:var(--gold);">${esc(String(pet.pet_power))}</span></div>` : ''}
        ${pet.updated_at ? `<div class="pet-modal-rate"><span class="rate-label">✎ LAST EDITED</span><span class="rate-value" style="font-size:.75rem;">${fmtDate(pet.updated_at)}</span></div>` : ''}
      </div>
      <div class="pet-stats-section">
        <div class="pet-stats-label-row">
          <span class="pet-stats-label">Variant Values</span>
          <button class="copy-val-btn" onclick="copyToClipboard('${fmtVal(nv)}${isOC(nv)?'':' tokens'}')">📋 Copy</button>
        </div>
        <div class="stats-grid">
          ${statCard('s-normal',  '🔵', 'NORMAL',  nv, null,    false)}
          ${statCard('s-gold',    '⭐', 'GOLD',    gv, goldMult, !pet.has_gold)}
          ${statCard('s-rainbow', '🌈', 'RAINBOW', rv, rbMult,   !pet.has_rainbow)}
        </div>
      </div>
      ${pet.notes ? `<div class="pet-modal-notes">📝 ${esc(pet.notes)}</div>` : ''}
      <div class="modal-action-row">
        <button class="modal-add-calc" onclick="askAiAboutPet(window._modalPet)">✦ Ask AI</button>
        <button class="modal-chart-btn" onclick="toggleModalChart('${esc(pet.id)}')">📈 Price History</button>
      </div>
      <div id="modal-chart-section" style="display:none;margin-top:1rem;">
        <div id="modal-chart-content"><div class="chart-loading">Loading chart...</div></div>
      </div>
    </div>`
  );
}

function toggleFavModal(id) {
  const favs = getFavs();
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  saveFavs(favs); updateFavCount();
  const btn = document.getElementById('modal-fav-toggle');
  if (btn) btn.textContent = favs.has(id) ? '⭐ Saved' : '☆ Save';
  applyVariantFilter();
}

async function toggleModalChart(petId) {
  const section = document.getElementById('modal-chart-section');
  const content = document.getElementById('modal-chart-content');
  const btn     = document.querySelector('.modal-chart-btn');
  if (!section) return;
  if (section.style.display !== 'none') {
    section.style.display = 'none';
    if (btn) btn.textContent = '📈 Price History';
    return;
  }
  section.style.display = 'block';
  if (btn) btn.textContent = '📉 Hide Chart';
  content.innerHTML = '<div class="chart-loading">Loading price history...</div>';
  try {
    const history = await apiFetch('GET', '/api/pets/' + encodeURIComponent(petId) + '/history');
    if (!history.length) {
      content.innerHTML = '<div class="chart-empty">No price history added yet.</div>'; return;
    }
    const numericCount = history.filter(p => !isNaN(parseFloat(p.token_value))).length;
    content.innerHTML =
      `<div class="chart-header">
        <span class="chart-title">Price History <span class="chart-point-count">${history.length} point${history.length!==1?'s':''}</span></span>
        <span class="chart-range">${history.length >= 2 ? getChartRange(history) : ''}</span>
      </div>` +
      (numericCount < 2
        ? '<div class="chart-empty">Need at least 2 numeric points to draw the chart.</div>'
        : buildChartSVG(history)) +
      '<div class="chart-points-list">' +
      history.map(p =>
        `<div class="chart-point-row">
          <span class="cpr-date">${new Date(p.recorded_at).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}</span>
          <span class="cpr-val${isOC(p.token_value)?' oc-text':''}">${isOC(p.token_value)?'👑 ':''}${fmtVal(p.token_value)}${isOC(p.token_value)?'':' T'}</span>
          ${p.label ? `<span class="cpr-label">${esc(p.label)}</span>` : ''}
        </div>`
      ).join('') +
      '</div>';
  } catch (e) {
    content.innerHTML = `<div class="chart-empty" style="color:var(--danger);">Failed: ${esc(e.message)}</div>`;
  }
}

function getChartRange(history) {
  const dates = history.map(p => new Date(p.recorded_at)).sort((a,b) => a - b);
  const spanDays = (dates[dates.length-1] - dates[0]) / 86400000;
  if (spanDays < 1)  return 'Past 24h';
  if (spanDays < 7)  return 'Past ' + Math.ceil(spanDays) + ' days';
  if (spanDays < 60) return Math.ceil(spanDays/7) + ' weeks';
  return Math.ceil(spanDays/30) + ' months';
}

// Ask AI about a pet (shortcut from pet modal)
function askAiAboutPet(pet) {
  closeModal();
  showPage('ai');
  setTimeout(async () => {
    if (!currentChatId) await newAiChat();
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `What is the value of ${pet.name}? Is it a good deal at ${fmtVal(pet.normal_value)} tokens?`;
      autoResizeAiInput(input);
      sendAiMessage();
    }
  }, 200);
}

// ══════════════════════════════════════════════════════════════════
//  CREDITS
// ══════════════════════════════════════════════════════════════════
async function loadCredits() {
  const grid = document.getElementById('credits-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="grid-loading">Loading...</div>';
  try {
    const data = await apiFetch('GET', '/api/credits');
    if (!data.length) {
      grid.innerHTML = '<div class="grid-loading" style="padding:2rem;">No credits added yet</div>'; return;
    }
    grid.innerHTML = '';
    data.forEach(c => {
      const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const card = document.createElement('div'); card.className = 'credit-card';
      card.innerHTML =
        `<div class="credit-avatar">${esc(initials)}</div>` +
        `<div class="credit-name">${esc(c.name)}</div>` +
        (c.role    ? `<div class="credit-role">${esc(c.role)}</div>`       : '') +
        (c.discord ? `<div class="credit-discord">${esc(c.discord)}</div>` : '');
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = `<div class="grid-loading">Failed: ${esc(e.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════
//  AI PAGE
// ══════════════════════════════════════════════════════════════════
function initAiPage() {
  getAiUserId();
  loadAiChats();
  if (!currentChatId) renderAiWelcome();
}

function renderAiWelcome() {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  msgs.innerHTML = `
    <div class="ai-welcome">
      <div class="ai-welcome-icon">✦</div>
      <h2 class="ai-welcome-title">CSU AI Assistant</h2>
      <p class="ai-welcome-sub">Ask me anything about pet values, trades, demand, or price history.<br/>I have access to the full live pet database.</p>
      <div class="ai-welcome-chips">
        <button class="ai-chip" onclick="chipPrompt('What are the most valuable pets right now?')">💰 Most valuable pets</button>
        <button class="ai-chip" onclick="chipPrompt('Which pets have the highest demand?')">🔥 Highest demand</button>
        <button class="ai-chip" onclick="chipPrompt('Is trading a Gold pet worth it compared to Normal?')">⭐ Gold vs Normal</button>
        <button class="ai-chip" onclick="chipPrompt('What are the rarest pets in the game?')">💎 Rarest pets</button>
      </div>
    </div>`;
}

async function chipPrompt(text) {
  const input = document.getElementById('ai-input');
  if (input) { input.value = text; autoResizeAiInput(input); }
  if (!currentChatId) await newAiChat();
  sendAiMessage();
}

async function loadAiChats() {
  const listEl = document.getElementById('ai-chat-list');
  if (!listEl) return;
  try {
    aiChats = await apiFetch('GET', '/api/ai/chats/' + getAiUserId());
    renderAiChatList();
  } catch {
    listEl.innerHTML = '<div class="ai-chat-empty">Could not load chats</div>';
  }
}

function renderAiChatList() {
  const listEl = document.getElementById('ai-chat-list');
  if (!listEl) return;
  if (!aiChats.length) { listEl.innerHTML = '<div class="ai-chat-empty">No chats yet</div>'; return; }
  listEl.innerHTML = '';
  aiChats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'ai-chat-item' + (chat.id === currentChatId ? ' active' : '');
    item.dataset.id = chat.id;
    item.innerHTML =
      `<span class="ai-chat-item-title">${esc(chat.title || 'New Chat')}</span>` +
      `<span class="ai-chat-item-time">${fmtDateShort(chat.updated_at)}</span>` +
      `<button class="ai-chat-del-btn" onclick="deleteAiChat('${chat.id}',event)" title="Delete">✕</button>`;
    item.onclick = (e) => { if (!e.target.classList.contains('ai-chat-del-btn')) loadAiChat(chat.id); };
    listEl.appendChild(item);
  });
}

async function newAiChat() {
  const id     = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const userId = getAiUserId();
  try {
    await apiFetch('POST', '/api/ai/chats', { id, user_id: userId, title: 'New Chat' });
    currentChatId = id;
    aiChats.unshift({ id, title: 'New Chat', updated_at: new Date().toISOString() });
    renderAiChatList();
    renderAiWelcome();
    const msgs = document.getElementById('ai-messages');
    if (msgs) msgs.scrollTop = 0;
    closeMobileAiSidebar();
    // focus input
    setTimeout(() => document.getElementById('ai-input')?.focus(), 100);
  } catch (e) { toast('⚠ Could not create chat: ' + e.message); }
}

async function loadAiChat(chatId) {
  currentChatId = chatId;
  renderAiChatList();
  closeMobileAiSidebar();
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  msgs.innerHTML = '<div class="ai-loading-msgs"><div class="ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  try {
    const history = await apiFetch('GET', '/api/ai/chat/' + encodeURIComponent(chatId) + '/messages');
    msgs.innerHTML = '';
    if (!history.length) { renderAiWelcome(); return; }
    history.forEach(m => appendAiMessage(m.role, m.content, false));
    msgs.scrollTop = msgs.scrollHeight;
  } catch (e) {
    msgs.innerHTML = `<div class="ai-error-msg">Failed to load: ${esc(e.message)}</div>`;
  }
}

async function deleteAiChat(chatId, e) {
  e?.stopPropagation();
  if (!confirm('Delete this chat?')) return;
  try {
    await apiFetch('DELETE', '/api/ai/chat/' + encodeURIComponent(chatId));
    aiChats = aiChats.filter(c => c.id !== chatId);
    if (currentChatId === chatId) {
      currentChatId = null;
      renderAiWelcome();
    }
    renderAiChatList();
    toast('Chat deleted');
  } catch (e) { toast('⚠ ' + e.message); }
}

async function clearAllAiChats() {
  if (!confirm('Delete all your AI chat history? This cannot be undone.')) return;
  const userId = getAiUserId();
  let deleted = 0;
  for (const chat of [...aiChats]) {
    try { await apiFetch('DELETE', '/api/ai/chat/' + encodeURIComponent(chat.id)); deleted++; } catch {}
  }
  aiChats = []; currentChatId = null;
  renderAiChatList(); renderAiWelcome();
  toast(`✔ Deleted ${deleted} chat${deleted !== 1 ? 's' : ''}`);
}

function toggleAiSidebar() {
  const sidebar = document.getElementById('ai-sidebar');
  if (!sidebar) return;
  aiSidebarOpen = !aiSidebarOpen;
  sidebar.classList.toggle('open', aiSidebarOpen);
}
function closeMobileAiSidebar() {
  const sidebar = document.getElementById('ai-sidebar');
  if (window.innerWidth <= 768 && sidebar) {
    sidebar.classList.remove('open');
    aiSidebarOpen = false;
  }
}

// ── Append message to chat ─────────────────────────────────────────
function appendAiMessage(role, content, animate) {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return null;

  // Remove welcome screen if present
  const welcome = msgs.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-' + role;

  if (role === 'assistant') {
    div.innerHTML =
      `<div class="ai-msg-avatar">✦</div>` +
      `<div class="ai-msg-bubble"><div class="ai-msg-content"></div></div>`;
    msgs.appendChild(div);
    const contentEl = div.querySelector('.ai-msg-content');
    if (animate && settings.animationsEnabled) {
      typewriterStream(contentEl, content);
    } else {
      contentEl.innerHTML = formatAiContent(content);
    }
  } else {
    div.innerHTML =
      `<div class="ai-msg-bubble user-bubble">` +
        `<div class="ai-msg-content">${esc(content)}</div>` +
      `</div>`;
    msgs.appendChild(div);
  }
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

// ── Typewriter for static text (after stream) ──────────────────────
function typewriterStream(el, text) {
  el.innerHTML = '';
  const formatted = formatAiContent(text);
  // For formatted HTML, inject directly (stream does char-by-char on plain)
  el.innerHTML = formatted;
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    el.style.opacity    = '1';
    el.style.transform  = 'translateY(0)';
  });
}

// ── Format AI markdown-ish content ────────────────────────────────
function formatAiContent(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code class="ai-code">$1</code>')
    .replace(/^### (.+)$/gm,   '<h4 class="ai-h">$1</h4>')
    .replace(/^## (.+)$/gm,    '<h3 class="ai-h">$1</h3>')
    .replace(/^# (.+)$/gm,     '<h2 class="ai-h">$1</h2>')
    .replace(/^[-*] (.+)$/gm,  '<div class="ai-li">• $1</div>')
    .replace(/\n\n/g,           '<br/><br/>')
    .replace(/\n/g,             '<br/>');
}

// ── Thinking indicator ─────────────────────────────────────────────
let thinkingInterval = null;
let thinkingPhraseIdx = 0;

function showThinkingIndicator() {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  const welcome = msgs.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  thinkingPhraseIdx = 0;
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-assistant ai-msg-thinking';
  div.id = 'ai-thinking-indicator';
  div.innerHTML =
    `<div class="ai-msg-avatar thinking-avatar">✦</div>` +
    `<div class="ai-msg-bubble thinking-bubble">` +
      `<div class="ai-thinking-text" id="ai-thinking-text">${THINKING_PHRASES[0]}</div>` +
      `<div class="ai-thinking-dots"><span></span><span></span><span></span></div>` +
    `</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;

  thinkingInterval = setInterval(() => {
    thinkingPhraseIdx = (thinkingPhraseIdx + 1) % THINKING_PHRASES.length;
    const el = document.getElementById('ai-thinking-text');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = THINKING_PHRASES[thinkingPhraseIdx];
        el.style.opacity = '1';
      }, 200);
    }
  }, 1800);
}

function removeThinkingIndicator() {
  clearInterval(thinkingInterval);
  thinkingInterval = null;
  document.getElementById('ai-thinking-indicator')?.remove();
}

// ── Send message ───────────────────────────────────────────────────
async function sendAiMessage() {
  if (aiStreaming) return;
  const input = document.getElementById('ai-input');
  const text  = input?.value?.trim();
  if (!text) return;

  if (!currentChatId) await newAiChat();
  if (!currentChatId) return;

  input.value = '';
  autoResizeAiInput(input);

  appendAiMessage('user', text, false);
  showThinkingIndicator();

  aiStreaming = true;
  const sendBtn = document.getElementById('ai-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  let fullText  = '';
  let msgDiv    = null;
  let contentEl = null;
  let firstChunk = true;

  try {
    const res = await fetch(API + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: currentChatId, user_id: getAiUserId(), message: text }),
    });

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) { toast('⚠ AI Error: ' + parsed.error); break; }
          if (parsed.token) {
            if (firstChunk) {
              removeThinkingIndicator();
              firstChunk = false;
              // Create assistant message bubble for streaming
              const msgs = document.getElementById('ai-messages');
              msgDiv = document.createElement('div');
              msgDiv.className = 'ai-msg ai-msg-assistant ai-msg-streaming';
              msgDiv.innerHTML =
                `<div class="ai-msg-avatar">✦</div>` +
                `<div class="ai-msg-bubble"><div class="ai-msg-content"></div></div>`;
              msgs?.appendChild(msgDiv);
              contentEl = msgDiv.querySelector('.ai-msg-content');
            }
            fullText += parsed.token;
            if (contentEl) {
              contentEl.innerHTML = formatAiContent(fullText) +
                '<span class="ai-cursor">▋</span>';
              document.getElementById('ai-messages').scrollTop =
                document.getElementById('ai-messages').scrollHeight;
            }
          }
        } catch {}
      }
    }

    // Finalize
    removeThinkingIndicator();
    if (contentEl) {
      contentEl.innerHTML = formatAiContent(fullText);
      msgDiv?.classList.remove('ai-msg-streaming');
    } else if (firstChunk) {
      // No tokens received at all
      appendAiMessage('assistant', 'Sorry, I could not generate a response. Please try again.', true);
    }

    // Refresh chat list (title may have updated)
    loadAiChats();

  } catch (e) {
    removeThinkingIndicator();
    appendAiMessage('assistant', '⚠ Connection error: ' + e.message, false);
  }

  aiStreaming = false;
  if (sendBtn) sendBtn.disabled = false;
  input?.focus();
  const msgs = document.getElementById('ai-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function aiInputKey(e) {
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); sendAiMessage(); }
}
function autoResizeAiInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN LOGIN
// ══════════════════════════════════════════════════════════════════
function initAdmin() {
  if (adminSession) showAdminDash();
  else {
    document.getElementById('admin-login-view').style.display = 'block';
    document.getElementById('admin-dash-view').style.display  = 'none';
  }
}
async function adminLogin() {
  const btn = document.getElementById('adm-login-btn'), err = document.getElementById('adm-err');
  const user = val('adm-user'), pw = val('adm-pass');
  err.style.display = 'none';
  if (!user || !pw) { err.textContent = 'Enter username and password'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const res = await apiFetch('POST', '/api/admin/login', { username: user, password: pw });
    if (!res.success) throw new Error(res.error || 'Login failed');
    adminSession = { token: res.token, username: res.username, role: res.role, display_name: res.display_name };
    localStorage.setItem('vx_admin_session', JSON.stringify(adminSession));
    showAdminDash();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  btn.disabled = false; btn.textContent = '🔐 Sign In';
}
function adminLogout() {
  adminSession = null; localStorage.removeItem('vx_admin_session');
  document.getElementById('admin-login-view').style.display = 'block';
  document.getElementById('admin-dash-view').style.display  = 'none';
  toast('Signed out');
}
function showAdminDash() {
  if (!adminSession) return;
  document.getElementById('admin-login-view').style.display = 'none';
  document.getElementById('admin-dash-view').style.display  = 'block';
  setEl('adm-welcome', 'Welcome back, ' + adminSession.display_name + ' · ' + adminSession.role);
  loadAdminPets(); loadAdminLog(); loadAiPrompt();
}

// ══════════════════════════════════════════════════════════════════
//  AI PROMPT (ADMIN)
// ══════════════════════════════════════════════════════════════════
async function loadAiPrompt() {
  if (!adminSession) return;
  try {
    const res = await apiFetch('GET', '/api/admin/ai-prompt', null, { 'x-admin-token': adminSession.token });
    const el  = document.getElementById('ai-prompt-editor');
    if (el) el.value = res.prompt || '';
  } catch {}
}
async function saveAiPrompt() {
  if (!adminSession) return;
  const prompt = document.getElementById('ai-prompt-editor')?.value || '';
  try {
    await apiFetch('PUT', '/api/admin/ai-prompt', { prompt }, { 'x-admin-token': adminSession.token });
    toast('✔ AI prompt saved');
  } catch (e) { toast('⚠ ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN LOG
// ══════════════════════════════════════════════════════════════════
async function loadAdminLog() {
  const list = document.getElementById('admin-log-list');
  if (!list || !adminSession) return;
  list.innerHTML = '<div class="log-empty">Loading...</div>';
  try {
    const logs = await apiFetch('GET', '/api/admin/logs?limit=80', null, { 'x-admin-token': adminSession.token });
    if (!logs || !logs.length) { list.innerHTML = '<div class="log-empty">No activity yet</div>'; return; }
    list.innerHTML = '';
    logs.forEach(entry => {
      const row = document.createElement('div'); row.className = 'log-row';
      const dt      = new Date(entry.created_at);
      const timeStr = dt.toLocaleDateString([], { month:'short', day:'numeric' }) + ' ' +
        dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      const iconMap  = { ADD_PET:'➕', EDIT_PET:'✏️', DELETE_PET:'🗑️', ADD_HISTORY:'📊', DELETE_HISTORY:'🗑️', EDIT_PROMPT:'✦' };
      const icon     = iconMap[entry.action] || '📋';
      const badgeCls = entry.action === 'ADD_PET' ? 'log-badge-add'
        : entry.action === 'EDIT_PET' ? 'log-badge-edit'
        : (entry.action === 'DELETE_PET' || entry.action === 'DELETE_HISTORY') ? 'log-badge-del'
        : entry.action === 'ADD_HISTORY' ? 'log-badge-history' : 'log-badge-other';
      row.innerHTML =
        `<span class="log-icon">${icon}</span>` +
        `<div class="log-body">` +
          `<div class="log-header-row">` +
            `<span class="log-admin">${esc(entry.admin_username)}</span>` +
            `<span class="log-badge ${badgeCls}">${esc(entry.action.replace(/_/g,' '))}</span>` +
            `<span class="log-time">${timeStr}</span>` +
          `</div>` +
          `<div class="log-detail">${esc(entry.detail || '')}</div>` +
        `</div>`;
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = `<div class="log-empty" style="color:var(--danger);">Could not load log: ${esc(e.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN PETS LIST
// ══════════════════════════════════════════════════════════════════
async function loadAdminPets() {
  const list = document.getElementById('admin-pet-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-muted);">Loading...</div>';
  try {
    adminPets = await apiFetch('GET', '/api/pets?');
    renderAdminPets(adminPets);
  } catch (e) {
    list.innerHTML = `<div style="padding:1rem;color:var(--danger);">${esc(e.message)}</div>`;
  }
}
function adminFilterPets() {
  const q = val('admin-search').toLowerCase();
  renderAdminPets(q ? adminPets.filter(p => p.name.toLowerCase().includes(q)) : adminPets);
}
function renderAdminPets(pets) {
  const list = document.getElementById('admin-pet-list');
  if (!list) return;
  if (!pets.length) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No pets yet — add one!</div>'; return;
  }
  list.innerHTML = '';
  pets.forEach(pet => {
    const imgContent = pet.image_url
      ? `<img src="${esc(pet.image_url)}" alt="" onerror="this.parentElement.textContent='🐾'"/>`
      : '🐾';
    const demandCfg = pet.demand ? (DEMAND_CONFIG[pet.demand] || null) : null;
    const row = document.createElement('div'); row.className = 'admin-pet-row';
    row.innerHTML =
      `<div class="apr-img">${imgContent}</div>` +
      `<div class="apr-info">` +
        `<div class="apr-name">${esc(pet.name)}` +
          (isOC(pet.normal_value) ? ' <span class="oc-mini-badge">O/C</span>' : '') +
          (demandCfg ? ` <span class="demand-mini-badge" style="color:${demandCfg.color};background:${demandCfg.bg};border-color:${demandCfg.border};">${demandCfg.icon} ${esc(pet.demand)}</span>` : '') +
        `</div>` +
        `<div class="apr-meta">${esc(pet.existence_rate||'Unknown')} · ${esc(pet.category||'standard')}` +
          (pet.pet_power ? ` · ⚡${esc(String(pet.pet_power))}` : '') +
          (pet.updated_at ? ` · ✎ ${fmtDateShort(pet.updated_at)}` : '') +
        `</div>` +
      `</div>` +
      `<div class="apr-values">` +
        `<span class="apr-val n">${fmtVal(pet.normal_value)}</span>` +
        (pet.has_gold    ? `<span class="apr-val g">G:${fmtVal(pet.gold_value)}</span>`    : '') +
        (pet.has_rainbow ? `<span class="apr-val r">R:${fmtVal(pet.rainbow_value)}</span>` : '') +
      `</div>` +
      `<div class="apr-btns">` +
        `<button class="btn-sm" onclick="openEditPetModal('${esc(pet.id)}')">✏ Edit</button>` +
        `<button class="btn-sm chart-btn" onclick="openAdminChartModal('${esc(pet.id)}','${esc(pet.name)}')">📈</button>` +
        `<button class="btn-sm danger" onclick="deletePet('${esc(pet.id)}','${esc(pet.name)}')">🗑</button>` +
      `</div>`;
    list.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN CHART MODAL
// ══════════════════════════════════════════════════════════════════
async function openAdminChartModal(petId, petName) {
  showModal(
    `<button class="modal-close" onclick="closeModal()">✕</button>
    <div class="mform">
      <h2>📈 Price History</h2>
      <p class="mform-sub" style="font-family:'Share Tech Mono',monospace;color:var(--accent);">${esc(petName)}</p>
      <div id="acm-chart-area"><div class="chart-loading">Loading...</div></div>
      <div class="acm-add-form">
        <div class="acm-add-title">Add Data Point</div>
        <div class="acm-add-row">
          <div class="acm-field"><label>Date &amp; Time</label><input type="datetime-local" id="acm-date" value="${todayISO()}"/></div>
          <div class="acm-field"><label>Value</label><input type="text" id="acm-val" placeholder="e.g. 50000 or O/C"/></div>
          <div class="acm-field"><label>Label (optional)</label><input type="text" id="acm-label" placeholder="e.g. Patch update"/></div>
        </div>
        <button class="btn-primary" style="width:100%;margin-top:.6rem;" onclick="adminAddHistoryPoint('${esc(petId)}')">➕ Add Point</button>
      </div>
    </div>`
  );
  await refreshAdminChartArea(petId);
}

async function refreshAdminChartArea(petId) {
  const area = document.getElementById('acm-chart-area');
  if (!area) return;
  try {
    const history = await apiFetch('GET', '/api/pets/' + encodeURIComponent(petId) + '/history');
    if (!history.length) {
      area.innerHTML = '<div class="chart-empty" style="margin-bottom:1rem;">No data points yet. Add one below.</div>'; return;
    }
    const numericCount = history.filter(p => !isNaN(parseFloat(p.token_value))).length;
    let html = numericCount >= 2
      ? buildChartSVG(history)
      : '<div class="chart-empty" style="margin-bottom:.5rem;">Need 2+ numeric points to draw chart.</div>';
    html += '<div class="acm-points-list">';
    history.slice().sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)).forEach(p => {
      html +=
        `<div class="acm-point-row">` +
          `<span class="cpr-date">${new Date(p.recorded_at).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})} ${new Date(p.recorded_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>` +
          `<span class="cpr-val${isOC(p.token_value)?' oc-text':''}">${isOC(p.token_value)?'👑 ':''}${fmtVal(p.token_value)}${isOC(p.token_value)?'':' T'}</span>` +
          (p.label ? `<span class="cpr-label">${esc(p.label)}</span>` : '<span></span>') +
          `<span class="cpr-by">by ${esc(p.created_by||'?')}</span>` +
          `<button class="btn-sm danger" onclick="adminDeleteHistoryPoint(${p.id},'${esc(petId)}')">✕</button>` +
        `</div>`;
    });
    html += '</div>';
    area.innerHTML = html;
  } catch (e) {
    area.innerHTML = `<div class="chart-empty" style="color:var(--danger);">Failed: ${esc(e.message)}</div>`;
  }
}

async function adminAddHistoryPoint(petId) {
  const dateEl  = document.getElementById('acm-date');
  const valEl   = document.getElementById('acm-val');
  const labelEl = document.getElementById('acm-label');
  const dateVal = dateEl?.value?.trim(), tokenVal = valEl?.value?.trim(), labelVal = labelEl?.value?.trim();
  if (!dateVal)  { toast('⚠ Pick a date'); return; }
  if (!tokenVal) { toast('⚠ Enter a value'); return; }
  try {
    await apiFetch('POST', '/api/admin/pets/' + encodeURIComponent(petId) + '/history',
      { token_value: tokenVal, recorded_at: new Date(dateVal).toISOString(), label: labelVal },
      { 'x-admin-token': adminSession.token });
    if (valEl)   valEl.value   = '';
    if (labelEl) labelEl.value = '';
    toast('✔ Point added!');
    await refreshAdminChartArea(petId);
    loadAdminLog();
  } catch (e) { toast('⚠ ' + e.message); }
}

async function adminDeleteHistoryPoint(pointId, petId) {
  if (!confirm('Delete this data point?')) return;
  try {
    await apiFetch('DELETE', '/api/admin/history/' + pointId, null, { 'x-admin-token': adminSession.token });
    toast('Point deleted');
    await refreshAdminChartArea(petId);
    loadAdminLog();
  } catch (e) { toast('⚠ ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN PET FORM
// ══════════════════════════════════════════════════════════════════
function openAddPetModal() {
  showModal(
    `<button class="modal-close" onclick="closeModal()">✕</button>
    <div class="mform"><h2>Add Pet</h2><p class="mform-sub">Fill in the details. Values can be updated anytime.</p>
    ${petFormHTML()}
    <div id="pet-form-err" class="form-error" style="display:none;"></div>
    <div class="mform-actions">
      <button class="btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitAddPet()">⚡ Add Pet</button>
    </div></div>`
  );
}
function openEditPetModal(petId) {
  const pet = adminPets.find(p => p.id === petId);
  if (!pet) return;
  showModal(
    `<button class="modal-close" onclick="closeModal()">✕</button>
    <div class="mform"><h2>Edit Pet</h2>
    <p class="mform-sub" style="font-family:'Share Tech Mono',monospace;color:var(--accent);">${esc(pet.name)}</p>
    ${petFormHTML(pet)}
    <div id="pet-form-err" class="form-error" style="display:none;"></div>
    <div class="mform-actions">
      <button class="btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-sm chart-btn" onclick="closeModal();openAdminChartModal('${esc(petId)}','${esc(pet.name)}')" style="flex:1;padding:.68rem;">📈 Chart Data</button>
      <button class="btn-primary" onclick="submitEditPet('${esc(petId)}')" style="flex:2;">Save Changes</button>
    </div></div>`
  );
}
function petFormHTML(pet) {
  const p = pet || {};
  const demandOpts = ['', 'Very High', 'High', 'Medium', 'Low', 'Very Low'];
  const demandSelectOpts = demandOpts.map(d =>
    `<option value="${esc(d)}"${p.demand === d ? ' selected' : ''}>${d || '— Not set —'}</option>`
  ).join('');
  return `<div class="mform-grid">
    <div class="field-group"><label>Pet Name *</label><input id="pf-name" type="text" value="${esc(p.name||'')}" placeholder="e.g. Blossom Ninja"/></div>
    <div class="field-group"><label>Category</label><select id="pf-cat">
      ${['standard','limited','exclusive','event'].map(c =>
        `<option value="${c}"${p.category===c?' selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`
      ).join('')}
    </select></div>
    <div class="field-group" style="grid-column:1/-1;"><label>Image URL</label><input id="pf-img" type="text" value="${esc(p.image_url||'')}" placeholder="https://..."/></div>
    <div class="field-group" style="grid-column:1/-1;"><label>Existence Rate</label><input id="pf-rate" type="text" value="${esc(p.existence_rate||'')}" placeholder="e.g. 1 in 10,000 or 0.01%"/></div>
    <div class="field-group"><label>Normal Value</label><input id="pf-nval" type="text" value="${esc(String(p.normal_value||''))}" placeholder="e.g. 5000 or O/C"/></div>
    <div class="field-group"><label>Gold Value</label><input id="pf-gval" type="text" value="${esc(String(p.gold_value||''))}" placeholder="e.g. 10000 or O/C"/></div>
    <div class="field-group"><label>Rainbow Value</label><input id="pf-rval" type="text" value="${esc(String(p.rainbow_value||''))}" placeholder="e.g. 20000 or O/C"/></div>
    <div class="field-group"><label>Pet Power ⚡</label><input id="pf-power" type="text" value="${esc(p.pet_power||'')}" placeholder="e.g. 1500 or 145% or High"/></div>
    <div class="field-group"><label>Demand 📊</label><select id="pf-demand">${demandSelectOpts}</select></div>
    <div class="field-group" style="display:flex;gap:1.5rem;align-items:center;padding-top:.5rem;">
      <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.88rem;text-transform:none;letter-spacing:0;">
        <input id="pf-hasgold" type="checkbox"${p.has_gold!==false?' checked':''} style="width:auto;margin:0;accent-color:var(--accent);"/> Has Gold
      </label>
      <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.88rem;text-transform:none;letter-spacing:0;">
        <input id="pf-hasrb" type="checkbox"${p.has_rainbow!==false?' checked':''} style="width:auto;margin:0;accent-color:var(--accent);"/> Has Rainbow
      </label>
    </div>
    <div class="field-group" style="grid-column:1/-1;"><label>Notes (optional)</label><textarea id="pf-notes" placeholder="Any extra info...">${esc(p.notes||'')}</textarea></div>
  </div>`;
}
function getPetFormData() {
  return {
    name:           val('pf-name'),
    category:       val('pf-cat'),
    image_url:      val('pf-img'),
    existence_rate: val('pf-rate'),
    normal_value:   document.getElementById('pf-nval')?.value?.trim()   || '0',
    gold_value:     document.getElementById('pf-gval')?.value?.trim()   || '0',
    rainbow_value:  document.getElementById('pf-rval')?.value?.trim()   || '0',
    pet_power:      document.getElementById('pf-power')?.value?.trim()  || '',
    demand:         document.getElementById('pf-demand')?.value?.trim() || '',
    has_gold:       document.getElementById('pf-hasgold')?.checked !== false,
    has_rainbow:    document.getElementById('pf-hasrb')?.checked   !== false,
    notes:          document.getElementById('pf-notes')?.value?.trim()  || '',
  };
}
async function submitAddPet() {
  const err = document.getElementById('pet-form-err'), data = getPetFormData();
  err.style.display = 'none';
  if (!data.name) { err.textContent = 'Pet name is required'; err.style.display = 'block'; return; }
  try {
    await apiFetch('POST', '/api/admin/pets', data, { 'x-admin-token': adminSession.token });
    closeModal(); toast('✔ Pet added!'); loadAdminPets(); loadAdminLog(); loadPets();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}
async function submitEditPet(petId) {
  const err = document.getElementById('pet-form-err'), data = getPetFormData();
  err.style.display = 'none';
  if (!data.name) { err.textContent = 'Pet name is required'; err.style.display = 'block'; return; }
  try {
    await apiFetch('PUT', '/api/admin/pets/' + encodeURIComponent(petId), data, { 'x-admin-token': adminSession.token });
    closeModal(); toast('✔ Pet updated!'); loadAdminPets(); loadAdminLog(); loadPets();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}
async function deletePet(petId, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await apiFetch('DELETE', '/api/admin/pets/' + encodeURIComponent(petId), null, { 'x-admin-token': adminSession.token });
    toast('Pet deleted'); loadAdminPets(); loadAdminLog(); loadPets();
  } catch (e) { toast('⚠ ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════
//  OWNER PANEL
// ══════════════════════════════════════════════════════════════════
function initOwner() {
  if (ownerAuthed) {
    document.getElementById('owner-login-view').style.display = 'none';
    document.getElementById('owner-dash-view').style.display  = 'block';
    loadOwnerData();
  } else {
    document.getElementById('owner-login-view').style.display = 'block';
    document.getElementById('owner-dash-view').style.display  = 'none';
  }
}
async function ownerLogin() {
  const pw = val('own-pass'), err = document.getElementById('own-err');
  err.style.display = 'none';
  try {
    const res = await apiFetch('GET', '/api/owner/admins', null, { 'x-owner-password': pw });
    if (res.error) throw new Error(res.error);
    ownerPw = pw; ownerAuthed = true;
    document.getElementById('owner-login-view').style.display = 'none';
    document.getElementById('owner-dash-view').style.display  = 'block';
    loadOwnerData();
  } catch (e) {
    err.textContent = e.message === 'Unauthorized' ? 'Wrong password' : e.message;
    err.style.display = 'block';
  }
}
function ownerLogout() {
  ownerAuthed = false; ownerPw = '';
  document.getElementById('owner-login-view').style.display = 'block';
  document.getElementById('owner-dash-view').style.display  = 'none';
  document.getElementById('own-pass').value = '';
}
async function loadOwnerData() {
  if (!ownerAuthed) return;
  const h = { 'x-owner-password': ownerPw };
  try {
    const admins = await apiFetch('GET', '/api/owner/admins', null, h);
    const list   = document.getElementById('owner-admins-list'); if (!list) return;
    list.innerHTML = '';
    if (!admins.length) {
      list.innerHTML = '<div style="padding:.6rem 1rem;color:var(--text-muted);font-size:.88rem;">No admins yet</div>';
    } else {
      admins.forEach(a => {
        const row = document.createElement('div'); row.className = 'owner-list-row';
        row.innerHTML =
          `<span class="olr-name">${esc(a.display_name||a.username)}</span>` +
          `<span class="olr-role">${esc(a.role)}</span>` +
          `<span style="color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:.7rem;flex:1;">${esc(a.username)}</span>` +
          `<button class="btn-sm danger" onclick="ownerDeleteAdmin('${esc(a.username)}')">Remove</button>`;
        list.appendChild(row);
      });
    }
  } catch {}
  try {
    const credits = await apiFetch('GET', '/api/owner/credits', null, h);
    const list    = document.getElementById('owner-credits-list'); if (!list) return;
    list.innerHTML = '';
    if (!credits.length) {
      list.innerHTML = '<div style="padding:.6rem 1rem;color:var(--text-muted);font-size:.88rem;">No credits yet</div>';
    } else {
      credits.forEach(c => {
        const row = document.createElement('div'); row.className = 'owner-list-row';
        row.innerHTML =
          `<span class="olr-name">${esc(c.name)}</span>` +
          (c.role ? `<span class="olr-role">${esc(c.role)}</span>` : '') +
          `<span style="color:var(--text-muted);font-size:.8rem;flex:1;">${esc(c.discord||'')}</span>` +
          `<button class="btn-sm danger" onclick="ownerDeleteCredit(${c.id})">Remove</button>`;
        list.appendChild(row);
      });
    }
  } catch {}
  try {
    const pets = await apiFetch('GET', '/api/owner/pets', null, h);
    setEl('owner-pet-count', pets.length + ' pets');
    const list = document.getElementById('owner-pets-list'); if (!list) return;
    list.innerHTML = '';
    pets.forEach(p => {
      const row = document.createElement('div'); row.className = 'owner-list-row';
      row.innerHTML =
        `<span class="olr-name">${esc(p.name)}${isOC(p.normal_value)?' <span class="oc-mini-badge">O/C</span>':''}</span>` +
        `<span class="olr-role">${esc(p.category||'standard')}</span>` +
        `<span style="font-family:'Share Tech Mono',monospace;font-size:.7rem;color:var(--accent);flex:1;">${fmtVal(p.normal_value)}${isOC(p.normal_value)?'':' tokens'}</span>` +
        `<button class="btn-sm danger" onclick="ownerDeletePet('${esc(p.id)}','${esc(p.name)}')">Delete</button>`;
      list.appendChild(row);
    });
  } catch {}
}
async function ownerAddAdmin() {
  const username     = val('ow-adm-user'), display_name = val('ow-adm-display');
  const password     = val('ow-adm-pass');
  const role         = document.getElementById('ow-adm-role')?.value || 'admin';
  if (!username || !password) { toast('⚠ Username and password required'); return; }
  try {
    await apiFetch('POST', '/api/owner/admins', { username, password, role, display_name }, { 'x-owner-password': ownerPw });
    toast('✔ Admin added: ' + username);
    ['ow-adm-user','ow-adm-display','ow-adm-pass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadOwnerData();
  } catch (e) { toast('⚠ ' + e.message); }
}
async function ownerDeleteAdmin(username) {
  if (!confirm(`Remove admin "${username}"?`)) return;
  try {
    await apiFetch('DELETE', '/api/owner/admins/' + encodeURIComponent(username), null, { 'x-owner-password': ownerPw });
    toast('Admin removed'); loadOwnerData();
  } catch (e) { toast('⚠ ' + e.message); }
}
async function ownerAddCredit() {
  const name = val('ow-cr-name'), role = val('ow-cr-role'), discord = val('ow-cr-discord');
  const order_num = parseInt(document.getElementById('ow-cr-order')?.value) || 0;
  if (!name) { toast('⚠ Name required'); return; }
  try {
    await apiFetch('POST', '/api/owner/credits', { name, role, discord, order_num }, { 'x-owner-password': ownerPw });
    toast('✔ Credit added');
    ['ow-cr-name','ow-cr-role','ow-cr-discord','ow-cr-order'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadOwnerData();
  } catch (e) { toast('⚠ ' + e.message); }
}
async function ownerDeleteCredit(id) {
  if (!confirm('Remove this credit?')) return;
  try {
    await apiFetch('DELETE', '/api/owner/credits/' + id, null, { 'x-owner-password': ownerPw });
    toast('Credit removed'); loadOwnerData();
  } catch (e) { toast('⚠ ' + e.message); }
}
async function ownerDeletePet(id, name) {
  if (!confirm(`Permanently delete "${name}"?`)) return;
  try {
    await apiFetch('DELETE', '/api/owner/pets/' + encodeURIComponent(id), null, { 'x-owner-password': ownerPw });
    toast('Pet deleted'); loadOwnerData(); loadPets();
  } catch (e) { toast('⚠ ' + e.message); }
}

// ── Hidden owner button ────────────────────────────────────────────
let versionClicks = 0;
document.getElementById('nav-version')?.addEventListener('click', () => {
  versionClicks++;
  if (versionClicks >= 3) {
    versionClicks = 0;
    const btn = document.getElementById('owner-secret-btn');
    if (btn) btn.style.display = 'inline-flex';
    toast('🔓 Owner access revealed');
  }
  setTimeout(() => versionClicks = 0, 900);
});

// ══════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('data-theme', 'dark');
  loadSettings();
  applyDensity(settings.gridDensity);
  applyAccentColor(settings.accentColor);

  const sf = document.getElementById('sort-filter');
  if (sf) sf.value = settings.sortOrder;
  if (settings.defaultVariant && settings.defaultVariant !== 'all')
    setVariantFilter(settings.defaultVariant);

  // Enter key shortcuts
  document.getElementById('adm-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
  document.getElementById('own-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') ownerLogin(); });

  // AI input enter
  document.getElementById('ai-input')?.addEventListener('keydown', aiInputKey);

  checkStatus();
  loadPets();
  getAiUserId();
});
