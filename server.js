const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const rootDir = __dirname;
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || rootDir.startsWith('/var/task'));
const dataDir = process.env.DATA_DIR || (isVercel ? path.join('/tmp', 'sydv-data') : path.join(rootDir, 'data'));
const tasitDir = path.join(rootDir, 'apps', 'tasit');
const dogrudanTeminDir = path.join(rootDir, 'apps', 'dogrudan-temin');
const yazismaFile = path.join(rootDir, 'apps', 'yazisma', 'index.html');
const modulFile = path.join(rootDir, 'apps', 'modul', 'index.html');
const tasitDataFile = path.join(dataDir, 'tasit-veriler.json');
const yazismaDataFile = path.join(dataDir, 'yazisma-veriler.json');
const modulDataFile = path.join(dataDir, 'modul-veriler.json');
const usersFile = path.join(dataDir, 'kullanicilar.json');
const requestedPort = Number(process.env.PORT || 8091);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536 ? requestedPort : 8091;
const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Degistiriniz123!';
const authDisabled = process.env.AUTH_DISABLED !== '0';
const useSupabase = !authDisabled && process.env.DATA_BACKEND === 'supabase' && Boolean(process.env.DATABASE_URL);
let pgPool = null;
let dbReady = false;

const MODULES = ['asevi', 'tasit', 'yazisma', 'dogrudanTemin', 'personel'];
const MODULE_ALIASES = { asevi: 'asevi', dogrudanTemin: 'dogrudanTemin', personel: 'personel' };
const sessions = new Map();
const bypassUser = {
  id: 'auth-disabled',
  username: 'sydv',
  fullName: 'SYDV Kullanıcısı',
  title: '',
  active: true,
  permissions: { asevi: true, tasit: true, yazisma: true, dogrudanTemin: true, personel: true, users: false },
  mustChangePassword: false,
  createdAt: null,
  updatedAt: null
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') };
}

function verifyPassword(password, user) {
  try {
    const candidate = Buffer.from(hashPassword(password, user.salt).hash, 'hex');
    const saved = Buffer.from(user.passwordHash, 'hex');
    return candidate.length === saved.length && crypto.timingSafeEqual(candidate, saved);
  } catch { return false; }
}

