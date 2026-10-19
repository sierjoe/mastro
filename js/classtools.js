/* MASTRO — Classes extras (v6.7)
   1. Learners' progress slips: raw scores of Written Works, Performance Tasks and Examinations, 2 slips per A4 (0.5 in margins, no overflow)
   2. Teacher tools: make groups, spin wheel, duck race, random pick
   3. ECR safety net: every ECR in its own folder, packed for your Google Drive folder */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum} = M;
const CL = {ww:'Written Works', pt:'Performance Tasks', qa:'Examinations'};

/* ---------- shared: A4 preview modal (same pages that print) ---------- */
M.pagePreview = function(title, html, opts = {}){
  const land = !!opts.land;
  M.modal(title, `<div class="row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><span class="small muted">${esc(opts.note || ('A4 ' + (land ? 'landscape' : 'portrait') + ' · 0.5 in margins'))}</span><span class="spacer"></span>${opts.extra || ''}<button class="btn primary" id="pvP">${ico('print')} Print</button></div>
    <div class="rd-prev-wrap"><div class="print-only rd-prev">${html}</div></div>`, b => {
    const box = $('.rd-prev', b); const pw = (land ? 297 : 210) * 96 / 25.4; box.style.zoom = Math.min(1, ($('.rd-prev-wrap', b).clientWidth - 24) / pw).toFixed(3);
    $('#pvP', b).onclick = () => opts.onPrint ? opts.onPrint() : M.doPrint(html, M.pageCss('A4', land), {noFit: true});
    if(opts.onMount) opts.onMount(b);
  }, true);
};
// any list of page bodies → fixed A4 sheets; each is shrunk only when it would not fit
M.fitA4 = function(pages, land){
  const css = M.pageCss('A4', land); const [PW, PH] = M.printableMm(css); const W = Math.floor(PW) - 0.5, H = Math.floor(PH) - 0.5, px = 96 / 25.4;
  return pages.map(html => { let k = 1;
    for(let i = 0; i < 6; i++){ const m = M.measurePrint(html, W / k); if(m.w * k <= W * px + 1 && m.h * k <= H * px - 2) break; k = Math.min(k * 0.995, (W * px) / Math.max(m.w, 1), (H * px - 2) / Math.max(m.h, 1)); }
    return `<div class="fitbox" style="width:${W}mm;height:${H}mm;overflow:hidden"><div style="width:${(W / k).toFixed(2)}mm;transform:scale(${k.toFixed(4)});transform-origin:0 0">${html}</div></div>`; }).join('');
};

/* ---------- roster of a class record ---------- */
const termsOf = (E) => Object.keys(E.terms || {}).sort();
const rosterOf = (E) => { const t = termsOf(E); const T = t.length ? E.terms[t[t.length - 1]] : null;
  if(T) return T.learners.map(x => ({name: x.name, sex: x.sex || ''}));
  const R = (E.model && E.model.roster) || null; if(R) return [...R.M.filter(Boolean).map(n => ({name: n, sex:'M'})), ...R.F.filter(Boolean).map(n => ({name: n, sex:'F'}))];
  return (E.roster || []).map(n => typeof n === 'string' ? {name: n, sex: ''} : n); };
// learners tagged T/O, NLP or DO in any of your MASTRO class rosters are left out of groups and pickers
const outNames = () => { const out = []; (M.S.classes || []).forEach(c => (c.learners || []).forEach(l => { if(!M.counted(l)) out.push({n: M.normName(l.name), tag: (M.STATUS[l.status] || {}).short || l.status}); })); return out; };
const outTag = (name, out) => { const n = M.normName(name); const hit = out.find(o => o.n === n || M.sim(o.n, n) >= 0.88); return hit ? hit.tag : ''; };
const short = (n) => { const [last, rest] = String(n).split(','); const first = (rest || '').trim().split(/\s+/)[0] || ''; return first ? `${first} ${last.trim().charAt(0)}.` : last.trim(); };
const nice = (n) => String(n).toLowerCase().replace(/(^|[\s,.-])([a-zñ])/g, (m, a, b) => a + b.toUpperCase());

/* =====================================================================
   1 · PROGRESS SLIPS
   ===================================================================== */
