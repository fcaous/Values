/* CSU VALUE LIST — app.js | Made by Aousisgood1 */

const API = window.location.origin;

// ── State ──────────────────────────────────────────────────────────
let allPets       = [];
let filteredPets  = [];
let variantFilter = 'all';
let adminSession  = null;
let ownerPw       = '';
let ownerAuthed   = false;
let calcItems     = { your: [], their: [] };
let adminPets     = [];
let searchDebounce = null;

// ── Settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  accentColor:    'blue',
  gridDensity:    'normal',
  sortOrder:      'oc_first',
  defaultVariant: 'all',
  showRate:       true,
  showCat:        true,
  showPower:      true,
  showLastEdited: false,
};
let settings = { ...DEFAULT_SETTINGS };

const ACCENT_DARK = {
  blue:   { '--accent':'#4da6d8','--accent-med':'#62b8e6','--accent-light':'#80caef','--accent-dim':'rgba(77,166,216,.18)','--accent-pale':'rgba(77,166,216,.09)' },
  teal:   { '--accent':'#2ec4b6','--accent-med':'#3dd9ca','--accent-light':'#5ee8da','--accent-dim':'rgba(46,196,182,.18)','--accent-pale':'rgba(46,196,182,.09)' },
  purple: { '--accent':'#a78bfa','--accent-med':'#c4abfc','--accent-light':'#d8c5ff','--accent-dim':'rgba(167,139,250,.18)','--accent-pale':'rgba(167,139,250,.09)' },
  amber:  { '--accent':'#f0a832','--accent-med':'#f7c055','--accent-light':'#fbd07a','--accent-dim':'rgba(240,168,50,.18)','--accent-pale':'rgba(240,168,50,.09)' },
  rose:   { '--accent':'#f06080','--accent-med':'#f57d98','--accent-light':'#f8a0b3','--accent-dim':'rgba(240,96,128,.18)','--accent-pale':'rgba(240,96,128,.09)' },
};

// Restore admin session
try { const s = localStorage.getItem('vx_admin_session'); if (s) adminSession = JSON.parse(s); } catch {}

// ══════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════
function loadSettings() {
  try { const s = localStorage.getItem('csu_settings'); if (s) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) }; } catch {}
}
function saveSettings() {
  settings.sortOrder      = document.getElementById('set-sort')?.value    || settings.sortOrder;
  settings.defaultVariant = document.getElementById('set-variant')?.value || settings.defaultVariant;
  settings.showRate       = document.getElementById('set-showrate')?.checked  ?? settings.showRate;
  settings.showCat        = document.getElementById('set-showcat')?.checked   ?? settings.showCat;
  settings.showPower      = document.getElementById('set-showpower')?.checked ?? settings.showPower;
  settings.showLastEdited = document.getElementById('set-showedited')?.checked ?? settings.showLastEdited;
  try { localStorage.setItem('csu_settings', JSON.stringify(settings)); } catch {}
  renderPetGrid();
}
function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  settings = { ...DEFAULT_SETTINGS };
  try { localStorage.removeItem('csu_settings'); } catch {}
  applySettingsToUI();
  applyDensity('normal');
  applyAccentColor('blue');
  renderPetGrid();
  toast('Settings reset');
}
function applySettingsToUI() {
  const el = id => document.getElementById(id);
  if (el('set-density'))    el('set-density').value      = settings.gridDensity;
  if (el('set-sort'))       el('set-sort').value         = settings.sortOrder;
  if (el('set-variant'))    el('set-variant').value      = settings.defaultVariant;
  if (el('set-showrate'))   el('set-showrate').checked   = settings.showRate;
  if (el('set-showcat'))    el('set-showcat').checked    = settings.showCat;
  if (el('set-showpower'))  el('set-showpower').checked  = settings.showPower;
  if (el('set-showedited')) el('set-showedited').checked = settings.showLastEdited;
  if (el('sort-filter'))    el('sort-filter').value      = settings.sortOrder;
  document.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('active', s.dataset.accent === settings.accentColor));
  const nv = el('nav-version'); const vd = el('settings-ver-display');
  if (nv && vd) vd.textContent = nv.textContent;
}
function applyDensity(val) {
  settings.gridDensity = val;
  document.body.classList.remove('density-compact','density-normal','density-spacious');
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
  document.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('active', s.dataset.accent === color));
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
  saveFavs(favs);
  applyVariantFilter();
  toast(favs.has(id) ? '⭐ Added to favorites' : 'Removed from favorites');
}

