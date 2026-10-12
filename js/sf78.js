/* MASTRO — SF7 (School Personnel Assignment List) and SF8 (Learner's Basic Health and Nutrition Report).
   MASTRO asks for the inputs, then fills the DepEd templates you sent (built in) or your own uploaded copy.
   SF8 keeps all its formulas; BMI, BMI category and height-for-age are computed with the WHO growth tables
   inside the template, exactly as the workbook does. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum} = M;
const {FORMS, fillSignatures} = M.TPL;
const dSerial = (iso) => { if(!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m-1, d) - Date.UTC(1899, 11, 30)) / 864e5; };
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };

/* =====================================================================
   SF8 — growth tables, age, BMI and status (same rules as the template's CalSheet)
   ===================================================================== */
const tabCache = {};
M.sf8Tables = async function(blob){
  const key = blob ? blob.size + ':' + (blob.lastModified || '') : 'none'; if(tabCache[key]) return tabCache[key];
  if(!blob) return null;
  const wb = XLSX.read(await blob.arrayBuffer(), {type:'array'});
  const bt = wb.Sheets['BMI Tables']; if(!bt) return null;
  const rows = XLSX.utils.sheet_to_json(bt, {header:1, raw:true, defval:null});
  const bmi = [], hfa = [];
  rows.forEach(R => { if(!R || typeof R[0] !== 'number' || typeof R[1] !== 'number' || R[1] < 60 || R[1] > 228) return; bmi.push(R.slice(0, 18)); hfa.push(R.slice(19, 33)); });
  const cs = wb.Sheets['CalSheet']; const lab = (a, d) => (cs && cs[a] && String(cs[a].v).trim()) || d;
  const L = {sw: lab('C3','Severely Wasted'), w: lab('D3','Wasted'), n: lab('F3','Normal'), ow: lab('H3','Overweight'), ob: lab('J3','Obese'), ss: lab('K3','Severely Stunted'), st: lab('L3','Stunted'), hn: lab('N3','Normal'), tall: lab('P3','Tall')};
  return tabCache[key] = {bmi, hfa, L};
};
// age in years.months at the date of assessment (CalSheet: AC & "." & 2-digit AA)
M.sf8Age = (bISO, dISO) => { if(!bISO || !dISO) return null; const [by, bm, bd] = bISO.split('-').map(Number), [cy, cm, cd] = dISO.split('-').map(Number);
  const Z = cd >= bd ? cm : cm - 1; const AA = Z >= bm ? Z - bm : Z + 12 - bm; const AB = Z >= bm ? cy : cy - 1; const AC = AB >= by ? AB - by : (AB - 1) - by;
  return {y: AC, m: AA, v: +(AC + '.' + String(AA).padStart(2, '0')), months: AC * 12 + AA}; };
const lookup = (tab, v) => { let r = null; for(const row of tab){ if(row[0] <= v + 1e-9) r = row; else break; } return r; };
M.sf8Status = (T, sex, age, w, h) => {
  const out = {h2: null, bmi: null, cat: '', hfa: ''}; if(!T || !isNum(w) || !isNum(h) || h <= 0) return out;
  out.h2 = h * h; out.bmi = w / out.h2; if(!age) return out;
  const f = sex === 'F'; const r = lookup(T.bmi, age.v); const q = lookup(T.hfa, age.v);
  if(r && age.v >= 5){ const o = f ? 8 : 0; const sw = r[2+o], wTo = r[4+o], nTo = r[6+o], owTo = r[8+o];
    out.cat = out.bmi > owTo ? T.L.ob : out.bmi > nTo ? T.L.ow : out.bmi > wTo ? T.L.n : out.bmi > sw ? T.L.w : T.L.sw; }
  if(q && age.v >= 5){ const o = f ? 6 : 0; const cm = h * 100; const ss = q[2+o], stTo = q[4+o], nTo = q[6+o];
    out.hfa = cm > nTo ? T.L.tall : cm > stTo ? T.L.hn : cm > ss ? T.L.st : T.L.ss; }
  return out;
};
const sf8Data = (c) => { c.sf8 = c.sf8 || {}; const d = c.sf8; d.rows = d.rows || {}; d.date = d.date || M.today(); d.by = d.by || {name: c.adviser || '', pos: 'Class Adviser'};
  d.cert = d.cert || {name:'', pos:''}; d.rev = d.rev || {name: c.head || M.S.settings.head || '', pos: M.S.settings.headTitle || 'School Head'}; return d; };