function slipHtml(E, term, x){
  const T = E.terms[term]; const s = M.S.settings;
  const comp = (k) => { const C = T.comp && T.comp[k]; if(!C) return '';
    const items = (C.hps || []).map((h, i) => ({h, v: (x[k] || [])[i], lab: (C.labels || [])[i] || String(i + 1), ttl: ((C.titles || [])[i] || '')})).filter(it => isNum(it.h) && it.h > 0);
    if(!items.length) return '';
    const got = items.filter(it => isNum(it.v)); const tot = got.reduce((a, it) => a + it.v, 0), hp = items.reduce((a, it) => a + it.h, 0);
    return `<tr><td class="ps-c"><b>${CL[k]}</b>${C.w ? `<span>${C.w}%</span>` : ''}</td>
      <td class="ps-g">${items.map(it => `<span class="ps-i ${isNum(it.v) ? '' : 'miss'}" title="${esc(it.ttl)}"><i>${esc(String(it.lab).replace(/^(\d+)$/, k === 'qa' ? 'Exam $1' : '#$1'))}</i><b>${isNum(it.v) ? it.v : '—'}</b><u>/${it.h}</u></span>`).join('')}</td>
      <td class="ps-n">${got.length ? tot : '—'}<small>/${hp}</small></td><td class="ps-n">${isNum(x[k + 'PS']) ? fmt(x[k + 'PS'], 2) : '—'}</td><td class="ps-n">${isNum(x[k + 'WS']) ? fmt(x[k + 'WS'], 2) : '—'}</td></tr>`; };
  const g = isNum(x.tg) ? x.tg : null;
  return `<div class="pslip">
    <div class="ps-head"><div><b>${esc(s.school || '')}</b><span>${esc(E.subject || '')} · ${esc(E.title)} · SY ${esc(E.sy || '')}</span></div><div class="ps-title">LEARNER'S PROGRESS SLIP<span>Term ${esc(term)} · Learner's copy</span></div></div>
    <div class="ps-name"><span>Name: <b>${esc(x.name)}</b></span><span>Date issued: <b>${esc(new Date().toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}))}</b></span></div>
    <table class="ps-t"><thead><tr><th>Component</th><th>Scores (score / highest possible)</th><th>Total</th><th>PS</th><th>WS</th></tr></thead>
      <tbody>${['ww','pt','qa'].map(comp).join('')}</tbody></table>
    <div class="ps-sum"><span>Initial grade <b>${isNum(x.ig) ? fmt(x.ig, 2) : '—'}</b></span><span>Term grade <b>${g ?? '—'}</b></span><span>Descriptor <b>${g !== null ? esc(M.descriptor(g)) : '—'}</b></span><span class="ps-note">“—” = no score yet</span></div>
    <div class="ps-sign"><div><div class="ln"></div>Subject Teacher</div><div><div class="ln"></div>Parent / Guardian signature</div></div>
  </div>`;
}
// two slips per A4 sheet; each half holds one slip, shrunk only if it would spill
function slipPages(E, term, list){
  const css = M.pageCss('A4'); const [PW, PH] = M.printableMm(css); const W = Math.floor(PW) - 0.5, H = Math.floor(PH) - 0.5, half = H / 2, px = 96 / 25.4, pad = 4;
  const cell = (x) => { const html = slipHtml(E, term, x); let k = 1;
    for(let i = 0; i < 5; i++){ const m = M.measurePrint(`<div class="pslip-wrap">${html}</div>`, W / k); if(m.h * k <= (half - pad * 2) * px && m.w * k <= W * px + 1) break; k = Math.min(k * 0.99, (half - pad * 2) * px / m.h, W * px / m.w); }
    return `<div class="ps-half" style="height:${half}mm"><div style="width:${(W / k).toFixed(2)}mm;transform:scale(${k.toFixed(4)});transform-origin:0 0;padding-top:${pad / k}mm"><div class="pslip-wrap">${html}</div></div></div>`; };
  const out = [];
  for(let i = 0; i < list.length; i += 2){ const a = list[i], b = list[i + 1];
    out.push(`<div class="fitbox ps-page" style="width:${W}mm;height:${H}mm;overflow:hidden">${cell(a)}<i class="ps-cut"></i>${b ? cell(b) : `<div class="ps-half" style="height:${half}mm"></div>`}</div>`); }
  return out.join('');
}
M.progressSlips = function(E){
  const terms = termsOf(E); if(!terms.length) return M.toast('No scores yet in this class record');
  let term = terms[terms.length - 1];
  const OUT = outNames();
  const draw = (b) => { const T = E.terms[term]; const L = T.learners;
    $('#psList', b).innerHTML = ['M','F',''].map(sx => { const arr = L.map((x, i) => ({x, i})).filter(o => (o.x.sex || '') === sx); if(!arr.length) return '';
      return `<div class="ps-grp"><div class="tiny muted" style="margin:8px 0 4px">${sx === 'M' ? 'MALE' : sx === 'F' ? 'FEMALE' : 'LEARNERS'} <a href="#" data-allsx="${sx}">select all</a></div>${arr.map(o => { const tg = outTag(o.x.name, OUT); return `<label class="ps-pick"><input type="checkbox" data-i="${o.i}" ${tg || o.x.noScores ? '' : 'checked'}> ${esc(o.x.name)}${tg ? ` <span class="chip red" style="font-size:10px;padding:1px 7px">${esc(tg)}</span>` : ''}${o.x.noScores ? ' <span class="tiny muted">(no scores)</span>' : ''}</label>`; }).join('')}</div>`; }).join('');
    $$('[data-allsx]', b).forEach(a => a.onclick = (e) => { e.preventDefault(); const box = a.closest('.ps-grp'); const cbs = $$('input', box); const on = !cbs.every(c => c.checked); cbs.forEach(c => c.checked = on); upd(b); });
    $$('#psList input', b).forEach(c => c.onchange = () => upd(b)); upd(b); };
  const upd = (b) => { const n = $$('#psList input:checked', b).length; $('#psN', b).textContent = `${n} slip(s) · ${Math.ceil(n / 2)} A4 sheet(s)`; };
  const chosen = (b) => { const T = E.terms[term]; return $$('#psList input:checked', b).map(c => T.learners[+c.dataset.i]); };
  M.modal(`Progress slips · ${E.title} · ${E.subject}`, `
    <p class="small muted" style="margin-top:0">Raw scores in Written Works, Performance Tasks and Examinations for each learner — <b>2 slips per A4</b>, with a cut line. Tick only the learners who need a (replacement) copy.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><div class="seg" id="psT">${terms.map(t => `<button data-t="${t}" class="${t === term ? 'on' : ''}">Term ${t}</button>`).join('')}</div>
      <button class="btn sm" id="psAll">All</button><button class="btn sm" id="psNone">None</button>
      <input class="input" id="psQ" placeholder="Find a learner…" style="max-width:200px;padding:6px 10px"><span class="spacer"></span><span class="small muted" id="psN"></span></div>
    <div id="psList" class="ps-list"></div>
    <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn" id="psV">${ico('eye')} View</button><button class="btn primary" id="psP">${ico('print')} Print</button></div>`, b => {
    $$('#psT button', b).forEach(x => x.onclick = () => { term = x.dataset.t; $$('#psT button', b).forEach(y => y.classList.toggle('on', y === x)); draw(b); });
    $('#psAll', b).onclick = () => { $$('#psList input', b).forEach(c => c.checked = true); upd(b); };
    $('#psNone', b).onclick = () => { $$('#psList input', b).forEach(c => c.checked = false); upd(b); };
    $('#psQ', b).oninput = (e) => { const q = M.normName(e.target.value); $$('.ps-pick', b).forEach(l => l.style.display = !q || M.normName(l.textContent).includes(q) ? '' : 'none'); };
    const go = (view) => { const list = chosen(b); if(!list.length) return M.toast('Tick at least one learner'); const html = slipPages(E, term, list);
      if(view) M.pagePreview(`Progress slips · Term ${term} · ${list.length} learner(s)`, html, {note:`A4 · 2 slips per sheet · 0.5 in margins · ${Math.ceil(list.length / 2)} sheet(s)`});
      else M.doPrint(html, M.pageCss('A4'), {noFit: true}); };
    $('#psV', b).onclick = () => go(true); $('#psP', b).onclick = () => go(false);
    draw(b);
  }, true);
};

