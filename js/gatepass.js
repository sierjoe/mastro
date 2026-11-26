/* MASTRO — Gate Pass (v6.23)
   Prints the class gate pass exactly like the adviser's Word template (top part of an 8.5 × 11 in page, Bookman Old Style):
     STUDENT GATE PASS · Name / Grade-Section · Reason / Timeout / Return · Noted by / Signature
   One pass can carry several learners (e.g. a classmate who keeps the sick learner company).
   Every pass is written to each learner's Anecdotal Record; companions get their own note saying they only accompanied
   a classmate, so their parents will not worry. Editing or deleting the pass updates those records too.
   Data: c.gatepass = [{id, date, out, ret, home, reason, go:[lid], comp:[lid], kind, note, by, ar:{lid: anecdotalId}, at, edited}] */
(function(){
'use strict';
const M = window.M; const {$, $$, esc, ico} = M;
const REASONS = ['Emergency','Requested by parent / guardian','Stomachache','Headache','Toothache','Fever','Feeling unwell','Dizziness','Medical / dental check-up','Family matter','Personal matter','School errand'];
const KINDS = [['neu','General observation'],['con','Concern'],['pos','Positive behavior']];
const list = (c) => (c.gatepass = c.gatepass || []);
const ui = () => (M.S.ui.gp = M.S.ui.gp || {});
const nowT = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ft = (t) => { if(!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0); return d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}); };
const fd = (d) => d ? M.parse(d).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}) : '';
const lrn = (c, id) => c.learners.find(l => l.id === id);
const nm = (c, id) => { const l = lrn(c, id); return l ? l.name : '(removed learner)'; };
// "DELA CRUZ, JUAN PEDRO" → "Juan Pedro Dela Cruz" for sentences
const nice = (c, id) => { const n = nm(c, id); const [last, rest] = n.split(','); const t = (s) => (s || '').trim().toLowerCase().replace(/(^|[\s-])\S/g, x => x.toUpperCase());
  return rest ? `${t(M.firstName(n))} ${t(last)}` : t(n); };
const joinN = (a) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const secLabel = (c) => `${c.grade}-${(c.section || '').toUpperCase()}`;
const retText = (g) => g.home ? 'Homebound' : g.ret ? ft(g.ret) : '';

/* ---------- anecdotal records that go with a pass ---------- */
function arText(c, g, lid){
  const isComp = g.comp.includes(lid); const out = ft(g.out); const goers = g.go.map(id => nice(c, id)); const comps = g.comp.map(id => nice(c, id));
  const he = (id) => (lrn(c, id) || {}).sex === 'M' ? 'He' : 'She';
  const backS = (id) => g.home ? `${he(id)} went home and did not return to school for the rest of the day (homebound).` : g.ret ? `${he(id)} returned / was expected back at ${ft(g.ret)}.` : 'Return time: not yet recorded.';
  if(!isComp){
    const with_ = g.comp.length ? `, accompanied by ${joinN(comps)}` : '';
    return {obs: `${nice(c, lid)} left the school at ${out} with a gate pass${with_}. Reason: ${g.reason}. ${backS(lid)}${g.note ? ' ' + g.note : ''}`,
      interp: `Gate pass issued because of: ${g.reason.toLowerCase()}.`,
      action: `Gate pass noted and signed by the class adviser${g.home ? '; learner sent home' : ''}. Follow up on the learner's condition / concern.`};
  }
  return {obs: `${nice(c, lid)} left the school at ${out} with a gate pass only to accompany ${joinN(goers)}, who went out because of: ${g.reason.toLowerCase()}. ${backS(lid)}${g.note ? ' ' + g.note : ''}`,
    interp: `${nice(c, lid)} was not the one with the concern — ${he(lid).toLowerCase()} went along to keep a classmate company and safe.`,
    action: 'Gate pass noted and signed by the class adviser. No concern about this learner; recorded so the parents / guardians know why the learner left school.'};
}
function syncAR(c, g){
  const A = (c.anecdotal = c.anecdotal || []); g.ar = g.ar || {}; const who = [...g.go, ...g.comp];
  Object.entries(g.ar).forEach(([lid, id]) => { if(!who.includes(lid)){ c.anecdotal = A.filter(r => r.id !== id); delete g.ar[lid]; } });
  const A2 = c.anecdotal;
  who.forEach(lid => { const t = arText(c, g, lid); let r = A2.find(x => x.id === g.ar[lid]);
    if(!r){ r = {id: M.uid('ar'), lid}; A2.push(r); g.ar[lid] = r.id; }
    Object.assign(r, {lid, date: g.date, time: g.out, place: 'School gate', kind: g.comp.includes(lid) ? 'neu' : (g.kind || 'neu'), obs: t.obs, interp: t.interp, action: t.action,
      observer: c.adviser || M.S.settings.adviser || '', term: M.termOfDate ? M.termOfDate(g.date) || r.term : r.term, gp: g.id, edited: new Date().toISOString()}); });
}
function removeAR(c, g){ const ids = new Set(Object.values(g.ar || {})); c.anecdotal = (c.anecdotal || []).filter(r => !ids.has(r.id)); }

