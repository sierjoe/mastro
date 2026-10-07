/* MASTRO — fill your own DepEd form templates (SF2–SF8, SF10) with MASTRO data.
   Works on the .xlsx XML directly so fonts, borders, merges and print settings are kept.
   It reads the template's labels ("School ID", "Section", "Name of Adviser", "LRN", "NAME", …)
   and writes the matching data next to / under them, then reports exactly what it filled. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, isNum} = M;
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const colNum = (L) => L.split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64, 0);
const colLet = (n) => { let s=''; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; };
const ref = (c, r) => colLet(c) + r;
const parseRef = (x) => { const m = x.match(/^([A-Z]+)(\d+)$/); return {c:colNum(m[1]), r:+m[2]}; };
const clean = (t) => String(t||'').replace(/\s+/g,' ').trim();

/* ---------------- sheet model ---------------- */
function Sheet(doc, sst, styles){
  this.doc = doc; this.sst = sst; this.styles = styles;
  this.sd = doc.getElementsByTagNameNS(NS,'sheetData')[0];
  this.cells = new Map(); this.rows = new Map(); this.maxR = 0; this.maxC = 0;
  [...this.sd.getElementsByTagNameNS(NS,'row')].forEach(r => { const n = +r.getAttribute('r'); this.rows.set(n, r); this.maxR = Math.max(this.maxR, n);
    [...r.getElementsByTagNameNS(NS,'c')].forEach(c => { const p = parseRef(c.getAttribute('r')); this.cells.set(c.getAttribute('r'), c); this.maxC = Math.max(this.maxC, p.c); }); });
  // merges: every covered cell → its range
  this.merge = new Map();
  [...doc.getElementsByTagNameNS(NS,'mergeCell')].forEach(m => { const [a,b] = m.getAttribute('ref').split(':'); if(!b) return; const A = parseRef(a), B = parseRef(b);
    const rg = {c1:A.c, r1:A.r, c2:B.c, r2:B.r}; for(let r=A.r;r<=B.r;r++) for(let c=A.c;c<=B.c;c++) this.merge.set(ref(c,r), rg); });
  // formulas pointing elsewhere are dropped (their cached values stay as plain values)
  [...doc.getElementsByTagNameNS(NS,'f')].forEach(f => { const c = f.parentNode; const v = c.getElementsByTagNameNS(NS,'v')[0]; c.removeChild(f); if(c.getAttribute('t')==='str' && v){ /* keep text */ } });
  this.filled = [];
}
Sheet.prototype.master = function(c, r){ const m = this.merge.get(ref(c,r)); return m ? {c:m.c1, r:m.r1, m} : {c, r, m:null}; };
Sheet.prototype.text = function(c, r){
  const x = this.cells.get(ref(c,r)); if(!x) return '';
  const t = x.getAttribute('t');
  if(t === 's'){ const v = x.getElementsByTagNameNS(NS,'v')[0]; return v ? (this.sst[+v.textContent]||'') : ''; }
  if(t === 'inlineStr'){ return [...x.getElementsByTagNameNS(NS,'t')].map(n=>n.textContent).join(''); }
  const v = x.getElementsByTagNameNS(NS,'v')[0]; return v ? v.textContent : '';
};
Sheet.prototype.mtext = function(c, r){ const m = this.master(c, r); return clean(this.text(m.c, m.r)); };
Sheet.prototype.rowEl = function(n){
  let r = this.rows.get(n); if(r) return r;
  r = this.doc.createElementNS(NS,'row'); r.setAttribute('r', n);
  const after = [...this.rows.keys()].filter(k => k > n).sort((a,b)=>a-b)[0];
  this.sd.insertBefore(r, after ? this.rows.get(after) : null); this.rows.set(n, r); this.maxR = Math.max(this.maxR, n); return r;
};
Sheet.prototype.cellEl = function(c, r){
  const k = ref(c, r); let x = this.cells.get(k); if(x) return x;
  const row = this.rowEl(r); x = this.doc.createElementNS(NS,'c'); x.setAttribute('r', k);
  const after = [...row.getElementsByTagNameNS(NS,'c')].find(y => parseRef(y.getAttribute('r')).c > c);
  // borrow the style of the cell to the left so new cells look like the row
  const prev = [...row.getElementsByTagNameNS(NS,'c')].filter(y => parseRef(y.getAttribute('r')).c < c).pop(); if(prev && prev.getAttribute('s')) x.setAttribute('s', prev.getAttribute('s'));
  row.insertBefore(x, after || null); this.cells.set(k, x); return x;
};
Sheet.prototype.set = function(c, r, v, label){
  if(v===undefined || v===null || v==='') return false;
  const m = this.master(c, r); const x = this.cellEl(m.c, m.r);
  while(x.firstChild) x.removeChild(x.firstChild); x.removeAttribute('t');
  if(typeof v === 'number' && isFinite(v)){ const e = this.doc.createElementNS(NS,'v'); e.textContent = String(v); x.appendChild(e); }
  else { x.setAttribute('t','inlineStr'); const is = this.doc.createElementNS(NS,'is'), t = this.doc.createElementNS(NS,'t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve'); t.textContent = String(v); is.appendChild(t); x.appendChild(is); }
  if(label) this.filled.push({cell: ref(m.c, m.r), label, value: String(v)});
  return true;
};
Sheet.prototype.isEmpty = function(c, r){ const m = this.master(c, r); return !clean(this.text(m.c, m.r)) || /^_+$/.test(clean(this.text(m.c, m.r))); };
Sheet.prototype.each = function(fn){ for(const [k, x] of this.cells){ const p = parseRef(k); const t = clean(this.text(p.c, p.r)); if(t) fn(p.c, p.r, t); } };
// next empty master cell to the right of (c,r), skipping the label's own merge
Sheet.prototype.rightOf = function(c, r, max=14){
  const m = this.master(c, r); let x = (m.m ? m.m.c2 : c) + 1;
  for(let i=0; i<max && x<=Math.max(this.maxC+2, 40); i++){
    const mm = this.master(x, r);
    if(mm.r !== r && mm.m){ x = mm.m.c2 + 1; continue; }
    if(this.isEmpty(x, r)) return {c:mm.c, r:mm.r};
    const t = this.mtext(x, r); if(t && !/^:$/.test(t)) return null;
    x = (mm.m ? mm.m.c2 : x) + 1;
  }
  return null;
};
// the next n empty master cells to the right (for M · F · TOTAL boxes)
Sheet.prototype.rightCells = function(c, r, n){
  const out = []; let pos = {c, r};
  for(let i=0;i<n;i++){ const nx = this.rightOf(pos.c, pos.r, 20); if(!nx) break; out.push(nx); pos = nx; }
  return out;
};

