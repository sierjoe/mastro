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
  {k:'L3', n:'3', t:'Word Recognition', sub:'25 lessons · CVC · word families · blends · sight words', icon:'🔤', ready:true},
  {k:'L4', n:'4', t:'Fluency', sub:'25 poems & stories · timed oral reading', icon:'🎙️', ready:true},
  {k:'L5', n:'5', t:'Listening & Vocabulary', sub:'Grades 7–8 and 9–10 · 20 days · pre- and post-tests', icon:'🎧', ready:true},
  {k:'L6', n:'6', t:'Graded Comprehension', sub:'Grades 7–10 · pre-test · 10 selections · post-test', icon:'📖', ready:true},
  {k:'L7', n:'7', t:'Love for Reading & Writing', sub:'Grade 7 · 27 campus-journalism activities', icon:'✍️', ready:true}
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
const loadData = () => Promise.all(['js/hub-l3.js','js/hub-l4.js','js/hub-l5.js','js/hub-l6.js','js/hub-l7.js'].map(f => M.loadScript(f)));
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
    ${[['M','Male'],['F','Female']].map(([sx, t]) => { const a = L.filter(l => sx === 'M' ? l.sex === 'M' : l.sex !== 'M'); return a.length ? `<optgroup label="${t}">${a.map(l => `<option value="${l.id}" ${l.id === val ? 'selected' : ''}>${esc(l.name)}${M.readAssessor && M.readAssessor(c, l) ? ' · 👩‍🏫 ' + esc(M.readAssessor(c, l)) : ''}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>`; }
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
function playL6(c, g, idx){ return playQuiz(c, M.HUB_L6[g], idx, {sub: `Level 6 · Graded Reading Comprehension · Grade ${g}`, theme: 'hs-l6', replay: (i) => playL6(c, g, i)}); }
// generic multiple-choice player: a = {id, label, title, p?: [paragraphs], q: [[stem, options, key, skill?, context?]]}
function playQuiz(c, A, idx, opt){
  const a = A[idx]; const key = keyOf(a); const n = a.q.length; const u = ui();
  const who = u.who ? learnerById(c, u.who) : null;
  const st = stage(`${a.label}${a.title ? ' · ' + a.title : ''}`, `${opt.sub}${who ? ' · ' + who.name : ' · Whole class'}`, (opt.theme || 'hs-l6') + ' hs-wide');
  const ans = new Array(n).fill(null); let i = -1; const T0 = Date.now(); let tRead = 0, tq = 0;
  let LB, TB;   // learner box, teacher box
  const frame = () => { st.body.innerHTML = splitWrap(`<div id="hbL"></div>`, `<div id="hbT"></div>`, 'Teacher · answer key and live results', 'learner');
    splitWire(st.body, () => { frame(); i < 0 ? read() : i >= n ? end() : q(); }); LB = $('#hbL', st.body); TB = $('#hbT', st.body); };
  const fmt = (ms) => { const s2 = Math.round(ms / 1000); return `${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, '0')}`; };
  const right = () => ans.filter((x, j) => x === key[j]).length;
  const teacher = () => { if(!TB) return; const done = ans.filter(x => x !== null).length;
    const cur = i >= 0 && i < n ? a.q[i] : null;
    TB.innerHTML = `<div class="hb-tp">
      <div class="hb-tp-k"><div><span>Stage</span><b>${i < 0 ? 'Reading' : i >= n ? 'Finished' : `Question ${i + 1}/${n}`}</b></div><div><span>Correct</span><b>${right()}/${done}</b></div><div><span>${a.p && a.p.length ? 'Reading time' : 'Time'}</span><b id="hbTr">${fmt(i < 0 ? Date.now() - T0 : a.p && a.p.length ? tRead : Date.now() - T0)}</b></div></div>
      ${i < 0 ? `<div class="hb-tp-note">The learner is reading <b>${esc(a.title)}</b> (${a.p.join(' ').split(/\s+/).length} words). When they are ready, they tap <b>I'm ready</b> — or start the questions from here.</div><button class="hs-btn" id="hbTGo">Start the questions →</button>` : ''}
      ${cur ? `<div class="hb-tp-cur"><div class="hb-tp-l">Now on the learner's side${cur[3] || a.focus ? ' · ' + esc(cur[3] || a.focus) : ''}</div><b>${i + 1}. ${esc(cur[0])}</b>
        <ol type="A">${cur[1].map((o, j) => `<li class="${'ABCD'[j] === key[i] ? 'key' : ''} ${ans[i] === 'ABCD'[j] ? 'pick' : ''}">${esc(o)}${'ABCD'[j] === key[i] ? ' <i>✓ key</i>' : ''}${ans[i] === 'ABCD'[j] && ans[i] !== key[i] ? ' <i class="x">learner</i>' : ''}</li>`).join('')}</ol></div>` : ''}
      ${i >= n ? `<div id="hbSaveT" class="hb-tp-save"></div>` : ''}
      <div class="hb-tp-list">${a.q.map((x, j) => `<div class="${j === i ? 'cur' : ''} ${ans[j] === null ? '' : ans[j] === key[j] ? 'ok' : 'no'}"><i>${j + 1}</i><span>${esc(x[0])}</span><b>${ans[j] ? (ans[j] === key[j] ? '✓ ' : '✕ ') + ans[j] : '·'}</b><em>key ${key[j]}</em></div>`).join('')}</div>
    </div>`;
    if($('#hbTGo', TB)) $('#hbTGo', TB).onclick = () => go(0); };
  const clockT = setInterval(() => { const e = $('#hbTr', st.s); if(e && (i < 0 || (!(a.p && a.p.length) && i < n))) e.textContent = fmt(Date.now() - T0); }, 1000); st.s._stop = () => clearInterval(clockT);
  const passage = (cls) => !(a.p && a.p.length) ? '' : `<article class="hb-paper ${cls || ''}"><div class="hb-kicker">${esc(a.label)}${a.focus && a.focus !== 'Mixed' ? ` · ${esc(a.focus)} comprehension` : ''}</div><h1>${esc(a.title)}</h1>${a.by ? `<div class="hb-by">by ${esc(a.by)}</div>` : ''}${a.p.map(p => `<p>${esc(p)}</p>`).join('')}</article>`;
  const read = () => { st.s.onKey = (e) => { if(e.key === 'Enter') go(0); };
    LB.innerHTML = `<div class="hb-read">${passage('learner')}
      <div class="hb-dock"><button class="hs-btn ghost" id="hbTts">🔊 Read aloud</button><span class="hb-dock-t">${n} questions after reading</span><button class="hs-btn big" id="hbGo">I'm ready — questions →</button></div></div>`;
    let on = false; $('#hbTts', LB).onclick = (e) => { if(on){ TTS.stop(); on = false; e.target.textContent = '🔊 Read aloud'; return; }
      if(!TTS.ok()) return M.toast('This browser cannot read aloud'); on = true; e.target.textContent = '⏸ Stop reading';
      TTS.speak(a.title + '. ' + a.p.join(' '), {onEnd: () => { on = false; const b = $('#hbTts', LB); if(b) b.textContent = '🔊 Read aloud'; }}); };
    $('#hbGo', LB).onclick = () => go(0); teacher(); };
  const go = (k) => { TTS.stop(); if(i < 0) tRead = Date.now() - T0; i = k; if(i >= n) return end(); q(); };
  const q = () => { const [stem, opts, , skill] = a.q[i]; const done = ans[i] !== null;
    LB.innerHTML = `<div class="hb-quiz">
      <div class="hb-prog">${a.q.map((x, j) => `<i class="${j === i ? 'cur' : ''} ${ans[j] === null ? '' : ans[j] === key[j] ? 'ok' : 'no'}"></i>`).join('')}</div>
      <div class="hb-qcard"><div class="hb-qmeta"><span>Question ${i + 1} of ${n}</span>${skill || (a.focus && a.focus !== 'Mixed') ? `<span class="hb-skill sk-${SKILL_C[skill || a.focus]}">${esc(skill || a.focus)}</span>` : ''}</div>
        ${a.q[i][4] ? `<div class="hb-ctx">${esc(a.q[i][4])}</div>` : ''}<h2>${esc(stem)}</h2>
        <div class="hb-opts">${opts.map((o, j) => { const L = 'ABCD'[j]; return `<button class="hb-opt" data-l="${L}"><b>${L}</b><span>${esc(o)}</span></button>`; }).join('')}</div>
        <div class="hb-fb" id="hbFb"></div></div>
      <div class="hb-dock">${a.p && a.p.length ? '<button class="hs-btn ghost" id="hbBack">📖 Look back at the selection</button>' : ''}<span class="spacer"></span><button class="hs-btn big" id="hbNext" ${done ? '' : 'hidden'}>${i === n - 1 ? 'See my score →' : 'Next →'}</button></div>
      <div class="hb-drawer" id="hbDrawer" hidden><button class="hs-ic hb-dx" id="hbDx">✕</button>${passage('small')}</div></div>`;
    const mark = (L, fresh) => { ans[i] = L; const ok = L === key[i];
      $$('.hb-opt', LB).forEach(b => { b.disabled = true; b.classList.toggle('right', b.dataset.l === key[i]); b.classList.toggle('wrong', b.dataset.l === L && !ok); b.classList.toggle('dim', b.dataset.l !== L && b.dataset.l !== key[i]); });
      $('#hbFb', LB).innerHTML = ok ? `<span class="good">${['Correct! 🎉','Nice work! ⭐','You got it! 👏','Excellent! 🌟'][i % 4]}</span>` : `<span class="bad">Not quite — the answer is <b>${key[i]}</b>.</span>`;
      if(fresh) chime(ok); $('#hbNext', LB).hidden = false; $('.hb-prog i.cur', LB).classList.add(ok ? 'ok' : 'no'); teacher(); };
    $$('.hb-opt', LB).forEach(b => b.onclick = () => mark(b.dataset.l, true));
    if(done) mark(ans[i], false);
    $('#hbNext', LB).onclick = () => go(i + 1);
    if($('#hbBack', LB)){ $('#hbBack', LB).onclick = () => { $('#hbDrawer', LB).hidden = false; }; $('#hbDx', LB).onclick = () => { $('#hbDrawer', LB).hidden = true; }; }
    st.s.onKey = (e) => { const k = e.key.toUpperCase(); const m = {A:'A', B:'B', C:'C', D:'D', 1:'A', 2:'B', 3:'C', 4:'D'}[k];
      if(m && ans[i] === null){ const b = $(`.hb-opt[data-l="${m}"]`, LB); if(b) b.click(); } else if((e.key === 'Enter' || e.key === 'ArrowRight') && ans[i] !== null) go(i + 1); };
    teacher(); };
  const end = () => { st.s.onKey = null; const r = right(); const pct = Math.round(r / n * 100); const sN = stars(pct);
    const sk = {}; a.q.forEach((x, j) => { const k = x[3] || (a.focus !== 'Mixed' ? a.focus : null); if(!k) return; sk[k] = sk[k] || [0, 0]; sk[k][1]++; if(ans[j] === key[j]) sk[k][0]++; });
    LB.innerHTML = `<div class="hb-end">
      <div class="hb-ring" style="--p:${pct}"><div><b>${r}</b><span>of ${n}</span></div></div>
      ${starHtml(sN)}
      <h2>${pct >= 80 ? 'Outstanding reading!' : pct >= 60 ? 'Good job — keep going!' : 'Nice try — let’s read it again!'}</h2>
      ${Object.keys(sk).length > 1 ? `<div class="hb-sk">${Object.entries(sk).map(([k, [x, t]]) => `<div class="sk-${SKILL_C[k]}"><span>${esc(k)}</span><b>${x}/${t}</b></div>`).join('')}</div>` : ''}
      <div id="hbSave"></div>
      <details class="hb-review"><summary>Review answers</summary>${a.q.map((x, j) => `<div class="${ans[j] === key[j] ? 'ok' : 'no'}"><b>${j + 1}.</b> ${esc(x[0])}<br><span>${ans[j] === key[j] ? '✓' : '✕'} Your answer: ${ans[j] || '–'} · Correct: <b>${key[j]}</b> ${esc(x[1]['ABCD'.indexOf(key[j])] || '')}</span></div>`).join('')}</details>
      <div class="hb-dock center"><button class="hs-btn ghost" id="hbAgain">↻ Try again</button><button class="hs-btn ghost" id="hbList">☰ All activities</button>${idx < A.length - 1 ? `<button class="hs-btn big" id="hbNextA">Next: ${esc(A[idx + 1].label)} →</button>` : ''}</div></div>`;
    if(pct >= 60) confetti(st.s);
    teacher(); saveBox(c, $('#hbSaveT', st.body) || $('#hbSave', LB), a.id, {score: r, max: n, pct, ans: ans.join(''), secs: Math.round(tRead / 1000), ts: Date.now()});
    $('#hbAgain', LB).onclick = () => opt.replay(idx);
    $('#hbList', LB).onclick = () => closeStage(true);
    if($('#hbNextA', LB)) $('#hbNextA', LB).onclick = () => opt.replay(idx + 1); };
  frame(); if(a.p && a.p.length) read(); else { tRead = 0; i = 0; q(); }
}

