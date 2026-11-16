// server.js - เซิร์ฟเวอร์สำหรับ index.html (แชตคนใกล้ตัว สมุทรสงคราม)
// ไม่ต้องติดตั้งแพ็กเกจเพิ่ม ใช้ Node.js 16 ขึ้นไป
// รัน: ADMIN_KEY=รหัสของคุณ node server.js   แล้วเปิด https://2558mp2558.github.io
const http = require('https://2558mp2558.github.io'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'm159357p';
const DATA = path.join(__dirname, 'data.json');
const MEDIA_TTL = 60 * 60 * 1000; // รูป/เสียงหมดอายุใน 1 ชม.
const MAX_MSGS = 300, MAX_DMS = 2000;

let db = { msgs: { general: [], checkpoint: [] }, dms: [], bans: {}, pics: {}, announce: null };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch (e) {}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(function () { fs.writeFile(DATA, JSON.stringify(db), function () {}); }, 1500); }

const users = new Map(); // id -> {conns:Set, n, d, adm}
const lastSend = new Map();

// ---------- บอทแชต 50 ตัว คุยกันตลอดวัน (ห้องแชตทั่วไปเท่านั้น) ----------
const BOTS = ["น้องฟ้า","พี่โจ้","ลุงชาติ","ป้าแต๋ว","น้ำฝน","บอยแม่กลอง","แพรวา","ต้นกล้า","ครูหนุ่ม","เจ๊อ้อย","หมูหยอง","ไก่ทอด","มะลิ","พิมพ์","โอ๊ต","เบสท์","กานต์","นุ่น","ปลาทู","ส้มโอ","ลิ้นจี่","ตาโต","อาร์ม","แจม","กุ้ง","ปอนด์","ฝ้าย","เมษา","ตุ๊กตา","บอสน้อย","ลุงสมชัย","พี่หนึ่ง","น้องเมย์","ครูแอน","เจ้ปุ๊","แม็ก","มินท์","เก่ง","ใบเตย","จ๋า","ฟิล์ม","ก้อง","บีม","ออมสิน","เนย","ภูมิ","ทราย","โบว์","ไผ่","ข้าวปั้น"].map(function (n, i) { return { id: 'bot' + i, n: n, d: i % 3, pv: 0, adm: false, bot: true }; });
const BOTMAP = {}; BOTS.forEach(function (b) { BOTMAP[b.id] = b; });
const pick = a => a[Math.floor(Math.random() * a.length)];
const SCRIPTS = [
["วันนี้อากาศดีจังเลย","จริง ลมเย็นๆ เหมาะกับไปตลาดน้ำอัมพวา","ไปกี่โมงดี ไปเช้าๆ ไหม","ไปสักแปดโมงกำลังดี คนยังไม่เยอะ"],
["มีใครรู้ร้านปลาทูแม่กลองอร่อยๆ ไหม","ร้านแถวตลาดแม่กลองนี่แหละ ปลาทูตัวมันเลย","ขอบคุณนะ เดี๋ยวไปลอง","ไปแล้วอย่าลืมซื้อน้ำพริกกลับบ้านด้วย"],
["ใครไปตลาดร่มหุบมาบ้าง","ไปเมื่อวาน รถไฟวิ่งผ่านตื่นเต้นมาก","คนเยอะไหม","เยอะพอสมควร ไปเช้าดีกว่านะ"],
["ส้มโอบ้านเราหวานจริงๆ","ใช่ ซื้อฝากที่ทำงานทุกทีเลย","เปลือกหนาแต่เนื้อฉ่ำมาก"],
["เย็นนี้ฝนจะตกไหม ฟ้าเริ่มครึ้มแล้ว","เห็นเมฆเยอะเหมือนกัน พกร่มไปดีกว่า","โอเค ขอบคุณที่เตือน"],
["หิวแล้ว วันนี้กินอะไรดี","ก๋วยเตี๋ยวเรือไหม","เอาสิ เส้นเล็กน้ำตกใช่ไหม","ใช่เลย ใส่หมูกรอบด้วย"],
["ไปดูหิ่งห้อยที่อัมพวากันไหมสุดสัปดาห์นี้","ดีเลย ต้องจองเรือก่อนหรือเปล่า","จองไว้ก่อนดีกว่า ช่วงเสาร์อาทิตย์คนเยอะ","โอเค เดี๋ยวโทรจองให้"],
["กาแฟร้านใหม่แถวบางคนทีใครเคยลองบ้าง","เคยไปแล้ว ร้านน่ารัก กาแฟหอมดี","ราคาโอเคไหม","โอเคเลย แก้วละไม่ถึงร้อย"],
["ถนนช่วงนี้รถเยอะไหม จะออกจากบ้านตอนบ่าย","ตอนบ่ายโล่งๆ แต่เย็นๆ เริ่มติด","งั้นออกก่อนสี่โมงดีกว่า"],
["สุดสัปดาห์นี้มีงานวัดแถวไหนบ้างไหม","ยังไม่เห็นประกาศเลย ถ้าเจอบอกด้วยนะ","ได้เลย เดี๋ยวมาอัปเดต"],
["มะพร้าวน้ำหอมบ้านเรานี่หวานเย็นชื่นใจ","ซื้อกินริมทางทุกวันเลย","วันละลูกสบายๆ"],
["เมื่อคืนนอนหลับสบายไหม","หลับสบาย ลมเย็นดี","ดีจัง ฉันตื่นมาตั้งแต่ตีห้า"]
];
const FILL = ["สวัสดีทุกคน","555 ขำมาก","จริงด้วย","เห็นด้วยเลย","ขอบคุณครับ","โอเคเลย","ว้าว น่าไปมาก","ใครมีที่แนะนำบ้างไหม","วันนี้ยุ่งทั้งวันเลย","เดี๋ยวมาใหม่นะ","สู้ๆ นะทุกคน","น่ารักจัง"];
const DM_REPLY = ["สวัสดีครับ ผมเป็นบอทประจำห้องแชต ยังคุยได้ไม่เยอะ 🤖","ขอบคุณที่ทักนะ แต่ผมเป็นบอทครับ","ได้รับข้อความแล้วครับ ผมเป็นบอทเลยตอบได้แค่นี้ 🤖"];
function botSay(b, t, ts) {
  const m = { u: b.id, n: b.n, d: b.d, r: 'general', k: 't', t: t, ts: ts || Date.now(), adm: false, pv: 0, bot: true };
  db.msgs.general.push(m);
  while (db.msgs.general.length > MAX_MSGS) db.msgs.general.shift();
  save(); toAll('msg', m);
}
function timeLines() {
  const h = (new Date().getUTCHours() + 7) % 24, a = FILL.slice(); // เวลาไทย
  if (h >= 5 && h < 11) a.push('อรุณสวัสดิ์ทุกคน ☀️', 'ตื่นแล้ว วันนี้ไปตลาดเช้ากันไหม');
  else if (h >= 11 && h < 14) a.push('พักเที่ยงแล้ว ทุกคนกินข้าวหรือยัง', 'เที่ยงนี้กินอะไรกันดี');
  else if (h >= 14 && h < 17) a.push('บ่ายแล้ว ง่วงจัง ต้องกินกาแฟ', 'แดดร้อนมาก ระวังด้วยนะทุกคน');
  else if (h >= 17 && h < 21) a.push('เลิกงานแล้ว วันนี้เหนื่อยไหม', 'เย็นนี้ลมเย็นดี น่าไปเดินเล่น');
  else a.push('ดึกแล้ว ฝันดีทุกคนนะ 🌙', 'ยังไม่นอนอีกหรือ');
  return a;
}
let script = null, si = 0, pa = null, pb = null;
function botTick() {
  let gap = 7000 + Math.random() * 15000;
  if (!script && Math.random() >= 0.3) { script = pick(SCRIPTS); si = 0; pa = pick(BOTS); do { pb = pick(BOTS); } while (pb === pa); }
  if (script) { botSay(si % 2 ? pb : pa, script[si]); si++; if (si >= script.length) { script = null; gap = 15000 + Math.random() * 30000; } }
  else botSay(pick(BOTS), pick(timeLines()));
  setTimeout(botTick, gap);
}
function botStart() {
  const recent = db.msgs.general.some(function (m) { return m.bot && Date.now() - m.ts < 3600000; });
  if (!recent) {
    let t = Date.now() - 5400000;
    for (let q = 0; q < 5; q++) {
      const sc = pick(SCRIPTS), a = pick(BOTS); let b = pick(BOTS);
      if (a === b) b = BOTS[(+a.id.slice(3) + 1) % BOTS.length];
      sc.forEach(function (l, i) { t += 30000 + Math.random() * 60000; botSay(i % 2 ? b : a, l, t); });
      t += 600000;
    }
  }
  setTimeout(botTick, 3000);
}
const uidOf = tk => crypto.createHash('sha256').update(tk).digest('hex').slice(0, 16);
const okTk = tk => typeof tk === 'string' && /^[0-9a-f]{16,100}$/.test(tk);
function isAdmin(ak) {
  if (!ADMIN_KEY || typeof ak !== 'string') return false;
  const a = Buffer.from(ak), b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const pvOf = id => (db.pics[id] ? db.pics[id].v : 0);
const banOf = id => (db.bans[id] > Date.now() ? db.bans[id] : 0);

function sse(res, ev, data) { res.write('event: ' + ev + '\ndata: ' + JSON.stringify(data) + '\n\n'); }
function toUsers(ids, ev, data) {
  ids.forEach(function (id) { const u = users.get(id); if (u) u.conns.forEach(function (r) { sse(r, ev, data); }); });
}
function toAll(ev, data) { users.forEach(function (u) { u.conns.forEach(function (r) { sse(r, ev, data); }); }); }
function toAdmins(ev, data) { users.forEach(function (u) { if (u.adm) u.conns.forEach(function (r) { sse(r, ev, data); }); }); }
function people() {
  const out = [];
  users.forEach(function (u, id) {
    if (u.conns.size && u.d !== undefined) out.push({ id: id, n: u.n, d: u.d, pv: pvOf(id), adm: !!u.adm });
  });
  return out.concat(BOTS);
}
const pushPeople = () => toAll('people', people());

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let size = 0; const chunks = [];
  req.on('data', function (c) { size += c.length; if (size > 1200000) { req.destroy(); return; } chunks.push(c); });
  req.on('end', function () { try { cb(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { cb(null); } });
}

// ตรวจเนื้อหาข้อความ (ข้อความ/รูป/เสียง) คืนค่า object หรือ null
function content(b) {
  if (b.k === 'i') {
    if (typeof b.im === 'string' && b.im.indexOf('data:image/jpeg;base64,') === 0 && b.im.length <= 200000) return { k: 'i', im: b.im };
    return null;
  }
  if (b.k === 'v') {
    if (typeof b.au === 'string' && b.au.indexOf('data:audio/') === 0 && b.au.length <= 230000) {
      return { k: 'v', au: b.au, dur: Math.max(1, Math.min(15, Math.round(+b.dur || 1))) };
    }
    return null;
  }
  const t = clean(b.t, 200);
  return t ? { k: 't', t: t } : null;
}

function handleApi(req, res, route) {
  readBody(req, function (b) {
    if (!b || !okTk(b.tk)) return json(res, 400, { error: 'bad' });
    const id = uidOf(b.tk), u = users.get(id), adm = isAdmin(b.ak);
    const name = clean(b.n, 12) || (u && u.n) || 'ผู้ใช้';

    if (route === 'presence') {
      if (u) {
        u.n = name; u.adm = adm;
        if (b.d === 0 || b.d === 1 || b.d === 2) u.d = b.d;
        pushPeople();
      }
      return json(res, 200, { pv: pvOf(id) });
    }

    if (route === 'pic') {
      if (typeof b.pic !== 'string' || b.pic.indexOf('data:image/jpeg;base64,') !== 0 || b.pic.length > 60000) return json(res, 400, { error: 'bad' });
      db.pics[id] = { v: Date.now(), data: b.pic }; save(); pushPeople();
      return json(res, 200, { pv: db.pics[id].v });
    }

    if (route === 'announce') {
      if (!adm) return json(res, 403, { error: 'forbidden' });
      db.announce = { t: clean(b.t, 150), ts: Date.now() };
      save(); toAll('announce', db.announce);
      return json(res, 200, { ok: true });
    }

    if (route === 'ban') {
      if (!adm) return json(res, 403, { error: 'forbidden' });
      const t = String(b.target || ''), mins = Math.max(0, Math.min(1440, +b.mins || 0));
      const tu = users.get(t);
      if (!t || t === id || BOTMAP[t] || (tu && tu.adm)) return json(res, 400, { error: 'bad' });
      if (mins) db.bans[t] = Date.now() + mins * 60000; else delete db.bans[t];
      save();
      toUsers([t], 'ban', { until: banOf(t) });
      toAdmins('bans', db.bans);
      return json(res, 200, { ok: true });
    }

    if (route === 'send' || route === 'dm') {
      const bn = banOf(id);
      if (bn) return json(res, 403, { error: 'banned', until: bn });
      const now = Date.now();
      if (now - (lastSend.get(id) || 0) < 700) return json(res, 429, { error: 'rate' });
      lastSend.set(id, now);
      const c = content(b);
      if (!c) return json(res, 400, { error: 'bad' });

      if (route === 'send') {
        if (!(b.d === 0 || b.d === 1 || b.d === 2)) return json(res, 400, { error: 'bad' });
        const r = b.r === 'checkpoint' ? 'checkpoint' : 'general';
        const m = Object.assign({ u: id, n: name, d: b.d, r: r, ts: now, adm: adm, pv: pvOf(id) }, c);
        const list = db.msgs[r]; list.push(m);
        while (list.length > MAX_MSGS) list.shift();
        save(); toAll('msg', m);
        return json(res, 200, { ok: true });
      }

      const to = String(b.to || '');
      if (!to || to === id) return json(res, 400, { error: 'bad' });
      const m = Object.assign({ a: id, b: to, an: name, adm: adm, pv: pvOf(id), ts: now }, c);
      db.dms.push(m);
      while (db.dms.length > MAX_DMS) db.dms.shift();
      save(); toUsers([id, to], 'dm', m);
      const bb = BOTMAP[to];
      if (bb) setTimeout(function () {
        const r = { a: to, b: id, an: bb.n, adm: false, pv: 0, ts: Date.now(), k: 't', t: pick(DM_REPLY), bot: true };
        db.dms.push(r); save(); toUsers([id], 'dm', r);
      }, 1500 + Math.random() * 2500);
      return json(res, 200, { ok: true });
    }

    json(res, 404, { error: 'not found' });
  });
}

function handleEvents(req, res, q) {
  const tk = q.get('tk');
  if (!okTk(tk)) { res.writeHead(400); return res.end(); }
  const id = uidOf(tk), adm = isAdmin(q.get('ak'));
  req.socket.setTimeout(0);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  let u = users.get(id);
  if (!u) { u = { conns: new Set() }; users.set(id, u); }
  u.conns.add(res); u.adm = adm;
  sse(res, 'init', {
    me: { id: id, admin: adm, ban: banOf(id), pv: pvOf(id) },
    msgs: db.msgs,
    people: people(),
    dms: db.dms.filter(function (m) { return m.a === id || m.b === id; }),
    bans: adm ? db.bans : {},
    announce: db.announce
  });
  pushPeople();
  const ka = setInterval(function () { res.write(': ping\n\n'); }, 25000);
  req.on('close', function () {
    clearInterval(ka); u.conns.delete(res);
    if (!u.conns.size) users.delete(id);
    pushPeople();
  });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'https://2558mp2558.github.io'), p = url.pathname;
  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    return fs.readFile(path.join(__dirname, 'index.html'), function (e, d) {
      if (e) { res.writeHead(404); return res.end('ไม่พบ index.html (วางไว้โฟลเดอร์เดียวกับ server.js)'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
    });
  }
  if (req.method === 'GET' && p === '/events') return handleEvents(req, res, url.searchParams);
  if (req.method === 'GET' && p.indexOf('/pic/') === 0) {
    const pic = db.pics[p.slice(5)];
    if (!pic) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000' });
    return res.end(Buffer.from(pic.data.split(',')[1], 'base64'));
  }
  if (req.method === 'POST' && p.indexOf('/api/') === 0) return handleApi(req, res, p.slice(5));
  res.writeHead(404); res.end();
});

// ลบรูป/เสียงที่หมดอายุ
setInterval(function () {
  const now = Date.now(); let ch = false;
  function sweep(m) { if ((m.im || m.au) && now - m.ts > MEDIA_TTL) { delete m.im; delete m.au; m.exp = true; ch = true; } }
  db.msgs.general.forEach(sweep); db.msgs.checkpoint.forEach(sweep); db.dms.forEach(sweep);
  if (ch) save();
}, 60000);

server.listen(PORT, function () {
  botStart();
  console.log('https://2558mp2558.github.io:' + PORT);
  if (!ADMIN_KEY) console.log('ยังไม่ได้ตั้ง ADMIN_KEY จึงใช้ระบบแอดมินไม่ได้');
});
