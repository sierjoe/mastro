/* MASTRO — DepEd School Calendar SY 2026–2027 (DepEd Order No. 009, s. 2026) + "last time you…" activity log */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;

/* ---------- calendar (dates from DO 009, s. 2026; DepEd may adjust them through later issuances) ---------- */
M.SY_CAL = {
  sy: '2026-2027', source: 'DepEd Order No. 009, s. 2026',
  terms: [{t:'1', from:'2026-06-08', to:'2026-09-15'}, {t:'2', from:'2026-09-16', to:'2026-12-18'}, {t:'3', from:'2027-01-04', to:'2027-04-08'}],
  // [from, to, title, kind]  kind: term · test · exam · hol · meet · break · event
  ev: [
    ['2026-06-01','2026-06-05','Brigada Eskwela · enrollment','event'],
    ['2026-06-08','2026-06-11','Opening of classes · Opening Block (start of Term 1)','term'],
    ['2026-06-12','','Independence Day','hol'],
    ['2026-06-24','','DepEd Founding Anniversary','event'],
    ['2026-07-03','','End of mandatory health assessment','event'],
    ['2026-07-06','','Term 1 · 1st teacher-made summative test','test'],
    ['2026-07-10','','End of BOSY testing window','test'],
    ['2026-07-28','','Term 1 · 2nd teacher-made summative test','test'],
    ['2026-08-21','','Ninoy Aquino Day','hol'],
    ['2026-08-28','','Term 1 examination','exam'],
    ['2026-08-31','','National Heroes Day','hol'],
    ['2026-09-01','','Term 1 examination','exam'],
    ['2026-09-02','2026-09-15','End-of-Term Block (Term 1)','term'],
    ['2026-09-09','','PTA meeting · report cards (Term 1)','meet'],
    ['2026-09-10','2026-09-15','Learners’ wellness break','break'],
    ['2026-09-15','','End of Term 1','term'],
    ['2026-09-16','','Start of Term 2','term'],
    ['2026-09-21','2026-10-23','MOSY testing window','test'],
    ['2026-10-05','','World Teachers’ Day','event'],
    ['2026-10-07','','Term 2 · 1st teacher-made summative test','test'],
    ['2026-10-29','','Term 2 · 2nd teacher-made summative test','test'],
    ['2026-11-01','','All Saints’ Day','hol'],
    ['2026-11-02','','All Souls’ Day','hol'],
    ['2026-11-27','','Araw ng Pagbasa','event'],
    ['2026-11-30','','Bonifacio Day','hol'],
    ['2026-12-03','2026-12-04','Term 2 examination','exam'],
    ['2026-12-07','2026-12-18','End-of-Term Block (Term 2) · ARAL & grade computation','term'],
    ['2026-12-08','','Feast of the Immaculate Conception','hol'],
    ['2026-12-15','','PTA meeting · progress reports (Term 2)','meet'],
    ['2026-12-16','','Year-end activity','event'],
    ['2026-12-18','','End of Term 2','term'],
    ['2026-12-19','2026-12-31','Year-end break','break'],
    ['2026-12-25','','Christmas Day','hol'],
    ['2026-12-30','','Rizal Day','hol'],
    ['2027-01-01','','New Year’s Day','hol'],
    ['2027-01-04','','Start of Term 3','term'],
    ['2027-01-25','','Term 3 · 1st teacher-made summative test','test'],
    ['2027-01-30','2027-02-26','Early registration (Kinder, Grades 1, 7, 11, transferees)','event'],
    ['2027-02-01','2027-03-12','EOSY testing window','test'],
    ['2027-02-06','','Chinese New Year','hol'],
    ['2027-02-16','','Term 3 · 2nd teacher-made summative test','test'],
    ['2027-03-15','2027-03-16','Term 3 examination (moving up & graduating learners)','exam'],
    ['2027-03-22','2027-03-23','Term 3 examination (other grade levels)','exam'],
    ['2027-03-24','','Announcement of academic excellence awardees','event'],
    ['2027-03-25','2027-03-27','Holy Week (Maundy Thursday · Good Friday · Black Saturday)','hol'],
    ['2027-04-01','2027-04-08','End-of-Term Block (Term 3)','term'],
    ['2027-04-02','','INSET','meet'], ['2027-04-05','','INSET','meet'],
    ['2027-04-06','2027-04-07','End-of-school-year rites','event'],
    ['2027-04-08','','PTA meeting · report cards · end of the school year','meet'],
    ['2027-04-09','','Day of Valor · teachers’ EOSY break begins','hol']
  ]
};
const KIND = {term:['Term','#1f6b4a'], test:['Assessment','#2e86ab'], exam:['Exam','#6a4c93'], hol:['Holiday','#c0392b'], meet:['Meeting','#c9a227'], break:['Break','#3d9970'], event:['Event','#e07a5f']};
const D = (s) => M.parse(s);
const fd = (s, o) => D(s).toLocaleDateString(undefined, o || {month:'short', day:'numeric'});
const range = (a, b) => b ? (a.slice(0, 7) === b.slice(0, 7) ? `${fd(a)}–${D(b).getDate()}` : `${fd(a)} – ${fd(b)}`) : fd(a, {weekday:'short', month:'short', day:'numeric'});
// term of a date (falls back to the nearest earlier term, so a December break counts as Term 2)
M.termOfDate = (iso) => { const T = M.SY_CAL.terms; if(!iso) return ''; const hit = T.find(t => iso >= t.from && iso <= t.to); if(hit) return hit.t;
  const prev = T.filter(t => iso > t.to).pop(); return prev ? prev.t : '1'; };