/* =========================== split screen (learner side | teacher side) ===========================
   The learner looks only at their side: a clean page, big text, nothing to click. The teacher scores on the other side.
   ⇆ swaps the sides, ▣ switches to one page (old layout). Saved in M.S.ui.hub.split / .swap. */
function splitWrap(learnerHtml, teacherHtml, teacherTitle, offShow){ const u = ui(); const split = u.split !== false;
  const btns = `<span class="spacer"></span><button class="hs-ic sm" id="hbSwap" title="Swap sides" ${split ? '' : 'hidden'}>⇆</button><button class="hs-ic sm" id="hbSplit" title="${split ? 'One page for everyone' : 'Learner side | teacher side'}">${split ? '▣ One page' : '◫ Split screen'}</button>`;
  if(!split && offShow === 'learner') return `<div class="hb-split off"><section class="hb-side hb-learner solo"><div class="hb-side-tag">${btns}</div>${learnerHtml}</section></div>`;
  return `<div class="hb-split ${split ? 'on' : 'off'} ${u.swap ? 'swap' : ''}">
    ${split ? `<section class="hb-side hb-learner"><div class="hb-side-tag">📖 Learner</div>${learnerHtml}</section>` : ''}
    <section class="hb-side hb-teacher"><div class="hb-side-tag t">👩‍🏫 ${esc(teacherTitle || 'Teacher')}${btns}</div>${teacherHtml}</section></div>`; }
