/* MASTRO — Assessments: AI-made test papers.
   Grade + term → the competencies, topics and subtopics in the Budget of Work → number of items and test types →
   MASTRO writes the request for Claude → you paste Claude's reply → a finished test with an answer key,
   printable on A4 or 8.5 × 13 (0.5 in margins, 1, 2 or 4 copies per sheet) and downloadable as an editable Word file. */
(function () {
'use strict';
const M = window.M;
const {$, $$, esc, ico, fmt, isNum} = M;

const TYPES = [
  ['multiple_choice','Multiple Choice', 10],
  ['true_false','True or False', 5],
  ['modified_true_false','Modified True or False', 5],
  ['matching','Matching Type', 5],
  ['identification','Identification', 5],
  ['fill_blanks','Fill in the Blanks', 5],
  ['enumeration','Enumeration', 2],
  ['short_answer','Short Answer', 3],
  ['error_identification','Error Identification (grammar)', 5],
  ['essay','Essay / Writing Prompt', 1]
];
const TNAME = Object.fromEntries(TYPES.map(t => [t[0], t[1]]));
const KINDS = ['Quiz','Written Work','Summative Test','Term Examination','Diagnostic Test','Remediation / Enrichment'];
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
const L = 'abcdefghijklmnop';
const list = () => M.S.asm.filter(a => a.v === 2);
const getA = (id) => M.S.asm.find(a => a.id === id && a.v === 2);

/* =====================================================================
   LIST (history grouped by grade and term)
   ===================================================================== */
M.views.assess = function view(el, args){
  if(args[0] === 'new') return wizard(el);
  if(args[0]) return detail(el, args[0], args[1]);
  const all = list().sort((a, b) => b.created.localeCompare(a.created));
  const groups = {}; all.forEach(a => { const k = `Grade ${a.grade} · Term ${a.term}`; (groups[k] = groups[k] || []).push(a); });
  el.innerHTML = `
  <div class="card asm-hero"><div class="row">
    <div class="grow"><h2 style="margin:0">AI test maker ${M.newTag('asm-ai')}</h2>
      <div class="small muted" style="margin-top:4px">Pick the grade and term, choose competencies and topics from the Budget of Work, set the number of items and test types — Claude writes the test and the answer key. Print on A4 or 8.5 × 13, or download an editable Word file.</div></div>
    <a class="btn sparkle big" href="#assess/new" id="aNew">${ico('sparkle')} Create Assessment ${M.newTag('asm-create')}</a></div></div>
  ${all.length ? Object.entries(groups).map(([g, arr]) => `<div class="card" style="margin-top:20px"><div class="row"><h2 style="margin:0">${esc(g)}</h2><span class="chip">${arr.length} assessment(s)</span></div>
    <div class="grid g-3" style="margin-top:12px">${arr.map(a => `<div class="card form-card asm-card" style="padding:16px">
      <div class="row"><span class="chip green">${esc(a.kind)}</span><span class="spacer"></span><span class="tiny muted">${esc(a.created.slice(0,10))}</span></div>
      <div class="title" style="margin-top:8px"><b>${esc(a.title)}</b></div>
      <div class="small muted">${a.total} items · ${a.parts.map(p => esc(TNAME[p.type] || p.type)).join(', ')}</div>
      <div class="tiny muted" style="margin-top:4px">${a.compNames.slice(0,2).map(esc).join(' · ')}${a.compNames.length > 2 ? ` · +${a.compNames.length-2} more` : ''}</div>
      <div class="row" style="margin-top:12px"><a class="btn sm primary" href="#assess/${a.id}">Open</a><button class="btn sm" data-pr="${a.id}">${ico('print')} Print</button><button class="btn sm" data-dx="${a.id}">${ico('download')} Word</button></div></div>`).join('')}</div></div>`).join('')
    : `<div class="card" style="margin-top:20px"><div class="empty">No assessments yet. Tap <b>Create Assessment</b> to make your first test.</div></div>`}`;
  $$('[data-pr]', el).forEach(b => b.onclick = () => printDialog(getA(b.dataset.pr)));
  $$('[data-dx]', el).forEach(b => b.onclick = () => M.asmDocx(getA(b.dataset.dx)));
};

/* =====================================================================
   WIZARD
   ===================================================================== */
const newWiz = () => ({grade: String((M.S.ecr[0] && M.S.ecr[0].grade) || '7'), term: '1', sel: {}, lesson: '', title: '', kind: 'Summative Test',
  parts: [{type:'multiple_choice', n:15}, {type:'identification', n:5}], mix: [60, 30, 10], choices: 4, passage: 'auto', notes: '', reply: ''});
function wizard(el){
  const w = M.asmWiz = M.asmWiz || newWiz();
  const B = M.BOW[w.grade]; const T = B && B.terms[w.term];
  const total = w.parts.reduce((s, p) => s + (+p.n || 0), 0);
  const selComps = () => T ? T.sections.flatMap(s => s.comps).filter(c => w.sel[c.id]) : [];
  const topicTree = (nodes, cid, depth) => nodes.length ? `<div class="tp-tree" style="margin-left:${depth ? 18 : 26}px">${nodes.map(n => `<label class="tp-node"><input type="checkbox" data-topic="${n.id}" data-comp="${cid}" ${w.sel[cid] && w.sel[cid][n.id] ? 'checked' : ''}> <span>${esc(n.t)}</span></label>${topicTree(n.kids, cid, depth + 1)}`).join('')}</div>` : '';
  el.innerHTML = `
  <div class="card"><div class="row"><a class="btn sm" href="#assess">${ico('left','width:16px;height:16px')} Assessments</a><h2 style="margin:0 0 0 6px">Create Assessment</h2><span class="spacer"></span><button class="btn sm" id="wReset">Start over</button></div></div>
  <div class="card wz-step" style="margin-top:20px"><div class="wz-n">1</div><div class="grow">
    <h2 style="margin:0">Grade level and term</h2>
    <div class="row" style="margin-top:12px"><div class="seg" id="wG">${Object.keys(M.BOW).map(g => `<button data-g="${g}" class="${g===w.grade?'on':''}">Grade ${g} English</button>`).join('')}</div>
      <div class="seg" id="wT">${['1','2','3'].map(t => `<button data-t="${t}" class="${t===w.term?'on':''}">Term ${t}</button>`).join('')}</div></div>
    ${T ? `<details class="small" style="margin-top:12px"><summary><b>Content and performance standards</b></summary><p class="muted"><b>Content standard:</b> ${esc(T.cs)}</p><p class="muted"><b>Performance standard:</b> ${esc(T.ps)}</p></details>` : ''}</div></div>
  <div class="card wz-step" style="margin-top:20px"><div class="wz-n">2</div><div class="grow">
    <div class="row"><h2 style="margin:0">Competencies, topics and subtopics</h2><span class="spacer"></span><span class="chip ${selComps().length?'green':''}">${selComps().length} competenc${selComps().length===1?'y':'ies'} selected</span></div>
    <p class="small muted">From the Grade ${esc(w.grade)} English Budget of Work, Term ${esc(w.term)}. Tick a competency, then the topics / subtopics you taught (leave topics unticked to cover the whole competency).</p>
    ${T ? T.sections.map(s => `<div class="bow-sec"><div class="bow-dom">${esc(s.domain)}</div><div class="bow-foc">${esc(s.focus)}</div>
      ${s.comps.map(c => `<div class="bow-comp ${w.sel[c.id]?'on':''}"><label class="tp-comp"><input type="checkbox" data-c="${c.id}" ${w.sel[c.id]?'checked':''}> <b>${esc(c.text)}</b></label>${topicTree(c.topics, c.id, 0)}</div>`).join('')}</div>`).join('') : '<div class="empty">No Budget of Work for this grade.</div>'}
    <label class="field" style="margin-top:12px">Lesson, literary piece or text you used (optional — helps Claude make the items match what you taught)<textarea class="input" id="wLesson" rows="2" placeholder="e.g. title and author of the poem or story discussed, the news article used, or key points of your lesson">${esc(w.lesson)}</textarea></label></div></div>
  <div class="card wz-step" style="margin-top:20px"><div class="wz-n">3</div><div class="grow">
    <h2 style="margin:0">Number of items and type of test</h2>
    <div class="grid g-2" style="margin-top:12px;gap:12px">
      <label class="field">Title<input class="input" id="wTitle" value="${esc(w.title)}" placeholder="${esc(defaultTitle(w))}"></label>
      <label class="field">Kind of assessment<select class="input" id="wKind">${KINDS.map(k => `<option ${k===w.kind?'selected':''}>${k}</option>`).join('')}</select></label></div>
    <table class="wz-parts"><thead><tr><th>Test part</th><th>Type of test</th><th>No. of items</th><th></th></tr></thead><tbody>
      ${w.parts.map((p, i) => `<tr><td><b>Test ${ROMAN[i]}</b></td><td><select class="input" data-pt="${i}">${TYPES.map(([k, l]) => `<option value="${k}" ${k===p.type?'selected':''}>${l}</option>`).join('')}</select></td><td><input class="input" data-pn="${i}" value="${p.n}" inputmode="numeric" style="width:80px"></td><td>${w.parts.length > 1 ? `<button class="icon-btn" data-prm="${i}" title="Remove part">✕</button>` : ''}</td></tr>`).join('')}
    </tbody></table>
    <div class="row" style="margin-top:8px">${w.parts.length < 8 ? `<button class="btn sm" id="wAddPart">${ico('plus')} Add a test part</button>` : ''}<span class="spacer"></span><b>Total: ${total} item(s)</b></div>
    <div class="grid g-3" style="margin-top:14px;gap:12px">
      <label class="field">Easy / Average / Difficult (%)<div class="row" style="gap:6px">${w.mix.map((v, i) => `<input class="input" data-mix="${i}" value="${v}" inputmode="numeric" style="width:64px">`).join('')}</div></label>
      <label class="field">Choices for multiple choice<select class="input" id="wCh"><option value="4" ${w.choices==4?'selected':''}>4 (a–d)</option><option value="5" ${w.choices==5?'selected':''}>5 (a–e)</option><option value="3" ${w.choices==3?'selected':''}>3 (a–c)</option></select></label>
      <label class="field">Reading passage<select class="input" id="wPass"><option value="auto" ${w.passage==='auto'?'selected':''}>When the competency needs one</option><option value="yes" ${w.passage==='yes'?'selected':''}>Yes, include original passage(s)</option><option value="no" ${w.passage==='no'?'selected':''}>No passage</option></select></label></div>
    <label class="field" style="margin-top:12px">Other instructions for Claude (optional)<input class="input" id="wNotes" value="${esc(w.notes)}" placeholder="e.g. use local (Bukidnon) settings and names; avoid 'all of the above'"></label></div></div>
  <div class="card wz-step" style="margin-top:20px"><div class="wz-n">4</div><div class="grow">
    <h2 style="margin:0">Generate with Claude</h2>
    <ol class="small wz-how"><li>Tap <b>Copy request</b>, then <b>Open Claude</b> and paste it (MASTRO also tries to fill it in for you).</li><li>When Claude answers, copy its whole reply.</li><li>Paste it below and tap <b>Build my assessment</b>.</li></ol>
    <div class="row"><button class="btn primary" id="wCopy" ${selComps().length && total ? '' : 'disabled'}>${ico('download')} Copy request</button><button class="btn sparkle" id="wOpen" ${selComps().length && total ? '' : 'disabled'}>${ico('sparkle')} Open Claude</button>
      <details class="small" style="margin-left:6px"><summary>See the request</summary><pre class="wz-prompt">${esc(selComps().length ? buildPrompt(w) : 'Select at least one competency first.')}</pre></details></div>
    <label class="field" style="margin-top:14px">Paste Claude's reply here<textarea class="input mono" id="wReply" rows="7" placeholder="Paste the whole reply (it contains the test as JSON)">${esc(w.reply)}</textarea></label>
    <div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn primary big" id="wBuild">${ico('sparkle')} Build my assessment</button></div></div></div>`;
  const rer = () => wizard(el);
  $('#wReset', el).onclick = () => { if(!confirm('Clear this form and start over?')) return; M.asmWiz = newWiz(); rer(); };
  $('#wG', el).onclick = e => { const b = e.target.closest('button'); if(!b) return; w.grade = b.dataset.g; w.sel = {}; rer(); };
  $('#wT', el).onclick = e => { const b = e.target.closest('button'); if(!b) return; w.term = b.dataset.t; w.sel = {}; rer(); };
  el.onchange = e => { const x = e.target;
    if(x.dataset.c){ if(x.checked) w.sel[x.dataset.c] = w.sel[x.dataset.c] || {}; else delete w.sel[x.dataset.c]; rer(); }
    else if(x.dataset.topic){ const c = x.dataset.comp; w.sel[c] = w.sel[c] || {}; if(x.checked) w.sel[c][x.dataset.topic] = 1; else delete w.sel[c][x.dataset.topic]; rer(); }
    else if(x.dataset.pt !== undefined){ const p = w.parts[+x.dataset.pt]; p.type = x.value; p.n = (TYPES.find(t => t[0] === x.value) || [])[2] || p.n; rer(); }
    else if(x.dataset.pn !== undefined){ w.parts[+x.dataset.pn].n = Math.max(1, Math.min(100, parseInt(x.value) || 1)); rer(); }
    else if(x.dataset.mix !== undefined){ w.mix[+x.dataset.mix] = Math.max(0, Math.min(100, parseInt(x.value) || 0)); rer(); }
    else if(x.id === 'wKind'){ w.kind = x.value; rer(); } else if(x.id === 'wCh'){ w.choices = +x.value; rer(); } else if(x.id === 'wPass'){ w.passage = x.value; rer(); } };
  el.oninput = e => { const x = e.target; if(x.id === 'wLesson') w.lesson = x.value; if(x.id === 'wTitle') w.title = x.value; if(x.id === 'wNotes') w.notes = x.value; if(x.id === 'wReply') w.reply = x.value; };
  $$('[data-prm]', el).forEach(b => b.onclick = () => { w.parts.splice(+b.dataset.prm, 1); rer(); });
  if($('#wAddPart', el)) $('#wAddPart', el).onclick = () => { const used = new Set(w.parts.map(p => p.type)); const t = TYPES.find(x => !used.has(x[0])) || TYPES[0]; w.parts.push({type: t[0], n: t[2]}); rer(); };
  const copy = async () => { const txt = buildPrompt(w); try { await navigator.clipboard.writeText(txt); M.toast('Request copied — paste it in Claude'); return true; } catch(e){ const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); M.toast('Request copied'); } catch(_){ alert('Copy the request from “See the request”.'); } ta.remove(); return true; } };
  $('#wCopy', el).onclick = copy;
  $('#wOpen', el).onclick = async () => { await copy(); const txt = buildPrompt(w); const url = 'https://claude.ai/new' + (txt.length < 7000 ? '?q=' + encodeURIComponent(txt) : ''); window.open(url, '_blank', 'noopener'); };
  $('#wBuild', el).onclick = () => { const txt = $('#wReply', el).value.trim(); if(!txt) return M.toast('Paste Claude’s reply first');
    let data; try { data = parseReply(txt); } catch(err){ return alert('MASTRO could not read that reply: ' + err.message + '\n\nTip: ask Claude “Please send the whole test again as one JSON code block only.” then paste that.'); }
    const a = buildAsm(w, data); M.S.asm.push(a); M.save(); w.reply = ''; M.asmWiz = null; location.hash = '#assess/' + a.id; M.toast('Assessment ready'); };
}
function defaultTitle(w){ return `${w.kind || 'Summative Test'} in English ${w.grade} – Term ${w.term}`; }

