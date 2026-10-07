/* MASTRO — Classes: electronic class records (ECR) for every section you teach, with "Analyze" reports.
   Reads DepEd-style ECRs (Written Works · Performance Tasks · Quarterly/Term Assessment · Initial/Term Grade).
   If a workbook has another layout, a simple column picker is offered instead. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum} = M;
const str = (v) => String(v ?? '').replace(/\s+/g,' ').trim();
const num = (v) => { if(typeof v === 'number' && isFinite(v)) return v; const s = str(v); if(s==='' || isNaN(+s)) return null; return +s; };
const colLet = (n) => { let s=''; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; };
const colIdx = (L) => L.toUpperCase().split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64, 0) - 1;
const termOf = (name, rows) => {
  let m = String(name).match(/(?:^|[^a-z])(?:q|quarter|term|t|trm)\s*[-_ ]?\s*([1-4])\b/i) || String(name).match(/\b([1-4])\s*(?:st|nd|rd|th)\b/i);
  if(m) return m[1];
  const words = {first:'1', second:'2', third:'3', fourth:'4'};
  for(const r of rows.slice(0, 12)) for(const v of (r||[])){ const t = str(v).toLowerCase(); const w = t.match(/(first|second|third|fourth)\s*(quarter|term)/); if(w) return words[w[1]]; const n = t.match(/(quarter|term)\s*([1-4])/); if(n) return n[2]; }
  return null;
};

/* ---------------- ECR parser ---------------- */
M.parseECR = function(wb){
  const out = {meta:{}, terms:{}};
  const reWW = /written|oral\s*works?|\(\s*wws?\s*\)/i, rePT = /performance\s*tasks?|\(\s*pts?\s*\)/i, reEX = /exam|assessment|\(\s*exs?\s*\)/i;
  wb.SheetNames.forEach(sn => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, raw:true, defval:null});
    // metadata labels (skip the ":" cells used in DepEd ECRs)
    rows.slice(0, 40).forEach(r => (r||[]).forEach((v, i) => { const t = str(v).toLowerCase().replace(/\s*:$/,''); if(!t || t.length > 30) return;
      const next = () => { for(let j=i+1;j<(r||[]).length && j<i+8;j++){ const x = str(r[j]); if(x && x !== ':') return x; } return ''; };
      if(/^grade\s*(&|and)\s*section$/.test(t) && !out.meta.gradeSection) out.meta.gradeSection = next();
      if(/^grade(\s*level)?$/.test(t) && !out.meta.grade) out.meta.grade = next();
      if(/^section$/.test(t) && !out.meta.section) out.meta.section = next();
      if(/^(subject|learning\s*area)$/.test(t) && !out.meta.subject) out.meta.subject = next();
      if(/^(subject\s*)?teacher$/.test(t) && !out.meta.teacher) out.meta.teacher = next();
      if(/^school\s*year$/.test(t) && !out.meta.sy) out.meta.sy = next(); }));
    // header row = the row naming the WW and PT components
    let hr = -1;
    for(let r=0; r<Math.min(rows.length, 45) && hr<0; r++){ const R = (rows[r]||[]).map(str); if(R.some(x => reWW.test(x)) && R.some(x => rePT.test(x))) hr = r; }
    if(hr < 0) return;
    const term = termOf(sn, rows); if(!term) return;
    const findIn = (re, r0, r1, not) => { for(let r=r0; r<=r1; r++){ const R = rows[r]||[]; for(let c=0;c<R.length;c++){ const t = str(R[c]); if(re.test(t) && !(not && not.test(t))) return c; } } return -1; };
    const starts = [['ww', findIn(reWW, hr, hr)], ['pt', findIn(rePT, hr, hr)], ['qa', findIn(reEX, hr, hr, /initial|grade/i)]].filter(x => x[1] >= 0).sort((a,b)=>a[1]-b[1]);
    const igC = findIn(/initial\s*grade/i, hr, hr+3);
    const tgC = findIn(/(term|quarterly|transmuted|final|quarter)\s*grade/i, hr, hr+3, /initial/i);
    let subR = hr+1; for(let r=hr+1; r<=hr+4; r++) if((rows[r]||[]).some(v => /^ps$/i.test(str(v)))) { subR = r; break; }
    let hpsR = -1; for(let r=hr; r<=hr+7; r++) if((rows[r]||[]).some(v => /highest\s*possible|^hps$/i.test(str(v)))) { hpsR = r; break; }
    if(hpsR < 0) hpsR = subR + 1;
    const sub = (rows[subR]||[]).map(str), hps = rows[hpsR]||[];
    const comp = {};
    starts.forEach(([k, c0], i) => {
      const end = (i+1 < starts.length ? starts[i+1][1] : (igC >= 0 ? igC : (tgC >= 0 ? tgC : c0+14))) - 1;
      const items = []; let total, ps, ws;
      for(let c=c0; c<=end; c++){ const t = sub[c];
        if(/^\d{1,2}$/.test(t) || /^(st\s*\d+|te|pe|qa|exam\s*\d*|q\d)$/i.test(t)) items.push(c);
        else if(/^total$/i.test(t)) total = c; else if(/^ps$/i.test(t)) ps = c; else if(/^ws$/i.test(t)) ws = c; }
      const wPct = (str((rows[hr]||[])[c0]).match(/(\d+)\s*%/)||[])[1];
      let w = wPct ? +wPct : (ws!==undefined ? num(hps[ws]) : null); if(isNum(w) && w <= 1) w = Math.round(w*100);
      comp[k] = {items, total, ps, ws, w, labels: items.map(c => sub[c]), hps: items.map(c => num(hps[c]))};
    });
    // learner name column = the text column left of the first component
    const firstC = starts[0][1]; const counts = {};
    rows.slice(hpsR+1, hpsR+60).forEach(r => (r||[]).slice(0, firstC).forEach((v,c) => { const t = str(v); if(/[a-z]{2,}/i.test(t) && !/^(male|female|boys?|girls?)$/i.test(t)) counts[c] = (counts[c]||0)+1; }));
    const nameC = +((Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]||[])[0] ?? 1);
    let sex = '';
    const learners = [];
    for(let r = hpsR+1; r < rows.length; r++){
      const R = rows[r]||[]; const lead = [0,1,2,nameC].map(c => str(R[c])).join(' ').trim();
      if(/^(male|boys?)$/i.test(lead) || /^\s*(male|boys?)\s*$/i.test(str(R[1])) || /^\s*(male|boys?)\s*$/i.test(str(R[0]))) { sex = 'M'; continue; }
      if(/^(female|girls?)$/i.test(lead) || /^\s*(female|girls?)\s*$/i.test(str(R[1])) || /^\s*(female|girls?)\s*$/i.test(str(R[0]))) { sex = 'F'; continue; }
      const nm = str(R[nameC]);
      if(!nm || !/[a-z]{2,}/i.test(nm) || /total|average|prepared|checked|noted|submitted|highest/i.test(lead)) continue;
      const rec = {name: nm.replace(/\s*,\s*/, ', '), sex};
      let any = false;
      Object.entries(comp).forEach(([k, cp]) => {
        rec[k] = cp.items.map(c => num(R[c])); if(rec[k].some(isNum)) any = true;
        rec[k+'Total'] = cp.total!==undefined ? num(R[cp.total]) : null;
        rec[k+'PS'] = cp.ps!==undefined ? num(R[cp.ps]) : null;
        rec[k+'WS'] = cp.ws!==undefined ? num(R[cp.ws]) : null;
        if(rec[k+'PS']===null && cp.items.length){ const got = rec[k].map((v,i) => [v, cp.hps[i]]).filter(([v,h]) => isNum(h) && h>0);
          const hp = got.reduce((a,[,h])=>a+h,0); if(hp && got.some(([v])=>isNum(v))) rec[k+'PS'] = M.r2(got.reduce((a,[v])=>a+(v||0),0)/hp*100); }
        if(isNum(rec[k+'PS'])) rec[k+'PS'] = M.r2(rec[k+'PS']);
      });
      rec.ig = igC >= 0 ? num(R[igC]) : null; rec.tg = tgC >= 0 ? num(R[tgC]) : null;
      if(isNum(rec.ig)) rec.ig = M.r2(rec.ig);
      rec.noScores = !any && rec.tg===null && rec.ig===null;
      learners.push(rec);
    }
    if(learners.some(x => !x.noScores)) out.terms[term] = {sheet: sn, comp: Object.fromEntries(Object.entries(comp).map(([k,v]) => [k, {w:v.w, hps:v.hps, n:v.items.length, labels:v.labels}])), learners};
  });
  return Object.keys(out.terms).length ? out : null;
};
function manualParse(wb, o){
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[o.sheet], {header:1, raw:true, defval:null});
  const nc = colIdx(o.nameCol), gc = colIdx(o.gradeCol); const learners = [];
  for(let r = (+o.firstRow||1)-1; r < rows.length; r++){ const R = rows[r]||[]; const nm = str(R[nc]); if(!nm || !/[a-z]{2,}/i.test(nm) || /total|average/i.test(nm)) continue; if(/^(male|female)$/i.test(nm)) continue; const g = num(R[gc]); if(g===null) continue; learners.push({name:nm, sex:'', tg:g, ig:null}); }
  return learners;
}

