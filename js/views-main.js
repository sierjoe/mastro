/* MASTRO — Home, Grades, Analysis, Learners (checklist), Repository, Settings */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum, r2, PASS} = M;

/* ---------------- charts ---------------- */
function histogram(vals){
  const bins = [['<65',0,64.5],['65–69',64.5,69.5],['70–74',69.5,74.5],['75–79',74.5,79.5],['80–84',79.5,84.5],['85–89',84.5,89.5],['90–94',89.5,94.5],['95–100',94.5,101]];
  const counts = bins.map(b => vals.filter(v => v>=b[1] && v<b[2]).length);
  const W=640,H=230,pl=30,pb=28,pt=18, max=Math.max(1,...counts), bw=(W-pl-10)/bins.length;
  const step = Math.max(1, Math.ceil(max/4)), top = step*Math.ceil(max/step);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score distribution">
    <defs><linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8a61"/><stop offset="1" stop-color="#1f6b4a"/></linearGradient>
    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2a24a"/><stop offset="1" stop-color="#c27a1a"/></linearGradient></defs>`;
  for(let val=0; val<=top; val+=step){ const y=H-pb-(H-pb-pt)*val/top;
    s += `<line class="axis" x1="${pl}" x2="${W-6}" y1="${y}" y2="${y}"/><text x="${pl-8}" y="${y+4}" text-anchor="end">${val}</text>`; }
  bins.forEach((b,i) => {
    const h=(H-pb-pt)*counts[i]/top, x=pl+i*bw+6, y=H-pb-h, w=bw-12;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h,0)}" rx="7" fill="url(#${b[2]<=74.5?'gA':'gG'})"><title>${b[0]}: ${counts[i]} learner(s)</title></rect>`;
    if(counts[i]) s += `<text x="${x+w/2}" y="${y-6}" text-anchor="middle" style="font-weight:700;fill:var(--ink)">${counts[i]}</text>`;
    s += `<text x="${x+w/2}" y="${H-9}" text-anchor="middle">${b[0]}</text>`;
  });
  return s + '</svg>';
}
function descBar(list){
  const n = list.length || 1, counts = {}; M.DESCS.forEach(d=>counts[d]=0); list.forEach(d=>{ if(counts[d]!==undefined) counts[d]++; });
  return `<div class="stackbar">${M.DESCS.map(d=>counts[d]?`<span style="width:${counts[d]/n*100}%;background:${M.DESC_COLOR[d]}" title="${d}: ${counts[d]}"></span>`:'').join('')}</div>
  <div class="legend">${M.DESCS.map(d=>`<span><i style="background:${M.DESC_COLOR[d]}"></i>${d} <b>${counts[d]}</b> <span class="muted">(${M.DESC_RANGE[d]})</span></span>`).join('')}</div>`;
}
const meter = (done, total, low) => `<div class="bar-track" style="height:10px"><div class="bar-fill ${low?'low':''}" style="width:${total?done/total*100:0}%"></div></div>`;

/* ---------------- data checks ---------------- */
function dataFlags(c){
  const flags = [];
  const noLrn = c.learners.filter(l => !l.lrn);
  if(noLrn.length) flags.push({lvl:'gold', html:`<b>${noLrn.length} learner(s) without LRN</b> — ${noLrn.map(l=>esc(l.name.split(',')[0])).join(', ')}`});
  const seen = {}; c.learners.forEach(l => { if(l.lrn){ (seen[l.lrn] = seen[l.lrn]||[]).push(l.name); } });
  Object.entries(seen).filter(([,v])=>v.length>1).forEach(([lrn,v]) => flags.push({lvl:'red', html:`<b>Duplicate LRN ${esc(lrn)}</b> — ${v.map(esc).join(' and ')}`}));
  const noSex = c.learners.filter(l => l.sex!=='M' && l.sex!=='F');
  if(noSex.length) flags.push({lvl:'gold', html:`<b>${noSex.length} learner(s) without sex recorded</b>`});
  M.termsWithData(c).forEach(t => {
    M.RAW.forEach(k => {
      const vals = c.learners.map(l => ((c.grades[t]||{})[l.id]||{})[k]).filter(isNum);
      if(vals.length >= 5 && vals.every(v => v === vals[0])) flags.push({lvl:'red', html:`<b>Term ${t} ${esc(k)}: every learner has ${vals[0]}</b> — looks like a placeholder; it pulls the general average down`});
    });
    const inc = c.learners.filter(l => { const r = M.termRow(c,t,l.id); return r.filled>0 && r.filled<8; });
    if(inc.length) flags.push({lvl:'gold', html:`<b>Term ${t}: ${inc.length} learner(s) with incomplete grades</b> (no general average yet)`});
  });
  Object.entries(M.statusSummary(c)).forEach(([k,v]) => { if(v.length) flags.push({lvl:k==='SARDO'?'gold':'red', html:`<b>${esc(M.STATUS[k].label)} (${v.length})</b> — ${v.map(l=>`${esc(l.name)}${l.statusDate?' <span class="muted">('+esc(l.statusDate)+')</span>':''}`).join('; ')}${k==='SARDO'?' — monitor closely':' — left out of class statistics'}`}); });
  if(c.learners.some(l=>l.sf1)){ const ns = c.learners.filter(l=>!l.sf1); if(ns.length) flags.push({lvl:'gold', html:`<b>${ns.length} learner(s) not yet on the uploaded SF1</b> — ${ns.map(l=>esc(l.name)).join('; ')}`}); }
  else flags.push({lvl:'gold', html:`<b>No SF1 uploaded yet</b> — upload it in Learners to confirm LIS enrolment, names, LRNs and birthdates`});
  const sec = M.sectionFor(c);
  if(sec){
    const unl = Object.values(sec.students).filter(s => !s.lid && !s.outType);
    if(unl.length) flags.push({lvl:'gold', html:`<b>Attendance: ${unl.length} seat name(s) not linked to a learner</b> — ${unl.map(s=>esc(s.name)).join(', ')} <a href="#attendance">Fix in Attendance → Manage</a>`});
  }
  return flags;
}

/* =====================================================================
   HOME
   ===================================================================== */