function getPool() {
  if (!useSupabase) return null;
  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

function dbUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    title: row.title || '',
    active: row.active !== false,
    permissions: row.permissions || {},
    salt: row.salt,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function dbUserValues(user) {
  return [
    user.id, user.username, user.fullName, user.title || '', user.active !== false,
    JSON.stringify(user.permissions || {}), user.salt, user.passwordHash,
    user.mustChangePassword !== false, user.createdAt || new Date().toISOString(), user.updatedAt || new Date().toISOString()
  ];
}

async function ensureDatabase() {
  if (!useSupabase || dbReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id text PRIMARY KEY,
      username text UNIQUE NOT NULL,
      full_name text NOT NULL,
      title text DEFAULT '',
      active boolean NOT NULL DEFAULT true,
      permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
      salt text NOT NULL,
      password_hash text NOT NULL,
      must_change_password boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      token text PRIMARY KEY,
      user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    )
  `);
  await pool.query('ALTER TABLE app_state ADD COLUMN IF NOT EXISTS key text');
  await pool.query("ALTER TABLE app_state ADD COLUMN IF NOT EXISTS value jsonb NOT NULL DEFAULT '{}'::jsonb");
  await pool.query('ALTER TABLE app_state ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS app_state_key_idx ON app_state(key)');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS id text');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username text');
  await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS title text DEFAULT ''");
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true');
  await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS salt text NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT ''");
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()');
  await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS app_users_id_idx ON app_users(id)');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_idx ON app_users(username)');
  await pool.query('ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS token text');
  await pool.query("ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT ''");
  await pool.query('ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT now()');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS app_sessions_token_idx ON app_sessions(token)');
  await pool.query(`
    INSERT INTO app_state (key, value) VALUES
      ('tasit', $1::jsonb),
      ('yazisma', $2::jsonb),
      ('modul', $3::jsonb)
    ON CONFLICT (key) DO NOTHING
  `, [
    JSON.stringify({ records: [], fuelRecords: [], definitions: {} }),
    JSON.stringify({ records: [], updatedAt: null }),
    JSON.stringify({ asevi: [], dogrudanTemin: [], personel: [] })
  ]);
  const count = await pool.query('SELECT count(*)::int AS count FROM app_users');
  if (!count.rows[0]?.count) {
    const password = hashPassword(initialAdminPassword);
    const now = new Date().toISOString();
    await pool.query(`
      INSERT INTO app_users
        (id, username, full_name, title, active, permissions, salt, password_hash, must_change_password, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
    `, dbUserValues({
      id: crypto.randomUUID(), username: 'yonetici', fullName: 'Sistem Yöneticisi',
      title: 'Yönetici', active: true,
      permissions: { asevi: true, tasit: true, yazisma: true, dogrudanTemin: true, personel: true, users: true },
      salt: password.salt, passwordHash: password.hash, mustChangePassword: true, createdAt: now, updatedAt: now
    }));
  }
  dbReady = true;
}

function ensureDataFiles() {
  if (useSupabase) return ensureDatabase();
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(tasitDataFile)) atomicWrite(tasitDataFile, { records: [], fuelRecords: [], definitions: {} });
  if (!fs.existsSync(yazismaDataFile)) atomicWrite(yazismaDataFile, { records: [], updatedAt: null });
  if (!fs.existsSync(modulDataFile)) atomicWrite(modulDataFile, { asevi: [], dogrudanTemin: [], personel: [] });
  if (!fs.existsSync(usersFile)) {
    const password = hashPassword(initialAdminPassword);
    atomicWrite(usersFile, {
      users: [{
        id: crypto.randomUUID(), username: 'yonetici', fullName: 'Sistem Yöneticisi',
        title: 'Yönetici', active: true, permissions: { asevi: true, tasit: true, yazisma: true, dogrudanTemin: true, personel: true, users: true },
        salt: password.salt, passwordHash: password.hash, mustChangePassword: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }]
    });
  }
}

async function readJson(file, fallback) {
  await ensureDataFiles();
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temporary, file);
}

async function readState(key, fallback) {
  if (!useSupabase) return readJson(key === 'tasit' ? tasitDataFile : key === 'yazisma' ? yazismaDataFile : modulDataFile, fallback);
  await ensureDatabase();
  const result = await getPool().query('SELECT value FROM app_state WHERE key = $1', [key]);
  return result.rows[0]?.value || fallback;
}

async function writeState(key, value) {
  if (!useSupabase) {
    atomicWrite(key === 'tasit' ? tasitDataFile : key === 'yazisma' ? yazismaDataFile : modulDataFile, value);
    return;
  }
  await ensureDatabase();
  await getPool().query(
    'INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
    [key, JSON.stringify(value)]
  );
}

async function readUsers() {
  if (!useSupabase) return (await readJson(usersFile, { users: [] })).users || [];
  await ensureDatabase();
  const result = await getPool().query('SELECT * FROM app_users ORDER BY created_at ASC');
  return result.rows.map(dbUser);
}
async function writeUsers(users) {
  if (!useSupabase) { atomicWrite(usersFile, { users }); return; }
  await ensureDatabase();
  const pool = getPool();
  await pool.query('BEGIN');
  try {
    for (const user of users) {
      await pool.query(`
        INSERT INTO app_users
          (id, username, full_name, title, active, permissions, salt, password_hash, must_change_password, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          full_name = EXCLUDED.full_name,
          title = EXCLUDED.title,
          active = EXCLUDED.active,
          permissions = EXCLUDED.permissions,
          salt = EXCLUDED.salt,
          password_hash = EXCLUDED.password_hash,
          must_change_password = EXCLUDED.must_change_password,
          updated_at = EXCLUDED.updated_at
      `, dbUserValues(user));
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}
async function readTasItState() { return readState('tasit', { records: [], fuelRecords: [], definitions: {} }); }
async function writeTasItState(state) {
  await writeState('tasit', {
    records: Array.isArray(state.records) ? state.records : [],
    fuelRecords: Array.isArray(state.fuelRecords) ? state.fuelRecords : [],
    definitions: state.definitions && typeof state.definitions === 'object' ? state.definitions : {}
  });
}
async function readYazismaState() {
  const saved = await readState('yazisma', { records: [], updatedAt: null });
  return { records: Array.isArray(saved.records) ? saved.records : [], updatedAt: saved.updatedAt || null };
}
async function writeYazismaState(state) {
  await writeState('yazisma', { records: Array.isArray(state.records) ? state.records : [], updatedAt: new Date().toISOString() });
}
async function readModuleState() {
  const saved = await readState('modul', {});
  return { asevi: saved.asevi || [], dogrudanTemin: saved.dogrudanTemin || [], personel: saved.personel || [] };
}
async function writeModuleState(state) {
  await writeState('modul', {
    asevi: Array.isArray(state.asevi) ? state.asevi : [],
    dogrudanTemin: Array.isArray(state.dogrudanTemin) ? state.dogrudanTemin : [],
    personel: Array.isArray(state.personel) ? state.personel : []
  });
}

function requestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { reject(new Error('İstek boyutu sınırı aşıldı.')); request.destroy(); }
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new SyntaxError('Geçersiz istek.')); }
    });
    request.on('error', reject);
  });
}

function jsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  };
}
function sendJson(response, status, value, extra) {
  response.writeHead(status, jsonHeaders(extra));
  response.end(JSON.stringify(value));
}
function sendError(response, status, message) { sendJson(response, status, { ok: false, error: message }); }

function databaseDebugInfo() {
  const value = process.env.DATABASE_URL || '';
  const info = {
    databaseUrlPresent: Boolean(value),
    DATA_BACKEND: process.env.DATA_BACKEND || '',
    host: null,
    port: null,
    database: null,
    username: null
  };
  if (!value) return info;
  try {
    const parsed = new URL(value);
    info.host = parsed.hostname || null;
    info.port = parsed.port || null;
    info.database = parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || null : null;
    info.username = parsed.username ? decodeURIComponent(parsed.username) : null;
  } catch {
    info.host = 'DATABASE_URL okunamadi';
  }
  return info;
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const at = item.indexOf('=');
    return at < 0 ? [item, ''] : [item.slice(0, at), decodeURIComponent(item.slice(at + 1))];
  }));
}

async function currentUser(request) {
  if (authDisabled) return bypassUser;
  const token = parseCookies(request).sydv_session;
  if (!token) return null;
  if (useSupabase) {
    await ensureDatabase();
    await getPool().query('DELETE FROM app_sessions WHERE expires_at < now()');
    const result = await getPool().query(`
      SELECT u.* FROM app_sessions s
      JOIN app_users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now() AND u.active = true
    `, [token]);
    const user = dbUser(result.rows[0]);
    if (!user) { await getPool().query('DELETE FROM app_sessions WHERE token = $1', [token]); return null; }
    await getPool().query("UPDATE app_sessions SET expires_at = now() + interval '12 hours' WHERE token = $1", [token]);
    return user;
  }
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  const user = (await readUsers()).find(item => item.id === session.userId && item.active);
  if (!user) { sessions.delete(token); return null; }
  session.expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  return user;
}

function publicUser(user) {
  return {
    id: user.id, username: user.username, fullName: user.fullName, title: user.title || '',
    active: Boolean(user.active), permissions: user.permissions || {},
    mustChangePassword: Boolean(user.mustChangePassword), createdAt: user.createdAt, updatedAt: user.updatedAt
  };
}

async function requireUser(request, response, permission) {
  if (authDisabled) return bypassUser;
  const user = await currentUser(request);
  if (!user) { sendError(response, 401, 'Oturum açmanız gerekiyor.'); return null; }
  if (permission && !user.permissions?.[permission]) { sendError(response, 403, 'Bu işlem için yetkiniz bulunmuyor.'); return null; }
  return user;
}

function isInside(filePath, allowedRoot) {
  const file = path.resolve(filePath); const root = path.resolve(allowedRoot);
  return file === root || file.startsWith(root + path.sep);
}
function sendFile(response, filePath, allowedRoot) {
  if (!isInside(filePath, allowedRoot)) { response.writeHead(403); response.end('Erişim reddedildi.'); return; }
  fs.readFile(filePath, (error, data) => {
    if (error) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Dosya bulunamadı.'); return; }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(data);
  });
}

function sendYazismaProgram(response) {
  fs.readFile(yazismaFile, 'utf8', (error, source) => {
    if (error) { response.writeHead(404); response.end('Yazışma programı bulunamadı.'); return; }
    const bridge = `<script>(()=>{const k='sydv-yazisma-kayitlari',e='/api/yazisma-state',s=Storage.prototype.setItem;function y(v){try{const r=JSON.parse(v);if(Array.isArray(r))fetch(e,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:r})})}catch{}}Storage.prototype.setItem=function(a,v){s.call(this,a,v);if(this===localStorage&&a===k)y(v)};fetch(e,{cache:'no-store'}).then(r=>{if(r.status===401||r.status===403)throw new Error();return r.json()}).then(d=>{let l=[];try{l=JSON.parse(localStorage.getItem(k))||[]}catch{}const f=Array.isArray(d.records)?d.records:[];if(f.length&&JSON.stringify(f)!==JSON.stringify(l)){s.call(localStorage,k,JSON.stringify(f));location.reload()}else if(!f.length&&l.length)y(JSON.stringify(l))}).catch(()=>{})})();</script>`;
    const html = /<\/body>/i.test(source) ? source.replace(/<\/body>/i, bridge + '\n</body>') : source + bridge;
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(html);
  });
}

function cleanText(value, max = 200) { return String(value || '').trim().slice(0, max); }
function normalizePermissions(value = {}) {
  return { asevi: !!value.asevi, tasit: !!value.tasit, yazisma: !!value.yazisma, dogrudanTemin: !!value.dogrudanTemin, personel: !!value.personel, users: !!value.users };
}
async function invalidateUserSessions(userId) {
  if (useSupabase) { await ensureDatabase(); await getPool().query('DELETE FROM app_sessions WHERE user_id = $1', [userId]); return; }
  for (const [token, session] of sessions) if (session.userId === userId) sessions.delete(token);
}

async function handleAuthApi(request, response, pathname) {
  if (authDisabled) {
    if (pathname === '/api/session' && request.method === 'GET') {
      sendJson(response, 200, { authenticated: true, user: publicUser(bypassUser) });
      return true;
    }
    if (pathname === '/api/login' && request.method === 'POST') {
      sendJson(response, 200, { ok: true, user: publicUser(bypassUser) });
      return true;
    }
    if (pathname === '/api/logout' && request.method === 'POST') {
      sendJson(response, 200, { ok: true });
      return true;
    }
    if (pathname === '/api/change-password' && request.method === 'POST') {
      sendJson(response, 200, { ok: true, disabled: true });
      return true;
    }
  }
  if (pathname === '/api/session' && request.method === 'GET') {
    const user = await currentUser(request);
    sendJson(response, 200, { authenticated: !!user, user: user ? publicUser(user) : null });
    return true;
  }
  if (pathname === '/api/login' && request.method === 'POST') {
    const body = await requestBody(request);
    const username = cleanText(body.username, 60).toLocaleLowerCase('tr-TR');
    const user = (await readUsers()).find(item => item.username.toLocaleLowerCase('tr-TR') === username);
    if (!user || !user.active || !verifyPassword(body.password, user)) { sendError(response, 401, 'Kullanıcı adı veya şifre hatalı.'); return true; }
    const token = crypto.randomBytes(32).toString('hex');
    if (useSupabase) {
      await ensureDatabase();
      await getPool().query(
        "INSERT INTO app_sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '12 hours')",
        [token, user.id]
      );
    } else {
      sessions.set(token, { userId: user.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    }
    sendJson(response, 200, { ok: true, user: publicUser(user) }, { 'Set-Cookie': `sydv_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
    return true;
  }
  if (pathname === '/api/logout' && request.method === 'POST') {
    const token = parseCookies(request).sydv_session;
    if (token) {
      if (useSupabase) { await ensureDatabase(); await getPool().query('DELETE FROM app_sessions WHERE token = $1', [token]); }
      else sessions.delete(token);
    }
    sendJson(response, 200, { ok: true }, { 'Set-Cookie': 'sydv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    return true;
  }
  if (pathname === '/api/change-password' && request.method === 'POST') {
    const user = await requireUser(request, response); if (!user) return true;
    const body = await requestBody(request);
    if (!verifyPassword(body.currentPassword, user)) { sendError(response, 400, 'Mevcut şifre yanlış.'); return true; }
    if (String(body.newPassword || '').length < 8) { sendError(response, 400, 'Yeni şifre en az 8 karakter olmalıdır.'); return true; }
    const users = await readUsers(); const target = users.find(item => item.id === user.id); const password = hashPassword(body.newPassword);
    target.salt = password.salt; target.passwordHash = password.hash; target.mustChangePassword = false; target.updatedAt = new Date().toISOString();
    await writeUsers(users); sendJson(response, 200, { ok: true }); return true;
  }
  return false;
}

async function handleUsersApi(request, response, pathname) {
  if (!pathname.startsWith('/api/users')) return false;
  if (authDisabled) { sendError(response, 403, 'Kullanıcı yönetimi geçici olarak kapalı.'); return true; }
  const operator = await requireUser(request, response, 'users'); if (!operator) return true;
  const users = await readUsers();
  if (pathname === '/api/users' && request.method === 'GET') { sendJson(response, 200, { users: users.map(publicUser) }); return true; }
  if (pathname === '/api/users' && request.method === 'POST') {
    const body = await requestBody(request); const username = cleanText(body.username, 60);
    if (username.length < 3 || cleanText(body.fullName, 100).length < 2) { sendError(response, 400, 'Kullanıcı adı ve ad soyad alanlarını doldurun.'); return true; }
    if (String(body.password || '').length < 8) { sendError(response, 400, 'Şifre en az 8 karakter olmalıdır.'); return true; }
    if (users.some(item => item.username.toLocaleLowerCase('tr-TR') === username.toLocaleLowerCase('tr-TR'))) { sendError(response, 409, 'Bu kullanıcı adı zaten kullanılıyor.'); return true; }
    const password = hashPassword(body.password); const now = new Date().toISOString();
    const user = { id: crypto.randomUUID(), username, fullName: cleanText(body.fullName, 100), title: cleanText(body.title, 100), active: body.active !== false, permissions: normalizePermissions(body.permissions), salt: password.salt, passwordHash: password.hash, mustChangePassword: true, createdAt: now, updatedAt: now };
    users.push(user); await writeUsers(users); sendJson(response, 201, { ok: true, user: publicUser(user) }); return true;
  }
  const match = pathname.match(/^\/api\/users\/([a-f0-9-]+)$/i);
  if (match && request.method === 'PUT') {
    const body = await requestBody(request); const target = users.find(item => item.id === match[1]);
    if (!target) { sendError(response, 404, 'Kullanıcı bulunamadı.'); return true; }
    const username = cleanText(body.username, 60);
    if (username.length < 3 || cleanText(body.fullName, 100).length < 2) { sendError(response, 400, 'Kullanıcı adı ve ad soyad alanlarını doldurun.'); return true; }
    if (users.some(item => item.id !== target.id && item.username.toLocaleLowerCase('tr-TR') === username.toLocaleLowerCase('tr-TR'))) { sendError(response, 409, 'Bu kullanıcı adı zaten kullanılıyor.'); return true; }
    const nextPermissions = normalizePermissions(body.permissions); const nextActive = body.active !== false;
    const otherManagers = users.filter(item => item.id !== target.id && item.active && item.permissions?.users);
    if (target.permissions?.users && (!nextPermissions.users || !nextActive) && otherManagers.length === 0) { sendError(response, 400, 'Sistemde en az bir aktif kullanıcı yöneticisi kalmalıdır.'); return true; }
    target.username = username; target.fullName = cleanText(body.fullName, 100); target.title = cleanText(body.title, 100); target.active = nextActive; target.permissions = nextPermissions; target.updatedAt = new Date().toISOString();
    if (body.password) {
      if (String(body.password).length < 8) { sendError(response, 400, 'Şifre en az 8 karakter olmalıdır.'); return true; }
      const password = hashPassword(body.password); target.salt = password.salt; target.passwordHash = password.hash; target.mustChangePassword = true;
    }
    await writeUsers(users); if (target.id !== operator.id) await invalidateUserSessions(target.id);
    sendJson(response, 200, { ok: true, user: publicUser(target) }); return true;
  }
  sendError(response, 405, 'İşlem desteklenmiyor.'); return true;
}

function auditDirectTenderMarketControl(records, body) {
  if (!body || body.stage !== 'piyasaFiyatVeMaliyetKontrolu') return body;
  const requestList = records.find(item => item.id === body.sourceRequestListId && item.stage === 'talepListesi');
  const initialCalculation = records.find(item => item.id === (requestList?.sourceCalculationId || body.sourceInitialCalculationId) && item.stage === 'yaklasikMaliyetHesabi');
  const offerIds = Array.isArray(body.offerLetterIds) ? body.offerLetterIds.slice(0, 3) : [];
  const offers = offerIds.map(id => records.find(item => item.id === id && item.stage === 'teklifMektubu'));
  const baseItems = Array.isArray(requestList?.items) ? requestList.items : [];
  const distinctOffers = offerIds.length === 3 && offerIds.every(Boolean) && new Set(offerIds).size === 3;
  let complete = distinctOffers && baseItems.length > 0 && offers.every(offer => offer && ['Teklif Alındı', 'Tamamlandı'].includes(offer.status) && cleanText(offer.bidderName, 200));
  const items = baseItems.map((item, itemIndex) => {
    const quantity = Number(item.quantity) || 0;
    const prices = offers.map(offer => Number(offer?.items?.[itemIndex]?.unitPrice) || 0);
    if (prices.some(price => price <= 0)) complete = false;
    const average = prices.reduce((sum, price) => sum + price, 0) / 3;
    return { material: item.material || '', quantity: item.quantity || 0, unit: item.unit || '', prices, average, lineTotal: Number((quantity * average).toFixed(2)) };
  });
  const firmTotals = offers.map((offer, firmIndex) => Number(items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.prices[firmIndex]) || 0), 0).toFixed(2)));
  const firstEstimatedCost = Number(initialCalculation?.grandTotal) || Number(requestList?.grandTotal) || 0;
  const secondEstimatedCost = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const difference = Number((secondEstimatedCost - firstEstimatedCost).toFixed(2));
  const variancePercent = firstEstimatedCost ? Number((difference / firstEstimatedCost * 100).toFixed(2)) : 0;
  const canProceed = complete && secondEstimatedCost <= firstEstimatedCost + 0.004;
  const positiveTotals = firmTotals.map((value, index) => ({ value, index })).filter(item => item.value > 0);
  const winnerIndex = positiveTotals.length ? positiveTotals.reduce((best, item) => item.value < best.value ? item : best).index : -1;
  const winner = winnerIndex >= 0 ? offers[winnerIndex] : null;
  const approvedForNextStage = body.approvedForNextStage === true && canProceed;
  return {
    ...body,
    sourceInitialCalculationId: initialCalculation?.id || body.sourceInitialCalculationId || '',
    firmNames: offers.map((offer, index) => cleanText(offer?.bidderName, 200) || `${index + 1}. Firma`),
    firmAddresses: offers.map(offer => cleanText(offer?.bidderAddress, 500)),
    items, firmTotals, winnerIndex,
    winnerName: cleanText(winner?.bidderName, 200), winnerAddress: cleanText(winner?.bidderAddress, 500),
    winnerTotal: winnerIndex >= 0 ? firmTotals[winnerIndex] : 0,
    firstEstimatedCost, secondEstimatedCost, difference, variancePercent, complete, canProceed, approvedForNextStage,
    member1Name: cleanText(body.member1Name, 200) || cleanText(initialCalculation?.signer1Name, 200),
    member1Title: cleanText(body.member1Title, 200) || cleanText(initialCalculation?.signer1Title, 200),
    member2Name: cleanText(body.member2Name, 200) || cleanText(initialCalculation?.signer2Name, 200),
    member2Title: cleanText(body.member2Title, 200) || cleanText(initialCalculation?.signer2Title, 200),
    member3Name: cleanText(body.member3Name, 200) || cleanText(initialCalculation?.signer3Name, 200),
    member3Title: cleanText(body.member3Title, 200) || cleanText(initialCalculation?.signer3Title, 200),
    workflowStatus: !complete ? 'Teklifler Eksik' : canProceed ? (approvedForNextStage ? 'İhaleye Devam Onayı Verildi' : 'Kontrol Uygun') : 'İhale Devam Edemez'
  };
}