// ══════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════
function isOC(v) {
  if (v === null || v === undefined || v === '') return false;
  const s = String(v).toLowerCase().trim();
  return s === 'o/c' || s === 'oc' || s.startsWith('o/c') || s.includes('o/c');
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function fmtNum(n) {
  n = parseInt(n) || 0;
  if (n >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,'') + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
  return n.toLocaleString();
}
function fmtVal(v) {
  if (isOC(v)) return 'O/C';
  const n = parseInt(v);
  if (!isNaN(n) && String(v).trim() === String(n)) return fmtNum(n);
  return String(v || '—');
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
       + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff/86400000) + 'd ago';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
async function apiFetch(method, path, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type':'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok && data.error) throw new Error(data.error);
  return data;
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('📋 Copied to clipboard!');
  } catch {
    toast('⚠ Could not copy');
  }
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.style.display = 'block'; el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity='0'; setTimeout(()=>{ el.style.display='none'; el.style.opacity='1'; },300); }, 2400);
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
//  PAGE ROUTER
// ══════════════════════════════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const pg = document.getElementById('page-' + id); if (pg) pg.classList.add('active');
  const nl = document.getElementById('nl-' + id);   if (nl) nl.classList.add('active');
  window.scrollTo(0, 0); closeModal();
  if (id === 'credits')  loadCredits();
  if (id === 'admin')    initAdmin();
  if (id === 'owner')    initOwner();
  if (id === 'settings') applySettingsToUI();
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
    updateFavCount();
    applyVariantFilter();
  } catch (e) {
    document.getElementById('pet-grid').innerHTML = '<div class="grid-loading">Failed to load pets: ' + esc(e.message) + '</div>';
  }
}
function updateFavCount() {
  const count = getFavs().size;
  const el = document.getElementById('ft-fav-count');
  if (el) el.textContent = count > 0 ? ' ' + count : '';
}
function getSortOrder() { return document.getElementById('sort-filter')?.value || settings.sortOrder || 'oc_first'; }
function onSortChange() {
  settings.sortOrder = getSortOrder();
  try { localStorage.setItem('csu_settings', JSON.stringify(settings)); } catch {}
  applyVariantFilter();
}
function sortPets(list) {
  const order = getSortOrder();
  const copy  = [...list];
  const getRaw = p => variantFilter === 'gold' ? p.gold_value : variantFilter === 'rainbow' ? p.rainbow_value : p.normal_value;
  const getNum = p => parseInt(getRaw(p)) || 0;

  // O/C always floats to top
  const ocPets  = copy.filter(p => isOC(getRaw(p)));
  const nonOC   = copy.filter(p => !isOC(getRaw(p)));
  ocPets.sort((a,b) => a.name.localeCompare(b.name));

  if (order === 'oc_first' || order === 'expensive') nonOC.sort((a,b) => getNum(b) - getNum(a));
  else if (order === 'cheap') nonOC.sort((a,b) => getNum(a) - getNum(b));
  else if (order === 'az')    nonOC.sort((a,b) => a.name.localeCompare(b.name));
  else if (order === 'za')    nonOC.sort((a,b) => b.name.localeCompare(a.name));

  return [...ocPets, ...nonOC];
}
function applyVariantFilter() {
  const favs = getFavs();
  if (variantFilter === 'fav') {
    filteredPets = allPets.filter(p => favs.has(p.id));
  } else if (variantFilter === 'gold') {
    filteredPets = allPets.filter(p => p.has_gold);
  } else if (variantFilter === 'rainbow') {
    filteredPets = allPets.filter(p => p.has_rainbow);
  } else {
    filteredPets = allPets;
  }
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
    grid.innerHTML = '<div class="no-results">No favorites yet — star a pet to save it ⭐</div>';
    return;
  }
  if (!filteredPets.length) { grid.innerHTML = '<div class="no-results">No pets found 🔍</div>'; return; }

  const showRate    = document.getElementById('set-showrate')?.checked   ?? settings.showRate;
  const showCat     = document.getElementById('set-showcat')?.checked    ?? settings.showCat;
  const showPower   = document.getElementById('set-showpower')?.checked  ?? settings.showPower;
  const showEdited  = document.getElementById('set-showedited')?.checked ?? settings.showLastEdited;
  const favs        = getFavs();

  grid.innerHTML = '';
  filteredPets.forEach(pet => {
    const rawVal  = variantFilter === 'gold' ? pet.gold_value : variantFilter === 'rainbow' ? pet.rainbow_value : pet.normal_value;
    const faved   = favs.has(pet.id);
    const oc      = isOC(rawVal);

    const imgContent = pet.image_url
      ? '<img src="' + esc(pet.image_url) + '" alt="' + esc(pet.name) + '" onerror="this.parentElement.innerHTML=\'🐾\'"/>'
      : '🐾';

    const card = document.createElement('div');
    card.className = 'pet-card' + (oc ? ' is-oc' : '') + (faved ? ' is-fav' : '');
    card.onclick = () => openPetModal(pet);

    card.innerHTML =
      '<div class="pet-card-img">' + imgContent + '</div>' +
      (showCat ? '<div class="pet-cat-tag">' + esc(pet.category || 'standard') + '</div>' : '') +
      '<button class="pet-fav-btn" onclick="toggleFav(\'' + esc(pet.id) + '\',event)" title="Favorite">' + (faved ? '⭐' : '☆') + '</button>' +
      '<div class="pet-card-body">' +
        '<div class="pet-card-name">' + esc(pet.name) + '</div>' +
        (showRate && pet.existence_rate ? '<div class="pet-card-rate">' + esc(pet.existence_rate) + '</div>' : '') +
        '<div class="pet-card-value' + (oc ? ' oc-val' : '') + '">' +
          (oc ? '<span class="oc-crown">👑</span> ' : '') +
          fmtVal(rawVal) +
          (oc ? '' : '<span class="val-unit">tokens</span>') +
        '</div>' +
        (showPower && pet.pet_power ? '<div class="pet-card-power">⚡ ' + esc(String(pet.pet_power)) + '</div>' : '') +
        (showEdited && pet.updated_at ? '<div class="pet-last-edited">✎ ' + fmtDateShort(pet.updated_at) + '</div>' : '') +
        '<div class="pet-variants">' +
          (oc ? '<span class="pv-badge oc">O/C</span>' : '') +
          (pet.has_gold    && !oc ? '<span class="pv-badge gold">GOLD</span>'       : '') +
          (pet.has_rainbow && !oc ? '<span class="pv-badge rainbow">RAINBOW</span>' : '') +
        '</div>' +
      '</div>';
    grid.appendChild(card);
  });
}

