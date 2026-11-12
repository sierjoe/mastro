/* MASTRO — Funds (v6.20): Homeroom and SPTA contributions.
   · Projects agreed for the school year, each with an amount per learner (some learners can be exempted)
   · Payments in any number of instalments — one payment can cover several projects
   · Acknowledgement receipt: A4 landscape quarter (about 148 × 105 mm), 4 per A4 sheet
   · Summary per learner and per project — print or Excel
   Data: class.funds = {hr:{projects, pays, next, receiver, title}, spta:{…}} */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico} = M;
const FUNDS = {
  hr:   {label:'Homeroom', long:'Homeroom Fund', code:'HR', receiverTitle:'Class Adviser'},
  spta: {label:'SPTA', long:'SPTA Fund', code:'SPTA', receiverTitle:'SPTA Treasurer'}
};
const r2 = (n) => Math.round((+n || 0) * 100) / 100;
const peso = (n) => '₱' + r2(n).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const longD = (d) => d ? M.parse(d).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}) : '';
function fund(c, k){
  c.funds = c.funds || {}; const F = c.funds[k] = c.funds[k] || {};
  F.projects = F.projects || []; F.pays = F.pays || []; F.next = F.next || 1;
  if(F.receiver == null) F.receiver = k === 'hr' ? (c.adviser || '') : '';
  if(F.title == null) F.title = FUNDS[k].receiverTitle;
  return F;
}
M.fundOf = fund;
const due = (pr, lid) => (pr.exempt && pr.exempt[lid]) ? 0 : r2(pr.amount);
const paid = (F, lid, pid) => r2(F.pays.filter(p => p.lid === lid).reduce((a, p) => a + p.lines.filter(x => x.proj === pid).reduce((b, x) => b + (+x.amt || 0), 0), 0));
const paidAll = (F, lid) => r2(F.pays.filter(p => p.lid === lid).reduce((a, p) => a + total(p), 0));
const total = (p) => r2(p.lines.reduce((a, x) => a + (+x.amt || 0), 0));
const dueAll = (F, lid) => r2(F.projects.reduce((a, pr) => a + due(pr, lid), 0));
const orNo = (k, F, n) => `${FUNDS[k].code}-${String(n).padStart(4, '0')}`;
// learners who are asked to pay: everyone still in the class, plus anyone who already paid
const payers = (c, F) => M.sortedLearners(c).filter(l => M.counted(l) || F.pays.some(p => p.lid === l.id));

