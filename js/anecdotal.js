/* MASTRO — Anecdotal Records (Forms → AR)
   Write dated observations about learners in your advisory class, keep them on this device (and in your backup),
   print them half an A4 each (2 per sheet; one record prints at the same half size), or download an editable Word file. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;

const PLACES = ['Classroom','School campus','Canteen','Library','Field / Court','Comfort room','Online / Messenger','During an activity','Home visit'];
const KINDS = [['pos','Positive behavior'],['con','Concern'],['neu','General observation']];
const list = (c) => (c.anecdotal = c.anecdotal || []);
const lname = (c, id) => { const l = c.learners.find(x => x.id === id); return l ? l.name : '(removed learner)'; };
const fdate = (d) => d ? M.parse(d).toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric', year:'numeric'}) : '';
const ftime = (t) => { if(!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0); return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); };
const ui = () => (M.arUI = M.arUI || {lid:'', q:'', sel:{}, mode:'learner'});
const termOf = (r) => r.term || (M.termOfDate ? M.termOfDate(r.date) : '1');
const TERMS = ['1','2','3'];
const nowTime = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ---------- the printed record: half of an A4 sheet ---------- */
function recordHtml(c, r){
  const s = M.S.settings; const l = c.learners.find(x => x.id === r.lid) || {name:'—'};
  const lg = s.logos || {}; const kind = (KINDS.find(k => k[0] === r.kind) || [,''])[1];
  const box = (t, v, h) => `<div class="ar-box"><div class="ar-lb">${t}</div><div class="ar-tx" style="min-height:${h}mm">${esc(v || '').replace(/\n/g, '<br>')}</div></div>`;
  return `<div class="ar-rec">
    <div class="ar-head">${lg.deped ? `<img src="${lg.deped}" alt="">` : '<span class="ar-sp"></span>'}<div class="ar-ht"><div>Republic of the Philippines · Department of Education</div><div>${esc(s.region || '')} · ${esc(s.division || '')}</div><b>${esc(s.school || '')}</b></div>${lg.school ? `<img src="${lg.school}" alt="">` : '<span class="ar-sp"></span>'}</div>
    <div class="ar-title">ANECDOTAL RECORD${kind ? `<span>${esc(kind)}</span>` : ''}</div>
    <table class="ar-info"><tr><td>Name of learner</td><td><b>${esc(l.name)}</b></td><td>Grade &amp; Section</td><td><b>${esc(M.className(c))}</b></td></tr>
      <tr><td>Date</td><td><b>${esc(fdate(r.date))}</b></td><td>Time</td><td><b>${esc(ftime(r.time))}</b></td></tr>
      <tr><td>Place / Setting</td><td><b>${esc(r.place || '')}</b></td><td>LRN</td><td><b>${esc(l.lrn || '')}</b></td></tr></table>
    ${box('Observation (what happened — facts only)', r.obs, 22)}
    ${box('Interpretation / Comment', r.interp, 12)}
    ${box('Action taken / Recommendation', r.action, 12)}
    <div class="ar-sign"><div><div class="nm">${esc(r.observer || c.adviser || '')}</div>Observed by (Class Adviser)</div><div><div class="nm">&nbsp;</div>Learner's signature</div><div><div class="nm">&nbsp;</div>Parent / Guardian's signature</div></div>
  </div>`;
}
// one learner, every observation grouped by term (Term 1 · 2 · 3)
function consolidatedHtml(c, lid, recs){
  const s = M.S.settings; const l = c.learners.find(x => x.id === lid) || {name:'—'}; const lg = s.logos || {};
  const by = TERMS.map(t => [t, recs.filter(r => termOf(r) === t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))]);
  const ent = (r) => { const kind = (KINDS.find(k => k[0] === r.kind) || [,''])[1];
    return `<tr><td class="ar-cd"><b>${esc(M.parse(r.date).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}))}</b><br>${esc(ftime(r.time))}<br><span>${esc(r.place || '')}</span>${kind ? `<br><i>${esc(kind)}</i>` : ''}</td>
      <td>${esc(r.obs || '').replace(/\n/g, '<br>')}</td><td>${esc(r.interp || '').replace(/\n/g, '<br>')}</td><td>${esc(r.action || '').replace(/\n/g, '<br>')}</td></tr>`; };
  return `<div class="ar-rec ar-cons">
    <div class="ar-head">${lg.deped ? `<img src="${lg.deped}" alt="">` : '<span class="ar-sp"></span>'}<div class="ar-ht"><div>Republic of the Philippines · Department of Education</div><div>${esc(s.region || '')} · ${esc(s.division || '')}</div><b>${esc(s.school || '')}</b></div>${lg.school ? `<img src="${lg.school}" alt="">` : '<span class="ar-sp"></span>'}</div>
    <div class="ar-title">ANECDOTAL RECORD<span>Consolidated · ${recs.length} observation${recs.length === 1 ? '' : 's'}</span></div>
    <table class="ar-info"><tr><td>Name of learner</td><td><b>${esc(l.name)}</b></td><td>Grade &amp; Section</td><td><b>${esc(M.className(c))}</b></td></tr>
      <tr><td>LRN</td><td><b>${esc(l.lrn || '')}</b></td><td>School year</td><td><b>${esc(c.sy || '')}</b></td></tr></table>
    <table class="ar-ct"><thead><tr><th style="width:17%">Date · time · place</th><th>Observation</th><th style="width:21%">Interpretation / Comment</th><th style="width:21%">Action taken / Recommendation</th></tr></thead>
      <tbody>${by.filter(x => x[1].length).map(([t, arr]) => `<tr class="ar-tr"><td colspan="4">TERM ${t} · ${arr.length} observation${arr.length === 1 ? '' : 's'}</td></tr>${arr.map(ent).join('')}`).join('')}</tbody></table>
    <div class="ar-sign"><div><div class="nm">${esc(c.adviser || '')}</div>Observed by (Class Adviser)</div><div><div class="nm">&nbsp;</div>Learner's signature</div><div><div class="nm">&nbsp;</div>Parent / Guardian's signature</div></div>
  </div>`;
}
// consolidated sheets: a learner fits half an A4 when possible, a long history gets a full A4 page
function consolidatedPages(c, groups){
  const [PW, PH] = M.printableMm(M.pageCss('A4')); const W = Math.floor(PW) - 0.5, H = Math.floor(PH) - 0.5, half = H / 2, px = 96 / 25.4, pad = 2;
  const items = groups.map(([lid, recs]) => { const html = consolidatedHtml(c, lid, recs); const m = M.measurePrint(`<div style="width:184mm">${html}</div>`, 184); const h = m.h / px;
    const kHalf = Math.min(1, (W - pad * 2) / 184, (half - pad * 2) / h); return {html, h, half: kHalf >= 0.72, kHalf}; });
  const cell = (it, top) => `<div class="quad-cell" style="left:${((W - 184 * it.kHalf) / 2).toFixed(2)}mm;top:${(top + pad).toFixed(2)}mm;width:${(184 * it.kHalf).toFixed(2)}mm;height:${(it.h * it.kHalf).toFixed(2)}mm"><div style="width:184mm;transform:scale(${it.kHalf.toFixed(4)});transform-origin:0 0">${it.html}</div></div>`;
  const out = []; let pend = null;
  const flush = () => { if(pend){ out.push(`<div class="quad-page" style="width:${W}mm;height:${H}mm"><i class="cut h" style="top:${half}mm"></i>${cell(pend, 0)}</div>`); pend = null; } };
  items.forEach(it => { if(it.half){ if(pend){ out.push(`<div class="quad-page" style="width:${W}mm;height:${H}mm"><i class="cut h" style="top:${half}mm"></i>${cell(pend, 0)}${cell(it, half)}</div>`); pend = null; } else pend = it; }
    else { flush(); out.push(M.fitA4([it.html])); } });
  flush(); return out.join('');
}
const groupRecs = (c, recs) => { const g = {}; recs.forEach(r => (g[r.lid] = g[r.lid] || []).push(r)); return M.sortedLearners(c).filter(l => g[l.id]).map(l => [l.id, g[l.id]]); };
const printCons = (c, recs) => M.doPrint(consolidatedPages(c, groupRecs(c, recs)), M.pageCss('A4'), {noFit: true});
const viewCons = (c, recs) => { const G = groupRecs(c, recs); M.pagePreview(`Anecdotal records · consolidated · ${G.length} learner(s)`, consolidatedPages(c, G), {note:'A4 · one learner per half sheet (a long history gets a full page) · 0.3 in margins', onPrint: () => printCons(c, recs)}); };
// half-A4 cells: 2 records per sheet; a single record keeps the same half size (top half, cut line)
const pagesOf = (c, recs) => M.quadPages(recs.map(r => recordHtml(c, r)), 184, 128, 2, 'A4', {measure: true, top: true, pad: 2});
const printRecs = (c, recs) => M.doPrint(pagesOf(c, recs), M.pageCss('A4'), {noFit: true});
const viewRecs = (c, recs) => M.pagePreview(`Anecdotal record${recs.length > 1 ? 's' : ''} · ${recs.length}`, pagesOf(c, recs),
  {note:`A4 · half a sheet per record · 0.3 in margins · ${Math.ceil(recs.length / 2)} sheet(s)`, onPrint: () => printRecs(c, recs)});