M.views.home = async function(el){
  const c = M.cls(), t = M.latestTerm(c), s = M.S.settings;
  const boys = c.learners.filter(l=>l.sex==='M').length, girls = c.learners.filter(l=>l.sex==='F').length;
  const ga = M.valuesFor(c, t, 'GA'); const st = M.stats(ga.map(x=>x.v));
  const below = ga.filter(x => Math.round(x.v) < PASS).length;
  const top = [...ga].sort((a,b)=>b.v-a.v)[0];
  const flags = dataFlags(c);
  const cs = M.checkSummary(c);
  const gradeDone = ['1','2','3'].map(tt => c.learners.filter(l => M.termStatus(c, tt, l.id)==='done').length);
  // attendance today
  const sec = M.sectionFor(c), today = M.today();
  let attHtml = '<div class="empty">Link a SeatCheck section to this class in Attendance → Manage.</div>';
  if(sec){
    const rec = sec.att[today];
    const active = Object.entries(sec.students).filter(([,x]) => !x.outType);
    if(rec){
      const cnt = k => Object.values(rec).filter(v=>v===k).length;
      const abs = Object.entries(rec).filter(([sid,v])=>(v==='A'||v==='E') && sec.students[sid]).map(([sid])=>({name:M.attFullName(sec,sid)}));
      attHtml = `<div class="grid g-3 keep" style="gap:12px"><div class="stat neu-in" style="border-radius:16px"><div class="label">Present</div><div class="value" style="color:var(--green)">${active.length - cnt('A') - cnt('E')}</div></div>
        <div class="stat neu-in" style="border-radius:16px"><div class="label">Absent</div><div class="value" style="color:var(--red)">${cnt('A')+cnt('E')}</div></div>
        <div class="stat neu-in" style="border-radius:16px"><div class="label">Late</div><div class="value" style="color:var(--amber)">${cnt('L')}</div></div></div>
        ${abs.length?`<div class="small" style="margin-top:12px"><b>Absent:</b> ${abs.map(x=>esc(x.name)).join(', ')}</div>`:''}`;
    } else attHtml = `<div class="empty">No attendance taken yet today.</div>`;
    attHtml += `<div class="row" style="margin-top:14px"><a class="btn sm primary" href="#attendance">${ico('attendance')} Take attendance · ${esc(sec.name)}</a></div>`;
  }
  const fresh = !c.learners.length && !M.S.ecr.length && !(M.S.att && M.S.att.sections.length);
  el.innerHTML = (fresh ? `
  <div class="card welcome" style="margin-bottom:20px"><div class="row"><img src="icons/brand.png" alt="" style="width:64px;height:64px;object-fit:contain">
    <div class="grow"><h2 style="margin:0">Welcome to MASTRO</h2><div class="small muted">This device has no class data yet. Restore your MASTRO data file (kept in your Google Drive), or start by uploading your SF1, gradesheet or ECRs.</div></div>
    <button class="btn primary" id="wRestore">${ico('upload')} Restore my data file</button><input type="file" id="wFile" accept=".json" hidden></div></div>` : '') + `
  <div class="grid g-hero">
    <div class="card hero">
      <div class="muted small">${esc(s.school)} · SY ${esc(c.sy)}</div>
      <h2>${esc(M.className(c))}</h2>
      <div class="muted small">Adviser: ${esc(c.adviser)}</div>
      <div class="chips"><span class="chip">${c.learners.length} learners</span><span class="chip">${boys} boys</span><span class="chip">${girls} girls</span><span class="chip">Terms with grades: ${M.termsWithData(c).join(', ')||'none'}</span>${Object.entries(M.statusSummary(c)).filter(([,v])=>v.length).map(([k,v])=>`<span class="chip">${M.STATUS[k].short} ${v.length}</span>`).join('')}</div>
    </div>
    <div class="grid g-2 keep">
      <div class="card stat accent"><div class="label">Class GA · T${t}</div><div class="value">${fmt(st.mean)}</div><div class="sub">median ${fmt(st.median)}</div></div>
      <div class="card stat"><div class="label">Passing (≥75)</div><div class="value">${st.n?Math.round(st.passRate)+'%':'—'}</div><div class="sub">${st.n?st.passed+' of '+st.n:'no data'}</div></div>
      <div class="card stat"><div class="label">Highest GA</div><div class="value">${top?fmt(top.v):'—'}</div><div class="sub">${top?esc(top.l.name.split(',').reverse().join(' ').trim()):''}</div></div>
      <div class="card stat"><div class="label">Missing credentials</div><div class="value" style="color:${cs.missing.length?'var(--amber)':'inherit'}">${cs.missing.length}</div><div class="sub">learners with gaps</div></div>
    </div>
  </div>

  <div class="grid g-2" style="margin-top:20px">
    <div class="card">
      <div class="row"><h2 style="margin:0">Credentials & requirements</h2><span class="spacer"></span><a class="btn sm" href="#learners">${ico('learners')} Open checklist</a></div>
      <div style="margin-top:14px">
        ${['1','2','3'].map((tt,i)=>`<div class="bar-row"><span>Term ${tt} grades</span>${meter(gradeDone[i], cs.total, gradeDone[i]<cs.total)}<b class="num" style="text-align:right">${gradeDone[i]}/${cs.total}</b></div>`).join('')}
        ${cs.per.map(({it,done})=>`<div class="bar-row"><span>${esc(it.label)}</span>${meter(done, cs.total, done<cs.total)}<b class="num" style="text-align:right">${done}/${cs.total}</b></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="row"><h2 style="margin:0">Learners with missing documents</h2><span class="spacer"></span><span class="chip ${cs.missing.length?'gold':'green'}">${cs.missing.length} of ${cs.total}</span></div>
      <div class="list" style="margin-top:14px;max-height:330px;overflow:auto;padding:4px">
        ${cs.missing.length ? cs.missing.map(({l,miss})=>`<div class="item" style="padding:9px 12px"><div class="avatar ${l.sex}" style="width:32px;height:32px;font-size:11px">${esc(M.initials(l.name))}</div><div class="grow"><div class="title small">${esc(l.name)}</div><div class="chips" style="gap:5px;margin-top:4px">${miss.map(it=>`<span class="chip red" style="font-size:11px;padding:2px 8px">${esc(it.short||it.label)}</span>`).join('')}</div></div></div>`).join('') : '<div class="empty">All learners have complete credentials. 🎉</div>'}
      </div>
    </div>
  </div>

  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Attendance today · ${esc(M.longDate(today))}</h2>${attHtml}</div>
    <div class="card"><h2>Descriptor distribution · Term ${t}</h2>${st.n?descBar(ga.map(x=>M.descriptor(x.v))):'<div class="empty">No grades yet.</div>'}
      <div class="row" style="margin-top:16px"><a class="btn sm" href="#analysis">${ico('analysis')} Class analysis</a><a class="btn sm" href="#forms/SF9">${ico('forms')} SF9 report cards</a></div></div>
  </div>

  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Data checks</h2>${flags.length ? flags.map(f=>`<div class="flag"><span class="dot ${f.lvl==='red'?'red':''}"></span><div>${f.html}</div></div>`).join('') : '<div class="empty">Everything looks clean.</div>'}</div>
    <div class="stack">
      <div class="card"><div class="row"><h2 style="margin:0">Recent documents</h2><span class="spacer"></span><a class="btn sm" href="#repo">${ico('repo')} Repository</a></div><div class="list" id="recentDocs" style="margin-top:14px"></div></div>
      <div class="card"><h2>Quick links</h2><div class="list">${(s.links||[]).map(l=>`<a class="item" href="${esc(l.url)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><div class="file-ico link">${ico('link')}</div><div class="grow"><div class="title">${esc(l.label)}</div><div class="tiny muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</div></div></a>`).join('') || '<div class="empty">Add links in Settings.</div>'}</div></div>
    </div>
  </div>`;
  if($('#wRestore')){ $('#wRestore').onclick = () => $('#wFile').click(); $('#wFile').onchange = e => { const f = e.target.files[0]; e.target.value=''; if(f) M.restoreFile(f); }; }
  const docs = (await M.docsAll().catch(()=>[])).sort((a,b)=>b.added.localeCompare(a.added)).slice(0,4);
  const rd = $('#recentDocs'); if(!rd) return;
  rd.innerHTML = docs.length ? docs.map(M.docItem).join('') : '<div class="empty">No documents yet. Upload forms in Forms or the Repository.</div>';
  M.bindDocActions(rd);
};

/* =====================================================================
   GRADES (editable consolidated gradesheet)
   ===================================================================== */
M.views.grades = function viewGrades(el){
  const c = M.cls(), t = M.S.ui.gradesTerm;
  const L = M.sortedLearners(c);
  const cols = [...M.RAW];
  let body = '', idx = 0, lastSex = null;
  L.forEach(l => {
    if(l.sex !== lastSex){ lastSex = l.sex; body += `<tr class="group"><td class="sticky-col" colspan="2">${l.sex==='M'?'Male':l.sex==='F'?'Female':'Sex not set'}</td><td colspan="${cols.length+3}"></td></tr>`; }
    const r = M.termRow(c, t, l.id); idx++;
    body += `<tr data-lid="${l.id}"><td class="muted">${idx}</td><td class="sticky-col"><b>${esc(l.name)}</b> ${M.statusChip(l,1)}</td>` +
      cols.map(k => `<td class="num"><input class="grade-in ${isNum(r[k])&&r[k]<PASS?'low':''}" inputmode="decimal" data-sub="${esc(k)}" value="${isNum(r[k])?r[k]:''}" aria-label="${esc(k)} grade for ${esc(l.name)}"></td>`).join('') +
      `<td class="num computed" data-c="MAPEH">${fmt(r.MAPEH,2).replace(/\.00$/,'')}</td><td class="num" data-c="GA"><b class="${isNum(r.GA)&&Math.round(r.GA)<PASS?'low':''}">${fmt(r.GA)}</b></td><td data-c="desc">${r.desc?`<span class="desc d-${r.desc}">${r.desc}</span>`:''}</td></tr>`;
  });
  const meanRow = () => `<tr><td></td><td class="sticky-col"><b>Class mean</b>${L.some(l=>!M.counted(l))?'<div class="tiny muted">excl. T/O, NLP, DO</div>':''}</td>${[...cols,'MAPEH','GA'].map(k=>`<td class="num computed">${fmt(M.stats(L.filter(M.counted).map(l=>M.termRow(c,t,l.id)[k])).mean)}</td>`).join('')}<td></td></tr>`;
  el.innerHTML = M.excludedNote(c) + `
  <div class="card">
    <div class="row" style="margin-bottom:14px">
      <div class="seg" id="termSeg">${['1','2','3'].map(x=>`<button data-t="${x}" class="${x===t?'on':''}">Term ${x}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn sm" id="impBtn">${ico('upload')} Import Excel</button>
      <button class="btn sm" id="expBtn">${ico('download')} Export Excel</button>
      <button class="btn sm primary" id="prtBtn">${ico('print')} Print Term ${t}</button>
      <input type="file" id="impFile" accept=".xlsx,.xls" hidden>
    </div>
    <p class="small muted" style="margin:0 0 12px">Type a grade and press <b>Enter</b> to move down. MAPEH, General Average and Descriptor compute the same way as your Excel file (GA appears once all 8 learning areas are filled).</p>
    <div class="table-wrap"><table id="gTable">
      <thead><tr><th>#</th><th class="sticky-col">Learner</th>${cols.map(k=>`<th class="num" title="${esc(k)}">${M.SHORT[k]}</th>`).join('')}<th class="num">MAPEH</th><th class="num">GA</th><th>Descriptor</th></tr></thead>
      <tbody>${body}</tbody><tfoot id="gFoot">${meanRow()}</tfoot>
    </table></div>
  </div>`;
  $('#termSeg').onclick = e => { const b=e.target.closest('button'); if(!b) return; M.S.ui.gradesTerm=b.dataset.t; M.save(); viewGrades(el); };
  $('#prtBtn').onclick = () => printGradesheet(c, t);
  $('#expBtn').onclick = () => exportClassXlsx(c);
  $('#impBtn').onclick = () => $('#impFile').click();
  $('#impFile').onchange = e => { const f=e.target.files[0]; if(f) importXlsx(f); e.target.value=''; };
  const tbl = $('#gTable');
  tbl.addEventListener('change', e => {
    const inp = e.target.closest('.grade-in'); if(!inp) return;
    const tr = inp.closest('tr'), lid = tr.dataset.lid, k = inp.dataset.sub;
    const raw = inp.value.trim();
    c.grades[t] = c.grades[t] || {}; const g = c.grades[t][lid] = c.grades[t][lid] || {};
    if(raw===''){ delete g[k]; }
    else { const n = Number(raw); if(!isFinite(n) || n<0 || n>100){ M.toast('Enter a grade from 0 to 100'); inp.value = isNum(g[k])?g[k]:''; return; } g[k] = n; }
    M.save();
    const r = M.termRow(c, t, lid);
    inp.classList.toggle('low', isNum(g[k]) && g[k] < PASS);
    $('[data-c="MAPEH"]', tr).textContent = fmt(r.MAPEH,2).replace(/\.00$/,'');
    $('[data-c="GA"]', tr).innerHTML = `<b class="${isNum(r.GA)&&Math.round(r.GA)<PASS?'low':''}">${fmt(r.GA)}</b>`;
    $('[data-c="desc"]', tr).innerHTML = r.desc?`<span class="desc d-${r.desc}">${r.desc}</span>`:'';
    $('#gFoot').innerHTML = meanRow();
  });
  tbl.addEventListener('keydown', e => {
    if(e.key !== 'Enter') return; const inp = e.target.closest('.grade-in'); if(!inp) return;
    e.preventDefault(); inp.blur();
    const ins = $$(`.grade-in[data-sub="${CSS.escape(inp.dataset.sub)}"]`, tbl); const i = ins.indexOf(inp);
    if(ins[i+1]) { ins[i+1].focus(); ins[i+1].select(); }
  });
};

/* =====================================================================
   ANALYSIS
   ===================================================================== */
M.views.analysis = function viewAnalysis(el){
  const c = M.cls(); const avail = M.termsWithData(c);
  let {term, subject, sex} = M.S.ui;
  if(term!=='F' && !avail.includes(term)) term = avail[avail.length-1] || '1';
  const keys = ['GA', ...M.AREAS, 'Music & Arts', 'PE & Health'];
  const data = M.valuesFor(c, term, subject, sex);
  const st = M.stats(data.map(x=>x.v));
  const termLabel = term==='F' ? `Final (average of Terms ${avail.join(', ')})` : `Term ${term}`;
  const subjLabel = subject==='GA' ? 'General Average' : subject;
  const sexLabel = sex==='all' ? 'All learners' : sex==='M' ? 'Boys' : 'Girls';
  const comp = [...M.AREAS,'GA'].map(k => ({k, s: M.stats(M.valuesFor(c, term, k, sex).map(x=>x.v))}));
  const compRows = comp.filter(x=>x.k!=='GA');
  const lowest = compRows.filter(x=>x.s.n).sort((a,b)=>a.s.mean-b.s.mean)[0];
  const bySex = ['M','F'].map(sx => ({sx, s: M.stats(M.valuesFor(c, term, subject, sx).map(x=>x.v))}));
  const ranked = [...data].sort((a,b)=>b.v-a.v);
  const support = ranked.filter(x => Math.round(x.v) < PASS).reverse();

  el.innerHTML = `
  <div class="card">
    <div class="row">
      <div class="seg" id="aTerm">${['1','2','3'].map(x=>`<button data-t="${x}" class="${x===term?'on':''}" ${avail.includes(x)?'':'disabled title="No grades yet"'}>Term ${x}</button>`).join('')}<button data-t="F" class="${term==='F'?'on':''}" ${avail.length?'':'disabled'}>Final</button></div>
      <select class="input" id="aSubj" style="width:auto;min-width:200px">${keys.map(k=>`<option value="${esc(k)}" ${k===subject?'selected':''}>${k==='GA'?'General Average':esc(k)}</option>`).join('')}</select>
      <div class="seg" id="aSex">${[['all','All'],['M','Boys'],['F','Girls']].map(([v,l])=>`<button data-s="${v}" class="${v===sex?'on':''}">${l}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn sm" id="aExp">${ico('download')} Export</button>
      <button class="btn sm primary" id="aPrt">${ico('print')} Print report</button>
    </div>
  </div>
  ${M.excludedNote(c).replace('class="card status-note"','class="card status-note" style="margin-top:16px"')}
  <div class="small muted" style="margin:16px 4px 10px">${esc(subjLabel)} · ${esc(termLabel)} · ${sexLabel} · ${st.n} learner(s) with grades</div>
  <div class="grid g-4">
    <div class="card stat accent"><div class="label">Mean</div><div class="value">${fmt(st.mean)}</div><div class="sub">average of all grades</div></div>
    <div class="card stat"><div class="label">Median</div><div class="value">${fmt(st.median)}</div><div class="sub">middle grade</div></div>
    <div class="card stat"><div class="label">Mode</div><div class="value" style="font-size:${st.modes&&st.modes.length>1?'22px':''}">${M.modeText(st)}</div><div class="sub">${st.n&&st.modes.length?`appears ${st.modeFreq}× (whole numbers)`:'no repeated grade'}</div></div>
    <div class="card stat"><div class="label">Std. deviation</div><div class="value">${fmt(st.sd)}</div><div class="sub">${st.n?(st.sd<4?'grades are close together':st.sd<8?'moderate spread':'widely spread'):''}</div></div>
    <div class="card stat"><div class="label">Highest</div><div class="value">${fmt(st.max)}</div><div class="sub">${ranked[0]?esc(ranked[0].l.name):''}</div></div>
    <div class="card stat"><div class="label">Lowest</div><div class="value">${fmt(st.min)}</div><div class="sub">${ranked.length?esc(ranked[ranked.length-1].l.name):''}</div></div>
    <div class="card stat"><div class="label">Range</div><div class="value">${fmt(st.range)}</div><div class="sub">highest − lowest</div></div>
    <div class="card stat"><div class="label">Passing (≥75)</div><div class="value">${st.n?fmt(st.passRate,1)+'%':'—'}</div><div class="sub">${st.n?`${st.passed} passed · ${st.n-st.passed} below`:''}</div></div>
  </div>
  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Grade distribution</h2>${st.n?histogram(st.values):'<div class="empty">No grades for this selection.</div>'}<div class="legend"><span><i style="background:#1f6b4a"></i>75 and above</span><span><i style="background:#c27a1a"></i>below 75</span></div></div>
    <div class="card"><h2>Proficiency descriptors</h2>${st.n?descBar(data.map(x=>M.descriptor(x.v))):'<div class="empty">—</div>'}
      <h3 style="margin-top:22px">Boys vs girls · ${esc(subjLabel)}</h3>
      <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Group</th><th class="num">N</th><th class="num">Mean</th><th class="num">Median</th><th class="num">Mode</th><th class="num">Pass %</th></tr></thead>
      <tbody>${bySex.map(({sx,s})=>`<tr><td>${sx==='M'?'Boys':'Girls'}</td><td class="num">${s.n}</td><td class="num">${fmt(s.mean)}</td><td class="num">${fmt(s.median)}</td><td class="num">${M.modeText(s)}</td><td class="num">${s.n?fmt(s.passRate,1):'—'}</td></tr>`).join('')}</tbody></table></div>
    </div>
  </div>
  <div class="card" style="margin-top:20px">
    <div class="row"><h2 style="margin:0">Learning area comparison</h2><span class="spacer"></span>${lowest?`<span class="chip gold">Lowest mean: ${esc(lowest.k)} (${fmt(lowest.s.mean)})</span>`:''}</div>
    <div style="margin:14px 0 18px">${compRows.map(({k,s})=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill ${s.n&&s.mean<PASS?'low':''}" style="width:${s.n?Math.max(2,(s.mean-60)/40*100):0}%"></div></div><b class="num" style="text-align:right">${fmt(s.mean)}</b></div>`).join('')}
      <div class="tiny muted">Bars start at 60 so differences are easier to see.</div></div>
    <div class="table-wrap" style="max-height:none"><table>
      <thead><tr><th>Learning area</th><th class="num">N</th><th class="num">Mean</th><th class="num">Median</th><th class="num">Mode</th><th class="num">SD</th><th class="num">Lowest</th><th class="num">Highest</th><th class="num">Pass %</th></tr></thead>
      <tbody>${comp.map(({k,s})=>`<tr ${k==='GA'?'style="font-weight:700"':''}><td>${k==='GA'?'General Average':esc(k)}</td><td class="num">${s.n}</td><td class="num">${fmt(s.mean)}</td><td class="num">${fmt(s.median)}</td><td class="num">${M.modeText(s)}</td><td class="num">${fmt(s.sd)}</td><td class="num">${fmt(s.min)}</td><td class="num">${fmt(s.max)}</td><td class="num">${s.n?fmt(s.passRate,1):'—'}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>
  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Ranking · ${esc(subjLabel)}</h2>
      <div class="table-wrap"><table><thead><tr><th class="num">Rank</th><th>Learner</th><th class="num">Grade</th><th>Descriptor</th></tr></thead>
      <tbody>${rankRows(ranked)}</tbody></table></div></div>
    <div class="card"><h2>Needs support (below 75)</h2>
      ${support.length ? `<div class="list">${support.map(x=>`<div class="item"><div class="avatar ${x.l.sex}">${esc(M.initials(x.l.name))}</div><div class="grow"><div class="title">${esc(x.l.name)}</div><div class="tiny muted">${lowAreas(c, term, x.l.id)}</div></div><b class="low">${fmt(x.v)}</b></div>`).join('')}</div>` : '<div class="empty">No learner is below 75 for this selection. 🎉</div>'}
    </div>
  </div>`;
  $('#aTerm').onclick = e => { const b=e.target.closest('button'); if(!b||b.disabled) return; M.S.ui.term=b.dataset.t; M.save(); viewAnalysis(el); };
  $('#aSex').onclick = e => { const b=e.target.closest('button'); if(!b) return; M.S.ui.sex=b.dataset.s; M.save(); viewAnalysis(el); };
  $('#aSubj').onchange = e => { M.S.ui.subject=e.target.value; M.save(); viewAnalysis(el); };
  $('#aPrt').onclick = () => printAnalysis(c, term, sex);
  $('#aExp').onclick = () => exportAnalysisXlsx(c, term, sex);
};
function rankRows(ranked){
  let rank = 0, prev = null;
  return ranked.map((x,i) => { if(x.v!==prev){ rank=i+1; prev=x.v; } const d=M.descriptor(x.v);
    return `<tr><td class="num muted">${rank}</td><td>${esc(x.l.name)} ${M.statusChip(x.l,1)}</td><td class="num"><b class="${Math.round(x.v)<PASS?'low':''}">${fmt(x.v)}</b></td><td>${d?`<span class="desc d-${d}">${d}</span>`:''}</td></tr>`; }).join('');
}
function lowAreas(c, term, lid){
  const r = M.rowFor(c, term, lid); const lows = M.AREAS.filter(k => isNum(r[k]) && Math.round(r[k]) < PASS);
  return lows.length ? 'Below 75 in: ' + lows.map(k=>M.SHORT[k]).join(', ') : 'All learning areas 75+';
}

/* =====================================================================
   LEARNERS — roster + credentials checklist monitoring
   ===================================================================== */
M.views.learners = function viewLearners(el){
  const c = M.cls(); const items = M.checkItems();
  const q = (viewLearners.q||'').toLowerCase(), f = M.S.ui.lfilter;
  const dup = {}; c.learners.forEach(l => { if(l.lrn) dup[l.lrn]=(dup[l.lrn]||0)+1; });
  const all = M.sortedLearners(c);
  const totalItems = 3 + items.length;
  const score = (l) => ['1','2','3'].filter(t=>M.termStatus(c,t,l.id)==='done').length + items.filter(it=>(c.checklist[l.id]||{})[it.id]).length;
  const L = all.filter(l => (!q || l.name.toLowerCase().includes(q) || (l.lrn||'').includes(q)) &&
    (f==='all' || (f==='missing' && M.missingFor(c,l.id).length) || (f==='complete' && !M.missingFor(c,l.id).length) || (f==='tagged' && l.status)));
  const gradeCell = (st) => st==='done' ? `<span class="ck on" title="Complete in gradesheet">${ico('check')}</span>` : st==='part' ? `<span class="ck part" title="Some grades missing">½</span>` : `<span class="ck none" title="No grades yet">–</span>`;
  const colDone = (it) => c.learners.filter(l => (c.checklist[l.id]||{})[it.id]).length;
  const termDone = (t) => c.learners.filter(l => M.termStatus(c,t,l.id)==='done').length;
  let body = '', last = null, i = 0;
  L.forEach(l => {
    if(l.sex!==last){ last=l.sex; body += `<tr class="group"><td colspan="2" class="sticky-col">${l.sex==='M'?'Male':l.sex==='F'?'Female':'Sex not set'}</td><td colspan="${totalItems+2}"></td></tr>`; }
    const sc = score(l), cl = c.checklist[l.id]||{};
    body += `<tr data-lid="${l.id}"><td class="muted">${++i}</td>
      <td class="sticky-col"><a href="#" class="lname" data-open="${l.id}"><b>${esc(l.name)}</b></a> ${M.statusChip(l,1)}<div class="tiny muted">LRN: ${l.lrn?esc(l.lrn):'<span class="low">missing</span>'}${dup[l.lrn]>1?' · <span class="low">duplicate</span>':''} · ${l.sf1?`<span style="color:var(--green);font-weight:700" title="Matched on SF1 ${esc(l.sf1.date)}">SF1 ✓</span>`:'<span title="Not yet found on an uploaded SF1">not in SF1</span>'}</div></td>
      ${['1','2','3'].map(t=>`<td class="c">${gradeCell(M.termStatus(c,t,l.id))}</td>`).join('')}
      ${items.map(it=>`<td class="c"><button class="ck btn-ck ${cl[it.id]?'on':'off'}" data-item="${esc(it.id)}" title="${cl[it.id]?'Submitted '+esc(cl[it.id]):'Not yet submitted — tap to mark'}" aria-label="${esc(it.label)} for ${esc(l.name)}">${cl[it.id]?ico('check'):''}</button></td>`).join('')}
      <td><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar-track" style="width:70px;height:8px"><div class="bar-fill ${sc<totalItems?'low':''}" style="width:${sc/totalItems*100}%"></div></div><span class="tiny ${sc<totalItems?'':'muted'}">${sc}/${totalItems}</span></div></td><td><button class="btn sm st-btn" data-st="${l.id}">${l.status?M.STATUS[l.status].short:'Active'}</button></td></tr>`;
  });
  el.innerHTML = `
  <div class="grid g-4 ck-stats" style="margin-bottom:20px">
    ${['1','2','3'].map(t=>{const d=termDone(t);return `<div class="card stat"><div class="label">Term ${t} grades</div><div class="value">${d}<span class="muted" style="font-size:16px">/${c.learners.length}</span></div>${meter(d,c.learners.length,d<c.learners.length)}</div>`;}).join('')}
    ${items.map(it=>{const d=colDone(it);return `<div class="card stat"><div class="label">${esc(it.label)}</div><div class="value">${d}<span class="muted" style="font-size:16px">/${c.learners.length}</span></div>${meter(d,c.learners.length,d<c.learners.length)}</div>`;}).join('')}
  </div>
  <div class="card">
    <div class="row" style="margin-bottom:14px">
      <input class="input" id="lq" placeholder="Search name or LRN…" value="${esc(viewLearners.q||'')}" style="max-width:260px">
      <div class="seg" id="lf">${[['all','All'],['missing','With missing'],['complete','Complete'],['tagged','Tagged status']].map(([v,t])=>`<button data-f="${v}" class="${v===f?'on':''}">${t}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn sm gold" id="lSf1">${ico('upload')} Upload SF1</button>
      <button class="btn sm" id="lPrint">${ico('print')} Print checklist</button>
      <button class="btn sm primary" id="addL">${ico('plus')} Add learner</button>
    </div>
    <p class="small muted" style="margin:0 0 12px"><b>Upload SF1</b> (Excel from LIS) to mark LIS Enrolment automatically and use the SF1 names, LRNs and birthdates. Term columns fill in automatically from the gradesheet. Tap a document box to mark it submitted (tap again to undo). Tap a column title to mark the whole class.</p>
    <div class="table-wrap"><table class="checklist">
      <thead><tr><th>#</th><th class="sticky-col">Learner</th>${['1','2','3'].map(t=>`<th class="c">T${t}</th>`).join('')}${items.map(it=>`<th class="c sortable" data-all="${esc(it.id)}" title="Mark all learners">${esc(it.short||it.label)}</th>`).join('')}<th>Progress</th><th>Status</th></tr></thead>
      <tbody>${body || `<tr><td colspan="${totalItems+3}"><div class="empty">No learners match.</div></td></tr>`}</tbody>
    </table></div>
  </div>`;
  const qi = $('#lq'); qi.oninput = () => { viewLearners.q = qi.value; const pos = qi.selectionStart; viewLearners(el); const n=$('#lq'); n.focus(); n.setSelectionRange(pos,pos); };
  $('#lf').onclick = e => { const b=e.target.closest('button'); if(!b) return; M.S.ui.lfilter=b.dataset.f; M.save(); viewLearners(el); };
  $('#addL').onclick = () => learnerForm(c, null);
  $('#lPrint').onclick = () => printChecklist(c);
  $('#lSf1').onclick = () => M.pickSF1();
  el.querySelector('table.checklist').addEventListener('click', e => {
    const open = e.target.closest('[data-open]'); if(open){ e.preventDefault(); learnerProfile(c, c.learners.find(l=>l.id===open.dataset.open)); return; }
    const sb = e.target.closest('[data-st]'); if(sb){ M.setStatus(c, c.learners.find(l=>l.id===sb.dataset.st)); return; }
    const b = e.target.closest('.btn-ck');
    if(b){ const lid = b.closest('tr').dataset.lid, id = b.dataset.item; const cl = c.checklist[lid] = c.checklist[lid]||{};
      if(cl[id]) delete cl[id]; else cl[id] = M.today(); M.save(); viewLearners(el); return; }
    const h = e.target.closest('[data-all]');
    if(h){ const it = items.find(x=>x.id===h.dataset.all); const allOn = c.learners.every(l=>(c.checklist[l.id]||{})[it.id]);
      if(!confirm(allOn ? `Clear "${it.label}" for all learners?` : `Mark "${it.label}" as submitted for all learners?`)) return;
      c.learners.forEach(l => { const cl = c.checklist[l.id] = c.checklist[l.id]||{}; if(allOn) delete cl[it.id]; else if(!cl[it.id]) cl[it.id] = M.today(); });
      M.save(); viewLearners(el); }
  });
};
function printChecklist(c){
  const items = M.checkItems(); let i=0, last=null;
  const mark = (v) => v ? '✓' : '';
  const rows = M.sortedLearners(c).map(l => { const cl=c.checklist[l.id]||{}; let pre='';
    if(l.sex!==last){ last=l.sex; pre=`<tr><td colspan="${5+items.length}"><b>${l.sex==='M'?'MALE':'FEMALE'}</b></td></tr>`; }
    return pre+`<tr><td>${++i}</td><td>${esc(l.lrn)}</td><td>${esc(l.name)}</td>${['1','2','3'].map(t=>`<td style="text-align:center">${M.termStatus(c,t,l.id)==='done'?'✓':M.termStatus(c,t,l.id)==='part'?'½':''}</td>`).join('')}${items.map(it=>`<td style="text-align:center">${mark(cl[it.id])}</td>`).join('')}</tr>`; }).join('');
  M.doPrint(M.printHeader('LEARNERS’ CREDENTIALS CHECKLIST') + `<p>Grade &amp; Section: <b>${esc(M.className(c))}</b> &nbsp; School Year: <b>${esc(c.sy)}</b></p>
    <table><thead><tr><th>#</th><th>LRN</th><th>Name</th><th>T1</th><th>T2</th><th>T3</th>${items.map(it=>`<th>${esc(it.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>` + M.printSign(c));
}
function learnerProfile(c, l){
  const terms = ['1','2','3'];
  const rows = terms.map(t => M.termRow(c, t, l.id));
  const f = M.finalRow(c, l.id);
  const cl = c.checklist[l.id]||{};
  M.modal(l.name, `
    <div class="row" style="margin-bottom:14px">${l.status?`<span class="chip ${M.STATUS[l.status].cls}">${esc(M.STATUS[l.status].label)}${l.statusDate?' · '+esc(l.statusDate):''}${l.statusNote?' · '+esc(l.statusNote):''}</span>`:'<span class="chip green">Active</span>'}<span class="chip">${l.sex==='M'?'Male':l.sex==='F'?'Female':'Sex not set'}</span><span class="chip">LRN ${esc(l.lrn||'—')}</span>${l.birthday?`<span class="chip">Born ${esc(l.birthday)} · age ${M.ageOn(l.birthday)}</span>`:''}</div>
    <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Learning area</th>${terms.map(t=>`<th class="num">T${t}</th>`).join('')}<th class="num">Final</th></tr></thead>
    <tbody>${[...M.AREAS,'GA'].map(k=>`<tr ${k==='GA'?'style="font-weight:700"':''}><td>${k==='GA'?'General Average':esc(k)}</td>${rows.map(r=>`<td class="num ${isNum(r[k])&&Math.round(r[k])<PASS?'low':''}">${fmt(r[k],k==='GA'||k==='MAPEH'?2:0)}</td>`).join('')}<td class="num">${fmt(f[k])}</td></tr>`).join('')}</tbody></table></div>
    <h3 style="margin-top:16px">Credentials</h3>
    <div class="chips">${M.checkItems().map(it=>`<span class="chip ${cl[it.id]?'green':'red'}">${cl[it.id]?'✓':'✕'} ${esc(it.label)}${cl[it.id]?' · '+esc(cl[it.id]):''}</span>`).join('')}</div>
    ${l.remarks?`<p class="small"><b>Remarks:</b> ${esc(l.remarks)}</p>`:''}
    <div class="row" style="margin-top:16px"><button class="btn sm" id="pEdit">Edit details</button><button class="btn sm" id="pStat">Set status</button><a class="btn sm" href="#forms/SF9/${l.id}">${ico('forms')} SF9</a><span class="spacer"></span><button class="btn sm danger" id="pDel">Remove learner</button></div>`,
  b => {
    $('#pEdit', b).onclick = () => learnerForm(c, l);
    $('#pStat', b).onclick = () => M.setStatus(c, l);
    $('a[href^="#forms"]', b).onclick = () => M.closeModal();
    $('#pDel', b).onclick = () => { if(!confirm(`Remove ${l.name} and all their grades?`)) return;
      c.learners = c.learners.filter(x=>x.id!==l.id); ['1','2','3'].forEach(t=>{ if(c.grades[t]) delete c.grades[t][l.id]; }); delete c.checklist[l.id]; M.save(); M.closeModal(); M.route(); M.toast('Learner removed'); };
  });
}
M.learnerProfile = learnerProfile;
function learnerForm(c, l){
  const x = l || {name:'', lrn:'', sex:'M', birthday:'', remarks:''};
  M.modal(l?'Edit learner':'Add learner', `
    <div class="grid g-2">
      <label class="field" style="grid-column:1/-1">Name (Family Name, First Name Middle Name)<input class="input" id="fN" value="${esc(x.name)}"></label>
      <label class="field">LRN<input class="input" id="fL" inputmode="numeric" maxlength="12" value="${esc(x.lrn)}"></label>
      <label class="field">Sex<select class="input" id="fS"><option value="M" ${x.sex==='M'?'selected':''}>Male</option><option value="F" ${x.sex==='F'?'selected':''}>Female</option></select></label>
      <label class="field">Birthday <span class="muted">(age on SF9 is computed from this)</span><input class="input" id="fB" type="date" value="${esc(x.birthday)}"></label>
      <label class="field">Age override <span class="muted">(only if no birthday)</span><input class="input" id="fA" inputmode="numeric" value="${esc(x.age||'')}"></label>
      <label class="field">Status<select class="input" id="fSt"><option value="">Active</option>${Object.entries(M.STATUS).map(([k,v])=>`<option value="${k}" ${x.status===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
      <label class="field">Status date<input class="input" id="fSD" type="date" value="${esc(x.statusDate||'')}"></label>
      <label class="field" style="grid-column:1/-1">Status note <span class="muted">(e.g. school transferred to, reason)</span><input class="input" id="fSN" value="${esc(x.statusNote||'')}"></label>
      <label class="field" style="grid-column:1/-1">Remarks<textarea class="input" id="fR" rows="2">${esc(x.remarks)}</textarea></label>
    </div>
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn" id="fC">Cancel</button><button class="btn primary" id="fSave">Save</button></div>`,
  b => {
    $('#fC', b).onclick = M.closeModal;
    $('#fSave', b).onclick = () => {
      const name = $('#fN',b).value.trim(); if(!name) return M.toast('Name is required');
      const lrn = $('#fL',b).value.replace(/\D/g,'');
      if(lrn && lrn.length!==12) M.toast('Note: LRN is usually 12 digits');
      const data = {name, lrn, sex:$('#fS',b).value, birthday:$('#fB',b).value, age:$('#fA',b).value.replace(/\D/g,''), remarks:$('#fR',b).value.trim(),
        status:$('#fSt',b).value, statusDate:$('#fSt',b).value ? ($('#fSD',b).value || M.today()) : '', statusNote:$('#fSN',b).value.trim()};
      let target = l; if(l) Object.assign(l, data); else { target = Object.assign({id:M.uid('L')}, data); c.learners.push(target); }
      M.syncStatus(c, target);
      M.save(); M.closeModal(); M.route(); M.toast('Saved');
    };
  });
}
M.learnerForm = learnerForm;
// keep Attendance (SF2/SF4) in step with the learner's status
M.syncStatus = (c, l) => {
  const sec = M.sectionFor(c); const sid = M.sidFor(sec, l.id); if(!sid) return;
  const st = sec.students[sid];
  if(l.status==='TO' || l.status==='DO'){ st.outType = l.status==='TO' ? 'transferred' : 'dropped'; st.outDate = l.statusDate || M.today(); st.outNote = l.statusNote || st.outNote || ''; st.fromStatus = true; }
  else if(st.fromStatus){ delete st.outType; delete st.outDate; delete st.fromStatus; }
};
M.setStatus = (c, l) => M.modal(`Status · ${l.name}`, `
  <div class="list">${[['', 'Active', 'Counted in all statistics'], ...Object.entries(M.STATUS).map(([k,v]) => [k, v.label, k==='SARDO'?'Still counted; flagged for monitoring':'Left out of class statistics; shown as a reminder'])].map(([k,t,d]) => `<label class="item" style="cursor:pointer"><input type="radio" name="stR" value="${k}" ${(l.status||'')===k?'checked':''}><div class="grow"><div class="title">${t}</div><div class="tiny muted">${d}</div></div></label>`).join('')}</div>
  <div class="grid g-2" style="margin-top:12px"><label class="field">Date<input type="date" class="input" id="stD" value="${M.esc(l.statusDate||M.today())}"></label><label class="field">Note<input class="input" id="stN" value="${M.esc(l.statusNote||'')}" placeholder="School transferred to / reason"></label></div>
  <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" id="stX">Cancel</button><button class="btn primary" id="stOk">Save</button></div>`,
  b => { $('#stX',b).onclick = M.closeModal; $('#stOk',b).onclick = () => { const v = (b.querySelector('[name=stR]:checked')||{}).value||'';
    l.status = v; l.statusDate = v ? ($('#stD',b).value || M.today()) : ''; l.statusNote = v ? $('#stN',b).value.trim() : ''; M.syncStatus(c, l); M.save(); M.closeModal(); M.route(); M.toast(v ? `Tagged ${M.STATUS[v].short}` : 'Marked active'); }; });

/* =====================================================================
   REPOSITORY (offline document storage)
   ===================================================================== */
function fileKind(d){
  if(d.url && !d.blob) return ['link','LINK'];
  const n = (d.name||'').toLowerCase(), m = d.mime||'';
  if(m.includes('pdf')||n.endsWith('.pdf')) return ['pdf','PDF'];
  if(/\.(xlsx?|csv)$/.test(n)||m.includes('sheet')||m.includes('excel')) return ['xls','XLS'];
  if(/\.(docx?|rtf)$/.test(n)||m.includes('word')) return ['doc','DOC'];
  if(m.startsWith('image/')) return ['img','IMG'];
  return ['', (n.split('.').pop()||'FILE').slice(0,4).toUpperCase()];
}
M.docItem = function(d){
  const [k,lbl] = fileKind(d);
  const c = M.S.classes.find(x=>x.id===d.classId);
  return `<div class="item" data-doc="${d.id}"><div class="file-ico ${k}">${k==='link'?ico('link'):lbl}</div>
    <div class="grow"><div class="title">${esc(d.name)}</div><div class="tiny muted">${d.formCode?esc(d.formCode)+' · ':''}${esc(d.category)}${c?' · '+esc(M.className(c)):''} · ${d.blob?M.fmtBytes(d.size):'link'} · ${new Date(d.added).toLocaleDateString()}${d.tags?' · '+esc(d.tags):''}</div></div>
    <button class="btn sm" data-act="open">Open</button>${d.blob?`<button class="icon-btn" data-act="dl" title="Download">⤓</button>`:''}<button class="icon-btn" data-act="edit" title="Edit">✎</button></div>`;
};
M.bindDocActions = function(root){
  root.onclick = async e => {
    const b = e.target.closest('[data-act]'); if(!b) return;
    const id = b.closest('[data-doc]').dataset.doc; const d = await M.docGet(id); if(!d) return;
    if(b.dataset.act==='open'){
      if(!d.blob){ window.open(d.url, '_blank', 'noopener'); return; }
      const u = URL.createObjectURL(d.blob); const w = window.open(u, '_blank');
      if(!w) M.downloadBlob(d.blob, d.name); setTimeout(()=>URL.revokeObjectURL(u), 60000);
    }
    if(b.dataset.act==='dl') M.downloadBlob(d.blob, d.name);
    if(b.dataset.act==='edit') docForm(d);
  };
};
const catOptions = (sel) => M.CATS.map(x=>`<option ${x===sel?'selected':''}>${x}</option>`).join('');
const classOptions = (sel) => `<option value="">All classes / general</option>` + M.S.classes.map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(M.className(c))}</option>`).join('');
function docForm(d){
  M.modal('Document details', `
    <div class="grid g-2">
      <label class="field" style="grid-column:1/-1">Name<input class="input" id="dN" value="${esc(d.name)}"></label>
      <label class="field">Category<select class="input" id="dC">${catOptions(d.category)}</select></label>
      <label class="field">Class<select class="input" id="dK">${classOptions(d.classId)}</select></label>
      <label class="field" style="grid-column:1/-1">Tags (comma-separated)<input class="input" id="dT" value="${esc(d.tags||'')}" placeholder="SF2, Term 1, signed"></label>
      ${d.blob?'':`<label class="field" style="grid-column:1/-1">Link URL<input class="input" id="dU" value="${esc(d.url||'')}"></label>`}
      <label class="field" style="grid-column:1/-1">Notes<textarea class="input" id="dX" rows="2">${esc(d.notes||'')}</textarea></label>
    </div>
    <div class="row" style="margin-top:16px"><button class="btn danger sm" id="dDel">Delete</button><span class="spacer"></span><button class="btn" id="dCancel">Cancel</button><button class="btn primary" id="dSave">Save</button></div>`,
  b => {
    $('#dCancel',b).onclick = M.closeModal;
    $('#dDel',b).onclick = async () => { if(!confirm('Delete this document from MASTRO?')) return; await M.docDel(d.id); M.closeModal(); M.route(); M.toast('Deleted'); };
    $('#dSave',b).onclick = async () => {
      Object.assign(d, {name:$('#dN',b).value.trim()||d.name, category:$('#dC',b).value, classId:$('#dK',b).value, tags:$('#dT',b).value.trim(), notes:$('#dX',b).value.trim()});
      if($('#dU',b)) d.url = $('#dU',b).value.trim();
      await M.docPut(d); M.closeModal(); M.route(); M.toast('Saved');
    };
  });
}
M.docForm = docForm;
M.addFiles = async function(files, category, extra){
  if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  let n = 0;
  for(const f of files){
    await M.docPut(Object.assign({id:M.uid('d'), name:f.name, category, classId:M.S.activeClassId, tags:'', notes:'', mime:f.type, size:f.size, added:new Date().toISOString(), blob:f}, extra||{}));
    n++;
  }
  M.toast(`${n} file(s) saved to MASTRO`); M.route();
};
M.dropZone = function(drop, input, onFiles){
  drop.onclick = () => input.click();
  input.onchange = () => { if(input.files.length) onFiles([...input.files]); input.value=''; };
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if(e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
};
M.views.repo = async function viewRepo(el){
  const st = viewRepo.st || (viewRepo.st = {cat:'All', q:'', scope:'all'});
  el.innerHTML = `
  <div class="grid g-hero">
    <div class="card">
      <div class="drop" id="drop">${ico('upload','width:34px;height:34px;color:var(--green)')}
        <div><b>Drop files here or tap to upload</b></div><div class="small muted">PDF, Word, Excel, images — stored on this device, works offline</div></div>
      <input type="file" id="upFile" multiple hidden>
      <div class="row" style="margin-top:14px"><label class="field" style="flex-direction:row;align-items:center;gap:10px">Save to<select class="input" id="upCat" style="width:auto">${catOptions(st.upCat||'School Forms')}</select></label><span class="spacer"></span><button class="btn sm" id="addLink">${ico('link')} Add link</button></div>
    </div>
    <div class="card"><h2>Google Drive repository</h2><p class="small muted" style="margin-top:0">Your online copy lives in Drive. Open it to upload originals or pull files down, then add them here for offline use.</p>
      <a class="btn gold" href="${esc(M.S.settings.driveUrl)}" target="_blank" rel="noopener">${ico('drive')} Open Drive folder</a>
      <div class="tiny muted" style="margin-top:12px" id="storeInfo"></div></div>
  </div>
  <div class="card" style="margin-top:20px">
    <div class="row" style="margin-bottom:14px">
      <div class="seg" id="catSeg">${['All',...M.CATS].map(x=>`<button data-c="${x}" class="${x===st.cat?'on':''}">${x}</button>`).join('')}</div>
      <span class="spacer"></span>
      <select class="input" id="scope" style="width:auto"><option value="all" ${st.scope==='all'?'selected':''}>All classes</option><option value="cls" ${st.scope==='cls'?'selected':''}>This class only</option></select>
      <input class="input" id="dq" placeholder="Search documents…" value="${esc(st.q)}" style="max-width:240px">
    </div>
    <div class="list" id="docList"><div class="empty">Loading…</div></div>
  </div>`;
  M.dropZone($('#drop'), $('#upFile'), files => M.addFiles(files, $('#upCat').value));
  $('#upCat').onchange = e => st.upCat = e.target.value;
  $('#addLink').onclick = () => docForm({id:M.uid('d'), name:'New link', category:$('#upCat').value, classId:M.S.activeClassId, url:'https://', added:new Date().toISOString(), blob:null});
  $('#catSeg').onclick = e => { const b=e.target.closest('button'); if(!b) return; st.cat=b.dataset.c; viewRepo(el); };
  $('#scope').onchange = e => { st.scope=e.target.value; viewRepo(el); };
  const dq = $('#dq'); dq.oninput = () => { st.q = dq.value; renderList(); };
  let all = [];
  try { all = await M.docsAll(); } catch(e) { $('#docList').innerHTML = '<div class="empty">This browser blocked offline storage (private mode?).</div>'; return; }
  function renderList(){
    const q = st.q.toLowerCase();
    const list = all.filter(d => (st.cat==='All'||d.category===st.cat) && (st.scope==='all'||!d.classId||d.classId===M.S.activeClassId) &&
      (!q || (d.name+' '+(d.tags||'')+' '+(d.notes||'')+' '+(d.formCode||'')).toLowerCase().includes(q))).sort((a,b)=>b.added.localeCompare(a.added));
    $('#docList').innerHTML = list.length ? list.map(M.docItem).join('') : '<div class="empty">No documents here yet.</div>';
  }
  renderList(); M.bindDocActions($('#docList'));
  if(navigator.storage && navigator.storage.estimate){ const e = await navigator.storage.estimate(); const si=$('#storeInfo'); if(si) si.textContent = `${all.length} item(s) · using ${M.fmtBytes(e.usage)} of ~${M.fmtBytes(e.quota)} available on this device`; }
};

/* =====================================================================
   SETTINGS
   ===================================================================== */
M.views.settings = function(el){
  const s = M.S.settings, c = M.cls();
  const f = (k, label, extra='') => `<label class="field">${label}<input class="input" data-s="${k}" value="${esc(s[k]||'')}" ${extra}></label>`;
  el.innerHTML = `
  <div class="grid g-2">
    <div class="card"><h2>School & signatories</h2>
      <div class="stack" style="gap:12px">
        <div class="grid g-2" style="gap:12px">${f('school','School')}${f('schoolId','School ID')}</div>
        ${f('address','Address')}
        ${f('region','Region / Division line (printed reports)')}
        <div class="grid g-2" style="gap:12px">${f('head','School Head')}${f('headTitle','Title')}</div>
        ${f('driveUrl','Google Drive folder')}
        <label class="field">Appearance<select class="input" data-s="theme"><option value="auto" ${s.theme==='auto'?'selected':''}>Match device</option><option value="light" ${s.theme==='light'?'selected':''}>Light</option><option value="dark" ${s.theme==='dark'?'selected':''}>Dark</option></select></label>
      </div>
      <h2 style="margin-top:22px">Printout logos</h2>
      <p class="small muted" style="margin-top:0">Shown on the SF9, SF2/SF4 and every printed report — DepEd seal on the upper left, school seal on the upper right.</p>
      <div class="grid g-2" style="gap:12px">${['deped','school'].map(k=>`<div class="logo-slot"><div class="logo-prev">${(s.logos||{})[k]?`<img src="${s.logos[k]}" alt="">`:'<span class="muted small">none</span>'}</div><div><b class="small">${k==='deped'?'DepEd seal (left)':'School seal (right)'}</b><div class="row" style="margin-top:6px"><button class="btn sm" data-logo="${k}">${ico('upload')} Upload</button>${(s.logos||{})[k]?`<button class="btn sm danger" data-logorm="${k}">Remove</button>`:''}</div></div></div>`).join('')}</div>
      <input type="file" id="logoFile" accept="image/*" hidden>
      <h2 style="margin-top:22px">SF9 header lines</h2>
      <div class="grid g-2" style="gap:12px">${f('regionName','Region')}${f('division','Division')}${f('district','District')}${f('municipality','Municipality, Province')}</div>
    </div>
    <div class="stack">
      <div class="card"><h2>Active class</h2>
        <div class="grid g-2" style="gap:12px">
          <label class="field">Grade level<input class="input" data-c="grade" value="${esc(c.grade)}"></label>
          <label class="field">Section<input class="input" data-c="section" value="${esc(c.section)}"></label>
          <label class="field">School year<input class="input" data-c="sy" value="${esc(c.sy)}"></label>
          <label class="field">Adviser<input class="input" data-c="adviser" value="${esc(c.adviser)}"></label>
        </div>
        <div class="row" style="margin-top:16px"><button class="btn sm" id="newCls">${ico('plus')} New blank class</button><button class="btn sm" id="impCls">${ico('upload')} Import gradesheet</button><span class="spacer"></span><button class="btn sm danger" id="delCls">Delete class</button></div>
        <input type="file" id="impFile2" accept=".xlsx,.xls" hidden>
      </div>
      <div class="card"><h2>Credentials checklist items</h2>
        <label class="field">One per line (Term 1–3 grades are always tracked)<textarea class="input" id="ckItems" rows="4">${esc(M.checkItems().map(it=>it.label).join('\n'))}</textarea></label></div>
      <div class="card"><h2>Quick links</h2>
        <label class="field">One per line: Label | URL<textarea class="input" id="links" rows="3">${esc((s.links||[]).map(l=>l.label+' | '+l.url).join('\n'))}</textarea></label></div>
    </div>
  </div>
  <div class="card" style="margin-top:20px"><h2>Backup & restore</h2>
    <p class="small muted" style="margin-top:0">Everything is saved only on this device (grades, checklist, attendance, cleaning points). Make a backup regularly and keep it in your Google Drive folder — restore it on another device (MacBook ↔ iPhone) to move your data.</p>
    <div class="row"><button class="btn primary" id="bk">${ico('download')} Backup (records only)</button><button class="btn" id="bkAll">${ico('download')} Backup with documents</button><button class="btn" id="rs">${ico('upload')} Restore backup</button><input type="file" id="rsFile" accept=".json" hidden><span class="spacer"></span><button class="btn danger" id="reset">Reset to sample data</button></div>
  </div>`;
  $$('[data-s]', el).forEach(i => i.onchange = () => { s[i.dataset.s] = i.value.trim(); M.save(); if(i.dataset.s==='theme') M.applyTheme(); M.toast('Saved'); });
  $$('[data-c]', el).forEach(i => i.onchange = () => { c[i.dataset.c] = i.dataset.c==='grade' ? (Number(i.value)||i.value) : i.value.trim(); M.save(); M.renderClassSelect(); M.toast('Saved'); });
  let logoKey = null;
  $$('[data-logo]', el).forEach(b => b.onclick = () => { logoKey = b.dataset.logo; $('#logoFile').click(); });
  $$('[data-logorm]', el).forEach(b => b.onclick = () => { s.logos[b.dataset.logorm] = ''; M.save(); M.route(); });
  $('#logoFile').onchange = async e => { const f = e.target.files[0]; e.target.value=''; if(!f || !logoKey) return;
    s.logos[logoKey] = await M.shrinkImage(f, 360); M.save(); M.route(); M.toast('Logo saved'); };
  $('#links').onchange = e => { s.links = e.target.value.split('\n').map(x=>x.split('|').map(y=>y.trim())).filter(x=>x[0]&&x[1]).map(([label,url])=>({label,url})); M.save(); M.toast('Links saved'); };
  $('#ckItems').onchange = e => {
    const old = M.checkItems();
    s.checkItems = e.target.value.split('\n').map(x=>x.trim()).filter(Boolean).map(label => old.find(o=>o.label===label) || {id:M.slug(label), label, short:label.length>12?label.slice(0,11)+'…':label});
    M.save(); M.toast('Checklist items saved');
  };
  $('#newCls').onclick = () => { const n = {id:M.uid('c'), grade:'', section:'NEW SECTION', sy:c.sy, adviser:s.adviser||c.adviser, head:s.head, learners:[], grades:{'1':{},'2':{},'3':{}}, checklist:{}, sf9:{days:{}, abs:{}, comments:{}, cert:false, layout:'duplex'}}; M.S.classes.push(n); M.S.activeClassId=n.id; M.save(); M.route(); M.toast('Blank class created'); };
  $('#impCls').onclick = () => $('#impFile2').click();
  $('#impFile2').onchange = e => { const f=e.target.files[0]; if(f) importXlsx(f); e.target.value=''; };
  $('#delCls').onclick = () => { if(M.S.classes.length<2) return M.toast('Keep at least one class'); if(!confirm(`Delete ${M.className(c)} and all its grades?`)) return; M.S.classes=M.S.classes.filter(x=>x.id!==c.id); M.S.activeClassId=M.S.classes[0].id; M.save(); M.route(); };
  $('#bk').onclick = () => backup(false);
  $('#bkAll').onclick = () => backup(true);
  $('#rs').onclick = () => $('#rsFile').click();
  $('#rsFile').onchange = e => { const f=e.target.files[0]; if(f) restore(f); e.target.value=''; };
  $('#reset').onclick = () => { if(!confirm('Replace all class records and attendance with the original sample data? Documents are kept.')) return; M.reset(); M.applyTheme(); M.route(); M.toast('Reset done'); };
};
const blobToB64 = (b) => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function backup(withDocs){
  const out = {app:'MASTRO', version:2, exported:new Date().toISOString(), state:M.S, docs:[]};
  const docs = await M.docsAll().catch(()=>[]);
  for(const d of docs){ const x = Object.assign({}, d); x.blob = (withDocs && d.blob) ? await blobToB64(d.blob) : null; if(!withDocs && d.blob) x.skipped = true; out.docs.push(x); }
  M.downloadBlob(new Blob([JSON.stringify(out)], {type:'application/json'}), `MASTRO-backup-${M.today()}${withDocs?'-full':''}.json`);
  M.toast('Backup downloaded');
}
M.restoreFile = (f) => restore(f);
async function restore(file){
  try {
    const data = JSON.parse(await file.text());
    if(data.app!=='MASTRO' || !data.state) throw new Error('Not a MASTRO backup (for SeatCheck backups use Attendance → Manage → Import SeatCheck backup)');
    if(!confirm('Restore this backup? Current records on this device will be replaced.')) return;
    localStorage.setItem(M.KEY, JSON.stringify(data.state)); M.load();
    for(const d of data.docs||[]){
      if(d.skipped) continue;
      if(d.blob && typeof d.blob==='string'){ const res = await fetch(d.blob); d.blob = await res.blob(); }
      await M.docPut(d);
    }
    M.applyTheme(); M.route(); M.toast('Backup restored');
  } catch(e) { alert('Could not restore: ' + e.message); }
}

/* =====================================================================
   EXCEL IMPORT / EXPORT
   ===================================================================== */
const cellStr = (v) => String(v ?? '').replace(/\s+/g,' ').trim();
function mapHeader(h){
  const x = cellStr(h).toLowerCase();
  if(x==='lrn') return 'lrn'; if(x.startsWith('birth')) return 'birthday'; if(x==='sex') return 'sex';
  if(x.includes('name')) return 'name';
  if(x.startsWith('english')) return 'English'; if(x.startsWith('filipino')) return 'Filipino'; if(x.startsWith('science')) return 'Science';
  if(x.startsWith('math')) return 'Mathematics'; if(x==='tle'||x.startsWith('tle')||x.includes('technology')) return 'TLE';
  if(x.startsWith('araling')) return 'Araling Panlipunan'; if(x.startsWith('values')||x.startsWith('esp')) return 'Values Education';
  if(x.startsWith('music')) return 'Music & Arts'; if(x.startsWith('pe')) return 'PE & Health';
  return null;
}
function parseWorkbook(wb){
  const out = {meta:{}, learners:[], grades:{'1':{},'2':{},'3':{}}};
  const byName = {};
  wb.SheetNames.forEach((sn, si) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, raw:true, defval:null});
    const hr = rows.findIndex(r => r && r.some(v => cellStr(v).toUpperCase()==='LRN'));
    if(hr < 0) return;
    let term = (sn.match(/\d/)||[])[0];
    rows.slice(0,hr).forEach(r => (r||[]).forEach((v,i) => {
      const lab = cellStr(v).toLowerCase(); const next = () => { for(let j=i+1;j<r.length;j++) if(cellStr(r[j])) return cellStr(r[j]); return ''; };
      if(lab.startsWith('grade level')) out.meta.grade = out.meta.grade || next();
      if(lab.startsWith('section')) out.meta.section = out.meta.section || next();
      if(lab.startsWith('school year')) out.meta.sy = out.meta.sy || next();
      if(lab.startsWith('adviser')) out.meta.adviser = out.meta.adviser || next();
      if(lab === 'term:' && !term) term = next();
    }));
    term = String(term || (si+1));
    if(!['1','2','3'].includes(term)) return;
    const map = rows[hr].map(mapHeader);
    for(let i = hr+1; i < rows.length; i++){
      const r = rows[i]; if(!r) continue;
      const rec = {}; map.forEach((k,j) => { if(k) rec[k] = r[j]; });
      let name = cellStr(rec.name);
      if(!name || /prepared|noted|adviser/i.test(name)) continue;
      name = name.replace(/\s*,\s*/g, ', ');
      if(!name.includes(',') && name.includes(' ')) name = name.replace(' ', ', ');
      const key = M.normName(name);
      let L = byName[key];
      if(!L){ L = byName[key] = {id:M.uid('L'), lrn:cellStr(rec.lrn).replace(/\D/g,''), name, sex:/^f/i.test(cellStr(rec.sex))?'F':/^m/i.test(cellStr(rec.sex))?'M':'', birthday:cellStr(rec.birthday), remarks:''}; out.learners.push(L); }
      const g = {}; M.RAW.forEach(k => { const v = rec[k]; if(typeof v==='number' && isFinite(v)) g[k] = v; else if(v!==null && v!=='' && isFinite(Number(v))) g[k] = Number(v); });
      if(Object.keys(g).length) out.grades[term][L.id] = g;
    }
  });
  return out;
}
async function importXlsx(file){
  try {
    const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
    const p = parseWorkbook(wb);
    if(!p.learners.length) return alert('No learners found. The sheet needs a header row with "LRN" and a name column.');
    const terms = ['1','2','3'].filter(t => Object.keys(p.grades[t]).length);
    const c = M.cls();
    M.modal('Import gradesheet', `
      <p><b>${esc(file.name)}</b></p>
      <div class="chips" style="margin-bottom:14px"><span class="chip">Grade ${esc(p.meta.grade||'?')} – ${esc(p.meta.section||'?')}</span><span class="chip">${p.learners.length} learners</span><span class="chip">Grades in: ${terms.map(t=>'Term '+t).join(', ')||'none'}</span></div>
      <p class="small muted">Add it as a new class, or update grades in <b>${esc(M.className(c))}</b> (learners are matched by name; new names are added).</p>
      <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn" id="iUpd">Update current class</button><button class="btn primary" id="iNew">Add as new class</button></div>`,
    b => {
      $('#iNew',b).onclick = () => {
        const n = {id:M.uid('c'), grade:Number(p.meta.grade)||p.meta.grade||'', section:(p.meta.section||'New Section').toUpperCase(), sy:p.meta.sy||c.sy, adviser:p.meta.adviser||M.S.settings.adviser, head:M.S.settings.head, learners:p.learners, grades:p.grades, checklist:{}, sf9:{days:{}, abs:{}, comments:{}, cert:false, layout:'duplex'}};
        M.S.classes.push(n); M.S.activeClassId = n.id; M.save(); M.closeModal(); M.route(); M.toast('Class imported');
      };
      $('#iUpd',b).onclick = () => {
        let added = 0; const idMap = {};
        p.learners.forEach(L => { let ex = c.learners.find(x => M.normName(x.name)===M.normName(L.name)); if(!ex){ ex = L; c.learners.push(L); added++; } else { if(!ex.lrn && L.lrn) ex.lrn = L.lrn; if(!ex.sex && L.sex) ex.sex = L.sex; } idMap[L.id] = ex.id; });
        terms.forEach(t => { c.grades[t] = c.grades[t]||{}; Object.entries(p.grades[t]).forEach(([lid,g]) => { c.grades[t][idMap[lid]] = Object.assign(c.grades[t][idMap[lid]]||{}, g); }); });
        M.save(); M.closeModal(); M.route(); M.toast(`Grades updated${added?` · ${added} new learner(s)`:''}`);
      };
    });
  } catch(e) { alert('Could not read that file: ' + e.message); }
}
function exportClassXlsx(c){
  const s = M.S.settings, wb = XLSX.utils.book_new(), L = M.sortedLearners(c);
  const head = ['LRN','BIRTHDAY','AGE','SEX',"Student's Name\n(Family Name, First Name)",'English','Filipino','Science','Mathematics','TLE','Araling\nPanlipunan','Values\nEducation','MAPEH','Music &\nArts','PE &\nHealth','General\nAverage','Descriptor'];
  ['1','2','3'].forEach(t => {
    const aoa = [['Republic of the Philippines'],['Department of Education'],[s.region],[s.school],[s.address],[],[`CONSOLIDATED GRADES – TERM ${t}`],[],
      ['Grade Level:',null,null,null,c.grade,'Section:',c.section,null,null,'Term:',Number(t),null,'School Year:',null,null,c.sy],
      ['Adviser:',null,null,null,c.adviser],[], head];
    L.forEach(l => { const g = (c.grades[t]||{})[l.id]||{}; aoa.push([l.lrn||null,l.birthday||null,M.ageOn(l.birthday)||l.age||null,l.sex||null,l.name, ...['English','Filipino','Science','Mathematics','TLE','Araling Panlipunan','Values Education'].map(k=>isNum(g[k])?g[k]:null), null, isNum(g['Music & Arts'])?g['Music & Arts']:null, isNum(g['PE & Health'])?g['PE & Health']:null, null, null]); });
    const end = aoa.length;
    aoa.push([],[],['Prepared by:',null,null,null,null,null,null,null,null,null,null,'Noted by:'],[],[c.adviser,null,null,null,null,null,null,null,null,null,null,c.head||s.head],['Class Adviser',null,null,null,null,null,null,null,null,null,null,s.headTitle||'School Head']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for(let r = 13; r <= end; r++){
      ws['M'+r] = {t:'n', f:`IF(COUNT(N${r}:O${r})=0,"",AVERAGE(N${r}:O${r}))`};
      ws['P'+r] = {t:'n', f:`IF(COUNT(F${r}:M${r})=8,ROUND(AVERAGE(F${r}:M${r}),2),"")`};
      ws['Q'+r] = {t:'s', f:`IF(P${r}="","",IF(ROUND(P${r},0)>=90,"Advancing",IF(ROUND(P${r},0)>=80,"Benchmarking",IF(ROUND(P${r},0)>=75,"Connecting",IF(ROUND(P${r},0)>=65,"Developing","Emerging")))))`};
      const row = M.termRow(c, t, L[r-13].id);
      if(isNum(row.MAPEH)) ws['M'+r].v = row.MAPEH; if(isNum(row.GA)) ws['P'+r].v = row.GA; ws['Q'+r].v = row.desc;
    }
    ws['!merges'] = [0,1,2,3,4,6].map(r => ({s:{r,c:0}, e:{r,c:16}}));
    ws['!cols'] = [{wch:14},{wch:11},{wch:5},{wch:5},{wch:34},...Array(10).fill({wch:9}),{wch:9},{wch:13}];
    XLSX.utils.book_append_sheet(wb, ws, `TERM ${t}`);
  });
  XLSX.writeFile(wb, `Consolidated Grades ${c.grade}-${c.section}.xlsx`);
  M.toast('Excel file downloaded');
}
function exportAnalysisXlsx(c, term, sex){
  const wb = XLSX.utils.book_new();
  const tl = term==='F' ? 'Final' : 'Term '+term;
  const sum = [[`${M.className(c)} · ${tl} · ${sex==='all'?'All':sex==='M'?'Boys':'Girls'}`],[],['Learning area','N','Mean','Median','Mode','SD','Lowest','Highest','Range','Passed (≥75)','Pass %']];
  [...M.AREAS,'Music & Arts','PE & Health','GA'].forEach(k => { const s = M.stats(M.valuesFor(c, term, k, sex).map(x=>x.v));
    sum.push([k==='GA'?'General Average':k, s.n, s.n?r2(s.mean):null, s.n?r2(s.median):null, M.modeText(s), s.n?r2(s.sd):null, s.min??null, s.max??null, s.n?r2(s.range):null, s.passed??null, s.n?r2(s.passRate):null]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'Summary');
  const det = [['Learner','Sex',...M.AREAS,'General Average','Descriptor']];
  M.sortedLearners(c).filter(l=>sex==='all'||l.sex===sex).forEach(l => { const r = M.rowFor(c, term, l.id); det.push([l.name, l.sex, ...M.AREAS.map(k=>isNum(r[k])?r2(r[k]):null), r.GA, r.desc]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), 'Learners');
  XLSX.writeFile(wb, `Class Analysis ${c.grade}-${c.section} ${tl}.xlsx`);
  M.toast('Analysis exported');
}

/* ---------------- printing ---------------- */
function printGradesheet(c, t){
  const L = M.sortedLearners(c); let i = 0, last = null;
  const rows = L.map(l => { const r = M.termRow(c, t, l.id); let pre = '';
    if(l.sex!==last){ last=l.sex; pre = `<tr><td colspan="15"><b>${l.sex==='M'?'MALE':l.sex==='F'?'FEMALE':'—'}</b></td></tr>`; }
    return pre + `<tr><td>${++i}</td><td>${esc(l.lrn)}</td><td>${esc(l.name)}</td>${M.AREAS.slice(0,7).map(k=>`<td style="text-align:center">${isNum(r[k])?r[k]:''}</td>`).join('')}<td style="text-align:center">${isNum(r.MAPEH)?r2(r.MAPEH):''}</td><td style="text-align:center">${isNum(r['Music & Arts'])?r['Music & Arts']:''}</td><td style="text-align:center">${isNum(r['PE & Health'])?r['PE & Health']:''}</td><td style="text-align:center"><b>${fmt(r.GA).replace('—','')}</b></td><td>${r.desc}</td></tr>`; }).join('');
  M.doPrint(M.printHeader(`CONSOLIDATED GRADES – TERM ${t}`) +
    `<p>Grade Level: <b>${esc(c.grade)}</b> &nbsp; Section: <b>${esc(c.section)}</b> &nbsp; School Year: <b>${esc(c.sy)}</b><br>Adviser: <b>${esc(c.adviser)}</b></p>
    <table><thead><tr><th>#</th><th>LRN</th><th>Name</th>${M.AREAS.slice(0,7).map(k=>`<th>${M.SHORT[k]}</th>`).join('')}<th>MAPEH</th><th>M&amp;A</th><th>PE&amp;H</th><th>GA</th><th>Descriptor</th></tr></thead><tbody>${rows}</tbody></table>` + M.printSign(c));
}
function printAnalysis(c, term, sex){
  const tl = term==='F' ? 'FINAL' : 'TERM '+term;
  const comp = [...M.AREAS,'GA'].map(k => ({k, s: M.stats(M.valuesFor(c, term, k, sex).map(x=>x.v))}));
  const ga = M.valuesFor(c, term, 'GA', sex); const counts = {}; M.DESCS.forEach(d=>counts[d]=0); ga.forEach(x=>counts[M.descriptor(x.v)]++);
  const support = ga.filter(x=>Math.round(x.v)<PASS).sort((a,b)=>a.v-b.v);
  M.doPrint(M.printHeader(`CLASS ANALYSIS REPORT – ${tl}`) +
    `<p>Grade &amp; Section: <b>${esc(M.className(c))}</b> &nbsp; School Year: <b>${esc(c.sy)}</b> &nbsp; Group: <b>${sex==='all'?'All learners':sex==='M'?'Boys':'Girls'}</b></p>
    <table><thead><tr><th>Learning Area</th><th>N</th><th>Mean</th><th>Median</th><th>Mode</th><th>SD</th><th>Lowest</th><th>Highest</th><th>Passing %</th></tr></thead>
    <tbody>${comp.map(({k,s})=>`<tr><td>${k==='GA'?'<b>General Average</b>':esc(k)}</td><td style="text-align:center">${s.n}</td><td style="text-align:center">${fmt(s.mean)}</td><td style="text-align:center">${fmt(s.median)}</td><td style="text-align:center">${M.modeText(s)}</td><td style="text-align:center">${fmt(s.sd)}</td><td style="text-align:center">${fmt(s.min)}</td><td style="text-align:center">${fmt(s.max)}</td><td style="text-align:center">${s.n?fmt(s.passRate,1):'—'}</td></tr>`).join('')}</tbody></table>
    <p style="margin-top:14px"><b>Proficiency (General Average):</b> ${M.DESCS.map(d=>`${d} (${M.DESC_RANGE[d]}): ${counts[d]}`).join(' · ')}</p>
    <p><b>Learners below 75 (${support.length}):</b> ${support.length ? support.map(x=>`${esc(x.l.name)} (${fmt(x.v)})`).join('; ') : 'None'}</p>` + M.printSign(c));
}
})();
