/* MASTRO — Budget of Work (Three-Term BOW for Learning Competencies, DepEd, last updated April 8, 2026)
   English Grade 7 and Grade 9, typed from the PDFs you provided. Each term: content standard, performance standard,
   then sections ("Domain | Text type" + focus) with competencies and their topics / subtopics (indent = level). */
(function () {
'use strict';
const M = window.M;
const RAW = {
'7': {
'1': {cs:'The learners demonstrate their multiliteracies and communicative competence in evaluating Philippine literature (poetry and prose) for clarity of meaning, purpose, and target audience as a foundation for publishing original literary texts that reflect local and national identity.',
ps:'The learners analyze the style, form, and features of Philippine poetry (lyric, narrative, dramatic) and prose (short story and novel); evaluate poetry and prose for clarity of meaning, purpose, and target audience; and compose and publish an original multimodal literary text (poem and short story) that represents their meaning, purpose, and target audience, and reflects their local and national identity.',
text:`# Literary Text | Poetry and Prose :: Evaluating literary texts
- Analyze literary texts as expressions of individual or communal values within:
  - Structural context
    - Conflict
      - Character vs Character
      - Character vs Society
      - Character vs Nature/environment
    - Character
    - Characterization
    - Plot: Linear and flashback
    - Rhyme and meter
    - Diction
    - Tone and mood
    - Style
    - Patterns and motifs
    - Figures of speech and sound devices
    - Point of view and narrative techniques
    - Organic unity
  - Biographical context
  - Historical context
  - Sociocultural context
- Analyze the maxims, universal truths, and philosophies presented in the literary text as a means of valuing other people and their various circumstances in life.
# Literary Text | Poetry and Prose :: Publishing an original literary text that reflects culture
- Identify one's meaning and purpose in selecting the type of literary text for composition.
- Compose literary texts using appropriate structure.
- Revise the literary texts for coherence and cohesion.
- Publish an original literary text that reflects culture:
  - Poem/prose`},
'2': {cs:'The learners demonstrate their multiliteracies and communicative competence in evaluating informational texts (expository texts and journalistic texts: news and press releases and features) for clarity of meaning, purpose, and target audience as a foundation for publishing original informational texts.',
ps:'The learners analyze the style, form, and features of informational texts (expository texts, news and press releases, and features); evaluate informational texts for clarity of meaning, purpose, and target audience; and compose and publish original multimodal informational texts (expository texts, news and press releases, and features) using appropriate forms and structures that represent their meaning, purpose, and target audience.',
text:`# Informational Text | Expository Text, News, and Press Releases, Features :: Evaluating informational text in a range of media (spoken, written, visual, and multimedia) for clarity of meaning, purpose, form, and function
- Examine text structures for clarity of meaning and purpose:
  - Non-journalistic texts: Expository text
    - Sequence/process
    - Comparison-contrast
    - Cause and effect
    - Problem and solution
  - Journalistic texts
    - News and press releases
    - Features
- Examine linguistic features as tools to achieve organizational efficiency in informational texts:
  - Diction and style
  - Transition devices
  - Sentence structure and function
- Analyze the use of discipline-specific word, voice, technical terms in research, and conceptual, operational, and expanded definition of words.
- Examine how visual elements are used as tools to achieve the intended meaning of information texts:
  - Vector (for scientific, mathematical, or technical topics) and viewpoint
  - Technical editing
  - Animations
- Extract significant information.
- Analyze the real-world issues/occurrences presented in informational texts.
- Distinguish facts from claims/opinions:
  - Statements of facts
  - Statements of opinions
  - Statements of fact-based opinions
- Analyze propaganda techniques used in informational texts for political correctness:
  - Testimonials vs Plain folks
  - Stereotyping vs Fear appeals
- Draw inferences and conclusions to formulate sound judgment:
  - Author's purpose and meaning
  - Target audience
    - Hypothetical vs Real
    - Experts vs Laypeople
    - Managerial vs Rank-and-file
- Analyze how non-linear texts represent and/or summarize the contents of informational texts:
  - Graphs
  - Charts
  - Infographics
  - Graphical organizers
- Determine the veracity of the information presented:
  - Credibility of the author
  - Accuracy of information
  - Relevance
  - Timeliness
  - Objectivity
  - Coverage
- Analyze textual evidence to support an argument/general statement:
  - Quoting
  - Paraphrasing
  - Summarizing
- Assess the quality of journalistic articles based on standard development principles:
  - Simplicity and brevity
  - Precision
  - Objectivity and factuality
  - Fairness and balance
  - Ethics
- Synthesize significant information.
# Informational Text | Expository Text, News, and Press Releases, Features :: Publishing a multimodal informational text for one's purpose and target audience
- Identify the text type appropriate for one's topic, purpose, and target audience.
- Organize significant information using various techniques.
- Determine one's thesis as the central idea of the paper.
- Compose the informational text based on the chosen text type.
- Apply multimodal elements appropriate to the chosen text delivery/ies.
- Revise the text for coherence.
- Revise the text for cohesion (diction, syntax, and style).
- Edit the text for textual consistency.
- Publish a multimodal informational text for one's purpose and target audience:
  - Expository text, news and press releases, and features`},
'3': {cs:'The learners demonstrate their multiliteracies and communicative competence in evaluating informational texts (academic text: expository essays) and transactional texts (letter of request) for clarity of meaning, purpose, and target audience as a foundation for publishing original informational and transactional texts.',
ps:'The learners analyze the style, form, and features of informational texts (expository essays) and transactional texts (letter of request); evaluate informational and transactional texts for clarity of meaning, purpose, and target audience; and compose and publish original multimodal informational texts (expository essays) and transactional texts (letter of request) using appropriate forms and structures that represent their meaning, purpose, and target audience.',
text:`# Informational Text | Expository Essay :: Evaluating informational text in a range of media (spoken, written, visual, and multimedia) for clarity of meaning, purpose, form, and function
- Examine text structures for clarity of meaning and purpose:
  - Academic texts: Expository essay
- Examine linguistic features as tools to achieve organizational efficiency in informational texts:
  - Diction and style
  - Transition devices
  - Sentence structure and function
- Analyze the use of discipline-specific word, voice, technical terms in research, and conceptual, operational, and expanded definition of words.
- Extract significant information.
- Analyze supporting evidence to validate assertions and counterclaims:
  - Factual knowledge
  - Statistical inferences
  - Informed opinion
  - Personal testimony
- Evaluate claims explicitly or implicitly made in a text:
  - Claim of fact
  - Claim of value
  - Claim of policy
- Draw inferences and conclusions to formulate sound judgment:
  - Author's purpose and meaning
  - Target audience
    - Hypothetical vs Real
    - Experts vs Laypeople
    - Managerial vs Rank-and-file
- Analyze textual evidence to support an argument/general statement:
  - Quoting
  - Paraphrasing
  - Summarizing
- Synthesize significant information.
# Informational Text | Expository Essay :: Publishing a multimodal informational text for one's purpose and target audience
- Identify the text type appropriate for one's topic, purpose, and target audience.
- Organize significant information using various techniques.
- Determine one's thesis as the central idea of the paper.
- Compose the informational text based on the chosen text type.
- Apply multimodal elements appropriate to the chosen text delivery/ies.
- Revise the text for coherence.
- Revise the text for cohesion (diction, syntax, and style).
- Edit the text for textual consistency.
- Publish a multimodal informational text for one's purpose and target audience:
  - Expository essay
# Transactional Text :: Evaluating letters for clarity of purpose and meaning
- Analyze distinguishing features of informal and formal correspondences to infer sender's meaning and purpose across modalities:
  - Letter of request
- Analyze milieus influencing the structure and rhetoric of informal and formal correspondences across modalities:
  - Parts and formats
  - Organizational patterns
  - Politeness strategies (etiquette)
- Examine the sender's voice for clarity of purpose and meaning:
  - Diction
  - Style
  - Tone and register
  - Point of view
  - Sentence structure
- Examine how ethics is established in transmitting informal and formal correspondences across modalities.
# Transactional Text :: Sending letters to communicate with and respond to senders
- Identify one's purpose and meaning in writing letters.
- Compose a letter of request.
- Revise for coherence and cohesion.
- Edit for consistency of diction, style, tone and register, point of view, and grammar.
- Send correspondences to communicate with and respond to senders within the bounds of ethics.`}
},
'9': {
'1': {cs:'The learners demonstrate their multiliteracies and communicative competence in evaluating Anglo-American literature (poetry, prose, and drama) for clarity of meaning, purpose, and target audience as a foundation for publishing original literary texts that reflect their expanding cultural identity.',
ps:'The learners analyze the style, form, and features of Anglo-American literature (poetry, prose, and drama); evaluate literary texts for clarity of meaning, purpose, and target audience; and compose and publish an original multimodal literary text (one-act play) that represents their meaning, purpose, and target audience, and reflects their expanding cultural identity.',
text:`# Literary Text | Poetry, Prose, and Drama :: Evaluating literary texts
- Analyze literary texts as expressions of individual or communal values within:
  - Structural context
    - Conflict
      - Character vs Character
      - Character vs Society
      - Character vs Nature/environment
    - Character
    - Characterization
    - Plot
      - Parallel
      - Episodic
    - Spectacle, dialogue, and music
    - Rhyme and meter
    - Diction
    - Tone and mood
    - Style
    - Patterns and motifs
    - Figures of speech and sound devices
    - Point of view and narrative techniques
    - Organic unity
    - Sign and referent
    - Binary opposition
  - Biographical context
  - Historical context
  - Sociocultural context
  - Linguistic context
    - Co-text
    - Collocation
  - Psychological context
- Analyze the maxims, universal truths, and philosophies presented in the literary text as a means of valuing other people and their various circumstances in life.
# Literary Text | Poetry, Prose, and Drama :: Publishing an original literary text that reflects culture
- Identify one's meaning and purpose in selecting the type of literary text for composition.
- Compose literary texts using appropriate structure.
- Revise the literary texts for coherence and cohesion.
- Publish an original literary text that reflects culture:
  - Script for a one-act play`},
'2': {cs:'The learners demonstrate their multiliteracies and communicative competence in evaluating informational texts (argumentative texts) and transactional texts (letter of complaint) for clarity of meaning, purpose, and target audience as a foundation for publishing original informational and transactional texts.',
ps:'The learners analyze the style, form, and features of informational texts (argumentative texts) and transactional texts (letter of complaint); evaluate informational and transactional texts for clarity of meaning, purpose, and target audience; and compose and publish original multimodal informational texts (argumentative texts) and transactional texts (letter of complaint) using appropriate forms and structures that represent their meaning, purpose, and target audience.',
text:`# Informational Text | Argumentative Texts :: Evaluating informational text in a range of media (spoken, written, visual, and multimedia) for clarity of meaning, purpose, form, and function
- Examine text structures for clarity of meaning and purpose:
  - Non-journalistic texts: Argumentative text
- Examine linguistic features as tools to achieve organizational efficiency in informational texts:
  - Diction and style
  - Transition devices
  - Sentence structure and function
- Analyze the use of discipline-specific words, voice, technical terms in research, and conceptual, operational, and expanded definition of words.
- Extract significant information.
- Analyze supporting evidence to validate assertions and counterclaims:
  - Factual knowledge
  - Statistical inferences
  - Informed opinion
  - Personal testimony
- Distinguish facts from claims/opinions:
  - Self-evidence
  - Anecdotal evidence
  - Argument from authority
  - Empirical evidence
- Evaluate claims explicitly or implicitly made in a text:
  - Claim of fact
  - Claim of value
  - Claim of policy
- Analyze propaganda techniques used in informational texts for political correctness:
  - Name calling vs Card stacking
  - Ad nauseam propaganda vs Appeal to justice
- Analyze persuasive techniques to support an argument:
  - Ethos
  - Pathos
  - Logos
- Draw inferences and conclusions to formulate sound judgment:
  - Author's purpose and meaning
  - Target audience
    - Hypothetical vs Real
    - Experts vs Laypeople
    - Managerial vs Rank-and-file
- Analyze textual evidence to support an argument/general statement:
  - Quoting
  - Paraphrasing
  - Summarizing
- Synthesize significant information.
# Informational Text | Argumentative Text :: Publishing a multimodal informational text for one's purpose and target audience
- Identify the text type appropriate for one's topic, purpose, and target audience.
- Organize significant information using various techniques.
- Determine one's thesis as the central idea of the paper.
- Compose the informational text based on the chosen text type.
- Apply multimodal elements appropriate to the chosen text delivery/ies.
- Revise the text for coherence.
- Revise the text for cohesion (diction, syntax, and style).
- Edit the text for textual consistency.
- Publish a multimodal informational text for one's purpose and target audience:
  - Argumentative text
# Transactional Text :: Evaluating letters for clarity of purpose and meaning
- Analyze distinguishing features of informal and formal correspondences to infer sender's meaning and purpose across modalities:
  - Letter of complaint
- Analyze milieus influencing the structure and rhetoric of informal and formal correspondences across modalities:
  - Parts and formats
  - Organizational patterns
  - Politeness strategies (etiquette)
- Examine the sender's voice for clarity of purpose and meaning:
  - Diction
  - Style
  - Tone and register
  - Point of view
  - Sentence structure
- Examine how ethics is established in transmitting informal and formal correspondences across modalities.
# Transactional Text :: Sending letters to communicate with and respond to senders
- Identify one's purpose and meaning in writing letters.
- Compose a letter of complaint.
- Revise for coherence and cohesion.
- Edit for consistency of diction, style, tone and register, point of view, and grammar.
- Send correspondences to communicate with and respond to senders within the bounds of ethics.`},
'3': {cs:'The learners demonstrate their multiliteracies and communicative competence in evaluating informational texts (academic text: literature review) for clarity of meaning, purpose, and target audience as a foundation for publishing original informational texts.',
ps:'The learners analyze the style, form, and features of informational texts (literature review); evaluate informational texts for clarity of meaning, purpose, and target audience; and compose and publish original multimodal informational texts (literature review) using appropriate forms and structures that represent their meaning, purpose, and target audience.',
text:`# Informational Text | Literature Review :: Evaluating informational text in a range of media (spoken, written, visual, and multimedia) for clarity of meaning, purpose, form, and function
- Examine text structures for clarity of meaning and purpose:
  - Academic text: Literature review
- Examine linguistic features as tools to achieve organizational efficiency in informational texts:
  - Diction and style
  - Transition devices
  - Sentence structure and function
- Analyze the use of discipline-specific words, voice, technical terms in research, and conceptual, operational, and expanded definition of words.
- Extract significant information.
- Analyze supporting evidence to validate assertions and counterclaims:
  - Factual knowledge
  - Statistical inferences
  - Informed opinion
  - Personal testimony
- Draw inferences and conclusions to formulate sound judgment:
  - Author's purpose and meaning
  - Target audience
    - Hypothetical vs Real
    - Experts vs Laypeople
    - Managerial vs Rank-and-file
- Analyze textual evidence to support an argument/general statement:
  - Quoting
  - Paraphrasing
  - Summarizing
- Synthesize significant information.
# Informational Text | Sports and Science and Technology Stories :: Publishing a multimodal informational text for one's purpose and target audience
- Identify the text type appropriate for one's topic, purpose, and target audience.
- Organize significant information using various techniques.
- Determine one's thesis as the central idea of the paper.
- Compose the informational text based on the chosen text type.
- Apply multimodal elements appropriate to the chosen text delivery/ies.
- Revise the text for coherence.
- Revise the text for cohesion (diction, syntax, and style).
- Edit the text for textual consistency.
- Publish a multimodal informational text for one's purpose and target audience:
  - Literature review`}
}};

// outline text → {sections:[{domain, focus, comps:[{id, text, topics:[{id, t, kids:[...]}]}]}]}
function parse(grade, term, src){
  const sections = []; let sec = null, comp = null; const stack = []; let n = 0, k = 0;
  src.text.split('\n').forEach(line => {
    if(!line.trim()) return;
    if(line.startsWith('# ')){ const [domain, focus] = line.slice(2).split('::').map(x => x.trim()); sec = {domain, focus, comps: []}; sections.push(sec); return; }
    const m = line.match(/^(\s*)- (.*)$/); if(!m) return; const lvl = m[1].length / 2; const t = m[2].trim();
    if(lvl === 0){ comp = {id: `g${grade}t${term}c${++n}`, text: t, topics: []}; sec.comps.push(comp); stack.length = 0; return; }
    const node = {id: `${comp.id}-${++k}`, t: t.replace(/:$/, ''), kids: []};
    while(stack.length >= lvl) stack.pop();
    (stack.length ? stack[stack.length-1].kids : comp.topics).push(node); stack.push(node);
  });
  return {grade, term, cs: src.cs, ps: src.ps, sections};
}
M.BOW = {};
Object.entries(RAW).forEach(([g, terms]) => { M.BOW[g] = {grade: g, subject: 'English', source: 'DepEd Three-Term Budget of Work (April 8, 2026)', terms: {}};
  Object.entries(terms).forEach(([t, src]) => M.BOW[g].terms[t] = parse(g, t, src)); });
// all topic names under a node (for matching and prompts)
M.bowFlatTopics = (nodes, pre = '') => nodes.flatMap(n => [pre + n.t, ...M.bowFlatTopics(n.kids, pre + n.t + ' › ')]);
// the same competencies in the Item Analysis "Budget of Work" format (used by TOS), added once if missing
M.ensureBuiltinBOW = () => {
  if(!M.S || !Array.isArray(M.S.bow)) return;
  Object.values(M.BOW).forEach(B => {
    if(M.S.bow.some(b => String(b.grade) === B.grade && /english/i.test(b.subject || ''))) return;
    const comps = []; Object.values(B.terms).forEach(T => T.sections.forEach(sec => sec.comps.forEach(c => comps.push({id: c.id, term: T.term, code: '', text: c.text, days: 1, keywords: M.bowFlatTopics(c.topics).join(' ') + ' ' + sec.domain + ' ' + sec.focus}))));
    M.S.bow.push({id: 'bow-builtin-' + B.grade, grade: B.grade, subject: 'English', name: B.source, builtin: true, comps, added: new Date().toISOString()});
  });
};
})();
