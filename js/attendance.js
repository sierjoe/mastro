/* MASTRO — Attendance (SeatCheck inside MASTRO)
   Seat taps: tap = Absent · double-tap = Late · hold = Excused · tap again = clear.
   Data format is the same as a SeatCheck backup, so SeatCheck backups import directly. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const STATUS = {A:'Absent', L:'Late', E:'Excused'};

const A = () => M.S.att;
const sec = () => { const a = A(); return a.sections.find(s => s.id === a.current) || a.sections[0]; };
const linkedClass = (s) => M.S.classes.find(c => c.id === s.classId);
const learnerOf = (s, sid) => { const c = linkedClass(s), st = s.students[sid]; return c && st && st.lid ? c.learners.find(l => l.id === st.lid) : null; };
M.attFullName = (s, sid) => { const l = learnerOf(s, sid); return l ? l.name : (s.students[sid]||{}).name || '?'; };
const nick = (s, sid) => { const l = learnerOf(s, sid); return l && l.sf1 ? M.shortName(l.name) : ((s.students[sid]||{}).name || '?'); };
M.attNick = (s, sid) => nick(s, sid);
// students in display order (boys then girls, by full name)
const ordered = (s, includeOut=true) => Object.keys(s.students).filter(sid => includeOut || !s.students[sid].outType)
  .sort((a,b) => { const x=s.students[a], y=s.students[b]; const sx = (x.sex||'Z').localeCompare(y.sex||'Z'); return (x.sex===y.sex?0:(x.sex==='M'?-1:y.sex==='M'?1:sx)) || M.attFullName(s,a).localeCompare(M.attFullName(s,b)); });
// enrolled on a date? (respects transferred-in and transferred/dropped-out dates)
const enrolledOn = (st, d) => !(st.inDate && d < st.inDate) && !(st.outType && st.outDate && d >= st.outDate) && !(st.outType && !st.outDate);
const ui = () => (M.attUI = M.attUI || {date:M.today(), month:M.today().slice(0,7), week:M.mondayOf(M.today()), edit:false, sel:null});

/* =====================================================================
   VIEW
   ===================================================================== */
M.views.attendance = function view(el){
  const a = A(); const u = ui();
  if(!a.sections.length){ el.innerHTML = `<div class="card"><div class="empty">No sections yet.</div><div class="row" style="justify-content:center"><button class="btn primary" id="addSec">${ico('plus')} Add a section</button><button class="btn" id="impSc">${ico('upload')} Import SeatCheck backup</button><input type="file" id="impScF" accept=".json" hidden></div></div>`;
    $('#addSec').onclick = () => sectionForm(null); $('#impSc').onclick = () => $('#impScF').click(); $('#impScF').onchange = e => { if(e.target.files[0]) importSeatCheck(e.target.files[0]); }; return; }
  const s = sec(); const tab = M.S.ui.attTab || 'seats';
  const c = linkedClass(s);
  el.innerHTML = `
  <div class="card att-head">
    <div class="row">
      <div class="seg" id="secSeg">${a.sections.map(x=>`<button data-id="${x.id}" class="${x.id===s.id?'on':''}">${esc(x.name)}</button>`).join('')}</div>
      <span class="spacer"></span>
      <div class="seg" id="attTabs">${[['seats','Seats'],['month','Month'],['clean','Cleaning'],['reports','SF2 / SF4'],['manage','Manage']].map(([k,l])=>`<button data-t="${k}" class="${k===tab?'on':''}">${l}</button>`).join('')}</div>
    </div>
    <div class="tiny muted" style="margin-top:10px">${Object.values(s.students).filter(x=>!x.outType).length} active learners · ${c?`linked to <b>${esc(M.className(c))}</b>`:'not linked to a MASTRO class'}</div>
  </div>
  <div id="attBody" style="margin-top:20px"></div>`;
  $('#secSeg').onclick = e => { const b=e.target.closest('button'); if(!b) return; a.current=b.dataset.id; u.sel=null; M.save(); view(el); };
  $('#attTabs').onclick = e => { const b=e.target.closest('button'); if(!b) return; M.S.ui.attTab=b.dataset.t; M.save(); view(el); };
  const body = $('#attBody');
  ({seats:seatsTab, month:monthTab, clean:cleanTab, reports:reportsTab, manage:manageTab})[tab](body, s, () => view(el));
};

/* =====================================================================
   SEATS — daily attendance on the seating chart
   ===================================================================== */