/* ---------------- analysis ---------------- */
M.ecrAnalyze = function(E, term){
  const T = E.terms[term]; if(!T) return null;
  const L = T.learners; const g = (x) => isNum(x.tg) ? x.tg : x.ig;
  const st = M.stats(L.map(g));
  const comps = ['ww','pt','qa'].filter(k => T.comp && T.comp[k]).map(k => ({k, label:{ww:'Written Works', pt:'Performance Tasks', qa:'Examinations / Term Assessment'}[k], w:T.comp[k].w, s:M.stats(L.map(x=>x[k+'PS']))}));
  const weakest = comps.filter(c=>c.s.n).sort((a,b)=>a.s.mean-b.s.mean)[0];
  const acts = [];
  ['ww','pt','qa'].forEach(k => { const cp = T.comp && T.comp[k]; if(!cp) return; (cp.hps||[]).forEach((h, i) => { if(!isNum(h) || h<=0) return;
    const v = L.map(x => (x[k]||[])[i]); const got = v.filter(isNum); acts.push({k, no:(cp.labels && /[a-z]/i.test(cp.labels[i]||'')) ? cp.labels[i] : i+1, hps:h, mean: got.length ? got.reduce((a,b)=>a+b,0)/got.length/h*100 : null, missing: v.filter(x=>!isNum(x)).length}); }); });
  const missingBy = L.map(x => ({x, n: ['ww','pt'].reduce((a,k) => a + ((T.comp&&T.comp[k]&&T.comp[k].hps)||[]).filter((h,i)=>isNum(h)&&h>0&&!isNum((x[k]||[])[i])).length, 0)})).filter(y => y.n).sort((a,b)=>b.n-a.n);
  const ranked = L.filter(x => isNum(g(x))).sort((a,b)=>g(b)-g(a));
  const risk = ranked.filter(x => Math.round(g(x)) < 75).reverse().map(x => { const why = [];
    comps.forEach(c => { const v = x[c.k+'PS']; if(isNum(v) && c.s.n && v < c.s.mean - 5) why.push(`low ${c.k.toUpperCase()} (${fmt(v,1)})`); });
    const ms = missingBy.find(y=>y.x===x); if(ms) why.push(`${ms.n} missing output(s)`); return {x, g:g(x), why}; });
  const bySex = ['M','F'].map(sx => ({sx, s:M.stats(L.filter(x=>x.sex===sx).map(g))}));
  // change vs previous term
  const prev = String(+term - 1); let trend = null;
  if(E.terms[prev]){ const P = E.terms[prev].learners; const key = (n) => M.normName(n);
    const pairs = L.map(x => { const p = P.find(y => key(y.name)===key(x.name)); return p && isNum(g(x)) && isNum(g(p)) ? {x, d:g(x)-g(p), was:g(p)} : null; }).filter(Boolean);
    trend = {prevMean: M.stats(P.map(g)).mean, drops: pairs.filter(p=>p.d<=-3).sort((a,b)=>a.d-b.d), gains: pairs.filter(p=>p.d>=3).sort((a,b)=>b.d-a.d)}; }
  return {T, L, g, st, comps, weakest, acts, lowActs: acts.filter(a=>isNum(a.mean)).sort((a,b)=>a.mean-b.mean).slice(0,5), missingBy, ranked, risk, bySex, trend};
};