/* ---------- the request sent to Claude ---------- */
function buildPrompt(w){
  const B = M.BOW[w.grade], T = B.terms[w.term];
  const comps = T.sections.flatMap(s => s.comps.map(c => ({s, c}))).filter(x => w.sel[x.c.id]);
  const topicLines = (nodes, picked, depth) => nodes.flatMap(n => { const inner = topicLines(n.kids, picked, depth + 1); const on = !picked || picked[n.id]; return (on || inner.length) ? [`${'  '.repeat(depth)}- ${n.t}${picked && picked[n.id] ? '' : ''}`, ...inner] : []; });
  const compText = comps.map(({s, c}, i) => { const picked = Object.keys(w.sel[c.id] || {}).length ? w.sel[c.id] : null;
    const tl = topicLines(c.topics, picked, 1); return `${i+1}. ${c.text}  [${s.domain} — ${s.focus}]${tl.length ? '\n   Topics / subtopics to cover:\n' + tl.map(x => '   ' + x).join('\n') : ''}`; }).join('\n');
  const parts = w.parts.map((p, i) => `- Test ${ROMAN[i]}: ${TNAME[p.type]} — ${p.n} ${p.type === 'essay' ? 'prompt(s)' : 'item(s)'}`).join('\n');
  const total = w.parts.reduce((s, p) => s + (+p.n || 0), 0);
  return `You are an experienced Filipino English teacher writing a ${w.kind.toLowerCase()} for Grade ${w.grade} English learners in a public junior high school (DepEd, Philippines), Term ${w.term}, based on the DepEd Three-Term Budget of Work.

CONTENT STANDARD: ${T.cs}
PERFORMANCE STANDARD: ${T.ps}

LEARNING COMPETENCIES TO ASSESS (assess only these):
${compText}
${w.lesson ? `\nLESSON / TEXT TAUGHT: ${w.lesson}\n` : ''}
TEST DESIGN (${total} items in all):
${parts}
- Difficulty: about ${w.mix[0]}% easy (remembering/understanding), ${w.mix[1]}% average (applying/analyzing), ${w.mix[2]}% difficult (evaluating/creating).
- Multiple choice: exactly ${w.choices} options each, one clearly correct answer, plausible distractors, no "all/none of the above"; spread the correct letters evenly.
- Reading passage: ${w.passage === 'yes' ? 'include one or more ORIGINAL passages that the items refer to.' : w.passage === 'no' ? 'do not include a passage; items must stand alone.' : 'if a competency needs a text (e.g. analyzing a poem, story, news article, essay or letter), write a short ORIGINAL passage for it; otherwise no passage.'} Write every passage yourself (never copy published or copyrighted texts); use Filipino names, places and situations.
- Language suitable for Grade ${w.grade}; clear, grammatical, gender-fair and culturally sensitive.
- Matching type: Column B has 2 more options than Column A.
- Modified True or False: put the word or phrase being judged in square brackets, e.g. "The [climax] is the turning point." The answer is "True" or the word that makes it true.
- Error identification: mark four parts of each sentence as [A: ...] [B: ...] [C: ...] [D: ...]; the answer is the letter of the error.
- Essay / writing prompt: give points and a short analytic rubric (criteria with points).
${w.notes ? `- Also: ${w.notes}\n` : ''}
REPLY FORMAT — reply with ONE JSON code block only, exactly in this shape:
\`\`\`json
{
  "title": "${(w.title || defaultTitle(w)).replace(/"/g, "'")}",
  "general_directions": "…",
  "passages": [ { "id": "P1", "title": "…", "text": "paragraphs separated by \\n\\n" } ],
  "parts": [
    { "type": "multiple_choice", "title": "Multiple Choice", "directions": "…", "passage": "P1 or null",
      "items": [ { "q": "…", "choices": ["…","…","…","…"], "answer": "B", "competency": "competency number from the list", "level": "Remembering|Understanding|Applying|Analyzing|Evaluating|Creating" } ] },
    { "type": "true_false", "title": "…", "directions": "…", "items": [ { "q": "…", "answer": "True" } ] },
    { "type": "modified_true_false", "items": [ { "q": "… [word] …", "answer": "True or the correct word" } ] },
    { "type": "matching", "title": "…", "directions": "…", "items": [ { "q": "Column A entry", "answer": "C" } ], "choices": ["Column B option a", "…"] },
    { "type": "identification", "items": [ { "q": "…", "answer": "…" } ], "word_bank": ["optional"] },
    { "type": "fill_blanks", "items": [ { "q": "sentence with ______", "answer": "…" } ], "word_bank": ["optional"] },
    { "type": "enumeration", "items": [ { "q": "Give three …", "answer": ["…","…","…"] } ] },
    { "type": "short_answer", "items": [ { "q": "…", "answer": "model answer" } ] },
    { "type": "error_identification", "items": [ { "q": "[A: …] [B: …] [C: …] [D: …]", "answer": "B" } ] },
    { "type": "essay", "items": [ { "q": "prompt", "points": 10, "rubric": [ { "criterion": "…", "points": 4 } ], "answer": "what a good response includes" } ] }
  ]
}
\`\`\`
Use only the part types listed in TEST DESIGN, in that order, with exactly the number of items asked. Every item must have its "competency" number and an "answer". No text outside the JSON block.`;
}

