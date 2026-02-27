/* ══════════════════════════════════════════
   FLASHGEN v4 — COMPLETE ENGINE
   New: Multi-PDF, AI Doubt Chat, Weak Topic Notes, Focus Timer, AI Summary
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
  {id:'multi_pdf',e:'📄',n:'Multi-PDF',d:'Upload multiple PDFs at once'},
  {id:'notes_writer',e:'📝',n:'Note Taker',d:'Write 3 topic notes'},
  {id:'focus_1h',e:'⏱',n:'Focused',d:'Complete 1 hour of study time'},
  {id:'exam_sim',e:'📝',n:'Exam Ready',d:'Complete an exam simulation'},
  {id:'perfect_sim',e:'🏆',n:'Simulator Pro',d:'Score 100% in exam simulation'},
  {id:'room_joined',e:'👥',n:'Study Buddy',d:'Join a study room'},
  {id:'predicted',e:'🔮',n:'Oracle',d:'Use the AI Exam Predictor'},
  {id:'mindmapper',e:'🗺',n:'Mind Mapper',d:'Generate a concept mind map'},
  {id:'shop_unlock',e:'🛍',n:'Shopper',d:'Unlock something from the shop'},
  {id:'bot_sent',e:'📱',n:'Daily Grinder',d:'Send cards to WhatsApp/Telegram'},
];

// ── STATE ──
let selCount=10, pdfFiles=[], ytUrl='', activeTab='pdf', selExam='CBSE-12';
let allCards=[], filteredCards=[], cardIdx=0, seenSet=new Set(), flipped=false;
let curDeckId=null, sidebarOpen=false, mchart=null;
let mergingMode=false, mergeSelected=new Set();
let doubtHistory=[], currentDoubtCard=null;
let timerInterval=null, timerRunning=false, timerSecondsLeft=25*60, timerTotalSeconds=25*60;
// Coins & Shop
const getCoins=()=>$.get('fg:coins',0);
const setCoins=n=>$.set('fg:coins',n);
const getUnlocked=()=>$.get('fg:unlocked',[]);
function earnCoins(n,reason=''){
  const old=getCoins();setCoins(old+n);
  const popup=document.getElementById('coins-popup');
  document.getElementById('coins-amount').textContent=n;
  popup.classList.add('show');setTimeout(()=>popup.classList.remove('show'),1800);
}
// Study Room state
let roomCode=null, roomChannel=null, roomName='You', roomMembers={};
// Exam Simulation state
let simCards=[], simAnswers=[], simIdx=0, simTimer=null, simTimeLeft=0, simConfig={};
let simReviewLater=new Set();

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
const getNotes=()=>$.get('fg:notes',[]);
const setNotes=n=>$.set('fg:notes',n);

// ── THEMES ──
const THEMES=['aurora','neon','midnight','cyberpunk','dracula','obsidian','deepspace','parchment','sakura','ocean','forest','ember'];
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
  earnCoins(2,'rated card');
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

// ── NAV BUTTONS ──
document.getElementById('btn-key').addEventListener('click',()=>{document.getElementById('api-key-input').value=getKey();showScreen('apikey');});
document.getElementById('btn-lib').addEventListener('click',()=>document.getElementById('lib-sec').scrollIntoView({behavior:'smooth'}));
document.getElementById('btn-dash').addEventListener('click',()=>{showScreen('dashboard');renderDash();});
document.getElementById('btn-timer').addEventListener('click',()=>openTimer());
document.getElementById('btn-shop').addEventListener('click',()=>openShop());
document.getElementById('btn-rooms').addEventListener('click',()=>openRoom());

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

// ══════════════════════════════════════
// MULTI-FILE UPLOAD
// ══════════════════════════════════════
const dz=document.getElementById('dz');
const pdfInp=document.getElementById('pdf-input');
const genBtn=document.getElementById('gen-btn');

pdfInp.addEventListener('change',e=>{
  if(e.target.files.length) addFiles([...e.target.files]);
  pdfInp.value=''; // reset so same file can be re-added
});
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{
  e.preventDefault();dz.classList.remove('over');
  const files=[...e.dataTransfer.files].filter(f=>f.type==='application/pdf');
  if(!files.length){showToast('Please drop PDF files only','error');return;}
  addFiles(files);
});

function addFiles(newFiles){
  const tooBig=newFiles.filter(f=>f.size>20*1024*1024);
  if(tooBig.length){showToast(`${tooBig.length} file(s) too large (max 20MB each)','error`);newFiles=newFiles.filter(f=>f.size<=20*1024*1024);}
  if(!newFiles.length) return;
  pdfFiles=[...pdfFiles,...newFiles];
  if(pdfFiles.length>1) earnBadge('multi_pdf');
  renderFileList();
  updateGenBtn();
}

function renderFileList(){
  const fl=document.getElementById('file-list');
  if(!pdfFiles.length){fl.style.display='none';return;}
  fl.style.display='flex';
  fl.innerHTML='';
  pdfFiles.forEach((f,i)=>{
    const item=document.createElement('div');item.className='file-item';
    item.innerHTML=`<span>📄</span><span class="file-item-name" title="${f.name}">${f.name}</span><span class="file-item-size">${(f.size/1024/1024).toFixed(1)}MB</span><button class="file-item-del" data-idx="${i}">✕</button>`;
    item.querySelector('.file-item-del').addEventListener('click',e=>{
      e.stopPropagation();pdfFiles.splice(i,1);renderFileList();updateGenBtn();
    });
    fl.appendChild(item);
  });
  // Add more button
  const addBtn=document.createElement('button');
  addBtn.className='file-add-more';
  addBtn.innerHTML='+ Add more PDFs<input type="file" accept=".pdf" multiple style="position:absolute;inset:0;opacity:0;cursor:pointer"/>';
  addBtn.querySelector('input').addEventListener('change',e=>{if(e.target.files.length)addFiles([...e.target.files]);e.target.value='';});
  fl.appendChild(addBtn);
}

document.getElementById('yt-inp').addEventListener('input',e=>{ytUrl=e.target.value.trim();updateGenBtn();});
function updateGenBtn(){genBtn.disabled=activeTab==='pdf'?!pdfFiles.length:(!ytUrl||!ytUrl.includes('youtube'));}
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
    const srcIcon=item.source==='yt'?'▶️':item.source==='multi'?'📚':'📘';
    el.innerHTML=`<input type="checkbox" class="merge-cb" data-id="${item.id}">
      <button class="lc-del">✕</button>
      <div class="lc-icon">${srcIcon}</div>
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

// ══════════════════════════════════════
// GENERATION (Multi-PDF support)
// ══════════════════════════════════════
async function runGen(){
  if(!navigator.onLine){showToast('No internet — connect to generate cards','error');return;}
  selExam=document.getElementById('exam-sel').value;
  const examDate=getExamDate();
  showScreen('loading');animSteps();

  try{
    let cards,name,src;
    if(activeTab==='pdf'){
      if(pdfFiles.length===1){
        // Single file — original behavior
        const b64=await toB64(pdfFiles[0]);
        cards=await callGemini({type:'pdf',b64},selCount,selExam,examDate);
        name=pdfFiles[0].name;src='pdf';
      } else {
        // Multi-file: generate from each, combine
        document.getElementById('ld-sub').textContent=`Processing ${pdfFiles.length} PDFs…`;
        const perFile=Math.max(5,Math.round(selCount/pdfFiles.length));
        let allNewCards=[];
        for(let i=0;i<pdfFiles.length;i++){
          document.getElementById('ld-sub').textContent=`Processing PDF ${i+1}/${pdfFiles.length}: ${pdfFiles[i].name}`;
          const b64=await toB64(pdfFiles[i]);
          const fc=await callGemini({type:'pdf',b64},perFile,selExam,examDate);
          allNewCards=[...allNewCards,...fc];
        }
        // Deduplicate
        const seen=new Set();
        cards=allNewCards.filter(c=>{const k=c.q.slice(0,50).toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
        name=`${pdfFiles.length} PDFs: ${pdfFiles.map(f=>f.name.replace('.pdf','')).join(', ').slice(0,60)}`;
        src='multi';
      }
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
    throw new Error(`AI returned unexpected format. Please retry.`);
  }
  if(!Array.isArray(cards))cards=[cards];
  cards=cards.filter(c=>c&&c.q&&c.a);
  if(!cards.length)throw new Error('No valid flashcards in response — please retry.');
  return cards;
}

// ══════════════════════════════════════
// EXPLAIN FEATURE
// ══════════════════════════════════════
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

// ══════════════════════════════════════
// AI DOUBT CHAT
// ══════════════════════════════════════
function openDoubtChat(contextCard){
  currentDoubtCard=contextCard||filteredCards[cardIdx];
  doubtHistory=[];
  const overlay=document.getElementById('doubt-overlay');
  const ctx=document.getElementById('doubt-context');
  const msgs=document.getElementById('doubt-messages');
  ctx.textContent=currentDoubtCard?`Topic: "${currentDoubtCard.topic}" | Q: "${currentDoubtCard.q.slice(0,80)}…"`:'Ask any doubt about the current deck';
  msgs.innerHTML='<div class="msg msg-ai">👋 Hi! I\'m your AI tutor. Ask me any doubt about this topic — I\'ll explain it clearly for your exam!</div>';
  document.getElementById('doubt-input').value='';
  overlay.classList.add('show');
  document.getElementById('doubt-input').focus();
}

async function sendDoubt(){
  const input=document.getElementById('doubt-input');
  const q=input.value.trim();
  if(!q)return;
  const key=getKey();
  if(!key){showToast('No API key set','error');return;}
  const msgs=document.getElementById('doubt-messages');
  // Add user message
  const userMsg=document.createElement('div');userMsg.className='msg msg-user';userMsg.textContent=q;msgs.appendChild(userMsg);
  input.value='';
  // Add typing indicator
  const typingEl=document.createElement('div');typingEl.className='msg-typing';
  typingEl.innerHTML='<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  msgs.appendChild(typingEl);msgs.scrollTop=msgs.scrollHeight;
  doubtHistory.push({role:'user',parts:[{text:q}]});
  
  try{
    const exam=curDeckMeta()?.exam||selExam||'CBSE-12';
    const sys=`You are a friendly, expert AI tutor for ${exam} students. 
Context card topic: "${currentDoubtCard?.topic||'General'}"
Card question: "${currentDoubtCard?.q||''}"
Card answer: "${currentDoubtCard?.a?.replace(/<[^>]+>/g,'')||''}"

Answer the student's doubt clearly and concisely. Use simple language. If needed, use examples. Keep answers under 200 words. End with one encouraging tip.`;

    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const contents=[{role:'user',parts:[{text:sys+'\n\nStudent: '+q}]},...doubtHistory.slice(1)];
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:doubtHistory,generationConfig:{maxOutputTokens:800,temperature:0.4}})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Error');
    const rParts=data.candidates?.[0]?.content?.parts||[];
    const rText=((rParts.find(p=>!p.thought&&p.text)||rParts[0])||{}).text||'Sorry, I could not answer that.';
    
    typingEl.remove();
    const aiMsg=document.createElement('div');aiMsg.className='msg msg-ai';
    aiMsg.innerHTML=rText.trim().replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
    msgs.appendChild(aiMsg);msgs.scrollTop=msgs.scrollHeight;
    doubtHistory.push({role:'model',parts:[{text:rText}]});
  }catch(e){
    typingEl.remove();
    const errMsg=document.createElement('div');errMsg.className='msg msg-ai';errMsg.style.color='#ef4444';
    errMsg.textContent='Error: '+e.message;msgs.appendChild(errMsg);
  }
}

document.getElementById('doubt-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('doubt-overlay'))document.getElementById('doubt-overlay').classList.remove('show');});
document.getElementById('doubt-close').addEventListener('click',()=>document.getElementById('doubt-overlay').classList.remove('show'));
document.getElementById('doubt-send').addEventListener('click',sendDoubt);
document.getElementById('doubt-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDoubt();}});
document.getElementById('doubt-btn').addEventListener('click',()=>openDoubtChat());

// ══════════════════════════════════════
// WEAK TOPIC NOTES
// ══════════════════════════════════════
function openNotes(preselectedTopic){
  const overlay=document.getElementById('notes-overlay');
  const sel=document.getElementById('notes-topic-sel');
  sel.innerHTML='';
  
  // Get all topics from current deck or all decks
  const topics=new Set(['General']);
  if(curDeckId){
    const deck=getDeck(curDeckId);
    if(deck)deck.cards.forEach(c=>c.topic&&topics.add(c.topic));
  } else {
    getIdx().forEach(it=>{const d=getDeck(it.id);if(d)d.cards.forEach(c=>c.topic&&topics.add(c.topic));});
  }
  [...topics].forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o);});
  if(preselectedTopic&&topics.has(preselectedTopic))sel.value=preselectedTopic;
  
  // Load existing note for selected topic
  loadNoteForTopic(sel.value);
  renderSavedNotes();
  overlay.classList.add('show');
  document.getElementById('notes-textarea').focus();
}

function loadNoteForTopic(topic){
  const notes=getNotes();
  const note=notes.find(n=>n.topic===topic);
  document.getElementById('notes-textarea').value=note?note.text:'';
}

document.getElementById('notes-topic-sel').addEventListener('change',e=>loadNoteForTopic(e.target.value));

document.getElementById('notes-save').addEventListener('click',()=>{
  const topic=document.getElementById('notes-topic-sel').value;
  const text=document.getElementById('notes-textarea').value.trim();
  if(!text){showToast('Write something first!','error');return;}
  const notes=getNotes().filter(n=>n.topic!==topic);
  notes.unshift({topic,text,date:new Date().toLocaleDateString()});
  setNotes(notes);
  const count=notes.length;if(count>=3)earnBadge('notes_writer');
  showToast('📝 Note saved!');renderSavedNotes();
});

document.getElementById('notes-clear').addEventListener('click',()=>{
  document.getElementById('notes-textarea').value='';
});

document.getElementById('notes-ask-ai').addEventListener('click',()=>{
  const topic=document.getElementById('notes-topic-sel').value;
  const text=document.getElementById('notes-textarea').value;
  document.getElementById('notes-overlay').classList.remove('show');
  // Create a virtual card for the doubt
  const virtualCard={topic,q:`Notes on ${topic}`,a:text||'(no notes yet)'};
  openDoubtChat(virtualCard);
});

function renderSavedNotes(){
  const notes=getNotes();
  const el=document.getElementById('saved-notes-list');
  if(!notes.length){el.innerHTML='<div style="font-size:.8rem;color:var(--ink-3);font-family:\'DM Mono\',monospace">No notes yet. Write your first note above!</div>';return;}
  el.innerHTML='';
  notes.forEach((n,i)=>{
    const d=document.createElement('div');d.className='saved-note';
    d.innerHTML=`<div class="saved-note-topic">${n.topic} · ${n.date}</div>
      <div class="saved-note-text">${n.text.slice(0,300)}${n.text.length>300?'…':''}</div>
      <div class="saved-note-actions">
        <button class="saved-note-del" data-i="${i}">🗑 Delete</button>
        <button class="nb" data-topic="${n.topic}" data-text="${encodeURIComponent(n.text)}" style="font-size:.6rem;padding:.25rem .6rem;min-height:auto">🤖 Ask AI</button>
      </div>`;
    d.querySelector('.saved-note-del').addEventListener('click',()=>{const ns=getNotes();ns.splice(i,1);setNotes(ns);renderSavedNotes();});
    d.querySelector('.nb').addEventListener('click',()=>{
      document.getElementById('notes-overlay').classList.remove('show');
      openDoubtChat({topic:n.topic,q:`Notes on ${n.topic}`,a:decodeURIComponent(d.querySelector('.nb').dataset.text)});
    });
    el.appendChild(d);
  });
}

document.getElementById('notes-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('notes-overlay'))document.getElementById('notes-overlay').classList.remove('show');});
document.getElementById('notes-close').addEventListener('click',()=>document.getElementById('notes-overlay').classList.remove('show'));
document.getElementById('cv-notes').addEventListener('click',()=>{
  const card=filteredCards[cardIdx];
  openNotes(card?.topic);
});

// ══════════════════════════════════════
// AI SUMMARY FEATURE
// ══════════════════════════════════════
async function generateSummary(){
  const overlay=document.getElementById('summary-overlay');
  const body=document.getElementById('summary-body');
  overlay.classList.add('show');
  body.innerHTML='<div class="explain-loading"><div class="explain-spinner"></div>Generating AI summary of this deck…</div>';
  const key=getKey();
  if(!key){body.innerHTML='<div class="explain-body">No API key set.</div>';return;}
  if(!curDeckId){body.innerHTML='<div class="explain-body">No deck loaded.</div>';return;}
  
  const deck=getDeck(curDeckId);
  const topics=[...new Set(deck.cards.map(c=>c.topic).filter(Boolean))];
  const highPrio=deck.cards.filter(c=>c.priority==='high').slice(0,5);
  
  try{
    const prompt=`I am studying for ${deck.meta.exam||'my exam'}. I have flashcards on these topics: ${topics.join(', ')}.
    
Here are the most important high-priority questions from my deck:
${highPrio.map((c,i)=>`${i+1}. Q: ${c.q}\n   A: ${c.a.replace(/<[^>]+>/g,'')}`).join('\n\n')}

Please provide a structured study summary:
1. Key concepts I must know (top 5)
2. Likely exam questions (top 3)
3. Most common mistakes to avoid
4. Quick memory tips / mnemonics if any

Keep it concise, exam-focused, and actionable. Use <strong>tags</strong> for emphasis.`;
    
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1200,temperature:0.3}})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Error');
    const rParts=data.candidates?.[0]?.content?.parts||[];
    const rText=((rParts.find(p=>!p.thought&&p.text)||rParts[0])||{}).text||'';
    body.innerHTML=`<div class="explain-body">${rText.trim().replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>')}</div>`;
  }catch(e){body.innerHTML=`<div class="explain-body" style="color:#ef4444">Error: ${e.message}</div>`;}
}

document.getElementById('cv-summary').addEventListener('click',generateSummary);
document.getElementById('summary-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('summary-overlay'))document.getElementById('summary-overlay').classList.remove('show');});
document.getElementById('summary-close').addEventListener('click',()=>document.getElementById('summary-overlay').classList.remove('show'));

// ══════════════════════════════════════
// FOCUS TIMER
// ══════════════════════════════════════
function openTimer(){
  document.getElementById('timer-overlay').classList.add('show');
  updateTimerDisplay();
  updateTimerStats();
}

function setTimerDuration(mins){
  if(timerRunning)return;
  timerTotalSeconds=mins*60;timerSecondsLeft=timerTotalSeconds;
  document.querySelectorAll('.timer-preset').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.mins)===mins));
  document.getElementById('timer-label').textContent=mins<=10?'Break 🌿':'Study Session 📚';
  updateTimerDisplay();updateTimerRing();
}

document.querySelectorAll('.timer-preset').forEach(b=>b.addEventListener('click',()=>setTimerDuration(parseInt(b.dataset.mins))));

document.getElementById('timer-start').addEventListener('click',()=>{
  if(timerRunning){
    clearInterval(timerInterval);timerRunning=false;
    document.getElementById('timer-start').textContent='▶ Resume';
  } else {
    timerRunning=true;
    document.getElementById('timer-start').textContent='⏸ Pause';
    timerInterval=setInterval(()=>{
      timerSecondsLeft--;
      if(timerSecondsLeft<=0){
        clearInterval(timerInterval);timerRunning=false;
        document.getElementById('timer-start').textContent='▶ Start';
        // Record session
        const sessions=$.get('fg:timer_sessions',[]);
        const today=new Date().toISOString().slice(0,10);
        sessions.push({date:today,mins:Math.round(timerTotalSeconds/60)});
        $.set('fg:timer_sessions',sessions);
        const totalMins=sessions.filter(s=>s.date===today).reduce((a,b)=>a+b.mins,0);
        if(totalMins>=60)earnBadge('focus_1h');
        showToast('⏱ Session complete! Great work!','success');
        updateTimerStats();
        timerSecondsLeft=timerTotalSeconds;
      }
      updateTimerDisplay();updateTimerRing();
    },1000);
  }
});

document.getElementById('timer-reset').addEventListener('click',()=>{
  clearInterval(timerInterval);timerRunning=false;
  timerSecondsLeft=timerTotalSeconds;
  document.getElementById('timer-start').textContent='▶ Start';
  updateTimerDisplay();updateTimerRing();
});

function updateTimerDisplay(){
  const m=Math.floor(timerSecondsLeft/60),s=timerSecondsLeft%60;
  document.getElementById('timer-display').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateTimerRing(){
  const prog=document.getElementById('timer-ring-prog');
  const circumference=326.7;
  const pct=timerSecondsLeft/timerTotalSeconds;
  prog.style.strokeDashoffset=circumference*(1-pct);
}

function updateTimerStats(){
  const sessions=$.get('fg:timer_sessions',[]);
  const today=new Date().toISOString().slice(0,10);
  const todaySessions=sessions.filter(s=>s.date===today);
  document.getElementById('timer-sessions-count').textContent=todaySessions.length;
  document.getElementById('timer-total-mins').textContent=todaySessions.reduce((a,b)=>a+b.mins,0);
}

document.getElementById('timer-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('timer-overlay'))document.getElementById('timer-overlay').classList.remove('show');});
document.getElementById('timer-close').addEventListener('click',()=>document.getElementById('timer-overlay').classList.remove('show'));

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

  // Weak topics in sidebar (from ratings)
  if(curDeckId){
    const mdata=computeMastery();
    const weakSpots=Object.entries(mdata)
      .filter(([,d])=>d.known+d.review>=2)
      .map(([t,d])=>({t,pct:Math.round(d.known/(d.known+d.review)*100)}))
      .filter(w=>w.pct<50)
      .sort((a,b)=>a.pct-b.pct).slice(0,5);
    if(weakSpots.length){
      const hdr=document.getElementById('weak-topics-hdr');hdr.style.display='';
      const swt=document.getElementById('sb-weak-topics');swt.innerHTML='';
      weakSpots.forEach(ws=>{
        const b=document.createElement('button');b.className='sbpill weak-pill';
        b.innerHTML=`<span>⚠ ${ws.t}</span><span class="sb-cnt" style="color:#ef4444">${ws.pct}%</span>`;
        b.addEventListener('click',()=>{deact();b.classList.add('active');setFil(c=>c.topic===ws.t);});
        swt.appendChild(b);
      });
    }
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
document.getElementById('cv-new').addEventListener('click',()=>{pdfFiles=[];renderFileList();genBtn.disabled=true;showScreen('upload');renderLibrary();});
document.getElementById('cv-dash').addEventListener('click',()=>{showScreen('dashboard');renderDash();});
document.getElementById('sb-toggle').addEventListener('click',()=>{sidebarOpen=!sidebarOpen;document.getElementById('sidebar').classList.toggle('open',sidebarOpen);});

// ── QUIZ MODE ──
document.getElementById('cv-quiz').addEventListener('click',()=>{
  if(allCards.length<4){showToast('Need at least 4 cards to start a quiz','error');return;}
  localStorage.setItem('fg:quiz_deck_id', curDeckId||'');
  localStorage.setItem('fg:quiz_all_cards', JSON.stringify(allCards));
  window.location.href='quiz.html';
});
document.getElementById('cv-exam-sim').addEventListener('click',()=>openExamSim());
document.getElementById('cv-predict').addEventListener('click',()=>openPredictor());
document.getElementById('cv-mindmap').addEventListener('click',()=>openMindMap());

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
  else{
    wl.innerHTML='';
    weakSpots.forEach(ws=>{
      const el=document.createElement('div');el.className='weak-item';
      el.innerHTML=`<div><div class="wi-topic">${ws.t}</div><div style="font-size:.68rem;color:var(--ink-3);font-family:'DM Mono',monospace;margin-top:.15rem">${ws.ch||''}</div></div>
        <div class="wi-pct">${ws.pct}% known</div>
        <button class="wi-btn" data-topic="${ws.t}">+ Generate 5 More</button>
        <button class="wi-notes-btn" data-topic="${ws.t}">📝 Take Notes</button>
        <button class="wi-notes-btn" data-topic="${ws.t}" data-ask="1">🤖 Ask AI</button>`;
      el.querySelector('.wi-btn').addEventListener('click',()=>generateWeakCards(ws.t,ws.ch));
      el.querySelectorAll('.wi-notes-btn').forEach(b=>{
        b.addEventListener('click',()=>{
          if(b.dataset.ask){
            openDoubtChat({topic:ws.t,q:'Help me understand '+ws.t,a:'I am weak in this topic'});
          } else {
            openNotes(ws.t);
          }
        });
      });
      wl.appendChild(el);
    });
  }
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

  // Handle return navigation from quiz.html
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
      history.replaceState(null,'',window.location.pathname);
      if(ret==='quiz-done'){
        const lastScore=$.get('fg:last_quiz_score',null);
        if(lastScore) showToast('Quiz done — '+lastScore.score+'/'+lastScore.total+' correct ('+lastScore.pct+'%)','info');
      }
    } else { showScreen('upload'); }
  } else {
    showScreen('upload');
  }
})();

// ══════════════════════════════════════
// FEATURE 1: AI EXAM PREDICTOR
// ══════════════════════════════════════
async function openPredictor(){
  const overlay=document.getElementById('predict-overlay');
  const body=document.getElementById('predict-body');
  overlay.classList.add('show');
  if(!curDeckId){body.innerHTML='<div class="explain-body">Open a deck first to use the predictor.</div>';return;}
  body.innerHTML='<div class="explain-loading"><div class="explain-spinner"></div>Analysing your weak spots and predicting likely exam questions…</div>';
  const key=getKey();
  if(!key){body.innerHTML='<div class="explain-body">No API key set.</div>';return;}
  earnBadge('predicted');

  const deck=getDeck(curDeckId);
  const res=getRes(curDeckId);
  const mdata=computeMastery();
  const weakTopics=Object.entries(mdata)
    .filter(([,d])=>d.known+d.review>=1)
    .map(([t,d])=>({t,pct:d.known+d.review?Math.round(d.known/(d.known+d.review)*100):50,total:d.total}))
    .sort((a,b)=>a.pct-b.pct).slice(0,8);
  const allTopics=[...new Set(deck.cards.map(c=>c.topic).filter(Boolean))];
  const highPrio=deck.cards.filter(c=>c.priority==='high').map(c=>c.q).slice(0,8);

  try{
    const prompt=`You are a top ${deck.meta.exam||'exam'} paper setter with 20 years of experience.

A student is studying for ${deck.meta.exam||'their exam'}. Based on their study data:

WEAK TOPICS (sorted by lowest mastery first):
${weakTopics.map(w=>`- ${w.t}: ${w.pct}% mastered`).join('\n')}

ALL TOPICS COVERED:
${allTopics.join(', ')}

HIGH-PRIORITY QUESTIONS IN THEIR DECK:
${highPrio.map((q,i)=>`${i+1}. ${q}`).join('\n')}

Please provide a focused exam prediction:

## 🎯 Top 5 Most Likely Exam Questions
(Based on topic importance, frequency, and this student's weak areas)

## ⚠️ Topics Most Likely to Trip This Student
(3 specific areas where they're likely to lose marks)

## 📋 Rapid Revision Checklist  
(8 specific things to review in the last 24 hours before the exam)

## 🔑 Most Frequently Tested Concepts
(Top 5 concepts that appear in almost every ${deck.meta.exam} paper)

Be specific, actionable, and exam-pattern-aware. Use <strong> for key terms.`;

    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1800,temperature:0.4}})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Error');
    const rParts=data.candidates?.[0]?.content?.parts||[];
    const rText=((rParts.find(p=>!p.thought&&p.text)||rParts[0])||{}).text||'';
    body.innerHTML=`<div class="explain-body">${rText.trim().replace(/##\s*/g,'<h3 style="font-size:.9rem;font-weight:600;color:var(--ac);margin:1rem 0 .4rem;font-family:\'Outfit\',sans-serif">').replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>')}</div>`;
    earnCoins(10,'used predictor');
    showToast('🔮 Exam prediction ready! +10 coins','info');
  }catch(e){body.innerHTML=`<div class="explain-body" style="color:#ef4444">Error: ${e.message}</div>`;}
}
document.getElementById('predict-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('predict-overlay'))document.getElementById('predict-overlay').classList.remove('show');});
document.getElementById('predict-close').addEventListener('click',()=>document.getElementById('predict-overlay').classList.remove('show'));

// ══════════════════════════════════════
// FEATURE 2: ADAPTIVE DIFFICULTY (reword wrong card)
// ══════════════════════════════════════
let adaptiveCard=null, adaptiveNewCard=null;
async function openAdaptiveExplainer(card){
  adaptiveCard=card;adaptiveNewCard=null;
  const overlay=document.getElementById('adaptive-overlay');
  const body=document.getElementById('adaptive-body');
  document.getElementById('adaptive-replace').style.display='none';
  overlay.classList.add('show');
  body.innerHTML='<div class="explain-loading"><div class="explain-spinner"></div>Simplifying this card for better understanding…</div>';
  const key=getKey();
  if(!key){body.innerHTML='<div class="explain-body">No API key set.</div>';return;}

  // Check if rated wrong multiple times
  const wrongCount=$.get('fg:wrong:'+encodeURIComponent(card.q.slice(0,40)),0)+1;
  $.set('fg:wrong:'+encodeURIComponent(card.q.slice(0,40)),wrongCount);

  try{
    const prompt=`A student keeps getting this flashcard WRONG (${wrongCount} time${wrongCount>1?'s':''}).

ORIGINAL QUESTION: ${card.q.replace(/<[^>]+>/g,'')}
ORIGINAL ANSWER: ${card.a.replace(/<[^>]+>/g,'')}
TOPIC: ${card.topic||'General'}
EXAM: ${curDeckMeta()?.exam||'CBSE'}

Please:
1. Explain WHY this concept is confusing and what common misconceptions students have
2. Provide a SIMPLER reworded version of this question that builds understanding step by step
3. Give a memorable analogy or mnemonic to lock this in
4. Write a NEW simplified flashcard (JSON at the end) that's easier to understand but teaches the same concept

Return your explanation first, then end with EXACTLY this JSON on its own line:
{"q":"simplified question","a":"clearer answer with analogy","topic":"${card.topic||'General'}","type":"${card.type||'recall'}","priority":"high","chapter":"${card.chapter||'General'}"}

Use <strong> for emphasis.`;

    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1400,temperature:0.4}})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Error');
    const rParts=data.candidates?.[0]?.content?.parts||[];
    const rText=((rParts.find(p=>!p.thought&&p.text)||rParts[0])||{}).text||'';

    // Try to extract the JSON card at the end
    const jsonMatch=rText.match(/\{"q"[\s\S]*?"chapter"[^}]*\}/);
    if(jsonMatch){
      try{adaptiveNewCard=JSON.parse(jsonMatch[0]);}catch{}
    }
    const explanation=rText.replace(/\{"q"[\s\S]*?\}/,'').trim();
    body.innerHTML=`<div class="explain-body">${explanation.replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>')}
    ${adaptiveNewCard?`<div style="margin-top:1.25rem;padding:.85rem;background:var(--surf);border:1px solid var(--ac);border-radius:12px"><div style="font-size:.65rem;color:var(--ac);font-family:'DM Mono',monospace;margin-bottom:.4rem">✨ SIMPLIFIED CARD</div><strong>${adaptiveNewCard.q}</strong><br><br>${adaptiveNewCard.a}</div>`:''}
    </div>`;
    if(adaptiveNewCard) document.getElementById('adaptive-replace').style.display='block';
  }catch(e){body.innerHTML=`<div class="explain-body" style="color:#ef4444">Error: ${e.message}</div>`;}
}

