/* ══════════════════════════════════════════
   FLASHGEN v3 — COMPLETE ENGINE
══════════════════════════════════════════ */

// ── BADGES ──
const BADGES=[
  {id:'first_deck',e:'🌱',n:'First Deck',d:'Generate your first deck'},
  {id:'streak_3',e:'🔥',n:'On Fire',d:'3-day streak'},
  {id:'streak_7',e:'💪',n:'Committed',d:'7-day streak'},
  {id:'streak_30',e:'🏆',n:'Legend',d:'30-day streak'},
  {id:'decks_5',e:'📚',n:'Bookworm',d:'5 decks generated'},
  {id:'rated_50',e:'⚡',n:'Quick Study',d:'Rate 50 cards'},
  {id:'rated_100',e:'🎓',n:'Centurion',d:'Rate 100 cards'},
  {id:'formula_10',e:'🧪',n:'Formula Fan',d:'Rate 10 formula cards'},
  {id:'perfect',e:'🎯',n:'Flawless',d:'100% correct in a quiz'},
  {id:'quiz_5',e:'🏅',n:'Quiz Addict',d:'Complete 5 quizzes'},
  {id:'exam_set',e:'📅',n:'Planner',d:'Set an exam date'},
  {id:'yt_used',e:'▶️',n:'Video Learner',d:'Generate from YouTube'},
  {id:'merged',e:'🔀',n:'Merger',d:'Merge two decks'},
  {id:'sr_streak',e:'🧬',n:'Spaced Learner',d:'Rate 20 cards with SR'},
];

// ── STATE ──
let selCount=10, pdfFile=null, ytUrl='', activeTab='pdf', selExam='CBSE-12';
let allCards=[], filteredCards=[], cardIdx=0, seenSet=new Set(), flipped=false;
let curDeckId=null, sidebarOpen=false, mchart=null;
let mergingMode=false, mergeSelected=new Set();

// ── STORAGE ──
const $={
  get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d}catch{return d}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
  del:(k)=>{try{localStorage.removeItem(k)}catch{}}
};
const getKey=()=>localStorage.getItem('fg_key')||'';
const saveKey=k=>localStorage.setItem('fg_key',k);
const getIdx=()=>$.get('fg:idx',[]);
const setIdx=a=>$.set('fg:idx',a);
const getDeck=id=>$.get('fg:d:'+id,null);
const setDeck=(id,m,c)=>$.set('fg:d:'+id,{meta:m,cards:c});
const rmDeck=id=>{$.del('fg:d:'+id);$.del('fg:r:'+id);$.del('fg:sr:'+id)};
const getRes=id=>$.get('fg:r:'+id,{});
const setRes=(id,r)=>$.set('fg:r:'+id,r);
const getSR=id=>$.get('fg:sr:'+id,{});
const setSR=(id,r)=>$.set('fg:sr:'+id,r);

// ── THEMES ──
const THEMES=['aurora','parchment','sakura','ocean','forest','ember','neon','slate'];
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);$.set('fg:theme',t);
  document.querySelectorAll('.sw').forEach(s=>s.classList.toggle('active',s.dataset.t===t));
  if(mchart) buildChart(computeMastery());
}
document.querySelectorAll('.sw').forEach(s=>s.addEventListener('click',()=>applyTheme(s.dataset.t)));

// ── OFFLINE ──
function checkOnline(){
  const off=!navigator.onLine;
  document.getElementById('offline-banner').classList.toggle('show',off);
  document.getElementById('offline-dot').classList.toggle('show',off);
}
window.addEventListener('online',checkOnline);
window.addEventListener('offline',checkOnline);

// ── SM-2 ALGORITHM ──
function sm2(cardData, quality) {
  let {ef=2.5, interval=1, reps=0} = cardData;
  if(quality >= 2){
    if(reps===0) interval=1;
    else if(reps===1) interval=6;
    else interval=Math.round(interval*ef);
    if(quality===3) interval=Math.round(interval*1.3);
    reps++;
    ef=Math.max(1.3, ef+0.1-(3-quality)*(0.08+(3-quality)*0.02));
  } else {
    reps=0; interval=1;
    ef=Math.max(1.3, ef-0.2);
  }
  const nextReview=new Date(Date.now()+interval*864e5).toISOString().slice(0,10);
  return {ef, interval, reps, nextReview};
}
function getDueCount(){
  const today=new Date().toISOString().slice(0,10);
  let due=0;
  getIdx().forEach(item=>{
    const sr=getSR(item.id);
    Object.values(sr).forEach(v=>{if(v.nextReview&&v.nextReview<=today) due++;});
  });
  return due;
}

// ── STREAK ──
function getStreak(){return $.get('fg:streak',{cur:0,best:0,last:null,hist:[]})}
function updateStreak(){
  const s=getStreak(),today=new Date().toISOString().slice(0,10);
  if(s.last===today) return s;
  const yday=new Date(Date.now()-864e5).toISOString().slice(0,10);
  s.cur=s.last===yday?s.cur+1:1;s.best=Math.max(s.best,s.cur);s.last=today;
  s.hist=s.hist||[];s.hist.push(today);if(s.hist.length>30)s.hist=s.hist.slice(-30);
  $.set('fg:streak',s);
  if(s.cur>=3)earnBadge('streak_3');if(s.cur>=7)earnBadge('streak_7');if(s.cur>=30)earnBadge('streak_30');
  return s;
}
function renderStreakNav(){
  const s=getStreak(),el=document.getElementById('nav-streak');
  if(s.cur>0){el.classList.add('show');document.getElementById('nav-snum').textContent=s.cur;}
  else el.classList.remove('show');
}

