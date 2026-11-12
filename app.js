import './prefs.js';
import { CONFIG } from './config.js';
import { initStore, store } from './store.js';
import { esc } from './logic.js';
import { $, actions, inputs, icon, initials, S } from './ui.js';
import * as V from './views-student.js';
import * as W from './views-writing.js';
import * as A from './views-admin.js';
import * as MA from './views-marathon.js';
import * as GM from './views-game.js';
import { startActivity } from './activity.js';

const routes = [
  [/^\/?$/, MA.marathonHome],
  [/^\/marathon$/, MA.marathonHome],
  [/^\/marathon\/(\d+)$/, MA.marathonDay],
  [/^\/marathon\/(\d+)\/([\w-]+)$/, MA.marathonTask],
  [/^\/game\/([\w-]+)$/, GM.gameView],
  [/^\/writing\/([\w-]+)$/, W.writingEditor],
  [/^\/test\/([\w-]+)$/, V.testIntro],
  [/^\/run\/([\w-]+)$/, V.runTest],
  [/^\/result\/([\w-]+)$/, V.resultView],
  [/^\/admin$/, A.adminHome],
];

function renderNav() {
  const a = MA.getAcc();
  $('#nav').innerHTML = `<div class="wrap">
    <a class="brand" href="#/"><span class="logo">${icon('spark', 20)}</span>IELTS 30 <small class="muted" style="font-weight:500;margin-left:6px">· ${esc(CONFIG.teacher)}</small></a>
    <div class="navright">
      <a class="icon-btn" href="${CONFIG.telegramPersonalUrl}" target="_blank" rel="noopener" title="${esc(CONFIG.telegramPersonal)}">${icon('send', 18)}</a>
      <button class="icon-btn" data-act="theme" title="Theme">${icon(document.documentElement.dataset.theme !== 'dark' ? 'moon' : 'sun', 18)}</button>
      ${a?.token ? `<span class="studentchip"><span class="av">${esc(initials(a.name))}</span>${esc(a.name.split(' ')[0])}</span>` : '<button class="btn primary sm" data-act="marLoginOpen">Kirish</button>'}
    </div></div>`;
  $('#footBrand').innerHTML = `© ${new Date().getFullYear()} ${esc(CONFIG.brand)} · <a href="${CONFIG.telegramPersonalUrl}" target="_blank" rel="noopener">${esc(CONFIG.telegramPersonal)}</a>${store.mode === 'local' ? ' · <span class="badge draft">Demo mode</span>' : ''}`;
}

let navToken = 0;
async function render() {
  const token = ++navToken;
  try { S.cleanup?.(); } catch (e) { console.error(e); }
  S.cleanup = null;
  document.body.classList.remove('running');
  let path = (location.hash.slice(1) || '/').split('?')[0];
  if (/^\/(practice|recent|ielts|leaderboard|me|writing$|vocab|speaking)/.test(path)) { location.replace('#/'); return; }   // asosiy saytdagi bo'limlar bu yerda yo'q
  renderNav();
  const root = $('#view');
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    window.scrollTo(0, 0);
    try { await fn(root, ...m.slice(1)); } catch (e) {
      console.error(e);
      if (token === navToken) root.innerHTML = `<div class="wrap page"><div class="empty">Xatolik yuz berdi.<br><small>${esc(e.message)}</small><br><br><a class="btn" href="#/">Bosh sahifa</a></div></div>`;
    }
    return;
  }
  root.innerHTML = '<div class="wrap page"><div class="empty">Sahifa topilmadi.<br><br><a class="btn" href="#/">Bosh sahifa</a></div></div>';
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
});
const onInput = e => { const el = e.target.closest('[data-in]'); if (el && inputs[el.dataset.in]) inputs[el.dataset.in](el, e); };
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);

actions.theme = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ie30_theme', next); } catch { /* ignore */ }
  renderNav();
};
window.addEventListener('studentchange', renderNav);
window.addEventListener('hashchange', render);

(async () => {
  try { await initStore(); startActivity(); } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="wrap page"><div class="empty">Bazaga ulanib bo'lmadi.<br><small>${esc(e.message)}</small></div></div>`;
    return;
  }
  document.title = 'IELTS 30 kun · ' + CONFIG.brand;
  render();
})();
