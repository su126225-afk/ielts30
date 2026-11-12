/* IELTS 30: test sahifalari (ie-listening-N / ie-reading-N) uchun.
   - O'quvchi ismi saytdagi logindan (yoki bepul 1-kun ismidan) olinadi — testda hech narsa so'ralmaydi.
   - Javoblar o'qituvchiga yuboriladi (mock_submissions, test_no = 100 + N).
   - Vazifa kunga "bajarildi" deb yoziladi va o'quvchi kun sahifasiga qaytariladi. */
(function () {
  var P = new URLSearchParams(location.search), DAY = parseInt(P.get('day'), 10) || 0, TASK = P.get('task') || window.IE30_KIND;
  var N = window.IE30_TEST || 0, KIND = window.IE30_KIND;
  function jget(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var cfgP = null;
  function cfg() { if (!cfgP) cfgP = import('./config.js').then(function (m) { return m.CONFIG; }).catch(function () { return {}; }); return cfgP; }
  var acc = jget('ie30_acc'), guest = jget('ie30_guest') || { name: '', progress: [] };
  var student = acc && acc.token ? { name: acc.name, group: acc.group || 'IELTS30' } : { name: guest.name || 'Mehmon', group: 'IELTSFREE' };
  var AK = 'ie30_att_d' + DAY;
  if (KIND === 'listening' || !localStorage.getItem(AK)) localStorage.setItem(AK, 'ie30-' + (acc && acc.login || 'g') + '-d' + DAY + '-' + Date.now().toString(36));
  function rest(path, body) {
    return cfg().then(function (c) {
      if (!c.supabaseUrl || !c.supabaseAnonKey) return null;
      return fetch(c.supabaseUrl + '/rest/v1/' + path, { method: 'POST', headers: { apikey: c.supabaseAnonKey, Authorization: 'Bearer ' + c.supabaseAnonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) })
        .then(function (r) { return r; }).catch(function () { return null; });
    });
  }
  window.MockSync = {
    testNo: 100 + N,
    student: function () { return student; },
    send: function (section, data) {
      var row = { attempt_id: localStorage.getItem(AK), student_name: String(student.name).slice(0, 120), group_code: String(student.group).slice(0, 40), section: section, test_no: 100 + N };
      for (var k in data) row[k] = data[k];
      return rest('mock_submissions', row).then(function (r) { return !!(r && (r.ok || r.status === 409)); });
    }
  };
  function back() { location.href = 'index.html' + (DAY ? '#/marathon/' + DAY : '#/'); }
  window.IE30 = {
    done: function (kind, data) {
      var sc = data ? data.correct : null, tot = data ? data.total : null;
      var p;
      if (!DAY) p = Promise.resolve();
      else if (acc && acc.token) p = rest('rpc/ie_complete_t', { tok: acc.token, d: DAY, t: TASK, sc: sc, tot: tot });
      else {
        if (DAY <= 1) {
          var g = jget('ie30_guest') || { name: student.name, progress: [] }, x = (g.progress || []).filter(function (q) { return q.day === DAY && q.task === TASK; })[0];
          if (x) { x.score = Math.max(x.score || 0, sc || 0); x.total = tot; } else (g.progress = g.progress || []).push({ day: DAY, task: TASK, score: sc, total: tot });
          jset('ie30_guest', g);
        }
        p = Promise.resolve();
      }
      var t = setTimeout(back, 6000);
      p.then(function () { clearTimeout(t); try { sessionStorage.setItem('ie30_flash', JSON.stringify({ day: DAY, task: TASK, kind: kind })); } catch (e) {} back(); });
    }
  };
})();
