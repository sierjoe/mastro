/* MASTRO — Scan & check answer sheets (v6.13).
   iPhone: point the camera at an answer sheet → MASTRO finds the 4 corner squares, reads the QR (sheet + learner),
   reads every bubble, checks it against the key and shows the score → Save puts it in the chosen exam column
   (ST1 · ST2 · TE of the term) of the class's ECR.
   iPhone → MacBook, no internet needed: the phone shows the results as QR codes and the MacBook reads them with its
   camera (or AirDrop a results file). MacBook → iPhone: the answer key travels the same way. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const O = () => M.omr;
const COMPS = [['st1','ST1','Summative Test 1'], ['st2','ST2','Summative Test 2'], ['te','TE','Term Examination']];
const compName = (k) => (COMPS.find(x => x[0] === k) || [k, k, k])[2];
const compShort = (k) => (COMPS.find(x => x[0] === k) || [k, k])[1];
const scans = () => (M.S.scans = Array.isArray(M.S.scans) ? M.S.scans : []);
const sheets = () => M.asStore();
const isPhone = () => /iPhone|iPod|Android/i.test(navigator.userAgent);
const ui = () => (M.S.ui.scan = M.S.ui.scan || {term: '1', comp: 'st1'});
const nm = (s) => M.normName(s);

/* ======================= camera helpers ======================= */
async function openCam(video, hi){
  const want = {facingMode: 'environment', width: {ideal: hi ? 1920 : 1280}, height: {ideal: hi ? 1080 : 720}};
  const stream = await navigator.mediaDevices.getUserMedia({video: want, audio: false});
  video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true; await video.play(); return stream;
}
const stopCam = (s) => { if(s) s.getTracks().forEach(t => t.stop()); };
const camErr = (e) => `<span class="low">Camera not available (${esc(e.name || e.message)}).</span> Allow camera access for this site in your browser settings, then try again.`;