document.getElementById('adaptive-replace').addEventListener('click',()=>{
  if(!adaptiveNewCard||!curDeckId)return;
  const deck=getDeck(curDeckId);
  if(!deck)return;
  const idx=deck.cards.findIndex(c=>c.q===adaptiveCard.q);
  if(idx!==-1){deck.cards[idx]={...adaptiveNewCard,_simplified:true};setDeck(curDeckId,deck.meta,deck.cards);allCards=[...deck.cards];filteredCards=[...deck.cards];}
  else{deck.cards.push({...adaptiveNewCard,_simplified:true});setDeck(curDeckId,deck.meta,deck.cards);allCards=[...deck.cards];filteredCards=[...deck.cards];}
  document.getElementById('adaptive-overlay').classList.remove('show');
  showToast('✓ Card simplified and replaced!');
});
document.getElementById('adaptive-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('adaptive-overlay'))document.getElementById('adaptive-overlay').classList.remove('show');});
document.getElementById('adaptive-close').addEventListener('click',()=>document.getElementById('adaptive-overlay').classList.remove('show'));

// Trigger adaptive on multiple wrong SR ratings
const _origRateSR=window.rateSR;

// ══════════════════════════════════════
// FEATURE 3: WRONG ANSWER EXPLAINER (for quiz)
// ══════════════════════════════════════
async function openWrongExplainer(questionText, correctAnswer, yourAnswer, topic, exam){
  const overlay=document.getElementById('wrongexp-overlay');
  const body=document.getElementById('wrongexp-body');
  overlay.classList.add('show');
  body.innerHTML='<div class="explain-loading"><div class="explain-spinner"></div>Analysing your mistake…</div>';
  const key=getKey();
  if(!key){body.innerHTML='<div class="explain-body">No API key set.</div>';return;}
  try{
    const prompt=`A ${exam||'CBSE'} student got this question WRONG in a quiz.

QUESTION: ${questionText}
CORRECT ANSWER: ${correctAnswer}
STUDENT'S ANSWER: ${yourAnswer||'(skipped/timed out)'}
TOPIC: ${topic||'General'}

Explain clearly:
1. Why the correct answer is right (the underlying concept)
2. Why the student's answer is wrong (the likely misconception)
3. A simple trick or rule to never get this wrong again
4. One similar question they should practise

Keep it concise (under 200 words). Use <strong> for key points.`;
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:700,temperature:0.3}})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Error');
    const rParts=data.candidates?.[0]?.content?.parts||[];
    const rText=((rParts.find(p=>!p.thought&&p.text)||rParts[0])||{}).text||'';
    body.innerHTML=`<div class="explain-body">${rText.trim().replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>')}</div>`;
  }catch(e){body.innerHTML=`<div class="explain-body" style="color:#ef4444">Error: ${e.message}</div>`;}
}
// Expose globally for quiz.js to call
window.openWrongExplainer=openWrongExplainer;
document.getElementById('wrongexp-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('wrongexp-overlay'))document.getElementById('wrongexp-overlay').classList.remove('show');});
document.getElementById('wrongexp-close').addEventListener('click',()=>document.getElementById('wrongexp-overlay').classList.remove('show'));

// ══════════════════════════════════════
// FEATURE 4: CONCEPT MIND MAP
// ══════════════════════════════════════
async function openMindMap(){
  const overlay=document.getElementById('mindmap-overlay');
  const body=document.getElementById('mindmap-body');
  overlay.classList.add('show');
  if(!curDeckId){body.innerHTML='<div class="explain-body">Open a deck first.</div>';return;}
  body.innerHTML='<div class="explain-loading"><div class="explain-spinner"></div>Mapping concept connections…</div>';
  const key=getKey();
  if(!key){body.innerHTML='<div class="explain-body">No API key set.</div>';return;}
  const deck=getDeck(curDeckId);
  const topics=[...new Set(deck.cards.map(c=>c.topic).filter(Boolean))].slice(0,15);
  const cards=deck.cards.slice(0,30).map(c=>({q:c.q.replace(/<[^>]+>/g,'').slice(0,80),topic:c.topic||'General'}));
  earnBadge('mindmapper');

  try{
    const prompt=`Generate a concept mind map structure for these flashcard topics: ${topics.join(', ')}

Based on these questions:
${cards.map(c=>`- [${c.topic}] ${c.q}`).join('\n')}

Return ONLY a JSON object with this exact structure:
{
  "center": "Main Subject Name",
  "branches": [
    {
      "label": "Branch Topic",
      "color": "#hexcolor",
      "children": ["subtopic 1", "subtopic 2", "subtopic 3"]
    }
  ]
}

Maximum 6 branches, 3 children each. Colors should be visually distinct. No markdown, no preamble.`;

    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${key}`;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1200,temperature:0.5}})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error?.message||'Error');
    const rParts=data.candidates?.[0]?.content?.parts||[];
    const rText=((rParts.find(p=>!p.thought&&p.text)||rParts[0])||{}).text||'';

    let mapData;
    try{
      const cleaned=rText.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
      const match=cleaned.match(/(\{[\s\S]*\})/);
      mapData=JSON.parse(match?match[1]:cleaned);
    }catch{
      // Fallback: build from actual topics
      const branchColors=['#7c6ffa','#22d3ee','#a855f7','#f59e0b','#22c55e','#ef4444'];
      mapData={center:deck.meta.name.slice(0,20),branches:topics.slice(0,6).map((t,i)=>({label:t,color:branchColors[i%branchColors.length],children:deck.cards.filter(c=>c.topic===t).slice(0,3).map(c=>c.q.replace(/<[^>]+>/g,'').slice(0,30))}))};
    }
    body.innerHTML=renderMindMap(mapData);
    earnCoins(5,'mind map');
  }catch(e){body.innerHTML=`<div class="explain-body" style="color:#ef4444">Error: ${e.message}</div>`;}
}

function renderMindMap(data){
  const {center,branches=[]}=data;
  const W=600,H=440,cx=W/2,cy=H/2;
  const n=branches.length;
  let svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;font-family:'Outfit',sans-serif;overflow:visible">
  <defs><filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity=".15"/></filter></defs>
  <!-- Center node -->
  <ellipse cx="${cx}" cy="${cy}" rx="70" ry="32" fill="var(--ac)" filter="url(#shadow)"/>
  <text x="${cx}" y="${cy+5}" text-anchor="middle" fill="white" font-size="13" font-weight="700">${esc(center.slice(0,18))}</text>`;

  branches.forEach((br,i)=>{
    const angle=(i/n)*Math.PI*2 - Math.PI/2;
    const bx=cx+Math.cos(angle)*160,by=cy+Math.sin(angle)*130;
    const col=br.color||'#7c6ffa';
    // Line from center to branch
    svg+=`<line x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="2.5" stroke-opacity=".6"/>`;
    // Branch node
    const bw=Math.min(100,br.label.length*8+20);
    svg+=`<rect x="${bx-bw/2}" y="${by-18}" width="${bw}" height="34" rx="10" fill="${col}" filter="url(#shadow)"/>
    <text x="${bx}" y="${by+5}" text-anchor="middle" fill="white" font-size="11" font-weight="600">${esc(br.label.slice(0,14))}</text>`;
    // Children
    (br.children||[]).slice(0,3).forEach((child,j)=>{
      const spread=0.35,childAngle=angle+(j-1)*spread;
      const clx=bx+Math.cos(childAngle)*90,cly=by+Math.sin(childAngle)*70;
      svg+=`<line x1="${bx}" y1="${by}" x2="${clx}" y2="${cly}" stroke="${col}" stroke-width="1.5" stroke-opacity=".4" stroke-dasharray="4"/>`;
      svg+=`<circle cx="${clx}" cy="${cly}" r="28" fill="var(--surf)" stroke="${col}" stroke-width="1.5"/>
      <text x="${clx}" y="${cly-4}" text-anchor="middle" fill="var(--ink)" font-size="8.5" font-weight="500">${esc(child.slice(0,12))}</text>
      ${child.length>12?`<text x="${clx}" y="${cly+7}" text-anchor="middle" fill="var(--ink-2)" font-size="7.5">${esc(child.slice(12,24))}</text>`:''}`;
    });
  });
  svg+='</svg>';
  return `<div style="text-align:center">${svg}</div><div style="font-size:.7rem;color:var(--ink-3);text-align:center;margin-top:.75rem;font-family:'DM Mono',monospace">${branches.length} branches · ${branches.reduce((a,b)=>a+(b.children||[]).length,0)} concepts mapped</div>`;
}

document.getElementById('mindmap-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('mindmap-overlay'))document.getElementById('mindmap-overlay').classList.remove('show');});
document.getElementById('mindmap-close').addEventListener('click',()=>document.getElementById('mindmap-overlay').classList.remove('show'));

// ══════════════════════════════════════
// FEATURE 5: STUDY ROOMS (BroadcastChannel)
// ══════════════════════════════════════
function openRoom(){
  document.getElementById('room-overlay').classList.add('show');
  if(roomCode) showActiveRoom();
  else{
    document.getElementById('room-active').style.display='none';
    document.querySelector('#room-body .room-section').style.display='';
    document.querySelector('.room-divider').style.display='';
    document.querySelectorAll('#room-body .room-section')[1].style.display='';
  }
}

function genRoomCode(){return Math.random().toString(36).slice(2,8).toUpperCase();}

document.getElementById('room-create-btn').addEventListener('click',()=>{
  const name=prompt('Your name for this room:','Student');
  if(!name)return;
  roomName=name.trim()||'Student';
  roomCode=genRoomCode();
  joinRoomChannel();
  earnBadge('room_joined');
  earnCoins(5,'created room');
  showActiveRoom();
  showToast('Room created! Share code: '+roomCode,'info');
});

document.getElementById('room-join-btn').addEventListener('click',()=>{
  const code=document.getElementById('room-code-input').value.trim().toUpperCase();
  if(code.length<4){showToast('Enter a valid room code','error');return;}
  const name=prompt('Your name:','Student');
  if(!name)return;
  roomName=name.trim()||'Student';
  roomCode=code;
  joinRoomChannel();
  earnBadge('room_joined');
  showActiveRoom();
  showToast('Joined room '+code+'!','info');
});

function joinRoomChannel(){
  if(roomChannel)roomChannel.close();
  try{
    roomChannel=new BroadcastChannel('fg_room_'+roomCode);
    roomMembers[roomName]={name:roomName,card:cardIdx,deck:curDeckId?getDeck(curDeckId)?.meta?.name||'Unknown':'No deck',lastSeen:Date.now()};
    roomChannel.postMessage({type:'join',name:roomName,deck:curDeckId?getDeck(curDeckId)?.meta?.name||'Unknown':'No deck'});
    roomChannel.onmessage=e=>{
      const msg=e.data;
      if(msg.type==='join'){
        roomMembers[msg.name]={name:msg.name,deck:msg.deck,card:0,lastSeen:Date.now()};
        roomChannel.postMessage({type:'hello',name:roomName,deck:curDeckId?getDeck(curDeckId)?.meta?.name||'Unknown':'No deck',card:cardIdx});
        addRoomFeed('👋 '+msg.name+' joined');
        renderRoomMembers();
      } else if(msg.type==='hello'){
        roomMembers[msg.name]={name:msg.name,deck:msg.deck,card:msg.card||0,lastSeen:Date.now()};
        renderRoomMembers();
      } else if(msg.type==='progress'){
        if(roomMembers[msg.name])roomMembers[msg.name].card=msg.card;
        renderRoomMembers();
        addRoomFeed('📖 '+msg.name+' is on card '+(msg.card+1));
      } else if(msg.type==='leave'){
        delete roomMembers[msg.name];
        addRoomFeed('👋 '+msg.name+' left');
        renderRoomMembers();
      }
    };
  }catch(e){showToast('Study Rooms require a modern browser','error');}
}

function broadcastProgress(){
  if(roomChannel&&roomCode) roomChannel.postMessage({type:'progress',name:roomName,card:cardIdx});
}

function showActiveRoom(){
  document.querySelector('#room-body .room-section').style.display='none';
  document.querySelector('.room-divider').style.display='none';
  document.querySelectorAll('#room-body .room-section')[1].style.display='none';
  document.getElementById('room-active').style.display='';
  document.getElementById('room-code-show').textContent=roomCode;
  renderRoomMembers();
}

function renderRoomMembers(){
  const el=document.getElementById('room-members');
  const members=Object.values(roomMembers);
  el.innerHTML=`<div style="font-size:.7rem;color:var(--ink-2);font-family:'DM Mono',monospace;margin-bottom:.5rem">${members.length} member${members.length!==1?'s':''} online</div>`+
    members.map(m=>`<div class="room-member"><span class="rm-dot"></span><span class="rm-name">${esc(m.name)}${m.name===roomName?' (you)':''}</span><span class="rm-deck" style="font-size:.65rem;color:var(--ink-2)">${esc(m.deck)}</span></div>`).join('');
}

let roomFeedLog=[];
function addRoomFeed(msg){
  roomFeedLog.push(msg);if(roomFeedLog.length>10)roomFeedLog=roomFeedLog.slice(-10);
  const el=document.getElementById('room-feed');
  el.innerHTML=roomFeedLog.map(m=>`<div style="font-size:.7rem;color:var(--ink-2);padding:.2rem 0;font-family:'DM Mono',monospace">${m}</div>`).join('');
  el.scrollTop=el.scrollHeight;
}

document.getElementById('room-copy-code').addEventListener('click',()=>{
  navigator.clipboard?.writeText(roomCode).then(()=>showToast('Room code copied!','info'));
});

document.getElementById('room-leave-btn').addEventListener('click',()=>{
  if(roomChannel){roomChannel.postMessage({type:'leave',name:roomName});roomChannel.close();}
  roomCode=null;roomChannel=null;roomMembers={};roomFeedLog=[];
  document.getElementById('room-active').style.display='none';
  document.querySelector('#room-body .room-section').style.display='';
  document.querySelector('.room-divider').style.display='';
  document.querySelectorAll('#room-body .room-section')[1].style.display='';
  showToast('Left the study room');
});

document.getElementById('room-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('room-overlay'))document.getElementById('room-overlay').classList.remove('show');});
document.getElementById('room-close').addEventListener('click',()=>document.getElementById('room-overlay').classList.remove('show'));

// ══════════════════════════════════════
// FEATURE 7: REWARD SHOP
// ══════════════════════════════════════
const SHOP_ITEMS=[
  {id:'theme_ember',name:'🔥 Ember Theme',desc:'Warm ember dark theme',cost:50,type:'theme',value:'ember'},
  {id:'theme_cyberpunk',name:'💜 Cyberpunk Theme',desc:'Neon cyber aesthetic',cost:75,type:'theme',value:'cyberpunk'},
  {id:'theme_dracula',name:'🧛 Dracula Theme',desc:'Classic dark purple',cost:60,type:'theme',value:'dracula'},
  {id:'theme_deepspace',name:'🌌 Deep Space Theme',desc:'Into the cosmos',cost:100,type:'theme',value:'deepspace'},
  {id:'card_confetti',name:'🎉 Card Confetti',desc:'Confetti burst on card flip',cost:80,type:'effect',value:'confetti'},
  {id:'streak_freeze',name:'❄️ Streak Freeze',desc:'Protect your streak for 1 day',cost:30,type:'powerup',value:'freeze'},
  {id:'hint_extra',name:'💡 Extra Hints ×5',desc:'5 extra hints in quiz mode',cost:40,type:'powerup',value:'hints'},
  {id:'coin_double',name:'⚡ Coin Double (1 day)',desc:'Earn 2× coins for 24 hours',cost:120,type:'powerup',value:'2x'},
];

function openShop(){
  document.getElementById('shop-overlay').classList.add('show');
  renderShop();
}

function renderShop(){
  const coins=getCoins();
  const unlocked=getUnlocked();
  document.getElementById('shop-coins-display').textContent=coins;
  const grid=document.getElementById('shop-grid');
  grid.innerHTML='';
  SHOP_ITEMS.forEach(item=>{
    const owned=unlocked.includes(item.id);
    const canAfford=coins>=item.cost;
    const el=document.createElement('div');
    el.className='shop-item'+(owned?' owned':'')+(canAfford||owned?'':' locked');
    el.innerHTML=`<div class="si-name">${item.name}</div>
      <div class="si-desc">${item.desc}</div>
      <div class="si-foot">
        <span class="si-cost">🪙 ${item.cost}</span>
        ${owned?'<span class="si-owned">✓ Owned</span>':`<button class="si-buy" data-id="${item.id}" ${canAfford?'':'disabled'}>Buy</button>`}
      </div>`;
    if(!owned){
      el.querySelector('.si-buy')?.addEventListener('click',()=>buyItem(item));
    } else if(item.type==='theme'){
      el.style.cursor='pointer';
      el.addEventListener('click',()=>{applyTheme(item.value);showToast('Theme applied!');});
    }
    grid.appendChild(el);
  });
}

function buyItem(item){
  const coins=getCoins();
  if(coins<item.cost){showToast('Not enough coins!','error');return;}
  setCoins(coins-item.cost);
  const unlocked=getUnlocked();
  unlocked.push(item.id);
  $.set('fg:unlocked',unlocked);
  earnBadge('shop_unlock');
  if(item.type==='theme') applyTheme(item.value);
  if(item.type==='powerup'&&item.value==='freeze'){
    const tomorrow=new Date(Date.now()+864e5).toISOString().slice(0,10);
    $.set('fg:streak_freeze',tomorrow);
  }
  if(item.type==='powerup'&&item.value==='2x'){
    $.set('fg:coin_double_until',Date.now()+864e5);
  }
  if(item.type==='powerup'&&item.value==='hints'){
    $.set('fg:extra_hints',($.get('fg:extra_hints',0))+5);
  }
  showToast('✓ '+item.name+' unlocked!');
  renderShop();
}

document.getElementById('shop-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('shop-overlay'))document.getElementById('shop-overlay').classList.remove('show');});
document.getElementById('shop-close').addEventListener('click',()=>document.getElementById('shop-overlay').classList.remove('show'));

// ══════════════════════════════════════
// FEATURE 17: PWA SERVICE WORKER
// ══════════════════════════════════════
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(()=>{
      console.log('FlashGen SW registered');
    }).catch(err=>console.log('SW registration failed:',err));
  });
}

// ══════════════════════════════════════
// FEATURE 19: EXAM SIMULATION MODE
// ══════════════════════════════════════
const SIM_PATTERNS={
  jee:{name:'JEE Main',time:90,marks:4,negative:-1,desc:'90 min · +4/–1 · MCQ'},
  neet:{name:'NEET',time:180,marks:4,negative:-1,desc:'180 min · +4/–1 · MCQ'},
  cbse:{name:'CBSE Board',time:180,marks:1,negative:0,desc:'180 min · +1/0 · No negative'},
  upsc:{name:'UPSC',time:120,marks:2,negative:-0.67,desc:'120 min · +2/–⅔ · MCQ'},
  custom:{name:'Custom',time:30,marks:4,negative:-1,desc:'Custom settings'}
};

document.getElementById('sim-pattern').addEventListener('change',e=>{
  const p=SIM_PATTERNS[e.target.value];
  if(p&&e.target.value!=='custom'){
    document.getElementById('sim-time').value=p.time;
    document.getElementById('sim-marks').value=p.marks;
    document.getElementById('sim-negative').value=p.negative;
  }
});

function openExamSim(){
  document.getElementById('examsim-overlay').classList.add('show');
  document.getElementById('examsim-setup').style.display='';
  document.getElementById('examsim-active').style.display='none';
  document.getElementById('examsim-results').style.display='none';
}

document.getElementById('examsim-start-btn').addEventListener('click',()=>{
  if(!allCards.length){showToast('Open a deck first','error');return;}
  const qcount=parseInt(document.getElementById('sim-qcount').value)||20;
  const time=parseInt(document.getElementById('sim-time').value)||30;
  const marks=parseFloat(document.getElementById('sim-marks').value)||4;
  const negative=parseFloat(document.getElementById('sim-negative').value)||(-1);
  const patternKey=document.getElementById('sim-pattern').value;
  simConfig={qcount,time,marks,negative,pattern:SIM_PATTERNS[patternKey]?.name||'Custom'};

  // Shuffle and pick cards, build MCQ questions
  simCards=shuffle([...allCards]).slice(0,Math.min(qcount,allCards.length));
  simAnswers=simCards.map(()=>({selected:null,markedReview:false}));
  simIdx=0;simReviewLater=new Set();
  simTimeLeft=time*60;

  document.getElementById('examsim-setup').style.display='none';
  document.getElementById('examsim-active').style.display='';
  renderSimQuestion();
  startSimTimer();
  buildSimPalette();
});

function renderSimQuestion(){
  const card=simCards[simIdx];
  if(!card){endExamSim();return;}
  const ans=simAnswers[simIdx];

  document.getElementById('sim-q-num').textContent=`Q${simIdx+1}/${simCards.length}`;
  document.getElementById('sim-prog-fill').style.width=((simIdx+1)/simCards.length*100)+'%';
  updateSimScore();

  // Build distractors
  const correct=card.a.replace(/<[^>]+>/g,'').slice(0,120);
  const pool=allCards.filter(c=>c!==card&&c.a);
  const distractors=shuffle(pool).slice(0,3).map(c=>c.a.replace(/<[^>]+>/g,'').slice(0,120));
  while(distractors.length<3)distractors.push(['Cannot be determined','None of the above','All of the above'][distractors.length]);
  const opts=shuffle([correct,...distractors]);

  document.getElementById('sim-question').innerHTML=`
    <div class="sim-q-meta">${card.topic||'General'} · ${card.chapter||'General'} ${ans.markedReview?'<span style="color:#a78bfa;font-size:.7rem">📌 Marked for review</span>':''}</div>
    <div class="sim-q-text">${card.q}</div>`;

  const optsEl=document.getElementById('sim-options');
  optsEl.innerHTML='';
  const LETTERS=['A','B','C','D'];
  opts.forEach((opt,i)=>{
    const btn=document.createElement('button');
    btn.className='sim-opt'+(ans.selected===i?' selected':'');
    btn.innerHTML=`<span class="sim-opt-letter">${LETTERS[i]}</span><span>${esc(opt)}</span>`;
    btn.dataset.optIdx=i;
    btn.dataset.isCorrect=(opt===correct);
    btn.addEventListener('click',()=>{
      simAnswers[simIdx].selected=i;
      simAnswers[simIdx].correctOpt=opts.findIndex(o=>o===correct);
      document.querySelectorAll('.sim-opt').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      updateSimScore();
      updateSimPaletteCell(simIdx,'answered');
    });
    optsEl.appendChild(btn);
  });
}

function updateSimScore(){
  let score=0,attempted=0;
  simAnswers.forEach((a,i)=>{
    if(a.selected===null)return;
    attempted++;
    const isCorrect=a.selected===a.correctOpt;
    score+=isCorrect?simConfig.marks:simConfig.negative;
  });
  document.getElementById('sim-score-live').textContent=score.toFixed(1);
  document.getElementById('sim-attempted').textContent=attempted;
}

function startSimTimer(){
  clearInterval(simTimer);
  simTimer=setInterval(()=>{
    simTimeLeft--;
    const m=Math.floor(simTimeLeft/60),s=simTimeLeft%60;
    const disp=document.getElementById('sim-timer-display');
    disp.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if(simTimeLeft<=300)disp.style.color='#ef4444';
    if(simTimeLeft<=0){clearInterval(simTimer);endExamSim();}
  },1000);
}

function buildSimPalette(){
  const el=document.getElementById('sim-palette');
  el.innerHTML='<div style="font-size:.65rem;color:var(--ink-2);font-family:\'DM Mono\',monospace;margin-bottom:.4rem">Question palette</div><div class="sim-pal-grid" id="sim-pal-grid"></div>';
  const grid=document.getElementById('sim-pal-grid');
  simCards.forEach((_,i)=>{
    const btn=document.createElement('button');
    btn.className='sim-pal-btn';btn.textContent=i+1;btn.dataset.i=i;
    btn.addEventListener('click',()=>{simIdx=i;renderSimQuestion();updateAllPalette();});
    grid.appendChild(btn);
  });
  updateAllPalette();
}

function updateAllPalette(){
  document.querySelectorAll('.sim-pal-btn').forEach((btn,i)=>{
    btn.classList.remove('current','answered','review');
    if(i===simIdx)btn.classList.add('current');
    else if(simAnswers[i]?.selected!==null)btn.classList.add('answered');
    if(simReviewLater.has(i))btn.classList.add('review');
  });
}

function updateSimPaletteCell(i,cls){
  const btn=document.querySelectorAll('.sim-pal-btn')[i];
  if(btn)btn.classList.add(cls);
}

document.getElementById('sim-prev-btn').addEventListener('click',()=>{if(simIdx>0){simIdx--;renderSimQuestion();updateAllPalette();}});
document.getElementById('sim-next-btn').addEventListener('click',()=>{if(simIdx<simCards.length-1){simIdx++;renderSimQuestion();updateAllPalette();}});
document.getElementById('sim-skip-btn').addEventListener('click',()=>{if(simIdx<simCards.length-1){simIdx++;renderSimQuestion();updateAllPalette();}});
document.getElementById('sim-review-btn').addEventListener('click',()=>{
  if(simReviewLater.has(simIdx))simReviewLater.delete(simIdx);else simReviewLater.add(simIdx);
  simAnswers[simIdx].markedReview=simReviewLater.has(simIdx);
  renderSimQuestion();updateAllPalette();
});
document.getElementById('sim-submit-btn').addEventListener('click',()=>{
  if(!confirm('Submit exam? You cannot change answers after this.'))return;
  clearInterval(simTimer);endExamSim();
});

function endExamSim(){
  clearInterval(simTimer);
  document.getElementById('examsim-active').style.display='none';
  document.getElementById('examsim-results').style.display='';
  earnBadge('exam_sim');earnCoins(20,'exam simulation');

  let correct=0,wrong=0,skipped=0,totalScore=0;
  simAnswers.forEach(a=>{
    if(a.selected===null){skipped++;return;}
    if(a.selected===a.correctOpt){correct++;totalScore+=simConfig.marks;}
    else{wrong++;totalScore+=simConfig.negative;}
  });
  const pct=Math.round(correct/simCards.length*100);
  if(pct===100)earnBadge('perfect_sim');

  const wrongList=simCards.map((c,i)=>({c,a:simAnswers[i]})).filter(x=>x.a.selected!==null&&x.a.selected!==x.a.correctOpt);

  document.getElementById('examsim-results').innerHTML=`
    <div style="text-align:center;padding:1.5rem 1.5rem .75rem">
      <div style="font-size:3rem">${pct>=80?'🏆':pct>=60?'🎯':pct>=40?'👍':'📚'}</div>
      <div style="font-size:2rem;font-weight:700;color:var(--ac);margin:.3rem 0">${totalScore.toFixed(1)} / ${(simCards.length*simConfig.marks).toFixed(1)}</div>
      <div style="font-size:.85rem;color:var(--ink-2)">${pct}% accuracy · ${simConfig.pattern}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;padding:0 1.5rem .75rem;text-align:center">
      <div class="rstat"><span class="rstat-n" style="color:#22c55e">${correct}</span><span class="rstat-l">Correct</span></div>
      <div class="rstat"><span class="rstat-n" style="color:#ef4444">${wrong}</span><span class="rstat-l">Wrong</span></div>
      <div class="rstat"><span class="rstat-n" style="color:#f59e0b">${skipped}</span><span class="rstat-l">Skipped</span></div>
      <div class="rstat"><span class="rstat-n" style="color:var(--ac)">${pct}%</span><span class="rstat-l">Accuracy</span></div>
    </div>
    ${wrongList.length?`<div style="padding:0 1.5rem 1.5rem">
      <div style="font-size:.78rem;font-weight:600;color:var(--ink);margin-bottom:.6rem">Review Wrong Answers</div>
      ${wrongList.slice(0,5).map(x=>`<div class="bk-row bk-wrong" style="cursor:pointer" onclick="openWrongExplainer('${x.c.q.replace(/'/g,'&apos;').replace(/<[^>]+>/g,'').slice(0,100)}','${x.c.a.replace(/<[^>]+>/g,'').replace(/'/g,'&apos;').slice(0,80)}','',${JSON.stringify(x.c.topic||'General')},${JSON.stringify(curDeckMeta()?.exam||'CBSE')})">
        <div class="bk-ic">✗</div>
        <div class="bk-body"><div class="bk-q">${x.c.q.replace(/<[^>]+>/g,'').slice(0,70)}…</div></div>
        <div class="bk-pts" style="font-size:.65rem;color:var(--ac)">Why? →</div>
      </div>`).join('')}
    </div>`:''}
    <div style="padding:0 1.5rem 1.5rem;display:flex;gap:.75rem">
      <button class="btn-full" onclick="openExamSim()">🔄 Try Again</button>
    </div>`;
}

document.getElementById('examsim-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('examsim-overlay')){clearInterval(simTimer);document.getElementById('examsim-overlay').classList.remove('show');}});
document.getElementById('examsim-close').addEventListener('click',()=>{clearInterval(simTimer);document.getElementById('examsim-overlay').classList.remove('show');});

// ══════════════════════════════════════
// FEATURE 20: WHATSAPP / TELEGRAM BOT
// ══════════════════════════════════════
function openBotModal(){
  document.getElementById('bot-overlay').classList.add('show');
  buildBotPreview();
}

function buildBotPreview(){
  if(!allCards.length&&!curDeckId){
    document.getElementById('bot-cards-preview').textContent='Open a deck to see today\'s cards here.';
    return;
  }
  const cards=allCards.length?allCards:getDeck(curDeckId)?.cards||[];
  // Pick 5: prioritise high-priority, unseen, or weak cards
  const res=curDeckId?getRes(curDeckId):{};
  const weakOrUnseen=cards.filter((_,i)=>!res[i]||res[i]==='again').slice(0,5);
  const selected=(weakOrUnseen.length>=5?weakOrUnseen:cards).slice(0,5);
  const deck=curDeckId?getDeck(curDeckId):null;
  const exam=deck?.meta?.exam||selExam||'General';
  const today=new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});

  const text=`📚 FlashGen Daily Cards — ${today}
Exam: ${exam}
━━━━━━━━━━━━━━━━

${selected.map((c,i)=>`Q${i+1}. ${c.q.replace(/<[^>]+>/g,'').slice(0,120)}

💡 Answer: ${c.a.replace(/<[^>]+>/g,'').slice(0,150)}

`).join('---\n')}
━━━━━━━━━━━━━━━━
Keep revising! 🎯 Open FlashGen to track your progress.`;

  document.getElementById('bot-cards-preview').textContent=text;
  return text;
}

document.getElementById('bot-wa-btn').addEventListener('click',()=>{
  const text=buildBotPreview();
  const encoded=encodeURIComponent(text);
  window.open('https://wa.me/?text='+encoded,'_blank');
  earnBadge('bot_sent');earnCoins(3,'sent to WhatsApp');
  showToast('Opening WhatsApp…','info');
});

document.getElementById('bot-tg-btn').addEventListener('click',()=>{
  const text=buildBotPreview();
  const encoded=encodeURIComponent(text);
  window.open('https://t.me/share/url?url=https://flashgen.app&text='+encoded,'_blank');
  earnBadge('bot_sent');earnCoins(3,'sent to Telegram');
  showToast('Opening Telegram…','info');
});

document.getElementById('bot-alarm-btn').addEventListener('click',()=>{
  const time=prompt('Set daily reminder time (e.g. 7:00):','7:00');
  if(!time)return;
  showToast('⏰ Reminder noted for '+time+' — set a recurring phone alarm too!','info');
  $.set('fg:bot_reminder_time',time);
});

document.getElementById('bot-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('bot-overlay'))document.getElementById('bot-overlay').classList.remove('show');});
document.getElementById('bot-close').addEventListener('click',()=>document.getElementById('bot-overlay').classList.remove('show'));

// ── Hook bot button in card viewer nav (add dynamically) ──
const cvBotBtn=document.createElement('button');
cvBotBtn.className='nb';cvBotBtn.id='cv-bot';cvBotBtn.textContent='📱 Send';
cvBotBtn.addEventListener('click',openBotModal);
document.querySelector('#screen-cards .nav-actions').insertBefore(cvBotBtn, document.getElementById('cv-dash'));

// ── Hook adaptive explainer to wrong SR ratings ──
const _rateSROriginal = window.rateSR;
document.getElementById('sr-again').addEventListener('click',()=>{
  const card=filteredCards[cardIdx];
  const wrongCount=$.get('fg:wrong:'+encodeURIComponent((card?.q||'').slice(0,40)),0);
  if(wrongCount>=2) setTimeout(()=>openAdaptiveExplainer(card),500);
},{capture:false});

// ── Broadcast room progress on card change ──
const _origUpdateCard=updateCard;

// Broadcast on card navigation
document.getElementById('next-btn').addEventListener('click',()=>setTimeout(broadcastProgress,100),true);
document.getElementById('prev-btn').addEventListener('click',()=>setTimeout(broadcastProgress,100),true);

// ── Update coin display in shop when opened ──
function updateCoinDisplay(){
  const el=document.getElementById('shop-coins-display');
  if(el)el.textContent=getCoins();
}

// ── Add coin balance to dashboard ──
const _origRenderDash=renderDash;
renderDash=function(){
  _origRenderDash();
  // add coins stat
  const sDecks=document.getElementById('s-decks');
  if(sDecks&&sDecks.parentElement){
    const existing=document.getElementById('s-coins');
    if(!existing){
      const coinBox=document.createElement('div');
      coinBox.className='sbox';coinBox.id='s-coins';
      coinBox.innerHTML=`<div class="snum" style="color:#f59e0b">${getCoins()}</div><div class="slbl">🪙 Coins</div>`;
      sDecks.parentElement.appendChild(coinBox);
    } else {
      existing.querySelector('.snum').textContent=getCoins();
    }
  }
};