M.calendarCard = function(){
  const C = M.SY_CAL, today = M.today(); const T = C.terms.find(t => today >= t.from && today <= t.to);
  const days = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const prog = T ? Math.min(100, Math.max(0, days(T.from, today) / days(T.from, T.to) * 100)) : 0;
  const now = C.ev.filter(e => today >= e[0] && today <= (e[1] || e[0]));
  const next = C.ev.filter(e => e[0] > today).slice(0, 6);
  const row = (e) => `<div class="cal-row"><span class="cal-d">${range(e[0], e[1])}</span><span class="cal-k" style="--kc:${KIND[e[3]][1]}">${KIND[e[3]][0]}</span><span class="cal-t">${esc(e[2])}</span>${e[0] > today ? `<span class="cal-in">in ${days(today, e[0])} day${days(today, e[0]) === 1 ? '' : 's'}</span>` : ''}</div>`;
  return `<div class="card cal-card"><div class="row" style="gap:10px;flex-wrap:wrap"><div><h2 style="margin:0">School calendar · SY ${C.sy}</h2><div class="tiny muted">${C.source} · three terms, 201 class days ${M.newTag('sy-calendar')}</div></div><span class="spacer"></span><button class="btn sm" id="calAll">${ico('attendance')} Full calendar</button></div>
    ${T ? `<div class="cal-term"><b>Term ${T.t}</b><span>${fd(T.from)} – ${fd(T.to, {month:'short', day:'numeric', year:'numeric'})}</span><div class="bar-track"><div class="bar-fill" style="width:${prog.toFixed(1)}%"></div></div><span class="tiny muted">${days(today, T.to)} day(s) left in Term ${T.t}</span></div>` : '<div class="cal-term"><b>No classes today</b><span class="tiny muted">between terms / outside the school year</span></div>'}
    ${now.length ? `<div class="tiny muted" style="margin:10px 0 4px">HAPPENING NOW</div>${now.map(row).join('')}` : ''}
    <div class="tiny muted" style="margin:10px 0 4px">COMING UP</div>${next.map(row).join('') || '<div class="empty">No more events this school year.</div>'}</div>`;
};
M.calendarBind = function(el){ const b = $('#calAll', el); if(!b) return;
  b.onclick = () => { const today = M.today(); const months = {};
    M.SY_CAL.ev.forEach(e => { const k = e[0].slice(0, 7); (months[k] = months[k] || []).push(e); });
    M.modal(`School calendar · SY ${M.SY_CAL.sy}`, `<p class="small muted" style="margin-top:0">${M.SY_CAL.source}. Term 1: Jun 8 – Sep 15, 2026 · Term 2: Sep 16 – Dec 18, 2026 · Term 3: Jan 4 – Apr 8, 2027. DepEd may adjust dates through later issuances.</p>
      <div class="cal-full">${Object.entries(months).map(([k, arr]) => `<div class="cal-m"><h3>${D(k + '-01').toLocaleDateString(undefined, {month:'long', year:'numeric'})}</h3>${arr.map(e => `<div class="cal-row ${(e[1] || e[0]) < today ? 'past' : ''}"><span class="cal-d">${range(e[0], e[1])}</span><span class="cal-k" style="--kc:${KIND[e[3]][1]}">${KIND[e[3]][0]}</span><span class="cal-t">${esc(e[2])}</span></div>`).join('')}</div>`).join('')}</div>`, null, true); };
};

