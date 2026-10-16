/* MASTRO — BULIG Reading Monitoring (Bukidnon's Unified Literacy and Intervention Gateway)
   Profiling (pre-assessment level + BOSY/MOSY/EOSY profile) → Assessment Periods (PASSED / NOT READY moves a learner up the ladder)
   → intervention groupings by level → A4 reports (CRM report, List of Pupils, Classroom Monitoring Tool, groupings). */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;

/* ---------- BULIG ladder (Grade 4–10 grouping from the BULIG pilot deck; Phil-IRI profiling) ---------- */
const LV = [
  {k:'L1',  t:'LEVEL 1',  short:'1',  comp:'Oral Language',                                      skill:'Oral Language',                                   ks3:'Frustration', ks1:'Low Emerging'},
  {k:'L2A', t:'LEVEL 2A', short:'2A', comp:'Phonemic Awareness',                                 skill:'Phonological Awareness',                          ks3:'Frustration', ks1:'Low Emerging'},
  {k:'L2B', t:'LEVEL 2B', short:'2B', comp:'Phonological Awareness',                             skill:'PA · Alphabet Knowledge · Letter-Sound Knowledge · Phonics', ks3:'Frustration', ks1:'Developing'},
  {k:'L3A', t:'LEVEL 3A', short:'3A', comp:'Word Recognition',                                   skill:'Word Recognition',                                ks3:'Frustration', ks1:'Developing'},
  {k:'L3B', t:'LEVEL 3B', short:'3B', comp:'Word Recognition (Phrase Reading)',                  skill:'Word Recognition · Phrase Reading',               ks3:'Frustration', ks1:'Transitioning'},
  {k:'L4',  t:'LEVEL 4',  short:'4',  comp:'Vocabulary Development & Listening Comprehension',   skill:'Vocabulary Development · Listening Comprehension', ks3:'Instructional', ks1:'Transitioning'},
  {k:'L5',  t:'LEVEL 5',  short:'5',  comp:'Fluency (Graded)',                                   skill:'Automaticity, Speed and Accuracy',                ks3:'Instructional / Independent', ks1:'Transitioning / Grade Level Ready'},
  {k:'L6',  t:'LEVEL 6',  short:'6',  comp:'Graded Reading Comprehension',                       skill:'Reading Comprehension (grade-level complexity)',  ks3:'Independent', ks1:'Grade Level Ready'},
  {k:'L7',  t:'LEVEL 7',  short:'7',  comp:'Genuine Love for Reading and Writing',               skill:'Enhancement / Enrichment',                        ks3:'Advanced', ks1:'Advanced'}
];
const LVI = Object.fromEntries(LV.map((x, i) => [x.k, i]));
const KS = {
  KS1: {label:'Key Stage 1 (CRLA)', tool:'CRLA', profiles:['Low Emerging','High Emerging','Developing','Transitioning','Grade Level Ready']},
  KS2: {label:'Key Stage 2 (Phil-IRI)', tool:'PHIL-IRI', profiles:['Frustration','Instructional','Independent']},
  KS3: {label:'Key Stage 3 (Phil-IRI)', tool:'PHIL-IRI', profiles:['Frustration','Instructional','Independent']}
};
const TERMS = ['1ST TERM','2ND TERM','3RD TERM'];
const LANGS = [['ENGLISH','English'],['FILIPINO','Filipino']];
const termOf = (q) => TERMS.includes(q) ? q : /^1/.test(q || '') ? TERMS[0] : /^2/.test(q || '') ? TERMS[1] : q ? TERMS[2] : TERMS[0];
const PER = [['bosy','BOSY'],['mosy','MOSY'],['eosy','EOSY']];
const MAX_AP = 15;
M.BULIG_LEVELS = LV;

/* ---------- data (stored on the class, so it is in every backup) ----------
   c.bulig = {ks, lang, langs:{ENGLISH:{tool, preT, preDate, preBy, L:{lid:{pre,bosy,mosy,eosy}}, aps:[{id,q,date,by,byLv,marks}]}, FILIPINO:{…}}}
   Same flow as the BULIG RMS template (MONITORING sheet): pre-test LEVEL (BULIG ladder) → BOSY / MOSY / EOSY reading profile
   (key-stage list) → AP1–AP15 remarks (PASSED moves to the next level). One record per subject (English / Filipino reading). */
const root = (c) => { const r = c.bulig = c.bulig || {};
  r.ks = r.ks || (+c.grade >= 7 ? 'KS3' : +c.grade >= 4 ? 'KS2' : 'KS1'); r.langs = r.langs || {}; r.lang = r.lang || 'ENGLISH';
  if(r.L || r.aps){ const old = r.langs[r.subject || 'ENGLISH'] = r.langs[r.subject || 'ENGLISH'] || {};   // v6.4 → v6.5: single record becomes the English record
    old.L = r.L || {}; old.aps = r.aps || []; old.tool = r.tool; old.preT = termOf(r.preQ); delete r.L; delete r.aps; delete r.preQ; delete r.subject; delete r.tool; }
  return r; };
