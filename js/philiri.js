/* MASTRO — Phil-IRI Reading Monitoring (v6.14) · Reading → Phil-IRI
   Philippine Informal Reading Inventory (DepEd Order No. 14, s. 2018 · Revised Phil-IRI Manual 2018).
   Pre-test and Post-test, English and Filipino:
   1 · Group Screening Test (GST): 20 items, a raw score below 14 means the learner takes the graded passage.
   2 · Graded passage (oral reading): miscues → word reading %, comprehension items → comprehension %, time → words per minute.
       Word reading: Independent 97–100 · Instructional 90–96 · Frustration 89 and below.
       Comprehension: Independent 80–100 · Instructional 59–79 · Frustration 58 and below.
       Reading profile = the lower of the two (any Frustration → Frustration). Non-readers are marked by the teacher.
   3 · Groupings by reading profile   4 · Reports (Class Reading Profile, list per profile, pre- vs post-test). */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;

const LANGS = [['ENGLISH','English'],['FILIPINO','Filipino']];
const PERS = [['pre','Pre-test'],['post','Post-test']];
const PROF = [['IND','Independent','green'],['INS','Instructional','gold'],['FRU','Frustration','red'],['NR','Non-reader','red']];
const PN = Object.fromEntries(PROF.map(p => [p[0], p[1]]));
const GST_MAX = 20, GST_CUT = 14;

/* c.philiri = {lang, per, langs:{ENGLISH:{pre:{date, by, gstMax, L:{lid:{gst, gl, words, mis, secs, items, ok, nr}}}, post:{…}}, FILIPINO:{…}}} */
const root = (c) => { const r = c.philiri = c.philiri || {}; r.lang = r.lang || 'ENGLISH'; r.per = r.per || 'pre'; r.langs = r.langs || {}; return r; };
const data = (c, lang, per) => { const r = root(c); const L = r.langs[lang || r.lang] = r.langs[lang || r.lang] || {}; const d = L[per || r.per] = L[per || r.per] || {};
  d.L = d.L || {}; d.gstMax = d.gstMax || GST_MAX; if(d.by == null) d.by = c.adviser || ''; return d; };
const learners = (c) => M.sortedLearners(c).filter(M.counted);
const bySex = (L) => [['M','MALE', L.filter(l => l.sex === 'M')], ['F','FEMALE', L.filter(l => l.sex !== 'M')]];
const ui = () => (M.piriUI = M.piriUI || {tab:'gst'});
const num = (v) => v === '' || v == null || isNaN(+v) ? null : +v;

// scoring (Phil-IRI 2018)
const wrLevel = (p) => p == null ? '' : p >= 97 ? 'IND' : p >= 90 ? 'INS' : 'FRU';
const cmLevel = (p) => p == null ? '' : p >= 80 ? 'IND' : p >= 59 ? 'INS' : 'FRU';
function calc(r, d){
  r = r || {}; const gst = num(r.gst); const out = {gst, below: gst != null && gst < GST_CUT * (d.gstMax / GST_MAX), wr: null, cm: null, wpm: null, wrL: '', cmL: '', prof: ''};
  if(r.nr){ out.prof = 'NR'; return out; }
  const words = num(r.words), mis = num(r.mis), secs = num(r.secs), items = num(r.items), ok = num(r.ok);
  if(words && mis != null) out.wr = Math.max(0, Math.round((words - mis) / words * 100));
  if(items && ok != null) out.cm = Math.round(Math.min(ok, items) / items * 100);
  if(words && secs) out.wpm = Math.round(words / secs * 60);
  out.wrL = wrLevel(out.wr); out.cmL = cmLevel(out.cm);
  if(out.wrL && out.cmL) out.prof = out.wrL === 'FRU' || out.cmL === 'FRU' ? 'FRU' : out.wrL === 'IND' && out.cmL === 'IND' ? 'IND' : 'INS';
  else if(gst != null && !out.below) out.prof = 'GL';     // passed the GST: reading at grade level, no oral test needed
  return out;
}
const profLabel = (p) => p === 'GL' ? 'Passed GST' : PN[p] || '';
const chip = (p) => p ? `<span class="pr-chip p-${p}">${esc(profLabel(p))}</span>` : '<span class="muted tiny">—</span>';

