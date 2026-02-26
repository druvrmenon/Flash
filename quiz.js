// ═══════════════════════════════════════════════════════
//  FlashGen Quiz Engine v2  —  3-tier difficulty system
// ═══════════════════════════════════════════════════════

const $ = {
  get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d}catch{return d}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
};

// ─── Difficulty presets ────────────────────────────────
const MODES = {
  easy: {
    label:'Easy', emoji:'🟢',
    color:'#22c55e', colorBg:'rgba(34,197,94,.1)', colorBorder:'rgba(34,197,94,.2)',
    timer:45, basePoints:100, timeBonusMax:50,
    optCount:3,                    // 3 choices
    formats:['mcq','truefalse'],   // mix of MCQ and True/False
    distractorStrategy:'random',   // distractors from different topics
    hintEnabled:true,
    streakAt:[3,6,10], streakMult:[1.5,2,2.5],
    cardPool: cards => cards,      // all cards
    blurb:'3 choices · 45 s · hints available · all cards'
  },
  medium: {
    label:'Medium', emoji:'🟡',
    color:'#f59e0b', colorBg:'rgba(245,158,11,.1)', colorBorder:'rgba(245,158,11,.2)',
    timer:30, basePoints:200, timeBonusMax:120,
    optCount:4,
    formats:['mcq'],
    distractorStrategy:'chapter',  // same-chapter answers as distractors
    hintEnabled:false,
    streakAt:[3,5,8], streakMult:[1.5,2,3],
    cardPool: cards => cards,
    blurb:'4 choices · 30 s · chapter-matched distractors'
  },
  hard: {
    label:'Hard', emoji:'🔴',
    color:'#ef4444', colorBg:'rgba(239,68,68,.1)', colorBorder:'rgba(239,68,68,.2)',
    timer:15, basePoints:350, timeBonusMax:250,
    optCount:4,
    formats:['mcq','reverse'],     // also: show answer → pick correct question
    distractorStrategy:'topic',    // same-topic = almost identical answers
    hintEnabled:false,
    streakAt:[2,4,7], streakMult:[2,3,4],
    // prioritise high-priority cards; fall back to all if too few
    cardPool: cards => {
      const hi = cards.filter(c=>c.priority==='high');
      return hi.length>=4 ? hi : cards;
    },
    blurb:'4 choices · 15 s · same-topic traps · reverse questions'
  }
};

// ─── State ────────────────────────────────────────────
let allCards=[], deckId=null, mode=null;
let quizCards=[], qIdx=0, score=0, pts=0, streak=0, bestStreak=0;
let answers=[], timer=null, timeLeft=0, answered=false;
let selectedCount=10, hintUsed=false, curQ=null;

// ─── Load ─────────────────────────────────────────────
function loadCards(){
  deckId = localStorage.getItem('fg:quiz_deck_id')||null;
  const raw = localStorage.getItem('fg:quiz_all_cards');
  if(raw){try{const p=JSON.parse(raw);if(Array.isArray(p)&&p.length>=4){allCards=p;return true}}catch{}}
  if(deckId){const d=$.get('fg:d:'+deckId,null);if(d?.cards?.length>=4){allCards=d.cards;return true}}
  const idx=$.get('fg:idx',[]);
  for(const it of idx){const d=$.get('fg:d:'+it.id,null);if(d?.cards)allCards=[...allCards,...d.cards]}
  return allCards.length>=4;
}