// ── BADGES ──
function getBadges(){return $.get('fg:badges',[])}
function earnBadge(id){
  const e=getBadges();if(e.includes(id))return;e.push(id);$.set('fg:badges',e);
  const b=BADGES.find(x=>x.id===id);if(b)showToast('🏆 '+b.n+' — '+b.d,'info');
}
function checkRateBadges(cardType){
  const t=$.get('fg:tot_rated',0)+1;$.set('fg:tot_rated',t);
  if(t>=50)earnBadge('rated_50');if(t>=100)earnBadge('rated_100');
  if(cardType==='formula'){const f=$.get('fg:formula_rated',0)+1;$.set('fg:formula_rated',f);if(f>=10)earnBadge('formula_10');}
  const sr=$.get('fg:sr_rated',0)+1;$.set('fg:sr_rated',sr);if(sr>=20)earnBadge('sr_streak');
}

// ── COUNTDOWN ──
function getExamDate(){return $.get('fg:examdate',null)}
function renderCountdown(){
  const d=getExamDate(),el=document.getElementById('cd-msg');
  if(!d){el.textContent='';return;}
  const days=Math.ceil((new Date(d)-new Date())/864e5);
  if(days<0){el.textContent='Exam passed.';return;}
  if(days===0){el.textContent='🎯 Exam TODAY — you got this!';return;}
  el.textContent=`⏳ ${days} day${days!==1?'s':''} to exam`;
  const b=document.getElementById('exam-banner');
  if(b){b.textContent=`📅 ${days} day${days!==1?'s':''} to exam · Cards sorted by priority · 🔴 = must-know`;b.classList.add('show');}
}
document.getElementById('date-save').addEventListener('click',()=>{
  const v=document.getElementById('exam-date').value;
  if(!v){showToast('Pick a date first','error');return;}
  $.set('fg:examdate',v);earnBadge('exam_set');renderCountdown();showToast('📅 Exam date saved!');
});

// ── SCREEN ──
function showScreen(n){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('screen-'+n).classList.add('active');}

// ── API KEY ──
document.getElementById('api-save-btn').addEventListener('click',()=>{
  const k=document.getElementById('api-key-input').value.trim();
  if(!k.startsWith('AIza')||k.length<20){showToast('Enter a valid Gemini API key (starts with AIza)','error');return;}
  saveKey(k);showScreen('upload');renderLibrary();renderStreakNav();
});
document.getElementById('api-key-input').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('api-save-btn').click();});
document.getElementById('btn-key').addEventListener('click',()=>{document.getElementById('api-key-input').value=getKey();showScreen('apikey');});

// ── TABS ──
document.querySelectorAll('.tab').forEach(b=>{
  b.addEventListener('click',()=>{
    activeTab=b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tabp').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');document.getElementById('tab-'+activeTab).classList.add('active');
    updateGenBtn();
  });
});

// ── UPLOAD ──
const dz=document.getElementById('dz'),pdfInp=document.getElementById('pdf-input');
const fpill=document.getElementById('fpill'),fname=document.getElementById('fname'),genBtn=document.getElementById('gen-btn');
pdfInp.addEventListener('change',e=>{if(e.target.files[0])handleFile(e.target.files[0]);});
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{
  e.preventDefault();dz.classList.remove('over');
  const f=e.dataTransfer.files[0];
  if(f&&f.type==='application/pdf')handleFile(f);else showToast('Please drop a PDF file','error');
});
function handleFile(f){
  if(f.size>20*1024*1024){showToast('File too large (max 20MB)','error');return;}
  pdfFile=f;fname.textContent=f.name;fpill.classList.add('show');updateGenBtn();
}
document.getElementById('yt-inp').addEventListener('input',e=>{ytUrl=e.target.value.trim();updateGenBtn();});
function updateGenBtn(){genBtn.disabled=activeTab==='pdf'?!pdfFile:(!ytUrl||!ytUrl.includes('youtube'));}
document.getElementById('exam-sel').addEventListener('change',e=>selExam=e.target.value);
document.getElementById('cnt-row').addEventListener('click',e=>{
  const b=e.target.closest('.cc');if(!b)return;
  document.querySelectorAll('.cc').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');selCount=parseInt(b.dataset.n);document.getElementById('cust-n').value='';
});
document.getElementById('cust-n').addEventListener('input',e=>{
  const v=parseInt(e.target.value);
  if(v>=3&&v<=50){selCount=v;document.querySelectorAll('.cc').forEach(x=>x.classList.remove('active'));}
});
genBtn.addEventListener('click',runGen);
document.getElementById('btn-lib').addEventListener('click',()=>document.getElementById('lib-sec').scrollIntoView({behavior:'smooth'}));
document.getElementById('btn-dash').addEventListener('click',()=>{showScreen('dashboard');renderDash();});

// ── LIBRARY ──
function renderLibrary(){
  const idx=getIdx(),c=document.getElementById('lib-container');
  if(!idx.length){c.innerHTML='<div class="lib-empty">No saved decks yet. Generate your first deck above!</div>';return;}
  const g=document.createElement('div');g.className='lib-grid';
  idx.forEach(item=>{
    const res=getRes(item.id),vals=Object.values(res);
    const kn=vals.filter(v=>v==='good'||v==='easy').length;
    const pct=vals.length?Math.round(kn/vals.length*100):null;
    const sr=getSR(item.id),today=new Date().toISOString().slice(0,10);
    const due=Object.values(sr).filter(v=>v.nextReview&&v.nextReview<=today).length;
    const el=document.createElement('div');el.className='lc';el.dataset.id=item.id;
    el.innerHTML=`<input type="checkbox" class="merge-cb" data-id="${item.id}">
      <button class="lc-del">✕</button>
      <div class="lc-icon">${item.source==='yt'?'▶️':'📘'}</div>
      <div class="lc-name" title="${item.name}">${item.name}</div>
      <div class="lc-meta">${item.count} cards · ${item.exam||'General'} · ${item.date}</div>
      ${pct!=null?`<div class="lc-pct" style="background:${pct>=70?'#dcfce7':'#fee2e2'};color:${pct>=70?'#166534':'#991b1b'}">${pct}% mastered</div>`:''}
      ${due>0?`<div class="lc-sr">⏰ ${due} due for review</div>`:''}`;
    el.addEventListener('click',e=>{
      if(e.target.classList.contains('lc-del')){
        e.stopPropagation();if(!confirm(`Delete "${item.name}"?`))return;
        rmDeck(item.id);setIdx(getIdx().filter(x=>x.id!==item.id));renderLibrary();showToast('Deck deleted');return;
      }
      if(e.target.type==='checkbox'){
        const id=e.target.dataset.id;
        if(e.target.checked)mergeSelected.add(id);else mergeSelected.delete(id);
        el.classList.toggle('merge-selected',e.target.checked);
        document.getElementById('merge-do-btn').style.display=mergeSelected.size>=2?'':'none';
        return;
      }
      if(mergingMode)return;
      const deck=getDeck(item.id);if(!deck){showToast('Deck not found','error');return;}
      curDeckId=item.id;loadViewer(deck.meta,deck.cards);
    });
    g.appendChild(el);
  });
  c.innerHTML='';c.appendChild(g);
}