function onSearch() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');
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
  const nvNum = parseInt(nv) || 0, gvNum = parseInt(gv) || 0, rvNum = parseInt(rv) || 0;
  const goldMult = nvNum > 0 && pet.has_gold && !isOC(gv)    ? (gvNum/nvNum).toFixed(1) + 'x' : null;
  const rbMult   = nvNum > 0 && pet.has_rainbow && !isOC(rv) ? (rvNum/nvNum).toFixed(1) + 'x' : null;
  const faved    = getFavs().has(pet.id);

  const imgHtml = pet.image_url
    ? '<img src="' + esc(pet.image_url) + '" alt="' + esc(pet.name) + '" onerror="this.style.display=\'none\'"/>'
    : '<span style="font-size:5rem;">🐾</span>';

  const statCard = (cls, icon, label, val, mult, locked) => {
    const oc = isOC(val);
    return '<div class="stat-card ' + cls + (locked ? ' locked' : '') + '">' +
      '<span class="stat-icon">' + icon + '</span>' +
      '<span class="stat-variant-name">' + label + '</span>' +
      (locked
        ? '<span class="stat-value" style="font-size:.9rem;">N/A</span><span class="stat-unavail">no variant</span>'
        : (oc
            ? '<span class="stat-value oc-stat-val">👑 O/C</span><span class="stat-unit">owner\'s choice</span>'
            : '<span class="stat-value">' + fmtVal(val) + '</span><span class="stat-unit">tokens</span>' + (mult ? '<span class="stat-multiplier">' + mult + '</span>' : '')
          )
      ) +
    '</div>';
  };

  showModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>' +
    '<div class="pet-modal-img">' + imgHtml + '</div>' +
    '<div class="pet-modal-body">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.35rem;">' +
        '<div class="pet-modal-name">' + esc(pet.name) + '</div>' +
        '<button class="modal-fav-btn" onclick="toggleFav(\'' + esc(pet.id) + '\',event);this.textContent=window._modalPet&&getFavs().has(window._modalPet.id)?\'⭐ Saved\':\'☆ Save\';" style="flex-shrink:0;">' + (faved ? '⭐ Saved' : '☆ Save') + '</button>' +
      '</div>' +
      '<div class="pet-modal-cat">' + esc(pet.category || 'Standard') + '</div>' +

      '<div class="pet-modal-rate"><span class="rate-label">EXISTENCE RATE</span><span class="rate-value">' + esc(pet.existence_rate || 'Unknown') + '</span></div>' +
      (pet.pet_power ? '<div class="pet-modal-rate" style="margin-bottom:.9rem;"><span class="rate-label">⚡ PET POWER</span><span class="rate-value" style="color:var(--gold);">' + esc(String(pet.pet_power)) + '</span></div>' : '') +
      (pet.updated_at ? '<div class="pet-modal-rate" style="margin-bottom:1rem;"><span class="rate-label">✎ LAST EDITED</span><span class="rate-value" style="font-size:.78rem;">' + fmtDate(pet.updated_at) + '</span></div>' : '') +

      '<div class="pet-stats-section">' +
        '<div class="pet-stats-label-row">' +
          '<span class="pet-stats-label">Variant Values</span>' +
          '<button class="copy-val-btn" onclick="copyToClipboard(\'' + fmtVal(nv) + (isOC(nv) ? '' : ' tokens') + '\')" title="Copy normal value">📋 Copy</button>' +
        '</div>' +
        '<div class="stats-grid">' +
          statCard('s-normal', '🔵', 'NORMAL',  nv, null,    false) +
          statCard('s-gold',   '⭐', 'GOLD',    gv, goldMult, !pet.has_gold) +
          statCard('s-rainbow','🌈', 'RAINBOW', rv, rbMult,   !pet.has_rainbow) +
        '</div>' +
      '</div>' +

      (pet.notes ? '<div class="pet-modal-notes">📝 ' + esc(pet.notes) + '</div>' : '') +
      '<button class="modal-add-calc" onclick="addToCalcFromModal(window._modalPet)">➕ Add to Calculator</button>' +
    '</div>'
  );
}

