/* MASTRO — BULIG RMS (Records Management System) Excel file, filled from the Reading tab (v6.23)
   Uses the division's "BULIG_RMSv1_TEACHER.xlsm" (templates/BULIG_RMS_Template.xlsm, sample data removed and three formula
   mistakes fixed: pre-test level counts, "Frustation" spelling, AP quarter label). Only the input cells are written:
   HOME (school / class), LEARNERS INFORMATION (name, LRN, birthdate), MONITORING (pre-test level, key stage,
   BOSY / MOSY / EOSY profile, AP quarters and PASSED / NOT READY remarks). Everything else is the template's own formulas,
   recalculated by Excel when the file is opened. Learners with no pre-test level (NLP, T/O, …) are left out. */
(function(){
const M = window.M;
const TPL = 'templates/BULIG_RMS_Template.xlsm';
const LV = {L1:'LEVEL 1', L2A:'LEVEL 2A', L2B:'LEVEL 2B', L3A:'LEVEL 3A', L3B:'LEVEL 3B', L4:'LEVEL 4', L5:'LEVEL 5', L6:'LEVEL 6', L7:'LEVEL 7'};
const KSK = {KS1:'KeyStage1', KS2:'KeyStage2', KS3:'KeyStage3'};
const KSN = {KS1:'KEY STAGE 1', KS2:'KEY STAGE 2', KS3:'KEY STAGE 3'};
const AP_REM = ['M','P','S','V','Y','AB','AE','AH','AK','AN','AQ','AT','AW','AZ','BC'];
const AP_Q = ['N','Q','T','W','Z','AC','AF','AI','AL','AO','AR','AU','AX','BA','BD'];
const MARK = {P:'PASSED', N:'NOT READY', '-':'-'};
const SHEET = {HOME:3, LEARNERS:2, MON:5, AP1:7, APLIST:8};
const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colN = (s) => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const term = (q) => (q || '').split(' ')[0] || null;
const serial = (iso) => { if(!iso) return null; const [y, m, d] = iso.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); };
function build(ref, attrs, val){ const s = / s="(\d+)"/.exec(attrs || ''); const sa = s ? ` s="${s[1]}"` : '';
  if(val == null || val === '') return `<c r="${ref}"${sa}/>`;
  if(typeof val === 'number') return `<c r="${ref}"${sa}><v>${val}</v></c>`;
  return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${xe(val)}</t></is></c>`; }
function setCell(x, ref, val){
  const re = new RegExp(`<c r="${ref}"((?: [^>]*?)?)(?:/>|>([\\s\\S]*?)</c>)`); const m = re.exec(x);
  if(m){ if(m[2] && m[2].includes('<f')) throw new Error('formula cell ' + ref); return x.slice(0, m.index) + build(ref, m[1], val) + x.slice(m.index + m[0].length); }
  if(val == null || val === '') return x;
  const [, col, row] = /([A-Z]+)(\d+)/.exec(ref);
  const rm = new RegExp(`<row r="${row}"[^>]*?(?:/>|>([\\s\\S]*?)</row>)`).exec(x); if(!rm) throw new Error('no row ' + row);
  if(rm[0].endsWith('/>')) return x.slice(0, rm.index) + rm[0].slice(0, -2) + '>' + build(ref, '', val) + '</row>' + x.slice(rm.index + rm[0].length);
  const body = rm[1]; const start = rm.index + rm[0].indexOf(body); let pos = body.length; const cr = /<c r="([A-Z]+)\d+"/g; let cm;
  while((cm = cr.exec(body))){ if(colN(cm[1]) > colN(col)){ pos = cm.index; break; } }
  return x.slice(0, start) + body.slice(0, pos) + build(ref, '', val) + body.slice(pos) + x.slice(start + body.length); }

M.buligRms = async function(c, lang){
  await M.loadScript('vendor/jszip.min.js');
  const res = await fetch(TPL); if(!res.ok) throw new Error('The BULIG RMS template is missing from MASTRO (templates folder).');
  const zip = await JSZip.loadAsync(await res.arrayBuffer(), {createFolders: false});
  const R = c.bulig || {}; const d = (R.langs || {})[lang]; if(!d) throw new Error(`No ${lang === 'FILIPINO' ? 'Filipino' : 'English'} BULIG records yet.`);
  const ks = R.ks || 'KS3'; const st = M.S.settings;
  const aps = (d.aps || []).filter(a => a.marks && Object.keys(a.marks).length).slice(0, 15);
  const L = M.sortedLearners(c).filter(l => ((d.L || {})[l.id] || {}).pre);
  const Ms = L.filter(l => l.sex === 'M'), Fs = L.filter(l => l.sex !== 'M');
  if(Ms.length > 50 || Fs.length > 50) throw new Error('The template has room for 50 boys and 50 girls.');
  const sh = async (n) => zip.file(`xl/worksheets/sheet${n}.xml`).async('string');
  const put = (n, x) => zip.file(`xl/worksheets/sheet${n}.xml`, x);
  // HOME
  let x = await sh(SHEET.HOME);
  const sy = (c.sy || '').replace(/–|—/g, '-');
  [['C15', st.school], ['C16', /^\d+$/.test(st.schoolId || '') ? +st.schoolId : st.schoolId], ['C17', c.head || st.head], ['C18', st.headTitle || M.headTitle()],
   ['C19', (st.district || '').toUpperCase()], ['C20', 'Division of Bukidnon'], ['C21', 'Region X - Northern Mindanao'], ['C24', sy], ['C25', +c.grade || c.grade],
   ['C26', (c.section || '').toUpperCase()], ['C27', c.adviser || st.adviser], ['C28', d.tool || 'PHIL-IRI'], ['C30', lang], ['M19', KSN[ks]], ['K19', aps.length ? `AP${aps.length}` : 'AP1']]
    .forEach(([r, v]) => { x = setCell(x, r, v == null ? null : v); });
  put(SHEET.HOME, x);
  // LEARNERS INFORMATION
  x = await sh(SHEET.LEARNERS);
  [[5, Ms], [56, Fs]].forEach(([base, arr]) => arr.forEach((l, i) => { const r = base + i;
    x = setCell(x, `B${r}`, l.name.trim()); x = setCell(x, `F${r}`, /^\d{1,15}$/.test(l.lrn || '') ? +l.lrn : (l.lrn || null)); x = setCell(x, `G${r}`, serial(l.birthday)); }));
  put(SHEET.LEARNERS, x);
  // MONITORING
  x = await sh(SHEET.MON);
  x = setCell(x, 'F9', term(d.preT));
  aps.forEach((a, k) => { x = setCell(x, `${AP_Q[k]}6`, term(a.q)); });
  const prof = (p) => !p ? null : ks === 'KS1' ? p : `${ks}_${p}`;
  [[10, Ms], [62, Fs]].forEach(([base, arr]) => arr.forEach((l, i) => { const r = base + i; const rec = d.L[l.id] || {};
    x = setCell(x, `F${r}`, LV[rec.pre] || null); x = setCell(x, `G${r}`, KSK[ks]);
    [['H', 'bosy'], ['I', 'mosy'], ['J', 'eosy']].forEach(([col, per]) => { x = setCell(x, `${col}${r}`, prof(rec[per])); });
    aps.forEach((a, k) => { const mk = a.marks[l.id]; x = setCell(x, `${AP_REM[k]}${r}`, mk ? MARK[mk] || null : null); }); }));
  put(SHEET.MON, x);
  // the AP report sheets open on the latest assessment period
  for(const n of [SHEET.AP1, SHEET.APLIST]){ let y = await sh(n); y = setCell(y, 'K11', aps.length ? `AP${aps.length}` : 'AP1'); put(n, y); }
  // stale results from the template are removed; Excel recalculates everything when the file is opened
  for(const f of Object.keys(zip.files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))){
    const y = await zip.file(f).async('string'); zip.file(f, y.replace(/(<\/f>|<f [^>]*\/>)<v>[^<]*<\/v>/g, '$1').replace(/(<\/f>|<f [^>]*\/>)<v\/>/g, '$1')); }
  let wb = await zip.file('xl/workbook.xml').async('string');
  wb = wb.replace(/<calcPr([^>]*?)\/>/, (m, a) => `<calcPr${a.replace(/ fullCalcOnLoad="\d"/, '')} fullCalcOnLoad="1"/>`); zip.file('xl/workbook.xml', wb);
  const blob = await zip.generateAsync({type: 'blob', mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12', compression: 'DEFLATE'});
  return {blob, name: `BULIG_RMSv1_TEACHER - ${M.className(c)} - ${lang}.xlsm`, counts: {M: Ms.length, F: Fs.length, aps: aps.length, left: M.sortedLearners(c).length - L.length}};
};
})();
