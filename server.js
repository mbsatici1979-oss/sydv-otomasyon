const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
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

const MODULES = ['asevi', 'tasit', 'yazisma', 'dogrudanTemin', 'personel'];
const MODULE_ALIASES = { asevi: 'asevi', dogrudanTemin: 'dogrudanTemin', personel: 'personel' };
const sessions = new Map();

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

function ensureDataFiles() {
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

function readJson(file, fallback) {
  ensureDataFiles();
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temporary, file);
}

function readUsers() { return readJson(usersFile, { users: [] }).users || []; }
function writeUsers(users) { atomicWrite(usersFile, { users }); }
function readTasItState() { return readJson(tasitDataFile, { records: [], fuelRecords: [], definitions: {} }); }
function writeTasItState(state) {
  atomicWrite(tasitDataFile, {
    records: Array.isArray(state.records) ? state.records : [],
    fuelRecords: Array.isArray(state.fuelRecords) ? state.fuelRecords : [],
    definitions: state.definitions && typeof state.definitions === 'object' ? state.definitions : {}
  });
}
function readYazismaState() {
  const saved = readJson(yazismaDataFile, { records: [], updatedAt: null });
  return { records: Array.isArray(saved.records) ? saved.records : [], updatedAt: saved.updatedAt || null };
}
function writeYazismaState(state) {
  atomicWrite(yazismaDataFile, { records: Array.isArray(state.records) ? state.records : [], updatedAt: new Date().toISOString() });
}
function readModuleState() {
  const saved = readJson(modulDataFile, {});
  return { asevi: saved.asevi || [], dogrudanTemin: saved.dogrudanTemin || [], personel: saved.personel || [] };
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

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const at = item.indexOf('=');
    return at < 0 ? [item, ''] : [item.slice(0, at), decodeURIComponent(item.slice(at + 1))];
  }));
}