function splitWire(host, redraw){ const u = ui();
  const sw = $('#hbSwap', host), sp = $('#hbSplit', host);
  if(sw) sw.onclick = () => { u.swap = !u.swap; M.save(); $('.hb-split', host).classList.toggle('swap', u.swap); };
  if(sp) sp.onclick = () => { u.split = u.split === false; M.save(); redraw(); }; }
// words as tappable spans; the same data-i on both sides
function wordsHtml(lines, kind, words){ let wi = 0;
  return lines.map(line => `<${kind === 'poem' ? 'div class="hb-ln"' : 'p'}>${line.split(/(\s+)/).map(t => { if(!t.trim()) return ' '; if(words) words.push(t); return `<span class="hb-w" data-i="${wi++}">${esc(t)}</span>`; }).join('')}</${kind === 'poem' ? 'div' : 'p'}>`).join(''); }
function countdown(host, done){ const d = document.createElement('div'); d.className = 'hb-cd'; host.appendChild(d); let n = 3;
  const step = () => { if(n === 0){ d.innerHTML = '<b>Read!</b>'; setTimeout(() => d.remove(), 650); done(); return; } d.innerHTML = `<b>${n}</b>`; n--; setTimeout(step, 750); }; step(); }

/* =========================== Level 4 · fluency player =========================== */
function playL4(c, idx){
  const P = M.HUB_L4; const a = P[idx]; const u = ui(); const who = u.who ? learnerById(c, u.who) : null;
  const st = stage(`${a.label} · ${a.title}`, `Level 4 · Fluency${a.grade ? ' · ' + a.grade : ''}${who ? ' · ' + who.name : ' · Whole class'}`, 'hs-l4 hs-wide');
  const words = []; const tHtml = wordsHtml(a.t, a.kind, words); const lHtml = wordsHtml(a.t, a.kind);
  const marks = {}; let active = 'MP'; let t0 = 0, acc = 0, timer = 0, running = false, pace = false, paceT = 0, paceI = 0; let wpmT = u.paceWpm || 120; let modelOn = false;
  const draw = () => {
    st.body.innerHTML = splitWrap(
      `<article class="hb-paper flu ${a.kind} learner"><h1>${esc(a.title)}</h1><div class="hb-text">${lHtml}</div></article>`,
      `<div class="hb-fbar">
        <div class="hb-clock" id="hbClock">0:00</div>
        <button class="hs-btn big" id="hbStart">▶ Start</button><button class="hs-btn ghost" id="hbReset" title="Start over">↺</button>
        <span class="spacer"></span><button class="hs-btn big done" id="hbDone">⏹ Done</button>
        <div class="hb-fbar2"><button class="hs-btn ghost sm" id="hbModel" title="The laptop reads the passage aloud while the words light up">🔊 Model reading</button>
        <label class="hb-pace"><input type="checkbox" id="hbPace" ${pace ? 'checked' : ''}> 🐢 Pace <input type="range" id="hbPw" min="60" max="200" step="10" value="${wpmT}"><b id="hbPwv">${wpmT}</b> wpm</label></div>
      </div>
      <div class="hb-mis" id="hbMis"><span class="hb-mis-t">Miscue type, then tap the word:</span>${MIS.map(([k, t]) => `<button data-k="${k}" class="${k === active ? 'on' : ''}" title="${t}"><b>${k}</b>${t}<i data-c="${k}">0</i></button>`).join('')}</div>
      <article class="hb-paper flu ${a.kind} teacher"><div class="hb-kicker">${esc(a.label)} · ${a.kind === 'poem' ? 'Poem' : 'Story'} · ${a.wc} words</div><h1>${esc(a.title)}</h1><div class="hb-text" id="hbText">${tHtml}</div></article>
      <div id="hbRes"></div>`, 'Teacher · tap the words the learner misses');
    splitWire(st.body, () => { const keep = {...marks}; draw(); Object.assign(marks, keep); restore(); });
    wire(); };
  let W = [], WL = [], clock;
  const hl = (cls, j) => { [W, WL].forEach(A => A.forEach((w, k) => w.classList.toggle(cls, k === j))); const t = WL[j] || W[j]; if(t) t.scrollIntoView({block: 'nearest', behavior: 'smooth'}); };
  const secs = () => (acc + (running ? (Date.now() - t0) : 0)) / 1000;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const tick = () => { if(clock) clock.textContent = fmt(secs()); };
  const counts = () => { MIS.forEach(([k]) => { const e = $(`[data-c="${k}"]`, st.body); if(e) e.textContent = Object.values(marks).filter(x => x === k).length; }); };
  const restore = () => { Object.entries(marks).forEach(([j, k]) => { const w = W[+j]; if(w){ w.className = 'hb-w mk'; w.dataset.m = k; } }); counts(); tick(); if(running) $('#hbStart', st.body).textContent = '⏸ Pause'; };
  const startPace = () => { clearInterval(paceT); if(!pace) return; paceT = setInterval(() => { hl('pace', paceI); paceI++; if(paceI > W.length) clearInterval(paceT); }, 60000 / wpmT); };
  const go = () => { t0 = Date.now(); running = true; timer = setInterval(tick, 250); $('#hbStart', st.body).textContent = '⏸ Pause'; st.s.classList.add('reading'); startPace(); };
  const start = () => { if(running){ acc += Date.now() - t0; running = false; clearInterval(timer); clearInterval(paceT); $('#hbStart', st.body).textContent = '▶ Resume'; return; }
    const lp = $('.hb-learner', st.body); if(!acc && lp) countdown(lp, go); else go(); };
  const reset = () => { running = false; acc = 0; clearInterval(timer); clearInterval(paceT); paceI = 0; Object.keys(marks).forEach(k => delete marks[k]); draw(); };
  st.s._stop = () => { clearInterval(timer); clearInterval(paceT); };
  const wire = () => { W = $$('.hb-teacher .hb-w', st.body); WL = $$('.hb-learner .hb-w', st.body); clock = $('#hbClock', st.body); tick();
    $('#hbStart', st.body).onclick = start; $('#hbReset', st.body).onclick = reset;
    $$('#hbMis button', st.body).forEach(b => b.onclick = () => { active = b.dataset.k; $$('#hbMis button', st.body).forEach(x => x.classList.toggle('on', x === b)); });
    W.forEach(w => w.onclick = () => { const j = w.dataset.i; if(marks[j] === active){ delete marks[j]; w.className = 'hb-w'; delete w.dataset.m; } else { marks[j] = active; w.className = 'hb-w mk'; w.dataset.m = active; } counts(); });
    $('#hbPace', st.body).onchange = (e) => { pace = e.target.checked; paceI = 0; [W, WL].forEach(A => A.forEach(w => w.classList.remove('pace'))); if(running) startPace(); };
    $('#hbPw', st.body).oninput = (e) => { wpmT = +e.target.value; u.paceWpm = wpmT; $('#hbPwv', st.body).textContent = wpmT; if(running && pace) startPace(); };
    $('#hbModel', st.body).onclick = (e) => { if(modelOn){ TTS.stop(); modelOn = false; e.target.textContent = '🔊 Model reading'; hl('say', -1); return; }
      if(!TTS.ok()) return M.toast('This browser cannot read aloud');
      const starts = []; let p = 0; words.forEach(w => { starts.push(p); p += w.length + 1; });
      modelOn = true; e.target.textContent = '⏸ Stop';
      TTS.speak(words.join(' '), {rate: 0.9, onWord: (ci) => { let j = starts.length - 1; while(j > 0 && starts[j] > ci) j--; hl('say', j); },
        onEnd: () => { modelOn = false; const b = $('#hbModel', st.body); if(b) b.textContent = '🔊 Model reading'; hl('say', -1); }}); };
    $('#hbDone', st.body).onclick = () => { if(running) start(); results(Math.round(secs())); };
  };
  st.s.onKey = (e) => { if(e.key === ' ' && e.target === document.body){ e.preventDefault(); start(); } };
  const results = (s) => { st.s.classList.remove('reading');
    const box = $('#hbRes', st.body); let read = a.wc;
    const lp = $('.hb-learner', st.body);
    const rdraw = () => { const mis = Object.keys(marks).length; const pct = Math.max(0, Math.round((a.wc - mis) / a.wc * 1000) / 10); const lvl = levelOf(pct); const wpm = s ? Math.round(read * 60 / s) : 0;
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
      $('#hbRead', box).onchange = (e) => { read = Math.max(1, Math.min(a.wc, +e.target.value || a.wc)); rdraw(); };
      $('#hbRx', box).onclick = () => { box.innerHTML = ''; };
      saveBox(c, $('#hbSave', box), a.id, {pct, wpm, mis, secs: s, read, lvl, ts: Date.now(), marks: Object.entries(marks).map(([k, v]) => k + v).join(',')}, null, true);
      $('#hbAgain', box).onclick = () => playL4(c, idx); $('#hbList', box).onclick = () => closeStage(true);
      if($('#hbNextA', box)) $('#hbNextA', box).onclick = () => playL4(c, idx + 1); };
    rdraw(); if(lp){ const g = document.createElement('div'); g.className = 'hb-wd'; g.innerHTML = `<b>Well done!</b><span>You finished reading.</span>`; lp.appendChild(g); if(Object.keys(marks).length / a.wc <= .03) confetti(lp); }
    box.scrollIntoView({behavior: 'smooth'}); };
  draw();
}

