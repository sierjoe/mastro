/* MASTRO — SF1 (School Register) import.
   Reads an SF1 Excel file (LIS download or school-made), matches each learner to the class by
   family name + first name (≥ 90% similar) or LRN, then marks LIS Enrolment, and takes the SF1
   name, LRN, sex and birthdate as the official record. Learners not on the SF1 are left untouched. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const THRESH = 0.9;

const txt = (v) => String(v ?? '').replace(/\s+/g,' ').trim();
const up = (v) => txt(v).toUpperCase();
function toISO(v){
  if(v instanceof Date && !isNaN(v)) return M.iso(new Date(v.getFullYear(), v.getMonth(), v.getDate()));
  if(typeof v === 'number' && v > 1000 && v < 80000){ const d = XLSX.SSF.parse_date_code(v); if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`; }
  const s = txt(v); if(!s) return '';
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/); if(m){ let y = +m[3]; if(y < 100) y += 2000; return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; }
  const d = new Date(s); return isNaN(d) ? '' : M.iso(d);
}
M.parseSF1 = function(wb){
  const out = {meta:{}, rows:[]};
  const seen = new Set();
  wb.SheetNames.forEach(sn => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, raw:true, defval:null});
    const hr = rows.findIndex(r => r && r.some(v => up(v) === 'LRN'));
    if(hr < 0) return;
    // header text per column = this row + the next (LIS headers often span 2 rows)
    const width = Math.max(...rows.slice(hr, hr+2).map(r => (r||[]).length));
    const head = [...Array(width).keys()].map(i => up((rows[hr]||[])[i]) + ' ' + up((rows[hr+1]||[])[i]));
    const find = (fn) => head.findIndex(fn);
    const cLrn = find(h => /(^| )LRN( |$)/.test(h));
    const cLast = find(h => /LAST\s*NAME/.test(h) && !/,/.test(h));
    const cFirst = find(h => /FIRST\s*NAME/.test(h) && !/,/.test(h) && !/LAST/.test(h));
    const cMid = find(h => /MIDDLE\s*NAME/.test(h) && !/FIRST/.test(h));
    const cName = find(h => /NAME/.test(h) && !/FATHER|MOTHER|GUARDIAN|SCHOOL|ADVISER|TEACHER|HEAD/.test(h));
    const cSex = find(h => /^SEX|\bSEX\b|GENDER/.test(h));
    const cBirth = find(h => /BIRTH/.test(h) && /DATE|DAY|\(MM/.test(h));
    const cAge = find(h => /^AGE|\bAGE\b/.test(h) && !/BIRTH/.test(h));
    rows.slice(0, hr).forEach(r => (r||[]).forEach((v,i) => {
      const lab = txt(v).toLowerCase(); if(!lab) return;
      const next = () => { for(let j=i+1;j<(r||[]).length;j++) if(txt(r[j])) return txt(r[j]); return ''; };
      if(lab.startsWith('grade level') && !out.meta.grade) out.meta.grade = next();
      if(lab.startsWith('section') && !out.meta.section) out.meta.section = next();
      if(lab.startsWith('school year') && !out.meta.sy) out.meta.sy = next();
      if(lab.startsWith('school id') && !out.meta.schoolId) out.meta.schoolId = next();
    }));
    for(let i = hr+1; i < rows.length; i++){
      const r = rows[i]; if(!r) continue;
      let name = '';
      if(cLast >= 0 && cFirst >= 0 && cLast !== cFirst) name = `${txt(r[cLast])}, ${txt(r[cFirst])}${cMid>=0 && txt(r[cMid]) ? ' ' + txt(r[cMid]) : ''}`.replace(/^, |, $/,'');
      else if(cName >= 0) name = txt(r[cName]);
      const lrn = cLrn >= 0 ? txt(r[cLrn]).replace(/\D/g,'') : '';
      if(!name || !name.includes(',') || /TOTAL|PREPARED|CERTIFIED|LEGEND|^NAME/i.test(name)) continue;
      if(lrn && lrn.length < 6) continue;
      name = name.replace(/\s*,\s*/, ', ').replace(/\s+/g,' ');
      const key = lrn || M.normName(name); if(seen.has(key)) continue; seen.add(key);
      const sx = up(cSex >= 0 ? r[cSex] : '');
      out.rows.push({lrn, name, sex: sx.startsWith('F') ? 'F' : sx.startsWith('M') ? 'M' : '', birthday: cBirth >= 0 ? toISO(r[cBirth]) : '', age: cAge >= 0 ? txt(r[cAge]) : ''});
    }
  });
  return out;
};
// best learner for each SF1 row: same LRN, or family name and first name both ≥ 90% similar
M.matchSF1 = function(rows, c){
  const pairs = [];
  rows.forEach((r, i) => c.learners.forEach(l => {
    const m = M.nameMatch(r.name, l.name);
    // same LRN counts only when the names are also plausibly the same person (guards against duplicated LRNs)
    if(r.lrn && l.lrn && r.lrn === l.lrn && m.score >= 0.6) { pairs.push({i, lid:l.id, score:1.5 + m.score, last:m.last, first:m.first, by:'LRN'}); return; }
    if(m.last >= THRESH && m.first >= THRESH) pairs.push({i, lid:l.id, score:m.score, last:m.last, first:m.first, by:'name'});
  }));
  pairs.sort((a,b) => b.score - a.score);
  const ri = new Set(), li = new Set(), map = {};
  pairs.forEach(p => { if(ri.has(p.i) || li.has(p.lid)) return; ri.add(p.i); li.add(p.lid); map[p.i] = p; });
  return map;
};
M.pickSF1 = function(){
  let inp = $('#sf1Input');
  if(!inp){ document.body.insertAdjacentHTML('beforeend', '<input type="file" id="sf1Input" accept=".xlsx,.xls,.csv" hidden>'); inp = $('#sf1Input'); }
  inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if(f) M.importSF1(f); };
  inp.click();
};
M.importSF1 = async function(file){
  let p;
  try { p = M.parseSF1(XLSX.read(await file.arrayBuffer(), {type:'array', cellDates:true})); }
  catch(e){ return alert('Could not read that file: ' + e.message); }
  if(!p.rows.length) return alert('No learners found. The SF1 needs a header row with "LRN" and a name column (Last Name, First Name, Middle Name). Download the SF1 from LIS as Excel.');
  const c = M.cls();
  const map = M.matchSF1(p.rows, c);
  const matched = Object.entries(map).map(([i, m]) => ({r:p.rows[i], l:c.learners.find(x=>x.id===m.lid), m}));
  const extra = p.rows.filter((r,i) => !map[i]);
  const missing = M.sortedLearners(c).filter(l => !Object.values(map).some(m => m.lid===l.id));
  const pct = (x) => Math.round(x*100) + '%';
  M.modal('Import SF1 · School Register', `
    <div class="chips" style="margin-bottom:12px"><span class="chip">${esc(file.name)}</span>${p.meta.grade||p.meta.section?`<span class="chip">Grade ${esc(p.meta.grade||'?')} – ${esc(p.meta.section||'?')}</span>`:''}<span class="chip">${p.rows.length} learner(s) on SF1</span></div>
    ${p.meta.section && M.normName(p.meta.section)!==M.normName(c.section) ? `<div class="flag"><span class="dot red"></span><div>This SF1 is for section <b>${esc(p.meta.section)}</b> but the active class is <b>${esc(M.className(c))}</b>. Switch class first if this is wrong.</div></div>`:''}
    <h3 style="margin-top:12px">Matched — will be marked LIS Enrolled (${matched.length})</h3>
    <div class="table-wrap" style="max-height:260px"><table><thead><tr><th>SF1 name (official)</th><th>Current name in MASTRO</th><th class="num">Match</th><th>Birthdate</th></tr></thead><tbody>
      ${matched.map(x=>`<tr><td><b>${esc(x.r.name)}</b><div class="tiny muted">${esc(x.r.lrn||'no LRN')}</div></td><td>${esc(x.l.name)}</td><td class="num">${x.m.by==='LRN'?'LRN':`${pct(x.m.last)} / ${pct(x.m.first)}`}</td><td>${esc(x.r.birthday||'—')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No matches.</td></tr>'}
    </tbody></table></div>
    <label class="row" style="margin-top:10px;cursor:pointer"><input type="checkbox" id="sfUse" checked> Use the SF1 name, LRN, sex and birthdate as the official record (also updates seat and cleaning names)</label>
    ${extra.length?`<h3 style="margin-top:16px">On SF1 but not in this class (${extra.length})</h3>
      <div class="list" style="max-height:200px;overflow:auto;padding:4px">${extra.map((r,i)=>`<label class="item" style="padding:8px 12px;cursor:pointer"><input type="checkbox" data-add="${i}" checked><div class="grow"><div class="title small">${esc(r.name)}</div><div class="tiny muted">${esc(r.lrn||'no LRN')} · ${r.sex||'?'} · ${esc(r.birthday||'no birthdate')}</div></div></label>`).join('')}</div>
      <p class="tiny muted">Ticked names are added as new learners (and as unseated learners in Attendance).</p>`:''}
    ${missing.length?`<h3 style="margin-top:16px">In MASTRO but not on this SF1 (${missing.length}) — left as is</h3><div class="small muted">${missing.map(l=>esc(l.name)).join('; ')}</div>`:''}
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn" id="sfCancel">Cancel</button><button class="btn primary" id="sfApply">${ico('check')} Apply SF1</button></div>`,
  b => {
    $('#sfCancel', b).onclick = M.closeModal;
    $('#sfApply', b).onclick = async () => {
      const use = $('#sfUse', b).checked, today = M.today();
      const stamp = {date: today, file: file.name};
      matched.forEach(({r, l}) => {
        if(use){ l.name = r.name; if(r.lrn) l.lrn = r.lrn; if(r.sex) l.sex = r.sex; if(r.birthday) l.birthday = r.birthday; }
        l.sf1 = stamp;
        const cl = c.checklist[l.id] = c.checklist[l.id] || {}; cl.lis = cl.lis || today;
      });
      const sec = M.sectionFor(c); let added = 0;
      $$('[data-add]:checked', b).forEach(x => {
        const r = extra[+x.dataset.add];
        const l = {id:M.uid('L'), name:r.name, lrn:r.lrn, sex:r.sex, birthday:r.birthday, remarks:'', sf1:stamp};
        c.learners.push(l); c.checklist[l.id] = {lis: today}; added++;
      });
      if(sec && added){
        // link new learners to existing seat names first (e.g. a nickname already in SeatCheck), else add them unseated
        Object.entries(M.matchStudents(sec, c)).forEach(([sid, lid]) => { sec.students[sid].lid = lid; });
        c.learners.filter(l => l.sf1 === stamp && !Object.values(sec.students).some(x => x.lid === l.id) && !matched.some(x => x.l === l))
          .forEach(l => { const sid = Math.random().toString(36).slice(2,13); sec.students[sid] = {name: M.firstName(l.name), sex: l.sex, lid: l.id}; });
      }
      M.save();
      if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
      await M.docPut({id:M.uid('d'), name:file.name, category:'School Forms', formCode:'SF1', tags:'SF1, '+c.section, classId:c.id, notes:`Imported ${today}: ${matched.length} matched, ${added} added`, mime:file.type, size:file.size, added:new Date().toISOString(), blob:file}).catch(()=>{});
      M.closeModal(); M.route();
      M.toast(`SF1 applied · ${matched.length} enrolled${added?` · ${added} added`:''}`);
    };
  }, true);
};
})();
