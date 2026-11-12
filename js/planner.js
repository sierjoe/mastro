/* MASTRO — My calendar (v6.20): notes, comments, reminders and alarms on any date or date range.
   · Month view on Home with the DepEd school calendar and your own notes
   · Each note: from – until, title, kind (Note · Reminder · Event · To-do), comments, optional alarm (date + time)
   · Every time MASTRO opens, a pop-up lists today's notes, what is coming in the next days and missed alarms
   · Alarms ring while MASTRO is open (sound + pop-up, and a system notification when allowed)
   Data: M.S.notes = [{id, from, to, title, kind, text, alarm:'YYYY-MM-DDTHH:MM', fired, done, created}] */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const KINDS = {note:['📝', 'Note', '#2e86ab'], rem:['⏰', 'Reminder', '#c9a227'], event:['📌', 'Event', '#6a4c93'], todo:['✅', 'To-do', '#1f6b4a']};
const notes = () => (M.S.notes = Array.isArray(M.S.notes) ? M.S.notes : []);
const D = (s) => M.parse(s);
const fd = (s, o) => D(s).toLocaleDateString(undefined, o || {month: 'short', day: 'numeric'});
const rangeTxt = (n) => n.to && n.to !== n.from ? `${fd(n.from)} – ${fd(n.to)}` : fd(n.from, {weekday: 'short', month: 'short', day: 'numeric'});
const onDay = (n, d) => d >= n.from && d <= (n.to || n.from);
const daysTo = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const alarmTxt = (a) => a ? new Date(a).toLocaleString(undefined, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) : '';
const schoolOn = (d) => ((M.SY_CAL && M.SY_CAL.ev) || []).filter(e => d >= e[0] && d <= (e[1] || e[0]));
M.notesOn = (d) => notes().filter(n => onDay(n, d));
// for Home's "Coming up": your notes from today on
M.notesAhead = (days = 30) => { const t = M.today(); return notes().filter(n => !n.done && (n.to || n.from) >= t && daysTo(t, n.from) <= days).sort((a, b) => a.from.localeCompare(b.from)); };

/* ---------- add / edit ---------- */
function form(n0, day, done){
  const isNew = !n0; const n = n0 ? Object.assign({}, n0) : {id: M.uid('nt'), from: day || M.today(), to: '', title: '', kind: 'note', text: '', alarm: '', created: new Date().toISOString()};
  M.modal(isNew ? 'New note' : 'Edit note', `
    <div class="seg" id="ntK" style="margin-bottom:10px">${Object.entries(KINDS).map(([k, [e, t]]) => `<button data-k="${k}" class="${n.kind === k ? 'on' : ''}">${e} ${t}</button>`).join('')}</div>
    <label class="field">Title<input class="input" id="ntT" value="${esc(n.title)}" placeholder="e.g. Submit SF2 to the principal"></label>
    <div class="grid g-2" style="gap:8px"><label class="field">From<input class="input" id="ntF" type="date" value="${esc(n.from)}"></label><label class="field">Until <span class="muted">(optional)</span><input class="input" id="ntU" type="date" value="${esc(n.to || '')}"></label></div>
    <label class="field">Notes / comments<textarea class="input" id="ntX" rows="4" placeholder="Details, comments, what to bring…">${esc(n.text)}</textarea></label>
    <div class="grid g-2" style="gap:8px;align-items:end"><label class="field">⏰ Alarm <span class="muted">(optional)</span><input class="input" id="ntA" type="datetime-local" value="${esc(n.alarm || '')}"></label>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px"><button class="btn sm" data-q="0">At 7:00 AM</button><button class="btn sm" data-q="-1">Day before</button><button class="btn sm" data-q="x">No alarm</button></div></div>
    <p class="tiny muted" style="margin-top:0">Alarms ring while MASTRO is open (keep it open in a tab, or the Home Screen app). A missed alarm is shown the next time you open MASTRO.</p>
    <div class="row" style="margin-top:8px;gap:8px">${isNew ? '' : `<button class="btn danger" id="ntD">Delete</button>`}<span class="spacer"></span><button class="btn" id="ntC">Cancel</button><button class="btn primary" id="ntS">${ico('save')} Save</button></div>`, b => {
    $$('#ntK button', b).forEach(x => x.onclick = () => { n.kind = x.dataset.k; $$('#ntK button', b).forEach(y => y.classList.toggle('on', y === x)); });
    $$('[data-q]', b).forEach(x => x.onclick = () => { const f = $('#ntF', b).value || M.today(); if(x.dataset.q === 'x'){ $('#ntA', b).value = ''; return; }
      const d = D(f); d.setDate(d.getDate() + +x.dataset.q); $('#ntA', b).value = `${M.iso(d)}T07:00`; });
    $('#ntC', b).onclick = M.closeModal;
    $('#ntS', b).onclick = () => { const title = $('#ntT', b).value.trim(); if(!title) return M.toast('Type a title');
      const from = $('#ntF', b).value || M.today(); let to = $('#ntU', b).value; if(to && to < from) return M.toast('“Until” is before “From”'); if(to === from) to = '';
      const alarm = $('#ntA', b).value; const changedAlarm = alarm !== (n0 ? n0.alarm || '' : '');
      Object.assign(n, {title, from, to, text: $('#ntX', b).value.trim(), alarm, edited: new Date().toISOString()}); if(changedAlarm) n.fired = false;
      if(isNew) notes().push(n); else Object.assign(n0, n);
      M.save(); M.closeModal(); M.toast('Note saved'); done && done();
      if(alarm && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); };
    if(!isNew) $('#ntD', b).onclick = () => { if(!confirm(`Delete “${n0.title}”?`)) return; M.S.notes = notes().filter(x => x !== n0); M.save(); M.closeModal(); done && done(); };
  });
}
M.noteForm = form;

