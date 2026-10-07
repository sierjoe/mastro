/* MASTRO — tests from the ECR (Summative Test 1, Summative Test 2, Term Examination),
   Budget of Work (BOW) per grade, and the Table of Specifications (TOS) built from an uploaded test paper. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum} = M;
const str = (v) => String(v ?? '').replace(/\s+/g,' ').trim();

/* =====================================================================
   1) TEXT FROM FILES (Word, PDF, Excel, CSV, text)
   ===================================================================== */
const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
M.extractText = async function(file){
  const name = file.name.toLowerCase();
  if(/\.docx$/.test(name)){
    await M.loadScript('vendor/jszip.min.js');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const body = doc.getElementsByTagNameNS(WNS,'body')[0];
    const counters = {}; const paras = [], tables = [];
    // list formats (decimal 1. / letter a. / roman I.) from numbering.xml
    const numFmt = {};
    if(zip.file('word/numbering.xml')){ const nd = new DOMParser().parseFromString(await zip.file('word/numbering.xml').async('string'), 'application/xml'); const abs = {};
      [...nd.getElementsByTagNameNS(WNS,'abstractNum')].forEach(an => { const lv = {}; [...an.getElementsByTagNameNS(WNS,'lvl')].forEach(l => { lv[l.getAttributeNS(WNS,'ilvl')] = l.getElementsByTagNameNS(WNS,'numFmt')[0]?.getAttributeNS(WNS,'val') || 'decimal'; }); abs[an.getAttributeNS(WNS,'abstractNumId')] = lv; });
      [...nd.getElementsByTagNameNS(WNS,'num')].forEach(n => { const a = n.getElementsByTagNameNS(WNS,'abstractNumId')[0]; if(a) numFmt[n.getAttributeNS(WNS,'numId')] = abs[a.getAttributeNS(WNS,'val')] || {}; }); }
    // numbering that comes from a paragraph style (e.g. "List Number")
    const styleNum = {};
    if(zip.file('word/styles.xml')){ const sd = new DOMParser().parseFromString(await zip.file('word/styles.xml').async('string'), 'application/xml'); const raw = {};
      [...sd.getElementsByTagNameNS(WNS,'style')].forEach(st => { const id = st.getAttributeNS(WNS,'styleId') || st.getAttribute('w:styleId'); const np = st.getElementsByTagNameNS(WNS,'numPr')[0]; const based = st.getElementsByTagNameNS(WNS,'basedOn')[0];
        raw[id] = {np: np ? {id: np.getElementsByTagNameNS(WNS,'numId')[0]?.getAttributeNS(WNS,'val'), lv: +(np.getElementsByTagNameNS(WNS,'ilvl')[0]?.getAttributeNS(WNS,'val') || 0)} : null, based: based ? based.getAttributeNS(WNS,'val') : null}; });
      Object.keys(raw).forEach(id => { let x = raw[id], g = 0; while(x && !x.np && x.based && g++ < 8) x = raw[x.based]; if(x && x.np && x.np.id) styleNum[id] = x.np; }); }
    const pText = (p) => { let s = ''; p.querySelectorAll('*').forEach(n => { if(n.namespaceURI !== WNS) return; if(n.localName === 't') s += n.textContent; else if(n.localName === 'tab') s += '\t'; else if(n.localName === 'br' || n.localName === 'cr') s += '\n'; }); return s; };
    // Word's automatic numbering is not in the text: rebuild "1." / "a." prefixes
    const numPrefix = (p) => { const pPr = [...p.childNodes].find(n => n.localName === 'pPr'); if(!pPr) return '';
      const np = pPr.getElementsByTagNameNS(WNS,'numPr')[0]; const ps = pPr.getElementsByTagNameNS(WNS,'pStyle')[0];
      const sn = ps ? styleNum[ps.getAttributeNS(WNS,'val')] : null;
      if(!np && !sn) return '';
      const id = (np && np.getElementsByTagNameNS(WNS,'numId')[0]?.getAttributeNS(WNS,'val')) || (sn && sn.id) || '0'; if(id === '0') return '';
      const lv = np && np.getElementsByTagNameNS(WNS,'ilvl')[0] ? +np.getElementsByTagNameNS(WNS,'ilvl')[0].getAttributeNS(WNS,'val') : (sn ? sn.lv : 0);
      const k = id + ':' + lv; counters[k] = (counters[k]||0) + 1; Object.keys(counters).forEach(x => { const [i2, l2] = x.split(':'); if(i2 === id && +l2 > lv) counters[x] = 0; });
      const fmtv = (numFmt[id] || {})[lv] || (lv === 0 ? 'decimal' : 'lowerLetter'); const nth = counters[k];
      if(/letter/i.test(fmtv)) return (/upper/i.test(fmtv) ? String.fromCharCode(64 + ((nth-1) % 26) + 1) : String.fromCharCode(96 + ((nth-1) % 26) + 1)) + '. ';
      if(/roman/i.test(fmtv)) return 'Part ' + ['I','II','III','IV','V','VI','VII','VIII','IX','X'][(nth-1) % 10] + ' ';
      if(/bullet|none/i.test(fmtv)) return '';
      return nth + '. '; };
    [...body.childNodes].forEach(n => {
      if(n.localName === 'p'){ const t = numPrefix(n) + pText(n); t.split('\n').forEach(x => paras.push(x)); }
      else if(n.localName === 'tbl'){ const rows = [...n.getElementsByTagNameNS(WNS,'tr')].map(tr => [...tr.childNodes].filter(c => c.localName === 'tc').map(tc => [...tc.getElementsByTagNameNS(WNS,'p')].map(p => numPrefix(p) + pText(p)).join('\n').trim()));
        tables.push(rows); rows.forEach(r => paras.push(r.join('\t'))); }
    });
    return {paras, tables};
  }
  if(/\.pdf$/.test(name)){
    await M.loadScript('vendor/pdf.min.js');
    const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const pdf = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
    const paras = [];
    for(let i=1;i<=pdf.numPages;i++){ const pg = await pdf.getPage(i); const tc = await pg.getTextContent();
      const lines = []; tc.items.forEach(it => { if(!it.str) return; const y = Math.round(it.transform[5]), x = it.transform[4]; let L = lines.find(l => Math.abs(l.y - y) <= 2); if(!L){ L = {y, parts:[]}; lines.push(L); } L.parts.push({x, s: it.str}); });
      lines.sort((a,b) => b.y - a.y).forEach(L => paras.push(L.parts.sort((a,b)=>a.x-b.x).map(p=>p.s).join(' ').replace(/\s+/g,' '))); }
    return {paras, tables: []};
  }
  if(/\.(xlsx|xls|xlsm|csv)$/.test(name)){
    const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
    const tables = wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:false, defval:''}).map(r => r.map(str)));
    return {paras: tables.flat().map(r => r.join('\t')), tables};
  }
  if(/\.doc$/.test(name)) throw new Error('Old Word files (.doc) cannot be read. In Word: File → Save As → Word Document (.docx), then upload again.');
  const t = await file.text(); return {paras: t.split(/\r?\n/), tables: []};
};