/* =====================================================================
   2 · TEACHER TOOLS — groups and fun pickers
   ===================================================================== */
const shuffle = (a) => { a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function makeGroups(list, mode, n, mix){
  const k = mode === 'size' ? Math.max(1, Math.ceil(list.length / Math.max(1, n))) : Math.max(1, Math.min(n, list.length));
  const G = Array.from({length: k}, () => []);
  const order = mix ? [...shuffle(list.filter(x => x.sex === 'M')), ...shuffle(list.filter(x => x.sex !== 'M'))] : shuffle(list);
  // deal like cards so sizes differ by at most one and boys / girls spread evenly
  let gi = 0; order.forEach(x => { G[gi].push(x); gi = (gi + 1) % k; });
  return G.map(g => shuffle(g));
}
const COLORS = ['#1f6b4a','#c9a227','#2e86ab','#e07a5f','#6a4c93','#3d9970','#f4a261','#8d99ae','#d62828','#2a9d8f','#e9c46a','#7b2cbf'];
M.teacherTools = function(E){
  const OUT = outNames(); const gone = rosterOf(E).filter(x => outTag(x.name, OUT)); const all = rosterOf(E).filter(x => !outTag(x.name, OUT)); if(!all.length) return M.toast('No learners in this class record yet');
  const st = E.tools = E.tools || {};
  const ui = M.ttUI = Object.assign({tab:'groups', mode:'count', n:5, mix:true, absent:[]}, M.ttUI && M.ttUI.eid === E.id ? M.ttUI : {}, {eid:E.id});
  const present = () => all.filter(x => !ui.absent.includes(x.name));
  M.modal(`Teacher tools · ${E.title} · ${E.subject}`, `
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><div class="seg" id="ttTab">${[['groups','👥 Make groups'],['wheel','🎡 Spin wheel'],['race','🦆 Duck race'],['pick','🎲 Random pick']].map(([k, t]) => `<button data-t="${k}" class="${ui.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <span class="spacer"></span>${gone.length ? `<span class="tiny muted" title="${esc(gone.map(x => x.name).join(', '))}">${gone.length} T/O · NLP · DO left out</span>` : ''}<button class="btn sm" id="ttAbs">Who is absent? <b id="ttAbsN">${ui.absent.length || ''}</b></button></div>
    <div id="ttBody"></div>`, b => {
    const body = $('#ttBody', b);
    const render = () => { $$('#ttTab button', b).forEach(x => x.classList.toggle('on', x.dataset.t === ui.tab)); $('#ttAbsN', b).textContent = ui.absent.length ? ui.absent.length : '';
      ({groups, wheel, race, pick})[ui.tab](body); };
    $$('#ttTab button', b).forEach(x => x.onclick = () => { stopAll(); ui.tab = x.dataset.t; render(); });
    $('#ttAbs', b).onclick = () => { const box = body; box.innerHTML = `<p class="small muted" style="margin:0 0 8px">Untick learners who are absent today — they are left out of groups and pickers.</p>
      <div class="ps-list">${all.map(x => `<label class="ps-pick"><input type="checkbox" data-n="${esc(x.name)}" ${ui.absent.includes(x.name) ? '' : 'checked'}> ${esc(x.name)}</label>`).join('')}</div>
      <div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn primary" id="absOk">Done</button></div>`;
      $('#absOk', box).onclick = () => { ui.absent = $$('input', box).filter(c => !c.checked).map(c => c.dataset.n); render(); }; };
    let timers = []; const stopAll = () => { timers.forEach(t => { clearInterval(t); cancelAnimationFrame(t); clearTimeout(t); }); timers = []; };
    M.onModalClose = stopAll;

    /* --- groups --- */
    function groups(el){ const L = present();
      el.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="seg" id="gM"><button data-m="count" class="${ui.mode === 'count' ? 'on' : ''}">Number of groups</button><button data-m="size" class="${ui.mode === 'size' ? 'on' : ''}">Learners per group</button></div>
        <label class="field mini">${ui.mode === 'count' ? 'Groups' : 'Per group'}<input class="input" type="number" min="1" max="${L.length}" id="gN" value="${ui.n}" style="width:80px"></label>
        <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gMix" ${ui.mix ? 'checked' : ''}> Mix boys and girls evenly</label>
        <span class="spacer"></span><button class="btn primary" id="gGo">🎲 Make groups</button>${st.groups ? `<button class="btn" id="gPr">${ico('print')} Print</button>` : ''}</div>
        <div class="small muted" style="margin:8px 0">${L.length} learner(s) present.</div>
        <div id="gOut" class="tt-groups">${st.groups ? st.groups.map((g, i) => `<div class="tt-g" style="--gc:${COLORS[i % COLORS.length]}"><div class="tt-gh">Group ${i + 1}<span>${g.length}</span></div><ol>${g.map(x => `<li>${esc(x.name)}</li>`).join('')}</ol></div>`).join('') : '<div class="empty">Choose how to split the class, then tap <b>Make groups</b>.</div>'}</div>`;
      $$('#gM button', el).forEach(x => x.onclick = () => { ui.mode = x.dataset.m; groups(el); });
      $('#gN', el).onchange = (e) => ui.n = Math.max(1, +e.target.value || 1); $('#gMix', el).onchange = (e) => ui.mix = e.target.checked;
      $('#gGo', el).onclick = () => { ui.n = Math.max(1, +$('#gN', el).value || 1); st.groups = makeGroups(L, ui.mode, ui.n, ui.mix); st.groupsAt = new Date().toISOString(); M.save(); groups(el); $$('.tt-g', el).forEach((g, i) => { g.style.animationDelay = (i * 60) + 'ms'; g.classList.add('pop'); }); };
      if($('#gPr', el)) $('#gPr', el).onclick = () => { const html = M.fitA4([`<div class="rdp">${M.printHeader(`GROUPINGS · ${E.subject} · ${E.title}`)}<p style="text-align:center;margin-top:-4px">${esc(new Date(st.groupsAt || Date.now()).toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric', year:'numeric'}))}</p>
        <div class="rd-grid">${st.groups.map((g, i) => `<div class="rd-gc"><div class="h"><b>Group ${i + 1}</b><span>${g.length} members</span></div><ol>${g.map(x => `<li>${esc(x.name)}</li>`).join('')}</ol></div>`).join('')}</div></div>`]);
        M.doPrint(html, M.pageCss('A4'), {noFit: true}); }; }

    /* --- spin wheel --- */
    function wheel(el){ let L = present().filter(x => !(ui.wheelOut || []).includes(x.name));
      el.innerHTML = `<div class="tt-wheel"><div class="tt-wbox"><canvas id="wC" width="520" height="520"></canvas><div class="tt-ptr">▼</div></div>
        <div class="tt-side"><div class="tt-result" id="wR">Tap SPIN!</div><button class="btn primary tt-big" id="wGo">🎡 SPIN</button>
        <label class="small" style="display:flex;gap:6px;align-items:center;margin-top:10px"><input type="checkbox" id="wRm" ${ui.wheelRm ? 'checked' : ''}> Remove the picked name after each spin</label>
        <div class="small muted" style="margin-top:6px">${L.length} name(s) on the wheel${(ui.wheelOut || []).length ? ` · <a href="#" id="wReset">put all ${ui.wheelOut.length} back</a>` : ''}</div>
        <div class="tt-hist" id="wH">${(ui.wheelHist || []).map(n => `<span>${esc(n)}</span>`).join('')}</div></div></div>`;
      const cv = $('#wC', el), cx = cv.getContext('2d'); let ang = ui.wAng || 0;
      const draw = () => { const n = L.length, R = 255; cx.clearRect(0, 0, 520, 520); if(!n){ cx.fillStyle = '#999'; cx.font = '20px sans-serif'; cx.textAlign = 'center'; cx.fillText('No names left', 260, 260); return; }
        for(let i = 0; i < n; i++){ const a0 = ang + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
          cx.beginPath(); cx.moveTo(260, 260); cx.arc(260, 260, R, a0, a1); cx.closePath(); cx.fillStyle = COLORS[i % COLORS.length]; cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.stroke();
          cx.save(); cx.translate(260, 260); cx.rotate(a0 + Math.PI / n); cx.textAlign = 'right'; cx.fillStyle = '#fff'; cx.font = `bold ${n > 30 ? 11 : n > 18 ? 13 : 16}px Inter, sans-serif`; cx.fillText(short(L[i].name), R - 12, 5); cx.restore(); }
        cx.beginPath(); cx.arc(260, 260, 34, 0, 2 * Math.PI); cx.fillStyle = '#fff'; cx.fill(); cx.fillStyle = '#1f6b4a'; cx.font = 'bold 14px sans-serif'; cx.textAlign = 'center'; cx.fillText('MASTRO', 260, 265); };
      draw();
      $('#wRm', el).onchange = (e) => ui.wheelRm = e.target.checked;
      if($('#wReset', el)) $('#wReset', el).onclick = (e) => { e.preventDefault(); ui.wheelOut = []; wheel(el); };
      $('#wGo', el).onclick = () => { if(!L.length) return; const btn = $('#wGo', el); btn.disabled = true; const start = ang, extra = 2 * Math.PI * (5 + Math.random() * 3) + Math.random() * 2 * Math.PI, dur = 4200, t0 = performance.now();
        const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4); ang = start + extra * e; draw(); if(p < 1){ timers.push(requestAnimationFrame(step)); return; }
          ui.wAng = ang % (2 * Math.PI); const n = L.length; const top = -Math.PI / 2; let rel = ((top - ang) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); const idx = Math.floor(rel / (2 * Math.PI / n)) % n; const who = L[idx];
          $('#wR', el).innerHTML = `<span class="tt-win">${esc(nice(who.name))}</span>`; ui.wheelHist = [nice(who.name), ...(ui.wheelHist || [])].slice(0, 12);
          $('#wH', el).innerHTML = ui.wheelHist.map(n2 => `<span>${esc(n2)}</span>`).join(''); confetti($('.tt-wbox', el));
          btn.disabled = false; if(ui.wheelRm){ ui.wheelOut = [...(ui.wheelOut || []), who.name]; timers.push(setTimeout(() => wheel(el), 1600)); } };
        timers.push(requestAnimationFrame(step)); }; }

    /* --- duck race --- */
    function race(el){ const L = present(); const cnt = Math.min(ui.raceN || Math.min(10, L.length), L.length);
      el.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end"><label class="field mini">Ducks racing<input class="input" type="number" id="rN" min="2" max="${L.length}" value="${cnt}" style="width:80px"></label>
        <span class="small muted">picked at random from ${L.length} learners</span><span class="spacer"></span><button class="btn primary" id="rGo">🏁 Start the race</button></div>
        <div class="tt-race" id="rT"></div><div class="tt-result" id="rR" style="margin-top:10px"></div>`;
      const setup = () => { const n = Math.max(2, Math.min(L.length, +$('#rN', el).value || 2)); ui.raceN = n; const racers = shuffle(L).slice(0, n);
        $('#rT', el).innerHTML = racers.map((x, i) => `<div class="tt-lane" style="--lc:${COLORS[i % COLORS.length]}"><span class="tt-lname">${esc(short(x.name))}</span><div class="tt-track"><span class="tt-duck" data-i="${i}">🦆</span><span class="tt-flag">🏁</span></div></div>`).join(''); return racers; };
      let racers = setup(); $('#rN', el).onchange = () => { racers = setup(); };
      $('#rGo', el).onclick = () => { racers = setup(); $('#rR', el).innerHTML = ''; const btn = $('#rGo', el); btn.disabled = true; const pos = racers.map(() => 0), sp = racers.map(() => .8 + Math.random() * .4);
        const ducks = $$('.tt-duck', el); const track = $('.tt-track', el).clientWidth - 40; let done = false, last = performance.now(); const base = track / 6.5;   // about 6–7 seconds per race, on any device
        const tick = (now) => { if(done) return; const dt = Math.min(0.1, ((now || performance.now()) - last) / 1000); last = now || performance.now();
          racers.forEach((r, i) => { pos[i] += base * dt * sp[i] * (0.55 + Math.random() * 0.9) * (Math.random() < .06 ? 2.2 : 1); if(Math.random() < .03) sp[i] = .75 + Math.random() * .5; ducks[i].style.transform = `translateX(${Math.min(pos[i], track)}px) scaleX(-1)`; });
          const w = pos.findIndex(p => p >= track); if(w >= 0){ done = true; btn.disabled = false; ducks[w].classList.add('won'); $('#rR', el).innerHTML = `🏆 <span class="tt-win">${esc(nice(racers[w].name))}</span> wins!`; confetti($('#rT', el)); return; }
          timers.push(requestAnimationFrame(tick)); };
        timers.push(requestAnimationFrame(tick)); }; }

    /* --- random pick (slot machine) --- */
    function pick(el){ const L = present(); const left = L.filter(x => !(ui.pickOut || []).includes(x.name));
      el.innerHTML = `<div class="tt-slot"><div class="tt-reel" id="pR">${left.length ? '❔' : 'Everyone has been picked!'}</div>
        <div class="row" style="justify-content:center;gap:8px;margin-top:14px"><button class="btn primary tt-big" id="pGo" ${left.length ? '' : 'disabled'}>🎲 Pick a learner</button></div>
        <div class="small muted" style="text-align:center;margin-top:8px">No repeats until everyone is picked · ${left.length} of ${L.length} left${(ui.pickOut || []).length ? ` · <a href="#" id="pReset">start over</a>` : ''}</div>
        <div class="tt-hist" style="justify-content:center">${(ui.pickOut || []).slice().reverse().map(n => `<span>${esc(nice(n))}</span>`).join('')}</div></div>`;
      if($('#pReset', el)) $('#pReset', el).onclick = (e) => { e.preventDefault(); ui.pickOut = []; pick(el); };
      $('#pGo', el).onclick = () => { if(!left.length) return; const btn = $('#pGo', el); btn.disabled = true; const reel = $('#pR', el); const who = left[Math.floor(Math.random() * left.length)]; let i = 0, delay = 40;
        const spin = () => { reel.textContent = nice(L[Math.floor(Math.random() * L.length)].name); reel.classList.toggle('flip'); i++; delay *= 1.09;
          if(delay < 420) timers.push(setTimeout(spin, delay)); else { reel.innerHTML = `<span class="tt-win">${esc(nice(who.name))}</span>`; ui.pickOut = [...(ui.pickOut || []), who.name]; confetti(reel.parentElement); timers.push(setTimeout(() => pick(el), 1800)); } };
        spin(); }; }

    render();
  }, true);
};
function confetti(host){ if(!host) return; host.style.position = host.style.position || 'relative';
  const box = document.createElement('div'); box.className = 'tt-confetti';
  for(let i = 0; i < 40; i++){ const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.background = COLORS[i % COLORS.length]; s.style.animationDelay = (Math.random() * .3) + 's'; s.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(s); }
  host.appendChild(box); setTimeout(() => box.remove(), 2200); }

/* =====================================================================
   4 · PRINT THE ECR — class record (raw scores) and summary, A4 with 0.5 in margins
   ===================================================================== */
function ecrRawPage(E, term, sxLabel, L){
  const T = E.terms[term]; const ks = ['ww','pt','qa'].filter(k => T.comp && T.comp[k]);
  const items = (k) => (T.comp[k].hps || []).map((h, i) => ({h, i, lab: (T.comp[k].labels || [])[i] || String(i + 1)})).filter(it => isNum(it.h) && it.h > 0);
  const n0 = (v, d = 2) => isNum(v) ? fmt(v, d) : '';
  const head1 = ks.map(k => `<th colspan="${items(k).length + 3}">${CL[k]}${T.comp[k].w ? ` (${T.comp[k].w}%)` : ''}</th>`).join('');
  const head2 = ks.map(k => items(k).map(it => `<th>${esc(it.lab)}</th>`).join('') + '<th>Total</th><th>PS</th><th>WS</th>').join('');
  const hps = ks.map(k => { const it = items(k); return it.map(x => `<td>${x.h}</td>`).join('') + `<td>${it.reduce((a, x) => a + x.h, 0)}</td><td>100</td><td>${T.comp[k].w ? T.comp[k].w + '%' : ''}</td>`; }).join('');
  const row = (x, i) => `<tr><td>${i + 1}</td><td class="l">${esc(x.name)}</td>${ks.map(k => items(k).map(it => `<td>${isNum((x[k] || [])[it.i]) ? x[k][it.i] : ''}</td>`).join('') +
    `<td>${isNum(x[k + 'Total']) ? x[k + 'Total'] : (items(k).some(it => isNum((x[k] || [])[it.i])) ? items(k).reduce((a, it) => a + (+(x[k] || [])[it.i] || 0), 0) : '')}</td><td>${n0(x[k + 'PS'])}</td><td>${n0(x[k + 'WS'])}</td>`).join('')}
    <td>${n0(x.ig)}</td><td><b>${isNum(x.tg) ? x.tg : ''}</b></td></tr>`;
  return `<div class="rdp">${M.printHeader('CLASS RECORD')}
    <table class="rd-info"><tr><td>Subject</td><td><b>${esc(E.subject || '')}</b></td><td>Grade &amp; Section</td><td><b>${esc(E.title)}</b></td></tr>
      <tr><td>Term</td><td><b>Term ${esc(term)}</b></td><td>School year</td><td><b>${esc(E.sy || (E.model && E.model.info && E.model.info.sy) || '')}</b></td></tr></table>
    <table class="rd-t ecr-raw"><thead><tr><th rowspan="2">#</th><th rowspan="2" class="l">${sxLabel}</th>${head1}<th rowspan="2">Initial<br>grade</th><th rowspan="2">Term<br>grade</th></tr><tr>${head2}</tr>
      <tr class="hps"><td></td><td class="l"><b>Highest possible score</b></td>${hps}<td></td><td></td></tr></thead>
      <tbody>${L.map(row).join('') || '<tr><td colspan="99">No learners.</td></tr>'}</tbody></table>
    ${M.printSign(M.cls(), 'Prepared by:', 'Noted by:').replace('Class Adviser', 'Subject Teacher')}</div>`;
}
function ecrSummaryPage(E, term, only){
  const T = E.terms[term]; const ks = ['ww','pt','qa'].filter(k => T.comp && T.comp[k]); let last = null, i = 0;
  const rows = (only || T.learners).map(x => { let pre = ''; if(x.sex && x.sex !== last){ last = x.sex; i = 0; pre = `<tr class="tot"><td colspan="${ks.length + 5}" class="l"><b>${x.sex === 'M' ? 'MALE' : 'FEMALE'}</b></td></tr>`; }
    const g = isNum(x.tg) ? x.tg : null; return pre + `<tr><td>${++i}</td><td class="l">${esc(x.name)}</td>${ks.map(k => `<td>${isNum(x[k + 'PS']) ? fmt(x[k + 'PS'], 2) : ''}</td>`).join('')}<td>${isNum(x.ig) ? fmt(x.ig, 2) : ''}</td><td><b>${g ?? ''}</b></td><td>${g !== null ? esc(M.descriptor(g)) : ''}</td></tr>`; }).join('');
  return `<div class="rdp">${M.printHeader('SUMMARY OF TERM GRADES')}
    <table class="rd-info"><tr><td>Subject</td><td><b>${esc(E.subject || '')}</b></td><td>Grade &amp; Section</td><td><b>${esc(E.title)}</b></td></tr><tr><td>Term</td><td><b>Term ${esc(term)}</b></td><td>School year</td><td><b>${esc(E.sy || '')}</b></td></tr></table>
    <table class="rd-t"><thead><tr><th>#</th><th class="l">Learner</th>${ks.map(k => `<th>${CL[k]} PS${T.comp[k].w ? ` (${T.comp[k].w}%)` : ''}</th>`).join('')}<th>Initial grade</th><th>Term grade</th><th>Descriptor</th></tr></thead><tbody>${rows}</tbody></table>
    ${M.printSign(M.cls(), 'Prepared by:', 'Noted by:').replace('Class Adviser', 'Subject Teacher')}</div>`;
}
M.ecrPrint = function(E){
  const terms = termsOf(E); if(!terms.length) return M.toast('No scores yet in this class record');
  let term = terms[terms.length - 1];
  const build = (kind) => { const T = E.terms[term];
    if(kind === 'raw'){ const S = [['M','MALE'],['F','FEMALE']].map(([sx, t]) => [t, T.learners.filter(x => (x.sex || 'M') === sx)]).filter(x => x[1].length); return {land: true, pages: S.map(([t, L]) => ecrRawPage(E, term, t, L))}; }
    // big classes: boys and girls on separate sheets so the print stays readable
    if(T.learners.length > 30){ const S = ['M','F'].map(sx => T.learners.filter(x => (x.sex || 'M') === sx)).filter(a => a.length); return {land: false, pages: S.map(a => ecrSummaryPage(E, term, a))}; }
    return {land: false, pages: [ecrSummaryPage(E, term)]}; };
  M.modal(`Print ECR · ${E.title} · ${E.subject}`, `<div class="row" style="gap:8px;flex-wrap:wrap"><div class="seg" id="epT">${terms.map(t => `<button data-t="${t}" class="${t === term ? 'on' : ''}">Term ${t}</button>`).join('')}</div></div>
    <div class="list" style="margin-top:12px">${[['raw','Class record — raw scores','Every written work, performance task and exam score with HPS, totals, PS, WS, initial and term grade. A4 landscape, boys and girls on separate sheets.'],['sum','Summary of term grades','PS per component, initial grade, term grade and descriptor. A4 portrait (boys and girls on separate sheets for big classes).']].map(([k, t, d]) => `<div class="item" style="align-items:center;gap:12px">${ico('print','width:22px;height:22px;color:var(--green)')}<div class="grow"><div class="title">${t}</div><div class="tiny muted">${d}</div></div><button class="btn sm" data-ev="${k}">${ico('eye')} View</button><button class="btn sm primary" data-ep="${k}">${ico('print')} Print</button></div>`).join('')}</div>`, b => {
    $$('#epT button', b).forEach(x => x.onclick = () => { term = x.dataset.t; $$('#epT button', b).forEach(y => y.classList.toggle('on', y === x)); });
    $$('[data-ev]', b).forEach(x => x.onclick = () => { const r = build(x.dataset.ev); const html = M.fitA4(r.pages, r.land);
      M.pagePreview(`ECR · Term ${term} · ${E.title}`, html, {land: r.land, note: `A4 ${r.land ? 'landscape' : 'portrait'} · 0.5 in margins · ${r.pages.length} sheet(s)`}); });
    $$('[data-ep]', b).forEach(x => x.onclick = () => { const r = build(x.dataset.ep); M.doPrint(M.fitA4(r.pages, r.land), M.pageCss('A4', r.land), {noFit: true}); });
  }, true);
};

/* =====================================================================
   3 · ECR SAFETY NET for Google Drive — one folder per class record
   ===================================================================== */
M.ecrDriveExport = async function(){
  const L = M.S.ecr || []; if(!L.length) return M.toast('No class records yet');
  await M.loadScript('vendor/jszip.min.js'); const zip = new JSZip(); const day = M.today(); const root = `MASTRO ECRs ${day}`; let n = 0, skipped = [];
  const safe = (s) => String(s).replace(/[–—]/g, '-').replace(/[\\/:*?"<>|]+/g, '-').trim();
  for(const E of L){ const folder = `${root}/${safe(`${E.title} (${E.subject || 'Subject'})`)}`;
    try { let blob = null, name = null;
      if(E.model && E.model.dirty && M.ecrWriteBack){ const r = await M.ecrWriteBack(E); blob = r.blob; name = r.name; }
      else if(E.docId){ const d = await M.docGet(E.docId); if(d && d.blob){ blob = d.blob; name = d.name; } }
      if(!blob){ skipped.push(E.title); continue; }
      zip.file(`${folder}/${safe(name || (E.title + '.xlsx'))}`, blob); n++;
    } catch(e){ skipped.push(E.title); } }
  if(!n) return alert('No ECR files are on this device to pack.');
  zip.file(`${root}/READ ME.txt`, `MASTRO ECR safety net — ${new Date().toLocaleString()}\r\n\r\nOne folder per class record. Files edited in MASTRO are the updated copies (formulas kept).\r\nUpload this whole folder into your MASTRO Google Drive folder (keep that folder Restricted — the ECRs contain learners' names and grades).\r\n`);
  const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE'});
  M.downloadBlob(blob, `${root}.zip`); M.S.settings.ecrDriveSaved = new Date().toISOString(); M.save();
  const url = M.S.settings.driveUrl;
  M.modal('ECRs packed for Google Drive', `<p><b>${n}</b> ECR file(s) are in <b>${esc(root)}.zip</b>, each class in its own folder${skipped.length ? ` (not on this device: ${esc(skipped.join(', '))})` : ''}.</p>
    <ol class="small" style="line-height:1.7"><li>Open the downloaded zip (double-click) — you get the folder <b>${esc(root)}</b>.</li><li>Open your MASTRO Drive folder (button below).</li><li>Drag the whole folder into Drive — Drive keeps the class folders.</li></ol>
    <p class="small" style="color:var(--amber)">Keep the Drive folder <b>Restricted</b> (Share → General access → Restricted): ECRs hold learners' names and grades.</p>
    <div class="row"><span class="spacer"></span><a class="btn gold" href="${esc(url)}" target="_blank" rel="noopener">${ico('drive')} Open MASTRO Drive folder</a></div>`);
};
})();
