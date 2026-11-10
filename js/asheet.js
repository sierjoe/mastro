/* MASTRO — Answer sheets (v6.14).
   Two answer sheets per A4 page (each a landscape half page, 0.3 in margins — also fits Letter); bubbles in columns of 10.
   Every sheet has 4 black corner squares and a QR code (sheet · learner · section) so the phone can check it (scan.js).
   Print one per learner of a class, only the learners you tick (lost papers), or blank copies. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const O = () => M.omr;

const FMTS = {
  abcd:{label:'Letters A–D', ch:['A','B','C','D']},
  abcde:{label:'Letters A–E', ch:['A','B','C','D','E']},
  abc:{label:'Letters A–C', ch:['A','B','C']},
  tf:{label:'True / False', ch:['T','F']},
  line:{label:'Write-in line (checked by you)', ch:null}
};
M.AS_FMTS = FMTS;
const PAPER = 'A4';
const BLOCK_H = 131;                          // mm — 2 blocks stay under the printable height of A4 and of Letter, so nothing spills onto another page
const store = () => (M.S.asheets = Array.isArray(M.S.asheets) ? M.S.asheets : []);
M.asStore = store;
const total = (sh) => sh.parts.reduce((a, p) => a + (+p.n || 0), 0);
M.asTotal = total;
const keyed = (sh) => sh.parts.reduce((a, p) => a + (FMTS[p.fmt] && FMTS[p.fmt].ch ? String(p.key || '').replace(/[^A-Z]/gi, '').slice(0, +p.n).length : 0), 0);
// the full key, one entry per item number ('' for write-in items)
M.asKey = (sh) => sh.parts.flatMap(p => { const ch = FMTS[p.fmt] && FMTS[p.fmt].ch; const k = String(p.key || '').toUpperCase().replace(/[^A-Z]/g, '');
  return Array.from({length: +p.n || 0}, (_, i) => ch && ch.includes(k[i]) ? k[i] : ''); });
const ascii = (s) => String(s || '').replace(/[\u2013\u2014]/g, '-').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\|/g, '/');

/* ---------------- class rosters (Classes → ECRs, plus the advisory roster) ---------------- */
function latestTerm(model){ const ks = Object.keys(model.terms || {}).sort(); return ks.length ? model.terms[ks[ks.length - 1]] : null; }
function ecrList(E){
  const R = E.model && E.model.roster;
  if(R){ const T = latestTerm(E.model); const tags = (T && T.tags) || {};
    return ['M','F'].flatMap(sx => (R[sx] || []).map((n, i) => n ? {name: String(n).replace(/\s*,\s*/, ', '), sex: sx, lk: sx + i, tag: M.ecrNormTag ? M.ecrNormTag(tags[sx + i]) : (tags[sx + i] || '')} : null).filter(Boolean)); }
  const ts = Object.keys(E.terms || {}).sort(); const T = ts.length ? E.terms[ts[ts.length - 1]] : null;
  if(T && T.learners && T.learners.length) return T.learners.map(x => ({name: x.name, sex: x.sex || 'M', lk: '', tag: x.tag || ''}));
  return (E.roster || []).map(x => ({name: x.name, sex: x.sex || 'M', lk: '', tag: ''}));
}
const isOut = (x) => x.tag && (M.ecrTagOut ? M.ecrTagOut(x.tag) : true);
function sources(){
  const out = (M.S.ecr || []).map(E => ({id: 'e:' + E.id, label: `${E.title || ('Grade ' + E.grade + ' – ' + E.section)}${E.subject ? ' · ' + E.subject : ''}`, section: `Grade ${E.grade} – ${E.section}`, E}));
  (M.S.classes || []).forEach(c => out.push({id: 'c:' + c.id, label: `${M.className(c)} · advisory roster`, section: M.className(c), c}));
  return out;
}
async function rosterOf(src){
  if(src.E){ if(!src.E.model && src.E.docId && M.ecrEnsureModel){ try { await M.ecrEnsureModel(src.E); } catch(e){} } return ecrList(src.E); }
  return M.sortedLearners(src.c).map(l => ({name: l.name, sex: l.sex, lk: l.id, tag: l.status || '', out: !M.counted(l)}));
}
const sortRoster = (L) => [...L].sort((a, b) => (a.sex === b.sex ? 0 : a.sex === 'M' ? -1 : 1) || a.name.localeCompare(b.name));

