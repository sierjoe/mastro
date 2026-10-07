/* MASTRO — Forms hub (SF1–SF10) and the SF9 Learner's Performance Report generator */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, isNum} = M;

M.FORMS = [
  {code:'SF1', title:'School Register', desc:'Upload the LIS SF1 to confirm enrolment and update names, LRNs, sex and birthdates (ages on SF9).', gen:'sf1'},
  {code:'SF2', title:'Daily Attendance Report of Learners', desc:'Monthly attendance grid with tardiness and the monthly summary.', gen:'attendance'},
  {code:'SF3', title:'Books Issued and Returned', desc:'Textbooks and learning materials issued to and returned by learners.'},
  {code:'SF4', title:'Monthly Learner’s Movement and Attendance', desc:'Per-section registered learners, average daily attendance, dropouts and transfers.', gen:'attendance'},
  {code:'SF5', title:'Report on Promotion and Level of Proficiency', desc:'End-of-year promotion status and proficiency level per learner.'},
  {code:'SF6', title:'Summarized Report on Promotion and Level of Proficiency', desc:'School-level summary of promotion and proficiency by grade level.'},
  {code:'SF7', title:'School Personnel Assignment List and Basic Profile', desc:'Teaching and non-teaching personnel, assignments and teaching loads.'},
  {code:'SF8', title:'Learner’s Basic Health and Nutrition Report', desc:'Height, weight, BMI and nutritional status of learners.'},
  {code:'SF9', title:'Learner’s Progress Report Card', desc:'Learner’s Performance Report (front and back) filled from the gradesheet and attendance.', gen:'sf9'},
  {code:'SF10', title:'Learner’s Permanent Academic Record', desc:'Formerly Form 137 — the learner’s permanent scholastic record.'}
];

/* =====================================================================
   HUB + per-form workspace
   ===================================================================== */
M.views.forms = async function(el, args){
  const code = (args[0]||'').toUpperCase();
  if(code === 'SF9') return sf9View(el, args[1]);
  if(code) return formPage(el, M.FORMS.find(f=>f.code===code) || M.FORMS[0]);
  const docs = await M.docsAll().catch(()=>[]);
  const count = (c) => docs.filter(d=>d.formCode===c).length;
  el.innerHTML = `<div class="grid g-3 forms-grid">${M.FORMS.map(f => `
    <a class="card form-card" href="#forms/${f.code}">
      <div class="row"><div class="sf-code">${f.code}</div><span class="spacer"></span>${f.gen?`<span class="chip green">Generate</span>`:(M.TPL_FORMS||[]).includes(f.code)?`<span class="chip gold">Auto-fill</span>`:''}<span class="chip">${count(f.code)} file(s)</span></div>
      <div class="title" style="margin-top:12px">${esc(f.title)}</div>
      <div class="small muted">${esc(f.desc)}</div>
    </a>`).join('')}</div>`;
};
async function formPage(el, f){
  el.innerHTML = `
  <div class="card"><div class="row"><a class="btn sm" href="#forms">${ico('left','width:16px;height:16px')} All forms</a><div class="sf-code" style="margin-left:6px">${f.code}</div><div><div class="title"><b>${esc(f.title)}</b></div><div class="small muted">${esc(f.desc)}</div></div>
    <span class="spacer"></span>${f.code==='SF1'?`<button class="btn primary" id="sf1Imp">${ico('upload')} Import SF1 → update learners & LIS</button>`:''}${f.gen==='attendance'?`<a class="btn primary" href="#attendance" id="goAtt">${ico('attendance')} Generate ${f.code} in Attendance</a>`:''}</div></div>
  ${f.code==='SF2'?'<div id="sf2Wrap" style="margin-top:20px"></div>':''}
  <div id="tplWrap" style="margin-top:20px"></div>
  <div class="grid g-hero" style="margin-top:20px">
    <div class="card"><h2>${f.code} workspace</h2>
      <div class="drop" id="fDrop">${ico('upload','width:30px;height:30px;color:var(--green)')}<div><b>Upload ${f.code} files</b></div><div class="small muted">Templates, filled forms, scanned signed copies — kept offline on this device</div></div>
      <input type="file" id="fFile" multiple hidden>
      <div class="list" id="fList" style="margin-top:16px"></div></div>
    <div class="card"><h2>Notes</h2><p class="small muted" style="margin-top:0">Files uploaded here are tagged <b>${f.code}</b> and also appear in the Repository under School Forms.</p>
      ${M.TPL_FORMS && M.TPL_FORMS.includes(f.code)?`<p class="small">Upload your blank ${f.code} template in the card above — MASTRO fills it from your class data.</p>`:''}
      <a class="btn gold sm" href="${esc(M.S.settings.driveUrl)}" target="_blank" rel="noopener">${ico('drive')} Open Drive folder</a></div>
  </div>`;
  if($('#sf1Imp')) $('#sf1Imp').onclick = () => M.pickSF1();
  if(M.TPL_FORMS && M.TPL_FORMS.includes(f.code)) M.templateCard($('#tplWrap'), f); else $('#tplWrap').remove();
  if(f.code==='SF2') sf2Card();
  if($('#goAtt')) $('#goAtt').onclick = () => { M.S.ui.attTab = 'reports'; M.save(); };
  M.dropZone($('#fDrop'), $('#fFile'), files => M.addFiles(files, 'School Forms', {formCode:f.code, tags:f.code}));
  const docs = (await M.docsAll().catch(()=>[])).filter(d=>d.formCode===f.code).sort((a,b)=>b.added.localeCompare(a.added));
  const fl = $('#fList'); if(!fl) return;
  fl.innerHTML = docs.length ? docs.map(M.docItem).join('') : '<div class="empty">No files yet.</div>';
  M.bindDocActions(fl);
}

