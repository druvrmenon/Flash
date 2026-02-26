// ═══════════════════════════════════════════════════════
//  FlashGen Quiz Engine v3
//  · Inherits theme from flashcard app
//  · 3-tier difficulty (Easy / Medium / Hard)
//  · Type-aware distractor engine (plausible same-type distractors)
//  · True/False + Reverse question formats
// ═══════════════════════════════════════════════════════

const $ = {
  get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d}catch{return d}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
};

// ═══ THEME ═══════════════════════════════════════════
const THEMES = ['aurora','neon','parchment','sakura','ocean','forest','ember','slate'];

function applyTheme(t){
  if(!THEMES.includes(t)) t = 'aurora';
  document.documentElement.setAttribute('data-theme', t);
  $.set('fg:theme', t);
  document.querySelectorAll('.tsw').forEach(b => b.classList.toggle('active', b.dataset.t === t));
}

function initTheme(){
  const saved = $.get('fg:theme','aurora');
  applyTheme(saved);
}

function openThemePanel(){
  document.getElementById('theme-panel').classList.add('open');
  document.getElementById('theme-overlay').classList.add('show');
}
function closeThemePanel(){
  document.getElementById('theme-panel').classList.remove('open');
  document.getElementById('theme-overlay').classList.remove('show');
}

// ═══ DIFFICULTY CONFIG ═══════════════════════════════
const MODES = {
  easy:{
    label:'Easy', emoji:'🟢',
    color:'#22c55e', colorBg:'rgba(34,197,94,.12)', colorBr:'rgba(34,197,94,.3)',
    timer:45, base:100, timeBonus:50,
    optCount:3, formats:['mcq','truefalse'],
    distStrategy:'random',
    hint:true,
    streakAt:[3,6,10], streakMult:[1.5,2,2.5],
    pool: c => c
  },
  medium:{
    label:'Medium', emoji:'🟡',
    color:'#f59e0b', colorBg:'rgba(245,158,11,.1)', colorBr:'rgba(245,158,11,.3)',
    timer:30, base:200, timeBonus:120,
    optCount:4, formats:['mcq'],
    distStrategy:'chapter',
    hint:false,
    streakAt:[3,5,8], streakMult:[1.5,2,3],
    pool: c => c
  },
  hard:{
    label:'Hard', emoji:'🔴',
    color:'#ef4444', colorBg:'rgba(239,68,68,.1)', colorBr:'rgba(239,68,68,.3)',
    timer:15, base:350, timeBonus:250,
    optCount:4, formats:['mcq','reverse'],
    distStrategy:'topic',
    hint:false,
    streakAt:[2,4,7], streakMult:[2,3,4],
    pool: cards => { const hi=cards.filter(c=>c.priority==='high'); return hi.length>=4?hi:cards; }
  }
};

// ═══ STATE ════════════════════════════════════════════
let allCards=[], deckId=null, mode=null;
let quizCards=[], qIdx=0, score=0, pts=0, streak=0, bestStreak=0;
let answers=[], qTimer=null, timeLeft=0, answered=false;
let selectedCount=10, hintUsed=false, curQ=null;

// ═══ LOAD CARDS ═══════════════════════════════════════
function loadCards(){
  deckId = localStorage.getItem('fg:quiz_deck_id')||null;
  const raw = localStorage.getItem('fg:quiz_all_cards');
  if(raw){ try{ const p=JSON.parse(raw); if(Array.isArray(p)&&p.length>=4){allCards=p;return true;} }catch{} }
  if(deckId){ const d=$.get('fg:d:'+deckId,null); if(d?.cards?.length>=4){allCards=d.cards;return true;} }
  const idx=$.get('fg:idx',[]); for(const it of idx){ const d=$.get('fg:d:'+it.id,null); if(d?.cards) allCards=[...allCards,...d.cards]; }
  return allCards.length>=4;
}

