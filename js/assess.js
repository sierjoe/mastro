/* MASTRO — Assessments: printable answer sheets (with each learner's name and a QR marker),
   scanning by camera or photo (optical mark reading), and scores written straight into the ECR
   column you chose (Written Work 1–5, Summative Test 1–2 or Term Examination). */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum} = M;

const COMPS = [['ww1','Written Work 1'],['ww2','Written Work 2'],['ww3','Written Work 3'],['ww4','Written Work 4'],['ww5','Written Work 5'],['st1','Summative Test 1'],['st2','Summative Test 2'],['te','Term Examination']];
const compLabel = (k) => (COMPS.find(x => x[0] === k) || [k, k.toUpperCase()])[1];
const compShort = (k) => /^ww/.test(k) ? 'WW ' + k.slice(2) : k === 'te' ? 'TE' : k.toUpperCase().replace('ST', 'ST ');
const ecrOf = (a) => M.S.ecr.find(e => e.id === a.ecrId);
const roster = (E) => { const m = E && E.model; if(!m) return []; const out = []; ['M','F'].forEach(sx => m.roster[sx].forEach((n, i) => { if(n) out.push({slot: sx + i, sx, i, name: n.replace(/\s*,\s*/, ', ')}); })); return out; };
const keyDone = (a) => a.key && a.key.length === a.n && !/[^A-E]/.test(a.key);
const scoreOf = (a, ans) => { if(!keyDone(a)) return null; let s = 0; for(let i=0;i<a.n;i++) if(ans[i] && ans[i] === a.key[i]) s++; return s; };

/* =====================================================================
   SHEET LAYOUT (millimetres) — the same numbers are used to print and to scan
   ===================================================================== */
const MS = 6, MI = 3, QS = 17, D = 3.4, PX = 4.6, NUMW = 6;
function format(a){
  const no = a.opts.length, colW = NUMW + no * PX + 2;
  const cap = (W) => Math.min(Math.floor((W - 10) / colW), 6) * 20;
  return a.n <= cap(99) ? {W:99, H:142.5, per:4} : {W:198, H:142.5, per:2};
}
M.asmLayout = function(a){
  const {W, H, per} = format(a); const no = a.opts.length;
  const markers = [[MI+MS/2, MI+MS/2], [W-MI-MS/2, MI+MS/2], [W-MI-MS/2, H-MI-MS/2], [MI+MS/2, H-MI-MS/2]];   // TL TR BR BL
  const qr = {x: W - MI - QS, y: 11, s: QS};
  const colW = NUMW + no * PX + 2, top = 42, bottom = H - 11;
  const cols = Math.max(1, Math.ceil(a.n / 20)), rows = Math.ceil(a.n / cols);
  const pitchY = Math.min(5.6, (bottom - top) / rows);
  const x0 = (W - (cols * colW - 2)) / 2;
  const items = [...Array(a.n).keys()].map(i => { const c = Math.floor(i / rows), r = i % rows; const bx = x0 + c * colW;
    return {no: i + 1, nx: bx + NUMW - 0.9, y: top + r * pitchY + pitchY / 2, opts: [...Array(no).keys()].map(o => [bx + NUMW + PX/2 + o * PX, top + r * pitchY + pitchY / 2])}; });
  return {W, H, per, markers, qr, items, cols, rows, colW, x0, top, pitchY};
};

