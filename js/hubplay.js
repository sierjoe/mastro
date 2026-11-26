/* MASTRO — BULIG Hub · activity engine (v6.22)
   playTask(): one activity made of steps (listen, vocabulary cards, multiple choice, word bank, matching, word search,
   crossword, unscramble, build-a-word, odd word out, word sort, flash reading, writing, drawing, on-air reading …).
   Every step has a LEARNER side (clean, big, nothing to grade) and a TEACHER side (key, live answers, marking).
   Levels 3, 5 and 7 are built from it; Level 4 and Level 6 have their own players in bulighub.js. */
(function(){
const M = window.M; const {$, $$, esc} = M; const H = M._hub;
const {ui, TTS, confetti, chime, stage, closeStage, saveBox, splitWrap, splitWire, learnerById, stars, starHtml} = H;
const shuffle = (a, seed) => { a = a.slice(); let s = seed || Math.floor(Math.random() * 1e9); const r = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const say = (t, rate) => { if(TTS.ok()) TTS.speak(t, {rate: rate || .85}); else M.toast('This browser cannot read aloud'); };
const L3E = {bat:'🦇',cat:'🐱',fan:'🪭',map:'🗺️',hat:'🎩',van:'🚐',bag:'👜',jam:'🍓',cab:'🚕',man:'👨',rag:'🧽',tap:'🚰',mat:'🧘',lap:'🦵',
  net:'🥅',ten:'🔟',pen:'🖊️',hen:'🐔',bed:'🛏️',jet:'✈️',leg:'🦵',web:'🕸️',vet:'🩺',wet:'💧',red:'🟥',egg:'🥚',men:'👬',
  zip:'🤐',bin:'🗑️',pig:'🐷',pin:'📌',lip:'👄',kid:'🧒',lid:'🫙',six:'6️⃣',fig:'🫐',hip:'🕺',sit:'🪑',dig:'⛏️',wig:'💇',fin:'🦈',
  dog:'🐶',jog:'🏃',log:'🪵',mop:'🧹',pot:'🍲',box:'📦',fox:'🦊',top:'🔝',hop:'🐇',cot:'🛏️',dot:'⚫',mom:'👩',rod:'🎣',
  mug:'☕',bun:'🍞',bug:'🐛',sun:'☀️',bus:'🚌',cup:'🥤',nut:'🥜',run:'🏃',gum:'🍬',tub:'🛁',cub:'🐻',rug:'🧶',hug:'🤗',
  nail:'💅',rain:'🌧️',tail:'🐒',pail:'🪣',hair:'💇',meal:'🍽️',meat:'🥩',seat:'💺',peak:'⛰️',hear:'👂',head:'🗣️',bait:'🪱',
  boat:'⛵',book:'📕',goat:'🐐',road:'🛣️',pool:'🏊',roof:'🏠',moon:'🌙',soap:'🧼',coat:'🧥',boot:'👢',food:'🍲',spoon:'🥄',foam:'🫧',
  pack:'🎒',back:'🔙',sack:'🛍️',deck:'🃏',neck:'🦒',black:'⬛',ball:'⚽',bell:'🔔',call:'📞',wall:'🧱',tall:'🦒',shell:'🐚',well:'⛲',small:'🐜',smell:'👃',
  mask:'🎭',pink:'🩷',tank:'🛢️',wink:'😉',flask:'⚗️',drink:'🥤',desk:'🪑',bank:'🏦',whisk:'🥣',trunk:'🐘',tusk:'🐘',link:'🔗',
  blue:'🔵',block:'🧱',blanket:'🛏️',bread:'🍞',brick:'🧱',broom:'🧹',brush:'🪥',bridge:'🌉',brown:'🟫',clock:'🕰️',crab:'🦀',crown:'👑',claw:'🦞',cry:'😢',
  drum:'🥁',dress:'👗',dragon:'🐉',drone:'🛸',drop:'💧',flag:'🚩',flower:'🌸',frog:'🐸',fruit:'🍎',globe:'🌍',glass:'🥛',glue:'🧴',grapes:'🍇',grass:'🌿',green:'🟩',
  plant:'🪴',plate:'🍽️',plane:'✈️',plum:'🍑',prize:'🏆',star:'⭐',stop:'🛑',stone:'🪨',stamp:'📮',straw:'🥤',string:'🧵',ship:'🚢',shoe:'👟',sheep:'🐑',slide:'🛝',sled:'🛷',sleep:'😴',
  spoon2:'🥄',spider:'🕷️',spring:'🌱',splash:'💦',tree:'🌳',train:'🚆',truck:'🚚',trumpet:'🎺'};

/* ================================================================ the task player ================================================================ */
function playTask(c, task, opt){
  const u = ui(); const who = u.who ? learnerById(c, u.who) : null;
  const st = stage(task.title, `${opt.sub}${who ? ' · ' + who.name : ' · Whole class'}`, (opt.theme || 'hs-l5') + ' hs-wide');
  const steps = task.steps; const R = steps.map(() => null); const D = steps.map(() => ({})); task._D = D; let s = 0; let LB, TB;
  const scoreOf = () => { let p = 0, m = 0; R.forEach((r, k) => { if(r && r.max){ p += r.pts; m += r.max; } else if(!r && STEP[steps[k].t].scored){ m += STEP[steps[k].t].max(steps[k]); } }); return [p, m]; };
  const frame = () => { st.body.innerHTML = splitWrap(`<div class="hb-steps" id="hbSn"></div><div id="hbL"></div>`, `<div id="hbT"></div>`, 'Teacher · key and marking', 'learner');
    splitWire(st.body, () => { frame(); show(); }); LB = $('#hbL', st.body); TB = $('#hbT', st.body); };
  const nav = () => { const n = $('#hbSn', st.body); if(!n) return;
    n.innerHTML = steps.map((x, k) => `<button data-s="${k}" class="${k === s ? 'cur' : ''} ${R[k] ? 'done' : ''}"><i>${k + 1}</i>${esc(x.label || STEP[x.t].label)}</button>`).join('') + `<button data-s="end" class="end ${s === steps.length ? 'cur' : ''}">★ Finish</button>`;
    $$('button', n).forEach(b => b.onclick = () => go(b.dataset.s === 'end' ? steps.length : +b.dataset.s)); };
  const ctx = (k) => ({ c, st, task, step: steps[k], d: D[k], res: R[k],
    report: (r) => { R[k] = r; nav(); teacher(); },
    teacher: () => teacher(),
    next: () => go(k + 1),
    learnerBox: () => LB });
  const teacher = () => { if(!TB) return; const [p, m] = scoreOf();
    TB.innerHTML = `<div class="hb-tp">
      <div class="hb-tp-k"><div><span>Step</span><b>${s < steps.length ? `${s + 1}/${steps.length}` : 'Finish'}</b></div><div><span>Score so far</span><b>${p}/${m}</b></div><div><span>Steps done</span><b>${R.filter(Boolean).length}/${steps.length}</b></div></div>
      ${task.ref ? `<details class="hb-tp-ref" ${steps[s] && steps[s].t === 'listen' ? 'open' : ''}><summary>${esc(task.refLabel || 'Text')}</summary>${task.ref.map(x => `<p>${esc(x)}</p>`).join('')}</details>` : ''}
      <div id="hbTs"></div>
      <div class="hb-tp-list">${steps.map((x, k) => `<div class="${k === s ? 'cur' : ''} ${R[k] ? 'ok' : ''}" data-s="${k}"><i>${k + 1}</i><span>${esc(x.label || STEP[x.t].label)}</span><b>${R[k] ? (R[k].max ? `${R[k].pts}/${R[k].max}` : '✓') : '·'}</b><em>${STEP[x.t].scored ? (STEP[x.t].teacher ? 'you mark' : 'auto') : '—'}</em></div>`).join('')}</div></div>`;
    $$('.hb-tp-list>div', TB).forEach(r => r.onclick = () => go(+r.dataset.s));
    if(s < steps.length && STEP[steps[s].t].teacherView) STEP[steps[s].t].teacherView($('#hbTs', TB), ctx(s));
    if(s >= steps.length) finishTeacher($('#hbTs', TB)); };
  const go = (k) => { TTS.stop(); if(st.s._stepStop){ st.s._stepStop(); st.s._stepStop = null; } s = Math.max(0, Math.min(steps.length, k)); show(); };
  const show = () => { nav(); st.s.onKey = null; LB.scrollTop = 0; const side = $('.hb-learner', st.body); if(side) side.scrollTop = 0;
    if(s >= steps.length) return finish();
    const T = STEP[steps[s].t]; LB.innerHTML = `<div class="hb-step ${steps[s].t}">${steps[s].dir ? `<div class="hb-dir">${esc(steps[s].dir)}</div>` : ''}<div id="hbSb"></div>
      <div class="hb-dock"><button class="hs-btn ghost" id="hbPrev" ${s ? '' : 'hidden'}>← Back</button><span class="spacer"></span><button class="hs-btn big" id="hbNx">${s === steps.length - 1 ? 'Finish ★' : 'Next step →'}</button></div></div>`;
    $('#hbPrev', LB).onclick = () => go(s - 1); $('#hbNx', LB).onclick = () => { if(!R[s] && !T.scored) R[s] = {done: true}; go(s + 1); };
    T.learner($('#hbSb', LB), ctx(s)); teacher(); };
  let saved = false;
  const finishTeacher = (box) => { box.innerHTML = `<div id="hbSaveT" class="hb-tp-save"></div>`; };
  const finish = () => { const [p, m] = scoreOf(); const pct = m ? Math.round(p / m * 100) : 100; const pending = steps.filter((x, k) => STEP[x.t].teacher && !R[k]).length;
    LB.innerHTML = `<div class="hb-end">
      ${m ? `<div class="hb-ring" style="--p:${pct}"><div><b>${p}</b><span>of ${m}</span></div></div>${starHtml(stars(pct))}` : '<div class="hb-big-ic">🌟</div>'}
      <h2>${!m ? 'All done — great work!' : pct >= 80 ? 'Outstanding!' : pct >= 60 ? 'Good job — keep going!' : 'Nice try — practice makes progress!'}</h2>
      ${pending ? `<div class="hb-note">${pending} step(s) still need the teacher's marks — the score will go up when they're marked.</div>` : ''}
      <div id="hbSave"></div>
      <div class="hb-dock center"><button class="hs-btn ghost" id="hbAgain">↻ Do it again</button><button class="hs-btn ghost" id="hbList">☰ All activities</button>${opt.next ? `<button class="hs-btn big" id="hbNextA">${esc(opt.nextLabel || 'Next')} →</button>` : ''}</div></div>`;
    if(m && pct >= 60) confetti(st.s);
    teacher();
    const rec = {score: p, max: m, pct, ts: Date.now(), steps: R.map(r => r && r.max ? [r.pts, r.max] : r ? 1 : 0)};
    saveBox(c, $('#hbSaveT', st.body) || $('#hbSave', LB), task.id, rec, () => { saved = true; });
    $('#hbAgain', LB).onclick = () => opt.replay(); $('#hbList', LB).onclick = () => closeStage(true);
    if($('#hbNextA', LB)) $('#hbNextA', LB).onclick = () => opt.next(); };
  frame(); show();
}

/* ---------- shared bits ---------- */
// one-at-a-time multiple choice (items: [stem, options[], answerIndex, underline?, sayText?])
function stepper(host, x, items, kind){ const d = x.d; d.a = d.a || []; d.i = d.i || 0;
  const draw = () => { const i = d.i; const it = items[i]; if(!it) return;
    const [stem, opts, ans, und, sayT] = it; const done = d.a[i] != null;
    const stemH = sayT ? `<button class="hb-say big" id="hbSay">🔊</button><span class="hb-say-t">Listen, then choose.</span>` : und ? esc(stem).replace(new RegExp('\\b(' + und.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'i'), '<u>$1</u>') : esc(stem).replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/___/g, '<span class="hb-blank">____</span>');
    host.innerHTML = `<div class="hb-prog">${items.map((_, j) => `<i class="${j === i ? 'cur' : ''} ${d.a[j] == null ? '' : d.a[j] === items[j][2] ? 'ok' : 'no'}"></i>`).join('')}</div>
      <div class="hb-qcard"><div class="hb-qmeta"><span>${i + 1} of ${items.length}</span></div><h2>${stemH}</h2>
      <div class="hb-opts ${opts.length > 4 || opts.every(o => o.length < 14) ? 'chips' : ''}">${opts.map((o, j) => `<button class="hb-opt" data-j="${j}"><b>${opts.length <= 4 ? 'ABCD'[j] : '•'}</b><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="hb-fb" id="hbFb"></div><div class="hb-dock" style="margin-top:6px"><span class="spacer"></span><button class="hs-btn" id="hbQn" ${done ? '' : 'hidden'}>${i === items.length - 1 ? 'Done ✓' : 'Next →'}</button></div></div>`;
    if(sayT){ $('#hbSay', host).onclick = () => say(sayT); if(!done) setTimeout(() => say(sayT), 300); }
    const mark = (j, fresh) => { d.a[i] = j; const ok = j === ans;
      $$('.hb-opt', host).forEach(b => { const k = +b.dataset.j; b.disabled = true; b.classList.toggle('right', k === ans); b.classList.toggle('wrong', k === j && !ok); b.classList.toggle('dim', k !== j && k !== ans); });
      $('#hbFb', host).innerHTML = ok ? `<span class="good">${['Correct! 🎉','Nice! ⭐','Yes! 👏','Great! 🌟'][i % 4]}</span>` : `<span class="bad">The answer is <b>${esc(opts[ans])}</b>.</span>`;
      if(fresh){ chime(ok); if(sayT) setTimeout(() => say(opts[ans]), 350); }
      $('#hbQn', host).hidden = false; x.report({pts: d.a.filter((v, k) => v === items[k][2]).length, max: items.length, partial: d.a.filter(v => v != null).length < items.length}); };
    $$('.hb-opt', host).forEach(b => b.onclick = () => mark(+b.dataset.j, true));
    if(done) mark(d.a[i], false);
    $('#hbQn', host).onclick = () => { if(d.i < items.length - 1){ d.i++; draw(); } else x.next(); };
    x.st.s.onKey = (e) => { const k = '1234ABCD'.indexOf(e.key.toUpperCase()); if(k >= 0 && d.a[d.i] == null){ const b = $(`.hb-opt[data-j="${k % 4}"]`, host); if(b) b.click(); } else if(e.key === 'Enter' && d.a[d.i] != null) $('#hbQn', host).click(); };
  };
  draw();
}
function keyList(host, items, d, fmt){ host.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">Answer key · learner's answers</div><ol class="hb-kl">${items.map((it, i) => { const a = (d.a || [])[i]; return `<li class="${a == null ? '' : a === it[2] ? 'ok' : 'no'} ${i === d.i ? 'cur' : ''}"><span>${esc(fmt ? fmt(it) : it[0])}</span><b>${esc(it[1][it[2]])}</b>${a != null && a !== it[2] ? `<i>${esc(it[1][a])}</i>` : ''}</li>`; }).join('')}</ol></div>`; }
// teacher marks: rows with ✓ / ½ / ✗ buttons → pts
function marksPanel(host, x, rows, title){ const d = x.d; d.m = d.m || {};
  host.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">${esc(title || 'Mark each answer')}</div>${rows.map((r, i) => `<div class="hb-mk"><div><b>${esc(r[0])}</b>${r[1] ? `<div class="hb-mk-a">${r[1]}</div>` : '<div class="hb-mk-a muted">— not answered yet —</div>'}</div>
    <div class="hb-mk-b">${[[2,'✓'],[1,'½'],[0,'✕']].map(([v, t]) => `<button data-r="${i}" data-v="${v}" class="${d.m[i] === v ? 'on v' + v : ''}">${t}</button>`).join('')}</div></div>`).join('')}</div>`;
  $$('[data-r]', host).forEach(b => b.onclick = () => { d.m[b.dataset.r] = +b.dataset.v; const pts = Object.values(d.m).reduce((s2, v) => s2 + v, 0); x.report({pts, max: rows.length * 2}); });
}
function rubricPanel(host, x, rub, extra){ const d = x.d; d.r = d.r || {};
  const max = rub.reduce((s2, r) => s2 + r[1], 0);
  host.innerHTML = `${extra || ''}<div class="hb-tp-cur"><div class="hb-tp-l">Rubric · tap a score</div>${rub.map((r, i) => `<div class="hb-rb"><span>${esc(r[0])}</span><div>${Array.from({length: r[1]}, (_, k) => k + 1).map(v => `<button data-c="${i}" data-v="${v}" class="${d.r[i] === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`).join('')}
    <textarea class="hb-cm" id="hbCm" placeholder="Comment for the learner (optional)">${esc(d.cm || '')}</textarea><div class="tiny" style="opacity:.6;margin-top:4px">${Object.keys(d.r).length}/${rub.length} criteria scored · ${Object.values(d.r).reduce((a, b) => a + b, 0)}/${max}</div></div>`;
  $$('[data-c]', host).forEach(b => b.onclick = () => { d.r[b.dataset.c] = +b.dataset.v; const pts = Object.values(d.r).reduce((a2, b2) => a2 + b2, 0); x.report({pts, max}); });
  $('#hbCm', host).oninput = (e) => { d.cm = e.target.value; };
}

/* ================================================================ step types ================================================================ */
const STEP = {};
STEP.listen = {label: 'Listen', scored: false,
  learner(h, x){ const t = x.step; const d = x.d;
    h.innerHTML = `<div class="hb-listen"><button class="hb-ear ${d.on ? 'on' : ''}" id="hbEar"><span>🎧</span><b>${d.played ? 'Listen again' : 'Listen'}</b></button>
      <div class="hb-eq"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="hb-listen-t">${esc(t.title || '')}</div>
      <button class="hs-btn ghost sm" id="hbShow">${d.show ? 'Hide the text' : '📄 Show the text'}</button>
      ${d.show ? `<article class="hb-paper learner small">${t.p.map(p => `<p>${esc(p)}</p>`).join('')}${t.moral ? `<p><i>Moral: ${esc(t.moral)}</i></p>` : ''}</article>` : ''}</div>`;
    const ear = $('#hbEar', h);
    ear.onclick = () => { if(d.on){ TTS.stop(); d.on = false; this.learner(h, x); return; } d.on = true; d.played = true; ear.classList.add('on'); h.querySelector('.hb-listen').classList.add('playing');
      TTS.speak((t.title ? t.title + '. ' : '') + t.p.join(' '), {rate: .9, onEnd: () => { d.on = false; const e = $('#hbEar', h); if(e){ e.classList.remove('on'); h.querySelector('.hb-listen').classList.remove('playing'); } }}); };
    $('#hbShow', h).onclick = () => { d.show = !d.show; this.learner(h, x); x.teacher(); }; },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-note">Read the text aloud yourself, or let the laptop read it (🎧 on the learner's side). The text stays hidden on the learner's side until you show it.</div>
    <label class="hb-tg"><input type="checkbox" id="hbTs1" ${x.d.show ? 'checked' : ''}> Show the text on the learner's side</label>`;
    $('#hbTs1', h).onchange = (e) => { x.d.show = e.target.checked; const lb = x.learnerBox(); STEP.listen.learner($('#hbSb', lb), x); }; } };
STEP.read = {label: 'Read', scored: false,
  learner(h, x){ const t = x.step; h.innerHTML = `<article class="hb-paper learner">${t.kicker ? `<div class="hb-kicker">${esc(t.kicker)}</div>` : ''}${t.title ? `<h1>${esc(t.title)}</h1>` : ''}${t.p.map(p => `<p class="${/^• /.test(p) ? 'bul' : ''}">${esc(p)}</p>`).join('')}</article>
    ${t.example && t.example.length ? `<details class="hb-ex"><summary>👀 See the example</summary>${t.example.map(p => `<p>${esc(p)}</p>`).join('')}</details>` : ''}`; },
  teacherView(h){ h.innerHTML = `<div class="hb-tp-note">The learner reads the task. Read it together or answer their questions.</div>`; } };
STEP.cards = {label: 'Vocabulary', scored: false,
  learner(h, x){ const V = x.step.vocab; const d = x.d; d.i = d.i || 0;
    const draw = () => { const v = V[d.i];
      h.innerHTML = `<div class="hb-card"><div class="hb-card-n">${d.i + 1} / ${V.length}</div><div class="hb-card-w">${esc(v.w)}</div><button class="hb-say" id="hbSw">🔊</button>
        <div class="hb-card-d">${esc(v.d)}</div>${(v.ex || []).length ? `<ul class="hb-card-ex">${v.ex.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}</div>
        <div class="hb-dock center"><button class="hs-btn ghost" id="hbCp" ${d.i ? '' : 'disabled'}>←</button><button class="hs-btn ghost" id="hbCs">🔊 Read the card</button><button class="hs-btn ghost" id="hbCn" ${d.i < V.length - 1 ? '' : 'disabled'}>→</button></div>`;
      $('#hbSw', h).onclick = () => say(v.w); $('#hbCs', h).onclick = () => say(`${v.w}. ${v.d}. ${(v.ex || []).join(' ')}`);
      $('#hbCp', h).onclick = () => { d.i--; draw(); }; $('#hbCn', h).onclick = () => { d.i++; draw(); }; };
    draw(); },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">Words for today</div>${x.step.vocab.map((v, i) => `<div class="hb-vw ${i === x.d.i ? 'cur' : ''}"><b>${esc(v.w)}</b> — ${esc(v.d)}</div>`).join('')}</div>`; } };
STEP.mc = {label: 'Answer', scored: true, max: (t) => t.items.length,
  learner(h, x){ stepper(h, x, x.step.items); },
  teacherView(h, x){ keyList(h, x.step.items, x.d, it => it[4] ? '🔊 ' + it[4] : it[0]); } };
STEP.bank = {label: 'Word bank', scored: true, max: (t) => t.items.length,
  learner(h, x){ const t = x.step; const items = t.items.map(([s2, w]) => [s2.includes('___') ? s2 : s2 + ' → ___', t.bank, t.bank.indexOf(w)]);
    h.innerHTML = `<div class="hb-bank">${t.bank.map(w => `<span>${esc(w)}</span>`).join('')}</div><div id="hbBk"></div>`; stepper($('#hbBk', h), x, items); },
  teacherView(h, x){ keyList(h, x.step.items.map(([s2, w]) => [s2, x.step.bank, x.step.bank.indexOf(w)]), x.d); } };
STEP.match = {label: 'Match', scored: true, max: (t) => t.pairs.length,
  learner(h, x){ const P = x.step.pairs; const d = x.d; d.done = d.done || {}; d.miss = d.miss || 0; d.L = d.L || shuffle(P.map((_, i) => i)); d.R = d.R || shuffle(P.map((_, i) => i)); let pick = null;
    const draw = () => { h.innerHTML = `<div class="hb-match"><div>${d.L.map(i => `<button class="hb-mt l ${d.done[i] ? 'ok' : ''}" data-i="${i}">${esc(P[i][0])}</button>`).join('')}</div>
      <div>${d.R.map(i => `<button class="hb-mt r ${d.done[i] ? 'ok' : ''}" data-i="${i}">${esc(P[i][1])}</button>`).join('')}</div></div>
      <div class="hb-fb center">${Object.keys(d.done).length === P.length ? '<span class="good">All matched! 🎉</span>' : 'Tap a word, then tap its meaning.'}</div>`;
      $$('.hb-mt.l', h).forEach(b => b.onclick = () => { if(d.done[b.dataset.i]) return; pick = +b.dataset.i; $$('.hb-mt.l', h).forEach(y => y.classList.toggle('sel', y === b)); });
      $$('.hb-mt.r', h).forEach(b => b.onclick = () => { if(pick == null || d.done[b.dataset.i]) return; const ok = +b.dataset.i === pick;
        if(ok){ d.done[pick] = 1; chime(true); pick = null; draw(); } else { d.miss++; chime(false); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); }
        x.report({pts: Math.max(0, Object.keys(d.done).length - Math.min(d.miss, Object.keys(d.done).length)) , max: P.length, partial: Object.keys(d.done).length < P.length}); }); };
    draw(); },
  teacherView(h, x){ const d = x.d; h.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">Pairs · ${Object.keys(d.done || {}).length}/${x.step.pairs.length} matched · ${d.miss || 0} wrong tries</div>${x.step.pairs.map((p, i) => `<div class="hb-vw ${(d.done || {})[i] ? 'ok' : ''}"><b>${esc(p[0])}</b> — ${esc(p[1])}</div>`).join('')}<div class="tiny" style="opacity:.6;margin-top:6px">Score = pairs matched minus wrong tries.</div></div>`; } };
STEP.search = {label: 'Word search', scored: true, max: (t) => t.words.length,
  learner(h, x){ const d = x.d; const W = x.step.words.map(w => w[0].toUpperCase()); d.f = d.f || {};
    if(!d.g){ const N = Math.max(10, ...W.map(w => w.length)); let g; for(let tries = 0; tries < 200; tries++){ g = Array.from({length: N}, () => Array(N).fill('')); let ok = true;
        for(const w of [...W].sort((a, b) => b.length - a.length)){ let placed = false;
          for(let t2 = 0; t2 < 300 && !placed; t2++){ const dir = [[0,1],[1,0],[1,1]][Math.floor(Math.random() * 3)]; const r0 = Math.floor(Math.random() * (N - dir[0] * (w.length - 1))), c0 = Math.floor(Math.random() * (N - dir[1] * (w.length - 1)));
            if([...w].every((ch, k) => { const v = g[r0 + dir[0] * k][c0 + dir[1] * k]; return !v || v === ch; })){ [...w].forEach((ch, k) => { g[r0 + dir[0] * k][c0 + dir[1] * k] = ch; }); placed = true; d.pos = d.pos || {}; d.pos[w] = [r0, c0, dir]; } }
          if(!placed){ ok = false; d.pos = {}; break; } }
        if(ok) break; }
      const A = 'ABCDEFGHIJKLMNOPRSTUVWY'; d.g = g.map(r => r.map(ch => ch || A[Math.floor(Math.random() * A.length)])); }
    let first = null;
    const cells = (w) => { const [r0, c0, dir] = d.pos[w]; return [...w].map((_, k) => `${r0 + dir[0] * k}-${c0 + dir[1] * k}`); };
    const draw = () => { const found = new Set(Object.keys(d.f).flatMap(w => cells(w)));
      h.innerHTML = `<div class="hb-ws"><div class="hb-grid" style="--n:${d.g.length}">${d.g.map((r, i) => r.map((ch, j) => `<button data-c="${i}-${j}" class="${found.has(i + '-' + j) ? 'f' : ''}">${ch}</button>`).join('')).join('')}</div>
        <div class="hb-clues">${x.step.words.map(([w, cl]) => `<div class="${d.f[w.toUpperCase()] ? 'ok' : ''}"><b>${d.f[w.toUpperCase()] ? esc(w) : '_ '.repeat(w.length).trim()}</b><span>${esc(cl)}</span></div>`).join('')}</div></div>
        <div class="hb-fb center">Tap the first letter of a word, then its last letter.</div>`;
      $$('.hb-grid button', h).forEach(b => b.onclick = () => { if(!first){ first = b.dataset.c; b.classList.add('sel'); return; }
        const a = first.split('-').map(Number), z = b.dataset.c.split('-').map(Number); first = null;
        const hit = W.find(w => { const cs = cells(w); return (cs[0] === a.join('-') && cs[cs.length - 1] === z.join('-')) || (cs[0] === z.join('-') && cs[cs.length - 1] === a.join('-')); });
        if(hit && !d.f[hit]){ d.f[hit] = 1; chime(true); x.report({pts: Object.keys(d.f).length, max: W.length, partial: Object.keys(d.f).length < W.length}); } else if(!hit) chime(false);
        draw(); }); };
    draw(); },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">Words · ${Object.keys(x.d.f || {}).length}/${x.step.words.length} found</div>${x.step.words.map(([w, cl]) => `<div class="hb-vw ${(x.d.f || {})[w.toUpperCase()] ? 'ok' : ''}"><b>${esc(w)}</b> — ${esc(cl)}</div>`).join('')}</div>`; } };
STEP.cross = {label: 'Puzzle', scored: true, max: (t) => t.clues.length,
  learner(h, x){ const d = x.d; d.v = d.v || {}; d.ok = d.ok || {};
    h.innerHTML = `<div class="hb-cross">${x.step.clues.map(([cl, w], i) => `<div class="hb-cw ${d.ok[i] ? 'ok' : ''}" data-i="${i}"><div class="hb-cw-c"><i>${i + 1}</i>${esc(cl)}</div><div class="hb-cw-b">${[...w].map((ch, k) => `<input maxlength="1" data-k="${k}" value="${esc((d.v[i] || '')[k] || '')}" ${d.ok[i] ? 'disabled' : ''}>`).join('')}<button class="hs-btn sm" data-chk="${i}" ${d.ok[i] ? 'hidden' : ''}>Check</button></div></div>`).join('')}</div>`;
    $$('.hb-cw', h).forEach(row => { const i = +row.dataset.i; const ins = $$('input', row);
      ins.forEach((inp, k) => { inp.oninput = () => { inp.value = inp.value.slice(-1).toUpperCase(); d.v[i] = ins.map(z => z.value).join(''); if(inp.value && ins[k + 1]) ins[k + 1].focus(); };
        inp.onkeydown = (e) => { if(e.key === 'Backspace' && !inp.value && ins[k - 1]) ins[k - 1].focus(); if(e.key === 'Enter') $(`[data-chk="${i}"]`, row).click(); }; });
      $(`[data-chk="${i}"]`, row).onclick = () => { const w = x.step.clues[i][1].toUpperCase(); const g = ins.map(z => z.value.toUpperCase()).join('');
        if(g === w){ d.ok[i] = 1; chime(true); row.classList.add('ok'); ins.forEach(z => z.disabled = true); $(`[data-chk="${i}"]`, row).hidden = true; }
        else { chime(false); row.classList.add('shake'); setTimeout(() => row.classList.remove('shake'), 400); d.miss = (d.miss || 0) + 1; }
        x.report({pts: Object.keys(d.ok).length, max: x.step.clues.length, partial: Object.keys(d.ok).length < x.step.clues.length}); }; }); },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">Answers · ${Object.keys(x.d.ok || {}).length}/${x.step.clues.length} solved</div>${x.step.clues.map(([cl, w], i) => `<div class="hb-vw ${(x.d.ok || {})[i] ? 'ok' : ''}"><b>${esc(w)}</b> — ${esc(cl)}${(x.d.v || {})[i] && !(x.d.ok || {})[i] ? ` <i class="muted">(typing: ${esc(x.d.v[i])})</i>` : ''}</div>`).join('')}</div>`; } };
// unscramble / build a word: letter tiles
function tiles(h, x, items, mode){ const d = x.d; d.i = d.i || 0; d.res = d.res || {};
  const draw = () => { const i = d.i; const [w, hint, emo] = items[i]; const W = w.toLowerCase();
    d.t = d.t || {}; if(!d.t[i]){ const extra = mode === 'build' ? shuffle('abcdefghijklmnoprstuw'.split('').filter(ch => !W.includes(ch))).slice(0, 2) : []; d.t[i] = shuffle([...W, ...extra].map((ch, k) => ({ch, k}))); }
    d.p = d.p || {}; d.p[i] = d.p[i] || [];
    const used = new Set(d.p[i]); const got = d.p[i].map(k => d.t[i].find(z => z.k === k).ch).join('');
    h.innerHTML = `<div class="hb-prog">${items.map((_, j) => `<i class="${j === i ? 'cur' : ''} ${d.res[j] === 1 ? 'ok' : d.res[j] === 0 ? 'no' : ''}"></i>`).join('')}</div>
      <div class="hb-tile-q">${emo ? `<div class="hb-emo">${emo}</div>` : ''}${mode === 'build' ? `<button class="hb-say big" id="hbSw">🔊</button>` : ''}${hint ? `<div class="hb-hint">${esc(hint)}</div>` : ''}</div>
      <div class="hb-slots">${[...W].map((_, k) => `<span class="${got[k] ? 'on' : ''}">${got[k] || ''}</span>`).join('')}</div>
      <div class="hb-tiles">${d.t[i].map(z => `<button data-k="${z.k}" ${used.has(z.k) || d.res[i] != null ? 'disabled' : ''}>${z.ch}</button>`).join('')}</div>
      <div class="hb-fb center" id="hbFb">${d.res[i] === 1 ? '<span class="good">Correct! 🎉</span>' : d.res[i] === 0 ? `<span class="bad">It’s <b>${esc(W)}</b>.</span>` : ''}</div>
      <div class="hb-dock center"><button class="hs-btn ghost" id="hbUndo" ${d.res[i] != null ? 'hidden' : ''}>⌫ Undo</button><button class="hs-btn ghost" id="hbSkip" ${d.res[i] != null ? 'hidden' : ''}>Show me</button><button class="hs-btn" id="hbTn" ${d.res[i] != null ? '' : 'hidden'}>${i < items.length - 1 ? 'Next word →' : 'Done ✓'}</button></div>`;
    if($('#hbSw', h)){ $('#hbSw', h).onclick = () => say(W); if(!d.p[i].length && d.res[i] == null) setTimeout(() => say(W), 250); }
    const rep = () => x.report({pts: Object.values(d.res).filter(v => v === 1).length, max: items.length, partial: Object.keys(d.res).length < items.length});
    $$('.hb-tiles button', h).forEach(b => b.onclick = () => { d.p[i].push(+b.dataset.k); const g = d.p[i].map(k => d.t[i].find(z => z.k === k).ch).join('');
      if(g.length === W.length){ chime(g === W);
        if(g !== W){ d.p[i] = []; d.miss = (d.miss || 0) + 1; draw(); h.querySelector('.hb-slots').classList.add('shake'); return; }
        d.res[i] = 1; say(W); rep(); }
      draw(); });
    $('#hbUndo', h).onclick = () => { d.p[i].pop(); draw(); };
    $('#hbSkip', h).onclick = () => { d.res[i] = 0; const usedK = new Set(); d.p[i] = [...W].map(ch => { const z = d.t[i].find(y => y.ch === ch && !usedK.has(y.k)); usedK.add(z.k); return z.k; }); say(W); rep(); draw(); };
    $('#hbTn', h).onclick = () => { if(d.i < items.length - 1){ d.i++; draw(); } else x.next(); }; };
  draw(); }
STEP.scramble = {label: 'Unscramble', scored: true, max: (t) => t.items.length,
  learner(h, x){ tiles(h, x, x.step.items.map(([w, def]) => [w, def]), 'scramble'); },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">Words</div>${x.step.items.map(([w, def], i) => `<div class="hb-vw ${(x.d.res || {})[i] === 1 ? 'ok' : (x.d.res || {})[i] === 0 ? 'no' : ''} ${i === x.d.i ? 'cur' : ''}"><b>${esc(w)}</b> — ${esc(def)}</div>`).join('')}</div>`; } };
STEP.build = {label: 'Build a word', scored: true, max: (t) => t.words.length,
  learner(h, x){ tiles(h, x, x.step.words.map(w => [w, '', L3E[w] || '']), 'build'); },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-note">The laptop says each word (🔊). The learner builds it from the letters.</div><div class="hb-tp-cur">${x.step.words.map((w, i) => `<span class="hb-wchip ${(x.d.res || {})[i] === 1 ? 'ok' : (x.d.res || {})[i] === 0 ? 'no' : ''} ${i === x.d.i ? 'cur' : ''}">${L3E[w] || ''} ${esc(w)}</span>`).join('')}</div>`; } };
STEP.odd = {label: 'Odd word out', scored: true, max: (t) => t.rows.length,
  learner(h, x){ const items = x.step.rows.map(([r, o]) => [r.join(' · '), r, r.indexOf(o)]);
    stepper(h, x, items.map(it => [it[0], it[1], it[2], null, null]));
    const addSay = () => { const q = h.querySelector('.hb-qcard h2'); if(q && !q.querySelector('.hb-say')){ const b = document.createElement('button'); b.className = 'hb-say'; b.textContent = '🔊'; b.onclick = () => say(q.textContent.replace(/·/g, ',')); q.prepend(b); } };
    addSay(); new MutationObserver(addSay).observe(h, {childList: true}); },
  teacherView(h, x){ keyList(h, x.step.rows.map(([r, o]) => [r.join(' '), r, r.indexOf(o)]), x.d); } };
STEP.sort = {label: 'Word sort', scored: true, max: (t) => t.words.length,
  learner(h, x){ const t = x.step; const d = x.d; d.b = d.b || {}; d.order = d.order || shuffle(t.words.map((_, i) => i)); let pick = null;
    const draw = () => { const left = d.order.filter(i => d.b[i] == null);
      h.innerHTML = `<div class="hb-sortw">${left.map(i => `<button data-i="${i}" class="${pick === i ? 'sel' : ''}">${esc(t.words[i][0])}</button>`).join('') || '<span class="good">All sorted! 🎉</span>'}</div>
        <div class="hb-bins">${t.bins.map((b, k) => `<div class="hb-bin" data-k="${k}"><b>${esc(b)}</b><div>${t.words.map((w, i) => d.b[i] === k ? `<span class="${w[1] === k ? 'ok' : 'no'}">${esc(w[0])}</span>` : '').join('')}</div></div>`).join('')}</div>
        <div class="hb-fb center">Tap a word, then tap its box.</div>`;
      $$('.hb-sortw button', h).forEach(b => b.onclick = () => { pick = +b.dataset.i; say(t.words[pick][0]); draw(); });
      $$('.hb-bin', h).forEach(b => b.onclick = () => { if(pick == null) return; const k = +b.dataset.k; d.b[pick] = k; chime(t.words[pick][1] === k); pick = null;
        x.report({pts: t.words.filter((w, i) => d.b[i] === w[1]).length, max: t.words.length, partial: Object.keys(d.b).length < t.words.length}); draw(); }); };
    draw(); },
  teacherView(h, x){ const t = x.step; h.innerHTML = `<div class="hb-tp-cur">${t.bins.map((b, k) => `<div class="hb-vw"><b>${esc(b)}</b>: ${t.words.filter(w => w[1] === k).map(w => esc(w[0])).join(', ')}</div>`).join('')}</div>`; } };
STEP.blend = {label: 'Blend and say', scored: false,
  learner(h, x){ const t = x.step; const d = x.d; d.i = d.i || 0;
    const draw = () => { const parts = t.items[d.i]; const w = parts.join('');
      h.innerHTML = `<div class="hb-blend">${parts.map((p, k) => `<button class="hb-bt" data-k="${k}">${esc(p)}</button>${k < parts.length - 1 ? '<span>+</span>' : ''}`).join('')}<span>=</span><button class="hb-bt w" id="hbBw">${d.show ? esc(w) : '?'}</button></div>
        <div class="hb-dock center"><button class="hs-btn ghost" id="hbBp" ${d.i ? '' : 'disabled'}>←</button><button class="hs-btn" id="hbBs">${d.show ? '🔊 Say it' : 'Blend it!'}</button><button class="hs-btn ghost" id="hbBn" ${d.i < t.items.length - 1 ? '' : 'disabled'}>→</button></div>
        <div class="hb-wall">${t.items.map((p, k) => `<span class="${k === d.i ? 'cur' : ''}" data-k="${k}">${esc(p.join(''))}</span>`).join('')}</div>`;
      $$('.hb-bt[data-k]', h).forEach(b => b.onclick = () => say(parts[+b.dataset.k], .6));
      $('#hbBw', h).onclick = $('#hbBs', h).onclick = () => { d.show = true; say(w, .75); draw(); };
      $('#hbBp', h).onclick = () => { d.i--; d.show = false; draw(); }; $('#hbBn', h).onclick = () => { d.i++; d.show = false; draw(); };
      $$('.hb-wall span', h).forEach(b => b.onclick = () => { d.i = +b.dataset.k; d.show = false; draw(); }); };
    draw(); },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-note">Sound out each part with the learner, then blend. Tap a part on the learner's side to hear it. ${x.step.note ? esc(x.step.note) : ''}</div>`; } };
// flash reading: the learner reads big cards; the teacher marks ✓ / ✕ (split screen)
STEP.flash = {label: 'Read aloud', scored: true, teacher: true, max: (t) => t.items.length,
  learner(h, x){ const d = x.d; const t = x.step; d.m = d.m || []; d.i = d.i || 0;
    const big = t.items.every(w => w.length < 14);
    h.innerHTML = `<div class="hb-flash ${big ? 'w' : 's'}"><div class="hb-flash-n">${Math.min(d.i + 1, t.items.length)} / ${t.items.length}</div><div class="hb-flash-c" id="hbFc">${d.i < t.items.length ? esc(t.items[d.i]) : '🌟'}</div>
      ${ui().split === false ? `<div class="hb-dock center"><button class="hs-btn ghost" data-v="0">✕ Try again</button><button class="hs-btn done" data-v="1">✓ Correct</button></div>` : '<div class="hb-flash-h">Read the word aloud.</div>'}</div>`;
    $$('[data-v]', h).forEach(b => b.onclick = () => STEP.flash.mark(x, +b.dataset.v)); },
  mark(x, v){ const d = x.d; const t = x.step; if(d.i >= t.items.length) return; if(!d.t0) d.t0 = Date.now(); d.m[d.i] = v; d.i++; if(d.i >= t.items.length) d.secs = Math.round((Date.now() - d.t0) / 1000);
    x.report({pts: d.m.filter(Boolean).length, max: t.items.length, partial: d.i < t.items.length}); const lb = x.learnerBox(); STEP.flash.learner($('#hbSb', lb), x); },
  teacherView(h, x){ const d = x.d; const t = x.step; const right = (d.m || []).filter(Boolean).length; const done = (d.m || []).length;
    h.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">${done < t.items.length ? `Now showing: <b style="font-size:20px">${esc(t.items[d.i || 0])}</b>` : `Finished · ${right}/${t.items.length} correct${d.secs ? ` · ${d.secs}s · ${Math.round(right * 60 / Math.max(1, d.secs))} correct per minute` : ''}`}</div>
      ${done < t.items.length ? `<div class="hb-fl-b"><button class="hs-btn ghost big" data-v="0">✕ Not yet</button><button class="hs-btn done big" data-v="1">✓ Correct</button></div><div class="tiny" style="opacity:.6">Keys: → or Space = correct · X = not yet</div>` : `<button class="hs-btn ghost sm" id="hbFr">↺ Read the list again</button>`}
      <div class="hb-fl-l">${t.items.map((w, i) => `<span class="${d.m && d.m[i] === 1 ? 'ok' : d.m && d.m[i] === 0 ? 'no' : ''} ${i === d.i ? 'cur' : ''}">${esc(w)}</span>`).join('')}</div></div>`;
    $$('[data-v]', h).forEach(b => b.onclick = () => STEP.flash.mark(x, +b.dataset.v));
    if($('#hbFr', h)) $('#hbFr', h).onclick = () => { d.m = []; d.i = 0; d.t0 = 0; d.secs = 0; x.report(null); const lb = x.learnerBox(); STEP.flash.learner($('#hbSb', lb), x); };
    x.st.s.onKey = (e) => { if(e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return; if(e.key === 'ArrowRight' || e.key === ' '){ e.preventDefault(); STEP.flash.mark(x, 1); } else if(e.key.toLowerCase() === 'x' || e.key === 'ArrowLeft') STEP.flash.mark(x, 0); }; } };
// writing: sections with hints; the teacher scores with a rubric (or ✓ marks per item)
STEP.write = {label: 'Write', scored: true, teacher: true, max: (t) => t.rub ? t.rub.reduce((s2, r) => s2 + r[1], 0) : (t.sections.length * 2),
  learner(h, x){ const t = x.step; const d = x.d; d.v = d.v || {}; d.ck = d.ck || {};
    h.innerHTML = `${t.check ? `<div class="hb-check">${t.check.map((cItem, i) => `<label><input type="checkbox" data-ck="${i}" ${d.ck[i] ? 'checked' : ''}> ${esc(cItem)}</label>`).join('')}</div>` : ''}
      ${t.sections.map((sec, i) => `<div class="hb-ws-sec"><label><b>${esc(sec.l)}</b>${sec.h ? `<span>${esc(sec.h)}</span>` : ''}</label><textarea rows="${sec.rows || 4}" data-w="${i}" placeholder="Write here…">${esc(d.v[i] || '')}</textarea><i class="hb-wc" data-wc="${i}">${(d.v[i] || '').trim() ? (d.v[i] || '').trim().split(/\s+/).length : 0} words</i></div>`).join('')}`;
    $$('[data-w]', h).forEach(ta => ta.oninput = () => { d.v[ta.dataset.w] = ta.value; $(`[data-wc="${ta.dataset.w}"]`, h).textContent = (ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0) + ' words'; clearTimeout(d._t); d._t = setTimeout(() => x.teacher(), 600); });
    $$('[data-ck]', h).forEach(cb => cb.onchange = () => { d.ck[cb.dataset.ck] = cb.checked; x.teacher(); }); },
  teacherView(h, x){ const t = x.step; const d = x.d; const txt = (i) => (d.v || {})[i] ? esc(d.v[i]).replace(/\n/g, '<br>') : '';
    if(t.rub) return rubricPanel(h, x, t.rub, `<div class="hb-tp-cur"><div class="hb-tp-l">Learner's writing ${t.check ? `· checklist ${Object.values(d.ck || {}).filter(Boolean).length}/${t.check.length}` : ''}</div>${t.sections.map((sec, i) => `<div class="hb-wv"><b>${esc(sec.l)}</b><div>${txt(i) || '<span class="muted">—</span>'}</div></div>`).join('')}</div>`);
    marksPanel(h, x, t.sections.map((sec, i) => [sec.l, txt(i)]), 'Mark each answer · ✓ 2 · ½ 1 · ✕ 0'); } };
// drawing pad(s)
function pad(host, d, key, onEnd){ const cv = document.createElement('canvas'); cv.className = 'hb-pad'; const W2 = 900, H2 = 560; cv.width = W2; cv.height = H2; host.appendChild(cv);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W2, H2); if(d[key]){ const im = new Image(); im.onload = () => g.drawImage(im, 0, 0); im.src = d[key]; }
  let down = false, last = null; d._col = d._col || '#1d2a24'; d._sz = d._sz || 5;
  const pos = (e) => { const r = cv.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [(p.clientX - r.left) * W2 / r.width, (p.clientY - r.top) * H2 / r.height]; };
  const st = (e) => { down = true; last = pos(e); e.preventDefault(); };
  const mv = (e) => { if(!down) return; const p = pos(e); g.strokeStyle = d._col === 'erase' ? '#fff' : d._col; g.lineWidth = d._col === 'erase' ? 24 : d._sz; g.lineCap = 'round'; g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; e.preventDefault(); };
  const en = () => { if(!down) return; down = false; d[key] = cv.toDataURL('image/jpeg', .6); onEnd && onEnd(); };
  cv.addEventListener('pointerdown', st); cv.addEventListener('pointermove', mv); window.addEventListener('pointerup', en); cv.style.touchAction = 'none';
  return {clear(){ g.fillStyle = '#fff'; g.fillRect(0, 0, W2, H2); d[key] = ''; onEnd && onEnd(); }}; }
STEP.draw = {label: 'Draw', scored: true, teacher: true, max: (t) => t.rub ? t.rub.reduce((s2, r) => s2 + r[1], 0) : t.words.length * 2,
  learner(h, x){ const t = x.step; const d = x.d; const keys = t.words || ['cartoon']; d.k = d.k || 0; d.cap = d.cap || {};
    const draw = () => { const k = keys[d.k];
      h.innerHTML = `${t.words ? `<div class="hb-seg">${keys.map((w, i) => `<button data-k="${i}" class="${i === d.k ? 'on' : ''} ${d['img' + i] ? 'has' : ''}">${esc(w)}</button>`).join('')}</div>` : ''}
        <div class="hb-padbar">${['#1d2a24','#d44b3b','#2f6fc4','#1f9a5c','#e0a21a','#8a4fd0','#7a4b2a'].map(cl => `<button data-col="${cl}" style="background:${cl}" class="${d._col === cl ? 'on' : ''}"></button>`).join('')}<button data-col="erase" class="er ${d._col === 'erase' ? 'on' : ''}">🧽</button>
          <input type="range" min="2" max="18" value="${d._sz || 5}" id="hbSz"><span class="spacer"></span><button class="hs-btn ghost sm" id="hbClr">Clear</button></div>
        <div id="hbPad"></div>${t.words ? `<div class="hb-hint">Draw what <b>${esc(k)}</b> means.</div>` : ''}
        <input class="hb-cap" id="hbCap" placeholder="${t.words ? 'Write a sentence with the word (optional)' : 'Caption / title for your cartoon'}" value="${esc(d.cap[d.k] || '')}">`;
      const P = pad($('#hbPad', h), d, 'img' + d.k, () => x.teacher());
      $$('[data-k]', h).forEach(b => b.onclick = () => { d.k = +b.dataset.k; draw(); });
      $$('[data-col]', h).forEach(b => b.onclick = () => { d._col = b.dataset.col; $$('[data-col]', h).forEach(y => y.classList.toggle('on', y === b)); });
      $('#hbSz', h).oninput = (e) => { d._sz = +e.target.value; };
      $('#hbClr', h).onclick = () => P.clear();
      $('#hbCap', h).oninput = (e) => { d.cap[d.k] = e.target.value; clearTimeout(d._t); d._t = setTimeout(() => x.teacher(), 600); }; };
    draw(); },
  teacherView(h, x){ const t = x.step; const d = x.d; const keys = t.words || ['cartoon'];
    const gal = `<div class="hb-tp-cur"><div class="hb-tp-l">Learner's drawing${keys.length > 1 ? 's' : ''}</div><div class="hb-gal">${keys.map((w, i) => `<figure>${d['img' + i] ? `<img src="${d['img' + i]}">` : '<div class="muted">—</div>'}<figcaption><b>${esc(w)}</b> ${esc((d.cap || {})[i] || '')}</figcaption></figure>`).join('')}</div></div>`;
    if(t.rub) return rubricPanel(h, x, t.rub, gal);
    marksPanel(h, x, keys.map((w, i) => [w, d['img' + i] ? `<img src="${d['img' + i]}" class="hb-th">${esc((d.cap || {})[i] || '')}` : '']), 'Mark each sketch · ✓ 2 · ½ 1 · ✕ 0'); } };
STEP.frayer = {label: 'Frayer model', scored: true, teacher: true, max: (t) => t.words.length * 2,
  learner(h, x){ const t = x.step; const d = x.d; d.v = d.v || {}; d.k = d.k || 0;
    const F = ['Definition', 'Synonym', 'Antonym', 'Sentence'];
    const draw = () => { const w = t.words[d.k]; const v = d.v[d.k] = d.v[d.k] || {};
      h.innerHTML = `<div class="hb-seg">${t.words.map((x2, i) => `<button data-k="${i}" class="${i === d.k ? 'on' : ''}">${esc(x2)}</button>`).join('')}</div>
        <div class="hb-frayer">${F.map((f, i) => `<label class="q${i}"><b>${f}</b><textarea data-f="${f}" rows="3">${esc(v[f] || '')}</textarea></label>`).join('')}<div class="hb-fr-w"><span>${esc(w)}</span><button class="hb-say" id="hbSw">🔊</button></div></div>`;
      $('#hbSw', h).onclick = () => say(w);
      $$('[data-k]', h).forEach(b => b.onclick = () => { d.k = +b.dataset.k; draw(); });
      $$('[data-f]', h).forEach(ta => ta.oninput = () => { v[ta.dataset.f] = ta.value; clearTimeout(d._t); d._t = setTimeout(() => x.teacher(), 600); }); };
    draw(); },
  teacherView(h, x){ const d = x.d; marksPanel(h, x, x.step.words.map((w, i) => { const v = (d.v || {})[i] || {}; const s2 = ['Definition','Synonym','Antonym','Sentence'].filter(f => v[f]).map(f => `<i>${f}:</i> ${esc(v[f])}`).join('<br>'); return [w, s2]; }), 'Mark each word · ✓ 2 · ½ 1 · ✕ 0'); } };
STEP.lines = {label: 'Write', scored: true, teacher: true, max: (t) => t.rows.length * 2,
  learner(h, x){ const t = x.step; const d = x.d; d.v = d.v || {};
    h.innerHTML = `${t.word ? `<div class="hb-assoc"><span>${esc(t.word)}</span></div>` : ''}<div class="hb-lines">${t.rows.map((r, i) => `<div class="hb-ln2"><label>${esc(r)}</label>${t.two ? `<input data-a="${i}" placeholder="${esc(t.two)}" value="${esc((d.v[i] || {}).a || '')}">` : ''}<textarea data-b="${i}" rows="2" placeholder="${esc(t.ph || 'Write your answer in a complete sentence.')}">${esc((d.v[i] || {}).b || '')}</textarea></div>`).join('')}</div>`;
    const up = () => { clearTimeout(d._t); d._t = setTimeout(() => x.teacher(), 600); };
    $$('[data-a]', h).forEach(e => e.oninput = () => { (d.v[e.dataset.a] = d.v[e.dataset.a] || {}).a = e.value; up(); });
    $$('[data-b]', h).forEach(e => e.oninput = () => { (d.v[e.dataset.b] = d.v[e.dataset.b] || {}).b = e.value; up(); }); },
  teacherView(h, x){ const d = x.d; marksPanel(h, x, x.step.rows.map((r, i) => { const v = (d.v || {})[i] || {}; return [r, [v.a ? `<b>${esc(v.a)}</b>` : '', v.b ? esc(v.b) : ''].filter(Boolean).join(' — ')]; }), 'Mark each answer · ✓ 2 · ½ 1 · ✕ 0'); } };
STEP.order = {label: 'Put in order', scored: true, max: (t) => t.items.length,
  learner(h, x){ const t = x.step; const d = x.d; d.o = d.o || shuffle(t.items.map((_, i) => i)); let pick = null;
    const draw = () => { h.innerHTML = `<div class="hb-order">${d.o.map((k, i) => `<div class="hb-or ${d.chk ? (k === i ? 'ok' : 'no') : ''}" data-i="${i}"><i>${t.labels ? esc(t.labels[i]) : i + 1}</i><span>${esc(t.items[k])}</span><div><button data-up="${i}" ${i ? '' : 'disabled'}>↑</button><button data-dn="${i}" ${i < d.o.length - 1 ? '' : 'disabled'}>↓</button></div></div>`).join('')}</div>
      <div class="hb-dock center"><button class="hs-btn" id="hbOc">Check my order</button></div>`;
      $$('[data-up]', h).forEach(b => b.onclick = () => { const i = +b.dataset.up; [d.o[i - 1], d.o[i]] = [d.o[i], d.o[i - 1]]; d.chk = false; draw(); });
      $$('[data-dn]', h).forEach(b => b.onclick = () => { const i = +b.dataset.dn; [d.o[i + 1], d.o[i]] = [d.o[i], d.o[i + 1]]; d.chk = false; draw(); });
      $('#hbOc', h).onclick = () => { d.chk = true; const pts = d.o.filter((k, i) => k === i).length; chime(pts === t.items.length); if(pts === t.items.length) confetti(x.st.s); x.report({pts, max: t.items.length}); draw(); }; };
    draw(); },
  teacherView(h, x){ h.innerHTML = `<div class="hb-tp-cur"><div class="hb-tp-l">Correct order</div><ol class="hb-kl">${x.step.items.map((it, i) => `<li><span>${x.step.labels ? `<b>${esc(x.step.labels[i])}:</b> ` : ''}${esc(it)}</span></li>`).join('')}</ol></div>`; } };
// copyreading: edit the article; the teacher sees what changed
function diffWords(a, b){ const A = a.split(/(\s+)/), B = b.split(/(\s+)/); const n = A.length, m = B.length; if(n * m > 900000) return esc(b);
  const T = Array.from({length: n + 1}, () => new Uint16Array(m + 1)); for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--) T[i][j] = A[i] === B[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  let i = 0, j = 0, out = ''; while(i < n && j < m){ if(A[i] === B[j]){ out += esc(A[i]); i++; j++; } else if(T[i + 1][j] >= T[i][j + 1]){ if(A[i].trim()) out += `<del>${esc(A[i])}</del>`; i++; } else { out += B[j].trim() ? `<ins>${esc(B[j])}</ins>` : esc(B[j]); j++; } }
  while(i < n){ if(A[i].trim()) out += `<del>${esc(A[i])}</del>`; i++; } while(j < m){ out += B[j].trim() ? `<ins>${esc(B[j])}</ins>` : ''; j++; } return out.replace(/\n/g, '<br>'); }
STEP.copy = {label: 'Copyread', scored: true, teacher: true, max: (t) => t.rub.reduce((s2, r) => s2 + r[1], 0),
  learner(h, x){ const t = x.step; const d = x.d; if(d.v == null) d.v = t.article; d.hd = d.hd || {};
    h.innerHTML = `<div class="hb-ws-sec"><label><b>Slug</b><span>Short title of the story</span></label><input class="hb-cap" id="hbSlug" value="${esc(d.slug || '')}"></div>
      <div class="hb-ws-sec"><label><b>Copy</b><span>Fix the errors right in the text.</span></label><textarea id="hbCopy" rows="16" class="copy" spellcheck="false">${esc(d.v)}</textarea></div>
      ${t.heads.map((hh, i) => `<div class="hb-ws-sec"><label><b>${esc(hh)}</b></label><input class="hb-cap" data-h="${i}" value="${esc(d.hd[i] || '')}"></div>`).join('')}`;
    const up = () => { clearTimeout(d._t); d._t = setTimeout(() => x.teacher(), 700); };
    $('#hbCopy', h).oninput = (e) => { d.v = e.target.value; up(); }; $('#hbSlug', h).oninput = (e) => { d.slug = e.target.value; up(); };
    $$('[data-h]', h).forEach(e => e.oninput = () => { d.hd[e.dataset.h] = e.value; up(); }); },
  teacherView(h, x){ const t = x.step; const d = x.d;
    rubricPanel(h, x, t.rub, `<div class="hb-tp-cur"><div class="hb-tp-l">Changes the learner made <ins>added</ins> <del>removed</del></div><div class="hb-diff">${diffWords(t.article, d.v == null ? t.article : d.v)}</div>
      <div class="hb-wv"><b>Slug</b><div>${esc(d.slug || '—')}</div></div>${t.heads.map((hh, i) => `<div class="hb-wv"><b>${esc(hh)}</b><div>${esc((d.hd || {})[i] || '—')}</div></div>`).join('')}</div>`); } };
// on air: the learner reads their own script into a "microphone"; the teacher times and scores
STEP.air = {label: 'On air', scored: true, teacher: true, max: (t) => t.rub.reduce((s2, r) => s2 + r[1], 0),
  learner(h, x){ const t = x.step; const d = x.d; const ws = x.task.steps.findIndex(z => z.t === 'write');
    const script = ws >= 0 ? ((x.task._D[ws].v || {})[0] || '') : '';
    h.innerHTML = `<div class="hb-air ${d.on ? 'on' : ''}"><div class="hb-onair">ON AIR</div><div class="hb-air-t" id="hbAt">${d.secs != null && !d.on ? d.secs + ' s' : '0 s'}</div>
      <article class="hb-paper learner script">${script ? esc(script).replace(/\n/g, '<br>') : '<span class="muted">Write your script in the step before, then come back.</span>'}</article>
      <div class="hb-dock center"><button class="hs-btn big ${d.on ? 'done' : ''}" id="hbAir">${d.on ? '⏹ Stop' : '🎙️ Start broadcast'}</button></div><div class="hb-hint">Target: ${t.secs[0]}–${t.secs[1]} seconds</div></div>`;
    $('#hbAir', h).onclick = () => STEP.air.toggle(x); },
  toggle(x){ const d = x.d; if(!d.on){ d.on = true; d.t0 = Date.now(); d.iv = setInterval(() => { const e = $('#hbAt', x.st.s); if(e) e.textContent = Math.round((Date.now() - d.t0) / 1000) + ' s'; }, 250); x.st.s._stepStop = () => clearInterval(d.iv); }
    else { d.on = false; clearInterval(d.iv); d.secs = Math.round((Date.now() - d.t0) / 1000); }
    STEP.air.learner($('#hbSb', x.learnerBox()), x); x.teacher(); },
  teacherView(h, x){ const t = x.step; const d = x.d;
    rubricPanel(h, x, t.rub, `<div class="hb-tp-cur"><div class="hb-tp-l">Broadcast time</div><b style="font-size:26px">${d.on ? 'recording…' : d.secs != null ? d.secs + ' s' : '—'}</b> <span class="muted">target ${t.secs[0]}–${t.secs[1]} s</span>
      <div style="margin-top:8px"><button class="hs-btn sm" id="hbAirT">${d.on ? '⏹ Stop' : '🎙️ Start'}</button></div></div>`);
    $('#hbAirT', h).onclick = () => STEP.air.toggle(x); } };
STEP.info = {label: 'Learn', scored: false,
  learner(h, x){ h.innerHTML = `<article class="hb-paper learner info"><div class="hb-kicker">Background information</div>${x.step.p.map(p => `<p class="${/^• /.test(p) ? 'bul' : ''}">${esc(p)}</p>`).join('')}</article>`; },
  teacherView(h){ h.innerHTML = `<div class="hb-tp-note">Discuss the background with the learner before the task.</div>`; } };

/* ================================================================ Level 5 ================================================================ */
const L5 = () => M.HUB_L5;
function l5Task(set, k){ const B = L5()[set]; const d = B.days[k];
  const steps = [{t: 'listen', label: 'Listen', title: d.title, p: d.p.length ? (Array.isArray(d.p) ? d.p : [d.p]) : [], moral: d.moral}];
  if(d.vocab && d.vocab.length) steps.push({t: 'cards', label: 'Vocabulary', vocab: d.vocab});
  const a = d.act; const T = {mc: 'mc', bank: 'bank', match: 'match', search: 'search', cross: 'cross', scramble: 'scramble', frayer: 'frayer', sketch: 'draw', assoc: 'lines'}[a.t];
  const st2 = Object.assign({}, a, {t: T, label: d.skill || {mc: 'Answer', bank: 'Word bank', match: 'Match', search: 'Word search', cross: 'Puzzle', scramble: 'Unscramble', frayer: 'Frayer model', draw: 'Sketchnote', lines: 'Word association'}[T]});
  if(T === 'mc') st2.items = a.items.map(it => [it[0], it[1], it[2], it[3] || null]);
  if(T === 'lines'){ st2.rows = Array.from({length: a.n}, (_, i) => `Word ${i + 1}`); st2.word = a.word; st2.two = 'a word you connect with it'; st2.ph = 'Use the word in a sentence.'; }
  steps.push(st2);
  if(d.open && d.open.length || d.use && d.use.length) steps.push({t: 'lines', label: 'Think & write', dir: 'Answer in complete sentences.', rows: [...(d.open || []), ...(d.use || []).map(w => `Use “${w}” in a sentence.`)]});
  return {id: `L5-${set}-d${d.day}`, title: `Day ${d.day} · ${d.title}`, steps, ref: Array.isArray(d.p) ? d.p : [d.p], refLabel: 'Listening text (read it aloud)'}; }
function l5Home(main, c, el){ const u = ui(); const set = u.l5set || (+c.grade >= 9 ? '910' : '78'); const B = L5()[set];
  main.innerHTML = `<div class="row hb-bar">${H.tabsHtml([['play','Days & tests'],['prog','Progress']], u.tab === 'keys' ? 'play' : u.tab)}<span class="spacer"></span>
    <div class="seg" id="hbSet">${Object.entries(L5()).map(([k, v]) => `<button data-s="${k}" class="${k === set ? 'on' : ''}">${esc(v.label)}</button>`).join('')}</div></div><div id="hbTab"></div>`;
  $$('#hbSet button', main).forEach(b => b.onclick = () => { u.l5set = b.dataset.s; M.save(); M.views.readingHub(el); });
  $$('#hbTabs button', main).forEach(b => b.onclick = () => { u.tab = b.dataset.t; M.save(); M.views.readingHub(el); });
  const box = $('#hbTab', main); const r = u.who ? (((c.hub || {}).r || {})[u.who] || {}) : null;
  const tests = B.tests.map((t, i) => ({id: `L5-${set}-t${i}`, label: t.label, title: B.label, q: t.q.map(q => [q[0], q[1], q[2], null, q[3] || null])}));
  const days = B.days.map(d => ({id: `L5-${set}-d${d.day}`, label: `Day ${d.day}`, title: d.title}));
  if(u.tab === 'prog') return H.progress(box, c, [tests[0], tests[1], ...days, tests[2], tests[3]], 'L5', (a) => a.label.startsWith('Day') ? a.label.slice(4) : a.label.replace('-test · Days ', ' ').replace('–', '-'));
  const tile = (a, i, kind) => { const x = r && r[a.id]; return `<button class="hb-tile ${kind === 't' ? 'test' : 'l5'} ${x ? 'done' : ''}" data-k="${kind}" data-i="${i}"><span class="hb-tile-n">${kind === 't' ? (a.label.startsWith('Pre') ? 'PRE' : 'POST') : a.label.slice(4)}</span>
    <span class="hb-tile-b"><span class="hb-tile-l">${esc(kind === 't' ? a.label.replace(/^(Pre|Post)-test · /, '') : (B.days[i].skill || B.days[i].act.t === 'scramble' && 'Unscramble' || B.days[i].act.t === 'match' && 'Matching' || 'Vocabulary'))}</span><b>${esc(kind === 't' ? a.label.split(' · ')[0] + ' · 50 items' : a.title)}</b>
    <span class="hb-tile-s">${x ? `${starHtml(stars(x.best.pct))} best ${x.best.score}/${x.best.max}` : kind === 't' ? 'multiple choice' : '🎧 listen · activity'}</span></span></button>`; };
  box.innerHTML = `<div class="hb-gh">Pre-tests</div><div class="hb-path">${[0, 1].map(i => tile(tests[i], i, 't')).join('')}</div>
    <div class="hb-gh">Days 1–20 · listen, learn the words, practise</div><div class="hb-path">${days.map((a, i) => tile(a, i, 'd')).join('')}</div>
    <div class="hb-gh">Post-tests</div><div class="hb-path">${[2, 3].map(i => tile(tests[i], i, 't')).join('')}</div>`;
  $$('.hb-tile', box).forEach(b => b.onclick = () => { const i = +b.dataset.i;
    if(b.dataset.k === 't'){ const runT = (j) => H.playQuiz(c, tests, j, {sub: `Level 5 · ${B.label}`, theme: 'hs-l5', replay: runT}); return runT(i); }
    const run = (k) => playTask(c, l5Task(set, k), {sub: `Level 5 · Listening & Vocabulary · ${B.label}`, theme: 'hs-l5', replay: () => run(k), next: k < B.days.length - 1 ? () => run(k + 1) : null, nextLabel: k < B.days.length - 1 ? `Day ${B.days[k + 1].day}` : ''});
    run(i); });
}

/* ================================================================ Level 3 ================================================================ */
function l3Task(k){ const x = M.HUB_L3[k]; const S = [];
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  if(x.n <= 5){
    S.push({t: 'blend', label: 'Blend and say', items: x.words.map(w => [w[0], w[1], w.slice(2)]), note: 'Sound out each letter, then blend the word.'});
    S.push({t: 'build', label: 'Build a word', dir: 'Listen to the word, then build it with the letters.', words: pick(x.words, 10)});
    S.push({t: 'odd', label: 'Odd word out', dir: 'Which word does not belong? Tap 🔊 to hear the words.', rows: x.odd});
    S.push({t: 'flash', label: 'Speed read', dir: 'Read each word aloud as fast as you can.', items: x.speed});
    S.push({t: 'flash', label: 'Assessment', dir: 'Read each word correctly.', items: x.assess});
  } else if(x.n <= 10){ const fam = x.fam; const famOf = (w) => fam.findIndex(f => w.includes(f));
    const words = x.all.filter(w => famOf(w) >= 0);
    S.push({t: 'blend', label: 'Read the words', items: x.words.map(w => { const f = fam.find(f2 => w.includes(f2)) || ''; const i = w.indexOf(f); return f ? [w.slice(0, i) || '·', w.slice(i)].filter(p => p !== '·') : [w]; }), note: `Read each word aloud and let the learner repeat. Point to the “${fam.join('” / “')}” part.`});
    S.push({t: 'sort', label: 'Word sort', dir: 'Sort the words into the right word family.', bins: fam.map(f => '/' + f + '/'), words: words.slice(0, 12).map(w => [w, famOf(w)])});
    const lw = x.listen.length ? x.listen : x.words; S.push({t: 'mc', label: 'Listen and match', dir: 'Listen to the word and tap the one you hear.', items: lw.map(w => { const o = shuffle([w, ...pick(words.filter(z => z !== w), 3)]); return ['🔊', o, o.indexOf(w), null, w]; })});
    S.push({t: 'build', label: 'Spell it', dir: 'Listen, then spell the word with the letters.', words: pick(words, 8)});
    S.push({t: 'flash', label: 'Assessment', dir: 'Read each word correctly.', items: x.assess});
  } else if(x.n <= 20){ const bl = x.blends; const blOf = (w) => [...bl].sort((a, b) => b.length - a.length).find(b => w.startsWith(b));
    S.push({t: 'blend', label: 'Blend and say', items: x.words.map(w => { const b = blOf(w); return [b, w.slice(b.length)]; }), note: `Blend ${bl.map(b => b.split('').join(' + ') + ' = ' + b).join(' · ')}, then read the words.`});
    S.push({t: 'mc', label: 'Missing blend', dir: 'Which blend completes the word?', items: x.words.slice(0, 10).map(w => { const b = blOf(w); const o = bl.length > 1 ? bl.slice() : [b, ...pick(['bl','br','cl','cr','dr','fl','fr','gl','gr','pl','pr','st','tr','sl','sp'].filter(z => z !== b), 2)]; const opts = shuffle(o); return [`${L3E[w] || ''} ___${w.slice(b.length)}`.trim(), opts, opts.indexOf(b), null, null]; })});
    if(bl.length > 1) S.push({t: 'sort', label: 'Blend sort', dir: 'Sort the words by their beginning blend.', bins: bl.map(b => b + '-'), words: x.words.map(w => [w, bl.indexOf(blOf(w))])});
    S.push({t: 'build', label: 'Build a word', dir: 'Listen, then build the word.', words: pick(x.words.filter(w => w.length <= 7), 8)});
    S.push({t: 'flash', label: 'Assessment', dir: 'Read each word correctly.', items: x.assess});
  } else {
    S.push({t: 'flash', label: 'Sight words', dir: 'Read each word aloud.', items: x.words});
    S.push({t: 'mc', label: 'Listen and find', dir: 'Listen and tap the word you hear.', items: x.words.map(w => { const o = shuffle([w, ...pick(x.words.filter(z => z !== w), 3)]); return ['🔊', o, o.indexOf(w), null, w]; })});
    S.push({t: 'flash', label: 'Reading phrases', dir: 'Read each phrase aloud.', items: x.phrases});
    S.push({t: 'flash', label: 'Reading sentences', dir: 'Read each sentence aloud.', items: x.sentences});
    S.push({t: 'flash', label: 'Assessment', dir: 'Read each word correctly.', items: shuffle(x.words)});
  }
  return {id: `L3-${x.n}`, title: `Lesson ${x.n} · ${x.title}`, steps: S}; }
function l3Home(main, c, el){ const u = ui(); const A = M.HUB_L3;
  main.innerHTML = `<div class="row hb-bar">${H.tabsHtml([['play','Lessons'],['prog','Progress']], u.tab === 'keys' ? 'play' : u.tab)}<span class="spacer"></span><span class="small muted">Flash reading: the learner reads on their side, you tap ✓ or ✕ on yours</span></div><div id="hbTab"></div>`;
  $$('#hbTabs button', main).forEach(b => b.onclick = () => { u.tab = b.dataset.t; M.save(); M.views.readingHub(el); });
  const box = $('#hbTab', main); const items = A.map(x => ({id: `L3-${x.n}`, label: `Lesson ${x.n}`, title: x.title}));
  if(u.tab === 'prog') return H.progress(box, c, items, 'L3', (a) => a.label.slice(7));
  const r = u.who ? (((c.hub || {}).r || {})[u.who] || {}) : null;
  const G = [['CVC words', 1, 5], ['Word families', 6, 10], ['Consonant blends', 11, 20], ['Basic sight words', 21, 25]];
  box.innerHTML = G.map(([t, a, b]) => `<div class="hb-gh">${t}</div><div class="hb-path">${A.filter(x => x.n >= a && x.n <= b).map(x => { const y = r && r[`L3-${x.n}`];
    return `<button class="hb-tile l3 ${y ? 'done' : ''}" data-n="${x.n}"><span class="hb-tile-n">${x.n}</span><span class="hb-tile-b"><span class="hb-tile-l">${esc(x.focus)}${x.wordsBy ? ' <span class="hb-chk" title="The module shows these words as pictures — the word list was typed in for the Hub">words ✎</span>' : ''}</span><b>${esc(x.title)}</b><span class="hb-tile-s">${y ? `${starHtml(stars(y.best.pct))} best ${y.best.score}/${y.best.max}` : `${x.words.slice(0, 5).join(' · ')}…`}</span></span></button>`; }).join('')}</div>`).join('');
  $$('.hb-tile', box).forEach(b => b.onclick = () => { const k = A.findIndex(x => x.n === +b.dataset.n);
    const run = (j) => playTask(c, l3Task(j), {sub: 'Level 3 · Word Recognition', theme: 'hs-l3', replay: () => run(j), next: j < A.length - 1 ? () => run(j + 1) : null, nextLabel: j < A.length - 1 ? `Lesson ${A[j + 1].n}` : ''});
    run(k); });
}

/* ================================================================ Level 7 ================================================================ */
function l7Task(k){ const a = M.HUB_L7[k]; const S = [];
  if(a.info && a.info.length) S.push({t: 'info', label: 'Learn', p: a.info});
  if(a.kind !== 'match' && a.kind !== 'order') S.push({t: 'read', label: 'The task', title: a.title, kicker: `Activity ${a.n}`, p: a.prompt, example: a.example});
  if(a.kind === 'write') S.push({t: 'write', label: 'Write', sections: a.sections, check: a.check, rub: a.rub});
  if(a.kind === 'copy') S.push({t: 'copy', label: 'Copyread', article: a.article, heads: a.heads, rub: a.rub});
  if(a.kind === 'match') S.push({t: 'match', label: 'Match', dir: a.prompt[0], pairs: a.pairs});
  if(a.kind === 'order') S.push({t: 'order', label: 'Put in order', dir: a.prompt[0], items: a.items, labels: a.labels});
  if(a.kind === 'draw') S.push({t: 'draw', label: 'Draw the cartoon', dir: 'Draw your editorial cartoon. Add a caption.', rub: a.rub});
  if(a.kind === 'air'){ S.push({t: 'write', label: 'Write the script', sections: [{l: 'Your script', h: a.prompt.join(' '), rows: 6}], check: a.check, rub: null});
    S.push({t: 'air', label: 'On air', secs: a.secs, rub: a.rub}); }
  const task = {id: `L7-${a.n}`, title: `Activity ${a.n} · ${a.title}`, steps: S};
  return task; }
function l7Home(main, c, el){ const u = ui(); const A = M.HUB_L7;
  main.innerHTML = `<div class="row hb-bar">${H.tabsHtml([['play','Activities'],['prog','Progress']], u.tab === 'keys' ? 'play' : u.tab)}<span class="spacer"></span><span class="small muted">Learner writes on their side · you score with the rubric on yours</span></div><div id="hbTab"></div>`;
  $$('#hbTabs button', main).forEach(b => b.onclick = () => { u.tab = b.dataset.t; M.save(); M.views.readingHub(el); });
  const box = $('#hbTab', main); const items = A.map(x => ({id: `L7-${x.n}`, label: `Activity ${x.n}`, title: x.title}));
  if(u.tab === 'prog') return H.progress(box, c, items, 'L7', (a) => a.label.slice(9));
  const r = u.who ? (((c.hub || {}).r || {})[u.who] || {}) : null;
  const G = [['News writing', 1, 3, '📰'], ['Editorial writing', 4, 6, '🗞️'], ['Sports writing', 7, 9, '🏐'], ['Copyreading and headlines', 10, 12, '✏️'], ['Science and technology', 13, 15, '🔬'], ['Feature writing', 16, 18, '🌿'], ['Column writing', 19, 21, '🗂️'], ['Editorial cartooning', 22, 24, '🎨'], ['Radio broadcasting', 25, 27, '🎙️']];
  const KIND = {write: 'Write', copy: 'Copyread', match: 'Match', order: 'Order', draw: 'Draw', air: 'Write + on air'};
  box.innerHTML = G.map(([t, a, b, ic]) => `<div class="hb-gh">${ic} ${t}</div><div class="hb-path">${A.filter(x => x.n >= a && x.n <= b).map(x => { const y = r && r[`L7-${x.n}`];
    return `<button class="hb-tile l7 ${y ? 'done' : ''}" data-n="${x.n}"><span class="hb-tile-n">${x.n}</span><span class="hb-tile-b"><span class="hb-tile-l">${KIND[x.kind]}</span><b>${esc(x.title)}</b><span class="hb-tile-s">${y ? `${starHtml(stars(y.best.pct))} ${y.best.score}/${y.best.max}` : x.rub ? 'rubric-scored' : 'auto-checked'}</span></span></button>`; }).join('')}</div>`).join('');
  $$('.hb-tile', box).forEach(b => b.onclick = () => { const k = A.findIndex(x => x.n === +b.dataset.n);
    const run = (j) => { const t = l7Task(j); playTask(c, t, {sub: 'Level 7 · Genuine Love for Reading and Writing · Grade 7', theme: 'hs-l7', replay: () => run(j), next: j < A.length - 1 ? () => run(j + 1) : null, nextLabel: j < A.length - 1 ? `Activity ${A[j + 1].n}` : ''}); };
    run(k); });
}

H.homes.L3 = l3Home; H.homes.L5 = l5Home; H.homes.L7 = l7Home; H.L3E = L3E;
H.playTask = playTask;
})();