function seatsTab(el, s, rerender){
  const u = ui(); const d = u.date;
  const unseated = Object.keys(s.students).filter(sid => !s.seats.includes(sid) && !s.students[sid].outType);
  el.innerHTML = `
  <div class="card" id="attHead"></div>
  <div class="card" style="margin-top:20px">
    <div class="tiny muted" style="text-align:center;margin-bottom:10px">${u.edit?'<b>Arrange mode:</b> tap a seat, then tap another seat to swap · tap the selected seat again to edit · tap an empty seat to add a learner':'<b>Tap</b> = absent · <b>double-tap</b> = late · <b>hold</b> = excused · tap again to clear'}</div>
    ${s.flip?'':`<div class="desk">FRONT · TEACHER'S TABLE</div>`}
    <div class="seats" id="seats" style="grid-template-columns:${seatCols(s.cols)}">${seatHtml(s, d, s.att[d], u)}</div>
    ${s.flip?`<div class="desk" style="margin-top:14px">FRONT · TEACHER'S TABLE</div>`:''}
    <div class="row" style="margin-top:14px;justify-content:center"><button class="btn sm" id="flipBtn">⇅ ${s.flip?"Teacher's view":"Students' view"} — flip</button></div>
  </div>
  ${unseated.length||u.edit?`<div class="card" style="margin-top:20px"><div class="row"><h2 style="margin:0">Not seated (${unseated.length})</h2><span class="spacer"></span><button class="btn sm" id="addStu">${ico('plus')} Add learner</button></div>
    <div class="chips" style="margin-top:12px" id="tray">${unseated.map(sid=>`<button class="chip seat-chip ${u.sel===sid?'sel':''}" data-sid="${sid}">${esc(nick(s,sid))}</button>`).join('')||'<span class="muted small">Everyone has a seat.</span>'}</div></div>`:''}`;
  const head = () => {
    const rec = s.att[d];
    const active = Object.entries(s.students).filter(([,st]) => enrolledOn(st, d));
    const cnt = (k) => rec ? Object.entries(rec).filter(([sid,v]) => v===k && s.students[sid]).length : 0;
    const bySex = (sx) => active.filter(([sid,st]) => st.sex===sx && !(rec && (rec[sid]==='A'||rec[sid]==='E'))).length;
    $('#attHead').innerHTML = `
    <div class="row">
      <button class="icon-btn" id="dPrev" aria-label="Previous day">${ico('left','width:18px;height:18px')}</button>
      <input type="date" class="input" id="dPick" value="${d}" style="width:auto">
      <button class="icon-btn" id="dNext" aria-label="Next day">${ico('right','width:18px;height:18px')}</button>
      <button class="btn sm" id="dToday">Today</button>
      <span class="spacer"></span>
      <span class="chip green">Present ${M.isSchoolDay(d)?active.length - cnt('A') - cnt('E'):'—'}</span>
      <span class="chip red">Absent ${cnt('A')}</span>
      <span class="chip gold">Late ${cnt('L')}</span>
      <span class="chip" style="color:#4a6bb5">Excused ${cnt('E')}</span>
    </div>
    <div class="row" style="margin-top:12px">
      <span class="small muted">${M.isSchoolDay(d) ? `<b style="color:var(--green)">● Class day</b> · Boys present ${bySex('M')} · Girls present ${bySex('F')}${d>M.today()?' · <i>future date</i>':''}` : M.offReason(d) ? `<b style="color:var(--red)">● No class:</b> ${esc(M.offReason(d))}` : !M.isWeekday(d) ? '<b>Weekend</b>' : '<b>Outside the school year</b> (see Manage → School calendar)'}</span>
      <span class="spacer"></span>
      ${M.offReason(d) ? `<button class="btn sm" id="unHol">Make it a class day</button>` : M.isSchoolDay(d) ? `<button class="btn sm" id="setHol">Mark as holiday / no class</button>` : ''}
      <button class="btn sm ${u.edit?'gold':''}" id="editBtn">${ico('edit')} ${u.edit?'Done arranging':'Arrange seats'}</button>
    </div>`;
    $('#dPick').onchange = e => { if(e.target.value){ u.date = e.target.value; rerender(); } };
    $('#dPrev').onclick = () => { let x = M.addDays(u.date,-1); while([0,6].includes(M.parse(x).getDay())) x = M.addDays(x,-1); u.date = x; rerender(); };
    $('#dNext').onclick = () => { let x = M.addDays(u.date,1); while([0,6].includes(M.parse(x).getDay())) x = M.addDays(x,1); u.date = x; rerender(); };
    $('#dToday').onclick = () => { u.date = M.today(); rerender(); };
    if($('#setHol')) $('#setHol').onclick = () => { M.markHoliday(d); rerender(); };
    if($('#unHol')) $('#unHol').onclick = () => { delete M.cal().off[d]; M.save(); rerender(); };
    $('#editBtn').onclick = () => { u.edit = !u.edit; u.sel = null; rerender(); };
  };
  head();
  $('#flipBtn').onclick = () => { s.flip = !s.flip; M.save(); rerender(); };
  if($('#addStu')) $('#addStu').onclick = () => studentForm(s, null, null, rerender);
  if($('#tray')) $('#tray').onclick = e => { const b = e.target.closest('[data-sid]'); if(!b) return; u.sel = u.sel===b.dataset.sid ? null : b.dataset.sid; rerender(); };
  bindSeats($('#seats'), s, rerender, head);
}
// columns come in pairs; an aisle (divider) is drawn after every 2 columns
const seatCols = (n) => [...Array(n).keys()].map(c => 'minmax(0,1fr)' + (c%2===1 && c<n-1 ? ' var(--aisle,16px)' : '')).join(' ');
function seatHtml(s, d, rec, u){
  const idx = [...Array(s.rows*s.cols).keys()];
  if(s.flip) idx.reverse();
  return idx.map((i, pos) => {
    const dc = pos % s.cols; const aisle = (dc%2===1 && dc<s.cols-1) ? '<div class="aisle" aria-hidden="true"></div>' : '';
    const sid = s.seats[i];
    if(!sid || !s.students[sid]) return `<div class="seat empty ${u.edit&&u.sel==='@'+i?'sel':''}" data-i="${i}">${u.edit?'+':''}</div>` + aisle;
    const st = s.students[sid]; const v = rec ? rec[sid] : '';
    const out = !enrolledOn(st, d); const L = learnerOf(s, sid); const tag = L && L.status;
    return `<div class="seat ${v||''} ${out?'out':''} ${u.sel===sid?'sel':''} ${tag?'tag-'+tag:''}" data-i="${i}" data-sid="${sid}" title="${esc(M.attFullName(s,sid))}${tag?' · '+esc(M.STATUS[tag].label):''}">
      <span class="nm">${esc(nick(s,sid))}</span>${v?`<span class="badge">${v}</span>`:''}${out?'<span class="badge">OUT</span>':''}${tag&&!out?`<span class="stbadge">${M.STATUS[tag].short}</span>`:''}<span class="sx ${st.sex||''}"></span></div>` + aisle;
  }).join('');
}
function setMark(s, d, sid, v){
  s.att[d] = s.att[d] || {};
  if(v) s.att[d][sid] = v; else delete s.att[d][sid];
  M.save();
}
function bindSeats(grid, s, rerender, head){
  const u = ui();
  let holdT = null, held = false, tapT = null, tapSid = null;
  grid.addEventListener('contextmenu', e => e.preventDefault());
  if(u.edit){
    grid.onclick = e => {
      const t = e.target.closest('.seat'); if(!t) return; const i = +t.dataset.i, sid = t.dataset.sid;
      if(u.sel && u.sel.startsWith && u.sel.startsWith('@')) u.sel = null;
      if(!u.sel){ if(sid){ u.sel = sid; } else { studentForm(s, null, i, rerender); return; } rerender(); return; }
      if(u.sel === sid){ u.sel = null; studentForm(s, sid, null, rerender); return; }
      // move/swap selected learner into this seat
      const from = s.seats.indexOf(u.sel);
      const here = s.seats[i];
      s.seats[i] = u.sel; if(from>=0) s.seats[from] = here || null;
      u.sel = null; M.save(); rerender();
    };
    return;
  }
  const apply = (sid, v) => { const d = u.date; const st = s.students[sid]; if(!enrolledOn(st, d)) { M.toast(`${nick(s,sid)} is not enrolled on this date`); return; }
    if(!M.isSchoolDay(d)) { M.toast(M.offReason(d) ? `No class: ${M.offReason(d)}` : 'Not a school day'); return; } setMark(s, d, sid, v); paint(sid); };
  const paint = (sid) => { const t = grid.querySelector(`.seat[data-sid="${sid}"]`); if(!t) return; const v = (s.att[u.date]||{})[sid]||'';
    t.classList.remove('A','L','E'); if(v) t.classList.add(v); const b = t.querySelector('.badge'); if(b) b.remove(); if(v) t.insertAdjacentHTML('beforeend', `<span class="badge">${v}</span>`);
    if(navigator.vibrate) navigator.vibrate(v==='E'?30:12); refreshCounts(); };
  const refreshCounts = () => head();
  grid.addEventListener('pointerdown', e => {
    const t = e.target.closest('.seat[data-sid]'); if(!t) return; held = false;
    holdT = setTimeout(() => { held = true; apply(t.dataset.sid, 'E'); }, 520);
  });
  const cancel = () => clearTimeout(holdT);
  grid.addEventListener('pointerleave', cancel); grid.addEventListener('pointercancel', cancel);
  grid.addEventListener('pointerup', e => {
    clearTimeout(holdT);
    const t = e.target.closest('.seat[data-sid]'); if(!t || held) { held = false; return; }
    const sid = t.dataset.sid;
    if(tapT && tapSid === sid){ clearTimeout(tapT); tapT = null; apply(sid, 'L'); return; }
    clearTimeout(tapT); tapSid = sid;
    tapT = setTimeout(() => { tapT = null; const cur = (s.att[u.date]||{})[sid]; apply(sid, cur ? '' : 'A'); }, 260);
  });
}
function studentForm(s, sid, seatIndex, rerender){
  const st = sid ? s.students[sid] : {name:'', sex:'M'};
  const c = linkedClass(s);
  const used = new Set(Object.entries(s.students).filter(([k])=>k!==sid).map(([,x])=>x.lid).filter(Boolean));
  M.modal(sid ? 'Edit learner' : 'Add learner', `
    <div class="grid g-2">
      <label class="field">Seat name / nickname<input class="input" id="sN" value="${esc(st.name)}"></label>
      <label class="field">Sex<select class="input" id="sS"><option value="M" ${st.sex==='M'?'selected':''}>Male</option><option value="F" ${st.sex==='F'?'selected':''}>Female</option></select></label>
      ${c?`<label class="field" style="grid-column:1/-1">Linked learner in ${esc(M.className(c))} <span class="muted">(full name used on SF2 / SF9)</span><select class="input" id="sL"><option value="">— not linked —</option>${M.sortedLearners(c).filter(l=>!used.has(l.id)||l.id===st.lid).map(l=>`<option value="${l.id}" ${l.id===st.lid?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>`:''}
      <label class="field">Status<select class="input" id="sO"><option value="">Active</option><option value="transferred" ${st.outType==='transferred'?'selected':''}>Transferred out</option><option value="dropped" ${st.outType==='dropped'?'selected':''}>Dropped out</option></select></label>
      <label class="field">Effective date (out)<input type="date" class="input" id="sOD" value="${esc(st.outDate||'')}"></label>
      <label class="field">Joined class on <span class="muted">(late enrollee / transferred in)</span><input type="date" class="input" id="sID" value="${esc(st.inDate||'')}"></label>
      <label class="field">Joined as<select class="input" id="sIT"><option value="">—</option><option value="transferred" ${st.inType==='transferred'?'selected':''}>Transferred in</option><option value="late" ${st.inType==='late'?'selected':''}>Late enrollee</option></select></label>
      <label class="field" style="grid-column:1/-1">Note<input class="input" id="sNote" value="${esc(st.outNote||'')}"></label>
    </div>
    <div class="row" style="margin-top:16px">${sid?`<button class="btn sm danger" id="sDel">Delete</button><button class="btn sm" id="sUnseat">Remove from seat</button>`:''}<span class="spacer"></span><button class="btn" id="sCancel">Cancel</button><button class="btn primary" id="sSave">Save</button></div>`,
  b => {
    $('#sCancel',b).onclick = M.closeModal;
    if(sid){
      $('#sDel',b).onclick = () => { if(!confirm(`Delete ${st.name} from ${s.name}? Their attendance marks are removed too.`)) return;
        delete s.students[sid]; s.seats = s.seats.map(x=>x===sid?null:x); Object.values(s.att).forEach(r=>delete r[sid]); M.save(); M.closeModal(); rerender(); };
      $('#sUnseat',b).onclick = () => { s.seats = s.seats.map(x=>x===sid?null:x); M.save(); M.closeModal(); rerender(); };
    }
    $('#sSave',b).onclick = () => {
      const name = $('#sN',b).value.trim(); if(!name) return M.toast('Name is required');
      const id = sid || Math.random().toString(36).slice(2,13);
      const x = s.students[id] = Object.assign(s.students[id]||{}, {name, sex:$('#sS',b).value});
      if($('#sL',b)) x.lid = $('#sL',b).value || undefined;
      const o = $('#sO',b).value; if(o){ x.outType = o; x.outDate = $('#sOD',b).value || M.today(); } else { delete x.outType; delete x.outDate; }
      const inD = $('#sID',b).value; if(inD){ x.inDate = inD; x.inType = $('#sIT',b).value || 'late'; } else { delete x.inDate; delete x.inType; }
      x.outNote = $('#sNote',b).value.trim();
      if(!sid && seatIndex!=null) s.seats[seatIndex] = id;
      M.save(); M.closeModal(); rerender(); M.toast('Saved');
    };
  });
}

/* =====================================================================
   MONTH — attendance grid, editable
   ===================================================================== */
M.markHoliday = (d) => {
  const r = prompt(`Reason for no class on ${M.longDate(d)} (e.g. holiday, class suspension, typhoon):`, 'Class suspension');
  if(r===null) return false; M.cal().off[d] = r.trim() || 'No class'; M.save(); M.toast('Marked as no class'); return true;
};
function monthTab(el, s, rerender){
  const u = ui(); const ym = u.month; const today = M.today();
  const days = M.weekdaysOfMonth(ym);
  const live = (d) => M.isSchoolDay(d) && d <= today;
  const list = ordered(s);
  let last = null, n = 0;
  const rows = list.map(sid => {
    const st = s.students[sid]; let pre = '';
    if(st.sex!==last){ last = st.sex; pre = `<tr class="group"><td class="sticky-col" colspan="2">${st.sex==='M'?'Male':st.sex==='F'?'Female':'—'}</td><td colspan="${days.length+3}"></td></tr>`; }
    let a=0,l=0,e=0;
    const cells = days.map(d => { const v = (s.att[d]||{})[sid]||''; const en = enrolledOn(st, d);
      if(M.offReason(d)) return `<td class="mc hol" title="${esc(M.offReason(d))}"></td>`;
      if(!live(d)) return `<td class="mc fut"></td>`;
      if(v==='A')a++; if(v==='L')l++; if(v==='E')e++;
      return `<td class="mc rec ${v} ${en?'':'na'}" data-d="${d}" data-sid="${sid}">${en?v:'·'}</td>`; }).join('');
    return pre + `<tr><td class="muted">${++n}</td><td class="sticky-col">${esc(M.attFullName(s,sid))} ${M.statusChip(learnerOf(s,sid),1)}${st.outType?` <span class="chip red" style="font-size:10px;padding:1px 6px">${st.outType==='dropped'?'DO':'T/O'}</span>`:''}</td>${cells}<td class="num"><b class="${a+e?'low':''}">${a+e}</b></td><td class="num">${l}</td><td class="num muted">${e}</td></tr>`;
  }).join('');
  const present = days.map(d => live(d) ? list.filter(sid => enrolledOn(s.students[sid], d) && !['A','E'].includes((s.att[d]||{})[sid])).length : '');
  const classDays = days.filter(live).length, schoolDays = days.filter(d => M.isSchoolDay(d)).length;
  el.innerHTML = `
  <div class="card">
    <div class="row" style="margin-bottom:12px">
      <input type="month" class="input" id="mPick" value="${ym}" style="width:auto">
      <span class="chip green">${classDays} class day(s) so far</span><span class="chip">${schoolDays} school days this month</span>
      <span class="spacer"></span>
      <span class="tiny muted">Weekends are skipped. Tap a <b>date</b> to mark/unmark a holiday or class suspension. Tap a cell: absent → late → excused → clear. Unmarked = present.</span>
    </div>
    <div class="table-wrap"><table class="month">
      <thead><tr><th>#</th><th class="sticky-col">Learner</th>${days.map(d=>`<th class="c ${M.offReason(d)?'hol':''} ${d>today?'dim':''}" data-day="${d}" title="${M.offReason(d)?esc(M.offReason(d))+' — tap to make it a class day':'Tap to mark as holiday / no class'}">${+d.slice(8)}<div class="tiny">${M.offReason(d)?'H':['S','M','T','W','Th','F','S'][M.parse(d).getDay()]}</div></th>`).join('')}<th class="num">Abs</th><th class="num">Late</th><th class="num">Exc</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td class="sticky-col"><b>Present</b></td>${present.map(p=>`<td class="c computed">${p}</td>`).join('')}<td colspan="3"></td></tr></tfoot>
    </table></div>
    ${days.some(d=>M.offReason(d))?`<div class="tiny muted" style="margin-top:10px">${days.filter(d=>M.offReason(d)).map(d=>`<b>${M.parse(d).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</b> ${esc(M.offReason(d))}`).join(' · ')}</div>`:''}
  </div>`;
  $('#mPick').onchange = e => { if(e.target.value){ u.month = e.target.value; rerender(); } };
  el.querySelector('table.month').onclick = e => {
    const h = e.target.closest('th[data-day]');
    if(h){ const d = h.dataset.day; if(M.offReason(d)){ if(!confirm(`Make ${M.longDate(d)} a class day again?`)) return; delete M.cal().off[d]; M.save(); rerender(); } else if(M.markHoliday(d)) rerender(); return; }
    const td = e.target.closest('td[data-d]'); if(!td || td.classList.contains('na')) return;
    const cyc = {'':'A', A:'L', L:'E', E:''}; const cur = (s.att[td.dataset.d]||{})[td.dataset.sid]||'';
    setMark(s, td.dataset.d, td.dataset.sid, cyc[cur]); rerender();
  };
}

/* =====================================================================
   CLEANING — weekly groups, QR cards, scan to award points
   ===================================================================== */
const weekKey = () => ui().week;
const groupsOf = (s, wk) => s.clean.weeks[wk] || {};
const taskOfStudent = (s, wk, sid) => { const g = groupsOf(s, wk); const tid = Object.keys(g).find(t => g[t].includes(sid)); return s.clean.tasks.find(t => t.id===tid); };
const ptsIn = (s, sid, from, to) => s.clean.log.filter(x => x.sid===sid && x.date>=from && x.date<=to).reduce((a,x)=>a+(x.pts||0),0);
function award(s, sid, task, pct, date){
  const pts = Math.round((task ? task.pts : 10) * pct * 10) / 10;
  s.clean.log.push({id:Math.random().toString(36).slice(2,13), sid, date:date||M.today(), kind:'task', pts, pct, task:task?task.name:'(no task)', ts:Date.now()});
  M.save(); return pts;
}
function cleanTab(el, s, rerender){
  const u = ui(); const wk = u.week, wkEnd = M.addDays(wk, 6);
  const g = groupsOf(s, wk);
  const assigned = new Set(Object.values(g).flat());
  const active = ordered(s, false);
  const free = active.filter(sid => !assigned.has(sid));
  const monthStart = wk.slice(0,7)+'-01', monthEnd = wk.slice(0,7)+'-31';
  const board = active.map(sid => ({sid, w:ptsIn(s,sid,wk,wkEnd), m:ptsIn(s,sid,monthStart,monthEnd), t:ptsIn(s,sid,'0000','9999')})).sort((a,b)=>b.w-a.w||b.t-a.t);
  const todayLog = s.clean.log.filter(x => x.date===M.today()).sort((a,b)=>b.ts-a.ts);
  el.innerHTML = `
  <div class="card">
    <div class="row">
      <button class="icon-btn" id="wPrev">${ico('left','width:18px;height:18px')}</button>
      <b>Week of ${M.parse(wk).toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${M.parse(M.addDays(wk,4)).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</b>
      <button class="icon-btn" id="wNext">${ico('right','width:18px;height:18px')}</button>
      <span class="spacer"></span>
      <button class="btn sm primary" id="scanBtn">${ico('camera')} Scan QR card</button>
      <button class="btn sm" id="qrBtn">${ico('qr')} Print QR cards</button>
      <button class="btn sm" id="taskBtn">${ico('broom')} Tasks</button>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn sm" id="autoBtn">Auto-assign groups</button>
      <button class="btn sm" id="rotBtn">Rotate from last week</button>
      <button class="btn sm danger" id="clrBtn">Clear week</button>
      <span class="spacer"></span><span class="tiny muted">Tap a name to award points or move them.</span>
    </div>
  </div>
  ${s.clean.tasks.length ? `<div class="grid g-3" style="margin-top:20px">${s.clean.tasks.map(t => { const mem = (g[t.id]||[]).filter(sid=>s.students[sid]);
    return `<div class="card task"><div class="row"><h2 style="margin:0">${esc(t.name)}</h2><span class="spacer"></span><span class="chip green">${t.pts} pts</span></div>
      <div class="tiny muted" style="margin:4px 0 10px">${mem.length}${t.size?` of ${t.size}`:''} member(s)</div>
      <div class="chips">${mem.map(sid=>`<button class="chip mem ${s.students[sid].sex}" data-sid="${sid}">${esc(nick(s,sid))} <b>${ptsIn(s,sid,wk,wkEnd)||''}</b></button>`).join('')||'<span class="muted small">No members</span>'}</div></div>`; }).join('')}</div>`
  : `<div class="card" style="margin-top:20px"><div class="empty">No cleaning tasks yet. Tap <b>Tasks</b> to add (e.g. Classroom, Porch, Comfort room).</div></div>`}
  ${free.length?`<div class="card" style="margin-top:20px"><h2>Not in a group this week (${free.length})</h2><div class="chips">${free.map(sid=>`<button class="chip mem" data-sid="${sid}">${esc(nick(s,sid))}</button>`).join('')}</div></div>`:''}
  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Leaderboard</h2><div class="table-wrap" style="max-height:420px"><table><thead><tr><th>#</th><th>Learner</th><th class="num">This week</th><th class="num">This month</th><th class="num">Total</th></tr></thead>
      <tbody>${board.map((x,i)=>`<tr><td class="muted">${i+1}</td><td>${esc(nick(s,x.sid))}</td><td class="num"><b>${x.w}</b></td><td class="num">${x.m}</td><td class="num muted">${x.t}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Today’s points (${todayLog.length})</h2><div class="list" style="max-height:420px;overflow:auto;padding:4px">${todayLog.map(x=>`<div class="item" style="padding:9px 12px"><div class="grow"><div class="title small">${esc(nick(s,x.sid))}</div><div class="tiny muted">${esc(x.task)} · ${Math.round((x.pct||1)*100)}% · ${new Date(x.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div><b>+${x.pts}</b><button class="icon-btn" data-undo="${x.id}" title="Undo">↺</button></div>`).join('')||'<div class="empty">No points yet today.</div>'}</div></div>
  </div>`;
  $('#wPrev').onclick = () => { u.week = M.addDays(wk,-7); rerender(); };
  $('#wNext').onclick = () => { u.week = M.addDays(wk,7); rerender(); };
  $('#taskBtn').onclick = () => tasksForm(s, rerender);
  $('#qrBtn').onclick = () => printQrCards(s);
  $('#scanBtn').onclick = () => scanner(s, rerender);
  $('#autoBtn').onclick = () => { if(Object.keys(g).length && !confirm('Replace this week’s groups?')) return; s.clean.weeks[wk] = autoGroups(s, active); M.save(); rerender(); };
  $('#rotBtn').onclick = () => { const prev = s.clean.weeks[M.addDays(wk,-7)]; if(!prev) return M.toast('No groups last week'); const T = s.clean.tasks; const n = {}; T.forEach((t,i)=>{ n[T[(i+1)%T.length].id] = (prev[t.id]||[]).slice(); }); s.clean.weeks[wk] = n; M.save(); rerender(); M.toast('Groups rotated to the next task'); };
  $('#clrBtn').onclick = () => { if(!confirm('Clear all groups for this week?')) return; delete s.clean.weeks[wk]; M.save(); rerender(); };
  el.onclick = e => {
    const un = e.target.closest('[data-undo]'); if(un){ s.clean.log = s.clean.log.filter(x=>x.id!==un.dataset.undo); M.save(); rerender(); return; }
    const m = e.target.closest('.mem'); if(m) memberSheet(s, m.dataset.sid, rerender);
  };
}
function autoGroups(s, active){
  const T = s.clean.tasks; if(!T.length) return {};
  const shuffle = (x) => x.map(v=>[Math.random(),v]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);
  const boys = shuffle(active.filter(x=>s.students[x].sex==='M')), girls = shuffle(active.filter(x=>s.students[x].sex!=='M'));
  const order = []; while(boys.length || girls.length){ if(boys.length) order.push(boys.shift()); if(girls.length) order.push(girls.shift()); }
  const out = {}; T.forEach(t => out[t.id] = []);
  let k = 0;
  order.forEach(sid => {
    let placed = false;
    for(let tries = 0; tries < T.length; tries++){ const t = T[(k++) % T.length]; if(!t.size || out[t.id].length < t.size){ out[t.id].push(sid); placed = true; break; } }
    if(!placed){ const t = T.reduce((m,x) => out[x.id].length < out[m.id].length ? x : m, T[0]); out[t.id].push(sid); }
  });
  return out;
}
function memberSheet(s, sid, rerender){
  const u = ui(); const wk = u.week; const t = taskOfStudent(s, wk, sid);
  M.modal(nick(s,sid), `
    <div class="small muted" style="margin-bottom:12px">${esc(M.attFullName(s,sid))} · ${t?'Task this week: <b>'+esc(t.name)+'</b>':'No task this week'}</div>
    <h3>Award points for today${t?` (${t.pts} pts)`:''}</h3>
    <div class="row">${[1,.75,.5].map(p=>`<button class="btn ${p===1?'primary':''}" data-p="${p}">${p*100}%</button>`).join('')}</div>
    <h3 style="margin-top:18px">Move to</h3>
    <div class="row"><select class="input" id="mvT" style="width:auto"><option value="">— no group —</option>${s.clean.tasks.map(x=>`<option value="${x.id}" ${t&&x.id===t.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select><button class="btn" id="mvB">Move</button></div>`,
  b => {
    $$('[data-p]', b).forEach(x => x.onclick = () => { const pts = award(s, sid, t, +x.dataset.p); M.closeModal(); rerender(); M.toast(`+${pts} pts for ${nick(s,sid)}`); });
    $('#mvB',b).onclick = () => { const g = s.clean.weeks[wk] = s.clean.weeks[wk] || {}; Object.keys(g).forEach(k => g[k] = g[k].filter(x=>x!==sid)); const to = $('#mvT',b).value; if(to){ g[to] = g[to]||[]; g[to].push(sid); } M.save(); M.closeModal(); rerender(); };
  });
}
function tasksForm(s, rerender){
  const T = s.clean.tasks;
  const row = (t) => `<div class="row task-row" data-id="${t.id}"><input class="input" data-k="name" value="${esc(t.name)}" placeholder="Task name" style="flex:2"><label class="field" style="flex-direction:row;align-items:center;gap:6px">Pts<input class="input" data-k="pts" inputmode="numeric" value="${t.pts}" style="width:64px"></label><label class="field" style="flex-direction:row;align-items:center;gap:6px">Size<input class="input" data-k="size" inputmode="numeric" value="${t.size||0}" style="width:60px"></label><button class="icon-btn" data-del title="Delete">✕</button></div>`;
  M.modal('Cleaning tasks', `<p class="small muted" style="margin-top:0">Size = how many learners per group (0 = takes the rest). Points are for a 100% rating; 75% and 50% scale down.</p>
    <div class="stack" style="gap:10px" id="tRows">${T.map(row).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn sm" id="tAdd">${ico('plus')} Add task</button><span class="spacer"></span><button class="btn primary" id="tSave">Save</button></div>`,
  b => {
    $('#tAdd',b).onclick = () => $('#tRows',b).insertAdjacentHTML('beforeend', row({id:Math.random().toString(36).slice(2,13), name:'', pts:10, size:0}));
    $('#tRows',b).onclick = e => { const d = e.target.closest('[data-del]'); if(d) d.closest('.task-row').remove(); };
    $('#tSave',b).onclick = () => {
      s.clean.tasks = $$('.task-row', b).map(r => ({id:r.dataset.id, name:$('[data-k=name]',r).value.trim(), pts:+$('[data-k=pts]',r).value||0, size:+$('[data-k=size]',r).value||0})).filter(t=>t.name);
      M.save(); M.closeModal(); rerender();
    };
  });
}
async function printQrCards(s){
  await M.loadScript('vendor/qrcode.js');
  const cards = ordered(s, false).map(sid => {
    const q = qrcode(0, 'M'); q.addData(`MASTRO:${s.id}:${sid}`); q.make();
    return `<div class="qr-card">${q.createSvgTag({cellSize:4, margin:0, scalable:true})}<div class="qn">${esc(nick(s,sid))}</div><div class="qf">${esc(M.attFullName(s,sid))}</div><div class="qs">${esc(s.name)} · Cleaning task card</div></div>`;
  }).join('');
  M.doPrint(`<div class="qr-grid">${cards}</div>`, '@page{size:A4;margin:10mm}');
}
async function scanner(s, rerender){
  await M.loadScript('vendor/jsQR.js');
  let stream = null, raf = 0, lastCode = '', lastAt = 0, paused = false;
  M.modal('Scan cleaning card', `
    <div class="scan-wrap"><video id="qv" playsinline muted></video><div class="scan-frame"></div></div>
    <div id="scanOut" class="small muted" style="margin-top:12px;text-align:center">Point the camera at a learner’s QR card.</div>`, async b => {
    const v = $('#qv', b), out = $('#scanOut', b);
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently:true});
    try { stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false}); v.srcObject = stream; await v.play(); }
    catch(e){ out.innerHTML = `<span class="low">Camera not available (${esc(e.name||e.message)}).</span> Allow camera access for this site, or award points by tapping names.`; return; }
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if(paused || v.readyState < 2) return;
      const w = Math.min(640, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth); if(!w || !h) return;
      cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const res = jsQR(cx.getImageData(0,0,w,h).data, w, h, {inversionAttempts:'dontInvert'});
      if(!res || !res.data) return;
      if(res.data === lastCode && Date.now()-lastAt < 2500) return;
      lastCode = res.data; lastAt = Date.now();
      const hit = findScanned(res.data, s);
      if(!hit){ out.innerHTML = `<span class="low">Card not recognized:</span> ${esc(res.data.slice(0,60))}`; return; }
      paused = true; if(navigator.vibrate) navigator.vibrate(40);
      const S2 = hit.sec, sid = hit.sid, t = taskOfStudent(S2, M.mondayOf(M.today()), sid);
      const dup = S2.clean.log.some(x => x.sid===sid && x.date===M.today() && (!t || x.task===t.name));
      out.innerHTML = `<div class="item" style="text-align:left"><div class="avatar ${S2.students[sid].sex}">${esc(M.initials(nick(S2,sid)))}</div><div class="grow"><div class="title">${esc(nick(S2,sid))} <span class="muted small">${esc(S2.name)}</span></div><div class="tiny muted">${t?'Task: '+esc(t.name)+' · '+t.pts+' pts':'No group this week'}${dup?' · <span class="low">already rated today</span>':''}</div></div></div>
        <div class="row" style="justify-content:center;margin-top:12px">${[1,.75,.5].map(p=>`<button class="btn ${p===1?'primary':''}" data-p="${p}">${p*100}%</button>`).join('')}<button class="btn" data-p="0">Skip</button></div>`;
      $$('[data-p]', out).forEach(x => x.onclick = () => {
        const p = +x.dataset.p; if(p){ const pts = award(S2, sid, t, p); M.toast(`+${pts} pts · ${nick(S2,sid)}`); }
        out.innerHTML = 'Ready for the next card…'; paused = false;
      });
    };
    tick();
  });
  M.onModalClose = () => { cancelAnimationFrame(raf); if(stream) stream.getTracks().forEach(t=>t.stop()); rerender(); };
}
function findScanned(text, cur){
  const secs = [cur, ...A().sections.filter(x=>x!==cur)];
  const m = String(text).match(/MASTRO:([^:]+):(.+)$/);
  if(m){ const S2 = A().sections.find(x=>x.id===m[1]); if(S2 && S2.students[m[2]]) return {sec:S2, sid:m[2]}; }
  for(const S2 of secs) for(const sid of Object.keys(S2.students)) if(String(text).includes(sid)) return {sec:S2, sid};
  const t = M.normName(text); // older cards may only carry a name
  for(const S2 of secs) for(const sid of Object.keys(S2.students)) if(M.normName(S2.students[sid].name) === t) return {sec:S2, sid};
  return null;
}

