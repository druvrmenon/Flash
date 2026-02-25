// ══════════════════════════════════════════
//  FLASHGEN QUIZ ENGINE  — fully wired to app
// ══════════════════════════════════════════

// ─── Storage helpers ───
const $ = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ─── State ───
let allCards    = [];
let quizCards   = [];
let quizIdx     = 0;
let quizScore   = 0;
let quizAnswers = [];
let quizTimer   = null;
let timeLeft    = 30;
let selectedCount = 10;
let answered    = false;
let deckId      = null;

const TE      = { recall:'🧠 Recall', formula:'🧪 Formula', diagram:'📊 Diagram', concept:'💡 Concept', application:'🎯 Applied' };
const LETTERS = ['A','B','C','D'];

// ─── Load cards passed from app.js ───
function loadCards() {
  deckId = localStorage.getItem('fg:quiz_deck_id') || null;

  // Primary: cards passed directly from the card viewer
  const raw = localStorage.getItem('fg:quiz_all_cards');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 4) { allCards = parsed; return true; }
    } catch {}
  }

  // Fallback: load directly from the stored deck
  if (deckId) {
    const deck = $.get('fg:d:' + deckId, null);
    if (deck?.cards?.length >= 4) { allCards = deck.cards; return true; }
  }

  // Last resort: merge all saved decks
  const idx = $.get('fg:idx', []);
  for (const item of idx) {
    const deck = $.get('fg:d:' + item.id, null);
    if (deck?.cards) allCards = [...allCards, ...deck.cards];
  }
  return allCards.length >= 4;
}

// ─── Init ───
window.addEventListener('DOMContentLoaded', () => {
  const hasCards = loadCards();

  if (!hasCards || allCards.length < 4) {
    document.getElementById('start-card').classList.add('hidden');
    document.getElementById('no-cards').classList.remove('hidden');
    return;
  }

  // Populate deck info on start screen
  let deckName = 'Your flashcards';
  if (deckId) {
    const deck = $.get('fg:d:' + deckId, null);
    if (deck?.meta?.name) deckName = deck.meta.name;
  }
  document.getElementById('start-desc').textContent =
    `${allCards.length} cards from "${deckName.slice(0, 50)}" — test your knowledge with timed multiple-choice questions.`;

  // Disable count options that exceed available cards
  document.querySelectorAll('.qc-chip').forEach(btn => {
    const n = parseInt(btn.dataset.n);
    if (n > allCards.length) {
      btn.disabled = true;
      btn.style.opacity = '.3';
      btn.classList.remove('active');
    }
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qc-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCount = n;
    });
  });
  // Default to first available count
  const firstValid = document.querySelector('.qc-chip:not([disabled])');
  if (firstValid && !document.querySelector('.qc-chip.active:not([disabled])')) {
    document.querySelectorAll('.qc-chip').forEach(b => b.classList.remove('active'));
    firstValid.classList.add('active');
    selectedCount = parseInt(firstValid.dataset.n);
  }

  // Button wiring
  document.getElementById('start-btn').addEventListener('click', startQuiz);

  document.getElementById('exit-btn').addEventListener('click', () => {
    clearInterval(quizTimer);
    window.location.href = 'index.html?return=cards';
  });

  document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('progress-bar-wrap').classList.add('hidden');
  });

  document.getElementById('back-cards-btn').addEventListener('click', () => {
    window.location.href = 'index.html?return=quiz-done';
  });

  document.getElementById('view-stats-btn').addEventListener('click', () => {
    window.location.href = 'index.html?return=dashboard';
  });

  document.getElementById('next-btn').addEventListener('click', advanceQuestion);
  document.addEventListener('keydown', handleKeydown);
});

// ─── Start ───
function startQuiz() {
  quizCards   = [...allCards].sort(() => Math.random() - .5).slice(0, Math.min(selectedCount, allCards.length));
  quizIdx     = 0;
  quizScore   = 0;
  quizAnswers = [];
  answered    = false;

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('quiz-section').classList.remove('hidden');
  document.getElementById('progress-bar-wrap').classList.remove('hidden');

  renderQuestion();
}