/* ---------- one answer sheet as SVG ---------- */
const fitText = (txt, maxW, size) => { const w = String(txt).length * size * 0.56; return w > maxW ? Math.max(size * 0.62, size * maxW / w) : size; };
M.asmSheetSvg = function(a, person, qrMatrix){
  const L = M.asmLayout(a); const E = ecrOf(a);
  const tx = (x, y, s, t, o = '') => `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${s.toFixed(2)}" ${o}>${esc(t)}</text>`;
  let g = `<rect x="0" y="0" width="${L.W}" height="${L.H}" fill="#fff"/>`;
  L.markers.forEach(([x, y]) => g += `<rect x="${x-MS/2}" y="${y-MS/2}" width="${MS}" height="${MS}" fill="#000"/>`);
  // QR (drawn module by module so it always prints)
  if(qrMatrix){ const n = qrMatrix.length, m = L.qr.s / n; let p = '';
    for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qrMatrix[r][c]) p += `M${(L.qr.x + c*m).toFixed(3)} ${(L.qr.y + r*m).toFixed(3)}h${m.toFixed(3)}v${m.toFixed(3)}h-${m.toFixed(3)}z`;
    g += `<path d="${p}" fill="#000"/>`; }
  const tw = L.qr.x - 13;
  g += tx(11, 7.6, 2.1, 'MASTRO · ANSWER SHEET', 'fill="#555" letter-spacing="0.35"');
  g += tx(11, 12.6, fitText(a.title, tw, 3.3), a.title, 'font-weight="700"');
  const sub = `${E ? E.title : ''}${E && E.subject ? ' · ' + E.subject : ''} · Term ${a.term} · ${compShort(a.comp)} · ${a.n} items`;
  g += tx(11, 16.8, fitText(sub, tw, 2.35), sub, 'fill="#333"');
  g += tx(11, 22.4, 2, 'NAME', 'fill="#666" letter-spacing="0.3"');
  const nm = person ? person.name : '';
  g += tx(11, 27.4, fitText(nm || ' ', tw, 3.7), nm, 'font-weight="700"');
  g += `<line x1="11" y1="28.6" x2="${L.qr.x - 2}" y2="28.6" stroke="#000" stroke-width="0.2"/>`;
  g += tx(11, 32.4, 2.2, person ? `${person.sx === 'M' ? 'Male' : 'Female'} · No. ${person.i + 1}${a.date ? ' · ' + a.date : ''}` : 'Write your name above', 'fill="#333"');
  g += tx(11, 36.4, 1.95, 'Shade one circle per item completely. Do not fold or write on the black squares.', 'fill="#555"');
  // bubbles
  const no = a.opts.length; const letters = a.opts.split('');
  for(let c=0;c<L.cols;c++){ const bx = L.x0 + c * L.colW; letters.forEach((ch, o) => g += tx(bx + NUMW + PX/2 + o*PX, L.top - 1.2, 2, ch, 'text-anchor="middle" font-weight="700" fill="#333"')); }
  L.items.forEach(it => {
    g += tx(it.nx, it.y + 0.85, 2.4, it.no, 'text-anchor="end" font-weight="700"');
    it.opts.forEach(([x, y], o) => { g += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${D/2}" fill="none" stroke="#000" stroke-width="0.26"/>`; g += tx(x, y + 0.62, 1.75, letters[o], 'text-anchor="middle" fill="#9a9a9a"'); });
  });
  g += tx(L.W/2, L.H - 4.6, 2.2, `Score: ______ / ${a.n}`, 'text-anchor="middle" fill="#333"');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="omr-sheet" viewBox="0 0 ${L.W} ${L.H}" width="${L.W}mm" height="${L.H}mm" font-family="Arial, Helvetica, sans-serif">${g}</svg>`;
};
async function qrFor(a, slot){
  await M.loadScript('vendor/qrcode.js');
  const q = qrcode(0, 'M'); q.addData(`MSA:${a.code}:${slot}`); q.make();
  const n = q.getModuleCount(); return [...Array(n).keys()].map(r => [...Array(n).keys()].map(c => q.isDark(r, c)));
}
// A4 pages with 4 (or 2) sheets each, cut lines between them
M.quadPages = function(cells, w, h, per){
  const pages = []; const pos = per === 4 ? [[6,6],[6+w,6],[6,6+h],[6+w,6+h]] : [[6,6],[6,6+h]];
  for(let i=0;i<cells.length;i+=per){ const chunk = cells.slice(i, i+per);
    pages.push(`<div class="quad-page">${per === 4 ? '<i class="cut v"></i><i class="cut h"></i>' : '<i class="cut h"></i>'}${chunk.map((c, k) => `<div class="quad-cell" style="left:${pos[k][0]}mm;top:${pos[k][1]}mm;width:${w}mm;height:${h}mm">${c}</div>`).join('')}</div>`); }
  return pages.join('');
};
async function printSheets(a, people){
  if(!people.length) return M.toast('No learners to print');
  const F = format(a); const cells = [];
  for(const p of people) cells.push(M.asmSheetSvg(a, p, await qrFor(a, p.slot)));
  M.doPrint(M.quadPages(cells, F.W, F.H, F.per), '@page{size:A4 portrait;margin:0}');
  M.toast(`${people.length} answer sheet(s) · ${F.per} per A4 page — print at 100% / actual size`);
}

/* =====================================================================
   SCANNING (optical mark reading)
   ===================================================================== */
function solve(A, b){ const n = b.length; const m = A.map((r, i) => [...r, b[i]]);
  for(let c=0;c<n;c++){ let p = c; for(let r=c+1;r<n;r++) if(Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r; if(Math.abs(m[p][c]) < 1e-12) return null; [m[c], m[p]] = [m[p], m[c]];
    for(let r=0;r<n;r++){ if(r === c) continue; const f = m[r][c] / m[c][c]; for(let k=c;k<=n;k++) m[r][k] -= f * m[c][k]; } }
  return m.map((r, i) => r[n] / r[i]); }
function homography(src, dst){ const A = [], b = [];
  for(let i=0;i<4;i++){ const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v*x, -v*y]); b.push(v); }
  const h = solve(A, b); if(!h) return null; h.push(1); return h; }
const hap = (h, x, y) => { const w = h[6]*x + h[7]*y + h[8]; return [(h[0]*x + h[1]*y + h[2]) / w, (h[3]*x + h[4]*y + h[5]) / w]; };
const dist = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1]);
function inPoly(pt, poly){ let ins = false; for(let i=0, j=poly.length-1; i<poly.length; j=i++){ const [xi, yi] = poly[i], [xj, yj] = poly[j]; if(((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }

// returns {ok, a, slot, ans, marks, H, ...} — `pick` lets you name the assessment when there is no QR
M.omrRead = async function(canvas, pick){
  await M.loadScript('vendor/jsQR.js');
  const w = canvas.width, h = canvas.height; const cx = canvas.getContext('2d', {willReadFrequently:true});
  const img = cx.getImageData(0, 0, w, h); const d = img.data;
  // 1) QR: which assessment and which learner
  let q = jsQR(d, w, h, {inversionAttempts:'dontInvert'}); let a = null, slot = null;
  if(q && /^MSA:/.test(q.data)){ const [, code, sl] = q.data.split(':'); a = M.S.asm.find(x => x.code === code); slot = sl; if(!a) return {ok:false, why:'This answer sheet belongs to an assessment that is not on this device.'}; }
  else q = null;
  if(!a){ if(pick && pick.a){ a = pick.a; slot = pick.slot || null; } else return {ok:false, why:'QR code not found — hold the sheet flat, fill the frame and avoid glare.'}; }
  const L = M.asmLayout(a);
  // 2) dark-pixel mask (adaptive) and connected blobs
  const g = new Uint8Array(w*h); for(let i=0, j=0; i<g.length; i++, j+=4) g[i] = (d[j]*77 + d[j+1]*150 + d[j+2]*29) >> 8;
  const W1 = w + 1; const I = new Uint32Array(W1 * (h + 1));
  for(let y=1;y<=h;y++){ let row = 0; for(let x=1;x<=w;x++){ row += g[(y-1)*w + x-1]; I[y*W1 + x] = I[(y-1)*W1 + x] + row; } }
  const R = Math.max(12, Math.round(Math.min(w, h) / 9));
  const meanAt = (x, y) => { const x0 = Math.max(0, x-R), x1 = Math.min(w, x+R+1), y0 = Math.max(0, y-R), y1 = Math.min(h, y+R+1); return (I[y1*W1+x1] - I[y0*W1+x1] - I[y1*W1+x0] + I[y0*W1+x0]) / ((x1-x0)*(y1-y0)); };
  const dark = new Uint8Array(w*h); for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const v = g[y*w+x]; if(v < 170 && v < meanAt(x, y) * 0.72) dark[y*w+x] = 1; }
  const lab = new Int32Array(w*h); const blobs = []; const st = new Int32Array(w*h);
  for(let s0=0;s0<w*h;s0++){ if(!dark[s0] || lab[s0]) continue; const id = blobs.length + 1; let sp = 0; st[sp++] = s0; lab[s0] = id;
    let n = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while(sp){ const p = st[--sp]; const x = p % w, y = (p / w) | 0; n++; sx += x; sy += y; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      if(x > 0 && dark[p-1] && !lab[p-1]){ lab[p-1] = id; st[sp++] = p-1; } if(x < w-1 && dark[p+1] && !lab[p+1]){ lab[p+1] = id; st[sp++] = p+1; }
      if(y > 0 && dark[p-w] && !lab[p-w]){ lab[p-w] = id; st[sp++] = p-w; } if(y < h-1 && dark[p+w] && !lab[p+w]){ lab[p+w] = id; st[sp++] = p+w; } }
    blobs.push({n, c:[sx/n, sy/n], bw: x1-x0+1, bh: y1-y0+1}); }
  // 3) the four corner squares
  let scale = null, qrPoly = null, qrC = null;
  if(q){ const lo = q.location; qrPoly = [[lo.topLeftCorner.x, lo.topLeftCorner.y], [lo.topRightCorner.x, lo.topRightCorner.y], [lo.bottomRightCorner.x, lo.bottomRightCorner.y], [lo.bottomLeftCorner.x, lo.bottomLeftCorner.y]];
    scale = (dist(qrPoly[0], qrPoly[1]) + dist(qrPoly[1], qrPoly[2]) + dist(qrPoly[2], qrPoly[3]) + dist(qrPoly[3], qrPoly[0])) / 4 / QS;
    qrC = qrPoly.reduce((s, p) => [s[0] + p[0]/4, s[1] + p[1]/4], [0, 0]); }
  const grow = (poly, k) => { const c = poly.reduce((s, p) => [s[0] + p[0]/4, s[1] + p[1]/4], [0, 0]); return poly.map(p => [c[0] + (p[0]-c[0])*k, c[1] + (p[1]-c[1])*k]); };
  let cand = blobs.filter(b => { const ar = b.bw / b.bh; return b.n >= 30 && ar > 0.45 && ar < 2.2 && b.n / (b.bw * b.bh) > 0.42; });
  if(scale){ const exp = (MS * scale) ** 2; cand = cand.filter(b => b.n > exp * 0.35 && b.n < exp * 2.4 && !inPoly(b.c, grow(qrPoly, 1.25))); }
  else { cand.sort((x, y) => y.n - x.n); const ref = cand[3] ? cand[3].n : 0; cand = cand.filter(b => b.n > ref * 0.45 && b.n < ref * 3); }
  if(cand.length < 4) return {ok:false, why:'The four black corner squares were not found — show the whole answer sheet.', a, slot};
  if(qrC) cand.sort((x, y) => dist(x.c, qrC) - dist(y.c, qrC)); cand = cand.slice(0, 11);
  const S = L.markers; const qrS = [[L.qr.x, L.qr.y], [L.qr.x + QS, L.qr.y], [L.qr.x + QS, L.qr.y + QS], [L.qr.x, L.qr.y + QS]];
  let best = null;
  const combos = []; for(let i=0;i<cand.length;i++) for(let j=i+1;j<cand.length;j++) for(let k=j+1;k<cand.length;k++) for(let l=k+1;l<cand.length;l++) combos.push([cand[i], cand[j], cand[k], cand[l]]);
  for(const cb of combos){
    const ctr = cb.reduce((s, b) => [s[0] + b.c[0]/4, s[1] + b.c[1]/4], [0, 0]);
    const ord = [...cb].sort((x, y) => Math.atan2(x.c[1]-ctr[1], x.c[0]-ctr[0]) - Math.atan2(y.c[1]-ctr[1], y.c[0]-ctr[0])).map(b => b.c);   // clockwise on screen
    for(let r=0;r<4;r++){ const dst = [0,1,2,3].map(t => ord[(t + r) % 4]); const H = homography(S, dst); if(!H) continue;
      let err;
      if(qrPoly){ err = qrS.reduce((s, p, t) => s + dist(hap(H, p[0], p[1]), qrPoly[t]), 0) / 4 / scale; }
      else { if(r) continue; const tl = dst.reduce((m, p, t) => p[0] + p[1] < dst[m][0] + dst[m][1] ? t : m, 0); if(tl !== 0) continue;
        const sideA = (dist(dst[0], dst[1]) + dist(dst[3], dst[2])) / 2, sideB = (dist(dst[0], dst[3]) + dist(dst[1], dst[2])) / 2; err = Math.abs(sideA / sideB - L.W / L.H) * 10 - sideA * sideB / (w * h); }
      if(!best || err < best.err) best = {err, H, dst}; } }
  if(!best || (qrPoly && best.err > 3.5)) return {ok:false, why:'The answer sheet could not be lined up — keep the whole sheet (all four squares) in view.', a, slot};
  const H = best.H;
  // 4) read every bubble: darkness inside the circle compared with the item's lightest circle
  const sc = dist(hap(H, L.W/2, L.H/2), hap(H, L.W/2 + 1, L.H/2)); const rIn = Math.max(1.5, 0.3 * D * sc);
  const meanIn = (u, v) => { let s = 0, n = 0; const r2 = rIn*rIn; for(let y = Math.floor(v - rIn); y <= v + rIn; y++) for(let x = Math.floor(u - rIn); x <= u + rIn; x++){ if(x < 0 || y < 0 || x >= w || y >= h) continue; if((x-u)**2 + (y-v)**2 > r2) continue; s += g[y*w + x]; n++; } return n ? s / n : 255; };
  const marks = L.items.map(it => { const m = it.opts.map(([x, y]) => { const [u, v] = hap(H, x, y); return {u, v, mean: meanIn(u, v)}; }); const ref = Math.max(...m.map(o => o.mean)); m.forEach(o => o.dark = ref - o.mean); return m; });
  const tops = marks.map(m => Math.max(...m.map(o => o.dark))).sort((x, y) => x - y);
  const p90 = tops[Math.floor(tops.length * 0.9)] || 0; const thr = Math.max(28, p90 * 0.42);
  const flags = [];
  const ans = marks.map((m, i) => { const ord = m.map((o, k) => ({k, v:o.dark})).sort((x, y) => y.v - x.v);
    if(ord[0].v < thr){ return '-'; }
    if(ord[1] && ord[1].v >= thr && ord[1].v > ord[0].v * 0.62){ flags.push(i + 1); return '*'; }
    return a.opts[ord[0].k]; }).join('');
  return {ok:true, a, slot, ans, marks, H, scale: sc, corners: best.dst, flags, w, h};
};
// scale an image/video frame onto a canvas (long side ≤ max)
function toCanvas(src, sw, sh, max){ const k = Math.min(1, max / Math.max(sw, sh)); const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k); c.getContext('2d', {willReadFrequently:true}).drawImage(src, 0, 0, c.width, c.height); return c; }

/* =====================================================================
   SAVE RESULTS → ECR
   ===================================================================== */
async function saveResult(a, slot, ans, src){
  a.results = a.results || {}; const sc = scoreOf(a, ans);
  a.results[slot] = {ans, score: sc, at: new Date().toISOString(), src: src || 'scan', flags: [...ans].map((x, i) => x === '*' ? i + 1 : 0).filter(Boolean)};
  M.save();
  if(isNum(sc)) await syncEcr(a, [slot], true);
}
async function syncEcr(a, slots, quiet){
  const E = ecrOf(a); if(!E) return M.toast('The ECR of this assessment was deleted');
  await M.ecrEnsureModel(E); if(!E.model) return alert('The ECR file is not on this device, so scores cannot be written. Upload the ECR again in Classes.');
  if(!keyDone(a)) return quiet ? null : alert('Enter the complete answer key first.');
  const scores = {}; (slots || Object.keys(a.results || {})).forEach(sl => { const r = a.results[sl]; if(!r) return; r.score = scoreOf(a, r.ans); if(isNum(r.score)) scores[sl] = r.score; });
  try { M.ecrPutScores(E, a.term, a.comp, scores, a.setHps ? a.n : undefined); a.synced = new Date().toISOString(); M.save();
    if(!quiet) M.toast(`${Object.keys(scores).length} score(s) written to ${E.title} · Term ${a.term} · ${compShort(a.comp)}`); }
  catch(e){ alert(e.message); }
}

/* =====================================================================
   VIEWS
   ===================================================================== */
M.views.assess = function view(el, args){
  if(args[0]) return detail(el, args[0], args[1]);
  const ui = M.S.ui; const tf = ui.asmTerm || 'all';
  const groups = M.S.ecr.map(E => ({E, list: M.S.asm.filter(a => a.ecrId === E.id && (tf === 'all' || a.term === tf)).sort((x, y) => (x.term + x.comp).localeCompare(y.term + y.comp))})).filter(g => g.list.length);
  const orphans = M.S.asm.filter(a => !ecrOf(a));
  el.innerHTML = `
  <div class="card"><div class="row">
    <div><h2 style="margin:0">Assessments</h2><div class="small muted">Create an assessment, print answer sheets with each learner's name, scan them with your phone or upload photos — scores go straight into the ECR column you picked.</div></div>
    <span class="spacer"></span><button class="btn primary" id="aNew">${ico('plus')} Create Assessment</button></div>
    <div class="row" style="margin-top:14px"><div class="seg" id="aTf">${[['all','All terms'],['1','Term 1'],['2','Term 2'],['3','Term 3']].map(([k, l]) => `<button data-t="${k}" class="${k===tf?'on':''}">${l}</button>`).join('')}</div><span class="spacer"></span><button class="btn sm" id="aScan">${ico('camera')} Scan answer sheets</button></div></div>
  ${groups.length ? groups.map(({E, list}) => `
    <div class="card asm-group" style="margin-top:20px"><div class="row"><h2 style="margin:0">${esc(E.title)}</h2><span class="chip green">${esc(E.subject || '')}</span><span class="spacer"></span><a class="btn sm" href="#classes/${E.id}/edit">${ico('edit')} ECR</a></div>
      <div class="table-wrap" style="margin-top:12px;max-height:none"><table><thead><tr><th>Assessment</th><th>Term</th><th>ECR column</th><th class="num">Items</th><th class="num">Scanned</th><th class="num">Mean</th><th class="num">MPS</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(a => { const R = stats(a); return `<tr><td><a href="#assess/${a.id}"><b>${esc(a.title)}</b></a><div class="tiny muted">${esc(a.date || a.created.slice(0,10))}</div></td><td>${esc(a.term)}</td><td>${esc(compLabel(a.comp))}</td><td class="num">${a.n}</td><td class="num">${R.done}/${R.total}</td><td class="num">${R.st.n ? fmt(R.st.mean) : '—'}</td><td class="num">${R.st.n ? `<b class="${R.mps<75?'low':''}">${fmt(R.mps,1)}</b>` : '—'}</td>
        <td>${!keyDone(a) ? '<span class="chip gold">needs key</span>' : a.synced ? '<span class="chip green">in ECR</span>' : R.done ? '<span class="chip">not yet in ECR</span>' : '<span class="chip">ready to scan</span>'}</td><td><a class="btn sm" href="#assess/${a.id}">Open</a></td></tr>`; }).join('')}
      </tbody></table></div></div>`).join('') : `<div class="card" style="margin-top:20px"><div class="empty">${M.S.ecr.length ? 'No assessments yet. Tap <b>Create Assessment</b>.' : 'Add your class records first (Classes → upload ECR or Add a class) — assessments write scores into them.'}</div></div>`}
  ${orphans.length ? `<div class="card" style="margin-top:20px"><h2>Without a class record</h2>${orphans.map(a => `<div class="row" style="margin:6px 0"><a href="#assess/${a.id}">${esc(a.title)}</a><span class="tiny muted">ECR deleted</span></div>`).join('')}</div>` : ''}`;
  $('#aNew', el).onclick = () => form(null);
  $('#aTf', el).onclick = e => { const b = e.target.closest('button'); if(!b) return; ui.asmTerm = b.dataset.t; M.save(); view(el, []); };
  $('#aScan', el).onclick = () => scanner(null);
};
function stats(a){
  const E = ecrOf(a); const R = roster(E); const res = a.results || {};
  const scores = R.map(p => res[p.slot] && isNum(res[p.slot].score) ? res[p.slot].score : null).filter(isNum);
  const st = M.stats(scores);
  return {total: R.length, done: R.filter(p => res[p.slot]).length, st, mps: st.n ? st.mean / a.n * 100 : 0};
}

/* ---------- create / edit ---------- */
async function form(a){
  const ecrs = M.S.ecr.filter(e => e.docId);
  if(!ecrs.length) return alert('Upload your ECRs in Classes first — assessments write their scores into the ECR.');
  const x = a || {ecrId: ecrs[0].id, term: (M.S.ui.asmTerm && M.S.ui.asmTerm !== 'all') ? M.S.ui.asmTerm : '1', comp:'st1', title:'', n:20, opts:'ABCD', key:'', setHps:true, date: M.today()};
  M.modal(a ? 'Edit assessment' : 'Create Assessment', `
    <div class="grid g-2">
      <label class="field">Grade &amp; Section<select class="input" id="fE">${ecrs.map(e => `<option value="${e.id}" ${e.id===x.ecrId?'selected':''}>${esc(e.title)} · ${esc(e.subject||'')}</option>`).join('')}</select></label>
      <label class="field">Term<select class="input" id="fT">${['1','2','3'].map(t => `<option ${t===x.term?'selected':''}>${t}</option>`).join('')}</select></label>
      <label class="field">Put the scores in<select class="input" id="fC">${COMPS.map(([k, l]) => `<option value="${k}" ${k===x.comp?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="field">Date given<input type="date" class="input" id="fD" value="${esc(x.date||'')}"></label>
      <label class="field" style="grid-column:1/-1">Title<input class="input" id="fN" value="${esc(x.title)}" placeholder="e.g. Summative Test 1 – Reading Comprehension"></label>
      <label class="field">Number of items<input class="input" id="fI" inputmode="numeric" value="${x.n}"></label>
      <label class="field">Choices<select class="input" id="fO">${[['ABCD','A – D'],['ABCDE','A – E'],['ABC','A – C'],['AB','A – B (True / False)']].map(([k, l]) => `<option value="${k}" ${k===x.opts?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="field" style="grid-column:1/-1">Answer key <span class="muted">(optional now — type the letters in order, e.g. ABDCA…)</span><input class="input mono" id="fK" value="${esc(x.key||'')}" autocapitalize="characters" spellcheck="false"></label>
      <label class="row small" style="grid-column:1/-1;cursor:pointer;gap:8px"><input type="checkbox" id="fH" ${x.setHps!==false?'checked':''}> Set the ECR's highest possible score for this column to the number of items</label>
    </div>
    <div id="fInfo" class="small muted" style="margin-top:10px"></div>
    <div class="row" style="margin-top:16px">${a ? '<button class="btn sm danger" id="fDel">Delete assessment</button>' : ''}<span class="spacer"></span><button class="btn" id="fX">Cancel</button><button class="btn primary" id="fOk">${a ? 'Save' : 'Create'}</button></div>`,
  b => {
    const info = async () => { const E = M.S.ecr.find(e => e.id === $('#fE', b).value); await M.ecrEnsureModel(E).catch(() => null);
      const t = $('#fT', b).value, comp = $('#fC', b).value; const n = Math.max(1, Math.min(100, +$('#fI', b).value || 0)); const F = format({n, opts: $('#fO', b).value});
      const R = roster(E); const T = E && E.model && E.model.terms[t]; let has = 0, hps = null;
      if(T){ const {k, j} = M.ecrCompSlot(T, comp); hps = T.hps[k][j]; R.forEach(p => { if(isNum(M.ecrGetScore(E, t, comp, p.slot))) has++; }); }
      $('#fInfo', b).innerHTML = !E || !E.model ? '<span class="low">This ECR file is not on this device — upload it again in Classes.</span>' : !T ? `<span class="low">This ECR has no Term ${t} sheet.</span>` :
        `${R.length} learners on the ECR · ${F.per} answer sheets per A4 page${F.per === 2 ? ' (too many items for a quarter sheet)' : ''}${isNum(hps) ? ` · current HPS ${hps}` : ''}${has ? ` · <span class="low">${has} learner(s) already have a score in this column — scanned scores will replace them</span>` : ''}`;
      if(!$('#fN', b).value || $('#fN', b).dataset.auto){ $('#fN', b).value = `${compLabel(comp)} – Term ${t}`; $('#fN', b).dataset.auto = '1'; } };
    $('#fN', b).oninput = () => delete $('#fN', b).dataset.auto;
    ['#fE','#fT','#fC','#fI','#fO'].forEach(s => $(s, b).onchange = info); info();
    $('#fX', b).onclick = M.closeModal;
    if(a) $('#fDel', b).onclick = () => { if(!confirm(`Delete “${a.title}” and its scanned results? (Scores already written to the ECR stay there.)`)) return; M.S.asm = M.S.asm.filter(y => y !== a); M.save(); M.closeModal(); location.hash = '#assess'; M.route(); };
    $('#fOk', b).onclick = async () => {
      const n = Math.max(1, Math.min(100, +$('#fI', b).value || 0)); const opts = $('#fO', b).value;
      const d = {ecrId: $('#fE', b).value, term: $('#fT', b).value, comp: $('#fC', b).value, title: $('#fN', b).value.trim() || compLabel($('#fC', b).value), n, opts, date: $('#fD', b).value,
        key: $('#fK', b).value.toUpperCase().replace(new RegExp(`[^${opts}]`, 'g'), '').slice(0, n), setHps: $('#fH', b).checked};
      const E = M.S.ecr.find(e => e.id === d.ecrId); await M.ecrEnsureModel(E).catch(() => null);
      if(!E || !E.model) return alert('This ECR file is not on this device — upload it again in Classes.');
      if(!E.model.terms[d.term]) return alert(`This ECR has no Term ${d.term} sheet.`);
      if(a && (a.n !== n || a.opts !== opts) && Object.keys(a.results || {}).length && !confirm('Changing the number of items or choices makes the printed sheets outdated. Continue?')) return;
      if(a){ Object.assign(a, d); Object.values(a.results || {}).forEach(r => r.score = scoreOf(a, r.ans)); }
      else { a = Object.assign({id: M.uid('as'), code: Math.random().toString(36).slice(2, 7).toUpperCase(), created: new Date().toISOString(), results: {}}, d); M.S.asm.push(a); }
      if(a.setHps && E.model){ try { M.ecrPutScores(E, a.term, a.comp, {}, a.n); } catch(e){} }
      M.save(); M.closeModal(); location.hash = '#assess/' + a.id; M.route();
    };
  }, true);
}

/* ---------- one assessment ---------- */
function detail(el, id, tab){
  const a = M.S.asm.find(x => x.id === id); if(!a){ el.innerHTML = '<div class="card"><div class="empty">Assessment not found.</div></div>'; return; }
  const E = ecrOf(a); const R = roster(E); const S = stats(a); tab = tab || 'results';
  el.innerHTML = `
  <div class="card"><div class="row">
    <a class="btn sm" href="#assess">${ico('left','width:16px;height:16px')} Assessments</a>
    <div><div class="title"><b>${esc(a.title)}</b></div><div class="small muted">${esc(E ? E.title : '(ECR deleted)')} · Term ${esc(a.term)} · ECR column: <b>${esc(compLabel(a.comp))}</b> · ${a.n} items · ${a.opts.split('').join('/')}${a.date ? ' · ' + esc(a.date) : ''}</div></div>
    <span class="spacer"></span><button class="btn sm" id="dEd">${ico('edit')} Edit</button></div>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" id="dScan">${ico('camera')} Scan with camera</button>
      <button class="btn" id="dUp">${ico('upload')} Upload photos</button><input type="file" id="dUpF" accept="image/*" multiple hidden>
      <span class="spacer"></span>
      <button class="btn" id="dPrintAll">${ico('print')} Print all sheets (${R.length})</button>
      <select class="input" id="dOne" style="width:auto;max-width:240px"><option value="">Print one learner's sheet…</option>${R.map(p => `<option value="${p.slot}">${esc(p.name)}</option>`).join('')}</select>
      <button class="btn gold" id="dSync" ${keyDone(a) && S.done ? '' : 'disabled'}>${ico('save')} Write scores to ECR</button>
    </div>
    <div class="chips" style="margin-top:12px"><span class="chip">${S.done} of ${S.total} scanned</span>${S.st.n ? `<span class="chip">mean ${fmt(S.st.mean)} / ${a.n}</span><span class="chip ${S.mps<75?'gold':'green'}">MPS ${fmt(S.mps,1)} · ${esc(M.mpsLevel(S.mps))}</span>` : ''}${!keyDone(a) ? '<span class="chip gold">Answer key needed for scores</span>' : ''}${a.synced ? `<span class="chip green">Written to ECR ${esc(new Date(a.synced).toLocaleString())}</span>` : ''}${E && E.model && E.model.dirty ? `<a class="chip" href="#classes/${E.id}/edit/${a.term}">ECR edited in MASTRO — download the updated ECR</a>` : ''}</div>
    <div class="seg" id="dTabs" style="margin-top:14px">${[['results','Results'],['items','Item analysis'],['key','Answer key'],['sheet','Sheet preview']].map(([k, l]) => `<button data-t="${k}" class="${k===tab?'on':''}">${l}</button>`).join('')}</div></div>
  <div id="dBody" style="margin-top:20px"></div>`;
  const rerender = (t) => detail(el, id, t || tab);
  $('#dEd', el).onclick = () => form(a);
  $('#dScan', el).onclick = () => scanner(a, () => rerender());
  $('#dUp', el).onclick = () => $('#dUpF', el).click();
  $('#dUpF', el).onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if(fs.length) uploadPhotos(a, fs, () => rerender()); };
  $('#dPrintAll', el).onclick = () => printSheets(a, R);
  $('#dOne', el).onchange = e => { const p = R.find(x => x.slot === e.target.value); e.target.value = ''; if(p) printSheets(a, [p]); };
  $('#dSync', el).onclick = async () => { await syncEcr(a); rerender(); };
  $('#dTabs', el).onclick = e => { const b = e.target.closest('button'); if(b) location.hash = `#assess/${a.id}/${b.dataset.t}`; };
  const body = $('#dBody', el);
  if(tab === 'results') resultsTab(body, a, R, rerender);
  if(tab === 'items') itemsTab(body, a, R);
  if(tab === 'key') keyTab(body, a, rerender);
  if(tab === 'sheet') sheetTab(body, a, R);
}
function resultsTab(body, a, R, rerender){
  const res = a.results || {}; const E = ecrOf(a);
  let last = null;
  body.innerHTML = `<div class="card"><h2>Results</h2>
    <div class="table-wrap"><table><thead><tr><th>#</th><th class="sticky-col">Learner</th><th class="num">Score</th><th class="num">%</th><th>In ECR</th><th>Scanned</th><th>Notes</th><th></th></tr></thead><tbody>
    ${R.map(p => { const r = res[p.slot]; const pre = p.sx !== last ? (last = p.sx, `<tr class="group"><td colspan="2" class="sticky-col">${p.sx==='M'?'Male':'Female'}</td><td colspan="6"></td></tr>`) : '';
      const inEcr = E && E.model ? M.ecrGetScore(E, a.term, a.comp, p.slot) : null;
      return pre + `<tr><td class="muted">${p.i + 1}</td><td class="sticky-col">${esc(p.name)}</td>
        <td class="num">${r ? (isNum(r.score) ? `<b>${r.score}</b>/${a.n}` : '<span class="muted">no key</span>') : '<span class="muted">—</span>'}</td>
        <td class="num ${r && isNum(r.score) && r.score/a.n*100 < 75 ? 'low' : ''}">${r && isNum(r.score) ? fmt(r.score/a.n*100, 0) : ''}</td>
        <td>${isNum(inEcr) ? `<span class="${r && isNum(r.score) && inEcr !== r.score ? 'low' : ''}">${inEcr}</span>` : '<span class="muted">—</span>'}</td>
        <td class="tiny muted">${r ? esc(new Date(r.at).toLocaleString()) + (r.src === 'manual' ? ' · typed' : '') : ''}</td>
        <td class="tiny">${r && r.flags && r.flags.length ? `<span class="low">double-shaded: ${r.flags.join(', ')}</span>` : r && /-/.test(r.ans) ? `blank: ${[...r.ans].map((x, i) => x === '-' ? i + 1 : 0).filter(Boolean).slice(0, 8).join(', ')}` : ''}</td>
        <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-ed="${p.slot}">${r ? 'Edit' : 'Type answers'}</button><button class="icon-btn" data-pr="${p.slot}" title="Print this learner's sheet">${ico('print','width:16px;height:16px')}</button>${r ? `<button class="icon-btn" data-rm="${p.slot}" title="Remove result">✕</button>` : ''}</div></td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="tiny muted">“In ECR” shows what is in the ECR column now. Scores are written when you save a scan (once the answer key is complete) or with <b>Write scores to ECR</b>. Then open the ECR and use <b>Download updated ECR</b> to update your Excel file.</p></div>`;
  $$('[data-pr]', body).forEach(b => b.onclick = () => printSheets(a, R.filter(p => p.slot === b.dataset.pr)));
  $$('[data-rm]', body).forEach(b => b.onclick = () => { if(!confirm('Remove this result? (The ECR keeps its score until you change it there.)')) return; delete a.results[b.dataset.rm]; M.save(); rerender(); });
  $$('[data-ed]', body).forEach(b => b.onclick = () => { const p = R.find(x => x.slot === b.dataset.ed); const r = (a.results || {})[p.slot];
    M.modal(`Answers · ${p.name}`, `<p class="small muted" style="margin-top:0">Type the learner's answers in order (${a.opts.split('').join(', ')}), “-” for blank. ${a.n} items.</p>
      <input class="input mono" id="mA" maxlength="${a.n}" value="${esc(r ? r.ans : '')}" autocapitalize="characters" spellcheck="false" style="letter-spacing:.08em">
      <div class="small" id="mS" style="margin-top:8px"></div>
      <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" id="mX">Cancel</button><button class="btn primary" id="mOk">Save</button></div>`, m => {
      const inp = $('#mA', m); const upd = () => { inp.value = inp.value.toUpperCase().replace(new RegExp(`[^${a.opts}\\-*]`, 'g'), '').slice(0, a.n); const sc = scoreOf(a, inp.value.padEnd(a.n, '-')); $('#mS', m).innerHTML = `${inp.value.length}/${a.n} answers${isNum(sc) ? ` · score <b>${sc}</b>` : ''}`; };
      inp.oninput = upd; upd(); $('#mX', m).onclick = M.closeModal;
      $('#mOk', m).onclick = async () => { await saveResult(a, p.slot, inp.value.padEnd(a.n, '-'), 'manual'); M.closeModal(); rerender(); }; }); });
}
function itemsTab(body, a, R){
  const res = Object.entries(a.results || {}).filter(([sl]) => R.some(p => p.slot === sl)).map(([, r]) => r);
  if(!keyDone(a) || !res.length){ body.innerHTML = `<div class="card"><div class="empty">${!keyDone(a) ? 'Enter the answer key to see the item analysis.' : 'No scanned answer sheets yet.'}</div></div>`; return; }
  const N = res.length; const sorted = [...res].sort((x, y) => y.score - x.score); const g = Math.max(1, Math.round(N * 0.27)); const U = sorted.slice(0, g), Lw = sorted.slice(-g);
  const items = [...Array(a.n).keys()].map(i => { const ok = (r) => r.ans[i] === a.key[i]; const p = res.filter(ok).length / N; const Dx = U.filter(ok).length / g - Lw.filter(ok).length / g;
    const cnt = {}; a.opts.split('').forEach(o => cnt[o] = res.filter(r => r.ans[i] === o).length); return {no: i + 1, p, D: Dx, cnt, blank: res.filter(r => r.ans[i] === '-' || r.ans[i] === '*').length}; });
  const least = items.filter(x => x.p < .75).sort((x, y) => x.p - y.p);
  body.innerHTML = `<div class="card"><h2>Percent correct per item <span class="tiny muted">${N} learners</span></h2>
    <div class="ia-bars">${items.map(x => `<div class="ia-b" title="Item ${x.no}: ${Math.round(x.p*100)}% correct"><i style="height:${Math.max(2, x.p*100)}%;background:${x.p>=.75?'#2f8a61':x.p>=.5?'#d9a73a':'#c55252'}"></i><span>${x.no}</span></div>`).join('')}</div>
    <div class="chips" style="margin-top:12px">${least.length ? least.map(x => `<span class="chip ${x.p<.5?'red':'gold'}">#${x.no} · ${Math.round(x.p*100)}%</span>`).join('') : '<span class="chip green">All items at 75% or higher</span>'}</div></div>
    <div class="card" style="margin-top:20px"><h2>Item table</h2><div class="table-wrap"><table><thead><tr><th class="num">Item</th><th class="c">Key</th><th class="num">% correct</th><th>Difficulty</th><th class="num">D</th>${a.opts.split('').map(o => `<th class="c">${o}</th>`).join('')}<th class="num">Blank / double</th></tr></thead><tbody>
    ${items.map(x => `<tr><td class="num"><b>${x.no}</b></td><td class="c"><b>${a.key[x.no-1]}</b></td><td class="num ${x.p<.75?'low':''}">${fmt(x.p*100,0)}</td><td>${x.p>=.81?'Very easy':x.p>=.61?'Easy':x.p>=.41?'Average':x.p>=.21?'Difficult':'Very difficult'}</td><td class="num">${x.D.toFixed(2)}</td>${a.opts.split('').map(o => `<td class="c" style="${o===a.key[x.no-1]?'font-weight:800;color:var(--green)':''}">${x.cnt[o]}</td>`).join('')}<td class="num">${x.blank}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function keyTab(body, a, rerender){
  body.innerHTML = `<div class="card"><h2>Answer key</h2>
    <div class="key-grid">${[...Array(a.n).keys()].map(i => `<label><span>${i+1}</span><select class="input" data-k="${i}"><option value="">?</option>${a.opts.split('').map(o => `<option ${a.key[i]===o?'selected':''}>${o}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="row" style="margin-top:14px"><input class="input mono" id="kT" placeholder="…or type all letters, e.g. ABDCA" value="${esc(a.key)}" style="flex:1" autocapitalize="characters"><button class="btn primary" id="kSave">Save key</button></div>
    <p class="small muted">Saving the key re-scores every scanned sheet. Then use <b>Write scores to ECR</b>.</p></div>`;
  const save = (k) => { a.key = k.toUpperCase().replace(new RegExp(`[^${a.opts}?]`, 'g'), '').slice(0, a.n); Object.values(a.results || {}).forEach(r => r.score = scoreOf(a, r.ans)); M.save(); M.toast(keyDone(a) ? 'Key saved — scores updated' : `Key saved (${a.key.replace(/\?/g,'').length} of ${a.n})`); rerender('key'); };
  $('#kSave', body).onclick = () => save($('#kT', body).value);
  body.addEventListener('change', e => { const s = e.target.closest('[data-k]'); if(!s) return; const arr = a.key.padEnd(a.n, '?').split(''); arr[+s.dataset.k] = s.value || '?'; a.key = arr.join('').replace(/\?+$/, ''); Object.values(a.results || {}).forEach(r => r.score = scoreOf(a, r.ans)); M.save(); $('#kT', body).value = a.key; });
}
async function sheetTab(body, a, R){
  const F = format(a);
  body.innerHTML = `<div class="card"><h2>Sheet preview</h2><p class="small muted" style="margin-top:0">${F.per} sheets per A4 page (${F.W} × ${F.H} mm each). Print at <b>100% / actual size</b>. Cut along the dashed lines. Each sheet has the learner's name and a QR code that tells MASTRO which assessment and learner it is.</p>
    <div class="sheet-prev">${M.asmSheetSvg(a, R[0] || null, R[0] ? await qrFor(a, R[0].slot) : null)}</div></div>`;
}

/* ---------- scanning UI ---------- */
function reviewHtml(){ return `<div class="omr-review"><div class="omr-canvas"><canvas id="rvC"></canvas></div><div class="omr-side" id="rvSide"></div></div>`; }
// show a read sheet with the detected marks; tap a bubble to correct it
function review(host, img, res, onSave, onRetake){
  const a = res.a; const E = ecrOf(a); const R = roster(E); let ans = res.ans.split(''); let slot = res.slot;
  host.innerHTML = reviewHtml();
  const cv = $('#rvC', host); const maxW = Math.min(host.clientWidth || 600, 560); const k = Math.min(1, maxW / img.width); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  const draw = () => { const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
    res.marks.forEach((m, i) => m.forEach((o, j) => { const ch = a.opts[j]; const sel = ans[i] === ch; const key = keyDone(a) ? a.key[i] : null;
      cx.beginPath(); cx.arc(o.u * k, o.v * k, Math.max(3, D/2 * res.scale * k), 0, Math.PI * 2);
      if(sel){ cx.fillStyle = key ? (key === ch ? 'rgba(47,138,97,.55)' : 'rgba(197,82,82,.6)') : 'rgba(31,107,74,.5)'; cx.fill(); }
      else if(ans[i] === '*'){ cx.strokeStyle = 'rgba(230,140,20,.95)'; cx.lineWidth = 2; cx.stroke(); }
      else if(key === ch){ cx.strokeStyle = 'rgba(47,138,97,.9)'; cx.lineWidth = 1.2; cx.stroke(); } })); };
  const side = () => { const sc = scoreOf(a, ans.join('')); const p = R.find(x => x.slot === slot); const prev = slot && a.results && a.results[slot];
    $('#rvSide', host).innerHTML = `<div class="small muted">${esc(a.title)} · ${esc(E ? E.title : '')}</div>
      <label class="field" style="margin-top:8px">Learner<select class="input" id="rvL"><option value="">Choose…</option>${R.map(x => `<option value="${x.slot}" ${x.slot===slot?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <div class="omr-score">${isNum(sc) ? `${sc}<span>/${a.n}</span>` : '<span class="small">enter the key for a score</span>'}</div>
      <div class="tiny">${ans.filter(x => x === '-').length} blank · ${ans.filter(x => x === '*').length ? `<span class="low">${ans.filter(x => x === '*').length} double-shaded — tap the intended circle</span>` : '0 double-shaded'}</div>
      ${prev ? `<div class="tiny low" style="margin-top:6px">Already scanned (${isNum(prev.score) ? prev.score : '?'}). Saving replaces it.</div>` : ''}
      <p class="tiny muted">Tap a circle on the photo to change an answer.</p>
      <div class="row" style="margin-top:10px"><button class="btn" id="rvRe">${onRetake ? 'Retake' : 'Skip'}</button><button class="btn primary" id="rvOk" ${slot ? '' : 'disabled'}>${ico('save')} Save${keyDone(a) ? ' → ECR' : ''}</button></div>`;
    $('#rvL', host).onchange = e => { slot = e.target.value; side(); };
    $('#rvRe', host).onclick = () => onRetake ? onRetake() : onSave(null);
    $('#rvOk', host).onclick = async () => { await saveResult(a, slot, ans.join(''), 'scan'); onSave({slot, score: scoreOf(a, ans.join(''))}); }; };
  cv.onclick = e => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * cv.width / r.width / k, y = (e.clientY - r.top) * cv.height / r.height / k;
    let best = null; res.marks.forEach((m, i) => m.forEach((o, j) => { const dd = Math.hypot(o.u - x, o.v - y); if(!best || dd < best.d) best = {d: dd, i, j}; }));
    if(!best || best.d > PX * res.scale) return; const ch = a.opts[best.j]; ans[best.i] = ans[best.i] === ch ? '-' : ch; draw(); side(); };
  draw(); side();
}
async function scanner(a0, done){
  let stream = null, timer = 0, busy = false, stop = false;
  M.modal('Scan answer sheets', `
    <div id="scLive"><div class="scan-wrap omr"><video id="scV" playsinline muted></video><div class="omr-guide"><i></i><i></i><i></i><i></i></div></div>
      <div id="scMsg" class="small muted" style="margin-top:10px;text-align:center">Hold one answer sheet flat so all four black squares are inside the frame.</div>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="scSnap">${ico('camera')} Capture now</button><label class="btn" style="cursor:pointer">${ico('upload')} Take / choose photo<input type="file" id="scPh" accept="image/*" capture="environment" hidden></label></div></div>
    <div id="scRev"></div><div id="scLog" class="tiny muted" style="margin-top:10px"></div>`, async b => {
    const v = $('#scV', b), msg = $('#scMsg', b), live = $('#scLive', b), rev = $('#scRev', b); let count = 0;
    const close = () => { stop = true; clearTimeout(timer); if(stream) stream.getTracks().forEach(t => t.stop()); };
    const mo = new MutationObserver(() => { if($('#modalWrap').hidden){ close(); mo.disconnect(); if(done) done(); } }); mo.observe($('#modalWrap'), {attributes:true});
    const show = (canvas, res) => { live.style.display = 'none'; rev.innerHTML = '';
      review(rev, canvas, res, (saved) => { if(saved){ count++; $('#scLog', b).innerHTML = `Saved ${count} sheet(s) · last: ${esc((roster(ecrOf(res.a)).find(p => p.slot === saved.slot)||{}).name || '')} ${isNum(saved.score) ? saved.score + '/' + res.a.n : ''}`; if(navigator.vibrate) navigator.vibrate(30); }
        rev.innerHTML = ''; live.style.display = ''; busy = false; loop(); }, () => { rev.innerHTML = ''; live.style.display = ''; busy = false; loop(); }); };
    const attempt = async (canvas, manual) => { const res = await M.omrRead(canvas, a0 ? {a: a0} : null);
      if(res.ok){ if(a0 && res.a !== a0 && !confirm(`This sheet is for “${res.a.title}”. Save it there?`)) { msg.textContent = 'Different assessment — skipped.'; return false; } show(canvas, res); return true; }
      msg.innerHTML = esc(res.why); if(manual) M.toast(res.why); return false; };
    const grab = () => toCanvas(v, v.videoWidth, v.videoHeight, 1400);
    const loop = () => { if(stop) return; clearTimeout(timer); timer = setTimeout(async () => { if(stop || busy || !stream || v.readyState < 2){ loop(); return; } busy = true;
      try { const small = toCanvas(v, v.videoWidth, v.videoHeight, 640); await M.loadScript('vendor/jsQR.js');
        const q = jsQR(small.getContext('2d').getImageData(0, 0, small.width, small.height).data, small.width, small.height, {inversionAttempts:'dontInvert'});
        if(q && /^MSA:/.test(q.data)){ msg.textContent = 'Sheet found — reading…'; if(await attempt(grab(), false)) return; } } catch(e){ console.error(e); }
      busy = false; loop(); }, 350); };
    $('#scSnap', b).onclick = async () => { if(!stream || busy) return; busy = true; if(!(await attempt(grab(), true))) busy = false; };
    $('#scPh', b).onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if(!f) return; busy = true; const bm = await createImageBitmap(f); if(!(await attempt(toCanvas(bm, bm.width, bm.height, 1600), true))) busy = false; };
    try { stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment', width:{ideal:1920}, height:{ideal:1080}}, audio:false}); v.srcObject = stream; await v.play(); loop(); }
    catch(e){ msg.innerHTML = `<span class="low">Camera not available (${esc(e.name || e.message)}).</span> Use “Take / choose photo” instead.`; }
  }, true);
}
async function uploadPhotos(a, files, done){
  const pr = M.xvProgress ? M.xvProgress('Reading photos…') : null; const out = [];
  for(let i=0;i<files.length;i++){ try { const bm = await createImageBitmap(files[i]); const cv = toCanvas(bm, bm.width, bm.height, 1600); const res = await M.omrRead(cv, {a}); out.push({f: files[i], cv, res}); } catch(e){ out.push({f: files[i], res:{ok:false, why:e.message}}); }
    if(pr) pr.set(`Reading ${i+1} of ${files.length}…`, (i+1)/files.length); await new Promise(r => setTimeout(r, 0)); }
  if(pr) pr.done();
  const R = roster(ecrOf(a));
  const list = () => `<p class="small muted" style="margin-top:0">Check each sheet, then save. Sheets without problems can be saved together.</p>
    <div class="table-wrap" style="max-height:52vh"><table><thead><tr><th>Photo</th><th>Learner</th><th class="num">Score</th><th>Check</th><th></th></tr></thead><tbody>
    ${out.map((o, i) => { const r = o.res; const p = r.ok && R.find(x => x.slot === r.slot); const sc = r.ok ? scoreOf(r.a, r.ans) : null; const issues = !r.ok ? r.why : [!p ? 'no learner' : '', r.flags.length ? r.flags.length + ' double-shaded' : '', r.a !== a ? 'other assessment' : ''].filter(Boolean).join(' · ');
      return `<tr><td class="tiny">${esc(o.f.name.slice(0, 24))}</td><td>${p ? esc(p.name) : '—'}</td><td class="num">${isNum(sc) ? sc + '/' + r.a.n : ''}</td><td class="tiny ${issues ? 'low' : ''}">${o.saved ? '<span style="color:var(--green)">saved</span>' : esc(issues || 'OK')}</td><td>${r.ok && !o.saved ? `<button class="btn sm" data-rv="${i}">Review</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" id="upX">Close</button><button class="btn primary" id="upAll">Save all OK sheets</button></div><div id="upRev"></div>`;
  M.modal(`Scanned photos (${files.length})`, list(), function bind(b){
    $('#upX', b).onclick = M.closeModal;
    $('#upAll', b).onclick = async () => { let n = 0; for(const o of out){ const r = o.res; if(!r.ok || o.saved || r.flags.length || !r.slot || r.a !== a) continue; await saveResult(r.a, r.slot, r.ans, 'scan'); o.saved = true; n++; } M.toast(`${n} sheet(s) saved`); b.innerHTML = list(); bind(b); };
    $$('[data-rv]', b).forEach(btn => btn.onclick = () => { const o = out[+btn.dataset.rv]; const host = $('#upRev', b); host.innerHTML = ''; review(host, o.cv, o.res, (saved) => { if(saved) o.saved = true; b.innerHTML = list(); bind(b); }, null); host.scrollIntoView({behavior:'smooth'}); });
    const mo = new MutationObserver(() => { if($('#modalWrap').hidden){ mo.disconnect(); if(done) done(); } }); mo.observe($('#modalWrap'), {attributes:true});
  }, true);
}
M.asmFormat = format;
})();