async function handleModuleApi(request, response, pathname) {
  const match = pathname.match(/^\/api\/modules\/([A-Za-z]+)(?:\/([a-f0-9-]+))?$/i);
  if (!match) return false;
  const moduleKey = MODULE_ALIASES[match[1]];
  if (!moduleKey) { sendError(response, 404, 'Modül bulunamadı.'); return true; }
  const user = await requireUser(request, response, moduleKey); if (!user) return true;
  const state = await readModuleState(); const records = state[moduleKey]; const recordId = match[2];
  if (request.method === 'GET' && !recordId) { sendJson(response, 200, { records }); return true; }
  if (request.method === 'POST' && !recordId) {
    let body = await requestBody(request);
    const approvalRequested = body.stage === 'piyasaFiyatVeMaliyetKontrolu' && body.approvedForNextStage === true;
    if (moduleKey === 'dogrudanTemin') body = auditDirectTenderMarketControl(records, body);
    if (approvalRequested && !body.canProceed) { sendError(response, 409, 'İkinci yaklaşık maliyet ilk yaklaşık maliyeti aştığı için ihaleye devam edilemez.'); return true; }
    const now = new Date().toISOString();
    const record = { ...body, id: crypto.randomUUID(), createdAt: now, updatedAt: now, createdBy: user.fullName };
    delete record.password; records.unshift(record); await writeModuleState(state); sendJson(response, 201, { ok: true, record }); return true;
  }
  const index = records.findIndex(item => item.id === recordId);
  if (index < 0) { sendError(response, 404, 'Kayıt bulunamadı.'); return true; }
  if (request.method === 'PUT') {
    let body = await requestBody(request);
    const approvalRequested = body.stage === 'piyasaFiyatVeMaliyetKontrolu' && body.approvedForNextStage === true;
    if (moduleKey === 'dogrudanTemin') body = auditDirectTenderMarketControl(records, body);
    if (approvalRequested && !body.canProceed) { sendError(response, 409, 'İkinci yaklaşık maliyet ilk yaklaşık maliyeti aştığı için ihaleye devam edilemez.'); return true; }
    records[index] = { ...records[index], ...body, id: recordId, updatedAt: new Date().toISOString() };
    await writeModuleState(state); sendJson(response, 200, { ok: true, record: records[index] }); return true;
  }
  if (request.method === 'DELETE') { records.splice(index, 1); await writeModuleState(state); sendJson(response, 200, { ok: true }); return true; }
  sendError(response, 405, 'İşlem desteklenmiyor.'); return true;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    const pathname = decodeURIComponent(url.pathname);
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (await handleAuthApi(request, response, pathname)) return;
    if (await handleUsersApi(request, response, pathname)) return;
    if (await handleModuleApi(request, response, pathname)) return;

    if (pathname === '/api/health') { sendJson(response, 200, { ok: true, service: 'goksun-sydv-yonetim-sistemi' }); return; }
    if (pathname === '/api/db-debug' && request.method === 'GET') { sendJson(response, 200, databaseDebugInfo()); return; }
    if (pathname === '/api/summary' && request.method === 'GET') {
      const user = await requireUser(request, response); if (!user) return;
      const tasit = await readTasItState(), yazisma = await readYazismaState(), modules = await readModuleState();
      sendJson(response, 200, { tasit: tasit.records.length, yazisma: yazisma.records.length, asevi: modules.asevi.length, dogrudanTemin: modules.dogrudanTemin.length, personel: modules.personel.length }); return;
    }
    if (pathname === '/api/state') {
      if (!await requireUser(request, response, 'tasit')) return;
      if (request.method === 'GET') { sendJson(response, 200, await readTasItState()); return; }
      if (request.method === 'PUT' || request.method === 'POST') { await writeTasItState(await requestBody(request)); sendJson(response, 200, { ok: true }); return; }
      sendError(response, 405, 'İşlem desteklenmiyor.'); return;
    }
    if (pathname === '/api/yazisma-state') {
      if (!await requireUser(request, response, 'yazisma')) return;
      if (request.method === 'GET') { sendJson(response, 200, await readYazismaState()); return; }
      if (request.method === 'PUT' || request.method === 'POST') { await writeYazismaState(await requestBody(request)); sendJson(response, 200, { ok: true }); return; }
      sendError(response, 405, 'İşlem desteklenmiyor.'); return;
    }

    if (pathname === '/') { sendFile(response, path.join(rootDir, 'index.html'), rootDir); return; }
    if (pathname === '/tasit' || pathname === '/tasit/') { if (!await requireUser(request, response, 'tasit')) return; sendFile(response, path.join(tasitDir, 'index.html'), tasitDir); return; }
    if (pathname.startsWith('/tasit/')) { if (!await requireUser(request, response, 'tasit')) return; sendFile(response, path.join(tasitDir, pathname.slice('/tasit/'.length)), tasitDir); return; }
    if (pathname === '/yazisma' || pathname === '/yazisma/') { if (!await requireUser(request, response, 'yazisma')) return; sendYazismaProgram(response); return; }
    if (pathname === '/dogrudan-temin' || pathname === '/dogrudan-temin/') { if (!await requireUser(request, response, 'dogrudanTemin')) return; sendFile(response, path.join(dogrudanTeminDir, 'index.html'), dogrudanTeminDir); return; }
    if (pathname.startsWith('/dogrudan-temin/')) { if (!await requireUser(request, response, 'dogrudanTemin')) return; sendFile(response, path.join(dogrudanTeminDir, pathname.slice('/dogrudan-temin/'.length)), dogrudanTeminDir); return; }
    if (pathname === '/modul' || pathname === '/modul/') {
      const moduleKey = MODULE_ALIASES[url.searchParams.get('tip')];
      if (!moduleKey) { sendError(response, 404, 'Modül bulunamadı.'); return; }
      if (!await requireUser(request, response, moduleKey)) return;
      sendFile(response, modulFile, path.dirname(modulFile)); return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Sayfa bulunamadı.');
  } catch (error) {
    sendError(response, error instanceof SyntaxError ? 400 : 500, error.message || 'Beklenmeyen bir hata oluştu.');
  }
});

function openBrowser() {
  if (process.platform === 'win32' && process.env.OPEN_BROWSER !== '0') exec(`start "" "http://127.0.0.1:${port}"`, { shell: 'cmd.exe', windowsHide: true });
}
if (!isVercel) {
server.listen(port, '127.0.0.1', () => {
  Promise.resolve(ensureDataFiles()).catch(error => console.error(error.message));
  console.log('Göksun SYDV Yönetim Sistemi çalışıyor.');
  console.log(`Ana menü: http://127.0.0.1:${port}`);
  console.log('Programı kapatmak için bu pencereyi kapatın.');
  setTimeout(openBrowser, 400);
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') { console.log(`Program zaten çalışıyor: http://127.0.0.1:${port}`); openBrowser(); setTimeout(() => process.exit(0), 500); return; }
  console.error(error.message); process.exit(1);
});
}

module.exports = server;
