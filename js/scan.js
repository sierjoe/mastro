/* MASTRO — Scan answer sheets → scores per section (v6.14).
   Tap 📷 Scan on an answer sheet, hold the phone over each paper: MASTRO reads the QR (sheet · learner · section)
   and the shaded bubbles, checks them against the key and shows the score. Save & next.
   📊 Scores shows every learner's score grouped by section — view, print or download as Excel.
   iPhone ↔ MacBook without internet: the answer key and the scores travel as QR codes shown on one screen
   and read by the other device's camera. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const O = () => M.omr;
const scans = () => (M.S.scans = Array.isArray(M.S.scans) ? M.S.scans : []);
const sheets = () => M.asStore();
const isPhone = () => /iPhone|iPod|Android/i.test(navigator.userAgent);
const nm = (s) => M.normName(s || '');
const secName = (s) => String(s || '').trim() || 'No section';

/* ======================= camera ======================= */
async function openCam(video){
  const want = {facingMode: 'environment', width: {ideal: 2560}, height: {ideal: 1440}};
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({video: want, audio: false}); }
  catch(e){ stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}, audio: false}); }
  video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true; await video.play(); return stream;
}
const stopCam = (s) => { if(s) s.getTracks().forEach(t => t.stop()); };
const camErr = (e) => `<span class="low">Camera not available (${esc(e.name || e.message)}).</span> Allow camera access for this site in your browser settings, then try again.`;

/* ======================= QR transfer (chunks) ======================= */
// MX1|type|batch|i|n|data  — K = answer key, R = scores
const RX = {};
function chunkify(type, obj){
  const s = JSON.stringify(obj).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const size = 340, n = Math.max(1, Math.ceil(s.length / size)); const batch = Math.random().toString(36).slice(2, 7);
  return Array.from({length: n}, (_, i) => `MX1|${type}|${batch}|${i + 1}|${n}|${s.slice(i * size, (i + 1) * size)}`);
}
function takeChunk(text){
  const m = String(text).match(/^MX1\|([A-Z])\|(\w+)\|(\d+)\|(\d+)\|([\s\S]*)$/); if(!m) return null;
  const [, type, batch, i, n, data] = m; const B = RX[batch] = RX[batch] || {type, n: +n, parts: {}}; B.parts[+i] = data;
  const got = Object.keys(B.parts).length; if(got < B.n) return {type, got, n: B.n};
  try { const obj = JSON.parse(Array.from({length: B.n}, (_, k) => B.parts[k + 1]).join('')); delete RX[batch]; return {type, obj, got, n: B.n}; }
  catch(e){ delete RX[batch]; return {type, err: 'Could not read the codes — show them again.', got, n: B.n}; }
}
async function qrCarousel(title, codes, note){
  await M.loadScript('vendor/qrcode.js');
  const svgs = codes.map(t => { const q = qrcode(0, 'M'); q.addData(t); q.make(); return q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); });
  let i = 0, run = true, tm = 0;
  M.modal(title, `<div class="qx-box"><div class="qx-qr" id="qxQ"></div>
      <div class="row" style="justify-content:center;gap:8px;margin-top:10px">${codes.length > 1 ? `<button class="btn sm" id="qxP">‹</button><span class="small" id="qxN"></span><button class="btn sm" id="qxPl">Pause</button><button class="btn sm" id="qxF">›</button>` : ''}</div>
      <div class="small muted" style="margin-top:10px;text-align:center">${note}</div></div>`, b => {
    const show = () => { $('#qxQ', b).innerHTML = svgs[i]; if($('#qxN', b)) $('#qxN', b).textContent = `Code ${i + 1} of ${codes.length}`; };
    const step = (d) => { i = (i + d + codes.length) % codes.length; show(); };
    show(); if(codes.length > 1){ tm = setInterval(() => { if(run) step(1); }, 850);
      $('#qxP', b).onclick = () => step(-1); $('#qxF', b).onclick = () => step(1); $('#qxPl', b).onclick = e => { run = !run; e.target.textContent = run ? 'Pause' : 'Play'; }; }
  });
  M.onModalClose = () => clearInterval(tm);
}
async function receive(){
  await M.loadScript('vendor/jsQR.js');
  let stream = null, raf = 0, last = 0; const seen = new Set();
  M.modal(isPhone() ? 'Receive answer key' : 'Receive scores from iPhone', `
    <div class="qx-cam"><video id="rxV" playsinline muted></video></div>
    <div id="rxOut" class="small" style="margin-top:12px;text-align:center">Point this camera at the codes on the other device's screen and hold steady — the parts are collected automatically.</div>`, async b => {
    const v = $('#rxV', b), out = $('#rxOut', b); const cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently: true});
    try { stream = await openCam(v); } catch(e){ out.innerHTML = camErr(e); return; }
    const tick = (t) => { raf = requestAnimationFrame(tick); if(t - last < 120 || v.readyState < 2) return; last = t;
      const w = Math.min(1280, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth); if(!w || !h) return;
      cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h, {inversionAttempts: 'dontInvert'}); if(!r || !r.data || seen.has(r.data)) return; seen.add(r.data);
      const c = takeChunk(r.data);
      if(!c){ out.innerHTML = `<span class="low">That is not a MASTRO transfer code.</span>`; return; }
      if(c.err){ out.innerHTML = `<span class="low">${esc(c.err)}</span>`; seen.clear(); return; }
      if(!c.obj){ out.innerHTML = `<b>${c.got} of ${c.n}</b> codes received… keep pointing at the screen.`; return; }
      cancelAnimationFrame(raf); stopCam(stream); stream = null; if(navigator.vibrate) navigator.vibrate([30, 40, 30]);
      out.innerHTML = incoming(c.type, c.obj) + `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn primary" id="rxDone">Done</button></div>`; $('#rxDone', b).onclick = M.closeModal;
    };
    raf = requestAnimationFrame(tick);
  });
  M.onModalClose = () => { cancelAnimationFrame(raf); stopCam(stream); M.route(); };
}
M.scanReceive = receive;
function incoming(type, obj){
  if(type === 'K'){ const n = importSheets(obj.sheets || []); return `✅ Answer key received: <b>${esc((obj.sheets || []).map(s => s.title).join(', '))}</b>. You can scan these sheets now.`; }
  if(type === 'R'){ importSheets(obj.sheets || []); const r = importResults(obj); return `✅ <b>${r.added}</b> new and <b>${r.updated}</b> updated score(s) received. Open <b>📊 Scores</b> on the answer sheet, then <b>⬆ Upload scores to ECR</b>.`; }
  return 'Unknown code.';
}

