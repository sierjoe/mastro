/* MASTRO — Answer sheets (v6.12).
   Make an answer sheet for any test or quiz: number of items, answer format per part (A–D, A–E, True/False, write-in line).
   Print on 8.5 × 13 in (0.3 in margins), 1, 2 or 4 per sheet: one sheet per learner of a class (names printed),
   only the learners you tick (lost papers), or blank copies. Header: school name and assessment name only. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;

const FMTS = {
  abcd:{label:'Letters A–D', ch:['A','B','C','D']},
  abcde:{label:'Letters A–E', ch:['A','B','C','D','E']},
  abc:{label:'Letters A–C', ch:['A','B','C']},
  tf:{label:'True / False', ch:['T','F']},
  line:{label:'Write-in line', ch:null}
};
const PAPER = 'FOLIO';                       // 8.5 × 13 in (long bond)
const store = () => (M.S.asheets = Array.isArray(M.S.asheets) ? M.S.asheets : []);
const total = (sh) => sh.parts.reduce((a, p) => a + (+p.n || 0), 0);

/* ---------------- class rosters (Classes → ECRs, plus the advisory roster) ---------------- */
function latestTerm(model){ const ks = Object.keys(model.terms || {}).sort(); return ks.length ? model.terms[ks[ks.length - 1]] : null; }
function ecrList(E){
  const R = E.model && E.model.roster;
  if(R){ const T = latestTerm(E.model); const tags = (T && T.tags) || {};
    return ['M','F'].flatMap(sx => (R[sx] || []).map((n, i) => n ? {name: String(n).replace(/\s*,\s*/, ', '), sex: sx, tag: M.ecrNormTag ? M.ecrNormTag(tags[sx + i]) : (tags[sx + i] || '')} : null).filter(Boolean)); }
  const ts = Object.keys(E.terms || {}).sort(); const T = ts.length ? E.terms[ts[ts.length - 1]] : null;
  if(T && T.learners && T.learners.length) return T.learners.map(x => ({name: x.name, sex: x.sex || 'M', tag: x.tag || ''}));
  return (E.roster || []).map(x => ({name: x.name, sex: x.sex || 'M', tag: ''}));
}
const isOut = (x) => x.tag && (M.ecrTagOut ? M.ecrTagOut(x.tag) : true);
function sources(){
  const out = (M.S.ecr || []).map(E => ({id: 'e:' + E.id, label: `${E.title || ('Grade ' + E.grade + ' – ' + E.section)}${E.subject ? ' · ' + E.subject : ''}`, section: `Grade ${E.grade} – ${E.section}`, E}));
  (M.S.classes || []).forEach(c => out.push({id: 'c:' + c.id, label: `${M.className(c)} · advisory roster`, section: M.className(c), c}));
  return out;
}
async function rosterOf(src){
  if(src.E){ if(!src.E.model && src.E.docId && M.ecrEnsureModel){ try { await M.ecrEnsureModel(src.E); } catch(e){} } return ecrList(src.E); }
  return M.sortedLearners(src.c).map(l => ({name: l.name, sex: l.sex, tag: l.status || '', out: !M.counted(l)}));
}
const sortRoster = (L) => [...L].sort((a, b) => (a.sex === b.sex ? 0 : a.sex === 'M' ? -1 : 1) || a.name.localeCompare(b.name));