/* ---------- editable Word copy (.docx) ---------- */
const X = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (t, o = {}) => String(t ?? '').split('\n').map((line, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ''}${o.c ? `<w:color w:val="${o.c}"/>` : ''}</w:rPr><w:t xml:space="preserve">${X(line)}</w:t></w:r>`).join('');
const para = (inner, o = {}) => `<w:p><w:pPr>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 60}"/>${o.pb ? '<w:pageBreakBefore/>' : ''}</w:pPr>${inner}</w:p>`;
const cell = (inner, w, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}</w:tcPr>${inner}</w:tc>`;
const tbl = (rows, grid) => `<w:tbl><w:tblPr><w:tblW w:w="${grid.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(k => `<w:${k} w:val="single" w:sz="4" w:color="555555"/>`).join('')}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid.map(g => `<w:gridCol w:w="${g}"/>`).join('')}</w:tblGrid>${rows.map(r => `<w:tr>${r}</w:tr>`).join('')}</w:tbl>`;
async function packDocx(doc, name){
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/document.xml', doc); zip.file('word/styles.xml', styles);
  const blob = await zip.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  M.downloadBlob(blob, name); M.toast('Word file downloaded — open it to view or edit');
}
async function docx(c, recs){
  await M.loadScript('vendor/jszip.min.js'); const s = M.S.settings; const W = 10466;   // A4 width minus 0.3 in margins, in twips
  const body = recs.map((r, i) => { const l = c.learners.find(x => x.id === r.lid) || {name:'—'}; const kind = (KINDS.find(k => k[0] === r.kind) || [,''])[1];
    const g = [2000, 3233, 2000, 3233];
    const info = tbl([
      cell(para(run('Name of learner', {sz:18})), g[0]) + cell(para(run(l.name, {b:1, sz:20})), g[1]) + cell(para(run('Grade & Section', {sz:18})), g[2]) + cell(para(run(M.className(c), {b:1, sz:20})), g[3]),
      cell(para(run('Date', {sz:18})), g[0]) + cell(para(run(fdate(r.date), {b:1, sz:20})), g[1]) + cell(para(run('Time', {sz:18})), g[2]) + cell(para(run(ftime(r.time), {b:1, sz:20})), g[3]),
      cell(para(run('Place / Setting', {sz:18})), g[0]) + cell(para(run(r.place, {b:1, sz:20})), g[1]) + cell(para(run('LRN', {sz:18})), g[2]) + cell(para(run(l.lrn || '', {b:1, sz:20})), g[3])], g);
    const blk = (t, v, lines) => tbl([cell(para(run(t, {b:1, sz:18, c:'1F6B4A'})), W, {fill:'E9F1EC'}), cell(para(run(v || '', {sz:21}), {after:0}) + (lines ? Array.from({length: lines}, () => para('', {after:0})).join('') : ''), W)], [W]);
    const sig = tbl([cell(para(run(r.observer || c.adviser || '', {b:1, sz:19}), {jc:'center', before:240}) + para(run('Observed by (Class Adviser)', {sz:16}), {jc:'center'}), 3488) + cell(para('', {before:240}) + para(run("Learner's signature", {sz:16}), {jc:'center'}), 3489) + cell(para('', {before:240}) + para(run("Parent / Guardian's signature", {sz:16}), {jc:'center'}), 3489)], [3488, 3489, 3489]);
    return para(run('Republic of the Philippines · Department of Education', {sz:16}), {jc:'center', after:0, pb: i > 0 && i % 2 === 0}) + para(run(s.school || '', {b:1, sz:20}), {jc:'center', after:40}) +
      para(run('ANECDOTAL RECORD' + (kind ? ` — ${kind}` : ''), {b:1, sz:26, c:'1F6B4A'}), {jc:'center', after:80}) + info + para('', {after:40}) +
      blk('Observation (what happened — facts only)', r.obs, 2) + para('', {after:40}) + blk('Interpretation / Comment', r.interp, 1) + para('', {after:40}) + blk('Action taken / Recommendation', r.action, 1) + para('', {after:40}) + sig +
      (i % 2 === 0 && i < recs.length - 1 ? para(run('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂', {sz:14, c:'999999'}), {jc:'center', before:200, after:200}) : '');
  }).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const one = recs.length === 1 ? ` - ${lname(c, recs[0].lid).split(',')[0]} ${recs[0].date}` : ` (${recs.length})`;
  return packDocx(doc, `Anecdotal Record${one} - ${M.className(c)}.docx`);
}