/* ======================= QR transfer (chunks) ======================= */
// MX1|type|batch|i|n|data  — type K = answer key(s), R = scan results
const RX = {};
function chunkify(type, obj){
  const s = JSON.stringify(obj).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const size = 340, n = Math.max(1, Math.ceil(s.length / size)); const batch = Math.random().toString(36).slice(2, 7);
  return Array.from({length: n}, (_, i) => `MX1|${type}|${batch}|${i + 1}|${n}|${s.slice(i * size, (i + 1) * size)}`);
}
// returns {type, obj, got, n} — obj only when every part has arrived
function takeChunk(text){
  const m = String(text).match(/^MX1\|([A-Z])\|(\w+)\|(\d+)\|(\d+)\|([\s\S]*)$/); if(!m) return null;
  const [, type, batch, i, n, data] = m; const B = RX[batch] = RX[batch] || {type, n: +n, parts: {}}; B.parts[+i] = data;
  const got = Object.keys(B.parts).length;
  if(got < B.n) return {type, got, n: B.n};
  try { const obj = JSON.parse(Array.from({length: B.n}, (_, k) => B.parts[k + 1]).join('')); delete RX[batch]; return {type, obj, got, n: B.n}; }
  catch(e){ delete RX[batch]; return {type, err: 'Could not read the codes — show them again.', got, n: B.n}; }
}
async function qrCarousel(title, codes, note){
  await M.loadScript('vendor/qrcode.js');
  const svgs = codes.map(t => { const q = qrcode(0, 'M'); q.addData(t); q.make(); return q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); });
  let i = 0, run = true, tm = 0;
  M.modal(title, `<div class="qx-box"><div class="qx-qr" id="qxQ"></div>
      <div class="row" style="justify-content:center;gap:8px;margin-top:10px">${codes.length > 1 ? `<button class="btn sm" id="qxP">‹</button><span class="small" id="qxN"></span><button class="btn sm" id="qxPl">Pause</button><button class="btn sm" id="qxF">›</button>` : '<span class="small muted">1 code</span>'}</div>
      <div class="small muted" style="margin-top:10px;text-align:center">${note}</div></div>`, b => {
    const show = () => { $('#qxQ', b).innerHTML = svgs[i]; if($('#qxN', b)) $('#qxN', b).textContent = `Code ${i + 1} of ${codes.length}`; };
    const step = (d) => { i = (i + d + codes.length) % codes.length; show(); };
    show(); if(codes.length > 1){ tm = setInterval(() => { if(run) step(1); }, 850);
      $('#qxP', b).onclick = () => step(-1); $('#qxF', b).onclick = () => step(1); $('#qxPl', b).onclick = e => { run = !run; e.target.textContent = run ? 'Pause' : 'Play'; }; }
  });
  M.onModalClose = () => clearInterval(tm);
}
// receive: camera reads the codes shown on the other device
async function receive(){
  await M.loadScript('vendor/jsQR.js');
  let stream = null, raf = 0, last = 0; const seen = new Set();
  M.modal(isPhone() ? 'Receive from MacBook' : 'Receive from iPhone', `
    <div class="scan-wrap qx-cam"><video id="rxV" playsinline muted></video></div>
    <div id="rxOut" class="small" style="margin-top:12px;text-align:center">Point this camera at the codes on the other device's screen. Keep it steady — parts are collected automatically.</div>`, async b => {
    const v = $('#rxV', b), out = $('#rxOut', b); const cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently: true});
    try { stream = await openCam(v, true); } catch(e){ out.innerHTML = camErr(e); return; }
    const tick = (t) => { raf = requestAnimationFrame(tick); if(t - last < 120 || v.readyState < 2) return; last = t;
      const w = Math.min(1280, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth); if(!w || !h) return;
      cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h, {inversionAttempts: 'dontInvert'}); if(!r || !r.data || seen.has(r.data)) return; seen.add(r.data);
      const c = takeChunk(r.data);
      if(!c){ out.innerHTML = `<span class="low">That is not a MASTRO transfer code.</span>`; return; }
      if(c.err){ out.innerHTML = `<span class="low">${esc(c.err)}</span>`; seen.clear(); return; }
      if(!c.obj){ out.innerHTML = `<b>${c.got} of ${c.n}</b> codes received… keep pointing at the screen.`; if(navigator.vibrate) navigator.vibrate(15); return; }
      cancelAnimationFrame(raf); stopCam(stream); stream = null; if(navigator.vibrate) navigator.vibrate([30, 40, 30]);
      handleIncoming(c.type, c.obj).then(msg => { out.innerHTML = msg + `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn primary" id="rxDone">Done</button></div>`; $('#rxDone', b).onclick = M.closeModal; });
    };
    raf = requestAnimationFrame(tick);
  });
  M.onModalClose = () => { cancelAnimationFrame(raf); stopCam(stream); M.route(); };
}
M.scanReceive = receive;
async function handleIncoming(type, obj){
  if(type === 'K'){ const n = importSheets(obj.sheets || []); return `✅ <b>${n}</b> answer key(s) received: ${esc((obj.sheets || []).map(s => s.title).join(', '))}. You can now scan these answer sheets.`; }
  if(type === 'R'){ const r = importResults(obj); const ap = await applyAll(); return `✅ <b>${r.added}</b> new and <b>${r.updated}</b> updated result(s) received.<br>${ap.done ? `<b>${ap.done}</b> recorded in the ECR.` : ''} ${ap.fail ? `<span class="low">${ap.fail} not recorded yet</span> — see the list for the reason.` : ''}`; }
  return 'Unknown code.';
}

/* ======================= keys: MacBook → iPhone ======================= */
const packSheet = (s) => ({id: s.id, title: s.title, parts: s.parts.map(p => ({n: +p.n, fmt: p.fmt, label: p.label || '', key: p.key || ''})), edited: s.edited});
function importSheets(list){ let n = 0; list.forEach(s => { if(!s || !s.id || !Array.isArray(s.parts)) return; const L = sheets(); const i = L.findIndex(x => x.id === s.id);
  const v = Object.assign({}, i >= 0 ? L[i] : {created: new Date().toISOString()}, s, {received: new Date().toISOString()}); if(i >= 0) L[i] = v; else L.push(v); n++; }); M.save(); return n; }