function sf2Card(){
  const el = $('#sf2Wrap'); if(!el) return; const c = M.cls(); const sec = M.sectionFor(c);
  if(!sec){ el.innerHTML = `<div class="card"><div class="empty">Link ${esc(M.className(c))} to its attendance section in Attendance → Manage to generate SF2.</div></div>`; return; }
  const ui = M.sf2UI = M.sf2UI || {month: M.today().slice(0,7)};
  const D = M.sf2Data(sec, ui.month);
  const absent = D.rows.reduce((a,r)=>a+r.abs,0), tardy = D.rows.reduce((a,r)=>a+r.tardy,0);
  const sf1 = c.learners.filter(l=>l.sf1).length;
  el.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0">SF2 · ${esc(M.className(c))} (advisory)</h2><span class="spacer"></span>
      <input type="month" class="input" id="s2M" value="${ui.month}" style="width:auto">
      <button class="btn" id="s2X">${ico('download')} Excel</button><button class="btn primary" id="s2P">${ico('print')} Print / Save PDF</button></div>
    <div class="chips" style="margin:12px 0"><span class="chip green">From the seat-chart attendance of ${esc(sec.name)}</span><span class="chip">${D.days.length} class days</span><span class="chip">${D.rows.length} learners</span><span class="chip">${absent} absences · ${tardy} tardy</span><span class="chip ${sf1?'green':'gold'}">${sf1?`${sf1} names from SF1`:'Upload SF1 for official names'}</span></div>
    <div class="sf-preview">${M.sf2Html(sec, ui.month)}</div></div>`;
  $('#s2M').onchange = e => { if(e.target.value){ ui.month = e.target.value; sf2Card(); } };
  $('#s2P').onclick = () => M.doPrint(M.sf2Html(sec, ui.month), '@page{size:A4 landscape;margin:7mm}');
  $('#s2X').onclick = () => M.sf2Xlsx(sec, ui.month);
}

/* =====================================================================
   SF9 DATA
   ===================================================================== */
const SF9_ROWS = [
  ['Filipino','Filipino'],['English','English'],['Mathematics','Mathematics'],['Science','Science'],
  ['Araling Panlipunan (AP)','Araling Panlipunan'],['Values Education','Values Education'],['TLE','TLE'],['MAPEH','MAPEH'],
  ['Music and Arts','Music & Arts',true],['Physical Education and Health','PE & Health',true]
];
const remark = (v) => isNum(v) ? (v >= 75 ? 'Passed' : 'Failed') : '';
M.sf9Data = function(c, l){
  const s = M.S.settings;
  const rows = ['1','2','3'].map(t => M.termRow(c, t, l.id));
  const subj = SF9_ROWS.map(([label, key, sub]) => {
    const t = rows.map(r => r[key]);
    const fin = t.every(isNum) ? Math.round(t.reduce((a,b)=>a+b,0)/3) : null;
    return {label, key, sub:!!sub, t, fin, rem: sub ? '' : remark(fin)};
  });
  const finals = subj.filter(x=>!x.sub).map(x=>x.fin).filter(isNum);
  const ga = finals.length ? Math.round(finals.reduce((a,b)=>a+b,0)/finals.length) : null;
  // attendance (Jun–Apr): class days from the school calendar, absences from the same records as SF2; manual overrides win
  const sec = M.sectionFor(c), sid = M.sidFor(sec, l.id);
  const st = sec && sid ? sec.students[sid] : null;
  const trackFrom = sec ? Object.keys(sec.att).sort()[0] : null;
  const months = M.SY_MONTHS.map((mn, i) => {
    const key = M.syMonthKey(c.sy, i);
    const cd = M.classDays(sec, key);
    const dOv = (c.sf9.days||{})[i];
    const days = dOv!==undefined && dOv!=='' ? +dOv : (cd.length || '');
    const aOv = ((c.sf9.abs||{})[l.id]||{})[i];
    let abs = '';
    if(aOv!==undefined && aOv!=='') abs = +aOv;
    else if(st && trackFrom && cd.some(d => d >= trackFrom)) abs = cd.filter(d => d >= trackFrom && ['A','E'].includes((sec.att[d]||{})[sid])).length;
    else if(st && c.sf9.fillUntracked && cd.length) abs = 0;
    const present = days!=='' && abs!=='' ? Math.max(0, days - abs) : '';
    return {mn, days, present, abs: days!=='' ? abs : '', tracked: abs!=='' && (aOv===undefined || aOv==='')};
  });
  const tot = (k) => months.reduce((a,m)=>a+(isNum(m[k])?m[k]:0),0);
  const age = M.ageOn(l.birthday, c.sf9.ageAsOf || M.firstFridayJune(c.sy)) || l.age || '';
  const g = Number(c.grade);
  return {
    s, c, l, subj, ga, gaRem: remark(ga), months,
    totals:{days:tot('days'), present:tot('present'), abs:tot('abs')},
    age, sex: l.sex==='M'?'Male':l.sex==='F'?'Female':'',
    comments: ((c.sf9.comments||{})[l.id]) || {},
    cert: c.sf9.cert ? {admitted: c.grade, eligible: isNum(g) && (ga===null || ga>=75) ? g+1 : ''} : null
  };
};

/* =====================================================================
   SF9 RENDERING (HTML replica of the template — used for preview, print and PDF)
   ===================================================================== */
const gtxt = (v) => isNum(v) ? String(M.r2(v)) : '';
function sf9Front(D){
  const {s, c, l} = D;
  const sl = M.sealsHtml();
  return `<div class="sf9-panel">
    <div class="hdr" style="margin-top:.6em">${sl.l}<div class="mid">
    <div class="c">Republic of the Philippines</div>
    <div class="c">Department of Education</div>
    <div class="c" style="margin-top:.5em">${esc(s.regionName||'REGION')}</div>
    <div class="c b">${esc(s.division)}</div>
    <div class="c">${esc(s.district)}</div>
    <div class="c">${esc(s.municipality)}</div></div>${sl.r}</div>
    <div class="c b" style="font-size:1.33em;margin-top:.35em">${esc(s.school)}</div>
    <div class="c b">LEARNER'S PERFORMANCE REPORT</div>
    <div class="c">School Year ${esc(String(c.sy).replace('–','-'))}</div>
    <div class="info">
      <span>Name:</span><span class="ln l">${esc(l.name)}</span><span>Age:</span><span class="ln">${esc(D.age)}</span><span>Sex:</span><span class="ln">${esc(D.sex)}</span>
      <span>LRN:</span><span class="ln l">${esc(l.lrn)}</span><span>Grade:</span><span class="ln">${esc(c.grade)}</span><span>Section:</span><span class="ln">${esc(c.section)}</span>
    </div>
    <div class="letter"><div>Dear Parents,</div>
      <div class="ind">This Performance Report presents your child's progress and achievement in the different learning areas.</div>
      <div class="ind">The school welcomes you to reach out should you wish to know more about your child's learning and performance.</div></div>
    <div class="sigs"><div><div class="sn">${esc(c.head||s.head)}</div><div class="cap">School Head</div></div><div><div class="sn">${esc(c.adviser)}</div><div class="cap">Adviser</div></div></div>
    <div class="c b" style="margin-top:.5em">LEARNING PROGRESS AND ACHIEVEMENT</div>
    <table class="lp">
      <colgroup><col style="width:38%"><col style="width:9.4%"><col style="width:8.7%"><col style="width:9.4%"><col style="width:9%"><col></colgroup>
      <thead><tr><th rowspan="2">Learning Areas</th><th colspan="3">TERM</th><th rowspan="2">Final<br>Grade</th><th rowspan="2">Remarks</th></tr><tr><th>T1</th><th>T2</th><th>T3</th></tr></thead>
      <tbody>${D.subj.map(x => `<tr class="${x.sub?'sub':''}"><td class="la">${esc(x.label)}</td>${x.t.map(v=>`<td>${gtxt(v)}</td>`).join('')}<td>${gtxt(x.fin)}</td><td>${x.rem}</td></tr>`).join('')}
        <tr class="ga"><td colspan="4" class="gal">General Average</td><td><b>${gtxt(D.ga)}</b></td><td><b>${D.gaRem}</b></td></tr></tbody>
    </table>
    <div class="desc-key"><div class="b">PERFORMANCE DESCRIPTORS</div>
      <table><tr class="b"><td>Grading Scale</td><td>Descriptors</td><td>Remarks</td></tr>
      ${[['90-100','Advancing','Passed'],['80-89','Benchmarking','Passed'],['75-79','Connecting','Passed'],['65-74','Developing','Failed'],['0-64','Emerging','Failed']].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table></div>
  </div>`;
}
function sf9Back(D){
  const {s, c} = D; const head = c.head||s.head;
  const cell = (v) => v===''||v===undefined ? '' : v;
  return `<div class="sf9-panel back">
    <table class="att">
      <thead><tr><th class="m">Month</th>${D.months.map(m=>`<th>${m.mn}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>
        <tr><th class="m">No. of Class Days</th>${D.months.map(m=>`<td>${cell(m.days)}</td>`).join('')}<td><b>${D.totals.days}</b></td></tr>
        <tr><th class="m">No. of Days Present</th>${D.months.map(m=>`<td>${cell(m.present)}</td>`).join('')}<td><b>${D.totals.present}</b></td></tr>
        <tr><th class="m">No. of Days Absent</th>${D.months.map(m=>`<td>${cell(m.abs)}</td>`).join('')}<td><b>${D.totals.abs}</b></td></tr>
      </tbody></table>
    <div class="c b" style="margin-top:1.6em">TEACHER'S COMMENTS / REMARKS</div>
    <div class="cbox">${['1','2','3'].map(t=>`<div class="cb"><b>Term ${t}</b><div class="ctext">${esc(D.comments[t]||'')}</div></div>`).join('')}</div>
    <div class="c b" style="margin-top:1.3em">PARENT/S GUARDIAN'S SIGNATURE</div>
    <div class="psig">${['1','2','3'].map(t=>`<div><b>Term ${t}</b><span class="ln"></span></div>`).join('')}</div>
    <div class="c b" style="margin-top:1.6em">CERTIFICATE OF TRANSFER</div>
    <div class="cert-t">This is to certify that the above-named learner has satisfactorily completed the requirements for the grade level indicated.</div>
    <div class="cert-f">Admitted to Grade: <span class="ln sh">${esc(D.cert?D.cert.admitted:'')}</span></div>
    <div class="cert-f">Eligible for Admission to Grade: <span class="ln md">${esc(D.cert?D.cert.eligible:'')}</span></div>
    <div class="appr"><div>Approved:</div><div class="r"><div class="sn">${esc(c.adviser)}</div><div class="cap">Adviser</div></div></div>
    <div class="hs"><div class="sn">${esc(head)}</div><div class="cap">School &nbsp;Head</div></div>
    <div class="c b" style="margin-top:.9em">CANCELLATION OF ELIGIBILITY TO TRANSFER</div>
    <div class="cancel"><span>Admitted in:</span><span class="ln"></span><span>Date:</span><span class="ln"></span></div>
    <div class="hs" style="margin-top:2em"><div class="sn">${esc(head)}</div><div class="cap">School Head</div></div>
  </div>`;
}
// paper layouts: two panels side by side (landscape) or front/back on separate pages (portrait)
M.SF9_LAYOUTS = {
  duplex:   {label:'A4 portrait · front & back', cls:'a4p', fmt:'a4', orient:'portrait',  margin:8, w:194, h:280, both:false},
  landscape:{label:'A4 landscape · both sides',  cls:'a4l', fmt:'a4', orient:'landscape', margin:8, w:281, h:193, both:true},
  a5p:      {label:'A5 portrait · front & back', cls:'a5p', fmt:'a5', orient:'portrait',  margin:6, w:136, h:197, both:false},
  a5l:      {label:'A5 landscape · both sides',  cls:'a5l', fmt:'a5', orient:'landscape', margin:6, w:198, h:135, both:true}
};
const LAY = (k) => M.SF9_LAYOUTS[k] || M.SF9_LAYOUTS.duplex;
const PANEL_W = 184.2, PANEL_H = 270.4; // mm at 10.4pt (50.2em × 73.7em)
function sf9Pages(D, layout){
  const L = LAY(layout);
  const k = Math.min(1, (L.both ? (L.w - 6) / 2 : L.w) / PANEL_W, (L.h - 2) / PANEL_H);
  const slot = (html) => k >= 0.999 ? html : `<div class="pslot" style="width:${(PANEL_W*k).toFixed(2)}mm;height:${(PANEL_H*k).toFixed(2)}mm"><div class="pscale" style="transform:scale(${k.toFixed(4)})">${html}</div></div>`;
  if(L.both) return `<div class="sf9-page ${L.cls}">${slot(sf9Front(D))}${slot(sf9Back(D))}</div>`;
  return `<div class="sf9-page ${L.cls}">${slot(sf9Front(D))}</div><div class="sf9-page ${L.cls}">${slot(sf9Back(D))}</div>`;
}
const pageCss = (layout) => { const L = LAY(layout); return `@page{size:${L.fmt.toUpperCase()} ${L.orient};margin:${L.margin}mm}`; };

/* =====================================================================
   SF9 VIEW
   ===================================================================== */
function sf9View(el, lidArg){
  const c = M.cls(); const L = M.sortedLearners(c);
  if(!L.length){ el.innerHTML = '<div class="card"><div class="empty">No learners in this class yet.</div></div>'; return; }
  const ui = M.sf9UI = M.sf9UI || {tab:'preview'};
  const l = L.find(x=>x.id===lidArg) || L.find(x=>x.id===ui.lid) || L[0]; ui.lid = l.id;
  const i = L.indexOf(l); const layout = c.sf9.layout || 'duplex';
  const sec = M.sectionFor(c);
  el.innerHTML = `
  <div class="card">
    <div class="row">
      <a class="btn sm" href="#forms">${ico('left','width:16px;height:16px')} Forms</a>
      <div class="sf-code">SF9</div><b>Learner’s Performance Report</b>
      <span class="spacer"></span>
      <select class="input" id="lay" style="width:auto">${Object.entries(M.SF9_LAYOUTS).map(([k,v])=>`<option value="${k}" ${k===layout?'selected':''}>${v.label}</option>`).join('')}</select>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="icon-btn" id="pv" ${i?'':'disabled'}>${ico('left','width:18px;height:18px')}</button>
      <select class="input" id="lsel" style="width:auto;max-width:320px">${L.map(x=>`<option value="${x.id}" ${x.id===l.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      <button class="icon-btn" id="nx" ${i<L.length-1?'':'disabled'}>${ico('right','width:18px;height:18px')}</button>
      <span class="small muted">${i+1} of ${L.length}</span>
      <span class="spacer"></span>
      <button class="btn sm" id="p1">${ico('print')} Print</button>
      <button class="btn sm" id="d1">${ico('pdf')} PDF</button>
      <button class="btn sm primary" id="pAll">${ico('print')} Print all (${L.length})</button>
      <button class="btn sm primary" id="dAll">${ico('pdf')} Bulk PDF</button>
      <button class="btn sm gold" id="xAll">${ico('download')} Excel (your template)</button>
    </div>
    <div class="seg" id="sfTabs" style="margin-top:14px">${[['preview','Preview'],['att','Attendance'],['com','Teacher’s comments'],['opt','Options']].map(([k,t])=>`<button data-t="${k}" class="${ui.tab===k?'on':''}">${t}</button>`).join('')}</div>
  </div>
  <div id="sfBody" style="margin-top:20px"></div>
  <div id="pdfStage" aria-hidden="true"></div>`;
  const go = (id) => { location.hash = '#forms/SF9/' + id; };
  $('#pv').onclick = () => go(L[i-1].id); $('#nx').onclick = () => go(L[i+1].id);
  $('#lsel').onchange = e => go(e.target.value);
  $('#lay').onchange = e => { c.sf9.layout = e.target.value; M.save(); sf9View(el, l.id); };
  $('#sfTabs').onclick = e => { const b=e.target.closest('button'); if(!b) return; ui.tab = b.dataset.t; sf9View(el, l.id); };
  $('#p1').onclick = () => M.doPrint(sf9Pages(M.sf9Data(c,l), layout), pageCss(layout));
  $('#pAll').onclick = () => M.doPrint(L.map(x=>sf9Pages(M.sf9Data(c,x), layout)).join(''), pageCss(layout));
  $('#d1').onclick = () => makePdf(c, [l], layout, `SF9 ${l.name}.pdf`);
  $('#dAll').onclick = () => makePdf(c, L, layout, `SF9 ${c.grade}-${c.section} (${L.length} learners).pdf`);
  $('#xAll').onclick = () => makeXlsx(c, L);
  const body = $('#sfBody');
  if(ui.tab==='preview'){
    const D = M.sf9Data(c, l);
    const warn = [];
    if(!D.age) warn.push('No birthday/age — add it in Learners → Edit details');
    if(!sec) warn.push('Attendance: this class is not linked to a SeatCheck section');
    else if(!M.sidFor(sec, l.id)) warn.push('Attendance: this learner has no seat — link them in Attendance → Manage');
    if(M.termsWithData(c).length < 3) warn.push('Final grades appear once Term 1–3 grades are all in');
    body.innerHTML = `${warn.length?`<div class="card" style="margin-bottom:20px">${warn.map(w=>`<div class="flag"><span class="dot"></span><div>${esc(w)}</div></div>`).join('')}</div>`:''}
      <div class="sf9-preview ${LAY(layout).both?'both':'duplex'}">${sf9Pages(D, layout)}</div>`;
    fitPreview(body);
  }
  if(ui.tab==='att') attTab(body, c, L, sec, () => sf9View(el, l.id));
  if(ui.tab==='com') comTab(body, c, L);
  if(ui.tab==='opt') optTab(body, c, () => sf9View(el, l.id));
}
function fitPreview(body){
  const wrap = $('.sf9-preview', body); if(!wrap) return;
  const pages = $$('.sf9-page', wrap);
  pages.forEach(p => { const w = document.createElement('div'); w.className = 'pw'; p.parentNode.insertBefore(w, p); w.appendChild(p); });
  const fit = () => {
    const avail = wrap.clientWidth, pw = pages[0].offsetWidth, ph = pages[0].offsetHeight;
    const per = wrap.classList.contains('duplex') && avail > 1000 ? 2 : 1;
    const k = Math.min(1, (avail - 16*(per-1)) / per / pw);
    $$('.pw', wrap).forEach(w => { w.style.width = (pw*k)+'px'; w.style.height = (ph*k)+'px'; w.firstChild.style.transform = `scale(${k})`; });
  };
  fit(); window.addEventListener('resize', fit); M.onLeave = () => window.removeEventListener('resize', fit);
}
function attTab(body, c, L, sec, rerender){
  const days = M.SY_MONTHS.map((mn,i) => { const key = M.syMonthKey(c.sy, i); const rec = sec ? M.classDays(sec, key).length : 0; const ov = (c.sf9.days||{})[i]; return {mn, i, key, rec, ov: ov===undefined?'':ov}; });
  body.innerHTML = `<div class="card">
    <h2>School days per month</h2>
    <p class="small muted" style="margin-top:0">Blank = school days from the calendar (Attendance → Manage → School calendar)${sec?` (section ${esc(sec.name)})`:''}. Type a number to set the official count (e.g. for months before you started taking attendance in MASTRO/SeatCheck).</p>
    <div class="table-wrap" style="max-height:none"><table><thead><tr><th></th>${days.map(d=>`<th class="c">${d.mn}</th>`).join('')}</tr></thead>
      <tbody><tr><td><b>Class days</b></td>${days.map(d=>`<td class="c"><input class="grade-in" data-day="${d.i}" placeholder="${d.rec||''}" value="${esc(d.ov)}" inputmode="numeric" style="width:46px;text-align:center"></td>`).join('')}</tr></tbody></table></div>
  </div>
  <div class="card" style="margin-top:20px"><h2>Days absent per learner</h2>
    <label class="row" style="cursor:pointer;margin-bottom:10px"><input type="checkbox" id="fillUT" ${c.sf9.fillUntracked?'checked':''}> Months before I started taking attendance in MASTRO/SeatCheck: count as no absences (instead of leaving them blank)</label>
    <p class="small muted" style="margin-top:0">Gray numbers come from Attendance (absent + excused), the same records used for SF2. Months before you started taking attendance are blank — type those absences from your records. Type to override any month.</p>
    <div class="table-wrap"><table><thead><tr><th class="sticky-col">Learner</th>${days.map(d=>`<th class="c">${d.mn}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
    ${L.map(l => { const D = M.sf9Data(c, l); const ov = (c.sf9.abs||{})[l.id]||{};
      return `<tr><td class="sticky-col">${esc(l.name)}</td>${D.months.map((m,i)=>`<td class="c"><input class="grade-in" data-lid="${l.id}" data-m="${i}" value="${esc(ov[i]??'')}" placeholder="${ov[i]!==undefined?'':m.abs}" inputmode="numeric" style="width:42px;text-align:center"></td>`).join('')}<td class="num"><b>${D.totals.abs}</b></td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  body.addEventListener('change', e => {
    const x = e.target; if(x.id==='fillUT'){ c.sf9.fillUntracked = x.checked; M.save(); rerender(); return; }
    const v = x.value.replace(/\D/g,'');
    if(x.dataset.day!==undefined){ c.sf9.days = c.sf9.days||{}; if(v==='') delete c.sf9.days[x.dataset.day]; else c.sf9.days[x.dataset.day] = v; }
    if(x.dataset.lid){ const o = c.sf9.abs[x.dataset.lid] = c.sf9.abs[x.dataset.lid]||{}; if(v==='') delete o[x.dataset.m]; else o[x.dataset.m] = v; }
    M.save(); rerender();
  });
}
function comTab(body, c, L){
  const bank = () => [...M.COMMENT_BANK, ...(M.S.settings.myComments||[])];
  const opts = () => `<option value="">＋ Insert a comment…</option><optgroup label="Pre-built comments">${M.COMMENT_BANK.map((x,i)=>`<option value="b${i}">${esc(x.replace('{name}','[Name]'))}</option>`).join('')}</optgroup>${(M.S.settings.myComments||[]).length?`<optgroup label="My comments">${M.S.settings.myComments.map((x,i)=>`<option value="m${i}">${esc(x.replace('{name}','[Name]'))}</option>`).join('')}</optgroup>`:''}`;
  const pick = (v) => v[0]==='b' ? M.COMMENT_BANK[+v.slice(1)] : M.S.settings.myComments[+v.slice(1)];
  const fill = (tpl, l) => tpl.replace(/\{name\}/g, M.firstName(l.name).replace(/\b\w+/g, w => w[0].toUpperCase()+w.slice(1).toLowerCase()));
  body.innerHTML = `
  <div class="card"><div class="row"><h2 style="margin:0">Teacher’s comments / remarks</h2><span class="spacer"></span>
    <label class="field" style="flex-direction:row;align-items:center;gap:8px">Term<select class="input" id="bulkT" style="width:auto">${['1','2','3'].map(t=>`<option>${t}</option>`).join('')}</select></label>
    <select class="input" id="bulkC" style="width:auto;max-width:330px">${opts()}</select>
    <button class="btn sm" id="bulkGo">Fill blanks for all learners</button></div>
    <p class="small muted">Printed in the Term 1–3 boxes on the back of the SF9. Pick from the comment bank (the learner’s first name is filled in for you) or type your own. Saved as you type.</p>
    <div class="row" style="margin-top:6px"><input class="input" id="myC" placeholder="Write a reusable comment — use {name} for the learner’s first name" style="flex:1;min-width:240px"><button class="btn sm primary" id="myAdd">${ico('plus')} Save to my comments</button></div>
    ${(M.S.settings.myComments||[]).length?`<div class="chips" style="margin-top:10px">${M.S.settings.myComments.map((x,i)=>`<span class="chip">${esc(x)} <a href="#" data-rmc="${i}" style="color:var(--red);text-decoration:none;margin-left:4px">✕</a></span>`).join('')}</div>`:''}
  </div>
  <div class="list" style="margin-top:20px">${L.map(l => { const cm = (c.sf9.comments||{})[l.id]||{}; return `<div class="card" style="padding:16px"><div class="title" style="margin-bottom:10px"><b>${esc(l.name)}</b></div>
    <div class="grid g-3" style="gap:12px">${['1','2','3'].map(t=>`<div class="field"><div class="row" style="justify-content:space-between"><span>Term ${t}</span><select class="input bankSel" data-lid="${l.id}" data-t="${t}" style="width:auto;max-width:170px;padding:5px 8px;font-size:12px">${opts()}</select></div>
      <textarea class="input" rows="3" data-lid="${l.id}" data-t="${t}" maxlength="240" placeholder="Type a comment…">${esc(cm[t]||'')}</textarea></div>`).join('')}</div></div>`; }).join('')}</div>`;
  const setC = (lid, t, v) => { const o = c.sf9.comments[lid] = c.sf9.comments[lid]||{}; o[t] = v; };
  body.addEventListener('input', e => { const x = e.target; if(x.tagName!=='TEXTAREA' || !x.dataset.lid) return; setC(x.dataset.lid, x.dataset.t, x.value); clearTimeout(comTab.t); comTab.t = setTimeout(M.save, 400); });
  body.addEventListener('change', e => { const x = e.target; if(!x.classList.contains('bankSel') || !x.value) return;
    const l = L.find(y=>y.id===x.dataset.lid); const ta = body.querySelector(`textarea[data-lid="${x.dataset.lid}"][data-t="${x.dataset.t}"]`);
    const txt = fill(pick(x.value), l); ta.value = ta.value.trim() ? (ta.value.trim() + ' ' + txt).slice(0,240) : txt; setC(l.id, x.dataset.t, ta.value); M.save(); x.value = ''; });
  $('#bulkGo', body).onclick = () => { const v = $('#bulkC', body).value, t = $('#bulkT', body).value; if(!v) return M.toast('Choose a comment first');
    let n = 0; L.forEach(l => { const cm = (c.sf9.comments[l.id]||{}); if(!(cm[t]||'').trim()){ setC(l.id, t, fill(pick(v), l)); n++; } }); M.save(); comTab(body, c, L); M.toast(`Filled ${n} blank comment(s) for Term ${t}`); };
  $('#myAdd', body).onclick = () => { const v = $('#myC', body).value.trim(); if(!v) return; M.S.settings.myComments.push(v); M.save(); comTab(body, c, L); M.toast('Saved to My comments'); };
  body.querySelectorAll('[data-rmc]').forEach(a => a.onclick = e => { e.preventDefault(); M.S.settings.myComments.splice(+a.dataset.rmc, 1); M.save(); comTab(body, c, L); });
}
async function optTab(body, c, rerender){
  const docs = (await M.docsAll().catch(()=>[])).filter(d => d.formCode==='SF9' && d.isTemplate);
  body.innerHTML = `<div class="grid g-2">
    <div class="card"><h2>Certificate of transfer</h2>
      <label class="row" style="cursor:pointer"><input type="checkbox" id="cert" ${c.sf9.cert?'checked':''}> Fill “Admitted to Grade” and “Eligible for Admission to Grade” (use at year end)</label>
      <p class="small muted">Eligible grade = current grade + 1 when the general average is 75 or higher; left blank otherwise.</p></div>
    <div class="card"><h2>Excel template</h2>
      <p class="small muted" style="margin-top:0">“Excel (your template)” fills your uploaded SF9 workbook (FRONT and BACK sheets) for every learner. ${docs.length?`Using your uploaded template: <b>${esc(docs[0].name)}</b>.`:'Currently using the template you sent (built in).'}</p>
      <div class="row"><button class="btn sm" id="tplUp">${ico('upload')} Replace template</button>${docs.length?`<button class="btn sm danger" id="tplDel">Use built-in template</button>`:''}<input type="file" id="tplF" accept=".xlsx" hidden></div>
      <p class="tiny muted">The template must keep the same cell layout as the DepEd file (Name in C17, grades in F32:H41, attendance in R5:AB9).</p></div>
    <div class="card"><h2>Age on the report card</h2>
      <label class="field">Compute age as of<input type="date" class="input" id="ageAsOf" value="${esc(c.sf9.ageAsOf || M.firstFridayJune(c.sy))}"></label>
      <p class="small muted">Default is the 1st Friday of June (same basis as SF1). Birthdates come from your uploaded SF1 or from Learners → Edit details.</p></div>
    <div class="card"><h2>Header lines</h2><p class="small muted" style="margin-top:0">Region, division, district and school ID are edited in Settings.</p><a class="btn sm" href="#settings">${ico('settings')} Open Settings</a></div>
  </div>`;
  $('#cert').onchange = e => { c.sf9.cert = e.target.checked; M.save(); };
  $('#ageAsOf').onchange = e => { c.sf9.ageAsOf = e.target.value; M.save(); };
  $('#tplUp').onclick = () => $('#tplF').click();
  $('#tplF').onchange = async e => { const f = e.target.files[0]; if(!f) return; for(const d of docs) await M.docDel(d.id);
    await M.docPut({id:M.uid('d'), name:f.name, category:'School Forms', formCode:'SF9', isTemplate:true, tags:'SF9, template', classId:'', notes:'', mime:f.type, size:f.size, added:new Date().toISOString(), blob:f}); M.toast('Template saved'); rerender(); };
  if($('#tplDel')) $('#tplDel').onclick = async () => { for(const d of docs) await M.docDel(d.id); M.toast('Using built-in template'); rerender(); };
}

/* =====================================================================
   PDF (html2canvas + jsPDF) — A4, one image per page
   ===================================================================== */
function progress(text){
  let p = $('#pdfProg'); if(!p){ document.body.insertAdjacentHTML('beforeend', `<div id="pdfProg" class="prog glass"><div class="pt"></div><div class="bar-track"><div class="bar-fill"></div></div></div>`); p = $('#pdfProg'); }
  return { set:(t, f) => { $('.pt', p).textContent = t; $('.bar-fill', p).style.width = (f*100)+'%'; }, done:() => p.remove() };
}
async function makePdf(c, learners, layout, filename){
  const pr = progress('Preparing…');
  try {
    await Promise.all([M.loadScript('vendor/html2canvas.min.js'), M.loadScript('vendor/jspdf.umd.min.js')]);
    const {jsPDF} = window.jspdf;
    const Ly = LAY(layout);
    const pdf = new jsPDF({orientation: Ly.orient, unit:'mm', format:Ly.fmt, compress:true});
    const stage = $('#pdfStage'); let first = true, n = 0;
    const total = learners.length * (Ly.both?1:2);
    for(const l of learners){
      stage.innerHTML = sf9Pages(M.sf9Data(c, l), layout);
      for(const page of $$('.sf9-page', stage)){
        const canvas = await html2canvas(page, {scale:2, backgroundColor:'#ffffff', logging:false, useCORS:true});
        if(!first) pdf.addPage(Ly.fmt, Ly.orient); first = false;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', Ly.margin, Ly.margin, Ly.w, Ly.h, undefined, 'FAST');
        pr.set(`Rendering ${++n} of ${total} pages…`, n/total);
      }
    }
    stage.innerHTML = '';
    pr.set('Saving PDF…', 1);
    M.downloadBlob(pdf.output('blob'), filename);
    M.toast('PDF downloaded');
  } catch(e){ alert('Could not make the PDF: ' + e.message); }
  pr.done();
}

/* =====================================================================
   EXCEL — fill the user's own SF9 workbook by editing its sheet XML directly,
   so every border, merge, font and print setting stays exactly as designed.
   ===================================================================== */
async function templateBuffer(){
  const docs = (await M.docsAll().catch(()=>[])).filter(d => d.formCode==='SF9' && d.isTemplate && d.blob);
  if(docs.length) return await docs[0].blob.arrayBuffer();
  const r = await fetch('templates/SF9_Report_Card_Template.xlsx'); if(!r.ok) throw new Error('Template file missing'); return await r.arrayBuffer();
}
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const colNum = (L) => L.split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64, 0);
const splitRef = (ref) => { const m = ref.match(/^([A-Z]+)(\d+)$/); return [m[1], +m[2]]; };
const ATT_COLS = ['R','S','T','U','V','W','X','Y','Z','AA','AB'];
function sheetFiller(doc, wrapStyle){
  const sd = doc.getElementsByTagNameNS(NS,'sheetData')[0];
  // drop every formula (they point to another workbook) together with its cached value
  [...doc.getElementsByTagNameNS(NS,'f')].forEach(f => { const c = f.parentNode; while(c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t'); });
  const rowEl = (n) => {
    const rows = [...sd.getElementsByTagNameNS(NS,'row')];
    let r = rows.find(x => +x.getAttribute('r') === n); if(r) return r;
    r = doc.createElementNS(NS,'row'); r.setAttribute('r', n);
    const after = rows.find(x => +x.getAttribute('r') > n); sd.insertBefore(r, after || null); return r;
  };
  const cellEl = (ref) => {
    const [L, n] = splitRef(ref), row = rowEl(n);
    const cells = [...row.getElementsByTagNameNS(NS,'c')];
    let c = cells.find(x => x.getAttribute('r') === ref); if(c) return c;
    c = doc.createElementNS(NS,'c'); c.setAttribute('r', ref);
    const after = cells.find(x => colNum(splitRef(x.getAttribute('r'))[0]) > colNum(L)); row.insertBefore(c, after || null); return c;
  };
  return {
    set(ref, v, wrap){
      const c = cellEl(ref); while(c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t');
      if(wrap) c.setAttribute('s', wrapStyle(+(c.getAttribute('s')||0)));
      if(v===null || v===undefined || v==='') return;
      if(typeof v === 'number' && isFinite(v)){ const e = doc.createElementNS(NS,'v'); e.textContent = String(v); c.appendChild(e); return; }
      c.setAttribute('t','inlineStr'); const is = doc.createElementNS(NS,'is'), t = doc.createElementNS(NS,'t');
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve'); t.textContent = String(v); is.appendChild(t); c.appendChild(is);
    }
  };
}
function fillSf9(F, D){
  const {s, c, l} = D; const num = (v) => isNum(v) ? M.r2(v) : null;
  F.set('B7', s.regionName||'REGION'); F.set('B8', s.division); F.set('B9', s.district); F.set('B10', s.municipality); F.set('B12', s.school);
  F.set('B15', 'School Year ' + String(c.sy).replace('–','-'));
  F.set('C17', l.name); F.set('I17', D.age===''?null:+D.age); F.set('K17', D.sex); F.set('C18', l.lrn);
  F.set('I18', isFinite(Number(c.grade)) && c.grade!=='' ? Number(c.grade) : c.grade); F.set('K18', c.section);
  F.set('B27', c.head||s.head); F.set('H27', c.adviser);
  D.subj.forEach((x, i) => { const r = 32 + i; ['F','G','H'].forEach((col,k) => F.set(col+r, num(x.t[k]))); F.set('I'+r, x.fin); if(!x.sub) F.set('J'+r, x.rem); });
  F.set('I42', D.ga); F.set('J42', D.gaRem);
  D.months.forEach((m, i) => { F.set(ATT_COLS[i]+'5', m.days===''?null:m.days); F.set(ATT_COLS[i]+'7', m.present===''?null:m.present); F.set(ATT_COLS[i]+'9', m.abs===''?null:m.abs); });
  F.set('AC5', D.totals.days); F.set('AC7', D.totals.present); F.set('AC9', D.totals.abs);
  [['Q15','1'],['Q19','2'],['Q23','3']].forEach(([a,t]) => F.set(a, `Term ${t}` + (D.comments[t] ? '\n' + D.comments[t] : ''), !!D.comments[t]));
  if(D.cert){ F.set('S37', D.cert.admitted); F.set('U38', D.cert.eligible===''?null:D.cert.eligible); }
  F.set('X40', c.adviser); F.set('Q41', c.head||s.head); F.set('Q49', c.head||s.head); F.set('AE35', null);
}
async function makeXlsx(c, learners){
  const pr = progress('Loading template…');
  try {
    await M.loadScript('vendor/jszip.min.js');
    const zip = await JSZip.loadAsync(await templateBuffer());
    const P = new DOMParser(), X = new XMLSerializer();
    const read = async (p) => P.parseFromString(await zip.file(p).async('string'), 'application/xml');
    const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels'), ct = await read('[Content_Types].xml'), st = await read('xl/styles.xml');
    const relEls = [...rels.getElementsByTagName('Relationship')];
    const sheetEls = [...wb.getElementsByTagNameNS(NS,'sheet')];
    const pathOf = (el) => { const id = el.getAttributeNS(RNS,'id'); const t = relEls.find(r=>r.getAttribute('Id')===id).getAttribute('Target'); return t.startsWith('/') ? t.slice(1) : 'xl/'+t; };
    const pick = (name, i) => sheetEls.find(x => x.getAttribute('name').trim().toUpperCase()===name) || sheetEls[i];
    const fEl = pick('FRONT',0), bEl = pick('BACK',1);
    if(!fEl || !bEl) throw new Error('The template needs a FRONT and a BACK sheet');
    const areaOf = (el, def) => { const i = sheetEls.indexOf(el); const dn = [...wb.getElementsByTagNameNS(NS,'definedName')].find(d => d.getAttribute('name')==='_xlnm.Print_Area' && +d.getAttribute('localSheetId')===i); return dn ? dn.textContent.split('!').pop() : def; };
    const SRC = [{xml: await zip.file(pathOf(fEl)).async('string'), area: areaOf(fEl,'$A$1:$M$53'), tag:'F'}, {xml: await zip.file(pathOf(bEl)).async('string'), area: areaOf(bEl,'$O$1:$AE$53'), tag:'B'}];
    // styles: clone a cell style with wrapped text (for teacher's comments)
    const xfs = st.getElementsByTagNameNS(NS,'cellXfs')[0]; const wrapMemo = {};
    const wrapStyle = (i) => { if(wrapMemo[i]!=null) return wrapMemo[i]; const xf = xfs.getElementsByTagNameNS(NS,'xf')[i].cloneNode(true);
      let al = xf.getElementsByTagNameNS(NS,'alignment')[0]; if(!al){ al = st.createElementNS(NS,'alignment'); xf.appendChild(al); }
      al.setAttribute('wrapText','1'); al.setAttribute('vertical','top'); xf.setAttribute('applyAlignment','1'); xfs.appendChild(xf);
      const n = xfs.getElementsByTagNameNS(NS,'xf').length; xfs.setAttribute('count', n); return wrapMemo[i] = n-1; };
    // remove old sheets, the external link to the source workbook and the calc chain
    const dropTypes = ['/worksheet','/externalLink','/calcChain'];
    relEls.filter(r => dropTypes.some(t => r.getAttribute('Type').endsWith(t))).forEach(r => { const t = r.getAttribute('Target'); zip.remove(t.startsWith('/')?t.slice(1):'xl/'+t); r.parentNode.removeChild(r); });
    Object.keys(zip.files).filter(p => p.startsWith('xl/externalLinks/')).forEach(p => zip.remove(p));
    [...ct.getElementsByTagName('Override')].filter(o => /worksheets\/|externalLinks\/|calcChain/.test(o.getAttribute('PartName'))).forEach(o => o.parentNode.removeChild(o));
    [...wb.getElementsByTagNameNS(NS,'externalReferences')].forEach(e => e.parentNode.removeChild(e));
    const sheetsNode = wb.getElementsByTagNameNS(NS,'sheets')[0]; while(sheetsNode.firstChild) sheetsNode.removeChild(sheetsNode.firstChild);
    let dns = wb.getElementsByTagNameNS(NS,'definedNames')[0];
    if(!dns){ dns = wb.createElementNS(NS,'definedNames'); sheetsNode.parentNode.insertBefore(dns, sheetsNode.nextSibling); }
    while(dns.firstChild) dns.removeChild(dns.firstChild);
    const relRoot = rels.documentElement, ctRoot = ct.documentElement;
    const used = new Set(); let k = 0, n = 0;
    for(const l of learners){
      const D = M.sf9Data(c, l);
      const base = `${String(++n).padStart(2,'0')} ${l.name.split(',')[0]}`.replace(/[\[\]:*?\/\\']/g,'').slice(0,26).trim();
      for(const src of SRC){
        const doc = P.parseFromString(src.xml, 'application/xml');
        fillSf9(sheetFiller(doc, wrapStyle), D);
        [...doc.getElementsByTagNameNS(NS,'sheetView')].forEach(v => { if(k>0) v.removeAttribute('tabSelected'); });
        k++;
        let name = `${base} ${src.tag}`; while(used.has(name)) name += '_'; used.add(name);
        zip.file(`xl/worksheets/sheet${k}.xml`, X.serializeToString(doc));
        const r = rels.createElementNS(relRoot.namespaceURI,'Relationship'); r.setAttribute('Id','rIdM'+k); r.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'); r.setAttribute('Target',`worksheets/sheet${k}.xml`); relRoot.appendChild(r);
        const o = ct.createElementNS(ctRoot.namespaceURI,'Override'); o.setAttribute('PartName',`/xl/worksheets/sheet${k}.xml`); o.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'); ctRoot.appendChild(o);
        const se = wb.createElementNS(NS,'sheet'); se.setAttribute('name', name); se.setAttribute('sheetId', k); se.setAttributeNS(RNS,'r:id','rIdM'+k); sheetsNode.appendChild(se);
        const dn = wb.createElementNS(NS,'definedName'); dn.setAttribute('name','_xlnm.Print_Area'); dn.setAttribute('localSheetId', k-1); dn.textContent = `'${name}'!${src.area}`; dns.appendChild(dn);
      }
      pr.set(`Filling ${n} of ${learners.length}…`, n/learners.length);
      if(n % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
    zip.file('xl/workbook.xml', X.serializeToString(wb));
    zip.file('xl/_rels/workbook.xml.rels', X.serializeToString(rels));
    zip.file('[Content_Types].xml', X.serializeToString(ct));
    zip.file('xl/styles.xml', X.serializeToString(st));
    if(zip.file('docProps/app.xml')) zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>');
    pr.set('Saving…', 1);
    const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    M.downloadBlob(blob, `SF9 ${c.grade}-${c.section}${learners.length===1?' '+learners[0].name:''}.xlsx`);
    M.toast('Excel file downloaded');
  } catch(e){ console.error(e); alert('Could not fill the Excel template: ' + e.message); }
  pr.done();
}
M.sf9Pages = sf9Pages; M.makeSf9Xlsx = makeXlsx;
})();