// ─── Render question ───
function renderQuestion() {
  if (quizIdx >= quizCards.length) { showResults(); return; }

  answered = false;
  const card = quizCards[quizIdx];

  // Progress bar & header
  const progPct = (quizIdx / quizCards.length) * 100;
  document.getElementById('top-progress-fill').style.width = progPct + '%';
  document.getElementById('progress-text').textContent = `Question ${quizIdx + 1} of ${quizCards.length}`;
  document.getElementById('live-score').textContent = `${quizScore} correct`;
  document.getElementById('q-num-label').textContent = 'Q' + (quizIdx + 1);

  // Meta chips
  const meta = document.getElementById('q-meta');
  meta.innerHTML = '';
  if (card.topic) {
    const tc = document.createElement('div');
    tc.className = 'q-topic-chip';
    tc.textContent = card.topic;
    meta.appendChild(tc);
  }
  if (card.type) {
    const tt = document.createElement('div');
    tt.className = 'q-type-chip';
    tt.textContent = TE[card.type] || card.type;
    meta.appendChild(tt);
  }
  if (card.priority === 'high') {
    const hp = document.createElement('div');
    hp.className = 'q-priority-chip';
    hp.textContent = '🔴 High Priority';
    meta.appendChild(hp);
  }

  document.getElementById('q-text').textContent = stripHtml(card.q);

  // Build 4 options — 1 correct + 3 distractors
  const correctText = stripHtml(card.a).slice(0, 150);
  const pool = allCards
    .filter(c => c !== card)
    .map(c => stripHtml(c.a).slice(0, 150))
    .filter(t => t && t !== correctText);
  const distractors = pool.sort(() => Math.random() - .5).slice(0, 3);
  const opts = [correctText, ...distractors].sort(() => Math.random() - .5);
  const correctIdx = opts.indexOf(correctText);

  // Render buttons
  const grid = document.getElementById('opts-grid');
  grid.innerHTML = '';
  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.dataset.correct = i === correctIdx;
    btn.dataset.idx = i;
    btn.innerHTML = `<div class="opt-letter">${LETTERS[i]}</div><div class="opt-text">${escapeHtml(opt)}</div>`;
    btn.addEventListener('click', () => selectOption(btn, correctIdx, opts, card));
    grid.appendChild(btn);
  });

  // Reset feedback & next
  document.getElementById('feedback-strip').className = 'feedback-strip';
  document.getElementById('next-wrap').classList.add('hidden');

  // Re-trigger entry animations
  const qCard = document.getElementById('q-card');
  qCard.style.animation = 'none'; qCard.offsetHeight; qCard.style.animation = '';
  grid.style.animation   = 'none'; grid.offsetHeight;   grid.style.animation   = '';

  startTimer();
}

// ─── Timer ───
function startTimer() {
  clearInterval(quizTimer);
  timeLeft = 30;

  const fill = document.getElementById('timer-fill');
  const num  = document.getElementById('timer-num');
  fill.style.width = '100%';
  fill.className   = 'timer-fill';
  num.className    = 'timer-num';
  num.textContent  = timeLeft;

  quizTimer = setInterval(() => {
    timeLeft--;
    fill.style.width = (timeLeft / 30 * 100) + '%';
    num.textContent  = timeLeft;

    if (timeLeft <= 10) { fill.className = 'timer-fill warning'; num.className = 'timer-num warning'; }
    if (timeLeft <= 5)  { fill.className = 'timer-fill critical'; num.className = 'timer-num critical'; }
    if (timeLeft <= 0)  { clearInterval(quizTimer); autoTimeout(); }
  }, 1000);
}

// ─── Select answer ───
function selectOption(btn, correctIdx, opts, card) {
  if (answered) return;
  answered = true;
  clearInterval(quizTimer);

  const isCorrect = btn.dataset.correct === 'true';

  document.querySelectorAll('.opt-btn').forEach((b, i) => {
    b.disabled = true;
    if (i === correctIdx)            b.classList.add('correct');
    else if (b === btn && !isCorrect) b.classList.add('wrong');
    else                              b.classList.add('dimmed');
  });

  if (isCorrect) quizScore++;

  quizAnswers.push({
    q:             card.q,
    correct:       isCorrect,
    topic:         card.topic   || 'General',
    type:          card.type    || 'recall',
    chapter:       card.chapter || 'General',
    priority:      card.priority|| 'medium',
    cardRef:       card,                          // keep ref for SR write-back
    timeLeft,
    userAnswer:    opts[parseInt(btn.dataset.idx)],
    correctAnswer: opts[correctIdx]
  });

  showFeedback(isCorrect, isCorrect ? null : opts[correctIdx]);

  setTimeout(() => {
    const nw = document.getElementById('next-wrap');
    document.getElementById('next-btn-label').textContent =
      quizIdx + 1 >= quizCards.length ? 'See Results' : 'Next Question';
    nw.classList.remove('hidden');
  }, 300);
}