// ── MERGE DECKS ──
document.getElementById('merge-toggle-btn').addEventListener('click',()=>{
  mergingMode=true;mergeSelected.clear();
  document.getElementById('lib-container').classList.add('merging');
  document.getElementById('merge-toggle-btn').style.display='none';
  document.getElementById('merge-do-btn').style.display='none';
  document.getElementById('merge-cancel-btn').style.display='';
  showToast('Select 2+ decks to merge','info');
});
document.getElementById('merge-cancel-btn').addEventListener('click',cancelMerge);
function cancelMerge(){
  mergingMode=false;mergeSelected.clear();
  document.getElementById('lib-container').classList.remove('merging');
  document.getElementById('merge-toggle-btn').style.display='';
  document.getElementById('merge-do-btn').style.display='none';
  document.getElementById('merge-cancel-btn').style.display='none';
  renderLibrary();
}
document.getElementById('merge-do-btn').addEventListener('click',()=>{
  if(mergeSelected.size<2){showToast('Select at least 2 decks','error');return;}
  const ids=[...mergeSelected];
  const seenQs=new Set(),merged=[];
  ids.forEach(id=>{
    const deck=getDeck(id);if(!deck)return;
    deck.cards.forEach(card=>{
      const key=card.q.toLowerCase().replace(/\s+/g,' ').trim().slice(0,60);
      if(!seenQs.has(key)){seenQs.add(key);merged.push(card);}
    });
  });
  const names=ids.map(id=>{const d=getDeck(id);return d?d.meta.name.slice(0,20):'';});
  const meta={name:'Merged: '+names.join(' + '),count:merged.length,exam:selExam,source:'merged',
    date:new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})};
  const id='dk'+Date.now();setDeck(id,meta,merged);
  const idx=getIdx();idx.unshift({id,name:meta.name,count:meta.count,exam:meta.exam,source:'merged',date:meta.date});
  setIdx(idx);earnBadge('merged');cancelMerge();renderLibrary();
  showToast(`✓ Merged ${merged.length} cards (${ids.length} decks)!`);
});