/* ---------- the printed pass (same lines as the Word template) ---------- */
function passHtml(c, g){
  const names = [...g.go.map(id => esc(nm(c, id))), ...g.comp.map(id => `${esc(nm(c, id))} <i>(companion)</i>`)].join('; ');
  const u = (v, w, grow) => `<span class="gp-u${grow ? ' grow' : ''}" style="min-width:${w}">${v || '&nbsp;'}</span>`;
  return `<div class="gp-pass"><div class="gp-t">STUDENT GATE PASS</div>
    <div class="gp-l"><span>Name:</span>${u(names, '3.4in', 1)}<span class="gp-nw">Grade/Section: ${esc(secLabel(c))}</span></div>
    <div class="gp-l"><span>Reason:</span>${u(esc(g.reason), '2.6in')}<span>Timeout:</span>${u(esc(ft(g.out)), '1.05in')}<span>Return:</span>${u(esc(retText(g)), '1.5in')}</div>
    <div class="gp-l"><span>Noted by: ${esc((g.by || c.adviser || '').toUpperCase())}</span><span class="gp-sp"></span><span>Signature:</span>${u('', '1.35in')}</div></div>`; }
const printPass = (c, g) => M.doPrint(`<div class="gp-page">${passHtml(c, g)}</div>`, '@page{size:215.9mm 279.4mm}', {noFit: true, safe: false, margin: 0.5});