M.scanSendKey = (sh) => qrCarousel(`Answer key → iPhone · ${sh.title}`, chunkify('K', {sheets: [packSheet(sh)]}),
  'On your iPhone open MASTRO → Assessments → <b>Scan answer sheets</b> (or <b>Receive from MacBook</b>) and point the camera here. The key stays on your phone for the next scans.');

/* ======================= results store + ECR ======================= */
const recKey = (r) => [r.sheet, r.src, r.lk || nm(r.name), r.term, r.comp].join('|');
function addResult(r){ const L = scans(); const i = L.findIndex(x => recKey(x) === recKey(r)); if(i >= 0){ r.id = L[i].id; L[i] = r; } else L.push(r); M.save(); return i >= 0; }
function importResults(obj){ let added = 0, updated = 0;
  (obj.recs || []).forEach(a => { const r = Array.isArray(a) ? {sheet: a[0], src: a[1], lk: a[2], name: a[3], term: a[4], comp: a[5], score: a[6], max: a[7], ts: a[8], title: a[9] || '', manual: a[10] || 0} : a;
    if(!r.sheet) return; const ex = scans().find(x => recKey(x) === recKey(r));
    if(ex && (ex.ts || 0) >= (r.ts || 0)) return;
    const rec = Object.assign({id: M.uid('sc'), ans: ''}, r, {applied: null, err: '', from: 'phone', sent: true});
    if(addResult(rec)) updated++; else added++; });
  return {added, updated}; }
// find the ECR + row for a result
function ecrFor(r){
  const E0 = r.src && r.src.startsWith('e:') ? (M.S.ecr || []).find(E => E.id === r.src.slice(2)) : null; if(E0) return E0;
  const want = nm(r.name); if(!want) return null;
  const c = r.src && r.src.startsWith('c:') ? (M.S.classes || []).find(x => x.id === r.src.slice(2)) : null;
  const has = (E) => { const R = E.model && E.model.roster; const names = R ? [...(R.M || []), ...(R.F || [])] : Object.values(E.terms || {}).flatMap(T => (T.learners || []).map(x => x.name)); return names.some(n => n && (nm(n) === want || (want.length >= 8 && nm(n).startsWith(want)))); };
  const L = (M.S.ecr || []).filter(has); if(!L.length) return null;
  return (c && L.find(E => String(E.section).toUpperCase() === String(c.section).toUpperCase())) || L[0];
}
function slotFor(E, r){
  const R = E.model.roster; const want = nm(r.name);
  if(r.lk && /^[MF]\d+$/.test(r.lk) && r.src === 'e:' + E.id){ const n = (R[r.lk[0]] || [])[+r.lk.slice(1)]; if(n && (!want || nm(n).startsWith(want.slice(0, 8)) || want.startsWith(nm(n).slice(0, 8)))) return r.lk; }
  for(const sx of ['M','F']){ const i = (R[sx] || []).findIndex(n => n && (nm(n) === want || (want.length >= 8 && nm(n).startsWith(want)))); if(i >= 0) return sx + i; }
  return null;
}
async function applyOne(r){
  const E = ecrFor(r); if(!E){ r.err = 'No class record on this device has this learner'; return false; }
  let model = null; try { model = await M.ecrEnsureModel(E); } catch(e){}
  if(!model){ r.err = `The ECR of ${E.title} is not on this device`; return false; }
  if(!model.terms[r.term]){ r.err = `${E.title} has no Term ${r.term} sheet`; return false; }
  const slot = slotFor(E, r); if(!slot){ r.err = `${r.name || 'Learner'} is not in ${E.title}`; return false; }
  try { M.ecrPutScores(E, r.term, r.comp, {[slot]: r.score}, r.max); } catch(e){ r.err = e.message; return false; }
  r.applied = new Date().toISOString(); r.ecr = E.id; r.slot = slot; r.ecrTitle = E.title; r.err = ''; return true;
}
async function applyAll(){ let done = 0, fail = 0; for(const r of scans()){ if(r.applied) continue; if(await applyOne(r)) done++; else fail++; } M.save(); return {done, fail}; }
M.scanApplyAll = applyAll;