function currentUser(request) {
  const token = parseCookies(request).sydv_session;
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  const user = readUsers().find(item => item.id === session.userId && item.active);
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

function requireUser(request, response, permission) {
  const user = currentUser(request);
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
function invalidateUserSessions(userId) {
  for (const [token, session] of sessions) if (session.userId === userId) sessions.delete(token);
}

async function handleAuthApi(request, response, pathname) {
  if (pathname === '/api/session' && request.method === 'GET') {
    const user = currentUser(request);
    sendJson(response, 200, { authenticated: !!user, user: user ? publicUser(user) : null });
    return true;
  }
  if (pathname === '/api/login' && request.method === 'POST') {
    const body = await requestBody(request);
    const username = cleanText(body.username, 60).toLocaleLowerCase('tr-TR');
    const user = readUsers().find(item => item.username.toLocaleLowerCase('tr-TR') === username);
    if (!user || !user.active || !verifyPassword(body.password, user)) { sendError(response, 401, 'Kullanıcı adı veya şifre hatalı.'); return true; }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    sendJson(response, 200, { ok: true, user: publicUser(user) }, { 'Set-Cookie': `sydv_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
    return true;
  }
  if (pathname === '/api/logout' && request.method === 'POST') {
    const token = parseCookies(request).sydv_session;
    if (token) sessions.delete(token);
    sendJson(response, 200, { ok: true }, { 'Set-Cookie': 'sydv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    return true;
  }
  if (pathname === '/api/change-password' && request.method === 'POST') {
    const user = requireUser(request, response); if (!user) return true;
    const body = await requestBody(request);
    if (!verifyPassword(body.currentPassword, user)) { sendError(response, 400, 'Mevcut şifre yanlış.'); return true; }
    if (String(body.newPassword || '').length < 8) { sendError(response, 400, 'Yeni şifre en az 8 karakter olmalıdır.'); return true; }
    const users = readUsers(); const target = users.find(item => item.id === user.id); const password = hashPassword(body.newPassword);
    target.salt = password.salt; target.passwordHash = password.hash; target.mustChangePassword = false; target.updatedAt = new Date().toISOString();
    writeUsers(users); sendJson(response, 200, { ok: true }); return true;
  }
  return false;
}

async function handleUsersApi(request, response, pathname) {
  if (!pathname.startsWith('/api/users')) return false;
  const operator = requireUser(request, response, 'users'); if (!operator) return true;
  const users = readUsers();
  if (pathname === '/api/users' && request.method === 'GET') { sendJson(response, 200, { users: users.map(publicUser) }); return true; }
  if (pathname === '/api/users' && request.method === 'POST') {
    const body = await requestBody(request); const username = cleanText(body.username, 60);
    if (username.length < 3 || cleanText(body.fullName, 100).length < 2) { sendError(response, 400, 'Kullanıcı adı ve ad soyad alanlarını doldurun.'); return true; }
    if (String(body.password || '').length < 8) { sendError(response, 400, 'Şifre en az 8 karakter olmalıdır.'); return true; }
    if (users.some(item => item.username.toLocaleLowerCase('tr-TR') === username.toLocaleLowerCase('tr-TR'))) { sendError(response, 409, 'Bu kullanıcı adı zaten kullanılıyor.'); return true; }
    const password = hashPassword(body.password); const now = new Date().toISOString();
    const user = { id: crypto.randomUUID(), username, fullName: cleanText(body.fullName, 100), title: cleanText(body.title, 100), active: body.active !== false, permissions: normalizePermissions(body.permissions), salt: password.salt, passwordHash: password.hash, mustChangePassword: true, createdAt: now, updatedAt: now };
    users.push(user); writeUsers(users); sendJson(response, 201, { ok: true, user: publicUser(user) }); return true;
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
    writeUsers(users); if (target.id !== operator.id) invalidateUserSessions(target.id);
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
  const user = requireUser(request, response, moduleKey); if (!user) return true;
  const state = readModuleState(); const records = state[moduleKey]; const recordId = match[2];
  if (request.method === 'GET' && !recordId) { sendJson(response, 200, { records }); return true; }
  if (request.method === 'POST' && !recordId) {
    let body = await requestBody(request);
    const approvalRequested = body.stage === 'piyasaFiyatVeMaliyetKontrolu' && body.approvedForNextStage === true;
    if (moduleKey === 'dogrudanTemin') body = auditDirectTenderMarketControl(records, body);
    if (approvalRequested && !body.canProceed) { sendError(response, 409, 'İkinci yaklaşık maliyet ilk yaklaşık maliyeti aştığı için ihaleye devam edilemez.'); return true; }
    const now = new Date().toISOString();
    const record = { ...body, id: crypto.randomUUID(), createdAt: now, updatedAt: now, createdBy: user.fullName };
    delete record.password; records.unshift(record); atomicWrite(modulDataFile, state); sendJson(response, 201, { ok: true, record }); return true;
  }
  const index = records.findIndex(item => item.id === recordId);
  if (index < 0) { sendError(response, 404, 'Kayıt bulunamadı.'); return true; }
  if (request.method === 'PUT') {
    let body = await requestBody(request);
    const approvalRequested = body.stage === 'piyasaFiyatVeMaliyetKontrolu' && body.approvedForNextStage === true;
    if (moduleKey === 'dogrudanTemin') body = auditDirectTenderMarketControl(records, body);
    if (approvalRequested && !body.canProceed) { sendError(response, 409, 'İkinci yaklaşık maliyet ilk yaklaşık maliyeti aştığı için ihaleye devam edilemez.'); return true; }
    records[index] = { ...records[index], ...body, id: recordId, updatedAt: new Date().toISOString() };
    atomicWrite(modulDataFile, state); sendJson(response, 200, { ok: true, record: records[index] }); return true;
  }
  if (request.method === 'DELETE') { records.splice(index, 1); atomicWrite(modulDataFile, state); sendJson(response, 200, { ok: true }); return true; }
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
    if (pathname === '/api/summary' && request.method === 'GET') {
      const user = requireUser(request, response); if (!user) return;
      const tasit = readTasItState(), yazisma = readYazismaState(), modules = readModuleState();
      sendJson(response, 200, { tasit: tasit.records.length, yazisma: yazisma.records.length, asevi: modules.asevi.length, dogrudanTemin: modules.dogrudanTemin.length, personel: modules.personel.length }); return;
    }
    if (pathname === '/api/state') {
      if (!requireUser(request, response, 'tasit')) return;
      if (request.method === 'GET') { sendJson(response, 200, readTasItState()); return; }
      if (request.method === 'PUT' || request.method === 'POST') { writeTasItState(await requestBody(request)); sendJson(response, 200, { ok: true }); return; }
      sendError(response, 405, 'İşlem desteklenmiyor.'); return;
    }
    if (pathname === '/api/yazisma-state') {
      if (!requireUser(request, response, 'yazisma')) return;
      if (request.method === 'GET') { sendJson(response, 200, readYazismaState()); return; }
      if (request.method === 'PUT' || request.method === 'POST') { writeYazismaState(await requestBody(request)); sendJson(response, 200, { ok: true }); return; }
      sendError(response, 405, 'İşlem desteklenmiyor.'); return;
    }

    if (pathname === '/') { sendFile(response, path.join(rootDir, 'index.html'), rootDir); return; }
    if (pathname === '/tasit' || pathname === '/tasit/') { if (!requireUser(request, response, 'tasit')) return; sendFile(response, path.join(tasitDir, 'index.html'), tasitDir); return; }
    if (pathname.startsWith('/tasit/')) { if (!requireUser(request, response, 'tasit')) return; sendFile(response, path.join(tasitDir, pathname.slice('/tasit/'.length)), tasitDir); return; }
    if (pathname === '/yazisma' || pathname === '/yazisma/') { if (!requireUser(request, response, 'yazisma')) return; sendYazismaProgram(response); return; }
    if (pathname === '/dogrudan-temin' || pathname === '/dogrudan-temin/') { if (!requireUser(request, response, 'dogrudanTemin')) return; sendFile(response, path.join(dogrudanTeminDir, 'index.html'), dogrudanTeminDir); return; }
    if (pathname.startsWith('/dogrudan-temin/')) { if (!requireUser(request, response, 'dogrudanTemin')) return; sendFile(response, path.join(dogrudanTeminDir, pathname.slice('/dogrudan-temin/'.length)), dogrudanTeminDir); return; }
    if (pathname === '/modul' || pathname === '/modul/') {
      const moduleKey = MODULE_ALIASES[url.searchParams.get('tip')];
      if (!moduleKey) { sendError(response, 404, 'Modül bulunamadı.'); return; }
      if (!requireUser(request, response, moduleKey)) return;
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
server.listen(port, '127.0.0.1', () => {
  ensureDataFiles();
  console.log('Göksun SYDV Yönetim Sistemi çalışıyor.');
  console.log(`Ana menü: http://127.0.0.1:${port}`);
  console.log('Programı kapatmak için bu pencereyi kapatın.');
  setTimeout(openBrowser, 400);
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') { console.log(`Program zaten çalışıyor: http://127.0.0.1:${port}`); openBrowser(); setTimeout(() => process.exit(0), 500); return; }
  console.error(error.message); process.exit(1);
});