/* ======================= answer keys & scores ======================= */
const packSheet = (s) => ({id: s.id, title: s.title, parts: s.parts.map(p => ({n: +p.n, fmt: p.fmt, label: p.label || '', key: p.key || ''})), edited: s.edited});
function importSheets(list){ let n = 0; list.forEach(s => { if(!s || !s.id || !Array.isArray(s.parts)) return; const L = sheets(); const i = L.findIndex(x => x.id === s.id);
  const v = Object.assign({}, i >= 0 ? L[i] : {created: new Date().toISOString()}, s, {received: new Date().toISOString()}); if(i >= 0) L[i] = v; else L.push(v); n++; }); M.save(); return n; }
M.scanSendKey = (sh) => qrCarousel(`Answer key → iPhone`, chunkify('K', {sheets: [packSheet(sh)]}),
  `<b>${esc(sh.title)}</b><br>On your iPhone open MASTRO → Assessments → <b>📥 Receive key</b> (or just tap 📷 Scan) and point the camera here.`);
const recKey = (r) => [r.sheet, nm(secName(r.section)), r.lk || nm(r.name)].join('|');
function addResult(r){ const L = scans(); const i = L.findIndex(x => recKey(x) === recKey(r)); if(i >= 0){ r.id = L[i].id; L[i] = r; } else L.push(r); M.save(); return i >= 0; }
const packRec = (r) => [r.sheet, r.lk || '', r.name || '', r.section || '', r.score, r.max, r.ts, r.manual || 0];
function importResults(obj){ let added = 0, updated = 0;
  (obj.recs || []).forEach(a => { const r = {sheet: a[0], lk: a[1], name: a[2], section: a[3], score: a[4], max: a[5], ts: a[6], manual: a[7] || 0};
    if(!r.sheet) return; const ex = scans().find(x => recKey(x) === recKey(r)); if(ex && (ex.ts || 0) >= (r.ts || 0)) return;
    const sh = sheets().find(s => s.id === r.sheet);
    if(addResult(Object.assign({id: M.uid('sc'), title: sh ? sh.title : '', ans: '', from: 'phone', sent: true}, r))) updated++; else added++; });
  return {added, updated}; }