/* ---------- amount in words (Philippine peso) ---------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function words999(n){ const h = Math.floor(n / 100), r = n % 100; const out = [];
  if(h) out.push(ONES[h] + ' Hundred'); if(r) out.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : '')); return out.join(' '); }
function inWords(amount){
  const a = r2(amount); let n = Math.floor(a); const cents = Math.round((a - n) * 100);
  if(!n && !cents) return 'Zero Pesos';
  const parts = []; [[1e6, 'Million'], [1e3, 'Thousand'], [1, '']].forEach(([u, name]) => { const q = Math.floor(n / u); n %= u; if(q) parts.push(words999(q) + (name ? ' ' + name : '')); });
  let s = parts.join(' '); if(s) s += Math.floor(a) === 1 ? ' Peso' : ' Pesos';
  if(cents) s += (s ? ' and ' : '') + `${String(cents).padStart(2, '0')}/100`;
  return s + ' Only';
}
M.pesoWords = inWords;

/* ======================= the page ======================= */
function view(el, k){
  const c = M.cls(); const F = fund(c, k); const FD = FUNDS[k];
  const L = payers(c, F); const P = F.projects;
  const expected = r2(L.reduce((a, l) => a + dueAll(F, l.id), 0)); const got = r2(F.pays.reduce((a, p) => a + total(p), 0));
  const full = L.filter(l => dueAll(F, l.id) > 0 && paidAll(F, l.id) >= dueAll(F, l.id)).length;
  const none = L.filter(l => dueAll(F, l.id) > 0 && !paidAll(F, l.id)).length;
  const cell = (l, pr) => { const d = due(pr, l.id), p = paid(F, l.id, pr.id);
    if(!d && !p) return `<td class="c fd-ex" title="Exempted">—</td>`;
    const cls = p >= d ? 'fd-full' : p > 0 ? 'fd-part' : 'fd-none';
    return `<td class="c ${cls}" title="${esc(pr.name)}: paid ${peso(p)} of ${peso(d)}">${p ? peso(p).replace('₱', '') : '0'}${p > 0 && p < d ? `<div class="tiny">bal ${peso(d - p).replace('₱', '')}</div>` : ''}</td>`; };
  el.innerHTML = `
  <div class="card fd-head"><div class="row" style="gap:12px;flex-wrap:wrap"><div class="grow"><h2 style="margin:0">${FD.long} · ${esc(M.className(c))}</h2>
      <div class="small muted">School year ${esc(c.sy || '')} · contributions agreed for the year, paid in full or in instalments. Every payment gets an acknowledgement receipt.</div></div>
      <button class="btn" id="fdSet">${ico('settings')} Receipt details</button><button class="btn" id="fdProj">${ico('plus')} Project</button><button class="btn primary" id="fdPay" ${P.length ? '' : 'disabled'}>₱ Record payment</button></div>
    <div class="rp-stats">${[['Expected', peso(expected)], ['Collected', peso(got)], ['Balance', peso(Math.max(0, expected - got))], ['Fully paid', `${full} / ${L.length}`], ['Not yet paid', none], ['Payments', F.pays.length]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" id="fdRc" ${F.pays.length ? '' : 'disabled'}>${ico('print')} Print receipts</button><button class="btn sm" id="fdSum" ${P.length ? '' : 'disabled'}>${ico('print')} Print summary</button><button class="btn sm" id="fdX" ${P.length ? '' : 'disabled'}>${ico('download')} Excel</button></div></div>

  <div class="card" style="margin-top:16px"><h3 style="margin:0 0 10px">Projects</h3>
    ${P.length ? `<div class="fd-projs">${P.map(pr => { const exp = r2(L.reduce((a, l) => a + due(pr, l.id), 0)), g = r2(L.reduce((a, l) => a + paid(F, l.id, pr.id), 0));
      return `<button class="fd-proj" data-pe="${pr.id}"><b>${esc(pr.name)}</b><span class="small">${peso(pr.amount)} per learner${pr.due ? ` · due ${esc(longD(pr.due))}` : ''}</span>
        <div class="bar-track" style="height:6px;margin:6px 0 3px"><div class="bar-fill" style="width:${exp ? Math.min(100, g / exp * 100) : 0}%"></div></div><span class="tiny muted">${peso(g)} of ${peso(exp)}${Object.keys(pr.exempt || {}).length ? ` · ${Object.keys(pr.exempt).length} exempted` : ''}</span></button>`; }).join('')}</div>`
      : `<div class="empty">No projects yet. Add the projects agreed with the parents for this school year (e.g. “Classroom electric fan — ₱150 per learner”), then record the payments.</div>`}</div>

  ${P.length ? `<div class="card" style="margin-top:16px"><div class="row" style="margin-bottom:10px"><h3 style="margin:0">Contributions per learner</h3><span class="spacer"></span><input class="input" id="fdQ" placeholder="Find a learner…" style="max-width:220px;padding:6px 10px"><div class="seg sm" id="fdF">${[['all', 'All'], ['bal', 'With balance'], ['full', 'Fully paid']].map(([v, t]) => `<button data-f="${v}" class="${(M.S.ui.fdF || 'all') === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="table-wrap"><table class="fd-t"><thead><tr><th>#</th><th class="sticky-col">Learner</th>${P.map(pr => `<th class="c">${esc(pr.name)}<div class="tiny muted">${peso(pr.amount)}</div></th>`).join('')}<th class="num">Paid</th><th class="num">Balance</th><th></th></tr></thead>
      <tbody>${L.map((l, i) => { const d = dueAll(F, l.id), p = paidAll(F, l.id); const st = d && p >= d ? 'full' : 'bal';
        return `<tr data-row="${st}" data-name="${esc(M.normName(l.name))}"><td class="muted">${i + 1}</td><td class="sticky-col"><a href="#" data-led="${l.id}"><b>${esc(l.name)}</b></a> ${M.statusChip(l, 1)}<div class="tiny muted">${F.pays.filter(x => x.lid === l.id).length} payment(s)</div></td>${P.map(pr => cell(l, pr)).join('')}
          <td class="num"><b>${peso(p)}</b></td><td class="num ${d - p > 0 ? 'low' : ''}">${d - p > 0 ? peso(d - p) : '<span style="color:var(--green)">✓ Paid</span>'}</td><td><button class="btn sm" data-pay="${l.id}">₱ Pay</button></td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td></td><td class="sticky-col"><b>Total</b></td>${P.map(pr => `<td class="c"><b>${peso(L.reduce((a, l) => a + paid(F, l.id, pr.id), 0)).replace('₱', '')}</b></td>`).join('')}<td class="num"><b>${peso(got)}</b></td><td class="num"><b>${peso(Math.max(0, expected - got))}</b></td><td></td></tr></tfoot></table></div></div>

  <div class="card" style="margin-top:16px"><h3 style="margin:0 0 10px">Latest payments</h3>${F.pays.length ? `<div class="list">${[...F.pays].sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at)).slice(0, 12).map(p => payRow(c, F, k, p)).join('')}</div>` : '<div class="empty small">No payments yet.</div>'}</div>` : ''}`;

  const rr = () => view(el, k);
  $('#fdProj', el).onclick = () => projectForm(c, k, null, rr);
  $('#fdSet', el).onclick = () => settingsForm(c, k, rr);
  if(P.length) $('#fdPay', el).onclick = () => payForm(c, k, null, rr);
  $$('[data-pe]', el).forEach(b => b.onclick = () => projectForm(c, k, P.find(x => x.id === b.dataset.pe), rr));
  $$('[data-pay]', el).forEach(b => b.onclick = () => payForm(c, k, b.dataset.pay, rr));
  $$('[data-led]', el).forEach(a => a.onclick = (e) => { e.preventDefault(); ledger(c, k, a.dataset.led, rr); });
  bindPayRows(el, c, k, rr);
  if($('#fdRc', el)) $('#fdRc', el).onclick = () => receiptPicker(c, k);
  if($('#fdSum', el)) $('#fdSum', el).onclick = () => printSummary(c, k);
  if($('#fdX', el)) $('#fdX', el).onclick = () => excel(c, k);
  const filt = () => { const q = M.normName(($('#fdQ', el) || {}).value || ''); const f = M.S.ui.fdF || 'all';
    $$('.fd-t tbody tr', el).forEach(tr => { tr.style.display = (!q || tr.dataset.name.includes(q)) && (f === 'all' || tr.dataset.row === f) ? '' : 'none'; }); };
  if($('#fdQ', el)){ $('#fdQ', el).oninput = filt; $('#fdF', el).onclick = (e) => { const b = e.target.closest('button'); if(!b) return; M.S.ui.fdF = b.dataset.f; M.save(); $$('#fdF button', el).forEach(x => x.classList.toggle('on', x === b)); filt(); }; filt(); }
}
function payRow(c, F, k, p){ const l = c.learners.find(x => x.id === p.lid) || {name: '(removed learner)'};
  return `<div class="item" style="gap:10px;align-items:center"><div class="grow"><div class="title small"><b>${esc(l.name)}</b> · ${peso(total(p))}</div>
    <div class="tiny muted">${esc(longD(p.date))} · ${esc(p.or)} · ${p.lines.map(x => { const pr = F.projects.find(y => y.id === x.proj); return `${esc(pr ? pr.name : '?')} ${peso(x.amt)}`; }).join(' · ')}${p.by ? ` · from ${esc(p.by)}` : ''}</div></div>
    <button class="btn sm" data-rcp="${p.id}">${ico('print')} Receipt</button><button class="icon-btn" data-pedit="${p.id}" title="Edit">${ico('edit', 'width:16px;height:16px')}</button><button class="icon-btn del-l" data-pdel="${p.id}" title="Delete payment">${ico('trash', 'width:16px;height:16px')}</button></div>`; }
function bindPayRows(box, c, k, rr){ const F = fund(c, k);
  $$('[data-rcp]', box).forEach(b => b.onclick = () => printReceipts(c, k, [F.pays.find(p => p.id === b.dataset.rcp)]));
  $$('[data-pedit]', box).forEach(b => b.onclick = () => { const p = F.pays.find(x => x.id === b.dataset.pedit); payForm(c, k, p.lid, rr, p); });
  $$('[data-pdel]', box).forEach(b => b.onclick = () => { const p = F.pays.find(x => x.id === b.dataset.pdel); if(!p || !confirm(`Delete payment ${p.or} (${peso(total(p))})? Its receipt number is not reused.`)) return;
    F.pays = F.pays.filter(x => x !== p); M.save(); M.closeModal(); rr(); M.toast('Payment deleted'); }); }

/* ---------- projects ---------- */
function projectForm(c, k, pr, rr){
  const F = fund(c, k); const isNew = !pr; pr = pr || {id: M.uid('pj'), name: '', amount: '', due: '', notes: '', exempt: {}};
  const L = payers(c, F); const ex = Object.assign({}, pr.exempt || {});
  M.modal(isNew ? `New ${FUNDS[k].label} project` : `Project · ${pr.name}`, `
    <label class="field">Project / purpose<input class="input" id="pjN" value="${esc(pr.name)}" placeholder="e.g. Classroom electric fan"></label>
    <div class="grid g-2" style="gap:8px"><label class="field">Amount per learner (₱)<input class="input" id="pjA" type="number" min="0" step="0.01" value="${esc(pr.amount)}"></label><label class="field">Due date <span class="muted">(optional)</span><input class="input" id="pjD" type="date" value="${esc(pr.due || '')}"></label></div>
    <label class="field">Notes <span class="muted">(e.g. agreed in the PTA meeting of …)</span><input class="input" id="pjNo" value="${esc(pr.notes || '')}"></label>
    <details style="margin-top:6px"><summary class="small">Exempted learners (${Object.keys(ex).length}) — they do not need to pay this project</summary>
      <div class="ps-list" style="max-height:200px">${L.map(l => `<label class="ps-pick"><input type="checkbox" data-ex="${l.id}" ${ex[l.id] ? 'checked' : ''}> ${esc(l.name)}</label>`).join('')}</div></details>
    <div class="row" style="margin-top:14px;gap:8px">${isNew ? '' : `<button class="btn danger" id="pjDel">Delete project</button>`}<span class="spacer"></span><button class="btn" id="pjC">Cancel</button><button class="btn primary" id="pjS">${ico('save')} Save</button></div>`, b => {
    $$('[data-ex]', b).forEach(x => x.onchange = () => { if(x.checked) ex[x.dataset.ex] = 1; else delete ex[x.dataset.ex]; });
    $('#pjC', b).onclick = M.closeModal;
    $('#pjS', b).onclick = () => { const name = $('#pjN', b).value.trim(), amount = r2($('#pjA', b).value);
      if(!name) return M.toast('Type the project name'); if(!(amount > 0)) return M.toast('Type the amount per learner');
      Object.assign(pr, {name, amount, due: $('#pjD', b).value, notes: $('#pjNo', b).value.trim(), exempt: ex});
      if(isNew) F.projects.push(pr); M.save(); M.closeModal(); rr(); M.toast('Project saved'); };
    if(!isNew) $('#pjDel', b).onclick = () => { const used = F.pays.some(p => p.lines.some(x => x.proj === pr.id));
      if(used) return alert('Payments were already recorded for this project. Delete those payments first, or keep the project.');
      if(!confirm(`Delete the project “${pr.name}”?`)) return; F.projects = F.projects.filter(x => x !== pr); M.save(); M.closeModal(); rr(); };
  });
}

/* ---------- receipt details (who receives) ---------- */
function settingsForm(c, k, rr){
  const F = fund(c, k);
  M.modal(`${FUNDS[k].long} · receipt details`, `
    <div class="grid g-2" style="gap:8px"><label class="field">Received by (name on the receipt)<input class="input" id="fsN" value="${esc(F.receiver)}"></label><label class="field">Position<input class="input" id="fsT" value="${esc(F.title)}"></label></div>
    <label class="field">Next receipt number<input class="input" id="fsNo" type="number" min="1" value="${F.next}"></label>
    <p class="tiny muted">Receipts are numbered ${esc(FUNDS[k].code)}-0001, ${esc(FUNDS[k].code)}-0002… The school name and seals come from Settings.</p>
    <div class="row" style="gap:8px"><span class="spacer"></span><button class="btn" id="fsC">Cancel</button><button class="btn primary" id="fsS">${ico('save')} Save</button></div>`, b => {
    $('#fsC', b).onclick = M.closeModal;
    $('#fsS', b).onclick = () => { F.receiver = $('#fsN', b).value.trim(); F.title = $('#fsT', b).value.trim(); F.next = Math.max(1, parseInt($('#fsNo', b).value, 10) || 1); M.save(); M.closeModal(); rr(); M.toast('Saved'); };
  });
}

/* ---------- record (or edit) a payment ---------- */
function payForm(c, k, lid, rr, edit){
  const F = fund(c, k); const L = payers(c, F);
  let cur = lid || (L[0] && L[0].id); const p0 = edit || null;
  const lastBy = (id) => { const x = [...F.pays].reverse().find(p => p.lid === id && p.by); return x ? x.by : ''; };
  M.modal(p0 ? `Edit payment ${p0.or}` : `Record payment · ${FUNDS[k].long}`, `
    <label class="field">Learner<select class="input" id="pyL" ${p0 ? 'disabled' : ''}>${L.map(l => `<option value="${l.id}" ${l.id === cur ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
    <div class="grid g-2" style="gap:8px"><label class="field">Date<input class="input" id="pyD" type="date" value="${esc(p0 ? p0.date : M.today())}"></label><label class="field">Received from (parent / guardian)<input class="input" id="pyB" value="${esc(p0 ? p0.by : lastBy(cur))}" placeholder="Name of the one who paid"></label></div>
    <div class="field">Amount for each project <span class="muted">— pay any part; the rest stays as balance</span><div id="pyLines"></div></div>
    <div class="row" style="gap:8px;margin:6px 0"><button class="btn sm" id="pyAll">Pay all balances</button><span class="spacer"></span><b id="pyT"></b></div>
    <label class="field">Note <span class="muted">(optional)</span><input class="input" id="pyN" value="${esc(p0 ? p0.note || '' : '')}"></label>
    ${p0 ? '' : `<label class="row small" style="gap:6px;cursor:pointer;margin-top:4px"><input type="checkbox" id="pyR" ${M.S.ui.fdPrint === false ? '' : 'checked'}> Print the acknowledgement receipt after saving</label>`}
    <div class="row" style="margin-top:12px;gap:8px"><span class="tiny muted">Receipt no. <b>${esc(p0 ? p0.or : orNo(k, F, F.next))}</b></span><span class="spacer"></span><button class="btn" id="pyC">Cancel</button><button class="btn primary" id="pyS">${ico('save')} Save payment</button></div>`, b => {
    const amt = {}; if(p0) p0.lines.forEach(x => amt[x.proj] = x.amt);
    const lines = () => { const l = L.find(x => x.id === cur);
      $('#pyLines', b).innerHTML = F.projects.map(pr => { const d = due(pr, cur), pd = r2(paid(F, cur, pr.id) - (p0 ? +((p0.lines.find(x => x.proj === pr.id) || {}).amt || 0) : 0)); const bal = r2(Math.max(0, d - pd));   // when editing, this payment is not counted as already paid
        return `<div class="fd-line"><div class="grow"><b class="small">${esc(pr.name)}</b><div class="tiny muted">${d ? `due ${peso(d)} · paid ${peso(pd)} · <span class="${bal ? 'low' : ''}">balance ${peso(bal)}</span>` : 'exempted'}</div></div>
          <input class="input" type="number" min="0" step="0.01" data-amt="${pr.id}" value="${amt[pr.id] != null ? esc(amt[pr.id]) : ''}" placeholder="0.00" style="width:110px">${bal ? `<button class="btn sm" data-fill="${pr.id}" data-bal="${bal}">Full</button>` : '<span style="width:52px"></span>'}</div>`; }).join('');
      $$('[data-amt]', b).forEach(i => i.oninput = () => { amt[i.dataset.amt] = i.value; sum(); });
      $$('[data-fill]', b).forEach(x => x.onclick = () => { amt[x.dataset.fill] = x.dataset.bal; $(`[data-amt="${x.dataset.fill}"]`, b).value = x.dataset.bal; sum(); });
      sum(); void l; };
    const sum = () => { $('#pyT', b).textContent = 'Total ' + peso(Object.values(amt).reduce((a, v) => a + (+v || 0), 0)); };
    $('#pyL', b).onchange = (e) => { cur = e.target.value; Object.keys(amt).forEach(x => delete amt[x]); $('#pyB', b).value = lastBy(cur); lines(); };
    $('#pyAll', b).onclick = () => { $$('[data-fill]', b).forEach(x => x.click()); };
    $('#pyC', b).onclick = M.closeModal;
    $('#pyS', b).onclick = () => {
      const ls = F.projects.map(pr => ({proj: pr.id, amt: r2(amt[pr.id])})).filter(x => x.amt > 0);
      if(!ls.length) return M.toast('Type the amount paid');
      const date = $('#pyD', b).value || M.today(), by = $('#pyB', b).value.trim(), note = $('#pyN', b).value.trim();
      let p;
      if(p0){ Object.assign(p0, {date, by, note, lines: ls, edited: new Date().toISOString()}); p = p0; }
      else { p = {id: M.uid('py'), lid: cur, date, by, note, lines: ls, or: orNo(k, F, F.next), at: new Date().toISOString()}; F.next++; F.pays.push(p); }
      const pr = $('#pyR', b) ? $('#pyR', b).checked : false; if($('#pyR', b)) M.S.ui.fdPrint = pr;
      M.save(); M.closeModal(); rr(); M.toast(`${p.or} saved · ${peso(total(p))}`);
      if(pr) setTimeout(() => printReceipts(c, k, [p]), 120);
    };
    lines();
  }, true);
}

/* ---------- one learner's history ---------- */
function ledger(c, k, lid, rr){
  const F = fund(c, k); const l = c.learners.find(x => x.id === lid); const ps = F.pays.filter(p => p.lid === lid).sort((a, b) => a.date.localeCompare(b.date));
  M.modal(`${l.name} · ${FUNDS[k].long}`, `
    <div class="table-wrap"><table><thead><tr><th>Project</th><th class="num">Due</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>
      ${F.projects.map(pr => { const d = due(pr, lid), p = paid(F, lid, pr.id); return `<tr><td>${esc(pr.name)}</td><td class="num">${d ? peso(d) : 'exempted'}</td><td class="num">${peso(p)}</td><td class="num ${d - p > 0 ? 'low' : ''}">${peso(Math.max(0, d - p))}</td></tr>`; }).join('')}
      <tr><td><b>Total</b></td><td class="num"><b>${peso(dueAll(F, lid))}</b></td><td class="num"><b>${peso(paidAll(F, lid))}</b></td><td class="num"><b>${peso(Math.max(0, dueAll(F, lid) - paidAll(F, lid)))}</b></td></tr></tbody></table></div>
    <h3 style="margin:14px 0 8px">Payments (${ps.length})</h3>${ps.length ? `<div class="list">${ps.map(p => payRow(c, F, k, p)).join('')}</div>` : '<div class="empty small">No payments yet.</div>'}
    <div class="row" style="margin-top:12px;gap:8px"><span class="spacer"></span>${ps.length > 1 ? `<button class="btn" id="lgAll">${ico('print')} All receipts</button>` : ''}<button class="btn primary" id="lgPay">₱ Record payment</button></div>`, b => {
    bindPayRows(b, c, k, () => { rr(); ledger(c, k, lid, rr); });
    $('#lgPay', b).onclick = () => payForm(c, k, lid, rr);
    if($('#lgAll', b)) $('#lgAll', b).onclick = () => printReceipts(c, k, ps);
  }, true);
}

/* ======================= acknowledgement receipt =======================
   A quarter of an A4: 148.5 × 105 mm, landscape. Printed on A4 landscape, 4 per sheet (2 × 2), with cut lines. */
function receiptHtml(c, k, p){
  const F = fund(c, k), FD = FUNDS[k], s = M.S.settings, lg = s.logos || {};
  const l = c.learners.find(x => x.id === p.lid) || {name: '', id: ''};
  // balances as of this receipt (payments up to and including it)
  const upto = F.pays.filter(x => x.lid === p.lid && (x.date < p.date || (x.date === p.date && (x.at || '') <= (p.at || '')) || x === p));
  const paidUpto = (pid) => r2(upto.reduce((a, x) => a + x.lines.filter(y => y.proj === pid).reduce((b, y) => b + (+y.amt || 0), 0), 0));
  const rows = F.projects.filter(pr => due(pr, p.lid) || p.lines.some(x => x.proj === pr.id)).map(pr => { const now = r2((p.lines.find(x => x.proj === pr.id) || {}).amt); const d = due(pr, p.lid), pu = paidUpto(pr.id);
    return {pr, now, d, pu, bal: r2(Math.max(0, d - pu))}; });
  const balAll = r2(rows.reduce((a, r) => a + r.bal, 0));
  return `<div class="ar"><div class="ar-in">
    <div class="ar-hd">${lg.deped ? `<img src="${lg.deped}" alt="">` : '<span></span>'}<div><div class="ar-s1">Republic of the Philippines · Department of Education</div><b>${esc(s.school || '')}</b><div class="ar-s1">${esc(s.address || '')}</div></div>${lg.school ? `<img src="${lg.school}" alt="">` : '<span></span>'}</div>
    <div class="ar-tt"><b>ACKNOWLEDGEMENT RECEIPT</b><span>${esc(FD.long)} · S.Y. ${esc(c.sy || '')}</span></div>
    <div class="ar-no"><span>No. <b>${esc(p.or)}</b></span><span>Date: <b>${esc(longD(p.date))}</b></span></div>
    <p class="ar-p">Received from <u>${esc(p.by || ' '.repeat(30))}</u>, parent/guardian of <b>${esc(l.name)}</b> (${esc(M.className(c))}), the amount of <b>${esc(inWords(total(p)))}</b> (<b>${peso(total(p))}</b>) for:</p>
    <table class="ar-t"><thead><tr><th>Project</th><th>Amount due</th><th>This payment</th><th>Total paid</th><th>Balance</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="l">${esc(r.pr.name)}</td><td>${r.d ? peso(r.d) : 'exempt'}</td><td><b>${r.now ? peso(r.now) : '—'}</b></td><td>${peso(r.pu)}</td><td>${r.bal ? peso(r.bal) : 'PAID'}</td></tr>`).join('')}
      <tr class="ar-tot"><td class="l">TOTAL</td><td></td><td>${peso(total(p))}</td><td></td><td>${balAll ? peso(balAll) : 'FULLY PAID'}</td></tr></tbody></table>
    ${p.note ? `<div class="ar-note">Note: ${esc(p.note)}</div>` : ''}
    <div class="ar-ft"><div class="ar-st">${balAll ? 'Instalment payment' : '✓ Fully paid'}</div><div class="ar-sig"><div class="nm">${esc(F.receiver || '')}</div><div>${esc(F.title || '')}</div><div class="ar-s1">Received by</div></div></div>
  </div></div>`;
}
function printReceipts(c, k, list){
  list = list.filter(Boolean); if(!list.length) return;
  const pages = []; for(let i = 0; i < list.length; i += 4) pages.push(list.slice(i, i + 4));
  const html = pages.map(g => `<div class="ar-sheet">${g.map(p => receiptHtml(c, k, p)).join('')}${'<div class="ar ar-empty"></div>'.repeat(4 - g.length)}</div>`).join('');
  M.doPrint(html, M.pageCss('A4', true), {noFit: true, safe: false});
}
M.fundReceipt = (c, k, p) => receiptHtml(c, k, p);
function receiptPicker(c, k){
  const F = fund(c, k); const days = [...new Set(F.pays.map(p => p.date))].sort().reverse(); let day = days[0];
  M.modal('Print receipts', `<p class="small muted" style="margin-top:0">Each receipt is a quarter of an A4 page (landscape) — 4 per sheet. Cut along the dotted lines.</p>
    <div class="row" style="gap:8px;margin-bottom:8px"><label class="small">Date <select class="input" id="rpD" style="width:auto">${days.map(d => `<option value="${d}">${esc(longD(d))}</option>`).join('')}<option value="">All dates</option></select></label><span class="spacer"></span><button class="btn sm" id="rpAll">Tick all</button></div>
    <div class="ps-list" id="rpList" style="max-height:46vh"></div>
    <div class="row" style="margin-top:12px;gap:8px"><span class="small muted" id="rpN"></span><span class="spacer"></span><button class="btn" id="rpC">Cancel</button><button class="btn primary" id="rpGo">${ico('print')} Print</button></div>`, b => {
    const draw = () => { const ps = F.pays.filter(p => !day || p.date === day).sort((a, b) => a.or.localeCompare(b.or));
      $('#rpList', b).innerHTML = ps.map(p => { const l = c.learners.find(x => x.id === p.lid) || {name: '?'}; return `<label class="ps-pick"><input type="checkbox" data-r="${p.id}" checked> ${esc(p.or)} · ${esc(l.name)} · ${peso(total(p))}</label>`; }).join('') || '<div class="empty small">None.</div>';
      const upd = () => { const n = $$('#rpList input:checked', b).length; $('#rpN', b).textContent = `${n} receipt(s) · ${Math.ceil(n / 4)} sheet(s)`; };
      $$('#rpList input', b).forEach(x => x.onchange = upd); upd(); };
    $('#rpD', b).onchange = (e) => { day = e.target.value; draw(); };
    $('#rpAll', b).onclick = () => { $$('#rpList input', b).forEach(x => x.checked = true); $$('#rpList input', b)[0] && $$('#rpList input', b)[0].onchange(); };
    $('#rpC', b).onclick = M.closeModal;
    $('#rpGo', b).onclick = () => { const ids = $$('#rpList input:checked', b).map(x => x.dataset.r); if(!ids.length) return M.toast('Tick at least one'); printReceipts(c, k, ids.map(id => F.pays.find(p => p.id === id))); };
    draw();
  });
}

/* ---------- summary: print and Excel ---------- */
function printSummary(c, k){
  const F = fund(c, k), L = payers(c, F), P = F.projects; let i = 0;
  const rows = L.map(l => `<tr><td>${++i}</td><td class="l">${esc(l.name)}</td>${P.map(pr => { const d = due(pr, l.id), p = paid(F, l.id, pr.id); return `<td>${d ? peso(p).replace('₱', '') : 'exempt'}</td>`; }).join('')}<td><b>${peso(paidAll(F, l.id)).replace('₱', '')}</b></td><td>${dueAll(F, l.id) - paidAll(F, l.id) > 0 ? peso(dueAll(F, l.id) - paidAll(F, l.id)).replace('₱', '') : 'PAID'}</td></tr>`).join('');
  const tot = (fn) => peso(L.reduce((a, l) => a + fn(l), 0)).replace('₱', '');
  M.doPrint(M.printHeader(`${FUNDS[k].long.toUpperCase()} · CONTRIBUTIONS`) + `<p>Grade &amp; Section: <b>${esc(M.className(c))}</b> &nbsp; School Year: <b>${esc(c.sy || '')}</b> &nbsp; As of: <b>${esc(longD(M.today()))}</b></p>
    <table class="fd-pt"><thead><tr><th>#</th><th>Name of Learner</th>${P.map(pr => `<th>${esc(pr.name)}<br><span style="font-weight:normal">${peso(pr.amount)}</span></th>`).join('')}<th>Total paid</th><th>Balance</th></tr></thead><tbody>${rows}
      <tr><td></td><td class="l"><b>TOTAL</b></td>${P.map(pr => `<td><b>${tot(l => paid(F, l.id, pr.id))}</b></td>`).join('')}<td><b>${tot(l => paidAll(F, l.id))}</b></td><td><b>${tot(l => Math.max(0, dueAll(F, l.id) - paidAll(F, l.id)))}</b></td></tr></tbody></table>` + M.printSign(c));
}
function excel(c, k){
  const F = fund(c, k), L = payers(c, F), P = F.projects; const wb = XLSX.utils.book_new();
  const a1 = [[M.S.settings.school || ''], [`${FUNDS[k].long} · ${M.className(c)} · S.Y. ${c.sy || ''}`], [`As of ${longD(M.today())}`], [],
    ['No.', 'Name of Learner', ...P.map(pr => `${pr.name} (${r2(pr.amount)})`), 'Total due', 'Total paid', 'Balance'],
    ...L.map((l, i) => [i + 1, l.name, ...P.map(pr => due(pr, l.id) ? paid(F, l.id, pr.id) : 'exempt'), dueAll(F, l.id), paidAll(F, l.id), r2(Math.max(0, dueAll(F, l.id) - paidAll(F, l.id)))])];
  const ws1 = XLSX.utils.aoa_to_sheet(a1); ws1['!cols'] = [{wch: 5}, {wch: 34}, ...P.map(() => ({wch: 16})), {wch: 11}, {wch: 11}, {wch: 11}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Per learner');
  const a2 = [['Receipt no.', 'Date', 'Learner', 'Received from', ...P.map(pr => pr.name), 'Total', 'Note'],
    ...[...F.pays].sort((a, b) => a.or.localeCompare(b.or)).map(p => [p.or, p.date, (c.learners.find(x => x.id === p.lid) || {name: ''}).name, p.by || '', ...P.map(pr => r2((p.lines.find(x => x.proj === pr.id) || {}).amt) || ''), total(p), p.note || ''])];
  const ws2 = XLSX.utils.aoa_to_sheet(a2); ws2['!cols'] = [{wch: 12}, {wch: 11}, {wch: 32}, {wch: 26}, ...P.map(() => ({wch: 14})), {wch: 10}, {wch: 24}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Payments');
  XLSX.writeFile(wb, `${FUNDS[k].long} ${M.className(c).replace(/[\\\/:*?"<>|]/g, ' ')} ${M.today()}.xlsx`);
}

M.views['fund-hr'] = (el) => view(el, 'hr');
M.views['fund-spta'] = (el) => view(el, 'spta');
})();