// ══════════════════════════════════════════════════════════════════
//  CALCULATOR
// ══════════════════════════════════════════════════════════════════
function calcSearch(side) {
  const input = document.getElementById('calc-search-' + side);
  const drop  = document.getElementById('calc-drop-'   + side);
  const q     = input?.value.toLowerCase().trim() || '';
  if (!q) { drop.innerHTML = ''; drop.style.display = 'none'; return; }
  const matches = allPets.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { drop.innerHTML = ''; drop.style.display = 'none'; return; }
  drop.innerHTML = matches.map(p =>
    '<div class="calc-drop-item" onclick="addCalcItem(\'' + side + '\',\'' + esc(p.id) + '\')">' +
    '<span class="drop-pet-name">' + esc(p.name) + '</span>' +
    '<span class="drop-pet-val">' + (isOC(p.normal_value) ? '👑 O/C' : fmtNum(p.normal_value) + ' T') + '</span></div>'
  ).join('');
  drop.style.display = 'block';
}
function addCalcItem(side, petId) {
  const pet = allPets.find(p => p.id === petId);
  if (!pet) return;
  calcItems[side].push({ isManual:false, pet, variant:'normal', qty:1 });
  document.getElementById('calc-search-' + side).value = '';
  document.getElementById('calc-drop-'   + side).style.display = 'none';
  renderCalc();
}
function addManualTokens(side) {
  const labelEl  = document.getElementById('calc-manual-label-'  + side);
  const tokensEl = document.getElementById('calc-manual-tokens-' + side);
  const tokens   = parseInt(tokensEl?.value) || 0;
  if (!tokens) { toast('⚠ Enter a token amount'); return; }
  const label = labelEl?.value?.trim() || 'Manual tokens';
  calcItems[side].push({ isManual:true, label, tokens, qty:1 });
  if (labelEl)  labelEl.value  = '';
  if (tokensEl) tokensEl.value = '';
  renderCalc();
}
function addToCalcFromModal(pet) {
  closeModal();
  calcItems.your.push({ isManual:false, pet, variant:'normal', qty:1 });
  showPage('calculator');
  renderCalc();
}
function removeCalcItem(side, i) { calcItems[side].splice(i,1); renderCalc(); }
function changeVariant(side, i, v) { calcItems[side][i].variant = v; renderCalc(); }
function changeQty(side, i, qty) { calcItems[side][i].qty = Math.max(1, parseInt(qty)||1); renderCalc(); }
function clearCalc() { calcItems = { your:[], their:[] }; renderCalc(); }

function getItemValue(item) {
  if (item.isManual) return (parseInt(item.tokens)||0) * (item.qty||1);
  const raw = item.variant === 'gold' ? item.pet.gold_value : item.variant === 'rainbow' ? item.pet.rainbow_value : item.pet.normal_value;
  if (isOC(raw)) return 0; // O/C can't be numerically compared
  return (parseInt(raw)||0) * item.qty;
}