/* ======================= send results: iPhone → MacBook ======================= */
const packRec = (r) => [r.sheet, r.src || '', r.lk || '', r.name || '', r.term, r.comp, r.score, r.max, r.ts, (r.title || '').slice(0, 40), r.manual || 0];
function sendResults(all){
  const L = scans().filter(r => all || !r.sent); if(!L.length) return M.toast(all ? 'No results yet' : 'Every result was already sent — use “Send all again”');
  qrCarousel(`Send ${L.length} result(s) to MacBook`, chunkify('R', {v: 1, recs: L.map(packRec)}),
    'On your MacBook open MASTRO → Assessments → <b>Receive from iPhone</b> and hold this screen in front of its camera (about 20–30 cm). The scores go straight into the ECRs there.');
  L.forEach(r => r.sent = true); M.save();
}
async function saveFile(){
  const out = {app: 'MASTRO', kind: 'scans', exported: new Date().toISOString(), recs: scans().map(packRec), sheets: sheets().map(packSheet)};
  const name = `MASTRO-scans-${M.today()}.json`; const blob = new Blob([JSON.stringify(out)], {type: 'application/json'});
  const file = typeof File === 'function' ? new File([blob], name, {type: 'application/json'}) : null;
  if(file && navigator.canShare && isPhone() && navigator.canShare({files: [file]})){ try { await navigator.share({files: [file], title: name}); return; } catch(e){ if(e && e.name === 'AbortError') return; } }
  M.downloadBlob(blob, name); M.toast('Results file saved');
}
async function openFile(f){
  try { const d = JSON.parse(await f.text()); if(d.app !== 'MASTRO' || d.kind !== 'scans') throw new Error('Not a MASTRO scans file');
    const k = importSheets(d.sheets || []); const r = importResults(d); const ap = await applyAll();
    M.toast(`${r.added + r.updated} result(s), ${k} answer key(s) · ${ap.done} recorded in the ECR`); M.route(); }
  catch(e){ alert('Could not open: ' + e.message); }
}

