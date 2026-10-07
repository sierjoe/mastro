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
    if(this.isEmpty(x, r)){
      if(!mm.m){ const nx = this.master(x+1, r); if(nx.m && nx.r === r && nx.c === x+1 && this.isEmpty(x+1, r)) return {c:nx.c, r:nx.r}; }
      return {c:mm.c, r:mm.r};
    }
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
function fillLabels(sh, values, rules, r1, r2){
  sh.each((c, r, t) => {
    if(t.length > 60) return;
    if((r1 && r < r1) || (r2 && r > r2)) return;
    if(sh.master(c, r).c !== c || sh.master(c, r).r !== r) return;
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
  SF10: {perLearner:true, paper:'8.5 × 13 in', fill(sh, X, p){
    const find = (re, r1=1, r2=sh.maxR) => { let hit = null; sh.each((c, r, t) => { if(r < r1 || r > r2) return; if(re.test(t) && (!hit || r < hit.r || (r===hit.r && c < hit.c))) hit = {c, r}; }); return hit; };
    const all = (re) => { const out = []; sh.each((c, r, t) => { if(re.test(t)) out.push({c, r}); }); return out.sort((a,b)=>a.r-b.r||a.c-b.c); };
    // 1) learner's information — only the rows above "SCHOLASTIC RECORD" (never the elementary-school boxes)
    const scho = find(/^scholastic\s*record/i); const elig = find(/eligibility/i);
    const infoEnd = elig ? elig.r - 1 : scho ? scho.r - 1 : 12;
    const ext = (p.name.match(/\b(JR\.?|SR\.?|II|III|IV)\b/i)||[])[0] || '';
    fillLabels(sh, {last:p.last, first:p.first.replace(/\b(JR\.?|SR\.?|II|III|IV)\b/i,'').trim(), middle:p.middle, lrn:p.lrn, bday:p.bday, sexWord: p.sex==='M'?'MALE':p.sex==='F'?'FEMALE':'', ext}, [...PERSON_LABELS.map(([re,k]) => [re,k,k]), [/^name\s*ext/i,'ext','Name ext.']], 1, infoEnd);
    // 2) scholastic record blocks: "LEARNING AREAS" rows that have a "Term Rating" header beside them
    const blocks = all(/^learning\s*areas?$/i).filter(b => [b.r, b.r+1].some(r => { for(let c=b.c+1;c<=sh.maxC;c++) if(/term\s*rating|quarterly\s*rating|quarter/i.test(sh.mtext(c, r))) return true; return false; }));
    if(!blocks.length) return 'Learner info filled (no LEARNING AREAS table found).';
    const g = parseInt(X.head.grade, 10); const bi = isFinite(g) ? (((g - 7) % blocks.length) + blocks.length) % blocks.length : 0;
    const la = blocks[bi]; const prevEnd = bi ? blocks[bi-1].r + 1 : (scho ? scho.r : 1);
    // block header ("School:", "School ID:", "District:", "Division:", "Region:", "Classified as Grade:", "Section:", "School Year:", "Name of Adviser/Teacher:")
    let hdr = null; for(let r = la.r - 1; r > prevEnd && r > la.r - 8; r--) if(/^school\s*:?$/i.test(sh.mtext(sh.master(2, r).c, r)) || find(/^school\s*:?$/i, r, r)) { hdr = r; break; }
    // the Region box on SF10 is small: use the short form ("X" for "REGION X - NORTHERN MINDANAO")
    const rs = (String(X.head.region||'').match(/region\s*([ivx]+|\d+[a-z]?)\b/i)||[])[1];
    if(hdr) fillLabels(sh, Object.assign({}, X.head, rs ? {region: rs.toUpperCase()} : {}), LABELS, hdr, la.r - 1);
    const tc = {}; let fc = 0, rc = 0;
    for(let c = la.c+1; c <= sh.maxC; c++) [la.r, la.r+1, la.r+2].forEach(r => { const t = sh.mtext(c, r); const mm = sh.master(c, r); if(mm.c !== c) return;
      if(/^[1-4]$/.test(t) && !tc[t]) tc[t] = c; if(/final\s*(rating|grade)/i.test(t) && !fc) fc = c; if(/^remarks?$/i.test(t) && !rc) rc = c; });
    const subj = [[/^filipino/i,'Filipino'],[/^english/i,'English'],[/^math/i,'Mathematics'],[/^science/i,'Science'],[/^araling/i,'Araling Panlipunan'],[/pagpapakatao|values|^esp|gmrc/i,'Values Education'],[/^(tle|technology|epp)/i,'TLE'],[/^mapeh/i,'MAPEH'],[/^music|music\s*(and|&)\s*arts/i,'Music & Arts'],[/^(physical|pe\b|p\.e\.)/i,'PE & Health']];
    const gaAt = find(/^general\s*average$/i, la.r + 1, la.r + 30); const stop = gaAt ? gaAt.r : la.r + 16;
    let rows = 0;
    for(let r = la.r+1; r < stop; r++){
      const t = sh.mtext(la.c, r); if(!t) continue;
      const hit = subj.find(([re]) => re.test(t)); if(!hit) continue;
      const row = p.sd.subj.find(x => x.key === hit[1]); if(!row) continue;
      ['1','2','3'].forEach((q,i) => { if(tc[q] && isNum(row.t[i])) sh.set(tc[q], r, M.r2(row.t[i])); });
      if(fc && isNum(row.fin)) sh.set(fc, r, row.fin); if(rc && row.rem && !row.sub) sh.set(rc, r, row.rem);
      rows++; sh.filled.push({cell: ref(la.c, r), label:'Grades', value: hit[1]});
    }
    if(gaAt){ if(fc && isNum(p.sd.ga)) sh.set(fc, gaAt.r, p.sd.ga, 'General average'); if(rc && p.sd.gaRem) sh.set(rc, gaAt.r, p.sd.gaRem); }
    // 3) certification
    const cert = find(/i\s*certify/i);
    if(cert){
      const nx = (c, r) => sh.rightOf(c, r, 20);
      let x = nx(cert.c, cert.r); if(x) sh.set(x.c, x.r, [p.first, p.middle, p.last].filter(Boolean).join(' ').toUpperCase(), 'Certification name');
      const wl = find(/^with\s*lrn/i, cert.r, cert.r); if(wl){ x = nx(wl.c, wl.r); if(x) sh.set(x.c, x.r, p.lrn, 'Certification LRN'); }
      const el = find(/eligible\s*for\s*admission/i, cert.r, cert.r); if(el && isNum(p.sd.ga) && p.sd.ga >= 75 && isFinite(g)){ x = nx(el.c, el.r); if(x) sh.set(x.c, x.r, g + 1, 'Eligible for grade'); }
      fillLabels(sh, {school:X.head.school, schoolId:X.head.schoolId, lastSy:X.head.sy}, [[/^name\s*of\s*school/i,'school','School name'], [/^school\s*id/i,'schoolId','School ID'], [/last\s*school\s*year\s*attended/i,'lastSy','Last SY attended']], cert.r, cert.r + 2);
    }
    fillSignatures(sh, X.head);
    return `Grade ${isFinite(g)?g:'?'} block (${bi+1} of ${blocks.length}) · ${rows} learning area row(s)`;
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
async function finish(T){
  const X = new XMLSerializer();
  T.zip.file('xl/workbook.xml', X.serializeToString(T.wb));
  T.zip.file('xl/_rels/workbook.xml.rels', X.serializeToString(T.rels));
  T.zip.file('[Content_Types].xml', X.serializeToString(T.ct));
  return await T.zip.generateAsync({type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

/* ---------------- templates kept per form + the one "currently used" ---------------- */
M.tplList = async (code) => (await M.docsAll().catch(()=>[])).filter(d => d.formCode===code && d.isTemplate && d.blob).sort((a,b)=>b.added.localeCompare(a.added));
// returns the doc in use, or null (= built-in, where the form has one)
M.tplCurrent = async (code, list) => {
  list = list || await M.tplList(code); const id = (M.S.settings.tplCurrent||{})[code];
  if(id === 'builtin') return null;
  return list.find(d => d.id === id) || list[0] || null;
};
M.tplSetCurrent = (code, id) => { M.S.settings.tplCurrent = M.S.settings.tplCurrent || {}; M.S.settings.tplCurrent[code] = id; M.save(); };
M.tplAdd = async (code, file) => {
  const id = M.uid('d');
  await M.docPut({id, name:file.name, category:'School Forms', formCode:code, isTemplate:true, tags:`${code}, template`, classId:'', notes:'Template', mime:file.type, size:file.size, added:new Date().toISOString(), blob:file});
  M.tplSetCurrent(code, id); return id;
};
// list with "Currently used" badge, Use / Delete buttons. builtin = label of a built-in template (SF9) or null
M.tplListHtml = (list, cur, builtin) => `<div class="tpl-list">${builtin ? `<div class="tpl-row ${!cur?'cur':''}"><span class="nm">${esc(builtin)}</span>${!cur?'<span class="badge-cur">Currently used</span>':`<button class="btn sm" data-tuse="builtin">Use this</button>`}</div>`:''}
  ${list.map(d => `<div class="tpl-row ${cur && cur.id===d.id?'cur':''}"><span class="nm" title="${esc(d.name)}">${esc(d.name)}</span><span class="tiny muted">${esc(d.added.slice(0,10))}</span>
    ${cur && cur.id===d.id ? '<span class="badge-cur">Currently used</span>' : `<button class="btn sm" data-tuse="${d.id}">Use this</button>`}<button class="icon-btn" data-tdel="${d.id}" title="Delete template" aria-label="Delete template">✕</button></div>`).join('')}
  ${!list.length && !builtin ? '<div class="empty" style="padding:14px">No template uploaded yet.</div>' : ''}</div>`;
M.tplListBind = (el, code, rerender) => {
  $$('[data-tuse]', el).forEach(b => b.onclick = () => { M.tplSetCurrent(code, b.dataset.tuse); M.toast('Template in use changed'); rerender(); });
  $$('[data-tdel]', el).forEach(b => b.onclick = async () => { if(!confirm('Delete this template from MASTRO?')) return; await M.docDel(b.dataset.tdel); if((M.S.settings.tplCurrent||{})[code] === b.dataset.tdel){ delete M.S.settings.tplCurrent[code]; M.save(); } rerender(); });
};

/* ---------------- fill: one engine for Excel download, on-screen view, print and PDF ---------------- */
async function prepare(code, blob, opts){
  const F = FORMS[code]; const c = M.cls();
  const X = context(c, opts); X.sections = opts.sections;
  const T = await openTemplate(await blob.arrayBuffer());
  const srcs = [];
  for(let i=0;i<T.sheets.length;i++){ const sht = T.sheets[i]; const st = sht.el.getAttribute('state');
    srcs.push({sht, idx:i, xml: await T.zip.file(sht.path).async('string'), area: M.xvPrintArea(T.wb, i), hidden: !!st && st !== 'visible'}); }
  const people = F.perLearner ? (opts.only ? X.learners.filter(p => p.l.id === opts.only) : X.learners.filter(p => M.counted(p.l))) : [null];
  return {F, c, X, T, srcs, people};
}
function fillOne(B, src, p){ const doc = B.T.P.parseFromString(src.xml, 'application/xml'); const sh = new Sheet(doc, B.T.sst); const note = B.F.fill(sh, B.X, p); return {doc, sh, note}; }

// pages to look at / print: [{label, html, paper}]
M.templatePages = async function(code, blob, opts, onStep){
  const B = await prepare(code, blob, opts);
  if(!B.T.styles) B.T.styles = await M.xvBook(B.T.zip);
  const pages = []; const report = [];
  let n = 0;
  for(const p of B.people){
    const filledHere = [];
    for(const src of B.srcs){ if(src.hidden) continue;
      const f = fillOne(B, src, p); filledHere.push({src, ...f}); }
    // class forms: show the sheets that received data (or the first sheet)
    const show = B.F.perLearner ? filledHere : (filledHere.filter(x => x.sh.filled.length).length ? filledHere.filter(x => x.sh.filled.length) : filledHere.slice(0,1));
    for(const x of show){
      if(!x.src.drawings) x.src.drawings = await M.xvDrawings(B.T.zip, x.src.sht.path, x.doc);
      const R = M.xvRender(x.doc, B.T.sst, B.T.styles, x.src.area, {drawings: x.src.drawings});
      pages.push({label: p ? p.name : x.src.sht.name, lid: p ? p.l.id : null, html: R.html, paper: R.paper, W: R.W, H: R.H, k: R.k, margins: R.margins});
      report.push({sheet: p ? p.name : x.src.sht.name, note: x.note, filled: x.sh.filled});
    }
    if(onStep) onStep(++n, B.people.length);
    if(n % 4 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return {pages, report, perLearner: !!B.F.perLearner};
};

// Excel download (one sheet per learner for SF10)
M.fillTemplate = async function(code, blob, opts){
  const B = await prepare(code, blob, opts); const {T, F, c} = B;
  const Xs = new XMLSerializer(); const report = [];
  if(!F.perLearner){
    for(const src of B.srcs){
      const f = fillOne(B, src, null);
      if(f.sh.filled.length){ T.zip.file(src.sht.path, Xs.serializeToString(f.doc)); report.push({sheet: src.sht.name, note: f.note, filled: f.sh.filled}); }
    }
    dropCalcChain(T);
  } else {
    // parts that belong to each template sheet (pictures, check boxes, comments) are copied for every learner
    const ctOver = {}; [...T.ct.getElementsByTagName('Override')].forEach(o => ctOver[o.getAttribute('PartName').slice(1)] = o.getAttribute('ContentType'));
    for(const src of B.srcs){ src.rels = await M.xvRels(T.zip, src.sht.path); src.parts = {};
      for(const r of src.rels){ if(!r.target || !T.zip.file(r.target)) continue; src.parts[r.id] = {r, data: await T.zip.file(r.target).async('string'), sub: await M.xvRels(T.zip, r.target), subRaw: T.zip.file(r.target.replace(/([^\/]+)$/, '_rels/$1.rels')) ? await T.zip.file(r.target.replace(/([^\/]+)$/, '_rels/$1.rels')).async('string') : null}; } }
    const relOf = (path) => path.replace(/([^\/]+)$/, '_rels/$1.rels');
    // remove the template sheets and their parts
    const removePart = (path) => { T.zip.remove(path); T.zip.remove(relOf(path)); [...T.ct.getElementsByTagName('Override')].filter(o => o.getAttribute('PartName') === '/'+path).forEach(o => o.parentNode.removeChild(o)); };
    B.srcs.forEach(src => { Object.values(src.parts).forEach(pt => { if(!/\/(image)$/.test(pt.r.type)) removePart(pt.r.target); }); removePart(src.sht.path); });
    T.relEls.filter(r => /\/worksheet$/.test(r.getAttribute('Type'))).forEach(r => r.parentNode.removeChild(r));
    dropCalcChain(T);
    const sheetsNode = T.wb.getElementsByTagNameNS(NS,'sheets')[0]; while(sheetsNode.firstChild) sheetsNode.removeChild(sheetsNode.firstChild);
    let dns = T.wb.getElementsByTagNameNS(NS,'definedNames')[0]; if(dns) while(dns.firstChild) dns.removeChild(dns.firstChild); else { dns = T.wb.createElementNS(NS,'definedNames'); sheetsNode.parentNode.insertBefore(dns, sheetsNode.nextSibling); }
    let k = 0; const used = new Set();
    const addCt = (path, type) => { if(!type) return; const o = T.ct.createElementNS(T.ct.documentElement.namespaceURI,'Override'); o.setAttribute('PartName','/'+path); o.setAttribute('ContentType', type); T.ct.documentElement.appendChild(o); };
    B.people.forEach((p, i) => B.srcs.forEach((src, si) => {
      const f = fillOne(B, src, p); k++;
      [...f.doc.getElementsByTagNameNS(NS,'sheetView')].forEach(v => { if(k>1) v.removeAttribute('tabSelected'); });
      let name = `${String(i+1).padStart(2,'0')} ${p.last}${B.srcs.length>1?' '+(si+1):''}`.replace(/[\[\]:*?\/\\']/g,'').slice(0,30); while(used.has(name)) name = name.slice(0,29)+'_'; used.add(name);
      // check-box shape ids must be unique per sheet: shift them by 1024 per copy
      const shift = (txt) => txt.replace(/_x0000_s(\d+)/g, (m, n) => '_x0000_s' + (+n + (k-1)*1024)).replace(/shapeId="(\d+)"/g, (m, n) => `shapeId="${+n + (k-1)*1024}"`).replace(/(<o:idmap[^>]*data=")([\d,]+)/g, (m, a, b) => a + b.split(',').map(x => +x + (k-1)).join(','));
      const sheetPath = `xl/worksheets/sheet${k}.xml`;
      T.zip.file(sheetPath, shift(Xs.serializeToString(f.doc)));
      // copy the sheet's own parts
      const relsXml = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'];
      Object.entries(src.parts).forEach(([id, pt]) => {
        if(/\/image$/.test(pt.r.type)){ relsXml.push(`<Relationship Id="${id}" Type="${pt.r.type}" Target="/${pt.r.target}"/>`); return; }
        const np = pt.r.target.replace(/(\.\w+)$/, `_m${k}$1`);
        T.zip.file(np, /vmlDrawing|drawing/.test(pt.r.type) ? shift(pt.data) : pt.data);
        if(pt.subRaw) T.zip.file(relOf(np), pt.subRaw);
        addCt(np, ctOver[pt.r.target]);
        relsXml.push(`<Relationship Id="${id}" Type="${pt.r.type}" Target="/${np}"/>`);
      });
      src.rels.filter(r => !r.target).forEach(() => {});
      relsXml.push('</Relationships>');
      if(Object.keys(src.parts).length) T.zip.file(relOf(sheetPath), relsXml.join(''));
      const r = T.rels.createElementNS(T.rels.documentElement.namespaceURI,'Relationship'); r.setAttribute('Id','rIdF'+k); r.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'); r.setAttribute('Target',`worksheets/sheet${k}.xml`); T.rels.documentElement.appendChild(r);
      addCt(sheetPath, 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
      const se = T.wb.createElementNS(NS,'sheet'); se.setAttribute('name', name); se.setAttribute('sheetId', k); se.setAttributeNS(RNS,'r:id','rIdF'+k); sheetsNode.appendChild(se);
      if(src.area){ const dn = T.wb.createElementNS(NS,'definedName'); dn.setAttribute('name','_xlnm.Print_Area'); dn.setAttribute('localSheetId', k-1); dn.textContent = `'${name}'!${src.area}`; dns.appendChild(dn); }
      if(si===0) report.push({sheet: name, note: f.note, filled: f.sh.filled});
    }));
    if(!dns.firstChild) dns.parentNode.removeChild(dns);
    if(T.zip.file('docProps/app.xml')) T.zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>');
  }
  const only = opts.only && B.people[0] ? ' ' + B.people[0].name : '';
  const fname = `${code} ${c.grade}-${c.section}${opts.month && F.needs ? ' '+opts.month : ''}${only} (filled).xlsx`;
  const blobOut = await finish(T);
  if(!opts.noDownload) M.downloadBlob(blobOut, fname);
  return {report, fname, blob: blobOut};
};

/* ---------------- viewer: pages on screen, print, PDF (template's own paper size) ---------------- */
function progress(text){
  let p = $('#pdfProg'); if(!p){ document.body.insertAdjacentHTML('beforeend', `<div id="pdfProg" class="prog glass"><div class="pt"></div><div class="bar-track"><div class="bar-fill"></div></div></div>`); p = $('#pdfProg'); }
  $('.pt', p).textContent = text || '';
  return { set:(t, f) => { $('.pt', p).textContent = t; $('.bar-fill', p).style.width = (f*100)+'%'; }, done:() => p.remove() };
}
M.xvProgress = progress;
const paperName = (pp) => { const k = pp.map(x => +x.toFixed(2)).join('×'); return ({'8.5×13':'8.5 × 13 in (folio)','8.5×14':'8.5 × 14 in (legal)','8.5×11':'8.5 × 11 in (letter)','8.27×11.69':'A4','11.69×8.27':'A4 landscape','13×8.5':'13 × 8.5 in (folio, landscape)','14×8.5':'8.5 × 14 in landscape'})[k] || `${pp[0]} × ${pp[1]} in`; };
M.xvPaperName = paperName;
M.xvPrintPages = (pages) => M.doPrint(pages.map(p => p.html).join(''), M.xvPageCss(pages[0].paper));
M.xvPdf = async function(pages, filename){
  const pr = progress('Preparing PDF…');
  try {
    await Promise.all([M.loadScript('vendor/html2canvas.min.js'), M.loadScript('vendor/jspdf.umd.min.js')]);
    const {jsPDF} = window.jspdf; const [pw, ph] = pages[0].paper;
    const pdf = new jsPDF({orientation: pw > ph ? 'landscape' : 'portrait', unit:'in', format:[Math.min(pw,ph), Math.max(pw,ph)], compress:true});
    let stage = $('#pdfStage'); if(!stage){ document.body.insertAdjacentHTML('beforeend','<div id="pdfStage" aria-hidden="true"></div>'); stage = $('#pdfStage'); }
    for(let i=0;i<pages.length;i++){
      // capture the sheet at full size (no CSS scaling), then place it on the page at the template's scale
      const pg = pages[i]; stage.innerHTML = pg.html; const sc = $('.xv-scale', stage); sc.style.transform = 'none'; sc.style.position = 'static';
      const target = sc.firstElementChild;
      const canvas = await html2canvas(target, {scale: Math.max(1.5, Math.min(3, 2.4 * pg.k)), backgroundColor:'#ffffff', logging:false, useCORS:true, width: pg.W, height: pg.H, windowWidth: pg.W + 50});
      if(i) pdf.addPage([Math.min(pw,ph), Math.max(pw,ph)], pw > ph ? 'landscape' : 'portrait');
      const [mT, , , mL] = pg.margins;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', mL, mT, pg.W * pg.k / 96, pg.H * pg.k / 96, undefined, 'FAST');
      pr.set(`Rendering page ${i+1} of ${pages.length}…`, (i+1)/pages.length);
    }
    stage.innerHTML = ''; pr.set('Saving PDF…', 1);
    M.downloadBlob(pdf.output('blob'), filename); M.toast('PDF downloaded');
  } catch(e){ console.error(e); alert('Could not make the PDF: ' + e.message); }
  pr.done();
};
// fit pages to the width of the viewer
M.xvFit = (wrap) => {
  const fit = () => { $$('.xvw', wrap).forEach(w => { const p = w.firstElementChild; const pw = p.offsetWidth, ph = p.offsetHeight; const k = Math.min(1, (wrap.clientWidth - 8) / pw);
    w.style.width = (pw*k)+'px'; w.style.height = (ph*k)+'px'; p.style.transform = `scale(${k})`; }); };
  fit(); window.addEventListener('resize', fit); const prev = M.onLeave; M.onLeave = () => { window.removeEventListener('resize', fit); if(prev) prev(); };
};
M.xvShow = (wrap, pages) => { wrap.innerHTML = `<div class="xv-stage">${pages.map(p => `<div class="xvw">${p.html}</div>`).join('')}</div>`; M.xvFit($('.xv-stage', wrap)); };

/* ---------------- UI card used on the Forms pages ---------------- */
const repHtml = (report) => { const total = report.reduce((a,r)=>a+r.filled.length, 0);
  return `<div class="tpl-rep"><b>${total} cell(s) filled</b> — ${report.slice(0,6).map(r => `${esc(r.sheet)}: ${esc(r.note||'')}`).join(' · ')}${report.length>6?` · … (${report.length})`:''}${!total?' — nothing matched; check that the template has labels like “School ID”, “Section”, “LRN”, “NAME”.':''}
  <details style="margin-top:8px"><summary class="small">Show what was filled</summary><div class="table-wrap" style="max-height:260px;margin-top:8px"><table><thead><tr><th>Sheet</th><th>Cell</th><th>Field</th><th>Value</th></tr></thead><tbody>${report.flatMap(r => r.filled.filter(x=>x.label).slice(0,400).map(x => `<tr><td>${esc(r.sheet)}</td><td>${x.cell}</td><td>${esc(x.label)}</td><td>${esc(x.value)}</td></tr>`)).join('')}</tbody></table></div></details></div>`; };
M.templateCard = async function(el, f){
  const list = await M.tplList(f.code); const tpl = await M.tplCurrent(f.code, list); const F = FORMS[f.code]; const c = M.cls();
  const secs = (M.S.att && M.S.att.sections) || [];
  const L = M.sortedLearners(c).filter(M.counted);
  const ui = M.tplUI = (M.tplUI && M.tplUI.code === f.code) ? M.tplUI : {code:f.code, lid:'', view:false};
  el.innerHTML = `<div class="card tpl-card"><div class="row"><h2 style="margin:0">${f.code} template → auto-fill</h2><span class="spacer"></span>${tpl?`<span class="chip green" title="Template currently used">In use: ${esc(tpl.name)}</span>`:'<span class="chip gold">No template yet</span>'}</div>
    <p class="small muted">Upload your blank ${f.code} template (.xlsx). MASTRO reads its labels and fills ${F.perLearner?'one copy per learner with name, LRN, birthdate, the grade-level block (school, grade, section, SY, adviser), term grades, general average and the certification':'the headers (school, ID, region, division, SY, grade, section, adviser, school head), the learner list'}${f.code==='SF2'?', the daily marks, totals and the monthly summary':f.code==='SF4'?', and one row per section with registered learners, ADA, % attendance, drop-outs and transfers':f.code==='SF5'||f.code==='SF6'?', general averages, action taken and the summary counts':''} — keeping your template’s formatting and paper size.</p>
    <div class="row"><b class="small">Your ${f.code} templates</b><span class="spacer"></span><button class="btn sm" id="tplUp">${ico('upload')} Upload template</button></div>
    ${M.tplListHtml(list, tpl, null)}
    <div class="row">
      ${F.needs && F.needs.includes('month') ? `<label class="field" style="flex-direction:row;align-items:center;gap:8px">Month<input type="month" class="input" id="tplM" value="${ui.month || M.today().slice(0,7)}" style="width:auto"></label>`:''}
      ${f.code==='SF4' ? `<div class="chips">${secs.map(x=>`<label class="chip" style="cursor:pointer"><input type="checkbox" data-tsec="${x.id}" ${x.classId===c.id?'checked':''}> ${esc(x.name)}</label>`).join('')}</div>`:''}
      <span class="spacer"></span>
      <button class="btn primary" id="tplView" ${tpl?'':'disabled'}>${ico('eye')} View filled ${F.perLearner?'(per learner)':'form'}</button>
      <button class="btn" id="tplGo" ${tpl?'':'disabled'}>${ico('download')} Excel${F.perLearner?' (all learners)':''}</button>
    </div>
    <input type="file" id="tplFile" accept=".xlsx" hidden>
    <div id="tplRep"></div><div id="tplViewer"></div></div>`;
  const rerender = () => M.templateCard(el, f);
  M.tplListBind(el, f.code, rerender);
  $('#tplUp', el).onclick = () => $('#tplFile', el).click();
  $('#tplFile', el).onchange = async e => { const file = e.target.files[0]; e.target.value=''; if(!file) return;
    if(!/\.xlsx$/i.test(file.name)) return alert('Please use an .xlsx file (in Excel: File → Save As → Excel Workbook .xlsx).');
    await M.tplAdd(f.code, file); M.toast('Template saved — now in use'); rerender(); };
  const opts = (extra) => { const o = {month: $('#tplM', el) ? $('#tplM', el).value : undefined, ...extra};
    if(f.code==='SF4') o.sections = $$('[data-tsec]:checked', el).map(x => secs.find(s => s.id===x.dataset.tsec)).filter(Boolean); ui.month = o.month; return o; };
  $('#tplGo', el).onclick = async () => {
    const btn = $('#tplGo', el); btn.disabled = true; btn.textContent = 'Filling…';
    try { const {report} = await M.fillTemplate(f.code, tpl.blob, opts({})); $('#tplRep', el).innerHTML = repHtml(report); M.toast('Filled template downloaded'); }
    catch(e){ console.error(e); alert('Could not fill the template: ' + e.message); }
    btn.disabled = false; btn.innerHTML = `${ico('download')} Excel${F.perLearner?' (all learners)':''}`;
  };
  $('#tplView', el).onclick = () => { ui.view = true; viewer(); };
  if(ui.view && tpl) viewer();
  async function viewer(){
    const V = $('#tplViewer', el); const T0 = `${f.code} ${c.grade}-${c.section}`;
    if(F.perLearner){
      if(!L.length){ V.innerHTML = '<div class="empty">No learners.</div>'; return; }
      const l = L.find(x => x.id === ui.lid) || L[0]; ui.lid = l.id; const i = L.indexOf(l);
      V.innerHTML = `<div class="row" style="margin-top:16px">
          <button class="icon-btn" id="vPv" ${i?'':'disabled'}>${ico('left','width:18px;height:18px')}</button>
          <select class="input" id="vSel" style="width:auto;max-width:300px">${L.map(x=>`<option value="${x.id}" ${x.id===l.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
          <button class="icon-btn" id="vNx" ${i<L.length-1?'':'disabled'}>${ico('right','width:18px;height:18px')}</button>
          <span class="small muted">${i+1} of ${L.length}</span><span class="spacer"></span>
          <button class="btn sm" id="vP1">${ico('print')} Print</button><button class="btn sm" id="vD1">${ico('pdf')} PDF</button><button class="btn sm" id="vX1">${ico('download')} Excel</button>
          <button class="btn sm primary" id="vPA">${ico('print')} Print all (${L.length})</button><button class="btn sm primary" id="vDA">${ico('pdf')} Bulk PDF</button><button class="btn sm" id="vClose">✕</button></div>
        <div class="chips" id="vInfo" style="margin:10px 0"></div><div id="vPages"><div class="empty">Filling…</div></div>`;
      const go = (id) => { ui.lid = id; viewer(); };
      $('#vPv', V).onclick = () => go(L[i-1].id); $('#vNx', V).onclick = () => go(L[i+1].id); $('#vSel', V).onchange = e => go(e.target.value);
      $('#vClose', V).onclick = () => { ui.view = false; V.innerHTML = ''; };
      const one = await M.templatePages(f.code, tpl.blob, opts({only:l.id}));
      if(!one.pages.length){ $('#vPages', V).innerHTML = '<div class="empty">Nothing to show.</div>'; return; }
      $('#vInfo', V).innerHTML = `<span class="chip green">Template: ${esc(tpl.name)}</span><span class="chip">Paper: ${esc(paperName(one.pages[0].paper))}</span><span class="chip">${one.pages.length} page(s) per learner</span>${one.report[0]&&one.report[0].note?`<span class="chip">${esc(one.report[0].note)}</span>`:''}`;
      M.xvShow($('#vPages', V), one.pages);
      $('#vP1', V).onclick = () => M.xvPrintPages(one.pages);
      $('#vD1', V).onclick = () => M.xvPdf(one.pages, `${f.code} ${l.name}.pdf`);
      $('#vX1', V).onclick = () => M.fillTemplate(f.code, tpl.blob, opts({only:l.id})).then(() => M.toast('Excel downloaded'));
      const allPages = async () => { const pr = progress('Filling…'); try { const r = await M.templatePages(f.code, tpl.blob, opts({}), (n, t) => pr.set(`Filling ${n} of ${t} learners…`, n/t)); return r.pages; } finally { pr.done(); } };
      $('#vPA', V).onclick = async () => M.xvPrintPages(await allPages());
      $('#vDA', V).onclick = async () => { const pg = await allPages(); M.xvPdf(pg, `${T0} (${L.length} learners).pdf`); };
    } else {
      V.innerHTML = `<div class="row" style="margin-top:16px"><b>${esc(T0)}${opts({}).month && F.needs?' · '+esc(M.monthName(opts({}).month)):''}</b><span class="spacer"></span>
        <button class="btn sm" id="vP1">${ico('print')} Print</button><button class="btn sm" id="vD1">${ico('pdf')} PDF</button><button class="btn sm" id="vClose">✕</button></div>
        <div class="chips" id="vInfo" style="margin:10px 0"></div><div id="vPages"><div class="empty">Filling…</div></div>`;
      $('#vClose', V).onclick = () => { ui.view = false; V.innerHTML = ''; };
      const r = await M.templatePages(f.code, tpl.blob, opts({}));
      $('#tplRep', el).innerHTML = repHtml(r.report);
      if(!r.pages.length){ $('#vPages', V).innerHTML = '<div class="empty">Nothing to show.</div>'; return; }
      $('#vInfo', V).innerHTML = `<span class="chip green">Template: ${esc(tpl.name)}</span><span class="chip">Paper: ${esc(paperName(r.pages[0].paper))}</span><span class="chip">${r.pages.length} sheet(s)</span>`;
      M.xvShow($('#vPages', V), r.pages);
      $('#vP1', V).onclick = () => M.xvPrintPages(r.pages);
      $('#vD1', V).onclick = () => M.xvPdf(r.pages, `${T0}.pdf`);
    }
  }
};
})();