function renderCalc() {
  ['your','their'].forEach(side => {
    const container = document.getElementById(side + '-items');
    const totalEl   = document.getElementById(side + '-total');
    if (!container) return;
    let total = 0;
    if (!calcItems[side].length) {
      container.innerHTML = '<div class="calc-empty">No pets added yet</div>';
    } else {
      container.innerHTML = '';
      calcItems[side].forEach((item, i) => {
        const itemVal = getItemValue(item);
        total += itemVal;
        const row = document.createElement('div');
        if (item.isManual) {
          row.className = 'calc-item is-token';
          row.innerHTML =
            '<div class="ci-name">🪙 ' + esc(item.label) + '</div>' +
            '<input class="ci-qty" type="number" min="1" value="' + (item.qty||1) + '" onchange="changeQty(\'' + side + '\',' + i + ',this.value)"/>' +
            '<div class="ci-val">' + fmtNum(itemVal) + '</div>' +
            '<button class="ci-rm" onclick="removeCalcItem(\'' + side + '\',' + i + ')">✕</button>';
        } else {
          const raw = item.variant === 'gold' ? item.pet.gold_value : item.variant === 'rainbow' ? item.pet.rainbow_value : item.pet.normal_value;
          const oc  = isOC(raw);
          const varOpts = ['normal'];
          if (item.pet.has_gold)    varOpts.push('gold');
          if (item.pet.has_rainbow) varOpts.push('rainbow');
          const varHtml = varOpts.map(v =>
            '<span class="ci-variant ' + v + '" style="cursor:pointer;opacity:' + (item.variant===v?1:0.4) + ';font-weight:' + (item.variant===v?800:500) + ';" onclick="changeVariant(\'' + side + '\',' + i + ',\'' + v + '\')">' + v.toUpperCase() + '</span>'
          ).join('');
          row.className = 'calc-item' + (oc ? ' is-oc-item' : '');
          row.innerHTML =
            '<div class="ci-name">' + (oc?'👑 ':'') + esc(item.pet.name) + '</div>' +
            '<div style="display:flex;gap:.25rem;align-items:center;">' + varHtml + '</div>' +
            '<input class="ci-qty" type="number" min="1" value="' + item.qty + '" onchange="changeQty(\'' + side + '\',' + i + ',this.value)"/>' +
            '<div class="ci-val">' + (oc ? 'O/C' : fmtNum(itemVal)) + '</div>' +
            '<button class="ci-rm" onclick="removeCalcItem(\'' + side + '\',' + i + ')">✕</button>';
        }
        container.appendChild(row);
      });
    }
    if (totalEl) totalEl.textContent = fmtNum(total) + ' tokens';
  });

  const yt = calcItems.your.reduce((s,i)  => s + getItemValue(i), 0);
  const tt = calcItems.their.reduce((s,i) => s + getItemValue(i), 0);
  const r  = document.getElementById('calc-result');
  if (!r) return;

  // Check if any O/C items exist
  const hasOC = [...calcItems.your, ...calcItems.their].some(item => {
    if (item.isManual) return false;
    const raw = item.variant === 'gold' ? item.pet.gold_value : item.variant === 'rainbow' ? item.pet.rainbow_value : item.pet.normal_value;
    return isOC(raw);
  });

  if (hasOC) {
    r.innerHTML = '👑 O/C in trade<br><span style="font-size:.72rem;">Manual valuation needed</span>';
    r.style.background = 'rgba(184,111,10,0.1)'; r.style.color = 'var(--gold)'; r.style.borderColor = 'var(--gold-border)';
  } else if (!yt && !tt) {
    r.textContent = '—'; r.style.background = ''; r.style.color = ''; r.style.borderColor = '';
  } else if (yt === tt) {
    r.textContent = '✔ Fair Trade';
    r.style.background = 'rgba(22,128,60,0.1)'; r.style.color = 'var(--success)'; r.style.borderColor = 'rgba(22,128,60,0.3)';
  } else {
    const diff = Math.abs(yt - tt);
    const who  = yt > tt ? 'You overpay' : 'They overpay';
    r.innerHTML = who + '<br><span style="font-size:.75rem;">' + fmtNum(diff) + ' tokens</span>';
    r.style.background  = yt > tt ? 'rgba(192,57,43,0.1)' : 'rgba(184,111,10,0.1)';
    r.style.color       = yt > tt ? 'var(--danger)' : 'var(--gold)';
    r.style.borderColor = yt > tt ? 'rgba(192,57,43,0.3)' : 'var(--gold-border)';
  }
}

document.addEventListener('click', e => {
  ['your','their'].forEach(side => {
    const drop  = document.getElementById('calc-drop-'   + side);
    const input = document.getElementById('calc-search-' + side);
    if (drop && !drop.contains(e.target) && e.target !== input) drop.style.display = 'none';
  });
});