/* ======================= the scanner ======================= */
async function scanner(){
  await Promise.all([M.loadScript('vendor/jsQR.js')]);
  const U = ui(); let stream = null, raf = 0, last = 0, idle = 0, busy = false, paused = false, stable = 0, prevQ = null, skipQR = '', skipUntil = 0;
  M.modal('Scan answer sheets', `
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center">
      <div class="seg sm" id="scT">${['1','2','3'].map(t => `<button data-t="${t}" class="${t === U.term ? 'on' : ''}">Term ${t}</button>`).join('')}</div>
      <div class="seg sm" id="scC">${COMPS.map(([k, s]) => `<button data-c="${k}" class="${k === U.comp ? 'on' : ''}">${s}</button>`).join('')}</div></div>
    <div class="tiny muted" style="text-align:center;margin-top:6px" id="scDest"></div>
    <div class="scan-wrap omr-cam" id="scWrap"><video id="scV" playsinline muted></video><canvas id="scO"></canvas></div>
    <div id="scOut" class="small" style="margin-top:10px;text-align:center">Hold the phone above one answer sheet so all <b>4 black squares</b> are inside the picture. It scans by itself.</div>
    <div class="tiny muted" style="text-align:center;margin-top:6px" id="scCount"></div>`, async b => {
    const v = $('#scV', b), ov = $('#scO', b), out = $('#scOut', b); const cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently: true});
    const dest = () => { $('#scDest', b).textContent = `Scores go to: ${compName(U.comp)} · Term ${U.term}`; const n = scans().filter(r => r.term === U.term && r.comp === U.comp).length; $('#scCount', b).textContent = n ? `${n} paper(s) saved for this exam so far` : ''; };
    dest();
    $('#scT', b).onclick = e => { const x = e.target.closest('button'); if(!x) return; U.term = x.dataset.t; $$('#scT button', b).forEach(y => y.classList.toggle('on', y === x)); M.save(); dest(); };
    $('#scC', b).onclick = e => { const x = e.target.closest('button'); if(!x) return; U.comp = x.dataset.c; $$('#scC button', b).forEach(y => y.classList.toggle('on', y === x)); M.save(); dest(); };
    try { stream = await openCam(v, true); } catch(e){ out.innerHTML = camErr(e); return; }
    const drawQuad = (q, ok) => { const r = v.getBoundingClientRect(); ov.width = r.width; ov.height = r.height; const g = ov.getContext('2d'); g.clearRect(0, 0, ov.width, ov.height); if(!q) return;
      const k = Math.min(r.width / v.videoWidth, r.height / v.videoHeight), ox = (r.width - v.videoWidth * k) / 2, oy = (r.height - v.videoHeight * k) / 2;
      g.strokeStyle = ok ? '#2bd47d' : '#f5c242'; g.lineWidth = 4; g.beginPath(); q.forEach((p, i) => i ? g.lineTo(ox + p.x * k, oy + p.y * k) : g.moveTo(ox + p.x * k, oy + p.y * k)); g.closePath(); g.stroke(); };
    const tick = (t) => { raf = requestAnimationFrame(tick); if(paused || busy || t - last < 160 || v.readyState < 2 || !v.videoWidth) return; last = t;
      const w = v.videoWidth, h = v.videoHeight; cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const img = cx.getImageData(0, 0, w, h); const g0 = O().toGray(img.data, w, h, 720); const best = O().findMarkers(g0);
      if(!best){ stable = 0; prevQ = null; drawQuad(null);
        // no sheet in view: maybe the MacBook is showing an answer-key code
        if(++idle % 4 === 0){ const k = Math.min(1, 900 / w), sw = Math.round(w * k), shh = Math.round(h * k); cv.width = sw; cv.height = shh; cx.drawImage(v, 0, 0, sw, shh);
          const r = jsQR(cx.getImageData(0, 0, sw, shh).data, sw, shh, {inversionAttempts: 'dontInvert'});
          if(r && r.data.startsWith('MX1|')){ const c = takeChunk(r.data); if(c && c.obj && c.type === 'K'){ const n = importSheets(c.obj.sheets || []); out.innerHTML = `✅ Answer key received: <b>${esc((c.obj.sheets || []).map(x => x.title).join(', '))}</b>. Now scan the answer sheets.`; if(navigator.vibrate) navigator.vibrate([30, 40, 30]); }
            else if(c && !c.obj && !c.err) out.innerHTML = `Receiving the answer key… ${c.got} of ${c.n}`; else if(c && c.obj && c.type === 'R') out.innerHTML = 'Those are scan results — open <b>Receive</b> to take them in.'; } }
        return; }
      const moved = prevQ ? Math.max(...best.q.map((p, i) => Math.hypot(p.x - prevQ[i].x, p.y - prevQ[i].y))) / w : 1; prevQ = best.q;
      stable = moved < 0.012 ? stable + 1 : 0; drawQuad(best.q, stable >= 2);
      if(stable < 2) return;
      busy = true; try { grade(img, w, h, best); } catch(e){ console.error(e); out.innerHTML = `<span class="low">Could not read that sheet — try again.</span>`; } busy = false; };
    const grade = (img, w, h, best) => {
      const G = O().toGray(img.data, w, h); const or = O().locate(G, best); if(!or){ stable = 0; return; }
      let qr = null; for(const p of [8, 10, 6]){ const q = O().qrCrop(G, or.H, p); qr = jsQR(q.data, q.w, q.h, {inversionAttempts: 'dontInvert'}); if(qr) break; }
      if(!qr) qr = jsQR(img.data, w, h, {inversionAttempts: 'dontInvert'});
      if(!qr){ out.innerHTML = `Sheet found — move a little closer so the code can be read.`; stable = 0; return; }
      if(qr.data.startsWith('MX1|')){ const c = takeChunk(qr.data); if(c && c.obj && c.type === 'K'){ const n = importSheets(c.obj.sheets || []); out.innerHTML = `✅ Answer key received (${n}). Now scan the answer sheets.`; } return; }
      const m = qr.data.split('|'); if(m[0] !== 'MA1'){ out.innerHTML = `<span class="low">This is not a MASTRO answer sheet.</span>`; return; }
      if(qr.data === skipQR && Date.now() < skipUntil) return;
      const sh = sheets().find(s => s.id === m[1]);
      if(!sh){ out.innerHTML = `<span class="low">The answer key of this sheet is not on this phone.</span> On your MacBook open Assessments → Answer sheets → <b>📱 Key to iPhone</b>, then point this camera at that screen.`; return; }
      const L = O().layout(sh.parts); const res = O().read(G, or.H, L); const key = M.asKey(sh); const sc = O().score(res, key);
      paused = true; if(navigator.vibrate) navigator.vibrate(40); $('#scWrap', b).hidden = true;
      showResult(sh, {src: m[2] || '', lk: m[3] || '', name: m[4] || ''}, res, sc, key, L);
    };
    const showResult = (sh, who, res, sc, key, L) => {
      const lines = L.items.filter(it => it.line).length; const marks = sc.marks; let manual = 0;
      let name = who.name || '';
      const total = () => marks.filter(x => x.ok).length + manual;
      const draw = () => {
        const dup = scans().find(r => recKey(r) === recKey({sheet: sh.id, src: who.src, lk: who.lk, name, term: U.term, comp: U.comp}));
        out.innerHTML = `<div class="sc-res">
          <div class="row" style="gap:10px;align-items:center"><div class="grow" style="text-align:left"><div class="title"><b>${name ? esc(name) : '<span class="low">Name not on sheet</span>'}</b></div><div class="tiny muted">${esc(sh.title)} · ${compShort(U.comp)} · Term ${U.term}</div></div>
            <div class="sc-score"><b>${total()}</b><span>/ ${L.n}</span></div></div>
          ${!who.name ? `<input class="input" id="srN" list="srNL" placeholder="Type the learner's name (Last, First)" style="margin-top:8px"><datalist id="srNL">${knownNames(who.src).map(n => `<option value="${esc(n)}">`).join('')}</datalist>` : ''}
          <div class="tiny muted" style="margin:8px 0 4px;text-align:left">${sc.right} correct · ${sc.wrong} wrong${sc.blank ? ` · ${sc.blank} blank` : ''}${sc.multi ? ` · ${sc.multi} with 2 marks` : ''}${key.filter(Boolean).length < marks.filter(x => !x.line).length ? ' · <span class="low">answer key incomplete</span>' : ''} — tap an item to change what was read.</div>
          <div class="sc-grid">${marks.map((x, i) => x.line ? '' : `<button class="sc-it ${x.ok ? 'ok' : x.ans === '' ? 'bl' : x.ans === '*' ? 'mu' : 'no'}" data-i="${i}"><i>${x.no}</i>${x.ans === '*' ? '2×' : x.ans || '–'}</button>`).join('')}</div>
          ${lines ? `<div class="row" style="justify-content:center;gap:8px;margin-top:10px"><span class="small">Write-in items correct</span><button class="btn sm" id="srMm">−</button><b id="srMv">${manual}</b><button class="btn sm" id="srMp">+</button><span class="small muted">of ${lines}</span></div>` : ''}
          ${dup ? `<div class="tiny" style="margin-top:8px;color:var(--amber)">Already saved for this exam (${dup.score}/${dup.max}) — saving replaces it.</div>` : ''}
          <div class="row" style="justify-content:center;gap:8px;margin-top:12px"><button class="btn" id="srAg">↻ Rescan</button><button class="btn primary" id="srOk">${ico('save')} Save &amp; next</button></div></div>`;
        if($('#srN', out)){ $('#srN', out).value = name; $('#srN', out).oninput = e => { name = e.target.value.trim(); }; }
        $$('.sc-it', out).forEach(x => x.onclick = () => { const mk = marks[+x.dataset.i]; const ch = [...(L.items[+x.dataset.i].bub.map(bb => bb.L)), ''];
          mk.ans = ch[(ch.indexOf(mk.ans === '*' ? '' : mk.ans) + 1) % ch.length]; mk.ok = !!mk.key && mk.ans === mk.key; draw(); });
        if($('#srMm', out)){ $('#srMm', out).onclick = () => { manual = Math.max(0, manual - 1); draw(); }; $('#srMp', out).onclick = () => { manual = Math.min(lines, manual + 1); draw(); }; }
        $('#srAg', out).onclick = () => { paused = false; stable = 0; $('#scWrap', b).hidden = false; out.innerHTML = 'Hold the sheet steady…'; };
        $('#srOk', out).onclick = async () => { if(!name){ M.toast('Type the learner’s name first'); return; }
          const r = {id: M.uid('sc'), sheet: sh.id, title: sh.title, src: who.src, lk: who.lk, name, term: U.term, comp: U.comp, score: total(), max: L.n, right: marks.filter(x => x.ok).length, manual,
            ans: marks.map(x => x.line ? '_' : x.ans === '' ? '.' : x.ans).join(''), ts: Date.now(), applied: null, err: '', sent: false};
          addResult(r); const ok = (M.S.ecr || []).length ? await applyOne(r) : false; M.save();
          M.toast(`${name.split(',')[0]} · ${r.score}/${r.max} saved${ok ? ' · in ECR' : ''}`);
          skipQR = `MA1|${sh.id}|${who.src}|${who.lk}|${who.name}`; skipUntil = Date.now() + 4000;
          paused = false; stable = 0; $('#scWrap', b).hidden = false; dest(); out.innerHTML = 'Next sheet…'; };
      };
      draw();
    };
    raf = requestAnimationFrame(tick);
  }, true);
  M.onModalClose = () => { cancelAnimationFrame(raf); stopCam(stream); M.route(); };
}
M.scanOpen = scanner;
function knownNames(src){
  const out = new Set(); const E = src && src.startsWith('e:') ? (M.S.ecr || []).find(x => x.id === src.slice(2)) : null;
  const add = (E) => { const R = E.model && E.model.roster; (R ? [...(R.M || []), ...(R.F || [])] : Object.values(E.terms || {}).flatMap(T => (T.learners || []).map(x => x.name))).forEach(n => n && out.add(String(n).replace(/\s*,\s*/, ', '))); };
  if(E) add(E); else { (M.S.ecr || []).forEach(add); (M.S.classes || []).forEach(c => (c.learners || []).forEach(l => out.add(l.name))); }
  return [...out].sort();
}