const data = (c, lang) => { const r = root(c); const k = lang || r.lang; const d = r.langs[k] = r.langs[k] || {};
  d.tool = d.tool || KS[r.ks].tool; d.preT = termOf(d.preT); d.L = d.L || {}; d.aps = d.aps || [];
  d.aps.forEach(a => { a.q = termOf(a.q); a.byLv = a.byLv || {}; if(a.by == null) a.by = c.adviser || ''; });
  if(d.preBy == null) d.preBy = c.adviser || '';
  Object.defineProperty(d, 'ks', {value: r.ks, enumerable: false, configurable: true});
  Object.defineProperty(d, 'subject', {value: k, enumerable: false, configurable: true});
  return d; };
const rec = (d, lid) => d.L[lid] = d.L[lid] || {};
// participants = the class roster (updated by SF1 uploads) without Transferred Out, No Longer Participating and Dropped Out
const learners = (c) => M.sortedLearners(c).filter(M.counted);
const excluded = (c) => M.sortedLearners(c).filter(l => !M.counted(l));
const bySex = (L) => [['M','MALE', L.filter(l => l.sex === 'M')], ['F','FEMALE', L.filter(l => l.sex !== 'M')]];
const lvOf = (k) => LV[LVI[k]] || null;
// level after assessment period n (n = 0 → pre-assessment). PASSED moves one rung up; NOT READY / "–" / not tagged stays.
const levelAt = (d, lid, n) => { let k = (d.L[lid] || {}).pre || ''; if(!k) return '';
  for(let i = 0; i < Math.min(n, d.aps.length); i++){ const m = (d.aps[i].marks || {})[lid]; if(m === 'P' && LVI[k] < LV.length - 1) k = LV[LVI[k] + 1].k; }
  return k; };
const curLevel = (d, lid) => levelAt(d, lid, d.aps.length);
const profileOf = (d, k) => { const x = lvOf(k); return x ? (d.ks === 'KS1' ? x.ks1 : x.ks3) : ''; };
const nm = (l) => l.name;
const apName = (n) => n === 0 ? 'PRE-TEST' : 'AP' + n;
const ui = () => (M.bulUI = M.bulUI || {tab:'mon', ap:null, gp:null});
const fdate = (iso) => iso ? M.parse(iso).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : '';
const assessorOf = (d, n, lvk) => { if(!n) return d.preBy || ''; const a = d.aps[n - 1]; return (a.byLv && a.byLv[lvk]) || a.by || ''; };
const LOGO = 'icons/bulig.png';
M.buligLevel = (c, lid) => { if(!c.bulig) return []; return LANGS.map(([k, t]) => { const r = root(c); if(!r.langs[k]) return null; const d = data(c, k); const lv = curLevel(d, lid); if(!lv) return null;
  const pr = d.L[lid] || {}; return {lang: t, level: lvOf(lv), pre: lvOf(pr.pre), profile: pr.eosy || pr.mosy || pr.bosy || '', aps: d.aps.length}; }).filter(Boolean); };

