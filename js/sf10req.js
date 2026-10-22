/* MASTRO — SF1 extras (Forms → SF1)
   1. View the uploaded SF1 inside the app
   2. Transferred-In (T/I) learners → SF10 request letters (editable, several learners per letter, Word download)
   3. Request tracker: 1st request · 2nd request · Urgent · Received (Received ticks "Old Form 137" in Learners) */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const STAGES = [['r1','1st request'],['r2','2nd request'],['ru','Urgent'],['rec','Received']];
const TPL = 'templates/SF10_Request_Template.docx';
const isTI = (l) => l.status === 'TI' || /\bT\s*\/\s*I\b|\bTI\b|transferr?ed\s*in/i.test(l.sf1Rem || '');
const track = (c) => (c.sf10track = c.sf10track || {});
const letters = (c) => (c.sf10letters = c.sf10letters || []);
const ui = () => (M.sf1UI = M.sf1UI || {doc:'', sheet:0, zoom:0.8, sel:{}});
const f137 = () => M.checkItemId(/137/);
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s-])([a-zñ])/g, (m, a, b) => a + b.toUpperCase());
const prevSY = (c) => { const m = String(c.sy || '').match(/(\d{4})/); return m ? `${+m[1] - 1}-${m[1]}` : ''; };

/* ---------- SF1 remarks: read them from the uploaded SF1 when the learner record has none yet ---------- */
async function syncRemarks(c){
  const docs = (await M.docsAll().catch(() => [])).filter(d => d.formCode === 'SF1' && d.blob && /\.xlsx?$/i.test(d.name)).sort((a, b) => b.added.localeCompare(a.added));
  if(!docs.length || !M.parseSF1) return false; let changed = false;
  try { const wb = XLSX.read(await docs[0].blob.arrayBuffer(), {type:'array', cellDates:false}); const P = M.parseSF1(wb); if(!P || !P.rows) return false;
    P.rows.forEach(r => { if(!r.rem) return; const l = c.learners.find(x => (r.lrn && x.lrn === r.lrn) || M.normName(x.name) === M.normName(r.name)); if(l && l.sf1Rem !== r.rem){ l.sf1Rem = r.rem; changed = true; } });
  } catch(e){ return false; }
  if(changed) M.save(); return changed;
}

/* ---------- tracker: ticking Received also ticks Old Form 137 ---------- */
function setStage(c, lid, k, on){
  const t = track(c)[lid] = track(c)[lid] || {}; if(on) t[k] = t[k] || M.today(); else delete t[k];
  if(k === 'rec'){ const id = f137(); if(id){ const cl = c.checklist[lid] = c.checklist[lid] || {}; c.autoTicks = c.autoTicks || {};
    if(on && !cl[id]){ cl[id] = M.today(); c.autoTicks[lid + ':' + id] = 1; }
    if(!on && c.autoTicks[lid + ':' + id]){ delete cl[id]; delete c.autoTicks[lid + ':' + id]; } } }
  M.save();
}

/* ---------- the letter ---------- */
const defBody = (n) => `The school would like to request for a copy of Form 10 of the following ${n > 1 ? 'students who' : 'student who'} attended in your school as Grade 6 S.Y. ${prevSY(M.cls())} and ${n > 1 ? 'are' : 'is'} temporarily enrolled in the Grade 7 Curriculum.`;
const newLetter = (c, lids) => ({id: M.uid('rq'), lids, date: '', recipient: '', body: defBody(lids.length), stage: 'r1',
  rows: Object.fromEntries(lids.map(id => [id, {section: '', year: prevSY(c)}])), phone: M.S.settings.phone || '', position: `Grade ${c.grade}-${titleCase(c.section)}, Class Moderator`, created: new Date().toISOString()});