/* ---------------- Add a class: blank ECR that keeps every formula ---------------- */
const XNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const cNum = (L) => L.split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64, 0);
const cLet = (n) => { let s=''; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; };
M.buildECR = async function(buf, info){
  await M.loadScript('vendor/jszip.min.js');
  const zip = await JSZip.loadAsync(buf); const P = new DOMParser(), X = new XMLSerializer();
  const read = async (p) => zip.file(p) ? P.parseFromString(await zip.file(p).async('string'), 'application/xml') : null;
  const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels'), sstDoc = await read('xl/sharedStrings.xml');
  const sis = sstDoc ? [...sstDoc.getElementsByTagNameNS(XNS,'si')] : [];
  const sst = sis.map(si => [...si.getElementsByTagNameNS(XNS,'t')].map(t=>t.textContent).join(''));
  const relEls = [...rels.getElementsByTagName('Relationship')];
  const sheets = [...wb.getElementsByTagNameNS(XNS,'sheet')].map(el => { const t = relEls.find(r => r.getAttribute('Id') === el.getAttributeNS(RNS,'id')).getAttribute('Target'); return {name: el.getAttribute('name'), path: t.startsWith('/') ? t.slice(1) : 'xl/'+t}; });
  const used = new Set();
  for(const sht of sheets){
    const doc = P.parseFromString(await zip.file(sht.path).async('string'), 'application/xml');
    const cells = new Map(); [...doc.getElementsByTagNameNS(XNS,'c')].forEach(c => cells.set(c.getAttribute('r'), c));
    const txt = (c) => { if(!c) return ''; const t = c.getAttribute('t'); const v = c.getElementsByTagNameNS(XNS,'v')[0];
      if(t==='s') return v ? (sst[+v.textContent]||'') : ''; if(t==='inlineStr') return [...c.getElementsByTagNameNS(XNS,'t')].map(n=>n.textContent).join(''); return v ? v.textContent : ''; };
    const isF = (c) => !!c.getElementsByTagNameNS(XNS,'f')[0];
    const clear = (c) => { if(!c || isF(c)) return; while(c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t'); };
    const cellAt = (ref) => { let c = cells.get(ref); if(c) return c; const m = ref.match(/^([A-Z]+)(\d+)$/); const rn = +m[2];
      const sd = doc.getElementsByTagNameNS(XNS,'sheetData')[0]; let row = [...sd.getElementsByTagNameNS(XNS,'row')].find(r => +r.getAttribute('r') === rn);
      if(!row){ row = doc.createElementNS(XNS,'row'); row.setAttribute('r', rn); const after = [...sd.getElementsByTagNameNS(XNS,'row')].find(r => +r.getAttribute('r') > rn); sd.insertBefore(row, after||null); }
      c = doc.createElementNS(XNS,'c'); c.setAttribute('r', ref); const after = [...row.getElementsByTagNameNS(XNS,'c')].find(x => cNum(x.getAttribute('r').match(/^[A-Z]+/)[0]) > cNum(m[1])); row.insertBefore(c, after||null); cells.set(ref, c); return c; };
    const put = (ref, v) => { const c = cellAt(ref); if(isF(c)) return; clear(c); if(v===''||v==null) return;
      if(typeof v === 'number'){ const e = doc.createElementNS(XNS,'v'); e.textContent = String(v); c.appendChild(e); return; }
      c.setAttribute('t','inlineStr'); const is = doc.createElementNS(XNS,'is'), t = doc.createElementNS(XNS,'t'); t.textContent = String(v); is.appendChild(t); c.appendChild(is); };
    const all = [...cells.values()]; const anyF = all.some(isF);
    if(/input\s*data/i.test(sht.name)){
      // learner name lists: the columns right under "MALE" and "FEMALE"
      const lists = {};
      all.forEach(c => { const t = txt(c).trim().toUpperCase(); if(t==='MALE'||t==='FEMALE'){ const m = c.getAttribute('r').match(/^([A-Z]+)(\d+)$/); lists[t] = {col: cNum(m[1]) + 1, row: +m[2] + 1}; } });
      Object.entries(lists).forEach(([k, L]) => { for(let r=L.row; r<L.row+50; r++){ const c = cells.get(cLet(L.col)+r); if(c) clear(c); }
        (k==='MALE' ? info.males : info.females).forEach((nm, i) => put(cLet(L.col)+(L.row+i), nm)); });
      // "LABEL : value" fields
      const fields = {'GRADE LEVEL': info.grade, 'SECTION': info.section, 'SUBJECT': info.subject, 'SUBJECT TEACHER': info.teacher, 'SCHOOL YEAR': info.sy};
      all.forEach(c => { const t = txt(c).trim().toUpperCase(); if(!(t in fields)) return; const m = c.getAttribute('r').match(/^([A-Z]+)(\d+)$/);
        for(let k=1; k<=4; k++){ const ref = cLet(cNum(m[1])+k) + m[2]; const x = cells.get(ref); const tx = txt(x).trim(); if(tx === ':') continue; const v = fields[t]; put(ref, /^\d+$/.test(String(v)) ? +v : v); break; } });
    } else if(anyF){
      // score sheets: clear typed scores under the HIGHEST POSSIBLE SCORE row (formulas stay)
      const hps = all.find(c => /highest\s*possible/i.test(txt(c)));
      if(hps){ const hr = +hps.getAttribute('r').match(/\d+$/)[0];
        const subRow = hr - 1;
        all.forEach(c => { const m = c.getAttribute('r').match(/^([A-Z]+)(\d+)$/); const col = cNum(m[1]), r = +m[2];
          if(r > hr && col >= 6) clear(c);
          if(info.clearHPS && r === hr && col >= 6){ const lab = txt(cells.get(m[1]+subRow)).trim(); if(/^\d{1,2}$|^(st\s*\d+|te)$/i.test(lab)) clear(c); } });
      }
    } else if(!/helper/i.test(sht.name)) all.forEach(clear);   // scratch sheets with copied names
    // stale cached results (old names/grades) are removed; Excel recalculates on open
    all.filter(isF).forEach(c => { const v = c.getElementsByTagNameNS(XNS,'v')[0]; if(v) c.removeChild(v); });
    [...doc.getElementsByTagNameNS(XNS,'c')].forEach(c => { if(c.getAttribute('t')==='s'){ const v = c.getElementsByTagNameNS(XNS,'v')[0]; if(v) used.add(+v.textContent); } });
    zip.file(sht.path, X.serializeToString(doc));
  }
  // scrub text that is no longer used anywhere (old learner names)
  if(sstDoc){ sis.forEach((si, i) => { if(!used.has(i)){ while(si.firstChild) si.removeChild(si.firstChild); const t = sstDoc.createElementNS(XNS,'t'); si.appendChild(t); } }); zip.file('xl/sharedStrings.xml', X.serializeToString(sstDoc)); }
  const cp = wb.getElementsByTagNameNS(XNS,'calcPr')[0]; if(cp) cp.setAttribute('fullCalcOnLoad','1');
  zip.file('xl/workbook.xml', X.serializeToString(wb));
  return await zip.generateAsync({type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
};
async function ecrBase(id){
  if(id){ const d = await M.docGet(id).catch(()=>null); if(d && d.blob) return await d.blob.arrayBuffer(); }
  const r = await fetch('templates/ECR_Template.xlsx'); if(!r.ok) throw new Error('ECR template missing'); return await r.arrayBuffer();
}
function addClass(){
  const bases = M.S.ecr.filter(e => e.docId);
  const cl = M.S.classes;
  M.modal('Add a class', `
    <p class="small muted" style="margin-top:0">Creates a fresh ECR with the same layout and formulas as your class records — learner names, section, grade and all scores are cleared. Fill in the details below.</p>
    <div class="grid g-2">
      <label class="field">Grade level<input class="input" id="nG" placeholder="e.g. 8"></label>
      <label class="field">Section<input class="input" id="nS" placeholder="e.g. MAGALLANES"></label>
      <label class="field">Subject<input class="input" id="nSub" value="English"></label>
      <label class="field">School year<input class="input" id="nSY" value="${esc(String(M.cls().sy).replace('–','-'))}"></label>
      <label class="field" style="grid-column:1/-1">Subject teacher<input class="input" id="nT" value="${esc(M.S.settings.adviser||M.cls().adviser)}"></label>
      <label class="field" style="grid-column:1/-1">Copy layout from<select class="input" id="nB"><option value="">Built-in DepEd ECR 2026 (blank)</option>${bases.map(e=>`<option value="${e.docId}">${esc(e.title)} · ${esc(e.subject)}</option>`).join('')}</select></label>
      <label class="field">Male learners <span class="muted">(one per line, Last, First Middle — optional)</span><textarea class="input" id="nM" rows="6"></textarea></label>
      <label class="field">Female learners<textarea class="input" id="nF" rows="6"></textarea></label>
    </div>
    <div class="row" style="margin-top:8px"><select class="input" id="nFrom" style="width:auto"><option value="">Fill names from a MASTRO class…</option>${cl.map(c=>`<option value="${c.id}">${esc(M.className(c))}</option>`).join('')}</select>
      <label class="row small" style="cursor:pointer;gap:6px"><input type="checkbox" id="nH"> Also clear highest possible scores</label></div>
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn" id="nX">Cancel</button><button class="btn primary" id="nOk">${ico('plus')} Create ECR</button></div>`,
  b => {
    $('#nX', b).onclick = M.closeModal;
    $('#nFrom', b).onchange = e => { const c = cl.find(x => x.id === e.target.value); if(!c) return; const L = M.sortedLearners(c).filter(M.counted);
      $('#nM', b).value = L.filter(l=>l.sex==='M').map(l=>l.name).join('\n'); $('#nF', b).value = L.filter(l=>l.sex!=='M').map(l=>l.name).join('\n');
      if(!$('#nG', b).value) $('#nG', b).value = c.grade; if(!$('#nS', b).value) $('#nS', b).value = c.section; };
    $('#nOk', b).onclick = async () => {
      const info = {grade:$('#nG',b).value.trim(), section:$('#nS',b).value.trim().toUpperCase(), subject:$('#nSub',b).value.trim(), teacher:$('#nT',b).value.trim(), sy:$('#nSY',b).value.trim(),
        males:$('#nM',b).value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,50), females:$('#nF',b).value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,50), clearHPS:$('#nH',b).checked};
      if(!info.grade || !info.section) return M.toast('Enter the grade level and section');
      const btn = $('#nOk', b); btn.disabled = true; btn.textContent = 'Creating…';
      try {
        const blob = await M.buildECR(await ecrBase($('#nB',b).value), info);
        const fname = `${info.grade}-${info.section.replace(/\s+/g,'_')}_ECR.xlsx`;
        const docId = M.uid('d');
        await M.docPut({id:docId, name:fname, category:'Grades & Reports', formCode:'ECR', tags:`ECR, ${info.subject}, ${info.section}`, classId:'', notes:'Created with Add a class', mime:blob.type, size:blob.size, added:new Date().toISOString(), blob});
        M.S.ecr.push({id:M.uid('e'), title:`Grade ${info.grade} – ${info.section}`, grade:info.grade, section:info.section, subject:info.subject, sy:info.sy, terms:{}, docId, added:new Date().toISOString(),
          roster: [...info.males.map(n=>({name:n, sex:'M'})), ...info.females.map(n=>({name:n, sex:'F'}))]});
        M.save(); M.downloadBlob(blob, fname); M.closeModal(); M.route();
        M.toast('ECR created — tap “Work on ECR” to encode scores here, or fill it in Excel');
      } catch(e){ console.error(e); alert('Could not create the ECR: ' + e.message); btn.disabled = false; }
    };
  }, true);
}

/* ---------------- views ---------------- */
M.views.classes = function view(el, args){
  if(args[0]) return detail(el, args[0], args[1], args[2]);
  const L = M.S.ecr;
  el.innerHTML = `
  <div class="card"><div class="row"><div><h2 style="margin:0">Electronic class records</h2><div class="small muted">Upload the ECR of each section you teach (Excel). MASTRO reads Written Works, Performance Tasks, Quarterly/Term Assessment and the term grades for every term sheet.</div></div><span class="spacer"></span><button class="btn primary" id="eAdd">${ico('plus')} Add a class</button></div>
    <div class="drop" id="eDrop" style="margin-top:14px">${ico('upload','width:30px;height:30px;color:var(--green)')}<div><b>Drop ECR files here or tap to upload</b></div><div class="small muted">.xlsx / .xls — one file per section; you can drop several at once</div></div>
    <input type="file" id="eFile" accept=".xlsx,.xls,.xlsm" multiple hidden></div>
  ${L.length ? `<div class="grid g-3" style="margin-top:20px">${L.map(E => { const terms = Object.keys(E.terms).sort(); const last = terms[terms.length-1]; const A = last ? M.ecrAnalyze(E, last) : null; return `
    <div class="card ecr-card">
      <div class="row"><span class="chip green">${esc(E.subject||'Subject')}</span><span class="spacer"></span><span class="tiny muted">${terms.map(t=>'T'+t).join(' · ')||'no terms'}</span></div>
      <div class="title" style="margin-top:10px;font-size:17px"><b>${esc(E.title)}</b></div>
      <div class="small muted">${A?A.L.length:(E.roster||[]).length} learners${!terms.length?' · no scores uploaded yet':''}${A&&A.st.n?` · Term ${last} mean <b>${fmt(A.st.mean)}</b> · ${A.risk.length} below 75`:''}</div>
      <div class="row" style="margin-top:14px"><a class="btn sm" href="#classes/${E.id}">Open</a>${E.docId?`<a class="btn sm" href="#classes/${E.id}/edit">${ico('edit')} Work on ECR</a>`:''}${E.model&&E.model.dirty?'<span class="chip gold" title="Edited in MASTRO — download the updated ECR">edited</span>':''}<span class="spacer"></span><a class="btn sparkle" href="#classes/${E.id}/analyze/${last||'1'}">${ico('sparkle')} Analyze</a></div>
    </div>`; }).join('')}</div>` : `<div class="card" style="margin-top:20px"><div class="empty">No class records yet. Upload your ECRs to start.</div></div>`}`;
  M.dropZone($('#eDrop'), $('#eFile'), async files => { for(const f of files) await importECR(f); });
  $('#eAdd').onclick = addClass;
};
async function importECR(file){
  let wb; try { wb = XLSX.read(await file.arrayBuffer(), {type:'array'}); } catch(e){ return alert(`Could not read ${file.name}: ${e.message}`); }
  const P = M.parseECR(wb);
  const guess = (file.name.replace(/\.[^.]+$/,'').match(/(grade\s*)?(7|8|9|10|11|12)\b/i)||[])[2] || '';
  const meta = P ? P.meta : {};
  const gs = str(meta.gradeSection); const g0 = meta.grade || (gs.match(/\d{1,2}/)||[])[0] || guess; const s0 = meta.section || gs.replace(/grade|\d+|[-–:]/gi,'').trim();
  M.modal('Add class record', `
    <div class="chips" style="margin-bottom:12px"><span class="chip">${esc(file.name)}</span>${P?`<span class="chip green">Read ${Object.keys(P.terms).length} term sheet(s): ${Object.entries(P.terms).map(([t,v])=>`T${t} (${v.learners.length} learners)`).join(', ')}</span>`:'<span class="chip gold">Layout not recognized — pick the columns below</span>'}</div>
    <div class="grid g-2">
      <label class="field">Grade<input class="input" id="eG" value="${esc(g0)}"></label>
      <label class="field">Section<input class="input" id="eS" value="${esc(s0)}"></label>
      <label class="field">Subject<input class="input" id="eSub" value="${esc(meta.subject||'English')}"></label>
      <label class="field">School year<input class="input" id="eSY" value="${esc(meta.sy||M.cls().sy)}"></label>
    </div>
    ${P ? '' : `<h3 style="margin-top:14px">Column picker</h3><div class="grid g-4" style="gap:10px">
      <label class="field">Sheet<select class="input" id="mSh">${wb.SheetNames.map(n=>`<option>${esc(n)}</option>`).join('')}</select></label>
      <label class="field">Term<select class="input" id="mT"><option>1</option><option>2</option><option>3</option></select></label>
      <label class="field">Name column<input class="input" id="mN" value="B"></label>
      <label class="field">Grade column<input class="input" id="mG" placeholder="e.g. AF"></label>
      <label class="field">First learner row<input class="input" id="mR" value="12"></label></div>
      <div id="mPrev" class="table-wrap" style="max-height:200px;margin-top:10px"></div>`}
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn" id="eX">Cancel</button><button class="btn primary" id="eOk">Save class record</button></div>`,
  b => {
    $('#eX', b).onclick = M.closeModal;
    if(!P){ const prev = () => { const rows = XLSX.utils.sheet_to_json(wb.Sheets[$('#mSh',b).value], {header:1, raw:true, defval:null}).slice(0, 25);
        const w = Math.min(30, Math.max(...rows.map(r=>(r||[]).length), 1));
        $('#mPrev', b).innerHTML = `<table><thead><tr><th>#</th>${[...Array(w).keys()].map(c=>`<th>${colLet(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="muted">${i+1}</td>${[...Array(w).keys()].map(c=>`<td class="tiny">${esc(str((r||[])[c])).slice(0,16)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; };
      $('#mSh', b).onchange = prev; prev(); }
    $('#eOk', b).onclick = async () => {
      let terms;
      if(P) terms = P.terms;
      else { const ls = manualParse(wb, {sheet:$('#mSh',b).value, nameCol:$('#mN',b).value, gradeCol:$('#mG',b).value, firstRow:$('#mR',b).value}); if(!ls.length) return M.toast('No learners found with those columns'); terms = {[$('#mT',b).value]: {sheet:$('#mSh',b).value, comp:{}, learners:ls}}; }
      const grade = $('#eG',b).value.trim(), section = $('#eS',b).value.trim().toUpperCase(), subject = $('#eSub',b).value.trim();
      const docId = M.uid('d');
      await M.docPut({id:docId, name:file.name, category:'Grades & Reports', formCode:'ECR', tags:`ECR, ${subject}, ${section}`, classId:'', notes:'Electronic class record', mime:file.type, size:file.size, added:new Date().toISOString(), blob:file}).catch(()=>{});
      const ex = M.S.ecr.find(e => M.normName(e.section)===M.normName(section) && M.normName(e.subject)===M.normName(subject));
      if(ex && confirm(`Update the existing record for ${ex.title}? (Term sheets in this file replace the same terms.)${ex.model && ex.model.dirty ? '\n\nNote: scores you typed in MASTRO that are not yet in this file will be replaced by the file.' : ''}`)){ Object.assign(ex.terms, terms); ex.docId = docId; ex.model = null; ex.updated = new Date().toISOString(); }
      else M.S.ecr.push({id:M.uid('e'), title:`Grade ${grade} – ${section}`, grade, section, subject, sy:$('#eSY',b).value.trim(), terms, docId, added:new Date().toISOString()});
      M.save(); M.closeModal(); M.route(); M.toast('Class record saved');
    };
  }, true);
}
function detail(el, id, mode, termArg){
  const E = M.S.ecr.find(e => e.id === id); if(!E){ el.innerHTML = '<div class="card"><div class="empty">Class record not found.</div></div>'; return; }
  const terms = Object.keys(E.terms).sort(); const term = termArg && E.terms[termArg] ? termArg : terms[terms.length-1];
  el.innerHTML = `
  <div class="card"><div class="row">
    <a class="btn sm" href="#classes">${ico('left','width:16px;height:16px')} Classes</a>
    <div><div class="title"><b>${esc(E.title)}</b> · ${esc(E.subject)}</div><div class="small muted">SY ${esc(E.sy||'')} · ${terms.length} term(s) loaded</div></div>
    <span class="spacer"></span>
    ${mode==='edit' ? '' : `<div class="seg" id="eT">${terms.map(t=>`<button data-t="${t}" class="${t===term?'on':''}">Term ${t}</button>`).join('')}</div>`}
    ${E.docId ? `<a class="btn ${mode==='edit'?'primary':''}" href="#classes/${E.id}/edit">${ico('edit')} Work on ECR</a>` : ''}
    ${mode==='edit' ? `<a class="btn" href="#classes/${E.id}/view/${term||''}">${ico('grades')} Summary</a>` : ''}
    <a class="btn sparkle" href="#classes/${E.id}/analyze/${term||'1'}">${ico('sparkle')} Analyze</a>
  </div>
  <div class="row" style="margin-top:12px"><button class="btn sm" id="eUp">${ico('upload')} Update from new ECR file</button><input type="file" id="eUpF" accept=".xlsx,.xls,.xlsm" hidden><button class="btn sm" id="eEd">${ico('edit')} Rename</button>${E.docId?`<button class="btn sm" id="eDl">${ico('download')} Download ECR file</button>`:''}<span class="spacer"></span><button class="btn sm danger" id="eDel">Delete</button></div></div>
  <div id="eBody" style="margin-top:20px"></div>`;
  if($('#eT')) $('#eT').onclick = e => { const b = e.target.closest('button'); if(b) location.hash = `#classes/${E.id}/${mode==='analyze'?'analyze':'view'}/${b.dataset.t}`; };
  $('#eUp').onclick = () => $('#eUpF').click();
  $('#eUpF').onchange = e => { const f = e.target.files[0]; e.target.value=''; if(f) importECR(f); };
  if($('#eDl')) $('#eDl').onclick = async () => { const d = await M.docGet(E.docId); if(d && d.blob) M.downloadBlob(d.blob, d.name); else M.toast('File not found on this device'); };
  $('#eEd').onclick = () => { const t = prompt('Class record title:', E.title); if(t){ E.title = t.trim(); const s = prompt('Subject:', E.subject); if(s) E.subject = s.trim(); M.save(); M.route(); } };
  $('#eDel').onclick = () => { if(!confirm(`Delete ${E.title} · ${E.subject}?`)) return; M.S.ecr = M.S.ecr.filter(x=>x!==E); M.save(); location.hash = '#classes'; };
  const body = $('#eBody');
  if(mode === 'edit') return M.ecrEditor(body, E, termArg);
  if(mode === 'analyze') return report(body, E, term);
  const T = E.terms[term]; if(!T){ body.innerHTML = `<div class="card"><div class="empty">No scores yet. Tap <b>Work on ECR</b> to encode scores here in MASTRO, or encode them in Excel and use <b>Update from new ECR file</b>.${(E.roster||[]).length?`<div class="small" style="margin-top:10px">${E.roster.length} learners in this class.</div>`:''}</div></div>`; return; }
  const has = (k) => T.comp && T.comp[k];
  body.innerHTML = `<div class="card"><h2>Term ${term} · ${T.learners.length} learners <span class="tiny muted">(sheet “${esc(T.sheet)}”)</span></h2>
    <div class="table-wrap"><table><thead><tr><th>#</th><th class="sticky-col">Learner</th>${['ww','pt','qa'].filter(has).map(k=>`<th class="num">${k.toUpperCase()} PS${T.comp[k].w?` <span class="muted">(${T.comp[k].w}%)</span>`:''}</th>`).join('')}<th class="num">Initial</th><th class="num">Term grade</th><th>Descriptor</th></tr></thead>
    <tbody>${(() => { let last = null, i = 0; return T.learners.map(x => { const g = isNum(x.tg)?x.tg:x.ig; const d = M.descriptor(g); let pre = ''; if(x.sex && x.sex!==last){ last = x.sex; pre = `<tr class="group"><td colspan="2" class="sticky-col">${x.sex==='M'?'Male':'Female'}</td><td colspan="6"></td></tr>`; }
      return pre + `<tr><td class="muted">${++i}</td><td class="sticky-col">${esc(x.name)}</td>${['ww','pt','qa'].filter(has).map(k=>`<td class="num">${fmt(x[k+'PS'],1)}</td>`).join('')}<td class="num">${fmt(x.ig,1)}</td><td class="num"><b class="${isNum(g)&&Math.round(g)<75?'low':''}">${isNum(x.tg)?x.tg:'—'}</b></td><td>${d?`<span class="desc d-${d}">${d}</span>`:''}</td></tr>`; }).join(''); })()}</tbody></table></div></div>`;
}
function report(body, E, term){
  const A = M.ecrAnalyze(E, term); if(!A || !A.st.n){ body.innerHTML = '<div class="card"><div class="empty">No grades found for this term.</div></div>'; return; }
  const descs = {}; M.DESCS.forEach(d => descs[d] = 0); A.ranked.forEach(x => descs[M.descriptor(A.g(x))]++);
  const n = A.ranked.length;
  body.innerHTML = `
  <div class="card insight"><div class="row"><div>${ico('sparkle','width:26px;height:26px;color:var(--gold)')}</div><div class="grow">
    <div class="title"><b>Term ${term} insights · ${esc(E.title)} · ${esc(E.subject)}</b></div>
    <ul class="small" style="margin:8px 0 0;padding-left:18px;line-height:1.6">
      <li>Class mean <b>${fmt(A.st.mean)}</b> (median ${fmt(A.st.median)}, SD ${fmt(A.st.sd)}); <b>${A.st.passed}</b> of ${A.st.n} learners (${fmt(A.st.passRate,1)}%) reached 75.</li>
      ${A.weakest?`<li>Weakest component: <b>${esc(A.weakest.label)}</b> (mean PS ${fmt(A.weakest.s.mean,1)}) — ${A.comps.filter(c=>c!==A.weakest&&c.s.n).map(c=>`${c.k.toUpperCase()} ${fmt(c.s.mean,1)}`).join(', ')}.</li>`:''}
      ${A.risk.length?`<li><b>${A.risk.length} learner(s) below 75</b> need intervention${A.risk.filter(r=>r.why.some(w=>/missing/.test(w))).length?` — ${A.risk.filter(r=>r.why.some(w=>/missing/.test(w))).length} of them have missing outputs`:''}.</li>`:'<li>No learner is below 75. 🎉</li>'}
      ${A.missingBy.length?`<li><b>${A.missingBy.length} learner(s) with missing scores</b> (${A.missingBy.reduce((a,y)=>a+y.n,0)} blank entries in WW/PT).</li>`:''}
      ${A.lowActs.length?`<li>Lowest-scored activity: <b>${A.lowActs[0].k.toUpperCase()} ${A.lowActs[0].no}</b> (${fmt(A.lowActs[0].mean,1)}% of HPS ${A.lowActs[0].hps}) — consider re-teaching or re-checking the item.</li>`:''}
      ${A.trend?`<li>Compared with Term ${+term-1} (mean ${fmt(A.trend.prevMean)}): ${A.trend.drops.length} learner(s) dropped by 3+ points, ${A.trend.gains.length} improved by 3+.</li>`:''}
      ${A.bySex.every(b=>b.s.n)?`<li>Boys ${fmt(A.bySex[0].s.mean)} vs girls ${fmt(A.bySex[1].s.mean)}.</li>`:''}
    </ul></div>
    <div class="row" style="align-self:flex-start"><button class="btn sm" id="rX">${ico('download')} Excel</button><button class="btn sm primary" id="rP">${ico('print')} Print report</button></div></div></div>
  <div class="grid g-4" style="margin-top:20px">
    <div class="card stat accent"><div class="label">Mean</div><div class="value">${fmt(A.st.mean)}</div><div class="sub">median ${fmt(A.st.median)}</div></div>
    <div class="card stat"><div class="label">Mode</div><div class="value">${M.modeText(A.st)}</div><div class="sub">SD ${fmt(A.st.sd)}</div></div>
    <div class="card stat"><div class="label">Highest · Lowest</div><div class="value" style="font-size:24px">${fmt(A.st.max,0)} · ${fmt(A.st.min,0)}</div><div class="sub">range ${fmt(A.st.range,0)}</div></div>
    <div class="card stat"><div class="label">Passing (≥75)</div><div class="value">${fmt(A.st.passRate,1)}%</div><div class="sub">${A.st.passed} of ${A.st.n}</div></div>
  </div>
  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Components (mean percentage score)</h2>${A.comps.length?A.comps.map(c=>`<div class="bar-row" style="grid-template-columns:minmax(0,1.5fr) 1fr 56px"><span>${esc(c.label)}${c.w?` <span class="muted tiny">${c.w}%</span>`:''}</span><div class="bar-track"><div class="bar-fill ${c.s.mean<75?'low':''}" style="width:${c.s.n?c.s.mean:0}%"></div></div><b class="num" style="text-align:right">${fmt(c.s.mean,1)}</b></div>`).join(''):'<div class="empty small">This record only has term grades.</div>'}
      <h3 style="margin-top:18px">Proficiency</h3>
      <div class="stackbar">${M.DESCS.map(d=>descs[d]?`<span style="width:${descs[d]/n*100}%;background:${M.DESC_COLOR[d]}" title="${d}: ${descs[d]}"></span>`:'').join('')}</div>
      <div class="legend">${M.DESCS.map(d=>`<span><i style="background:${M.DESC_COLOR[d]}"></i>${d} <b>${descs[d]}</b></span>`).join('')}</div></div>
    <div class="card"><h2>Needs intervention (below 75)</h2>${A.risk.length?`<div class="list">${A.risk.map(r=>`<div class="item" style="padding:9px 12px"><div class="grow"><div class="title small">${esc(r.x.name)}</div><div class="tiny muted">${esc(r.why.join(' · ')||'overall low scores')}</div></div><b class="low">${fmt(r.g,0)}</b></div>`).join('')}</div>`:'<div class="empty">None. 🎉</div>'}</div>
  </div>
  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Activities with the lowest class average</h2>${A.lowActs.length?A.lowActs.map(a=>`<div class="bar-row"><span>${a.k.toUpperCase()} ${a.no} <span class="muted tiny">HPS ${a.hps}</span></span><div class="bar-track"><div class="bar-fill ${a.mean<75?'low':''}" style="width:${a.mean}%"></div></div><b class="num" style="text-align:right">${fmt(a.mean,1)}</b></div>`).join(''):'<div class="empty small">No item-level scores in this record.</div>'}</div>
    <div class="card"><h2>Missing scores</h2>${A.missingBy.length?`<div class="list" style="max-height:300px;overflow:auto;padding:4px">${A.missingBy.map(y=>`<div class="item" style="padding:8px 12px"><div class="grow small">${esc(y.x.name)}</div><span class="chip gold">${y.n} missing</span></div>`).join('')}</div>`:'<div class="empty small">No blank WW/PT entries. 🎉</div>'}</div>
  </div>
  ${A.trend?`<div class="card" style="margin-top:20px"><h2>Change from Term ${+term-1}</h2><div class="grid g-2"><div><h3>Dropped 3+ points</h3>${A.trend.drops.map(p=>`<div class="small">${esc(p.x.name)} — ${fmt(p.was,0)} → <b class="low">${fmt(A.g(p.x),0)}</b></div>`).join('')||'<div class="muted small">None</div>'}</div><div><h3>Improved 3+ points</h3>${A.trend.gains.map(p=>`<div class="small">${esc(p.x.name)} — ${fmt(p.was,0)} → <b style="color:var(--green)">${fmt(A.g(p.x),0)}</b></div>`).join('')||'<div class="muted small">None</div>'}</div></div></div>`:''}
  <div class="card" style="margin-top:20px"><h2>Ranking</h2><div class="table-wrap"><table><thead><tr><th class="num">#</th><th>Learner</th>${A.comps.map(c=>`<th class="num">${c.k.toUpperCase()}</th>`).join('')}<th class="num">Grade</th><th>Descriptor</th></tr></thead><tbody>
    ${A.ranked.map((x,i)=>{ const g = A.g(x), d = M.descriptor(g); return `<tr><td class="num muted">${i+1}</td><td>${esc(x.name)}</td>${A.comps.map(c=>`<td class="num">${fmt(x[c.k+'PS'],1)}</td>`).join('')}<td class="num"><b class="${Math.round(g)<75?'low':''}">${fmt(g,0)}</b></td><td><span class="desc d-${d}">${d}</span></td></tr>`; }).join('')}</tbody></table></div></div>`;
  $('#rP', body).onclick = () => printReport(E, term, A, descs);
  $('#rX', body).onclick = () => exportReport(E, term, A);
}
function printReport(E, term, A, descs){
  const c = M.cls();
  M.doPrint(M.printHeader(`CLASS RECORD ANALYSIS — TERM ${term}`) +
    `<p>Grade &amp; Section: <b>${esc(E.title)}</b> &nbsp; Learning Area: <b>${esc(E.subject)}</b> &nbsp; School Year: <b>${esc(E.sy||'')}</b></p>
    <table><thead><tr><th>Learners</th><th>Mean</th><th>Median</th><th>Mode</th><th>SD</th><th>Highest</th><th>Lowest</th><th>Passed (≥75)</th></tr></thead><tbody><tr>
    <td style="text-align:center">${A.st.n}</td><td style="text-align:center">${fmt(A.st.mean)}</td><td style="text-align:center">${fmt(A.st.median)}</td><td style="text-align:center">${M.modeText(A.st)}</td><td style="text-align:center">${fmt(A.st.sd)}</td><td style="text-align:center">${fmt(A.st.max,0)}</td><td style="text-align:center">${fmt(A.st.min,0)}</td><td style="text-align:center">${A.st.passed} (${fmt(A.st.passRate,1)}%)</td></tr></tbody></table>
    ${A.comps.length?`<p style="margin-top:10px"><b>Components:</b> ${A.comps.map(c=>`${esc(c.label)} ${fmt(c.s.mean,1)}`).join(' · ')}${A.weakest?` — weakest: <b>${esc(A.weakest.label)}</b>`:''}</p>`:''}
    <p><b>Proficiency:</b> ${M.DESCS.map(d=>`${d} ${descs[d]}`).join(' · ')}</p>
    <p><b>Below 75 (${A.risk.length}):</b> ${A.risk.map(r=>`${esc(r.x.name)} (${fmt(r.g,0)}${r.why.length?'; '+esc(r.why.join(', ')):''})`).join('; ') || 'None'}</p>
    ${A.missingBy.length?`<p><b>Missing scores:</b> ${A.missingBy.map(y=>`${esc(y.x.name)} (${y.n})`).join('; ')}</p>`:''}
    ${A.lowActs.length?`<p><b>Lowest activities:</b> ${A.lowActs.map(a=>`${a.k.toUpperCase()} ${a.no} (${fmt(a.mean,1)}%)`).join(', ')}</p>`:''}
    <table style="margin-top:10px"><thead><tr><th>#</th><th>Learner</th>${A.comps.map(c=>`<th>${c.k.toUpperCase()} PS</th>`).join('')}<th>Grade</th><th>Descriptor</th></tr></thead><tbody>${A.ranked.map((x,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${esc(x.name)}</td>${A.comps.map(c=>`<td style="text-align:center">${fmt(x[c.k+'PS'],1)}</td>`).join('')}<td style="text-align:center">${fmt(A.g(x),0)}</td><td>${M.descriptor(A.g(x))}</td></tr>`).join('')}</tbody></table>` +
    M.printSign(c, 'Prepared by:', 'Noted by:').replace('Class Adviser', 'Subject Teacher'));
}
function exportReport(E, term, A){
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${E.title} · ${E.subject} · Term ${term}`], ['Learners', A.st.n], ['Mean', +A.st.mean.toFixed(2)], ['Median', A.st.median], ['Mode', M.modeText(A.st)], ['SD', +A.st.sd.toFixed(2)], ['Highest', A.st.max], ['Lowest', A.st.min], ['Passed (≥75)', A.st.passed], ['Pass %', +A.st.passRate.toFixed(2)], [],
    ['Component','Weight %','Mean PS'], ...A.comps.map(c=>[c.label, c.w, c.s.n?+c.s.mean.toFixed(2):null]), [], ['Activity','HPS','Class mean %','Missing'], ...A.acts.map(a=>[`${a.k.toUpperCase()} ${a.no}`, a.hps, isNum(a.mean)?+a.mean.toFixed(2):null, a.missing])]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Rank','Learner','Sex',...A.comps.map(c=>c.k.toUpperCase()+' PS'),'Initial','Term grade','Descriptor','Missing scores','Notes'],
    ...A.ranked.map((x,i)=>{ const ms = A.missingBy.find(y=>y.x===x); const rk = A.risk.find(r=>r.x===x); return [i+1, x.name, x.sex, ...A.comps.map(c=>x[c.k+'PS']), x.ig, A.g(x), M.descriptor(A.g(x)), ms?ms.n:0, rk?rk.why.join('; '):'']; })]), 'Learners');
  XLSX.writeFile(wb, `ECR Analysis ${E.title} ${E.subject} T${term}.xlsx`);
}
})();