/* ---------------- the sheet (absolute mm layout from omr.js, so the scanner knows where every bubble is) ---------------- */
// QR on every sheet: MA2|sheet id|learner key|name|section
const qrText = (sh, who) => `MA2|${sh.id}|${who.lk || ''}|${ascii(who.name).slice(0, 24)}|${ascii(who.section).replace(/^Grade\s*/i, 'G').slice(0, 18)}`;
function qrSvg(text){ const q = qrcode(0, 'L'); q.addData(text); q.make(); return q.createSvgTag({cellSize: 2, margin: 0, scalable: true}); }
function sheetHtml(sh, who, L){
  const S = M.S.settings; const c = L.cfg; const mm = (v) => v.toFixed(2) + 'mm';
  const fs = c.bubD >= 4.6 ? 7.4 : c.bubD >= 4.2 ? 6.8 : 6.2;
  const mk = O().MC.map(([x, y]) => `<i class="ash-mk" style="left:${mm(x - O().MK / 2)};top:${mm(y - O().MK / 2)};width:${O().MK}mm;height:${O().MK}mm"></i>`).join('');
  const Q = O().QR;
  const items = L.items.map(it => `<b class="ash-n" style="left:${mm(it.x)};top:${mm(it.y)};width:${mm(c.numW - 1.2)};height:${mm(c.rowP)};line-height:${mm(c.rowP)}">${it.no}.</b>` +
    (it.line ? `<i class="ash-ln" style="left:${mm(it.line.x0)};top:${mm(it.line.y)};width:${mm(it.line.x1 - it.line.x0)}"></i>`
      : it.bub.map(b => `<i class="ash-b" style="left:${mm(b.x - c.bubD / 2)};top:${mm(b.y - c.bubD / 2)};width:${mm(c.bubD)};height:${mm(c.bubD)};line-height:${mm(c.bubD)};font-size:${fs}pt">${b.L}</i>`).join(''))).join('');
  const labels = L.labels.map(l => `<b class="ash-pl" style="left:${mm(l.x)};top:${mm(l.y)};width:${mm(l.w)};height:${mm(c.hdr)};line-height:${mm(c.hdr)}">${esc(l.text)}</b>`).join('');
  return `<div class="ash" style="width:${O().W}mm;height:${O().H}mm">${mk}
    <div class="ash-qr" style="left:${Q.x}mm;top:${Q.y}mm;width:${Q.s}mm;height:${Q.s}mm">${qrSvg(qrText(sh, who))}</div>
    <div class="ash-h"><div class="s">${esc(S.school || '')}</div><div class="t">${esc(sh.title || 'Answer Sheet')}</div></div>
    <div class="ash-who"><div class="r"><span>Name:</span><b class="v no-emph">${who.name ? esc(who.name) : ''}</b><span>Section:</span><b class="v sm no-emph">${who.section ? esc(who.section) : ''}</b></div>
      <div class="r"><span>Date:</span><i class="v xs"></i><span>Score:</span><i class="v xxs"></i><span>/ ${total(sh)}</span></div></div>
    <div class="ash-ins">Shade the circle of your answer completely with a dark pencil or pen. Do not fold, write on, or mark the black squares and the code.</div>
    ${labels}${items}</div>`;
}
async function sheetsHtml(sh, people){
  await M.loadScript('vendor/qrcode.js');
  const L = O().layout(sh.parts);
  // two sheets per page: a dashed cut line under the first, a page break after the second
  return people.map((w, i) => `<div class="ash-blk ${i % 2 ? 'b2' : 'b1'}${i % 2 && i < people.length - 1 ? ' pb' : ''}" style="height:${BLOCK_H}mm">${sheetHtml(sh, w, L)}</div>`).join('');
}
M.asSheetsHtml = sheetsHtml;

/* ---------------- editor ---------------- */
const TYPE_FMT = (p) => p.type === 'true_false' ? 'tf' : p.type === 'error_identification' ? 'abcd'
  : p.type === 'multiple_choice' ? (Math.max(...p.items.map(it => (it.choices || []).length), 4) >= 5 ? 'abcde' : Math.max(...p.items.map(it => (it.choices || []).length), 0) === 3 ? 'abc' : 'abcd')
  : p.type === 'matching' ? ({3:'abc', 4:'abcd', 5:'abcde'})[(p.choices || []).length] || 'line' : 'line';
