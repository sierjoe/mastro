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
const prevGrade = (c) => { const g = parseInt(c.grade, 10); return g > 1 ? `Grade ${g - 1}` : 'Grade 6'; };
const defBody = (n, L) => { const c = M.cls(); L = L || {}; return `The school would like to request for a copy of Form 10 of the following ${n > 1 ? 'students who' : 'student who'} attended in your school as ${L.prevGrade || prevGrade(c)} S.Y. ${L.prevSY || prevSY(c)} and ${n > 1 ? 'are' : 'is'} temporarily enrolled in the Grade ${c.grade || 7} Curriculum.`; };
const newLetter = (c, lids) => { const L = {id: M.uid('rq'), lids, date: new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}), recipient: '', teacher: '', prevSchool: '', prevGrade: prevGrade(c), prevSY: prevSY(c), autoBody: true, stage: 'r1',
  rows: Object.fromEntries(lids.map(id => [id, {section: '', year: prevSY(c)}])), phone: M.S.settings.phone || '', position: `Grade ${c.grade}-${titleCase(c.section)}, Class Moderator`, created: new Date().toISOString()};
  L.body = defBody(lids.length, L); return L; };
// who the letter goes to: previous teacher, previous school, then any extra address lines
const toLines = (L) => [L.teacher, L.prevSchool, L.recipient].map(x => String(x || '').trim()).filter(Boolean).join('\n');
function letterHtml(c, L){
  const s = M.S.settings; const lg = s.logos || {}; const mark = (k) => L.stage === k ? '<b>&nbsp;&nbsp;✓&nbsp;&nbsp;</b>' : '_______';
  const people = L.lids.map(id => c.learners.find(l => l.id === id)).filter(Boolean);
  return `<div class="rq-letter">
    <div class="rq-head">${lg.deped ? `<img src="${lg.deped}" alt="">` : '<span></span>'}<div><div>Department of Education</div><div>Region X</div><div>Division of Bukidnon</div><b>${esc(s.school || '')}</b><i>${esc(s.address || '')}</i></div>${lg.school ? `<img src="${lg.school}" alt="">` : '<span></span>'}</div>
    <div class="rq-date">${esc(L.date || '')}</div>
    ${toLines(L) ? `<div class="rq-to">${esc(toLines(L)).replace(/\n/g, '<br>')}</div>` : '<div class="rq-to rq-blank"></div>'}
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
/* ---------- your own Word template (uploaded in MASTRO; kept only on this device and in your backups — it may carry e-signatures) ---------- */
const myTpl = async () => (await M.docsAll().catch(() => [])).filter(d => d.formCode === 'SF10REQ' && d.blob).sort((a, b) => (b.added || '').localeCompare(a.added || ''))[0] || null;
M.sf10ReqTemplate = myTpl;
M.sf10ReqUpload = async (file) => {
  if(!/\.docx$/i.test(file.name)) return alert('Choose the Word file (.docx) of your request letter.');
  const old = (await M.docsAll().catch(() => [])).filter(d => d.formCode === 'SF10REQ');
  for(const d of old) await M.docDel(d.id).catch(() => {});
  await M.docPut({id: M.uid('d'), name: file.name, category: 'Templates', formCode: 'SF10REQ', isTemplate: true, tags: 'SF10 request, Old Form 137', notes: 'Request letter template (private — stays on this device)', mime: file.type, size: file.size, added: new Date().toISOString(), blob: file});
  M.toast('Your request letter template is saved on this device');
};
const SPLIT_T = /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g;
const paraText = (p) => { let t = ''; p.replace(SPLIT_T, (m, a, b) => { t += b; return m; }); return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); };
// put new text in the first text run of a paragraph and empty the others (keeps the paragraph's look)
const setParaText = (p, text) => { let first = true; return p.replace(SPLIT_T, (m, a, b, z) => { if(first){ first = false; return `<w:t xml:space="preserve">${multi(text)}</w:t>`; } return `${a}${z}`; }); };
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
function fillOwnTemplate(x, c, L, people){
  const mk = (k) => L.stage === k ? '___✓___' : '_______';
  // 1) paragraphs outside the table
  x = x.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => {
    if(/<w:tbl[ >]/.test(p)) return p;
    const t = paraText(p).trim();
    if(new RegExp(`^(${MONTHS})\\s+\\d{1,2},\\s*\\d{4}$`, 'i').test(t)) return setParaText(p, L.date || '');
    if(/would like to request/i.test(t)) return setParaText(p, L.body || '');
    if(/^madame\s*\/\s*sir/i.test(t) && toLines(L)){ const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
      const lines = toLines(L).split('\n').map(s => `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xmlEsc(s)}</w:t></w:r></w:p>`).join('');
      return lines + `<w:p>${pPr}</w:p>` + p; }
    const stage = /^1\s*st\s+request/i.test(t) ? 'r1' : /^2\s*nd\s+request/i.test(t) ? 'r2' : /^urgent/i.test(t) ? 'ru' : null;
    if(stage){ let done = false; return p.replace(SPLIT_T, (m, a, b, z) => { if(!done && /_{3,}/.test(b)){ done = true; return `${a}${b.replace(/_{3,}/, mk(stage))}${z}`; } return m; }); }
    return p;
  });
  // 2) the table: keep the header row, repeat the last row once per learner
  x = x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/, (tbl) => {
    const rows = tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []; if(rows.length < 2) return tbl;
    const head = rows[0], tpl = rows[rows.length - 1];
    const rPr = ((head.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0]).replace(/<w:b\/>|<w:bCs\/>/g, '');
    const fill = (cells) => { let i = 0; return tpl.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (tc) => { const v = cells[i++] || '';
      const clean = tc.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, '');
      return clean.replace(/<\/w:p>/, `<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(v)}</w:t></w:r></w:p>`); }); };
    const body = people.map(l => { const q = (L.rows || {})[l.id] || {}; return fill([l.name, q.section || '', q.year || '']); }).join('');
    const start = tbl.indexOf(rows[0]); const end = tbl.lastIndexOf(tpl) + tpl.length;
    return tbl.slice(0, start) + rows.slice(0, rows.length - 1).join('') + body + tbl.slice(end);
  });
  return x;
}
M.sf10FillOwn = fillOwnTemplate;   // used by the self-check
async function letterDocx(c, L){
  await M.loadScript('vendor/jszip.min.js');
  const own = await myTpl(); let buf;
  if(own) buf = await own.blob.arrayBuffer();
  else { const r = await fetch(TPL); if(!r.ok) return alert('The SF10 request template is missing (templates/SF10_Request_Template.docx).'); buf = await r.arrayBuffer(); }
  const zip = await JSZip.loadAsync(buf); let x = await zip.file('word/document.xml').async('string');
  const people = L.lids.map(id => c.learners.find(l => l.id === id)).filter(Boolean);
  if(own && !/\{\{NAME\}\}/.test(x)){
    zip.file('word/document.xml', fillOwnTemplate(x, c, L, people));
    const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const who = people.length === 1 ? people[0].name.split(',')[0] : `${people.length} learners`;
    M.downloadBlob(blob, `SF10 Request - ${who} - ${STAGES.find(z => z[0] === L.stage)[1]}.docx`); M.toast('Word letter downloaded (your template)'); return;
  }
  const row = (x.match(/<!--ROW-->([\s\S]*?)<!--\/ROW-->/) || [])[1] || '';
  const rows = people.map(l => { const q = (L.rows || {})[l.id] || {}; return row.replace('{{NAME}}', xmlEsc(l.name)).replace('{{SECTION}}', xmlEsc(q.section || '')).replace('{{YEAR}}', xmlEsc(q.year || '')); }).join('');
  x = x.replace(/<!--ROW-->[\s\S]*?<!--\/ROW-->/, rows);
  const s = M.S.settings; const mk = (k) => L.stage === k ? '   ✓   ' : '_______';
  const rep = {DATE: xmlEsc(L.date || ''), RECIPIENT: toLines(L) ? multi(toLines(L)) + '</w:t><w:br/><w:br/><w:t xml:space="preserve">' : '', BODY: multi(L.body || ''),
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
  if(L.prevGrade == null){ L.prevGrade = prevGrade(c); L.prevSY = prevSY(c); L.teacher = ''; L.prevSchool = ''; L.autoBody = false; }
  const people = () => L.lids.map(id => c.learners.find(l => l.id === id)).filter(Boolean);
  M.modal('SF10 request letter', `<div class="rq-ed">
    <div class="rq-form">
      <div class="seg" id="rqS">${STAGES.slice(0, 3).map(([k, t]) => `<button data-k="${k}" class="${L.stage === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <label class="field">Date <span class="muted">(leave blank to write by hand)</span><input class="input" id="rqD" value="${esc(L.date)}" placeholder="e.g. October 22, 2026"></label>
      <div class="grid g-2" style="gap:8px"><label class="field">Previous grade<input class="input" id="rqPG" value="${esc(L.prevGrade)}" placeholder="Grade 6"></label><label class="field">Previous school year<input class="input" id="rqPY" value="${esc(L.prevSY)}" placeholder="2025-2026"></label></div>
      <div class="grid g-2" style="gap:8px"><label class="field">Previous adviser / teacher<input class="input" id="rqT" value="${esc(L.teacher)}" placeholder="e.g. Mrs. Ana D. Cruz, Grade 6 – Rizal"></label><label class="field">Previous school<input class="input" id="rqSc" value="${esc(L.prevSchool)}" placeholder="e.g. Impalutao Central Elementary School"></label></div>
      <label class="field">Address / other lines <span class="muted">(optional)</span><textarea class="input" id="rqR" rows="2" placeholder="Address">${esc(L.recipient)}</textarea></label>
      <label class="field">Letter body <span class="muted">${L.autoBody ? '(written from the grade and school year above — edit to change)' : '<a href="#" id="rqBR">rewrite from the fields above</a>'}</span><textarea class="input" id="rqB" rows="4">${esc(L.body)}</textarea></label>
      <div class="field"><div class="row" style="gap:6px"><span class="grow">Learners in this letter</span><button class="btn sm" id="rqAllS" title="Copy the first learner's Year / Section to everyone">⤓ Same section</button><button class="btn sm" id="rqAllY" title="Copy the first learner's year to everyone">⤓ Same year</button></div><div id="rqRows"></div></div>
      <div class="small" id="rqTpl" style="margin-top:6px"></div>
      <div class="grid g-2" style="gap:8px"><label class="field">Your position<input class="input" id="rqPo" value="${esc(L.position)}"></label><label class="field">Contact number<input class="input" id="rqPh" value="${esc(L.phone)}" placeholder="09xx-xxx-xxxx"></label></div>
    </div>
    <div class="rq-prev-wrap"><div class="rq-prev" id="rqPrev"></div></div></div>
    <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><span class="tiny muted">Printing or downloading marks the chosen request as sent for these learners.</span><span class="spacer"></span>
      <button class="btn" id="rqSave">${ico('save')} Save</button><button class="btn gold" id="rqW">${ico('download')} Word (.docx)</button><button class="btn primary" id="rqP">${ico('print')} Print</button></div>`, b => {
    const rowsUI = () => { $('#rqRows', b).innerHTML = people().map(l => { const r = L.rows[l.id] = L.rows[l.id] || {section:'', year: prevSY(c)};
      return `<div class="rq-row"><b>${esc(l.name)}</b><input class="input" data-rs="${l.id}" data-f="section" value="${esc(r.section)}" placeholder="Year / Section (e.g. Grade 6 – Rizal)"><input class="input" data-rs="${l.id}" data-f="year" value="${esc(r.year)}" placeholder="Year enrolled"><button class="icon-btn" data-rm="${l.id}" title="Remove from this letter">✕</button></div>`; }).join('');
      $$('[data-rs]', b).forEach(i => i.oninput = () => { L.rows[i.dataset.rs][i.dataset.f] = i.value; prev(); });
      if(L.autoBody){ L.body = defBody(L.lids.length, L); const bb = $('#rqB', b); if(bb) bb.value = L.body; }
      $$('[data-rm]', b).forEach(x => x.onclick = () => { if(L.lids.length < 2) return M.toast('A letter needs at least one learner'); L.lids = L.lids.filter(id => id !== x.dataset.rm); rowsUI(); prev(); }); };
    const prev = () => { $('#rqPrev', b).innerHTML = letterHtml(c, L); };
    const bind = (id, k) => $(id, b).oninput = (e) => { L[k] = e.target.value; prev(); };
    bind('#rqD', 'date'); bind('#rqR', 'recipient'); bind('#rqPo', 'position'); bind('#rqPh', 'phone'); bind('#rqT', 'teacher'); bind('#rqSc', 'prevSchool');
    $('#rqB', b).oninput = (e) => { L.body = e.target.value; L.autoBody = false; prev(); };
    const reBody = () => { if(L.autoBody){ L.body = defBody(L.lids.length, L); $('#rqB', b).value = L.body; } prev(); };
    $('#rqPG', b).oninput = (e) => { L.prevGrade = e.target.value; reBody(); };
    $('#rqPY', b).oninput = (e) => { const old = L.prevSY; L.prevSY = e.target.value; Object.values(L.rows).forEach(r => { if(!r.year || r.year === old) r.year = L.prevSY; }); rowsUI(); reBody(); };
    if($('#rqBR', b)) $('#rqBR', b).onclick = (e) => { e.preventDefault(); L.autoBody = true; reBody(); };
    const same = (f) => { const first = L.rows[L.lids[0]] || {}; L.lids.forEach(id => { L.rows[id] = L.rows[id] || {}; L.rows[id][f] = first[f] || ''; }); rowsUI(); prev(); M.toast('Copied to every learner in this letter'); };
    $('#rqAllS', b).onclick = () => same('section'); $('#rqAllY', b).onclick = () => same('year');
    const tplUI = async () => { const t = await myTpl(); const box = $('#rqTpl', b); if(!box) return;
      box.innerHTML = `${t ? `Word file uses <b>your template</b> (${esc(t.name)}).` : 'Word file uses the built-in letter.'} <a href="#" id="rqTU">${t ? 'Replace' : 'Upload your template (.docx)'}</a>${t ? ` · <a href="#" id="rqTD">Use built-in</a>` : ''}<input type="file" id="rqTF" accept=".docx" hidden>`;
      $('#rqTU', b).onclick = (e) => { e.preventDefault(); $('#rqTF', b).click(); };
      $('#rqTF', b).onchange = async (e) => { const f = e.target.files[0]; if(f){ await M.sf10ReqUpload(f); tplUI(); } };
      if($('#rqTD', b)) $('#rqTD', b).onclick = async (e) => { e.preventDefault(); if(!confirm('Remove your uploaded template from this device and use the built-in letter?')) return; await M.docDel(t.id); tplUI(); }; };
    tplUI();
    $$('#rqS button', b).forEach(x => x.onclick = () => { L.stage = x.dataset.k; $$('#rqS button', b).forEach(y => y.classList.toggle('on', y === x)); prev(); });
    const save = () => { if(isNew && !letters(c).includes(L)) letters(c).push(L); L.edited = new Date().toISOString(); if(L.phone) M.S.settings.phone = L.phone; M.save(); };
    $('#rqSave', b).onclick = () => { save(); M.closeModal(); M.toast('Letter saved'); done && done(); };
    $('#rqW', b).onclick = async () => { save(); await letterDocx(c, L); markSent(c, L); };
    $('#rqP', b).onclick = () => { save(); markSent(c, L); M.doPrint(`<div class="rq-page">${letterHtml(c, L)}</div>`, M.pageCss('A4')); };
    M.onModalClose = () => done && done();
    rowsUI(); prev();
  }, true);
}