/* ---------- form: new / edit ---------- */
function form(c, g0, rr){
  const L = M.sortedLearners(c).filter(l => M.counted(l)); const isNew = !g0;
  const g = g0 ? JSON.parse(JSON.stringify(g0)) : {id: M.uid('gp'), date: M.today(), out: nowT(), ret: '', home: false, reason: '', go: [], comp: [], kind: 'neu', note: '', by: c.adviser || M.S.settings.adviser || ''};
  const role = {}; g.go.forEach(id => role[id] = 'go'); g.comp.forEach(id => role[id] = 'comp');
  M.modal(isNew ? 'New gate pass' : 'Edit gate pass', `
    <div class="field"><b>Learner(s)</b> <span class="muted small">— tap a name; tap again to switch between <b>going out</b> and <b>companion</b>, a third time to remove</span>
      <input class="input" id="gpQ" placeholder="Search a name…" style="margin:6px 0">
      <div class="gp-pick" id="gpPick"></div></div>
    <div class="field"><b>Reason</b><div class="chips gp-rs" id="gpRs" style="margin:6px 0">${REASONS.map(r => `<button type="button" class="chip" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <input class="input" id="gpR" placeholder="Choose above or type the reason" value="${esc(g.reason)}"></div>
    <div class="grid g-3" style="gap:8px">
      <label class="field">Date<input class="input" type="date" id="gpD" value="${esc(g.date)}"></label>
      <label class="field">Time out<input class="input" type="time" id="gpO" value="${esc(g.out)}"></label>
      <label class="field">Return<input class="input" type="time" id="gpT" value="${esc(g.ret)}" ${g.home ? 'disabled' : ''}></label></div>
    <label class="row small" style="gap:8px;cursor:pointer;margin:2px 0 8px"><input type="checkbox" id="gpH" ${g.home ? 'checked' : ''}> <b>Homebound</b> — will not return to school today</label>
    <div class="grid g-2" style="gap:8px">
      <label class="field">Anecdotal record type <span class="muted">(learner going out)</span><select class="input" id="gpK">${KINDS.map(([k, t]) => `<option value="${k}" ${k === g.kind ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field">Noted by<input class="input" id="gpB" value="${esc(g.by)}"></label></div>
    <label class="field">Note for the anecdotal record <span class="muted">(optional — e.g. “Mother fetched the learner.”)</span><input class="input" id="gpN" value="${esc(g.note || '')}"></label>
    <div class="tiny muted" style="margin:4px 0 10px">Saving adds the pass to each learner's <b>Anecdotal Record</b>. Companions get a note that they only accompanied a classmate.</div>
    <div class="gp-prev" id="gpPv"></div>
    <div class="row" style="gap:8px;margin-top:12px"><span class="spacer"></span><button class="btn" id="gpC">Cancel</button><button class="btn" id="gpS">${ico('save')} Save</button><button class="btn primary" id="gpSP">${ico('print')} Save &amp; print</button></div>`, b => {
    const read = () => { g.reason = $('#gpR', b).value.trim(); g.date = $('#gpD', b).value || M.today(); g.out = $('#gpO', b).value; g.home = $('#gpH', b).checked; g.ret = g.home ? '' : $('#gpT', b).value;
      g.kind = $('#gpK', b).value; g.by = $('#gpB', b).value.trim(); g.note = $('#gpN', b).value.trim();
      g.go = L.filter(l => role[l.id] === 'go').map(l => l.id); g.comp = L.filter(l => role[l.id] === 'comp').map(l => l.id).concat(g.comp.filter(id => !L.some(l => l.id === id) && role[id] === 'comp')); };
    const pick = () => { const q = M.normName($('#gpQ', b).value || '');
      $('#gpPick', b).innerHTML = [['M', 'Boys'], ['F', 'Girls']].map(([sx, t]) => { const a = L.filter(l => (sx === 'M' ? l.sex === 'M' : l.sex !== 'M') && (!q || M.normName(l.name).includes(q)));
        return a.length ? `<div class="tiny muted" style="margin:6px 0 4px">${t}</div><div class="gp-names">${a.map(l => `<button type="button" data-l="${l.id}" class="${role[l.id] || ''}">${esc(l.name)}${role[l.id] === 'go' ? ' <i>going out</i>' : role[l.id] === 'comp' ? ' <i>companion</i>' : ''}</button>`).join('')}</div>` : ''; }).join('') || '<div class="tiny muted">No match.</div>';
      $$('[data-l]', b).forEach(x => x.onclick = () => { const id = x.dataset.l; const anyGo = Object.values(role).includes('go');
        role[id] = !role[id] ? (anyGo ? 'comp' : 'go') : role[id] === 'go' ? 'comp' : undefined; if(!role[id]) delete role[id]; pick(); prev(); }); };
    const prev = () => { read(); $('#gpPv', b).innerHTML = `<div class="tiny muted" style="margin-bottom:4px">Preview</div><div class="gp-paper">${passHtml(c, g)}</div>`; };
    $('#gpQ', b).oninput = pick;
    $$('[data-r]', b).forEach(x => x.onclick = () => { $('#gpR', b).value = x.dataset.r; prev(); });
    $('#gpH', b).onchange = (e) => { $('#gpT', b).disabled = e.target.checked; prev(); };
    ['#gpR', '#gpD', '#gpO', '#gpT', '#gpB', '#gpN'].forEach(id => $(id, b).oninput = prev); $('#gpK', b).onchange = prev;
    const save = (andPrint) => { read();
      if(!g.go.length) return M.toast(g.comp.length ? 'Tap the learner who is going out (not only companions)' : 'Choose the learner');
      if(!g.reason) return M.toast('Choose or type the reason');
      const A = list(c); if(isNew){ g.at = new Date().toISOString(); A.push(g); } else { g.edited = new Date().toISOString(); A.splice(A.findIndex(x => x.id === g.id), 1, g); }
      syncAR(c, g); M.save(); M.closeModal(); rr(); M.toast(`Gate pass saved · added to ${g.go.length + g.comp.length} anecdotal record(s)`);
      if(andPrint) setTimeout(() => printPass(c, g), 120); };
    $('#gpC', b).onclick = M.closeModal; $('#gpS', b).onclick = () => save(false); $('#gpSP', b).onclick = () => save(true);
    pick(); prev();
  }, true);
}

/* ---------- the tab ---------- */
M.views.gatepass = function view(el){
  const c = M.cls(); const u = ui(); const A = list(c); const rr = () => view(el);
  const months = [...new Set(A.map(g => g.date.slice(0, 7)))].sort().reverse(); const ym = u.ym && (u.ym === 'all' || months.includes(u.ym)) ? u.ym : 'all';
  const rows = A.filter(g => (ym === 'all' || g.date.startsWith(ym)) && (!u.lid || g.go.includes(u.lid) || g.comp.includes(u.lid))).sort((a, b) => (b.date + b.out).localeCompare(a.date + a.out));
  const today = A.filter(g => g.date === M.today());
  el.innerHTML = `<div class="card gp-hero"><div class="row" style="gap:14px;flex-wrap:wrap;align-items:center">
      <div class="grow"><div class="eyebrow-s">${esc(M.className(c))} · gate pass</div><h2 style="margin:4px 0">Let a learner out — print the pass, keep the record</h2>
        <div class="small muted">Prints your gate pass on the top part of an 8.5 × 11 in page. Each pass is added to the learner's Anecdotal Record (companions included).</div></div>
      <button class="btn primary big" id="gpNew">${ico('plus')} New gate pass</button></div>
    <div class="rp-stats" style="margin-top:12px">${[['Today', today.length], ['Out now', today.filter(g => !g.home && !g.ret).length], ['Homebound today', today.filter(g => g.home).length], ['This school year', A.length]].map(([a, b2]) => `<div><span>${a}</span><b>${b2}</b></div>`).join('')}</div></div>
  <div class="card" style="margin-top:16px"><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">Gate pass records</h3><span class="spacer"></span>
      <select class="input" id="gpM" style="width:auto"><option value="all">All months</option>${months.map(m => `<option value="${m}" ${m === ym ? 'selected' : ''}>${esc(M.monthName ? M.monthName(m) : m)}</option>`).join('')}</select>
      <select class="input" id="gpLf" style="width:auto"><option value="">All learners</option>${M.sortedLearners(c).map(l => `<option value="${l.id}" ${l.id === u.lid ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
    ${rows.length ? `<div class="list">${rows.map(g => `<div class="item gp-item" style="gap:10px;align-items:center"><div class="gp-time"><b>${esc(ft(g.out))}</b><span>${esc(fd(g.date))}</span></div>
      <div class="grow"><div class="title small">${g.go.map(id => `<b>${esc(nm(c, id))}</b>`).join(', ')}${g.comp.length ? ` <span class="muted">with</span> ${g.comp.map(id => esc(nm(c, id))).join(', ')} <span class="chip" style="font-size:10px;padding:1px 7px">companion${g.comp.length > 1 ? 's' : ''}</span>` : ''}</div>
        <div class="tiny muted">${esc(g.reason)} · ${g.home ? '<b>Homebound</b>' : g.ret ? `return ${esc(ft(g.ret))}` : '<span class="low">return time not set</span>'}${g.note ? ' · ' + esc(g.note) : ''} · 📝 in anecdotal record</div></div>
      ${!g.home && !g.ret ? `<button class="btn sm" data-back="${g.id}" title="Record the time the learner came back">↩ Back now</button>` : ''}
      <button class="btn sm" data-pp="${g.id}">${ico('print')} Print</button><button class="icon-btn" data-pe="${g.id}" title="Edit">${ico('edit', 'width:16px;height:16px')}</button><button class="icon-btn del-l" data-pd="${g.id}" title="Delete">${ico('trash', 'width:16px;height:16px')}</button></div>`).join('')}</div>`
      : `<div class="empty">No gate passes ${ym === 'all' && !u.lid ? 'yet' : 'for this filter'}.</div>`}</div>`;
  $('#gpNew', el).onclick = () => form(c, null, rr);
  $('#gpM', el).onchange = (e) => { u.ym = e.target.value; M.save(); rr(); };
  $('#gpLf', el).onchange = (e) => { u.lid = e.target.value; M.save(); rr(); };
  $$('[data-pp]', el).forEach(b => b.onclick = () => printPass(c, A.find(g => g.id === b.dataset.pp)));
  $$('[data-pe]', el).forEach(b => b.onclick = () => form(c, A.find(g => g.id === b.dataset.pe), rr));
  $$('[data-back]', el).forEach(b => b.onclick = () => { const g = A.find(x => x.id === b.dataset.back); g.ret = nowT(); g.edited = new Date().toISOString(); syncAR(c, g); M.save(); rr(); M.toast(`Back at ${ft(g.ret)} · anecdotal record updated`); });
  $$('[data-pd]', el).forEach(b => b.onclick = () => { const g = A.find(x => x.id === b.dataset.pd);
    if(!confirm(`Delete this gate pass (${g.go.map(id => nm(c, id)).join(', ')} · ${fd(g.date)})?\n\nIts ${g.go.length + g.comp.length} anecdotal record(s) will be deleted too.`)) return;
    removeAR(c, g); c.gatepass = A.filter(x => x !== g); M.save(); rr(); M.toast('Gate pass deleted'); });
};
})();