/* ======================= section on the Assessments page ======================= */
M.scanSection = function(box){
  const L = scans(); const unsent = L.filter(r => !r.sent).length; const pend = L.filter(r => !r.applied).length;
  const groups = {}; L.forEach(r => { const k = [r.sheet, r.term, r.comp, r.ecrTitle || r.src].join('|'); (groups[k] = groups[k] || []).push(r); });
  const G = Object.values(groups).sort((a, b) => Math.max(...b.map(r => r.ts || 0)) - Math.max(...a.map(r => r.ts || 0)));
  const btn = (id, label, cls = '') => `<button class="btn ${cls}" id="${id}">${label}</button>`;
  const phoneBtns = btn('scGo', `📷 Scan answer sheets`, 'primary') + btn('scSend', `📤 Send results to MacBook${unsent ? ` <span class="chip gold" style="margin-left:4px">${unsent} new</span>` : ''}`) + btn('scRxK', '📥 Receive key from MacBook');
  const macBtns = btn('scRx', '📥 Receive from iPhone', 'primary') + btn('scGo', '📷 Scan with this camera');
  box.innerHTML = `<div class="card" style="margin-top:20px"><div class="row"><div class="grow"><h2 style="margin:0">📷 Scan &amp; check ${M.newTag('omr-scan')}</h2>
      <div class="small muted" style="margin-top:4px">Check answer sheets with your iPhone camera. Each score goes to the exam you pick (ST1 · ST2 · TE) in the class's ECR. Results move from iPhone to MacBook by camera — no internet needed.</div></div></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">${isPhone() ? phoneBtns : macBtns}
      <span class="spacer"></span><button class="btn sm" id="scMore">⋯ More</button></div>
    <div id="scMoreBox" hidden class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
      ${isPhone() ? btn('scRx', '📥 Receive results', 'sm') : btn('scSend', '📤 Send results', 'sm') + btn('scRxK', '📥 Receive key', 'sm')}
      ${btn('scSendAll', '📤 Send all again', 'sm')}${btn('scFile', '💾 Save results file (AirDrop)', 'sm')}${btn('scOpen', '📂 Open results file', 'sm')}${pend ? btn('scApply', `↻ Record ${pend} pending in ECR`, 'sm') : ''}<input type="file" id="scFileIn" accept=".json" hidden></div>
    ${G.length ? `<div class="list" style="margin-top:14px">${G.map(g => { const r0 = g[0]; const ok = g.filter(r => r.applied).length; const mean = g.reduce((a, r) => a + r.score, 0) / g.length;
      return `<div class="item sc-grp" data-g="${esc([r0.sheet, r0.term, r0.comp, r0.ecrTitle || r0.src].join('|'))}"><div class="grow"><div class="title"><b>${esc(r0.title || 'Answer sheet')}</b> · ${compShort(r0.comp)} · Term ${esc(r0.term)}</div>
        <div class="tiny muted">${esc(r0.ecrTitle || (r0.src && r0.src.startsWith('c:') ? 'advisory class' : '') || '')} · ${g.length} paper(s) · mean ${M.r2(mean)} / ${r0.max} · ${ok === g.length ? '<span style="color:var(--green)">all in the ECR</span>' : `<span class="low">${g.length - ok} not in the ECR yet</span>`}</div></div>
        <button class="btn sm" data-gv="1">View</button></div>`; }).join('')}</div>` : '<div class="empty small" style="margin-top:12px">No answer sheets scanned yet.</div>'}</div>`;
  const on = (id, f) => { const x = $('#' + id, box); if(x) x.onclick = f; };
  on('scGo', scanner); on('scRx', receive); on('scRxK', receive); on('scSend', () => sendResults(false)); on('scSendAll', () => sendResults(true));
  on('scMore', () => { $('#scMoreBox', box).hidden = !$('#scMoreBox', box).hidden; });
  on('scFile', saveFile); on('scOpen', () => $('#scFileIn', box).click()); $('#scFileIn', box).onchange = e => { const f = e.target.files[0]; e.target.value = ''; if(f) openFile(f); };
  on('scApply', async () => { const r = await applyAll(); M.toast(`${r.done} recorded${r.fail ? ` · ${r.fail} still pending` : ''}`); M.route(); });
  $$('.sc-grp', box).forEach(el => el.querySelector('[data-gv]').onclick = () => viewGroup(groups[el.dataset.g]));
};
function viewGroup(g){
  const r0 = g[0]; const L = [...g].sort((a, b) => a.name.localeCompare(b.name));
  M.modal(`${r0.title || 'Answer sheet'} · ${compShort(r0.comp)} · Term ${r0.term}`, `
    <div class="table-wrap" style="max-height:60vh"><table><thead><tr><th>Learner</th><th class="num">Score</th><th>ECR</th><th></th></tr></thead><tbody>
    ${L.map(r => `<tr><td>${esc(r.name || r.lk)}</td><td class="num"><b>${r.score}</b> / ${r.max}</td><td class="small">${r.applied ? '✓ ' + esc(r.ecrTitle || '') : `<span class="low">${esc(r.err || 'not yet')}</span>`}</td><td><button class="icon-btn" data-del="${r.id}" title="Delete this result">✕</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:12px"><span class="tiny muted">Deleting a result here does not erase the score already typed in the ECR.</span><span class="spacer"></span><button class="btn" id="vgX">Close</button></div>`, b => {
    $('#vgX', b).onclick = M.closeModal;
    $$('[data-del]', b).forEach(x => x.onclick = () => { if(!confirm('Delete this scan result?')) return; M.S.scans = scans().filter(r => r.id !== x.dataset.del); M.save(); x.closest('tr').remove(); });
  }, true);
  M.onModalClose = () => M.route();
}
})();
