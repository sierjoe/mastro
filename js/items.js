/* MASTRO — Item Analysis for summative tests and term examinations.
   Responses can be typed (A–E letters or 1/0) or uploaded from Excel/CSV, including the
   Answer Sheet Checker export (Name · Score · Items missed). */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt} = M;

const TYPES = ['Summative Test 1','Summative Test 2','Term Examination','Quiz','Other'];
const MPS_LEVELS = [[96,'Mastered'],[86,'Closely approximating mastery'],[66,'Moving towards mastery'],[35,'Average'],[16,'Low'],[5,'Very low'],[0,'Absolutely no mastery']];
M.mpsLevel = (x) => (MPS_LEVELS.find(([t]) => x >= t) || MPS_LEVELS[MPS_LEVELS.length-1])[1];
const diffText = (p) => p>=.81?'Very easy':p>=.61?'Easy':p>=.41?'Average':p>=.21?'Difficult':'Very difficult';
const discText = (d) => d>=.40?'Very good':d>=.30?'Good':d>=.20?'Fair':d>=0?'Poor':'Negative';
const decision = (p, d) => d < 0 ? 'Reject' : (p>=.21 && p<=.80 && d>=.20) ? 'Retain' : ((p>=.21 && p<=.80) || d>=.20) ? 'Revise' : 'Reject';
const list = () => M.S.ia.filter(a => a.classId === M.cls().id);
const getA = (id) => M.S.ia.find(a => a.id === id);
const parseItems = (s, n) => { const out = new Set(); String(s||'').split(/[,;\s]+/).forEach(t => { const m = t.match(/^(\d+)(?:-(\d+))?$/); if(!m) return; const a = +m[1], b = m[2] ? +m[2] : a; for(let i=Math.min(a,b); i<=Math.max(a,b); i++) if(i>=1 && (!n || i<=n)) out.add(i); }); return [...out].sort((x,y)=>x-y); };
const cleanResp = (s, n) => String(s||'').toUpperCase().replace(/[^A-E01\-]/g,'').slice(0, n);

/* ---------------- analysis ---------------- */
M.iaAnalyze = function(a, c){
  const n = a.n, key = (a.key||'').toUpperCase();
  const isRight = (ch, i) => ch === '1' || (/[A-E]/.test(ch) && key[i] === ch);
  const people = Object.entries(a.resp||{}).map(([k, r]) => {
    const l = k.startsWith('x:') ? null : c.learners.find(x => x.id === k);
    const rr = cleanResp(r, n).padEnd(n, '-');
    const right = [...rr].map((ch,i) => isRight(ch,i) ? 1 : 0);
    return {k, l, name: l ? l.name : (a.names||{})[k] || k.slice(2), sex: l ? l.sex : '', r: rr, right, score: right.reduce((x,y)=>x+y,0), took: /[A-E01]/.test(rr)};
  }).filter(p => p.took);
  const N = people.length;
  const st = M.stats(people.map(p => p.score));
  const sorted = [...people].sort((x,y) => y.score - x.score);
  const g = Math.max(1, Math.round(N * 0.27));
  const U = sorted.slice(0, g), Lw = sorted.slice(-g);
  const opts = (a.options || 'ABCD').split('');
  const items = [...Array(n).keys()].map(i => {
    const correct = people.filter(p => p.right[i]).length;
    const p = N ? correct / N : 0;
    const pU = U.filter(x => x.right[i]).length / g, pL = Lw.filter(x => x.right[i]).length / g;
    const D = N >= 2 ? pU - pL : 0;
    const counts = {}; opts.forEach(o => counts[o] = people.filter(x => x.r[i] === o).length);
    const blank = people.filter(x => x.r[i] === '-').length;
    const flags = [];
    if(/[A-E]/.test(key[i]||'') && people.some(x => /[A-E]/.test(x.r[i]))){
      opts.filter(o => o !== key[i]).forEach(o => {
        if(!counts[o]) flags.push(`${o} not chosen`);
        else if(U.filter(x=>x.r[i]===o).length > Lw.filter(x=>x.r[i]===o).length) flags.push(`${o} attracts upper group`);
      });
    }
    return {no:i+1, key:key[i]||'', correct, p, pct:p*100, D, diff:diffText(p), disc:discText(D), dec:decision(p, D), mastered: p*100 >= 75, counts, blank, flags};
  });
  const comps = (a.comps||[]).map(cp => { const its = parseItems(cp.items, n); const pct = its.length ? its.reduce((s,i)=>s+items[i-1].pct,0)/its.length : 0; return {name:cp.name, items:its, pct, level:M.mpsLevel(pct)}; });
  const mps = N && n ? st.mean / n * 100 : 0;
  return {n, N, people:sorted, st, mps, level: M.mpsLevel(mps), items, comps, g, passed: people.filter(p => p.score/n*100 >= 75).length};
};

