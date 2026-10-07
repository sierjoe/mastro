/* =====================================================================
   MASTRO core — shared helpers, state, grade math, storage, router.
   Every other file adds views to M.views and uses the helpers here.
   Data stays on this device:
     class records, attendance & settings → localStorage ("mastro.v1")
     uploaded documents                   → IndexedDB ("mastro" / "docs")
   ===================================================================== */
(function () {
'use strict';
const M = window.M = { views:{} };

/* ---------------- constants ---------------- */
M.KEY = 'mastro.v1';
M.VERSION = {n:'6.1', date:'2026-10-07', label:'October 7, 2026'};
M.DEV = {name:'Jhon Joemar L. La Victoria', org:'Impalutao Integrated School'};
M.RAW = ['English','Filipino','Science','Mathematics','TLE','Araling Panlipunan','Values Education','Music & Arts','PE & Health'];
M.AREAS = ['English','Filipino','Science','Mathematics','TLE','Araling Panlipunan','Values Education','MAPEH'];
M.SHORT = {'English':'Eng','Filipino':'Fil','Science':'Sci','Mathematics':'Math','TLE':'TLE','Araling Panlipunan':'AP',
  'Values Education':'VE','MAPEH':'MAPEH','Music & Arts':'M&A','PE & Health':'PE&H','GA':'Gen. Ave.'};
M.DESCS = ['Advancing','Benchmarking','Connecting','Developing','Emerging'];
M.DESC_COLOR = {Advancing:'#1f6b4a',Benchmarking:'#4fa77c',Connecting:'#d9b23a',Developing:'#d98a2b',Emerging:'#c55252'};
M.DESC_RANGE = {Advancing:'90–100',Benchmarking:'80–89',Connecting:'75–79',Developing:'65–74',Emerging:'below 65'};
M.PASS = 75;
M.CATS = ['School Forms','Grades & Reports','Letters & Memos','Lesson Materials','Guidance','Others'];
M.DRIVE_DEFAULT = 'https://drive.google.com/drive/folders/1glAdRLV1JGkii-7etoWTu2DKlHWcWFJq?usp=sharing';
M.CHECK_DEFAULT = [
  {id:'bc', label:'Birth Certificate', short:'Birth Cert.'},
  {id:'f137', label:'Old Form 137', short:'Old 137'},
  {id:'sf10', label:'SF10', short:'SF10'},
  {id:'lis', label:'LIS Enrolment', short:'LIS'}
];
M.SY_MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'];
// DepEd SY 2026–2027 (DepEd Order No. 9, s. 2026) + 2026 national holidays — weekdays with no classes
M.CAL_DEFAULT = {start:'2026-06-08', end:'2027-04-08', off:{
  '2026-06-12':'Independence Day','2026-08-21':'Ninoy Aquino Day','2026-08-31':'National Heroes Day',
  '2026-09-10':'Learner wellness break','2026-09-11':'Learner wellness break','2026-09-14':'Learner wellness break','2026-09-15':'Learner wellness break',
  '2026-11-02':'All Souls’ Day','2026-11-30':'Bonifacio Day','2026-12-08':'Immaculate Conception',
  '2026-12-17':'Learner wellness break','2026-12-18':'Learner wellness break',
  '2026-12-21':'Year-end break','2026-12-22':'Year-end break','2026-12-23':'Year-end break','2026-12-24':'Christmas Eve','2026-12-25':'Christmas Day',
  '2026-12-28':'Year-end break','2026-12-29':'Year-end break','2026-12-30':'Rizal Day','2026-12-31':'Last day of the year','2027-01-01':'New Year’s Day',
  '2027-03-25':'Maundy Thursday','2027-03-26':'Good Friday',
  '2027-04-01':'Learner wellness break','2027-04-02':'Learner wellness break','2027-04-05':'Learner wellness break'}};
M.COMMENT_BANK = [
  '{name} participates actively in class discussions and shows genuine interest in learning.',
  '{name} is respectful, cooperative, and works well with classmates.',
  '{name} consistently submits quality outputs on time.',
  '{name} has shown steady improvement this term. Keep up the good work!',
  '{name} demonstrates good reading and communication skills.',
  '{name} is a responsible learner who follows classroom rules and routines.',
  '{name} shows leadership and initiative in group activities.',
  '{name} shows creativity and confidence in performance tasks.',
  '{name} is kind, helpful, and a positive influence on classmates.',
  '{name} has great potential and is encouraged to participate more actively in class.',
  '{name} is encouraged to review lessons regularly at home to improve performance.',
  '{name} needs additional support in some learning areas; home practice is encouraged.',
  '{name} is encouraged to complete and submit all requirements on time.',
  '{name} needs to improve attendance and punctuality to keep up with lessons.',
  'Parents are requested to guide {name} in managing study time and completing assignments at home.'
];

const I = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  grades:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  analysis:'<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
  learners:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
  attendance:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8.5 15.5l2.2 2.2 4.8-4.8"/>',
  forms:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  repo:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  settings:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  items:'<path d="M10 6h10M10 12h10M10 18h10M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  classes:'<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 1h13v-3M8 7h7M8 11h5"/>',
  sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download:'<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  print:'<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  drive:'<path d="M8 3h8l6 10-4 7H6l-4-7zM8 3l6 10M16 3l-6 10M2 13h20"/>',
  qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  left:'<path d="M15 5l-7 7 7 7"/>', right:'<path d="M9 5l7 7-7 7"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  broom:'<path d="M14 3l-4 9M7 12h8l2 9H5z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  assess:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10.5h.01M11 10.5h5M8.5 14.5h.01M11 14.5h5M8 18l1.2 1.2L11.5 17"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  save:'<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v6h8V3M7 21v-7h10v7"/>',
  pdf:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 16v-4h1.5a1.5 1.5 0 0 1 0 3H8M13 12v4h1a2 2 0 0 0 0-4z"/>'
};
M.ico = (n, style='') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${style?`style="${style}"`:''}>${I[n]||''}</svg>`;

M.NAV = [
  {id:'home', label:'Home', icon:'home', eyebrow:'Overview', title:'MASTRO'},
  {id:'attendance', label:'Attendance', icon:'attendance', eyebrow:'SeatCheck · seats, SF2, SF4, cleaning', title:'Attendance'},
  {id:'learners', label:'Learners', icon:'learners', eyebrow:'Roster & credentials checklist', title:'Learners'},
  {id:'grades', label:'Grades', icon:'grades', eyebrow:'Consolidated gradesheet', title:'Grades'},
  {id:'analysis', label:'Analysis', icon:'analysis', eyebrow:'Class analysis tools', title:'Analysis'},
  {id:'assess', label:'Assessments', icon:'assess', eyebrow:'Answer sheets · scan · ECR', title:'Assessments'},
  {id:'items', label:'Item Analysis', icon:'items', eyebrow:'Summative tests & term examinations', title:'Item Analysis'},
  {id:'classes', label:'Classes', icon:'classes', eyebrow:'Electronic class records (ECR)', title:'Classes'},
  {id:'forms', label:'Forms', icon:'forms', eyebrow:'DepEd School Forms SF1–SF10', title:'Forms'},
  {id:'repo', label:'Repository', icon:'repo', eyebrow:'Documents & files', title:'Repository'},
  {id:'settings', label:'Settings', icon:'settings', eyebrow:'School, backup & data', title:'Settings'}
];
M.TABBAR = ['home','attendance','assess','learners'];

/* ---------------- helpers ---------------- */
const $ = M.$ = (s, el = document) => el.querySelector(s);
M.$$ = (s, el = document) => [...el.querySelectorAll(s)];
M.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
M.uid = (p='id') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
M.isNum = (v) => typeof v === 'number' && isFinite(v);
M.r2 = (n) => Math.round(n * 100) / 100;
M.fmt = (n, d = 2) => M.isNum(n) ? n.toFixed(d) : '—';
M.gradeTxt = (n) => M.isNum(n) ? String(M.r2(n)) : '';
M.normName = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
M.initials = (name) => { const [l,f] = String(name).split(','); return f!==undefined ? ((f||'').trim()[0]||'') + ((l||'').trim()[0]||'') : String(name).trim().slice(0,2); };
M.toast = (msg) => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(M.toast._t); M.toast._t=setTimeout(()=>t.classList.remove('show'),2400); };
M.fmtBytes = (b) => { if(!b) return '0 KB'; const u=['B','KB','MB','GB']; let i=0; while(b>=1024&&i<3){b/=1024;i++;} return b.toFixed(i?1:0)+' '+u[i]; };
// local-date helpers (YYYY-MM-DD, never UTC-shifted)
M.iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
M.today = () => M.iso(new Date());
M.parse = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
M.addDays = (s, n) => { const d = M.parse(s); d.setDate(d.getDate()+n); return M.iso(d); };
M.mondayOf = (s) => { const d = M.parse(s); const w = (d.getDay()+6)%7; d.setDate(d.getDate()-w); return M.iso(d); };
M.longDate = (s) => M.parse(s).toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric', year:'numeric'});
M.monthName = (ym) => { const [y,m] = ym.split('-').map(Number); return new Date(y, m-1, 1).toLocaleDateString('en-US',{month:'long', year:'numeric'}); };
M.ageOn = (birthday, onISO) => { if(!birthday) return ''; const b = M.parse(birthday), o = M.parse(onISO||M.today()); let a = o.getFullYear()-b.getFullYear(); if(o.getMonth()<b.getMonth() || (o.getMonth()===b.getMonth() && o.getDate()<b.getDate())) a--; return a>0&&a<100 ? a : ''; };
M.syStart = (sy) => Number((String(sy).match(/\d{4}/)||[new Date().getFullYear()])[0]);
// SY month index (0=Jun … 10=Apr) → "YYYY-MM"
M.syMonthKey = (sy, i) => { const y = M.syStart(sy) + (i >= 7 ? 1 : 0); const m = ((5 + i) % 12) + 1; return `${y}-${String(m).padStart(2,'0')}`; };
M.downloadBlob = (blob, name) => { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 8000); };
M.slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'item';

// resize an uploaded image (logos) so it fits in browser storage
M.shrinkImage = (file, max) => new Promise((res, rej) => {
  const fr = new FileReader(); fr.onerror = rej;
  fr.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => {
    const k = Math.min(1, max / Math.max(im.width, im.height)); const cv = document.createElement('canvas');
    cv.width = Math.round(im.width*k); cv.height = Math.round(im.height*k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    res(cv.toDataURL('image/png')); }; im.src = fr.result; };
  fr.readAsDataURL(file);
});
/* lazy-load a vendor script (works offline once the service worker has cached it) */
const _loaded = {};
M.loadScript = (src) => _loaded[src] || (_loaded[src] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete _loaded[src]; rej(new Error('Could not load '+src)); }; document.head.appendChild(s);
}));

/* ---------------- state ---------------- */
function defaultState(){
  const seed = JSON.parse(JSON.stringify(window.MASTRO_SEED));
  const S = {
    v:2,
    settings:{
      school:'IMPALUTAO INTEGRATED SCHOOL', schoolId:'500246', address:'Impalutao, Impasugong, Bukidnon',
      region:'Region X – Northern Mindanao · Schools Division of Bukidnon',
      regionName:'REGION X – NORTHERN MINDANAO', division:'SCHOOLS DIVISION OF BUKIDNON',
      district:'District of Impasugong I', municipality:'Impasugong, Bukidnon',
      adviser:seed.adviser, head:seed.head, headTitle:'School Head',
      driveUrl:M.DRIVE_DEFAULT, theme:'auto',
      links:[{label:'MASTRO Drive folder', url:M.DRIVE_DEFAULT}],
      checkItems: JSON.parse(JSON.stringify(M.CHECK_DEFAULT)),
      calendar: JSON.parse(JSON.stringify(M.CAL_DEFAULT)),
      myComments: [],
      logos: {deped:'', school:''}
    },
    classes:[seed],
    activeClassId:seed.id,
    att:null,
    ui:{}
  };
  if(window.MASTRO_SEATCHECK) S.att = JSON.parse(JSON.stringify(window.MASTRO_SEATCHECK));
  return S;
}
function migrate(S){
  const d = defaultState();
  S.settings = Object.assign({}, d.settings, S.settings||{});
  if(!Array.isArray(S.settings.checkItems) || !S.settings.checkItems.length) S.settings.checkItems = d.settings.checkItems;
  if(!S.settings.calendar || !S.settings.calendar.off) S.settings.calendar = d.settings.calendar;
  if(!Array.isArray(S.settings.myComments)) S.settings.myComments = [];
  S.ia = Array.isArray(S.ia) ? S.ia : [];
  S.ecr = Array.isArray(S.ecr) ? S.ecr : [];
  S.bow = Array.isArray(S.bow) ? S.bow : [];
  S.asm = Array.isArray(S.asm) ? S.asm : [];
  S.settings.logos = Object.assign({deped:'', school:''}, S.settings.logos||{});
  S.ui = Object.assign({term:'1', subject:'GA', sex:'all', gradesTerm:'1', attTab:'seats', lfilter:'all'}, S.ui||{});
  S.classes.forEach(c => {
    c.grades = c.grades || {'1':{},'2':{},'3':{}};
    c.checklist = c.checklist || {};
    c.sf9 = Object.assign({days:{}, abs:{}, comments:{}, cert:false, layout:'duplex'}, c.sf9||{});
  });
  if(!S.att) S.att = d.att || {sections:[], current:null, school:{id:S.settings.schoolId, name:S.settings.school, year:''}};
  M.normalizeAtt(S.att);
  return S;
}
M.normalizeAtt = (A) => {
  A.sections = A.sections || [];
  A.school = A.school || {};
  A.sections.forEach(s => {
    s.rows = s.rows||5; s.cols = s.cols||8; s.students = s.students||{}; s.att = s.att||{};
    s.seats = s.seats || []; while(s.seats.length < s.rows*s.cols) s.seats.push(null);
    s.clean = s.clean || {tasks:[], weeks:{}, log:[]}; s.clean.tasks = s.clean.tasks||[]; s.clean.weeks = s.clean.weeks||{}; s.clean.log = s.clean.log||[];
    s.sf2 = s.sf2 || {grade:'', section:s.name};
  });
  if(!A.current && A.sections[0]) A.current = A.sections[0].id;
};
M.load = () => {
  let S; try { S = JSON.parse(localStorage.getItem(M.KEY)); } catch(e) { S = null; }
  const fresh = !S || !S.classes;
  if(fresh) S = defaultState();
  M.S = migrate(S);
  M.autoLinkSections();
  if(fresh){ const sec = M.sectionFor(M.cls()); if(sec) M.S.att.current = sec.id; }
  M.save();
};
M.save = () => { try { localStorage.setItem(M.KEY, JSON.stringify(M.S)); } catch(e) { M.toast('Could not save — storage is full'); } };
M.reset = () => { M.S = migrate(defaultState()); M.autoLinkSections(); const sec = M.sectionFor(M.cls()); if(sec) M.S.att.current = sec.id; M.save(); };
M.cls = () => M.S.classes.find(c => c.id === M.S.activeClassId) || M.S.classes[0];
M.className = (c) => `Grade ${c.grade} – ${c.section}`;
M.checkItems = () => M.S.settings.checkItems;

/* ---------------- school calendar ---------------- */
M.cal = () => M.S.settings.calendar;
M.offReason = (d) => (M.cal().off||{})[d] || '';
M.isWeekday = (d) => { const w = M.parse(d).getDay(); return w>0 && w<6; };
M.inSY = (d) => { const c = M.cal(); return (!c.start || d >= c.start) && (!c.end || d <= c.end); };
M.isSchoolDay = (d) => M.isWeekday(d) && M.inSY(d) && !M.offReason(d);
M.weekdaysOfMonth = (ym) => { const [y,m] = ym.split('-').map(Number); const out = []; const d = new Date(y, m-1, 1); while(d.getMonth()===m-1){ const x = M.iso(d); if(M.isWeekday(x) && M.inSY(x)) out.push(x); d.setDate(d.getDate()+1); } return out; };
M.schoolDaysOfMonth = (ym) => M.weekdaysOfMonth(ym).filter(d => !M.offReason(d));
// class days that have already happened (used by SF2 / SF4 / SF9)
M.classDays = (s, ym) => { const t = M.today(); return M.schoolDaysOfMonth(ym).filter(d => d <= t); };
M.firstFridayJune = (sy) => { const d = new Date(M.syStart(sy), 5, 1); while(d.getDay()!==5) d.setDate(d.getDate()+1); return M.iso(d); };

/* ---------------- names ---------------- */
M.splitName = (name) => { const [last, rest=''] = String(name).split(','); const g = rest.trim().split(/\s+/).filter(Boolean); return {last:last.trim(), given:g}; };
// "LAST, FIRST MIDDLE" → "FIRST LAST" (drops the middle name when there are 2+ given names)
M.shortName = (name) => { const {last, given} = M.splitName(name); if(!given.length) return last; const first = given.length > 1 ? given.slice(0,-1) : given; return first.join(' ') + ' ' + last; };
M.firstName = (name) => { const {given} = M.splitName(name); return (given.length > 1 ? given.slice(0,-1) : given).join(' ') || name; };
const _lev = (a,b) => { let p=[...Array(b.length+1).keys()]; for(let i=1;i<=a.length;i++){ const c=[i]; for(let j=1;j<=b.length;j++) c.push(Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]!==b[j-1]))); p=c; } return p[b.length]; };
M.sim = (a,b) => { a = M.normName(a); b = M.normName(b); return 1 - _lev(a,b)/Math.max(a.length,b.length,1); };
// family-name and first-name similarity (0–1); tolerant of a missing middle name on either side
M.nameMatch = (a, b) => {
  const A = M.splitName(a), B = M.splitName(b);
  const variants = (g) => { const v = [g.join(' ')]; if(g.length > 1) v.push(g.slice(0,-1).join(' ')); if(g.length) v.push(g[0]); return v; };
  let first = 0; variants(A.given).forEach(x => variants(B.given).forEach(y => { first = Math.max(first, M.sim(x, y)); }));
  return {last: M.sim(A.last, B.last), first, score: (M.sim(A.last, B.last) + first) / 2};
};

/* ---------------- grade computation (matches the Excel formulas) ---------------- */
M.mapeh = (g) => { const v=['Music & Arts','PE & Health'].map(k=>g[k]).filter(M.isNum); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
M.descriptor = (ga) => { if(!M.isNum(ga)) return ''; const r = Math.round(ga); return r>=90?'Advancing':r>=80?'Benchmarking':r>=75?'Connecting':r>=65?'Developing':'Emerging'; };
M.termRow = (c, term, lid) => {
  const g = (c.grades[term]||{})[lid] || {};
  const row = {};
  M.RAW.forEach(k => row[k] = M.isNum(g[k]) ? g[k] : null);
  row.MAPEH = M.mapeh(g);
  const areas = M.AREAS.map(k => row[k]);
  row.GA = areas.every(M.isNum) ? M.r2(areas.reduce((a,b)=>a+b,0)/8) : null;
  row.desc = M.descriptor(row.GA);
  row.filled = areas.filter(M.isNum).length;
  return row;
};
M.termsWithData = (c) => ['1','2','3'].filter(t => Object.values(c.grades[t]||{}).some(g => Object.values(g).some(M.isNum)));
M.finalRow = (c, lid) => {
  const rows = M.termsWithData(c).map(t => M.termRow(c, t, lid));
  const row = {};
  [...M.RAW,'MAPEH'].forEach(k => { const v = rows.map(r=>r[k]).filter(M.isNum); row[k] = v.length ? M.r2(v.reduce((a,b)=>a+b,0)/v.length) : null; });
  const areas = M.AREAS.map(k=>row[k]);
  row.GA = areas.every(M.isNum) ? M.r2(areas.reduce((a,b)=>a+b,0)/8) : null;
  row.desc = M.descriptor(row.GA);
  row.filled = areas.filter(M.isNum).length;
  return row;
};
M.rowFor = (c, term, lid) => term === 'F' ? M.finalRow(c, lid) : M.termRow(c, term, lid);
M.sortedLearners = (c) => [...c.learners].sort((a,b) => (a.sex===b.sex?0:(a.sex==='M'?-1:b.sex==='M'?1:a.sex==='F'?-1:1)) || a.name.localeCompare(b.name));
M.latestTerm = (c) => { const t = M.termsWithData(c); return t.length ? t[t.length-1] : '1'; };
// grade status for checklist: 'done' (all 8 areas), 'part', or ''
M.termStatus = (c, t, lid) => { const f = M.termRow(c, t, lid).filled; return f===8 ? 'done' : f>0 ? 'part' : ''; };

/* ---------------- learner status ---------------- */
M.STATUS = {
  TO:{label:'Transferred Out', short:'T/O', cls:'red'},
  SARDO:{label:'SARDO (at risk of dropping out)', short:'SARDO', cls:'gold'},
  NLP:{label:'No Longer Participating', short:'NLP', cls:'red'},
  DO:{label:'Dropped Out', short:'DO', cls:'red'}
};
// T/O, NLP and DO are left out of class statistics; SARDO stays in (still enrolled) but is flagged everywhere
M.counted = (l) => !l || !['TO','NLP','DO'].includes(l.status);
M.statusChip = (l, small) => { const st = l && M.STATUS[l.status]; return st ? `<span class="chip ${st.cls} st-chip" title="${M.esc(st.label)}${l.statusDate?' · '+M.esc(l.statusDate):''}${l.statusNote?' · '+M.esc(l.statusNote):''}" style="${small?'font-size:10px;padding:1px 7px':''}">${st.short}</span>` : ''; };
M.statusSummary = (c) => { const out = {}; Object.keys(M.STATUS).forEach(k => out[k] = c.learners.filter(l => l.status===k)); return out; };
M.excludedNote = (c) => { const x = c.learners.filter(l => !M.counted(l)); const sardo = c.learners.filter(l => l.status==='SARDO');
  if(!x.length && !sardo.length) return '';
  return `<div class="card status-note">${x.length?`<div class="flag"><span class="dot red"></span><div><b>${x.length} learner(s) left out of these statistics</b> — ${x.map(l=>`${M.esc(l.name)} ${M.statusChip(l,1)}`).join(', ')}</div></div>`:''}${sardo.length?`<div class="flag"><span class="dot"></span><div><b>SARDO (included, needs monitoring):</b> ${sardo.map(l=>M.esc(l.name)).join(', ')}</div></div>`:''}</div>`; };

/* ---------------- statistics ---------------- */
M.stats = (values) => {
  const v = values.filter(M.isNum).sort((a,b)=>a-b);
  const n = v.length;
  if(!n) return {n:0};
  const sum = v.reduce((a,b)=>a+b,0), mean = sum/n;
  const median = n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2;
  const freq = {}; v.forEach(x => { const k = Math.round(x); freq[k]=(freq[k]||0)+1; });
  const top = Math.max(...Object.values(freq));
  const modes = top > 1 ? Object.keys(freq).filter(k=>freq[k]===top).map(Number).sort((a,b)=>a-b) : [];
  const sd = Math.sqrt(v.reduce((a,x)=>a+(x-mean)**2,0)/n);
  const passed = v.filter(x => Math.round(x) >= M.PASS).length;
  return {n, mean, median, modes, modeFreq:top, sd, min:v[0], max:v[n-1], range:v[n-1]-v[0], passed, passRate:passed/n*100, values:v};
};
M.modeText = (s) => !s.n ? '—' : s.modes.length ? (s.modes.length>3 ? s.modes.slice(0,3).join(', ')+'…' : s.modes.join(', ')) : 'None';
M.valuesFor = (c, term, key, sex='all') => M.sortedLearners(c).filter(l => M.counted(l) && (sex==='all' || l.sex===sex)).map(l => ({l, v: M.rowFor(c, term, l.id)[key]})).filter(x => M.isNum(x.v));

/* ---------------- credentials checklist ---------------- */
M.missingFor = (c, lid) => M.checkItems().filter(it => !((c.checklist[lid]||{})[it.id]));
M.checkSummary = (c) => {
  const items = M.checkItems();
  const per = items.map(it => ({it, done: c.learners.filter(l => (c.checklist[l.id]||{})[it.id]).length}));
  const missing = M.sortedLearners(c).map(l => ({l, miss: M.missingFor(c, l.id)})).filter(x => x.miss.length);
  return {items, per, missing, total:c.learners.length};
};

/* ---------------- SeatCheck ↔ class linking ---------------- */
function lev(a,b){ let p=[...Array(b.length+1).keys()]; for(let i=1;i<=a.length;i++){ const c=[i]; for(let j=1;j<=b.length;j++) c.push(Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]!==b[j-1]))); p=c; } return p[b.length]; }
const sim = (a,b) => 1 - lev(a,b)/Math.max(a.length,b.length,1);
const toks = (s) => String(s).toLowerCase().replace(/[^a-z ]/g,'').split(/\s+/).filter(Boolean);
// match nickname-style SeatCheck names to full learner names; returns {sid: lid}
M.matchStudents = (section, c) => {
  const used = new Set(Object.values(section.students).map(s=>s.lid).filter(Boolean));
  const pairs = [];
  Object.entries(section.students).forEach(([sid, st]) => {
    if(st.lid) return;
    let nt = toks(st.name), ini = null;
    if(nt.length>1 && nt[nt.length-1].length===1){ ini = nt.pop(); }
    const n = nt.join('');
    c.learners.forEach(L => {
      if(used.has(L.id)) return;
      const [last, first=''] = L.name.split(',');
      const g = toks(first); let best = 0;
      for(let i=0;i<g.length;i++) for(let j=i+1;j<=g.length;j++) best = Math.max(best, sim(n, g.slice(i,j).join('')));
      if(ini) best += (toks(last)[0]||'')[0]===ini ? .15 : -.3;
      if(st.sex && L.sex && st.sex!==L.sex) best -= .1;
      pairs.push([best, sid, L.id]);
    });
  });
  pairs.sort((a,b)=>b[0]-a[0]);
  const us = new Set(), out = {};
  pairs.forEach(([s,sid,lid]) => { if(s<0.6 || us.has(sid) || used.has(lid)) return; us.add(sid); used.add(lid); out[sid]=lid; });
  return out;
};
M.autoLinkSections = () => {
  const A = M.S.att; if(!A) return;
  A.sections.forEach(sec => {
    if(sec.classId===undefined){ const c = M.S.classes.find(c => M.normName(c.section) === M.normName(sec.name)); if(c) sec.classId = c.id; }
    const c = M.S.classes.find(x => x.id === sec.classId);
    if(!c) return;
    Object.entries(M.matchStudents(sec, c)).forEach(([sid,lid]) => sec.students[sid].lid = lid);
  });
};
M.sectionFor = (c) => (M.S.att && M.S.att.sections || []).find(s => s.classId === c.id);
M.sidFor = (sec, lid) => sec ? Object.keys(sec.students).find(sid => sec.students[sid].lid === lid) : null;

/* ---------------- IndexedDB (documents) ---------------- */
let _db;
function db(){
  if(_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open('mastro', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('docs', {keyPath:'id'});
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function docsTx(mode, fn){
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('docs', mode), st = tx.objectStore('docs');
    const out = fn(st);
    tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    tx.onerror = () => rej(tx.error);
  });
}
M.docsAll = () => docsTx('readonly', st => st.getAll());
M.docGet = (id) => docsTx('readonly', st => st.get(id));
M.docPut = (d) => docsTx('readwrite', st => st.put(d));
M.docDel = (id) => docsTx('readwrite', st => st.delete(id));

/* ---------------- modal ---------------- */
M.modal = (title, html, onMount, wide) => {
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html;
  $('#modalWrap').hidden = false; $('#modalWrap .modal').classList.toggle('wide', !!wide);
  if(onMount) onMount($('#modalBody'));
};
M.closeModal = () => { $('#modalWrap').hidden = true; $('#modalBody').innerHTML=''; if(M.onModalClose){ const f = M.onModalClose; M.onModalClose = null; f(); } };

/* ---------------- print ---------------- */
M.sealsHtml = () => { const lg = M.S.settings.logos||{}; return {l: lg.deped ? `<img class="seal" src="${lg.deped}" alt="DepEd seal">` : '<span class="seal"></span>', r: lg.school ? `<img class="seal" src="${lg.school}" alt="School seal">` : '<span class="seal"></span>'}; };
M.printHeader = (title) => {
  const s = M.S.settings; const sl = M.sealsHtml();
  return `<div class="p-headrow">${sl.l}<div class="p-head"><div>Republic of the Philippines</div><div class="b">Department of Education</div><div>${M.esc(s.region)}</div><div class="b">${M.esc(s.school)}</div><div>${M.esc(s.address)}</div></div>${sl.r}</div><div class="p-title">${M.esc(title)}</div>`;
};
M.printSign = (c, left='Prepared by:', right='Noted by:') => { const s = M.S.settings; return `<div class="p-sign"><div>${left}<div class="nm">${M.esc(c.adviser)}</div><div>Class Adviser</div></div><div>${right}<div class="nm">${M.esc(c.head||s.head)}</div><div>${M.esc(s.headTitle||'School Head')}</div></div></div>`; };
// pageCss lets a form choose its own paper (e.g. "@page{size:A4 landscape;margin:8mm}")
// print on one page: shrink the content to the printable area when it is too big
M.doPrintFit = (html, size = 'A4 landscape', marginMm = 7) => {
  const dims = /landscape/i.test(size) ? [297, 210] : [210, 297];
  const W = dims[0] - 2*marginMm, H = dims[1] - 2*marginMm, px = 96 / 25.4;
  const st = document.createElement('div');
  st.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}mm;visibility:hidden;font-family:"Bookman Old Style",Bookman,Georgia,serif;font-size:11pt;color:#000;background:#fff`;
  st.innerHTML = html; document.body.appendChild(st);
  const sw = Math.max(st.scrollWidth, W*px), sh = st.scrollHeight; st.remove();
  const k = Math.min(1, (W*px) / sw, (H*px - 2) / sh);
  M.doPrint(`<div class="fitbox" style="width:${W}mm;height:${H}mm;overflow:hidden"><div style="width:${sw}px;transform:scale(${k.toFixed(4)});transform-origin:0 0">${html}</div></div>`, `@page{size:${size};margin:${marginMm}mm}`);
};
M.doPrint = (html, pageCss) => {
  $('#printArea').innerHTML = html;
  $('#pageStyle').textContent = pageCss || '@page{size:A4;margin:14mm}';
  setTimeout(() => window.print(), 80);
};