/* ---------------- the sheet ---------------- */
function itemW(fmt){ const f = FMTS[fmt] || FMTS.abcd; return f.ch ? 9 + f.ch.length * 6.4 : 42; }   // mm per item column
function sheetHtml(sh, who, wMm){
  const S = M.S.settings; let no = 0;
  const parts = sh.parts.filter(p => +p.n > 0).map((p, pi) => { const f = FMTS[p.fmt] || FMTS.abcd; const n = +p.n;
    const cols = Math.max(1, Math.min(n, Math.floor((wMm - 2) / itemW(p.fmt)))); const rows = Math.ceil(n / cols);
    const its = []; for(let k = 0; k < n; k++){ no++;
      its.push(`<div class="as-it"><span class="n">${no}.</span>${f.ch ? f.ch.map(c => `<span class="bb">${c}</span>`).join('') : '<span class="ln"></span>'}</div>`); }
    const label = (p.label || '').trim();
    return `<div class="as-part">${label || sh.parts.length > 1 ? `<div class="as-pl">${esc(label || ('Part ' + (pi + 1)))} <span>(${no - n + 1}–${no})</span></div>` : ''}<div class="as-grid" style="grid-template-rows:repeat(${rows},auto);grid-template-columns:repeat(${cols},1fr)">${its.join('')}</div></div>`; }).join('');
  return `<div class="as" style="width:${wMm}mm">
    <div class="as-h"><div class="as-school">${esc(S.school || '')}</div><div class="as-title">${esc(sh.title || 'Answer Sheet')}</div></div>
    <div class="as-name"><span class="w">Name: <b class="no-emph">${who && who.name ? esc(who.name) : ''}</b></span><span>Section: <b class="no-emph">${who && who.section ? esc(who.section) : ''}</b></span><span>Date: <i></i></span><span>Score: <i class="s"></i> / ${total(sh)}</span></div>
    ${parts}</div>`;
}
// pages of 1, 2 or 4 cells; each sheet is shrunk only if it is taller than its cell
function layout(sh, per){
  const [PW, PH] = M.printableMm(M.pageCss(PAPER)); const pw = Math.floor(PW) - 0.5, ph = Math.floor(PH) - 0.5;
  const cw = per === 4 ? pw / 2 : pw, ch = per === 1 ? ph : ph / 2; const pad = per === 1 ? 0 : 2.5; const px = 96 / 25.4;
  const dw = cw - pad * 2; const m = M.measurePrint(sheetHtml(sh, {name: 'DELA CRUZ, JUAN MIGUEL SANTOS', section: 'Grade 10 – Section'}, dw), dw);
  const h = m.h / px; const k = Math.min(1, (ch - pad * 2) / h);
  return {pw, ph, cw, ch, pad, dw, k, ok: k >= 0.55};
}
function pagesHtml(sh, people, per){
  const Lo = layout(sh, per); const pos = per === 4 ? [[0,0],[Lo.cw,0],[0,Lo.ch],[Lo.cw,Lo.ch]] : per === 2 ? [[0,0],[0,Lo.ch]] : [[0,0]];
  const pages = [];
  for(let i = 0; i < people.length; i += per){ const chunk = people.slice(i, i + per);
    pages.push(`<div class="quad-page" style="width:${Lo.pw}mm;height:${Lo.ph}mm">${per === 4 ? `<i class="cut v" style="left:${Lo.cw}mm"></i>` : ''}${per > 1 ? `<i class="cut h" style="top:${Lo.ch}mm"></i>` : ''}${chunk.map((w, j) =>
      `<div class="quad-cell" style="left:${(pos[j][0] + Lo.pad).toFixed(2)}mm;top:${(pos[j][1] + Lo.pad).toFixed(2)}mm;width:${Lo.dw.toFixed(2)}mm;height:${(Lo.ch - Lo.pad * 2).toFixed(2)}mm"><div style="width:${Lo.dw.toFixed(2)}mm;transform:scale(${Lo.k.toFixed(4)});transform-origin:0 0">${sheetHtml(sh, w, Lo.dw)}</div></div>`).join('')}</div>`); }
  return pages.join('');
}

