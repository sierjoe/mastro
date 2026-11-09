/* MASTRO — OMR engine for scannable answer sheets (v6.13). No DOM needed.
   layout(parts)          → where every bubble sits on the half-sheet (mm), shared by printing and scanning
   findMarkers(gray)      → the 4 black corner squares in a photo
   read(gray, quad, L)    → which bubble is shaded in every item */
(function (root) {
'use strict';
const FMT = {abcd:['A','B','C','D'], abcde:['A','B','C','D','E'], abc:['A','B','C'], tf:['T','F'], line:null};
// the sheet: 196 × 150 mm (half of 8.5 × 13 in, landscape, inside the 0.3 in margins)
const W = 196, H = 150, MK = 5;                                    // corner squares are 5 mm
const MC = [[MK/2, MK/2], [W - MK/2, MK/2], [W - MK/2, H - MK/2], [MK/2, H - MK/2]];   // TL TR BR BL centres
const QR = {x: 167, y: 6.5, s: 19};
const GRID = {x0: 8, x1: 188, y0: 33, y1: 143};
const CFG = [{rowP:4.9, bubD:4.0, bubP:5.2, numW:7.2, gap:3.6}, {rowP:4.4, bubD:3.6, bubP:4.7, numW:6.6, gap:3}, {rowP:4.0, bubD:3.3, bubP:4.3, numW:6.2, gap:2.6}];

function layout(parts){
  parts = (parts || []).filter(p => +p.n > 0);
  const multi = parts.length > 1;
  for(const c of CFG){
    const R = Math.floor((GRID.y1 - GRID.y0) / c.rowP);
    const lineW = 30 * (c.bubP / 5.2);
    const ent = []; let no = 0;
    parts.forEach((p, pi) => { const ch = FMT[p.fmt] === undefined ? FMT.abcd : FMT[p.fmt];
      if(multi) ent.push({lab: (p.label || ('Part ' + (pi + 1))).trim(), w: Math.min(46, 1.3 * ((p.label || 'Part 1').trim().length) + 2), part: pi});
      for(let k = 0; k < +p.n; k++){ no++; ent.push({no, part: pi, fmt: FMT[p.fmt] === undefined ? 'abcd' : p.fmt, ch, w: c.numW + (ch ? ch.length * c.bubP : lineW)}); } });
    // fill columns top to bottom
    const cols = []; let col = null;
    ent.forEach(e => { if(!col || col.rows.length >= R || (e.lab && col.rows.length >= R - 1)){ col = {rows: [], w: 0}; cols.push(col); }
      col.rows.push(e); col.w = Math.max(col.w, e.w); });
    const total = cols.reduce((a, cl) => a + cl.w, 0) + c.gap * Math.max(0, cols.length - 1);
    if(total > GRID.x1 - GRID.x0 + 0.01 && c !== CFG[CFG.length - 1]) continue;
    let x = GRID.x0 + Math.max(0, (GRID.x1 - GRID.x0 - total) / 2);
    const items = [], labels = [];
    cols.forEach(cl => { cl.rows.forEach((e, r) => { const y = GRID.y0 + r * c.rowP;
        if(e.lab){ labels.push({text: e.lab, x, y, part: e.part}); return; }
        const it = {no: e.no, part: e.part, fmt: e.fmt, x, y, cy: y + c.rowP / 2, bub: []};
        if(e.ch) e.ch.forEach((L, k) => it.bub.push({L, x: x + c.numW + c.bubP / 2 + k * c.bubP, y: y + c.rowP / 2}));
        else it.line = {x0: x + c.numW, x1: x + c.numW + lineW - 1.5, y: y + c.rowP - 0.9};
        items.push(it); });
      x += cl.w + c.gap; });
    return {W, H, MK, MC, QR, GRID, cfg: c, items, labels, n: no, fits: total <= GRID.x1 - GRID.x0 + 0.01, cols: cols.length};
  }
}

/* ---------- image helpers ---------- */
// RGBA → gray (optionally downscaled so the long side is at most maxSide)
function toGray(data, w, h, maxSide){
  const k = maxSide ? Math.min(1, maxSide / Math.max(w, h)) : 1; const gw = Math.max(1, Math.round(w * k)), gh = Math.max(1, Math.round(h * k));
  const g = new Uint8Array(gw * gh);
  if(k === 1){ for(let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 77 + data[j+1] * 151 + data[j+2] * 28) >> 8; }
  else { const s = 1 / k; for(let y = 0; y < gh; y++){ const sy = Math.min(h - 1, Math.floor((y + 0.5) * s)); for(let x = 0; x < gw; x++){ const sx = Math.min(w - 1, Math.floor((x + 0.5) * s)); const j = (sy * w + sx) * 4; g[y * gw + x] = (data[j] * 77 + data[j+1] * 151 + data[j+2] * 28) >> 8; } } }
  return {w: gw, h: gh, g, k};
}
// adaptive threshold (Bradley): a pixel is "ink" when clearly darker than its neighbourhood
function binarize(G){
  const {w, h, g} = G; const I = new Float64Array((w + 1) * (h + 1));
  for(let y = 0; y < h; y++){ let row = 0; for(let x = 0; x < w; x++){ row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  const s = Math.max(8, Math.round(Math.max(w, h) / 22)), r = s >> 1, b = new Uint8Array(w * h);
  for(let y = 0; y < h; y++){ const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for(let x = 0; x < w; x++){ const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const cnt = (x1 - x0 + 1) * (y1 - y0 + 1); const sum = I[(y1 + 1) * (w + 1) + x1 + 1] - I[y0 * (w + 1) + x1 + 1] - I[(y1 + 1) * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      b[y * w + x] = g[y * w + x] * cnt < sum * 0.78 && g[y * w + x] < 150 ? 1 : 0; } }
  return b;
}
function blobs(b, w, h){
  const lab = new Int32Array(w * h), out = [], st = new Int32Array(w * h); let id = 0;
  for(let p = 0; p < w * h; p++){ if(!b[p] || lab[p]) continue; id++; let sp = 0; st[sp++] = p; lab[p] = id;
    let a = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while(sp){ const q = st[--sp]; const x = q % w, y = (q - x) / w; a++; sx += x; sy += y; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      if(x > 0 && b[q-1] && !lab[q-1]){ lab[q-1] = id; st[sp++] = q-1; } if(x < w-1 && b[q+1] && !lab[q+1]){ lab[q+1] = id; st[sp++] = q+1; }
      if(y > 0 && b[q-w] && !lab[q-w]){ lab[q-w] = id; st[sp++] = q-w; } if(y < h-1 && b[q+w] && !lab[q+w]){ lab[q+w] = id; st[sp++] = q+w; } }
    out.push({a, x: sx / a + 0.5, y: sy / a + 0.5, bw: x1 - x0 + 1, bh: y1 - y0 + 1}); }
  return out;
}
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// the four corner squares: big, solid, square blobs that make the largest sheet-shaped quadrilateral
function findMarkers(G){
  const {w, h} = G; const b = binarize(G); const all = blobs(b, w, h);
  const minS = Math.max(4, Math.max(w, h) / 160), maxS = Math.max(w, h) / 9;
  const cand = all.filter(o => o.bw >= minS && o.bh >= minS && o.bw <= maxS && o.bh <= maxS && Math.max(o.bw, o.bh) / Math.min(o.bw, o.bh) <= 1.6 && o.a / (o.bw * o.bh) >= 0.8)
    .sort((p, q) => q.a - p.a).slice(0, 16);
  const found = [];
  const n = cand.length;
  for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++) for(let k = j + 1; k < n; k++) for(let l = k + 1; l < n; l++){
    const q = [cand[i], cand[j], cand[k], cand[l]]; const as = q.map(o => o.a); if(Math.max(...as) / Math.min(...as) > 3) continue;
    const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
    q.sort((p, r) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(r.y - cy, r.x - cx));
    let sg = 0, ok = true; for(let t = 0; t < 4; t++){ const c = cross(q[t], q[(t+1)%4], q[(t+2)%4]); if(!sg) sg = Math.sign(c); else if(Math.sign(c) !== sg){ ok = false; break; } } if(!ok) continue;
    const area = Math.abs((q[0].x*q[1].y - q[1].x*q[0].y) + (q[1].x*q[2].y - q[2].x*q[1].y) + (q[2].x*q[3].y - q[3].x*q[2].y) + (q[3].x*q[0].y - q[0].x*q[3].y)) / 2;
    if(area < w * h * 0.12) continue;
    const e = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])];
    const L1 = (e[0] + e[2]) / 2, L2 = (e[1] + e[3]) / 2, ratio = Math.max(L1, L2) / Math.min(L1, L2);
    if(ratio < 1.06 || ratio > 1.58) continue;
    if(Math.min(e[0], e[2]) / Math.max(e[0], e[2]) < 0.6 || Math.min(e[1], e[3]) / Math.max(e[1], e[3]) < 0.6) continue;
    // marker size should match the quad size (5 mm squares on a 191 mm wide frame)
    const side = Math.sqrt(as.reduce((a, v) => a + v, 0) / 4); const expect = Math.max(L1, L2) * MK / (W - MK);
    if(side < expect * 0.45 || side > expect * 2.2) continue;
    const sc = area * (1 - Math.abs(ratio - (W - MK) / (H - MK)) * 0.5);
    found.push({sc, q: q.map(o => ({x: o.x / G.k, y: o.y / G.k})), long01: e[0] + e[2] > e[1] + e[3]});
  }
  found.sort((a, b) => b.sc - a.sc);
  // drop near-duplicates, keep a few alternatives (e.g. both halves of an uncut page are in view)
  const keep = []; found.forEach(f => { if(keep.length < 6 && !keep.some(k => k.q.every((p, i) => Math.hypot(p.x - f.q[i].x, p.y - f.q[i].y) < 4 / G.k))) keep.push(f); });
  if(!keep.length) return null; const best = keep[0]; best.alts = keep; return best;
}
// first candidate whose QR corner checks out → {best, H}
function locate(G, best){ if(!best) return null; for(const b of (best.alts || [best])){ const o = orient(G, b); if(o) return {best: b, H: o.H, r: o.r}; } return null; }
// homography mapping 4 src points → 4 dst points
function homography(src, dst){
  const A = [], bv = [];
  for(let i = 0; i < 4; i++){ const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bv.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bv.push(v); }
  for(let c = 0; c < 8; c++){ let p = c; for(let r = c + 1; r < 8; r++) if(Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [bv[c], bv[p]] = [bv[p], bv[c]];
    for(let r = 0; r < 8; r++){ if(r === c) continue; const f = A[r][c] / A[c][c]; for(let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; bv[r] -= f * bv[c]; } }
  const h = bv.map((v, i) => v / A[i][i]); h.push(1); return h;
}
const proj = (h, x, y) => { const d = h[6] * x + h[7] * y + h[8]; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
function px(G, x, y){ x = Math.round(x); y = Math.round(y); if(x < 0 || y < 0 || x >= G.w || y >= G.h) return 255; return G.g[y * G.w + x]; }
function meanAt(G, H, cx, cy, r){ let s = 0, n = 0; for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++){ if(dx*dx + dy*dy > 5) continue; const [u, v] = proj(H, cx + dx * r / 2, cy + dy * r / 2); s += px(G, u, v); n++; } return s / n; }
function pct(a, p){ const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; }
// mm → image homography for each of the 2 possible orientations; the QR corner decides which is right
function orient(G, best){
  const q = best.q; const sets = best.long01 ? [[0,1,2,3],[2,3,0,1]] : [[1,2,3,0],[3,0,1,2]];
  let out = null;
  sets.forEach(s => { const Hm = homography(MC, s.map(i => [q[i].x * G.k, q[i].y * G.k]));
    // the QR square is about half black; the same spot on the other end is mostly white paper
    let dark = 0, n = 0; for(let y = QR.y + 1; y < QR.y + QR.s - 1; y += 0.9) for(let x = QR.x + 1; x < QR.x + QR.s - 1; x += 0.9){ const [u, v] = proj(Hm, x, y); if(px(G, u, v) < 110) dark++; n++; }
    const r = dark / n; if(!out || r > out.r) out = {H: Hm, r}; });
  return out && out.r >= 0.22 ? out : null;   // no QR-like corner → these 4 squares are not the sheet
}
// read every item. G: gray of the photo (any scale, G.k = its scale); best from findMarkers (in photo pixels)
function read(G, Hm, L){
  const c = L.cfg; const r = c.bubD * 0.3;
  const res = L.items.map(it => { if(!it.bub.length) return {no: it.no, line: true};
    const wh = []; for(let x = it.bub[0].x - c.bubP / 2; x <= it.bub[it.bub.length - 1].x + c.bubP / 2; x += 0.7){ wh.push(meanAt(G, Hm, x, it.cy - c.rowP / 2 + 0.25, 0.3)); wh.push(meanAt(G, Hm, x, it.cy + c.rowP / 2 - 0.25, 0.3)); }
    const white = Math.max(60, pct(wh, 0.8));
    const d = it.bub.map(b => Math.max(0, 1 - meanAt(G, Hm, b.x, b.y, r) / white));
    return {no: it.no, d, L: it.bub.map(b => b.L)}; });
  const all = res.filter(x => x.d).flatMap(x => x.d); const base = all.length ? pct(all, 0.5) : 0.1;
  const th = Math.max(base + 0.22, 0.36);
  res.forEach(x => { if(!x.d) return; const idx = x.d.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const on = idx.filter(([v]) => v >= th);
    if(!on.length || (on.length === 1 && idx.length > 1 && on[0][0] - idx[1][0] < 0.15)) x.ans = '';   // nothing clearly shaded
    else if(on.length === 1 || (on[1][0] < Math.max(th + 0.05, 0.42) && on[0][0] - on[1][0] >= 0.22)) x.ans = x.L[on[0][1]];   // a faint second mark = erasure
    else x.ans = '*'; });
  return {items: res, base, th};
}
// a straightened crop of the QR corner (for jsQR), pxPerMm pixels per mm
function qrCrop(G, Hm, ppm){
  ppm = ppm || 9; const m = 2.5, x0 = QR.x - m, y0 = QR.y - m, s = QR.s + 2 * m; const n = Math.round(s * ppm); const out = new Uint8ClampedArray(n * n * 4);
  for(let y = 0; y < n; y++) for(let x = 0; x < n; x++){ const [u, v] = proj(Hm, x0 + x / ppm, y0 + y / ppm); const g = px(G, u, v); const j = (y * n + x) * 4; out[j] = out[j+1] = out[j+2] = g; out[j+3] = 255; }
  return {data: out, w: n, h: n};
}
function score(res, key){
  let right = 0, wrong = 0, blank = 0, multi = 0; const marks = [];
  res.items.forEach(x => { if(x.line){ marks.push({no: x.no, line: true}); return; } const k = (key[x.no - 1] || '').toUpperCase();
    const ok = !!k && x.ans === k; if(!x.ans) blank++; else if(x.ans === '*') multi++; if(ok) right++; else if(k) wrong++;
    marks.push({no: x.no, ans: x.ans, key: k, ok}); });
  return {right, wrong, blank, multi, marks};
}
const api = {FMT, W, H, MK, MC, QR, GRID, layout, toGray, findMarkers, orient, locate, homography, proj, read, qrCrop, score};
root.M = root.M || {}; root.M.omr = api;
if(typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
