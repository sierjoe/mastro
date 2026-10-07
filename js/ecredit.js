/* MASTRO — work on your ECR inside the app.
   MASTRO reads the ECR's own layout (INPUT DATA, TERM 1–3, FINAL GRADES, HELPER) and gives you
   the same sheets as editable grids. Totals, PS, WS, Initial Grade, Term Grade and Descriptor are
   computed with exactly the ECR's formulas and transmutation table. "Download updated ECR" writes
   your entries back into the original workbook — every formula and format stays. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum} = M;
const str = (v) => String(v ?? '').replace(/\s+/g,' ').trim();
const num = (v) => { if(typeof v === 'number' && isFinite(v)) return v; const s = str(v); if(s==='' || isNaN(+s)) return null; return +s; };
const cLet = (n) => { let s=''; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; };   // 0-based
const cIdx = (L) => L.split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64, 0) - 1;
const SLOTS = 50;
const KEYS = ['ww','pt','ex'];
const CLABEL = {ww:'Written Works', pt:'Performance Tasks', ex:'Examinations'};
const DEF_TABLE = [[99.5,100],[98.32,99],[97.14,98],[95.96,97],[94.78,96],[93.6,95],[92.42,94],[91.24,93],[90.06,92],[88.88,91],[87.7,90],[86.52,89],[85.34,88],[84.16,87],[82.98,86],[81.8,85],[80.62,84],[79.44,83],[78.26,82],[77.08,81],[75.9,80],[74.72,79],[73.54,78],[72.36,77],[71.18,76],[70,75],[65.34,74],[60.67,73],[56.01,72],[51.34,71],[46.67,70],[42.01,69],[37.34,68],[32.68,67],[28.01,66],[23.35,65],[18.68,64],[14.01,63],[9.35,62],[4.68,61],[0,60]];
const INFO = [['region',/^region$/],['division',/^division$/],['schoolId',/^school\s*id$/],['school',/^school\s*name$/],['sy',/^school\s*year$/],['head',/^school\s*head$/],['teacher',/^subject\s*teacher$/],['subject',/^subject$/],['grade',/^grade\s*level$/],['section',/^section$/]];
const INFO_LABEL = {region:'Region', division:'Division', schoolId:'School ID', school:'School name', sy:'School year', head:'School head', teacher:'Subject teacher', subject:'Subject', grade:'Grade level', section:'Section'};

/* ---------------- read the workbook into an editable model ---------------- */
M.ecrModelFrom = function(wb){
  const S = (n) => wb.Sheets[n];
  const rowsOf = (n) => XLSX.utils.sheet_to_json(S(n), {header:1, raw:true, defval:null});
  const model = {v:1, info:{}, infoRefs:{}, roster:{M:Array(SLOTS).fill(''), F:Array(SLOTS).fill('')}, rosterRefs:{}, terms:{}, table:DEF_TABLE, desc:null, finalSheet:null};
  // INPUT DATA
  const inSh = wb.SheetNames.find(n => /input\s*data/i.test(n));
  if(inSh){ model.inputSheet = inSh; const R = rowsOf(inSh);
    R.forEach((row, r) => (row||[]).forEach((v, c) => { const t = str(v).toLowerCase();
      const hit = INFO.find(([k, re]) => re.test(t)); if(hit && !model.infoRefs[hit[0]]){
        for(let k=1;k<=4;k++){ const x = str((row||[])[c+k]); if(x === ':') continue; model.infoRefs[hit[0]] = cLet(c+k) + (r+1); model.info[hit[0]] = x; break; } }
      if((t === 'male' || t === 'female') && !model.rosterRefs[t[0].toUpperCase()]){ const sx = t === 'male' ? 'M' : 'F';
        model.rosterRefs[sx] = {col: cLet(c+1), row: r+2};
        for(let i=0;i<SLOTS;i++) model.roster[sx][i] = str((R[r+1+i]||[])[c+1]); } })); }
  // HELPER transmutation table
  const hSh = wb.SheetNames.find(n => /helper/i.test(n));
  if(hSh){ const R = rowsOf(hSh); let hr = -1, cMin = -1, cTg = -1, cNg = -1, cDs = -1;
    R.forEach((row, r) => (row||[]).forEach((v, c) => { const t = str(v).toLowerCase();
      if(/^ig\s*\(?min/.test(t)){ hr = r; cMin = c; } if(/transmuted\s*grade/.test(t)) cTg = c; if(/^numerical\s*grade/.test(t)) cNg = c; if(/^descriptor$/.test(t) && r === hr) cDs = c; }));
    if(hr >= 0 && cMin >= 0 && cTg >= 0){ const tb = []; for(let r=hr+1;r<R.length;r++){ const a = num((R[r]||[])[cMin]), b = num((R[r]||[])[cTg]); if(a===null || b===null) break; tb.push([a,b]); } if(tb.length > 10) model.table = tb; }
    if(hr >= 0 && cNg >= 0 && cDs >= 0){ const ds = []; for(let r=hr+1;r<R.length;r++){ const a = num((R[r]||[])[cNg]), b = str((R[r]||[])[cDs]); if(a===null || !b) break; ds.push([a,b]); } if(ds.length > 10) model.desc = ds; } }
  model.finalSheet = wb.SheetNames.find(n => /final/i.test(n)) || null;
  // TERM sheets
  const reWW = /written|oral\s*works?|\(\s*wws?\s*\)/i, rePT = /performance\s*tasks?|\(\s*pts?\s*\)/i, reEX = /exam|assessment|\(\s*exs?\s*\)/i;
  wb.SheetNames.forEach(sn => {
    const m = sn.match(/(?:term|quarter|q)\s*[-_ ]?\s*([1-4])/i); if(!m) return; const term = m[1];
    const R = rowsOf(sn); const cell = (r, c) => (R[r]||[])[c];
    let hr = -1; for(let r=0;r<Math.min(R.length,45) && hr<0;r++){ const X = (R[r]||[]).map(str); if(X.some(x=>reWW.test(x)) && X.some(x=>rePT.test(x))) hr = r; }
    if(hr < 0) return;
    let subR = -1; for(let r=hr+1;r<=hr+4;r++) if((R[r]||[]).some(v => /^ps$/i.test(str(v)))){ subR = r; break; } if(subR < 0) return;
    let hpsR = -1; for(let r=hr;r<=hr+7;r++) if((R[r]||[]).some(v => /highest\s*possible/i.test(str(v)))){ hpsR = r; break; } if(hpsR < 0) hpsR = subR + 1;
    const find = (re, row, not) => (R[row]||[]).findIndex(v => re.test(str(v)) && !(not && not.test(str(v))));
    const starts = [['ww', find(reWW, hr)], ['pt', find(rePT, hr)], ['ex', find(reEX, hr, /initial|grade/i)]].filter(x => x[1] >= 0).sort((a,b)=>a[1]-b[1]);
    if(starts.length < 3) return;
    const igC = (() => { for(let r=hr;r<=hr+3;r++){ const c = find(/initial\s*grade/i, r); if(c>=0) return c; } return -1; })();
    const tgC = (() => { for(let r=hr;r<=hr+3;r++){ const c = find(/(term|quarterly|transmuted|quarter)\s*grade/i, r, /initial/i); if(c>=0) return c; } return -1; })();
    const dsC = (() => { for(let r=hr;r<=hr+3;r++){ const c = find(/^descriptor$/i, r); if(c>=0) return c; } return -1; })();
    const sub = (R[subR]||[]).map(str);
    const T = {sheet: sn, hpsRow: hpsR + 1, cols:{}, hps:{}, w:{}, psMax:{}, exW:[], wCell:{}, labels:{}, igC: igC>=0?cLet(igC):null, tgC: tgC>=0?cLet(tgC):null, dsC: dsC>=0?cLet(dsC):null};
    starts.forEach(([k, c0], i) => {
      const end = (i+1 < starts.length ? starts[i+1][1] : (igC >= 0 ? igC : c0+14)) - 1;
      const items = [], wsSub = []; let total = null, ps = null, ws = null;
      for(let c=c0;c<=end;c++){ const t = sub[c];
        if(/^ws\s*(st\s*\d+|te|pe|qa)/i.test(t)) wsSub.push(c);
        else if(/^\d{1,2}$/.test(t) || /^(st\s*\d+|te|pe|qa|exam\s*\d*|q\d)$/i.test(t)) items.push(c);
        else if(/^total$/i.test(t)) total = c; else if(/^ps$/i.test(t)) ps = c; else if(/^ws$/i.test(t)) ws = c; }
      T.cols[k] = {items: items.map(cLet), total: total!==null?cLet(total):null, ps: ps!==null?cLet(ps):null, ws: ws!==null?cLet(ws):null, wsSub: wsSub.map(cLet)};
      T.labels[k] = items.map(c => sub[c]);
      T.hps[k] = items.map(c => num(cell(hpsR, c)));
      let w = ws!==null ? num(cell(hpsR, ws)) : null; if(isNum(w) && w > 1) w = w/100; T.w[k] = isNum(w) ? w : ({ww:.2, pt:.5, ex:.3})[k]; T.wCell[k] = ws!==null ? cLet(ws) : null;
      T.psMax[k] = ps!==null && isNum(num(cell(hpsR, ps))) ? num(cell(hpsR, ps)) : 100;
      if(k === 'ex') T.exW = wsSub.length ? wsSub.map(c => num(cell(hpsR, c))) : items.map(() => 100/items.length);
    });
    // learner rows: under "MALE" and "FEMALE"
    const marks = {}; R.forEach((row, r) => { if(r <= hpsR) return; for(let c=0;c<6;c++){ const t = str((row||[])[c]).toUpperCase(); if((t==='MALE' || t==='FEMALE') && !marks[t[0]]) marks[t[0]] = r; } });
    if(marks.M === undefined || marks.F === undefined) return;
    T.rows = {M: marks.M + 2, F: marks.F + 2};   // 1-based first learner row
    T.nameC = (() => { const cnt = {}; for(let r=marks.M+1;r<marks.M+1+SLOTS;r++) (R[r]||[]).slice(0, cIdx(T.cols[starts[0][0]].items[0]||'F')).forEach((v,c) => { if(/[a-z]{2,}/i.test(str(v))) cnt[c] = (cnt[c]||0)+1; }); const best = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]; return best ? cLet(+best[0]) : 'C'; })();
    T.scores = {M:[], F:[]};
    ['M','F'].forEach(sx => { for(let i=0;i<SLOTS;i++){ const r = T.rows[sx] - 1 + i; const o = {};
      KEYS.forEach(k => o[k] = T.cols[k].items.map(L => num(cell(r, cIdx(L))))); T.scores[sx].push(o); } });
    model.terms[term] = T;
  });
  return Object.keys(model.terms).length ? model : null;
};