/* ---------- reading Claude's reply ---------- */
function parseReply(txt){
  let s = txt; const f = s.match(/```(?:json)?\s*([\s\S]*?)```/i); if(f) s = f[1];
  const a = s.indexOf('{'), b = s.lastIndexOf('}'); if(a < 0 || b < a) throw new Error('no JSON found');
  s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch(e){}
  const fixed = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch(e){ throw new Error('the JSON is incomplete or broken (' + e.message + ')'); }
}
function buildAsm(w, d){
  const B = M.BOW[w.grade], T = B.terms[w.term];
  const comps = T.sections.flatMap(s => s.comps).filter(c => w.sel[c.id]);
  const parts = (d.parts || []).map(p => {
    const type = TNAME[p.type] ? p.type : /choice/i.test(p.type) ? 'multiple_choice' : /match/i.test(p.type) ? 'matching' : /modified/i.test(p.type) ? 'modified_true_false' : /true|false/i.test(p.type) ? 'true_false' : /blank|completion/i.test(p.type) ? 'fill_blanks' : /enumer/i.test(p.type) ? 'enumeration' : /essay|writing/i.test(p.type) ? 'essay' : /error/i.test(p.type) ? 'error_identification' : /short/i.test(p.type) ? 'short_answer' : 'identification';
    const items = (p.items || []).map(it => typeof it === 'string' ? {q: it} : it).map(it => ({q: String(it.q ?? it.question ?? ''), choices: Array.isArray(it.choices) ? it.choices.map(String) : null, answer: it.answer ?? '', competency: it.competency ?? '', level: it.level || '', points: it.points, rubric: Array.isArray(it.rubric) ? it.rubric : null}));
    return {type, title: p.title || TNAME[type], directions: p.directions || '', passage: p.passage || null, items, choices: Array.isArray(p.choices) ? p.choices.map(String) : null, word_bank: Array.isArray(p.word_bank) && p.word_bank.length ? p.word_bank.map(String) : null};
  }).filter(p => p.items.length);
  if(!parts.length) throw new Error('no test parts in the reply');
  const total = parts.reduce((s, p) => s + itemsPoints(p), 0);
  return {v: 2, id: M.uid('as'), created: new Date().toISOString(), grade: w.grade, term: w.term, kind: w.kind, title: d.title || w.title || defaultTitle(w),
    directions: d.general_directions || '', passages: Array.isArray(d.passages) ? d.passages.filter(p => p && p.text) : [], parts, total,
    comps: comps.map(c => c.id), compNames: comps.map(c => c.text), sel: JSON.parse(JSON.stringify(w.sel)), lesson: w.lesson, design: w.parts.map(p => ({...p})), mix: w.mix.slice()};
}
const itemsPoints = (p) => p.type === 'essay' ? p.items.reduce((s, it) => s + (+it.points || 0), 0) || p.items.length : p.type === 'enumeration' ? p.items.reduce((s, it) => s + (Array.isArray(it.answer) ? it.answer.length : 1), 0) : p.items.length;