// ── GENERATION ──
async function runGen(){
  if(!navigator.onLine){showToast('No internet — connect to generate cards','error');return;}
  selExam=document.getElementById('exam-sel').value;
  const examDate=getExamDate();
  showScreen('loading');animSteps();
  try{
    let cards,name,src;
    if(activeTab==='pdf'){
      const b64=await toB64(pdfFile);
      cards=await callGemini({type:'pdf',b64},selCount,selExam,examDate);
      name=pdfFile.name;src='pdf';
    } else {
      cards=await callGemini({type:'yt',url:ytUrl},selCount,selExam,examDate);
      name=ytUrl.replace(/.*v=/,'YT: ').replace(/&.*/,'').slice(0,50);src='yt';earnBadge('yt_used');
    }
    const meta={name,count:cards.length,exam:selExam,source:src,
      date:new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})};
    const id='dk'+Date.now();setDeck(id,meta,cards);
    const idx=getIdx();idx.unshift({id,name:meta.name,count:meta.count,exam:meta.exam,source:meta.source,date:meta.date});
    setIdx(idx);curDeckId=id;
    if(idx.length===1)earnBadge('first_deck');if(idx.length>=5)earnBadge('decks_5');
    updateStreak();renderStreakNav();
    loadViewer(meta,cards);showToast('✓ Deck saved!');
  }catch(err){
    showToast(err.message||'Generation failed — try again','error');showScreen('upload');renderLibrary();
  }
}
function toB64(file){return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result.split(',')[1]);rd.onerror=()=>j(new Error('Could not read file'));rd.readAsDataURL(file);});}
async function callGemini(src,count,exam,examDate){
  const key=getKey();if(!key)throw new Error('No API key set.');
  const days=examDate?Math.ceil((new Date(examDate)-new Date())/864e5):null;
  const urgency=days!=null?(days<=7?'CRITICAL — exam in a week!':days<=30?'HIGH — exam within a month':'MODERATE'):'not set';
  const EXAM_GUIDES={
    'CBSE-10':'CBSE Class 10 board exam: NCERT-focused, 1/2/3/5-mark questions, diagram labelling, brief definitions',
    'CBSE-12':'CBSE Class 12: NCERT-based, assertion-reasoning, case-study, long answers, derivations, all major topics',
    'JEE-Main':'JEE Main: MCQ + numerical, Physics/Chemistry/Maths formula-heavy, NCERT + beyond, concept application',
    'JEE-Advanced':'JEE Advanced: Multi-concept, complex numericals, paragraph-based, deep conceptual mastery',
    'NEET':'NEET: Biology 60%, NCERT line-by-line, assertion-reason, diagram-based, Physics & Chemistry numericals',
    'UPSC':'UPSC CSE: Conceptual clarity, current affairs linkage, multi-dimensional, static + dynamic content',
    'General':'Clear conceptual Q&A, comprehensive coverage of all topics in the material'
  };
  const sys=`You are a top Indian exam educator specialising in ${exam}.
EXAM PATTERN: ${EXAM_GUIDES[exam]||EXAM_GUIDES.General}
EXAM URGENCY: ${urgency}

CARD TYPES (generate proportional mix):
- "recall" — facts, definitions, one-line answers
- "formula" — critical formula/equation/reaction/law with when/how to use it  
- "diagram" — ask student to describe/label a key diagram, process, or structure
- "concept" — deeper "why/how" conceptual question
- "application" — numerical, problem-solving, applied scenario

PRIORITY (for ${exam} exam):
- "high" — appears in almost every exam, high mark-weightage, must-know
- "medium" — important, tested periodically
- "low" — good to know, supplementary

NCERT CHAPTER (for CBSE content — otherwise use "General"):
Map each card to its NCERT chapter like "Ch 1: Electric Charges and Fields" or "Ch 3: Atoms"

ANSWER FORMAT: Wrap key terms in <strong>term</strong>, formulas in <code>eq</code>. 2–5 sentences. Be precise.

OUTPUT: ONLY a valid JSON array. No markdown. No preamble. Nothing else.
Schema: [{"q":"...","a":"...","topic":"2-4 words","type":"recall|formula|diagram|concept|application","priority":"high|medium|low","chapter":"Chapter name or General"}]`;
  
  const prompt=`Generate exactly ${count} ${exam} flashcards from this content.
Type mix: ~20% formula, ~15% diagram, ~25% recall, ~20% concept, ~20% application.
Mark HIGH priority for content most frequently tested in ${exam}.
${days&&days<=14?'EXAM VERY SOON — weight heavily toward HIGH priority content.':''}
Cover all major sections. Return ONLY the JSON array, exactly ${count} items.`;

  const parts = src.type==='pdf'
    ? [{inline_data:{mime_type:'application/pdf',data:src.b64}},{text:prompt}]
    : [{text:`YouTube video to analyse: ${src.url}\n\n${prompt}`}];

  const MODELS=['gemma-3-27b-it','gemma-3-12b-it','gemma-3-4b-it'];
  let data, resp;
  for(const model of MODELS){
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try{
      const isGemma=model.startsWith('gemma');
      const gemmaUserParts=isGemma?[{text:sys+'\n\n---\n\n'},...parts]:parts;
      const reqBody={
        contents:[{role:'user',parts:gemmaUserParts}],
        generationConfig:{maxOutputTokens:8000,temperature:0.4}
      };
      if(!isGemma){reqBody.systemInstruction={parts:[{text:sys}]};reqBody.generationConfig.responseMimeType='application/json';}
      resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reqBody)});
      data=await resp.json();
      if(resp.ok) break;
      const errMsg=data.error?.message||'';
      if(!errMsg.includes('not found')&&!errMsg.includes('deprecated')) {
        throw new Error(errMsg||`Gemini error ${resp.status}`);
      }
    }catch(e){
      if(e.message&&!e.message.includes('not found')&&!e.message.includes('fetch'))throw e;
    }
  }
  if(!resp||!resp.ok){
    const m=data?.error?.message||`Gemini error ${resp?.status}`;
    if(m.includes('API_KEY')||m.includes('API key'))throw new Error('Invalid API key — tap 🔑 Key to update it.');
    if(m.includes('quota')||m.includes('QUOTA')||m.includes('rate')||m.includes('limit: 0'))
      throw new Error('⚠ Quota exceeded. Get a free key from aistudio.google.com/apikey — tap 🔑 Key to update.');
    throw new Error(m);
  }

  const allParts=data.candidates?.[0]?.content?.parts||[];
  const textPart=allParts.find(p=>!p.thought&&p.text)||allParts.find(p=>p.text);
  const raw=(textPart?.text||'').trim();

  if(!raw) throw new Error('Gemini returned an empty response — try a smaller card count or different source.');

  function extractJSON(str){
    try{return JSON.parse(str);}catch{}
    const stripped=str.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    try{return JSON.parse(stripped);}catch{}
    const match=stripped.match(/(\[[\s\S]*\])/);
    if(match){try{return JSON.parse(match[1]);}catch{}}
    const objMatch=stripped.match(/(\{[\s\S]*\})/);
    if(objMatch){try{return [JSON.parse(objMatch[1])];}catch{}}
    throw new Error('Could not parse AI response as JSON');
  }

  let cards;
  try{cards=extractJSON(raw);}
  catch(e){
    const preview=raw.slice(0,200).replace(/</g,'&lt;');
    throw new Error(`AI returned unexpected format. First 200 chars: "${preview}"… Please retry.`);
  }
  if(!Array.isArray(cards))cards=[cards];
  cards=cards.filter(c=>c&&c.q&&c.a);
  if(!cards.length)throw new Error('No valid flashcards in response — please retry.');
  return cards;
}

