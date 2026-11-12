/* MASTRO — Item analysis of a scanned answer sheet, one report per section (v6.20).
   Uses the bubbles read from every scanned paper (M.S.scans[].ans: one character per item —
   a letter, '.' = blank, '*' = two or more shaded, '_' = write-in line).
   Per item: key, how many got it right / wrong / left it blank, % correct (difficulty),
   discrimination (upper 27% vs lower 27%), and how many chose each letter (distractors). */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const secName = (s) => String(s || '').trim() || 'No section';

// DepEd-style interpretation
const diffLabel = (p) => p >= 0.81 ? 'Very easy' : p >= 0.61 ? 'Easy' : p >= 0.41 ? 'Average' : p >= 0.21 ? 'Difficult' : 'Very difficult';
const discLabel = (d) => d == null ? '—' : d >= 0.40 ? 'Very good' : d >= 0.30 ? 'Good' : d >= 0.20 ? 'Fair' : d >= 0 ? 'Poor' : 'Negative';
const action = (p, d) => d == null ? '' : (d < 0 ? 'Reject / check key' : d < 0.20 || p < 0.21 || p >= 0.95 ? 'Revise' : 'Retain');
const mastery = (p) => p >= 0.75 ? 'Mastered' : p >= 0.50 ? 'Nearly mastered' : 'Least mastered';

/* the items of a sheet: number, part, key, choices */
function itemsOf(sh){
  const F = M.AS_FMTS || {}; const keys = M.asKey(sh); let no = 0; const out = [];
  sh.parts.forEach((p, pi) => { const ch = F[p.fmt] && F[p.fmt].ch;
    for(let i = 0; i < (+p.n || 0); i++){ out.push({idx: no, no: no + 1, part: p.label || String.fromCharCode(65 + pi), ch, key: keys[no] || ''}); no++; } });
  return out;
}

/* analysis of one group of papers */
function analyze(sh, papers){
  const items = itemsOf(sh);
  const usable = papers.filter(r => r.ans && r.ans.length);
  const n = usable.length; const sorted = [...usable].sort((a, b) => b.score - a.score);
  const g = n >= 4 ? Math.max(1, Math.round(n * 0.27)) : 0;      // 27% upper and lower groups (needs 4+ papers)
  const up = sorted.slice(0, g), lo = g ? sorted.slice(-g) : [];
  const rows = items.map(it => {
    if(!it.ch || !it.key) return Object.assign({skip: true}, it);
    const pick = (r) => r.ans[it.idx] || '.';
    const cnt = {}; it.ch.forEach(c => cnt[c] = 0); let right = 0, blank = 0, multi = 0;
    usable.forEach(r => { const a = pick(r); if(a === it.key) right++; if(a === '.' || a === '' || a === '_') blank++; else if(a === '*') multi++; if(cnt[a] != null) cnt[a]++; });
    const wrong = n - right - blank; const p = n ? right / n : 0;
    const d = g ? (up.filter(r => pick(r) === it.key).length - lo.filter(r => pick(r) === it.key).length) / g : null;
    // a distractor nobody chose, or one the upper group chose more than the lower group, is flagged
    const dis = it.ch.filter(c => c !== it.key).map(c => ({c, n: cnt[c], bad: cnt[c] === 0 || (g && up.filter(r => pick(r) === c).length > lo.filter(r => pick(r) === c).length)}));
    return Object.assign(it, {right, wrong, blank, multi, p, d, cnt, dis});
  });
  const A = rows.filter(r => !r.skip);
  return {n, g, rows, A, skipped: papers.length - n, mps: A.length ? A.reduce((a, r) => a + r.p, 0) / A.length * 100 : 0,
    least: [...A].sort((a, b) => a.p - b.p).filter(r => r.p < 0.5).slice(0, 10)};
}

const groups = (sh) => { const G = {}; (M.S.scans || []).filter(r => r.sheet === sh.id).forEach(r => { const k = secName(r.section); (G[k] = G[k] || []).push(r); }); return G; };