// ══════════════════════════════════════════════════════════════════
//  CREDITS
// ══════════════════════════════════════════════════════════════════
async function loadCredits() {
  const grid = document.getElementById('credits-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="grid-loading">Loading...</div>';
  try {
    const data = await apiFetch('GET', '/api/credits');
    if (!data.length) { grid.innerHTML = '<div class="grid-loading" style="padding:2rem;">No credits added yet</div>'; return; }
    grid.innerHTML = '';
    data.forEach(c => {
      const initials = c.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const card = document.createElement('div'); card.className = 'credit-card';
      card.innerHTML =
        '<div class="credit-avatar">' + esc(initials) + '</div>' +
        '<div class="credit-name">' + esc(c.name) + '</div>' +
        (c.role    ? '<div class="credit-role">' + esc(c.role) + '</div>'       : '') +
        (c.discord ? '<div class="credit-discord">' + esc(c.discord) + '</div>' : '');
      grid.appendChild(card);
    });
  } catch (e) { grid.innerHTML = '<div class="grid-loading">Failed to load: ' + esc(e.message) + '</div>'; }
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
  const btn = document.getElementById('adm-login-btn');
  const err = document.getElementById('adm-err');
  const user = val('adm-user'), pw = val('adm-pass');
  err.style.display = 'none';
  if (!user || !pw) { err.textContent = 'Enter username and password'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const res = await apiFetch('POST', '/api/admin/login', { username:user, password:pw });
    if (!res.success) throw new Error(res.error || 'Login failed');
    adminSession = { token:res.token, username:res.username, role:res.role, display_name:res.display_name };
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
  loadAdminPets();
  loadAdminLog();
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
      const dt = new Date(entry.created_at);
      const timeStr = dt.toLocaleDateString([], { month:'short', day:'numeric' }) + ' ' + dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      const iconMap = { ADD_PET:'➕', EDIT_PET:'✏️', DELETE_PET:'🗑️' };
      const icon = iconMap[entry.action] || '📋';
      const badgeClass = entry.action === 'ADD_PET' ? 'log-badge-add' : entry.action === 'EDIT_PET' ? 'log-badge-edit' : entry.action === 'DELETE_PET' ? 'log-badge-del' : 'log-badge-other';
      row.innerHTML =
        '<span class="log-icon">' + icon + '</span>' +
        '<div class="log-body">' +
          '<div class="log-header-row">' +
            '<span class="log-admin">' + esc(entry.admin_username) + '</span>' +
            '<span class="log-badge ' + badgeClass + '">' + esc(entry.action.replace(/_/g,' ')) + '</span>' +
            '<span class="log-time">' + timeStr + '</span>' +
          '</div>' +
          '<div class="log-detail">' + esc(entry.detail || '') + '</div>' +
        '</div>';
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = '<div class="log-empty" style="color:var(--danger);">Could not load log: ' + esc(e.message) + '</div>';
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
  } catch (e) { list.innerHTML = '<div style="padding:1rem;color:var(--danger);">' + esc(e.message) + '</div>'; }
}
function adminFilterPets() {
  const q = val('admin-search').toLowerCase();
  renderAdminPets(q ? adminPets.filter(p => p.name.toLowerCase().includes(q)) : adminPets);
}
function renderAdminPets(pets) {
  const list = document.getElementById('admin-pet-list');
  if (!list) return;
  if (!pets.length) { list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No pets yet — add one!</div>'; return; }
  list.innerHTML = '';
  pets.forEach(pet => {
    const imgContent = pet.image_url
      ? '<img src="' + esc(pet.image_url) + '" alt="" onerror="this.parentElement.textContent=\'🐾\'"/>'
      : '🐾';
    const row = document.createElement('div'); row.className = 'admin-pet-row';
    row.innerHTML =
      '<div class="apr-img">' + imgContent + '</div>' +
      '<div class="apr-info">' +
        '<div class="apr-name">' + esc(pet.name) + (isOC(pet.normal_value) ? ' <span class="oc-mini-badge">O/C</span>' : '') + '</div>' +
        '<div class="apr-meta">' + esc(pet.existence_rate||'Unknown') + ' · ' + esc(pet.category||'standard') +
          (pet.pet_power ? ' · ⚡' + esc(String(pet.pet_power)) : '') +
          (pet.updated_at ? ' · ✎ ' + fmtDateShort(pet.updated_at) : '') +
        '</div>' +
      '</div>' +
      '<div class="apr-values">' +
        '<span class="apr-val n">' + fmtVal(pet.normal_value)  + '</span>' +
        (pet.has_gold    ? '<span class="apr-val g">G:' + fmtVal(pet.gold_value)    + '</span>' : '') +
        (pet.has_rainbow ? '<span class="apr-val r">R:' + fmtVal(pet.rainbow_value) + '</span>' : '') +
      '</div>' +
      '<div class="apr-btns">' +
        '<button class="btn-sm" onclick="openEditPetModal(\'' + esc(pet.id) + '\')">✏ Edit</button>' +
        '<button class="btn-sm danger" onclick="deletePet(\'' + esc(pet.id) + '\',\'' + esc(pet.name) + '\')">🗑</button>' +
      '</div>';
    list.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN PET FORM
// ══════════════════════════════════════════════════════════════════
function openAddPetModal() {
  showModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>' +
    '<div class="mform"><h2>Add Pet</h2><p class="mform-sub">Fill in the details. Values can be updated anytime.</p>' +
    petFormHTML() +
    '<div id="pet-form-err" class="form-error" style="display:none;"></div>' +
    '<div class="mform-actions"><button class="btn-outline" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitAddPet()">⚡ Add Pet</button></div>' +
    '</div>'
  );
}
function openEditPetModal(petId) {
  const pet = adminPets.find(p => p.id === petId);
  if (!pet) return;
  showModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>' +
    '<div class="mform"><h2>Edit Pet</h2><p class="mform-sub" style="font-family:\'Share Tech Mono\',monospace;color:var(--accent);">' + esc(pet.name) + '</p>' +
    petFormHTML(pet) +
    '<div id="pet-form-err" class="form-error" style="display:none;"></div>' +
    '<div class="mform-actions"><button class="btn-outline" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitEditPet(\'' + esc(petId) + '\')">Save Changes</button></div>' +
    '</div>'
  );
}
function petFormHTML(pet) {
  const p = pet || {};
  return '<div class="mform-grid">' +
    '<div class="field-group"><label>Pet Name *</label><input id="pf-name" type="text" value="' + esc(p.name||'') + '" placeholder="e.g. Blossom Ninja"/></div>' +
    '<div class="field-group"><label>Category</label><select id="pf-cat">' +
      '<option value="standard"'  + (p.category==='standard'  ?' selected':'') + '>Standard</option>' +
      '<option value="limited"'   + (p.category==='limited'   ?' selected':'') + '>Limited</option>' +
      '<option value="exclusive"' + (p.category==='exclusive' ?' selected':'') + '>Exclusive</option>' +
      '<option value="event"'     + (p.category==='event'     ?' selected':'') + '>Event</option>' +
    '</select></div>' +
    '<div class="field-group" style="grid-column:1/-1;"><label>Image URL</label><input id="pf-img" type="text" value="' + esc(p.image_url||'') + '" placeholder="https://..."/></div>' +
    '<div class="field-group" style="grid-column:1/-1;"><label>Existence Rate</label><input id="pf-rate" type="text" value="' + esc(p.existence_rate||'') + '" placeholder="e.g. 1 in 10,000 or 0.01%"/></div>' +
    '<div class="field-group"><label>Normal Value</label><input id="pf-nval" type="text" value="' + esc(String(p.normal_value||'')) + '" placeholder="e.g. 5000 or O/C"/></div>' +
    '<div class="field-group"><label>Gold Value</label><input id="pf-gval" type="text" value="' + esc(String(p.gold_value||'')) + '" placeholder="e.g. 10000 or O/C"/></div>' +
    '<div class="field-group"><label>Rainbow Value</label><input id="pf-rval" type="text" value="' + esc(String(p.rainbow_value||'')) + '" placeholder="e.g. 20000 or O/C"/></div>' +
    '<div class="field-group"><label>Pet Power ⚡</label><input id="pf-power" type="text" value="' + esc(p.pet_power||'') + '" placeholder="e.g. 1500 or 145% or High"/></div>' +
    '<div class="field-group" style="display:flex;gap:1.5rem;align-items:center;padding-top:.5rem;">' +
      '<label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.88rem;text-transform:none;letter-spacing:0;"><input id="pf-hasgold" type="checkbox"' + (p.has_gold!==false?' checked':'') + ' style="width:auto;margin:0;accent-color:var(--accent);"/> Has Gold version</label>' +
      '<label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.88rem;text-transform:none;letter-spacing:0;"><input id="pf-hasrb" type="checkbox"' + (p.has_rainbow!==false?' checked':'') + ' style="width:auto;margin:0;accent-color:var(--accent);"/> Has Rainbow version</label>' +
    '</div>' +
    '<div class="field-group" style="grid-column:1/-1;"><label>Notes (optional)</label><textarea id="pf-notes" placeholder="Any extra info about this pet...">' + esc(p.notes||'') + '</textarea></div>' +
  '</div>';
}
function getPetFormData() {
  return {
    name:           val('pf-name'),
    category:       val('pf-cat'),
    image_url:      val('pf-img'),
    existence_rate: val('pf-rate'),
    normal_value:   document.getElementById('pf-nval')?.value?.trim() || '0',
    gold_value:     document.getElementById('pf-gval')?.value?.trim() || '0',
    rainbow_value:  document.getElementById('pf-rval')?.value?.trim() || '0',
    pet_power:      document.getElementById('pf-power')?.value?.trim() || '',
    has_gold:       document.getElementById('pf-hasgold')?.checked !== false,
    has_rainbow:    document.getElementById('pf-hasrb')?.checked   !== false,
    notes:          document.getElementById('pf-notes')?.value?.trim() || '',
  };
}
async function submitAddPet() {
  const err = document.getElementById('pet-form-err');
  const data = getPetFormData();
  err.style.display = 'none';
  if (!data.name) { err.textContent = 'Pet name is required'; err.style.display = 'block'; return; }
  try {
    await apiFetch('POST', '/api/admin/pets', data, { 'x-admin-token': adminSession.token });
    closeModal(); toast('✔ Pet added!'); loadAdminPets(); loadAdminLog(); loadPets();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}
async function submitEditPet(petId) {
  const err = document.getElementById('pet-form-err');
  const data = getPetFormData();
  err.style.display = 'none';
  if (!data.name) { err.textContent = 'Pet name is required'; err.style.display = 'block'; return; }
  try {
    await apiFetch('PUT', '/api/admin/pets/' + encodeURIComponent(petId), data, { 'x-admin-token': adminSession.token });
    closeModal(); toast('✔ Pet updated!'); loadAdminPets(); loadAdminLog(); loadPets();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}
async function deletePet(petId, name) {
  if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
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
    const list = document.getElementById('owner-admins-list');
    if (!list) return;
    list.innerHTML = '';
    if (!admins.length) { list.innerHTML = '<div style="padding:.6rem 1rem;color:var(--text-muted);font-size:.88rem;">No admins yet</div>'; }
    else admins.forEach(a => {
      const row = document.createElement('div'); row.className = 'owner-list-row';
      row.innerHTML = '<span class="olr-name">' + esc(a.display_name||a.username) + '</span><span class="olr-role">' + esc(a.role) + '</span><span style="color:var(--text-muted);font-family:\'Share Tech Mono\',monospace;font-size:.7rem;flex:1;">' + esc(a.username) + '</span><button class="btn-sm danger" onclick="ownerDeleteAdmin(\'' + esc(a.username) + '\')">Remove</button>';
      list.appendChild(row);
    });
  } catch {}
  try {
    const credits = await apiFetch('GET', '/api/owner/credits', null, h);
    const list = document.getElementById('owner-credits-list');
    if (!list) return;
    list.innerHTML = '';
    if (!credits.length) { list.innerHTML = '<div style="padding:.6rem 1rem;color:var(--text-muted);font-size:.88rem;">No credits yet</div>'; }
    else credits.forEach(c => {
      const row = document.createElement('div'); row.className = 'owner-list-row';
      row.innerHTML = '<span class="olr-name">' + esc(c.name) + '</span>' + (c.role?'<span class="olr-role">' + esc(c.role) + '</span>':'') + '<span style="color:var(--text-muted);font-size:.8rem;flex:1;">' + esc(c.discord||'') + '</span><button class="btn-sm danger" onclick="ownerDeleteCredit(' + c.id + ')">Remove</button>';
      list.appendChild(row);
    });
  } catch {}
  try {
    const pets = await apiFetch('GET', '/api/owner/pets', null, h);
    setEl('owner-pet-count', pets.length + ' pets');
    const list = document.getElementById('owner-pets-list');
    if (!list) return;
    list.innerHTML = '';
    pets.forEach(p => {
      const row = document.createElement('div'); row.className = 'owner-list-row';
      row.innerHTML = '<span class="olr-name">' + esc(p.name) + (isOC(p.normal_value)?' <span class="oc-mini-badge">O/C</span>':'') + '</span><span class="olr-role">' + esc(p.category||'standard') + '</span><span style="font-family:\'Share Tech Mono\',monospace;font-size:.7rem;color:var(--accent);flex:1;">' + fmtVal(p.normal_value) + (isOC(p.normal_value)?'':' tokens') + '</span><button class="btn-sm danger" onclick="ownerDeletePet(\'' + esc(p.id) + '\',\'' + esc(p.name) + '\')">Delete</button>';
      list.appendChild(row);
    });
  } catch {}
}
async function ownerAddAdmin() {
  const username = val('ow-adm-user'), display_name = val('ow-adm-display'), password = val('ow-adm-pass');
  const role = document.getElementById('ow-adm-role')?.value || 'admin';
  if (!username || !password) { toast('⚠ Username and password required'); return; }
  try {
    await apiFetch('POST', '/api/owner/admins', { username, password, role, display_name }, { 'x-owner-password': ownerPw });
    toast('✔ Admin added: ' + username);
    ['ow-adm-user','ow-adm-display','ow-adm-pass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadOwnerData();
  } catch (e) { toast('⚠ ' + e.message); }
}
async function ownerDeleteAdmin(username) {
  if (!confirm('Remove admin "' + username + '"?')) return;
  try { await apiFetch('DELETE', '/api/owner/admins/' + encodeURIComponent(username), null, { 'x-owner-password': ownerPw }); toast('Admin removed'); loadOwnerData(); }
  catch (e) { toast('⚠ ' + e.message); }
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
  try { await apiFetch('DELETE', '/api/owner/credits/' + id, null, { 'x-owner-password': ownerPw }); toast('Credit removed'); loadOwnerData(); }
  catch (e) { toast('⚠ ' + e.message); }
}
async function ownerDeletePet(id, name) {
  if (!confirm('Permanently delete "' + name + '"?')) return;
  try { await apiFetch('DELETE', '/api/owner/pets/' + encodeURIComponent(id), null, { 'x-owner-password': ownerPw }); toast('Pet deleted'); loadOwnerData(); loadPets(); }
  catch (e) { toast('⚠ ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════
//  HIDDEN OWNER BUTTON
// ══════════════════════════════════════════════════════════════════
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
  // Always dark mode
  document.documentElement.setAttribute('data-theme', 'dark');

  loadSettings();
  applyDensity(settings.gridDensity);
  applyAccentColor(settings.accentColor);

  const sf = document.getElementById('sort-filter');
  if (sf) sf.value = settings.sortOrder;
  if (settings.defaultVariant && settings.defaultVariant !== 'all') setVariantFilter(settings.defaultVariant);

  document.getElementById('adm-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
  document.getElementById('own-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') ownerLogin(); });

  checkStatus();
  loadPets();
});