/* ---------------- editor ---------------- */
const TYPE_FMT = (p) => p.type === 'true_false' ? 'tf' : p.type === 'multiple_choice' ? (Math.max(...p.items.map(it => (it.choices || []).length), 4) >= 5 ? 'abcde' : 'abcd') : 'line';
const TNAME = {multiple_choice:'Multiple Choice', true_false:'True or False', modified_true_false:'Modified True or False', matching:'Matching Type', identification:'Identification', fill_blanks:'Fill in the Blanks', enumeration:'Enumeration', short_answer:'Short Answer', error_identification:'Error Identification', essay:'Essay'};
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
M.asheetFromAsm = function(a){
  const parts = a.parts.filter(p => p.type !== 'essay').map((p, i) => ({n: p.type === 'enumeration' ? p.items.reduce((s, it) => s + (Array.isArray(it.answer) ? it.answer.length : 1), 0) : p.items.length,
    fmt: p.type === 'matching' ? ((p.choices || []).length === 5 ? 'abcde' : (p.choices || []).length === 3 ? 'abc' : (p.choices || []).length === 4 ? 'abcd' : 'line') : TYPE_FMT(p), label: `Test ${ROMAN[i]}. ${p.title || TNAME[p.type] || ''}`}));
  editor({id: null, title: a.title, parts: parts.length ? parts : [{n: 20, fmt: 'abcd', label: ''}], asmId: a.id});
};
function editor(sh0){
  const sh = JSON.parse(JSON.stringify(sh0 || {id: null, title: '', parts: [{n: 20, fmt: 'abcd', label: ''}]}));
  const asms = (M.S.asm || []).filter(a => a.v === 2);
  M.modal(sh.id ? 'Edit answer sheet' : 'New answer sheet', `
    <label class="field">Name of the assessment (printed on the sheet)<input class="input" id="asT" value="${esc(sh.title)}" placeholder="e.g. Quiz 3 · Subject–Verb Agreement"></label>
    ${!sh.id && asms.length ? `<label class="field" style="margin-top:10px">Or start from a test you made in Assessments<select class="input" id="asFrom"><option value="">—</option>${asms.map(a => `<option value="${a.id}">${esc(a.title)} (${a.total} items)</option>`).join('')}</select></label>` : ''}
    <div class="row" style="margin-top:14px"><h3 style="margin:0">Items</h3><span class="spacer"></span><span class="small muted" id="asTot"></span></div>
    <div id="asParts" style="margin-top:8px"></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" id="asAdd">${ico('plus')} Add a part</button><span class="spacer"></span><span class="tiny muted">Numbering continues from part to part.</span></div>
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn" id="asX">Cancel</button><button class="btn" id="asSave">${ico('save')} Save</button><button class="btn primary" id="asPrint">${ico('print')} Save &amp; print…</button></div>`, b => {
    const draw = () => { $('#asParts', b).innerHTML = sh.parts.map((p, i) => `<div class="row as-prow" style="gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <input class="input" data-i="${i}" data-k="label" value="${esc(p.label || '')}" placeholder="Part label (optional, e.g. Test I)" style="flex:2;min-width:140px">
        <label class="field" style="flex-direction:row;align-items:center;gap:6px">Items<input class="input" data-i="${i}" data-k="n" inputmode="numeric" value="${p.n}" style="width:64px"></label>
        <select class="input" data-i="${i}" data-k="fmt" style="width:auto">${Object.entries(FMTS).map(([k, f]) => `<option value="${k}" ${k === p.fmt ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
        ${sh.parts.length > 1 ? `<button class="icon-btn" data-rm="${i}" title="Remove part">✕</button>` : ''}</div>`).join('');
      $('#asTot', b).textContent = `${total(sh)} item(s)`;
      $$('[data-rm]', b).forEach(x => x.onclick = () => { sh.parts.splice(+x.dataset.rm, 1); draw(); }); };
    draw();
    $('#asParts', b).oninput = e => { const x = e.target; if(x.dataset.i === undefined) return; const p = sh.parts[+x.dataset.i];
      p[x.dataset.k] = x.dataset.k === 'n' ? Math.max(0, Math.min(200, parseInt(x.value) || 0)) : x.value; $('#asTot', b).textContent = `${total(sh)} item(s)`; };
    $('#asParts', b).onchange = $('#asParts', b).oninput;
    $('#asAdd', b).onclick = () => { sh.parts.push({n: 10, fmt: 'line', label: ''}); draw(); };
    if($('#asFrom', b)) $('#asFrom', b).onchange = e => { const a = asms.find(x => x.id === e.target.value); if(!a) return; M.closeModal(); M.asheetFromAsm(a); };
    $('#asX', b).onclick = M.closeModal;
    const save = () => { sh.title = $('#asT', b).value.trim(); if(!sh.title){ M.toast('Type the name of the assessment'); return null; }
      if(!total(sh)){ M.toast('Add at least one item'); return null; }
      const L = store(); if(sh.id){ const i = L.findIndex(x => x.id === sh.id); if(i >= 0) L[i] = sh; else L.push(sh); } else { sh.id = M.uid('as'); sh.created = new Date().toISOString(); L.push(sh); }
      sh.edited = new Date().toISOString(); M.save(); return sh; };
    $('#asSave', b).onclick = () => { if(!save()) return; M.closeModal(); M.route(); M.toast('Answer sheet saved'); };
    $('#asPrint', b).onclick = () => { const s = save(); if(!s) return; M.closeModal(); M.route(); printDialog(s); };
  }, true);
}

/* ---------------- print dialog ---------------- */
const pui = {src: '', mode: 'class', per: 1, blanks: 0, skipOut: true, copies: 10};
async function printDialog(sh){
  const SRC = sources(); if(!SRC.find(s => s.id === pui.src)) pui.src = (SRC[0] || {}).id || '';
  const fits = {}; [1, 2, 4].forEach(n => fits[n] = layout(sh, n));
  if(!fits[pui.per].ok) pui.per = 1;
  let roster = []; const picked = new Set();
  M.modal('Print answer sheets', `
    <div class="small muted" style="margin-top:0"><b>${esc(sh.title)}</b> · ${total(sh)} items · 8.5 × 13 in (long bond), 0.3 in margins</div>
    <div class="seg" id="apMode" style="margin-top:12px">${[['class','Whole class'],['some','Selected learners'],['blank','Blank copies']].map(([k, l]) => `<button data-m="${k}" class="${k === pui.mode ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="apSrcBox" style="margin-top:12px"><label class="field">Class (from Classes)<select class="input" id="apSrc">${SRC.map(s => `<option value="${s.id}" ${s.id === pui.src ? 'selected' : ''}>${esc(s.label)}</option>`).join('') || '<option value="">No classes yet</option>'}</select></label></div>
    <div id="apBody" style="margin-top:10px"></div>
    <div class="field" style="margin-top:12px">Answer sheets on each page
      <div class="row" style="margin-top:6px;gap:8px">${[1, 2, 4].map(n => `<button class="btn sm ${pui.per === n ? 'primary' : ''}" data-per="${n}" ${fits[n].ok ? '' : 'disabled title="Too many items to fit this many on one page"'}>${n} per page${n > 1 ? ` · ${fits[n].ok ? Math.round(fits[n].k * 100) + '%' : 'too long'}` : fits[1].k < 1 ? ` · ${Math.round(fits[1].k * 100)}%` : ''}</button>`).join('')}</div></div>
    <div class="small muted" id="apInfo" style="margin-top:10px"></div>
    <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" id="apX">Cancel</button><button class="btn primary" id="apGo">${ico('print')} Print</button></div>`, async b => {
    const src = () => SRC.find(s => s.id === $('#apSrc', b).value);
    const people = () => { const s = src(); const sec = s ? s.section : '';
      if(pui.mode === 'blank') return Array.from({length: Math.max(1, Math.min(200, pui.copies))}, () => ({name: '', section: ''}));
      const L = pui.mode === 'some' ? roster.filter(x => picked.has(x.name)) : roster.filter(x => !(pui.skipOut && (x.out || isOut(x))));
      return [...L.map(x => ({name: x.name, section: sec})), ...Array.from({length: pui.blanks}, () => ({name: '', section: sec}))]; };
    const info = () => { const n = people().length; $('#apInfo', b).innerHTML = `<b>${n}</b> answer sheet(s) on <b>${Math.ceil(n / pui.per) || 0}</b> page(s)${pui.per > 1 ? ` — cut along the dashed lines` : ''}. Print at 100% / actual size on 8.5 × 13 paper.`; };
    const body = () => { $('#apSrcBox', b).style.display = pui.mode === 'blank' ? 'none' : '';
      if(pui.mode === 'blank'){ $('#apBody', b).innerHTML = `<label class="field">Number of blank copies<input class="input" id="apCp" inputmode="numeric" value="${pui.copies}" style="max-width:120px"></label>`;
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
    $$('[data-per]', b).forEach(x => x.onclick = () => { pui.per = +x.dataset.per; $$('[data-per]', b).forEach(y => y.classList.toggle('primary', y === x)); info(); });
    $('#apX', b).onclick = M.closeModal;
    $('#apGo', b).onclick = () => { const P = people(); if(!P.length) return M.toast(pui.mode === 'some' ? 'Tick at least one learner' : 'No learners to print');
      M.closeModal(); M.doPrint(pagesHtml(sh, P, pui.per), M.pageCss(PAPER), {noFit: true}); };
    await load();
  }, true);
}
M.asheetPrint = printDialog;

/* ---------------- section on the Assessments page ---------------- */
M.asheetSection = function(box){
  const L = [...store()].sort((a, b) => (b.edited || b.created || '').localeCompare(a.edited || a.created || ''));
  box.innerHTML = `<div class="card" style="margin-top:20px"><div class="row"><div class="grow"><h2 style="margin:0">${ico('assess','width:20px;height:20px;vertical-align:-3px')} Answer sheets ${M.newTag('asheet')}</h2>
      <div class="small muted" style="margin-top:4px">Make an answer sheet for any test or quiz, then print one per learner for a whole class, only the learners you pick (lost papers), or blank copies — 8.5 × 13 in, 0.3 in margins.</div></div>
      <button class="btn primary" id="asNew">${ico('plus')} New answer sheet</button></div>
    ${L.length ? `<div class="list" style="margin-top:12px">${L.map(s => `<div class="item"><div class="grow"><div class="title"><b>${esc(s.title)}</b></div><div class="tiny muted">${total(s)} items · ${s.parts.filter(p => +p.n > 0).map(p => `${p.n} ${FMTS[p.fmt] ? FMTS[p.fmt].label : p.fmt}`).join(' + ')}</div></div>
      <button class="btn sm primary" data-asp="${s.id}">${ico('print')} Print</button><button class="btn sm" data-ase="${s.id}">${ico('edit')} Edit</button><button class="icon-btn" data-asd="${s.id}" title="Delete">✕</button></div>`).join('')}</div>` : ''}</div>`;
  const get = (id) => store().find(x => x.id === id);
  $('#asNew', box).onclick = () => editor();
  $$('[data-asp]', box).forEach(x => x.onclick = () => printDialog(get(x.dataset.asp)));
  $$('[data-ase]', box).forEach(x => x.onclick = () => editor(get(x.dataset.ase)));
  $$('[data-asd]', box).forEach(x => x.onclick = () => { const s = get(x.dataset.asd); if(!s || !confirm(`Delete the answer sheet “${s.title}”?`)) return; M.S.asheets = store().filter(y => y !== s); M.save(); M.asheetSection(box); });
};
})();
