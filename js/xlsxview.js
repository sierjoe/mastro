/* MASTRO — draw an Excel sheet (from its XML) as a printable HTML page.
   Keeps column widths, row heights, merges, borders, fonts, fills and alignment, and fits the
   print area on the template's own paper (e.g. SF10 on 8.5 × 13 in folio). */
(function () {
'use strict';
const M = window.M;
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const ANS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const colNum = (L) => L.split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64, 0);
const parseRef = (x) => { const m = String(x).replace(/\$/g,'').match(/^([A-Z]+)(\d+)$/); return m ? {c:colNum(m[1]), r:+m[2]} : null; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// paper sizes (inches) by Excel paperSize code
const PAPER = {1:[8.5,11], 5:[8.5,14], 9:[8.27,11.69], 14:[8.5,13], 8:[11.69,16.54], 11:[5.83,8.27]};
const INDEXED = {8:'000000', 9:'FFFFFF', 10:'FF0000', 11:'00FF00', 12:'0000FF', 13:'FFFF00', 22:'C0C0C0', 23:'808080', 64:'000000', 65:'FFFFFF'};

function tint(hex, t){
  if(!t) return hex; let [r,g,b] = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
  const f = (v) => t < 0 ? v*(1+t) : v + (255-v)*t;
  return [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,f(v)))).toString(16).padStart(2,'0')).join('');
}
// read styles.xml + theme colours once per workbook
M.xvStyles = function(stDoc, themeDoc){
  const theme = [];
  if(themeDoc){ const cs = themeDoc.getElementsByTagNameNS(ANS,'clrScheme')[0];
    if(cs){ const order = ['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
      order.forEach(n => { const el = cs.getElementsByTagNameNS(ANS,n)[0]; if(!el) return theme.push(null); const s = el.getElementsByTagNameNS(ANS,'srgbClr')[0], y = el.getElementsByTagNameNS(ANS,'sysClr')[0];
        theme.push(s ? s.getAttribute('val') : y ? (y.getAttribute('lastClr') || (n==='lt1'?'FFFFFF':'000000')) : null); }); } }
  if(!theme.length) theme.push('FFFFFF','000000','E7E6E6','44546A','4472C4','ED7D31','A5A5A5','FFC000','5B9BD5','70AD47');
  const color = (el) => { if(!el) return null; if(el.getAttribute('auto')) return null;
    const rgb = el.getAttribute('rgb'); if(rgb) return rgb.slice(-6);
    const th = el.getAttribute('theme'); if(th !== null){ const base = theme[+th]; return base ? tint(base, +(el.getAttribute('tint')||0)) : null; }
    const ix = el.getAttribute('indexed'); if(ix !== null) return INDEXED[+ix] || null; return null; };
  const kids = (el, tag) => el ? [...el.childNodes].filter(n => n.localName === tag) : [];
  const fonts = kids(stDoc.getElementsByTagNameNS(NS,'fonts')[0], 'font').map(f => {
    const g = (t) => f.getElementsByTagNameNS(NS,t)[0];
    return {b: !!g('b') && g('b').getAttribute('val')!=='0', i: !!g('i') && g('i').getAttribute('val')!=='0', u: !!g('u'), sz: +(g('sz')?.getAttribute('val')||11), name: g('name')?.getAttribute('val') || 'Calibri', color: color(g('color'))}; });
  const fills = kids(stDoc.getElementsByTagNameNS(NS,'fills')[0], 'fill').map(f => { const p = f.getElementsByTagNameNS(NS,'patternFill')[0]; if(!p || !p.getAttribute('patternType') || p.getAttribute('patternType')==='none') return null; return color(p.getElementsByTagNameNS(NS,'fgColor')[0]) || null; });
  const borders = kids(stDoc.getElementsByTagNameNS(NS,'borders')[0], 'border').map(b => { const o = {};
    ['left','right','top','bottom'].forEach(side => { const e = kids(b, side)[0]; const st = e && e.getAttribute('style'); if(st) o[side] = {st, color: color(e.getElementsByTagNameNS(NS,'color')[0]) || '000000'}; }); return o; });
  const numFmts = {}; kids(stDoc.getElementsByTagNameNS(NS,'numFmts')[0], 'numFmt').forEach(n => numFmts[n.getAttribute('numFmtId')] = n.getAttribute('formatCode'));
  const xfs = kids(stDoc.getElementsByTagNameNS(NS,'cellXfs')[0], 'xf').map(x => { const a = x.getElementsByTagNameNS(NS,'alignment')[0];
    return {font: fonts[+(x.getAttribute('fontId')||0)] || fonts[0], fill: fills[+(x.getAttribute('fillId')||0)], border: borders[+(x.getAttribute('borderId')||0)] || {}, numFmt: +(x.getAttribute('numFmtId')||0), fmtCode: numFmts[x.getAttribute('numFmtId')],
      h: a?.getAttribute('horizontal'), v: a?.getAttribute('vertical'), wrap: a?.getAttribute('wrapText')==='1' || a?.getAttribute('wrapText')==='true', rot: +(a?.getAttribute('textRotation')||0), indent: +(a?.getAttribute('indent')||0)}; });
  return {xfs, fonts};
};
// is a font installed? (canvas width test against two generic fonts)
const fontMemo = {};
function fontOk(name){
  if(name in fontMemo) return fontMemo[name];
  try { const cv = document.createElement('canvas').getContext('2d'); const t = 'mmmmmmmmmlli1WWQ@#';
    const w = (f) => { cv.font = '40px ' + f; return cv.measureText(t).width; };
    return fontMemo[name] = ['monospace','serif'].some(g => w(`"${name}",${g}`) !== w(g)); } catch(e){ return fontMemo[name] = true; }
}
// font stack + size factor so text keeps Excel's line lengths when the exact font is missing (e.g. Arial Narrow on iPhone)
function fontCss(name, sz){
  const narrow = /narrow|condensed/i.test(name);
  if(fontOk(name)) return `font-family:'${name}',Arial,sans-serif;font-size:${sz}pt`;
  if(narrow){ const alt = ['Liberation Sans Narrow','Nimbus Sans Narrow','Arial Narrow','Roboto Condensed'].find(fontOk); if(alt) return `font-family:'${alt}',sans-serif;font-size:${sz}pt`; return `font-family:Arial,Helvetica,sans-serif;font-size:${(sz*0.82).toFixed(2)}pt;letter-spacing:-0.01em`; }
  if(/calibri/i.test(name)) return `font-family:Calibri,Carlito,Arial,sans-serif;font-size:${fontOk('Carlito') ? sz : (sz*0.92).toFixed(2)}pt`;
  if(/cambria/i.test(name)) return `font-family:Cambria,Caladea,Georgia,serif;font-size:${sz}pt`;
  if(/bookman/i.test(name)) return `font-family:'Bookman Old Style',Bookman,'URW Bookman',Georgia,serif;font-size:${(sz*0.94).toFixed(2)}pt`;
  if(/times/i.test(name)) return `font-family:'Times New Roman',Times,'Liberation Serif',serif;font-size:${sz}pt`;
  return `font-family:'${name}',Arial,sans-serif;font-size:${sz}pt`;
}
const BSTYLE = {thin:'1px solid', hair:'1px solid', medium:'2px solid', thick:'3px solid', dashed:'1px dashed', mediumDashed:'2px dashed', dotted:'1px dotted', double:'3px double', dashDot:'1px dashed', mediumDashDot:'2px dashed', slantDashDot:'2px dashed', dashDotDot:'1px dotted', mediumDashDotDot:'2px dotted'};
const isDateFmt = (id, code) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (code && /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g,'')) && !/0|#/.test(code));
function fmtValue(raw, xf){
  if(raw === null || raw === undefined || raw === '') return '';
  if(typeof raw === 'number'){
    if(xf && isDateFmt(xf.numFmt, xf.fmtCode) && raw > 1000 && raw < 80000){ const d = new Date(Math.round((raw - 25569) * 86400000)); return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`; }
    if(xf && (xf.numFmt === 9 || xf.numFmt === 10 || /%/.test(xf.fmtCode||''))) return (raw*100).toFixed(xf.numFmt===10?2:0) + '%';
    if(xf && (xf.numFmt === 2 || /0\.00(?!0)/.test(xf.fmtCode||''))) return raw.toFixed(2);
    return String(Math.round(raw*100)/100);
  }
  return String(raw);
}
// one sheet → {html (page box), w, h} ; area like "$B$1:$BD$85"
M.xvRender = function(doc, sst, styles, area, opts = {}){
  const g = (t) => doc.getElementsByTagNameNS(NS, t)[0];
  const fmtPr = g('sheetFormatPr');
  const defW = +(fmtPr?.getAttribute('defaultColWidth') || ((+(fmtPr?.getAttribute('baseColWidth')||8)) + 0.71));
  const defH = +(fmtPr?.getAttribute('defaultRowHeight') || 15);
  const colW = {}, colHidden = {};
  [...doc.getElementsByTagNameNS(NS,'col')].forEach(c => { const a = +c.getAttribute('min'), b = +c.getAttribute('max'); for(let i=a;i<=Math.min(b,a+400);i++){ colW[i] = c.getAttribute('width') ? +c.getAttribute('width') : defW; if(c.getAttribute('hidden')==='1') colHidden[i] = 1; } });
  const rowH = {}, rowHidden = {}, cells = {};
  let maxR = 1, maxC = 1;
  [...doc.getElementsByTagNameNS(NS,'row')].forEach(r => { const n = +r.getAttribute('r'); if(r.getAttribute('ht')) rowH[n] = +r.getAttribute('ht'); if(r.getAttribute('hidden')==='1') rowHidden[n] = 1;
    [...r.getElementsByTagNameNS(NS,'c')].forEach(c => { const p = parseRef(c.getAttribute('r')); if(!p) return; maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c);
      const t = c.getAttribute('t'); const v = c.getElementsByTagNameNS(NS,'v')[0]; let val = '';
      if(t === 's') val = v ? (sst[+v.textContent] || '') : ''; else if(t === 'inlineStr') val = [...c.getElementsByTagNameNS(NS,'t')].map(x=>x.textContent).join(''); else if(t === 'str' || t === 'e') val = v ? v.textContent : ''; else if(t === 'b') val = v ? (v.textContent==='1'?'TRUE':'FALSE') : ''; else val = v && v.textContent !== '' ? +v.textContent : '';
      cells[`${p.c},${p.r}`] = {val, s: +(c.getAttribute('s')||0)}; }); });
  let c1 = 1, r1 = 1, c2 = maxC, r2 = maxR;
  if(area){ const [a, b] = area.replace(/\$/g,'').split(':'); const A = parseRef(a), B = parseRef(b||a); if(A && B){ c1 = A.c; r1 = A.r; c2 = B.c; r2 = B.r; } }
  const merges = {}, covered = {};
  [...doc.getElementsByTagNameNS(NS,'mergeCell')].forEach(m => { const [a,b] = m.getAttribute('ref').split(':'); const A = parseRef(a), B = parseRef(b||a); if(!A||!B) return;
    merges[`${A.c},${A.r}`] = {c2:B.c, r2:B.r}; for(let r=A.r;r<=B.r;r++) for(let c=A.c;c<=B.c;c++) if(r!==A.r || c!==A.c) covered[`${c},${r}`] = 1; });
  const mdw = Math.max(5, Math.round(7 * ((styles.fonts[0] && styles.fonts[0].sz) || 11) / 11)); // max digit width of the default font
  const cpx = (c) => colHidden[c] ? 0 : Math.round((colW[c] ?? (defW || 8.43)) * mdw);
  const rpx = (r) => rowHidden[r] ? 0 : Math.round((rowH[r] ?? defH) * 96 / 72);
  let W = 0, H = 0; for(let c=c1;c<=c2;c++) W += cpx(c); for(let r=r1;r<=r2;r++) H += rpx(r);
  const bcss = (b) => b ? `${BSTYLE[b.st] || '1px solid'} #${b.color}` : '';
  let html = `<table class="xv-t" style="width:${W}px"><colgroup>${[...Array(c2-c1+1).keys()].map(i => `<col style="width:${cpx(c1+i)}px">`).join('')}</colgroup><tbody>`;
  for(let r=r1; r<=r2; r++){
    html += `<tr style="height:${rpx(r)}px">`;
    for(let c=c1; c<=c2; c++){
      const k = `${c},${r}`; if(covered[k]) continue;
      const cell = cells[k]; const xf = styles.xfs[cell ? cell.s : 0] || styles.xfs[0] || {font:{}, border:{}};
      const mg = merges[k]; const cs = mg ? Math.min(mg.c2, c2) - c + 1 : 1, rs = mg ? Math.min(mg.r2, r2) - r + 1 : 1;
      // borders of a merged range come from its edge cells
      const bEdge = (side) => { if(!mg) return xf.border[side];
        const pick = (cc, rr) => { const x = cells[`${cc},${rr}`]; const s = x ? styles.xfs[x.s] : null; return s && s.border[side]; };
        if(side==='right') return pick(Math.min(mg.c2,c2), r) || xf.border.right; if(side==='bottom') return pick(c, Math.min(mg.r2,r2)) || xf.border.bottom; return xf.border[side]; };
      const f = xf.font || {};
      const st = [fontCss(f.name||'Calibri', f.sz||11)];
      if(mg && !xf.wrap) st.push('overflow:hidden');
      if(f.b) st.push('font-weight:bold'); if(f.i) st.push('font-style:italic'); if(f.u) st.push('text-decoration:underline'); if(f.color) st.push(`color:#${f.color}`);
      if(xf.fill) st.push(`background:#${xf.fill}`);
      ['left','right','top','bottom'].forEach(sd => { const b = bEdge(sd); if(b) st.push(`border-${sd}:${bcss(b)}`); });
      const val = cell ? cell.val : '';
      const al = xf.h || (typeof val === 'number' ? 'right' : 'left');
      st.push(`text-align:${al==='centerContinuous'||al==='center'?'center':al==='right'?'right':al==='justify'?'justify':'left'}`);
      st.push(`vertical-align:${xf.v==='center'?'middle':xf.v==='top'?'top':'bottom'}`);
      if(xf.wrap) st.push('white-space:pre-wrap;word-break:break-word'); else st.push('white-space:pre');
      if(xf.indent) st.push(`padding-left:${xf.indent*9}px`);
      const txt = esc(fmtValue(val, xf));
      const ja = al==='centerContinuous'||al==='center' ? 'c' : al==='right' ? 'r' : 'l';
      const inner = !txt ? '' : xf.rot === 90 || xf.rot === 255 ? `<div class="xv-rot">${txt}</div>` : xf.rot === 180 ? `<div class="xv-rot r">${txt}</div>` : xf.wrap ? txt : `<div class="xv-o ${ja}"><span>${txt}</span></div>`;
      html += `<td${cs>1?` colspan="${cs}"`:''}${rs>1?` rowspan="${rs}"`:''} style="${st.join(';')}">${inner}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  // pictures and check boxes from the sheet's drawing (anchored to cells)
  if(opts.drawings && opts.drawings.length){
    const xAt = (col, off) => { let x = 0; for(let c=c1;c<col;c++) x += cpx(c); return x + off/9525; };
    const yAt = (row, off) => { let y = 0; for(let r=r1;r<row;r++) y += rpx(r); return y + off/9525; };
    let ov = '';
    opts.drawings.forEach(d => { if(d.c + 1 < c1 || d.c + 1 > c2 || d.r + 1 < r1 || d.r + 1 > r2) return;
      const x = xAt(d.c + 1, d.co), y = yAt(d.r + 1, d.ro);
      const w = d.c2 != null ? xAt(d.c2 + 1, d.co2) - x : d.cx/9525, h = d.r2 != null ? yAt(d.r2 + 1, d.ro2) - y : d.cy/9525;
      if(d.src) ov += `<img src="${d.src}" alt="" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px">`;
      else if(d.box) ov += `<span class="xv-box" style="left:${(x+2).toFixed(1)}px;top:${(y + h/2 - 6).toFixed(1)}px">${d.checked?'✓':''}</span>`; });
    html = `<div style="position:relative;width:${W}px;height:${H}px">${html}${ov}</div>`;
  }
  // paper, margins and fit
  const ps = g('pageSetup'), pm = g('pageMargins'), spr = g('pageSetUpPr');
  let [pw, ph] = PAPER[+(ps?.getAttribute('paperSize')||9)] || PAPER[9];
  if((opts.orientation || ps?.getAttribute('orientation')) === 'landscape') [pw, ph] = [ph, pw];
  if(opts.paper){ [pw, ph] = opts.paper; }
  const mL = +(pm?.getAttribute('left') ?? 0.5), mR = +(pm?.getAttribute('right') ?? 0.5), mT = +(pm?.getAttribute('top') ?? 0.5), mB = +(pm?.getAttribute('bottom') ?? 0.5);
  const iw = (pw - mL - mR) * 96, ih = (ph - mT - mB) * 96;
  const fit = spr?.getAttribute('fitToPage') === '1' || spr?.getAttribute('fitToPage') === 'true';
  let k = fit ? Math.min(iw / W, ih / H) : Math.min(1, (+(ps?.getAttribute('scale')||100))/100, iw / W);
  if(!fit && H * k > ih) k = Math.min(k, ih / H);
  return {W, H, k, paper:[pw, ph], margins:[mT, mR, mB, mL],
    html: `<div class="xv-page" style="width:${pw}in;height:${ph}in;padding:${mT}in ${mR}in ${mB}in ${mL}in"><div class="xv-fit" style="width:${(W*k).toFixed(1)}px;height:${(H*k).toFixed(1)}px"><div class="xv-scale" style="transform:scale(${k.toFixed(4)})">${html}</div></div></div>`};
};
/* helpers that read the parts of an opened workbook zip */
const DNS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const resolve = (base, t) => { if(t.startsWith('/')) return t.slice(1); const parts = base.split('/'); parts.pop(); t.split('/').forEach(x => { if(x==='..') parts.pop(); else if(x!=='.') parts.push(x); }); return parts.join('/'); };
const relsOf = async (zip, path) => { const rp = path.replace(/([^\/]+)$/, '_rels/$1.rels'); const f = zip.file(rp); if(!f) return []; const d = new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  return [...d.getElementsByTagName('Relationship')].map(r => ({id:r.getAttribute('Id'), type:r.getAttribute('Type'), target: r.getAttribute('TargetMode')==='External' ? null : resolve(path, r.getAttribute('Target'))})); };
M.xvRels = relsOf;
M.xvBook = async function(zip){
  const P = new DOMParser(); const rd = async (p) => zip.file(p) ? P.parseFromString(await zip.file(p).async('string'), 'application/xml') : null;
  const st = await rd('xl/styles.xml'); const theme = await rd(Object.keys(zip.files).find(p => /^xl\/theme\/theme\d*\.xml$/.test(p)) || 'xl/theme/theme1.xml');
  return st ? M.xvStyles(st, theme) : {xfs:[{font:{}, border:{}}], fonts:[]};
};
M.xvDrawings = async function(zip, sheetPath, sheetDoc){
  const out = []; const rels = await relsOf(zip, sheetPath);
  const dEl = sheetDoc && sheetDoc.getElementsByTagNameNS(NS,'drawing')[0]; const rid = dEl && dEl.getAttributeNS(RNS,'id');
  const dr = rels.find(r => (rid ? r.id === rid : /\/drawing$/.test(r.type)) && r.target);
  if(!dr || !zip.file(dr.target)) return out;
  const doc = new DOMParser().parseFromString(await zip.file(dr.target).async('string'), 'application/xml');
  const drels = await relsOf(zip, dr.target); const cache = {};
  const num = (el, t) => +(el?.getElementsByTagNameNS(DNS, t)[0]?.textContent || 0);
  for(const a of [...doc.getElementsByTagNameNS(DNS,'twoCellAnchor'), ...doc.getElementsByTagNameNS(DNS,'oneCellAnchor')]){
    const fr = a.getElementsByTagNameNS(DNS,'from')[0], to = a.getElementsByTagNameNS(DNS,'to')[0]; if(!fr) continue;
    const d = {c:num(fr,'col'), co:num(fr,'colOff'), r:num(fr,'row'), ro:num(fr,'rowOff')};
    if(to){ d.c2 = num(to,'col'); d.co2 = num(to,'colOff'); d.r2 = num(to,'row'); d.ro2 = num(to,'rowOff'); }
    else { const ext = a.getElementsByTagNameNS(DNS,'ext')[0]; d.cx = +(ext?.getAttribute('cx')||0); d.cy = +(ext?.getAttribute('cy')||0); }
    const pic = a.getElementsByTagNameNS(DNS,'pic')[0];
    if(pic){ const blip = pic.getElementsByTagNameNS(ANS,'blip')[0]; const id = blip && blip.getAttributeNS(RNS,'embed'); const r = drels.find(x => x.id === id);
      if(r && zip.file(r.target)){ if(!cache[r.target]){ const ext = r.target.split('.').pop().toLowerCase(); const b64 = await zip.file(r.target).async('base64'); cache[r.target] = `data:image/${ext==='jpg'?'jpeg':ext==='svg'?'svg+xml':ext};base64,${b64}`; } d.src = cache[r.target]; out.push(d); } }
    else { const nv = a.getElementsByTagNameNS(DNS,'cNvPr')[0]; if(nv && /check\s*box/i.test(nv.getAttribute('name')||'')){ d.box = true; out.push(d); } }
  }
  return out;
};
M.xvPrintArea = function(wbDoc, sheetIndex){
  const dn = [...wbDoc.getElementsByTagNameNS(NS,'definedName')].find(d => d.getAttribute('name')==='_xlnm.Print_Area' && +d.getAttribute('localSheetId')===sheetIndex);
  return dn ? dn.textContent.split(',')[0].split('!').pop() : null;
};
M.xvPageCss = (paper) => `@page{size:${paper[0]}in ${paper[1]}in;margin:0}`;
})();