// ─── Init ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded',()=>{
  if(!loadCards()||allCards.length<4){
    document.getElementById('start-card').classList.add('hidden');
    document.getElementById('no-cards').classList.remove('hidden');
    return;
  }

  // Deck title
  let deckName='Your deck';
  if(deckId){const d=$.get('fg:d:'+deckId,null);if(d?.meta?.name)deckName=d.meta.name;}
  document.getElementById('deck-title').textContent=deckName.slice(0,50);
  document.getElementById('deck-count').textContent=allCards.length+' cards';

  // Difficulty cards
  document.querySelectorAll('.diff-card').forEach(el=>{
    el.addEventListener('click',()=>{
      document.querySelectorAll('.diff-card').forEach(d=>d.classList.remove('active'));
      el.classList.add('active');
      mode = el.dataset.mode;
      updateCountBtns();
      document.getElementById('start-btn').disabled = false;
    });
  });

  // Count buttons
  document.querySelectorAll('.qc-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.qc-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selectedCount=parseInt(btn.dataset.n);
    });
  });
  updateCountBtns();

  document.getElementById('start-btn').addEventListener('click', startQuiz);
  document.getElementById('exit-btn').addEventListener('click',()=>{clearInterval(timer);window.location.href='index.html?return=cards';});
  document.getElementById('retry-btn').addEventListener('click',resetToStart);
  document.getElementById('back-btn').addEventListener('click',()=>window.location.href='index.html?return=quiz-done');
  document.getElementById('stats-btn').addEventListener('click',()=>window.location.href='index.html?return=dashboard');
  document.getElementById('next-btn').addEventListener('click', nextQ);
  document.getElementById('hint-btn').addEventListener('click', useHint);
  document.addEventListener('keydown', onKey);
});

function updateCountBtns(){
  const pool = mode ? MODES[mode].cardPool(allCards) : allCards;
  document.querySelectorAll('.qc-btn').forEach(btn=>{
    const n=parseInt(btn.dataset.n);
    const disabled = n>pool.length;
    btn.disabled=disabled;
    btn.style.opacity=disabled?'0.3':'';
    if(disabled) btn.classList.remove('active');
  });
  const firstOk=document.querySelector('.qc-btn:not([disabled])');
  if(!document.querySelector('.qc-btn.active:not([disabled])')&&firstOk){
    document.querySelectorAll('.qc-btn').forEach(b=>b.classList.remove('active'));
    firstOk.classList.add('active');
    selectedCount=parseInt(firstOk.dataset.n);
  }
}