// ─── Timeout ───
function autoTimeout() {
  if (answered) return;
  answered = true;

  document.querySelectorAll('.opt-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.correct === 'true') b.classList.add('correct');
    else b.classList.add('dimmed');
  });

  const card = quizCards[quizIdx];
  quizAnswers.push({
    q: card.q, correct: false,
    topic: card.topic||'General', type: card.type||'recall',
    chapter: card.chapter||'General', priority: card.priority||'medium',
    cardRef: card, timeLeft: 0, userAnswer: null, correctAnswer: null
  });

  const fb = document.getElementById('feedback-strip');
  document.getElementById('feedback-icon').textContent = '⏰';
  document.getElementById('feedback-text').innerHTML = '<strong>Time\'s up!</strong> The correct answer is highlighted above.';
  fb.className = 'feedback-strip timeout show';

  setTimeout(() => {
    document.getElementById('next-btn-label').textContent =
      quizIdx + 1 >= quizCards.length ? 'See Results' : 'Next Question';
    document.getElementById('next-wrap').classList.remove('hidden');
  }, 300);
}

// ─── Feedback strip ───
function showFeedback(isCorrect, correctAnswer) {
  const fb     = document.getElementById('feedback-strip');
  const fbIcon = document.getElementById('feedback-icon');
  const fbText = document.getElementById('feedback-text');
  const praise = ['Excellent!','Spot on!','Perfect!','Brilliant!','Nailed it!','Great job!'];

  if (isCorrect) {
    fb.className   = 'feedback-strip correct show';
    fbIcon.textContent = '✓';
    fbText.innerHTML = `<strong>${praise[Math.floor(Math.random()*praise.length)]}</strong> You got it right.`;
  } else {
    fb.className   = 'feedback-strip wrong show';
    fbIcon.textContent = '✗';
    fbText.innerHTML = `<strong>Not quite.</strong> The correct answer was:<br>
      <span class="correct-answer-preview">${escapeHtml((correctAnswer||'').slice(0,120))}</span>`;
  }
}

// ─── Advance ───
function advanceQuestion() {
  if (!answered) return;
  quizIdx++;
  renderQuestion();
}

// ─── Keyboard ───
function handleKeydown(e) {
  const keyMap   = { a:0, b:1, c:2, d:3, 1:0, 2:1, 3:2, 4:3 };
  const quizOn   = !document.getElementById('quiz-section').classList.contains('hidden');
  if (quizOn && !answered) {
    const idx = keyMap[e.key.toLowerCase()];
    if (idx !== undefined) {
      const btns = document.querySelectorAll('.opt-btn');
      if (btns[idx] && !btns[idx].disabled) btns[idx].click();
    }
  }
  if (quizOn && answered && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    if (!document.getElementById('next-wrap').classList.contains('hidden')) advanceQuestion();
  }
}