const TNAME = {multiple_choice:'Multiple Choice', true_false:'True or False', modified_true_false:'Modified True or False', matching:'Matching Type', identification:'Identification', fill_blanks:'Fill in the Blanks', enumeration:'Enumeration', short_answer:'Short Answer', error_identification:'Error Identification', essay:'Essay'};
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
M.asheetFromAsm = function(a){
  const parts = a.parts.filter(p => p.type !== 'essay').map((p, i) => { const fmt = TYPE_FMT(p);
    const key = FMTS[fmt].ch ? p.items.map(it => { const s = String(Array.isArray(it.answer) ? it.answer[0] : it.answer || '').trim().toUpperCase(); return fmt === 'tf' ? (s[0] === 'T' ? 'T' : s[0] === 'F' ? 'F' : '-') : (/^[A-E]\b/.test(s) ? s[0] : '-'); }).join('') : '';
    return {n: p.type === 'enumeration' ? p.items.reduce((s, it) => s + (Array.isArray(it.answer) ? it.answer.length : 1), 0) : p.items.length, fmt, key, label: `Test ${ROMAN[i]}. ${p.title || TNAME[p.type] || ''}`}; });
  editor({id: null, title: a.title, parts: parts.length ? parts : [{n: 20, fmt: 'abcd', label: '', key: ''}], asmId: a.id});
};
function editor(sh0){
  const sh = JSON.parse(JSON.stringify(sh0 || {id: null, title: '', parts: [{n: 20, fmt: 'abcd', label: '', key: ''}]}));
  const asms = (M.S.asm || []).filter(a => a.v === 2);
  M.modal(sh.id ? 'Edit answer sheet' : 'New answer sheet', `
    <label class="field">Name of the assessment (printed on the sheet)<input class="input" id="asT" value="${esc(sh.title)}" placeholder="e.g. Summative Test 1 · Term 2"></label>

    <div class="row" style="margin-top:14px"><h3 style="margin:0">Items and answer key</h3><span class="spacer"></span><span class="small muted" id="asTot"></span></div>
    <div id="asParts" style="margin-top:8px"></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" id="asAdd">${ico('plus')} Add a part</button><span class="spacer"></span><span class="tiny muted">Numbering continues from part to part. Bubbles come in columns of 10; up to about 120 items fit on a half sheet.</span></div>
    <div class="small" id="asFit" style="margin-top:8px"></div>
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn" id="asX">Cancel</button><button class="btn" id="asSave">${ico('save')} Save</button><button class="btn primary" id="asPrint">${ico('print')} Save &amp; print…</button></div>`, b => {
    const keyHint = (p) => { const ch = FMTS[p.fmt].ch; const k = String(p.key || '').toUpperCase().replace(/[^A-Z]/g, ''); const bad = [...k.slice(0, +p.n)].filter(x => !ch.includes(x)).length;
      return `${Math.min(k.length, +p.n)} of ${p.n} keyed${bad ? ` · <span class="low">${bad} not ${ch.join('/')}</span>` : ''}${k.length > +p.n ? ` · <span class="low">${k.length - p.n} extra</span>` : ''}`; };
    const fit = () => { const L = O().layout(sh.parts); $('#asTot', b).textContent = `${total(sh)} item(s) · ${keyed(sh)} keyed`;
      $('#asFit', b).innerHTML = !total(sh) ? '' : L.fits ? `<span class="muted">${L.cols} column(s) of 10${L.bands > 1 ? ' in 2 rows' : ''} · 2 answer sheets per A4 page${L.cfg.bubD < 3.6 ? ' (smaller bubbles)' : ''}.</span>` : `<span class="low">Too many items for a half sheet — split the test into two answer sheets.</span>`; };
    const draw = () => { $('#asParts', b).innerHTML = sh.parts.map((p, i) => `<div class="as-prow">
        <div class="row" style="gap:8px;flex-wrap:wrap">
        <input class="input" data-i="${i}" data-k="label" value="${esc(p.label || '')}" placeholder="Part label (e.g. Test I. Multiple Choice)" style="flex:2;min-width:140px">
        <label class="field" style="flex-direction:row;align-items:center;gap:6px">Items<input class="input" data-i="${i}" data-k="n" inputmode="numeric" value="${p.n}" style="width:64px"></label>
        <select class="input" data-i="${i}" data-k="fmt" style="width:auto">${Object.entries(FMTS).map(([k, f]) => `<option value="${k}" ${k === p.fmt ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
        ${sh.parts.length > 1 ? `<button class="icon-btn" data-rm="${i}" title="Remove part">✕</button>` : ''}</div>
        ${FMTS[p.fmt].ch ? `<div class="row" style="gap:8px;margin-top:6px"><input class="input mono" data-i="${i}" data-k="key" value="${esc(p.key || '')}" placeholder="Answer key in order, e.g. ${p.fmt === 'tf' ? 'TFTTF…' : 'ABDCA…'}" style="flex:1;letter-spacing:2px;text-transform:uppercase" autocomplete="off" autocapitalize="characters"><span class="tiny muted" data-kh="${i}">${keyHint(p)}</span></div>`
          : `<div class="tiny muted" style="margin-top:6px">Write-in items are not read by the scanner — you add their points on the result screen.</div>`}</div>`).join('');
      fit(); $$('[data-rm]', b).forEach(x => x.onclick = () => { sh.parts.splice(+x.dataset.rm, 1); draw(); }); };
    draw();
    $('#asParts', b).addEventListener('input', e => { const x = e.target; if(x.dataset.i === undefined) return; const p = sh.parts[+x.dataset.i]; const k = x.dataset.k;
      if(k === 'n') p.n = Math.max(0, Math.min(150, parseInt(x.value) || 0)); else if(k === 'key') p.key = x.value.toUpperCase().replace(/[^A-Z\-]/g, ''); else p[k] = x.value;
      if(k === 'fmt') return draw(); const kh = $(`[data-kh="${x.dataset.i}"]`, b); if(kh) kh.innerHTML = keyHint(p); fit(); });
    $('#asParts', b).addEventListener('change', e => { if(e.target.dataset.k === 'fmt'){ sh.parts[+e.target.dataset.i].fmt = e.target.value; draw(); } });
    $('#asAdd', b).onclick = () => { sh.parts.push({n: 10, fmt: 'abcd', label: '', key: ''}); draw(); };

    $('#asX', b).onclick = M.closeModal;
    const save = () => { sh.title = $('#asT', b).value.trim(); if(!sh.title){ M.toast('Type the name of the assessment'); return null; }
      if(!total(sh)){ M.toast('Add at least one item'); return null; }
      if(!O().layout(sh.parts).fits){ M.toast('Too many items for a half sheet'); return null; }
      const L = store(); if(sh.id){ const i = L.findIndex(x => x.id === sh.id); if(i >= 0) L[i] = sh; else L.push(sh); } else { sh.id = M.uid('as'); sh.created = new Date().toISOString(); L.push(sh); }
      sh.edited = new Date().toISOString(); M.save(); return sh; };
    $('#asSave', b).onclick = () => { if(!save()) return; M.closeModal(); M.route(); M.toast('Answer sheet saved'); };
    $('#asPrint', b).onclick = () => { const s = save(); if(!s) return; M.closeModal(); M.route(); printDialog(s); };
  }, true);
}

/* ---------------- print dialog ---------------- */
const pui = {src: '', mode: 'class', blanks: 0, skipOut: true, copies: 10};
async function printDialog(sh){
  const SRC = sources(); if(!SRC.find(s => s.id === pui.src)) pui.src = (SRC[0] || {}).id || '';
  let roster = []; const picked = new Set();
  M.modal('Print answer sheets', `
    <div class="small muted" style="margin-top:0"><b>${esc(sh.title)}</b> · ${total(sh)} items · 2 answer sheets per A4 page (cut in half), 0.3 in margins</div>
    <div class="seg" id="apMode" style="margin-top:12px">${[['class','Whole class'],['some','Selected learners'],['blank','Blank copies']].map(([k, l]) => `<button data-m="${k}" class="${k === pui.mode ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="apSrcBox" style="margin-top:12px"><label class="field">Class (from Classes)<select class="input" id="apSrc">${SRC.map(s => `<option value="${s.id}" ${s.id === pui.src ? 'selected' : ''}>${esc(s.label)}</option>`).join('') || '<option value="">No classes yet</option>'}</select></label></div>
    <div id="apBody" style="margin-top:10px"></div>
    <div class="small muted" id="apInfo" style="margin-top:12px"></div>
    <div class="tiny muted" style="margin-top:6px">In the print window choose paper <b>A4</b> and scale <b>100%</b>. Two sheets per page — cut along the dashed line. No page is skipped or left blank.</div>
    <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" id="apX">Cancel</button><button class="btn primary" id="apGo">${ico('print')} Print</button></div>`, async b => {
    const src = () => SRC.find(s => s.id === $('#apSrc', b).value);
    const people = () => { const s = src(); const sec = s ? s.section : '', sid = s ? s.id : '';
      if(pui.mode === 'blank') return Array.from({length: Math.max(1, Math.min(200, pui.copies))}, () => ({name: '', section: '', src: '', lk: ''}));
      const L = pui.mode === 'some' ? roster.filter(x => picked.has(x.name)) : roster.filter(x => !(pui.skipOut && (x.out || isOut(x))));
      return [...L.map(x => ({name: x.name, section: sec, src: sid, lk: x.lk})), ...Array.from({length: pui.blanks}, () => ({name: '', section: sec, src: sid, lk: ''}))]; };
    const info = () => { const n = people().length; $('#apInfo', b).innerHTML = `<b>${n}</b> answer sheet(s) on <b>${Math.ceil(n / 2)}</b> page(s).`; };
    const body = () => { $('#apSrcBox', b).style.display = pui.mode === 'blank' ? 'none' : '';
      if(pui.mode === 'blank'){ $('#apBody', b).innerHTML = `<label class="field">Number of blank copies<input class="input" id="apCp" inputmode="numeric" value="${pui.copies}" style="max-width:120px"></label><div class="tiny muted" style="margin-top:6px">When you scan a blank sheet, MASTRO asks whose paper it is.</div>`;
        $('#apCp', b).oninput = e => { pui.copies = parseInt(e.target.value) || 1; info(); }; return info(); }
      if(!roster.length){ $('#apBody', b).innerHTML = '<div class="empty small">No learners found in this class.</div>'; return info(); }
      const outN = roster.filter(x => x.out || isOut(x)).length;
      if(pui.mode === 'class'){ $('#apBody', b).innerHTML = `<div class="small">${roster.length} learner(s) in this class.</div>
          ${outN ? `<label class="row small" style="cursor:pointer;gap:6px;margin-top:6px"><input type="checkbox" id="apSk" ${pui.skipOut ? 'checked' : ''}> Skip ${outN} learner(s) tagged NLP / T/O / Dropped Out</label>` : ''}
          <label class="row small" style="gap:6px;margin-top:6px;align-items:center">Add <input class="input" id="apBl" inputmode="numeric" value="${pui.blanks}" style="width:56px;padding:4px 8px"> blank sheet(s) with the section filled in (spares)</label>`;
        if($('#apSk', b)) $('#apSk', b).onchange = e => { pui.skipOut = e.target.checked; info(); };
        $('#apBl', b).oninput = e => { pui.blanks = Math.max(0, Math.min(60, parseInt(e.target.value) || 0)); info(); }; return info(); }
      $('#apBody', b).innerHTML = `<div class="row" style="gap:8px"><input class="input" id="apQ" placeholder="Find a learner…" style="flex:1"><button class="btn sm" id="apNone">Clear</button></div>
        <div class="as-pick">${['M','F'].map(sx => { const L = roster.filter(x => x.sex === sx); return L.length ? `<div class="tiny muted as-pick-h">${sx === 'M' ? 'MALE' : 'FEMALE'}</div>` + L.map(x => `<label class="as-pick-r"><input type="checkbox" data-n="${esc(x.name)}" ${picked.has(x.name) ? 'checked' : ''}> ${esc(x.name)}${x.tag ? ` <span class="tiny muted">(${esc((M.ECR_TAG_SHORT || {})[x.tag] || (M.STATUS[x.tag] || {}).short || x.tag)})</span>` : ''}</label>`).join('') : ''; }).join('')}</div>`;
      $$('[data-n]', b).forEach(x => x.onchange = () => { if(x.checked) picked.add(x.dataset.n); else picked.delete(x.dataset.n); info(); });
      $('#apQ', b).oninput = e => { const q = e.target.value.trim().toLowerCase(); $$('.as-pick-r', b).forEach(r => r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none'); };
      $('#apNone', b).onclick = () => { picked.clear(); body(); }; info(); };
    const load = async () => { const s = src(); pui.src = s ? s.id : ''; roster = s ? sortRoster(await rosterOf(s)) : []; picked.clear(); body(); };
    $('#apMode', b).onclick = e => { const x = e.target.closest('button'); if(!x) return; pui.mode = x.dataset.m; $$('#apMode button', b).forEach(y => y.classList.toggle('on', y === x)); body(); };
    $('#apSrc', b).onchange = load;
    $('#apX', b).onclick = M.closeModal;
    $('#apGo', b).onclick = async () => { const P = people(); if(!P.length) return M.toast(pui.mode === 'some' ? 'Tick at least one learner' : 'No learners to print');
      M.closeModal(); M.doPrint(await sheetsHtml(sh, P), M.pageCss(PAPER), {noFit: true, safe: false}); };
    await load();
  }, true);
}
M.asheetPrint = printDialog;

/* ---------------- the Assessments page: one card per answer sheet ---------------- */
M.asheetSection = function(box){
  const L = [...store()].sort((a, b) => (b.edited || b.created || '').localeCompare(a.edited || a.created || ''));
  const nScans = (id) => (M.S.scans || []).filter(r => r.sheet === id).length;
  const phone = /iPhone|iPod|Android/i.test(navigator.userAgent);
  box.innerHTML = `<div class="card as-head"><div class="row" style="gap:12px;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">${ico('assess','width:22px;height:22px;vertical-align:-4px')} Answer sheets</h2>
      <div class="small muted" style="margin-top:4px">1 · Make the sheet and its answer key &nbsp; 2 · Print (2 per A4 page) &nbsp; 3 · Scan with your phone &nbsp; 4 · See the scores per section</div></div>
      <button class="btn sm" id="asRx" title="${phone ? 'Take in an answer key shown on your MacBook' : 'Take in the scores scanned on your iPhone'}">📥 ${phone ? 'Receive key' : 'Receive scores from iPhone'}</button>
      <button class="btn primary" id="asNew">${ico('plus')} New answer sheet</button></div></div>
    ${L.length ? `<div class="as-cards">${L.map(s => { const k = keyed(s), bub = s.parts.reduce((a, p) => a + (FMTS[p.fmt] && FMTS[p.fmt].ch ? +p.n : 0), 0), n = nScans(s.id);
      return `<div class="card as-card"><div class="row" style="align-items:flex-start"><div class="grow"><div class="title"><b>${esc(s.title)}</b></div>
          <div class="tiny muted" style="margin-top:3px">${total(s)} items${k < bub ? ` · <span class="low">answer key ${k}/${bub}</span>` : ''}</div></div>
          <div class="as-menu"><button class="icon-btn" data-asm="${s.id}" title="More">⋯</button><div class="as-pop" hidden><button data-ase="${s.id}">${ico('edit')} Edit</button><button data-ask="${s.id}">📱 Send key to iPhone</button><button data-asd="${s.id}" class="low">✕ Delete</button></div></div></div>
        <div class="as-acts"><button class="btn sm" data-asp="${s.id}">${ico('print')} Print</button><button class="btn sm primary" data-ass="${s.id}">📷 Scan</button><button class="btn sm" data-asr="${s.id}">📊 Scores${n ? ` <span class="chip" style="margin-left:4px;padding:1px 7px">${n}</span>` : ''}</button></div></div>`; }).join('')}</div>`
      : `<div class="card" style="margin-top:20px"><div class="empty">No answer sheets yet. Tap <b>New answer sheet</b>.</div></div>`}`;
  const get = (id) => store().find(x => x.id === id);
  $('#asNew', box).onclick = () => editor();
  $('#asRx', box).onclick = () => M.scanReceive();
  $$('[data-asm]', box).forEach(x => x.onclick = e => { e.stopPropagation(); const pop = x.nextElementSibling; const was = !pop.hidden; $$('.as-pop', box).forEach(p => p.hidden = true); pop.hidden = was; });
  box.onclick = e => { if(!e.target.closest('.as-menu')) $$('.as-pop', box).forEach(p => p.hidden = true); };
  $$('[data-asp]', box).forEach(x => x.onclick = () => printDialog(get(x.dataset.asp)));
  $$('[data-ass]', box).forEach(x => x.onclick = () => M.scanOpen(get(x.dataset.ass)));
  $$('[data-asr]', box).forEach(x => x.onclick = () => M.scanReport(get(x.dataset.asr)));
  $$('[data-ase]', box).forEach(x => x.onclick = () => editor(get(x.dataset.ase)));
  $$('[data-ask]', box).forEach(x => x.onclick = () => M.scanSendKey(get(x.dataset.ask)));
  $$('[data-asd]', box).forEach(x => x.onclick = () => { const s = get(x.dataset.asd); if(!s || !confirm(`Delete the answer sheet “${s.title}” and its scanned scores?`)) return;
    M.S.asheets = store().filter(y => y !== s); M.S.scans = (M.S.scans || []).filter(r => r.sheet !== s.id); M.save(); M.asheetSection(box); });
};
M.asheetEditor = editor;
})();