/* ---------------- the ECR's formulas ---------------- */
const cnt = (a) => a.filter(isNum).length, sum = (a) => a.filter(isNum).reduce((x,y)=>x+y, 0);
// =INDEX(D, IF(IG>=B8, 1, MATCH(IG, B, -1)+1)) on a descending table
M.ecrTransmute = (table, ig) => { if(!isNum(ig)) return null; if(ig >= table[0][0]) return table[0][1]; let pos = -1; for(let i=0;i<table.length;i++) if(table[i][0] >= ig) pos = i; if(pos < 0 || pos+1 >= table.length) return null; return table[pos+1][1]; };
const descOf = (model, g) => { if(!isNum(g)) return ''; if(model.desc){ const d = model.desc.find(x => x[0] === g); if(d) return d[1]; } return M.descriptor(g); };
function calc(model, T, s){
  const o = {};
  ['ww','pt'].forEach(k => { const h = cnt(T.hps[k]) ? sum(T.hps[k]) : null; const n = cnt(s[k]);
    o[k+'Total'] = n ? sum(s[k]) : null; o[k+'PS'] = n && h ? o[k+'Total'] / h * T.psMax[k] : null; o[k+'WS'] = o[k+'PS']===null ? null : o[k+'PS'] * T.w[k]; });
  o.exSub = T.hps.ex.map((h, i) => isNum(s.ex[i]) && h ? s.ex[i] / h * (T.exW[i] ?? 0) : null);
  o.exPS = cnt(s.ex) ? sum(o.exSub) : null; o.exWS = o.exPS===null ? null : o.exPS * T.w.ex;
  const any = cnt(s.ww) + cnt(s.pt) + cnt(s.ex);
  o.ig = any ? sum([o.wwWS, o.ptWS, o.exWS]) : null;
  o.tg = M.ecrTransmute(model.table, o.ig); o.desc = descOf(model, o.tg);
  return o;
}
M.ecrCalc = calc;
function finalOf(model, sx, i){
  const tg = ['1','2','3'].map(t => { const T = model.terms[t]; return T ? calc(model, T, T.scores[sx][i]).tg : null; });
  const fin = tg.filter(isNum).length === 3 ? Math.round(tg.reduce((a,b)=>a+b,0)/3) : null;
  return {tg, fin, desc: fin===null ? '' : descOf(model, fin), rem: fin===null ? '' : fin >= 75 ? 'Passed' : 'Failed'};
}
M.ecrFinal = finalOf;
// what the Classes / Analyze pages read (same shape as an uploaded ECR)
M.ecrTermsFromModel = function(model){
  const out = {};
  Object.entries(model.terms).forEach(([t, T]) => {
    const learners = [];
    ['M','F'].forEach(sx => model.roster[sx].forEach((name, i) => { if(!name) return; const s = T.scores[sx][i]; const o = calc(model, T, s);
      const rec = {name: name.replace(/\s*,\s*/, ', '), sex: sx, ww: s.ww.slice(), pt: s.pt.slice(), qa: s.ex.slice()};
      ['ww','pt'].forEach(k => { rec[k+'Total'] = o[k+'Total']; rec[k+'PS'] = isNum(o[k+'PS']) ? M.r2(o[k+'PS']) : null; rec[k+'WS'] = o[k+'WS']; });
      rec.qaPS = isNum(o.exPS) ? M.r2(o.exPS) : null; rec.qaWS = o.exWS; rec.ig = isNum(o.ig) ? M.r2(o.ig) : null; rec.tg = o.tg;
      rec.noScores = !cnt(s.ww) && !cnt(s.pt) && !cnt(s.ex); learners.push(rec); }));
    if(learners.some(x => !x.noScores)) out[t] = {sheet: T.sheet, comp: {ww:{w:Math.round(T.w.ww*100), hps:T.hps.ww, n:T.hps.ww.length, labels:T.labels.ww}, pt:{w:Math.round(T.w.pt*100), hps:T.hps.pt, n:T.hps.pt.length, labels:T.labels.pt}, qa:{w:Math.round(T.w.ex*100), hps:T.hps.ex, n:T.hps.ex.length, labels:T.labels.ex}}, learners};
  });
  return out;
};
M.ecrEnsureModel = async function(E){
  if(E.model) return E.model;
  if(!E.docId) return null;
  const d = await M.docGet(E.docId).catch(()=>null); if(!d || !d.blob) return null;
  const wb = XLSX.read(await d.blob.arrayBuffer(), {type:'array'});
  const model = M.ecrModelFrom(wb); if(!model) return null;
  E.model = model; M.save(); return model;
};