/* ---------- activity log: what you did, shown when you open MASTRO again ---------- */
const SID = 's' + Date.now().toString(36);
const store = () => { const S = M.S; S.activity = S.activity || []; return S.activity; };
M.logAct = function(text, key){ if(!M.S || !text) return; const A = store(); const now = new Date().toISOString(); key = key || text;
  const same = A.find(a => a.sid === SID && a.key === key); if(same){ same.n = (same.n || 1) + 1; same.at = now; }
  else A.push({sid: SID, key, text, at: now, n: 1});
  if(A.length > 400) A.splice(0, A.length - 400); clearTimeout(M.logAct._t); M.logAct._t = setTimeout(() => M.save(), 600); };
// toasts, downloads, prints and pages you open are logged automatically
const quiet = /^(pdf downloaded|word file downloaded|excel downloaded|saved|copied|nothing ticked|tick at least|choose|write the|no |not |name is required|file not found|pick a)/i;
const wrap = () => {
  const t0 = M.toast; M.toast = function(msg){ try { if(msg && !quiet.test(String(msg).trim())) M.logAct(String(msg)); } catch(e){} return t0.apply(this, arguments); };
  const d0 = M.downloadBlob; if(d0) M.downloadBlob = function(blob, name){ try { M.logAct('Downloaded ' + name, 'dl:' + name); } catch(e){} return d0.apply(this, arguments); };
  const p0 = M.doPrint; M.doPrint = function(html){ try { const H = String(html); const t = /rpc-card/.test(H) ? 'Reading Progress Cards' : /class="gslip"/.test(H) ? 'grade slips' : /class="pslip"/.test(H) ? 'progress slips' : (H.match(/class="(?:p-title|ar-title|ps-title)">([^<]{3,60})</) || [])[1]; M.logAct('Printed ' + (t ? t.trim().toLowerCase() : 'a page'), 'pr:' + (t || '')); } catch(e){} return p0.apply(this, arguments); };
  window.addEventListener('hashchange', () => { const id = (location.hash.slice(1).split('/')[0]) || 'home'; const v = (M.NAV || []).find(x => x.id === id); if(v && id !== 'home') M.logAct('Opened ' + v.label, 'nav:' + id); });
};
const agoText = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} day(s) ago`; };
M.welcomeBack = function(force){
  const st = M.S.settings; if(st.welcomeBack === false && !force) return;
  const A = store().filter(a => a.sid !== SID); if(!A.length) return force ? M.toast('Nothing logged yet') : null;
  const last = A[A.length - 1].sid; const S = A.filter(a => a.sid === last);
  const start = S[0].at, end = S[S.length - 1].at;
  const did = S.filter(a => !/^nav:/.test(a.key) && a.key !== 'open'), seen = S.filter(a => /^nav:/.test(a.key));
  const when = new Date(start).toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'}) + ', ' + new Date(start).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) + ' – ' + new Date(end).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  M.modal('👋 Welcome back!', `<p style="margin-top:0">Last time you used MASTRO — <b>${esc(when)}</b> <span class="tiny muted">(${agoText(end)})</span>:</p>
    ${did.length ? `<ul class="wb-list">${did.slice(-14).reverse().map(a => `<li>${esc(a.text)}${a.n > 1 ? ` <span class="chip" style="font-size:10px;padding:1px 7px">×${a.n}</span>` : ''}<span class="tiny muted"> · ${new Date(a.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</span></li>`).join('')}</ul>` : '<p class="small muted">You looked around without changing anything.</p>'}
    ${seen.length ? `<p class="small muted">Pages you opened: ${seen.map(a => esc(a.text.replace(/^Opened /, ''))).join(' · ')}</p>` : ''}
    <div class="row" style="margin-top:12px;gap:8px"><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="wbOff" ${st.welcomeBack === false ? 'checked' : ''}> Don't show this when I open MASTRO</label><span class="spacer"></span><button class="btn primary" id="wbOk">Continue</button></div>`, b => {
    $('#wbOk', b).onclick = M.closeModal; $('#wbOff', b).onchange = (e) => { st.welcomeBack = e.target.checked ? false : true; M.save(); };
  });
};
// start once the app has booted
const boot0 = M.boot; M.boot = function(){ const r = boot0.apply(this, arguments); wrap(); M.logAct('Opened MASTRO', 'open'); setTimeout(() => { if($('#modalWrap').hidden) M.welcomeBack(); }, 900); return r; };
})();