const hInM = (v) => { const n = num(v); if(n === null) return null; return n > 3 ? n / 100 : n; };   // 152 cm → 1.52 m

FORMS.SF8 = {keepFormulas: true,
  async prep(X, T, opts, blob){ X.sf8tab = await M.sf8Tables(blob); X.sf8 = sf8Data(X.c); },
  fill(sh, X){
    // the Nutritional Status sheet: header row names the learner column and a BMI column
    let isForm = false; sh.each((c, r, t) => { if(r <= 6 && /school\s*form\s*8|^sf\s*8$/i.test(t)) isForm = true; }); if(!isForm) return null;
    let hr = 0; sh.each((c, r, t) => { if(!hr && /learner'?s\s*name/i.test(t) && r < 40) hr = r; });
    if(!hr) return null; let isNS = false; sh.each((c, r, t) => { if(r >= hr && r <= hr + 1 && /bmi/i.test(t)) isNS = true; }); if(!isNS) return null;
    const col = (re, rows = [hr, hr+1]) => { let k = 0; sh.each((c, r, t) => { if(!k && rows.includes(r) && re.test(t)) k = sh.master(c, r).c; }); return k; };
    const C = {lrn: col(/^lrn/i), name: col(/learner'?s\s*name/i), bday: col(/birth/i), age: col(/^age$/i), w: col(/weight/i), h: col(/^height\s*\(m\)|^height\s*$|^height\s*\(/i), h2: col(/height\s*²|height\^?2|m²\)$/i), bmi: col(/^bmi\s*\(/i, [hr+1]), cat: col(/bmi\s*category/i, [hr+1]), hfa: col(/height\s*for\s*age/i), rem: col(/^remarks?/i)};
    // MALE / FEMALE marker rows and the summary table
    let mRow = 0, fRow = 0, sumRow = 0; sh.each((c, r, t) => { if(r <= hr) return; if(/^male$/i.test(t) && !mRow) mRow = r; else if(/^female$/i.test(t) && !fRow) fRow = r; else if(/summary\s*table/i.test(t) && !sumRow) sumRow = r; });
    if(!mRow || !fRow) return 'MALE / FEMALE rows not found.';
    const mEnd = fRow - 1, fEnd = (sumRow || fRow + 51) - 1; X._sf8rows = {mRow, fRow, mEnd, fEnd, hr, used: {M: 0, F: 0}};
    // header
    const H = X.head; const S = M.S.settings;
    sh.setRight(/^school\s*name/i, S.school, 'School name', 1, hr-1); sh.setRight(/^district/i, H.district, 'District', 1, hr-1); sh.setRight(/^division/i, H.division, 'Division', 1, hr-1);
    const rs = (String(S.regionName || H.region || '').match(/region\s*([ivx]+|\d+[a-z]?)\b/i) || [])[1];
    sh.setRight(/^region/i, rs ? 'Region ' + rs.toUpperCase() : (S.regionName || H.region), 'Region', 1, hr-1); sh.setRight(/^school\s*id/i, isFinite(+S.schoolId) ? +S.schoolId : S.schoolId, 'School ID', 1, hr-1);
    sh.setRight(/^grade\b/i, isFinite(+H.grade) ? +H.grade : H.grade, 'Grade', 1, hr-1); sh.setRight(/^section/i, H.section, 'Section', 1, hr-1); sh.setRight(/^school\s*year/i, H.sy, 'School year', 1, hr-1);
    // learners
    const D = X.sf8; const T = X.sf8tab; const counts = {M:{}, F:{}}; const hcounts = {M:{}, F:{}};
    const put = (k, r, v) => { if(C[k]) sh.set(C[k], r, v); };
    const clearRow = (r) => ['lrn','name','bday','w','h','rem'].forEach(k => { if(C[k]) sh.clear(C[k], r); });
    for(let r = mRow + 1; r <= fEnd; r++) if(r !== fRow) clearRow(r);
    const list = X.learners.filter(p => M.counted(p.l));
    ['M','F'].forEach(sx => { const rows = list.filter(p => (sx === 'M') === (p.sex === 'M')); const r0 = sx === 'M' ? mRow + 1 : fRow + 1, rEnd = sx === 'M' ? mEnd : fEnd;
      for(let r = r0, i = 0; r <= rEnd; r++, i++){ const p = rows[i];
        if(!p){ ['age','h2','bmi','cat','hfa'].forEach(k => { if(C[k]) sh.cache(C[k], r, ''); }); if(sh.cells.get(M.TPL.ref(1, r))) sh.cache(1, r, ''); continue; }
        const d = D.rows[p.l.id] || {}; const w = num(d.w), h = hInM(d.h); const age = M.sf8Age(p.l.birthday, D.date); const st = M.sf8Status(T, p.sex === 'M' ? 'M' : 'F', age, w, h);
        put('lrn', r, p.lrn || ''); put('name', r, p.name); if(p.l.birthday) put('bday', r, dSerial(p.l.birthday)); if(isNum(w)) put('w', r, w); if(isNum(h)) put('h', r, h); if(d.rem) put('rem', r, d.rem);
        sh.cache(1, r, i + 1); if(C.age) sh.cache(C.age, r, age ? age.v : ''); if(C.h2) sh.cache(C.h2, r, st.h2 ?? ''); if(C.bmi) sh.cache(C.bmi, r, st.bmi ?? ''); if(C.cat) sh.cache(C.cat, r, st.cat || ''); if(C.hfa) sh.cache(C.hfa, r, st.hfa || '');
        if(st.cat) counts[sx][st.cat] = (counts[sx][st.cat] || 0) + 1; if(st.hfa) hcounts[sx][st.hfa] = (hcounts[sx][st.hfa] || 0) + 1;
        X._sf8rows.used[sx] = i + 1; sh.filled.push({cell: M.TPL.ref(C.name, r), label: 'Learner', value: p.name}); } });
    // summary table: counts per category for MALE / FEMALE / TOTAL rows
    if(sumRow){ let labRow = 0; sh.each((c, r, t) => { if(!labRow && r > sumRow && /severely\s*wasted/i.test(t)) labRow = r; });
      if(labRow){ const heads = []; for(let c = 1; c <= sh.maxC; c++){ const m = sh.master(c, labRow); if(m.c !== c || m.r !== labRow) continue; const t = sh.mtext(c, labRow); if(t) heads.push({c, t}); }
        let group = 'ns'; heads.forEach(hd => { hd.g = group; if(/^total$/i.test(hd.t) && group === 'ns'){ hd.total = true; group = 'hfa'; } else if(/^total$/i.test(hd.t)) hd.total = true; });
        for(let r = labRow + 1; r <= labRow + 4; r++){ const who = sh.mtext(1, r).toUpperCase(); const sxs = who === 'MALE' ? ['M'] : who === 'FEMALE' ? ['F'] : who === 'TOTAL' ? ['M','F'] : null; if(!sxs) continue;
          heads.forEach(hd => { const src = hd.g === 'ns' ? counts : hcounts; const cats = hd.total ? heads.filter(x => x.g === hd.g && !x.total).map(x => x.t) : [hd.t];
            const v = sxs.reduce((a, sx) => a + cats.reduce((b, ct) => b + (src[sx][ct] || 0), 0), 0); sh.cache(hd.c, r, v); }); } } }
    // date of assessment and signatories (name two rows under each label, position under the name)
    sh.each((c, r, t) => { if(r <= (sumRow || hr)) return;
      if(/^date\s*of\s*assessment/i.test(t)){ const m = sh.master(c, r + 2); sh.clear(m.c, m.r); sh.set(m.c, m.r, dSerial(D.date), 'Date of assessment'); }
      const sig = /conducted|assessed\s*by/i.test(t) ? D.by : /certified/i.test(t) ? D.cert : /reviewed|noted/i.test(t) ? D.rev : null;
      if(sig){ const a = sh.master(c, r + 2), b = sh.master(c, r + 3); sh.clear(a.c, a.r); sh.clear(b.c, b.r); if(sig.name) sh.set(a.c, a.r, sig.name.toUpperCase(), 'Signatory'); if(sig.pos) sh.set(b.c, b.r, sig.pos); } });
    return `${list.length} learner(s) · date of assessment ${D.date}`;
  }
};
// pages for the SF8 view: rows of the template split at the FEMALE row, hiding empty learner rows
FORMS.SF8.areas = function(sh){
  let hr = 0, mRow = 0, fRow = 0, sumRow = 0, last = 0;
  sh.each((c, r, t) => { if(!hr && /learner'?s\s*name/i.test(t)) hr = r; if(/^male$/i.test(t) && !mRow && r > hr) mRow = r; if(/^female$/i.test(t) && !fRow && r > hr) fRow = r; if(/summary\s*table/i.test(t) && !sumRow) sumRow = r; if(/reviewed|certified/i.test(t)) last = Math.max(last, r + 4); });
  if(!hr || !mRow || !fRow) return null;
  const empty = (r) => !sh.mtext(M.TPL.colNum('C'), r) && !sh.mtext(2, r);
  const hide = new Set(); for(let r = mRow + 1; r < fRow; r++) if(empty(r)) hide.add(r); for(let r = fRow + 1; r < (sumRow || fRow + 51); r++) if(empty(r)) hide.add(r);
  const lastC = M.TPL.colLet(Math.min(sh.maxC, 15)); last = last || sh.maxR;
  return [{area: `A1:${lastC}${fRow - 1}`, opts: {hideRows: hide}}, {area: `A${fRow}:${lastC}${last}`, opts: {hideRows: hide}}];
};

/* SF8 inputs: date of measurement, weight and height per learner, signatories */
FORMS.SF8.inputs = async function(el, ctx){
  const c = ctx.c; const D = sf8Data(c); const T = ctx.tpl ? await M.sf8Tables(ctx.tpl.blob).catch(() => null) : null;
  const L = M.sortedLearners(c).filter(M.counted);
  const row = (l) => { const d = D.rows[l.id] || {}; const age = M.sf8Age(l.birthday, D.date); const st = M.sf8Status(T, l.sex === 'M' ? 'M' : 'F', age, num(d.w), hInM(d.h));
    return `<tr data-lid="${l.id}"><td class="sticky-col small">${esc(l.name)}</td><td class="tiny">${esc(l.birthday || '—')}</td><td class="num tiny">${age ? `${age.y}y ${age.m}m` : '<span class="low">no birthdate</span>'}</td>
      <td><input class="input sf8-in" data-k="w" value="${esc(d.w ?? '')}" inputmode="decimal" placeholder="kg"></td><td><input class="input sf8-in" data-k="h" value="${esc(d.h ?? '')}" inputmode="decimal" placeholder="m or cm"></td>
      <td class="num" data-o="bmi">${isNum(st.bmi) ? st.bmi.toFixed(2) : ''}</td><td data-o="cat">${st.cat ? `<span class="chip ${/normal/i.test(st.cat)?'green':/obese|severely/i.test(st.cat)?'red':'gold'}">${esc(st.cat)}</span>` : ''}</td><td data-o="hfa">${st.hfa ? `<span class="chip ${/normal/i.test(st.hfa)?'green':/severely/i.test(st.hfa)?'red':'gold'}">${esc(st.hfa)}</span>` : ''}</td>
      <td><input class="input sf8-in" data-k="rem" value="${esc(d.rem || '')}" placeholder="Remarks"></td></tr>`; };
  const done = L.filter(l => D.rows[l.id] && num(D.rows[l.id].w) && num(D.rows[l.id].h)).length;
  el.innerHTML = `<div class="card" style="padding:16px;box-shadow:var(--neu-in)"><div class="row"><h3 style="margin:0">SF8 inputs ${M.newTag('sf8-inputs')}</h3><span class="chip">${done} of ${L.length} measured</span><span class="spacer"></span>
      <label class="field" style="flex-direction:row;align-items:center;gap:8px">Date of measurement<input type="date" class="input" id="s8D" value="${esc(D.date)}" style="width:auto"></label></div>
    <p class="small muted" style="margin:8px 0">Type weight (kg) and height (m — or cm, MASTRO converts). Age, BMI, nutritional status and height-for-age use the WHO tables inside the SF8 template${T ? '' : ' <b class="low">(template tables not found — use the built-in SF8)</b>'}.</p>
    <div class="table-wrap" style="max-height:46vh"><table class="sf8-t"><thead><tr><th class="sticky-col">Learner</th><th>Birthdate</th><th class="num">Age</th><th>Weight (kg)</th><th>Height</th><th class="num">BMI</th><th>BMI category</th><th>Height for age</th><th>Remarks</th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>
    <div class="grid g-3" style="margin-top:12px;gap:10px">${[['by','Conducted / assessed by'],['cert','Certified correct by'],['rev','Reviewed by']].map(([k, t]) => `<div><div class="small"><b>${t}</b></div><input class="input" data-sig="${k}" data-f="name" value="${esc(D[k].name)}" placeholder="Name" style="margin-top:4px"><input class="input" data-sig="${k}" data-f="pos" value="${esc(D[k].pos)}" placeholder="Position" style="margin-top:4px"></div>`).join('')}</div></div>`;
  $('#s8D', el).onchange = e => { D.date = e.target.value || M.today(); M.save(); ctx.rerender(); };
  el.oninput = e => { const x = e.target;
    if(x.dataset.sig){ D[x.dataset.sig][x.dataset.f] = x.value; clearTimeout(el._t); el._t = setTimeout(M.save, 400); return; }
    if(!x.classList.contains('sf8-in')) return; const tr = x.closest('tr'); const l = L.find(y => y.id === tr.dataset.lid); const d = D.rows[l.id] = D.rows[l.id] || {}; d[x.dataset.k] = x.value.trim();
    const st = M.sf8Status(T, l.sex === 'M' ? 'M' : 'F', M.sf8Age(l.birthday, D.date), num(d.w), hInM(d.h));
    $('[data-o=bmi]', tr).textContent = isNum(st.bmi) ? st.bmi.toFixed(2) : ''; $('[data-o=cat]', tr).innerHTML = st.cat ? `<span class="chip ${/normal/i.test(st.cat)?'green':/obese|severely/i.test(st.cat)?'red':'gold'}">${esc(st.cat)}</span>` : '';
    $('[data-o=hfa]', tr).innerHTML = st.hfa ? `<span class="chip ${/normal/i.test(st.hfa)?'green':/severely/i.test(st.hfa)?'red':'gold'}">${esc(st.hfa)}</span>` : '';
    clearTimeout(el._t); el._t = setTimeout(M.save, 400); };
  el.onkeydown = e => { const x = e.target; if(e.key !== 'Enter' || !x.classList.contains('sf8-in')) return; e.preventDefault(); const all = $$(`.sf8-in[data-k="${x.dataset.k}"]`, el); const n = all[all.indexOf(x) + 1]; if(n){ n.focus(); n.select(); } };
};

/* =====================================================================
   SF7 — personnel list (school-wide), filled 7 people per page
   ===================================================================== */
const sf7Data = () => { const S = M.S; if(!S.sf7){ const ad = S.settings.adviser || (S.classes[0] && S.classes[0].adviser) || '';
    const subj = [...new Set(S.ecr.map(e => `${e.subject || 'English'} ${e.grade} – ${e.section}`))];
    const adv = S.classes.filter(c => c.adviser === ad || !c.adviser).map(c => `Adviser – Grade ${c.grade} ${c.section}`);
    S.sf7 = {asOf: M.today(), A: [], B: [], C: [], people: ad ? [{emp:'', name: ad, sex:'M', fund:'National', pos:'Teacher IV', nature:'Permanent', degree:'', major:'English', minor:'', subjects: [...subj, ...adv].join('\n'), program: [], remarks:''}] : []}; }
  return S.sf7; };
FORMS.SF7 = {keepFormulas: false,
  items(X){ const D = sf7Data(); const per = 7; const n = Math.max(1, Math.ceil(D.people.length / per));
    return [...Array(n).keys()].map(i => ({name: `Page ${i+1}`, last: `Page ${i+1}`, l: {id: 'p' + (i+1)}, page: i + 1, pages: n, people: D.people.slice(i * per, i * per + per)})); },
  fill(sh, X, g){
    const D = sf7Data(); const S = M.S.settings; const H = X.head;
    let empRow = 0; sh.each((c, r, t) => { if(!empRow && /employee\s*no/i.test(t)) empRow = r; }); if(!empRow) return 'Personnel table not found.';
    const rs = (String(S.regionName || H.region || '').match(/region\s*([ivx]+|\d+[a-z]?)\b/i) || [])[1];
    sh.setRight(/^school\s*id/i, isFinite(+S.schoolId) ? +S.schoolId : S.schoolId, 'School ID', 1, 8); sh.setRight(/^region/i, rs ? 'Region ' + rs.toUpperCase() : (S.regionName || H.region), 'Region', 1, 8);
    sh.setRight(/^division/i, H.division, 'Division', 1, 8); sh.setRight(/^school\s*name/i, S.school, 'School name', 1, 8); sh.setRight(/^district/i, H.district, 'District', 1, 8); sh.setRight(/^school\s*year/i, H.sy, 'School year', 1, 8);
    // (A) (B) (C) summary — first page only
    let sRow = 0; sh.each((c, r, t) => { if(!sRow && /title\s*of\s*plantilla/i.test(t) && r < empRow) sRow = r; });
    if(sRow && g.page === 1){ const r0 = sRow + 2; const put = (col, r, v) => { if(v !== '' && v != null) sh.set(M.TPL.colNum(col), r, v, 'Summary'); };
      for(let i=0;i<Math.max(0, empRow - 1 - r0);i++){ const r = r0 + i; const a = D.A[i], b = D.B[i], cc = D.C[i];
        if(a){ put('A', r, a.title); put('C', r, num(a.n) ?? a.n); } if(b){ put('F', r, b.title); put('I', r, num(b.n) ?? b.n); }
        if(cc){ put('K', r, cc.title); put('N', r, cc.appt); put('P', r, cc.fund); put('R', r, num(cc.nT) ?? cc.nT); put('S', r, num(cc.nNT) ?? cc.nNT); } } }
    // column of each field (from the header rows)
    const col = (re) => { let k = 0; for(let c = 1; c <= sh.maxC && !k; c++) [empRow, empRow + 1].forEach(r => { const m = sh.master(c, r); if(!k && m.c === c && re.test(sh.mtext(c, r))) k = c; }); return k; };
    const C = {emp: col(/employee\s*no/i), name: col(/name\s*of\s*school\s*personnel/i), sex: col(/^sex$/i), fund: col(/^fund\s*source$/i), pos: col(/position\s*\/?\s*designation/i), nature: col(/nature\s*of\s*appointment/i),
      degree: col(/^degree/i), major: col(/^major/i), minor: col(/^minor/i), subj: col(/subject\s*taught/i), day: col(/^day\b/i), from: col(/^from/i), to: col(/^to\b/i), min: col(/total\s*actual/i), rem: col(/^remark/i)};
    // personnel blocks = merged cells in the first column under the header
    const blocks = []; for(let r = empRow + 2; r <= sh.maxR; r++){ const m = sh.master(1, r); if(m.m && m.m.r1 === r && m.m.r2 > r){ blocks.push({r1: r, r2: m.m.r2}); r = m.m.r2; } else if(/guidelines/i.test(sh.mtext(1, r))) break; }
    g.people.forEach((p, i) => { const b = blocks[i]; if(!b) return; const r = b.r1; const set = (k, v) => { if(C[k] && v !== '' && v != null) sh.set(C[k], r, v); };
      set('emp', p.emp); set('name', p.name ? p.name.toUpperCase() : ''); set('sex', p.sex); set('fund', p.fund); set('pos', p.pos); set('nature', p.nature); set('degree', p.degree); set('major', p.major); set('minor', p.minor); set('rem', p.remarks);
      sh.filled.push({cell: M.TPL.ref(C.name || 2, r), label: 'Personnel', value: p.name});
      const lines = b.r2 - b.r1; // last row of a block holds "Ave. Minutes per Day"
      String(p.subjects || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, lines).forEach((x, k) => { if(C.subj) sh.set(C.subj, r + k, x); });
      let tot = 0; const days = new Set();
      (p.program || []).slice(0, lines).forEach((x, k) => { if(C.day && x.day) sh.set(C.day, r + k, x.day); if(C.from && x.from) sh.set(C.from, r + k, x.from); if(C.to && x.to) sh.set(C.to, r + k, x.to); const mn = num(x.min); if(C.min && isNum(mn)){ sh.set(C.min, r + k, mn); tot += mn; String(x.day || '').split(/[\/,\s-]+/).filter(Boolean).forEach(d => days.add(d.toUpperCase())); } });
      if(C.min && tot) sh.set(C.min, b.r2, Math.round(tot / Math.max(1, Math.min(5, days.size || 5)))); });
    sh.each((c, r, t) => { if(/school\s*form\s*7,?\s*page/i.test(t)) sh.set(c, r, `School Form 7, Page ${g.page} of ${g.pages}`, 'Page');
      if(/updated\s*as\s*of/i.test(t)) sh.set(c, r, `Updated as of: ${D.asOf || M.today()}`, 'Updated as of'); });
    fillSignatures(sh, X.head);
    return `Page ${g.page} of ${g.pages} · ${g.people.length} personnel`;
  }
};
// two printed pages like Excel: header + first personnel blocks, then the column titles again + the rest
FORMS.SF7.areas = function(sh){
  let empRow = 0, end = 0; sh.each((c, r, t) => { if(!empRow && /employee\s*no/i.test(t)) empRow = r; if(/school\s*form\s*7,?\s*page/i.test(t)) end = Math.max(end, r); });
  if(!empRow) return null; end = end || sh.maxR;
  const blocks = []; for(let r = empRow + 2; r <= end; r++){ const m = sh.master(1, r); if(m.m && m.m.r1 === r && m.m.r2 > r){ blocks.push(m.m.r2); r = m.m.r2; } }
  if(blocks.length < 4) return null; const cut = blocks[2]; const lastC = M.TPL.colLet(Math.min(sh.maxC, 19));
  const hide = new Set(); for(let r = empRow + 2; r <= cut; r++) hide.add(r); for(let r = 1; r < empRow; r++) hide.add(r);
  return [{area: `A1:${lastC}${cut}`}, {area: `A1:${lastC}${end}`, opts: {hideRows: hide}}];
};
const sumRows = (arr, cols, ph) => `<table class="sf7-mini"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${arr.map((x, i) => `<tr>${cols.map(c => `<td><input class="input" data-arr="${ph}" data-i="${i}" data-f="${c[0]}" value="${esc(x[c[0]] ?? '')}"></td>`).join('')}<td><button class="icon-btn" data-arm="${ph}" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table>${arr.length < 5 ? `<button class="btn sm" data-aadd="${ph}">${ico('plus')} Add row</button>` : ''}`;
FORMS.SF7.inputs = function(el, ctx){
  const D = sf7Data();
  el.innerHTML = `<div class="card" style="padding:16px;box-shadow:var(--neu-in)"><div class="row"><h3 style="margin:0">SF7 inputs ${M.newTag('sf7-inputs')}</h3><span class="chip">${D.people.length} personnel · ${Math.max(1, Math.ceil(D.people.length/7))} page(s)</span><span class="spacer"></span>
      <label class="field" style="flex-direction:row;align-items:center;gap:8px">Updated as of<input type="date" class="input" id="s7D" value="${esc(D.asOf || M.today())}" style="width:auto"></label></div>
    <details style="margin-top:10px"><summary class="small"><b>(A) (B) (C) summary of items</b> — plantilla positions and other appointments</summary>
      <div class="grid g-3" style="gap:12px;margin-top:10px">
        <div><div class="tiny muted">(A) Nationally-funded teaching &amp; teaching-related</div>${sumRows(D.A, [['title','Title of plantilla position'],['n','No.']], 'A')}</div>
        <div><div class="tiny muted">(B) Nationally-funded non-teaching</div>${sumRows(D.B, [['title','Title of plantilla position'],['n','No.']], 'B')}</div>
        <div><div class="tiny muted">(C) Other appointments and funding sources</div>${sumRows(D.C, [['title','Designation'],['appt','Appointment'],['fund','Fund'],['nT','Teaching'],['nNT','Non-teaching']], 'C')}</div></div></details>
    <div class="row" style="margin-top:12px"><b class="small">School personnel</b><span class="spacer"></span><button class="btn sm primary" id="s7Add">${ico('plus')} Add personnel</button></div>
    <div class="list" style="margin-top:8px">${D.people.map((p, i) => `<div class="item" style="padding:9px 12px"><div class="grow"><div class="title small">${esc(p.name || '(no name)')} <span class="tiny muted">${esc(p.pos || '')}${p.nature ? ' · ' + esc(p.nature) : ''}</span></div><div class="tiny muted">${esc(String(p.subjects || '').split('\n').filter(Boolean).slice(0,3).join(' · '))}${(p.program||[]).length ? ` · ${(p.program||[]).length} daily program line(s)` : ''}</div></div>
      <button class="btn sm" data-ped="${i}">${ico('edit')} Edit</button>${i ? `<button class="icon-btn" data-pup="${i}" title="Move up">↑</button>` : ''}<button class="icon-btn" data-pdel="${i}" title="Remove">✕</button></div>`).join('') || '<div class="empty small">No personnel yet.</div>'}</div></div>`;
  $('#s7D', el).onchange = e => { D.asOf = e.target.value; M.save(); };
  el.oninput = e => { const x = e.target; if(!x.dataset.arr) return; D[x.dataset.arr][+x.dataset.i][x.dataset.f] = x.value; clearTimeout(el._t); el._t = setTimeout(M.save, 400); };
  $$('[data-aadd]', el).forEach(b => b.onclick = () => { D[b.dataset.aadd].push({}); M.save(); ctx.rerender(); });
  $$('[data-arm]', el).forEach(b => b.onclick = () => { D[b.dataset.arm].splice(+b.dataset.i, 1); M.save(); ctx.rerender(); });
  $$('[data-pdel]', el).forEach(b => b.onclick = () => { if(!confirm('Remove this person from SF7?')) return; D.people.splice(+b.dataset.pdel, 1); M.save(); ctx.rerender(); });
  $$('[data-pup]', el).forEach(b => b.onclick = () => { const i = +b.dataset.pup; [D.people[i-1], D.people[i]] = [D.people[i], D.people[i-1]]; M.save(); ctx.rerender(); });
  $$('[data-ped]', el).forEach(b => b.onclick = () => personForm(D.people[+b.dataset.ped], ctx.rerender));
  $('#s7Add', el).onclick = () => personForm(null, ctx.rerender);
};
function personForm(p, done){
  const D = sf7Data(); const x = p || {emp:'', name:'', sex:'F', fund:'National', pos:'', nature:'Permanent', degree:'', major:'', minor:'', subjects:'', program:[], remarks:''};
  const prog = (x.program || []).concat([...Array(Math.max(0, 6 - (x.program||[]).length))].map(() => ({})));
  const f = (k, l, ph = '', full) => `<label class="field" ${full?'style="grid-column:1/-1"':''}>${l}<input class="input" data-k="${k}" value="${esc(x[k] || '')}" placeholder="${esc(ph)}"></label>`;
  M.modal(p ? 'Edit personnel' : 'Add personnel', `<div class="grid g-2">
      ${f('name','Name (arrange by position title)','Juan A. Dela Cruz', true)}${f('emp','Employee No. / TIN')}<label class="field">Sex<select class="input" data-k="sex"><option ${x.sex==='M'?'selected':''}>M</option><option ${x.sex==='F'?'selected':''}>F</option></select></label>
      ${f('fund','Fund source','National / SEF / PTA')}${f('pos','Position / designation','Teacher III')}${f('nature','Nature of appointment','Permanent')}${f('degree','Degree / post graduate','BSEd English, MA-ELT (units)')}${f('major','Major / specialization')}${f('minor','Minor')}
      <label class="field" style="grid-column:1/-1">Subjects taught (grade &amp; section), advisory class, ancillary assignments — one per line<textarea class="input" data-k="subjects" rows="4">${esc(x.subjects || '')}</textarea></label>
      ${f('remarks','Remarks','', true)}</div>
    <h3 style="margin-top:12px">Daily program (teaching personnel)</h3>
    <div class="table-wrap" style="max-height:none"><table class="sf7-mini"><thead><tr><th>Day (M/T/W/TH/F)</th><th>From</th><th>To</th><th>Minutes per week</th></tr></thead><tbody>${prog.map((r, i) => `<tr data-pr="${i}"><td><input class="input" data-p="day" value="${esc(r.day||'')}" placeholder="M-F"></td><td><input class="input" data-p="from" value="${esc(r.from||'')}" placeholder="7:30"></td><td><input class="input" data-p="to" value="${esc(r.to||'')}" placeholder="8:30"></td><td><input class="input" data-p="min" value="${esc(r.min||'')}" inputmode="numeric" placeholder="300"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" id="pfX">Cancel</button><button class="btn primary" id="pfOk">Save</button></div>`, b => {
    $('#pfX', b).onclick = M.closeModal;
    $('#pfOk', b).onclick = () => { const o = p || {}; $$('[data-k]', b).forEach(i => o[i.dataset.k] = i.value.trim());
      o.program = $$('[data-pr]', b).map(tr => { const r = {}; $$('[data-p]', tr).forEach(i => r[i.dataset.p] = i.value.trim()); return r; }).filter(r => r.day || r.from || r.to || r.min);
      if(!o.name) return M.toast('Enter the name'); if(!p) D.people.push(o); M.save(); M.closeModal(); done(); };
  }, true);
}
})();