/* =====================================================================
   2) BUDGET OF WORK
   ===================================================================== */
const ROMAN = {I:'1', II:'2', III:'3', IV:'4'};
const termFromText = (t) => { const s = String(t||''); let m = s.match(/\b(first|second|third|fourth|1st|2nd|3rd|4th)\s*(quarter|term|grading|trimester)/i);
  if(m) return {first:'1','1st':'1',second:'2','2nd':'2',third:'3','3rd':'3',fourth:'4','4th':'4'}[m[1].toLowerCase()];
  m = s.match(/\b(?:quarter|term|grading|trimester|q|t)\s*[-:]?\s*([1-4]|i{1,3}v?|iv)\b/i); if(m) return ROMAN[m[1].toUpperCase()] || m[1];
  return null; };
const termFromCode = (code) => { const m = String(code||'').match(/-(IV|I{1,3})[a-j]?(?:-|\b)/) || String(code||'').match(/\bQ([1-4])\b/i); return m ? (ROMAN[m[1]] || m[1]) : null; };
const CODE_RE = /\b[A-Z]{2,4}\d{1,2}[A-Z]{0,6}-(?:IV|I{1,3}|Q[1-4])[a-j\-]*(?:-\d+(?:\.\d+)?)?\b|\b[A-Z]{2,4}\d{1,2}-Q[1-4][\w.\-]*/;
M.parseBOW = function(X){
  const comps = []; let term = null;
  const push = (o) => { if(!o.text || o.text.length < 8) return; o.term = o.term || termFromCode(o.code) || term || '1'; o.id = M.uid('k'); comps.push(o); };
  // tables with a header row naming the competency column
  const tbls = X.tables.filter(t => t.some(r => r.some(c => /competenc|melc|learning\s*objective|content\s*standard/i.test(c))));
  if(tbls.length){
    tbls.forEach(rows => {
      const hr = rows.findIndex(r => r.some(c => /competenc|melc|learning\s*objective/i.test(c))); const H = rows[hr].map(c => c.toLowerCase());
      let cC = H.findIndex(c => /(learning\s*)?competenc|melc|learning\s*objective/.test(c) && !/code/.test(c));
      const cCode = H.findIndex(c => /code/.test(c)); const cDays = H.findIndex(c => /days|duration|sessions|no\.?\s*of\s*(meeting|hour)|time\s*allot|hours/.test(c)); const cTerm = H.findIndex(c => /quarter|term|grading|trimester/.test(c));
      const cWeek = H.findIndex(c => /^week|week\b/.test(c));
      for(let r=hr+1;r<rows.length;r++){ const R = rows[r]; const joined = R.join(' ').trim(); if(!joined) continue;
        const tt = termFromText(joined); const txt = str(R[cC]);
        if(tt && (!txt || txt.length < 25 || /^(first|second|third|fourth|quarter|term)/i.test(txt))){ term = tt; if(!txt || txt.length < 25) continue; }
        const code = str(R[cCode] || (joined.match(CODE_RE)||[])[0] || '');
        const days = cDays >= 0 ? parseFloat(String(R[cDays]).replace(/[^\d.]/g,'')) : NaN;
        push({text: txt.replace(CODE_RE,'').replace(/\s*\(\s*\)\s*/,'').trim(), code, days: isFinite(days) && days > 0 ? days : 1, term: cTerm >= 0 ? (termFromText('term ' + R[cTerm]) || termFromText(R[cTerm])) : null, week: cWeek >= 0 ? str(R[cWeek]) : ''});
      }
    });
  } else {
    // plain lines (PDF / pasted text): headings set the term; a line with a code or a verb is a competency
    X.paras.forEach(line => { const t = str(line); if(!t) return; const tt = termFromText(t);
      if(tt && t.length < 40){ term = tt; return; }
      const code = (t.match(CODE_RE)||[])[0] || ''; const d = t.match(/(\d+(?:\.\d+)?)\s*(days?|sessions?|hrs?|hours?)\b/i);
      const text = t.replace(CODE_RE,'').replace(/(\d+(?:\.\d+)?)\s*(days?|sessions?|hrs?|hours?)\b/i,'').replace(/^[\d.\-•*\s]+/,'').trim();
      if(code || /^(identify|determine|explain|analy[sz]e|use|write|compose|compare|evaluate|infer|distinguish|recogni[sz]e|express|describe|discuss|employ|deliver|formulate|examine|judge|create|produce|apply|classify|make|show|give|cite|extract|summarize|paraphrase|interpret|react|assess|critique)\b/i.test(text))
        push({text, code, days: d ? +d[1] : 1, term: null});
    });
  }
  return comps;
};
const bowFor = (grade, subject) => M.S.bow.find(b => String(b.grade) === String(grade) && (!subject || M.normName(b.subject) === M.normName(subject))) || M.S.bow.find(b => String(b.grade) === String(grade));
M.bowFor = bowFor;

/* =====================================================================
   3) TEST PAPER → ITEMS, matching to competencies, cognitive level
   ===================================================================== */