/* ---------- one day ---------- */
const noteRow = (n, withDate) => `<div class="pl-n ${n.done ? 'done' : ''}" style="--kc:${KINDS[n.kind || 'note'][2]}"><button class="pl-ck" data-done="${n.id}" title="${n.done ? 'Mark as not done' : 'Mark as done'}">${n.done ? '✓' : ''}</button>
  <div class="grow"><div><b>${KINDS[n.kind || 'note'][0]} ${esc(n.title)}</b>${withDate || n.to ? ` <span class="tiny muted">${esc(rangeTxt(n))}</span>` : ''}</div>${n.text ? `<div class="small pl-tx">${esc(n.text).replace(/\n/g, '<br>')}</div>` : ''}${n.alarm ? `<div class="tiny muted">⏰ ${esc(alarmTxt(n.alarm))}${n.fired ? ' · rang' : ''}</div>` : ''}</div>
  <button class="icon-btn" data-edit="${n.id}" title="Edit">${ico('edit', 'width:16px;height:16px')}</button></div>`;
function bindRows(box, redraw){
  $$('[data-done]', box).forEach(x => x.onclick = () => { const n = notes().find(y => y.id === x.dataset.done); if(!n) return; n.done = !n.done; M.save(); redraw(); });
  $$('[data-edit]', box).forEach(x => x.onclick = () => { const n = notes().find(y => y.id === x.dataset.edit); if(n) form(n, null, redraw); });
}
function dayModal(d, after){
  const draw = () => { const S = schoolOn(d), N = M.notesOn(d);
    M.modal(fd(d, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'}), `
      ${S.length ? `<div class="tiny muted" style="margin-bottom:4px">SCHOOL CALENDAR</div>${S.map(e => `<div class="pl-n" style="--kc:#888"><div class="grow">🏫 ${esc(e[2])}</div></div>`).join('')}` : ''}
      ${M.offReason && M.offReason(d) ? `<div class="pl-n" style="--kc:#c0392b"><div class="grow">🚫 No classes: ${esc(M.offReason(d))}</div></div>` : ''}
      <div class="tiny muted" style="margin:10px 0 4px">MY NOTES</div>${N.length ? N.map(n => noteRow(n)).join('') : '<div class="empty small">Nothing yet for this day.</div>'}
      <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn primary" id="dmAdd">${ico('plus')} Add note</button></div>`, b => {
      bindRows(b, () => { draw(); after && after(); });
      $('#dmAdd', b).onclick = () => form(null, d, () => { draw(); after && after(); });
    }); };
  draw();
}