function tableHtml(R, forPrint){
  const ch = [...new Set(R.A.flatMap(r => r.ch))];
  return `<table class="${forPrint ? '' : 'ia-t'}"><thead><tr><th>Item</th><th>Key</th><th class="num">Right</th><th class="num">Wrong</th><th class="num">Blank</th><th class="num">% right</th><th>Difficulty</th><th class="num">Discr.</th><th>Discrimination</th>${ch.map(c => `<th class="num">${c}</th>`).join('')}<th>Action</th></tr></thead><tbody>
    ${R.rows.map(r => r.skip ? `<tr class="muted"><td>${r.no}</td><td colspan="${8 + ch.length + 1}"><i>${r.ch ? 'no answer key' : 'write-in item (checked by you)'}</i></td></tr>` :
      `<tr class="${r.p < 0.5 ? 'ia-low' : ''}"><td><b>${r.no}</b></td><td><b>${r.key}</b></td><td class="num">${r.right}</td><td class="num">${r.wrong}</td><td class="num">${r.blank}</td><td class="num"><b>${Math.round(r.p * 100)}%</b></td><td>${diffLabel(r.p)}</td><td class="num">${r.d == null ? '—' : r.d.toFixed(2)}</td><td>${discLabel(r.d)}</td>
       ${ch.map(c => { const x = r.cnt[c]; const isKey = c === r.key; const bad = !isKey && r.dis.find(z => z.c === c && z.bad); return `<td class="num ${isKey ? 'ia-key' : bad ? 'ia-bad' : ''}">${x == null ? '' : x}</td>`; }).join('')}<td>${action(r.p, r.d)}</td></tr>`).join('')}
  </tbody></table>`;
}
function summaryHtml(R){
  return `<div class="rp-stats">${[['Papers', R.n], ['Items analysed', R.A.length], ['MPS', M.r2(R.mps) + '%'], ['Least mastered', R.A.filter(r => r.p < 0.5).length], ['Mastered (75%+)', R.A.filter(r => r.p >= 0.75).length]].map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div>`;
}
function sectionPrint(sh, sec, R){
  return `<div class="ia-print"><div class="c"><b>${esc(M.S.settings.school || '')}</b></div><div class="c t">ITEM ANALYSIS · ${esc(sh.title)}</div>
    <div class="c">Section: <b>${esc(sec)}</b> · ${R.n} paper(s) · ${R.A.length} item(s) analysed · MPS <b>${M.r2(R.mps)}%</b>${R.g ? ` · upper / lower group: ${R.g} each` : ''}</div>
    ${tableHtml(R, true)}
    <div class="s"><b>Least mastered (below 50% right):</b> ${R.least.length ? R.least.map(r => `#${r.no} (${Math.round(r.p * 100)}%)`).join(', ') : 'none'}</div>
    <div class="s tiny">Difficulty: 81–100% very easy · 61–80% easy · 41–60% average · 21–40% difficult · 0–20% very difficult. Discrimination (upper 27% − lower 27%): .40+ very good · .30–.39 good · .20–.29 fair · below .20 poor. Shaded letter counts: <u>key</u>; <i>flagged</i> = distractor chosen by no one or more by the upper group.</div>
    ${M.printSign ? `<div class="ia-sign"><div>Prepared by:<div class="nm">${esc(M.cls().adviser || '')}</div><div>Teacher</div></div></div>` : ''}</div>`;
}
function printAll(sh, G, only){
  const secs = only ? [only] : Object.keys(G).sort();
  const html = secs.map(s => sectionPrint(sh, s, analyze(sh, G[s]))).join('<div class="pbreak"></div>');
  M.doPrint(html, M.pageCss('A4'));
}
function xlsx(sh, G){
  const wb = XLSX.utils.book_new();
  Object.keys(G).sort().forEach(sec => { const R = analyze(sh, G[sec]); const ch = [...new Set(R.A.flatMap(r => r.ch))];
    const aoa = [[M.S.settings.school || ''], ['ITEM ANALYSIS — ' + sh.title], [`Section: ${sec}`, `Papers: ${R.n}`, `MPS: ${M.r2(R.mps)}%`], [],
      ['Item', 'Key', 'Right', 'Wrong', 'Blank', '% right', 'Difficulty', 'Discrimination index', 'Discrimination', ...ch.map(c => 'Chose ' + c), 'Mastery', 'Action'],
      ...R.rows.map(r => r.skip ? [r.no, '', '', '', '', '', r.ch ? 'no answer key' : 'write-in'] :
        [r.no, r.key, r.right, r.wrong, r.blank, Math.round(r.p * 100), diffLabel(r.p), r.d == null ? '' : +r.d.toFixed(2), discLabel(r.d), ...ch.map(c => r.cnt[c] ?? ''), mastery(r.p), action(r.p, r.d)])];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{wch: 6}, {wch: 5}, {wch: 7}, {wch: 7}, {wch: 7}, {wch: 8}, {wch: 13}, {wch: 11}, {wch: 13}, ...ch.map(() => ({wch: 8})), {wch: 15}, {wch: 18}];
    XLSX.utils.book_append_sheet(wb, ws, sec.replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || 'Section'); });
  XLSX.writeFile(wb, `${sh.title.replace(/[\\\/:*?"<>|]/g, ' ')} - item analysis.xlsx`);
}

M.itemAnalysis = function(sh){
  let sel = null;
  M.modal(`Item analysis · ${sh.title}`, `<div id="iaBody"></div>`, b => {
    const draw = () => { const G = groups(sh); const secs = Object.keys(G).sort(); if(!secs.includes(sel)) sel = secs[0] || null;
      if(!secs.length){ $('#iaBody', b).innerHTML = `<div class="empty">No papers scanned yet. Scan the papers first (📷 Scan), then come back here.</div>`; return; }
      const R = analyze(sh, G[sel]);
      $('#iaBody', b).innerHTML = `
        <div class="seg" id="iaSec" style="flex-wrap:wrap">${secs.map(s => `<button data-s="${esc(s)}" class="${s === sel ? 'on' : ''}">${esc(s)} <span class="tiny muted">${G[s].length}</span></button>`).join('')}</div>
        ${summaryHtml(R)}
        ${R.skipped ? `<div class="flag" style="margin:8px 0"><span class="dot"></span><div class="small">${R.skipped} paper(s) have a score but no bubble details (received from an older MASTRO). Scan them again, or send them again from the iPhone after updating it, to include them.</div></div>` : ''}
        ${R.n ? `<div class="table-wrap" style="max-height:52vh">${tableHtml(R)}</div>
        <div class="small" style="margin-top:8px"><b>Least mastered (below 50% right):</b> ${R.least.length ? R.least.map(r => `<span class="chip red" style="margin:2px">#${r.no} · ${Math.round(r.p * 100)}%</span>`).join('') : '<span class="muted">none</span>'}</div>
        <div class="tiny muted" style="margin-top:6px">Rows in red: fewer than half got it right. Letter columns show how many chose each letter — green is the key, amber is a weak distractor. Discrimination needs at least 4 papers.</div>` : ''}
        <div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap"><button class="btn primary" id="iaP">${ico('print')} Print this section</button><button class="btn" id="iaPA">${ico('print')} Print all sections</button><button class="btn" id="iaX">${ico('download')} Excel (one sheet per section)</button><span class="spacer"></span><button class="btn" id="iaC">Close</button></div>`;
      $('#iaSec', b).onclick = e => { const x = e.target.closest('button'); if(!x) return; sel = x.dataset.s; draw(); };
      $('#iaP', b).onclick = () => printAll(sh, G, sel); $('#iaPA', b).onclick = () => printAll(sh, G); $('#iaX', b).onclick = () => xlsx(sh, G); $('#iaC', b).onclick = M.closeModal; };
    draw();
  }, true);
};
M.itemAnalyze = analyze;   // used by the self-check
})();