/* =====================================================================
   TEST PAPER (one HTML used on screen, for printing and for measuring)
   ===================================================================== */
// [word] → underlined; [A: text] → underlined text with a letter under it
const fmtQ = (q, type) => { let s = esc(q);
  if(type === 'error_identification') s = s.replace(/\[([A-E])\s*:\s*([^\]]+)\]/g, '<span class="ei"><u>$2</u><sub>$1</sub></span>');
  s = s.replace(/\[([^\]]+)\]/g, '<u>$1</u>'); return s.replace(/_{3,}/g, m => `<span class="blank">${'&nbsp;'.repeat(Math.max(8, m.length))}</span>`); };
const ansText = (it) => Array.isArray(it.answer) ? it.answer.join(', ') : String(it.answer ?? '');
M.asmPaperHtml = function(a, opts = {}){
  const S = M.S.settings; const sl = M.sealsHtml(); let no = 0; const ed = !!opts.edit;
  // editable text (on screen): raw text with [markers] visible; printed text: formatted
  const E = (path, raw, html) => ed ? `<span class="ed" contenteditable="true" spellcheck="true" data-e="${path}">${esc(raw ?? '')}</span>` : (html ?? esc(raw ?? ''));
  const head = opts.header === false ? '' : `<div class="tp-head">${sl.l}<div class="tp-hc"><div>Republic of the Philippines · Department of Education</div><div class="b">${esc(S.school || '')}</div><div>${esc(S.address || '')}</div></div>${sl.r}</div>`;
  const pass = (id) => { const k = a.passages.findIndex(x => x.id === id); const p = a.passages[k]; if(!p) return '';
    return `<div class="tp-pass">${p.title || ed ? `<div class="pt">${E(`ps${k}.title`, p.title)}</div>` : ''}${ed ? `<div class="ed pre" contenteditable="true" data-e="ps${k}.text">${esc(p.text)}</div>` : String(p.text).split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('')}</div>`; };
  const usedPass = new Set(a.parts.map(p => p.passage).filter(Boolean));
  const loose = a.passages.filter(p => !usedPass.has(p.id));
  const part = (p, i) => {
    const pts = itemsPoints(p);
    let body = '';
    if(p.type === 'matching'){ const ch = p.choices || [];
      body = `<div class="tp-match"><div><div class="mh">Column A</div>${p.items.map((it, j) => `<div class="tp-it"><span class="ln"></span><span class="n">${++no}.</span><span class="q">${E(`p${i}.i${j}.q`, it.q, fmtQ(it.q, p.type))}</span></div>`).join('')}</div>
        <div><div class="mh">Column B</div>${ch.map((c, k) => `<div class="tp-it"><span class="n">${L[k]}.</span><span class="q">${E(`p${i}.ch${k}`, c)}</span></div>`).join('')}</div></div>`; }
    else body = p.items.map((it, j) => { no++; const q = E(`p${i}.i${j}.q`, it.q, fmtQ(it.q, p.type));
      if(p.type === 'multiple_choice'){ const chs = (it.choices || []).map(c => String(c).replace(/^[a-eA-E][.)]\s+/, '')); const long = chs.some(c => c.length > 28);
        return `<div class="tp-it mc"><span class="n">${no}.</span><div class="q">${q}<div class="tp-ch ${long ? 'one' : chs.every(c => c.length <= 16) ? 'four' : chs.length > 4 ? 'three' : 'two'}">${chs.map((c, k) => `<span><b>${L[k]}.</b> ${E(`p${i}.i${j}.c${k}`, c)}</span>`).join('')}</div></div></div>`; }
      if(['true_false','modified_true_false','identification','error_identification'].includes(p.type)) return `<div class="tp-it"><span class="ln ${p.type==='identification'?'wide':''}"></span><span class="n">${no}.</span><span class="q">${q}</span></div>`;
      if(p.type === 'enumeration'){ const k = Array.isArray(it.answer) ? it.answer.length : 3; return `<div class="tp-it"><span class="n">${no}.</span><div class="q">${q}${[...Array(k).keys()].map(x => `<div class="tp-line">${x+1}. </div>`).join('')}</div></div>`; }
      if(p.type === 'short_answer') return `<div class="tp-it"><span class="n">${no}.</span><div class="q">${q}<div class="tp-line"></div><div class="tp-line"></div></div></div>`;
      if(p.type === 'essay') return `<div class="tp-it"><span class="n">${no}.</span><div class="q">${q}${it.points ? ` <i>(${it.points} points)</i>` : ''}${it.rubric ? `<div class="tp-rub">${it.rubric.map(r => `<span>${esc(r.criterion || r.name || '')} — ${esc(r.points ?? '')} pts</span>`).join('')}</div>` : ''}${[...Array(opts.compact ? 4 : 7)].map(() => '<div class="tp-line"></div>').join('')}</div></div>`;
      return `<div class="tp-it"><span class="n">${no}.</span><span class="q">${q}</span></div>`; }).join('');
    const bank = p.word_bank ? `<div class="tp-bank">${p.word_bank.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';
    return `<div class="tp-part"><div class="tp-pt">Test ${ROMAN[i]}. ${E(`p${i}.title`, p.title || TNAME[p.type])} <span class="pts">(${pts} pt${pts===1?'':'s'})</span></div>${p.directions || ed ? `<div class="tp-dir"><b>Directions:</b> ${E(`p${i}.directions`, p.directions)}</div>` : ''}${p.passage ? pass(p.passage) : ''}${bank}${body}</div>`; };
  return `<div class="tp ${opts.compact ? 'compact' : ''}">${head}
    <div class="tp-title">${E('title', a.title)}</div><div class="tp-sub">English ${esc(a.grade)} · Term ${esc(a.term)} · ${a.total} points</div>
    <div class="tp-name"><span>Name: <i></i></span><span>Grade &amp; Section: <i></i></span><span>Date: <i class="s"></i></span><span>Score: <i class="s"></i> / ${a.total}</span></div>
    ${a.directions || ed ? `<div class="tp-dir"><b>General directions:</b> ${E('directions', a.directions)}</div>` : ''}
    ${loose.map(p => pass(p.id)).join('')}
    ${a.parts.map(part).join('')}</div>`;
};
// save an edit made on the test paper
function setPath(a, path, v){
  let m;
  if(path === 'title') a.title = v || a.title; else if(path === 'directions') a.directions = v;
  else if((m = path.match(/^ps(\d+)\.(title|text)$/))) a.passages[+m[1]][m[2]] = v;
  else if((m = path.match(/^p(\d+)\.(title|directions)$/))) a.parts[+m[1]][m[2]] = v;
  else if((m = path.match(/^p(\d+)\.ch(\d+)$/))) a.parts[+m[1]].choices[+m[2]] = v;
  else if((m = path.match(/^p(\d+)\.i(\d+)\.q$/))) a.parts[+m[1]].items[+m[2]].q = v;
  else if((m = path.match(/^p(\d+)\.i(\d+)\.c(\d+)$/))) a.parts[+m[1]].items[+m[2]].choices[+m[3]] = v;
  M.save();
}
M.asmKeyHtml = function(a){ let no = 0;
  return `<div class="tp tp-key"><div class="tp-title">ANSWER KEY</div><div class="tp-sub">${esc(a.title)} · English ${esc(a.grade)} · Term ${esc(a.term)} · ${a.total} points</div>
    ${a.parts.map((p, i) => `<div class="tp-part"><div class="tp-pt">Test ${ROMAN[i]}. ${esc(p.title || TNAME[p.type])}</div><div class="key-cols">${p.items.map(it => { no++; const extra = p.type === 'essay' && it.rubric ? `<div class="tiny">${it.rubric.map(r => `${esc(r.criterion || '')} (${esc(r.points ?? '')})`).join(' · ')}</div>` : '';
      return `<div class="key-it"><b>${no}.</b> ${esc(p.type === 'matching' || p.type === 'multiple_choice' || p.type === 'error_identification' ? String(ansText(it)).toLowerCase().replace(/^([a-e])$/, '$1') : ansText(it))}${extra}</div>`; }).join('')}</div></div>`).join('')}</div>`; };

/* =====================================================================
   DETAIL (preview, answer key, coverage; edit in place)
   ===================================================================== */
function detail(el, id, tab){
  const a = getA(id); if(!a){ el.innerHTML = '<div class="card"><div class="empty">Assessment not found.</div></div>'; return; }
  tab = tab || 'paper';
  el.innerHTML = `
  <div class="card"><div class="row">
    <a class="btn sm" href="#assess">${ico('left','width:16px;height:16px')} Assessments</a>
    <div><div class="title"><b>${esc(a.title)}</b></div><div class="small muted">${esc(a.kind)} · Grade ${esc(a.grade)} English · Term ${esc(a.term)} · ${a.total} points · ${a.parts.length} part(s)</div></div>
    <span class="spacer"></span>
    <button class="btn primary" id="dPrint">${ico('print')} Print</button><button class="btn gold" id="dDocx">${ico('download')} Word (.docx)</button><button class="btn sm danger" id="dDel">Delete</button></div>
    <div class="seg" id="dTabs" style="margin-top:14px">${[['paper','Test paper'],['key','Answer key'],['cov','Competencies covered']].map(([k, l]) => `<button data-t="${k}" class="${k===tab?'on':''}">${l}</button>`).join('')}</div>
    ${tab === 'paper' ? '<p class="tiny muted" style="margin:10px 0 0">Tap any title, direction, passage, question or choice to edit it — words in [square brackets] print underlined. Changes are saved for printing and the Word file.</p>' : ''}</div>
  <div id="dBody" style="margin-top:20px"></div>`;
  $('#dTabs', el).onclick = e => { const b = e.target.closest('button'); if(b) location.hash = `#assess/${a.id}/${b.dataset.t}`; };
  $('#dPrint', el).onclick = () => printDialog(a);
  $('#dDocx', el).onclick = () => M.asmDocx(a);
  $('#dDel', el).onclick = () => { if(!confirm(`Delete “${a.title}”?`)) return; M.S.asm = M.S.asm.filter(x => x !== a); M.save(); location.hash = '#assess'; };
  const body = $('#dBody', el);
  if(tab === 'paper'){ body.innerHTML = `<div class="tp-sheet">${M.asmPaperHtml(a, {edit: true})}</div>`;
    body.addEventListener('focusout', e => { const x = e.target.closest('[data-e]'); if(!x) return; setPath(a, x.dataset.e, x.dataset.e.endsWith('.text') ? x.innerText.trim() : x.textContent.trim()); }); }
  if(tab === 'key'){ let no = 0;
    body.innerHTML = `<div class="card"><h2>Answer key</h2><p class="small muted" style="margin-top:0">Edit any answer. The key prints on its own page and is included in the Word file.</p>
      ${a.parts.map((p, i) => `<h3>Test ${ROMAN[i]}. ${esc(p.title || TNAME[p.type])}</h3><div class="key-grid2">${p.items.map((it, j) => { no++; return `<label><span>${no}.</span><input class="input" data-kp="${i}" data-ki="${j}" value="${esc(ansText(it))}"></label>`; }).join('')}</div>`).join('')}</div>`;
    body.oninput = e => { const x = e.target; if(x.dataset.kp === undefined) return; const it = a.parts[+x.dataset.kp].items[+x.dataset.ki]; it.answer = Array.isArray(it.answer) ? x.value.split(',').map(s => s.trim()).filter(Boolean) : x.value; clearTimeout(body._t); body._t = setTimeout(M.save, 400); }; }
  if(tab === 'cov'){ const B = M.BOW[a.grade]; const T = B && B.terms[a.term]; const comps = T ? T.sections.flatMap(s => s.comps).filter(c => a.comps.includes(c.id)) : [];
    let no = 0; const byComp = {}; const lv = {}; a.parts.forEach(p => p.items.forEach(it => { no++; const k = String(it.competency || '').match(/\d+/); const key = k ? +k[0] : 0; (byComp[key] = byComp[key] || []).push(no); if(it.level) lv[it.level] = (lv[it.level] || 0) + 1; }));
    body.innerHTML = `<div class="card"><h2>Competencies covered</h2><div class="table-wrap" style="max-height:none"><table><thead><tr><th>#</th><th>Competency (Budget of Work, Term ${esc(a.term)})</th><th>Items</th><th class="num">Count</th></tr></thead><tbody>
      ${comps.map((c, i) => `<tr><td>${i+1}</td><td>${esc(c.text)}</td><td class="small">${(byComp[i+1] || []).join(', ')}</td><td class="num">${(byComp[i+1] || []).length}</td></tr>`).join('')}
      ${byComp[0] ? `<tr><td></td><td class="muted">Not tagged</td><td class="small">${byComp[0].join(', ')}</td><td class="num">${byComp[0].length}</td></tr>` : ''}</tbody></table></div>
      ${Object.keys(lv).length ? `<h3 style="margin-top:14px">Cognitive levels</h3><div class="chips">${Object.entries(lv).map(([k, v]) => `<span class="chip">${esc(k)} ${v}</span>`).join('')}</div>` : ''}
      ${a.lesson ? `<p class="small" style="margin-top:12px"><b>Lesson / text:</b> ${esc(a.lesson)}</p>` : ''}</div>`; }
}
/* =====================================================================
   PRINT: A4 or 8.5 × 13 with 0.5 in margins; 1, 2 or 4 copies per sheet (never overflowing)
   ===================================================================== */
