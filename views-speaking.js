// IELTS 30: AI Speaking — o'quvchi gapiradi (brauzer matnga aylantiradi), AI band va xatolarni ko'rsatadi.
import { store } from './store.js';
import { esc } from './logic.js';
import { $, $$, actions, inputs, toast, icon } from './ui.js';
import { marTaskDone, getAcc, reasonText } from './views-marathon.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let ST = null, REC = null;

const wc = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
function items(t) {
  const parts = t.parts || [{ title: 'Savollar', questions: t.questions || [] }];
  const out = [];
  parts.forEach((p, pi) => {
    const qs = (p.questions || []).filter(Boolean);
    if (p.cue || !qs.length) out.push({ title: p.title, prompt: [p.cue, ...qs].filter(Boolean).join(' | '), label: p.cue ? 'Cue card — 1–2 daqiqa gapiring' : 'Javobingiz', text: '', part: pi });
    else qs.forEach(q => out.push({ title: p.title, prompt: q, label: q, text: '', part: pi }));
  });
  return out;
}

export function mountSpeakingAI(box, day, task) {
  stopRec();
  ST = { day, task, items: items(task), busy: false, done: false };
  box.innerHTML = `<div class="panel mt" id="spaiPanel">
    <div class="row between wrapx"><b>🤖 AI bilan tekshirish</b><span class="badge">Band + xatolar</span></div>
    <p class="muted" style="margin:6px 0 0">Mikrofon tugmasini bosib inglizcha gapiring — javob matnga aylanadi (Chrome / Edge / Android). Matnni qo'lda tuzatish yoki yozish ham mumkin.${SR ? '' : ' <b>Bu brauzerda ovoz→matn ishlamaydi, javobni yozing yoki Chrome ochib ko\'ring.</b>'}</p>
    <div id="spaiList">${ST.items.map((it, i) => `<div class="panel mt" style="background:var(--bg2,transparent)">
      <div class="row between wrapx"><span class="badge">${esc(it.title)}</span><span class="muted" id="spwc${i}">0 so'z</span></div>
      <p style="margin:8px 0"><b>${esc(it.label)}</b></p>
      <textarea class="inp" id="spt${i}" rows="3" data-in="spaiText" data-i="${i}" placeholder="Javobingiz shu yerda ko'rinadi…" style="width:100%"></textarea>
      <div class="ctas" style="margin-top:8px">${SR ? `<button class="btn sm" data-act="spaiMic" data-i="${i}" id="spmic${i}">${icon('mic', 15)} Gapirish</button>` : ''}<button class="btn sm" data-act="spaiClear" data-i="${i}">Tozalash</button></div></div>`).join('')}</div>
    <div class="ctas mt"><button class="btn primary lg" data-act="spaiCheck" id="spaiGo">${icon('spark', 18)} AI tekshirsin</button></div>
    <div id="spaiOut"></div></div>`;
}
function stopRec() { try { REC?.stop(); } catch { /* */ } REC = null; $$('[id^=spmic]').forEach(b => b.classList.remove('primary')); }
inputs.spaiText = el => { const i = +el.dataset.i; ST.items[i].text = el.value; const w = $('#spwc' + i); if (w) w.textContent = wc(el.value) + " so'z"; };
actions.spaiClear = el => { const i = +el.dataset.i; stopRec(); ST.items[i].text = ''; $('#spt' + i).value = ''; $('#spwc' + i).textContent = "0 so'z"; };
actions.spaiMic = el => {
  const i = +el.dataset.i;
  if (REC && REC._i === i) return stopRec();
  stopRec();
  const r = new SR(); r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r._i = i;
  const base = ST.items[i].text ? ST.items[i].text.trim() + ' ' : '';
  r.onresult = e => {
    let fin = '', tmp = '';
    for (let k = 0; k < e.results.length; k++) (e.results[k].isFinal ? (fin += e.results[k][0].transcript + ' ') : (tmp += e.results[k][0].transcript));
    const v = (base + fin + tmp).replace(/\s+/g, ' ').trim();
    ST.items[i].text = v; $('#spt' + i).value = v; $('#spwc' + i).textContent = wc(v) + " so'z";
  };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast("Mikrofonga ruxsat bering", 'bad'); stopRec(); };
  r.onend = () => { if (REC === r) { try { r.start(); } catch { stopRec(); } } };   // jim qolsa ham davom etadi
  try { r.start(); REC = r; el.classList.add('primary'); el.innerHTML = icon('mic', 15) + ' To\'xtatish'; } catch { toast('Mikrofon ishga tushmadi', 'bad'); }
  const reset = () => { $$('[id^=spmic]').forEach(b => { b.innerHTML = icon('mic', 15) + ' Gapirish'; }); };
  const old = r.onend; r.onend = () => { reset(); old(); };
};
const bar = (l, v) => `<div style="min-width:120px;text-align:center"><div class="muted" style="font-size:12px">${l}</div><div style="font-size:26px;font-weight:800">${esc(String(v ?? '—'))}</div></div>`;
actions.spaiCheck = async el => {
  if (ST.busy) return; stopRec();
  const parts = ST.items.filter(x => wc(x.text) > 0);
  if (wc(parts.map(x => x.text).join(' ')) < 20) return toast("Kamida 20 ta so'z gapiring yoki yozing", 'bad');
  ST.busy = true; el.disabled = true; el.innerHTML = 'AI tekshiryapti…';
  const out = $('#spaiOut');
  try {
    const a = getAcc();
    const fb = await store.checkIeSpeaking({ parts: parts.map(x => ({ title: x.title, prompt: x.prompt, text: x.text })), group: a?.group || 'IELTS30' });
    try { await store.saveIeSpeaking({ student_name: a?.name || 'Mehmon', group_code: a?.group || 'IELTSFREE', day: ST.day, task: ST.task.id, band: String(fb.overall ?? ''), transcripts: parts.map(x => ({ title: x.title, prompt: x.prompt, text: x.text })), feedback: fb }); } catch (e) { console.warn(e); }
    const r = await marTaskDone(ST.day, ST.task.id, parseFloat(fb.overall) || null, null);
    out.innerHTML = `<div class="panel mt2"><h2 style="margin:0 0 10px">Natija: Band ${esc(String(fb.overall))}</h2>
      <div class="row wrapx" style="gap:14px;justify-content:space-around">${bar('Fluency', fb.fluency)}${bar('Lexical', fb.lexical)}${bar('Grammar', fb.grammar)}</div>
      <p class="mt">${esc(fb.summary || '')}</p>
      ${(fb.strengths || []).length ? `<b>✅ Yaxshi tomonlar</b><ul>${fb.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(fb.mistakes || []).length ? `<b>✏️ Xatolar</b><div class="tablewrap"><table><thead><tr><th>Siz aytdingiz</th><th>Yaxshiroq</th><th>Izoh</th></tr></thead><tbody>${fb.mistakes.map(m => `<tr><td>${esc(m.said)}</td><td><b>${esc(m.better)}</b></td><td class="muted">${esc(m.why)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${(fb.tips || []).length ? `<b>💡 Maslahatlar</b><ul>${fb.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${fb.model_answer ? `<b>🌟 Namuna javob (1-savol)</b><p class="muted">${esc(fb.model_answer)}</p>` : ''}
      <p class="note">Talaffuz AI bilan baholanmaydi — uni ustoz tekshiradi.</p>
      <div class="ctas mt">${r.ok ? `<a class="btn primary lg" href="#/marathon/${ST.day}">Kunga qaytish →</a>` : `<span class="badge bad">${esc(reasonText(r))}</span>`}</div></div>`;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.innerHTML = 'Qayta tekshirish'; el.disabled = false; ST.busy = false;
  } catch (e) { toast(e.message, 'bad'); el.disabled = false; el.innerHTML = icon('spark', 18) + ' AI tekshirsin'; ST.busy = false; }
};
