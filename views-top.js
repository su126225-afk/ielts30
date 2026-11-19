// IELTS 30: Leaderboard (#/top)
import { store } from './store.js';
import { esc } from './logic.js';
import { getAcc } from './views-marathon.js';

export async function topView(root) {
  root.innerHTML = '<div class="loading">Yuklanmoqda…</div>';
  let rows = [];
  try { rows = await store.marTop(); } catch (e) { root.innerHTML = `<div class="wrap page"><div class="empty">Reyting yuklanmadi.<br><small>${esc(e.message)}</small><br><br><a class="btn" href="#/">Kunlarga</a></div></div>`; return; }
  const me = (getAcc()?.name || '').trim().toLowerCase();
  const medal = i => ['🥇', '🥈', '🥉'][i] || `<span class="muted">${i + 1}</span>`;
  const pod = rows.slice(0, 3);
  root.innerHTML = `<div class="wrap page">
    <a class="muted" href="#/">← Kunlarga</a>
    <h1 class="ptitle mt" style="margin-bottom:4px">🏆 Reyting</h1>
    <p class="muted">Har bir bajarilgan vazifa 10 ball, Reading/Listening'da to'g'ri javoblar uchun yana 10 tagacha ball.</p>
    ${pod.length ? `<div class="row wrapx mt" style="gap:12px">${pod.map((r, i) => `<div class="panel" style="flex:1;min-width:150px;text-align:center"><div style="font-size:30px">${medal(i)}</div><b>${esc(r.name)}</b><div style="font-size:22px;font-weight:800">${r.points}</div><small class="muted">${r.days} kun · ${r.tasks} vazifa</small></div>`).join('')}</div>` : ''}
    ${rows.length ? `<div class="tablewrap mt"><table><thead><tr><th>#</th><th>O'quvchi</th><th>Kunlar</th><th>Vazifalar</th><th>O'rtacha %</th><th>Ball</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr style="${String(r.name).trim().toLowerCase() === me ? 'background:rgba(99,102,241,.12)' : ''}"><td>${medal(i)}</td><td><b>${esc(r.name)}</b></td><td>${r.days}</td><td>${r.tasks}</td><td>${r.avg}%</td><td><b>${r.points}</b></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty mt">Hali natijalar yo\'q — birinchi bo\'ling! 🚀</div>'}
  </div>`;
}