/* ---------- Learners → Old Form 137 requests (v6.20) ----------
   Everyone whose "Old 137" box is not ticked; tick several (same previous school / teacher) → one letter. */
M.req137 = function(c, done){
  c = c || M.cls(); const id = f137(); const sel = {}; let q = '', showAll = false;
  const stageOf = (lid) => { const t = track(c)[lid] || {}; return t.ru ? 'Urgent' : t.r2 ? '2nd request' : t.r1 ? '1st request' : ''; };
  const draw = (b) => {
    const pool = M.sortedLearners(c).filter(l => M.counted(l) && (showAll || !(id && (c.checklist[l.id] || {})[id])) && (!q || l.name.toLowerCase().includes(q)));
    const lettersOf = (lid) => letters(c).filter(L => L.lids.includes(lid));
    $('#r7Body', b).innerHTML = pool.length ? `<div class="list" style="max-height:52vh;overflow:auto">${pool.map(l => { const st = stageOf(l.id); const has = id && (c.checklist[l.id] || {})[id]; const Ls = lettersOf(l.id);
      return `<label class="item" style="padding:8px 12px;cursor:pointer;gap:10px"><input type="checkbox" data-s7="${l.id}" ${sel[l.id] ? 'checked' : ''} ${has ? 'disabled' : ''}><div class="grow"><div class="title small"><b>${esc(l.name)}</b> ${isTI(l) ? '<span class="ti-badge">T/I</span>' : ''} ${M.statusChip(l, 1)}</div>
        <div class="tiny muted">LRN ${esc(l.lrn || '—')}${st ? ` · <b style="color:var(--gold)">${st} sent</b>` : ' · no request yet'}${Ls.length ? ` · ${Ls.length} letter(s)` : ''}</div></div>
        ${has ? '<span class="chip green">✓ Received</span>' : `${Ls.map(L => `<button class="btn sm" data-o7="${L.id}">${STAGES.find(s => s[0] === L.stage)[1]}</button>`).join(' ')}<button class="btn sm" data-r7="${l.id}" title="The Form 137 arrived — tick Old 137">✓ Received</button>`}</label>`; }).join('')}</div>`
      : `<div class="empty">${showAll ? 'No learners.' : 'Everyone has an Old Form 137 ✓'}</div>`;
    const n = Object.keys(sel).length; $('#r7Go', b).textContent = n ? `Make one letter for ${n} learner${n > 1 ? 's' : ''}` : 'Make letter for ticked learners'; $('#r7Go', b).disabled = !n;
    $$('[data-s7]', b).forEach(x => x.onchange = () => { if(x.checked) sel[x.dataset.s7] = 1; else delete sel[x.dataset.s7]; draw(b); });
    $$('[data-r7]', b).forEach(x => x.onclick = (e) => { e.preventDefault(); const l = c.learners.find(y => y.id === x.dataset.r7); if(!confirm(`Old Form 137 of ${l.name} received?`)) return; setStage(c, l.id, 'rec', true); delete sel[l.id]; draw(b); M.toast('Old 137 ticked'); });
    $$('[data-o7]', b).forEach(x => x.onclick = (e) => { e.preventDefault(); const L = letters(c).find(y => y.id === x.dataset.o7); if(L) editor(c, L, () => M.req137(c, done)); });
  };
  M.modal('Old Form 137 · request letters', `<p class="small muted" style="margin-top:0">Learners whose <b>Old 137</b> is not yet ticked. Tick everyone who came from the same school / adviser — they go in <b>one letter</b>. In the letter you set the previous section, school year, teacher and whether it is the <b>1st</b>, <b>2nd</b> or <b>urgent</b> request. When the form arrives, tap <b>✓ Received</b>.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><input class="input" id="r7Q" placeholder="Search name…" style="max-width:220px"><label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" id="r7All"> Show learners who already have it</label><span class="spacer"></span><button class="btn sm" id="r7Tick">Tick all shown</button></div>
    <div id="r7Body"></div>
    <div class="row" style="margin-top:14px;gap:8px"><span class="spacer"></span><button class="btn" id="r7C">Close</button><button class="btn primary" id="r7Go" disabled>Make letter</button></div>`, b => {
    $('#r7Q', b).oninput = (e) => { q = e.target.value.toLowerCase(); draw(b); };
    $('#r7All', b).onchange = (e) => { showAll = e.target.checked; draw(b); };
    $('#r7Tick', b).onclick = () => { $$('[data-s7]:not(:disabled)', b).forEach(x => sel[x.dataset.s7] = 1); draw(b); };
    $('#r7C', b).onclick = M.closeModal;
    $('#r7Go', b).onclick = () => { const lids = M.sortedLearners(c).filter(l => sel[l.id]).map(l => l.id); if(!lids.length) return; M.onModalClose = null; editor(c, newLetter(c, lids), () => M.req137(c, done)); };
    M.onModalClose = () => done && done();
    draw(b);
  }, true);
};

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