/* ---------- view ---------- */
M.views.reading = function view(el, args){
  const c = M.cls(); const r = root(c); const d = data(c); const u = ui(); if(args[0]) u.tab = args[0];
  const L = learners(c), X = excluded(c);
  if(!L.length){ el.innerHTML = `<div class="card"><div class="empty">Add your learners first (Learners → upload SF1). BULIG monitoring uses your class roster.</div></div>`; return; }
  const cur = L.map(l => curLevel(d, l.id)); const profiled = cur.filter(Boolean).length;
  const dist = LV.map(x => cur.filter(k => k === x.k).length);
  const last = d.aps[d.aps.length - 1]; const tagged = last ? L.filter(l => curLevel(d, l.id) && last.marks && last.marks[l.id]).length : 0;
  el.innerHTML = `
  <div class="card bul-hero"><div class="row" style="align-items:center;gap:16px;flex-wrap:wrap">
    <img src="${LOGO}" alt="BULIG" class="bul-logo">
    <div class="grow" style="min-width:240px"><div class="eyebrow-s">Bukidnon's Unified Literacy and Intervention Gateway</div><h2 style="margin:2px 0 4px">Reading monitoring · ${esc(M.className(c))}</h2>
      <div class="small muted">Pre-test level → BOSY / MOSY / EOSY reading profile → Assessment Periods every 3-week BULIG cycle (2 weeks intervention, 1 week assessment &amp; regrouping).</div></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div class="seg" id="bLang">${LANGS.map(([k, t]) => `<button data-l="${k}" class="${k === r.lang ? 'on' : ''}">${t} reading</button>`).join('')}</div>
      <label class="field mini">Key stage<select class="input" id="bKs">${Object.entries(KS).map(([k, v]) => `<option value="${k}" ${k === r.ks ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label class="field mini">Tool<select class="input" id="bTool">${['PHIL-IRI','CRLA'].map(x => `<option ${x === d.tool ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    </div></div>
    <div class="bul-ladder" style="margin-top:14px">${LV.map((x, i) => `<div class="bl-step lv-${x.k}" title="${esc(x.comp)}"><b>Level ${x.short}</b><span>${dist[i]}</span></div>`).join('')}</div>
    <div class="chips" style="margin-top:10px"><span class="chip green">${esc(LANGS.find(x => x[0] === r.lang)[1])} · ${esc(d.tool)}</span><span class="chip">${L.length} learners assessed</span><span class="chip ${profiled < L.length ? 'gold' : 'green'}">${profiled}/${L.length} with pre-test level</span><span class="chip">${d.aps.length} assessment period(s)</span>${last ? `<span class="chip">${apName(d.aps.length)}: ${tagged}/${profiled} tagged</span>` : ''}</div>
    ${X.length ? `<div class="tiny muted" style="margin-top:8px">Not included (from your SF1 roster): ${X.map(l => `${esc(nm(l))} <b>(${esc((M.STATUS[l.status] || {}).short || l.status)})</b>`).join(', ')}</div>` : ''}
  </div>
  <div class="row" style="margin:18px 0 14px"><div class="seg" id="bTabs">${[['mon','1 · Pre-test & profile'],['ap','2 · Assessment periods'],['grp','3 · Groupings'],['rep','4 · Reports']].map(([k, t]) => `<button data-t="${k}" class="${u.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div id="bBody"></div>`;
  $$('#bLang button').forEach(b => b.onclick = () => { r.lang = b.dataset.l; u.ap = null; u.gp = null; M.save(); view(el, []); });
  $('#bKs').onchange = e => { r.ks = e.target.value; Object.values(r.langs).forEach(x => x.tool = KS[r.ks].tool); M.save(); view(el, []); };
  $('#bTool').onchange = e => { d.tool = e.target.value; M.save(); view(el, []); };
  $$('#bTabs button').forEach(b => b.onclick = () => { u.tab = b.dataset.t; view(el, []); });
  const rr = () => view(el, []);
  ({mon: monTab, ap: apTab, grp: grpTab, rep: repTab})[u.tab]($('#bBody'), c, d, L, rr);
};

/* ---------- 1 · Pre-test level + BOSY/MOSY/EOSY profile (template: MONITORING columns F, H, I, J) ---------- */
function monTab(el, c, d, L, rr){
  const prof = KS[d.ks].profiles;
  const sel = (lid, k, opts, val, ph) => `<select class="input bsel" data-lid="${lid}" data-k="${k}"><option value="">${ph}</option>${opts.map(o => `<option value="${esc(o[0])}" ${o[0] === val ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const row = (l, i) => { const r = d.L[l.id] || {}; const ck = curLevel(d, l.id); const cx = lvOf(ck);
    const hist = d.aps.map((a, j) => { const m = r.pre ? (a.marks || {})[l.id] : ''; return `<span class="aph ${m || ''}" title="AP${j + 1}: ${m === 'P' ? 'PASSED' : m === 'N' ? 'NOT READY' : 'not assessed'}">${m === 'P' ? '✓' : m === 'N' ? '✕' : '·'}</span>`; }).join('');
    return `<tr><td class="muted">${i + 1}</td><td class="sticky-col"><b>${esc(nm(l))}</b>${M.statusChip ? M.statusChip(l, 1) : ''}</td>
      <td>${sel(l.id, 'pre', LV.map(x => [x.k, x.t]), r.pre, '— level —')}</td>
      <td class="tiny" style="max-width:170px;white-space:normal">${r.pre ? esc(lvOf(r.pre).comp) : ''}</td>
      ${PER.map(([k]) => `<td class="pcol">${sel(l.id, k, prof.map(p => [p, p]), r[k], '—')}</td>`).join('')}
      <td>${cx ? `<span class="lvchip lv-${ck}">${cx.t}</span>` : ''}</td><td class="nowrap">${hist}</td></tr>`; };
  el.innerHTML = `<div class="card">
    <h2 style="margin:0">Pre-test level &amp; reading profile · ${esc(d.subject === 'FILIPINO' ? 'Filipino' : 'English')}</h2>
    <div class="bul-steps">
      <div><b>A · Pre-test level</b><span>BULIG level assessment at the start (Level 1 → 2A → 2B → 3A → 3B → 4 → 5 → 6 → 7). It decides each learner's first intervention group; the Assessment Periods move it up.</span></div>
      <div><b>B · BOSY · MOSY · EOSY</b><span>The ${esc(d.tool)} reading profile (${prof.join(' / ')}) at the beginning, middle and end of the school year. Recorded separately — it does not change the BULIG level, exactly as in the template.</span></div></div>
    <div class="row" style="gap:10px;flex-wrap:wrap;margin:6px 0 12px">
      <label class="field mini">Pre-test term<select class="input" id="bPreT">${TERMS.map(q => `<option ${q === d.preT ? 'selected' : ''}>${q}</option>`).join('')}</select></label>
      <label class="field mini">Pre-test date<input class="input" type="date" id="bPreD" value="${esc(d.preDate || '')}"></label>
      <label class="field mini" style="min-width:220px">Assessed by<input class="input" id="bPreBy" value="${esc(d.preBy || '')}" placeholder="Name of assessor"></label></div>
    <div class="table-wrap" style="max-height:none"><table class="btable"><thead><tr><th>#</th><th class="sticky-col">Learner</th><th>A · Pre-test level</th><th>Component</th>${PER.map(([, t]) => `<th class="pcol">B · ${t}</th>`).join('')}<th>Current level</th><th>APs</th></tr></thead>
    <tbody>${bySex(L).map(([, label, arr]) => `<tr class="group"><td></td><td class="sticky-col" colspan="9">${label} (${arr.length})</td></tr>` + arr.map(row).join('')).join('')}</tbody></table></div></div>`;
  $('#bPreT').onchange = e => { d.preT = e.target.value; M.save(); };
  $('#bPreD').onchange = e => { d.preDate = e.target.value; M.save(); };
  $('#bPreBy').onchange = e => { d.preBy = e.target.value.trim(); M.save(); };
  $$('.bsel', el).forEach(s => s.onchange = () => { rec(d, s.dataset.lid)[s.dataset.k] = s.value; M.save(); if(s.dataset.k === 'pre') rr(); });
}

/* ---------- 2 · Assessment periods: PASSED / NOT READY per learner, grouped by the level assessed ---------- */
function apTab(el, c, d, L, rr){
  const u = ui(); if(u.ap == null || u.ap > d.aps.length) u.ap = d.aps.length;
  const n = u.ap; const ap = d.aps[n - 1];
  const P = L.filter(l => (d.L[l.id] || {}).pre); const noPre = L.filter(l => !(d.L[l.id] || {}).pre);
  let body = '';
  if(!d.aps.length) body = `<div class="empty">No assessment period yet. After the first 2-week intervention, tap <b>New assessment period</b> to tag who passed their level.</div>`;
  else {
    const groups = LV.map(x => ({x, arr: P.filter(l => levelAt(d, l.id, n - 1) === x.k)})).filter(g => g.arr.length);
    const marks = ap.marks = ap.marks || {};
    const cnt = (m) => P.filter(l => marks[l.id] === m).length;
    body = `<div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:12px;align-items:flex-end">
        <label class="field mini">Term<select class="input" id="apQ">${TERMS.map(q => `<option ${q === ap.q ? 'selected' : ''}>${q}</option>`).join('')}</select></label>
        <label class="field mini">Date assessed<input class="input" type="date" id="apD" value="${esc(ap.date || '')}"></label>
        <label class="field mini" style="min-width:220px">Assessed by<input class="input" id="apBy" value="${esc(ap.by || '')}" placeholder="Name of assessor"></label>
        <span class="spacer"></span>${n === d.aps.length ? '<button class="btn sm danger" id="apDel">Delete this AP</button>' : ''}</div>
      <div class="ap-sum"><span class="s-p"><b>${cnt('P')}</b> passed</span><span class="s-n"><b>${cnt('N')}</b> not ready</span><span class="s-x"><b>${P.length - cnt('P') - cnt('N')}</b> not yet tagged</span></div>
      <p class="small muted" style="margin:10px 0 12px">Grouped by the level each learner was assessed on in ${apName(n)}. <b>PASSED</b> moves the learner to the next level (Level 7 stays); <b>NOT READY</b> keeps the level. A group can have its own assessor.</p>
      ${groups.map(({x, arr}) => `<div class="bul-grp"><div class="bg-h lv-${x.k}"><div class="bg-t"><b>${x.t}</b><span>${esc(x.comp)}</span></div>
          <input class="input bg-by" data-lv="${x.k}" value="${esc(ap.byLv[x.k] || '')}" placeholder="Assessor: ${esc(ap.by || 'same as above')}">
          <div class="bg-all"><button class="btn sm" data-all="${x.k}" data-m="P">All passed</button><button class="btn sm" data-all="${x.k}" data-m="N">All not ready</button></div></div>
        <div class="bg-rows"><div class="bg-row bg-cap"><span>#</span><span>Learner</span><span>Result</span><span>New level</span></div>${arr.map((l, i) => { const m = marks[l.id] || ''; const after = levelAt(d, l.id, n);
          return `<div class="bg-row ${m ? 'is-' + (m === '-' ? 'X' : m) : ''}"><span class="muted">${i + 1}</span><span class="bg-nm"><b>${esc(nm(l))}</b><i>${l.sex === 'M' ? 'Male' : 'Female'}</i></span>
            <div class="tagset" data-lid="${l.id}"><button data-m="P" class="t-p ${m === 'P' ? 'on' : ''}">✓ PASSED</button><button data-m="N" class="t-n ${m === 'N' ? 'on' : ''}">✕ NOT READY</button><button data-m="-" class="t-x ${m === '-' ? 'on' : ''}" title="Not assessed">–</button></div>
            <span class="lvchip lv-${after} ${m === 'P' ? 'up' : ''}">${after ? (m === 'P' && after !== x.k ? '▲ ' : '') + lvOf(after).t : ''}</span></div>`; }).join('')}</div></div>`).join('')}`;
  }
  el.innerHTML = `<div class="card">
    <div class="row" style="gap:10px;flex-wrap:wrap"><h2 style="margin:0">Assessment periods · ${esc(d.subject === 'FILIPINO' ? 'Filipino' : 'English')}</h2><span class="spacer"></span>
      <div class="seg" id="apSeg">${d.aps.map((a, i) => `<button data-n="${i + 1}" class="${i + 1 === n ? 'on' : ''}">AP${i + 1}</button>`).join('')}</div>
      ${d.aps.length < MAX_AP ? `<button class="btn sm primary" id="apNew">${ico('plus')} New assessment period</button>` : ''}</div>
    ${noPre.length ? `<div class="small" style="margin:10px 0;color:var(--amber)">${noPre.length} learner(s) have no pre-test level yet and are not included: ${noPre.slice(0, 6).map(l => esc(nm(l))).join(', ')}${noPre.length > 6 ? '…' : ''} — set them in <a href="#reading/mon">1 · Pre-test &amp; profile</a>.</div>` : ''}
    <div style="margin-top:12px">${body}</div></div>`;
  $$('#apSeg button').forEach(b => b.onclick = () => { u.ap = +b.dataset.n; rr(); });
  if($('#apNew')) $('#apNew').onclick = () => { const prev = d.aps[d.aps.length - 1]; d.aps.push({id: M.uid('ap'), q: prev ? prev.q : d.preT, date: M.today(), by: prev ? prev.by : (d.preBy || c.adviser || ''), byLv: {}, marks: {}}); u.ap = d.aps.length; M.save(); rr(); };
  if(!ap) return;
  $('#apQ').onchange = e => { ap.q = e.target.value; M.save(); };
  $('#apD').onchange = e => { ap.date = e.target.value; M.save(); };
  $('#apBy').onchange = e => { ap.by = e.target.value.trim(); M.save(); rr(); };
  $$('.bg-by', el).forEach(i => i.onchange = () => { const v = i.value.trim(); if(v) ap.byLv[i.dataset.lv] = v; else delete ap.byLv[i.dataset.lv]; M.save(); });
  if($('#apDel')) $('#apDel').onclick = () => { if(!confirm(`Delete AP${n} and its tags?`)) return; d.aps.pop(); u.ap = d.aps.length; M.save(); rr(); };
  $$('.tagset', el).forEach(s => $$('button', s).forEach(b => b.onclick = () => { const lid = s.dataset.lid; if(ap.marks[lid] === b.dataset.m) delete ap.marks[lid]; else ap.marks[lid] = b.dataset.m; M.save(); const y = window.scrollY; rr(); window.scrollTo(0, y); }));
  $$('[data-all]', el).forEach(b => b.onclick = () => { P.filter(l => levelAt(d, l.id, n - 1) === b.dataset.all).forEach(l => ap.marks[l.id] = b.dataset.m); M.save(); const y = window.scrollY; rr(); window.scrollTo(0, y); });
}

/* ---------- Groupings: intervention groups by level at a chosen point ---------- */
const groupsAt = (d, L, n) => LV.map(x => ({x, arr: L.filter(l => levelAt(d, l.id, n) === x.k)})).filter(g => g.arr.length);
function grpTab(el, c, d, L, rr){
  const u = ui(); if(u.gp == null || u.gp > d.aps.length) u.gp = d.aps.length; const n = u.gp;
  const G = groupsAt(d, L, n);
  const cls = {}; G.forEach(g => { const p = profileOf(d, g.x.k); cls[p] = (cls[p] || 0) + g.arr.length; });
  el.innerHTML = `<div class="card">
    <div class="row" style="gap:10px;flex-wrap:wrap"><h2 style="margin:0">Intervention groupings</h2><span class="spacer"></span>
      <label class="field mini" style="flex-direction:row;align-items:center;gap:6px">Grouping after<select class="input" id="gpN">${[0, ...d.aps.map((a, i) => i + 1)].map(i => `<option value="${i}" ${i === n ? 'selected' : ''}>${i ? 'AP' + i + ' (regrouping)' : 'Pre-test'}</option>`).join('')}</select></label>
      <button class="btn sm" id="gpV">${ico('eye')} View</button><button class="btn sm primary" id="gpP">${ico('print')} Print A4</button></div>
    <p class="small muted" style="margin:6px 0 12px">One group per BULIG level — the class each learner attends in the next 2-week intervention. Classification follows the BULIG ${d.ks === 'KS1' ? 'Grades 1–3 (CRLA)' : 'Grades 4–10 (Phil-IRI)'} grouping.</p>
    <div class="chips" style="margin-bottom:12px">${Object.entries(cls).map(([p, v]) => `<span class="chip">${esc(p)}: <b>${v}</b></span>`).join('')}</div>
    ${G.length ? `<div class="grid g-3">${G.map(({x, arr}) => `<div class="bul-gcard"><div class="bg-h lv-${x.k}"><b>${x.t}</b><span class="tiny">${esc(profileOf(d, x.k))}</span></div>
      <div style="padding:10px 12px"><div class="small"><b>${esc(x.comp)}</b></div><div class="tiny muted" style="margin:2px 0 8px">${esc(x.skill)}</div>
      <div class="tiny muted">${arr.filter(l => l.sex === 'M').length} M · ${arr.filter(l => l.sex !== 'M').length} F</div>
      <ol class="small" style="margin:6px 0 0;padding-left:20px">${arr.map(l => `<li>${esc(nm(l))}</li>`).join('')}</ol></div></div>`).join('')}</div>` : '<div class="empty">Set pre-assessment levels in Profiling first.</div>'}</div>`;
  $('#gpN').onchange = e => { u.gp = +e.target.value; rr(); };
  $('#gpV').onclick = () => preview(`Intervention groupings · ${n ? 'AP' + n : 'Pre-test'}`, [groupsPage(c, d, L, n)], false);
  $('#gpP').onclick = () => printPages([groupsPage(c, d, L, n)], false);
}

/* ---------- Reports ---------- */
function repTab(el, c, d, L){
  const aps = d.aps.map((a, i) => i + 1);
  const apSel = (id) => aps.length ? `<select class="input" id="${id}" style="width:auto">${aps.map(i => `<option value="${i}" ${i === aps.length ? 'selected' : ''}>AP${i}</option>`).join('')}</select>` : '<span class="tiny muted">No AP yet</span>';
  const R = [
    {id:'crm0', t:'CRM Report · Pre-test', s:'Classroom Reading Monitoring Report: learners per level (male/female) and the key-stage profile for BOSY, MOSY and EOSY.', pages:() => [crmPage(c, d, L, 0)]},
    {id:'lop0', t:'List of Pupils · Pre-test', s:'Each learner with reading level, component and colour coding, by sex.', pages:() => lopPages(c, d, L, 0)},
    {id:'crm', t:'CRM Report · Assessment Period', s:'Same report for the chosen AP (AP1–AP15), with term, date, assessor and passed / not-ready counts.', ap:'rCrm', pages:() => [crmPage(c, d, L, +$('#rCrm').value)]},
    {id:'lop', t:'List of Pupils · Assessment Period', s:'Level before, remarks (PASSED / NOT READY) and new level for the chosen AP.', ap:'rLop', pages:() => lopPages(c, d, L, +$('#rLop').value)},
    {id:'mon', t:'Classroom Monitoring Tool (BPrF1)', s:'The full record: pre-test level, BOSY/MOSY/EOSY profile and every AP (term, date, remarks, level). A4 landscape.', land:true, pages:() => monPages(c, d, L)},
    {id:'grp', t:'Intervention groupings', s:'Groups by level after the latest AP (change the point in the Groupings tab).', pages:() => [groupsPage(c, d, L, d.aps.length)]}
  ];
  el.innerHTML = `<div class="card"><h2 style="margin:0 0 4px">BULIG reports · ${esc(d.subject === 'FILIPINO' ? 'Filipino' : 'English')} reading</h2><p class="small muted" style="margin:0 0 14px">Every report fits A4 inside 0.5 in margins — big classes shrink to fit, nothing runs off the page. Tap <b>View</b> to check it before printing.</p>
    <div class="list">${R.map(r => `<div class="item" style="align-items:center;gap:12px">${ico('pdf','width:24px;height:24px;color:var(--green)')}<div class="grow"><div class="title">${r.t}${r.land ? ' <span class="chip" style="font-size:10px;padding:2px 8px">A4 landscape</span>' : ' <span class="chip" style="font-size:10px;padding:2px 8px">A4</span>'}</div><div class="tiny muted">${r.s}</div></div>
      ${r.ap ? apSel(r.ap) : ''}<button class="btn sm" data-v="${r.id}" ${r.ap && !aps.length ? 'disabled' : ''}>${ico('eye')} View</button><button class="btn sm primary" data-p="${r.id}" ${r.ap && !aps.length ? 'disabled' : ''}>${ico('print')} Print</button></div>`).join('')}</div></div>`;
  $$('[data-v]', el).forEach(b => b.onclick = () => { const r = R.find(x => x.id === b.dataset.v); preview(r.t, r.pages(), !!r.land); });
  $$('[data-p]', el).forEach(b => b.onclick = () => { const r = R.find(x => x.id === b.dataset.p); printPages(r.pages(), !!r.land); });
}

/* report pieces */
const head = (c, d, title, n) => { const ap = n ? d.aps[n - 1] : null;
  const by = n ? [ap.by, ...Object.entries(ap.byLv || {}).map(([k, v]) => `${v} (${lvOf(k) ? lvOf(k).t : k})`)].filter(Boolean).join('; ') : d.preBy;
  return M.printHeader(title).replace('<div class="p-title">', `<div class="bul-pt"><img src="${LOGO}" alt="BULIG"><div><b>BUKIDNON'S UNIFIED LITERACY AND INTERVENTION GATEWAY</b><i>Building Up Literacy, Inspiring Growth</i></div></div><div class="p-title">`) +
  `<table class="rd-info"><tr><td>Adviser</td><td><b>${esc(c.adviser)}</b></td><td>Assessment period</td><td><b>${apName(n)}</b></td></tr>
   <tr><td>Grade level</td><td><b>${esc(c.grade)}</b></td><td>Term</td><td><b>${esc(ap ? ap.q : d.preT)}</b></td></tr>
   <tr><td>Section</td><td><b>${esc(c.section)}</b></td><td>Date assessed</td><td><b>${esc(fdate(ap ? ap.date : d.preDate))}</b></td></tr>
   <tr><td>Subject · Tool</td><td><b>${esc(d.subject)} · ${esc(d.tool)}</b></td><td>Assessed by</td><td><b>${esc(by || '')}</b></td></tr></table>`; };
const sign = (c) => M.printSign(c, 'Prepared by:', 'Noted by:');
function crmPage(c, d, L, n){
  const S = bySex(L); const lv = (l) => levelAt(d, l.id, n);
  const cnt = (arr, k) => arr.filter(l => lv(l) === k).length;
  const lvT = `<table class="rd-t"><thead><tr><th rowspan="2"></th>${LV.map(x => `<th class="lv-${x.k}">${x.t.replace('LEVEL', 'Level')}</th>`).join('')}<th rowspan="2">Total</th></tr><tr>${LV.map(x => `<th class="cmp lv-${x.k}">${esc(x.comp)}</th>`).join('')}</tr></thead>
    <tbody>${S.map(([, t, arr]) => `<tr><td class="l"><b>${t === 'MALE' ? 'Male' : 'Female'}</b></td>${LV.map(x => `<td>${cnt(arr, x.k)}</td>`).join('')}<td><b>${arr.filter(lv).length}</b></td></tr>`).join('')}
    <tr class="tot"><td class="l"><b>Total</b></td>${LV.map(x => `<td><b>${cnt(L, x.k)}</b></td>`).join('')}<td><b>${L.filter(lv).length}</b></td></tr></tbody></table>`;
  const prof = KS[d.ks].profiles; const pc = (k, sx, p) => L.filter(l => (sx === 'M' ? l.sex === 'M' : l.sex !== 'M') && (d.L[l.id] || {})[k] === p).length;
  const pT = `<table class="rd-t"><thead><tr><th rowspan="2" class="l">${esc(KS[d.ks].label)}</th>${PER.map(([, t]) => `<th colspan="3">${t}</th>`).join('')}</tr><tr>${PER.map(() => '<th>Male</th><th>Female</th><th>Total</th>').join('')}</tr></thead>
    <tbody>${prof.map(p => `<tr><td class="l">${esc(p)}</td>${PER.map(([k]) => `<td>${pc(k, 'M', p)}</td><td>${pc(k, 'F', p)}</td><td><b>${pc(k, 'M', p) + pc(k, 'F', p)}</b></td>`).join('')}</tr>`).join('')}
    <tr class="tot"><td class="l"><b>Total</b></td>${PER.map(([k]) => { const a = prof.reduce((s, p) => s + pc(k, 'M', p), 0), b = prof.reduce((s, p) => s + pc(k, 'F', p), 0); return `<td><b>${a}</b></td><td><b>${b}</b></td><td><b>${a + b}</b></td>`; }).join('')}</tr></tbody></table>`;
  // literacy classification by BULIG level (grouping table of the program)
  const cls = [...new Set(LV.map(x => profileOf(d, x.k)))];
  const cT = `<table class="rd-t"><thead><tr><th class="l">BULIG classification (by level)</th><th>Levels</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>${cls.map(p => { const ks = LV.filter(x => profileOf(d, x.k) === p).map(x => x.k);
      const a = L.filter(l => l.sex === 'M' && ks.includes(lv(l))).length, b = L.filter(l => l.sex !== 'M' && ks.includes(lv(l))).length;
      return `<tr><td class="l">${esc(p)}</td><td>${ks.map(k => lvOf(k).short).join(', ')}</td><td>${a}</td><td>${b}</td><td><b>${a + b}</b></td></tr>`; }).join('')}</tbody></table>`;
  let apT = '';
  if(n){ const m = d.aps[n - 1].marks || {}; const c2 = (arr, k) => arr.filter(l => lv(l) && (k === '' ? !m[l.id] || m[l.id] === '-' : m[l.id] === k)).length;
    apT = `<table class="rd-t"><thead><tr><th class="l">Result of ${apName(n)}</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>${[['P','Passed (moved up a level)'],['N','Not ready (stays)'],['','Not assessed']].map(([k, t]) => `<tr><td class="l">${t}</td><td>${c2(S[0][2], k)}</td><td>${c2(S[1][2], k)}</td><td><b>${c2(L, k)}</b></td></tr>`).join('')}</tbody></table>`; }
  return `<div class="rdp">${head(c, d, 'CLASSROOM READING MONITORING REPORT', n)}
    <div class="rd-sec">Reading level of learners ${n ? 'after ' + apName(n) : '(pre-test)'}</div>${lvT}
    ${apT ? `<div class="rd-sec">Assessment result</div>${apT}` : ''}
    <div class="rd-two"><div><div class="rd-sec">Literacy profile · ${esc(KS[d.ks].label)}</div>${pT}</div></div>
    <div class="rd-sec">Learners per BULIG classification</div>${cT}${sign(c)}</div>`;
}
function lopPages(c, d, L, n){
  const m = n ? (d.aps[n - 1].marks || {}) : {}; const byCol = n && Object.keys(d.aps[n - 1].byLv || {}).length;
  return bySex(L).map(([, t, arr]) => `<div class="rdp">${head(c, d, 'LIST OF PUPILS', n)}
    <table class="rd-t lop"><thead><tr><th>No.</th><th class="l">${t}</th>${n ? '<th>Level assessed</th><th>Remarks</th>' : ''}${byCol ? '<th>Assessed by</th>' : ''}<th>Reading level</th><th>Component / Level</th><th>Profile</th></tr></thead>
    <tbody>${arr.map((l, i) => { const k = levelAt(d, l.id, n), x = lvOf(k), b = n ? levelAt(d, l.id, n - 1) : ''; const r = d.L[l.id] || {}; const mk = b ? m[l.id] : '';
      return `<tr><td>${i + 1}</td><td class="l">${esc(nm(l))}</td>${n ? `<td>${b ? lvOf(b).t : ''}</td><td class="${mk === 'P' ? 'ok' : mk === 'N' ? 'no' : ''}">${mk === 'P' ? 'PASSED' : mk === 'N' ? 'NOT READY' : b ? '–' : ''}</td>` : ''}${byCol ? `<td class="sm">${b ? esc(assessorOf(d, n, b)) : ''}</td>` : ''}<td class="l">${x ? esc(x.comp) : ''}</td><td class="lv-${k}"><b>${x ? x.t : ''}</b></td><td>${esc(r[n ? (r.eosy ? 'eosy' : r.mosy ? 'mosy' : 'bosy') : 'bosy'] || '')}</td></tr>`; }).join('') || `<tr><td colspan="7">No ${t.toLowerCase()} learners.</td></tr>`}</tbody></table>
    <div class="rd-legend">${LV.map(x => `<span class="lv-${x.k}">${x.short}</span>`).join('')}<i>Colour coding by BULIG level</i></div>${sign(c)}</div>`);
}
function monPages(c, d, L){
  const A = d.aps;
  return bySex(L).map(([, t, arr]) => `<div class="rdp">${head(c, d, 'CLASSROOM MONITORING TOOL', A.length)}
    <table class="rd-t mon"><thead><tr><th rowspan="2">No.</th><th rowspan="2" class="l">${t}</th><th rowspan="2">Pre-test<br>level<br><span class="tn">${esc(d.preT)}</span></th>${PER.map(([, p]) => `<th rowspan="2">${p}</th>`).join('')}${A.map((a, i) => `<th colspan="2">AP${i + 1}<br><span class="tn">${esc(a.q || '')}${a.date ? ' · ' + esc(M.parse(a.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})) : ''}</span></th>`).join('')}<th rowspan="2">Current level</th></tr>
      <tr>${A.map(() => '<th>Rem.</th><th>Level</th>').join('')}</tr></thead>
    <tbody>${arr.map((l, i) => { const r = d.L[l.id] || {}; return `<tr><td>${i + 1}</td><td class="l">${esc(nm(l))}</td><td class="lv-${r.pre || ''}">${r.pre ? lvOf(r.pre).t : ''}</td>${PER.map(([k]) => `<td class="sm">${esc(r[k] || '')}</td>`).join('')}
      ${A.map((a, j) => { const mk = r.pre ? (a.marks || {})[l.id] : ''; const k = levelAt(d, l.id, j + 1); return `<td class="${mk === 'P' ? 'ok' : mk === 'N' ? 'no' : ''}">${mk === 'P' ? 'P' : mk === 'N' ? 'NR' : r.pre ? '–' : ''}</td><td class="lv-${k}">${k ? lvOf(k).short : ''}</td>`; }).join('')}
      <td class="lv-${curLevel(d, l.id)}"><b>${curLevel(d, l.id) ? lvOf(curLevel(d, l.id)).t : ''}</b></td></tr>`; }).join('')}</tbody></table>
    <div class="rd-legend"><i>P = PASSED (moves up one level) · NR = NOT READY · – = not assessed</i>${LV.map(x => `<span class="lv-${x.k}">${x.short}</span>`).join('')}</div>${sign(c)}</div>`);
}
function groupsPage(c, d, L, n){
  const G = groupsAt(d, L, n);
  return `<div class="rdp">${head(c, d, 'BULIG INTERVENTION GROUPINGS', n)}
    <div class="rd-grid">${G.map(({x, arr}) => `<div class="rd-gc"><div class="h lv-${x.k}"><b>${x.t}</b><span>${esc(profileOf(d, x.k))}</span></div><div class="cmp">${esc(x.comp)}</div>
      <ol>${arr.map(l => `<li>${esc(nm(l))}</li>`).join('')}</ol><div class="ft">${arr.filter(l => l.sex === 'M').length} M · ${arr.filter(l => l.sex !== 'M').length} F · ${arr.length} total</div></div>`).join('') || '<p>No profiled learners yet.</p>'}</div>${sign(c)}</div>`;
}

