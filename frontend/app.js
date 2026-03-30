  /*
    CSU VALUE LIST — app.js xd
    Made by Aousisgood1
  */

  const API = window.location.origin;

  // ── State ─────────────────────────────────
  let allPets        = [];
  let filteredPets   = [];
  let variantFilter  = 'all';
  let adminSession   = null; // { token, username, role, display_name }
  let ownerPw        = '';
  let ownerAuthed    = false;
  let calcItems      = { your: [], their: [] };
  let searchDebounce = null;

  // Restore admin session
  try {
    const s = localStorage.getItem('vx_admin_session');
    if (s) adminSession = JSON.parse(s);
  } catch {}

  // ══════════════════════════════════════════
  //  UTILS
  // ══════════════════════════════════════════
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
  function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function fmtNum(n) {
    n = parseInt(n) || 0;
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/,'') + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace(/\.0$/,'') + 'M';
    if (n >= 1_000)         return (n / 1_000).toFixed(1).replace(/\.0$/,'') + 'K';
    return n.toLocaleString();
  }

  async function apiFetch(method, path, body, headers = {}) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(API + path, opts);
    const data = await res.json();
    if (!res.ok && data.error) throw new Error(data.error);
    return data;
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; }, 300); }, 2400);
  }

  function showModal(html) {
    const bg  = document.getElementById('modal-bg');
    const box = document.getElementById('modal-box');
    if (!bg || !box) return;
    box.innerHTML = html;
    bg.classList.add('open');
  }
  function closeModal() {
    document.getElementById('modal-bg')?.classList.remove('open');
  }

  // ══════════════════════════════════════════
  //  PAGE ROUTER
  // ══════════════════════════════════════════
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const pg = document.getElementById('page-' + id);
    if (pg) pg.classList.add('active');
    const nl = document.getElementById('nl-' + id);
    if (nl) nl.classList.add('active');
    window.scrollTo(0, 0);
    closeModal();
    if (id === 'credits')    loadCredits();
    if (id === 'admin')      initAdmin();
    if (id === 'owner')      initOwner();
  }

  // ══════════════════════════════════════════
  //  STATUS
  // ══════════════════════════════════════════
  async function checkStatus() {
    try {
      const data = await apiFetch('GET', '/api/status');
      const pill = document.getElementById('status-pill');
      if (pill) pill.className = 'status-pill online';
      setEl('status-text', 'ONLINE');
      if (data.version) setEl('nav-version', 'v' + data.version);
    } catch {
      setEl('status-text', 'OFFLINE');
    }
  }

  // ══════════════════════════════════════════
  //  PETS — LOAD & DISPLAY
  // ══════════════════════════════════════════
  async function loadPets() {
    const search   = val('search-input');
    const category = document.getElementById('cat-filter')?.value || '';
    try {
      let q = '/api/pets?';
      if (search)   q += `search=${encodeURIComponent(search)}&`;
      if (category) q += `category=${encodeURIComponent(category)}&`;
      allPets = await apiFetch('GET', q);
      setEl('pet-counter', allPets.length + ' pets');
      applyVariantFilter();
    } catch (e) {
      document.getElementById('pet-grid').innerHTML = `<div class="grid-loading">Failed to load pets: ${esc(e.message)}</div>`;
    }
  }

  function applyVariantFilter() {
    if (variantFilter === 'all') {
      filteredPets = allPets;
    } else if (variantFilter === 'gold') {
      filteredPets = allPets.filter(p => p.has_gold);
    } else if (variantFilter === 'rainbow') {
      filteredPets = allPets.filter(p => p.has_rainbow);
    }
    setEl('result-count', filteredPets.length + ' result' + (filteredPets.length !== 1 ? 's' : ''));
    renderPetGrid();
  }

  function setVariantFilter(f) {
    variantFilter = f;
    document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
    const map = { all: 'ft-all', gold: 'ft-gold', rainbow: 'ft-rainbow' };
    document.getElementById(map[f])?.classList.add('active');
    applyVariantFilter();
  }

  function renderPetGrid() {
    const grid = document.getElementById('pet-grid');
    if (!grid) return;
    if (!filteredPets.length) {
      grid.innerHTML = '<div class="no-results">No pets found 🔍</div>';
      return;
    }
    grid.innerHTML = '';
    filteredPets.forEach(pet => {
      const showVal = variantFilter === 'gold'    ? pet.gold_value
                    : variantFilter === 'rainbow' ? pet.rainbow_value
                    : pet.normal_value;
      const imgContent = pet.image_url
        ? `<img src="${esc(pet.image_url)}" alt="${esc(pet.name)}" onerror="this.parentElement.innerHTML='🐾'"/>`
        : '🐾';

      const card = document.createElement('div');
      card.className = 'pet-card';
      card.onclick = () => openPetModal(pet);
      card.innerHTML = `
        <div class="pet-card-img">${imgContent}</div>
        <div class="pet-cat-tag">${esc(pet.category || 'standard')}</div>
        <div class="pet-card-body">
          <div class="pet-card-name">${esc(pet.name)}</div>
          <div class="pet-card-rate">${esc(pet.existence_rate || 'Unknown')}</div>
          <div class="pet-card-value">${fmtNum(showVal)}<span class="val-unit">tokens</span></div>
          <div class="pet-variants">
            ${pet.has_gold    ? '<span class="pv-badge gold">GOLD</span>'    : ''}
            ${pet.has_rainbow ? '<span class="pv-badge rainbow">RAINBOW</span>' : ''}
          </div>
        </div>
      `;
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
    document.getElementById('search-clear').style.display = 'none';
    loadPets();
  }

  // ══════════════════════════════════════════
  //  PET MODAL
  // ══════════════════════════════════════════
  function openPetModal(pet) {
    const imgContent = pet.image_url
      ? `<img src="${esc(pet.image_url)}" alt="${esc(pet.name)}" onerror="this.style.display='none'"/>`
      : '<span style="font-size:5rem;">🐾</span>';

    showModal(`
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div class="pet-modal-img">${imgContent}</div>
      <div class="pet-modal-body">
        <div class="pet-modal-name">${esc(pet.name)}</div>
        <div class="pet-modal-cat">${esc(pet.category || 'Standard')}</div>

        <div class="pet-modal-rate">
          <span class="rate-label">EXISTENCE RATE</span>
          <span class="rate-value">${esc(pet.existence_rate || 'Unknown')}</span>
        </div>

        <div class="variant-cards">
          <div class="vc normal">
            <div class="vc-icon">🔵</div>
            <div class="vc-label">NORMAL</div>
            <div class="vc-value">${fmtNum(pet.normal_value)}</div>
            <div class="vc-unit">tokens</div>
          </div>
          <div class="vc gold ${!pet.has_gold ? 'disabled' : ''}">
            <div class="vc-icon">⭐</div>
            <div class="vc-label">GOLD</div>
            <div class="vc-value">${pet.has_gold ? fmtNum(pet.gold_value) : 'N/A'}</div>
            <div class="vc-unit">${pet.has_gold ? 'tokens' : ''}</div>
          </div>
          <div class="vc rainbow ${!pet.has_rainbow ? 'disabled' : ''}">
            <div class="vc-icon">🌈</div>
            <div class="vc-label">RAINBOW</div>
            <div class="vc-value">${pet.has_rainbow ? fmtNum(pet.rainbow_value) : 'N/A'}</div>
            <div class="vc-unit">${pet.has_rainbow ? 'tokens' : ''}</div>
          </div>
        </div>

        ${pet.notes ? `<div class="pet-modal-notes">📝 ${esc(pet.notes)}</div>` : ''}

        <button class="modal-add-calc" onclick="addToCalcFromModal(${JSON.stringify(pet).replace(/"/g,'&quot;')})">
          ➕ Add to Calculator
        </button>
      </div>
    `);
  }

  // ══════════════════════════════════════════
  //  CALCULATOR
  // ══════════════════════════════════════════
  function calcSearch(side) {
    const input = document.getElementById(`calc-search-${side}`);
    const drop  = document.getElementById(`calc-drop-${side}`);
    const q     = input?.value.toLowerCase().trim() || '';

    if (!q) { drop.innerHTML = ''; drop.style.display = 'none'; return; }

    const matches = allPets.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { drop.innerHTML = ''; drop.style.display = 'none'; return; }

    drop.innerHTML = matches.map(p => `
      <div class="calc-drop-item" onclick="addCalcItem('${side}', '${esc(p.id)}')">
        <span class="drop-pet-name">${esc(p.name)}</span>
        <span class="drop-pet-val">${fmtNum(p.normal_value)} T</span>
      </div>
    `).join('');
    drop.style.display = 'block';
  }

  function addCalcItem(side, petId) {
    const pet = allPets.find(p => p.id === petId);
    if (!pet) return;

    // Pick best available variant
    const variant = 'normal';
    calcItems[side].push({ pet, variant, qty: 1 });

    document.getElementById(`calc-search-${side}`).value = '';
    document.getElementById(`calc-drop-${side}`).style.display = 'none';
    renderCalc();
  }

  function addToCalcFromModal(pet) {
    closeModal();
    calcItems.your.push({ pet, variant: 'normal', qty: 1 });
    showPage('calculator');
    renderCalc();
  }

  function removeCalcItem(side, index) {
    calcItems[side].splice(index, 1);
    renderCalc();
  }

  function changeVariant(side, index, variant) {
    calcItems[side][index].variant = variant;
    renderCalc();
  }

  function changeQty(side, index, qty) {
    calcItems[side][index].qty = Math.max(1, parseInt(qty) || 1);
    renderCalc();
  }

  function clearCalc() {
    calcItems = { your: [], their: [] };
    renderCalc();
  }

  function getItemValue(item) {
    const v = item.variant === 'gold'    ? item.pet.gold_value
            : item.variant === 'rainbow' ? item.pet.rainbow_value
            : item.pet.normal_value;
    return (parseInt(v) || 0) * item.qty;
  }

  function renderCalc() {
    ['your', 'their'].forEach(side => {
      const container = document.getElementById(`${side}-items`);
      const totalEl   = document.getElementById(`${side}-total`);
      if (!container) return;

      let total = 0;
      if (!calcItems[side].length) {
        container.innerHTML = '<div class="calc-empty">No pets added yet</div>';
      } else {
        container.innerHTML = '';
        calcItems[side].forEach((item, i) => {
          const itemVal = getItemValue(item);
          total += itemVal;

          // Build variant options
          const varOpts = ['normal'];
          if (item.pet.has_gold)    varOpts.push('gold');
          if (item.pet.has_rainbow) varOpts.push('rainbow');

          const varSelects = varOpts.map(v => `
            <span class="ci-variant ${v} ${item.variant===v?'':'opacity-50'}"
              style="cursor:pointer;${item.variant===v?'font-weight:800;':''}"
              onclick="changeVariant('${side}',${i},'${v}')">
              ${v.toUpperCase()}
            </span>
          `).join('');

          const row = document.createElement('div');
          row.className = 'calc-item';
          row.innerHTML = `
            <div class="ci-name">${esc(item.pet.name)}</div>
            <div style="display:flex;gap:.25rem;align-items:center;">${varSelects}</div>
            <input class="ci-qty" type="number" min="1" value="${item.qty}"
              onchange="changeQty('${side}',${i},this.value)"/>
            <div class="ci-val">${fmtNum(itemVal)}</div>
            <button class="ci-rm" onclick="removeCalcItem('${side}',${i})">✕</button>
          `;
          container.appendChild(row);
        });
      }
      if (totalEl) totalEl.textContent = fmtNum(total) + ' tokens';
    });

    // Comparison
    const yourTotal  = calcItems.your.reduce((s, i)  => s + getItemValue(i), 0);
    const theirTotal = calcItems.their.reduce((s, i) => s + getItemValue(i), 0);
    const resultEl   = document.getElementById('calc-result');
    if (!resultEl) return;

    if (!yourTotal && !theirTotal) {
      resultEl.textContent = '—';
      resultEl.style.background = '';
      resultEl.style.color = '';
    } else if (yourTotal === theirTotal) {
      resultEl.textContent = '✔ Fair Trade';
      resultEl.style.background = '#dcfce7';
      resultEl.style.color = '#166534';
    } else {
      const diff = Math.abs(yourTotal - theirTotal);
      const who  = yourTotal > theirTotal ? 'You overpay' : 'They overpay';
      resultEl.innerHTML = `${who}<br><span style="font-size:.75rem;">${fmtNum(diff)} tokens</span>`;
      resultEl.style.background = yourTotal > theirTotal ? '#fee2e2' : '#fef3c7';
      resultEl.style.color       = yourTotal > theirTotal ? '#991b1b' : '#92400e';
    }
  }

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    ['your','their'].forEach(side => {
      const drop  = document.getElementById(`calc-drop-${side}`);
      const input = document.getElementById(`calc-search-${side}`);
      if (drop && !drop.contains(e.target) && e.target !== input) {
        drop.style.display = 'none';
      }
    });
  });

  // ══════════════════════════════════════════
  //  CREDITS
  // ══════════════════════════════════════════
  async function loadCredits() {
    const grid = document.getElementById('credits-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="grid-loading">Loading...</div>';
    try {
      const data = await apiFetch('GET', '/api/credits');
      if (!data.length) {
        grid.innerHTML = '<div class="grid-loading" style="padding:2rem;">No credits added yet</div>';
        return;
      }
      grid.innerHTML = '';
      data.forEach(c => {
        const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
        const card = document.createElement('div');
        card.className = 'credit-card';
        card.innerHTML = `
          <div class="credit-avatar">${esc(initials)}</div>
          <div class="credit-name">${esc(c.name)}</div>
          ${c.role    ? `<div class="credit-role">${esc(c.role)}</div>` : ''}
          ${c.discord ? `<div class="credit-discord">${esc(c.discord)}</div>` : ''}
        `;
        grid.appendChild(card);
      });
    } catch (e) {
      grid.innerHTML = `<div class="grid-loading">Failed to load: ${esc(e.message)}</div>`;
    }
  }

  // ══════════════════════════════════════════
  //  ADMIN — LOGIN
  // ══════════════════════════════════════════
  function initAdmin() {
    if (adminSession) {
      showAdminDash();
    } else {
      document.getElementById('admin-login-view').style.display = 'block';
      document.getElementById('admin-dash-view').style.display  = 'none';
    }
  }

  async function adminLogin() {
    const btn  = document.getElementById('adm-login-btn');
    const err  = document.getElementById('adm-err');
    const user = val('adm-user');
    const pw   = val('adm-pass');
    err.style.display = 'none';
    if (!user || !pw) { err.textContent = 'Enter username and password'; err.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const res = await apiFetch('POST', '/api/admin/login', { username: user, password: pw });
      if (!res.success) throw new Error(res.error || 'Login failed');
      adminSession = { token: res.token, username: res.username, role: res.role, display_name: res.display_name };
      localStorage.setItem('vx_admin_session', JSON.stringify(adminSession));
      showAdminDash();
    } catch (e) {
      err.textContent = e.message;
      err.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = '🔐 Sign In';
  }

  function adminLogout() {
    adminSession = null;
    localStorage.removeItem('vx_admin_session');
    document.getElementById('admin-login-view').style.display = 'block';
    document.getElementById('admin-dash-view').style.display  = 'none';
    toast('Signed out');
  }

  function showAdminDash() {
    if (!adminSession) return;
    document.getElementById('admin-login-view').style.display = 'none';
    document.getElementById('admin-dash-view').style.display  = 'block';
    setEl('adm-welcome', `Welcome back, ${adminSession.display_name} · ${adminSession.role}`);
    loadAdminPets();
  }

  // ══════════════════════════════════════════
  //  ADMIN — PETS LIST
  // ══════════════════════════════════════════
  let adminPets = [];

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
    const filtered = q ? adminPets.filter(p => p.name.toLowerCase().includes(q)) : adminPets;
    renderAdminPets(filtered);
  }

  function renderAdminPets(pets) {
    const list = document.getElementById('admin-pet-list');
    if (!list) return;
    if (!pets.length) {
      list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No pets yet — add one!</div>';
      return;
    }
    list.innerHTML = '';
    pets.forEach(pet => {
      const imgContent = pet.image_url
        ? `<img src="${esc(pet.image_url)}" alt="" onerror="this.parentElement.textContent='🐾'"/>`
        : '🐾';
      const row = document.createElement('div');
      row.className = 'admin-pet-row';
      row.innerHTML = `
        <div class="apr-img">${imgContent}</div>
        <div class="apr-info">
          <div class="apr-name">${esc(pet.name)}</div>
          <div class="apr-meta">${esc(pet.existence_rate||'Unknown')} · ${esc(pet.category||'standard')}</div>
        </div>
        <div class="apr-values">
          <span class="apr-val n">${fmtNum(pet.normal_value)}</span>
          ${pet.has_gold    ? `<span class="apr-val g">G:${fmtNum(pet.gold_value)}</span>`    : ''}
          ${pet.has_rainbow ? `<span class="apr-val r">R:${fmtNum(pet.rainbow_value)}</span>` : ''}
        </div>
        <div class="apr-btns">
          <button class="btn-sm" onclick="openEditPetModal('${esc(pet.id)}')">✏ Edit</button>
          <button class="btn-sm danger" onclick="deletePet('${esc(pet.id)}','${esc(pet.name)}')">🗑</button>
        </div>
      `;
      list.appendChild(row);
    });
  }

  // ══════════════════════════════════════════
  //  ADMIN — ADD / EDIT PET MODAL
  // ══════════════════════════════════════════
  function openAddPetModal() {
    showModal(`
      <div class="modal-close" onclick="closeModal()">✕</div>
      <div class="mform">
        <h2>Add Pet</h2>
        <p class="mform-sub">Fill in the pet details. Token values can be updated anytime.</p>
        ${petFormHTML()}
        <div id="pet-form-err" class="form-error" style="display:none;"></div>
        <div class="mform-actions">
          <button class="btn-outline" onclick="closeModal()">Cancel</button>
          <button class="btn-primary" onclick="submitAddPet()">⚡ Add Pet</button>
        </div>
      </div>
    `);
  }

  async function openEditPetModal(petId) {
    const pet = adminPets.find(p => p.id === petId);
    if (!pet) return;
    showModal(`
      <div class="modal-close" onclick="closeModal()">✕</div>
      <div class="mform">
        <h2>Edit Pet</h2>
        <p class="mform-sub" style="font-family:'Share Tech Mono',monospace;color:var(--sky-dark);">${esc(pet.name)}</p>
        ${petFormHTML(pet)}
        <div id="pet-form-err" class="form-error" style="display:none;"></div>
        <div class="mform-actions">
          <button class="btn-outline" onclick="closeModal()">Cancel</button>
          <button class="btn-primary" onclick="submitEditPet('${esc(petId)}')">Save Changes</button>
        </div>
      </div>
    `);
  }

  function petFormHTML(pet) {
    const p = pet || {};
    return `
      <div class="mform-grid">
        <div class="field-group">
          <label>PET NAME *</label>
          <input id="pf-name" type="text" value="${esc(p.name||'')}" placeholder="e.g. Blossom Ninja"/>
        </div>
        <div class="field-group">
          <label>CATEGORY</label>
          <select id="pf-cat">
            <option value="standard"  ${p.category==='standard' ?'selected':''}>Standard</option>
            <option value="limited"   ${p.category==='limited'  ?'selected':''}>Limited</option>
            <option value="exclusive" ${p.category==='exclusive'?'selected':''}>Exclusive</option>
            <option value="event"     ${p.category==='event'    ?'selected':''}>Event</option>
          </select>
        </div>
        <div class="field-group" style="grid-column:1/-1;">
          <label>IMAGE URL</label>
          <input id="pf-img" type="text" value="${esc(p.image_url||'')}" placeholder="https://..."/>
        </div>
        <div class="field-group" style="grid-column:1/-1;">
          <label>EXISTENCE RATE</label>
          <input id="pf-rate" type="text" value="${esc(p.existence_rate||'')}" placeholder="e.g. 1 in 10,000 or 0.01%"/>
        </div>
        <div class="field-group">
          <label>NORMAL VALUE (tokens)</label>
          <input id="pf-nval" type="number" min="0" value="${p.normal_value||0}"/>
        </div>
        <div class="field-group">
          <label>GOLD VALUE (tokens)</label>
          <input id="pf-gval" type="number" min="0" value="${p.gold_value||0}"/>
        </div>
        <div class="field-group">
          <label>RAINBOW VALUE (tokens)</label>
          <input id="pf-rval" type="number" min="0" value="${p.rainbow_value||0}"/>
        </div>
        <div class="field-group" style="display:flex;gap:1.5rem;align-items:center;padding-top:.5rem;">
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.85rem;">
            <input id="pf-hasgold" type="checkbox" ${p.has_gold!==false?'checked':''} style="width:auto;margin:0;"/>
            Has Gold version
          </label>
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.85rem;">
            <input id="pf-hasrb" type="checkbox" ${p.has_rainbow!==false?'checked':''} style="width:auto;margin:0;"/>
            Has Rainbow version
          </label>
        </div>
        <div class="field-group" style="grid-column:1/-1;">
          <label>NOTES (optional)</label>
          <textarea id="pf-notes" placeholder="Any extra info about this pet...">${esc(p.notes||'')}</textarea>
        </div>
      </div>
    `;
  }

  function getPetFormData() {
    return {
      name:           val('pf-name'),
      category:       val('pf-cat'),
      image_url:      val('pf-img'),
      existence_rate: val('pf-rate'),
      normal_value:   parseInt(document.getElementById('pf-nval')?.value) || 0,
      gold_value:     parseInt(document.getElementById('pf-gval')?.value) || 0,
      rainbow_value:  parseInt(document.getElementById('pf-rval')?.value) || 0,
      has_gold:       document.getElementById('pf-hasgold')?.checked !== false,
      has_rainbow:    document.getElementById('pf-hasrb')?.checked !== false,
      notes:          document.getElementById('pf-notes')?.value?.trim() || '',
    };
  }

  async function submitAddPet() {
    const err  = document.getElementById('pet-form-err');
    const data = getPetFormData();
    err.style.display = 'none';
    if (!data.name) { err.textContent = 'Pet name is required'; err.style.display = 'block'; return; }
    try {
      await apiFetch('POST', '/api/admin/pets', data, { 'x-admin-token': adminSession.token });
      closeModal();
      toast('✔ Pet added!');
      loadAdminPets();
      loadPets();
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  }

  async function submitEditPet(petId) {
    const err  = document.getElementById('pet-form-err');
    const data = getPetFormData();
    err.style.display = 'none';
    if (!data.name) { err.textContent = 'Pet name is required'; err.style.display = 'block'; return; }
    try {
      await apiFetch('PUT', `/api/admin/pets/${encodeURIComponent(petId)}`, data, { 'x-admin-token': adminSession.token });
      closeModal();
      toast('✔ Pet updated!');
      loadAdminPets();
      loadPets();
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  }

  async function deletePet(petId, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await apiFetch('DELETE', `/api/admin/pets/${encodeURIComponent(petId)}`, null, { 'x-admin-token': adminSession.token });
      toast('Pet deleted');
      loadAdminPets();
      loadPets();
    } catch (e) { toast('⚠ ' + e.message); }
  }

  // ══════════════════════════════════════════
  //  OWNER PANEL
  // ══════════════════════════════════════════
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
    const pw  = val('own-pass');
    const err = document.getElementById('own-err');
    err.style.display = 'none';
    try {
      const res = await apiFetch('GET', '/api/owner/admins', null, { 'x-owner-password': pw });
      if (res.error) throw new Error(res.error);
      ownerPw     = pw;
      ownerAuthed = true;
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

    // Load admins
    try {
      const admins = await apiFetch('GET', '/api/owner/admins', null, { 'x-owner-password': ownerPw });
      const list   = document.getElementById('owner-admins-list');
      if (!list) return;
      list.innerHTML = '';
      if (!admins.length) {
        list.innerHTML = '<div style="padding:.6rem 1rem;color:var(--text-muted);font-size:.88rem;">No admins yet</div>';
      } else {
        admins.forEach(a => {
          const row = document.createElement('div');
          row.className = 'owner-list-row';
          row.innerHTML = `
            <span class="olr-name">${esc(a.display_name || a.username)}</span>
            <span class="olr-role">${esc(a.role)}</span>
            <span style="color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:.7rem;flex:1;">${esc(a.username)}</span>
            <button class="btn-sm danger" onclick="ownerDeleteAdmin('${esc(a.username)}')">Remove</button>
          `;
          list.appendChild(row);
        });
      }
    } catch {}

    // Load credits
    try {
      const credits = await apiFetch('GET', '/api/owner/credits', null, { 'x-owner-password': ownerPw });
      const list    = document.getElementById('owner-credits-list');
      if (!list) return;
      list.innerHTML = '';
      if (!credits.length) {
        list.innerHTML = '<div style="padding:.6rem 1rem;color:var(--text-muted);font-size:.88rem;">No credits yet</div>';
      } else {
        credits.forEach(c => {
          const row = document.createElement('div');
          row.className = 'owner-list-row';
          row.innerHTML = `
            <span class="olr-name">${esc(c.name)}</span>
            ${c.role ? `<span class="olr-role">${esc(c.role)}</span>` : ''}
            <span style="color:var(--text-muted);font-size:.8rem;flex:1;">${esc(c.discord||'')}</span>
            <button class="btn-sm danger" onclick="ownerDeleteCredit(${c.id})">Remove</button>
          `;
          list.appendChild(row);
        });
      }
    } catch {}

    // Load all pets count
    try {
      const pets = await apiFetch('GET', '/api/owner/pets', null, { 'x-owner-password': ownerPw });
      setEl('owner-pet-count', pets.length + ' pets');
      const list = document.getElementById('owner-pets-list');
      if (!list) return;
      list.innerHTML = '';
      pets.forEach(p => {
        const row = document.createElement('div');
        row.className = 'owner-list-row';
        row.innerHTML = `
          <span class="olr-name">${esc(p.name)}</span>
          <span class="olr-role">${esc(p.category||'standard')}</span>
          <span style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:var(--sky-dark);flex:1;">${fmtNum(p.normal_value)} tokens</span>
          <button class="btn-sm danger" onclick="ownerDeletePet('${esc(p.id)}','${esc(p.name)}')">Delete</button>
        `;
        list.appendChild(row);
      });
    } catch {}
  }

  async function ownerAddAdmin() {
    const username     = val('ow-adm-user');
    const display_name = val('ow-adm-display');
    const password     = val('ow-adm-pass');
    const role         = document.getElementById('ow-adm-role')?.value || 'admin';
    if (!username || !password) { toast('⚠ Username and password required'); return; }
    try {
      await apiFetch('POST', '/api/owner/admins', { username, password, role, display_name }, { 'x-owner-password': ownerPw });
      toast('✔ Admin added: ' + username);
      document.getElementById('ow-adm-user').value    = '';
      document.getElementById('ow-adm-display').value = '';
      document.getElementById('ow-adm-pass').value    = '';
      loadOwnerData();
    } catch (e) { toast('⚠ ' + e.message); }
  }

  async function ownerDeleteAdmin(username) {
    if (!confirm(`Remove admin "${username}"?`)) return;
    try {
      await apiFetch('DELETE', `/api/owner/admins/${encodeURIComponent(username)}`, null, { 'x-owner-password': ownerPw });
      toast('Admin removed');
      loadOwnerData();
    } catch (e) { toast('⚠ ' + e.message); }
  }

  async function ownerAddCredit() {
    const name     = val('ow-cr-name');
    const role     = val('ow-cr-role');
    const discord  = val('ow-cr-discord');
    const order_num = parseInt(document.getElementById('ow-cr-order')?.value) || 0;
    if (!name) { toast('⚠ Name required'); return; }
    try {
      await apiFetch('POST', '/api/owner/credits', { name, role, discord, order_num }, { 'x-owner-password': ownerPw });
      toast('✔ Credit added');
      ['ow-cr-name','ow-cr-role','ow-cr-discord','ow-cr-order'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      loadOwnerData();
    } catch (e) { toast('⚠ ' + e.message); }
  }

  async function ownerDeleteCredit(id) {
    if (!confirm('Remove this credit?')) return;
    try {
      await apiFetch('DELETE', `/api/owner/credits/${id}`, null, { 'x-owner-password': ownerPw });
      toast('Credit removed');
      loadOwnerData();
    } catch (e) { toast('⚠ ' + e.message); }
  }

  async function ownerDeletePet(id, name) {
    if (!confirm(`Permanently delete "${name}"?`)) return;
    try {
      await apiFetch('DELETE', `/api/owner/pets/${encodeURIComponent(id)}`, null, { 'x-owner-password': ownerPw });
      toast('Pet deleted');
      loadOwnerData();
      loadPets();
    } catch (e) { toast('⚠ ' + e.message); }
  }

  // ══════════════════════════════════════════
  //  HIDDEN OWNER BUTTON (triple-click version tag)
  // ══════════════════════════════════════════
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

  // ══════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    // Enter key handlers
    document.getElementById('adm-pass')?.addEventListener('keydown', e => { if(e.key==='Enter') adminLogin(); });
    document.getElementById('own-pass')?.addEventListener('keydown', e => { if(e.key==='Enter') ownerLogin(); });

    checkStatus();
    loadPets();
  });