const PAPER = {A4:{label:'A4 (210 × 297 mm)', key:'A4'}, FOLIO:{label:'8.5 × 13 in (long bond / folio)', key:'FOLIO'}};
// largest scale k (≤ 1) at which the paper fits a cell of cw × ch mm
function fitScale(html, cw, ch){ const px = 96 / 25.4; for(const k of [1, .95, .9, .85, .8, .75, .7, .66, .62, .58, .55, .52, .5, .47, .44, .41, .38]){ const m = M.measurePrint(html, cw / k); if(m.h * k <= ch * px - 2) return k; } return 0; }
function layoutFor(a, paper, per){
  const [W, H] = M.printableMm(M.pageCss(paper)); const pw = Math.floor(W * 10) / 10 - 0.4, ph = Math.floor(H * 10) / 10 - 0.6;
  if(per === 1) return {pw, ph, per, k: 1, ok: true};
  const cw = per === 4 ? pw / 2 - 2 : pw, ch = ph / 2 - 2; const html = M.asmPaperHtml(a, {compact: true});
  const k = fitScale(html, cw, ch); return {pw, ph, per, cw, ch, k, ok: k >= 0.5, html};
}
function printHtml(a, o){
  const L0 = layoutFor(a, o.paper, o.per); const pages = [];
  if(o.per === 1){ for(let i=0;i<o.sheets;i++) pages.push(`<div class="asm-copy">${M.asmPaperHtml(a)}</div>`); }
  else { for(let i=0;i<o.sheets;i++){ const cells = []; for(let j=0;j<o.per;j++){ const x = o.per === 4 ? (j % 2) * (L0.pw / 2) : 0, y = Math.floor(o.per === 4 ? j / 2 : j) * (L0.ph / 2);
      cells.push(`<div class="asm-cell" style="left:${x.toFixed(1)}mm;top:${y.toFixed(1)}mm;width:${(o.per === 4 ? L0.pw / 2 : L0.pw).toFixed(1)}mm;height:${(L0.ph / 2).toFixed(1)}mm"><div style="width:${(L0.cw / L0.k).toFixed(2)}mm;transform:scale(${L0.k.toFixed(4)});transform-origin:0 0;margin:1mm">${L0.html}</div></div>`); }
    pages.push(`<div class="asm-page" style="width:${L0.pw}mm;height:${L0.ph}mm">${o.per === 4 ? `<i class="cut v" style="left:${(L0.pw/2).toFixed(1)}mm"></i>` : ''}<i class="cut h" style="top:${(L0.ph/2).toFixed(1)}mm"></i>${cells.join('')}</div>`); } }
  if(o.key) pages.push(`<div class="asm-copy">${M.asmKeyHtml(a)}</div>`);
  return pages.join('');
}
function printDialog(a){
  if(!a) return; const ui = printDialog.ui = printDialog.ui || {paper:'A4', per:1, sheets:1, key:true};
  const fits = {}; ['A4','FOLIO'].forEach(pp => [1,2,4].forEach(n => { fits[pp + n] = n === 1 ? {ok:true, k:1} : layoutFor(a, pp, n); }));
  M.modal('Print assessment', `
    <div class="grid g-2" style="gap:14px">
      <label class="field">Paper<select class="input" id="ppP">${Object.entries(PAPER).map(([k, v]) => `<option value="${k}" ${k===ui.paper?'selected':''}>${v.label}</option>`).join('')}</select></label>
      <label class="field">Number of sheets to print<input class="input" id="ppN" inputmode="numeric" value="${ui.sheets}"></label></div>
    <div class="field" style="margin-top:12px">Copies of the test on each sheet <span class="muted">(0.5 in margins on all sides)</span>
      <div class="row" id="ppPer" style="margin-top:6px;gap:8px"></div></div>
    <label class="row small" style="cursor:pointer;gap:6px;margin-top:10px"><input type="checkbox" id="ppK" ${ui.key?'checked':''}> Add the answer key on a separate page</label>
    <div class="small muted" id="ppInfo" style="margin-top:10px"></div>
    <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" id="ppX">Cancel</button><button class="btn primary" id="ppGo">${ico('print')} Print</button></div>`, b => {
    const draw = () => { const pp = $('#ppP', b).value;
      $('#ppPer', b).innerHTML = [1,2,4].map(n => { const f = fits[pp + n]; return `<button class="btn sm ${ui.per===n?'primary':''}" data-per="${n}" ${f.ok?'':'disabled'} title="${f.ok ? (n===1?'Full size; long tests continue on the next page':`Shrunk to ${Math.round(f.k*100)}% to fit`) : 'Too long to fit this many on one sheet'}">${n} per sheet${n>1 ? ` · ${f.ok ? Math.round(f.k*100) + '%' : 'too long'}` : ''}</button>`; }).join('');
      if(!fits[pp + ui.per].ok) ui.per = 1;
      $$('[data-per]', b).forEach(x => x.onclick = () => { ui.per = +x.dataset.per; draw(); });
      const n = Math.max(1, parseInt($('#ppN', b).value) || 1);
      $('#ppInfo', b).innerHTML = `${PAPER[pp].label} · ${ui.per} cop${ui.per===1?'y':'ies'} per sheet${ui.per>1 ? ` (text at ${Math.round(fits[pp + ui.per].k*100)}%)` : ''} · ${n} sheet(s) = <b>${n * ui.per} test copies</b>${ui.key ? ' + answer key page' : ''}. Print at 100% / actual size.`; };
    draw(); $('#ppP', b).onchange = () => { ui.paper = $('#ppP', b).value; draw(); }; $('#ppN', b).oninput = draw; $('#ppK', b).onchange = e => { ui.key = e.target.checked; draw(); };
    $('#ppX', b).onclick = M.closeModal;
    $('#ppGo', b).onclick = () => { ui.paper = $('#ppP', b).value; ui.sheets = Math.max(1, Math.min(60, parseInt($('#ppN', b).value) || 1)); ui.key = $('#ppK', b).checked; M.closeModal();
      M.doPrint(printHtml(a, ui), M.pageCss(ui.paper), {noFit: ui.per !== 1}); };
  }, true);
}

