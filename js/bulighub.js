/* MASTRO — BULIG Hub (v6.21): the Division of Bukidnon BULIG reading modules as interactive activities on the laptop.
   Phase 1: Level 4 · Fluency (timed oral reading with miscue marking, model reading, pace reader)
            Level 6 · Graded Reading Comprehension (Grades 7–10: pre-test, 10 selections, post-test).
   Results are saved per learner on the class (c.hub), so they are in every backup.
   c.hub = {r: {learnerId: {activityId: {best, max, pct, n, ts, hist:[…]}}}}
   M.S.hubKeys = {activityId: ['A','C',…]}  — teacher's answer-key corrections (override the module key). */
(function(){
const M = window.M;
const {$, $$, esc} = M;

const MODS = [
  {k:'L3', n:'3', t:'Word Recognition', sub:'CVC words · word families · speed read', icon:'🔤', phase:3},
  {k:'L4', n:'4', t:'Fluency', sub:'25 poems & stories · timed oral reading', icon:'🎙️', ready:true},
  {k:'L5', n:'5', t:'Listening & Vocabulary', sub:'20 days · matching · word search · crossword', icon:'🎧', phase:2},
  {k:'L6', n:'6', t:'Graded Comprehension', sub:'Grades 7–10 · pre-test · 10 selections · post-test', icon:'📖', ready:true},
  {k:'L7', n:'7', t:'Love for Reading & Writing', sub:'Fact or Bluff · Match Me · news & editorial writing', icon:'✍️', phase:3}
];
const SKILL_C = {Literal:'lit', Interpretive:'int', Critical:'cri', Creative:'cre', Mixed:'mix'};
const MIS = [['MP','Mispronunciation'],['O','Omission'],['S','Substitution'],['I','Insertion'],['R','Repetition'],['T','Transposition'],['RV','Reversal']];
const levelOf = (p) => p >= 97 ? 'Independent' : p >= 90 ? 'Instructional' : 'Frustration';

const ui = () => { const u = M.S.ui.hub = M.S.ui.hub || {}; u.tab = u.tab || 'play'; u.fs = u.fs || 1; u.who = u.who || ''; return u; };
const store = (c) => { c.hub = c.hub || {}; c.hub.r = c.hub.r || {}; return c.hub; };
const resOf = (c, lid, id) => (((c.hub || {}).r || {})[lid] || {})[id] || null;
const keyOf = (a) => ((M.S.hubKeys || {})[a.id]) || a.q.map(q => q[2]);
const learnerById = (c, id) => c.learners.find(l => l.id === id);
const short = (n) => { const p = String(n || '').split(','); return (p[1] ? p[1].trim().split(' ')[0] + ' ' : '') + p[0].trim(); };
const gradeOf = (c) => { const u = ui(); const g = +(u.grade || c.grade); return String([7,8,9,10].includes(g) ? g : g > 10 ? 10 : 7); };
const loadData = () => Promise.all([M.loadScript('js/hub-l6.js'), M.loadScript('js/hub-l4.js')]);
const stars = (pct) => pct >= 80 ? 3 : pct >= 60 ? 2 : pct > 0 ? 1 : 0;
const starHtml = (n, of = 3) => `<span class="hb-stars">${'★'.repeat(n)}<i>${'★'.repeat(of - n)}</i></span>`;

function saveRes(c, lid, id, rec){
  const h = store(c); const r = h.r[lid] = h.r[lid] || {}; const o = r[id] = r[id] || {n: 0, hist: []};
  o.n++; o.ts = Date.now(); o.hist = [rec, ...(o.hist || [])].slice(0, 10);
  const better = !o.best || (rec.pct > o.best.pct) || (rec.pct === o.best.pct && (rec.wpm || 0) > (o.best.wpm || 0));
  if(better) o.best = rec; o.last = rec; M.save(); return better;
}

/* ---------- read aloud (laptop voice) ---------- */
const TTS = {
  ok: () => 'speechSynthesis' in window,
  voice(){ const V = speechSynthesis.getVoices(); return V.find(v => /en[-_]PH/i.test(v.lang)) || V.find(v => /en[-_](US|GB)/i.test(v.lang) && /natural|samantha|daniel|google/i.test(v.name)) || V.find(v => /^en/i.test(v.lang)) || null; },
  speak(text, {rate = 0.92, onWord, onEnd} = {}){ this.stop(); const s = new SpeechSynthesisUtterance(text); const v = this.voice(); if(v) s.voice = v; s.lang = v ? v.lang : 'en-US'; s.rate = rate;
    if(onWord) s.onboundary = e => { if(e.name === 'word' || e.name === undefined) onWord(e.charIndex); };
    s.onend = () => onEnd && onEnd(); s.onerror = () => onEnd && onEnd(); speechSynthesis.speak(s); },
  stop(){ if(this.ok()) speechSynthesis.cancel(); }
};
if(TTS.ok()) speechSynthesis.getVoices();

/* ---------- little celebrations ---------- */
function confetti(host){ const box = document.createElement('div'); box.className = 'hb-confetti'; const C = ['#f5c242','#2bd47d','#ff7a59','#5aa9ff','#c58bff','#ffffff'];
  box.innerHTML = Array.from({length: 90}, () => `<i style="left:${Math.random() * 100}%;background:${C[Math.floor(Math.random() * C.length)]};animation-delay:${(Math.random() * .6).toFixed(2)}s;animation-duration:${(2 + Math.random() * 1.6).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join('');
  host.appendChild(box); setTimeout(() => box.remove(), 4200); }
let AC = null;
function chime(good){ try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime;
  (good ? [660, 880] : [300, 220]).forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = good ? 'triangle' : 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * .11); g.gain.exponentialRampToValueAtTime(.18, t + i * .11 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .11 + .22);
    o.connect(g).connect(AC.destination); o.start(t + i * .11); o.stop(t + i * .11 + .25); }); } catch(e){} }

/* ---------- full-screen stage ---------- */
function stage(title, sub, theme){
  closeStage(); const u = ui();
  const s = document.createElement('div'); s.className = 'hub-stage ' + (theme || ''); s.id = 'hubStage'; s.style.setProperty('--hs-fs', u.fs);
  s.innerHTML = `<div class="hs-top"><button class="hs-ic" id="hsX" title="Close (Esc)">✕</button><div class="hs-tt"><b>${esc(title)}</b><span>${esc(sub || '')}</span></div>
    <div class="hs-tools"><button class="hs-ic" id="hsFm" title="Smaller text">A−</button><button class="hs-ic" id="hsFp" title="Bigger text">A+</button><button class="hs-ic" id="hsFs" title="Full screen">⛶</button></div></div>
    <div class="hs-body" id="hsBody"></div>`;
  document.body.appendChild(s); document.body.classList.add('hub-open');
  const setFs = (d) => { u.fs = Math.max(.8, Math.min(1.9, +(u.fs + d).toFixed(2))); s.style.setProperty('--hs-fs', u.fs); M.save(); };
  $('#hsFm', s).onclick = () => setFs(-.1); $('#hsFp', s).onclick = () => setFs(.1);
  $('#hsFs', s).onclick = () => { if(document.fullscreenElement) document.exitFullscreen(); else if(s.requestFullscreen) s.requestFullscreen().catch(() => {}); };
  $('#hsX', s).onclick = () => closeStage(true);
  s._key = (e) => { if(e.key === 'Escape' && !document.fullscreenElement) closeStage(true); else if(s.onKey) s.onKey(e); };
  document.addEventListener('keydown', s._key);
  return {s, body: $('#hsBody', s), sub: (t) => { $('.hs-tt span', s).textContent = t; }};
}
function closeStage(back){ const s = $('#hubStage'); if(!s) return; TTS.stop(); if(s._stop) s._stop(); document.removeEventListener('keydown', s._key);
  if(document.fullscreenElement) document.exitFullscreen().catch(() => {}); s.remove(); document.body.classList.remove('hub-open'); if(back) M.route(); }

/* ---------- who is reading ---------- */
function whoPicker(c, id, val, withClass = true){ const L = M.readLearners ? M.readLearners(c) : c.learners;
  return `<select class="input" id="${id}">${withClass ? `<option value="">👥 Whole class (projector)</option>` : `<option value="">— choose a learner —</option>`}
    ${[['M','Male'],['F','Female']].map(([sx, t]) => { const a = L.filter(l => sx === 'M' ? l.sex === 'M' : l.sex !== 'M'); return a.length ? `<optgroup label="${t}">${a.map(l => `<option value="${l.id}" ${l.id === val ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>`; }
function saveBox(c, host, id, rec, after, manual){
  const u = ui();
  if(u.who && manual){ const l = learnerById(c, u.who);
    host.innerHTML = `<div class="hb-saveas"><button class="hs-btn" id="hbSaveMe">💾 Save to ${esc(l ? l.name : '')}</button></div>`;
    $('#hbSaveMe', host).onclick = () => saveBox(c, host, id, rec, after, false); return; }
  if(u.who){ const better = saveRes(c, u.who, id, rec); const l = learnerById(c, u.who);
    host.innerHTML = `<div class="hb-saved">✓ Saved to <b>${esc(l ? l.name : '')}</b>${better ? ' · <span class="hb-new">new best!</span>' : ''}</div>`; after && after(); return; }
  host.innerHTML = `<div class="hb-saveas"><span>Save this result for</span>${whoPicker(c, 'hbSaveWho', '', false)}<button class="hs-btn" id="hbSaveGo">Save</button></div>`;
  $('#hbSaveGo', host).onclick = () => { const lid = $('#hbSaveWho', host).value; if(!lid) return M.toast('Choose a learner first');
    const better = saveRes(c, lid, id, rec); const l = learnerById(c, lid); host.innerHTML = `<div class="hb-saved">✓ Saved to <b>${esc(l.name)}</b>${better ? ' · <span class="hb-new">new best!</span>' : ''}</div>`; after && after(); };
}

/* =========================== Level 6 · comprehension player =========================== */
function playL6(c, g, idx){
  const A = M.HUB_L6[g]; const a = A[idx]; const key = keyOf(a); const n = a.q.length; const u = ui();
  const who = u.who ? learnerById(c, u.who) : null;
  const st = stage(`${a.label} · ${a.title}`, `Level 6 · Graded Reading Comprehension · Grade ${g}${who ? ' · ' + who.name : ' · Whole class'}`, 'hs-l6');
  const ans = new Array(n).fill(null); let i = -1;
  const passage = (cls) => `<article class="hb-paper ${cls || ''}"><div class="hb-kicker">${esc(a.label)}${a.focus && a.focus !== 'Mixed' ? ` · ${esc(a.focus)} comprehension` : ''}</div><h1>${esc(a.title)}</h1>${a.by ? `<div class="hb-by">by ${esc(a.by)}</div>` : ''}${a.p.map(p => `<p>${esc(p)}</p>`).join('')}</article>`;
  const read = () => { st.s.onKey = (e) => { if(e.key === 'Enter') go(0); };
    st.body.innerHTML = `<div class="hb-read">${passage()}
      <div class="hb-dock"><button class="hs-btn ghost" id="hbTts">🔊 Read aloud</button><span class="hb-dock-t">${a.p.join(' ').split(/\s+/).length} words · ${n} questions</span><button class="hs-btn big" id="hbGo">I'm ready — questions →</button></div></div>`;
    let on = false; $('#hbTts', st.body).onclick = (e) => { if(on){ TTS.stop(); on = false; e.target.textContent = '🔊 Read aloud'; return; }
      if(!TTS.ok()) return M.toast('This browser cannot read aloud'); on = true; e.target.textContent = '⏸ Stop reading';
      TTS.speak(a.title + '. ' + a.p.join(' '), {onEnd: () => { on = false; const b = $('#hbTts', st.body); if(b) b.textContent = '🔊 Read aloud'; }}); };
    $('#hbGo', st.body).onclick = () => go(0); };
  const go = (k) => { TTS.stop(); i = k; if(i >= n) return end(); q(); };
  const q = () => { const [stem, opts, , skill] = a.q[i]; const done = ans[i] !== null;
    st.body.innerHTML = `<div class="hb-quiz">
      <div class="hb-prog">${a.q.map((x, j) => `<i class="${j === i ? 'cur' : ''} ${ans[j] === null ? '' : ans[j] === key[j] ? 'ok' : 'no'}"></i>`).join('')}</div>
      <div class="hb-qcard"><div class="hb-qmeta"><span>Question ${i + 1} of ${n}</span>${skill || (a.focus && a.focus !== 'Mixed') ? `<span class="hb-skill sk-${SKILL_C[skill || a.focus]}">${esc(skill || a.focus)}</span>` : ''}</div>
        <h2>${esc(stem)}</h2>
        <div class="hb-opts">${opts.map((o, j) => { const L = 'ABCD'[j]; return `<button class="hb-opt" data-l="${L}"><b>${L}</b><span>${esc(o)}</span></button>`; }).join('')}</div>
        <div class="hb-fb" id="hbFb"></div></div>
      <div class="hb-dock"><button class="hs-btn ghost" id="hbBack">📖 Look back at the selection</button><span class="spacer"></span><button class="hs-btn big" id="hbNext" ${done ? '' : 'hidden'}>${i === n - 1 ? 'See my score →' : 'Next →'}</button></div>
      <div class="hb-drawer" id="hbDrawer" hidden><button class="hs-ic hb-dx" id="hbDx">✕</button>${passage('small')}</div></div>`;
    const mark = (L, fresh) => { ans[i] = L; const ok = L === key[i];
      $$('.hb-opt', st.body).forEach(b => { b.disabled = true; b.classList.toggle('right', b.dataset.l === key[i]); b.classList.toggle('wrong', b.dataset.l === L && !ok); b.classList.toggle('dim', b.dataset.l !== L && b.dataset.l !== key[i]); });
      $('#hbFb', st.body).innerHTML = ok ? `<span class="good">${['Correct! 🎉','Nice work! ⭐','You got it! 👏','Excellent! 🌟'][i % 4]}</span>` : `<span class="bad">Not quite — the answer is <b>${key[i]}</b>.</span>`;
      if(fresh) chime(ok); $('#hbNext', st.body).hidden = false; $('.hb-prog i.cur', st.body).classList.add(ok ? 'ok' : 'no'); };
    $$('.hb-opt', st.body).forEach(b => b.onclick = () => mark(b.dataset.l, true));
    if(done) mark(ans[i], false);
    $('#hbNext', st.body).onclick = () => go(i + 1);
    $('#hbBack', st.body).onclick = () => { $('#hbDrawer', st.body).hidden = false; };
    $('#hbDx', st.body).onclick = () => { $('#hbDrawer', st.body).hidden = true; };
    st.s.onKey = (e) => { const k = e.key.toUpperCase(); const m = {A:'A', B:'B', C:'C', D:'D', 1:'A', 2:'B', 3:'C', 4:'D'}[k];
      if(m && ans[i] === null){ const b = $(`.hb-opt[data-l="${m}"]`, st.body); if(b) b.click(); } else if((e.key === 'Enter' || e.key === 'ArrowRight') && ans[i] !== null) go(i + 1); };
  };
  const end = () => { st.s.onKey = null; const right = ans.filter((x, j) => x === key[j]).length; const pct = Math.round(right / n * 100); const sN = stars(pct);
    const sk = {}; a.q.forEach((x, j) => { const k = x[3] || (a.focus !== 'Mixed' ? a.focus : null); if(!k) return; sk[k] = sk[k] || [0, 0]; sk[k][1]++; if(ans[j] === key[j]) sk[k][0]++; });
    st.body.innerHTML = `<div class="hb-end">
      <div class="hb-ring" style="--p:${pct}"><div><b>${right}</b><span>of ${n}</span></div></div>
      ${starHtml(sN)}
      <h2>${pct >= 80 ? 'Outstanding reading!' : pct >= 60 ? 'Good job — keep going!' : 'Nice try — let’s read it again!'}</h2>
      ${Object.keys(sk).length > 1 ? `<div class="hb-sk">${Object.entries(sk).map(([k, [r, t]]) => `<div class="sk-${SKILL_C[k]}"><span>${esc(k)}</span><b>${r}/${t}</b></div>`).join('')}</div>` : ''}
      <div id="hbSave"></div>
      <details class="hb-review"><summary>Review answers</summary>${a.q.map((x, j) => `<div class="${ans[j] === key[j] ? 'ok' : 'no'}"><b>${j + 1}.</b> ${esc(x[0])}<br><span>${ans[j] === key[j] ? '✓' : '✕'} Your answer: ${ans[j] || '–'} · Correct: <b>${key[j]}</b> ${esc(x[1]['ABCD'.indexOf(key[j])] || '')}</span></div>`).join('')}</details>
      <div class="hb-dock center"><button class="hs-btn ghost" id="hbAgain">↻ Try again</button><button class="hs-btn ghost" id="hbList">☰ All activities</button>${idx < A.length - 1 ? `<button class="hs-btn big" id="hbNextA">Next: ${esc(A[idx + 1].label)} →</button>` : ''}</div></div>`;
    if(pct >= 60) confetti(st.s);
    saveBox(c, $('#hbSave', st.body), a.id, {score: right, max: n, pct, ans: ans.join(''), ts: Date.now()});
    $('#hbAgain', st.body).onclick = () => playL6(c, g, idx);
    $('#hbList', st.body).onclick = () => closeStage(true);
    if($('#hbNextA', st.body)) $('#hbNextA', st.body).onclick = () => playL6(c, g, idx + 1);
  };
  read();
}

/* =========================== Level 4 · fluency player =========================== */
function playL4(c, idx){
  const P = M.HUB_L4; const a = P[idx]; const u = ui(); const who = u.who ? learnerById(c, u.who) : null;
  const st = stage(`${a.label} · ${a.title}`, `Level 4 · Fluency${a.grade ? ' · ' + a.grade : ''}${who ? ' · ' + who.name : ' · Whole class'}`, 'hs-l4');
  // tokens per line/paragraph
  let wi = 0; const words = [];
  const body = a.t.map(line => `<${a.kind === 'poem' ? 'div class="hb-ln"' : 'p'}>${line.split(/(\s+)/).map(t => { if(!t.trim()) return ' '; words.push(t); return `<span class="hb-w" data-i="${wi++}">${esc(t)}</span>`; }).join('')}</${a.kind === 'poem' ? 'div' : 'p'}>`).join('');
  const marks = {}; let active = 'MP'; let t0 = 0, acc = 0, timer = 0, running = false, pace = false, paceT = 0, paceI = 0; let wpmT = u.paceWpm || 120;
  st.body.innerHTML = `<div class="hb-flu">
    <div class="hb-fbar">
      <div class="hb-clock" id="hbClock">0:00</div>
      <button class="hs-btn big" id="hbStart">▶ Start</button><button class="hs-btn ghost" id="hbReset" title="Start over">↺</button>
      <span class="hb-sep"></span>
      <button class="hs-btn ghost" id="hbModel" title="The laptop reads the passage aloud while the words light up">🔊 Model reading</button>
      <label class="hb-pace"><input type="checkbox" id="hbPace"> 🐢 Pace reader <input type="range" id="hbPw" min="60" max="200" step="10" value="${wpmT}"><b id="hbPwv">${wpmT}</b> wpm</label>
      <span class="spacer"></span><button class="hs-btn big done" id="hbDone">⏹ Done reading</button>
    </div>
    <div class="hb-mis" id="hbMis"><span class="hb-mis-t">Tap a word to mark a miscue:</span>${MIS.map(([k, t]) => `<button data-k="${k}" class="${k === active ? 'on' : ''}"><b>${k}</b>${t}<i data-c="${k}">0</i></button>`).join('')}</div>
    <article class="hb-paper flu ${a.kind}"><div class="hb-kicker">${esc(a.label)} · ${a.kind === 'poem' ? 'Poem' : 'Story'} · ${a.wc} words</div><h1>${esc(a.title)}</h1><div class="hb-text" id="hbText">${body}</div></article>
    <div id="hbRes"></div></div>`;
  const W = $$('.hb-w', st.body); const clock = $('#hbClock', st.body);
  const secs = () => (acc + (running ? (Date.now() - t0) : 0)) / 1000;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const tick = () => { clock.textContent = fmt(secs()); };
  const counts = () => { MIS.forEach(([k]) => { $(`[data-c="${k}"]`, st.body).textContent = Object.values(marks).filter(x => x === k).length; }); };
  const startPace = () => { clearInterval(paceT); if(!pace) return; paceT = setInterval(() => { W.forEach((w, j) => w.classList.toggle('pace', j === paceI)); if(W[paceI]) W[paceI].scrollIntoView({block: 'nearest', behavior: 'smooth'}); paceI++; if(paceI > W.length) clearInterval(paceT); }, 60000 / wpmT); };
  const start = () => { if(running){ acc += Date.now() - t0; running = false; clearInterval(timer); clearInterval(paceT); $('#hbStart', st.body).textContent = '▶ Resume'; return; }
    t0 = Date.now(); running = true; timer = setInterval(tick, 250); $('#hbStart', st.body).textContent = '⏸ Pause'; st.s.classList.add('reading'); startPace(); };
  const reset = () => { running = false; acc = 0; clearInterval(timer); clearInterval(paceT); paceI = 0; tick(); $('#hbStart', st.body).textContent = '▶ Start';
    Object.keys(marks).forEach(k => delete marks[k]); W.forEach(w => { w.className = 'hb-w'; delete w.dataset.m; }); counts(); $('#hbRes', st.body).innerHTML = ''; st.s.classList.remove('reading'); };
  st.s._stop = () => { clearInterval(timer); clearInterval(paceT); };
  $('#hbStart', st.body).onclick = start; $('#hbReset', st.body).onclick = reset;
  $$('#hbMis button', st.body).forEach(b => b.onclick = () => { active = b.dataset.k; $$('#hbMis button', st.body).forEach(x => x.classList.toggle('on', x === b)); });
  W.forEach(w => w.onclick = () => { const j = w.dataset.i; if(marks[j] === active){ delete marks[j]; w.className = 'hb-w'; delete w.dataset.m; } else { marks[j] = active; w.className = 'hb-w mk'; w.dataset.m = active; } counts(); });
  $('#hbPace', st.body).onchange = (e) => { pace = e.target.checked; paceI = 0; W.forEach(w => w.classList.remove('pace')); if(running) startPace(); };
  $('#hbPw', st.body).oninput = (e) => { wpmT = +e.target.value; u.paceWpm = wpmT; $('#hbPwv', st.body).textContent = wpmT; if(running && pace) startPace(); };
  let modelOn = false;
  $('#hbModel', st.body).onclick = (e) => { if(modelOn){ TTS.stop(); modelOn = false; e.target.textContent = '🔊 Model reading'; W.forEach(w => w.classList.remove('say')); return; }
    if(!TTS.ok()) return M.toast('This browser cannot read aloud');
    const text = words.join(' '); const starts = []; let p = 0; words.forEach(w => { starts.push(p); p += w.length + 1; });
    modelOn = true; e.target.textContent = '⏸ Stop';
    TTS.speak(text, {rate: 0.9, onWord: (ci) => { let j = starts.length - 1; while(j > 0 && starts[j] > ci) j--; W.forEach((w, k) => w.classList.toggle('say', k === j)); if(W[j]) W[j].scrollIntoView({block: 'nearest', behavior: 'smooth'}); },
      onEnd: () => { modelOn = false; const b = $('#hbModel', st.body); if(b) b.textContent = '🔊 Model reading'; W.forEach(w => w.classList.remove('say')); }}); };
  $('#hbDone', st.body).onclick = () => { if(running) start(); const s = Math.round(secs()); results(s); };
  st.s.onKey = (e) => { if(e.key === ' ' && e.target === document.body){ e.preventDefault(); start(); } };
  const results = (s) => { st.s.classList.remove('reading');
    const box = $('#hbRes', st.body); let read = a.wc;
    const draw = () => { const mis = Object.keys(marks).length; const pct = Math.max(0, Math.round((a.wc - mis) / a.wc * 1000) / 10); const lvl = levelOf(pct); const wpm = s ? Math.round(read * 60 / s) : 0;
      box.innerHTML = `<div class="hb-fres">
        <div class="hb-fres-h"><h2>Oral reading record</h2><button class="hs-ic" id="hbRx">✕</button></div>
        <div class="hb-kpis">
          <div><span>Oral reading score</span><b>${pct}%</b><i class="lv-${lvl}">${lvl}</i></div>
          <div><span>Reading speed</span><b>${wpm}</b><i>words per minute</i></div>
          <div><span>Miscues</span><b>${mis}</b><i>${MIS.map(([k]) => { const x = Object.values(marks).filter(v => v === k).length; return x ? `${k} ${x}` : ''; }).filter(Boolean).join(' · ') || 'none'}</i></div>
          <div><span>Reading time</span><b>${fmt(s)}</b><i><label>Words read <input type="number" id="hbRead" min="1" max="${a.wc}" value="${read}"></label></i></div>
        </div>
        <div class="tiny hb-formula">Score = (${a.wc} − ${mis}) ÷ ${a.wc} × 100 · Independent 97–100 · Instructional 90–96 · Frustration 89 and below &nbsp;|&nbsp; Speed = words read × 60 ÷ ${s} s</div>
        <div id="hbSave"></div>
        <div class="hb-dock center"><button class="hs-btn ghost" id="hbAgain">↻ Read again</button><button class="hs-btn ghost" id="hbList">☰ All passages</button>${idx < P.length - 1 ? `<button class="hs-btn big" id="hbNextA">Next: ${esc(P[idx + 1].title)} →</button>` : ''}</div></div>`;
      $('#hbRead', box).onchange = (e) => { read = Math.max(1, Math.min(a.wc, +e.target.value || a.wc)); draw(); };
      $('#hbRx', box).onclick = () => { box.innerHTML = ''; };
      saveBox(c, $('#hbSave', box), a.id, {pct, wpm, mis, secs: s, read, lvl, ts: Date.now(), marks: Object.entries(marks).map(([k, v]) => k + v).join(',')}, null, true);
      $('#hbAgain', box).onclick = () => playL4(c, idx); $('#hbList', box).onclick = () => closeStage(true);
      if($('#hbNextA', box)) $('#hbNextA', box).onclick = () => playL4(c, idx + 1);
      if(pct >= 97) confetti(st.s); };
    draw(); box.scrollIntoView({behavior: 'smooth'}); };
}

/* =========================== hub views =========================== */
const BACK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

M.views.readingHub = function view(el){
  const c = M.cls(); const u = ui();
  if(!M.HUB_L6 || !M.HUB_L4){ el.innerHTML = `<div class="card"><div class="empty">Opening the BULIG Hub…</div></div>`; loadData().then(() => view(el)).catch(() => { el.innerHTML = `<div class="card"><div class="empty">Could not load the BULIG modules. Reload MASTRO and try again.</div></div>`; }); return; }
  if(u.who && !learnerById(c, u.who)) u.who = '';
  const who = u.who ? learnerById(c, u.who) : null; const lv = who && M.buligLevel ? M.buligLevel(c, who.id) : [];
  const mod = MODS.find(m => m.k === u.mod && m.ready);
  el.innerHTML = `<div class="card hb-hero">
    <div class="hb-hero-l"><div class="eyebrow-s">BULIG Hub · interactive modules</div><h2>${mod ? `<button class="hb-crumb" id="hbHome">${BACK} Hub</button> Level ${mod.n} · ${esc(mod.t)}` : 'Read, play and track — right on the laptop'}</h2>
      <div class="small muted">${mod ? esc(mod.sub) : 'The Division of Bukidnon BULIG modules as activities: project them for the whole class or let one learner read at a time. Results are saved to the learner.'}</div></div>
    <div class="hb-who"><label class="field mini">Who's reading?${whoPicker(c, 'hbWho', u.who)}</label>
      ${who ? `<div class="hb-who-lv">${lv.length ? lv.map(x => `<span class="chip">${esc(x.lang)} · BULIG ${esc(x.level.t.toLowerCase().replace('level', 'Level'))}</span>`).join('') : '<span class="chip">No BULIG level yet</span>'}</div>` : ''}</div></div>
  <div id="hbMain"></div>`;
  $('#hbWho', el).onchange = (e) => { u.who = e.target.value; M.save(); view(el); };
  if($('#hbHome', el)) $('#hbHome', el).onclick = () => { u.mod = null; M.save(); view(el); };
  const main = $('#hbMain', el);
  if(!mod) return shelf(main, c, el);
  if(mod.k === 'L6') return l6Home(main, c, el);
  if(mod.k === 'L4') return l4Home(main, c, el);
};

function shelf(main, c, el){ const u = ui();
  const done = (pre) => { const r = (c.hub || {}).r || {}; let n = 0; Object.values(r).forEach(x => Object.keys(x).forEach(k => { if(k.startsWith(pre)) n++; })); return n; };
  main.innerHTML = `<div class="hb-shelf">${MODS.map(m => `<button class="hb-mod m-${m.k} ${m.ready ? '' : 'soon'}" data-m="${m.k}" ${m.ready ? '' : 'disabled'}>
      <span class="hb-mod-n">Level ${m.n}</span><span class="hb-mod-ic">${m.icon}</span><b>${esc(m.t)}</b><span class="hb-mod-s">${esc(m.sub)}</span>
      <span class="hb-mod-f">${m.ready ? `${done(m.k + '-') ? `${done(m.k + '-')} result(s) saved` : 'Ready'} <i>Open →</i>` : `Coming in phase ${m.phase}`}</span></button>`).join('')}</div>`;
  $$('.hb-mod:not(.soon)', main).forEach(b => b.onclick = () => { u.mod = b.dataset.m; u.tab = 'play'; M.save(); M.views.readingHub(el); });
}

const tabsHtml = (tabs, cur) => `<div class="seg" id="hbTabs">${tabs.map(([k, t]) => `<button data-t="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join('')}</div>`;

function l6Home(main, c, el){ const u = ui(); const g = gradeOf(c); const A = M.HUB_L6[g];
  main.innerHTML = `<div class="row hb-bar">${tabsHtml([['play','Activities'],['prog','Progress'],['keys','Answer keys']], u.tab)}<span class="spacer"></span>
    <div class="seg" id="hbGr">${['7','8','9','10'].map(x => `<button data-g="${x}" class="${x === g ? 'on' : ''}">Grade ${x}</button>`).join('')}</div></div><div id="hbTab"></div>`;
  $$('#hbGr button', main).forEach(b => b.onclick = () => { u.grade = b.dataset.g; M.save(); M.views.readingHub(el); });
  $$('#hbTabs button', main).forEach(b => b.onclick = () => { u.tab = b.dataset.t; M.save(); M.views.readingHub(el); });
  const box = $('#hbTab', main);
  if(u.tab === 'prog') return progress(box, c, A, 'L6');
  if(u.tab === 'keys') return keys(box, c, A, g, el);
  const r = u.who ? (((c.hub || {}).r || {})[u.who] || {}) : null; const allR = (c.hub || {}).r || {};
  box.innerHTML = `<div class="hb-path">${A.map((a, i) => { const x = r && r[a.id]; const cnt = Object.values(allR).filter(y => y[a.id]).length; const isT = i === 0 || i === A.length - 1;
    return `<button class="hb-tile ${isT ? 'test' : ''} ${x ? 'done' : ''}" data-i="${i}"><span class="hb-tile-n">${isT ? (i ? 'POST' : 'PRE') : i}</span>
      <span class="hb-tile-b"><span class="hb-tile-l">${esc(a.label)}${a.focus && a.focus !== 'Mixed' ? ` <span class="hb-skill sk-${SKILL_C[a.focus]}">${esc(a.focus)}</span>` : ''}${a.keyBy ? ' <span class="hb-chk" title="Answer key written by Claude — check it in Answer keys">key ✎</span>' : ''}</span><b>${esc(a.title)}</b>
      <span class="hb-tile-s">${x ? `${starHtml(stars(x.best.pct))} best ${x.best.score}/${x.best.max}` : u.who ? `${a.q.length} questions` : cnt ? `${cnt} learner(s) done` : `${a.q.length} questions`}</span></span></button>`; }).join('')}</div>`;
  $$('.hb-tile', box).forEach(b => b.onclick = () => playL6(c, g, +b.dataset.i));
}

function l4Home(main, c, el){ const u = ui(); const P = M.HUB_L4;
  main.innerHTML = `<div class="row hb-bar">${tabsHtml([['play','Passages'],['prog','Progress']], u.tab === 'keys' ? 'play' : u.tab)}<span class="spacer"></span><span class="small muted">Tap ▶ Start when the learner begins · tap the words they miss · ⏹ Done</span></div><div id="hbTab"></div>`;
  $$('#hbTabs button', main).forEach(b => b.onclick = () => { u.tab = b.dataset.t; M.save(); M.views.readingHub(el); });
  const box = $('#hbTab', main);
  if(u.tab === 'prog') return progress(box, c, P, 'L4');
  const r = u.who ? (((c.hub || {}).r || {})[u.who] || {}) : null;
  const tile = (a, i) => { const x = r && r[a.id]; return `<button class="hb-tile flu ${a.kind} ${x ? 'done' : ''}" data-i="${i}"><span class="hb-tile-n">${a.kind === 'poem' ? '♪' : '¶'}</span>
    <span class="hb-tile-b"><span class="hb-tile-l">${esc(a.label)}${a.grade ? ' · ' + esc(a.grade) : ''}</span><b>${esc(a.title)}</b><span class="hb-tile-s">${x ? `<span class="lv-${x.best.lvl}">${x.best.pct}% ${x.best.lvl}</span> · ${x.best.wpm} wpm` : `${a.wc} words`}</span></span></button>`; };
  const grp = [['Assessment', P.map((a, i) => [a, i]).filter(([a]) => /assessment/i.test(a.label))], ['Part I · Fluency poems', P.map((a, i) => [a, i]).filter(([a]) => a.kind === 'poem')], ['Part II · Fluency stories', P.map((a, i) => [a, i]).filter(([a]) => a.kind === 'story' && !/assessment/i.test(a.label))]];
  box.innerHTML = grp.map(([t, arr]) => `<div class="hb-gh">${t}</div><div class="hb-path flu">${arr.map(([a, i]) => tile(a, i)).join('')}</div>`).join('');
  $$('.hb-tile', box).forEach(b => b.onclick = () => playL4(c, +b.dataset.i));
}

function progress(box, c, A, kind){ const L = M.readLearners ? M.readLearners(c) : c.learners; const R = (c.hub || {}).r || {};
  const col = (a, i) => kind === 'L6' ? (i === 0 ? 'Pre' : i === A.length - 1 ? 'Post' : String(i)) : (/Pre/.test(a.label) ? 'Pre' : /Post-assessment A/.test(a.label) ? 'Post A' : /Post-assessment B/.test(a.label) ? 'Post B' : a.label.replace('Activity ', ''));
  const cell = (x) => !x ? '<td class="e">·</td>' : kind === 'L6' ? `<td class="s${stars(x.best.pct)}" title="${x.n} attempt(s)">${x.best.score}/${x.best.max}</td>` : `<td class="lv-${x.best.lvl}" title="${x.best.pct}% · ${x.best.wpm} wpm · ${x.n} attempt(s)">${x.best.wpm}<small>${x.best.pct}%</small></td>`;
  const any = L.some(l => R[l.id] && A.some(a => R[l.id][a.id]));
  box.innerHTML = `<div class="card hb-progc"><div class="row" style="margin-bottom:10px"><b>${kind === 'L6' ? 'Best score per selection' : 'Best reading speed (wpm) and oral reading score per passage'}</b><span class="spacer"></span><button class="btn sm" id="hbCsv">⬇ Download CSV</button></div>
    ${any ? '' : '<div class="small muted" style="margin-bottom:8px">No results yet — choose a learner in “Who’s reading?” and play an activity, or save a whole-class result to a learner at the end.</div>'}
    <div class="hb-tw"><table class="hb-pt"><thead><tr><th class="l">Learner</th>${A.map((a, i) => `<th title="${esc(a.title)}">${col(a, i)}</th>`).join('')}</tr></thead><tbody>
    ${[['M','MALE'],['F','FEMALE']].map(([sx, t]) => { const arr = L.filter(l => sx === 'M' ? l.sex === 'M' : l.sex !== 'M'); return arr.length ? `<tr class="sx"><td colspan="${A.length + 1}">${t}</td></tr>` + arr.map(l => `<tr><td class="l">${esc(l.name)}</td>${A.map(a => cell((R[l.id] || {})[a.id])).join('')}</tr>`).join('') : ''; }).join('')}</tbody></table></div>
    ${kind === 'L4' ? '<div class="tiny muted" style="margin-top:8px">Colour = level: green Independent (97–100%), amber Instructional (90–96%), red Frustration (89% and below).</div>' : ''}</div>`;
  $('#hbCsv', box).onclick = () => { const rows = [['Learner', 'Sex', ...A.map((a, i) => col(a, i) + ' ' + a.title)]];
    L.forEach(l => rows.push([l.name, l.sex, ...A.map(a => { const x = (R[l.id] || {})[a.id]; return !x ? '' : kind === 'L6' ? `${x.best.score}/${x.best.max}` : `${x.best.pct}% ${x.best.lvl} ${x.best.wpm} wpm`; })]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], {type: 'text/csv'})); a.download = `BULIG Hub ${kind === 'L6' ? 'Level 6' : 'Level 4'} - ${M.className(c)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
}

function keys(box, c, A, g, el){ const K = M.S.hubKeys = M.S.hubKeys || {};
  const flagged = A.filter(a => a.keyBy || a.keyNote).length;
  box.innerHTML = `<div class="card"><div class="small" style="margin-bottom:10px">${flagged ? `<b>Please check:</b> ${A.some(a => a.keyBy) ? 'the Grade ' + g + ' module has no answer key, so Claude wrote these answers from the selections.' : ''} ${A.filter(a => a.keyNote).map(a => esc(a.label + ': ' + a.keyNote)).join(' ')} Change any answer below — your choice is used in the Hub from then on.` : 'These are the answer keys printed in the module. Change any answer below if you find a mistake — your choice is used in the Hub from then on.'}</div>
    <div class="hb-keys">${A.map(a => { const k = keyOf(a); const mine = !!K[a.id]; return `<div class="hb-key ${a.keyBy ? 'chk' : ''}"><div class="hb-key-h"><b>${esc(a.label)}</b><span>${esc(a.title)}</span>${mine ? `<button class="btn sm" data-reset="${a.id}">Reset to module key</button>` : ''}</div>
      <div class="hb-key-r">${a.q.map((q, j) => `<label title="${esc(q[0])}"><i>${j + 1}</i><select data-a="${a.id}" data-j="${j}">${'ABCD'.split('').map(L => `<option ${L === k[j] ? 'selected' : ''}>${L}</option>`).join('')}</select></label>`).join('')}</div></div>`; }).join('')}</div></div>`;
  $$('select[data-a]', box).forEach(s => s.onchange = () => { const a = A.find(x => x.id === s.dataset.a); const k = K[a.id] = keyOf(a).slice(); k[+s.dataset.j] = s.value; M.save(); M.toast('Answer key updated'); M.views.readingHub(el); });
  $$('[data-reset]', box).forEach(b => b.onclick = () => { delete K[b.dataset.reset]; M.save(); M.views.readingHub(el); });
}

M.hubClose = closeStage;
})();
