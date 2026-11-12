// O'qituvchi paneli (IELTS 30): kirish + loginlar va kontent. Natijalar va writinglar asosiy saytning Teacher panelida ham ko'rinadi.
import { store } from './store.js';
import { esc } from './logic.js';
import { marathonTab } from './views-marathon-admin.js';
import { $, actions, toast, icon } from './ui.js';

const rerender = () => adminHome($('#view'));
export async function adminHome(root) {
  if (!store.isAdmin()) return loginView(root);
  root.innerHTML = `<div class="wrap page">
    <div class="row between wrapx"><div><h1 class="ptitle">O'qituvchi paneli · IELTS 30</h1><p class="muted">${store.mode === 'cloud' ? 'Baza ulangan. Test natijalari va writinglar asosiy saytdagi Teacher panelda (Results / Writing, guruh: IELTS30 va IELTSFREE) ham ko\'rinadi.' : 'Demo rejim: maʼlumot faqat shu brauzerda.'}</p></div>
      <button class="btn sm" data-act="adminLogout">${icon('logout', 16)} Chiqish</button></div>
    <div class="mt2" id="admBody"><div class="loading">Yuklanmoqda…</div></div></div>`;
  try { await marathonTab($('#admBody')); } catch (e) { $('#admBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
actions.adminLogout = async () => { await store.adminLogout(); toast('Chiqildi'); rerender(); };
function loginView(root) {
  const cloud = store.mode === 'cloud';
  root.innerHTML = `<div class="wrap page"><div class="intro" style="max-width:440px">
    <h1 class="ptitle">O'qituvchi</h1><p class="muted">${cloud ? 'Asosiy saytdagi o\'qituvchi email va paroli bilan kiring.' : 'Demo: config.js dagi parol.'}</p>
    <div class="panel mt">${cloud ? '<label class="lbl">Email</label><input class="inp" id="lgEmail" type="email" autocomplete="username">' : ''}
      <label class="lbl">Parol</label><input class="inp" id="lgPw" type="password" autocomplete="current-password">
      <div class="err" id="lgErr"></div><button class="btn primary" style="width:100%" data-act="adminLogin">Kirish</button></div></div></div>`;
  $('#lgPw').addEventListener('keydown', e => { if (e.key === 'Enter') actions.adminLogin(); });
}
actions.adminLogin = async () => {
  const err = $('#lgErr'); err.textContent = '';
  try { await store.adminLogin($('#lgEmail')?.value.trim(), $('#lgPw').value); rerender(); } catch (e) { err.textContent = e.message; }
};
