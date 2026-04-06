/* CSU VALUE LIST v2 — server.js | Made by Aousisgood1 */

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const https   = require('https');
const http    = require('http');
const path    = require('path');

const app            = express();
const PORT           = process.env.PORT || 3000;
const VERSION        = '2.0.0';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'CSU_OWNER_2026';
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_KEY;
const GROQ_API_KEY   = process.env.GROQ_API_KEY || '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';
const GROQ_MODEL     = 'llama-3.3-70b-versatile';

// ── Put your webhook URL here ─────────────
const ADMIN_WEBHOOK = process.env.ADMIN_WEBHOOK || 'https://discord.com/api/webhooks/1489602577657102517/cM3e0g5zVPPx3gJVvpVCIrRNDO71viFX0xpjfNAEamk3RBzGnecb55pM7-gXN98Go0i5';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

// ── Supabase ──────────────────────────────
function sbRequest(method, table, body, query, extraHeaders) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return reject(new Error('Supabase not configured'));
    const url  = new URL(`${SUPABASE_URL}/rest/v1/${table}${query || ''}`);
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search, method,
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
        ...(extraHeaders || {}),
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          if (res.statusCode >= 400) reject(new Error(`Supabase ${res.statusCode}: ${raw}`));
          else resolve(parsed);
        } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

// ── Webhook ───────────────────────────────
function sendWebhook(url, payload) {
  return new Promise((resolve) => {
    if (!url) return resolve({ ok: false });
    let pu; try { pu = new URL(url); } catch { return resolve({ ok: false }); }
    const body = JSON.stringify(payload);
    const opts = {
      hostname: pu.hostname, path: pu.pathname + pu.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ ok: res.statusCode < 300 }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false }); });
    req.write(body); req.end();
  });
}

// ── Admin pet webhook (add / edit / delete) ──
async function logAdminWebhook(action, adminName, pet, extra) {
  try {
    // Color per action
    const colors = { ADD: 0x4ade80, EDIT: 0x60a5fa, DELETE: 0xf87171 };
    const icons  = { ADD: '➕', EDIT: '✏️', DELETE: '🗑️' };
    const labels = { ADD: 'Pet Added', EDIT: 'Pet Edited', DELETE: 'Pet Deleted' };
    const color  = colors[action] || 0x9f72f0;
    const icon   = icons[action]  || '📋';
    const label  = labels[action] || action;

    const fields = [];

    if (pet.name)           fields.push({ name: '🐾 Pet',      value: pet.name,                    inline: true });
    if (adminName)          fields.push({ name: '👤 Admin',    value: adminName,                   inline: true });
    if (pet.category)       fields.push({ name: '📂 Category', value: pet.category,                inline: true });
    if (pet.normal_value)   fields.push({ name: '🔵 Normal',   value: `${pet.normal_value} tokens`, inline: true });
    if (pet.gold_value && pet.has_gold)
                            fields.push({ name: '⭐ Gold',     value: `${pet.gold_value} tokens`,  inline: true });
    if (pet.rainbow_value && pet.has_rainbow)
                            fields.push({ name: '🌈 Rainbow',  value: `${pet.rainbow_value} tokens`, inline: true });
    if (pet.existence_rate) fields.push({ name: '📊 Rate',     value: pet.existence_rate,          inline: true });
    if (pet.demand)         fields.push({ name: '📈 Demand',   value: pet.demand,                  inline: true });
    if (pet.pet_power)      fields.push({ name: '⚡ Power',    value: String(pet.pet_power),       inline: true });
    if (extra)              fields.push({ name: '📝 Note',     value: extra,                       inline: false });

    await sendWebhook(ADMIN_WEBHOOK, {
      username: 'CSU Admin Log',
      embeds: [{
        title:     `${icon} ${label}`,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer:    { text: 'CSU Value List — Admin Panel' },
        thumbnail: pet.image_url ? { url: pet.image_url } : undefined,
      }],
    });
  } catch (e) {
    console.error('[CSU] admin webhook failed:', e.message);
  }
}