M.splitItems = function(paras){
  const items = []; let cur = null, part = '';
  paras.forEach(raw => { const t = String(raw).replace(/\t+/g,' ').trim(); if(!t) return;
    const m = t.match(/^(\d{1,3})\s*[.)]\s*(.*)$/) || t.match(/^(\d{1,3})\s+([A-Z_].*)$/);
    if(/^(test|part)\s+[IVX\d]+\b|^(directions?|instructions?)\s*:/i.test(t)){ part = t.slice(0, 80); cur = null; return; }
    if(m && (!cur || +m[1] !== cur.orig || m[2])){ cur = {no: items.length + 1, orig: +m[1], text: m[2] || '', opts: [], part}; items.push(cur); return; }
    if(!cur) return;
    if(/^[a-eA-E]\s*[.)]\s+/.test(t)) cur.opts.push(t.replace(/^[a-eA-E]\s*[.)]\s+/,'')); else if(cur.text.length < 600) cur.text += ' ' + t;
  });
  return items;
};
const STOP = new Set('the a an and or of to in on for with by is are was were be been being this that these those it its as at from into than then which who whom whose what when where why how not no yes can could will would shall should may might must do does did done has have had i you he she we they them their his her our your my me us also any all each other such only own same so too very just about above after again against below between both during few further here more most once over through under until up while there use used using given following correct answer choose letter best statement sentence passage word words text read write below above item items test'.split(' '));
const stem = (w) => w.replace(/(ations?|ities|ity|ments?|ness|ings|ing|edly|ed|es|s|ly)$/,'').replace(/(.)\1$/,'$1').slice(0, 6);
const toks = (s) => String(s||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
function tfidfMatcher(comps){
  const docs = comps.map(c => toks(c.text + ' ' + (c.keywords||'')));
  const df = {}; docs.forEach(d => new Set(d).forEach(w => df[w] = (df[w]||0)+1));
  const N = docs.length || 1; const idf = (w) => Math.log((N + 1) / ((df[w]||0) + 1)) + 1;
  const vec = (tk) => { const v = {}; tk.forEach(w => v[w] = (v[w]||0) + 1); let n = 0; Object.keys(v).forEach(w => { v[w] *= idf(w); n += v[w]*v[w]; }); n = Math.sqrt(n)||1; Object.keys(v).forEach(w => v[w] /= n); return v; };
  const cv = docs.map(vec);
  return (text) => { const q = vec(toks(text)); return cv.map((v, i) => { let s = 0; for(const w in q) if(v[w]) s += q[w]*v[w]; return {i, s}; }).sort((a,b)=>b.s-a.s); };
}
const BLOOM = ['Remembering','Understanding','Applying','Analyzing','Evaluating','Creating'];
const BLOOM_SHORT = ['R','U','Ap','An','E','C'];
const BLOOM_RE = [
  [5, /\b(create|compose|write (a|an|your)|design|construct|formulate|produce|develop|plan|invent|propose)\b/i],
  [4, /\b(evaluate|judge|justify|assess|critique|defend|which is the best|most appropriate|do you agree|recommend|appraise|argue)\b/i],
  [3, /\b(analy[sz]e|compare|contrast|distinguish|differentiate|infer|inference|cause|effect|why do you think|implied|imply|relationship|organi[sz]e|categori[sz]e|examine)\b/i],
  [2, /\b(apply|use the|complete the|fill in|solve|demonstrate|change the|rewrite|transform|combine|correct form|correct order|arrange)\b/i],
  [1, /\b(explain|describe|summari[sz]e|main idea|meaning|paraphrase|interpret|classify|what does .* mean|tone|mood|purpose|theme|best describes?)\b/i],
  [0, /\b(define|identify|list|name|recall|who|when|where|what is|which of the following is|state|label|recogni[sz]e|spell)\b/i]];
M.bloomOf = (text) => { for(const [lv, re] of BLOOM_RE) if(re.test(text)) return lv; return 1; };
const levelGroup = (lv) => lv <= 1 ? 'Easy' : lv <= 3 ? 'Average' : 'Difficult';

/* =====================================================================
   4) VIEWS: tabs on the Item Analysis page
   ===================================================================== */
M.iaTabs = (active) => `<div class="seg" id="iaMain">${[['tests','Tests & answers'],['ecr','ECR scores · ST1 · ST2 · TE'],['bow','Budget of Work']].map(([k,l]) => `<button data-m="${k}" class="${k===active?'on':''}">${l}</button>`).join('')}</div>`;
M.iaTabsBind = (el) => { const s = $('#iaMain', el); if(s) s.onclick = e => { const b = e.target.closest('button'); if(!b) return; location.hash = b.dataset.m === 'tests' ? '#items' : '#items/' + b.dataset.m; }; };

/* ---------- ECR scores per test ---------- */
const TESTS = [['0','Summative Test 1'],['1','Summative Test 2'],['2','Term Examination']];
function ecrTests(term){
  // every class record → the three exam columns of the term
  return M.S.ecr.map(E => { const T = E.terms[term]; if(!T || !T.comp || !T.comp.qa) return null;
    const hps = T.comp.qa.hps || []; const labels = T.comp.qa.labels || [];
    const L = T.learners.filter(x => !x.noScores || (x.qa||[]).some(isNum));
    return {E, hps, labels, L}; }).filter(Boolean);
}
const bins = [[90,100],[75,89.99],[50,74.99],[25,49.99],[0,24.99]];
function testStats(D, i){
  const h = D.hps[i]; const vals = D.L.map(x => (x.qa||[])[i]); const got = vals.filter(isNum);
  if(!got.length || !isNum(h) || !h) return null;
  const st = M.stats(got); const pct = got.map(v => v/h*100);
  return {h, st, n: got.length, missing: vals.length - got.length, mps: st.mean/h*100, mastered: pct.filter(p => p >= 75).length, low: D.L.filter(x => isNum((x.qa||[])[i]) && x.qa[i]/h*100 < 50), bins: bins.map(([a,b]) => pct.filter(p => p >= a && p <= b).length),
    absent: D.L.filter(x => !isNum((x.qa||[])[i])) };
}
function viewEcr(el){
  const ui = M.S.ui; const term = ui.iaEcrTerm || '1'; const ti = ui.iaEcrTest || '0';
  const all = ecrTests(term);
  const grades = [...new Set(all.map(d => String(d.E.grade)))].sort();
  const gsel = ui.iaEcrGrade && grades.includes(ui.iaEcrGrade) ? ui.iaEcrGrade : 'all';
  const D = all.filter(d => gsel === 'all' || String(d.E.grade) === gsel);
  const rows = D.map(d => ({d, s: testStats(d, +ti)}));
  const sel = rows.find(r => r.d.E.id === ui.iaEcrSel) || rows.find(r => r.s) || rows[0];
  el.innerHTML = `
  <div class="card">${M.iaTabs('ecr')}
    <div class="row" style="margin-top:14px">
      <div class="seg" id="eTerm">${['1','2','3'].map(t => `<button data-t="${t}" class="${t===term?'on':''}">Term ${t}</button>`).join('')}</div>
      <div class="seg" id="eTest">${TESTS.map(([k,l]) => `<button data-x="${k}" class="${k===ti?'on':''}">${l}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${grades.length > 1 ? `<select class="input" id="eGr" style="width:auto"><option value="all">All grades</option>${grades.map(g => `<option value="${g}" ${g===gsel?'selected':''}>Grade ${g}</option>`).join('')}</select>` : ''}
      <button class="btn sm" id="eXl">${ico('download')} Excel</button><button class="btn sm primary" id="ePr">${ico('print')} Print</button>
    </div>
    <p class="small muted" style="margin:10px 0 0">Scores come from the Examinations columns of your ECRs (ST1 · ST2 · TE) — edit them in <a href="#classes">Classes → Work on ECR</a>. MPS = mean ÷ highest possible score × 100.</p></div>
  ${!rows.length ? `<div class="card" style="margin-top:20px"><div class="empty">No ECR has Term ${term} examination scores yet.</div></div>` : `
  <div class="card" style="margin-top:20px"><h2>${esc(TESTS[+ti][1])} · Term ${term} — all sections</h2>
    <div class="table-wrap"><table><thead><tr><th>Section</th><th>Subject</th><th class="num">HPS</th><th class="num">Takers</th><th class="num">No score</th><th class="num">Mean</th><th class="num">MPS</th><th>Mastery level</th><th class="num">Median</th><th class="num">SD</th><th class="num">High · Low</th><th class="num">≥75% of HPS</th><th class="num">&lt;50%</th></tr></thead><tbody>
    ${rows.map(({d, s}) => `<tr class="${sel && sel.d===d?'sel':''}" data-sel="${d.E.id}" style="cursor:pointer"><td><b>${esc(d.E.title)}</b></td><td>${esc(d.E.subject||'')}</td>${s ? `<td class="num">${s.h}</td><td class="num">${s.n}</td><td class="num ${s.missing?'low':''}">${s.missing}</td><td class="num">${fmt(s.st.mean)}</td><td class="num"><b class="${s.mps<75?'low':''}">${fmt(s.mps,1)}</b></td><td class="small">${esc(M.mpsLevel(s.mps))}</td><td class="num">${fmt(s.st.median,1)}</td><td class="num">${fmt(s.st.sd)}</td><td class="num">${s.st.max} · ${s.st.min}</td><td class="num">${s.mastered} (${fmt(s.mastered/s.n*100,0)}%)</td><td class="num">${s.low.length}</td>` : `<td colspan="11" class="muted small">No scores for this test yet</td>`}</tr>`).join('')}
    </tbody></table></div>
    <div style="margin-top:14px">${rows.filter(r => r.s).map(({d, s}) => `<div class="bar-row" style="grid-template-columns:minmax(0,1.3fr) 2fr 56px"><span>${esc(d.E.title)}</span><div class="bar-track"><div class="bar-fill ${s.mps<75?'low':''}" style="width:${Math.min(100,s.mps)}%"></div></div><b class="num" style="text-align:right">${fmt(s.mps,1)}</b></div>`).join('')}</div></div>
  ${sel ? sectionCard(sel.d, term) : ''}`}`;
  M.iaTabsBind(el);
  $('#eTerm', el).onclick = e => { const b = e.target.closest('button'); if(!b) return; ui.iaEcrTerm = b.dataset.t; M.save(); viewEcr(el); };
  $('#eTest', el).onclick = e => { const b = e.target.closest('button'); if(!b) return; ui.iaEcrTest = b.dataset.x; M.save(); viewEcr(el); };
  if($('#eGr', el)) $('#eGr', el).onchange = e => { ui.iaEcrGrade = e.target.value; M.save(); viewEcr(el); };
  $$('[data-sel]', el).forEach(tr => tr.onclick = () => { ui.iaEcrSel = tr.dataset.sel; M.save(); viewEcr(el); });
  $('#eXl', el).onclick = () => ecrXlsx(term, all);
  $('#ePr', el).onclick = () => ecrPrint(term, ti, rows);
}
function sectionCard(d, term){
  const S = [0,1,2].map(i => testStats(d, i));
  const L = d.L.map(x => ({x, s: [0,1,2].map(i => isNum((x.qa||[])[i]) && d.hps[i] ? x.qa[i]/d.hps[i]*100 : null)}));
  const trend = S[0] && S[1] ? S[1].mps - S[0].mps : null;
  return `<div class="card" style="margin-top:20px"><div class="row"><h2 style="margin:0">${esc(d.E.title)} · ${esc(d.E.subject||'')} · Term ${term}</h2><span class="spacer"></span><a class="btn sm" href="#classes/${d.E.id}/edit/${term}">${ico('edit')} Work on ECR</a></div>
    <div class="grid g-3" style="margin-top:14px">${TESTS.map(([k, l], i) => { const s = S[i]; return `<div class="card stat ${i===2?'accent':''}" style="padding:16px"><div class="label">${l} <span class="muted">· HPS ${d.hps[i] ?? '—'}</span></div>
      ${s ? `<div class="value">${fmt(s.mps,1)}<span class="muted" style="font-size:14px"> MPS</span></div><div class="sub">mean ${fmt(s.st.mean)} · ${s.mastered}/${s.n} at 75%+ · ${s.missing} no score</div>
      <div class="stackbar" style="margin-top:10px">${s.bins.map((n, j) => n ? `<span style="width:${n/s.n*100}%;background:${['#2f8a61','#7fb069','#d9a73a','#e07a3a','#c55252'][j]}" title="${bins[j][0]}–${Math.floor(bins[j][1])}%: ${n}"></span>` : '').join('')}</div>` : '<div class="empty small">No scores yet</div>'}</div>`; }).join('')}</div>
    ${trend !== null ? `<p class="small" style="margin:12px 0 0">From ST1 to ST2 the MPS ${trend >= 0 ? 'rose' : 'fell'} by <b>${fmt(Math.abs(trend),1)}</b> points${S[2] ? `; the Term Examination MPS is <b>${fmt(S[2].mps,1)}</b> (${esc(M.mpsLevel(S[2].mps))})` : ''}.</p>` : ''}
    <div class="legend" style="margin-top:8px">${bins.map((b, j) => `<span><i style="background:${['#2f8a61','#7fb069','#d9a73a','#e07a3a','#c55252'][j]}"></i>${b[0]}–${Math.floor(b[1])}%</span>`).join('')}</div>
    <h3 style="margin-top:18px">Learners (percent of HPS)</h3>
    <div class="table-wrap" style="max-height:420px"><table><thead><tr><th class="sticky-col">Learner</th>${TESTS.map(([k,l]) => `<th class="num">${l.replace('Summative Test','ST').replace('Term Examination','TE')}</th>`).join('')}<th>Flag</th></tr></thead><tbody>
      ${L.sort((a,b) => (b.s[2] ?? b.s[1] ?? b.s[0] ?? -1) - (a.s[2] ?? a.s[1] ?? a.s[0] ?? -1)).map(({x, s}) => { const flags = []; if(s.some(v => v === null)) flags.push('missing score'); if(s.filter(isNum).some(v => v < 50)) flags.push('below 50%'); if(isNum(s[0]) && isNum(s[2]) && s[2] - s[0] <= -15) flags.push('dropped 15+');
        return `<tr><td class="sticky-col">${esc(x.name)}</td>${s.map((v, i) => `<td class="num ${isNum(v)&&v<75?'low':''}">${isNum(v) ? `${fmt(v,0)}% <span class="tiny muted">(${x.qa[i]})</span>` : '<span class="muted">—</span>'}</td>`).join('')}<td class="tiny">${esc(flags.join(' · '))}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}
function ecrXlsx(term, all){
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Section','Subject','Test','HPS','Takers','No score','Mean','MPS','Mastery level','Median','SD','Highest','Lowest','≥75% of HPS','<50%'],
    ...all.flatMap(d => TESTS.map(([k, l], i) => { const s = testStats(d, i); return s ? [d.E.title, d.E.subject, l, s.h, s.n, s.missing, +s.st.mean.toFixed(2), +s.mps.toFixed(2), M.mpsLevel(s.mps), s.st.median, +s.st.sd.toFixed(2), s.st.max, s.st.min, s.mastered, s.low.length] : [d.E.title, d.E.subject, l]; }))]), 'Summary');
  all.forEach(d => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Learner','Sex', ...TESTS.map(t => t[1] + ' (HPS ' + (d.hps[+t[0]] ?? '') + ')'), ...TESTS.map(t => t[1] + ' %')],
    ...d.L.map(x => [x.name, x.sex, ...[0,1,2].map(i => (x.qa||[])[i] ?? null), ...[0,1,2].map(i => isNum((x.qa||[])[i]) && d.hps[i] ? +(x.qa[i]/d.hps[i]*100).toFixed(2) : null)])]), d.E.title.replace(/[\[\]:*?\/\\]/g,'').slice(0,31)));
  XLSX.writeFile(wb, `Test results Term ${term}.xlsx`);
}
function ecrPrint(term, ti, rows){
  M.doPrint(M.printHeader(`${TESTS[+ti][1].toUpperCase()} — TERM ${term} RESULTS`) +
    `<table><thead><tr><th>Section</th><th>Subject</th><th>HPS</th><th>Takers</th><th>Mean</th><th>MPS</th><th>Mastery level</th><th>SD</th><th>Highest</th><th>Lowest</th><th>≥75% of HPS</th></tr></thead><tbody>
    ${rows.map(({d, s}) => s ? `<tr><td>${esc(d.E.title)}</td><td>${esc(d.E.subject||'')}</td><td style="text-align:center">${s.h}</td><td style="text-align:center">${s.n}</td><td style="text-align:center">${fmt(s.st.mean)}</td><td style="text-align:center"><b>${fmt(s.mps,2)}</b></td><td>${esc(M.mpsLevel(s.mps))}</td><td style="text-align:center">${fmt(s.st.sd)}</td><td style="text-align:center">${s.st.max}</td><td style="text-align:center">${s.st.min}</td><td style="text-align:center">${s.mastered}</td></tr>` : '').join('')}</tbody></table>
    <p class="small" style="margin-top:10px">MPS = mean ÷ highest possible score × 100. Mastery levels: 96–100 Mastered · 86–95 Closely approximating mastery · 66–85 Moving towards mastery · 35–65 Average · 16–34 Low · 5–15 Very low · 0–4 Absolutely no mastery.</p>` +
    M.printSign(M.cls(), 'Prepared by:', 'Noted by:').replace('Class Adviser','Subject Teacher'));
}

/* ---------- Budget of Work ---------- */
function viewBow(el, id){
  const B = M.S.bow;
  const cur = B.find(b => b.id === id) || B[0];
  el.innerHTML = `
  <div class="card">${M.iaTabs('bow')}
    <div class="row" style="margin-top:14px"><div><h2 style="margin:0">Budget of Work</h2><div class="small muted">Upload the BOW of each grade level (Word, Excel, PDF or pasted text). MASTRO lists the competencies per term with their codes and number of days — used to check your tests and to build the Table of Specifications.</div></div>
      <span class="spacer"></span><button class="btn primary" id="bUp">${ico('upload')} Upload BOW</button><button class="btn" id="bPaste">${ico('edit')} Paste text</button></div>
    <input type="file" id="bFile" accept=".docx,.xlsx,.xls,.csv,.pdf,.txt" hidden>
    ${B.length ? `<div class="chips" style="margin-top:14px">${B.map(b => `<a class="chip ${cur && b.id===cur.id?'green':''}" href="#items/bow/${b.id}" style="text-decoration:none">Grade ${esc(b.grade)} · ${esc(b.subject)} · ${b.comps.length} competencies</a>`).join('')}</div>` : ''}</div>
  ${cur ? bowCard(cur) : `<div class="card" style="margin-top:20px"><div class="empty">No Budget of Work yet. Upload the BOW for Grade 7 and Grade 9 English.</div></div>`}`;
  M.iaTabsBind(el);
  $('#bUp', el).onclick = () => $('#bFile', el).click();
  $('#bFile', el).onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    try { const X = await M.extractText(f); const comps = M.parseBOW(X); bowSave(comps, f.name, f); } catch(err){ alert('Could not read the BOW: ' + err.message); } };
  $('#bPaste', el).onclick = () => M.modal('Paste Budget of Work', `<p class="small muted" style="margin-top:0">Paste the competencies, one per line. Lines like “FIRST QUARTER” / “Term 2” start a new term. Codes (e.g. EN7RC-Ia-2) and “3 days” are picked up automatically.</p><textarea class="input" id="pT" rows="14"></textarea><div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn primary" id="pOk">Read competencies</button></div>`,
    b => { $('#pOk', b).onclick = () => { const comps = M.parseBOW({paras: $('#pT', b).value.split('\n'), tables: []}); M.closeModal(); bowSave(comps, 'Pasted BOW', null); }; });
  if(cur) bindBow(el, cur);
}
function bowSave(comps, name, file){
  if(!comps.length) return alert('No competencies were found. Try saving the BOW as Word (.docx) or Excel, or use “Paste text”.');
  const g0 = (name.match(/(?:grade|g)\s*[-_ ]?(7|8|9|10|11|12)\b/i) || name.match(/\b(7|8|9|10)\b/) || [])[1] || '';
  M.modal('Save Budget of Work', `<div class="chips" style="margin-bottom:12px"><span class="chip green">${comps.length} competencies read</span>${[...new Set(comps.map(c=>c.term))].sort().map(t => `<span class="chip">Term ${t}: ${comps.filter(c=>c.term===t).length}</span>`).join('')}</div>
    <div class="grid g-2"><label class="field">Grade level<input class="input" id="sG" value="${esc(g0)}"></label><label class="field">Learning area<input class="input" id="sS" value="English"></label></div>
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn primary" id="sOk">Save</button></div>`, b => {
    $('#sOk', b).onclick = async () => { const grade = $('#sG', b).value.trim(), subject = $('#sS', b).value.trim(); if(!grade) return M.toast('Enter the grade level');
      let docId = null; if(file){ docId = M.uid('d'); await M.docPut({id:docId, name:file.name, category:'Lesson Materials', formCode:'BOW', tags:`BOW, Grade ${grade}, ${subject}`, classId:'', notes:'Budget of Work', mime:file.type, size:file.size, added:new Date().toISOString(), blob:file}).catch(()=>{}); }
      const ex = M.S.bow.find(x => String(x.grade) === grade && M.normName(x.subject) === M.normName(subject));
      if(ex && !confirm(`Replace the Grade ${grade} ${subject} BOW?`)) return;
      const B = {id: ex ? ex.id : M.uid('bow'), grade, subject, name, docId, comps, added: new Date().toISOString()};
      if(ex) Object.assign(ex, B); else M.S.bow.push(B); M.save(); M.closeModal(); location.hash = '#items/bow/' + B.id; M.route(); M.toast('Budget of Work saved'); }; });
}
function bowCard(b){
  const terms = [...new Set(b.comps.map(c => c.term))].sort();
  return `<div class="card" style="margin-top:20px"><div class="row"><h2 style="margin:0">Grade ${esc(b.grade)} · ${esc(b.subject)}</h2><span class="tiny muted">${esc(b.name||'')}</span><span class="spacer"></span>
      <button class="btn sm" id="bAdd">${ico('plus')} Add competency</button><button class="btn sm" id="bX">${ico('download')} Excel</button><button class="btn sm danger" id="bDel">Delete BOW</button></div>
    <p class="small muted">Edit any cell — term, code, competency or number of days. The number of days sets each competency's weight in the TOS.</p>
    ${terms.map(t => { const cs = b.comps.filter(c => c.term === t); const days = cs.reduce((a,c)=>a+(+c.days||0),0); return `<h3 style="margin-top:16px">Term ${esc(t)} <span class="tiny muted">${cs.length} competencies · ${days} day(s)</span></h3>
      <div class="table-wrap"><table class="bow-t"><thead><tr><th style="width:56px">Term</th><th style="width:150px">Code</th><th>Competency</th><th style="width:70px" class="num">Days</th><th style="width:40px"></th></tr></thead><tbody>
      ${cs.map(c => `<tr data-k="${c.id}"><td><input class="input sm-in" data-f="term" value="${esc(c.term)}"></td><td><input class="input sm-in" data-f="code" value="${esc(c.code||'')}"></td><td><textarea class="input sm-in" data-f="text" rows="2">${esc(c.text)}</textarea></td><td><input class="input sm-in num" data-f="days" value="${esc(c.days)}" inputmode="decimal"></td><td><button class="icon-btn" data-rm="${c.id}" aria-label="Remove">✕</button></td></tr>`).join('')}</tbody></table></div>`; }).join('')}</div>`;
}
function bindBow(el, b){
  el.addEventListener('change', e => { const x = e.target; const tr = x.closest('tr[data-k]'); if(!tr || !x.dataset.f) return; const c = b.comps.find(y => y.id === tr.dataset.k); if(!c) return;
    c[x.dataset.f] = x.dataset.f === 'days' ? (+x.value || 0) : x.value.trim(); M.save(); if(x.dataset.f === 'term') viewBow(el, b.id); });
  $$('[data-rm]', el).forEach(btn => btn.onclick = () => { b.comps = b.comps.filter(c => c.id !== btn.dataset.rm); M.save(); viewBow(el, b.id); });
  $('#bAdd', el).onclick = () => { b.comps.push({id:M.uid('k'), term:'1', code:'', text:'New competency', days:1}); M.save(); viewBow(el, b.id); };
  $('#bDel', el).onclick = () => { if(!confirm('Delete this Budget of Work?')) return; M.S.bow = M.S.bow.filter(x => x !== b); M.save(); location.hash = '#items/bow'; M.route(); };
  $('#bX', el).onclick = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Term','Code','Competency','Days'], ...b.comps.map(c => [c.term, c.code, c.text, c.days])]), 'BOW'); XLSX.writeFile(wb, `BOW Grade ${b.grade} ${b.subject}.xlsx`); };
}

/* ---------- TOS for a test (tab in the test page) ---------- */
M.iaTos = async function(body, a, c, rerender){
  const bows = M.S.bow;
  const B = bows.find(b => b.id === a.bowId) || bowFor(c.grade, a.subject);
  const P = a.paper;
  body.innerHTML = `<div class="grid g-2">
    <div class="card"><h2>1 · Test paper</h2>
      <p class="small muted" style="margin-top:0">Upload the test questionnaire (Word .docx, PDF or text) or paste it. MASTRO splits it into numbered items.</p>
      <div class="row"><button class="btn sm primary" id="tpUp">${ico('upload')} Upload test paper</button><button class="btn sm" id="tpPaste">${ico('edit')} Paste</button>${P?`<span class="chip green">${P.items.length} items read${P.name?' from '+esc(P.name):''}</span>`:''}</div>
      <input type="file" id="tpF" accept=".docx,.pdf,.txt" hidden></div>
    <div class="card"><h2>2 · Budget of Work</h2>
      ${bows.length ? `<select class="input" id="tpB">${bows.map(b => `<option value="${b.id}" ${B && b.id===B.id?'selected':''}>Grade ${esc(b.grade)} · ${esc(b.subject)} (${b.comps.length})</option>`).join('')}</select>
        <p class="small muted">Term ${esc(a.term)} competencies: <b>${B ? B.comps.filter(k => k.term === a.term).length : 0}</b>. Items are matched to the competency they test; items that belong to another term are flagged.</p>`
        : `<div class="empty small">No Budget of Work yet. <a href="#items/bow">Upload the BOW</a> first.</div>`}</div></div>
  <div id="tosBody"></div>`;
  $('#tpUp', body).onclick = () => $('#tpF', body).click();
  $('#tpF', body).onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    try { const X = await M.extractText(f); setPaper(a, M.splitItems(X.paras), f.name);
      await M.docPut({id:M.uid('d'), name:f.name, category:'Lesson Materials', formCode:'IA', iaId:a.id, tags:`Test paper, ${a.title}`, classId:c.id, notes:'Test paper', mime:f.type, size:f.size, added:new Date().toISOString(), blob:f}).catch(()=>{});
      rerender(); } catch(err){ alert('Could not read the test paper: ' + err.message); } };
  $('#tpPaste', body).onclick = () => M.modal('Paste the test', `<p class="small muted" style="margin-top:0">Paste the questions. Each item should start with its number (1. or 1)); choices a. b. c. d. are kept with the item.</p><textarea class="input" id="ptT" rows="16"></textarea><div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn primary" id="ptOk">Read items</button></div>`,
    b => { $('#ptOk', b).onclick = () => { setPaper(a, M.splitItems($('#ptT', b).value.split('\n')), 'Pasted'); M.closeModal(); rerender(); }; });
  if($('#tpB', body)) $('#tpB', body).onchange = e => { a.bowId = e.target.value; if(a.paper) autoMap(a, bows.find(b => b.id === a.bowId), true); M.save(); rerender(); };
  if(!P || !P.items.length){ $('#tosBody', body).innerHTML = `<div class="card" style="margin-top:20px"><div class="empty">Upload or paste the test paper to build the Table of Specifications.</div></div>`; return; }
  if(!B){ $('#tosBody', body).innerHTML = `<div class="card" style="margin-top:20px"><div class="empty">Add the Budget of Work to match items with competencies.</div></div>`; return; }
  if(!P.map || P.bowId !== B.id) autoMap(a, B, false);
  tosRender($('#tosBody', body), a, c, B, rerender);
};
function setPaper(a, items, name){
  if(!items.length) return alert('No numbered items were found. Make sure each question starts with its number (e.g. “1.”).');
  a.paper = {name, items: items.map(it => ({no: it.no, orig: it.orig, text: (it.text + (it.opts.length ? ' — ' + it.opts.join(' | ') : '')).slice(0, 700), part: it.part})), map:null, bloom:{}};
  if(!a.n || a.n < items.length || !Object.keys(a.resp||{}).length) a.n = Math.max(a.n||0, items.length);
  M.save();
}
function autoMap(a, B, force){
  const P = a.paper; if(!P || !B) return;
  const match = tfidfMatcher(B.comps);
  P.map = P.map && !force ? P.map : {}; P.score = {}; P.bowId = B.id;
  // prefer the test's own term when scores are close
  P.items.forEach(it => { const r = match(it.text); if(!r.length) return;
    const best = r[0]; const inTerm = r.find(x => B.comps[x.i].term === a.term);
    const pick = inTerm && inTerm.s >= best.s * 0.85 ? inTerm : best;
    if(force || !P.map[it.no]) P.map[it.no] = pick.s > 0.02 ? B.comps[pick.i].id : '';
    P.score[it.no] = +pick.s.toFixed(3);
    if(P.bloom[it.no] === undefined) P.bloom[it.no] = M.bloomOf(it.text); });
  M.save();
}
M.tosData = function(a, B){
  const P = a.paper; const n = P.items.length;
  const termComps = B.comps.filter(k => k.term === a.term);
  const used = new Set(Object.values(P.map||{}).filter(Boolean));
  const rows = [...termComps, ...B.comps.filter(k => k.term !== a.term && used.has(k.id))];
  const totalDays = termComps.reduce((s,k) => s + (+k.days||0), 0) || 1;
  const R = rows.map(k => { const its = P.items.filter(it => P.map[it.no] === k.id);
    const by = BLOOM.map((_, lv) => its.filter(it => (P.bloom[it.no] ?? 1) === lv).map(it => it.no));
    const inTerm = k.term === a.term; const w = inTerm ? (+k.days||0)/totalDays : 0;
    return {k, inTerm, days: +k.days||0, w, expected: 0, raw: inTerm ? w * n : 0, actual: its.length, by, items: its.map(it => it.no)}; });
  // planned items: largest-remainder rounding so they add up to the number of items
  R.forEach(r => r.expected = Math.floor(r.raw)); let left = n - R.reduce((s,r) => s + r.expected, 0);
  [...R].filter(r => r.inTerm).sort((x,y) => (y.raw - Math.floor(y.raw)) - (x.raw - Math.floor(x.raw))).forEach(r => { if(left > 0){ r.expected++; left--; } });
  const unmatched = P.items.filter(it => !P.map[it.no]).map(it => it.no);
  const outside = R.filter(r => !r.inTerm && r.actual);
  const missing = R.filter(r => r.inTerm && r.expected > 0 && !r.actual);
  const lv = BLOOM.map((_, i) => P.items.filter(it => (P.bloom[it.no] ?? 1) === i).length);
  const groups = {Easy: lv[0]+lv[1], Average: lv[2]+lv[3], Difficult: lv[4]+lv[5]};
  return {n, R, totalDays, unmatched, outside, missing, lv, groups};
};
function tosRender(el, a, c, B, rerender){
  const P = a.paper; const D = M.tosData(a, B);
  const compOpt = (sel) => `<option value="">— not matched —</option>${['1','2','3','4'].filter(t => B.comps.some(k => k.term === t)).map(t => `<optgroup label="Term ${t}${t===a.term?' (this test)':''}">${B.comps.filter(k => k.term === t).map(k => `<option value="${k.id}" ${k.id===sel?'selected':''}>${esc((k.code?k.code+' · ':'') + k.text.slice(0,90))}</option>`).join('')}</optgroup>`).join('')}`;
  const R = (a.resp && Object.keys(a.resp).length) ? M.iaAnalyze(a, c) : null;
  el.innerHTML = `
  <div class="card insight" style="margin-top:20px"><div class="row"><div>${ico('sparkle','width:26px;height:26px;color:var(--gold)')}</div><div class="grow">
    <div class="title"><b>Alignment check · ${esc(a.title)} · Term ${esc(a.term)}</b></div>
    <ul class="small" style="margin:8px 0 0;padding-left:18px;line-height:1.6">
      <li><b>${D.n - D.unmatched.length - D.outside.reduce((s,r)=>s+r.actual,0)}</b> of ${D.n} items match Term ${esc(a.term)} competencies.</li>
      ${D.outside.length ? `<li class="low"><b>${D.outside.reduce((s,r)=>s+r.actual,0)} item(s) belong to other terms:</b> ${D.outside.map(r => `items ${r.items.join(', ')} → Term ${esc(r.k.term)} (${esc(r.k.code||r.k.text.slice(0,40))})`).join('; ')}.</li>` : `<li>No item belongs to another term. ✔</li>`}
      ${D.unmatched.length ? `<li><b>${D.unmatched.length} item(s) not matched</b> to any competency: ${D.unmatched.join(', ')} — pick the competency below.</li>` : ''}
      ${D.missing.length ? `<li><b>${D.missing.length} Term ${esc(a.term)} competenc${D.missing.length>1?'ies have':'y has'} no item</b> though the BOW gives ${D.missing.length>1?'them':'it'} days: ${D.missing.map(r => esc(r.k.code || r.k.text.slice(0,40))).join('; ')}.</li>` : ''}
      <li>Cognitive levels — Easy (R+U) <b>${D.groups.Easy}</b> · Average (Ap+An) <b>${D.groups.Average}</b> · Difficult (E+C) <b>${D.groups.Difficult}</b> (${D.n ? [D.groups.Easy, D.groups.Average, D.groups.Difficult].map(x => Math.round(x/D.n*100)).join('–') : ''}%; the usual DepEd split is 60–30–10).</li>
    </ul></div>
    <div class="row" style="align-self:flex-start"><button class="btn sm" id="tosRe">Re-match</button><button class="btn sm" id="tosX">${ico('download')} Excel</button><button class="btn sm primary" id="tosP">${ico('print')} Print TOS</button></div></div></div>
  <div class="card" style="margin-top:20px"><h2>Table of Specifications</h2>
    <div class="table-wrap"><table class="tos-t"><thead><tr><th rowspan="2">Competency</th><th rowspan="2" class="num">Days</th><th rowspan="2" class="num">%</th><th rowspan="2" class="num">Planned items</th><th colspan="6" class="c">Item placement by cognitive level</th><th rowspan="2" class="num">Actual</th>${R?'<th rowspan="2" class="num">% correct</th>':''}</tr>
      <tr>${BLOOM.map(b => `<th class="c" title="${b}">${b.slice(0,3)}.</th>`).join('')}</tr></thead><tbody>
      ${D.R.map(r => { const pc = R && r.items.length ? r.items.reduce((s,i)=>s+(R.items[i-1]?R.items[i-1].pct:0),0)/r.items.length : null;
        return `<tr class="${r.inTerm?'':'outside'}"><td>${r.k.code?`<b class="tiny">${esc(r.k.code)}</b> `:''}${esc(r.k.text)}${r.inTerm?'':` <span class="chip red" style="font-size:10px;padding:1px 6px">Term ${esc(r.k.term)}</span>`}</td><td class="num">${r.inTerm?r.days:''}</td><td class="num">${r.inTerm?fmt(r.w*100,1):''}</td><td class="num">${r.inTerm?r.expected:''}</td>
        ${r.by.map(x => `<td class="c tiny">${x.join(', ')}</td>`).join('')}<td class="num"><b class="${r.inTerm && r.actual !== r.expected ? 'low' : ''}">${r.actual}</b></td>${R?`<td class="num ${isNum(pc)&&pc<75?'low':''}">${isNum(pc)?fmt(pc,1):''}</td>`:''}</tr>`; }).join('')}
      <tr class="group"><td><b>Total</b></td><td class="num"><b>${D.totalDays}</b></td><td class="num">100</td><td class="num"><b>${D.R.reduce((s,r)=>s+r.expected,0)}</b></td>${D.lv.map(x => `<td class="c"><b>${x}</b></td>`).join('')}<td class="num"><b>${D.n - D.unmatched.length}</b></td>${R?'<td></td>':''}</tr></tbody></table></div>
    <p class="tiny muted">Planned items = days ÷ total days of Term ${esc(a.term)} × ${D.n} items. Cognitive levels: Remembering · Understanding · Applying · Analyzing · Evaluating · Creating (estimated from each question's wording — change any below).</p></div>
  <div class="card" style="margin-top:20px"><div class="row"><h2 style="margin:0">Items</h2><span class="spacer"></span>${R?'':'<span class="small muted">Add learners’ answers in Responses to see % correct per competency.</span>'}<button class="btn sm" id="tosUse">Use for competency mastery</button></div>
    <div class="table-wrap" style="max-height:560px"><table><thead><tr><th class="num">#</th><th>Question</th><th>Competency</th><th>Level</th><th class="num">Match</th></tr></thead><tbody>
    ${P.items.map(it => { const k = B.comps.find(x => x.id === P.map[it.no]); const off = k && k.term !== a.term;
      return `<tr class="${off?'outside':''}"><td class="num"><b>${it.no}</b></td><td class="small" style="min-width:260px;max-width:460px;white-space:normal">${esc(it.text.slice(0,220))}${it.text.length>220?'…':''}</td>
      <td><select class="input sm-in" data-map="${it.no}" style="max-width:340px">${compOpt(P.map[it.no])}</select>${off?`<div class="tiny low">Term ${esc(k.term)} competency</div>`:''}</td>
      <td><select class="input sm-in" data-bl="${it.no}">${BLOOM.map((b, i) => `<option value="${i}" ${(P.bloom[it.no] ?? 1) === i ? 'selected' : ''}>${b}</option>`).join('')}</select></td>
      <td class="num tiny muted">${P.score && isNum(P.score[it.no]) ? Math.round(P.score[it.no]*100) : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  el.addEventListener('change', e => { const x = e.target;
    if(x.dataset.map){ P.map[x.dataset.map] = x.value; M.save(); tosRender(el, a, c, B, rerender); }
    if(x.dataset.bl){ P.bloom[x.dataset.bl] = +x.value; M.save(); tosRender(el, a, c, B, rerender); } });
  $('#tosRe', el).onclick = () => { if(!confirm('Re-match every item automatically? Your manual choices will be replaced.')) return; P.bloom = {}; autoMap(a, B, true); tosRender(el, a, c, B, rerender); };
  $('#tosUse', el).onclick = () => { a.comps = D.R.filter(r => r.items.length).map(r => ({name: (r.k.code ? r.k.code + ' – ' : '') + r.k.text.slice(0, 120), items: r.items.join(', ')})); M.save(); M.toast('Competencies copied to this test — see Analysis'); };
  $('#tosP', el).onclick = () => tosPrint(a, c, B, D, R);
  $('#tosX', el).onclick = () => { const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`TABLE OF SPECIFICATIONS — ${a.title} (Term ${a.term})`], [`${M.className(c)} · ${a.subject} · ${D.n} items`], [],
      ['Code','Competency','Term','Days','% weight','Planned items', ...BLOOM, 'Actual items'],
      ...D.R.map(r => [r.k.code, r.k.text, r.k.term, r.inTerm?r.days:'', r.inTerm?+(r.w*100).toFixed(2):'', r.inTerm?r.expected:'', ...r.by.map(x => x.join(', ')), r.actual]),
      ['', 'TOTAL', '', D.totalDays, 100, D.R.reduce((s,r)=>s+r.expected,0), ...D.lv, D.n - D.unmatched.length]]), 'TOS');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item','Question','Code','Competency','Competency term','Cognitive level'], ...P.items.map(it => { const k = B.comps.find(x => x.id === P.map[it.no]); return [it.no, it.text, k?k.code:'', k?k.text:'', k?k.term:'', BLOOM[P.bloom[it.no] ?? 1]]; })]), 'Items');
    XLSX.writeFile(wb, `TOS - ${a.title}.xlsx`); };
}
function tosPrint(a, c, B, D, R){
  M.doPrint(M.printHeader(`TABLE OF SPECIFICATIONS`) +
    `<p style="text-align:center;margin-top:-4px"><b>${esc(a.title)}</b> · ${esc(a.subject)} ${esc(B.grade ? 'Grade ' + B.grade : '')} · Term ${esc(a.term)} · ${D.n} items</p>
    <table><thead><tr><th rowspan="2">Learning Competency</th><th rowspan="2">No. of Days</th><th rowspan="2">% Weight</th><th rowspan="2">No. of Items</th><th colspan="6">Item Placement</th><th rowspan="2">Total</th></tr><tr>${BLOOM.map(b => `<th style="font-size:8pt">${b}</th>`).join('')}</tr></thead><tbody>
    ${D.R.filter(r => r.inTerm || r.actual).map(r => `<tr><td>${r.k.code ? `<b>${esc(r.k.code)}</b> ` : ''}${esc(r.k.text)}${r.inTerm ? '' : ` <i>(Term ${esc(r.k.term)})</i>`}</td><td style="text-align:center">${r.inTerm?r.days:''}</td><td style="text-align:center">${r.inTerm?fmt(r.w*100,1):''}</td><td style="text-align:center">${r.inTerm?r.expected:''}</td>${r.by.map(x => `<td style="text-align:center;font-size:8pt">${x.join(', ')}</td>`).join('')}<td style="text-align:center"><b>${r.actual}</b></td></tr>`).join('')}
    <tr><td><b>TOTAL</b></td><td style="text-align:center"><b>${D.totalDays}</b></td><td style="text-align:center"><b>100</b></td><td style="text-align:center"><b>${D.R.reduce((s,r)=>s+r.expected,0)}</b></td>${D.lv.map(x => `<td style="text-align:center"><b>${x}</b></td>`).join('')}<td style="text-align:center"><b>${D.n - D.unmatched.length}</b></td></tr></tbody></table>
    <p style="font-size:9pt;margin-top:8px">Easy (Remembering + Understanding): ${D.groups.Easy} · Average (Applying + Analyzing): ${D.groups.Average} · Difficult (Evaluating + Creating): ${D.groups.Difficult}${D.unmatched.length ? ` · Not matched: items ${D.unmatched.join(', ')}` : ''}</p>` +
    M.printSign(c, 'Prepared by:', 'Noted by:').replace('Class Adviser','Subject Teacher'), '@page{size:A4 landscape;margin:10mm}');
}

M.iaViewEcr = viewEcr; M.iaViewBow = viewBow;
})();