// ══════════════════════════════════════════
//  RESULTS — with full write-back to app data
// ══════════════════════════════════════════
function showResults() {
  clearInterval(quizTimer);
  document.getElementById('quiz-section').classList.add('hidden');
  document.getElementById('progress-bar-wrap').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  document.getElementById('top-progress-fill').style.width = '100%';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const total    = quizCards.length;
  const pct      = Math.round((quizScore / total) * 100);
  const wrong    = quizAnswers.filter(a => !a.correct);
  const skipped  = quizAnswers.filter(a => !a.correct && !a.userAnswer);
  const avgTime  = Math.round(quizAnswers.reduce((s,a) => s + (30 - a.timeLeft), 0) / quizAnswers.length);

  // ── Write quiz results back to mastery data (fg:r:deckId) ──
  writeResultsToMastery();

  // ── Save last score so app.js can show a toast on return ──
  $.set('fg:last_quiz_score', { score: quizScore, total, pct });

  // ── Badge unlocks ──
  if (pct === 100) earnBadge('perfect');
  const qc = $.get('fg:quiz_count', 0) + 1;
  $.set('fg:quiz_count', qc);
  if (qc >= 5) earnBadge('quiz_5');

  // ── Trophy & grade ──
  const trophy = pct >= 90 ? '🏆' : pct >= 70 ? '🎯' : pct >= 50 ? '👍' : '📚';
  const grade  = pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Great Work!' : pct >= 50 ? 'Good Effort!' : 'Keep Studying!';

  document.getElementById('results-trophy').textContent = trophy;
  document.getElementById('results-score').textContent  = `${quizScore}/${total}`;
  document.getElementById('results-pct').textContent    = `${pct}% correct`;
  document.getElementById('results-grade').textContent  = grade;

  // ── Stats row ──
  document.getElementById('results-stats').innerHTML = `
    <div class="rstat"><div class="rstat-num green">${quizScore}</div><div class="rstat-lbl">Correct</div></div>
    <div class="rstat"><div class="rstat-num red">${wrong.length}</div><div class="rstat-lbl">Wrong</div></div>
    <div class="rstat"><div class="rstat-num yellow">${skipped.length}</div><div class="rstat-lbl">Timed Out</div></div>
    <div class="rstat"><div class="rstat-num blue">${avgTime}s</div><div class="rstat-lbl">Avg. Time</div></div>
  `;

  // ── Perfect / high score banner ──
  const perfEl = document.getElementById('results-perfect');
  if (pct === 100) {
    perfEl.innerHTML = `<div class="perfect-banner"><p>🎉 Flawless Victory! Perfect score — you've mastered this deck!</p></div>`;
    launchConfetti();
  } else if (pct >= 80) {
    perfEl.innerHTML = `<div class="perfect-banner"><p>🌟 Excellent performance! You're well prepared.</p></div>`;
  } else {
    perfEl.innerHTML = '';
  }

  // ── Per-question breakdown ──
  const bc = document.getElementById('breakdown-card');
  bc.innerHTML = `<div class="breakdown-title">📋 Question Review</div>`;
  quizAnswers.forEach((ans, i) => {
    const status = ans.correct ? 'correct' : (ans.userAnswer === null ? 'skipped' : 'wrong');
    const icon   = ans.correct ? '✓' : (ans.userAnswer === null ? '⏰' : '✗');
    const div    = document.createElement('div');
    div.className = 'breakdown-row';
    div.innerHTML = `
      <div class="breakdown-icon">${icon}</div>
      <div class="breakdown-q">
        <strong>Q${i+1}: ${escapeHtml(stripHtml(ans.q).slice(0,80))}${stripHtml(ans.q).length > 80 ? '…' : ''}</strong>
        ${!ans.correct && ans.correctAnswer
          ? `<span style="font-size:.75rem;color:var(--ink-3)">Answer: ${escapeHtml(ans.correctAnswer.slice(0,80))}</span>`
          : ''}
      </div>
      <div class="breakdown-tag ${status}">${status.charAt(0).toUpperCase()+status.slice(1)}</div>`;
    bc.appendChild(div);
  });

  // ── Weak topic tags ──
  const topicErr = {};
  wrong.forEach(a => { topicErr[a.topic] = (topicErr[a.topic]||0) + 1; });
  const weakTopics = Object.entries(topicErr).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const weakEl = document.getElementById('results-weak');
  weakEl.innerHTML = weakTopics.length ? `
    <div class="weak-card">
      <div class="weak-card-title">⚠ Topics to Review</div>
      <div class="weak-topics">
        ${weakTopics.map(([t,n]) => `<div class="weak-topic-tag">${escapeHtml(t)} · ${n} wrong</div>`).join('')}
      </div>
    </div>` : '';
}

// ─── Write quiz answers back to fg:r:deckId so mastery dashboard updates ───
function writeResultsToMastery() {
  if (!deckId) return;
  const deck = $.get('fg:d:' + deckId, null);
  if (!deck || !deck.cards) return;

  const res = $.get('fg:r:' + deckId, {});

  quizAnswers.forEach(ans => {
    if (!ans.cardRef) return;
    // Find the card index in the full deck
    const globalIdx = deck.cards.findIndex(c =>
      c.q === ans.cardRef.q && c.a === ans.cardRef.a
    );
    if (globalIdx === -1) return;
    // Only update if the quiz result is better, or there's no existing rating
    // "correct" in quiz → 'good'; wrong/timeout → 'again' (but don't overwrite an existing 'good')
    if (ans.correct) {
      res[globalIdx] = 'good';
    } else if (res[globalIdx] === undefined || res[globalIdx] === null) {
      res[globalIdx] = 'again';
    }
    // Track total rated count for badges
    const tot = $.get('fg:tot_rated', 0) + 1;
    $.set('fg:tot_rated', tot);
    if (tot >= 50)  earnBadge('rated_50');
    if (tot >= 100) earnBadge('rated_100');
  });

  $.set('fg:r:' + deckId, res);
}

// ─── Badge helper ───
function earnBadge(id) {
  const earned = $.get('fg:badges', []);
  if (!earned.includes(id)) { earned.push(id); $.set('fg:badges', earned); }
}

// ─── Confetti ───
function launchConfetti() {
  const colors = ['#7c6ffa','#22d3ee','#34d399','#f59e0b','#ec4899','#f87171'];
  for (let i = 0; i < 90; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `
        left:${Math.random()*100}vw; top:-20px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        width:${Math.random()*8+6}px; height:${Math.random()*8+6}px;
        border-radius:${Math.random()>.5?'50%':'2px'};
        animation-duration:${2+Math.random()*2}s;
        animation-delay:${Math.random()*.5}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4500);
    }, i * 28);
  }
}

// ─── Utils ───
function stripHtml(str) {
  return (str||'').replace(/<[^>]+>/g,'')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim();
}
function escapeHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