/* ---------------- router ---------------- */
M.applyTheme = () => { const t = M.S.settings.theme; if(t==='auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); };
M.renderNav = (active) => {
  $('#nav').innerHTML = M.NAV.map(v => `<a href="#${v.id}" class="${v.id===active?'active':''}">${M.ico(v.icon)}<span>${v.label}</span></a>`).join('');
  const inMore = !M.TABBAR.includes(active);
  $('#tabbar').innerHTML = M.TABBAR.map(id => { const v = M.NAV.find(x=>x.id===id); return `<a href="#${v.id}" class="${v.id===active?'active':''}">${M.ico(v.icon)}<span>${v.label}</span></a>`; }).join('') +
    `<a href="#" id="moreBtn" class="${inMore?'active':''}">${M.ico('more')}<span>More</span></a>`;
  $('#moreBtn').onclick = (e) => { e.preventDefault();
    M.modal('More', `<div class="list">${M.NAV.filter(v=>!M.TABBAR.includes(v.id)).map(v=>`<a class="item" href="#${v.id}" style="text-decoration:none;color:inherit">${M.ico(v.icon,'width:22px;height:22px;color:var(--green)')}<div class="grow"><div class="title">${v.label}</div><div class="tiny muted">${v.eyebrow}</div></div></a>`).join('')}</div>`,
      b => M.$$('a', b).forEach(a => a.addEventListener('click', () => M.closeModal()))); };
};
M.renderClassSelect = () => {
  $('#classSelect').innerHTML = M.S.classes.map(c => `<option value="${c.id}" ${c.id===M.S.activeClassId?'selected':''}>${M.esc(M.className(c))} · ${M.esc(c.sy)}</option>`).join('');
};
M.route = () => {
  if(M.onLeave){ try { M.onLeave(); } catch(e){} M.onLeave = null; }
  const parts = (location.hash||'#home').slice(1).split('/');
  const v = M.NAV.find(x=>x.id===parts[0]) || M.NAV[0];
  M.renderNav(v.id); M.renderClassSelect();
  $('#viewEyebrow').textContent = v.eyebrow;
  $('#viewTitle').textContent = v.title;
  const el = $('#view'); el.innerHTML = '';
  (M.views[v.id] || M.views.home)(el, parts.slice(1));
  window.scrollTo(0,0);
};
M.boot = () => {
  M.load(); M.applyTheme();
  $('#classSelect').onchange = e => { M.S.activeClassId = e.target.value; M.save(); M.route(); };
  $('#modalClose').onclick = M.closeModal;
  $('#modalWrap').onclick = e => { if(e.target.id==='modalWrap') M.closeModal(); };
  document.addEventListener('keydown', e => { if(e.key==='Escape' && !$('#modalWrap').hidden) M.closeModal(); });
  window.addEventListener('hashchange', M.route);
  const setT = (id, t) => { const e = document.getElementById(id); if(e) e.textContent = t; };
  setT('verChip', 'v' + M.VERSION.n); setT('verDate', M.VERSION.label); setT('devName', M.DEV.name); setT('devOrg', M.DEV.org);
  const net = () => { const p = $('#netPill'); p.textContent = navigator.onLine ? 'Online · works offline too' : 'Offline mode'; p.classList.toggle('off', !navigator.onLine); };
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
  M.route();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
};
})();