/* ---------------- list view ---------------- */
M.views.items = function view(el, args){
  if(args[0]) return detail(el, args[0], args[1]);
  const c = M.cls(); const t = M.S.ui.iaTerm || 'all';
  const all = list().sort((x,y) => (x.term+x.date).localeCompare(y.term+y.date));
  const shown = all.filter(a => t==='all' || a.term===t);
  el.innerHTML = `
  <div class="card"><div class="row">
    <div class="seg" id="iaT">${[['all','All terms'],['1','Term 1'],['2','Term 2'],['3','Term 3']].map(([k,l])=>`<button data-t="${k}" class="${k===t?'on':''}">${l}</button>`).join('')}</div>
    <span class="spacer"></span><button class="btn primary" id="iaNew">${ico('plus')} New test / exam</button></div>
    <p class="small muted" style="margin:12px 0 0">Add each summative test and term examination of ${esc(M.className(c))}, then upload the results (Excel/CSV, including your Answer Sheet Checker export) or type the answers. MASTRO computes MPS, item difficulty, discrimination, distractors and least-mastered competencies.</p></div>
  ${shown.length ? `<div class="grid g-3" style="margin-top:20px">${shown.map(a => { const R = M.iaAnalyze(a, c); return `
    <a class="card form-card" href="#items/${a.id}">
      <div class="row"><span class="chip green">Term ${esc(a.term)}</span><span class="chip">${esc(a.type)}</span><span class="spacer"></span><span class="tiny muted">${esc(a.date||'')}</span></div>
      <div class="title" style="margin-top:10px">${esc(a.title)}</div>
      <div class="small muted">${esc(a.subject||'')} · ${a.n} items · ${R.N} takers</div>
      <div class="row" style="margin-top:12px;align-items:flex-end"><div><div class="tiny muted">MPS</div><div style="font-size:26px;font-weight:800;color:var(--green)">${R.N?fmt(R.mps,1):'—'}</div></div><span class="spacer"></span>${R.N?`<span class="chip ${R.mps>=75?'green':'gold'}">${esc(R.level)}</span>`:'<span class="chip">no results yet</span>'}</div>
    </a>`; }).join('')}</div>` : `<div class="card" style="margin-top:20px"><div class="empty">No tests yet${t!=='all'?' for Term '+t:''}. Tap <b>New test / exam</b>.</div></div>`}
  ${all.length>1 ? `<div class="card" style="margin-top:20px"><h2>MPS across tests</h2>${all.map(a => { const R = M.iaAnalyze(a, c); return `<div class="bar-row"><span>T${esc(a.term)} · ${esc(a.title)}</span><div class="bar-track"><div class="bar-fill ${R.mps<75?'low':''}" style="width:${R.mps}%"></div></div><b class="num" style="text-align:right">${R.N?fmt(R.mps,1):'—'}</b></div>`; }).join('')}</div>`:''}`;
  $('#iaT').onclick = e => { const b = e.target.closest('button'); if(!b) return; M.S.ui.iaTerm = b.dataset.t; M.save(); view(el, []); };
  $('#iaNew').onclick = () => form(null);
};
function form(a){
  const c = M.cls(); const x = a || {title:'Summative Test 1', type:'Summative Test 1', subject:'English', term: M.latestTerm(c), date:M.today(), n:50, key:'', options:'ABCD', comps:[]};
  M.modal(a ? 'Edit test' : 'New test / exam', `
    <div class="grid g-2">
      <label class="field" style="grid-column:1/-1">Title<input class="input" id="fT" value="${esc(x.title)}"></label>
      <label class="field">Type<select class="input" id="fY">${TYPES.map(t=>`<option ${t===x.type?'selected':''}>${t}</option>`).join('')}</select></label>
      <label class="field">Learning area<input class="input" id="fS" value="${esc(x.subject)}"></label>
      <label class="field">Term<select class="input" id="fM">${['1','2','3'].map(t=>`<option ${t===x.term?'selected':''}>${t}</option>`).join('')}</select></label>
      <label class="field">Date given<input type="date" class="input" id="fD" value="${esc(x.date)}"></label>
      <label class="field">Number of items<input class="input" id="fN" inputmode="numeric" value="${x.n}"></label>
      <label class="field">Choices<select class="input" id="fO"><option value="ABCD" ${x.options==='ABCD'?'selected':''}>A–D</option><option value="ABCDE" ${x.options==='ABCDE'?'selected':''}>A–E</option><option value="AB" ${x.options==='AB'?'selected':''}>A–B (True/False)</option></select></label>
      <label class="field" style="grid-column:1/-1">Answer key <span class="muted">(type the letters in order, e.g. ABDCA… — leave blank if your results are already 1/0 or “items missed”)</span><input class="input mono" id="fK" value="${esc(x.key)}" autocapitalize="characters"></label>
      <label class="field" style="grid-column:1/-1">Competencies <span class="muted">(optional, one per line: competency | items, e.g. “Identify main idea | 1-10, 21”)</span><textarea class="input" id="fC" rows="4">${esc((x.comps||[]).map(cp=>cp.name+' | '+cp.items).join('\n'))}</textarea></label>
    </div>
    <div class="row" style="margin-top:16px">${a?`<button class="btn sm danger" id="fDel">Delete test</button>`:''}<span class="spacer"></span><button class="btn" id="fX">Cancel</button><button class="btn primary" id="fOk">Save</button></div>`,
  b => {
    $('#fX',b).onclick = M.closeModal;
    if(a) $('#fDel',b).onclick = () => { if(!confirm(`Delete “${a.title}” and its results?`)) return; M.S.ia = M.S.ia.filter(y=>y!==a); M.save(); M.closeModal(); location.hash = '#items'; };
    $('#fOk',b).onclick = () => {
      const n = Math.max(1, Math.min(200, +$('#fN',b).value || 0));
      const d = {title:$('#fT',b).value.trim()||'Untitled test', type:$('#fY',b).value, subject:$('#fS',b).value.trim(), term:$('#fM',b).value, date:$('#fD',b).value, n,
        options:$('#fO',b).value, key:$('#fK',b).value.toUpperCase().replace(/[^A-E]/g,'').slice(0,n),
        comps:$('#fC',b).value.split('\n').map(l=>l.split('|')).filter(p=>p[0].trim()&&p[1]).map(([name,items])=>({name:name.trim(), items:items.trim()}))};
      if(a) Object.assign(a, d); else { a = Object.assign({id:M.uid('ia'), classId:c.id, resp:{}, names:{}, created:new Date().toISOString()}, d); M.S.ia.push(a); }
      M.save(); M.closeModal(); location.hash = '#items/' + a.id; M.route();
    };
  });
}