/* ---------- A4 page fitting: every logical page becomes one sheet, shrunk only when needed ---------- */
function fitPages(pages, land){
  const css = M.pageCss('A4', land); const [PW, PH] = M.printableMm(css); const W = Math.floor(PW) - 0.5, H = Math.floor(PH) - 0.5; const px = 96 / 25.4;
  return pages.map(html => { let k = 1;
    // measured at design width W/k; the page fits when (width, height) × k stay inside the printable area
    for(let i = 0; i < 6; i++){ const m = M.measurePrint(html, W / k);
      if(m.w * k <= W * px + 1 && m.h * k <= H * px - 2) break;
      k = Math.min(k * 0.995, (W * px) / Math.max(m.w, 1), (H * px - 2) / Math.max(m.h, 1)); }
    return `<div class="fitbox" style="width:${W}mm;height:${H}mm;overflow:hidden"><div style="width:${(W / k).toFixed(2)}mm;transform:scale(${k.toFixed(4)});transform-origin:0 0">${html}</div></div>`; }).join('');
}
function printPages(pages, land){ M.doPrint(fitPages(pages, land), M.pageCss('A4', land), {noFit: true}); }
function preview(title, pages, land){
  const html = fitPages(pages, land);
  M.modal(title, `<div class="row" style="margin-bottom:10px"><span class="small muted">A4 ${land ? 'landscape' : 'portrait'} · 0.5 in margins · ${pages.length} page(s)</span><span class="spacer"></span><button class="btn primary" id="pvP">${ico('print')} Print</button></div>
    <div class="rd-prev-wrap"><div class="print-only rd-prev ${land ? 'land' : ''}">${html}</div></div>`, b => {
    const box = $('.rd-prev', b); const fit = () => { const pw = (land ? 297 : 210) * 96 / 25.4; const z = Math.min(1, ($('.rd-prev-wrap', b).clientWidth - 24) / pw); box.style.zoom = z.toFixed(3); }; fit();
    $('#pvP', b).onclick = () => printPages(pages, land);
  }, true);
}
})();