// ═══ DOM INIT ═════════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  initTheme();

  // Theme panel
  document.querySelectorAll('.tsw').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.t)));
  document.getElementById('tp-close').addEventListener('click',closeThemePanel);
  document.getElementById('theme-overlay').addEventListener('click',closeThemePanel);
  document.getElementById('theme-toggle').addEventListener('click',openThemePanel);
  document.getElementById('theme-toggle-start').addEventListener('click',openThemePanel);

  if(!loadCards()||allCards.length<4){
    document.getElementById('start-card').classList.add('hidden');
    document.getElementById('no-cards').classList.remove('hidden');
    return;
  }

  // Deck info
  let deckName='Your deck';
  if(deckId){ const d=$.get('fg:d:'+deckId,null); if(d?.meta?.name) deckName=d.meta.name; }
  document.getElementById('deck-title').textContent = deckName.slice(0,50);
  document.getElementById('deck-count').textContent = allCards.length+' cards';

  // Difficulty selection
  document.querySelectorAll('.diff-card').forEach(el=>{
    el.addEventListener('click',()=>{
      document.querySelectorAll('.diff-card').forEach(d=>d.classList.remove('active'));
      el.classList.add('active');
      mode = el.dataset.mode;
      applyModeColors();
      updateCountBtns();
      const btn = document.getElementById('start-btn');
      btn.disabled = false;
      btn.textContent = 'Start ' + MODES[mode].label + ' Quiz →';
    });
  });

  // Count buttons
  document.querySelectorAll('.qc-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.qc-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selectedCount = parseInt(btn.dataset.n);
    });
  });

  // Buttons
  document.getElementById('start-btn').addEventListener('click', startQuiz);
  document.getElementById('exit-btn').addEventListener('click',()=>{ clearInterval(qTimer); window.location.href='index.html?return=cards'; });
  document.getElementById('retry-btn').addEventListener('click', resetToStart);
  document.getElementById('back-btn').addEventListener('click',()=>window.location.href='index.html?return=quiz-done');
  document.getElementById('stats-btn').addEventListener('click',()=>window.location.href='index.html?return=dashboard');
  document.getElementById('next-btn').addEventListener('click', nextQ);
  document.getElementById('hint-btn').addEventListener('click', useHint);
  document.addEventListener('keydown', onKey);
});

function applyModeColors(){
  if(!mode) return;
  const cfg = MODES[mode];
  document.documentElement.style.setProperty('--mode', cfg.color);
  document.documentElement.style.setProperty('--mode-bg', cfg.colorBg);
  document.documentElement.style.setProperty('--mode-br', cfg.colorBr);
}

function updateCountBtns(){
  const pool = mode ? MODES[mode].pool(allCards) : allCards;
  let hasActive = false;
  document.querySelectorAll('.qc-btn').forEach(btn=>{
    const n = parseInt(btn.dataset.n);
    const too = n > pool.length;
    btn.disabled = too; btn.style.opacity = too ? '0.3' : '';
    if(too) btn.classList.remove('active');
    if(btn.classList.contains('active') && !too) hasActive = true;
  });
  if(!hasActive){
    const first = document.querySelector('.qc-btn:not([disabled])');
    if(first){ first.classList.add('active'); selectedCount = parseInt(first.dataset.n); }
  }
}