/* ---------- month view (Home) ---------- */
let viewYM = null;
M.plannerCard = function(){
  const today = M.today(); viewYM = viewYM || today.slice(0, 7);
  const [y, m] = viewYM.split('-').map(Number); const first = new Date(y, m - 1, 1); const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = []; for(let i = 0; i < 42; i++){ const d = new Date(start); d.setDate(start.getDate() + i); cells.push(M.iso(d)); }
  const weeks = cells[35].slice(0, 7) === viewYM ? 6 : 5;
  const ahead = M.notesAhead(14).slice(0, 4);
  return `<div class="card pl-card"><div class="row" style="gap:8px;flex-wrap:wrap"><h3 style="margin:0">My calendar ${M.newTag('my-calendar')}</h3><span class="spacer"></span>
      <span class="pl-nav"><button class="icon-btn" id="plPrev" title="Previous month">‹</button><b class="pl-ym">${first.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}</b><button class="icon-btn" id="plNext" title="Next month">›</button></span>
      <span class="pl-nav"><button class="btn sm" id="plToday">Today</button><button class="btn sm primary" id="plAdd">${ico('plus')} Note</button></span></div>
    <div class="pl-grid">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => `<div class="pl-wd">${w}</div>`).join('')}
      ${cells.slice(0, weeks * 7).map(d => { const N = M.notesOn(d), S = schoolOn(d); const off = d.slice(0, 7) !== viewYM; const hol = S.some(e => e[3] === 'hol') || (M.offReason && M.offReason(d));
        return `<button class="pl-day ${off ? 'off' : ''} ${d === today ? 'today' : ''} ${hol ? 'hol' : ''}" data-day="${d}" title="${esc([...S.map(e => e[2]), ...N.map(n => n.title)].join(' · '))}"><span class="pl-dn">${+d.slice(8)}</span>
          <span class="pl-dots">${S.length ? '<i class="sc"></i>' : ''}${N.slice(0, 3).map(n => `<i style="background:${KINDS[n.kind || 'note'][2]}"></i>`).join('')}</span>${N[0] ? `<span class="pl-lb">${esc(N[0].title)}</span>` : S[0] ? `<span class="pl-lb sc">${esc(S[0][2])}</span>` : ''}</button>`; }).join('')}</div>
    ${ahead.length ? `<div class="tiny muted" style="margin:10px 0 4px">NEXT 14 DAYS · MY NOTES</div>${ahead.map(n => noteRow(n, true)).join('')}` : '<div class="tiny muted" style="margin-top:8px">Tap a date to add notes, comments, reminders or an alarm. They pop up when you open MASTRO.</div>'}</div>`;
};
M.plannerBind = function(box){
  const redraw = () => { const card = $('.pl-card', box); if(!card) return; const t = document.createElement('div'); t.innerHTML = M.plannerCard(); card.replaceWith(t.firstElementChild); M.plannerBind(box); };
  const mv = (k) => { const [y, m] = viewYM.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); viewYM = M.iso(d).slice(0, 7); redraw(); };
  $('#plPrev', box).onclick = () => mv(-1); $('#plNext', box).onclick = () => mv(1); $('#plToday', box).onclick = () => { viewYM = M.today().slice(0, 7); redraw(); };
  $('#plAdd', box).onclick = () => form(null, M.today(), redraw);
  $$('[data-day]', box).forEach(x => x.onclick = () => dayModal(x.dataset.day, redraw));
  bindRows($('.pl-card', box), redraw);
};