/* =====================================================================
   WORD (.docx): plain paragraphs and tab stops — no tables — so everything stays easy to edit
   ===================================================================== */
const xe = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function runs(text, o = {}){ // supports [underline] and [A: underline] markers
  const out = []; const re = /\[([A-E])\s*:\s*([^\]]+)\]|\[([^\]]+)\]/g; let last = 0, m;
  const r = (t, u, sub) => out.push(`<w:r><w:rPr>${o.b?'<w:b/>':''}${o.i?'<w:i/>':''}${u?'<w:u w:val="single"/>':''}${sub?'<w:vertAlign w:val="subscript"/>':''}${o.sz?`<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`:''}</w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r>`);
  const t = String(text ?? '');
  while(o.marks && (m = re.exec(t))){ if(m.index > last) r(t.slice(last, m.index)); if(m[1]){ r(m[2], true); r(m[1], false, true); } else r(m[3], true); last = m.index + m[0].length; }
  r(t.slice(last)); return out.join(''); }
function para(content, o = {}){
  const pPr = [o.align ? `<w:jc w:val="${o.align}"/>` : '', `<w:spacing w:before="${o.before||0}" w:after="${o.after ?? 60}"/>`, o.ind ? `<w:ind w:left="${o.ind}" w:hanging="${o.hang||0}"/>` : '',
    o.tabs ? `<w:tabs>${o.tabs.map(t => `<w:tab w:val="left" w:pos="${t}"/>`).join('')}</w:tabs>` : '', o.keep ? '<w:keepNext/>' : '', o.pageBreak ? '<w:pageBreakBefore/>' : ''].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${content}</w:p>`; }
const TAB = '<w:r><w:tab/></w:r>';
M.asmDocx = function(a){
  if(!a) return; const ui = printDialog.ui = printDialog.ui || {paper:'A4', per:1, sheets:1, key:true};
  M.modal('Download as Word', `<p class="small muted" style="margin-top:0">An editable .docx (plain paragraphs — no tables) with the answer key on the last page, 0.5 in margins.</p>
    <div class="row" style="gap:8px">${Object.entries(PAPER).map(([k, v]) => `<button class="btn ${k===ui.paper?'primary':''}" data-dp="${k}">${v.label}</button>`).join('')}</div>`, b => {
    $$('[data-dp]', b).forEach(x => x.onclick = () => { ui.paper = x.dataset.dp; M.closeModal(); makeDocx(a, ui.paper === 'FOLIO'); }); });
};
async function makeDocx(a, folio){
  await M.loadScript('vendor/jszip.min.js');
  const S = M.S.settings; const P = []; let no = 0;
  P.push(para(runs('Republic of the Philippines · Department of Education', {sz: 18}), {align:'center', after: 0}));
  P.push(para(runs(S.school || '', {b: true, sz: 22}), {align:'center', after: 0}));
  if(S.address) P.push(para(runs(S.address, {sz: 18}), {align:'center', after: 120}));
  P.push(para(runs(a.title, {b: true, sz: 26}), {align:'center', after: 0}));
  P.push(para(runs(`English ${a.grade} · Term ${a.term} · ${a.total} points`, {sz: 20}), {align:'center', after: 160}));
  P.push(para(runs('Name: _______________________________') + TAB + runs('Grade & Section: ______________'), {tabs: [6200]}));
  P.push(para(runs('Date: _______________') + TAB + runs(`Score: ________ / ${a.total}`), {tabs: [6200], after: 160}));
  if(a.directions) P.push(para(runs('General directions: ', {b: true}) + runs(a.directions), {after: 120}));
  const passage = (p) => { if(!p) return; if(p.title) P.push(para(runs(p.title, {b: true}), {align:'center', before: 80, keep: true})); String(p.text).split(/\n{2,}/).forEach(x => P.push(para(runs(x), {after: 80, align: 'both'}))); };
  const used = new Set(a.parts.map(p => p.passage).filter(Boolean)); a.passages.filter(p => !used.has(p.id)).forEach(passage);
  a.parts.forEach((p, i) => {
    P.push(para(runs(`Test ${ROMAN[i]}. ${p.title || TNAME[p.type]} (${itemsPoints(p)} points)`, {b: true}), {before: 200, keep: true}));
    if(p.directions) P.push(para(runs('Directions: ', {b: true, i: true}) + runs(p.directions, {i: true}), {after: 80}));
    if(p.passage) passage(a.passages.find(x => x.id === p.passage));
    if(p.word_bank) P.push(para(runs('Word bank: ', {b: true}) + runs(p.word_bank.join('     ')), {after: 80}));
    if(p.type === 'matching'){
      P.push(para(runs('Column A', {b: true}), {keep: true}));
      p.items.forEach(it => P.push(para(runs(`_____ ${++no}. `) + runs(it.q), {ind: 360})));
      P.push(para(runs('Column B', {b: true}), {before: 100, keep: true}));
      (p.choices || []).forEach((c, k) => P.push(para(runs(`${L[k]}. ${c}`), {ind: 360})));
      return; }
    p.items.forEach(it => { no++;
      if(p.type === 'multiple_choice'){ P.push(para(runs(`${no}. `) + runs(it.q, {marks: true}), {ind: 360, hang: 360, keep: true, after: 20}));
        const ch = (it.choices || []).map(c => String(c).replace(/^[a-eA-E][.)]\s+/, '')); const long = ch.some(c => c.length > 28);
        if(long) ch.forEach((c, k) => P.push(para(runs(`${L[k]}. ${c}`), {ind: 720, after: k === ch.length - 1 ? 100 : 0})));
        else for(let k = 0; k < ch.length; k += 2) P.push(para(runs(`${L[k]}. ${ch[k]}`) + (ch[k+1] != null ? TAB + runs(`${L[k+1]}. ${ch[k+1]}`) : ''), {ind: 720, tabs: [5000], after: k + 2 >= ch.length ? 100 : 0}));
        return; }
      if(['true_false','modified_true_false','identification','error_identification'].includes(p.type)){ P.push(para(runs(`${p.type === 'identification' ? '______________' : '_________'} ${no}. `) + runs(it.q, {marks: true}), {ind: 360, hang: 360, after: 80})); return; }
      if(p.type === 'fill_blanks'){ P.push(para(runs(`${no}. `) + runs(it.q), {ind: 360, hang: 360, after: 80})); return; }
      if(p.type === 'enumeration'){ P.push(para(runs(`${no}. `) + runs(it.q), {ind: 360, hang: 360, keep: true, after: 20})); const k = Array.isArray(it.answer) ? it.answer.length : 3; for(let j = 0; j < k; j++) P.push(para(runs(`${j+1}. ____________________________`), {ind: 720, after: 20})); return; }
      if(p.type === 'short_answer'){ P.push(para(runs(`${no}. `) + runs(it.q), {ind: 360, hang: 360, keep: true, after: 20})); P.push(para(runs('_______________________________________________________________'), {ind: 360, after: 20})); P.push(para(runs('_______________________________________________________________'), {ind: 360, after: 100})); return; }
      if(p.type === 'essay'){ P.push(para(runs(`${no}. `) + runs(it.q) + (it.points ? runs(` (${it.points} points)`, {i: true}) : ''), {ind: 360, hang: 360, keep: true, after: 40}));
        (it.rubric || []).forEach(r => P.push(para(runs(`• ${r.criterion || ''} — ${r.points ?? ''} points`, {sz: 20}), {ind: 720, after: 0})));
        for(let j = 0; j < 8; j++) P.push(para(runs('_______________________________________________________________'), {ind: 360, after: 20})); return; }
      P.push(para(runs(`${no}. `) + runs(it.q), {ind: 360, hang: 360})); });
  });
  // answer key on its own page
  no = 0; P.push(para(runs('ANSWER KEY', {b: true, sz: 26}), {align:'center', pageBreak: true, after: 0})); P.push(para(runs(a.title, {sz: 20}), {align:'center', after: 160}));
  a.parts.forEach((p, i) => { P.push(para(runs(`Test ${ROMAN[i]}. ${p.title || TNAME[p.type]}`, {b: true}), {before: 120, keep: true}));
    p.items.forEach(it => { no++; P.push(para(runs(`${no}. ${ansText(it)}`) + (p.type === 'essay' && it.rubric ? runs(`  (Rubric: ${it.rubric.map(r => `${r.criterion} ${r.points}`).join('; ')})`, {i: true, sz: 18}) : ''), {ind: 360, after: 0})); }); });
  const [pw, ph] = folio ? [12240, 18720] : [11906, 16838];
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${P.join('')}<w:sectPr><w:pgSz w:w="${pw}" w:h="${ph}"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-PH"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/document.xml', doc); zip.file('word/styles.xml', styles);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(a.title)}</dc:title><dc:creator>MASTRO</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0,19)}Z</dcterms:created></cp:coreProperties>`);
  const blob = await zip.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression:'DEFLATE'});
  M.downloadBlob(blob, `${a.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80)}.docx`); M.toast(`Word file downloaded (${folio ? '8.5 × 13' : 'A4'}, 0.5 in margins)`);
}
})();