function sendScores(sh){
  const L = scans().filter(r => r.sheet === sh.id); if(!L.length) return M.toast('No scores yet');
  qrCarousel(`Send ${L.length} score(s) to MacBook`, chunkify('R', {v: 2, sheets: [packSheet(sh)], recs: L.map(packRec)}),
    'On your MacBook open MASTRO → Assessments → <b>📥 Receive scores from iPhone</b> and hold this screen about 20–30 cm in front of its camera.');
  L.forEach(r => r.sent = true); M.save();
}

/* ======================= the scanner ======================= */
async function scanner(sheet0){
  await M.loadScript('vendor/jsQR.js');
  let stream = null, raf = 0, last = 0, idle = 0, busy = false, paused = false, stable = 0, prevQ = null, skipQR = '', skipUntil = 0, saved = 0;
  M.modal(`Scan · ${sheet0 ? sheet0.title : 'answer sheets'}`, `
    <div class="omr-cam" id="scWrap"><video id="scV" playsinline muted></video><canvas id="scO"></canvas></div>
    <div id="scOut" class="small" style="margin-top:10px;text-align:center">Lay one answer sheet flat in good light. Hold the phone above it so all <b>4 black squares</b> are on the screen — it scans by itself.</div>
    <div class="row" style="justify-content:center;gap:8px;margin-top:10px"><span class="tiny muted" id="scCount"></span><label class="btn sm" id="scPhB">📸 Take photo<input type="file" id="scPh" accept="image/*" capture="environment" hidden></label><button class="btn sm" id="scDone">Done</button></div>`, async b => {
    const v = $('#scV', b), ov = $('#scO', b), out = $('#scOut', b); const cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently: true});
    const count = () => { $('#scCount', b).textContent = saved ? `${saved} saved this session` : ''; };
    $('#scDone', b).onclick = () => { M.closeModal(); if(sheet0 && saved) setTimeout(() => report(sheet0), 50); };
    try { stream = await openCam(v); } catch(e){ out.innerHTML = camErr(e) + '<div class="tiny" style="margin-top:6px">You can still use <b>📸 Take photo</b>.</div>'; $('#scWrap', b).hidden = true; }
    const drawQuad = (q, ok) => { const r = v.getBoundingClientRect(); ov.width = r.width; ov.height = r.height; const g = ov.getContext('2d'); g.clearRect(0, 0, ov.width, ov.height); if(!q) return;
      const k = Math.min(r.width / v.videoWidth, r.height / v.videoHeight), ox = (r.width - v.videoWidth * k) / 2, oy = (r.height - v.videoHeight * k) / 2;
      g.strokeStyle = ok ? '#2bd47d' : '#f5c242'; g.lineWidth = 4; g.beginPath(); q.forEach((p, i) => i ? g.lineTo(ox + p.x * k, oy + p.y * k) : g.moveTo(ox + p.x * k, oy + p.y * k)); g.closePath(); g.stroke(); };
    const tick = (t) => { raf = requestAnimationFrame(tick); if(paused || busy || t - last < 160 || v.readyState < 2 || !v.videoWidth) return; last = t;
      const w = v.videoWidth, h = v.videoHeight; cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const img = cx.getImageData(0, 0, w, h); const g0 = O().toGray(img.data, w, h, 1000); const best = O().findMarkers(g0);
      if(!best){ stable = 0; prevQ = null; drawQuad(null);
        if(idle === 25) out.innerHTML = `Looking for the <b>4 black squares</b>… Keep the whole sheet on screen, flat, with no shadow on the corners. Still nothing? Tap <b>📸 Take photo</b>.`;
        if(++idle % 4 === 0){ const k = Math.min(1, 900 / Math.max(w, h)), sw = Math.round(w * k), shh = Math.round(h * k); const c2 = document.createElement('canvas'); c2.width = sw; c2.height = shh; const x2 = c2.getContext('2d'); x2.drawImage(v, 0, 0, sw, shh);
          const r = jsQR(x2.getImageData(0, 0, sw, shh).data, sw, shh, {inversionAttempts: 'dontInvert'});
          if(r && r.data.startsWith('MX1|')){ const c = takeChunk(r.data); if(c && c.obj && c.type === 'K'){ importSheets(c.obj.sheets || []); out.innerHTML = `✅ Answer key received: <b>${esc((c.obj.sheets || []).map(x => x.title).join(', '))}</b>. Now scan the papers.`; }
            else if(c && !c.obj && !c.err) out.innerHTML = `Receiving the answer key… ${c.got} of ${c.n}`; } }
        return; }
      if(idle >= 25){ idle = 0; out.innerHTML = 'Squares found — hold steady…'; }
      const moved = prevQ ? Math.max(...best.q.map((p, i) => Math.hypot(p.x - prevQ[i].x, p.y - prevQ[i].y))) / Math.max(w, h) : 1; prevQ = best.q;
      stable = moved < 0.01 ? stable + 1 : 0; drawQuad(best.q, stable >= 2);
      if(stable < 2) return;
      busy = true; try { grade(img, w, h, best); } catch(e){ console.error(e); out.innerHTML = `<span class="low">Could not read that sheet — try again.</span>`; } busy = false; };
    const grade = (img, w, h, best) => {
      const G = O().toGray(img.data, w, h); const or = O().locate(G, best); if(!or){ stable = 0; out.innerHTML = 'Squares found but the sheet is not clear yet — move so the whole sheet fills the screen, avoid glare and shadows.'; return false; }
      let qr = null; for(const p of [8, 10, 6]){ const q = O().qrCrop(G, or.H, p); qr = jsQR(q.data, q.w, q.h, {inversionAttempts: 'dontInvert'}); if(qr) break; }
      if(!qr) qr = jsQR(img.data, w, h, {inversionAttempts: 'dontInvert'});
      if(!qr){ out.innerHTML = `Paper found — move a little closer so the code can be read.`; stable = 0; return false; }
      const m = qr.data.split('|'); if(m[0] !== 'MA2'){ out.innerHTML = `<span class="low">This is not a MASTRO answer sheet${m[0] === 'MA1' ? ' of the new kind — reprint it' : ''}.</span>`; return false; }
      if(qr.data === skipQR && Date.now() < skipUntil) return;
      const sh = sheets().find(s => s.id === m[1]);
      if(!sh){ out.innerHTML = `<span class="low">This sheet's answer key is not on this phone.</span> On your MacBook tap ⋯ → <b>📱 Send key to iPhone</b> on that answer sheet, then point this camera at the MacBook screen.`; return; }
      const L = O().layout(sh.parts); const res = O().read(G, or.H, L); const key = M.asKey(sh); const sc = O().score(res, key);
      paused = true; if(navigator.vibrate) navigator.vibrate(40); $('#scWrap', b).hidden = true;
      showResult(sh, {lk: m[2] || '', name: m[3] || '', section: m[4] || ''}, sc, key, L, qr.data); return true;
    };
    // still-photo fallback: full camera resolution, no need to hold steady
    $('#scPh', b).onchange = e => { const f = e.target.files[0]; e.target.value = ''; if(!f) return; out.innerHTML = 'Reading the photo…';
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
        cv.width = w; cv.height = h; cx.drawImage(im, 0, 0, w, h); const img = cx.getImageData(0, 0, w, h);
        const best = O().findMarkers(O().toGray(img.data, w, h, 1000));
        if(!best){ out.innerHTML = '<span class="low">Could not find the 4 black squares in that photo.</span> Take it from straight above, whole sheet in the picture, no shadow on the corners.'; return; }
        busy = true; try { grade(img, w, h, best); } catch(er){ console.error(er); out.innerHTML = '<span class="low">Could not read that photo — try again.</span>'; } busy = false; };
      im.onerror = () => { URL.revokeObjectURL(url); out.innerHTML = '<span class="low">Could not open that photo.</span>'; }; im.src = url; };
    const showResult = (sh, who, sc, key, L, qrText) => {
      const lines = L.items.filter(it => it.line).length; const marks = sc.marks; let manual = 0;
      let name = who.name, section = who.section || (M.S.ui.scanSec || '');
      const total = () => marks.filter(x => x.ok).length + manual;
      const resume = () => { paused = false; stable = 0; $('#scWrap', b).hidden = false; count(); };
      const draw = () => {
        const dup = name ? scans().find(r => recKey(r) === recKey({sheet: sh.id, section, lk: who.lk, name})) : null;
        out.innerHTML = `<div class="sc-res">
          <div class="row" style="gap:10px;align-items:center"><div class="grow" style="text-align:left"><div class="title"><b>${name ? esc(name) : 'Blank sheet — whose paper?'}</b></div><div class="tiny muted">${esc(section || 'No section')}${sheet0 && sh.id !== sheet0.id ? ` · <b>${esc(sh.title)}</b>` : ''}</div></div>
            <div class="sc-score"><b>${total()}</b><span>/ ${L.n}</span></div></div>
          ${!who.name ? `<div class="row" style="gap:6px;margin-top:8px"><input class="input" id="srN" list="srNL" placeholder="Learner's name (Last, First)" style="flex:2"><input class="input" id="srS" list="srSL" placeholder="Section" style="flex:1"></div>
            <datalist id="srNL">${knownNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist><datalist id="srSL">${[...new Set(scans().map(r => r.section).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>` : ''}
          <div class="tiny muted" style="margin:8px 0 4px;text-align:left">${sc.right} correct · ${sc.wrong} wrong${sc.blank ? ` · ${sc.blank} blank` : ''}${sc.multi ? ` · ${sc.multi} with 2 marks` : ''}${key.filter(Boolean).length < marks.filter(x => !x.line).length ? ' · <span class="low">answer key incomplete</span>' : ''} — tap an item to fix a misread.</div>
          <div class="sc-grid">${marks.map((x, i) => x.line ? '' : `<button class="sc-it ${x.ok ? 'ok' : x.ans === '' ? 'bl' : x.ans === '*' ? 'mu' : 'no'}" data-i="${i}"><i>${x.no}</i>${x.ans === '*' ? '2×' : x.ans || '–'}</button>`).join('')}</div>
          ${lines ? `<div class="row" style="justify-content:center;gap:8px;margin-top:10px"><span class="small">Write-in items correct</span><button class="btn sm" id="srMm">−</button><b>${manual}</b><button class="btn sm" id="srMp">+</button><span class="small muted">of ${lines}</span></div>` : ''}
          ${dup ? `<div class="tiny" style="margin-top:8px;color:var(--amber)">Already scanned (${dup.score}/${dup.max}) — saving replaces it.</div>` : ''}
          <div class="row" style="justify-content:center;gap:8px;margin-top:12px"><button class="btn" id="srAg">↻ Rescan</button><button class="btn primary" id="srOk">${ico('save')} Save &amp; next</button></div></div>`;
        if($('#srN', out)){ $('#srN', out).value = name; $('#srS', out).value = section; $('#srN', out).onchange = e => { name = e.target.value.trim(); draw(); }; $('#srS', out).onchange = e => { section = e.target.value.trim(); draw(); }; }
        $$('.sc-it', out).forEach(x => x.onclick = () => { const mk = marks[+x.dataset.i]; const ch = [...L.items[+x.dataset.i].bub.map(bb => bb.L), ''];
          mk.ans = ch[(ch.indexOf(mk.ans === '*' ? '' : mk.ans) + 1) % ch.length]; mk.ok = !!mk.key && mk.ans === mk.key; draw(); });
        if($('#srMm', out)){ $('#srMm', out).onclick = () => { manual = Math.max(0, manual - 1); draw(); }; $('#srMp', out).onclick = () => { manual = Math.min(lines, manual + 1); draw(); }; }
        $('#srAg', out).onclick = () => { resume(); out.innerHTML = 'Hold the sheet steady…'; };
        $('#srOk', out).onclick = () => { if($('#srN', out)){ name = $('#srN', out).value.trim(); section = $('#srS', out).value.trim(); } if(!name){ M.toast('Type the learner’s name first'); return; }
          if(!who.section && section) M.S.ui.scanSec = section;
          addResult({id: M.uid('sc'), sheet: sh.id, title: sh.title, lk: who.lk, name, section, score: total(), max: L.n, right: marks.filter(x => x.ok).length, manual,
            ans: marks.map(x => x.line ? '_' : x.ans === '' ? '.' : x.ans).join(''), ts: Date.now(), sent: false});
          saved++; M.toast(`${name.split(',')[0]} · ${total()}/${L.n} saved`);
          skipQR = qrText; skipUntil = Date.now() + 4000; resume(); out.innerHTML = 'Next paper…'; };
      };
      draw();
    };
    if(stream) raf = requestAnimationFrame(tick);
  }, true);
  M.onModalClose = () => { cancelAnimationFrame(raf); if(stream) stopCam(stream); M.route(); };
}
M.scanOpen = scanner;
function knownNames(){ const out = new Set();
  (M.S.ecr || []).forEach(E => { const R = E.model && E.model.roster; (R ? [...(R.M || []), ...(R.F || [])] : Object.values(E.terms || {}).flatMap(T => (T.learners || []).map(x => x.name))).forEach(n => n && out.add(String(n).replace(/\s*,\s*/, ', '))); });
  (M.S.classes || []).forEach(c => (c.learners || []).forEach(l => out.add(l.name))); return [...out].sort(); }

/* ======================= scores per section ======================= */
function bySection(sh){ const G = {}; scans().filter(r => r.sheet === sh.id).forEach(r => { const k = secName(r.section); (G[k] = G[k] || []).push(r); });
  Object.values(G).forEach(L => L.sort((a, b) => a.name.localeCompare(b.name))); return G; }
function stats(L, max){ if(!L.length) return null; const v = L.map(r => r.score); const mean = v.reduce((a, x) => a + x, 0) / v.length;
  return {n: v.length, mean, mps: max ? mean / max * 100 : 0, hi: Math.max(...v), lo: Math.min(...v), pass: v.filter(x => max && x / max >= 0.75).length}; }
function report(sh){
  const max = M.asTotal(sh); let sel = null;
  M.modal(`Scores · ${sh.title}`, `<div id="rpBody"></div>`, b => {
    const draw = () => { const G = bySection(sh); const secs = Object.keys(G).sort(); if(!secs.includes(sel)) sel = secs[0] || null;
      if(!secs.length){ $('#rpBody', b).innerHTML = `<div class="empty">No papers scanned yet. Tap <b>📷 Scan</b> on this answer sheet.</div>`; return; }
      const L = G[sel], st = stats(L, max);
      $('#rpBody', b).innerHTML = `
        <div class="seg" id="rpSec" style="flex-wrap:wrap">${secs.map(s => `<button data-s="${esc(s)}" class="${s === sel ? 'on' : ''}">${esc(s)} <span class="tiny muted">${G[s].length}</span></button>`).join('')}</div>
        <div class="rp-stats">${[['Papers', st.n], ['Mean', M.r2(st.mean)], ['MPS', M.r2(st.mps) + '%'], ['Highest', st.hi], ['Lowest', st.lo], ['75% and up', st.pass]].map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div>
        <div class="table-wrap" style="max-height:50vh"><table><thead><tr><th>#</th><th>Learner</th><th class="num">Score</th><th class="num">%</th><th></th></tr></thead><tbody>
          ${L.map((r, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(r.name)}</td><td class="num"><b>${r.score}</b> / ${r.max}</td><td class="num">${Math.round(r.score / (r.max || max) * 100)}${r.ecr ? ` <span class="tiny" title="Uploaded to the ECR · Term ${r.ecr.term} · ${r.ecr.comp.toUpperCase()}" style="color:var(--green)">✓ ECR</span>` : ''}</td><td><button class="icon-btn" data-del="${r.id}" title="Delete this score">✕</button></td></tr>`).join('')}
        </tbody></table></div>
        <div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap"><button class="btn primary" id="rpE">⬆ Upload scores to ECR</button><button class="btn" id="rpX">${ico('download')} Download Excel</button><button class="btn" id="rpP">${ico('print')} Print</button>
          ${isPhone() ? `<button class="btn" id="rpSend">📤 Send to MacBook</button>` : ''}<span class="spacer"></span><button class="btn" id="rpC">Close</button></div>`;
      $('#rpSec', b).onclick = e => { const x = e.target.closest('button'); if(!x) return; sel = x.dataset.s; draw(); };
      $$('[data-del]', b).forEach(x => x.onclick = () => { if(!confirm('Delete this score?')) return; M.S.scans = scans().filter(r => r.id !== x.dataset.del); M.save(); draw(); });
      $('#rpX', b).onclick = () => downloadXlsx(sh, G);
      $('#rpE', b).onclick = () => { M.closeModal(); setTimeout(() => toEcr(sh, sel, G[sel]), 60); }; $('#rpP', b).onclick = () => printReport(sh, sel, L, st);
      if($('#rpSend', b)) $('#rpSend', b).onclick = () => sendScores(sh);
      $('#rpC', b).onclick = M.closeModal; };
    draw();
  }, true);
  M.onModalClose = () => M.route();
}
M.scanReport = report;
/* ---------- upload one section's scores into an ECR column (ST1 · ST2 · TE of a term) ---------- */
const COMPS = [['st1','ST1 · Summative Test 1'], ['st2','ST2 · Summative Test 2'], ['te','TE · Term Examination']];
const rosterOf = (E) => ['M','F'].flatMap(sx => ((E.model && E.model.roster && E.model.roster[sx]) || []).map((n, i) => n ? {slot: sx + i, name: String(n).replace(/\s*,\s*/, ', '), sex: sx} : null).filter(Boolean));
const fold = (s) => nm(String(s || '').replace(/[–—]/g, '-').normalize('NFD').replace(/[̀-ͯ]/g, ''));
function matchSlot(R, name){ const want = fold(name); if(!want) return '';
  const hit = R.find(x => fold(x.name) === want) || (want.length >= 8 && R.find(x => fold(x.name).startsWith(want) || want.startsWith(fold(x.name)))); return hit ? hit.slot : ''; }
async function toEcr(sh, sec, list){
  const ECR = M.S.ecr || []; const u = M.S.ui.toEcr = M.S.ui.toEcr || {term: '1', comp: 'st1'};
  if(!ECR.length){ M.modal('Upload scores to ECR', `<div class="empty">No class records yet. Add your ECRs in <b>Classes</b> first.</div>`); return; }
  const secU = String(sec || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const guess = ECR.find(E => secU && String(E.section || '').toUpperCase().replace(/[^A-Z0-9]/g, '') && secU.endsWith(String(E.section).toUpperCase().replace(/[^A-Z0-9]/g, ''))) || ECR[0];
  let E = guess, R = [], map = {};
  M.modal(`Upload scores to ECR · ${sec}`, `
    <div class="small muted" style="margin-top:0"><b>${esc(sh.title)}</b> · ${list.length} paper(s) · ${M.asTotal(sh)} items</div>
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px;align-items:flex-end">
      <label class="field" style="flex:1;min-width:200px">Class record (section)<select class="input" id="teE">${ECR.map(x => `<option value="${x.id}" ${x === guess ? 'selected' : ''}>${esc(x.title || ('Grade ' + x.grade + ' – ' + x.section))}${x.subject ? ' · ' + esc(x.subject) : ''}</option>`).join('')}</select></label>
      <label class="field">Term<div class="seg" id="teT">${['1','2','3'].map(t => `<button data-t="${t}" class="${t === u.term ? 'on' : ''}">Term ${t}</button>`).join('')}</div></label></div>
    <label class="field" style="margin-top:10px">Column<div class="seg" id="teC" style="flex-wrap:wrap">${COMPS.map(([k, t]) => `<button data-c="${k}" class="${k === u.comp ? 'on' : ''}">${t}</button>`).join('')}</div></label>
    <label class="row small" style="gap:6px;margin-top:10px;cursor:pointer"><input type="checkbox" id="teH" checked> Set the highest possible score of this column to <b>${M.asTotal(sh)}</b></label>
    <div id="teBody" style="margin-top:12px"><div class="empty">Opening the ECR…</div></div>
    <div class="row" style="margin-top:14px"><span class="small muted" id="teInfo"></span><span class="spacer"></span><button class="btn" id="teX">Cancel</button><button class="btn primary" id="teGo">⬆ Upload to ECR</button></div>`, async b => {
    const draw = () => { const ok = list.filter(r => map[r.id]).length;
      $('#teBody', b).innerHTML = !R.length ? `<div class="empty">This ECR has no learner list yet.</div>` : `<div class="table-wrap" style="max-height:42vh"><table><thead><tr><th>Scanned name</th><th class="num">Score</th><th>Row in the ECR</th><th class="num">Now in ECR</th></tr></thead><tbody>
        ${list.map(r => { const cur = map[r.id] ? M.ecrGetScore(E, u.term, u.comp, map[r.id]) : null;
          return `<tr><td>${esc(r.name)}</td><td class="num"><b>${r.score}</b></td><td><select class="input" data-m="${r.id}" style="width:100%;padding:5px 8px">${`<option value="">— not uploaded —</option>`}${R.map(x => `<option value="${x.slot}" ${map[r.id] === x.slot ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></td><td class="num ${cur != null && cur !== '' && map[r.id] ? 'low' : 'muted'}">${cur != null && cur !== '' ? cur : '—'}</td></tr>`; }).join('')}
        </tbody></table></div>`;
      $('#teInfo', b).innerHTML = `${ok} of ${list.length} matched${list.length - ok ? ` · <span class="low">${list.length - ok} not matched — pick the row or leave it</span>` : ''}`;
      $$('[data-m]', b).forEach(x => x.onchange = () => { map[x.dataset.m] = x.value; draw(); }); };
    const load = async () => { $('#teBody', b).innerHTML = '<div class="empty">Opening the ECR…</div>';
      try { await M.ecrEnsureModel(E); } catch(e){}
      if(!E.model){ $('#teBody', b).innerHTML = `<div class="empty"><span class="low">The ECR file of ${esc(E.title)} is not on this device.</span></div>`; R = []; return; }
      if(!E.model.terms[u.term]){ $('#teBody', b).innerHTML = `<div class="empty"><span class="low">${esc(E.title)} has no Term ${u.term} sheet.</span></div>`; R = []; return; }
      R = rosterOf(E); map = {}; list.forEach(r => { map[r.id] = matchSlot(R, r.name); }); draw(); };
    $('#teE', b).onchange = e => { E = ECR.find(x => x.id === e.target.value); load(); };
    $('#teT', b).onclick = e => { const x = e.target.closest('button'); if(!x) return; u.term = x.dataset.t; $$('#teT button', b).forEach(y => y.classList.toggle('on', y === x)); M.save(); load(); };
    $('#teC', b).onclick = e => { const x = e.target.closest('button'); if(!x) return; u.comp = x.dataset.c; $$('#teC button', b).forEach(y => y.classList.toggle('on', y === x)); M.save(); if(R.length) draw(); };
    $('#teX', b).onclick = M.closeModal;
    $('#teGo', b).onclick = () => { const sc = {}; list.forEach(r => { if(map[r.id]) sc[map[r.id]] = r.score; }); const n = Object.keys(sc).length;
      if(!n) return M.toast('No learner is matched to an ECR row');
      const over = list.filter(r => { const c = map[r.id] && M.ecrGetScore(E, u.term, u.comp, map[r.id]); return c != null && c !== '' && +c !== r.score; }).length;
      if(over && !confirm(`${over} learner(s) already have a different ${u.comp.toUpperCase()} score in this ECR. Replace them?`)) return;
      try { M.ecrPutScores(E, u.term, u.comp, sc, $('#teH', b).checked ? M.asTotal(sh) : null); }
      catch(e){ alert(e.message); return; }
      list.forEach(r => { if(map[r.id]) { r.ecr = {id: E.id, term: u.term, comp: u.comp, at: Date.now()}; } }); M.save();
      M.closeModal(); M.toast(`✓ ${n} score(s) uploaded to ${E.title} · Term ${u.term} · ${u.comp.toUpperCase()}`); };
    await load();
  }, true);
}
function downloadXlsx(sh, G){
  const max = M.asTotal(sh); const wb = XLSX.utils.book_new(); const school = M.S.settings.school || '';
  Object.keys(G).sort().forEach(sec => { const L = G[sec], st = stats(L, max);
    const aoa = [[school], [sh.title], [`Section: ${sec}`, '', '', `Items: ${max}`], [], ['No.', 'Name of Learner', 'Score', '%'],
      ...L.map((r, i) => [i + 1, r.name, r.score, Math.round(r.score / (r.max || max) * 100)]), [],
      ['', 'Number of papers', st.n], ['', 'Mean', M.r2(st.mean)], ['', 'MPS (%)', M.r2(st.mps)], ['', 'Highest', st.hi], ['', 'Lowest', st.lo]];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{wch: 5}, {wch: 36}, {wch: 8}, {wch: 8}];
    XLSX.utils.book_append_sheet(wb, ws, sec.replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || 'Section'); });
  XLSX.writeFile(wb, `${sh.title.replace(/[\\\/:*?"<>|]/g, ' ')} - scores.xlsx`);
}
function printReport(sh, sec, L, st){
  const max = M.asTotal(sh);
  const html = `<div class="rp-print"><div class="c"><b>${esc(M.S.settings.school || '')}</b></div><div class="c t">${esc(sh.title)}</div><div class="c">Section: <b>${esc(sec)}</b> · ${max} items</div>
    <table><thead><tr><th>No.</th><th>Name of Learner</th><th>Score</th><th>%</th></tr></thead><tbody>${L.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r.name)}</td><td>${r.score}</td><td>${Math.round(r.score / (r.max || max) * 100)}</td></tr>`).join('')}</tbody></table>
    <div class="s">Papers: <b>${st.n}</b> &nbsp; Mean: <b>${M.r2(st.mean)}</b> &nbsp; MPS: <b>${M.r2(st.mps)}%</b> &nbsp; Highest: <b>${st.hi}</b> &nbsp; Lowest: <b>${st.lo}</b></div></div>`;
  M.doPrint(html, M.pageCss('A4'), {noFit: true, safe: false});
}
})();