function letterHtml(c, L){
  const s = M.S.settings; const lg = s.logos || {}; const mark = (k) => L.stage === k ? '<b>&nbsp;&nbsp;✓&nbsp;&nbsp;</b>' : '_______';
  const people = L.lids.map(id => c.learners.find(l => l.id === id)).filter(Boolean);
  return `<div class="rq-letter">
    <div class="rq-head">${lg.deped ? `<img src="${lg.deped}" alt="">` : '<span></span>'}<div><div>Department of Education</div><div>Region X</div><div>Division of Bukidnon</div><b>${esc(s.school || '')}</b><i>${esc(s.address || '')}</i></div>${lg.school ? `<img src="${lg.school}" alt="">` : '<span></span>'}</div>
    <div class="rq-date">${esc(L.date || '')}</div>
    ${L.recipient ? `<div class="rq-to">${esc(L.recipient).replace(/\n/g, '<br>')}</div>` : '<div class="rq-to rq-blank"></div>'}
    <p>Madame/Sir:</p>
    <p class="rq-body">${esc(L.body || '').replace(/\n/g, '<br>')}</p>
    <table class="rq-t"><thead><tr><th>Name</th><th>Year /Section</th><th>Year Enrolled in previous school</th></tr></thead>
      <tbody>${people.map(l => { const r = (L.rows || {})[l.id] || {}; return `<tr><td>${esc(l.name)}</td><td>${esc(r.section || '')}</td><td>${esc(r.year || '')}</td></tr>`; }).join('')}</tbody></table>
    <p class="rq-ind">Immediate action on this request is highly appreciated.</p>
    <div class="rq-sig"><div class="rq-stages"><div>1<sup>st</sup> request ${mark('r1')}</div><div>2<sup>nd</sup> request ${mark('r2')}</div><div>Urgent ${mark('ru')}</div></div>
      <div class="rq-who"><b>${esc(c.adviser || '')}</b><div>${esc(L.position || '')}</div><div>${esc(L.phone || '')}</div></div></div>
    <div class="rq-noted"><div>Noted by:</div><b>${esc(s.head || '')}</b><div>${esc(M.headTitle())}</div></div>
  </div>`;
}
const xmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const multi = (s) => xmlEsc(s).split('\n').join('</w:t><w:br/><w:t xml:space="preserve">');
async function letterDocx(c, L){
  await M.loadScript('vendor/jszip.min.js'); const r = await fetch(TPL); if(!r.ok) return alert('The SF10 request template is missing (templates/SF10_Request_Template.docx).');
  const zip = await JSZip.loadAsync(await r.arrayBuffer()); let x = await zip.file('word/document.xml').async('string');
  const people = L.lids.map(id => c.learners.find(l => l.id === id)).filter(Boolean);
  const row = (x.match(/<!--ROW-->([\s\S]*?)<!--\/ROW-->/) || [])[1] || '';
  const rows = people.map(l => { const q = (L.rows || {})[l.id] || {}; return row.replace('{{NAME}}', xmlEsc(l.name)).replace('{{SECTION}}', xmlEsc(q.section || '')).replace('{{YEAR}}', xmlEsc(q.year || '')); }).join('');
  x = x.replace(/<!--ROW-->[\s\S]*?<!--\/ROW-->/, rows);
  const s = M.S.settings; const mk = (k) => L.stage === k ? '   ✓   ' : '_______';
  const rep = {DATE: xmlEsc(L.date || ''), RECIPIENT: L.recipient ? multi(L.recipient) + '</w:t><w:br/><w:br/><w:t xml:space="preserve">' : '', BODY: multi(L.body || ''),
    R1: mk('r1'), R2: mk('r2'), RU: mk('ru'), ADVISER: xmlEsc(c.adviser || ''), POSITION: xmlEsc(L.position || ''), PHONE: xmlEsc(L.phone || ''), PRINCIPAL: xmlEsc(s.head || ''), PTITLE: xmlEsc(M.headTitle())};
  x = x.replace(/\{\{([A-Z0-9]+)\}\}/g, (m, k) => rep[k] ?? '');
  zip.file('word/document.xml', x);
  const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const who = people.length === 1 ? people[0].name.split(',')[0] : `${people.length} learners`;
  M.downloadBlob(blob, `SF10 Request - ${who} - ${STAGES.find(z => z[0] === L.stage)[1]}.docx`); M.toast('Word letter downloaded — add the date, address and your e-signature if needed');
}
const markSent = (c, L) => { L.lids.forEach(id => setStage(c, id, L.stage, true)); L.sent = L.sent || {}; L.sent[L.stage] = M.today(); M.save(); };
function editor(c, L, done){
  const isNew = !letters(c).includes(L);
  const people = () => L.lids.map(id => c.learners.find(l => l.id === id)).filter(Boolean);
  M.modal('SF10 request letter', `<div class="rq-ed">
    <div class="rq-form">
      <div class="seg" id="rqS">${STAGES.slice(0, 3).map(([k, t]) => `<button data-k="${k}" class="${L.stage === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <label class="field">Date <span class="muted">(leave blank to write by hand)</span><input class="input" id="rqD" value="${esc(L.date)}" placeholder="e.g. October 22, 2026"></label>
      <label class="field">Recipient &amp; address <span class="muted">(optional)</span><textarea class="input" id="rqR" rows="3" placeholder="The School Principal&#10;Name of school&#10;Address">${esc(L.recipient)}</textarea></label>
      <label class="field">Letter body<textarea class="input" id="rqB" rows="5">${esc(L.body)}</textarea></label>
      <div class="field">Learners in this letter<div id="rqRows"></div></div>
      <div class="grid g-2" style="gap:8px"><label class="field">Your position<input class="input" id="rqPo" value="${esc(L.position)}"></label><label class="field">Contact number<input class="input" id="rqPh" value="${esc(L.phone)}" placeholder="09xx-xxx-xxxx"></label></div>
    </div>
    <div class="rq-prev-wrap"><div class="rq-prev" id="rqPrev"></div></div></div>
    <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><span class="tiny muted">Printing or downloading marks the chosen request as sent for these learners.</span><span class="spacer"></span>
      <button class="btn" id="rqSave">${ico('save')} Save</button><button class="btn gold" id="rqW">${ico('download')} Word (.docx)</button><button class="btn primary" id="rqP">${ico('print')} Print</button></div>`, b => {
    const rowsUI = () => { $('#rqRows', b).innerHTML = people().map(l => { const r = L.rows[l.id] = L.rows[l.id] || {section:'', year: prevSY(c)};
      return `<div class="rq-row"><b>${esc(l.name)}</b><input class="input" data-rs="${l.id}" data-f="section" value="${esc(r.section)}" placeholder="Year / Section (e.g. Grade 6 – Rizal)"><input class="input" data-rs="${l.id}" data-f="year" value="${esc(r.year)}" placeholder="Year enrolled"><button class="icon-btn" data-rm="${l.id}" title="Remove from this letter">✕</button></div>`; }).join('');
      $$('[data-rs]', b).forEach(i => i.oninput = () => { L.rows[i.dataset.rs][i.dataset.f] = i.value; prev(); });
      $$('[data-rm]', b).forEach(x => x.onclick = () => { if(L.lids.length < 2) return M.toast('A letter needs at least one learner'); L.lids = L.lids.filter(id => id !== x.dataset.rm); rowsUI(); prev(); }); };
    const prev = () => { $('#rqPrev', b).innerHTML = letterHtml(c, L); };
    const bind = (id, k) => $(id, b).oninput = (e) => { L[k] = e.target.value; prev(); };
    bind('#rqD', 'date'); bind('#rqR', 'recipient'); bind('#rqB', 'body'); bind('#rqPo', 'position'); bind('#rqPh', 'phone');
    $$('#rqS button', b).forEach(x => x.onclick = () => { L.stage = x.dataset.k; $$('#rqS button', b).forEach(y => y.classList.toggle('on', y === x)); prev(); });
    const save = () => { if(isNew && !letters(c).includes(L)) letters(c).push(L); L.edited = new Date().toISOString(); if(L.phone) M.S.settings.phone = L.phone; M.save(); };
    $('#rqSave', b).onclick = () => { save(); M.closeModal(); M.toast('Letter saved'); done && done(); };
    $('#rqW', b).onclick = async () => { save(); await letterDocx(c, L); markSent(c, L); };
    $('#rqP', b).onclick = () => { save(); markSent(c, L); M.doPrint(`<div class="rq-page">${letterHtml(c, L)}</div>`, M.pageCss('A4')); };
    M.onModalClose = () => done && done();
    rowsUI(); prev();
  }, true);
}

/* ---------- SF1 viewer ---------- */
async function viewer(el){
  const u = ui(); const docs = (await M.docsAll().catch(() => [])).filter(d => d.formCode === 'SF1' && d.blob && /\.(xlsx?|xlsm)$/i.test(d.name)).sort((a, b) => b.added.localeCompare(a.added));
  if(!docs.length){ el.innerHTML = '<div class="empty">No SF1 uploaded yet. Use <b>Import SF1</b> above or drop the file in the workspace below.</div>'; return; }
  const d = docs.find(x => x.id === u.doc) || docs[0]; u.doc = d.id;
  let wb; try { wb = XLSX.read(await d.blob.arrayBuffer(), {type:'array', cellStyles:true}); } catch(e){ el.innerHTML = `<div class="empty">Could not open ${esc(d.name)}.</div>`; return; }
  const names = wb.SheetNames; if(u.sheet >= names.length) u.sheet = 0;
  const html = XLSX.utils.sheet_to_html(wb.Sheets[names[u.sheet]], {header:'', footer:''}).replace(/<html>|<\/html>|<head>.*?<\/head>|<body>|<\/body>/gs, '');
  el.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap"><select class="input" id="s1Doc" style="width:auto;max-width:340px">${docs.map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.name)} · ${esc(x.added.slice(0, 10))}</option>`).join('')}</select>
      ${names.length > 1 ? `<div class="seg" id="s1Sh">${names.map((n, i) => `<button data-i="${i}" class="${i === u.sheet ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>` : ''}<span class="spacer"></span>
      <button class="btn sm" id="s1Zo">−</button><span class="small muted" id="s1Z">${Math.round(u.zoom * 100)}%</span><button class="btn sm" id="s1Zi">+</button><button class="btn sm" id="s1Dl">${ico('download')} Download</button></div>
    <div class="s1-view"><div class="s1-sheet" style="zoom:${u.zoom}">${html}</div></div>`;
  $('#s1Doc', el).onchange = (e) => { u.doc = e.target.value; u.sheet = 0; viewer(el); };
  $$('#s1Sh button', el).forEach(x => x.onclick = () => { u.sheet = +x.dataset.i; viewer(el); });
  const z = (k) => { u.zoom = Math.max(0.4, Math.min(1.6, +(u.zoom + k).toFixed(2))); $('.s1-sheet', el).style.zoom = u.zoom; $('#s1Z', el).textContent = Math.round(u.zoom * 100) + '%'; };
  $('#s1Zo', el).onclick = () => z(-0.1); $('#s1Zi', el).onclick = () => z(0.1); $('#s1Dl', el).onclick = () => M.downloadBlob(d.blob, d.name);
  // highlight T/I remarks
  $$('.s1-sheet td', el).forEach(td => { if(/\bT\s*\/\s*I\b|\bTI\b/.test(td.textContent)) td.classList.add('s1-ti'); });
}

/* ---------- the SF1 cards ---------- */
M.sf1Extras = async function(wrap){
  const c = M.cls(); wrap.innerHTML = `<div class="card" style="margin-top:20px"><div class="row"><h2 style="margin:0">View your SF1 ${M.newTag('sf1-view')}</h2></div><div id="s1V" style="margin-top:12px"><div class="empty">Opening…</div></div></div>
    <div class="card" style="margin-top:20px" id="tiCard"></div>`;
  viewer($('#s1V', wrap));
  await syncRemarks(c); tiCard($('#tiCard', wrap), c);
};
function tiCard(el, c){
  const u = ui(); const all = M.sortedLearners(c).filter(l => M.counted(l)); const TI = all.filter(isTI); const T = TI.concat(all.filter(l => !isTI(l))); const tr = track(c); const id137 = f137();
  const lettersOf = (lid) => letters(c).filter(L => L.lids.includes(lid));
  el.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">Transferred In (T/I) · SF10 requests ${M.newTag('sf10-requests')}</h2>
      <div class="small muted">All learners can be ticked. <span class="ti-badge">T/I</span> learners (from the SF1 remarks or the Transferred In status) are listed first — priority (${TI.length}). Tick learners who came from the same school / adviser and make one letter for all of them. When the SF10 arrives, tick <b>Received</b> — Old Form 137 is ticked in Learners.</div></div>
      <button class="btn primary" id="tiNew" ${T.length ? '' : 'disabled'}>${ico('plus')} Letter for ticked learners</button></div>
    ${T.length ? `<div class="table-wrap" style="margin-top:12px;max-height:none"><table class="ti-t"><thead><tr><th></th><th class="sticky-col">Learner</th><th>SF1 remark</th>${STAGES.map(([, t]) => `<th class="c">${t}</th>`).join('')}<th class="c">Old 137</th><th>Letters</th></tr></thead>
      <tbody>${T.map(l => { const t = tr[l.id] || {}; const L = lettersOf(l.id); const has137 = id137 && (c.checklist[l.id] || {})[id137];
        const ti = isTI(l); const sep = !ti && TI.length && l === T[TI.length] ? `<tr class="ti-sep"><td colspan="${STAGES.length + 5}">Other learners</td></tr>` : '';
        return sep + `<tr class="${t.rec ? 'ti-done' : ''} ${ti ? 'ti-pri' : ''}"><td><input type="checkbox" data-sel="${l.id}" ${u.sel[l.id] ? 'checked' : ''}></td><td class="sticky-col"><b>${esc(l.name)}</b>${ti ? ' <span class="ti-badge" title="Transferred In — priority">T/I</span>' : ''}<div class="tiny muted">LRN ${esc(l.lrn || '—')}</div></td><td class="tiny">${esc(l.sf1Rem || (l.status === 'TI' ? 'Transferred In' : ''))}</td>
          ${STAGES.map(([k]) => `<td class="c"><label class="ti-ck"><input type="checkbox" data-st="${k}" data-l="${l.id}" ${t[k] ? 'checked' : ''}><span class="tiny">${t[k] ? esc(M.parse(t[k]).toLocaleDateString(undefined, {month:'short', day:'numeric'})) : ''}</span></label></td>`).join('')}
          <td class="c">${has137 ? '<span class="chip green" style="font-size:10.5px;padding:2px 8px">✓</span>' : '<span class="muted">—</span>'}</td>
          <td>${L.map(x => `<button class="btn sm" data-open="${x.id}" title="Open letter">${STAGES.find(s => s[0] === x.stage)[1]}${x.lids.length > 1 ? ` · ${x.lids.length}` : ''}</button>`).join(' ') || '<span class="tiny muted">none</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
    : '<div class="empty" style="margin-top:12px">No learners yet. MASTRO reads the REMARKS column of your SF1 (e.g. “T/I DATE:2026-06-08”) or the Transferred In status in Learners.</div>'}
    ${letters(c).length ? `<h3 style="margin-top:16px">Saved letters</h3><div class="list">${letters(c).slice().reverse().map(L => `<div class="item" style="gap:10px;align-items:center"><div class="grow"><b>${esc(L.lids.map(id => (c.learners.find(l => l.id === id) || {name:'?'}).name.split(',')[0]).join(', '))}</b><div class="tiny muted">${STAGES.find(s => s[0] === L.stage)[1]} · ${L.date ? esc(L.date) : 'no date yet'} · edited ${esc(new Date(L.edited || L.created).toLocaleDateString())}</div></div><button class="btn sm" data-open="${L.id}">${ico('edit')} Open</button><button class="icon-btn del-l" data-del="${L.id}" title="Delete letter">${ico('trash','width:16px;height:16px')}</button></div>`).join('')}</div>` : ''}`;
  const rr = () => tiCard(el, c);
  $$('[data-sel]', el).forEach(x => x.onchange = () => { if(x.checked) u.sel[x.dataset.sel] = 1; else delete u.sel[x.dataset.sel]; });
  $$('[data-st]', el).forEach(x => x.onchange = () => { setStage(c, x.dataset.l, x.dataset.st, x.checked); if(x.dataset.st === 'rec' && x.checked) M.toast('Received — Old Form 137 ticked in Learners'); rr(); });
  $('#tiNew', el).onclick = () => { const lids = T.filter(l => u.sel[l.id]).map(l => l.id); if(!lids.length) return M.toast('Tick the learners to include in the letter');
    editor(c, newLetter(c, lids), rr); };
  $$('[data-open]', el).forEach(x => x.onclick = () => { const L = letters(c).find(y => y.id === x.dataset.open); if(L) editor(c, L, rr); });
  $$('[data-del]', el).forEach(x => x.onclick = () => { if(!confirm('Delete this saved letter? (The request ticks stay.)')) return; c.sf10letters = letters(c).filter(L => L.id !== x.dataset.del); M.save(); rr(); });
}
})();