/* ---------------- data for the forms ---------------- */
const fmtDate = (iso) => { if(!iso) return ''; const [y,m,d] = iso.split('-'); return `${m}/${d}/${y}`; };
const splitGiven = (name) => { const {last, given} = M.splitName(name); const first = given.length > 1 ? given.slice(0,-1).join(' ') : given.join(' '); const middle = given.length > 1 ? given[given.length-1] : ''; return {last, first, middle}; };
function context(c, opts){
  const s = M.S.settings; const sec = M.sectionFor(c);
  const month = opts.month || M.today().slice(0,7);
  const D = sec ? M.sf2Data(sec, month) : null;
  const L = M.sortedLearners(c);
  const fin = (l) => M.sf9Data(c, l);
  const learners = L.map(l => { const sd = fin(l); const failed = sd.subj.filter(x=>!x.sub && isNum(x.fin) && x.fin < 75).length;
    const sid = M.sidFor(sec, l.id); const row = D && sid ? D.rows.find(r => r.sid === sid) : null;
    return {l, sex:l.sex, lrn:l.lrn, name:l.name, ...splitGiven(l.name), bday:fmtDate(l.birthday), age: sd.age, ga: sd.ga, sd,
      action: isNum(sd.ga) ? (failed ? (failed > 2 ? 'RETAINED' : 'CONDITIONAL') : 'PROMOTED') : '',
      remarks: l.status ? M.STATUS[l.status].label.toUpperCase() + (l.statusDate?' '+fmtDate(l.statusDate):'') + (l.statusNote?' – '+l.statusNote:'') : '',
      att: row }; });
  return {s, c, sec, month, D, learners,
    head: {schoolId:s.schoolId, school:s.school, sy:String(c.sy).replace('–','-'), grade:String(c.grade), section:c.section, adviser:c.adviser, schoolHead:c.head||s.head,
      region:s.regionName, division:s.division.replace(/^SCHOOLS DIVISION OF\s*/i,''), district:s.district.replace(/^District of\s*/i,''), month: M.monthName(month).split(' ')[0].toUpperCase(), monthFull: M.monthName(month), date: M.today(), municipality:s.municipality}};
}
const LABELS = [
  [/^school\s*id\b/i, 'schoolId', 'School ID'],
  [/^(name\s*of\s*)?school(\s*name)?\b(?!\s*(year|id|head|form))/i, 'school', 'School name'],
  [/^school\s*year\b|^s\.?\s*y\.?\s*:?$/i, 'sy', 'School year'],
  [/^(grade\s*(level)?|classified\s*as\s*grade|grade\s*\/\s*year\s*level)\s*:?$/i, 'grade', 'Grade level'],
  [/^section\s*:?$/i, 'section', 'Section'],
  [/^(class\s*)?adviser(\s*\/\s*teacher)?\s*:$|^name\s*of\s*(class\s*)?adviser/i, 'adviser', 'Adviser'],
  [/^(school\s*head|principal)\s*:$|^name\s*of\s*(the\s*)?(school\s*head|principal)/i, 'schoolHead', 'School head'],
  [/^region\s*:?$/i, 'region', 'Region'],
  [/^division\s*:?$/i, 'division', 'Division'],
  [/^district\s*:?$/i, 'district', 'District'],
  [/report\s*for\s*the\s*month\s*of|^month\s*:?$/i, 'month', 'Month'],
  [/^(date\s*(prepared|accomplished)?)\s*:?$/i, 'date', 'Date']
];
const PERSON_LABELS = [
  [/^last\s*name\s*:?$/i, 'last'], [/^first\s*name\s*:?$/i, 'first'], [/^middle\s*name\s*:?$/i, 'middle'],
  [/learner\s*reference\s*number|^lrn\s*:?$/i, 'lrn'], [/^birth\s*date|^birthdate|date\s*of\s*birth/i, 'bday'], [/^sex\s*:?$/i, 'sexWord'], [/^age\s*:?$/i, 'age']
];
function fillLabels(sh, values, rules){
  sh.each((c, r, t) => {
    if(t.length > 60) return;
    for(const [re, key, label] of rules){
      if(!re.test(t)) continue;
      const v = values[key]; if(v===undefined || v==='' || v===null) return;
      // "School ID: ________" inside one cell
      if(/_{3,}/.test(t)){ sh.set(c, r, t.replace(/_{3,}/, ' ' + v + ' '), label||key); return; }
      const tg = sh.rightOf(c, r); if(tg) sh.set(tg.c, tg.r, v, label||key);
      return;
    }
  });
}
// names above signature captions
function fillSignatures(sh, h){
  sh.each((c, r, t) => {
    let who = null;
    if(/^\(?\s*(signature\s*of\s*)?(class\s*)?(adviser|teacher|subject teacher)(\s*over\s*printed\s*name)?\s*\)?$|signature\s*of\s*(the\s*)?(class\s*)?(adviser|teacher)/i.test(t)) who = 'adviser';
    else if(/^\(?\s*(signature\s*of\s*)?(school\s*head|principal(\s*[iv]+)?|head\s*teacher)(\s*over\s*printed\s*name)?\s*\)?$|signature\s*of\s*(the\s*)?(school\s*head|principal)/i.test(t)) who = 'schoolHead';
    if(!who) return;
    for(let k=1;k<=3;k++){ const up = r - k; if(up < 1) break; const m = sh.master(c, up); const tx = sh.mtext(c, up);
      if(!tx || /^_+$/.test(tx)){ sh.set(m.c, m.r, h[who], who==='adviser'?'Adviser signature':'School head signature'); return; }
      if(tx) return; }
  });
}
/* learner list: finds the header row (LRN / NAME), then writes boys then girls into the empty rows */
const COLS = {
  no:/^(no\.?|#)$/i, lrn:/^lrn\b/i, last:/last\s*name/i, first:/first\s*name/i, middle:/middle\s*name/i,
  name:/name/i, sex:/^sex\b|gender|^\(?m\s*\/\s*f\)?$/i, bday:/birth/i, age:/^age\b/i,
  ga:/general\s*average|final\s*(grade|rating)|gen\.?\s*ave/i, action:/action\s*taken/i, remarks:/^remarks?\b/i,
  absent:/^absent\b/i, tardy:/^tardy\b/i, position:/position|designation/i
};
function findTable(sh){
  let hr = 0;
  for(let r=1; r<=Math.min(sh.maxR, 60) && !hr; r++) for(let c=1; c<=sh.maxC; c++){ const t = sh.mtext(c, r); if(/^lrn\b/i.test(t) || /learner'?s?\s*name|name\s*of\s*(the\s*)?learner|^names?\s*of\s*personnel|^name\s*\(last/i.test(t)){ hr = r; break; } }
  if(!hr) return null;
  const map = {};
  for(let c=1; c<=sh.maxC; c++){
    const txt = [0,1,2].map(k => sh.master(c, hr+k)).filter(m => m.c===c).map(m => sh.mtext(m.c, m.r)).join(' ');
    const head = sh.mtext(c, hr);
    if(sh.master(c, hr).c === c && /name/i.test(head) && /last\s*name.*first\s*name|name\s*\(\s*last/i.test(head) && !/father|mother|guardian/i.test(head)){ if(!map.name) map.name = c; continue; }
    for(const [k, re] of Object.entries(COLS)){ if(map[k]) continue; const src = k==='name' ? head : (txt || head);
      if(k==='name' && (/father|mother|guardian|school|adviser|parent/i.test(src) || !re.test(src))) continue;
      if(re.test(src) && sh.master(c, hr).c === c){ map[k] = c; break; } }
  }
  // one combined "NAME (Last Name, First Name, Middle Name)" column
  if(map.last && map.first && map.last === map.first){ map.name = map.last; delete map.last; delete map.first; delete map.middle; }
  if(map.middle && (map.middle === map.name || map.middle === map.last)) delete map.middle;
  if(map.last && map.first) delete map.name;
  const nameCol = map.name || map.last; if(!nameCol) return null;
  // first data row = first row under the header where the name column is empty
  let start = hr + 1; while(start <= hr + 4){ const t = sh.mtext(nameCol, start); const m = sh.master(nameCol, start); if((!t || /^(male|boys?)$/i.test(t)) && m.r === start) break; start++; }
  return {hr, start, map, nameCol};
}
function fillLearners(sh, tbl, people, write){
  const males = people.filter(p => p.sex==='M'), females = people.filter(p => p.sex!=='M');
  const hasMarkers = [...Array(Math.min(sh.maxR - tbl.start + 1, 400)).keys()].some(i => /female|girls/i.test([1,2,3,tbl.nameCol].map(c=>sh.mtext(c, tbl.start+i)).join(' ')));
  let q = males, mode = 'M', r = tbl.start, guard = 0, placed = [];
  const nextQueue = () => { if(mode==='M'){ mode='F'; q = females; return true; } return false; };
  while((males.length || females.length) && guard++ < 600){
    const rowText = [1,2,3,tbl.nameCol].map(c => sh.mtext(c, r)).join(' ');
    if(/female|girls/i.test(rowText)){ if(mode==='M'){ while(males.length) placed.push(writeRow(sh, tbl, males.shift(), r++, write)); } mode='F'; q = females; r++; continue; }
    if(/total|prepared|certified|summary|legend/i.test(rowText)){ if(mode==='M' && hasMarkers){ r++; nextQueue(); continue; } if(mode==='F' || !hasMarkers){ if(!q.length) break; } r++; continue; }
    if(sh.master(tbl.nameCol, r).r !== r){ r++; continue; }
    if(!sh.isEmpty(tbl.nameCol, r)){ r++; continue; }
    if(!q.length){ if(!hasMarkers && nextQueue() && q.length){ continue; } if(mode==='M' && hasMarkers){ r++; continue; } break; }
    placed.push(writeRow(sh, tbl, q.shift(), r, write)); r++;
  }
  return placed.filter(Boolean);
}
function writeRow(sh, tbl, p, r, write){
  const m = tbl.map; const set = (k, v) => { if(m[k]) sh.set(m[k], r, v); };
  set('lrn', p.lrn || ''); set('name', p.name); set('last', p.last); set('first', p.first); set('middle', p.middle);
  set('sex', p.sex); set('bday', p.bday); set('age', p.age==='' ? '' : +p.age || p.age);
  if(write) write(set, p, r);
  sh.filled.push({cell: ref(tbl.nameCol, r), label:'Learner', value: p.name});
  return {p, r};
}

/* ---------------- per-form fillers ---------------- */
const FORMS = {
  SF2: {needs:['month'], fill(sh, X){
    fillLabels(sh, X.head, LABELS); fillSignatures(sh, X.head);
    const D = X.D; if(!D) return 'Link this class to an attendance section first.';
    const tbl = findTable(sh); if(!tbl) return 'No learner table (LRN/NAME header) found.';
    // day columns: the "(1st row for date…)" block
    let dayCols = [], dateRow = 0;
    sh.each((c, r, t) => { if(!dateRow && /1st\s*row\s*for\s*date|row\s*for\s*date/i.test(t)){ const m = sh.master(c, r).m; const c1 = m ? m.c1 : c, c2 = m ? m.c2 : c; dateRow = (m ? m.r2 : r) + 1; for(let x=c1; x<=c2; x++) if(sh.master(x, dateRow).c === x) dayCols.push(x); } });
    if(dateRow){ D.days.forEach((d, i) => { if(dayCols[i]){ sh.set(dayCols[i], dateRow, +d.slice(8), i===0?'Class dates':''); sh.set(dayCols[i], dateRow+1, ['S','M','T','W','TH','F','S'][M.parse(d).getDay()]); } }); }
    const placed = fillLearners(sh, tbl, X.learners.filter(p => p.att), (set, p, r) => {
      const a = p.att; if(!a) return;
      if(dateRow) a.marks.forEach((v, i) => { if(dayCols[i] && (v==='A'||v==='E'||v==='L')) sh.set(dayCols[i], r, v==='L' ? 'T' : 'x'); });
      set('absent', a.abs); set('tardy', a.tardy); set('remarks', a.remark || p.remarks);
    });
    // per-day totals + summary box
    const sm = D.sx.M, sf = D.sx.F, T = (a,b) => (+a||0)+(+b||0);
    const lastLearnerRow = Math.max(tbl.start, ...placed.map(x => x.r));
    sh.each((c, r, t) => {
      if(r <= lastLearnerRow && !/total\s*per\s*day/i.test(t)) return;
      if(dateRow && /total\s*per\s*day/i.test(t)){ const arr = /\bfemale\b/i.test(t) ? D.daily.F : /\bmale\b/i.test(t) ? D.daily.M : D.daily.T; arr.forEach((v,i) => { if(dayCols[i]) sh.set(dayCols[i], r, v); }); }
      const box = (vals, label) => { const cs = sh.rightCells(c, r, vals.length); cs.forEach((x,i) => sh.set(x.c, x.r, vals[i], i===0?label:'')); };
      if(/enrol(l)?ment\s*as\s*of/i.test(t)) box([sm.june, sf.june, T(sm.june,sf.june)], 'Enrolment (June)');
      else if(/late\s*enrol/i.test(t)) box([D.lateEnrol.M, D.lateEnrol.F, D.lateEnrol.M+D.lateEnrol.F], 'Late enrolment');
      else if(/registered\s*learners?/i.test(t)) box([sm.reg, sf.reg, sm.reg+sf.reg], 'Registered learners');
      else if(/percentage\s*of\s*enrol/i.test(t)) box([sm.june?+(sm.reg/sm.june*100).toFixed(2):'', sf.june?+(sf.reg/sf.june*100).toFixed(2):'', T(sm.june,sf.june)?+((sm.reg+sf.reg)/T(sm.june,sf.june)*100).toFixed(2):''], '% enrolment');
      else if(/average\s*daily\s*attendance/i.test(t)) box([+sm.ada.toFixed(2), +sf.ada.toFixed(2), +(sm.ada+sf.ada).toFixed(2)], 'ADA');
      else if(/percentage\s*of\s*attendance/i.test(t)) box([sm.reg?+(sm.ada/sm.reg*100).toFixed(2):'', sf.reg?+(sf.ada/sf.reg*100).toFixed(2):'', (sm.reg+sf.reg)?+((sm.ada+sf.ada)/(sm.reg+sf.reg)*100).toFixed(2):''], '% attendance');
      else if(/5\s*consecutive/i.test(t)) box([D.cons5n.M, D.cons5n.F, D.cons5n.M+D.cons5n.F], '5 consecutive absences');
      else if(/^drop\s*out/i.test(t)) box([D.dropped.M, D.dropped.F, D.dropped.M+D.dropped.F], 'Drop out');
      else if(/^transferred\s*out/i.test(t)) box([D.transOut.M, D.transOut.F, D.transOut.M+D.transOut.F], 'Transferred out');
      else if(/^transferred\s*in/i.test(t)) box([D.transIn.M, D.transIn.F, D.transIn.M+D.transIn.F], 'Transferred in');
      else if(/no\.?\s*of\s*days\s*of\s*classes/i.test(t)){ if(/_{2,}|:$/.test(t) || true){ const x = sh.rightOf(c, r); if(x) sh.set(x.c, x.r, D.days.length, 'Days of classes'); } }
    });
    return `${placed.length} learner(s), ${D.days.length} class day(s)`;
  }},
  SF3: {fill(sh, X){ fillLabels(sh, X.head, LABELS); fillSignatures(sh, X.head); const tbl = findTable(sh); if(!tbl) return 'No learner table found.'; return fillLearners(sh, tbl, X.learners).length + ' learner(s)'; }},
  SF4: {needs:['month'], fill(sh, X){
    fillLabels(sh, X.head, LABELS); fillSignatures(sh, X.head);
    let gc = 0, gr = 0; sh.each((c, r, t) => { if(!gc && /grade\s*\/?\s*(year)?\s*level/i.test(t) && t.length < 30){ gc = c; gr = sh.master(c, r).m ? sh.master(c, r).m.r2 : r; } });
    if(!gc) return 'No GRADE/YEAR LEVEL column found.';
    let r = gr + 1; while(r < gr + 6 && !sh.isEmpty(gc, r)) r++;
    const secs = X.sections || (X.sec ? [X.sec] : []); if(!secs.length) return 'No attendance section to report.';
    const [y,m] = X.month.split('-').map(Number); const prevEnd = M.iso(new Date(y, m-1, 0));
    secs.forEach(sec => {
      const D = M.sf2Data(sec, X.month); const cl = M.S.classes.find(x => x.id === sec.classId); const st = Object.values(sec.students);
      const cum = (k, v, f, upto, sx) => st.filter(x => x.sex===sx && x[k]===v && x[f] && x[f] <= upto).length;
      const mv = (k, v, f) => { const a = ['M','F'].map(sx => cum(k,v,f,prevEnd,sx)), ab = ['M','F'].map(sx => cum(k,v,f,D.mEnd,sx)); const b = [ab[0]-a[0], ab[1]-a[1]]; return [a[0],a[1],a[0]+a[1], b[0],b[1],b[0]+b[1], ab[0],ab[1],ab[0]+ab[1]]; };
      const sm = D.sx.M, sf = D.sx.F; const pc = (a,b) => b ? +(a/b*100).toFixed(2) : '';
      const vals = [(sec.sf2&&sec.sf2.grade)||(cl?String(cl.grade):''), sec.name, (sec.sf2&&sec.sf2.adviser)||(cl?cl.adviser:''), sm.reg, sf.reg, sm.reg+sf.reg,
        +sm.ada.toFixed(2), +sf.ada.toFixed(2), +(sm.ada+sf.ada).toFixed(2), pc(sm.ada,sm.reg), pc(sf.ada,sf.reg), pc(sm.ada+sf.ada, sm.reg+sf.reg),
        ...mv('outType','dropped','outDate'), ...mv('outType','transferred','outDate'), ...mv('inType','transferred','inDate')];
      let c = gc; vals.forEach((v, i) => { const mm = sh.master(c, r); sh.set(mm.c, r, v, i===0 ? 'Section row: '+sec.name : ''); c = (mm.m ? mm.m.c2 : c) + 1; });
      r++;
    });
    return `${secs.length} section row(s)`;
  }},
  SF5: {fill(sh, X){
    fillLabels(sh, X.head, LABELS); fillSignatures(sh, X.head);
    const tbl = findTable(sh); let n = 0;
    if(tbl) n = fillLearners(sh, tbl, X.learners, (set, p) => { set('ga', isNum(p.ga) ? p.ga : ''); set('action', p.action); set('remarks', p.remarks); }).length;
    const cnt = (fn) => { const M_ = X.learners.filter(p => p.sex==='M' && fn(p)).length, F_ = X.learners.filter(p => p.sex!=='M' && fn(p)).length; return [M_, F_, M_+F_]; };
    const ga = (p) => isNum(p.ga) ? p.ga : null;
    const band = (lo, hi) => (p) => ga(p)!==null && ga(p) >= lo && ga(p) <= hi;
    const rules = [[/^promoted/i, p => p.action==='PROMOTED'], [/^(conditional|irregular)/i, p => p.action==='CONDITIONAL'], [/^retained/i, p => p.action==='RETAINED'],
      [/^advanc(ing|ed)\b/i, band(90,100)], [/^benchmarking/i, band(80,89.99)], [/^connecting/i, band(75,79.99)], [/^developing/i, band(65,74.99)], [/^emerging/i, band(0,64.99)],
      [/^proficient/i, band(85,89.99)], [/^approaching/i, band(80,84.99)], [/^beginning/i, band(0,74.99)]];
    sh.each((c, r, t) => {
      if(t.length > 70 || (tbl && r <= tbl.hr)) return;
      const hit = rules.find(([re]) => re.test(t)); if(!hit) return;
      let fn = hit[1];
      // a range written in the label wins, e.g. "DEVELOPING (D: 75%-79%)" or "BEGINNING (B: 74% and below)"
      const rg = t.match(/(\d{2,3})\s*%?\s*[-–]\s*(\d{2,3})/), below = t.match(/(\d{2,3})\s*%?\s*(and|&)\s*below/i), above = t.match(/(\d{2,3})\s*%?\s*(and|&)\s*above/i);
      if(rg) fn = band(+rg[1], +rg[2] + .99); else if(below) fn = band(0, +below[1] + .99); else if(above) fn = band(+above[1], 100);
      const cs = sh.rightCells(c, r, 3); const v = cnt(fn); cs.forEach((x,i) => sh.set(x.c, x.r, v[i], i===0 ? t.slice(0,30) : ''));
    });
    return `${n} learner(s) with general average and action taken`;
  }},
  SF6: {fill(sh, X){ return FORMS.SF5.fill(sh, Object.assign({}, X, {learners: X.learners})); }},
  SF7: {fill(sh, X){ fillLabels(sh, X.head, LABELS); fillSignatures(sh, X.head); const tbl = findTable(sh); if(!tbl) return 'Headers filled (no personnel table found).';
    const ppl = [{name:X.head.schoolHead, sex:'', pos:X.s.headTitle||'School Head'}, {name:X.head.adviser, sex:'', pos:'Teacher / Class Adviser'}];
    let r = tbl.start; ppl.forEach(p => { while(!sh.isEmpty(tbl.nameCol, r) && r < tbl.start + 50) r++; sh.set(tbl.nameCol, r, p.name, 'Personnel'); if(tbl.map.position) sh.set(tbl.map.position, r, p.pos); r++; }); return '2 personnel rows (school head, adviser)'; }},
  SF8: {fill(sh, X){ fillLabels(sh, X.head, LABELS); fillSignatures(sh, X.head); const tbl = findTable(sh); if(!tbl) return 'No learner table found.'; return fillLearners(sh, tbl, X.learners).length + ' learner(s) (height/weight left for you)'; }},
  SF10: {perLearner:true, fill(sh, X, p){
    fillLabels(sh, X.head, LABELS); fillSignatures(sh, X.head);
    fillLabels(sh, {last:p.last, first:p.first, middle:p.middle, lrn:p.lrn, bday:p.bday, sexWord: p.sex==='M'?'Male':p.sex==='F'?'Female':'', age:p.age}, PERSON_LABELS.map(([re,k]) => [re,k,k]));
    // scholastic record: subject rows under "LEARNING AREAS", term columns 1/2/3, FINAL RATING, REMARKS
    let la = null; sh.each((c, r, t) => { if(!la && /^learning\s*areas?$/i.test(t)) la = {c, r}; });
    if(!la) return 'Learner info filled (no LEARNING AREAS table found).';
    const hdrRows = [la.r, la.r+1, la.r+2]; const tc = {}; let fc = 0, rc = 0;
    for(let c = la.c+1; c <= sh.maxC; c++) hdrRows.forEach(r => { const t = sh.mtext(c, r); const mm = sh.master(c, r); if(mm.c !== c) return;
      if(/^[1-4]$/.test(t) && !tc[t]) tc[t] = c; if(/final\s*(rating|grade)/i.test(t) && !fc) fc = c; if(/^remarks?$/i.test(t) && !rc) rc = c; });
    const subj = [[/^filipino/i,'Filipino'],[/^english/i,'English'],[/^math/i,'Mathematics'],[/^science/i,'Science'],[/^araling/i,'Araling Panlipunan'],[/pagpapakatao|values|^esp|gmrc/i,'Values Education'],[/^(tle|technology|epp)/i,'TLE'],[/^mapeh/i,'MAPEH'],[/^music|music\s*(and|&)\s*arts/i,'Music & Arts'],[/^(physical|pe\b|p\.e\.)/i,'PE & Health']];
    let rows = 0;
    for(let r = la.r+1; r <= Math.min(sh.maxR, la.r+30); r++){
      const t = sh.mtext(la.c, r); if(!t) continue;
      if(/general\s*average/i.test(t)){ if(fc && isNum(p.sd.ga)) sh.set(fc, r, p.sd.ga, 'General average'); if(rc && p.sd.gaRem) sh.set(rc, r, p.sd.gaRem); break; }
      const hit = subj.find(([re]) => re.test(t)); if(!hit) continue;
      const row = p.sd.subj.find(x => x.key === hit[1]); if(!row) continue;
      ['1','2','3'].forEach((q,i) => { if(tc[q] && isNum(row.t[i])) sh.set(tc[q], r, M.r2(row.t[i])); });
      if(fc && isNum(row.fin)) sh.set(fc, r, row.fin); if(rc && row.rem) sh.set(rc, r, row.rem);
      rows++; sh.filled.push({cell: ref(la.c, r), label:'Grades', value: hit[1]});
    }
    return `${rows} learning area row(s)`;
  }}
};
M.TPL_FORMS = Object.keys(FORMS);

/* ---------------- workbook plumbing ---------------- */
async function openTemplate(buf){
  await M.loadScript('vendor/jszip.min.js');
  const zip = await JSZip.loadAsync(buf);
  const P = new DOMParser();
  const read = async (p) => zip.file(p) ? P.parseFromString(await zip.file(p).async('string'), 'application/xml') : null;
  const wb = await read('xl/workbook.xml'); if(!wb) throw new Error('This is not an .xlsx file. Open it in Excel and “Save As” .xlsx first.');
  const rels = await read('xl/_rels/workbook.xml.rels'), ct = await read('[Content_Types].xml');
  const sstDoc = await read('xl/sharedStrings.xml');
  const sst = sstDoc ? [...sstDoc.getElementsByTagNameNS(NS,'si')].map(si => [...si.getElementsByTagNameNS(NS,'t')].map(t=>t.textContent).join('')) : [];
  const relEls = [...rels.getElementsByTagName('Relationship')];
  const sheets = [...wb.getElementsByTagNameNS(NS,'sheet')].map(el => { const t = relEls.find(r => r.getAttribute('Id') === el.getAttributeNS(RNS,'id')).getAttribute('Target'); return {el, name:el.getAttribute('name'), path: t.startsWith('/') ? t.slice(1) : 'xl/'+t}; });
  return {zip, P, wb, rels, ct, sst, sheets, relEls};
}
function dropCalcChain(T){
  T.relEls.filter(r => /\/(calcChain|externalLink)$/.test(r.getAttribute('Type'))).forEach(r => { const t = r.getAttribute('Target'); T.zip.remove(t.startsWith('/')?t.slice(1):'xl/'+t); r.parentNode.removeChild(r); });
  Object.keys(T.zip.files).filter(p => p.startsWith('xl/externalLinks/')).forEach(p => T.zip.remove(p));
  [...T.ct.getElementsByTagName('Override')].filter(o => /externalLinks\/|calcChain/.test(o.getAttribute('PartName'))).forEach(o => o.parentNode.removeChild(o));
  [...T.wb.getElementsByTagNameNS(NS,'externalReferences')].forEach(e => e.parentNode.removeChild(e));
  // force Excel to recalculate remaining formulas on open
  let cp = T.wb.getElementsByTagNameNS(NS,'calcPr')[0]; if(cp) cp.setAttribute('fullCalcOnLoad','1');
}
async function finish(T, filename){
  const X = new XMLSerializer();
  T.zip.file('xl/workbook.xml', X.serializeToString(T.wb));
  T.zip.file('xl/_rels/workbook.xml.rels', X.serializeToString(T.rels));
  T.zip.file('[Content_Types].xml', X.serializeToString(T.ct));
  const blob = await T.zip.generateAsync({type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  M.downloadBlob(blob, filename);
}
M.fillTemplate = async function(code, file, opts){
  const F = FORMS[code]; const c = M.cls();
  const X = context(c, opts); X.sections = opts.sections;
  const T = await openTemplate(await file.arrayBuffer());
  const Xs = new XMLSerializer(); const report = [];
  if(!F.perLearner){
    for(const sht of T.sheets){
      const doc = T.P.parseFromString(await T.zip.file(sht.path).async('string'), 'application/xml');
      const sh = new Sheet(doc, T.sst); const note = F.fill(sh, X);
      if(sh.filled.length){ T.zip.file(sht.path, Xs.serializeToString(doc)); report.push({sheet: sht.name, note, filled: sh.filled}); }
    }
    dropCalcChain(T);
  } else {
    // one copy of every template sheet per learner
    const people = (opts.only ? X.learners.filter(p => p.l.id === opts.only) : X.learners.filter(p => M.counted(p.l)));
    const srcs = []; for(const sht of T.sheets) srcs.push({sht, xml: await T.zip.file(sht.path).async('string')});
    const areas = {}; [...T.wb.getElementsByTagNameNS(NS,'definedName')].forEach(d => { if(d.getAttribute('name')==='_xlnm.Print_Area') areas[+d.getAttribute('localSheetId')] = d.textContent.split('!').pop(); });
    T.relEls.filter(r => /\/worksheet$/.test(r.getAttribute('Type'))).forEach(r => { const t = r.getAttribute('Target'); T.zip.remove(t.startsWith('/')?t.slice(1):'xl/'+t); r.parentNode.removeChild(r); });
    [...T.ct.getElementsByTagName('Override')].filter(o => /worksheets\//.test(o.getAttribute('PartName'))).forEach(o => o.parentNode.removeChild(o));
    dropCalcChain(T);
    const sheetsNode = T.wb.getElementsByTagNameNS(NS,'sheets')[0]; while(sheetsNode.firstChild) sheetsNode.removeChild(sheetsNode.firstChild);
    let dns = T.wb.getElementsByTagNameNS(NS,'definedNames')[0]; if(dns) while(dns.firstChild) dns.removeChild(dns.firstChild); else { dns = T.wb.createElementNS(NS,'definedNames'); sheetsNode.parentNode.insertBefore(dns, sheetsNode.nextSibling); }
    let k = 0; const used = new Set();
    people.forEach((p, i) => srcs.forEach((src, si) => {
      const doc = T.P.parseFromString(src.xml, 'application/xml'); const sh = new Sheet(doc, T.sst);
      const note = F.fill(sh, X, p); k++;
      [...doc.getElementsByTagNameNS(NS,'sheetView')].forEach(v => { if(k>1) v.removeAttribute('tabSelected'); });
      let name = `${String(i+1).padStart(2,'0')} ${p.last}${srcs.length>1?' '+(si+1):''}`.replace(/[\[\]:*?\/\\']/g,'').slice(0,30); while(used.has(name)) name = name.slice(0,29)+'_'; used.add(name);
      T.zip.file(`xl/worksheets/sheet${k}.xml`, Xs.serializeToString(doc));
      const r = T.rels.createElementNS(T.rels.documentElement.namespaceURI,'Relationship'); r.setAttribute('Id','rIdF'+k); r.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'); r.setAttribute('Target',`worksheets/sheet${k}.xml`); T.rels.documentElement.appendChild(r);
      const o = T.ct.createElementNS(T.ct.documentElement.namespaceURI,'Override'); o.setAttribute('PartName',`/xl/worksheets/sheet${k}.xml`); o.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'); T.ct.documentElement.appendChild(o);
      const se = T.wb.createElementNS(NS,'sheet'); se.setAttribute('name', name); se.setAttribute('sheetId', k); se.setAttributeNS(RNS,'r:id','rIdF'+k); sheetsNode.appendChild(se);
      if(areas[si]){ const dn = T.wb.createElementNS(NS,'definedName'); dn.setAttribute('name','_xlnm.Print_Area'); dn.setAttribute('localSheetId', k-1); dn.textContent = `'${name}'!${areas[si]}`; dns.appendChild(dn); }
      if(si===0) report.push({sheet: name, note, filled: sh.filled});
    }));
    if(!dns.firstChild) dns.parentNode.removeChild(dns);
    if(T.zip.file('docProps/app.xml')) T.zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>');
  }
  const fname = `${code} ${c.grade}-${c.section}${opts.month && FORMS[code].needs ? ' '+opts.month : ''} (filled).xlsx`;
  await finish(T, fname);
  return {report, fname};
};

/* ---------------- UI card used on the Forms pages ---------------- */
M.templateCard = async function(el, f){
  const docs = (await M.docsAll().catch(()=>[])).filter(d => d.formCode===f.code && d.isTemplate && d.blob).sort((a,b)=>b.added.localeCompare(a.added));
  const tpl = docs[0]; const F = FORMS[f.code]; const c = M.cls();
  const secs = (M.S.att && M.S.att.sections) || [];
  el.innerHTML = `<div class="card tpl-card"><div class="row"><h2 style="margin:0">${f.code} template → auto-fill</h2><span class="spacer"></span>${tpl?`<span class="chip green">${esc(tpl.name)}</span>`:''}</div>
    <p class="small muted">Upload your blank ${f.code} template (.xlsx). MASTRO reads its labels and fills ${F.perLearner?'one copy per learner with name, LRN, birthdate and term grades':'the headers (school, ID, region, division, SY, grade, section, adviser, school head), the learner list'}${f.code==='SF2'?', the daily marks, totals and the monthly summary':f.code==='SF4'?', and one row per section with registered learners, ADA, % attendance, drop-outs and transfers':f.code==='SF5'||f.code==='SF6'?', general averages, action taken and the summary counts':''} — keeping your template’s formatting.</p>
    <div class="row">
      <button class="btn sm" id="tplUp">${ico('upload')} ${tpl?'Replace':'Upload'} template</button>
      ${F.needs && F.needs.includes('month') ? `<label class="field" style="flex-direction:row;align-items:center;gap:8px">Month<input type="month" class="input" id="tplM" value="${M.today().slice(0,7)}" style="width:auto"></label>`:''}
      ${f.code==='SF4' ? `<div class="chips">${secs.map(x=>`<label class="chip" style="cursor:pointer"><input type="checkbox" data-tsec="${x.id}" ${x.classId===c.id?'checked':''}> ${esc(x.name)}</label>`).join('')}</div>`:''}
      ${F.perLearner ? `<select class="input" id="tplL" style="width:auto"><option value="">All learners (${c.learners.filter(M.counted).length})</option>${M.sortedLearners(c).map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select>`:''}
      <span class="spacer"></span>
      <button class="btn primary" id="tplGo" ${tpl?'':'disabled'}>${ico('download')} Fill & download</button>
    </div>
    <input type="file" id="tplFile" accept=".xlsx" hidden>
    <div id="tplRep"></div></div>`;
  $('#tplUp', el).onclick = () => $('#tplFile', el).click();
  $('#tplFile', el).onchange = async e => { const file = e.target.files[0]; e.target.value=''; if(!file) return;
    if(!/\.xlsx$/i.test(file.name)) return alert('Please use an .xlsx file (in Excel: File → Save As → Excel Workbook .xlsx).');
    for(const d of docs) await M.docDel(d.id);
    await M.docPut({id:M.uid('d'), name:file.name, category:'School Forms', formCode:f.code, isTemplate:true, tags:`${f.code}, template`, classId:'', notes:'Template', mime:file.type, size:file.size, added:new Date().toISOString(), blob:file});
    M.toast('Template saved'); M.templateCard(el, f); };
  $('#tplGo', el).onclick = async () => {
    const btn = $('#tplGo', el); btn.disabled = true; btn.textContent = 'Filling…';
    try {
      const opts = {month: $('#tplM', el) ? $('#tplM', el).value : undefined, only: $('#tplL', el) ? $('#tplL', el).value : ''};
      if(f.code==='SF4') opts.sections = $$('[data-tsec]:checked', el).map(x => secs.find(s => s.id===x.dataset.tsec)).filter(Boolean);
      const {report} = await M.fillTemplate(f.code, tpl.blob, opts);
      const total = report.reduce((a,r)=>a+r.filled.length, 0);
      $('#tplRep', el).innerHTML = `<div class="tpl-rep"><b>${total} cell(s) filled</b> — ${report.map(r => `${esc(r.sheet)}: ${esc(r.note||'')}`).join(' · ') || 'nothing matched; check that the template has labels like “School ID”, “Section”, “LRN”, “NAME”.'}
        <details style="margin-top:8px"><summary class="small">Show what was filled</summary><div class="table-wrap" style="max-height:260px;margin-top:8px"><table><thead><tr><th>Sheet</th><th>Cell</th><th>Field</th><th>Value</th></tr></thead><tbody>${report.flatMap(r => r.filled.filter(x=>x.label).slice(0,400).map(x => `<tr><td>${esc(r.sheet)}</td><td>${x.cell}</td><td>${esc(x.label)}</td><td>${esc(x.value)}</td></tr>`)).join('')}</tbody></table></div></details></div>`;
      M.toast('Filled template downloaded');
    } catch(e){ console.error(e); alert('Could not fill the template: ' + e.message); }
    btn.disabled = false; btn.innerHTML = `${ico('download')} Fill & download`;
  };
};
})();