M.views.readingPhiliri = function view(el, args){
  const c = M.cls(); const r = root(c); const d = data(c); const u = ui();
  const L = learners(c);
  if(!L.length){ el.innerHTML = `<div class="card"><div class="empty">Add your learners first (Learners → upload SF1). Phil-IRI uses your class roster.</div></div>`; return; }
  const C = L.map(l => calc(d.L[l.id], d));
  const cnt = (k) => C.filter(x => x.prof === k).length;
  const gstDone = C.filter(x => x.gst != null).length, below = C.filter(x => x.below).length;
  el.innerHTML = `
  <div class="card bul-hero piri-hero"><div class="row" style="align-items:center;gap:16px;flex-wrap:wrap">
    <div class="piri-logo">Phil<b>IRI</b></div>
    <div class="grow" style="min-width:240px"><div class="eyebrow-s">Philippine Informal Reading Inventory</div><h2 style="margin:2px 0 4px">Reading profile · ${esc(M.className(c))}</h2>
      <div class="small muted">Group Screening Test → graded passage for learners below the cut-off → Independent · Instructional · Frustration reading profile.</div></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div class="seg" id="pLang">${LANGS.map(([k, t]) => `<button data-l="${k}" class="${k === r.lang ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="seg" id="pPer">${PERS.map(([k, t]) => `<button data-p="${k}" class="${k === r.per ? 'on' : ''}">${t}</button>`).join('')}</div></div></div>
    <div class="piri-dist" style="margin-top:14px">${[['GL','Passed GST','green'], ...PROF].map(([k, t]) => `<div class="pd p-${k}"><b>${cnt(k)}</b><span>${t}</span></div>`).join('')}</div>
    <div class="chips" style="margin-top:10px"><span class="chip green">${esc(LANGS.find(x => x[0] === r.lang)[1])} · ${esc(PERS.find(x => x[0] === r.per)[1])}</span><span class="chip">${L.length} learners</span>
      <span class="chip ${gstDone < L.length ? 'gold' : 'green'}">GST ${gstDone}/${L.length}</span>${below ? `<span class="chip gold">${below} below the cut-off → graded passage</span>` : ''}</div>
  </div>
  <div class="row" style="margin:18px 0 14px"><div class="seg" id="pTabs">${[['gst','1 · Group Screening Test'],['oral','2 · Graded passage'],['grp','3 · Groupings'],['rep','4 · Reports']].map(([k, t]) => `<button data-t="${k}" class="${u.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div id="pBody"></div>`;
  $$('#pLang button').forEach(b => b.onclick = () => { r.lang = b.dataset.l; M.save(); view(el, []); });
  $$('#pPer button').forEach(b => b.onclick = () => { r.per = b.dataset.p; M.save(); view(el, []); });
  $$('#pTabs button').forEach(b => b.onclick = () => { u.tab = b.dataset.t; view(el, []); });
  const rr = () => view(el, []);
  ({gst: gstTab, oral: oralTab, grp: grpTab, rep: repTab})[u.tab]($('#pBody'), c, d, L, rr);
};

/* ---------- 1 · GST ---------- */
function gstTab(el, c, d, L, rr){
  const cut = Math.round(GST_CUT * d.gstMax / GST_MAX);
  el.innerHTML = `<div class="card">
    <div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end"><div class="grow"><h2 style="margin:0">Group Screening Test</h2>
      <div class="small muted" style="margin-top:4px">Type each learner's raw score. A score below <b>${cut}</b> of ${d.gstMax} means the learner takes the individual graded passage (tab 2).</div></div>
      <label class="field mini">Date given<input class="input" type="date" id="pDate" value="${esc(d.date || '')}"></label>
      <label class="field mini">Items<input class="input" id="pMax" inputmode="numeric" value="${d.gstMax}" style="width:70px"></label>
      <label class="field mini">Administered by<input class="input" id="pBy" value="${esc(d.by || '')}"></label></div>
    <div class="table-wrap" style="margin-top:14px"><table class="piri-t"><thead><tr><th>#</th><th class="sticky-col">Learner</th><th class="num">GST score</th><th>Result</th><th>Reading profile</th></tr></thead><tbody>
    ${bySex(L).map(([sx, lab, arr]) => arr.length ? `<tr class="sexrow"><td colspan="5">${lab}</td></tr>` + arr.map((l, i) => { const x = calc(d.L[l.id], d);
      return `<tr><td class="muted">${i + 1}</td><td class="sticky-col"><b>${esc(l.name)}</b></td><td class="num"><input class="input gcell" data-lid="${l.id}" inputmode="numeric" value="${x.gst ?? ''}"></td>
        <td class="pr-res" data-res="${l.id}">${x.gst == null ? '' : x.below ? '<span class="low">Below cut-off · take the graded passage</span>' : '<span style="color:var(--green)">Passed</span>'}</td><td data-pf="${l.id}">${chip(x.prof)}</td></tr>`; }).join('') : '').join('')}
    </tbody></table></div></div>`;
  $('#pDate', el).onchange = e => { d.date = e.target.value; M.save(); };
  $('#pBy', el).onchange = e => { d.by = e.target.value; M.save(); };
  $('#pMax', el).onchange = e => { d.gstMax = Math.max(1, parseInt(e.target.value) || GST_MAX); M.save(); rr(); };
  $$('.gcell', el).forEach(i => { i.oninput = () => { const v = i.value.trim(); const rec = d.L[i.dataset.lid] = d.L[i.dataset.lid] || {};
      if(v === '') delete rec.gst; else { const n = Math.max(0, Math.min(d.gstMax, parseInt(v) || 0)); rec.gst = n; } M.save();
      const x = calc(rec, d); $(`[data-res="${i.dataset.lid}"]`, el).innerHTML = x.gst == null ? '' : x.below ? '<span class="low">Below cut-off · take the graded passage</span>' : '<span style="color:var(--green)">Passed</span>'; $(`[data-pf="${i.dataset.lid}"]`, el).innerHTML = chip(x.prof); };
    i.onkeydown = e => { if(e.key === 'Enter'){ const all = $$('.gcell', el); const n = all[all.indexOf(i) + 1]; if(n) n.focus(); } }; });
}

/* ---------- 2 · graded passage (oral reading) ---------- */
function oralTab(el, c, d, L, rr){
  const u = ui(); const showAll = !!u.oralAll;
  const list = L.filter(l => { const x = calc(d.L[l.id], d); return showAll || x.below || (d.L[l.id] || {}).words || (d.L[l.id] || {}).nr; });
  const cell = (l, k, ph, w) => `<input class="input ocell" data-lid="${l.id}" data-k="${k}" inputmode="numeric" placeholder="${ph}" value="${esc((d.L[l.id] || {})[k] ?? '')}" style="width:${w || 64}px">`;
  el.innerHTML = `<div class="card">
    <div class="row" style="gap:12px;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">Graded passage · oral reading</h2>
      <div class="small muted" style="margin-top:4px">For each learner: the passage's grade level, number of words, miscues and reading time, then the comprehension questions. MASTRO computes the percentages, words per minute and the reading profile.</div></div>
      <label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" id="pAll" ${showAll ? 'checked' : ''}> Show all learners (not only those below the GST cut-off)</label></div>
    <div class="tiny muted" style="margin-top:8px">Word reading: Independent 97–100% · Instructional 90–96% · Frustration 89% and below &nbsp;|&nbsp; Comprehension: Independent 80–100% · Instructional 59–79% · Frustration 58% and below</div>
    ${list.length ? `<div class="table-wrap" style="margin-top:12px"><table class="piri-t"><thead><tr><th class="sticky-col">Learner</th><th>Passage<br>grade</th><th>Words</th><th>Miscues</th><th>Time<br>(sec)</th><th>Word<br>reading</th><th>WPM</th><th>Questions</th><th>Correct</th><th>Compre-<br>hension</th><th>Non-<br>reader</th><th>Profile</th></tr></thead><tbody>
      ${list.map(l => { const x = calc(d.L[l.id], d); const rec = d.L[l.id] || {};
        return `<tr data-row="${l.id}"><td class="sticky-col"><b>${esc(l.name)}</b>${x.gst != null ? `<div class="tiny muted">GST ${x.gst}/${d.gstMax}</div>` : ''}</td>
          <td>${cell(l, 'gl', 'Gr', 50)}</td><td>${cell(l, 'words', 'no.')}</td><td>${cell(l, 'mis', 'no.')}</td><td>${cell(l, 'secs', 'sec')}</td>
          <td class="num" data-o="wr">${x.wr != null ? `${x.wr}%<div class="tiny">${esc(PN[x.wrL] || '')}</div>` : ''}</td><td class="num" data-o="wpm">${x.wpm ?? ''}</td>
          <td>${cell(l, 'items', 'no.', 56)}</td><td>${cell(l, 'ok', 'no.', 56)}</td>
          <td class="num" data-o="cm">${x.cm != null ? `${x.cm}%<div class="tiny">${esc(PN[x.cmL] || '')}</div>` : ''}</td>
          <td style="text-align:center"><input type="checkbox" class="onr" data-lid="${l.id}" ${rec.nr ? 'checked' : ''}></td><td data-o="pf">${chip(x.prof)}</td></tr>`; }).join('')}
    </tbody></table></div>` : `<div class="empty" style="margin-top:12px">${Object.keys(d.L).length ? 'No learner is below the GST cut-off. 🎉' : 'Enter the GST scores first (tab 1) — learners below the cut-off appear here.'}</div>`}</div>`;
  $('#pAll', el).onchange = e => { u.oralAll = e.target.checked; rr(); };
  const upd = (lid) => { const tr = $(`[data-row="${lid}"]`, el); const x = calc(d.L[lid], d);
    $('[data-o="wr"]', tr).innerHTML = x.wr != null ? `${x.wr}%<div class="tiny">${esc(PN[x.wrL] || '')}</div>` : ''; $('[data-o="wpm"]', tr).textContent = x.wpm ?? '';
    $('[data-o="cm"]', tr).innerHTML = x.cm != null ? `${x.cm}%<div class="tiny">${esc(PN[x.cmL] || '')}</div>` : ''; $('[data-o="pf"]', tr).innerHTML = chip(x.prof); };
  $$('.ocell', el).forEach(i => i.oninput = () => { const rec = d.L[i.dataset.lid] = d.L[i.dataset.lid] || {}; const v = i.value.trim();
    if(v === '') delete rec[i.dataset.k]; else rec[i.dataset.k] = i.dataset.k === 'gl' ? v : Math.max(0, parseFloat(v) || 0); M.save(); upd(i.dataset.lid); });
  $$('.onr', el).forEach(i => i.onchange = () => { const rec = d.L[i.dataset.lid] = d.L[i.dataset.lid] || {}; if(i.checked) rec.nr = true; else delete rec.nr; M.save(); upd(i.dataset.lid); });
}

/* ---------- 3 · groupings ---------- */
const GROUPS = [['FRU','Frustration','Intensive reading intervention'], ['NR','Non-reader','Beginning reading / decoding intervention'], ['INS','Instructional','Guided reading with teacher support'], ['IND','Independent','Enrichment and independent reading'], ['GL','Passed GST','Reading at grade level']];
function grpTab(el, c, d, L){
  const G = GROUPS.map(([k, t, note]) => ({k, t, note, arr: L.filter(l => calc(d.L[l.id], d).prof === k)}));
  const none = L.filter(l => !calc(d.L[l.id], d).prof);
  el.innerHTML = `<div class="card"><h2 style="margin:0">Groupings by reading profile</h2>
    <p class="small muted" style="margin:6px 0 12px">Learners are grouped by their ${esc(PERS.find(x => x[0] === root(c).per)[1].toLowerCase())} reading profile.</p>
    <div class="grid g-3" style="gap:14px">${G.map(g => `<div class="card piri-grp p-${g.k}" style="padding:14px"><div class="row"><b>${g.t}</b><span class="spacer"></span><span class="chip">${g.arr.length}</span></div>
      <div class="tiny muted" style="margin:2px 0 8px">${g.note}</div>${g.arr.map(l => `<div class="small">${esc(l.name)}</div>`).join('') || '<div class="tiny muted">—</div>'}</div>`).join('')}</div>
    ${none.length ? `<div class="tiny muted" style="margin-top:12px">Not assessed yet: ${none.map(l => esc(l.name)).join(', ')}</div>` : ''}</div>`;
}

/* ---------- 4 · reports ---------- */
function repTab(el, c, d, L){
  const r = root(c); const lang = LANGS.find(x => x[0] === r.lang)[1]; const per = PERS.find(x => x[0] === r.per)[1];
  el.innerHTML = `<div class="card"><h2 style="margin:0 0 4px">Phil-IRI reports · ${esc(lang)} · ${esc(per)}</h2><p class="small muted" style="margin:0 0 14px">A4, ready to print or save as PDF.</p>
    <div class="grid g-3" style="gap:14px">
      <button class="card form-card rp-btn" data-r="crp"><b>Class Reading Profile</b><span class="small muted">Every learner: GST, word reading, comprehension, words per minute and profile, with the summary by sex.</span></button>
      <button class="card form-card rp-btn" data-r="sum"><b>Summary per profile</b><span class="small muted">Number of male, female and total learners per reading profile, with the list of names.</span></button>
      <button class="card form-card rp-btn" data-r="cmp"><b>Pre-test vs Post-test</b><span class="small muted">Each learner's profile before and after, with the change in each group.</span></button></div></div>`;
  $$('[data-r]', el).forEach(b => b.onclick = () => { const k = b.dataset.r;
    if(k === 'crp') M.rdPreview('Class Reading Profile', [crpPage(c, d, L)], true);
    if(k === 'sum') M.rdPreview('Summary per profile', [sumPage(c, d, L)], false);
    if(k === 'cmp') M.rdPreview('Pre-test vs Post-test', [cmpPage(c, L)], false); });
}
const head = (c, title) => { const r = root(c); const d = data(c);
  return `${M.printHeader(title)}<table class="rd-info"><tr><td>School:</td><td><b>${esc(M.S.settings.school || '')}</b></td><td>Grade &amp; Section:</td><td><b>${esc(M.className(c))}</b></td></tr>
    <tr><td>Language:</td><td><b>${esc(LANGS.find(x => x[0] === r.lang)[1])}</b></td><td>Test:</td><td><b>${esc(PERS.find(x => x[0] === r.per)[1])}</b>${d.date ? ` · ${esc(M.parse(d.date).toLocaleDateString(undefined, {month:'long', day:'numeric', year:'numeric'}))}` : ''}</td></tr>
    <tr><td>School Year:</td><td><b>${esc(c.sy || '')}</b></td><td>Administered by:</td><td><b>${esc(d.by || c.adviser || '')}</b></td></tr></table>`; };
const sign = (c) => M.printSign(c, 'Prepared by:', 'Noted by:');
function crpPage(c, d, L){
  let n = 0;
  const rows = bySex(L).map(([sx, lab, arr]) => arr.length ? `<tr><td colspan="12" class="l sx">${lab}</td></tr>` + arr.map(l => { const x = calc(d.L[l.id], d), rec = d.L[l.id] || {};
    return `<tr><td>${++n}</td><td class="l">${esc(l.name)}</td><td>${x.gst ?? ''}</td><td>${esc(rec.gl || '')}</td><td>${rec.words ?? ''}</td><td>${rec.mis ?? ''}</td><td>${x.wr != null ? x.wr + '%' : ''}</td><td>${esc(PN[x.wrL] || '')}</td><td>${x.cm != null ? x.cm + '%' : ''}</td><td>${esc(PN[x.cmL] || '')}</td><td>${x.wpm ?? ''}</td><td><b>${esc(profLabel(x.prof))}</b></td></tr>`; }).join('') : '').join('');
  return `<div class="rdp">${head(c, 'PHIL-IRI CLASS READING PROFILE')}
    <table class="rd-t"><thead><tr><th>No.</th><th class="l">Name of Learner</th><th>GST<br>(${d.gstMax})</th><th>Passage<br>grade</th><th>Words</th><th>Miscues</th><th>Word<br>reading</th><th>Level</th><th>Compre-<br>hension</th><th>Level</th><th>WPM</th><th>Reading profile</th></tr></thead><tbody>${rows}</tbody></table>
    ${sumTable(d, L)}${sign(c)}</div>`;
}
function sumTable(d, L){
  const keys = [['GL','Passed GST'], ...PROF.map(p => [p[0], p[1]]), ['', 'Not yet assessed']];
  return `<table class="rd-t" style="margin-top:8px;width:70%"><thead><tr><th class="l">Reading profile</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>
    ${keys.map(([k, t]) => { const f = (arr) => arr.filter(l => calc(d.L[l.id], d).prof === k).length; const [m, fe] = bySex(L).map(x => f(x[2]));
      return `<tr><td class="l">${t}</td><td>${m}</td><td>${fe}</td><td><b>${m + fe}</b></td></tr>`; }).join('')}
    <tr><td class="l"><b>Total</b></td>${bySex(L).map(x => `<td><b>${x[2].length}</b></td>`).join('')}<td><b>${L.length}</b></td></tr></tbody></table>`;
}
function sumPage(c, d, L){
  return `<div class="rdp">${head(c, 'PHIL-IRI SUMMARY PER READING PROFILE')}${sumTable(d, L)}
    ${GROUPS.map(([k, t]) => { const arr = L.filter(l => calc(d.L[l.id], d).prof === k); return arr.length ? `<div class="rd-sec">${t} (${arr.length})</div><div class="small">${arr.map((l, i) => `${i + 1}. ${esc(l.name)}`).join(' &nbsp; ')}</div>` : ''; }).join('')}
    ${sign(c)}</div>`;
}
function cmpPage(c, L){
  const r = root(c); const pre = data(c, r.lang, 'pre'), post = data(c, r.lang, 'post'); let n = 0;
  const rows = bySex(L).map(([sx, lab, arr]) => arr.length ? `<tr><td colspan="4" class="l sx">${lab}</td></tr>` + arr.map(l => { const a = calc(pre.L[l.id], pre).prof, b = calc(post.L[l.id], post).prof;
    return `<tr><td>${++n}</td><td class="l">${esc(l.name)}</td><td>${esc(profLabel(a))}</td><td><b>${esc(profLabel(b))}</b></td></tr>`; }).join('') : '').join('');
  const keys = [['GL','Passed GST'], ...PROF.map(p => [p[0], p[1]])];
  return `<div class="rdp">${M.printHeader('PHIL-IRI PRE-TEST AND POST-TEST RESULTS')}<table class="rd-info"><tr><td>School:</td><td><b>${esc(M.S.settings.school || '')}</b></td><td>Grade &amp; Section:</td><td><b>${esc(M.className(c))}</b></td></tr><tr><td>Language:</td><td><b>${esc(LANGS.find(x => x[0] === r.lang)[1])}</b></td><td>School Year:</td><td><b>${esc(c.sy || '')}</b></td></tr></table>
    <table class="rd-t" style="width:70%"><thead><tr><th class="l">Reading profile</th><th>Pre-test</th><th>Post-test</th><th>Change</th></tr></thead><tbody>
      ${keys.map(([k, t]) => { const a = L.filter(l => calc(pre.L[l.id], pre).prof === k).length, b = L.filter(l => calc(post.L[l.id], post).prof === k).length; return `<tr><td class="l">${t}</td><td>${a}</td><td>${b}</td><td>${b - a > 0 ? '+' : ''}${b - a}</td></tr>`; }).join('')}</tbody></table>
    <table class="rd-t" style="margin-top:8px"><thead><tr><th>No.</th><th class="l">Name of Learner</th><th>Pre-test profile</th><th>Post-test profile</th></tr></thead><tbody>${rows}</tbody></table>${sign(c)}</div>`;
}

/* ---------- Reading tab: BULIG | Phil-IRI ---------- */
M.views.reading = function(el, args){
  const u = M.S.ui; u.readMode = u.readMode || 'bulig';
  el.innerHTML = `<div class="row" style="margin-bottom:16px"><div class="seg rd-mode" id="rdMode"><button data-m="bulig" class="${u.readMode === 'bulig' ? 'on' : ''}">BULIG</button><button data-m="philiri" class="${u.readMode === 'philiri' ? 'on' : ''}">Phil-IRI</button></div></div><div id="rdHost"></div>`;
  $$('#rdMode button', el).forEach(b => b.onclick = () => { u.readMode = b.dataset.m; M.save(); M.views.reading(el, []); });
  (u.readMode === 'philiri' ? M.views.readingPhiliri : M.views.readingBulig)($('#rdHost', el), args || []);
};
})();
