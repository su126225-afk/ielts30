// IELTS 30 kun: o'quvchi sahifalari (kunlar xaritasi, kun, speaking), login va bepul 1-kun.
// Fayl nomi views-marathon.js — test va writing sahifalari shu moduldan getCtx / marTaskDone ni oladi.
import { store } from './store.js';
import { CONFIG } from './config.js';
import { esc } from './logic.js';
import { dayState } from './marlogic.js';
import { $, actions, toast, icon, go, S, modal, closeModal } from './ui.js';

export const TOTAL_DAYS = 30;
export const FREE_DAYS = 1;
const FREE_GROUP = 'IELTSFREE';
const loading = root => { root.innerHTML = '<div class="loading">Yuklanmoqda…</div>'; };
const CTX = 'ie30_ctx', ACC = 'ie30_acc', GUEST = 'ie30_guest';
const rd = (k, store_ = localStorage) => { try { return JSON.parse(store_.getItem(k)); } catch { return null; } };
const wr = (k, v, store_ = localStorage) => { try { if (v == null) store_.removeItem(k); else store_.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

let CONTENT = null;
export async function content() {
  if (CONTENT) return CONTENT;
  try { const r = await fetch('ielts30.json', { cache: 'no-cache' }); CONTENT = r.ok ? await r.json() : { days: [] }; } catch { CONTENT = { days: [] }; }
  return CONTENT;
}
const dayDef = (C, d) => (C.days || []).find(x => x.day === d);
export const getCtx = () => rd(CTX, sessionStorage);
const setCtx = c => wr(CTX, c, sessionStorage);

const SKILL = { reading: { e: '📖', n: 'Reading' }, listening: { e: '🎧', n: 'Listening' }, writing: { e: '✍️', n: 'Writing' }, speaking: { e: '🗣', n: 'Speaking' }, words: { e: '🃏', n: "So'zlar" } };

// ── akkaunt (pullik) va mehmon (bepul 1-kun) ──
export const getAcc = () => rd(ACC);
const setAcc = a => wr(ACC, a);
const getGuest = () => rd(GUEST) || { name: '', progress: [] };
const setGuest = g => wr(GUEST, g);
const syncStudent = a => { const s = S.student; if (!s || s.name !== a.name || s.group !== a.group) S.student = { name: a.name, group: a.group, groupName: a.group }; };

let ST = null;
async function load() {
  const C = await content();
  const a = getAcc();
  if (a?.token) {
    ST = await store.marStatus(a.token);
    if (ST?.error === 'auth') { setAcc(null); return guestStatus(C, true); }
    if (!ST?.error) syncStudent(a);
    return ST;
  }
  return guestStatus(C);
}
function guestStatus(C, relogin = false) {
  const g = getGuest();
  const days = Object.fromEntries((C.days || []).map(d => [d.day, d.tasks.map(t => t.id)]));
  return { guest: true, relogin, open_upto: FREE_DAYS, progress: g.progress, days, name: g.name };
}

/** Vazifani bajarilgan deb belgilash (test / writing sahifalaridan ham chaqiriladi). */
export async function marTaskDone(day, task, score = null, total = null) {
  const a = getAcc();
  if (a?.token) { try { return await store.marComplete(a.token, day, task, score, total); } catch (e) { return { ok: false, reason: 'error', message: e.message }; } }
  if (day > FREE_DAYS) return { ok: false, reason: 'auth' };
  const C = await content(), def = dayDef(C, day);
  if (!def?.tasks.some(t => t.id === task)) return { ok: false, reason: 'unknown_task' };
  const g = getGuest(), p = g.progress.find(x => x.day === day && x.task === task);
  if (p) { p.score = Math.max(p.score || 0, score || 0); p.total = total ?? p.total; } else g.progress.push({ day, task, score, total });
  setGuest(g);
  const day_done = def.tasks.every(t => g.progress.some(x => x.day === day && x.task === t.id));
  return { ok: true, day_done };
}
const REASONS = { day_locked: 'Bu kun hali ochilmagan.', unknown_task: 'Bu vazifa kunga biriktirilmagan.', auth: "Davom etish uchun login bilan kiring.", expired: 'Kurs muddati tugagan — ustozga yozing.', inactive: "Login o'chirilgan — ustozga yozing.", locked: 'Kirish yopilgan — ustozga yozing.', error: 'Xatolik, qayta urinib ko‘ring.' };
export const reasonText = r => REASONS[r?.reason] || 'Vazifa belgilanmadi.';

// ═════════════ bosh sahifa: 30 kun ═════════════
const cover = (d, extra = '') => `<div class="ie-cover ${extra}"><span class="ie-tag">● IELTS</span><span class="ie-daylbl">DAY</span><span class="ie-num">${d}</span><span class="ie-ic">📘</span></div>`;
export async function marathonHome(root) {
  loading(root);
  const h0 = location.hash;
  const [s, C] = await Promise.all([load(), content()]);
  if (location.hash !== h0) return;
  if (s.relogin) toast('Qayta kiring', 'bad');
  if (s.error) { root.innerHTML = expiredScreen(s); return; }
  const has = d => (s.days[d] || []).length > 0 && !!dayDef(C, d);
  const doneCount = [...Array(TOTAL_DAYS)].map((_, i) => i + 1).filter(d => has(d) && dayState(s, d, s.days[d]).done).length;
  const cur = Math.min(s.open_upto, TOTAL_DAYS);
  const name = s.guest ? (s.name || '') : (getAcc()?.name || '');
  const cards = [...Array(TOTAL_DAYS)].map((_, i) => {
    const d = i + 1, def = dayDef(C, d), ready = has(d), ds = ready ? dayState(s, d, s.days[d]) : null;
    const paywall = s.guest && d > FREE_DAYS;
    const st = !ready ? ['soon', 'Tez kunda'] : ds.done ? ['done', '✓ Bajarildi'] : paywall ? ['lockd', '🔒 Login bilan'] : !ds.open ? ['lockd', '🔒 Yopiq'] : ['open', d === cur ? `Davom etish · ${ds.count}/${s.days[d].length}` : 'Ochiq'];
    const skills = def ? [...new Set(def.tasks.map(t => t.type))].map(t => `<span title="${SKILL[t]?.n || t}" class="${ready && def.tasks.filter(x => x.type === t).every(x => ds.doneSet.has(x.id)) ? 'ok' : ''}">${SKILL[t]?.e || '•'}</span>`).join('') : '';
    const inner = `${cover(d, st[0])}${d <= FREE_DAYS && s.guest ? '<span class="ie-free">BEPUL</span>' : ''}
      <div class="ie-meta"><b>Day ${d}</b>${def?.title ? `<small class="muted">${esc(def.title)}</small>` : ''}<div class="ie-skills">${skills}</div><span class="ie-chip ${st[0]}">${st[1]}</span></div>`;
    if (!ready) return `<div class="ie-card soon">${inner}</div>`;
    if (paywall) return `<button class="ie-card lockd" data-act="iePaywall">${inner}</button>`;
    if (!ds.open) return `<div class="ie-card lockd">${inner}</div>`;
    return `<a class="ie-card ${st[0]} ${d === cur ? 'cur' : ''}" href="#/marathon/${d}">${inner}</a>`;
  }).join('');
  root.innerHTML = `<div class="wrap page ie-home">
    <div class="row between wrapx"><div><small class="muted">${esc(CONFIG.brand)}</small><h1 class="ptitle" style="margin:2px 0 0">${name ? `Hi, ${esc(name.split(' ')[0])} 👋` : 'IELTS 30 kun 👋'}</h1></div>
      ${s.guest ? `<button class="btn primary" data-act="marLoginOpen">${icon('user', 16)} Kirish</button>` : `<button class="btn sm" data-act="marLogout">${icon('logout', 14)} Chiqish</button>`}</div>
    ${s.guest ? `<div class="panel mt ie-promo">${promoHTML(true)}<div class="ctas">${TG()}<button class="btn" data-act="marLoginOpen">${icon('user', 16)} Loginim bor</button></div></div>` : ''}
    <div class="kv mt"><div><b>${doneCount}</b><span>kun bajarildi</span></div><div><b>${cur}</b><span>hozirgi kun</span></div><div><b>${TOTAL_DAYS}</b><span>kunlik kurs</span></div>${!s.guest && s.expires ? `<div><b>${String(s.expires).slice(8, 10)}.${String(s.expires).slice(5, 7)}</b><span>muddat</span></div>` : ''}</div>
    <p class="muted mt" style="margin-bottom:0">Har kuni: 📖 Reading · 🎧 Listening · ✍️ Writing (Task 1 / Task 2 navbat bilan) · 🗣 Speaking (Part 1–3). Kunning hamma vazifalari tugagach, keyingi kun ochiladi.</p>
    <div class="ie-grid mt">${cards}</div>
    ${has(cur) && !(s.guest && cur > FREE_DAYS) ? `<div class="ctas mt2"><a class="btn primary lg" href="#/marathon/${cur}">${icon('play', 18)} Day ${cur} — davom etish</a></div>` : ''}
  </div>`;
}
actions.iePaywall = () => modal(`<div class="row between"><span></span><button class="icon-btn" data-act="closeModal">${icon('x', 18)}</button></div>${promoHTML()}
  <div class="ctas" style="justify-content:center">${TG()}<button class="btn lg" data-act="marLoginOpen">${icon('user', 17)} Loginim bor — kirish</button></div>`, true);

// ═════════════ kun sahifasi ═════════════
function flash() {
  let f = null; try { f = JSON.parse(sessionStorage.getItem('ie30_flash')); sessionStorage.removeItem('ie30_flash'); } catch { /* ignore */ }
  if (f) toast(`${SKILL[f.task]?.n || 'Vazifa'} bajarildi ✓`, 'ok');
}
export async function marathonDay(root, dStr) {
  const d = Number(dStr);
  loading(root); flash();
  const h0 = location.hash;
  const [s, C] = await Promise.all([load(), content()]);
  if (location.hash !== h0) return;
  if (s.error) return go('#/');
  if (s.guest && d > FREE_DAYS) { go('#/'); return actions.iePaywall(); }
  const def = dayDef(C, d), ids = s.days[d] || [];
  if (!def || !ids.length) { root.innerHTML = '<div class="wrap page"><div class="empty">Bu kun tez kunda qo\'shiladi.<br><br><a class="btn" href="#/">Kunlarga</a></div></div>'; return; }
  if (d > s.open_upto) { root.innerHTML = `<div class="wrap page"><div class="empty">${icon('lock', 36)}<br>Day ${d} hali ochilmagan.<br><small>Avval oldingi kun vazifalarini bajaring.</small><br><br><a class="btn" href="#/">Kunlarga</a></div></div>`; return; }
  const ds = dayState(s, d, ids);
  const tasks = ids.map(id => def.tasks.find(t => t.id === id)).filter(Boolean);
  const nextUndone = tasks.find(t => !ds.doneSet.has(t.id));
  const prog = s.progress.filter(p => p.day === d);
  const nextReady = d < TOTAL_DAYS && (s.days[d + 1] || []).length && dayDef(C, d + 1);
  root.innerHTML = `<div class="wrap page"><a class="muted" href="#/">← Kunlarga</a>
    <div class="ie-dayhead mt">${cover(d, 'open')}<div><h1 class="ptitle" style="font-size:32px;margin:0">Day ${d}${def.title ? ' · ' + esc(def.title) : ''}</h1><p class="muted" style="margin:6px 0 0">${esc(def.focus || '')}</p></div></div>
    <div class="meter mt"><i style="width:${Math.round(ds.count / tasks.length * 100)}%"></i></div><small class="muted">${ds.count} / ${tasks.length} vazifa bajarildi</small>
    <div class="mtasks mt">${tasks.map((t, i) => {
      const sk = SKILL[t.type] || { e: '•', n: t.type }, done = ds.doneSet.has(t.id), p = prog.find(x => x.task === t.id);
      const score = done && p && p.total ? `<span class="badge ok">${p.score}/${p.total}</span>` : done ? '<span class="badge ok">✓</span>' : '';
      return `<div class="mtask ${done ? 'done' : t === nextUndone ? 'next' : ''}"><span class="mnum">${done ? icon('check', 16) : sk.e}</span>
        <div class="grow"><b>${esc(t.title)}</b><small class="muted">${sk.n}${t.minutes ? ' · ~' + t.minutes + ' daqiqa' : ''}</small></div>${score}
        <button class="btn sm ${t === nextUndone ? 'primary' : ''}" data-act="marOpen" data-day="${d}" data-task="${esc(t.id)}">${done ? 'Qayta' : 'Boshlash'}</button></div>`;
    }).join('')}</div>
    ${ds.done ? `<div class="panel mt2 center"><h2>🎉 Day ${d} tugadi!</h2>${s.guest && d >= FREE_DAYS
      ? `<p class="muted">Bepul kun tugadi. Davom etish uchun kursga yoziling — login va parolni ustoz beradi.</p><div class="ctas" style="justify-content:center">${TG()}<button class="btn" data-act="marLoginOpen">Loginim bor</button></div>`
      : nextReady ? `<p class="muted">Keyingi kun ochildi.</p><a class="btn primary" href="#/marathon/${d + 1}">Day ${d + 1} ${icon('arrow', 14)}</a>` : '<p class="muted">Keyingi kun tez orada qo\'shiladi.</p>'}</div>` : ''}
  </div>`;
}

async function ensureStudent() {
  if (getAcc()?.token) return true;
  const g = getGuest();
  if (g.name) { S.student = { name: g.name, group: FREE_GROUP, groupName: 'Bepul' }; return true; }
  return new Promise(res => {
    modal(`<div class="row between"><h2>Bepul 1-kun</h2><button class="icon-btn" data-act="closeModal">${icon('x', 18)}</button></div>
      <p class="muted">Ismingizni yozing — natijalaringiz shu nomda saqlanadi.</p>
      <label class="lbl">Ism familiya</label><input class="inp" id="gName" placeholder="Aliyev Vali" autocomplete="name">
      <div class="err" id="gErr"></div><button class="btn primary" style="width:100%" id="gBtn">Boshlash</button>`);
    const go_ = () => {
      const n = $('#gName').value.trim().replace(/\s+/g, ' ');
      if (n.length < 3) { $('#gErr').textContent = 'Ism familiyani to\'liq yozing.'; return; }
      setGuest({ ...getGuest(), name: n }); S.student = { name: n, group: FREE_GROUP, groupName: 'Bepul' }; closeModal(); res(true);
    };
    setTimeout(() => { $('#gName')?.focus(); $('#gBtn').onclick = go_; $('#gName').onkeydown = e => { if (e.key === 'Enter') go_(); }; }, 30);
  });
}

actions.marOpen = async el => {
  const day = Number(el.dataset.day), task = el.dataset.task;
  const C = await content(), t = dayDef(C, day)?.tasks.find(x => x.id === task);
  if (!t) return;
  if (!(await ensureStudent())) return;
  if (t.url) { location.href = `${t.url}?day=${day}&task=${encodeURIComponent(task)}`; return; }
  if (t.type === 'reading' || t.type === 'listening') { setCtx({ day, task, ref: t.ref }); return go('#/test/' + t.ref); }
  if (t.type === 'writing') { setCtx({ day, task, ref: t.ref }); return go('#/writing/' + t.ref); }
  go(`#/marathon/${day}/${task}`);
};

// ═════════════ ichki vazifa: speaking (Part 1–3) ═════════════
let TK = null;
export async function marathonTask(root, dStr, task) {
  const day = Number(dStr);
  loading(root);
  const [s, C] = await Promise.all([load(), content()]);
  if (s.error || day > s.open_upto || (s.guest && day > FREE_DAYS)) return go('#/');
  const t = dayDef(C, day)?.tasks.find(x => x.id === task);
  if (!t || t.type !== 'speaking') return go('#/marathon/' + day);
  TK = { day, t };
  const parts = t.parts || [{ title: 'Savollar', questions: t.questions || [] }];
  root.innerHTML = `<div class="wrap page"><a class="muted" href="#/marathon/${day}">← Day ${day}</a><h1 class="ptitle mt" style="font-size:30px">${esc(t.title)}</h1>
    ${t.note ? `<p class="muted">${esc(t.note)}</p>` : ''}
    ${parts.map(p => `<div class="panel mt"><div class="row between wrapx"><b>${esc(p.title)}</b>${p.time ? `<span class="badge">${esc(p.time)}</span>` : ''}</div>
      ${p.cue ? `<div class="ie-cue mt">${esc(p.cue)}</div>` : ''}
      ${(p.images || []).length ? `<div class="row mt" style="gap:12px;flex-wrap:wrap">${p.images.map(u => `<img src="${esc(u)}" alt="" style="max-width:100%;width:340px;border-radius:14px;border:1px solid var(--border)">`).join('')}</div>` : ''}
      ${(p.questions || []).length ? `<ol style="margin:8px 0 0;padding-left:22px;line-height:1.8">${p.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol>` : ''}</div>`).join('')}
    <div class="panel mt"><b>Qanday topshiriladi?</b><ol style="margin:8px 0 0;padding-left:22px;line-height:1.8"><li>Har bir Part uchun javobingizni telefonda ovozga yozib oling.</li><li>Ovozli xabarlarni Telegramda ustozga yuboring: <a href="${CONFIG.telegramPersonalUrl}" target="_blank" rel="noopener"><b>${esc(CONFIG.telegramPersonal)}</b></a>. Ismingiz va kun raqamini (Day ${day}) yozing.</li><li>Yuborgach, pastdagi tugmani bosing.</li></ol>
      <div class="ctas"><a class="btn" href="${CONFIG.telegramPersonalUrl}" target="_blank" rel="noopener">${icon('send', 15)} Telegramni ochish</a></div></div>
    <label class="row mt" style="gap:10px;align-items:center"><input type="checkbox" data-act="spCheck"> <span>Ovozli javoblarni ustozga yubordim</span></label>
    <div class="ctas mt"><button class="btn primary lg" id="spDone" data-act="spDone" disabled>${icon('check', 18)} Bajardim</button></div></div>`;
}
actions.spCheck = el => { $('#spDone').disabled = !el.checked; };
actions.spDone = async el => {
  el.disabled = true;
  const r = await marTaskDone(TK.day, TK.t.id);
  if (!r.ok) { toast(reasonText(r), 'bad'); el.disabled = false; return; }
  toast(r.day_done ? `🎉 Day ${TK.day} tugadi!` : 'Vazifa bajarildi ✓', 'ok');
  go('#/marathon/' + TK.day);
};

// ═════════════ reklama, login ═════════════
const TG = () => `<a class="btn primary lg" href="${CONFIG.telegramPersonalUrl}" target="_blank" rel="noopener">${icon('send', 17)} Kursga yozilish — ustozga yozing</a>`;
export const PROMO_LIST = [
  ['📖', 'Reading', 'har kuni IELTS formatidagi matn va savollar, natija darhol'],
  ['🎧', 'Listening', 'har kuni audio + savollar, transcript va javob joylari belgilangan'],
  ['✍️', 'Writing', "bir kun Task 1, bir kun Task 2 — AI darhol tekshiradi (band + xatolar)"],
  ['🗣', 'Speaking', "har kuni to'liq Part 1, 2, 3 — ovozli javobni ustoz tekshiradi"],
  ['🔐', 'Shaxsiy kabinet', "har bir o'quvchiga alohida login va parol"],
  ['📅', 'Intizom', 'kunlar ketma-ket ochiladi — bugungi kun tugamasa, keyingisi ochilmaydi'],
];
export function promoHTML(short = false) {
  return `<div class="promo">
    ${short ? '' : '<p class="promo-hi">Assalomu alaykum! 👋</p>'}
    <h2 class="promo-t">🎯 IELTS 30 kun</h2>
    <p class="promo-lead"><b>1-kun bepul</b> — hoziroq sinab ko'ring. Qolgan 29 kun login va parol bilan ochiladi.</p>
    ${short ? '' : `<div class="promo-list">${PROMO_LIST.map(([e, t, d]) => `<div><span>${e}</span><p><b>${t}</b> — ${d}</p></div>`).join('')}</div>`}
    <p class="promo-note">Kursga yozilish uchun ustozga yozing: <b>${esc(CONFIG.telegramPersonal)}</b></p></div>`;
}
function expiredScreen(s) {
  const msg = s.error === 'expired' ? 'Kurs muddati tugagan.' : s.error === 'inactive' ? "Loginingiz o'chirilgan." : 'Kirishda xatolik.';
  return `<div class="wrap page"><div class="panel center marlock"><div class="lockic">${icon('lock', 44)}</div><h1 class="ptitle" style="font-size:28px">${msg}</h1>
    <p class="muted">Davom ettirish uchun ustozga yozing.</p><div class="ctas" style="justify-content:center">${TG()}<button class="btn" data-act="marLogout">Boshqa login bilan kirish</button></div></div></div>`;
}
actions.marLoginOpen = () => {
  modal(`<div class="row between"><h2>Kirish</h2><button class="icon-btn" data-act="closeModal">${icon('x', 18)}</button></div>
    <p class="muted">Login va parolni ustozingiz beradi.</p>
    <label class="lbl">Login</label><input class="inp" id="mlLogin" autocomplete="username" autocapitalize="off" spellcheck="false">
    <label class="lbl">Parol</label><input class="inp" id="mlPass" type="password" inputmode="numeric" autocomplete="current-password">
    <div class="err" id="mlErr"></div><button class="btn primary" style="width:100%" id="mlBtn" data-act="marLoginGo">Kirish</button>
    <p class="note center">Login yo'qmi? <a href="${CONFIG.telegramPersonalUrl}" target="_blank" rel="noopener">Ustozga yozing</a></p>`);
  setTimeout(() => $('#mlLogin')?.focus(), 50);
};
const LOGIN_ERR = { bad: "Login yoki parol noto'g'ri.", wait: "Ko'p marta xato kiritildi. 10 daqiqadan keyin urinib ko'ring.", expired: 'Kurs muddati tugagan — ustozga yozing.', inactive: "Login o'chirilgan — ustozga yozing." };
actions.marLoginGo = async () => {
  const l = $('#mlLogin').value.trim(), p = $('#mlPass').value.trim(), err = $('#mlErr'), btn = $('#mlBtn');
  if (!l || !p) { err.textContent = 'Login va parolni kiriting.'; return; }
  btn.disabled = true; err.textContent = '';
  try {
    const r = await store.marLogin(l, p);
    if (!r || r.error || !r.token) { err.textContent = LOGIN_ERR[r?.error] || 'Kirib bo\'lmadi.'; btn.disabled = false; return; }
    setAcc(r); syncStudent(r);
    // bepul 1-kunda bajarilgan vazifalar akkauntga o'tkaziladi
    for (const p of getGuest().progress.filter(x => x.day <= FREE_DAYS)) { try { await store.marComplete(r.token, p.day, p.task, p.score, p.total); } catch { /* ignore */ } }
    closeModal(); toast(`Xush kelibsiz, ${r.name}!`, 'ok');
    window.dispatchEvent(new Event('studentchange'));
    if (location.hash === '' || location.hash === '#/') marathonHome($('#view')); else go('#/');
  } catch (e) { err.textContent = e.message; btn.disabled = false; }
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && $('#mlBtn') && e.target.closest('#modal')) actions.marLoginGo(); });
actions.marLogout = async () => {
  const a = getAcc(); if (a?.token) store.marLogout(a.token).catch(() => {});
  setAcc(null); S.student = null; toast('Chiqdingiz');
  window.dispatchEvent(new Event('studentchange'));
  if (location.hash === '' || location.hash === '#/') marathonHome($('#view')); else go('#/');
};
