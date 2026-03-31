/*
  CSU VALUE LIST — server.js
  Made by Aousisgood1
  Supabase database — permanent storage
  Updated: pet_power field support
*/

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const https   = require('https');
const http    = require('http');
const path    = require('path');

const app            = express();
const PORT           = process.env.PORT || 3000;
const VERSION        = '1.0.0';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'CSU_OWNER_2026';
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_KEY;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

// ══════════════════════════════════════════
//  SUPABASE CLIENT
// ══════════════════════════════════════════
function sbRequest(method, table, body, query, extraHeaders) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return reject(new Error('Supabase not configured'));
    const url  = new URL(`${SUPABASE_URL}/rest/v1/${table}${query || ''}`);
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
        ...(extraHeaders || {}),
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
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
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
function hashPw(pw) {
  return crypto.createHash('sha256').update(pw + 'csu_value_salt_v1').digest('hex');
}

function authOwner(req, res, next) {
  const pw = req.headers['x-owner-password'] || req.body?.ownerPassword || '';
  if (pw !== OWNER_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function authAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || '';
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const rows = await sbRequest('GET', 'admins', null,
      `?token=eq.${encodeURIComponent(token)}&select=username,role,display_name`);
    if (!rows || !rows.length) return res.status(401).json({ error: 'Invalid or expired token' });
    req.admin = rows[0];
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ══════════════════════════════════════════
//  PUBLIC — STATUS
// ══════════════════════════════════════════
app.get('/api/status', async (req, res) => {
  try {
    const pets = await sbRequest('GET', 'pets', null, '?select=id');
    res.json({ version: VERSION, status: 'online', db: 'supabase', pets: (pets || []).length });
  } catch (e) { res.json({ version: VERSION, status: 'online', pets: 0 }); }
});

// ══════════════════════════════════════════
//  PUBLIC — PETS
// ══════════════════════════════════════════
app.get('/api/pets', async (req, res) => {
  try {
    const search   = req.query.search || '';
    const category = req.query.category || '';
    let q = '?select=*&order=name.asc';
    if (search)   q += `&name=ilike.*${encodeURIComponent(search)}*`;
    if (category && category !== 'all') q += `&category=eq.${encodeURIComponent(category)}`;
    const pets = await sbRequest('GET', 'pets', null, q);
    res.json(pets || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pets/:id', async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'pets', null,
      `?id=eq.${encodeURIComponent(req.params.id)}&select=*`);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Pet not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  PUBLIC — CREDITS
// ══════════════════════════════════════════
app.get('/api/credits', async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'credits', null, '?select=*&order=order_num.asc');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  LOGGING
// ══════════════════════════════════════════
async function writeLog(adminUsername, action, detail) {
  try {
    await sbRequest('POST', 'admin_logs', {
      admin_username: adminUsername,
      action,
      detail,
      created_at: new Date().toISOString(),
    }, '');
  } catch (e) {
    // Non-fatal — log silently
    console.error('Log write failed:', e.message);
  }
}


app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const rows = await sbRequest('GET', 'admins', null,
      `?username=eq.${encodeURIComponent(username)}&select=*`);
    if (!rows || !rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const admin = rows[0];
    if (admin.password_hash !== hashPw(password)) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, token: admin.token, username: admin.username, role: admin.role, display_name: admin.display_name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/me', authAdmin, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// ══════════════════════════════════════════
//  ADMIN — PETS (add / edit / delete)
// ══════════════════════════════════════════
app.post('/api/admin/pets', authAdmin, async (req, res) => {
  try {
    const {
      name, category, image_url, existence_rate,
      normal_value, gold_value, rainbow_value,
      has_gold, has_rainbow, pet_power, notes,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') + '_' + Date.now();
    const pet = {
      id,
      name:           name.trim(),
      category:       category       || 'standard',
      image_url:      image_url      || '',
      existence_rate: existence_rate || 'Unknown',
      normal_value:   parseInt(normal_value)  || 0,
      gold_value:     parseInt(gold_value)    || 0,
      rainbow_value:  parseInt(rainbow_value) || 0,
      pet_power:      pet_power ? String(pet_power).trim() : '',
      has_gold:       has_gold    !== false,
      has_rainbow:    has_rainbow !== false,
      notes:          notes || '',
      created_at:     new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    };
    await sbRequest('POST', 'pets', pet, '');
    await writeLog(req.admin.username, 'ADD_PET', `Added pet "${pet.name}" (${pet.category}) — Normal: ${pet.normal_value}, Gold: ${pet.gold_value}, Rainbow: ${pet.rainbow_value}${pet.pet_power ? ', Power: ' + pet.pet_power : ''}`);
    res.json({ success: true, pet });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/pets/:id', authAdmin, async (req, res) => {
  try {
    const {
      name, category, image_url, existence_rate,
      normal_value, gold_value, rainbow_value,
      has_gold, has_rainbow, pet_power, notes,
    } = req.body;
    const u = { updated_at: new Date().toISOString() };
    if (name           !== undefined) u.name           = name.trim();
    if (category       !== undefined) u.category       = category;
    if (image_url      !== undefined) u.image_url      = image_url;
    if (existence_rate !== undefined) u.existence_rate = existence_rate;
    if (normal_value   !== undefined) u.normal_value   = parseInt(normal_value)  || 0;
    if (gold_value     !== undefined) u.gold_value     = parseInt(gold_value)    || 0;
    if (rainbow_value  !== undefined) u.rainbow_value  = parseInt(rainbow_value) || 0;
    if (pet_power      !== undefined) u.pet_power      = pet_power ? String(pet_power).trim() : '';
    if (has_gold       !== undefined) u.has_gold       = has_gold;
    if (has_rainbow    !== undefined) u.has_rainbow    = has_rainbow;
    if (notes          !== undefined) u.notes          = notes;
    await sbRequest('PATCH', 'pets', u, `?id=eq.${encodeURIComponent(req.params.id)}`);
    const changedFields = Object.keys(u).filter(k => k !== 'updated_at').join(', ');
    await writeLog(req.admin.username, 'EDIT_PET', `Edited pet ID "${req.params.id}" — changed: ${changedFields}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/pets/:id', authAdmin, async (req, res) => {
  try {
    // Fetch name before deleting for a useful log entry
    let petName = req.params.id;
    try {
      const rows = await sbRequest('GET', 'pets', null, `?id=eq.${encodeURIComponent(req.params.id)}&select=name`);
      if (rows && rows[0]) petName = rows[0].name;
    } catch {}
    await sbRequest('DELETE', 'pets', null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    await writeLog(req.admin.username, 'DELETE_PET', `Deleted pet "${petName}"`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  ADMIN — LOGS
// ══════════════════════════════════════════
app.get('/api/admin/logs', authAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const rows = await sbRequest('GET', 'admin_logs', null,
      `?order=created_at.desc&limit=${limit}&select=*`);
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  OWNER — ADMINS
// ══════════════════════════════════════════
app.get('/api/owner/admins', authOwner, async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'admins', null,
      '?select=username,role,display_name,created_at&order=created_at.asc');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/owner/admins', authOwner, async (req, res) => {
  try {
    const { username, password, role, display_name } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 4)    return res.status(400).json({ error: 'Password must be at least 4 characters' });
    const token = crypto.randomBytes(32).toString('hex');
    const admin = {
      username,
      password_hash: hashPw(password),
      role:         role         || 'admin',
      display_name: display_name || username,
      token,
      created_at: new Date().toISOString(),
    };
    await sbRequest('POST', 'admins', admin, '');
    res.json({ success: true, username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/owner/admins/:username', authOwner, async (req, res) => {
  try {
    await sbRequest('DELETE', 'admins', null,
      `?username=eq.${encodeURIComponent(req.params.username)}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  OWNER — CREDITS
// ══════════════════════════════════════════
app.get('/api/owner/credits', authOwner, async (req, res) => {
  try {
    const rows = await sbRequest('GET', 'credits', null, '?select=*&order=order_num.asc');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/owner/credits', authOwner, async (req, res) => {
  try {
    const { name, role, discord, order_num } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const credit = {
      name, role: role||'', discord: discord||'',
      order_num: parseInt(order_num)||0,
      created_at: new Date().toISOString(),
    };
    await sbRequest('POST', 'credits', credit, '');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/owner/credits/:id', authOwner, async (req, res) => {
  try {
    await sbRequest('DELETE', 'credits', null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  OWNER — PETS (force view/delete any pet)
// ══════════════════════════════════════════
app.get('/api/owner/pets', authOwner, async (req, res) => {
  try {
    const pets = await sbRequest('GET', 'pets', null, '?select=*&order=name.asc');
    res.json(pets || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/owner/pets/:id', authOwner, async (req, res) => {
  try {
    await sbRequest('DELETE', 'pets', null, `?id=eq.${encodeURIComponent(req.params.id)}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  KEEPALIVE
// ══════════════════════════════════════════
setInterval(() => {
  http.get(`http://localhost:${PORT}/api/status`, r => r.resume()).on('error', () => {});
}, 10 * 60 * 1000);

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

app.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║  CSU VALUE LIST v${VERSION} — ONLINE      ║`);
  console.log(`║  Made by Aousisgood1                 ║`);
  console.log(`╚══════════════════════════════════════╝`);
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('⚠️  WARNING: SUPABASE_URL or SUPABASE_KEY not set!');
  }
});