function resetToStart(){
  document.getElementById('results-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.documentElement.style.removeProperty('--mode-color');
  document.documentElement.style.removeProperty('--mode-bg');
  document.documentElement.style.removeProperty('--mode-border');
}

// ═══════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════
function startQuiz(){
  if(!mode) return;
  const cfg=MODES[mode];
  const pool = cfg.cardPool(allCards);
  quizCards = [...pool].sort(()=>Math.random()-.5).slice(0,Math.min(selectedCount,pool.length));
  qIdx=0; score=0; pts=0; streak=0; bestStreak=0; answers=[]; answered=false;

  // Apply mode colours to root
  document.documentElement.style.setProperty('--mode-color', cfg.color);
  document.documentElement.style.setProperty('--mode-bg', cfg.colorBg);
  document.documentElement.style.setProperty('--mode-border', cfg.colorBorder);

  // HUD badge
  const badge=document.getElementById('mode-badge');
  badge.textContent=cfg.emoji+' '+cfg.label;
  badge.style.color=cfg.color;
  badge.style.background=cfg.colorBg;
  badge.style.borderColor=cfg.colorBorder;
  document.getElementById('hud').classList.remove('hidden');

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('quiz-section').classList.remove('hidden');
  renderQ();
}

// ═══════════════════════════════════════════════════════
//  QUESTION BUILDER
// ═══════════════════════════════════════════════════════
function buildQuestion(card){
  const cfg=MODES[mode];
  const formats=cfg.formats;
  // Pick format: hard alternates mcq/reverse roughly 65/35; easy alternates mcq/truefalse 55/45
  let fmt;
  if(formats.length===1){ fmt=formats[0]; }
  else if(mode==='hard'){ fmt=Math.random()<0.65?'mcq':'reverse'; }
  else { fmt=Math.random()<0.55?'mcq':'truefalse'; }

  // Reverse only works well with recall/concept — fallback to mcq for formula/diagram
  if(fmt==='reverse'&&(card.type==='formula'||card.type==='diagram')) fmt='mcq';

  if(fmt==='truefalse') return buildTF(card);
  if(fmt==='reverse')   return buildReverse(card);
  return buildMCQ(card, cfg.optCount, cfg.distractorStrategy);
}

// ── Standard MCQ ──
function buildMCQ(card, optCount, strategy){
  const correct = strip(card.a).slice(0,160);
  const distractors = getDistractors(card, correct, optCount-1, strategy);
  const opts = shuffle([correct,...distractors]);
  return {
    fmt:'mcq',
    prompt: strip(card.q),
    opts,
    correctIdx: opts.indexOf(correct),
    card,
    tag: typeTag(card)
  };
}

// ── True / False ──
function buildTF(card){
  const correctAns = strip(card.a);
  const useCorrect = Math.random()>0.4;
  let shownAns, isTrue;
  if(useCorrect){
    shownAns=correctAns; isTrue=true;
  } else {
    const other=allCards.filter(c=>c!==card&&c.a);
    const pick=other[Math.floor(Math.random()*other.length)];
    shownAns=pick?strip(pick.a):correctAns;
    isTrue = shownAns===correctAns;
  }
  return {
    fmt:'truefalse',
    prompt: strip(card.q),
    shownAns: shownAns.slice(0,200),
    opts:['True','False'],
    correctIdx: isTrue?0:1,
    card,
    tag: typeTag(card)
  };
}

// ── Reverse: show answer → pick correct question ──
function buildReverse(card){
  const correctQ = strip(card.q).slice(0,150);
  const wrongQs = allCards
    .filter(c=>c!==card&&c.q)
    .sort(()=>Math.random()-.5)
    .slice(0,3)
    .map(c=>strip(c.q).slice(0,150));
  const opts = shuffle([correctQ,...wrongQs]);
  return {
    fmt:'reverse',
    prompt: strip(card.a).slice(0,250), // show the ANSWER as the question
    label:'Which question does this answer belong to?',
    opts,
    correctIdx: opts.indexOf(correctQ),
    card,
    tag:{text:'🔄 Reverse',cls:'tag-reverse'}
  };
}

// ── Distractor engine ──
function getDistractors(card, correct, count, strategy){
  let pool;
  if(strategy==='topic'){
    // Same topic first — nearly identical domain, very tricky
    const sameTopic = allCards.filter(c=>c!==card&&c.topic===card.topic);
    const sameChap  = allCards.filter(c=>c!==card&&c.chapter===card.chapter&&c.topic!==card.topic);
    const rest      = allCards.filter(c=>c!==card&&c.chapter!==card.chapter);
    pool=[...sameTopic,...sameChap,...rest];
  } else if(strategy==='chapter'){
    // Same chapter first — same general subject area
    const sameChap  = allCards.filter(c=>c!==card&&c.chapter===card.chapter);
    const rest      = allCards.filter(c=>c!==card&&c.chapter!==card.chapter);
    pool=[...sameChap,...rest];
  } else {
    // Random — pick from different topics so they're easy to distinguish
    const diffTopic = allCards.filter(c=>c!==card&&c.topic!==card.topic);
    const sameTopic = allCards.filter(c=>c!==card&&c.topic===card.topic);
    pool=[...diffTopic,...sameTopic];
  }

  const seen=new Set([correct]);
  const result=[];
  for(const c of pool){
    const t=strip(c.a).slice(0,160);
    if(!seen.has(t)&&t.length>4){seen.add(t);result.push(t);if(result.length>=count)break;}
  }
  while(result.length<count) result.push('None of the above');
  return result.slice(0,count);
}

// ── Tag helper ──
const TYPE_TAGS={
  recall:{text:'🧠 Recall',cls:'tag-recall'},
  formula:{text:'🧪 Formula',cls:'tag-formula'},
  diagram:{text:'📐 Diagram',cls:'tag-diagram'},
  concept:{text:'💡 Concept',cls:'tag-concept'},
  application:{text:'🎯 Applied',cls:'tag-applied'}
};
function typeTag(card){ return TYPE_TAGS[card.type]||{text:'📝 Card',cls:'tag-recall'}; }

// ═══════════════════════════════════════════════════════
//  RENDER QUESTION
// ═══════════════════════════════════════════════════════
function renderQ(){
  if(qIdx>=quizCards.length){ showResults(); return; }
  answered=false; hintUsed=false;
  curQ=buildQuestion(quizCards[qIdx]);
  const cfg=MODES[mode];

  // HUD
  const p=qIdx/quizCards.length*100;
  document.getElementById('top-fill').style.width=p+'%';
  document.getElementById('q-counter').textContent=`${qIdx+1} / ${quizCards.length}`;
  document.getElementById('pts-display').textContent=pts.toLocaleString();
  updateStreakUI();

  // Tag
  const tagEl=document.getElementById('q-tag');
  tagEl.textContent=curQ.tag.text;
  tagEl.className='q-tag '+curQ.tag.cls;

  // Topic/chapter
  const metaEl=document.getElementById('q-meta');
  const parts=[];
  if(curQ.card.topic) parts.push(curQ.card.topic);
  if(curQ.card.chapter&&curQ.card.chapter!=='General') parts.push(curQ.card.chapter.slice(0,30));
  metaEl.textContent=parts.join('  ·  ');
  metaEl.style.display=parts.length?'':'none';

  // Format-specific label
  const fmtLabel=document.getElementById('fmt-label');
  if(curQ.fmt==='truefalse'){
    fmtLabel.style.display='';
    fmtLabel.textContent='Is this answer correct?';
  } else if(curQ.fmt==='reverse'){
    fmtLabel.style.display='';
    fmtLabel.textContent=curQ.label;
  } else {
    fmtLabel.style.display='none';
  }

  // Question text
  document.getElementById('q-text').textContent=curQ.prompt;

  // True/False alleged answer block
  const tfBlock=document.getElementById('tf-block');
  if(curQ.fmt==='truefalse'){
    document.getElementById('tf-ans').textContent=curQ.shownAns;
    tfBlock.style.display='';
  } else {
    tfBlock.style.display='none';
  }

  // Options
  const grid=document.getElementById('opts-grid');
  grid.innerHTML='';
  const LETTERS=['A','B','C','D'];
  const isTF=curQ.fmt==='truefalse';
  grid.style.gridTemplateColumns = isTF ? '1fr 1fr' : '';
  curQ.opts.forEach((opt,i)=>{
    const btn=document.createElement('button');
    btn.className='opt-btn';
    btn.dataset.i=i;
    btn.dataset.correct=(i===curQ.correctIdx);
    if(isTF){
      const icon=i===0?'✓':'✗';
      btn.innerHTML=`<span class="opt-tf-icon">${icon}</span><span class="opt-tf-text">${esc(opt)}</span>`;
    } else {
      btn.innerHTML=`<span class="opt-letter">${LETTERS[i]}</span><span class="opt-text">${esc(opt.slice(0,170))}</span>`;
    }
    btn.addEventListener('click',()=>pickAnswer(btn,i));
    grid.appendChild(btn);
  });

  // Hint
  const hintBtn=document.getElementById('hint-btn');
  const showHint=cfg.hintEnabled&&curQ.fmt==='mcq';
  hintBtn.style.display=showHint?'flex':'none';
  hintBtn.textContent='💡 Hint';
  hintBtn.classList.remove('used');

  // Max points indicator
  document.getElementById('pts-possible').textContent=`+${cfg.basePoints+cfg.timeBonusMax}`;

  // Reset feedback/next
  document.getElementById('feedback').className='feedback';
  document.getElementById('next-wrap').classList.add('hidden');

  // Animate in
  ['q-card','opts-grid'].forEach(id=>{
    const el=document.getElementById(id);
    el.style.animation='none'; el.offsetHeight; el.style.animation='';
  });

  startTimer();
}

// ─── Timer ───────────────────────────────────────────
function startTimer(){
  clearInterval(timer);
  const cfg=MODES[mode];
  timeLeft=cfg.timer;
  const fill=document.getElementById('timer-fill');
  const num=document.getElementById('timer-num');
  fill.style.width='100%'; fill.className='timer-fill';
  num.textContent=timeLeft; num.className='timer-num';

  timer=setInterval(()=>{
    timeLeft--;
    const pct=timeLeft/cfg.timer*100;
    fill.style.width=pct+'%';
    num.textContent=timeLeft;
    if(pct<=40){fill.className='timer-fill warn';num.className='timer-num warn';}
    if(pct<=20){fill.className='timer-fill danger';num.className='timer-num danger';}
    if(timeLeft<=0){clearInterval(timer);timeout();}
  },1000);
}

// ─── Pick answer ──────────────────────────────────────
function pickAnswer(btn, idx){
  if(answered) return;
  answered=true;
  clearInterval(timer);
  const cfg=MODES[mode];
  const correct=idx===curQ.correctIdx;

  document.querySelectorAll('.opt-btn').forEach((b,i)=>{
    b.disabled=true;
    if(i===curQ.correctIdx)     b.classList.add('correct');
    else if(b===btn&&!correct)  b.classList.add('wrong');
    else                        b.classList.add('dim');
  });

  let earned=0;
  if(correct){
    score++;
    streak++;
    bestStreak=Math.max(bestStreak,streak);
    const timeRatio=timeLeft/cfg.timer;
    const timePts=Math.round(cfg.timeBonusMax*timeRatio);
    const mult=getStreakMult();
    earned=Math.round((cfg.basePoints+timePts)*mult);
    pts+=earned;
    if(streak>=cfg.streakAt[0]) flashStreak();
  } else {
    streak=0;
  }
  updateStreakUI();

  answers.push({
    q:curQ.card.q, correct,
    topic:curQ.card.topic||'General',
    type:curQ.card.type||'recall',
    chapter:curQ.card.chapter||'General',
    cardRef:curQ.card,
    timeLeft, earned, fmt:curQ.fmt, hintUsed
  });

  showFeedback(correct, correct?null:curQ.opts[curQ.correctIdx], earned);
  setTimeout(()=>{
    document.getElementById('next-label').textContent=qIdx+1>=quizCards.length?'See Results':'Next';
    document.getElementById('next-wrap').classList.remove('hidden');
  },320);
}

// ─── Timeout ─────────────────────────────────────────
function timeout(){
  if(answered) return;
  answered=true; streak=0; updateStreakUI();
  document.querySelectorAll('.opt-btn').forEach(b=>{
    b.disabled=true;
    if(b.dataset.correct==='true') b.classList.add('correct');
    else b.classList.add('dim');
  });
  answers.push({
    q:curQ.card.q, correct:false,
    topic:curQ.card.topic||'General', type:curQ.card.type||'recall',
    chapter:curQ.card.chapter||'General', cardRef:curQ.card,
    timeLeft:0, earned:0, fmt:curQ.fmt, hintUsed:false
  });
  const fb=document.getElementById('feedback');
  document.getElementById('fb-icon').textContent='⏰';
  document.getElementById('fb-text').innerHTML='<strong>Time\'s up!</strong> Correct answer shown above.';
  document.getElementById('fb-pts').textContent=''; fb.className='feedback timeout show';
  setTimeout(()=>{
    document.getElementById('next-label').textContent=qIdx+1>=quizCards.length?'See Results':'Next';
    document.getElementById('next-wrap').classList.remove('hidden');
  },320);
}

// ─── Feedback ────────────────────────────────────────
const PRAISE=['Correct!','Spot on!','Nailed it!','Excellent!','Perfect!','Brilliant!','That\'s right!'];
function showFeedback(correct, wrongAns, earned){
  const fb=document.getElementById('feedback');
  const mult=getStreakMult();
  if(correct){
    const multStr=mult>1?` <span class="streak-mult">${mult}× streak</span>`:'';
    document.getElementById('fb-icon').textContent='✓';
    document.getElementById('fb-text').innerHTML=`<strong>${PRAISE[Math.floor(Math.random()*PRAISE.length)]}</strong>${multStr}`;
    document.getElementById('fb-pts').textContent='+'+earned.toLocaleString()+' pts';
    fb.className='feedback correct show';
  } else {
    document.getElementById('fb-icon').textContent='✗';
    document.getElementById('fb-text').innerHTML=wrongAns
      ?`<strong>Not quite.</strong> Correct: <span class="correct-preview">${esc(wrongAns.slice(0,100))}</span>`
      :'<strong>Not quite.</strong>';
    document.getElementById('fb-pts').textContent='0 pts';
    fb.className='feedback wrong show';
  }
}

// ─── Hint ────────────────────────────────────────────
function useHint(){
  if(answered||hintUsed||curQ.fmt!=='mcq') return;
  hintUsed=true;
  const btn=document.getElementById('hint-btn');
  btn.classList.add('used'); btn.textContent='💡 Used';
  // Eliminate one wrong option
  const btns=Array.from(document.querySelectorAll('.opt-btn'));
  const wrong=btns.filter(b=>b.dataset.correct!=='true'&&!b.disabled&&!b.classList.contains('dim'));
  if(wrong.length){
    const pick=wrong[Math.floor(Math.random()*wrong.length)];
    pick.classList.add('dim'); pick.disabled=true; pick.style.opacity='0.2';
  }
}

// ─── Streak ──────────────────────────────────────────
function getStreakMult(){
  if(!mode) return 1;
  const cfg=MODES[mode];
  let m=1;
  cfg.streakAt.forEach((t,i)=>{if(streak>=t)m=cfg.streakMult[i];});
  return m;
}
function updateStreakUI(){
  const el=document.getElementById('streak-display');
  if(streak>=2){
    el.classList.remove('hidden');
    document.getElementById('streak-num').textContent=streak;
    const m=getStreakMult();
    document.getElementById('streak-mult').textContent=m>1?m+'×':'';
  } else {
    el.classList.add('hidden');
  }
}
function flashStreak(){
  const el=document.getElementById('streak-display');
  el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'),400);
}

// ─── Next ────────────────────────────────────────────
function nextQ(){ if(!answered) return; qIdx++; renderQ(); }

// ─── Keys ────────────────────────────────────────────
function onKey(e){
  const on=!document.getElementById('quiz-section').classList.contains('hidden');
  if(!on) return;
  const map={a:0,b:1,c:2,d:3,'1':0,'2':1,'3':2,'4':3};
  if(!answered){
    const i=map[e.key.toLowerCase()];
    if(i!=null){const btns=document.querySelectorAll('.opt-btn');if(btns[i]&&!btns[i].disabled)btns[i].click();}
    if(e.key==='h'&&!hintUsed) useHint();
  }
  if(answered&&(e.key==='Enter'||e.key===' ')){
    e.preventDefault();
    if(!document.getElementById('next-wrap').classList.contains('hidden'))nextQ();
  }
}

// ═══════════════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════════════
function showResults(){
  clearInterval(timer);
  document.getElementById('quiz-section').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  document.getElementById('top-fill').style.width='100%';
  window.scrollTo({top:0,behavior:'smooth'});

  const cfg=MODES[mode];
  const total=quizCards.length;
  const pct=Math.round(score/total*100);
  const wrong=answers.filter(a=>!a.correct);
  const timedOut=answers.filter(a=>!a.correct&&a.timeLeft===0);
  const avgTime=Math.round(answers.reduce((s,a)=>s+(cfg.timer-a.timeLeft),0)/answers.length);

  // Write back to mastery data
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
  rb.style.color=cfg.color; rb.style.background=cfg.colorBg; rb.style.borderColor=cfg.colorBorder;

  // Stats
  document.getElementById('res-stats').innerHTML=`
    <div class="rstat"><span class="rstat-n" style="color:#22c55e">${score}</span><span class="rstat-l">Correct</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#ef4444">${wrong.length}</span><span class="rstat-l">Wrong</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#f59e0b">${timedOut.length}</span><span class="rstat-l">Timed Out</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#a78bfa">${bestStreak}</span><span class="rstat-l">Best Streak</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#38bdf8">${avgTime}s</span><span class="rstat-l">Avg Time</span></div>
    <div class="rstat"><span class="rstat-n" style="color:#fb923c">${pts.toLocaleString()}</span><span class="rstat-l">Points</span></div>
  `;

  // Banner
  const banner=document.getElementById('res-banner');
  if(pct===100){banner.innerHTML='<div class="res-banner perfect">🎉 Flawless! Perfect score!</div>';launchConfetti(cfg.color);}
  else if(pct>=80){banner.innerHTML='<div class="res-banner high">🌟 Excellent performance!</div>';}
  else banner.innerHTML='';
  if(pct>=90) launchConfetti(cfg.color);

  // Format breakdown
  const byFmt={};
  answers.forEach(a=>{
    if(!byFmt[a.fmt]) byFmt[a.fmt]={c:0,t:0};
    byFmt[a.fmt].t++; if(a.correct)byFmt[a.fmt].c++;
  });
  const fmtNames={mcq:'Multiple Choice',truefalse:'True / False',reverse:'Reverse Q'};
  const fmtHtml=Object.entries(byFmt).map(([f,d])=>{
    const p=Math.round(d.c/d.t*100);
    return `<div class="fmt-row">
      <span class="fmt-lbl">${fmtNames[f]||f}</span>
      <span class="fmt-bar-wrap"><span class="fmt-bar" style="width:${p}%;background:var(--mode-color,#7c6ffa)"></span></span>
      <span class="fmt-stat">${d.c}/${d.t} (${p}%)</span>
    </div>`;
  }).join('');

  // Weak topics
  const topErr={};
  wrong.forEach(a=>{topErr[a.topic]=(topErr[a.topic]||0)+1;});
  const weak=Object.entries(topErr).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const weakHtml=weak.length?`
    <div class="res-section"><div class="res-section-title">⚠ Topics to Review</div>
    <div class="weak-tags">${weak.map(([t,n])=>`<span class="weak-tag">${esc(t)} · ${n} wrong</span>`).join('')}</div></div>`:'';

  // Per-question list
  const qList=answers.map((a,i)=>{
    const st=a.correct?'correct':a.timeLeft===0?'timed':'wrong';
    const ic=a.correct?'✓':a.timeLeft===0?'⏰':'✗';
    const hint=a.hintUsed?'<span class="hint-used-tag">hint</span>':'';
    const fmtTag=`<span class="q-fmt-tag">${fmtNames[a.fmt]||a.fmt}</span>`;
    return `<div class="bk-row bk-${st}">
      <div class="bk-ic">${ic}</div>
      <div class="bk-body">
        <div class="bk-q">${esc(strip(a.q).slice(0,80))}${strip(a.q).length>80?'…':''}${hint}${fmtTag}</div>
        ${!a.correct&&a.cardRef?`<div class="bk-ans">✓ ${esc(strip(a.cardRef.a).slice(0,80))}</div>`:''}
      </div>
      <div class="bk-pts">${a.correct?'+'+a.earned:a.timeLeft===0?'⏰':'✗'}</div>
    </div>`;
  }).join('');

  document.getElementById('res-body').innerHTML=`
    <div class="res-section"><div class="res-section-title">Question Formats</div>
    <div class="fmt-breakdown">${fmtHtml}</div></div>
    ${weakHtml}
    <div class="res-section"><div class="res-section-title">Full Review</div>
    <div class="bk-list">${qList}</div></div>`;
}

// ─── Write quiz results back to mastery ──────────────
function writeMastery(){
  if(!deckId) return;
  const deck=$.get('fg:d:'+deckId,null);
  if(!deck?.cards) return;
  const res=$.get('fg:r:'+deckId,{});
  answers.forEach(a=>{
    if(!a.cardRef) return;
    const gi=deck.cards.findIndex(c=>c.q===a.cardRef.q&&c.a===a.cardRef.a);
    if(gi===-1) return;
    if(a.correct) res[gi]='good';
    else if(res[gi]==null) res[gi]='again';
  });
  $.set('fg:r:'+deckId,res);
  const tot=$.get('fg:tot_rated',0)+answers.length; $.set('fg:tot_rated',tot);
  if(tot>=50) earnBadge('rated_50');
  if(tot>=100) earnBadge('rated_100');
}

function earnBadge(id){
  const e=$.get('fg:badges',[]);
  if(!e.includes(id)){e.push(id);$.set('fg:badges',e);}
}

// ─── Confetti ────────────────────────────────────────
function launchConfetti(base){
  const cols=[base,'#fff','#f0f0ff','#a78bfa','#38bdf8'];
  for(let i=0;i<90;i++){
    setTimeout(()=>{
      const el=document.createElement('div');
      const s=Math.random()*8+5;
      el.style.cssText=`position:fixed;left:${Math.random()*100}vw;top:-12px;
        width:${s}px;height:${s}px;background:${cols[Math.floor(Math.random()*cols.length)]};
        border-radius:${Math.random()>.5?'50%':'2px'};
        animation:confettiFall ${2+Math.random()*2}s linear ${Math.random()*.5}s both;
        pointer-events:none;z-index:9999`;
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),4500);
    },i*25);
  }
}

// ─── Utils ───────────────────────────────────────────
function strip(s){return(s||'').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim();}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