// ── EXPLAIN FEATURE ──
async function explainCard(){
  if(!filteredCards.length)return;
  const card=filteredCards[cardIdx];
  const overlay=document.getElementById('explain-overlay');
  const body=document.getElementById('explain-body');
  overlay.classList.add('show');
  body.innerHTML='<div class="explain-loading"><div class="explain-spinner"></div>Asking Gemini for a detailed explanation…</div>';
  const key=getKey();
  if(!key){body.innerHTML='<div class="explain-body">No API key set. Add your key to use this feature.</div>';return;}
  try{
    const prompt=`Question: ${card.q}\n\nAnswer: ${card.a.replace(/<[^>]+>/g,'')}\n\nProvide a thorough, teacher-quality explanation of this concept for a ${curDeckMeta()?.exam||'CBSE'} student. Include:\n- Why the answer is correct (the underlying mechanism/reason)\n- Real-world example or analogy if helpful\n- Common mistakes students make\n- Any related formulas or diagrams to remember\n\nFormat clearly with short paragraphs. Use <strong>tags</strong> for key terms and <code>tags</code> for formulas.`;
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1500,temperature:0.3}})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Error');
    const eParts=data.candidates?.[0]?.content?.parts||[];
    const eText=((eParts.find(p=>!p.thought&&p.text)||eParts[0])||{}).text||'';
    body.innerHTML=`<div class="explain-body">${eText.trim().replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>')}</div>`;
  }catch(e){body.innerHTML=`<div class="explain-body" style="color:#ef4444">Error: ${e.message}</div>`;}
}
function curDeckMeta(){if(!curDeckId)return null;const d=getDeck(curDeckId);return d?d.meta:null;}
document.getElementById('explain-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('explain-overlay'))document.getElementById('explain-overlay').classList.remove('show');});
document.getElementById('explain-close').addEventListener('click',()=>document.getElementById('explain-overlay').classList.remove('show'));

// ── VOICE MODE ──
function speakCard(){
  if(!filteredCards.length)return;
  if('speechSynthesis' in window){
    window.speechSynthesis.cancel();
    const card=filteredCards[cardIdx];
    const u=new SpeechSynthesisUtterance(card.q.replace(/<[^>]+>/g,''));
    u.rate=0.9;u.pitch=1;u.lang='en-IN';
    window.speechSynthesis.speak(u);
    showToast('🔊 Reading question aloud…','info');
  } else {
    showToast('Voice not supported in this browser','error');
  }
}

// ── VIEWER ──
function loadViewer(meta,cards){
  allCards=[...cards];
  const ed=getExamDate();
  if(ed){const d=Math.ceil((new Date(ed)-new Date())/864e5);if(d<=30){const p={high:0,medium:1,low:2};allCards.sort((a,b)=>(p[a.priority]||1)-(p[b.priority]||1));}}
  
  const sr=curDeckId?getSR(curDeckId):{};
  const today=new Date().toISOString().slice(0,10);
  allCards.sort((a,b)=>{
    const ia=allCards.indexOf(a),ib=allCards.indexOf(b);
    const da=sr[ia]?.nextReview,db=sr[ib]?.nextReview;
    if(da&&da<=today&&(!db||db>today))return -1;
    if(db&&db<=today&&(!da||da>today))return 1;
    return 0;
  });

  filteredCards=[...allCards];cardIdx=0;seenSet.clear();
  document.getElementById('doc-name').textContent=meta.name;
  document.getElementById('doc-meta').textContent=`${cards.length} cards · ${meta.exam||'General'} · ${meta.date}`;
  document.getElementById('sb-name').textContent=meta.name;
  document.getElementById('sb-meta').textContent=cards.length+' cards';
  const et=document.getElementById('etag');
  if(meta.exam){et.textContent=meta.exam;et.style.display='';}else et.style.display='none';
  buildSidebar(cards);updateCard();showScreen('cards');renderCountdown();
  updateStreak();renderStreakNav();
}
function buildSidebar(cards){
  const st=document.getElementById('sb-topics');const sc=document.getElementById('sb-chapters');
  st.innerHTML='';sc.innerHTML='';
  function mkBtn(lbl,cnt,a){const b=document.createElement('button');b.className='sbpill'+(a?' active':'');b.innerHTML=`<span>${lbl}</span><span class="sb-cnt">${cnt}</span>`;return b;}
  function setFil(fn){filteredCards=fn?allCards.filter(fn):allCards.slice();cardIdx=0;seenSet.clear();document.getElementById('card-scene').classList.remove('flipped');flipped=false;hideSR();updateCard();closeMob();}
  function deact(){document.querySelectorAll('.sbpill').forEach(p=>p.classList.remove('active'));}

  const ab=mkBtn('All Cards',cards.length,true);
  ab.addEventListener('click',()=>{deact();ab.classList.add('active');setFil(null);});
  st.appendChild(ab);

  const sr=curDeckId?getSR(curDeckId):{};
  const today=new Date().toISOString().slice(0,10);
  const dueCnt=allCards.filter((c,i)=>sr[i]?.nextReview&&sr[i].nextReview<=today).length;
  if(dueCnt>0){
    const dh=document.createElement('div');dh.className='sbhd';dh.textContent='Spaced Repetition';st.appendChild(dh);
    const db=mkBtn('⏰ Due Today',dueCnt,false);
    db.addEventListener('click',()=>{deact();db.classList.add('active');setFil((c,i)=>sr[allCards.indexOf(c)]?.nextReview&&sr[allCards.indexOf(c)].nextReview<=today);});
    st.appendChild(db);
  }

  const hi=allCards.filter(c=>c.priority==='high');
  if(hi.length){
    const ph=document.createElement('div');ph.className='sbhd';ph.textContent='Priority';st.appendChild(ph);
    ['high','medium','low'].forEach(p=>{
      const pc=allCards.filter(c=>c.priority===p).length;if(!pc)return;
      const lbl={high:'🔴 High',medium:'🟡 Medium',low:'🟢 Low'}[p];
      const b=mkBtn(lbl,pc,false);b.addEventListener('click',()=>{deact();b.classList.add('active');setFil(c=>c.priority===p);});st.appendChild(b);
    });
  }

  const types=[...new Set(cards.map(c=>c.type).filter(Boolean))];
  if(types.length>1){
    const th=document.createElement('div');th.className='sbhd';th.textContent='Card Type';st.appendChild(th);
    const tmap={recall:'🧠 Recall',formula:'🧪 Formula',diagram:'📊 Diagram',concept:'💡 Concept',application:'🎯 Applied'};
    types.forEach(t=>{
      const tc=allCards.filter(c=>c.type===t).length;
      const b=mkBtn(tmap[t]||t,tc,false);b.addEventListener('click',()=>{deact();b.classList.add('active');setFil(c=>c.type===t);});st.appendChild(b);
    });
  }

  const chapters=[...new Set(cards.map(c=>c.chapter).filter(c=>c&&c!=='General'))];
  if(chapters.length){
    const ch=document.createElement('div');ch.className='sbhd';ch.textContent='NCERT Chapters';sc.appendChild(ch);
    chapters.forEach(ch=>{
      const cnt=allCards.filter(c=>c.chapter===ch).length;
      const b=mkBtn(ch,cnt,false);b.style.fontSize='.7rem';
      b.addEventListener('click',()=>{deact();b.classList.add('active');setFil(c=>c.chapter===ch);});sc.appendChild(b);
    });
  }

  const topics=[...new Set(cards.map(c=>c.topic).filter(Boolean))];
  if(topics.length){
    const toph=document.createElement('div');toph.className='sbhd';toph.textContent='Topics';st.appendChild(toph);
    topics.forEach(t=>{
      const tc=allCards.filter(c=>c.topic===t).length;
      const b=mkBtn(t,tc,false);b.addEventListener('click',()=>{deact();b.classList.add('active');setFil(c=>c.topic===t);});st.appendChild(b);
    });
  }
}
function closeMob(){if(window.innerWidth<=860){document.getElementById('sidebar').classList.remove('open');sidebarOpen=false;}}

// ── CARD DISPLAY ──
const cs=document.getElementById('card-scene');
const cardQ=document.getElementById('card-q'),cardA=document.getElementById('card-a');
const chipF=document.getElementById('chip-f'),chipB=document.getElementById('chip-b');
const pFill=document.getElementById('prog-fill'),cCtr=document.getElementById('card-ctr'),pctEl=document.getElementById('pct-seen');
const TE={recall:'🧠 Recall',formula:'🧪 Formula',diagram:'📊 Diagram',concept:'💡 Concept',application:'🎯 Applied'};
const PC={high:'#ef4444',medium:'#f59e0b',low:'#10b981'};

function updateCard(animate=false){
  if(!filteredCards.length)return;
  const card=filteredCards[cardIdx];seenSet.add(cardIdx);
  if(animate){cs.classList.add('swap');setTimeout(()=>cs.classList.remove('swap'),320);}
  cs.classList.remove('flipped');flipped=false;hideSR();
  cardQ.innerHTML=card.q||'—';cardA.innerHTML=card.a||'—';
  const t=card.topic||'General';chipF.textContent=t;chipB.textContent=t;
  const te=TE[card.type]||'📝 '+(card.type||'Card');
  document.getElementById('tbadge-f').textContent=te;document.getElementById('tbadge-b').textContent=te;
  const pd=document.getElementById('prio-dot');
  pd.style.background=PC[card.priority]||'transparent';pd.style.display=card.priority?'block':'none';
  const pct=seenSet.size/filteredCards.length;
  pFill.style.width=(pct*100)+'%';cCtr.textContent=`${cardIdx+1} / ${filteredCards.length}`;
  pctEl.textContent=Math.round(pct*100)+'% seen';
  document.getElementById('prev-btn').disabled=cardIdx===0;
  document.getElementById('next-btn').disabled=cardIdx===filteredCards.length-1;
}
function hideSR(){document.getElementById('sr-row').style.display='none';document.getElementById('sr-hint').style.display='none';}
function showSR(){document.getElementById('sr-row').style.display='grid';document.getElementById('sr-hint').style.display='block';}
function doFlip(){cs.classList.toggle('flipped');flipped=!flipped;if(flipped)showSR();else hideSR();}
cs.addEventListener('click',doFlip);
document.getElementById('flip-btn').addEventListener('click',doFlip);

// SM-2 Rating
function rateSR(quality){
  if(!curDeckId)return;
  const card=filteredCards[cardIdx];
  const globalIdx=allCards.indexOf(card);
  const srData=getSR(curDeckId);
  const cur=srData[globalIdx]||{ef:2.5,interval:1,reps:0};
  srData[globalIdx]=sm2(cur,quality);setSR(curDeckId,srData);
  const res=getRes(curDeckId);
  res[globalIdx]=quality>=2?'good':'again';setRes(curDeckId,res);
  checkRateBadges(card.type);
  const labels=['↩ Again','Hard','Good','⚡ Easy'];
  showToast(labels[quality]+' — next review in '+srData[globalIdx].interval+' day(s)','success');
  const btnIds=['sr-again','sr-hard','sr-good','sr-easy'];
  document.getElementById(btnIds[quality]).classList.add('pop');
  setTimeout(()=>document.getElementById(btnIds[quality]).classList.remove('pop'),350);
  setTimeout(()=>{if(cardIdx<filteredCards.length-1){cardIdx++;updateCard(true);}},450);
}
document.getElementById('sr-again').addEventListener('click',()=>rateSR(0));
document.getElementById('sr-hard').addEventListener('click',()=>rateSR(1));
document.getElementById('sr-good').addEventListener('click',()=>rateSR(2));
document.getElementById('sr-easy').addEventListener('click',()=>rateSR(3));

// Nav controls
document.getElementById('prev-btn').addEventListener('click',()=>{if(cardIdx>0){cardIdx--;updateCard(true);}});
document.getElementById('next-btn').addEventListener('click',()=>{if(cardIdx<filteredCards.length-1){cardIdx++;updateCard(true);}});
document.getElementById('shuffle-btn').addEventListener('click',()=>{
  for(let i=filteredCards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[filteredCards[i],filteredCards[j]]=[filteredCards[j],filteredCards[i]];}
  cardIdx=0;seenSet.clear();updateCard(true);showToast('Cards shuffled!');
});
document.getElementById('explain-btn').addEventListener('click',explainCard);
document.getElementById('voice-btn').addEventListener('click',speakCard);
document.getElementById('cv-back').addEventListener('click',()=>{showScreen('upload');renderLibrary();});
document.getElementById('cv-new').addEventListener('click',()=>{pdfFile=null;pdfInp.value='';fpill.classList.remove('show');genBtn.disabled=true;showScreen('upload');renderLibrary();});
document.getElementById('cv-dash').addEventListener('click',()=>{showScreen('dashboard');renderDash();});
document.getElementById('sb-toggle').addEventListener('click',()=>{sidebarOpen=!sidebarOpen;document.getElementById('sidebar').classList.toggle('open',sidebarOpen);});

// ── QUIZ MODE — opens quiz.html ──
document.getElementById('cv-quiz').addEventListener('click',()=>{
  if(allCards.length<4){showToast('Need at least 4 cards to start a quiz','error');return;}
  // Store quiz data in localStorage for quiz.html to read
  localStorage.setItem('fg:quiz_deck_id', curDeckId||'');
  localStorage.setItem('fg:quiz_all_cards', JSON.stringify(allCards));
  // Open quiz in same window
  window.location.href='quiz.html';
});

// ── DASHBOARD ──
function computeMastery(){
  const m={};
  getIdx().forEach(item=>{
    const deck=getDeck(item.id);if(!deck)return;
    const res=getRes(item.id),sr=getSR(item.id);
    const today=new Date().toISOString().slice(0,10);
    deck.cards.forEach((card,i)=>{
      const t=card.topic||'General',ch=card.chapter||'General';
      if(!m[t])m[t]={known:0,review:0,total:0,chapter:ch,due:0};
      m[t].total++;
      if(res[i]==='good'||res[i]==='easy')m[t].known++;
      else if(res[i]==='again')m[t].review++;
      if(sr[i]?.nextReview&&sr[i].nextReview<=today)m[t].due++;
    });
  });
  return m;
}
function buildChart(m){
  const topics=Object.keys(m).filter(t=>m[t].known+m[t].review>0);
  if(!topics.length)return false;
  const pcts=topics.map(t=>{const d=m[t];return d.known+d.review?Math.round(d.known/(d.known+d.review)*100):0;});
  const st=getComputedStyle(document.documentElement);
  const ink=st.getPropertyValue('--ink').trim(),br=st.getPropertyValue('--br').trim();
  const ac=st.getPropertyValue('--ac').trim(),ac3=st.getPropertyValue('--ac3').trim();
  const ctx=document.getElementById('mastery-chart').getContext('2d');
  if(mchart)mchart.destroy();
  mchart=new Chart(ctx,{type:'bar',data:{labels:topics,datasets:[{label:'% Mastered',data:pcts,backgroundColor:pcts.map(p=>p>=70?ac3+'cc':p>=40?'#f59e0bcc':ac+'cc'),borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100,ticks:{color:ink,callback:v=>v+'%'},grid:{color:br}},x:{ticks:{color:ink,maxRotation:30},grid:{display:false}}}}});
  return true;
}
function renderDash(){
  const idx=getIdx();
  document.getElementById('s-decks').textContent=idx.length;
  document.getElementById('s-rated').textContent=$.get('fg:tot_rated',0);
  document.getElementById('s-due').textContent=getDueCount();
  let kn=0,tot=0;idx.forEach(it=>{const r=getRes(it.id),v=Object.values(r);tot+=v.length;kn+=v.filter(x=>x==='good'||x==='easy').length;});
  document.getElementById('s-pct').textContent=tot?Math.round(kn/tot*100)+'%':'—';
  const s=getStreak();
  document.getElementById('d-streak').textContent=s.cur||0;
  document.getElementById('d-best').textContent=s.best||0;
  document.getElementById('d-sub').textContent=s.cur===1?'day in a row':'days in a row';
  const cal=document.getElementById('d-cal');cal.innerHTML='';
  const today=new Date().toISOString().slice(0,10);
  for(let i=6;i>=0;i--){const d=new Date(Date.now()-i*864e5),ds=d.toISOString().slice(0,10);const el=document.createElement('div');el.className='sday'+(s.hist&&s.hist.includes(ds)?' studied':'')+(ds===today?' today':'');el.textContent=d.getDate();cal.appendChild(el);}
  const earned=getBadges(),bg=document.getElementById('badges-g');bg.innerHTML='';
  BADGES.forEach(b=>{const el=document.createElement('div');el.className='badge-it'+(earned.includes(b.id)?' earned':' locked');el.title=b.d;el.innerHTML=`<span class="be">${b.e}</span><div class="bn">${b.n}</div>`;bg.appendChild(el);});
  const mdata=computeMastery();
  const rated=Object.keys(mdata).filter(t=>mdata[t].known+mdata[t].review>0);
  const nm=document.getElementById('no-mastery'),cw=document.getElementById('chart-wrap'),tb=document.getElementById('mtable');
  if(!rated.length){nm.style.display='block';cw.style.display='none';tb.style.display='none';}
  else{nm.style.display='none';cw.style.display='block';tb.style.display='table';buildChart(mdata);
    const tbody=document.getElementById('mtbody');tbody.innerHTML='';
    Object.entries(mdata).filter(([,d])=>d.known+d.review>0)
      .sort((a,b)=>{const pa=b[1].known/(b[1].known+b[1].review||1);const pb=a[1].known/(a[1].known+a[1].review||1);return pa-pb;})
      .forEach(([topic,d])=>{
        const pct=Math.round(d.known/(d.known+d.review)*100);
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${topic}</td><td style="font-family:'DM Mono',monospace;font-size:.68rem;color:var(--ink-2)">${d.chapter||'—'}</td><td style="color:#16a34a;font-weight:600">${d.known}</td><td style="color:#dc2626;font-weight:600">${d.review}</td><td><span>${pct}%</span><span class="mbar-w"><span class="mbar" style="width:${pct}%"></span></span></td><td style="font-family:'DM Mono',monospace;font-size:.65rem;color:var(--ac2)">${d.due>0?'⏰ '+d.due:''}</td>`;
        tbody.appendChild(tr);
      });
  }
  const wl=document.getElementById('weak-list');
  const weakSpots=Object.entries(mdata)
    .filter(([,d])=>d.known+d.review>=3)
    .map(([t,d])=>({t,pct:Math.round(d.known/(d.known+d.review)*100),ch:d.chapter}))
    .sort((a,b)=>a.pct-b.pct).slice(0,5);
  if(!weakSpots.length){wl.innerHTML='<div style="color:var(--ink-2);font-size:.85rem">Rate cards while studying to identify weak spots!</div>';}
  else{wl.innerHTML='';weakSpots.forEach(ws=>{const el=document.createElement('div');el.className='weak-item';el.innerHTML=`<div><div class="wi-topic">${ws.t}</div><div style="font-size:.68rem;color:var(--ink-3);font-family:'DM Mono',monospace;margin-top:.15rem">${ws.ch||''}</div></div><div class="wi-pct">${ws.pct}% known</div><button class="wi-btn" data-topic="${ws.t}">+ Generate 5 More</button>`;el.querySelector('.wi-btn').addEventListener('click',()=>generateWeakCards(ws.t,ws.ch));wl.appendChild(el);});}
}

async function generateWeakCards(topic,chapter){
  if(!navigator.onLine){showToast('Need internet to generate more cards','error');return;}
  const key=getKey();if(!key){showToast('No API key set','error');return;}
  showToast('Generating 5 more '+topic+' cards…','info');
  const selExamVal=document.getElementById('exam-sel')?.value||'CBSE-12';
  try{
    const prompt=`Generate exactly 5 flashcards specifically about "${topic}"${chapter&&chapter!=='General'?' from NCERT '+chapter:''} for ${selExamVal} students.
Focus on aspects students most often get wrong. Include at least 1 formula card if applicable.
Return ONLY a JSON array: [{"q":"...","a":"...","topic":"${topic}","type":"recall|formula|diagram|concept|application","priority":"high|medium|low","chapter":"${chapter||'General'}"}]`;
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:2000,temperature:0.4}})});
    const data=await resp.json();if(!resp.ok)throw new Error(data.error?.message||'Error');
    const wParts=data.candidates?.[0]?.content?.parts||[];
    const wRaw=((wParts.find(p=>!p.thought&&p.text)||wParts[0])||{}).text||'';
    const wClean=wRaw.replace(/^```json\s*/i,'').replace(/\s*```\s*$/,'').trim();
    let newCards;
    try{newCards=JSON.parse(wClean);}catch{
      const m2=wClean.match(/(\[[\s\S]*\])/);
      if(m2){try{newCards=JSON.parse(m2[1]);}catch{throw new Error('Parse error');}}
      else throw new Error('No JSON in response');
    }
    if(!Array.isArray(newCards)||!newCards.length)throw new Error('No cards returned');
    if(curDeckId){
      const deck=getDeck(curDeckId);
      if(deck){const updated=[...deck.cards,...newCards];setDeck(curDeckId,{...deck.meta,count:updated.length},updated);allCards=updated;filteredCards=[...updated];}
    }
    showToast('✓ Added '+newCards.length+' new '+topic+' cards!');renderDash();
  }catch(e){showToast('Error: '+e.message,'error');}
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown',e=>{
  if(document.getElementById('screen-cards').classList.contains('active')){
    if(e.key==='ArrowRight'&&cardIdx<filteredCards.length-1){cardIdx++;updateCard(true);}
    else if(e.key==='ArrowLeft'&&cardIdx>0){cardIdx--;updateCard(true);}
    else if(e.key===' '){e.preventDefault();doFlip();}
    else if(e.key==='1'&&flipped)rateSR(0);
    else if(e.key==='2'&&flipped)rateSR(1);
    else if(e.key==='3'&&flipped)rateSR(2);
    else if(e.key==='4'&&flipped)rateSR(3);
    else if((e.key==='e'||e.key==='E'))explainCard();
    else if((e.key==='v'||e.key==='V'))speakCard();
  }
});
// Touch swipe
let tx=0;
cs.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;},{passive:true});
cs.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40){if(dx<0&&cardIdx<filteredCards.length-1){cardIdx++;updateCard(true);}else if(dx>0&&cardIdx>0){cardIdx--;updateCard(true);}}});
// Dash back
document.getElementById('dash-back').addEventListener('click',()=>{showScreen(curDeckId?'cards':'upload');if(!curDeckId)renderLibrary();});

// ── PREVENT DOUBLE-TAP ZOOM ──
document.querySelectorAll('button,.nb,.ctrl,.cc,.sr-btn,.qopt,.lc').forEach(el=>{
  let lastTap=0;
  el.addEventListener('touchend',e=>{
    const now=Date.now();
    if(now-lastTap<350){e.preventDefault();}
    lastTap=now;
  },{passive:false});
});

// ── LOADING STEPS ──
function animSteps(){
  for(let i=0;i<4;i++)document.getElementById('ls'+i).className='ldstep';
  for(let i=0;i<4;i++)setTimeout(()=>{if(i>0)document.getElementById('ls'+(i-1)).className='ldstep done';document.getElementById('ls'+i).className='ldstep active';},i*2800);
}

// ── TOAST ──
let toastT;
function showToast(msg,type='success'){
  const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type;t.style.display='block';
  clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',3500);
}

// ── INIT ──
(function init(){
  applyTheme($.get('fg:theme','aurora'));
  checkOnline();
  const ed=$.get('fg:examdate',null);if(ed)document.getElementById('exam-date').value=ed;
  renderCountdown();
  if(!getKey()){showScreen('apikey');return;}
  renderLibrary();renderStreakNav();

  // ── Handle return navigation from quiz.html ──
  const params=new URLSearchParams(window.location.search);
  const ret=params.get('return');
  const retDeckId=localStorage.getItem('fg:quiz_deck_id')||null;

  if(ret==='dashboard'){
    showScreen('dashboard');renderDash();
  } else if((ret==='cards'||ret==='quiz-done') && retDeckId){
    const deck=getDeck(retDeckId);
    if(deck){
      curDeckId=retDeckId;
      loadViewer(deck.meta,deck.cards);
      // Clean URL without reload
      history.replaceState(null,'',window.location.pathname);
      // If coming back from a finished quiz, show a toast
      if(ret==='quiz-done'){
        const lastScore=$.get('fg:last_quiz_score',null);
        if(lastScore) showToast('Quiz done — '+lastScore.score+'/'+lastScore.total+' correct ('+lastScore.pct+'%)','info');
      }
    } else { showScreen('upload'); }
  } else {
    showScreen('upload');
  }
})();