/* ---------- add / edit form ---------- */
function editor(c, r, done){
  const isNew = !r; r = r || {id: M.uid('ar'), lid: ui().lid || '', date: M.today(), time: nowTime(), place: 'Classroom', kind: 'neu', obs: '', interp: '', action: '', observer: c.adviser || ''};
  const L = M.sortedLearners(c).filter(M.counted);
  M.modal(isNew ? 'New anecdotal record' : 'Edit anecdotal record', `
    <div class="grid g-2" style="gap:12px">
      <label class="field">Learner<select class="input" id="aL"><option value="">— choose a learner —</option>${L.map(l => `<option value="${l.id}" ${l.id === r.lid ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
      <label class="field">Type<select class="input" id="aK">${KINDS.map(([k, t]) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field">Date<input class="input" type="date" id="aD" value="${esc(r.date)}"></label>
      <label class="field">Time<input class="input" type="time" id="aT" value="${esc(r.time || '')}"></label>
      <label class="field">Place / Setting<input class="input" id="aP" list="aPl" value="${esc(r.place || '')}"><datalist id="aPl">${PLACES.map(p => `<option value="${esc(p)}">`).join('')}</datalist></label>
      <label class="field">Observed by<input class="input" id="aO" value="${esc(r.observer || '')}"></label>
      <label class="field">Term<select class="input" id="aTm"><option value="">Auto from the date (SY calendar)</option>${TERMS.map(t => `<option value="${t}" ${r.term === t ? 'selected' : ''}>Term ${t}</option>`).join('')}</select></label></div>
    <label class="field" style="margin-top:12px">Observation — what happened (facts only: what you saw and heard)<textarea class="input" id="aB" rows="5" placeholder="e.g. During the group activity, the learner volunteered to read the instructions aloud and helped two classmates finish their part.">${esc(r.obs || '')}</textarea></label>
    <label class="field" style="margin-top:10px">Interpretation / Comment<textarea class="input" id="aI" rows="2">${esc(r.interp || '')}</textarea></label>
    <label class="field" style="margin-top:10px">Action taken / Recommendation<textarea class="input" id="aA" rows="2">${esc(r.action || '')}</textarea></label>
    <div class="row" style="margin-top:14px;gap:8px"><span class="tiny muted">Saved on this device and included in Back up everything.</span><span class="spacer"></span><button class="btn" id="aX">Cancel</button><button class="btn primary" id="aS">${ico('save')} Save record</button></div>`, b => {
    $('#aX', b).onclick = M.closeModal;
    $('#aS', b).onclick = () => { const v = (id) => $(id, b).value.trim();
      if(!v('#aL')) return M.toast('Choose the learner'); if(!v('#aB')) return M.toast('Write the observation');
      Object.assign(r, {term: v('#aTm'), lid: v('#aL'), kind: v('#aK'), date: v('#aD') || M.today(), time: v('#aT'), place: v('#aP'), observer: v('#aO'), obs: $('#aB', b).value.trim(), interp: $('#aI', b).value.trim(), action: $('#aA', b).value.trim(), edited: new Date().toISOString()});
      if(isNew){ r.created = r.edited; list(c).push(r); }
      M.save(); M.closeModal(); M.toast('Anecdotal record saved'); done && done(); };
  }, true);
}

/* ---------- the page ---------- */
M.anecdotalView = function(el){
  const c = M.cls(); const u = ui(); const L = M.sortedLearners(c).filter(M.counted);
  const all = list(c).slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const q = M.normName(u.q || '');
  const R = all.filter(r => (!u.lid || r.lid === u.lid) && (!q || M.normName(lname(c, r.lid) + ' ' + r.obs + ' ' + r.interp + ' ' + r.action + ' ' + r.place).includes(q)));
  const sel = () => R.filter(r => u.sel[r.id]);
  const itemHtml = (r) => { const kind = KINDS.find(k => k[0] === r.kind) || KINDS[2];
      return `<div class="ar-item ar-${r.kind || 'neu'}"><input type="checkbox" data-s="${r.id}" ${u.sel[r.id] ? 'checked' : ''} aria-label="Select record">
        <div class="grow"><div class="row" style="gap:8px;flex-wrap:wrap"><b>${esc(lname(c, r.lid))}</b><span class="chip ${r.kind === 'pos' ? 'green' : r.kind === 'con' ? 'red' : ''}" style="font-size:10.5px;padding:2px 8px">${kind[1]}</span><span class="chip" style="font-size:10.5px;padding:2px 8px">Term ${termOf(r)}</span><span class="tiny muted">${esc(fdate(r.date))}${r.time ? ' · ' + esc(ftime(r.time)) : ''}${r.place ? ' · ' + esc(r.place) : ''}</span></div>
          <div class="small" style="margin-top:4px">${esc((r.obs || '').slice(0, 260))}${(r.obs || '').length > 260 ? '…' : ''}</div>${r.action ? `<div class="tiny muted" style="margin-top:3px"><b>Action:</b> ${esc(r.action.slice(0, 140))}</div>` : ''}</div>
        <div class="ar-acts"><button class="btn sm" data-v="${r.id}" title="View">${ico('eye')}</button><button class="btn sm" data-p="${r.id}" title="Print this record (half A4)">${ico('print')}</button><button class="btn sm" data-w="${r.id}" title="Word copy">.docx</button><button class="btn sm" data-e="${r.id}" title="Edit">${ico('edit')}</button><button class="icon-btn del-l" data-d="${r.id}" title="Delete">${ico('trash','width:16px;height:16px')}</button></div></div>`; }
  const per = {}; all.forEach(r => per[r.lid] = (per[r.lid] || 0) + 1);
  el.innerHTML = `
  <div class="card"><div class="row" style="gap:10px;flex-wrap:wrap"><a class="btn sm" href="#forms">${ico('left','width:16px;height:16px')} All forms</a><div class="sf-code" style="margin-left:6px">AR</div>
    <div class="grow"><div class="title"><b>Anecdotal Records</b> · ${esc(M.className(c))}</div><div class="small muted">Dated, factual observations of your advisory learners. Prints half an A4 per record (2 per sheet); one record prints at the same half size. Download as Word to view or edit.</div></div>
    <button class="btn primary" id="arNew">${ico('plus')} New record</button></div></div>
  <div class="card" style="margin-top:20px">
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <div class="seg" id="arMode"><button data-m="learner" class="${u.mode === 'learner' ? 'on' : ''}">By learner · per term ${M.newTag('ar-consolidated')}</button><button data-m="each" class="${u.mode !== 'learner' ? 'on' : ''}">Each record</button></div>
      <select class="input" id="arL" style="width:auto;max-width:280px"><option value="">All learners (${all.length} record${all.length === 1 ? '' : 's'})</option>${L.map(l => `<option value="${l.id}" ${l.id === u.lid ? 'selected' : ''}>${esc(l.name)}${per[l.id] ? ` (${per[l.id]})` : ''}</option>`).join('')}</select>
      <input class="input" id="arQ" placeholder="Search the records…" value="${esc(u.q || '')}" style="max-width:240px">
      <span class="spacer"></span>
      <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="arAll" ${R.length && R.every(r => u.sel[r.id]) ? 'checked' : ''}> Select all shown</label>
      <span class="small muted" id="arN">${sel().length} selected</span>
      <button class="btn sm" id="arV" ${R.length ? '' : 'disabled'}>${ico('eye')} View</button><button class="btn sm primary" id="arP" ${R.length ? '' : 'disabled'}>${ico('print')} Print${u.mode === 'learner' ? ' consolidated' : ' · 2 per A4'}</button><button class="btn sm gold" id="arW" ${R.length ? '' : 'disabled'}>${ico('download')} Word (.docx)</button></div>
    <div class="ar-list" style="margin-top:14px">${!R.length ? `<div class="empty">${all.length ? 'No records match.' : 'No anecdotal records yet. Tap <b>New record</b> to write your first observation.'}</div>`
      : u.mode === 'learner' ? groupRecs(c, R).map(([lid, recs]) => `<div class="ar-group"><div class="row ar-gh" style="gap:8px;flex-wrap:wrap"><b>${esc(lname(c, lid))}</b>${TERMS.map(t => { const n = recs.filter(r => termOf(r) === t).length; return n ? `<span class="chip">Term ${t}: ${n}</span>` : ''; }).join('')}<span class="spacer"></span>
          <button class="btn sm" data-gv="${lid}">${ico('eye')} View</button><button class="btn sm primary" data-gp="${lid}">${ico('print')} Print consolidated</button><button class="btn sm" data-gw="${lid}">.docx</button></div>
          ${TERMS.map(t => { const arr = recs.filter(r => termOf(r) === t); return arr.length ? `<div class="ar-term">TERM ${t}</div>${arr.map(itemHtml).join('')}` : ''; }).join('')}</div>`).join('')
      : R.map(itemHtml).join('')}</div></div>`;
  const rr = () => M.anecdotalView(el);
  $('#arNew').onclick = () => editor(c, null, rr);
  $('#arL').onchange = (e) => { u.lid = e.target.value; rr(); };
  $('#arQ').oninput = (e) => { u.q = e.target.value; clearTimeout($('#arQ')._t); $('#arQ')._t = setTimeout(() => { rr(); const i = $('#arQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 350); };
  $('#arAll').onchange = (e) => { R.forEach(r => { if(e.target.checked) u.sel[r.id] = 1; else delete u.sel[r.id]; }); rr(); };
  $$('[data-s]', el).forEach(x => x.onchange = () => { if(x.checked) u.sel[x.dataset.s] = 1; else delete u.sel[x.dataset.s]; $('#arN').textContent = `${sel().length} selected`; });
  const pick = () => sel().length ? sel() : R;   // nothing ticked → everything shown
  const cons = () => u.mode === 'learner';
  $('#arV').onclick = () => cons() ? viewCons(c, pick()) : viewRecs(c, pick()); $('#arP').onclick = () => cons() ? printCons(c, pick()) : printRecs(c, pick()); $('#arW').onclick = () => cons() ? docxCons(c, pick()) : docx(c, pick());
  $$('#arMode button', el).forEach(x => x.onclick = () => { u.mode = x.dataset.m; rr(); });
  const ofL = (lid) => R.filter(r => r.lid === lid);
  $$('[data-gv]', el).forEach(x => x.onclick = () => viewCons(c, ofL(x.dataset.gv)));
  $$('[data-gp]', el).forEach(x => x.onclick = () => printCons(c, ofL(x.dataset.gp)));
  $$('[data-gw]', el).forEach(x => x.onclick = () => docxCons(c, ofL(x.dataset.gw)));
  const byId = (id) => all.find(r => r.id === id);
  $$('[data-v]', el).forEach(x => x.onclick = () => viewRecs(c, [byId(x.dataset.v)]));
  $$('[data-p]', el).forEach(x => x.onclick = () => printRecs(c, [byId(x.dataset.p)]));
  $$('[data-w]', el).forEach(x => x.onclick = () => docx(c, [byId(x.dataset.w)]));
  $$('[data-e]', el).forEach(x => x.onclick = () => editor(c, byId(x.dataset.e), rr));
  $$('[data-d]', el).forEach(x => x.onclick = () => { if(!confirm('Delete this anecdotal record?')) return; c.anecdotal = list(c).filter(r => r.id !== x.dataset.d); delete u.sel[x.dataset.d]; M.save(); rr(); });
};
async function docxCons(c, recs){
  await M.loadScript('vendor/jszip.min.js'); const s = M.S.settings; const W = 10466; const G = groupRecs(c, recs);
  const body = G.map(([lid, arr], gi) => { const l = c.learners.find(x => x.id === lid) || {name:'—'}; const g = [2000, 3233, 2000, 3233];
    const info = tbl([cell(para(run('Name of learner', {sz:18})), g[0]) + cell(para(run(l.name, {b:1, sz:20})), g[1]) + cell(para(run('Grade & Section', {sz:18})), g[2]) + cell(para(run(M.className(c), {b:1, sz:20})), g[3]),
      cell(para(run('LRN', {sz:18})), g[0]) + cell(para(run(l.lrn || '', {b:1, sz:20})), g[1]) + cell(para(run('School year', {sz:18})), g[2]) + cell(para(run(c.sy || '', {b:1, sz:20})), g[3])], g);
    const cw = [1800, 4066, 2300, 2300];
    const terms = TERMS.map(t => [t, arr.filter(r => termOf(r) === t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))]).filter(x => x[1].length);
    const tables = terms.map(([t, rs]) => para(run(`TERM ${t}`, {b:1, sz:22, c:'1F6B4A'}), {before:160, after:60}) + tbl([
      cell(para(run('Date · time · place', {b:1, sz:17})), cw[0], {fill:'E9F1EC'}) + cell(para(run('Observation', {b:1, sz:17})), cw[1], {fill:'E9F1EC'}) + cell(para(run('Interpretation / Comment', {b:1, sz:17})), cw[2], {fill:'E9F1EC'}) + cell(para(run('Action taken / Recommendation', {b:1, sz:17})), cw[3], {fill:'E9F1EC'}),
      ...rs.map(r => cell(para(run(`${M.parse(r.date).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}\n${ftime(r.time)}\n${r.place || ''}`, {sz:17})), cw[0]) + cell(para(run(r.obs || '', {sz:19})), cw[1]) + cell(para(run(r.interp || '', {sz:19})), cw[2]) + cell(para(run(r.action || '', {sz:19})), cw[3]))], cw)).join('');
    const sig = tbl([cell(para(run(c.adviser || '', {b:1, sz:19}), {jc:'center', before:240}) + para(run('Observed by (Class Adviser)', {sz:16}), {jc:'center'}), 3488) + cell(para('', {before:240}) + para(run("Learner's signature", {sz:16}), {jc:'center'}), 3489) + cell(para('', {before:240}) + para(run("Parent / Guardian's signature", {sz:16}), {jc:'center'}), 3489)], [3488, 3489, 3489]);
    return para(run('Republic of the Philippines · Department of Education', {sz:16}), {jc:'center', after:0, pb: gi > 0}) + para(run(s.school || '', {b:1, sz:20}), {jc:'center', after:40}) +
      para(run(`ANECDOTAL RECORD — consolidated (${arr.length})`, {b:1, sz:26, c:'1F6B4A'}), {jc:'center', after:80}) + info + tables + para('', {after:80}) + sig; }).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return packDocx(doc, G.length === 1 ? `Anecdotal Record (consolidated) - ${lname(c, G[0][0]).split(',')[0]} - ${M.className(c)}.docx` : `Anecdotal Records (consolidated, ${G.length} learners) - ${M.className(c)}.docx`);
}
M.anecdotalDocx = docx;
})();