/* ---------------- detail view ---------------- */
function detail(el, id, tabArg){
  const a = getA(id); const c = M.cls();
  if(!a){ el.innerHTML = '<div class="card"><div class="empty">Test not found.</div></div>'; return; }
  const tab = tabArg || (Object.keys(a.resp||{}).length ? 'analysis' : 'responses');
  const R = M.iaAnalyze(a, c);
  el.innerHTML = `
  <div class="card"><div class="row">
    <a class="btn sm" href="#items">${ico('left','width:16px;height:16px')} Tests</a>
    <div><div class="title"><b>${esc(a.title)}</b></div><div class="small muted">${esc(a.type)} · ${esc(a.subject)} · Term ${esc(a.term)} · ${esc(a.date||'')} · ${a.n} items${a.key?' · key set':''}</div></div>
    <span class="spacer"></span>
    <button class="btn sm" id="iEdit">${ico('edit')} Edit</button>
    <button class="btn sm" id="iX">${ico('download')} Excel</button>
    <button class="btn sm primary" id="iP">${ico('print')} Print report</button>
  </div>
  <div class="seg" id="iTabs" style="margin-top:14px">${[['responses','Responses'],['analysis','Analysis'],['files','Test files']].map(([k,l])=>`<button data-t="${k}" class="${k===tab?'on':''}">${l}</button>`).join('')}</div></div>
  <div id="iBody" style="margin-top:20px"></div>`;
  $('#iEdit').onclick = () => form(a);
  $('#iX').onclick = () => exportXlsx(a, c);
  $('#iP').onclick = () => printReport(a, c);
  $('#iTabs').onclick = e => { const b = e.target.closest('button'); if(b) location.hash = `#items/${a.id}/${b.dataset.t}`; };
  const body = $('#iBody');
  if(tab==='responses') responses(body, a, c, () => detail(el, id, 'responses'));
  if(tab==='analysis') analysis(body, a, c, R);
  if(tab==='files') files(body, a);
}
function responses(body, a, c, rerender){
  const L = M.sortedLearners(c);
  const extra = Object.keys(a.resp||{}).filter(k => k.startsWith('x:'));
  const n = a.n, key = a.key||'';
  const row = (k, name, sex) => { const r = (a.resp||{})[k] || ''; const R = M.iaAnalyze({...a, resp:{[k]:r}}, c).people[0];
    return `<tr><td class="sticky-col">${esc(name)}</td><td><input class="input mono resp" data-k="${esc(k)}" value="${esc(r)}" maxlength="${n}" autocapitalize="characters" spellcheck="false" placeholder="${'-'.repeat(Math.min(n,10))}…" style="min-width:${Math.min(60, n)*0.62+2}em;padding:6px 10px"></td><td class="num" data-sc="${esc(k)}">${R?`<b>${R.score}</b>/${n}`:''}</td></tr>`; };
  body.innerHTML = `
  <div class="grid g-2">
    <div class="card"><h2>Upload results</h2>
      <div class="drop" id="rDrop">${ico('upload','width:30px;height:30px;color:var(--green)')}<div><b>Drop Excel / CSV results here</b></div><div class="small muted">Answers per item (A–E or 1/0) with an optional KEY row, or your Answer Sheet Checker export (Name · Score · Items missed)</div></div>
      <input type="file" id="rFile" accept=".xlsx,.xls,.csv" hidden>
      <div class="row" style="margin-top:12px"><button class="btn sm" id="rTpl">${ico('download')} Download blank template</button><span class="spacer"></span><button class="btn sm danger" id="rClr">Clear all responses</button></div></div>
    <div class="card"><h2>Answer key</h2>
      <input class="input mono" id="rKey" value="${esc(key)}" maxlength="${n}" autocapitalize="characters" spellcheck="false" placeholder="e.g. ABDCA…">
      <p class="small muted">${key.length===n?`${n} answers set.`:`${key.length} of ${n} answers entered.`} Needed for letter answers and distractor analysis; not needed for 1/0 or “items missed” results.</p></div>
  </div>
  <div class="card" style="margin-top:20px"><h2>Answers per learner</h2>
    <p class="small muted" style="margin-top:0">Type each learner’s answers in order (letters, or 1 = correct / 0 = wrong). Use “-” for no answer. Leave blank for learners who did not take the test.</p>
    <div class="table-wrap"><table><thead><tr><th class="sticky-col">Learner</th><th>Answers (items 1–${n})</th><th class="num">Score</th></tr></thead>
    <tbody>${L.map(l => row(l.id, l.name, l.sex)).join('')}${extra.map(k => row(k, (a.names||{})[k]||k.slice(2)+' (not on roster)')).join('')}</tbody></table></div></div>`;
  M.dropZone($('#rDrop'), $('#rFile'), fs => importResults(fs[0], a, c, rerender));
  $('#rTpl').onclick = () => template(a, c);
  $('#rClr').onclick = () => { if(!confirm('Clear all responses for this test?')) return; a.resp = {}; a.names = {}; M.save(); rerender(); };
  $('#rKey').onchange = e => { a.key = e.target.value.toUpperCase().replace(/[^A-E]/g,'').slice(0,n); M.save(); rerender(); };
  body.addEventListener('input', e => { const x = e.target; if(!x.classList.contains('resp')) return;
    const v = cleanResp(x.value, n); if(x.value !== v){ const p = x.selectionStart; x.value = v; x.setSelectionRange(p, p); }
    if(v) a.resp[x.dataset.k] = v; else delete a.resp[x.dataset.k];
    const R = v ? M.iaAnalyze({...a, resp:{[x.dataset.k]:v}}, c).people[0] : null;
    body.querySelector(`[data-sc="${CSS.escape(x.dataset.k)}"]`).innerHTML = R ? `<b>${R.score}</b>/${n}` : '';
    clearTimeout(responses.t); responses.t = setTimeout(M.save, 400); });
}
function matchLearner(name, lrn, c, used){
  if(lrn){ const l = c.learners.find(x => x.lrn && x.lrn === lrn); if(l) return l; }
  let best = null, bs = 0;
  c.learners.forEach(l => { if(used.has(l.id)) return;
    let s = 0;
    if(name.includes(',')){ const m = M.nameMatch(name, l.name); s = (m.last >= .85 && m.first >= .85) ? m.score : 0; }
    else { const sp = M.splitName(l.name); const f = (sp.given.length>1?sp.given.slice(0,-1):sp.given).join(' ');
      s = Math.max(M.sim(name, f+' '+sp.last), M.sim(name, sp.last+' '+f), M.sim(name, sp.last+' '+sp.given.join(' '))); if(s < .85) s = 0; }
    if(s > bs){ bs = s; best = l; } });
  return best;
}
async function importResults(file, a, c, rerender){
  try {
    const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:true, defval:null});
    const hr = rows.findIndex(r => r && r.some(v => /^(name|learner|student|learner'?s name|full name|surname)/i.test(String(v||'').trim())));
    if(hr < 0) throw new Error('No header row with a “Name” column was found.');
    const H = rows[hr].map(v => String(v ?? '').trim());
    const cName = H.findIndex(h => /^(name|learner|student|learner'?s name|full name|surname)/i.test(h));
    const cLrn = H.findIndex(h => /^lrn$/i.test(h));
    const cMiss = H.findIndex(h => /miss|wrong|incorrect/i.test(h));
    const itemCols = H.map((h,i) => { const m = h.match(/^(?:item|q|no\.?|#)?\s*(\d{1,3})$/i); return m ? {i, no:+m[1]} : null; }).filter(Boolean);
    let n = a.n; if(itemCols.length) n = Math.max(n, ...itemCols.map(x=>x.no));
    const cell = (v) => { const s = String(v ?? '').trim().toUpperCase(); if(/^[A-E]$/.test(s)) return s; if(s==='1'||s==='TRUE'||s==='✓'||s==='/') return '1'; if(s==='0'||s==='FALSE'||s==='X'||s==='✗') return '0'; return '-'; };
    const used = new Set(); let matched = 0, unmatched = 0, keyFound = false;
    for(let i = hr+1; i < rows.length; i++){
      const r = rows[i]; if(!r) continue;
      const name = String(r[cName] ?? '').replace(/\s+/g,' ').trim(); if(!name) continue;
      let resp;
      if(itemCols.length){ const arr = Array(n).fill('-'); itemCols.forEach(({i:ci, no}) => { if(no<=n) arr[no-1] = cell(r[ci]); }); resp = arr.join(''); }
      else if(cMiss >= 0){ const miss = new Set(parseItems(String(r[cMiss] ?? '').replace(/item/gi,''), n)); resp = [...Array(n).keys()].map(k => miss.has(k+1) ? '0' : '1').join(''); }
      else continue;
      if(/^(answer\s*)?key$/i.test(name)){ if(/[A-E]/.test(resp)){ a.key = resp.replace(/[^A-E]/g,'?'); keyFound = true; } continue; }
      if(!/[A-E01]/.test(resp)) continue;
      const l = matchLearner(name, String(cLrn>=0 ? r[cLrn] ?? '' : '').replace(/\D/g,''), c, used);
      if(l){ used.add(l.id); a.resp[l.id] = resp; matched++; }
      else { const k = 'x:' + name; a.resp[k] = resp; a.names = a.names||{}; a.names[k] = name; unmatched++; }
    }
    a.n = n; M.save();
    await M.docPut({id:M.uid('d'), name:file.name, category:'Grades & Reports', formCode:'IA', iaId:a.id, tags:`Item analysis, ${a.title}`, classId:c.id, notes:'Results file', mime:file.type, size:file.size, added:new Date().toISOString(), blob:file}).catch(()=>{});
    M.toast(`${matched} learner(s) matched${unmatched?`, ${unmatched} not on roster`:''}${keyFound?' · key read':''}`);
    rerender();
  } catch(e){ alert('Could not read the results: ' + e.message); }
}
function template(a, c){
  const head = ['No.','LRN','Name', ...[...Array(a.n).keys()].map(i => i+1)];
  const aoa = [[`${a.title} — ${M.className(c)} (fill letters A–E, or 1/0)`], head, ['', '', 'KEY', ...(a.key||'').split('')]];
  M.sortedLearners(c).forEach((l,i) => aoa.push([i+1, l.lrn||'', l.name]));
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{wch:5},{wch:14},{wch:34},...Array(a.n).fill({wch:4})];
  XLSX.utils.book_append_sheet(wb, ws, 'Responses'); XLSX.writeFile(wb, `${a.title} - ${c.section} template.xlsx`);
}

function itemChart(R){
  const W = Math.max(640, R.n*14), H = 200, pl = 30, pb = 24, bw = (W-pl-8)/R.n;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Percent correct per item" style="min-width:${Math.min(W,1200)}px">`;
  [0,25,50,75,100].forEach(v => { const y = H-pb-(H-pb-10)*v/100; s += `<line class="axis" x1="${pl}" x2="${W-4}" y1="${y}" y2="${y}" ${v===75?'stroke-dasharray="4 4" style="stroke:var(--gold)"':''}/><text x="${pl-6}" y="${y+4}" text-anchor="end">${v}</text>`; });
  R.items.forEach((it,i) => { const h = (H-pb-10)*it.pct/100, x = pl+i*bw+1.5, y = H-pb-h;
    s += `<rect x="${x}" y="${y}" width="${Math.max(2,bw-3)}" height="${h}" rx="2" fill="${it.pct>=75?'#2f8a61':it.pct>=50?'#d9a73a':'#c55252'}"><title>Item ${it.no}: ${it.pct.toFixed(0)}% correct · ${it.diff} · D=${it.D.toFixed(2)}</title></rect>`;
    if(R.n<=60 || it.no%5===0) s += `<text x="${x+bw/2-1}" y="${H-8}" text-anchor="middle" style="font-size:9px">${it.no}</text>`; });
  return s + '</svg>';
}
function analysis(body, a, c, R){
  if(!R.N){ body.innerHTML = `<div class="card"><div class="empty">No results yet. Add them in the <a href="#items/${a.id}/responses">Responses</a> tab.</div></div>`; return; }
  const least = R.items.filter(i => !i.mastered).sort((x,y)=>x.pct-y.pct);
  const decCount = (d) => R.items.filter(i=>i.dec===d).length;
  const hasLetters = /[A-E]/.test(a.key||'');
  body.innerHTML = `
  <div class="grid g-4">
    <div class="card stat accent"><div class="label">MPS</div><div class="value">${fmt(R.mps,2)}</div><div class="sub">${esc(R.level)}</div></div>
    <div class="card stat"><div class="label">Mean score</div><div class="value">${fmt(R.st.mean)}</div><div class="sub">of ${R.n} items · ${R.N} takers</div></div>
    <div class="card stat"><div class="label">Median · Mode</div><div class="value" style="font-size:24px">${fmt(R.st.median,1)} · ${M.modeText(R.st)}</div><div class="sub">SD ${fmt(R.st.sd)}</div></div>
    <div class="card stat"><div class="label">Reached 75%</div><div class="value">${R.passed}<span class="muted" style="font-size:16px">/${R.N}</span></div><div class="sub">highest ${R.st.max} · lowest ${R.st.min}</div></div>
  </div>
  <div class="card" style="margin-top:20px"><div class="row"><h2 style="margin:0">Percent correct per item</h2><span class="spacer"></span><span class="legend" style="margin:0"><span><i style="background:#2f8a61"></i>Mastered (≥75%)</span><span><i style="background:#d9a73a"></i>50–74%</span><span><i style="background:#c55252"></i>below 50%</span></span></div>
    <div style="overflow-x:auto;margin-top:10px">${itemChart(R)}</div>
    <div class="chips" style="margin-top:12px"><span class="chip green">Retain ${decCount('Retain')}</span><span class="chip gold">Revise ${decCount('Revise')}</span><span class="chip red">Reject ${decCount('Reject')}</span><span class="chip">Upper/lower groups: ${R.g} learner(s) each (27%)</span></div></div>
  <div class="grid g-2" style="margin-top:20px">
    <div class="card"><h2>Least-mastered items (below 75%)</h2>${least.length?`<div class="chips">${least.map(i=>`<span class="chip ${i.pct<50?'red':'gold'}">#${i.no} · ${i.pct.toFixed(0)}%</span>`).join('')}</div>`:'<div class="empty">All items mastered. 🎉</div>'}</div>
    <div class="card"><h2>Competencies</h2>${R.comps.length?R.comps.map(cp=>`<div class="bar-row" style="grid-template-columns:minmax(0,1.6fr) 1fr 56px"><span title="Items ${cp.items.join(', ')}">${esc(cp.name)}</span><div class="bar-track"><div class="bar-fill ${cp.pct<75?'low':''}" style="width:${cp.pct}%"></div></div><b class="num" style="text-align:right">${cp.pct.toFixed(1)}</b></div><div class="tiny muted" style="margin:-4px 0 8px">${esc(cp.level)} · items ${cp.items.join(', ')}</div>`).join(''):`<div class="empty small">Add competencies (with their item numbers) in <b>Edit</b> to see mastery per competency.</div>`}</div>
  </div>
  <div class="card" style="margin-top:20px"><h2>Item analysis table</h2>
    <div class="table-wrap"><table><thead><tr><th class="num">Item</th>${hasLetters?'<th class="c">Key</th>':''}<th class="num">Correct</th><th class="num">% correct</th><th>Difficulty</th><th class="num">D</th><th>Discrimination</th><th>Decision</th>${hasLetters?`${(a.options||'ABCD').split('').map(o=>`<th class="c">${o}</th>`).join('')}<th>Distractors</th>`:''}</tr></thead>
    <tbody>${R.items.map(i=>`<tr><td class="num"><b>${i.no}</b></td>${hasLetters?`<td class="c"><b>${esc(i.key)}</b></td>`:''}<td class="num">${i.correct}</td><td class="num"><b class="${i.mastered?'':'low'}">${i.pct.toFixed(1)}</b></td><td>${i.diff}</td><td class="num">${i.D.toFixed(2)}</td><td>${i.disc}</td><td><span class="desc ${i.dec==='Retain'?'d-Advancing':i.dec==='Revise'?'d-Connecting':'d-Emerging'}">${i.dec}</span></td>${hasLetters?`${(a.options||'ABCD').split('').map(o=>`<td class="c ${o===i.key?'computed':''}" style="${o===i.key?'font-weight:800;color:var(--green)':''}">${i.counts[o]||0}</td>`).join('')}<td class="tiny">${esc(i.flags.join('; '))}</td>`:''}</tr>`).join('')}</tbody></table></div>
    <p class="tiny muted">Difficulty = % of takers who got the item right (≥81 very easy · 61–80 easy · 41–60 average · 21–40 difficult · ≤20 very difficult). D = upper-group minus lower-group proportion correct (≥.40 very good · .30–.39 good · .20–.29 fair · &lt;.20 poor). Retain = average difficulty and D ≥ .20.</p></div>
  <div class="card" style="margin-top:20px"><h2>Learner scores</h2>
    <div class="table-wrap"><table><thead><tr><th class="num">Rank</th><th>Learner</th><th class="num">Score</th><th class="num">%</th><th>Mastery</th><th>Items missed</th></tr></thead>
    <tbody>${R.people.map((p,i)=>`<tr><td class="num muted">${i+1}</td><td>${esc(p.name)}${p.l?'':' <span class="chip" style="font-size:10px;padding:1px 6px">not on roster</span>'}</td><td class="num"><b>${p.score}</b>/${R.n}</td><td class="num ${p.score/R.n*100<75?'low':''}">${(p.score/R.n*100).toFixed(1)}</td><td class="small">${M.mpsLevel(p.score/R.n*100)}</td><td class="tiny muted">${p.right.map((v,k)=>v?null:k+1).filter(Boolean).join(', ')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
async function files(body, a){
  body.innerHTML = `<div class="card"><h2>Test files</h2>
    <div class="drop" id="tDrop">${ico('upload','width:30px;height:30px;color:var(--green)')}<div><b>Upload the test paper, TOS or answer key</b></div><div class="small muted">PDF, Word, images — stored offline with this test</div></div>
    <input type="file" id="tFile" multiple hidden><div class="list" id="tList" style="margin-top:16px"></div></div>`;
  M.dropZone($('#tDrop'), $('#tFile'), fs => M.addFiles(fs, 'Lesson Materials', {formCode:'IA', iaId:a.id, tags:`Item analysis, ${a.title}`}));
  const docs = (await M.docsAll().catch(()=>[])).filter(d => d.iaId === a.id).sort((x,y)=>y.added.localeCompare(x.added));
  const tl = $('#tList'); if(!tl) return;
  tl.innerHTML = docs.length ? docs.map(M.docItem).join('') : '<div class="empty">No files yet.</div>';
  M.bindDocActions(tl);
}

/* ---------------- print & export ---------------- */
function printReport(a, c){
  const R = M.iaAnalyze(a, c); if(!R.N) return M.toast('No results yet');
  const hasLetters = /[A-E]/.test(a.key||'');
  const least = R.items.filter(i => !i.mastered).sort((x,y)=>x.pct-y.pct);
  M.doPrint(M.printHeader(`ITEM ANALYSIS — ${a.title.toUpperCase()}`) +
    `<p>Learning Area: <b>${esc(a.subject)}</b> &nbsp; Grade &amp; Section: <b>${esc(M.className(c))}</b> &nbsp; Term: <b>${esc(a.term)}</b> &nbsp; Date: <b>${esc(a.date||'')}</b><br>
    No. of items: <b>${R.n}</b> &nbsp; No. of takers: <b>${R.N}</b> &nbsp; Mean: <b>${fmt(R.st.mean)}</b> &nbsp; SD: <b>${fmt(R.st.sd)}</b> &nbsp; MPS: <b>${fmt(R.mps)}</b> (${esc(R.level)}) &nbsp; Reached 75%: <b>${R.passed}</b></p>
    <table><thead><tr><th>Item</th>${hasLetters?'<th>Key</th>':''}<th>Correct</th><th>% Correct</th><th>Difficulty</th><th>D</th><th>Discrimination</th><th>Decision</th><th>Remark</th></tr></thead><tbody>
    ${R.items.map(i=>`<tr><td style="text-align:center">${i.no}</td>${hasLetters?`<td style="text-align:center">${esc(i.key)}</td>`:''}<td style="text-align:center">${i.correct}</td><td style="text-align:center">${i.pct.toFixed(1)}</td><td>${i.diff}</td><td style="text-align:center">${i.D.toFixed(2)}</td><td>${i.disc}</td><td>${i.dec}</td><td>${i.mastered?'Mastered':'Least mastered'}</td></tr>`).join('')}</tbody></table>
    ${R.comps.length?`<p style="margin-top:12px"><b>Competencies</b></p><table><thead><tr><th>Competency</th><th>Items</th><th>% Correct</th><th>Level</th></tr></thead><tbody>${R.comps.map(cp=>`<tr><td>${esc(cp.name)}</td><td>${cp.items.join(', ')}</td><td style="text-align:center">${cp.pct.toFixed(1)}</td><td>${esc(cp.level)}</td></tr>`).join('')}</tbody></table>`:''}
    <p style="margin-top:12px"><b>Least-mastered items:</b> ${least.length?least.map(i=>`#${i.no} (${i.pct.toFixed(0)}%)`).join(', '):'None'}</p>` + M.printSign(c, 'Prepared by:', 'Noted by:').replace('Class Adviser', 'Subject Teacher'));
}
function exportXlsx(a, c){
  const R = M.iaAnalyze(a, c); if(!R.N) return M.toast('No results yet');
  const wb = XLSX.utils.book_new(); const opts = (a.options||'ABCD').split('');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[a.title], ['Class', M.className(c)], ['Learning area', a.subject], ['Term', a.term], ['Date', a.date], ['Items', R.n], ['Takers', R.N], ['Mean', +R.st.mean.toFixed(2)], ['Median', R.st.median], ['Mode', M.modeText(R.st)], ['SD', +R.st.sd.toFixed(2)], ['MPS', +R.mps.toFixed(2)], ['Mastery level', R.level], ['Reached 75%', R.passed],
    [], ['Competency','Items','% Correct','Level'], ...R.comps.map(cp=>[cp.name, cp.items.join(', '), +cp.pct.toFixed(2), cp.level])]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item','Key','Correct','% Correct','Difficulty','D','Discrimination','Decision','Mastery',...opts,'Blank','Distractor notes'],
    ...R.items.map(i=>[i.no, i.key, i.correct, +i.pct.toFixed(2), i.diff, +i.D.toFixed(2), i.disc, i.dec, i.mastered?'Mastered':'Least mastered', ...opts.map(o=>i.counts[o]||0), i.blank, i.flags.join('; ')])]), 'Item Analysis');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Rank','Learner','Score','%','Mastery','Items missed','Answers'],
    ...R.people.map((p,i)=>[i+1, p.name, p.score, +(p.score/R.n*100).toFixed(2), M.mpsLevel(p.score/R.n*100), p.right.map((v,k)=>v?null:k+1).filter(Boolean).join(', '), p.r])]), 'Learners');
  XLSX.writeFile(wb, `Item Analysis - ${a.title} - ${c.section}.xlsx`);
}
})();