/* ---------- pop-up every time MASTRO opens ---------- */
M.notesPopup = function(force){
  const t = M.today(); const st = M.S.settings;
  const todays = notes().filter(n => !n.done && onDay(n, t));
  const soon = notes().filter(n => !n.done && n.from > t && daysTo(t, n.from) <= (st.notesAheadDays || 3)).sort((a, b) => a.from.localeCompare(b.from));
  const missed = notes().filter(n => n.alarm && !n.fired && new Date(n.alarm) <= new Date() && !todays.includes(n));
  const school = schoolOn(t);
  if(!force && (st.notesPopup === false || (!todays.length && !soon.length && !missed.length))) return false;
  const draw = () => M.modal(`📅 ${fd(t, {weekday: 'long', month: 'long', day: 'numeric'})}`, `
    <div class="small muted" style="margin:-4px 0 10px">MASTRO <span class="ver-chip">v${esc(M.VERSION.n)}</span> · ${esc(M.VERSION.label)}</div>
    ${school.length ? `<div class="tiny muted" style="margin-bottom:4px">SCHOOL CALENDAR TODAY</div>${school.map(e => `<div class="pl-n" style="--kc:#888"><div class="grow">🏫 ${esc(e[2])}</div></div>`).join('')}` : ''}
    ${missed.length ? `<div class="tiny muted" style="margin:10px 0 4px;color:var(--red)">MISSED ALARMS</div>${missed.map(n => noteRow(n, true)).join('')}` : ''}
    <div class="tiny muted" style="margin:10px 0 4px">TODAY</div>${todays.length ? todays.map(n => noteRow(n, !!n.to)).join('') : '<div class="empty small">No notes for today.</div>'}
    ${soon.length ? `<div class="tiny muted" style="margin:10px 0 4px">COMING UP</div>${soon.map(n => noteRow(n, true)).join('')}` : ''}
    <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="npOff" ${st.notesPopup === false ? 'checked' : ''}> Don't show when I open MASTRO</label><span class="spacer"></span><button class="btn" id="npAdd">${ico('plus')} Note</button><button class="btn primary" id="npOk">OK</button></div>`, b => {
    missed.forEach(n => { n.fired = true; }); if(missed.length) M.save();
    bindRows(b, draw);
    $('#npOk', b).onclick = M.closeModal; $('#npAdd', b).onclick = () => form(null, t, draw);
    $('#npOff', b).onchange = (e) => { st.notesPopup = e.target.checked ? false : true; M.save(); };
  });
  draw(); return true;
};

/* ---------- alarms while MASTRO is open ---------- */
function beep(){ try { const A = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.35, 0.7].forEach(t => { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = 880; o.connect(g); g.connect(A.destination);
  g.gain.setValueAtTime(0.0001, A.currentTime + t); g.gain.exponentialRampToValueAtTime(0.3, A.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + t + 0.3); o.start(A.currentTime + t); o.stop(A.currentTime + t + 0.32); }); } catch(e){} }
function ring(n){
  n.fired = true; M.save(); beep();
  if(document.hidden && 'Notification' in window && Notification.permission === 'granted'){ try { new Notification(`⏰ ${n.title}`, {body: (n.text || rangeTxt(n)).slice(0, 140), icon: 'icons/brand.png'}); } catch(e){} }
  const show = () => M.modal(`⏰ ${n.title}`, `<div class="small muted">${esc(rangeTxt(n))}</div>${n.text ? `<p>${esc(n.text).replace(/\n/g, '<br>')}</p>` : ''}
    <div class="row" style="gap:8px;margin-top:12px"><span class="spacer"></span><button class="btn" id="alS">Snooze 10 min</button><button class="btn" id="alD">Mark done</button><button class="btn primary" id="alOk">OK</button></div>`, b => {
    $('#alOk', b).onclick = M.closeModal;
    $('#alS', b).onclick = () => { const d = new Date(Date.now() + 6e5); n.alarm = `${M.iso(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; n.fired = false; M.save(); M.closeModal(); M.toast('Snoozed 10 minutes'); };
    $('#alD', b).onclick = () => { n.done = true; M.save(); M.closeModal(); if(location.hash === '' || location.hash.startsWith('#home')) M.route(); };
  });
  if($('#modalWrap').hidden) show(); else { const prev = M.onModalClose; M.onModalClose = () => { if(prev) prev(); setTimeout(show, 50); }; }
}
function tick(){ if(!M.S) return; const now = new Date(); notes().forEach(n => { if(n.alarm && !n.fired && !n.done){ const at = new Date(n.alarm); if(at <= now && now - at < 15 * 6e4) ring(n); } }); }

/* start after boot: the pop-up first, then "Welcome back" (from calendar.js) when it is closed */
const boot0 = M.boot; M.boot = function(){
  const wb = M.welcomeBack; let held = false;
  M.welcomeBack = function(force){ if(!force && held) return; return wb.apply(this, arguments); };
  const r = boot0.apply(this, arguments);
  setTimeout(() => { if(!$('#modalWrap').hidden || M.storage && M.storage.blocked) return;
    if(M.notesPopup()){ held = true; M.onModalClose = () => { held = false; setTimeout(() => { if($('#modalWrap').hidden) wb(); }, 200); }; } }, 600);
  setInterval(tick, 20000); setTimeout(tick, 3000);
  const vt = $('#verTop'); if(vt){ vt.textContent = 'v' + M.VERSION.n; vt.title = `MASTRO version ${M.VERSION.n} · ${M.VERSION.label}`; }
  return r;
};
})();