function resetToStart(){
  document.getElementById('results-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  // restore theme-based mode colors
  document.documentElement.style.setProperty('--mode', 'var(--ac)');
  document.documentElement.style.setProperty('--mode-bg', 'var(--ac-s)');
  document.documentElement.style.setProperty('--mode-br', 'var(--br)');
}

// ═══ START QUIZ ═══════════════════════════════════════
function startQuiz(){
  if(!mode) return;
  const cfg = MODES[mode];
  const pool = cfg.pool(allCards);
  quizCards = shuffle([...pool]).slice(0, Math.min(selectedCount, pool.length));
  qIdx=0; score=0; pts=0; streak=0; bestStreak=0; answers=[]; answered=false;

  applyModeColors();

  // HUD badge
  const badge = document.getElementById('mode-badge');
  badge.textContent = cfg.emoji+' '+cfg.label;
  badge.style.color = cfg.color;
  badge.style.background = cfg.colorBg;
  badge.style.borderColor = cfg.color;

  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('quiz-section').classList.remove('hidden');
  renderQ();
}

// ═══════════════════════════════════════════════════════
//  QUESTION BUILDER
// ═══════════════════════════════════════════════════════

function buildQuestion(card){
  const cfg = MODES[mode];
  const fmts = cfg.formats;
  let fmt;
  if(fmts.length===1){ fmt=fmts[0]; }
  else if(mode==='hard'){ fmt = Math.random()<0.6 ? 'mcq' : 'reverse'; }
  else { fmt = Math.random()<0.55 ? 'mcq' : 'truefalse'; }
  // Reverse doesn't suit formulas/diagrams
  if(fmt==='reverse' && (card.type==='formula'||card.type==='diagram')) fmt='mcq';
  if(fmt==='truefalse') return buildTF(card);
  if(fmt==='reverse')   return buildReverse(card);
  return buildMCQ(card, cfg.optCount, cfg.distStrategy);
}

// ── MCQ with type-aware distractors ──────────────────
function buildMCQ(card, optCount, strategy){
  const correct = strip(card.a);
  const distractors = getDistractors(card, correct, optCount-1, strategy);
  const opts = shuffle([correct.slice(0,160), ...distractors.map(d=>d.slice(0,160))]);
  const correctIdx = opts.findIndex(o => o === correct.slice(0,160));
  return { fmt:'mcq', prompt:strip(card.q), opts, correctIdx, card, tag:typeTag(card) };
}

// ── True / False ──────────────────────────────────────
function buildTF(card){
  const realAns = strip(card.a);
  const useReal = Math.random() > 0.42;
  let shown, isTrue;
  if(useReal){
    shown = realAns; isTrue = true;
  } else {
    // pick a distractor of the same TYPE so it's plausible
    const sameType = allCards.filter(c => c !== card && c.type === card.type && strip(c.a) !== realAns);
    const pool = sameType.length >= 1 ? sameType : allCards.filter(c => c !== card && strip(c.a) !== realAns);
    const pick = pool[Math.floor(Math.random()*pool.length)];
    shown = pick ? strip(pick.a) : realAns;
    isTrue = shown === realAns;
  }
  return { fmt:'truefalse', prompt:strip(card.q), shownAns:shown.slice(0,220), opts:['True','False'], correctIdx:isTrue?0:1, card, tag:typeTag(card) };
}

// ── Reverse: show answer → pick the right question ───
function buildReverse(card){
  const answerText = strip(card.a);
  const correctQ   = strip(card.q);
  // Pick wrong questions from the same topic/chapter if possible
  const sameTopic = allCards.filter(c=>c!==card&&c.topic===card.topic&&c.q);
  const rest      = allCards.filter(c=>c!==card&&c.topic!==card.topic&&c.q);
  const pool      = [...sameTopic,...rest];
  const wrongQs   = shuffle(pool).slice(0,3).map(c=>strip(c.q).slice(0,160));
  const opts      = shuffle([correctQ.slice(0,160),...wrongQs]);
  const correctIdx= opts.findIndex(o=>o===correctQ.slice(0,160));
  return { fmt:'reverse', prompt:answerText.slice(0,280), label:'Which question does this answer belong to?', opts, correctIdx, card, tag:{text:'🔄 Reverse',cls:'tag-reverse'} };
}

// ═══ TYPE-AWARE DISTRACTOR ENGINE ════════════════════
//
//  Strategy priority for each difficulty:
//  - EASY: use cards with DIFFERENT topics (obviously wrong but same type format)
//  - MEDIUM: use cards from the SAME CHAPTER (similar domain, plausible)
//  - HARD: use cards from the SAME TOPIC (nearly identical answers, very tricky)
//
//  Within each, we first try to get cards of the same TYPE so the answer
//  format makes sense (e.g. formula distractors for formula questions,
//  short definitions for recall questions, etc.)
//
function getDistractors(card, correct, count, strategy){
  // Build ranked pools: same-type first within each proximity tier
  function sameType(list){ return list.filter(c=>c.type===card.type); }
  function anyType(list) { return list; }

  let tiers;
  if(strategy==='topic'){
    // Hard: same topic → same chapter → rest (all same-type first within each tier)
    const t1 = allCards.filter(c=>c!==card&&c.topic===card.topic);
    const t2 = allCards.filter(c=>c!==card&&c.chapter===card.chapter&&c.topic!==card.topic);
    const t3 = allCards.filter(c=>c!==card&&c.chapter!==card.chapter);
    tiers = [...sameType(t1),...anyType(t1),...sameType(t2),...anyType(t2),...sameType(t3),...anyType(t3)];
  } else if(strategy==='chapter'){
    // Medium: same chapter → rest
    const t1 = allCards.filter(c=>c!==card&&c.chapter===card.chapter);
    const t2 = allCards.filter(c=>c!==card&&c.chapter!==card.chapter);
    tiers = [...sameType(t1),...anyType(t1),...sameType(t2),...anyType(t2)];
  } else {
    // Easy: different topics first (clearly different domain — easy to dismiss)
    const t1 = allCards.filter(c=>c!==card&&c.topic!==card.topic);
    const t2 = allCards.filter(c=>c!==card&&c.topic===card.topic);
    // For easy mode, same type makes the options recognisable (they all look like answers)
    tiers = [...sameType(t1),...sameType(t2),...anyType(t1),...anyType(t2)];
  }

  // Deduplicate and filter trivially identical answers
  const correctNorm = correct.toLowerCase().trim();
  const seen = new Set([correctNorm]);
  const result = [];
  for(const c of tiers){
    const text = strip(c.a).slice(0,160);
    const norm = text.toLowerCase().trim();
    // Skip: empty, too similar to correct (>85% overlap), duplicate
    if(!text || text.length < 3) continue;
    if(seen.has(norm)) continue;
    if(similarity(norm, correctNorm) > 0.85) continue;
    seen.add(norm);
    result.push(text);
    if(result.length >= count) break;
  }

  // Pad with generic fallbacks if we still don't have enough
  const fallbacks = ['None of the above', 'Cannot be determined', 'All of the above', 'Insufficient data'];
  let fi = 0;
  while(result.length < count){ result.push(fallbacks[fi++ % fallbacks.length]); }
  return result.slice(0,count);
}

// Quick string similarity (Jaccard on trigrams)
function similarity(a, b){
  if(!a||!b) return 0;
  const tri = s => { const t=new Set(); for(let i=0;i<s.length-2;i++) t.add(s.slice(i,i+3)); return t; };
  const A=tri(a), B=tri(b);
  let inter=0; A.forEach(t=>{ if(B.has(t)) inter++; });
  return inter / (A.size + B.size - inter || 1);
}

const TYPE_TAGS={
  recall:      {text:'🧠 Recall',cls:'tag-recall'},
  formula:     {text:'🧪 Formula',cls:'tag-formula'},
  diagram:     {text:'📐 Diagram',cls:'tag-diagram'},
  concept:     {text:'💡 Concept',cls:'tag-concept'},
  application: {text:'🎯 Applied',cls:'tag-applied'}
};
function typeTag(c){ return TYPE_TAGS[c.type]||{text:'📝 Card',cls:'tag-recall'}; }

// ═══ RENDER QUESTION ══════════════════════════════════
function renderQ(){
  if(qIdx>=quizCards.length){ showResults(); return; }
  answered=false; hintUsed=false;
  const card = quizCards[qIdx];
  curQ = buildQuestion(card);
  const cfg = MODES[mode];

  // HUD update
  document.getElementById('top-fill').style.width = (qIdx/quizCards.length*100)+'%';
  document.getElementById('q-counter').textContent = `${qIdx+1} / ${quizCards.length}`;
  document.getElementById('pts-display').textContent = pts.toLocaleString();
  document.getElementById('q-num').textContent = 'Q'+(qIdx+1);
  document.getElementById('pts-possible').textContent = `+${cfg.base+cfg.timeBonus}`;
  updateStreakUI();

  // Tag
  const tagEl = document.getElementById('q-tag');
  tagEl.textContent = curQ.tag.text;
  tagEl.className = 'q-tag '+curQ.tag.cls;

  // Topic/chapter meta
  const metaEl = document.getElementById('q-meta');
  const parts = [];
  if(card.topic) parts.push(card.topic);
  if(card.chapter && card.chapter!=='General') parts.push(card.chapter.slice(0,30));
  metaEl.textContent = parts.join(' · ');
  metaEl.style.display = parts.length ? '' : 'none';

  // Format-specific label
  const fmtLabel = document.getElementById('fmt-label');
  if(curQ.fmt==='truefalse'){ fmtLabel.style.display=''; fmtLabel.textContent='Is this answer correct for the question below?'; }
  else if(curQ.fmt==='reverse'){ fmtLabel.style.display=''; fmtLabel.textContent=curQ.label; }
  else { fmtLabel.style.display='none'; }

  // TF block
  const tfBlock = document.getElementById('tf-block');
  if(curQ.fmt==='truefalse'){
    document.getElementById('tf-ans').textContent = curQ.shownAns;
    tfBlock.style.display='';
  } else { tfBlock.style.display='none'; }

  // Question text
  document.getElementById('q-text').textContent = curQ.prompt.slice(0,300);

  // Options
  const grid = document.getElementById('opts-grid');
  grid.innerHTML='';
  const LETTERS=['A','B','C','D'];
  const isTF = curQ.fmt==='truefalse';
  grid.style.gridTemplateColumns = isTF ? '1fr 1fr' : '';
  curQ.opts.forEach((opt,i)=>{
    const btn = document.createElement('button');
    btn.className='opt-btn';
    btn.dataset.correct = (i===curQ.correctIdx);
    if(isTF){
      btn.innerHTML=`<span class="opt-tf-icon">${i===0?'✓':'✗'}</span><span class="opt-tf-text">${esc(opt)}</span>`;
    } else {
      btn.innerHTML=`<span class="opt-letter">${LETTERS[i]}</span><span class="opt-text">${esc(opt)}</span>`;
    }
    btn.addEventListener('click',()=>pickAnswer(btn,i));
    grid.appendChild(btn);
  });

  // Hint
  const hintBtn = document.getElementById('hint-btn');
  hintBtn.style.display = (cfg.hint && curQ.fmt==='mcq') ? 'flex' : 'none';
  hintBtn.textContent='💡 Hint (H)';
  hintBtn.classList.remove('used');

  // Reset
  document.getElementById('feedback').className='feedback';
  document.getElementById('next-wrap').classList.add('hidden');

  // Animate
  ['q-card','opts-grid'].forEach(id=>{ const el=document.getElementById(id); el.style.animation='none'; el.offsetHeight; el.style.animation=''; });

  startTimer();
}

// ═══ TIMER ════════════════════════════════════════════
function startTimer(){
  clearInterval(qTimer);
  const cfg=MODES[mode];
  timeLeft=cfg.timer;
  const fill=document.getElementById('timer-fill');
  const num=document.getElementById('timer-num');
  fill.style.width='100%'; fill.className='timer-fill';
  num.textContent=timeLeft; num.className='timer-num';
  qTimer=setInterval(()=>{
    timeLeft--;
    const pct=timeLeft/cfg.timer*100;
    fill.style.width=pct+'%';
    num.textContent=timeLeft;
    if(pct<=40){ fill.className='timer-fill warn'; num.className='timer-num warn'; }
    if(pct<=20){ fill.className='timer-fill danger'; num.className='timer-num danger'; }
    if(timeLeft<=0){ clearInterval(qTimer); timeout(); }
  },1000);
}

// ═══ PICK ANSWER ══════════════════════════════════════
function pickAnswer(btn, idx){
  if(answered) return;
  answered=true; clearInterval(qTimer);
  const cfg=MODES[mode];
  const correct = (idx===curQ.correctIdx);

  document.querySelectorAll('.opt-btn').forEach((b,i)=>{
    b.disabled=true;
    if(i===curQ.correctIdx)    b.classList.add('correct');
    else if(b===btn&&!correct) b.classList.add('wrong');
    else                       b.classList.add('dim');
  });

  let earned=0;
  if(correct){
    score++; streak++; bestStreak=Math.max(bestStreak,streak);
    const timeRatio=timeLeft/cfg.timer;
    const mult=streakMult();
    earned=Math.round((cfg.base + cfg.timeBonus*timeRatio) * mult);
    pts+=earned;
    if(streak>=cfg.streakAt[0]) flashStreak();
  } else { streak=0; }
  updateStreakUI();

  answers.push({ q:curQ.card.q, correct, topic:curQ.card.topic||'General', type:curQ.card.type||'recall', chapter:curQ.card.chapter||'General', cardRef:curQ.card, timeLeft, earned, fmt:curQ.fmt, hintUsed });
  showFeedback(correct, correct?null:curQ.opts[curQ.correctIdx], earned);
  setTimeout(()=>{
    document.getElementById('next-label').textContent = qIdx+1>=quizCards.length ? 'See Results' : 'Next';
    document.getElementById('next-wrap').classList.remove('hidden');
  }, 320);
}

// ═══ TIMEOUT ══════════════════════════════════════════
function timeout(){
  if(answered) return;
  answered=true; streak=0; updateStreakUI();
  document.querySelectorAll('.opt-btn').forEach(b=>{
    b.disabled=true;
    if(b.dataset.correct==='true') b.classList.add('correct');
    else b.classList.add('dim');
  });
  answers.push({ q:curQ.card.q, correct:false, topic:curQ.card.topic||'General', type:curQ.card.type||'recall', chapter:curQ.card.chapter||'General', cardRef:curQ.card, timeLeft:0, earned:0, fmt:curQ.fmt, hintUsed:false });
  const fb=document.getElementById('feedback');
  document.getElementById('fb-icon').textContent='⏰';
  document.getElementById('fb-text').innerHTML="<strong>Time's up!</strong> Correct answer shown above.";
  document.getElementById('fb-pts').textContent='';
  fb.className='feedback timeout show';
  setTimeout(()=>{
    document.getElementById('next-label').textContent = qIdx+1>=quizCards.length ? 'See Results' : 'Next';
    document.getElementById('next-wrap').classList.remove('hidden');
  }, 320);
}

// ═══ FEEDBACK ═════════════════════════════════════════
const PRAISE=['Correct!','Spot on!','Nailed it!','Excellent!','Perfect!','Brilliant!','Right!'];
function showFeedback(correct, wrongAns, earned){
  const fb=document.getElementById('feedback');
  const m=streakMult();
  if(correct){
    const mStr = m>1 ? `<span class="streak-badge">${m}× streak</span>` : '';
    document.getElementById('fb-icon').textContent='✓';
    document.getElementById('fb-text').innerHTML=`<strong>${PRAISE[Math.floor(Math.random()*PRAISE.length)]}</strong>${mStr}`;
    document.getElementById('fb-pts').textContent='+'+earned.toLocaleString()+' pts';
    fb.className='feedback correct show';
  } else {
    document.getElementById('fb-icon').textContent='✗';
    document.getElementById('fb-text').innerHTML = wrongAns
      ? `<strong>Not quite.</strong> Correct: <span class="correct-preview">${esc(wrongAns.slice(0,110))}</span>`
      : '<strong>Not quite.</strong>';
    document.getElementById('fb-pts').textContent='0 pts';
    fb.className='feedback wrong show';
  }
}

// ═══ HINT ═════════════════════════════════════════════
function useHint(){
  if(answered||hintUsed||curQ.fmt!=='mcq') return;
  hintUsed=true;
  const btn=document.getElementById('hint-btn');
  btn.classList.add('used'); btn.textContent='💡 Hint used';
  // Eliminate one random wrong option
  const btns=Array.from(document.querySelectorAll('.opt-btn'));
  const wrong=btns.filter(b=>b.dataset.correct!=='true'&&!b.disabled&&!b.classList.contains('dim'));
  if(wrong.length){ const pick=wrong[Math.floor(Math.random()*wrong.length)]; pick.classList.add('dim'); pick.disabled=true; }
}

// ═══ STREAK ═══════════════════════════════════════════
function streakMult(){
  if(!mode) return 1;
  const cfg=MODES[mode]; let m=1;
  cfg.streakAt.forEach((t,i)=>{ if(streak>=t) m=cfg.streakMult[i]; });
  return m;
}
function updateStreakUI(){
  const el=document.getElementById('streak-display');
  if(streak>=2){
    el.classList.remove('hidden');
    document.getElementById('streak-num').textContent=streak;
    const m=streakMult();
    document.getElementById('streak-mult').textContent=m>1?m+'×':'';
  } else { el.classList.add('hidden'); }
}
function flashStreak(){ const el=document.getElementById('streak-display'); el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'),400); }

// ═══ ADVANCE ══════════════════════════════════════════
function nextQ(){ if(!answered)return; qIdx++; renderQ(); }

// ═══ KEYBOARD ═════════════════════════════════════════
function onKey(e){
  if(!document.getElementById('quiz-section').classList.contains('hidden')){
    const map={a:0,b:1,c:2,d:3,'1':0,'2':1,'3':2,'4':3};
    if(!answered){ const i=map[e.key.toLowerCase()]; if(i!=null){const bs=document.querySelectorAll('.opt-btn');if(bs[i]&&!bs[i].disabled)bs[i].click();} if((e.key==='h'||e.key==='H')&&!hintUsed) useHint(); }
    if(answered&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); if(!document.getElementById('next-wrap').classList.contains('hidden'))nextQ(); }
  }
}

// ═══ RESULTS ══════════════════════════════════════════
function showResults(){
  clearInterval(qTimer);
  document.getElementById('quiz-section').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  document.getElementById('top-fill').style.width='100%';
  window.scrollTo({top:0,behavior:'smooth'});

  const cfg=MODES[mode];
  const total=quizCards.length;
  const pct=Math.round(score/total*100);
  const wrong=answers.filter(a=>!a.correct);
  const timed=answers.filter(a=>!a.correct&&a.timeLeft===0);
  const avgTime=Math.round(answers.reduce((s,a)=>s+(cfg.timer-a.timeLeft),0)/answers.length);

  writeMastery();
  $.set('fg:last_quiz_score',{score,total,pct,difficulty:mode});
  const qc=$.get('fg:quiz_count',0)+1; $.set('fg:quiz_count',qc);
  if(pct===100) earnBadge('perfect');
  if(qc>=5) earnBadge('quiz_5');

  const trophy=pct>=90?'🏆':pct>=75?'🎯':pct>=55?'👍':'📚';
  const grade=pct>=90?'Outstanding!':pct>=75?'Great Work!':pct>=55?'Good Effort!':'Keep Studying!';

  document.getElementById('res-trophy').textContent=trophy;
  document.getElementById('res-score').textContent=`${score}/${total}`;
  document.getElementById('res-pct').textContent=`${pct}% accuracy`;
  document.getElementById('res-grade').textContent=grade;
  document.getElementById('res-points').textContent=pts.toLocaleString()+' pts';
  const rb=document.getElementById('res-mode-badge');
  rb.textContent=cfg.emoji+' '+cfg.label+' Mode';
  rb.style.color=cfg.color; rb.style.background=cfg.colorBg; rb.style.borderColor=cfg.color;

  document.getElementById('res-stats').innerHTML=`
    <div class="rstat"><span class="rstat-n" style="color:#22c55e">${score}</span><span class="rstat-l">Correct</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#ef4444">${wrong.length}</span><span class="rstat-l">Wrong</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#f59e0b">${timed.length}</span><span class="rstat-l">Timed Out</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#a78bfa">${bestStreak}</span><span class="rstat-l">Best Streak</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#38bdf8">${avgTime}s</span><span class="rstat-l">Avg Time</span></div>
    <div class="rstat"><span class="rstat-n" style="color:var(--ac)">${pts.toLocaleString()}</span><span class="rstat-l">Points</span></div>`;

  // Banner
  const bannerDiv=document.getElementById('res-banner');
  if(pct===100){ bannerDiv.innerHTML='<div class="res-banner-inner perfect">🎉 Flawless Victory! Perfect score!</div>'; launchConfetti(cfg.color); }
  else if(pct>=80){ bannerDiv.innerHTML='<div class="res-banner-inner high">🌟 Excellent — you\'re well prepared!</div>'; }
  else bannerDiv.innerHTML='';

  // Format breakdown
  const byFmt={};
  answers.forEach(a=>{ if(!byFmt[a.fmt]){byFmt[a.fmt]={c:0,t:0};} byFmt[a.fmt].t++; if(a.correct)byFmt[a.fmt].c++; });
  const fmtNames={mcq:'Multiple Choice',truefalse:'True / False',reverse:'Reverse Q'};
  const fmtHtml=Object.entries(byFmt).map(([f,d])=>{
    const p=Math.round(d.c/d.t*100);
    return `<div class="fmt-row"><span class="fmt-lbl">${fmtNames[f]||f}</span><span class="fmt-bar-wrap"><span class="fmt-bar" style="width:${p}%"></span></span><span class="fmt-stat">${d.c}/${d.t} · ${p}%</span></div>`;
  }).join('');

  // Weak topics
  const topErr={};
  wrong.forEach(a=>{ topErr[a.topic]=(topErr[a.topic]||0)+1; });
  const weakTopics=Object.entries(topErr).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const weakHtml=weakTopics.length?`<div class="res-section" style="margin-top:1.1rem"><div class="res-sec-title">Topics to Review</div><div class="weak-tags">${weakTopics.map(([t,n])=>`<span class="weak-tag">${esc(t)} · ${n} wrong</span>`).join('')}</div></div>`:'';

  // Per-question list
  const qList=answers.map((a,i)=>{
    const st=a.correct?'correct':a.timeLeft===0?'timed':'wrong';
    const ic=a.correct?'✓':a.timeLeft===0?'⏰':'✗';
    const hTag=a.hintUsed?'<span class="hint-tag">hint</span>':'';
    const fTag=`<span class="fmt-tag">${fmtNames[a.fmt]||a.fmt}</span>`;
    return `<div class="bk-row bk-${st}">
      <div class="bk-ic">${ic}</div>
      <div class="bk-body">
        <div class="bk-q">${esc(strip(a.q).slice(0,80))}${strip(a.q).length>80?'…':''}${hTag}${fTag}</div>
        ${!a.correct&&a.cardRef?`<div class="bk-ans">✓ ${esc(strip(a.cardRef.a).slice(0,80))}</div>`:''}
      </div>
      <div class="bk-pts">${a.correct?'+'+a.earned:a.timeLeft===0?'⏰':'✗'}</div>
    </div>`;
  }).join('');

  document.getElementById('res-body').innerHTML=`
    <div class="res-section"><div class="res-sec-title">Question Formats</div><div class="fmt-breakdown">${fmtHtml}</div></div>
    ${weakHtml}
    <div class="res-section" style="margin-top:1.1rem"><div class="res-sec-title">Full Review</div><div class="bk-list">${qList}</div></div>`;
}

function writeMastery(){
  if(!deckId) return;
  const deck=$.get('fg:d:'+deckId,null);
  if(!deck?.cards) return;
  const res=$.get('fg:r:'+deckId,{});
  answers.forEach(a=>{ if(!a.cardRef) return; const gi=deck.cards.findIndex(c=>c.q===a.cardRef.q&&c.a===a.cardRef.a); if(gi===-1)return; if(a.correct) res[gi]='good'; else if(res[gi]==null) res[gi]='again'; });
  $.set('fg:r:'+deckId,res);
  const tot=$.get('fg:tot_rated',0)+answers.length; $.set('fg:tot_rated',tot);
  if(tot>=50) earnBadge('rated_50');
  if(tot>=100) earnBadge('rated_100');
}

function earnBadge(id){ const e=$.get('fg:badges',[]); if(!e.includes(id)){e.push(id);$.set('fg:badges',e);} }

// ═══ CONFETTI ═════════════════════════════════════════
function launchConfetti(base){
  const cols=[base,'#fff','rgba(255,255,255,.7)','rgba(255,255,255,.4)'];
  for(let i=0;i<80;i++){
    setTimeout(()=>{
      const el=document.createElement('div');
      const s=Math.random()*8+4;
      el.style.cssText=`position:fixed;left:${Math.random()*100}vw;top:-10px;width:${s}px;height:${s}px;background:${cols[Math.floor(Math.random()*cols.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation:confettiFall ${2+Math.random()*2}s linear ${Math.random()*.5}s both;pointer-events:none;z-index:9999`;
      document.body.appendChild(el); setTimeout(()=>el.remove(),4500);
    },i*28);
  }
}

// ═══ UTILS ════════════════════════════════════════════
function strip(s){ return (s||'').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim(); }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
