// Teacher panel → "IELTS 30" tab: kontent, loginlar (pullik kirish), qoidalar, o'quvchilar holati.
import { store } from './store.js';
import { esc } from './logic.js';
import { CONFIG } from './config.js';
import { missedDays, todayStr, dm } from './marlogic.js';
import { $, actions, toast, icon, confirmBox, modal } from './ui.js';

let ST = null, BODY = null;
const refresh = () => marathonTab(BODY);
const dmy = d => d ? `${dm(d)}.${String(d).slice(0, 4)}` : '—';
const siteUrl = () => (CONFIG.printSite || (location.origin + location.pathname)).replace(/#.*$/, '').replace(/\/?$/, '/') + '#/';
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export async function marathonTab(body) {
  BODY = body;
  const [st, groups, mj] = await Promise.all([store.marAdminLoad(), store.listGroups().catch(() => []), fetch('ielts30.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)]);
  ST = st; ST._mj = mj;
  const today = todayStr(), daysSynced = Object.keys(st.days).length, bundled = mj?.days?.length || 0;
  const accs = st.accounts || [];
  const stuOf = a => st.students.find(s => s.account_id === a.id);
  const doneDaysOf = s => Object.entries(st.days).filter(([d, tasks]) => tasks.length && tasks.every(t => st.progress.some(p => p.student_id === s.id && p.day === Number(d) && p.task === t))).length;
  const active = accs.filter(a => a.active && a.expires_on >= today).length;
  body.innerHTML = `
    <div class="panel"><div class="row between wrapx"><div><b>1. Kontent</b><div class="muted" style="font-size:14px">Serverda ${daysSynced} kunlik reja bor · sayt faylida (ielts30.json) ${bundled} kun. Yangi kunlar qo'shilganda shu tugmani bosing.</div></div>
      <button class="btn primary sm" data-act="marSync">${icon('arrow', 14)} Kontentni yuklash / yangilash</button></div></div>

    <div class="panel mt"><b>2. Yangi o'quvchi (login + parol)</b> <small class="muted">— guruh: IELTS30</small>
      <div class="row wrapx mt" style="gap:10px;align-items:flex-end">
        <div style="flex:2;min-width:200px"><label class="lbl">Ism familiya</label><input class="inp" id="accName" placeholder="Aliyev Vali"></div>
        <div style="flex:1;min-width:140px"><label class="lbl">Guruh</label><select class="inp" id="accGroup">${groups.filter(g => g.code !== 'IELTSFREE').sort((a, b) => (b.code === 'IELTS30') - (a.code === 'IELTS30')).map(g => `<option value="${esc(g.code)}">${esc(g.code)}${g.name ? ' · ' + esc(g.name) : ''}</option>`).join('')}</select></div>
        <div style="width:110px"><label class="lbl">Muddat (kun)</label><input class="inp" id="accDays" type="number" min="1" max="365" value="30"></div>
        <button class="btn primary" data-act="accCreate">${icon('plus', 15)} Login yaratish</button></div>
      <small class="muted">${groups.length ? 'Login va parol avtomatik yaratiladi. Tayyor xabarni nusxalab, o\'quvchiga Telegram\'da yuborasiz.' : 'Avval "Groups" tabida guruh yarating.'}</small></div>

    <h2 class="ptitle mt2" style="font-size:22px">O'quvchilar: ${accs.length} ta login · ${active} ta faol</h2>
    ${accs.length ? `<div class="tablewrap mt"><table><thead><tr><th>Login</th><th>Ism</th><th>Guruh</th><th>Muddat</th><th>Ochiq kun</th><th>Bajarilgan</th><th>Holat</th><th class="r"></th></tr></thead><tbody>
    ${accs.map(a => {
      const s = stuOf(a), exp = a.expires_on < today, miss = s ? missedDays(st, s, today) : [];
      const status = !a.active ? '<span class="badge draft">O\'chirilgan</span>' : exp ? '<span class="badge" style="color:var(--bad);border-color:var(--bad)">Muddati tugagan</span>'
        : s?.locked ? `<span class="badge" style="color:var(--bad);border-color:var(--bad)">${icon('lock', 12)} Qulflangan</span><br><small class="muted">${esc(s.lock_reason)}</small>` : s ? '<span class="badge ok">Faol</span>' : '<span class="badge">Hali kirmagan</span>';
      return `<tr>
      <td><b>${esc(a.login)}</b></td><td>${esc(a.student_name)}</td><td>${esc(a.group_code)}</td>
      <td class="${exp ? 'err' : ''}" style="margin:0">${dmy(a.expires_on)}</td>
      <td>${s ? `<div class="row" style="gap:6px"><input class="inp" type="number" min="1" max="30" value="${s.open_upto}" id="mo-${s.id}" style="width:66px"><button class="btn sm" data-act="marOpenTo" data-id="${s.id}">OK</button></div>` : '—'}</td>
      <td>${s ? `${doneDaysOf(s)} kun${miss.length ? `<br><small class="muted">qoldirgan: ${miss.map(dm).join(', ')}</small>` : ''}` : '—'}</td>
      <td>${status}</td>
      <td class="r"><div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:wrap">
        ${s?.locked ? `<button class="btn sm primary" data-act="marUnlock" data-id="${s.id}">Qulfni ochish</button>` : ''}
        ${s ? `<button class="btn sm primary" data-act="ieProg" data-id="${s.id}">Progress</button>` : ''}
        <button class="btn sm" data-act="accReset" data-id="${a.id}" title="Yangi parol berish">Yangi parol</button>
        <button class="btn sm" data-act="accExtend" data-id="${a.id}" title="Muddatni 30 kunga uzaytirish">+30 kun</button>
        <button class="btn sm" data-act="accToggle" data-id="${a.id}">${a.active ? "O'chirish" : 'Yoqish'}</button>
        <button class="btn sm danger" data-act="accDel" data-id="${a.id}" title="Butunlay o'chirish">${icon('trash', 14)}</button></div></td></tr>`;
    }).join('')}
    </tbody></table></div>` : '<div class="empty mt">Hozircha login yaratilmagan.</div>'}`;
}

function showCreds(a, r, title) {
  const msg = `Assalomu alaykum, ${a.student_name}!\nIELTS 30 kunlik kursga xush kelibsiz 🎉\n\nSayt: ${siteUrl()}\nLogin: ${r.login}\nParol: ${r.password}\nMuddat: ${dmy(a.expires_on)} gacha\n\nParolni hech kimga bermang.`;
  modal(`<div class="row between"><h2>${esc(title)}</h2><button class="icon-btn" data-act="closeModal">${icon('x', 18)}</button></div>
    <p class="muted">Parol faqat hozir ko'rinadi — xabarni nusxalab, o'quvchiga yuboring.</p>
    <pre class="acc-msg" id="accMsg">${esc(msg)}</pre>
    <div class="ctas"><button class="btn primary" data-act="accCopy">Nusxalash</button><button class="btn" data-act="closeModal">Yopish</button></div>`);
}
actions.accCopy = async () => {
  const t = $('#accMsg')?.textContent || '';
  try { await navigator.clipboard.writeText(t); toast('Nusxalandi — Telegram\'ga joylang', 'ok'); }
  catch { const r = document.createRange(); r.selectNodeContents($('#accMsg')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Belgilandi — Ctrl+C bosing'); }
};
actions.accCreate = async el => {
  const n = $('#accName').value.trim().replace(/\s+/g, ' '), g = $('#accGroup')?.value || '', days = Number($('#accDays').value) || 30;
  if (n.length < 3) return toast('Ism familiyani kiriting', 'bad');
  if (!g) return toast('Guruhni tanlang', 'bad');
  el.disabled = true;
  try {
    const r = await store.marAccCreate(n, g, days);
    await refresh();
    showCreds({ student_name: n, expires_on: addDays(todayStr(), days) }, r, 'Login tayyor');
  } catch (e) { toast(e.message, 'bad'); el.disabled = false; }
};
actions.accReset = async el => {
  const a = ST.accounts.find(x => x.id === el.dataset.id); if (!a) return;
  if (!(await confirmBox('Yangi parol', `${a.student_name} uchun yangi parol yaratiladi. Eski parol ishlamay qoladi va u barcha qurilmalardan chiqariladi.`, 'Yaratish'))) return;
  try { const r = await store.marAccReset(a.id); showCreds(a, r, 'Yangi parol'); } catch (e) { toast(e.message, 'bad'); }
};
actions.accExtend = async el => {
  const a = ST.accounts.find(x => x.id === el.dataset.id); if (!a) return;
  const base = a.expires_on > todayStr() ? a.expires_on : todayStr();
  try { await store.marAccPatch(a.id, { expires_on: addDays(base, 30), active: true }); toast(`Muddat: ${dmy(addDays(base, 30))} gacha`, 'ok'); } catch (e) { toast(e.message, 'bad'); }
  refresh();
};
actions.accToggle = async el => {
  const a = ST.accounts.find(x => x.id === el.dataset.id); if (!a) return;
  try { await store.marAccPatch(a.id, { active: !a.active }); toast(a.active ? "O'chirildi — kira olmaydi" : 'Yoqildi', 'ok'); } catch (e) { toast(e.message, 'bad'); }
  refresh();
};
actions.accDel = async el => {
  const a = ST.accounts.find(x => x.id === el.dataset.id); if (!a) return;
  if (!(await confirmBox("Loginni o'chirish", `${a.student_name} (${a.login}) va uning kursdagi barcha natijalari butunlay o'chadi.`, "O'chirish", true))) return;
  try { await store.marAccDelete(a.id); toast("O'chirildi", 'ok'); } catch (e) { toast(e.message, 'bad'); }
  refresh();
};

actions.marSync = async el => {
  const mj = ST?._mj; if (!mj?.days?.length) return toast('ielts30.json topilmadi', 'bad');
  el.disabled = true;
  try {
    const refs = new Set();
    mj.days.forEach(d => d.tasks.forEach(t => { if (t.ref) refs.add(t.ref); }));
    let nTests = 0;
    try {
      const tj = await (await fetch('tests.json?t=' + Date.now(), { cache: 'no-store' })).json();
      const list = tj.tests.filter(t => refs.has(t.id));
      for (let i = 0; i < list.length; i += 4) await store.saveTests(list.slice(i, i + 4).map(t => ({ published: true, ...t })));
      nTests = list.length;
    } catch { /* tests.json yo'q */ }
    for (const w of mj.writing || []) await store.saveWritingTask({ published: true, image_url: '', ...w });
    await store.marSaveDays(Object.fromEntries(mj.days.map(d => [d.day, d.tasks.map(t => t.id)])));
    toast(`Tayyor: ${mj.days.length} kun, ${nTests} test, ${(mj.writing || []).length} writing`, 'ok');
  } catch (e) { toast(e.message, 'bad'); }
  refresh();
};
actions.marSettings = async () => {
  const w = Number($('#marWin').value), l = Number($('#marLim').value);
  if (!(w >= 2 && w <= 60 && l >= 1 && l <= 10)) return toast("Qiymatlar noto'g'ri", 'bad');
  try { await store.marSaveSettings({ window_days: w, miss_limit: l }); toast('Saqlandi', 'ok'); } catch (e) { toast(e.message, 'bad'); }
  refresh();
};
actions.marPromo = async el => {
  try { await store.marSaveSettings({ promo_on: el.checked }); toast(el.checked ? 'Reklama yoqildi' : "Reklama o'chirildi", 'ok'); } catch (e) { toast(e.message, 'bad'); }
};
actions.marOpenTo = async el => {
  const v = Number($('#mo-' + el.dataset.id).value);
  if (!(v >= 1 && v <= 30)) return toast("1–30 oralig'ida", 'bad');
  try { await store.marPatchStudent(el.dataset.id, { open_upto: v }); toast(`${v}-kungacha ochildi`, 'ok'); } catch (e) { toast(e.message, 'bad'); }
  refresh();
};
actions.marUnlock = async el => {
  if (!(await confirmBox('Qulfni ochish', "O'quvchi qaytadan boshlaydi: bugundan boshlab qoldirilgan kunlar hisoblanadi.", 'Ochish'))) return;
  try { await store.marUnlock(el.dataset.id); toast('Qulf ochildi', 'ok'); } catch (e) { toast(e.message, 'bad'); }
  refresh();
};

// O'quvchi progressi: har bir kun va vazifa, ball
actions.ieProg = el => {
  const s = ST.students.find(x => x.id === el.dataset.id); if (!s) return;
  const mj = ST._mj || { days: [] }, P = ST.progress.filter(p => p.student_id === s.id);
  const N = { listening: '🎧 Listening', reading: '📖 Reading', writing: '✍️ Writing', speaking: '🗣 Speaking' };
  const rows = Object.keys(ST.days).map(Number).sort((a, b) => a - b).map(d => {
    const def = mj.days.find(x => x.day === d);
    const cells = ST.days[d].map(t => { const p = P.find(x => x.day === d && x.task === t);
      return `<td>${p ? `<span class="badge ok">${p.total ? `${p.score}/${p.total}` : p.score ? 'Band ' + p.score : '✓'}</span><br><small class="muted">${p.done_at ? String(p.done_at).slice(5, 16).replace('T', ' ') : ''}</small>` : '<span class="muted">—</span>'}</td>`; }).join('');
    return `<tr><td><b>Day ${d}</b><br><small class="muted">${esc(def?.title || '')}</small></td>${cells}</tr>`;
  }).join('');
  const heads = [...new Set(Object.values(ST.days).flat())];
  modal(`<div class="row between"><h2>${esc(s.student_name || s.name || "")} — progress</h2><button class="icon-btn" data-act="closeModal">${icon('x', 18)}</button></div>
    <p class="muted">Ochiq: Day ${s.open_upto} gacha · Listening/Reading — to'g'ri javoblar soni, Writing — AI band.</p>
    <div class="tablewrap"><table><thead><tr><th>Kun</th>${heads.map(h => `<th>${N[h] || esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">Listening/Reading javoblari va Writing matnlari — asosiy saytdagi Teacher panelda (IELTS Mock: Test 101+, Writing).</p>`, true);
};