/* ---------------- write the entries back into the original workbook ---------------- */
const XNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
M.ecrWriteBack = async function(E){
  const model = E.model; const d = await M.docGet(E.docId); if(!d || !d.blob) throw new Error('The original ECR file is not on this device. Upload it again in Classes.');
  await M.loadScript('vendor/jszip.min.js');
  const zip = await JSZip.loadAsync(await d.blob.arrayBuffer()); const P = new DOMParser(), X = new XMLSerializer();
  const read = async (p) => zip.file(p) ? P.parseFromString(await zip.file(p).async('string'), 'application/xml') : null;
  const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels');
  const relEls = [...rels.getElementsByTagName('Relationship')];
  const pathOf = (name) => { const el = [...wb.getElementsByTagNameNS(XNS,'sheet')].find(s => s.getAttribute('name') === name); if(!el) return null; const t = relEls.find(r => r.getAttribute('Id') === el.getAttributeNS(RNS,'id')).getAttribute('Target'); return t.startsWith('/') ? t.slice(1) : 'xl/'+t; };
  const open = async (name) => { const p = pathOf(name); if(!p) return null; const doc = await read(p);
    const sd = doc.getElementsByTagNameNS(XNS,'sheetData')[0]; const cells = new Map(); [...doc.getElementsByTagNameNS(XNS,'c')].forEach(c => cells.set(c.getAttribute('r'), c));
    const rows = new Map(); [...sd.getElementsByTagNameNS(XNS,'row')].forEach(r => rows.set(+r.getAttribute('r'), r));
    const cellAt = (ref) => { let c = cells.get(ref); if(c) return c; const m = ref.match(/^([A-Z]+)(\d+)$/); const rn = +m[2];
      let row = rows.get(rn); if(!row){ row = doc.createElementNS(XNS,'row'); row.setAttribute('r', rn); const after = [...rows.keys()].filter(k=>k>rn).sort((a,b)=>a-b)[0]; sd.insertBefore(row, after ? rows.get(after) : null); rows.set(rn, row); }
      c = doc.createElementNS(XNS,'c'); c.setAttribute('r', ref); const after = [...row.getElementsByTagNameNS(XNS,'c')].find(x => cIdx(x.getAttribute('r').match(/^[A-Z]+/)[0]) > cIdx(m[1]));
      // new cells borrow the style of the cell to their left
      const prev = [...row.getElementsByTagNameNS(XNS,'c')].filter(x => cIdx(x.getAttribute('r').match(/^[A-Z]+/)[0]) < cIdx(m[1])).pop(); if(prev && prev.getAttribute('s')) c.setAttribute('s', prev.getAttribute('s'));
      row.insertBefore(c, after || null); cells.set(ref, c); return c; };
    const isF = (c) => !!c.getElementsByTagNameNS(XNS,'f')[0];
    // constants (typed entries)
    const put = (ref, v) => { const c = cellAt(ref); if(isF(c)) return; while(c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t'); if(v === '' || v === null || v === undefined) return;
      if(typeof v === 'number' && isFinite(v)){ const e = doc.createElementNS(XNS,'v'); e.textContent = String(v); c.appendChild(e); return; }
      c.setAttribute('t','inlineStr'); const is = doc.createElementNS(XNS,'is'), t = doc.createElementNS(XNS,'t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve'); t.textContent = String(v); is.appendChild(t); c.appendChild(is); };
    // cached result of a formula cell (so previews show the new values); Excel recalculates anyway
    const cache = (ref, v) => { const c = cells.get(ref); if(!c || !isF(c)) return; const old = c.getElementsByTagNameNS(XNS,'v')[0]; if(old) c.removeChild(old);
      if(v === null || v === undefined || v === ''){ c.setAttribute('t','str'); const e = doc.createElementNS(XNS,'v'); e.textContent = ''; c.appendChild(e); return; }
      if(typeof v === 'number'){ c.removeAttribute('t'); } else c.setAttribute('t','str');
      const e = doc.createElementNS(XNS,'v'); e.textContent = String(v); c.appendChild(e); };
    return {doc, path: p, put, cache, cells, isF};
  };
  // INPUT DATA
  if(model.inputSheet){ const S = await open(model.inputSheet);
    if(S){ Object.entries(model.infoRefs).forEach(([k, ref]) => { const v = model.info[k]; S.put(ref, /^\d+$/.test(String(v||'')) && k !== 'sy' ? +v : (v||'')); });
      ['M','F'].forEach(sx => { const rr = model.rosterRefs[sx]; if(!rr) return; model.roster[sx].forEach((n, i) => S.put(rr.col + (rr.row + i), n || '')); });
      zip.file(S.path, X.serializeToString(S.doc)); } }
  // TERM sheets
  for(const [t, T] of Object.entries(model.terms)){
    const S = await open(T.sheet); if(!S) continue;
    KEYS.forEach(k => { T.cols[k].items.forEach((L, j) => S.put(L + T.hpsRow, T.hps[k][j])); if(T.wCell[k]) S.put(T.wCell[k] + T.hpsRow, T.w[k]); });
    T.cols.ex.wsSub.forEach((L, j) => S.put(L + T.hpsRow, T.exW[j]));
    const hT = {ww: cnt(T.hps.ww) ? sum(T.hps.ww) : '', pt: cnt(T.hps.pt) ? sum(T.hps.pt) : ''};
    if(T.cols.ww.total) S.cache(T.cols.ww.total + T.hpsRow, hT.ww); if(T.cols.pt.total) S.cache(T.cols.pt.total + T.hpsRow, hT.pt);
    ['M','F'].forEach(sx => T.scores[sx].forEach((s, i) => { const r = T.rows[sx] + i;
      KEYS.forEach(k => T.cols[k].items.forEach((L, j) => S.put(L + r, s[k][j])));
      const o = calc(model, T, s); const V = (x) => isNum(x) ? x : '';
      S.cache(T.nameC + r, model.roster[sx][i] || '');
      ['ww','pt'].forEach(k => { const C = T.cols[k]; if(C.total) S.cache(C.total + r, V(o[k+'Total'])); if(C.ps) S.cache(C.ps + r, V(o[k+'PS'])); if(C.ws) S.cache(C.ws + r, V(o[k+'WS'])); });
      T.cols.ex.wsSub.forEach((L, j) => S.cache(L + r, V(o.exSub[j]))); if(T.cols.ex.ps) S.cache(T.cols.ex.ps + r, V(o.exPS)); if(T.cols.ex.ws) S.cache(T.cols.ex.ws + r, V(o.exWS));
      if(T.igC) S.cache(T.igC + r, V(o.ig)); if(T.tgC) S.cache(T.tgC + r, V(o.tg)); if(T.dsC) S.cache(T.dsC + r, o.desc || '');
    }));
    zip.file(S.path, X.serializeToString(S.doc));
  }
  // FINAL GRADES: cached values for the rows that point at the term sheets (shared formulas: learn each column's role from the cells that spell it out)
  if(model.finalSheet){ const S = await open(model.finalSheet);
    if(S){ const T0 = Object.values(model.terms)[0]; const off = {}; const colType = {};
      const fx = (c) => { const f = c.getElementsByTagNameNS(XNS,'f')[0]; return f && f.textContent ? f.textContent : ''; };
      // 1) where the male/female learner rows start (from cells pointing at a term sheet's learner rows)
      for(const [ref, c] of S.cells){ const tx = fx(c); const m = tx.match(/'?(?:TERM|QUARTER|Q)\s*([1-4])'?!\$?([A-Z]+)\$?(\d+)/i); if(!m || !T0) continue; const rn = +ref.match(/\d+$/)[0];
        ['M','F'].forEach(sx => { const i = +m[3] - T0.rows[sx]; if(i >= 0 && i < SLOTS && off[sx] === undefined) off[sx] = rn - i; }); }
      const slotOf = (rn) => { const sx = ['M','F'].find(x => off[x] !== undefined && rn - off[x] >= 0 && rn - off[x] < SLOTS && (x === 'F' || off.F === undefined || rn < off.F)); return sx ? [sx, rn - off[sx]] : null; };
      // 2) what each column holds, read from learner-row formulas only
      for(const [ref, c] of S.cells){ const tx = fx(c); if(!tx) continue; const col = ref.match(/^[A-Z]+/)[0], rn = +ref.match(/\d+$/)[0]; if(!slotOf(rn) || colType[col]) continue;
        const m = tx.match(/'?(?:TERM|QUARTER|Q)\s*([1-4])'?!/i);
        if(m) colType[col] = 'T' + m[1]; else if(/INPUT DATA/i.test(tx)) colType[col] = 'name'; else if(/AVERAGE/i.test(tx)) colType[col] = 'avg'; else if(/passed|failed/i.test(tx)) colType[col] = 'rem'; else if(/HELPER/i.test(tx)) colType[col] = 'desc'; }
      for(const [ref, c] of S.cells){ if(!S.isF(c)) continue; const col = ref.match(/^[A-Z]+/)[0], rn = +ref.match(/\d+$/)[0]; const ty = colType[col]; if(!ty) continue;
        const sl = slotOf(rn); if(!sl) continue; const [sx, i] = sl;
        const F = finalOf(model, sx, i);
        S.cache(ref, ty === 'name' ? (model.roster[sx][i] || '') : ty[0] === 'T' ? (isNum(F.tg[+ty[1]-1]) ? F.tg[+ty[1]-1] : '') : ty === 'avg' ? (isNum(F.fin) ? F.fin : '') : ty === 'rem' ? F.rem : F.desc); }
      zip.file(S.path, X.serializeToString(S.doc)); } }
  [...wb.getElementsByTagNameNS(XNS,'calcPr')].forEach(cp => cp.setAttribute('fullCalcOnLoad','1'));
  zip.file('xl/workbook.xml', X.serializeToString(wb));
  // the calc chain may list cells that changed from formula to value — drop it, Excel rebuilds it
  const cc = relEls.find(r => /\/calcChain$/.test(r.getAttribute('Type'))); if(cc){ zip.remove('xl/calcChain.xml'); cc.parentNode.removeChild(cc); zip.file('xl/_rels/workbook.xml.rels', X.serializeToString(rels));
    const ct = await read('[Content_Types].xml'); [...ct.getElementsByTagName('Override')].filter(o => /calcChain/.test(o.getAttribute('PartName'))).forEach(o => o.parentNode.removeChild(o)); zip.file('[Content_Types].xml', X.serializeToString(ct)); }
  const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  // keep MASTRO's stored copy in step with the download
  d.blob = blob; d.size = blob.size; d.added = d.added || new Date().toISOString(); d.notes = 'Electronic class record (edited in MASTRO ' + M.today() + ')'; await M.docPut(d);
  return {blob, name: d.name};
};

/* ---------------- editor UI ---------------- */
const f2 = (v) => isNum(v) ? (Math.round(v*100)/100).toFixed(2) : '';
const f0 = (v) => isNum(v) ? String(v) : '';
function commit(E){ E.terms = M.ecrTermsFromModel(E.model); E.model.dirty = true; E.model.edited = new Date().toISOString(); clearTimeout(commit.t); commit.t = setTimeout(M.save, 350); }
// used by Assessments: put a score / highest possible score into the ECR model
M.ecrCompSlot = (T, comp) => { if(/^ww(\d)$/.test(comp)) return {k:'ww', j: +comp.slice(2) - 1};
  const want = {st1:/st\s*1|summative\s*test\s*1/i, st2:/st\s*2|summative\s*test\s*2/i, te:/^te$|term\s*exam|quarterly|exam/i}[comp];
  const labs = (T && T.labels && T.labels.ex) || []; let j = labs.findIndex(x => want && want.test(String(x)));
  if(j < 0) j = {st1:0, st2:1, te:2}[comp]; return {k:'ex', j}; };
M.ecrPutScores = function(E, term, comp, scores, hps){
  const T = E.model && E.model.terms[term]; if(!T) throw new Error(`The ECR of ${E.title} has no Term ${term} sheet.`);
  const {k, j} = M.ecrCompSlot(T, comp); if(j >= T.hps[k].length) throw new Error(`${E.title}: this ECR has no ${comp.toUpperCase()} column.`);
  if(isNum(hps)) T.hps[k][j] = hps;
  Object.entries(scores).forEach(([slot, v]) => { const sx = slot[0], i = +slot.slice(1); if(T.scores[sx] && T.scores[sx][i]) T.scores[sx][i][k][j] = v; });
  commit(E); clearTimeout(commit.t); M.save();
};
M.ecrGetScore = (E, term, comp, slot) => { const T = E.model && E.model.terms[term]; if(!T) return null; const {k, j} = M.ecrCompSlot(T, comp); const r = T.scores[slot[0]] && T.scores[slot[0]][+slot.slice(1)]; return r ? r[k][j] : null; };

M.ecrEditor = async function(body, E, tab){
  body.innerHTML = '<div class="card"><div class="empty">Opening the ECR…</div></div>';
  let model;
  try { model = await M.ecrEnsureModel(E); } catch(e){ console.error(e); }
  if(!model){ body.innerHTML = `<div class="card"><div class="empty">MASTRO could not read this ECR's layout for editing${E.docId?'':' (the ECR file is not on this device — upload it with “Update from new ECR file”)'}. The in-app editor works with the DepEd ECR layout (INPUT DATA, TERM 1–3, FINAL GRADES, HELPER).</div></div>`; return; }
  const terms = Object.keys(model.terms).sort();
  const ui = M.ecrUI = M.ecrUI && M.ecrUI.id === E.id ? M.ecrUI : {id:E.id, empty:false};
  tab = tab || ui.tab || terms[0] || 'input'; ui.tab = tab;
  body.innerHTML = `
  <div class="card ecr-ed-head"><div class="row">
    <div class="seg" id="edTabs">${[['input','Input data'], ...terms.map(t => [t, 'Term '+t]), ['final','Final grades']].map(([k,l]) => `<button data-k="${k}" class="${k===tab?'on':''}">${l}</button>`).join('')}</div>
    <span class="spacer"></span>
    <span class="small ${model.dirty?'':'muted'}" id="edState">${model.dirty ? '● Edited in MASTRO — not yet in your Excel file' : 'In step with your ECR file'}</span>
    <button class="btn primary" id="edDl">${ico('download')} Download updated ECR</button>
  </div>
  <p class="tiny muted" style="margin:10px 0 0">Type scores like in Excel — <b>Enter</b> moves down, <b>Tab</b> moves right. Totals, PS, WS, Initial Grade, Term Grade and Descriptor use your ECR's own formulas and transmutation table. Changes are saved on this device as you type.</p></div>
  <div id="edBody" style="margin-top:20px"></div>`;
  $('#edTabs').onclick = e => { const b = e.target.closest('button'); if(!b) return; location.hash = `#classes/${E.id}/edit/${b.dataset.k}`; };
  $('#edDl').onclick = async () => { const btn = $('#edDl'); btn.disabled = true; btn.textContent = 'Preparing…';
    try { const r = await M.ecrWriteBack(E); M.downloadBlob(r.blob, r.name); model.dirty = false; M.save(); $('#edState').textContent = 'In step with your ECR file'; $('#edState').classList.add('muted'); M.toast('Updated ECR downloaded — formulas kept'); }
    catch(e){ console.error(e); alert('Could not write the ECR: ' + e.message); }
    btn.disabled = false; btn.innerHTML = `${ico('download')} Download updated ECR`; };
  const eb = $('#edBody');
  const mark = () => { const s = $('#edState'); if(s){ s.textContent = '● Edited in MASTRO — not yet in your Excel file'; s.classList.remove('muted'); } };
  if(tab === 'input') return inputTab(eb, E, model, mark);
  if(tab === 'final') return finalTab(eb, E, model);
  if(model.terms[tab]) return termTab(eb, E, model, tab, ui, mark);
  eb.innerHTML = '<div class="card"><div class="empty">Not found.</div></div>';
};

function inputTab(eb, E, model, mark){
  eb.innerHTML = `<div class="grid g-2">
    <div class="card"><h2>School &amp; class</h2><div class="grid g-2" style="gap:12px">${Object.keys(model.infoRefs).map(k => `<label class="field"><span>${INFO_LABEL[k]} <span class="tiny muted">· ${model.infoRefs[k]}</span></span><input class="input" data-info="${k}" value="${esc(model.info[k]||'')}"></label>`).join('') || '<div class="empty small">No labelled fields found on INPUT DATA.</div>'}</div></div>
    <div class="card"><h2>Learners</h2><p class="small muted" style="margin-top:0">Names flow to every term sheet and FINAL GRADES, exactly as in the ECR. Format: <b>Last, First Middle</b>.</p>
      <div class="grid g-2" style="gap:14px">${['M','F'].map(sx => `<div><h3>${sx==='M'?'Male':'Female'} <span class="tiny muted">${model.roster[sx].filter(Boolean).length} of ${SLOTS}</span></h3>
        <div class="ecr-names">${model.roster[sx].map((n, i) => `<label><span>${i+1}</span><input class="input" data-sx="${sx}" data-i="${i}" value="${esc(n)}"></label>`).join('')}</div></div>`).join('')}</div></div>
  </div>`;
  eb.addEventListener('input', e => { const x = e.target;
    if(x.dataset.info){ model.info[x.dataset.info] = x.value; if(x.dataset.info==='section'){ E.section = x.value.trim().toUpperCase(); E.title = `Grade ${model.info.grade||E.grade} – ${E.section}`; } if(x.dataset.info==='grade'){ E.grade = x.value.trim(); E.title = `Grade ${E.grade} – ${E.section}`; } if(x.dataset.info==='subject') E.subject = x.value.trim(); }
    else if(x.dataset.sx){ model.roster[x.dataset.sx][+x.dataset.i] = x.value.trim(); }
    else return;
    commit(E); mark(); });
  eb.addEventListener('keydown', e => { const x = e.target; if(e.key !== 'Enter' || !x.dataset.sx) return; e.preventDefault(); const n = eb.querySelector(`[data-sx="${x.dataset.sx}"][data-i="${+x.dataset.i+1}"]`); if(n){ n.focus(); n.select(); } });
}

function termTab(eb, E, model, t, ui, mark){
  const T = model.terms[t];
  const cols = []; // [{k, j}] editable item columns in order
  KEYS.forEach(k => T.hps[k].forEach((_, j) => cols.push({k, j})));
  const nItems = {ww:T.hps.ww.length, pt:T.hps.pt.length, ex:T.hps.ex.length};
  const head1 = `<tr class="h1"><th class="sticky-col" rowspan="2">Learner</th>
    <th colspan="${nItems.ww+3}" class="g-ww">WRITTEN / ORAL WORKS · <input class="w-in" data-w="ww" value="${Math.round(T.w.ww*100)}" inputmode="decimal">%</th>
    <th colspan="${nItems.pt+3}" class="g-pt">PERFORMANCE TASKS · <input class="w-in" data-w="pt" value="${Math.round(T.w.pt*100)}" inputmode="decimal">%</th>
    <th colspan="${nItems.ex+2}" class="g-ex">EXAMINATIONS · <input class="w-in" data-w="ex" value="${Math.round(T.w.ex*100)}" inputmode="decimal">%</th>
    <th rowspan="2">Initial<br>Grade</th><th rowspan="2">Term<br>Grade</th><th rowspan="2">Descriptor</th></tr>`;
  const lab = (k, j) => esc(T.labels[k][j] || (j+1));
  const head2 = `<tr class="h2">${['ww','pt'].map(k => T.hps[k].map((_, j) => `<th>${lab(k,j)}</th>`).join('') + '<th class="cm">Total</th><th class="cm">PS</th><th class="cm">WS</th>').join('')}${T.hps.ex.map((_, j) => `<th>${lab('ex',j)}<div class="tiny muted">${f0(T.exW[j])}%</div></th>`).join('')}<th class="cm">PS</th><th class="cm">WS</th></tr>`;
  const hpsRow = `<tr class="hps"><td class="sticky-col"><b>HIGHEST POSSIBLE SCORE</b></td>${['ww','pt'].map(k => T.hps[k].map((h, j) => `<td><input class="sc" data-hk="${k}" data-j="${j}" value="${f0(h)}" inputmode="decimal"></td>`).join('') + `<td class="cm" data-ht="${k}">${f0(cnt(T.hps[k])?sum(T.hps[k]):null)}</td><td class="cm">${f0(T.psMax[k])}</td><td class="cm">${T.w[k]}</td>`).join('')}${T.hps.ex.map((h, j) => `<td><input class="sc" data-hk="ex" data-j="${j}" value="${f0(h)}" inputmode="decimal"></td>`).join('')}<td class="cm">${f0(T.psMax.ex)}</td><td class="cm">${T.w.ex}</td><td></td><td></td><td></td></tr>`;
  const row = (sx, i) => { const s = T.scores[sx][i]; const o = calc(model, T, s); const name = model.roster[sx][i];
    return `<tr data-r="${sx}${i}" class="${!name?'emptyslot':''}"><td class="sticky-col"><span class="muted tiny">${i+1}</span> ${esc(name||'—')}</td>
      ${['ww','pt'].map(k => s[k].map((v, j) => `<td><input class="sc" data-sx="${sx}" data-i="${i}" data-k="${k}" data-j="${j}" value="${f0(v)}" inputmode="decimal"></td>`).join('') + `<td class="cm" data-o="${k}Total">${f0(o[k+'Total'])}</td><td class="cm" data-o="${k}PS">${f2(o[k+'PS'])}</td><td class="cm" data-o="${k}WS">${f2(o[k+'WS'])}</td>`).join('')}
      ${s.ex.map((v, j) => `<td><input class="sc" data-sx="${sx}" data-i="${i}" data-k="ex" data-j="${j}" value="${f0(v)}" inputmode="decimal"></td>`).join('')}<td class="cm" data-o="exPS">${f2(o.exPS)}</td><td class="cm" data-o="exWS">${f2(o.exWS)}</td>
      <td class="cm" data-o="ig">${f2(o.ig)}</td><td class="tg ${isNum(o.tg)&&o.tg<75?'low':''}" data-o="tg">${f0(o.tg)}</td><td class="ds" data-o="desc">${o.desc?`<span class="desc d-${o.desc}">${o.desc}</span>`:''}</td></tr>`; };
  const span = 1 + nItems.ww + 3 + nItems.pt + 3 + nItems.ex + 2 + 3;
  const body = ['M','F'].map(sx => `<tr class="group"><td class="sticky-col">${sx==='M'?'MALE':'FEMALE'}</td><td colspan="${span-1}"></td></tr>` +
    model.roster[sx].map((n, i) => (n || ui.empty) ? row(sx, i) : '').join('')).join('');
  const A = M.ecrTermsFromModel(model)[t]; const st = A ? M.stats(A.learners.map(x => x.tg)) : null;
  eb.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0">Term ${t} <span class="tiny muted">sheet “${esc(T.sheet)}”</span></h2><span class="spacer"></span>
      ${st && st.n ? `<span class="chip">mean ${fmt(st.mean)}</span><span class="chip">${st.passed}/${st.n} reached 75</span>` : ''}
      <label class="row small" style="cursor:pointer;gap:6px"><input type="checkbox" id="edEmpty" ${ui.empty?'checked':''}> Show empty rows</label></div>
    <div class="table-wrap ecr-grid-wrap"><table class="ecr-grid"><thead>${head1}${head2}</thead><tbody>${hpsRow}${body}</tbody></table></div></div>`;
  $('#edEmpty', eb).onchange = e => { ui.empty = e.target.checked; termTab(eb, E, model, t, ui, mark); };
  const refresh = (sx, i) => { const tr = eb.querySelector(`tr[data-r="${sx}${i}"]`); if(!tr) return; const o = calc(model, T, T.scores[sx][i]);
    $$('[data-o]', tr).forEach(td => { const k = td.dataset.o; const v = o[k];
      if(k === 'desc') td.innerHTML = v ? `<span class="desc d-${v}">${v}</span>` : '';
      else if(k === 'tg'){ td.textContent = f0(v); td.classList.toggle('low', isNum(v) && v < 75); }
      else td.textContent = /Total$/.test(k) ? f0(v) : f2(v); }); };
  const val = (x) => { const s = x.value.trim(); if(s === '') return null; const n = +s; return isFinite(n) ? n : NaN; };
  eb.addEventListener('input', e => { const x = e.target;
    if(x.classList.contains('sc')){ const v = val(x); if(Number.isNaN(v)){ x.classList.add('bad'); return; } x.classList.remove('bad');
      if(x.dataset.hk){ const k = x.dataset.hk; if(isNum(v) && v < 0){ x.classList.add('bad'); return; } T.hps[k][+x.dataset.j] = v; const ht = eb.querySelector(`[data-ht="${k}"]`); if(ht) ht.textContent = f0(cnt(T.hps[k])?sum(T.hps[k]):null);
        ['M','F'].forEach(sx => model.roster[sx].forEach((n, i) => refresh(sx, i))); }
      else { const {sx, i, k, j} = x.dataset; const h = T.hps[k][+j]; x.classList.toggle('over', isNum(v) && isNum(h) && v > h); T.scores[sx][+i][k][+j] = v; refresh(sx, +i); }
      commit(E); mark(); }
    else if(x.classList.contains('w-in')){ const v = val(x); if(!isNum(v) || v < 0 || v > 100){ x.classList.add('bad'); return; } x.classList.remove('bad'); T.w[x.dataset.w] = v/100; ['M','F'].forEach(sx => model.roster[sx].forEach((n, i) => refresh(sx, i))); commit(E); mark(); }
  });
  // Excel-like keys: Enter = down, Shift+Enter = up, arrows up/down
  eb.addEventListener('keydown', e => { const x = e.target; if(!x.classList.contains('sc')) return;
    const dir = e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0; if(!dir) return; e.preventDefault();
    const k = x.dataset.k || x.dataset.hk, j = x.dataset.j;
    const list = [...eb.querySelectorAll(`input.sc[data-k="${k}"][data-j="${j}"], input.sc[data-hk="${k}"][data-j="${j}"]`)];
    const n = list[list.indexOf(x) + dir]; if(n){ n.focus(); n.select(); } });
  eb.addEventListener('focusin', e => { if(e.target.classList.contains('sc')) e.target.select(); });
}

function finalTab(eb, E, model){
  const rows = ['M','F'].map(sx => `<tr class="group"><td class="sticky-col" colspan="7">${sx==='M'?'MALE':'FEMALE'}</td></tr>` + model.roster[sx].map((n, i) => { if(!n) return ''; const F = finalOf(model, sx, i);
    return `<tr><td class="muted">${i+1}</td><td class="sticky-col">${esc(n)}</td>${F.tg.map(v => `<td class="num">${f0(v)}</td>`).join('')}<td class="num"><b class="${isNum(F.fin)&&F.fin<75?'low':''}">${f0(F.fin)}</b></td><td>${F.desc?`<span class="desc d-${F.desc}">${F.desc}</span>`:''}</td><td>${F.rem}</td></tr>`; }).join('')).join('');
  eb.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0">Final grades</h2><span class="spacer"></span><button class="btn sm" id="fgP">${ico('print')} Print</button></div>
    <p class="small muted">Final grade = average of the three term grades (rounded), as in the ECR's FINAL GRADES sheet. Shown once all three terms have grades.</p>
    <div class="table-wrap"><table><thead><tr><th>#</th><th class="sticky-col">Learner</th><th class="num">Term 1</th><th class="num">Term 2</th><th class="num">Term 3</th><th class="num">Final</th><th>Descriptor</th><th>Remark</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  $('#fgP', eb).onclick = () => M.doPrint(M.printHeader('FINAL GRADES') + `<p>Grade &amp; Section: <b>${esc(E.title)}</b> &nbsp; Learning Area: <b>${esc(E.subject)}</b> &nbsp; School Year: <b>${esc(model.info.sy||E.sy||'')}</b></p>` + eb.querySelector('table').outerHTML + M.printSign(M.cls(), 'Prepared by:', 'Noted by:').replace('Class Adviser','Subject Teacher'));
}
})();