// ── Auth ──────────────────────────────────
function hashPw(pw) { return crypto.createHash('sha256').update(pw + 'csu_value_salt_v1').digest('hex'); }
function authOwner(req, res, next) {
  const pw = req.headers['x-owner-password'] || req.body?.ownerPassword || '';
  if (pw !== OWNER_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
async function authAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || '';
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const rows = await sbRequest('GET', 'admins', null, `?token=eq.${encodeURIComponent(token)}&select=username,role,display_name`);
    if (!rows || !rows.length) return res.status(401).json({ error: 'Invalid token' });
    req.admin = rows[0]; next();
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Logging ───────────────────────────────
async function writeLog(user, action, detail) {
  try { await sbRequest('POST', 'admin_logs', { admin_username: user, action, detail, created_at: new Date().toISOString() }, ''); }
  catch {}
}

// ── Status ────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    const pets = await sbRequest('GET', 'pets', null, '?select=id');
    res.json({ version: VERSION, status: 'online', db: 'supabase', pets: (pets || []).length });
  } catch { res.json({ version: VERSION, status: 'online', pets: 0 }); }
});

// ── Public Pets ───────────────────────────
app.get('/api/pets', async (req, res) => {
  try {
    const search = req.query.search || '', category = req.query.category || '';
    let q = '?select=*&order=name.asc';
    if (search)   q += `&name=ilike.*${encodeURIComponent(search)}*`;
    if (category && category !== 'all') q += `&category=eq.${encodeURIComponent(category)}`;
    res.json(await sbRequest('GET', 'pets', null, q) || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/pets/:id', async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'pets', null, `?id=eq.${encodeURIComponent(req.params.id)}&select=*`);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/pets/:id/history', async (req, res) => {
  try {
    res.json(await sbRequest('GET', 'pet_price_history', null,
      `?pet_id=eq.${encodeURIComponent(req.params.id)}&order=recorded_at.asc&select=*`) || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Public Credits ────────────────────────
app.get('/api/credits', async (req, res) => {
  try { res.json(await sbRequest('GET', 'credits', null, '?select=*&order=order_num.asc') || []); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin Auth ────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const rows = await sbRequest('GET', 'admins', null, `?username=eq.${encodeURIComponent(username)}&select=*`);
    if (!rows || !rows.length || rows[0].password_hash !== hashPw(password))
      return res.status(401).json({ error: 'Invalid credentials' });
    const a = rows[0];
    res.json({ success: true, token: a.token, username: a.username, role: a.role, display_name: a.display_name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/me', authAdmin, (req, res) => res.json({ success: true, admin: req.admin }));

// ── Admin Pets ────────────────────────────
app.post('/api/admin/pets', authAdmin, async (req, res) => {
  try {
    const { name, category, image_url, existence_rate, normal_value, gold_value, rainbow_value,
            has_gold, has_rainbow, pet_power, demand, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id  = name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') + '_' + Date.now();
    const now = new Date().toISOString();
    const pet = {
      id, name: name.trim(), category: category || 'standard', image_url: image_url || '',
      existence_rate: existence_rate || 'Unknown',
      normal_value:  normal_value  ? String(normal_value).trim()  : '0',
      gold_value:    gold_value    ? String(gold_value).trim()    : '0',
      rainbow_value: rainbow_value ? String(rainbow_value).trim() : '0',
      pet_power: pet_power ? String(pet_power).trim() : '',
      demand:    demand    ? String(demand).trim()    : '',
      has_gold: has_gold !== false, has_rainbow: has_rainbow !== false,
      notes: notes || '', created_at: now, updated_at: now,
    };
    await sbRequest('POST', 'pets', pet, '');
    if (pet.normal_value && pet.normal_value !== '0') {
      await sbRequest('POST', 'pet_price_history', {
        pet_id: id, token_value: pet.normal_value, recorded_at: now,
        label: 'Added', created_by: req.admin.username, created_at: now,
      }, '').catch(() => {});
    }
    await writeLog(req.admin.username, 'ADD_PET', `Added "${pet.name}" N:${pet.normal_value} G:${pet.gold_value} R:${pet.rainbow_value}`);
    // ── Webhook ──
    await logAdminWebhook('ADD', req.admin.username, pet);
    res.json({ success: true, pet });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/pets/:id', authAdmin, async (req, res) => {
  try {
    const { name, category, image_url, existence_rate, normal_value, gold_value, rainbow_value,
            has_gold, has_rainbow, pet_power, demand, notes } = req.body;
    const now = new Date().toISOString();
    const u   = { updated_at: now };
    if (name           !== undefined) u.name           = name.trim();
    if (category       !== undefined) u.category       = category;
    if (image_url      !== undefined) u.image_url      = image_url;
    if (existence_rate !== undefined) u.existence_rate = existence_rate;
    if (normal_value   !== undefined) u.normal_value   = normal_value  ? String(normal_value).trim()  : '0';
    if (gold_value     !== undefined) u.gold_value     = gold_value    ? String(gold_value).trim()    : '0';
    if (rainbow_value  !== undefined) u.rainbow_value  = rainbow_value ? String(rainbow_value).trim() : '0';
    if (pet_power      !== undefined) u.pet_power      = pet_power     ? String(pet_power).trim()     : '';
    if (demand         !== undefined) u.demand         = demand        ? String(demand).trim()        : '';
    if (has_gold       !== undefined) u.has_gold       = has_gold;
    if (has_rainbow    !== undefined) u.has_rainbow    = has_rainbow;
    if (notes          !== undefined) u.notes          = notes;
    await sbRequest('PATCH', 'pets', u, `?id=eq.${encodeURIComponent(req.params.id)}`);
    if (normal_value !== undefined && String(normal_value).trim() !== '0') {
      await sbRequest('POST', 'pet_price_history', {
        pet_id: req.params.id, token_value: String(normal_value).trim(), recorded_at: now,
        label: 'Updated', created_by: req.admin.username, created_at: now,
      }, '').catch(() => {});
    }
    await writeLog(req.admin.username, 'EDIT_PET', `Edited "${req.params.id}"`);
    // ── Webhook — pass what we have (u has all updated fields) ──
    await logAdminWebhook('EDIT', req.admin.username, {
      name:           u.name           || req.params.id,
      category:       u.category       || '',
      image_url:      u.image_url      || '',
      normal_value:   u.normal_value   || '',
      gold_value:     u.gold_value     || '',
      rainbow_value:  u.rainbow_value  || '',
      has_gold:       u.has_gold,
      has_rainbow:    u.has_rainbow,
      existence_rate: u.existence_rate || '',
      demand:         u.demand         || '',
      pet_power:      u.pet_power      || '',
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/pets/:id', authAdmin, async (req, res) => {
  try {
    let petName = req.params.id;
    let petData = {};
    try {
      const r = await sbRequest('GET', 'pets', null, `?id=eq.${encodeURIComponent(req.params.id)}&select=*`);
      if (r?.[0]) { petName = r[0].name; petData = r[0]; }
    } catch {}
    await sbRequest('DELETE', 'pets', null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    await sbRequest('DELETE', 'pet_price_history', null, `?pet_id=eq.${encodeURIComponent(req.params.id)}`).catch(() => {});
    await writeLog(req.admin.username, 'DELETE_PET', `Deleted "${petName}"`);
    // ── Webhook ──
    await logAdminWebhook('DELETE', req.admin.username, { name: petName, ...petData });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin History ─────────────────────────
app.post('/api/admin/pets/:id/history', authAdmin, async (req, res) => {
  try {
    const { token_value, recorded_at, label } = req.body;
    if (!token_value || !recorded_at) return res.status(400).json({ error: 'token_value and recorded_at required' });
    const point = {
      pet_id: req.params.id, token_value: String(token_value).trim(),
      recorded_at: new Date(recorded_at).toISOString(), label: label ? String(label).trim() : '',
      created_by: req.admin.username, created_at: new Date().toISOString(),
    };
    const result = await sbRequest('POST', 'pet_price_history', point, '');
    await writeLog(req.admin.username, 'ADD_HISTORY', `Added price point for "${req.params.id}": ${token_value}`);
    res.json({ success: true, point: Array.isArray(result) ? result[0] : result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/history/:id', authAdmin, async (req, res) => {
  try {
    await sbRequest('DELETE', 'pet_price_history', null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    await writeLog(req.admin.username, 'DELETE_HISTORY', `Deleted history point ${req.params.id}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin Logs ────────────────────────────
app.get('/api/admin/logs', authAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 80, 300);
    res.json(await sbRequest('GET', 'admin_logs', null, `?order=created_at.desc&limit=${limit}&select=*`) || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin AI Prompt ───────────────────────
app.get('/api/admin/ai-prompt', authAdmin, async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'settings', null, '?key=eq.ai_system_prompt&select=value');
    res.json({ prompt: rows?.[0]?.value || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/ai-prompt', authAdmin, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });
    await sbRequest('POST', 'settings',
      { key: 'ai_system_prompt', value: prompt.trim(), updated_at: new Date().toISOString() },
      '?on_conflict=key', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
    await writeLog(req.admin.username, 'EDIT_PROMPT', 'Updated AI system prompt');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AI Chat History ───────────────────────
app.get('/api/ai/chats/:userId', async (req, res) => {
  try {
    res.json(await sbRequest('GET', 'ai_chats', null,
      `?user_id=eq.${encodeURIComponent(req.params.userId)}&order=updated_at.desc&limit=50&select=id,title,updated_at`) || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ai/chats', async (req, res) => {
  try {
    const { id, user_id, title } = req.body;
    if (!id || !user_id) return res.status(400).json({ error: 'id and user_id required' });
    const now = new Date().toISOString();
    await sbRequest('POST', 'ai_chats', { id, user_id, title: title || 'New Chat', created_at: now, updated_at: now }, '');
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/ai/chat/:id/messages', async (req, res) => {
  try {
    res.json(await sbRequest('GET', 'ai_messages', null,
      `?chat_id=eq.${encodeURIComponent(req.params.id)}&order=created_at.asc&select=id,role,content,created_at`) || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/ai/chat/:id', async (req, res) => {
  try {
    await sbRequest('DELETE', 'ai_messages', null, `?chat_id=eq.${encodeURIComponent(req.params.id)}`);
    await sbRequest('DELETE', 'ai_chats',   null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AI Groq Stream ────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { chat_id, user_id, message } = req.body;
  if (!chat_id || !message) return res.status(400).json({ error: 'chat_id and message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const now = new Date().toISOString();

  try {
    await sbRequest('POST', 'ai_messages', { chat_id, role: 'user', content: message, created_at: now }, '');
    const history     = await sbRequest('GET', 'ai_messages', null,
      `?chat_id=eq.${encodeURIComponent(chat_id)}&order=created_at.asc&limit=24&select=role,content`).catch(() => []);
    const pets        = await sbRequest('GET', 'pets', null, '?select=*&order=name.asc').catch(() => []);
    const promptRows  = await sbRequest('GET', 'settings', null, '?key=eq.ai_system_prompt&select=value').catch(() => []);
    const customPrompt = promptRows?.[0]?.value || 'You are a helpful pet game assistant.';

    const petContext = (pets || []).map(p => {
      let line = `• ${p.name}`;
      if (p.category !== 'standard') line += ` [${p.category}]`;
      line += `: N=${p.normal_value || '?'}`;
      if (p.has_gold    && p.gold_value)    line += ` G=${p.gold_value}`;
      if (p.has_rainbow && p.rainbow_value) line += ` R=${p.rainbow_value}`;
      if (p.existence_rate && p.existence_rate !== 'Unknown') line += ` Rate=${p.existence_rate}`;
      if (p.demand)    line += ` Demand=${p.demand}`;
      if (p.pet_power) line += ` Power=${p.pet_power}`;
      return line;
    }).join('\n');

    const systemPrompt = `${customPrompt}\n\n--- PET DATABASE (${(pets || []).length} pets, all values in tokens) ---\n${petContext || 'No pets yet.'}\n---`;
    const messages     = (history || []).map(m => ({ role: m.role, content: m.content }));

    const groqBody = JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true, max_tokens: 1024, temperature: 0.7,
    });

    let fullResponse = '';

    const groqReq = https.request({
      hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(groqBody),
      },
    }, groqRes => {
      let buf = '';
      groqRes.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content;
            if (token) { fullResponse += token; res.write(`data: ${JSON.stringify({ token })}\n\n`); }
          } catch {}
        }
      });
      groqRes.on('end', async () => {
        if (fullResponse) {
          const ts = new Date().toISOString();
          await sbRequest('POST', 'ai_messages', { chat_id, role: 'assistant', content: fullResponse, created_at: ts }, '').catch(() => {});
          const isFirst = (history || []).filter(m => m.role === 'user').length <= 1;
          const title   = isFirst ? message.slice(0, 55) + (message.length > 55 ? '...' : '') : undefined;
          await sbRequest('PATCH', 'ai_chats',
            { ...(title ? { title } : {}), updated_at: ts },
            `?id=eq.${encodeURIComponent(chat_id)}`).catch(() => {});
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });
    });
    groqReq.on('error', e => { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); res.end(); });
    groqReq.setTimeout(30000, () => groqReq.destroy());
    req.on('close', () => groqReq.destroy());
    groqReq.write(groqBody);
    groqReq.end();

  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// ── Owner Admins / Credits / Pets ─────────
app.get('/api/owner/admins', authOwner, async (req, res) => {
  try { res.json(await sbRequest('GET', 'admins', null, '?select=username,role,display_name,created_at&order=created_at.asc') || []); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/owner/admins', authOwner, async (req, res) => {
  try {
    const { username, password, role, display_name } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 4)    return res.status(400).json({ error: 'Password min 4 chars' });
    const token = crypto.randomBytes(32).toString('hex');
    await sbRequest('POST', 'admins', {
      username, password_hash: hashPw(password), role: role || 'admin',
      display_name: display_name || username, token, created_at: new Date().toISOString(),
    }, '');
    res.json({ success: true, username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/owner/admins/:username', authOwner, async (req, res) => {
  try { await sbRequest('DELETE', 'admins', null, `?username=eq.${encodeURIComponent(req.params.username)}`); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/owner/credits', authOwner, async (req, res) => {
  try { res.json(await sbRequest('GET', 'credits', null, '?select=*&order=order_num.asc') || []); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/owner/credits', authOwner, async (req, res) => {
  try {
    const { name, role, discord, order_num } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    await sbRequest('POST', 'credits', {
      name, role: role || '', discord: discord || '',
      order_num: parseInt(order_num) || 0, created_at: new Date().toISOString(),
    }, '');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/owner/credits/:id', authOwner, async (req, res) => {
  try { await sbRequest('DELETE', 'credits', null, `?id=eq.${encodeURIComponent(req.params.id)}`); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/owner/pets', authOwner, async (req, res) => {
  try { res.json(await sbRequest('GET', 'pets', null, '?select=*&order=name.asc') || []); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/owner/pets/:id', authOwner, async (req, res) => {
  try {
    await sbRequest('DELETE', 'pets', null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    await sbRequest('DELETE', 'pet_price_history', null, `?pet_id=eq.${encodeURIComponent(req.params.id)}`).catch(() => {});
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  POTION PRICES  (no webhooks here)
// ══════════════════════════════════════════
function parsePriceToNum(price) {
  if (!price) return null;
  const s = String(price).trim();
  if (/^[0-9]*\.?[0-9]+[Kk]$/.test(s)) return parseFloat(s) * 1000;
  if (/^[0-9]*\.?[0-9]+[Mm]$/.test(s)) return parseFloat(s) * 1000000;
  if (/^[0-9]*\.?[0-9]+[Bb]$/.test(s)) return parseFloat(s) * 1000000000;
  if (/^[0-9]*\.?[0-9]+$/.test(s))     return parseFloat(s);
  return null;
}

// GET all prices for a potion
app.get('/api/potions/:petId/prices', async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'potion_prices', null,
      `?pet_id=eq.${encodeURIComponent(req.params.petId)}&order=updated_at.desc&select=*`);
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all potion prices (for AI)
app.get('/api/potions/prices/all', async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'potion_prices', null,
      '?order=pet_name.asc,updated_at.desc&select=*');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST — submit or update a price
app.post('/api/potions/:petId/prices', async (req, res) => {
  try {
    let { discord_user, price, pet_name } = req.body;
    if (!discord_user || !price) return res.status(400).json({ error: 'discord_user and price required' });

    discord_user = discord_user.trim();
    if (!discord_user.startsWith('@')) discord_user = '@' + discord_user;

    const priceNum = parsePriceToNum(price);
    if (priceNum === null) return res.status(400).json({ error: 'Invalid price format. Use numbers like 5000, 1.5K, 2M etc.' });

    const petId = req.params.petId;
    const now   = new Date().toISOString();

    const existing = await sbRequest('GET', 'potion_prices', null,
      `?pet_id=eq.${encodeURIComponent(petId)}&discord_user=eq.${encodeURIComponent(discord_user)}&select=id,price`);

    let isUpdate = false;
    let oldPrice = null;

    if (existing && existing.length > 0) {
      oldPrice = existing[0].price;
      isUpdate = true;
      await sbRequest('PATCH', 'potion_prices',
        { price: String(price).trim(), updated_at: now },
        `?pet_id=eq.${encodeURIComponent(petId)}&discord_user=eq.${encodeURIComponent(discord_user)}`
      );
    } else {
      await sbRequest('POST', 'potion_prices', {
        pet_id: petId, pet_name: pet_name || petId, discord_user,
        price: String(price).trim(), created_at: now, updated_at: now,
      }, '');
    }

    // Log to admin_logs only (no webhook)
    await sbRequest('POST', 'admin_logs', {
      admin_username: discord_user,
      action:         isUpdate ? 'UPDATE_POTION_PRICE' : 'SET_POTION_PRICE',
      detail:         `Price of "${pet_name || petId}" set to ${price} tokens by ${discord_user}`,
      created_at:     now,
    }, '').catch(() => {});

    res.json({
      success: true,
      updated: isUpdate,
      message: isUpdate
        ? `✔ Your price has been updated from ${oldPrice} to ${price} tokens`
        : `✔ Your price of ${price} tokens has been listed`,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE — user deletes own price
app.delete('/api/potions/:petId/prices', async (req, res) => {
  try {
    let { discord_user } = req.body;
    if (!discord_user) return res.status(400).json({ error: 'discord_user required' });
    discord_user = discord_user.trim();
    if (!discord_user.startsWith('@')) discord_user = '@' + discord_user;

    const petId = req.params.petId;

    const existing = await sbRequest('GET', 'potion_prices', null,
      `?pet_id=eq.${encodeURIComponent(petId)}&discord_user=eq.${encodeURIComponent(discord_user)}&select=id,price,pet_name`);
    if (!existing || !existing.length) return res.status(404).json({ error: 'No price found for this Discord username' });

    const { price, pet_name } = existing[0];
    await sbRequest('DELETE', 'potion_prices', null,
      `?pet_id=eq.${encodeURIComponent(petId)}&discord_user=eq.${encodeURIComponent(discord_user)}`);

    // Log to admin_logs only (no webhook)
    await sbRequest('POST', 'admin_logs', {
      admin_username: discord_user,
      action:         'DELETE_POTION_PRICE',
      detail:         `${discord_user} removed their price for "${pet_name || petId}"`,
      created_at:     new Date().toISOString(),
    }, '').catch(() => {});

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin delete any price by id
app.delete('/api/admin/potion-prices/:id', authAdmin, async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'potion_prices', null,
      `?id=eq.${encodeURIComponent(req.params.id)}&select=*`);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Not found' });
    const p = rows[0];
    await sbRequest('DELETE', 'potion_prices', null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    // Log to admin_logs only (no webhook)
    await writeLog(req.admin.username, 'DELETE_POTION_PRICE', `Removed ${p.discord_user}'s price for "${p.pet_name}"`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Keepalive ─────────────────────────────
setInterval(() => {
  http.get(`http://localhost:${PORT}/api/status`, r => r.resume()).on('error', () => {});
}, 10 * 60 * 1000);

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.listen(PORT, () => {
  console.log(`CSU VALUE LIST v${VERSION} :${PORT}`);
  if (!SUPABASE_URL || !SUPABASE_KEY) console.error('WARNING: Supabase env vars missing!');
});