/* =====================================================================
   REPORTS — SF2 and SF4
   ===================================================================== */
M.sf2Data = function(s, ym){
  const days = M.classDays(s, ym);
  const [y,m] = ym.split('-').map(Number);
  const mStart = `${ym}-01`, mEnd = M.iso(new Date(y, m, 0));
  const list = ordered(s).filter(sid => { const st = s.students[sid]; return !(st.inDate && st.inDate > mEnd) && !(st.outType && st.outDate && st.outDate < mStart); });
  const rows = list.map(sid => {
    const st = s.students[sid]; let abs = 0, tardy = 0, exc = 0, run = 0, maxRun = 0;
    const marks = days.map(d => { if(!enrolledOn(st, d)) return '-'; const v = (s.att[d]||{})[sid]||''; if(v==='A'||v==='E'){ abs++; run++; maxRun = Math.max(maxRun, run); if(v==='E') exc++; } else run = 0; if(v==='L') tardy++; return v; });
    let remark = st.outType ? `${st.outType==='dropped'?'DROPPED OUT':'TRANSFERRED OUT'}${st.outDate?' '+st.outDate:''}${st.outNote?' – '+st.outNote:''}` : st.inDate && st.inDate.startsWith(ym) ? `${st.inType==='transferred'?'TRANSFERRED IN':'LATE ENROLLEE'} ${st.inDate}` : '';
    if(exc) remark = (remark?remark+'; ':'') + `${exc} excused`;
    return {sid, st, name:M.attFullName(s,sid), sex:st.sex, marks, abs, tardy, maxRun, remark};
  });
  const daily = (sx) => days.map((d,i) => rows.filter(r => (!sx || r.sex===sx) && r.marks[i]!=='-' && r.marks[i]!=='A' && r.marks[i]!=='E').length);
  const inMonth = (d) => d && d >= mStart && d <= mEnd;
  const regEnd = (sx) => rows.filter(r => r.sex===sx && !(r.st.outType && (!r.st.outDate || r.st.outDate <= mEnd))).length;
  const sum = (a) => a.reduce((x,y)=>x+y,0);
  const sf = s.sf2 || {};
  const enrolJune = (sx) => { const v = sx==='M' ? sf.enrolM : sf.enrolF; return v!==undefined && v!=='' ? +v : Object.values(s.students).filter(x => x.sex===sx && !(x.inDate && x.inDate > `${M.syStart(M.S.att.school.year||M.cls().sy)}-06-30`)).length; };
  const count = (pred) => ({M: rows.filter(r=>r.sex==='M'&&pred(r.st)).length, F: rows.filter(r=>r.sex==='F'&&pred(r.st)).length});
  const sx = {};
  ['M','F'].forEach(k => { const dl = daily(k); sx[k] = {daily:dl, ada: days.length ? sum(dl)/days.length : 0, reg: regEnd(k), june: enrolJune(k)}; });
  return {days, rows, daily:{M:sx.M.daily, F:sx.F.daily, T:daily(null)}, sx,
    lateEnrol: count(st => st.inType!=='transferred' && inMonth(st.inDate)),
    transIn: count(st => st.inType==='transferred' && inMonth(st.inDate)),
    dropped: count(st => st.outType==='dropped' && inMonth(st.outDate)),
    transOut: count(st => st.outType==='transferred' && inMonth(st.outDate)),
    cons5n: {M: rows.filter(r=>r.sex==='M'&&r.maxRun>=5).length, F: rows.filter(r=>r.sex==='F'&&r.maxRun>=5).length},
    mStart, mEnd};
};
function reportsTab(el, s, rerender){
  const u = ui(); const ym = u.month; const sf = s.sf2 = s.sf2 || {grade:'', section:s.name};
  const c = linkedClass(s);
  const D = M.sf2Data(s, ym);
  el.innerHTML = `
  <div class="grid g-2">
    <div class="card"><h2>SF2 · Daily Attendance Report of Learners</h2>
      <div class="grid g-2" style="gap:12px">
        <label class="field">Month<input type="month" class="input" id="rM" value="${ym}"></label>
        <label class="field">Grade level<input class="input" id="rG" value="${esc(sf.grade || (c?c.grade:''))}"></label>
        <label class="field">Enrolment 1st Friday of June · Male<input class="input" id="rEM" inputmode="numeric" placeholder="${D.sx.M.june}" value="${esc(sf.enrolM??'')}"></label>
        <label class="field">Enrolment 1st Friday of June · Female<input class="input" id="rEF" inputmode="numeric" placeholder="${D.sx.F.june}" value="${esc(sf.enrolF??'')}"></label>
        <label class="field" style="grid-column:1/-1">Adviser (for SF2/SF4)<input class="input" id="rA" value="${esc(sf.adviser || (c?c.adviser:M.S.settings.adviser))}"></label>
      </div>
      <div class="chips" style="margin:14px 0"><span class="chip">${D.days.length} class days</span><span class="chip">ADA ${(D.sx.M.ada+D.sx.F.ada).toFixed(2)}</span><span class="chip">${D.rows.length} learners</span>${c?'':'<span class="chip gold">Names: nicknames (link a class for full names)</span>'}</div>
      <div class="row"><button class="btn primary" id="sf2P">${ico('print')} Print / Save PDF</button><button class="btn" id="sf2X">${ico('download')} Excel</button></div>
    </div>
    <div class="card"><h2>SF4 · Monthly Learner’s Movement and Attendance</h2>
      <p class="small muted" style="margin-top:0">One row per section for ${esc(M.monthName(ym))}. Tick the sections to include.</p>
      <div class="list" id="sf4Secs">${A().sections.map(x=>`<label class="item" style="cursor:pointer"><input type="checkbox" data-sec="${x.id}" ${x.id===s.id||(u.sf4||[]).includes(x.id)?'checked':''}><div class="grow"><div class="title">${esc(x.name)}</div><div class="tiny muted">${M.classDays(x, ym).length} class days · ${Object.values(x.students).filter(y=>!y.outType).length} active</div></div></label>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn primary" id="sf4P">${ico('print')} Print / Save PDF</button><button class="btn" id="sf4X">${ico('download')} Excel</button></div>
    </div>
  </div>
  <div class="card" style="margin-top:20px"><h2>Preview · SF2 ${esc(M.monthName(ym))}</h2><div class="sf-preview">${sf2Html(s, ym)}</div></div>`;
  const keep = () => { sf.grade = $('#rG').value.trim(); sf.enrolM = $('#rEM').value.replace(/\D/g,''); sf.enrolF = $('#rEF').value.replace(/\D/g,''); sf.adviser = $('#rA').value.trim(); M.save(); };
  ['#rG','#rEM','#rEF','#rA'].forEach(q => $(q).onchange = () => { keep(); rerender(); });
  $('#rM').onchange = e => { if(e.target.value){ u.month = e.target.value; rerender(); } };
  $('#sf4Secs').onchange = () => { u.sf4 = $$('[data-sec]:checked').map(x=>x.dataset.sec); };
  $('#sf2P').onclick = () => { keep(); M.doPrint(sf2Html(s, ym), '@page{size:A4 landscape;margin:7mm}'); };
  $('#sf2X').onclick = () => { keep(); sf2Xlsx(s, ym); };
  const pick = () => $$('[data-sec]:checked').map(x => A().sections.find(y=>y.id===x.dataset.sec)).filter(Boolean);
  $('#sf4P').onclick = () => { keep(); M.doPrintFit(sf4Html(pick(), ym), 'A4 landscape', 7); M.toast('SF4 · A4 landscape, fitted to one page'); };
  $('#sf4X').onclick = () => { keep(); sf4Xlsx(pick(), ym); };
}
const pct = (a,b) => b ? (a/b*100).toFixed(2)+'%' : '';
function sf2Html(s, ym){
  const D = M.sf2Data(s, ym), set = M.S.settings, sf = s.sf2||{}, c = linkedClass(s);
  const dayHead = D.days.map(d => `<th class="d">${+d.slice(8)}<br>${['S','M','T','W','TH','F','S'][M.parse(d).getDay()]}</th>`).join('') || '<th class="d">—</th>';
  const mark = (v) => v==='A'||v==='E' ? 'x' : v==='L' ? '<span class="tardy"></span>' : v==='-' ? '' : '';
  let n = 0;
  const block = (sx, label) => {
    const R = D.rows.filter(r => r.sex===sx);
    const rows = R.map(r => `<tr><td class="n">${++n}</td><td class="nm">${esc(r.name)}</td>${D.days.map((d,i)=>`<td class="d ${r.marks[i]==='L'?'lt':''}">${mark(r.marks[i])}</td>`).join('')||'<td></td>'}<td class="t">${r.abs||''}</td><td class="t">${r.tardy||''}</td><td class="rm">${esc(r.remark)}</td></tr>`).join('');
    return rows + `<tr class="tot"><td></td><td class="nm">${label} | TOTAL Per Day</td>${D.daily[sx].map(x=>`<td class="d">${x}</td>`).join('')||'<td></td>'}<td class="t">${R.reduce((a,r)=>a+r.abs,0)}</td><td class="t">${R.reduce((a,r)=>a+r.tardy,0)}</td><td></td></tr>`;
  };
  const sm = D.sx.M, sfm = D.sx.F; const T = (a,b) => (+a||0)+(+b||0);
  return `<div class="sf2">
    <div class="sf-headrow">${M.sealsHtml().l}<div><div class="sf-title">School Form 2 (SF2) Daily Attendance Report of Learners</div>
    <div class="sf-sub">(This replaces Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)</div></div>${M.sealsHtml().r}</div>
    <table class="sf-meta"><tr><td>School ID <b class="box">${esc(set.schoolId)}</b></td><td>School Year <b class="box">${esc(c?c.sy:'')}</b></td><td>Report for the Month of <b class="box">${esc(M.monthName(ym).split(' ')[0].toUpperCase())}</b></td></tr>
      <tr><td colspan="2">Name of School <b class="box">${esc(set.school)}</b></td><td>Grade Level <b class="box">${esc(sf.grade||(c?c.grade:''))}</b> &nbsp; Section <b class="box">${esc(s.name)}</b></td></tr></table>
    <table class="grid2"><thead><tr><th class="n" rowspan="2">No.</th><th class="nm" rowspan="2">LEARNER'S NAME<br>(Last Name, First Name, Middle Name)</th><th colspan="${Math.max(1,D.days.length)}">(1st row for date, 2nd row for Day: M,T,W,TH,F)</th><th colspan="2">Total for the Month</th><th class="rm" rowspan="2">REMARKS (If DROPPED OUT, state reason. If TRANSFERRED IN/OUT, write the name of School.)</th></tr>
      <tr>${dayHead}<th class="t">ABSENT</th><th class="t">TARDY</th></tr></thead>
      <tbody>${block('M','MALE')}${block('F','FEMALE')}
      <tr class="tot"><td></td><td class="nm">Combined TOTAL PER DAY</td>${D.daily.T.map(x=>`<td class="d">${x}</td>`).join('')||'<td></td>'}<td class="t">${D.rows.reduce((a,r)=>a+r.abs,0)}</td><td class="t">${D.rows.reduce((a,r)=>a+r.tardy,0)}</td><td></td></tr></tbody></table>
    <div class="sf2-foot">
      <div class="guide"><b>GUIDELINES:</b> Attendance is recorded daily. Absent = <b>x</b>; Tardy = upper half of the cell shaded. Class days follow the school calendar (weekends, holidays and suspensions excluded); unmarked learners are counted present. Excused absences are counted as absences and noted in Remarks.
        <div class="cert">I certify that this is a true and correct report.<div class="sig">${esc(sf.adviser || (c?c.adviser:M.S.settings.adviser))}</div><div class="cap">(Signature of Teacher over Printed Name)</div>
        Attested by:<div class="sig">${esc(set.head)}</div><div class="cap">(Signature of School Head over Printed Name)</div></div></div>
      <table class="summary"><thead><tr><th>Month: ${esc(M.monthName(ym).split(' ')[0])}</th><th>No. of Days of Classes: ${D.days.length}</th><th>M</th><th>F</th><th>TOTAL</th></tr></thead><tbody>
        <tr><td colspan="2">* Enrolment as of (1st Friday of June)</td><td>${sm.june}</td><td>${sfm.june}</td><td>${T(sm.june,sfm.june)}</td></tr>
        <tr><td colspan="2">Late Enrollment during the month (beyond cut-off)</td><td>${D.lateEnrol.M}</td><td>${D.lateEnrol.F}</td><td>${D.lateEnrol.M+D.lateEnrol.F}</td></tr>
        <tr><td colspan="2">Registered Learners as of end of the month</td><td>${sm.reg}</td><td>${sfm.reg}</td><td>${sm.reg+sfm.reg}</td></tr>
        <tr><td colspan="2">Percentage of Enrolment as of end of the month</td><td>${pct(sm.reg,sm.june)}</td><td>${pct(sfm.reg,sfm.june)}</td><td>${pct(sm.reg+sfm.reg,T(sm.june,sfm.june))}</td></tr>
        <tr><td colspan="2">Average Daily Attendance</td><td>${sm.ada.toFixed(2)}</td><td>${sfm.ada.toFixed(2)}</td><td>${(sm.ada+sfm.ada).toFixed(2)}</td></tr>
        <tr><td colspan="2">Percentage of Attendance for the month</td><td>${pct(sm.ada,sm.reg)}</td><td>${pct(sfm.ada,sfm.reg)}</td><td>${pct(sm.ada+sfm.ada,sm.reg+sfm.reg)}</td></tr>
        <tr><td colspan="2">Number of students absent for 5 consecutive days</td><td>${D.cons5n.M}</td><td>${D.cons5n.F}</td><td>${D.cons5n.M+D.cons5n.F}</td></tr>
        <tr><td colspan="2">Drop out</td><td>${D.dropped.M}</td><td>${D.dropped.F}</td><td>${D.dropped.M+D.dropped.F}</td></tr>
        <tr><td colspan="2">Transferred out</td><td>${D.transOut.M}</td><td>${D.transOut.F}</td><td>${D.transOut.M+D.transOut.F}</td></tr>
        <tr><td colspan="2">Transferred in</td><td>${D.transIn.M}</td><td>${D.transIn.F}</td><td>${D.transIn.M+D.transIn.F}</td></tr>
      </tbody></table>
    </div></div>`;
}
function sf2Xlsx(s, ym){
  const D = M.sf2Data(s, ym), set = M.S.settings, sf = s.sf2||{}, c = linkedClass(s);
  const aoa = [['School Form 2 (SF2) Daily Attendance Report of Learners'],[],
    ['School ID', set.schoolId, '', 'School Year', c?c.sy:'', '', 'Report for the Month of', M.monthName(ym)],
    ['Name of School', set.school, '', 'Grade Level', sf.grade||(c?c.grade:''), '', 'Section', s.name],[],
    ['No.', "LEARNER'S NAME (Last Name, First Name, Middle Name)", ...D.days.map(d=>+d.slice(8)), 'ABSENT', 'TARDY', 'REMARKS'],
    ['', '', ...D.days.map(d=>['S','M','T','W','TH','F','S'][M.parse(d).getDay()]), '', '', '']];
  let n = 0;
  ['M','F'].forEach(sx => {
    D.rows.filter(r=>r.sex===sx).forEach(r => aoa.push([++n, r.name, ...r.marks.map(v => v==='A'||v==='E'?'x':v==='L'?'T':''), r.abs, r.tardy, r.remark]));
    aoa.push(['', `${sx==='M'?'MALE':'FEMALE'} | TOTAL Per Day`, ...D.daily[sx], D.rows.filter(r=>r.sex===sx).reduce((a,r)=>a+r.abs,0), D.rows.filter(r=>r.sex===sx).reduce((a,r)=>a+r.tardy,0)]);
  });
  aoa.push(['', 'Combined TOTAL PER DAY', ...D.daily.T]);
  aoa.push([],['SUMMARY','', 'M','F','TOTAL']);
  const sm = D.sx.M, sfm = D.sx.F;
  [['Enrolment as of 1st Friday of June', sm.june, sfm.june], ['Late enrolment during the month', D.lateEnrol.M, D.lateEnrol.F], ['Registered learners as of end of month', sm.reg, sfm.reg],
   ['Average daily attendance', +sm.ada.toFixed(2), +sfm.ada.toFixed(2)], ['Absent 5 consecutive days', D.cons5n.M, D.cons5n.F], ['Drop out', D.dropped.M, D.dropped.F], ['Transferred out', D.transOut.M, D.transOut.F], ['Transferred in', D.transIn.M, D.transIn.F]]
   .forEach(([k,a,b]) => aoa.push([k,'',a,b,+(a+b).toFixed?+(+a+ +b).toFixed(2):a+b]));
  aoa.push(['No. of days of classes', '', D.days.length], [], ['Prepared by:', sf.adviser||(c?c.adviser:set.adviser), '', 'Attested by:', set.head]);
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:5},{wch:38},...D.days.map(()=>({wch:4})),{wch:8},{wch:8},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'SF2 '+ym);
  XLSX.writeFile(wb, `SF2 ${s.name} ${ym}.xlsx`);
}
function sf4Rows(secs, ym){
  const [y,m] = ym.split('-').map(Number);
  const prevEnd = M.iso(new Date(y, m-1, 0));
  return secs.map(s => {
    const D = M.sf2Data(s, ym), c = linkedClass(s), st = Object.values(s.students);
    const cum = (type, field, upto, sx) => st.filter(x => x.sex===sx && x[type.k]===type.v && x[field] && x[field] <= upto).length;
    const mv = (k, v, field) => ['M','F'].map(sx => { const a = cum({k,v}, field, prevEnd, sx), b = cum({k,v}, field, D.mEnd, sx) - a; return {a, b, ab:a+b}; });
    return {s, c, D, grade:(s.sf2&&s.sf2.grade)||(c?c.grade:''), adviser:(s.sf2&&s.sf2.adviser)||(c?c.adviser:''),
      dropped: mv('outType','dropped','outDate'), tout: mv('outType','transferred','outDate'), tin: mv('inType','transferred','inDate')};
  });
}
function sf4Html(secs, ym){
  const set = M.S.settings; const R = sf4Rows(secs, ym);
  const trio = (m,f) => `<td>${m}</td><td>${f}</td><td>${(+m)+(+f)}</td>`;
  const mvCells = (mv) => ['a','b','ab'].map(k => trio(mv[0][k], mv[1][k])).join('');
  return `<div class="sf2 sf4"><div class="sf-headrow">${M.sealsHtml().l}<div><div class="sf-title">School Form 4 (SF4) Monthly Learner's Movement and Attendance</div>
    <div class="sf-sub">(This replaces Form 3 &amp; STS Form 4 – Absenteeism and Dropout Profile)</div></div>${M.sealsHtml().r}</div>
    <table class="sf-meta"><tr><td>School ID <b class="box">${esc(set.schoolId)}</b></td><td>Region <b class="box">${esc(set.regionName)}</b></td><td>Division <b class="box">${esc(set.division)}</b></td><td>District <b class="box">${esc(set.district)}</b></td></tr>
      <tr><td colspan="2">School Name <b class="box">${esc(set.school)}</b></td><td>School Year <b class="box">${esc(M.cls().sy)}</b></td><td>Report for the Month of <b class="box">${esc(M.monthName(ym))}</b></td></tr></table>
    <table class="grid2 sf4t"><thead>
      <tr><th rowspan="3">GRADE / YEAR LEVEL</th><th rowspan="3">SECTION</th><th rowspan="3">NAME OF ADVISER</th><th colspan="3" rowspan="2">REGISTERED LEARNERS (As of End of the Month)</th><th colspan="6">ATTENDANCE</th><th colspan="9">DROPPED OUT</th><th colspan="9">TRANSFERRED OUT</th><th colspan="9">TRANSFERRED IN</th></tr>
      <tr><th colspan="3">Daily Average</th><th colspan="3">Percentage for the Month</th>${['DROPPED','TOUT','TIN'].map(()=>'<th colspan="3">(A) Cumulative as of Previous Month</th><th colspan="3">(B) For the Month</th><th colspan="3">(A+B) Cumulative as of End of Month</th>').join('')}</tr>
      <tr>${Array(12).fill(0).map(()=>'<th>M</th><th>F</th><th>T</th>').join('')}</tr></thead>
      <tbody>${R.map(r => { const sm=r.D.sx.M, sf=r.D.sx.F; return `<tr><td>${esc(r.grade)}</td><td>${esc(r.s.name)}</td><td class="nm">${esc(r.adviser)}</td>${trio(sm.reg,sf.reg)}<td>${sm.ada.toFixed(2)}</td><td>${sf.ada.toFixed(2)}</td><td>${(sm.ada+sf.ada).toFixed(2)}</td><td>${pct(sm.ada,sm.reg)}</td><td>${pct(sf.ada,sf.reg)}</td><td>${pct(sm.ada+sf.ada,sm.reg+sf.reg)}</td>${mvCells(r.dropped)}${mvCells(r.tout)}${mvCells(r.tin)}</tr>`; }).join('')}</tbody></table>
    <div class="p-sign" style="margin-top:22px"><div>Prepared and submitted by:<div class="nm">${esc(set.head)}</div><div>${esc(set.headTitle||'School Head')}</div></div><div></div></div></div>`;
}
function sf4Xlsx(secs, ym){
  const R = sf4Rows(secs, ym), set = M.S.settings;
  const aoa = [["School Form 4 (SF4) Monthly Learner's Movement and Attendance"], ['School ID', set.schoolId, 'School', set.school, 'Month', M.monthName(ym)], [],
    ['Grade','Section','Adviser','Reg M','Reg F','Reg T','ADA M','ADA F','ADA T','% M','% F','% T',
     ...['Dropped','Transferred out','Transferred in'].flatMap(k => ['(A) M','(A) F','(A) T','(B) M','(B) F','(B) T','(A+B) M','(A+B) F','(A+B) T'].map(x=>k+' '+x))]];
  R.forEach(r => { const sm=r.D.sx.M, sf=r.D.sx.F; const mv = (x) => ['a','b','ab'].flatMap(k => [x[0][k], x[1][k], x[0][k]+x[1][k]]);
    aoa.push([r.grade, r.s.name, r.adviser, sm.reg, sf.reg, sm.reg+sf.reg, +sm.ada.toFixed(2), +sf.ada.toFixed(2), +(sm.ada+sf.ada).toFixed(2), pct(sm.ada,sm.reg), pct(sf.ada,sf.reg), pct(sm.ada+sf.ada,sm.reg+sf.reg), ...mv(r.dropped), ...mv(r.tout), ...mv(r.tin)]); });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'SF4 '+ym);
  XLSX.writeFile(wb, `SF4 ${ym}.xlsx`);
}

/* =====================================================================
   MANAGE — sections, linking to MASTRO classes, SeatCheck import/export
   ===================================================================== */
function manageTab(el, s, rerender){
  const c = linkedClass(s);
  const used = (lid, sid) => Object.entries(s.students).some(([k,x]) => k!==sid && x.lid===lid);
  const sids = ordered(s);
  const unlinkedLearners = c ? M.sortedLearners(c).filter(l => !Object.values(s.students).some(x=>x.lid===l.id)) : [];
  el.innerHTML = `
  <div class="grid g-2">
    <div class="card"><h2>Section: ${esc(s.name)}</h2>
      <div class="grid g-2" style="gap:12px">
        <label class="field">Section name<input class="input" id="mName" value="${esc(s.name)}"></label>
        <label class="field">Linked MASTRO class<select class="input" id="mCls"><option value="">— none —</option>${M.S.classes.map(x=>`<option value="${x.id}" ${x.id===s.classId?'selected':''}>${esc(M.className(x))}</option>`).join('')}</select></label>
        <label class="field">Seat rows<input class="input" id="mRows" inputmode="numeric" value="${s.rows}"></label>
        <label class="field">Seat columns<input class="input" id="mCols" inputmode="numeric" value="${s.cols}"></label>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn sm" id="mAddSec">${ico('plus')} New section</button><span class="spacer"></span><button class="btn sm danger" id="mDelSec">Delete section</button></div>
    </div>
    <div class="card"><h2>SeatCheck data</h2>
      <p class="small muted" style="margin-top:0">Import a backup from the SeatCheck app. Sections with the same ID are updated and keep their links to your learners; new sections are added.</p>
      <div class="row"><button class="btn primary" id="mImp">${ico('upload')} Import SeatCheck backup</button><button class="btn" id="mExp">${ico('download')} Export SeatCheck-format backup</button><input type="file" id="mImpF" accept=".json" hidden></div>
    </div>
  </div>
  <div class="card" style="margin-top:20px"><h2>School calendar</h2>
    <p class="small muted" style="margin-top:0">Attendance, SF2, SF4 and SF9 use every weekday from the opening to the closing of classes, minus the no-class days below. Pre-loaded: DepEd SY 2026–2027 (DO No. 9, s. 2026) breaks and the 2026 national holidays. Add suspensions or local holidays anytime (also by tapping a date in the Month tab).</p>
    <div class="grid g-4" style="gap:12px;align-items:end">
      <label class="field">Opening of classes<input type="date" class="input" id="calS" value="${esc(M.cal().start||'')}"></label>
      <label class="field">Last day of classes<input type="date" class="input" id="calE" value="${esc(M.cal().end||'')}"></label>
      <label class="field">Add no-class day<input type="date" class="input" id="calD"></label>
      <div class="row"><input class="input" id="calR" placeholder="Reason" style="flex:1;min-width:120px"><button class="btn sm primary" id="calAdd">${ico('plus')} Add</button></div>
    </div>
    <div class="chips" style="margin-top:14px;max-height:180px;overflow:auto;padding:4px">${Object.keys(M.cal().off).sort().map(d=>`<span class="chip">${M.parse(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · ${esc(M.cal().off[d])} <a href="#" data-rmoff="${d}" style="color:var(--red);text-decoration:none;margin-left:4px">✕</a></span>`).join('')}</div>
    <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn sm" id="calReset">Restore DepEd SY 2026–2027 defaults</button></div>
  </div>
  <div class="card" style="margin-top:20px">
    <div class="row"><h2 style="margin:0">Name links · seat name → learner</h2><span class="spacer"></span>${c?`<button class="btn sm" id="mAuto">Auto-match names</button>`:''}</div>
    ${c ? `<p class="small muted">Linking lets SF2, SF9 and the Home page use full names, LRN and grades. ${unlinkedLearners.length?`<b>Learners in ${esc(M.className(c))} without a seat:</b> ${unlinkedLearners.map(l=>esc(l.name)).join('; ')}`:''}</p>
    <div class="table-wrap"><table><thead><tr><th>Seat name</th><th>Sex</th><th>Linked learner</th><th>Status</th></tr></thead><tbody>
      ${sids.map(sid => { const st = s.students[sid]; return `<tr><td><b>${esc(st.name)}</b></td><td>${st.sex||'—'}</td><td><select class="input" data-link="${sid}" style="min-width:220px;padding:6px 10px"><option value="">— not linked —</option>${M.sortedLearners(c).filter(l=>!used(l.id,sid)).map(l=>`<option value="${l.id}" ${l.id===st.lid?'selected':''}>${esc(l.name)}</option>`).join('')}</select></td><td>${st.outType?`<span class="chip red">${st.outType} ${esc(st.outDate||'')}</span>`:st.inDate?`<span class="chip gold">${st.inType||'joined'} ${esc(st.inDate)}</span>`:'<span class="muted small">active</span>'} <button class="btn sm" data-ed="${sid}">Edit</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<div class="empty">Choose a linked MASTRO class above to connect seat names with learner records.</div>'}
  </div>`;
  $('#calS').onchange = e => { M.cal().start = e.target.value; M.save(); };
  $('#calE').onchange = e => { M.cal().end = e.target.value; M.save(); };
  $('#calAdd').onclick = () => { const d = $('#calD').value; if(!d) return M.toast('Pick a date'); M.cal().off[d] = $('#calR').value.trim() || 'No class'; M.save(); rerender(); };
  el.querySelectorAll('[data-rmoff]').forEach(a => a.onclick = (e) => { e.preventDefault(); delete M.cal().off[a.dataset.rmoff]; M.save(); rerender(); });
  $('#calReset').onclick = () => { if(!confirm('Replace the calendar with the DepEd SY 2026–2027 defaults? Your added suspensions will be removed.')) return; M.S.settings.calendar = JSON.parse(JSON.stringify(M.CAL_DEFAULT)); M.save(); rerender(); };
  $('#mName').onchange = e => { s.name = e.target.value.trim() || s.name; M.save(); rerender(); };
  $('#mCls').onchange = e => { s.classId = e.target.value; if(s.classId){ const cc = linkedClass(s); Object.entries(M.matchStudents(s, cc)).forEach(([sid,lid]) => s.students[sid].lid = lid); } M.save(); rerender(); };
  const resize = () => { const r = Math.max(1, Math.min(12, +$('#mRows').value||s.rows)), co = Math.max(1, Math.min(12, +$('#mCols').value||s.cols));
    const placed = s.seats.filter(Boolean); s.rows = r; s.cols = co; const ns = Array(r*co).fill(null); s.seats.forEach((x,i)=>{ if(x && i < ns.length) ns[i] = x; });
    placed.filter(x=>!ns.includes(x)).forEach(x => { const k = ns.indexOf(null); if(k>=0) ns[k] = x; }); s.seats = ns; M.save(); rerender(); };
  $('#mRows').onchange = resize; $('#mCols').onchange = resize;
  $('#mAddSec').onclick = () => sectionForm(null);
  $('#mDelSec').onclick = () => { if(!confirm(`Delete section ${s.name} with all its attendance and cleaning data?`)) return; A().sections = A().sections.filter(x=>x!==s); A().current = (A().sections[0]||{}).id; M.save(); rerender(); };
  $('#mImp').onclick = () => $('#mImpF').click();
  $('#mImpF').onchange = e => { if(e.target.files[0]) importSeatCheck(e.target.files[0]); e.target.value=''; };
  $('#mExp').onclick = () => { const out = JSON.parse(JSON.stringify(A())); out.version = 1; out.lastBackup = M.today(); M.downloadBlob(new Blob([JSON.stringify(out)],{type:'application/json'}), `seatcheck-backup-${M.today()}.json`); };
  if($('#mAuto')) $('#mAuto').onclick = () => { const n = M.matchStudents(s, c); Object.entries(n).forEach(([sid,lid]) => s.students[sid].lid = lid); M.save(); rerender(); M.toast(`${Object.keys(n).length} name(s) matched`); };
  el.querySelectorAll('[data-link]').forEach(x => x.onchange = () => { s.students[x.dataset.link].lid = x.value || undefined; M.save(); rerender(); });
  el.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => studentForm(s, x.dataset.ed, null, rerender));
}
function sectionForm(){
  const name = prompt('New section name (e.g. BALIKSI):'); if(!name) return;
  const id = Math.random().toString(36).slice(2,13);
  A().sections.push({id, name:name.trim(), rows:5, cols:8, flip:false, students:{}, seats:Array(40).fill(null), att:{}, clean:{tasks:[],weeks:{},log:[]}, sf2:{grade:'', section:name.trim()}});
  A().current = id; M.normalizeAtt(A()); M.save(); M.route();
}
async function importSeatCheck(file){
  try {
    const data = JSON.parse(await file.text());
    if(!Array.isArray(data.sections)) throw new Error('This is not a SeatCheck backup');
    const a = A(); let added = 0, updated = 0;
    data.sections.forEach(ns => {
      const old = a.sections.find(x => x.id === ns.id);
      if(old){ ns.classId = old.classId; ns.sf2 = Object.assign({}, old.sf2||{}, ns.sf2||{});
        Object.entries(ns.students||{}).forEach(([sid, st]) => { const o = old.students[sid]; if(o){ ['lid','inDate','inType'].forEach(k => { if(o[k]!==undefined && st[k]===undefined) st[k] = o[k]; }); } });
        a.sections[a.sections.indexOf(old)] = ns; updated++; }
      else { a.sections.push(ns); added++; }
    });
    if(data.school) a.school = Object.assign({}, a.school, data.school);
    if(data.current) a.current = data.current;
    M.normalizeAtt(a); M.autoLinkSections(); M.save(); M.route();
    M.toast(`SeatCheck imported · ${updated} updated, ${added} new section(s)`);
  } catch(e){ alert('Could not import: ' + e.message); }
}
M.importSeatCheck = importSeatCheck;
M.sf2Html = sf2Html; M.sf2Xlsx = sf2Xlsx;
})();