/* =========================== hub views =========================== */
const BACK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

M.views.readingHub = function view(el){
  const c = M.cls(); const u = ui();
  if(!M.HUB_L6 || !M.HUB_L4 || !M.HUB_L3 || !M.HUB_L5 || !M.HUB_L7){ el.innerHTML = `<div class="card"><div class="empty">Opening the BULIG Hub…</div></div>`; loadData().then(() => view(el)).catch(() => { el.innerHTML = `<div class="card"><div class="empty">Could not load the BULIG modules. Reload MASTRO and try again.</div></div>`; }); return; }
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
  if(M._hub.homes[mod.k]) return M._hub.homes[mod.k](main, c, el);
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

/* ---------- progress (v6.24): tap a cell to type or fix a result · enter a whole activity at once · assessor filter · reports ---------- */
const LVL_S = {Independent:'Ind', Instructional:'Ins', Frustration:'Fru'};
const mmss = (s) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';
const secsOf = (t) => { t = String(t || '').trim(); if(!t) return null; const m = t.match(/^(\d+)\s*[:.]\s*(\d{1,2})$/); if(m) return +m[1] * 60 + +m[2]; const n = parseFloat(t); return isFinite(n) && n > 0 ? Math.round(n) : null; };
const dIso = (ts) => { const d = new Date(ts || Date.now()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fDate = (ts) => ts ? new Date(ts).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : '';
const maxOf = (c, a) => { const R = (c.hub || {}).r || {}; for(const x of Object.values(R)){ const y = x[a.id]; if(y && y.best && y.best.max) return y.best.max; } return a.q ? a.q.length : ''; };
// a typed L4 record: accuracy from miscues, speed from time (or typed wpm)
function l4Rec(a, mis, secs, wpm, date){ mis = Math.max(0, Math.round(+mis || 0)); const pct = Math.max(0, Math.round((a.wc - mis) / a.wc * 1000) / 10);
  const w = wpm != null && wpm !== '' && +wpm > 0 ? Math.round(+wpm) : secs ? Math.round(a.wc * 60 / secs) : 0;
  return {pct, wpm: w, mis, secs: secs || (w ? Math.round(a.wc * 60 / w) : 0), read: a.wc, lvl: levelOf(pct), ts: date ? new Date(date + 'T12:00:00').getTime() : Date.now(), manual: true}; }
function scoreRec(score, max, date){ score = +score; max = +max; const pct = max ? Math.round(score / max * 100) : 0; return {score, max, pct, ts: date ? new Date(date + 'T12:00:00').getTime() : Date.now(), manual: true}; }
// a typed result becomes the learner's result for that activity (it replaces the best, the old one stays in the history)
function putRes(c, lid, id, rec){ const h = store(c); const r = h.r[lid] = h.r[lid] || {}; const o = r[id] = r[id] || {n: 0, hist: []};
  o.n = (o.n || 0) + 1; o.ts = Date.now(); o.hist = [rec, ...(o.hist || [])].slice(0, 10); o.best = rec; o.last = rec; }
function delRes(c, lid, id){ const r = (store(c).r || {})[lid]; if(r){ delete r[id]; if(!Object.keys(r).length) delete store(c).r[lid]; } }
const pf = () => ui().pf || 'all';
const asr = (c, l) => M.readAssessor ? M.readAssessor(c, l) : '';
const filtered = (c, L) => { const f = pf(); return L.filter(l => f === 'all' || (f === 'other' ? asr(c, l) : !asr(c, l))); };
const cellTxt = (x, kind) => !x ? '' : kind !== 'L4' ? `${x.best.score}/${x.best.max}` : `${x.best.wpm} wpm · ${x.best.pct}% ${LVL_S[x.best.lvl] || ''}${x.best.mis != null ? ` · ${x.best.mis} mis.` : ''}`;

function progress(box, c, A, kind, colFn){ const L0 = M.readLearners ? M.readLearners(c) : c.learners; const R = (c.hub || {}).r || {}; const u = ui();
  const col = colFn || ((a, i) => kind === 'L6' ? (i === 0 ? 'Pre' : i === A.length - 1 ? 'Post' : String(i)) : (/Pre/.test(a.label) ? 'Pre' : /Post-assessment A/.test(a.label) ? 'Post A' : /Post-assessment B/.test(a.label) ? 'Post B' : a.label.replace('Activity ', '')));
  const L = filtered(c, L0); const nOther = L0.filter(l => asr(c, l)).length;
  const cell = (l, a) => { const x = (R[l.id] || {})[a.id]; const at = `data-l="${l.id}" data-a="${a.id}"`;
    return !x ? `<td class="e ed" ${at} title="Tap to type a result">·</td>` : kind !== 'L4' ? `<td class="s${stars(x.best.pct)} ed ${x.best.manual ? 'man' : ''}" ${at} title="${x.n} attempt(s)${x.best.manual ? ' · typed' : ''} · tap to edit">${x.best.score}/${x.best.max}</td>`
      : `<td class="lv-${x.best.lvl} ed ${x.best.manual ? 'man' : ''}" ${at} title="${x.best.pct}% · ${x.best.wpm} wpm · ${x.best.mis ?? '?'} miscue(s)${x.best.secs ? ' · ' + mmss(x.best.secs) : ''} · ${x.n} attempt(s)${x.best.manual ? ' · typed' : ''} · tap to edit">${x.best.wpm}<small>${x.best.pct}%${x.best.mis != null ? ` · ${x.best.mis}m` : ''}</small></td>`; };
  const any = L.some(l => R[l.id] && A.some(a => R[l.id][a.id]));
  box.innerHTML = `<div class="card hb-progc"><div class="row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><b>${kind !== 'L4' ? 'Best score per activity' : 'Reading speed (wpm), oral reading score and miscues per passage'}</b><span class="spacer"></span>
      <div class="seg" id="hbPf">${[['all', 'All'], ['mine', 'My learners'], ['other', `Other assessors${nOther ? ' (' + nOther + ')' : ''}`]].map(([k, t]) => `<button data-f="${k}" class="${pf() === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <button class="btn sm" id="hbAs">👩‍🏫 Assessors</button><button class="btn sm primary" id="hbEnter">✎ Enter results</button><button class="btn sm" id="hbRep">📄 Reports</button><button class="btn sm" id="hbCsv">⬇ CSV</button></div>
    <div class="tiny muted" style="margin-bottom:8px">${any ? 'Tap any cell to type, fix or delete a result. Typed results are marked with a dot.' : 'No results yet — play an activity with a learner, or use <b>✎ Enter results</b> to type results you recorded on paper.'}</div>
    <div class="hb-tw"><table class="hb-pt"><thead><tr><th class="l">Learner</th>${A.map((a, i) => `<th title="${esc(a.title)}">${col(a, i)}</th>`).join('')}</tr></thead><tbody>
    ${[['M','MALE'],['F','FEMALE']].map(([sx, t]) => { const arr = L.filter(l => sx === 'M' ? l.sex === 'M' : l.sex !== 'M'); return arr.length ? `<tr class="sx"><td colspan="${A.length + 1}">${t}</td></tr>` + arr.map(l => `<tr><td class="l">${esc(l.name)}${M.readTagChip ? M.readTagChip(c, l) : ''}${M.readAssessorChip ? M.readAssessorChip(c, l) : ''}</td>${A.map(a => cell(l, a)).join('')}</tr>`).join('') : ''; }).join('') || `<tr><td colspan="${A.length + 1}" class="muted" style="padding:14px">No learners in this view.</td></tr>`}</tbody></table></div>
    ${kind === 'L4' ? '<div class="tiny muted" style="margin-top:8px">Big number = words per minute · small = oral reading score and miscues (m). Colour = level: green Independent (97–100%), amber Instructional (90–96%), red Frustration (89% and below).</div>' : ''}</div>`;
  const rr = () => progress(box, c, A, kind, colFn);
  $$('#hbPf button', box).forEach(b => b.onclick = () => { u.pf = b.dataset.f; M.save(); rr(); });
  $('#hbAs', box).onclick = () => M.readAssessorEditor ? M.readAssessorEditor(c, rr) : null;
  $('#hbEnter', box).onclick = () => entry(c, A, kind, col, rr);
  $('#hbRep', box).onclick = () => reportMenu(c, A, kind, col);
  $$('td.ed', box).forEach(td => td.onclick = () => editCell(c, A.find(a => a.id === td.dataset.a), kind, learnerById(c, td.dataset.l), A.findIndex(a => a.id === td.dataset.a), col, rr));
  $('#hbCsv', box).onclick = () => { const rows = [['Learner', 'Sex', 'Assessor', ...A.map((a, i) => col(a, i) + ' ' + a.title)]];
    L.forEach(l => rows.push([l.name, l.sex, asr(c, l), ...A.map(a => cellTxt((R[l.id] || {})[a.id], kind))]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], {type: 'text/csv'})); a.download = `BULIG Hub Level ${kind.slice(1)} - ${M.className(c)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
}

// fields for one result (shared by the cell editor and the whole-activity entry)
const l4Fields = (x, pre) => `<input class="input" type="number" min="0" data-k="mis" value="${x && x.mis != null ? x.mis : ''}" placeholder="0" ${pre || ''}><input class="input" data-k="time" value="${x && x.secs ? mmss(x.secs) : ''}" placeholder="m:ss" ${pre || ''}><input class="input" type="number" min="0" data-k="wpm" value="${x && x.wpm ? x.wpm : ''}" placeholder="auto" ${pre || ''}>`;
function readL4(row, a, date){ const v = (k) => ($(`[data-k="${k}"]`, row) || {}).value; const mis = v('mis'), t = v('time'), w = v('wpm');
  if(mis === '' && !t && !w) return null; if(mis === '') return 'mis'; const secs = secsOf(t); if(t && !secs) return 'time';
  if(!secs && !(+w > 0)) return 'speed'; return l4Rec(a, mis, secs, w, date); }
function readScore(row, date){ const v = (k) => ($(`[data-k="${k}"]`, row) || {}).value; const sc = v('score'), mx = v('max');
  if(sc === '') return null; if(!(+mx > 0)) return 'max'; if(+sc < 0 || +sc > +mx) return 'score'; return scoreRec(sc, mx, date); }
const ERR = {mis: 'Type the number of miscues (0 if none)', time: 'Type the reading time as m:ss (for example 1:25)', speed: 'Type the reading time or the words per minute', max: 'Type the total score (out of how many)', score: 'The score cannot be more than the total'};
const preview4 = (row, a) => { const r = readL4(row, a); const o = $('[data-o]', row); if(!o) return; o.innerHTML = r && typeof r === 'object' ? `<span class="lv-${r.lvl}">${r.pct}% ${esc(r.lvl)}</span>${r.wpm ? ` · ${r.wpm} wpm` : ''}` : ''; };

function editCell(c, a, kind, l, i, col, rr){ if(!a || !l) return; const x = resOf(c, l.id, a.id); const b0 = x && x.best;
  M.modal(`${l.name} · ${col(a, i)}`, `<div class="small muted" style="margin:-4px 0 12px">${esc(a.label)} · <b>${esc(a.title)}</b>${a.wc ? ` · ${a.wc} words` : ''}${x ? ` · ${x.n} attempt(s)` : ''}${b0 && b0.manual ? ' · typed result' : ''}</div>
    <div id="hbE" class="hb-ent1">${kind === 'L4' ? `<div class="hb-ef"><label>Miscues</label><label>Reading time</label><label>Words / min</label>${l4Fields(b0)}</div><div class="small" data-o style="margin-top:8px"></div>
      <div class="tiny muted" style="margin-top:6px">Score = (${a.wc} − miscues) ÷ ${a.wc} × 100. Give the reading time <i>or</i> the words per minute — the other is worked out.</div>`
      : `<div class="hb-ef sc"><label>Score</label><label>Out of</label><input class="input" type="number" min="0" data-k="score" value="${b0 ? b0.score : ''}"><input class="input" type="number" min="1" data-k="max" value="${b0 ? b0.max : maxOf(c, a)}"></div>`}
      <label class="field" style="margin-top:10px;max-width:200px">Date<input class="input" type="date" id="hbEd" value="${dIso(b0 && b0.ts)}"></label></div>
    ${x && x.hist && x.hist.length > 1 ? `<details style="margin-top:10px"><summary class="small">Earlier attempts (${x.hist.length})</summary><div class="tiny" style="margin-top:6px">${x.hist.map(h => `<div>${fDate(h.ts)} · ${kind === 'L4' ? `${h.wpm} wpm · ${h.pct}% ${esc(h.lvl)} · ${h.mis ?? '?'} miscue(s)` : `${h.score}/${h.max}`}${h.manual ? ' · typed' : ''}</div>`).join('')}</div></details>` : ''}
    <div class="row" style="margin-top:14px">${x ? '<button class="btn danger" id="hbEx">Delete result</button>' : ''}<span class="spacer"></span><button class="btn" id="hbEc">Cancel</button><button class="btn primary" id="hbEs">Save</button></div>`, b => {
    const row = $('#hbE', b); if(kind === 'L4'){ $$('input', row).forEach(e => e.oninput = () => preview4(row, a)); preview4(row, a); }
    $('#hbEc', b).onclick = M.closeModal;
    if($('#hbEx', b)) $('#hbEx', b).onclick = () => { if(!confirm(`Delete ${l.name}'s result for ${a.title}?`)) return; delRes(c, l.id, a.id); M.save(); M.closeModal(); M.toast('Result deleted'); rr(); };
    $('#hbEs', b).onclick = () => { const dt = $('#hbEd', b).value; const r = kind === 'L4' ? readL4(row, a, dt) : readScore(row, dt);
      if(!r) return M.toast(kind === 'L4' ? 'Type the miscues and the reading time or speed' : 'Type the score');
      if(typeof r === 'string') return M.toast(ERR[r]);
      putRes(c, l.id, a.id, r); M.save(); M.closeModal(); M.toast(`Saved for ${l.name}`); rr(); };
  }); }

// type one activity's results for the whole list (catching up from paper records)
function entry(c, A, kind, col, rr, aid){ const u = ui(); const L = filtered(c, M.readLearners ? M.readLearners(c) : c.learners);
  const a = A.find(x => x.id === (aid || u.entA)) || A[0]; u.entA = a.id; const i = A.indexOf(a);
  const row = (l) => { const x = resOf(c, l.id, a.id); const b0 = x && x.best;
    return `<div class="hb-er" data-l="${l.id}"><span class="nm">${esc(l.name)}${M.readAssessorChip ? M.readAssessorChip(c, l) : ''}${b0 ? ` <i class="tiny muted">· saved ${kind === 'L4' ? `${b0.wpm} wpm ${b0.pct}%` : `${b0.score}/${b0.max}`}</i>` : ''}</span>
      ${kind === 'L4' ? `${l4Fields(b0)}<span class="o" data-o></span>` : `<input class="input" type="number" min="0" data-k="score" value="${b0 ? b0.score : ''}"><input class="input" type="number" min="1" data-k="max" value="${b0 ? b0.max : maxOf(c, a)}">`}</div>`; };
  M.modal(`Enter results · Level ${kind.slice(1)}`, `<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
      <label class="field" style="min-width:260px;flex:1">Activity<select class="input" id="hbEa">${A.map((x, j) => `<option value="${x.id}" ${x === a ? 'selected' : ''}>${esc(col(x, j))} · ${esc(x.title)}</option>`).join('')}</select></label>
      <label class="field" style="width:170px">Date assessed<input class="input" type="date" id="hbEd" value="${dIso()}"></label></div>
    <div class="tiny muted" style="margin-bottom:8px">${kind === 'L4' ? `${a.wc} words. Type the <b>miscues</b> and the <b>reading time</b> (m:ss) — or the <b>words per minute</b> if that is what you recorded. Leave a row blank to skip it; rows you change replace the saved result.` : 'Type the score and the total. Leave a row blank to skip it; rows you change replace the saved result.'} Showing: <b>${pf() === 'all' ? 'all learners' : pf() === 'mine' ? 'my learners' : 'learners with other assessors'}</b> (change it with the filter on the progress page).</div>
    <div class="hb-elist ${kind === 'L4' ? 'l4' : 'sc'}"><div class="hb-er h"><span class="nm">Learner</span>${kind === 'L4' ? '<span>Miscues</span><span>Time</span><span>WPM</span><span class="o">Result</span>' : '<span>Score</span><span>Out of</span>'}</div>
      ${[['M','MALE'],['F','FEMALE']].map(([sx, t]) => { const arr = L.filter(l => sx === 'M' ? l.sex === 'M' : l.sex !== 'M'); return arr.length ? `<div class="hb-eg">${t}</div>` + arr.map(row).join('') : ''; }).join('')}</div>
    <div class="row" style="margin-top:12px"><span class="small muted" id="hbEn"></span><span class="spacer"></span><button class="btn" id="hbEc">Close</button><button class="btn primary" id="hbEs">Save results</button></div>`, b => {
    const changed = new Set();
    $$('.hb-er[data-l]', b).forEach(r => $$('input', r).forEach(e => e.oninput = () => { changed.add(r.dataset.l); if(kind === 'L4') preview4(r, a); $('#hbEn', b).textContent = `${changed.size} row(s) changed`; }));
    if(kind === 'L4') $$('.hb-er[data-l]', b).forEach(r => preview4(r, a));
    $('#hbEa', b).onchange = (e) => { if(changed.size && !confirm('Leave without saving the rows you typed?')) { e.target.value = a.id; return; } M.closeModal(); entry(c, A, kind, col, rr, e.target.value); };
    $('#hbEc', b).onclick = () => { if(changed.size && !confirm('Close without saving the rows you typed?')) return; M.closeModal(); rr(); };
    $('#hbEs', b).onclick = () => { const dt = $('#hbEd', b).value; let n = 0, bad = null;
      const recs = [...changed].map(lid => { const r = $(`.hb-er[data-l="${lid}"]`, b); const x = kind === 'L4' ? readL4(r, a, dt) : readScore(r, dt); if(typeof x === 'string' && !bad){ bad = [r, x]; } return [lid, x]; });
      if(bad){ bad[0].classList.add('bad'); bad[0].scrollIntoView({block: 'center'}); return M.toast(`${learnerById(c, bad[0].dataset.l).name}: ${ERR[bad[1]]}`); }
      recs.forEach(([lid, x]) => { if(x && typeof x === 'object'){ putRes(c, lid, a.id, x); n++; } });
      M.save(); changed.clear(); M.toast(n ? `${n} result(s) saved for ${a.title}` : 'Nothing to save'); M.closeModal(); rr(); };
  }, true); }

/* ---------- progress reports: class summary, one learner, or every learner — view, print, PDF, Excel ---------- */
function reportMenu(c, A, kind, col){ const L = M.readLearners ? M.readLearners(c) : c.learners; const MOD = MODS.find(m => m.k === kind);
  M.modal(`Progress reports · Level ${MOD.n} · ${MOD.t}`, `<div class="list">
    <div class="item" style="gap:12px;align-items:center"><div class="grow"><div class="title">Class progress summary</div><div class="tiny muted">Every learner × every ${kind === 'L4' ? 'passage: words per minute, oral reading score, level and miscues' : 'activity: best score'}. A4 landscape. Uses the filter on the progress page (all / my learners / other assessors).</div></div><button class="btn sm primary" id="rpC">👁 View</button></div>
    <div class="item" style="gap:12px;align-items:center"><div class="grow"><div class="title">Learner progress report</div><div class="tiny muted">One learner: each ${kind === 'L4' ? 'passage with date, miscues, time, speed, score and level' : 'activity with date, attempts and score'}, plus a summary.</div>
      <select class="input" id="rpL" style="margin-top:6px;max-width:340px">${L.map(l => `<option value="${l.id}" ${l.id === ui().who ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div><button class="btn sm primary" id="rpO">👁 View</button></div>
    <div class="item" style="gap:12px;align-items:center"><div class="grow"><div class="title">Every learner's progress report</div><div class="tiny muted">One page per learner who has results (same filter as the progress page).</div></div><button class="btn sm primary" id="rpA">👁 View</button></div></div>
    <div class="tiny muted" style="margin-top:10px">The viewer has Print, Download PDF and Excel buttons.</div>`, b => {
    const title = (t) => `BULIG Hub ${t} · Level ${MOD.n} ${MOD.t}`;
    $('#rpC', b).onclick = () => { M.closeModal(); M.rdPreview(title('Class Progress'), [classPage(c, A, kind, col)], true); };
    $('#rpO', b).onclick = () => { const l = learnerById(c, $('#rpL', b).value); M.closeModal(); M.rdPreview(`${title('Learner Progress')} · ${l.name}`, [learnerPage(c, A, kind, col, l)], false); };
    $('#rpA', b).onclick = () => { const R = (c.hub || {}).r || {}; const arr = filtered(c, L).filter(l => R[l.id] && A.some(a => R[l.id][a.id])); if(!arr.length) return M.toast('No learner has results yet');
      M.closeModal(); M.rdPreview(title('Learner Progress Reports'), arr.map(l => learnerPage(c, A, kind, col, l)), false); };
  }); }
const repHead = (c, title, sub) => M.printHeader(title) + `<table class="rd-info"><tr><td>Grade &amp; section</td><td><b>${esc(M.className(c))}</b></td><td>Adviser</td><td><b>${esc(c.adviser || '')}</b></td></tr>
  <tr><td>Module</td><td><b>${esc(sub)}</b></td><td>Date printed</td><td><b>${fDate(Date.now())}</b></td></tr></table>`;
function classPage(c, A, kind, col){ const R = (c.hub || {}).r || {}; const L = filtered(c, M.readLearners ? M.readLearners(c) : c.learners); const MOD = MODS.find(m => m.k === kind);
  const asCol = L.some(l => asr(c, l));
  const td = (x) => !x ? '<td></td>' : kind !== 'L4' ? `<td>${x.best.score}/${x.best.max}</td>` : `<td class="hbr-${x.best.lvl}"><b>${x.best.wpm}</b><br><span class="sm">${x.best.pct}% ${LVL_S[x.best.lvl] || ''}${x.best.mis != null ? '<br>' + x.best.mis + ' mis.' : ''}</span></td>`;
  const done = (l) => A.filter(a => (R[l.id] || {})[a.id]).length;
  return `<div class="rdp">${repHead(c, 'BULIG HUB · CLASS PROGRESS REPORT', `Level ${MOD.n} · ${MOD.t}${pf() === 'mine' ? ' · my learners' : pf() === 'other' ? ' · learners with other assessors' : ''}`)}
    <table class="rd-t hbr"><thead><tr><th>No.</th><th class="l">Name of learner</th>${asCol ? '<th>Assessor</th>' : ''}${A.map((a, i) => `<th>${esc(col(a, i))}</th>`).join('')}<th>Done</th></tr></thead><tbody>
    ${[['M','MALE'],['F','FEMALE']].map(([sx, t]) => { const arr = L.filter(l => sx === 'M' ? l.sex === 'M' : l.sex !== 'M'); return arr.length ? `<tr class="grp"><td></td><td class="l" colspan="${A.length + (asCol ? 3 : 2)}"><b>${t}</b></td></tr>` + arr.map((l, j) => `<tr><td>${j + 1}</td><td class="l">${esc(l.name)}${M.readTag && M.readTag(c, l) ? ` (${esc(M.readTag(c, l).replace('TO', 'T/O').replace('TI', 'T/I'))})` : ''}</td>${asCol ? `<td class="sm">${esc(asr(c, l))}</td>` : ''}${A.map(a => td((R[l.id] || {})[a.id])).join('')}<td>${done(l)}/${A.length}</td></tr>`).join('') : ''; }).join('')}</tbody></table>
    <div class="rd-legend"><i>${kind === 'L4' ? 'Big number = words per minute · oral reading score (Ind = Independent 97–100%, Ins = Instructional 90–96%, Fru = Frustration 89% and below) · mis. = miscues' : 'Best score per activity'}. Columns: ${A.map((a, i) => `${esc(col(a, i))} ${esc(a.title)}`).join(' · ')}</i></div>${M.printSign(c, 'Prepared by:', 'Noted by:')}</div>`; }
function learnerPage(c, A, kind, col, l){ const R = (c.hub || {}).r || {}; const r = R[l.id] || {}; const MOD = MODS.find(m => m.k === kind);
  const got = A.filter(a => r[a.id]); const B = got.map(a => r[a.id].best);
  const avg = (k) => B.length ? Math.round(B.reduce((s, x) => s + (+x[k] || 0), 0) / B.length * 10) / 10 : '';
  const first = got.length ? r[got[0].id].best : null, last = got.length ? r[got[got.length - 1].id].best : null;
  const sum = kind === 'L4' ? `<table class="rd-info"><tr><td>Passages read</td><td><b>${got.length} of ${A.length}</b></td><td>Average speed</td><td><b>${avg('wpm')} wpm</b></td></tr><tr><td>Average oral reading score</td><td><b>${avg('pct')}%</b></td><td>First → latest passage</td><td><b>${first ? `${first.wpm} wpm, ${first.pct}% → ${last.wpm} wpm, ${last.pct}% (${esc(last.lvl)})` : ''}</b></td></tr></table>`
    : `<table class="rd-info"><tr><td>Activities done</td><td><b>${got.length} of ${A.length}</b></td><td>Average score</td><td><b>${avg('pct')}%</b></td></tr></table>`;
  return `<div class="rdp">${repHead(c, 'BULIG HUB · LEARNER PROGRESS REPORT', `Level ${MOD.n} · ${MOD.t}`)}
    <table class="rd-info"><tr><td>Learner</td><td><b>${esc(l.name)}</b>${M.readTag && M.readTag(c, l) ? ` (${esc(M.readTag(c, l))})` : ''}</td><td>Teacher-assessor</td><td><b>${esc(asr(c, l) || c.adviser || '')}</b></td></tr></table>${sum}
    <table class="rd-t"><thead><tr><th>No.</th><th class="l">Activity</th><th>Date</th>${kind === 'L4' ? '<th>Miscues</th><th>Time</th><th>Words / min</th><th>Score</th><th>Level</th>' : '<th>Score</th><th>%</th>'}<th>Attempts</th></tr></thead><tbody>
    ${A.map((a, i) => { const x = r[a.id]; const b0 = x && x.best; return `<tr><td>${esc(col(a, i))}</td><td class="l">${esc(a.title)}</td><td>${b0 ? fDate(b0.ts) : ''}</td>${kind === 'L4' ? `<td>${b0 && b0.mis != null ? b0.mis : ''}</td><td>${b0 ? mmss(b0.secs) : ''}</td><td>${b0 ? b0.wpm : ''}</td><td>${b0 ? b0.pct + '%' : ''}</td><td class="${b0 ? 'hbr-' + b0.lvl : ''}">${b0 ? esc(b0.lvl) : ''}</td>` : `<td>${b0 ? `${b0.score}/${b0.max}` : ''}</td><td>${b0 ? b0.pct + '%' : ''}</td>`}<td>${x ? x.n : ''}</td></tr>`; }).join('')}</tbody></table>
    ${M.printSign(c, 'Prepared by:', 'Noted by:')}</div>`; }

function keys(box, c, A, g, el){ const K = M.S.hubKeys = M.S.hubKeys || {};
  const flagged = A.filter(a => a.keyBy || a.keyNote).length;
  box.innerHTML = `<div class="card"><div class="small" style="margin-bottom:10px">${flagged ? `<b>Please check:</b> ${A.some(a => a.keyBy) ? 'the Grade ' + g + ' module has no answer key, so Claude wrote these answers from the selections.' : ''} ${A.filter(a => a.keyNote).map(a => esc(a.label + ': ' + a.keyNote)).join(' ')} Change any answer below — your choice is used in the Hub from then on.` : 'These are the answer keys printed in the module. Change any answer below if you find a mistake — your choice is used in the Hub from then on.'}</div>
    <div class="hb-keys">${A.map(a => { const k = keyOf(a); const mine = !!K[a.id]; return `<div class="hb-key ${a.keyBy ? 'chk' : ''}"><div class="hb-key-h"><b>${esc(a.label)}</b><span>${esc(a.title)}</span>${mine ? `<button class="btn sm" data-reset="${a.id}">Reset to module key</button>` : ''}</div>
      <div class="hb-key-r">${a.q.map((q, j) => `<label title="${esc(q[0])}"><i>${j + 1}</i><select data-a="${a.id}" data-j="${j}">${'ABCD'.split('').map(L => `<option ${L === k[j] ? 'selected' : ''}>${L}</option>`).join('')}</select></label>`).join('')}</div></div>`; }).join('')}</div></div>`;
  $$('select[data-a]', box).forEach(s => s.onchange = () => { const a = A.find(x => x.id === s.dataset.a); const k = K[a.id] = keyOf(a).slice(); k[+s.dataset.j] = s.value; M.save(); M.toast('Answer key updated'); M.views.readingHub(el); });
  $$('[data-reset]', box).forEach(b => b.onclick = () => { delete K[b.dataset.reset]; M.save(); M.views.readingHub(el); });
}

M.hubClose = closeStage;
M._hub = {ui, store, resOf, keyOf, learnerById, stars, starHtml, TTS, confetti, chime, stage, closeStage, whoPicker, saveBox, saveRes, splitWrap, splitWire, wordsHtml, countdown, playQuiz, progress, tabsHtml, SKILL_C, homes: {}};
})();
