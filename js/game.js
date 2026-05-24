// Game state, level config, main loop
const Game = (() => {
  const LEVELS = [
    { id: 1, name: "⭐ O'Clock", icon: '⭐', generate: () => ({ h: rand(1, 12), m: 0 }) },
    { id: 2, name: '🌙 Half Past', icon: '🌙', generate: () => ({ h: rand(1, 12), m: pick([0, 30]) }) },
    { id: 3, name: '🌟 Quarter Hours', icon: '🌟', generate: () => ({ h: rand(1, 12), m: pick([0, 15, 30, 45]) }) },
    { id: 4, name: '🚀 Five Minutes', icon: '🚀', generate: () => ({ h: rand(1, 12), m: rand(0, 11) * 5 }) },
    { id: 5, name: '🏆 Clock Master', icon: '🏆', generate: () => ({ h: rand(1, 12), m: rand(0, 59) }) },
  ];

  const STORAGE_KEY = 'cq_progress_v1';

  // State
  let state = {
    currentLevel: 1,
    questionIdx: 0,
    score: 0,
    correctCount: 0,
    streak: 0,
    currentTime: { h: 12, m: 0 },
    answering: false,
    totalQuestions: 10,
  };

  let progress = loadProgress();
  let mascotHomeEl, mascotGameEl, mascotResultsEl;

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, unlocked: 1, lastLevel: 1 };
  }
  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function formatTime(h, m) {
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  // Generate 3 distractor times near the correct answer
  function generateDistractors(correct, levelId) {
    const distractors = new Set();
    const correctKey = formatTime(correct.h, correct.m);
    let attempts = 0;
    while (distractors.size < 3 && attempts < 50) {
      attempts++;
      let candidate;
      const strategy = rand(1, 4);
      if (strategy === 1) {
        // Swap hour and minute concept (off by an hour)
        const h = ((correct.h - 1 + (Math.random() < 0.5 ? 1 : -1) + 12) % 12) + 1;
        candidate = { h, m: correct.m };
      } else if (strategy === 2) {
        // Different minute, same hour
        candidate = { h: correct.h, m: LEVELS[levelId - 1].generate().m };
      } else if (strategy === 3) {
        // Plausible misread: hour + 1, common minute
        const h = (correct.h % 12) + 1;
        candidate = { h, m: LEVELS[levelId - 1].generate().m };
      } else {
        candidate = LEVELS[levelId - 1].generate();
      }
      const key = formatTime(candidate.h, candidate.m);
      if (key !== correctKey) distractors.add(key);
    }
    // Fallback fill
    while (distractors.size < 3) {
      const c = LEVELS[levelId - 1].generate();
      const k = formatTime(c.h, c.m);
      if (k !== correctKey) distractors.add(k);
    }
    return Array.from(distractors);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${id}`).classList.add('active');
  }

  // ===== HOME =====
  function renderHome() {
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';
    LEVELS.forEach(lvl => {
      const stars = progress.stars[lvl.id] || 0;
      const locked = lvl.id > progress.unlocked;
      const card = document.createElement('div');
      card.className = 'level-card' + (locked ? ' locked' : '');
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', locked ? '-1' : '0');
      card.setAttribute('aria-label', `${lvl.name}${locked ? ' (locked)' : `, ${stars} stars`}`);
      card.innerHTML = `
        ${locked ? '<div class="lvl-lock">🔒</div>' : ''}
        <span class="lvl-icon">${lvl.icon}</span>
        <div class="lvl-name">${lvl.name.replace(/^[^\s]+\s/, '')}</div>
        <div class="lvl-stars">
          <span class="${stars >= 1 ? 'star-on' : ''}">★</span>
          <span class="${stars >= 3 ? 'star-on' : ''}">★</span>
          <span class="${stars >= 5 ? 'star-on' : ''}">★</span>
        </div>
      `;
      if (!locked) {
        card.addEventListener('click', () => startLevel(lvl.id));
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startLevel(lvl.id); }
        });
      }
      grid.appendChild(card);
    });

    // Play button: last level
    const playBtn = document.getElementById('playBtn');
    const lastLvl = LEVELS.find(l => l.id === progress.lastLevel) || LEVELS[0];
    playBtn.textContent = `▶ Play ${lastLvl.name}`;
  }

  // ===== GAME =====
  function startLevel(levelId) {
    state.currentLevel = levelId;
    state.questionIdx = 0;
    state.score = 0;
    state.correctCount = 0;
    state.streak = 0;
    state.answering = false;
    progress.lastLevel = levelId;
    saveProgress();

    document.getElementById('levelName').textContent = LEVELS[levelId - 1].name;
    document.getElementById('score').textContent = '0';
    document.getElementById('streakBadge').hidden = true;
    Clock.build(document.getElementById('clock'));
    showScreen('game');

    Mascot.setMood(mascotGameEl, 'happy');
    setTimeout(() => nextQuestion(), 350);
  }

  function nextQuestion() {
    if (state.questionIdx >= state.totalQuestions) {
      return endRound();
    }
    state.questionIdx++;
    document.getElementById('qNum').textContent = state.questionIdx;

    const lvl = LEVELS[state.currentLevel - 1];
    state.currentTime = lvl.generate();
    Clock.setTime(state.currentTime.h, state.currentTime.m);

    // Build answers
    const correctStr = formatTime(state.currentTime.h, state.currentTime.m);
    const distractors = generateDistractors(state.currentTime, state.currentLevel);
    const options = shuffle([correctStr, ...distractors]);

    const answersEl = document.getElementById('answers');
    answersEl.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = opt;
      btn.setAttribute('aria-label', `Answer: ${opt.replace(':', ' ')}`);
      btn.addEventListener('click', () => handleAnswer(btn, opt, correctStr));
      btn.addEventListener('mouseenter', () => Audio.tick());
      answersEl.appendChild(btn);
    });

    state.answering = true;
  }

  function handleAnswer(btn, chosen, correct) {
    if (!state.answering) return;
    state.answering = false;
    const allBtns = document.querySelectorAll('.answer-btn');
    allBtns.forEach(b => b.disabled = true);

    if (chosen === correct) {
      btn.classList.add('correct');
      state.correctCount++;
      state.streak++;
      let points = 10;
      if (state.streak >= 5) points = 20;
      else if (state.streak >= 3) points = 15;
      state.score += points;
      document.getElementById('score').textContent = state.score;

      const sb = document.getElementById('streakBadge');
      if (state.streak >= 3) {
        sb.hidden = false;
        document.getElementById('streakNum').textContent = state.streak;
        if (state.streak === 3 || state.streak === 5) Audio.sparkle();
      }

      Audio.correct();
      Mascot.setMood(mascotGameEl, 'excited');
      mascotGameEl.classList.add('celebrate');
      setTimeout(() => mascotGameEl.classList.remove('celebrate'), 700);

      const rect = btn.getBoundingClientRect();
      Confetti.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, state.streak >= 5 ? 120 : 70);

      setTimeout(() => nextQuestion(), 1100);
    } else {
      btn.classList.add('wrong');
      // Highlight correct
      allBtns.forEach(b => {
        if (b.textContent === correct) b.classList.add('correct');
      });
      state.streak = 0;
      document.getElementById('streakBadge').hidden = true;
      Audio.wrong();
      Mascot.setMood(mascotGameEl, 'sad');

      const clockEl = document.getElementById('clock');
      clockEl.classList.add('shake');
      setTimeout(() => clockEl.classList.remove('shake'), 500);

      setTimeout(() => {
        Mascot.setMood(mascotGameEl, 'happy');
        nextQuestion();
      }, 1600);
    }
  }

  // ===== RESULTS =====
  function endRound() {
    const correct = state.correctCount;
    let stars = 0;
    if (correct >= 9) stars = 3;
    else if (correct >= 6) stars = 2;
    else if (correct >= 3) stars = 1;

    const prevStars = progress.stars[state.currentLevel] || 0;
    const newTotal = prevStars + stars;
    progress.stars[state.currentLevel] = newTotal;

    let unlocked = false;
    if (newTotal >= 5 && state.currentLevel < 5 && progress.unlocked < state.currentLevel + 1) {
      progress.unlocked = state.currentLevel + 1;
      unlocked = true;
    }
    saveProgress();

    // Render results
    let title = 'Great job!';
    let mood = 'happy';
    if (stars === 3) { title = 'Amazing! ⭐⭐⭐'; mood = 'excited'; }
    else if (stars === 2) { title = 'Well done!'; mood = 'happy'; }
    else if (stars === 1) { title = 'Good try!'; mood = 'happy'; }
    else { title = 'Keep practising!'; mood = 'sad'; }

    document.getElementById('resultsTitle').textContent = title;
    document.getElementById('finalScore').textContent = state.score;
    document.getElementById('finalCorrect').textContent = correct;
    document.getElementById('unlockMsg').hidden = !unlocked;

    const slots = document.querySelectorAll('.star-slot');
    slots.forEach(s => s.classList.remove('earned'));

    Mascot.setMood(mascotResultsEl, mood);

    // Next level button visibility
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.style.display = (state.currentLevel < 5 && progress.unlocked > state.currentLevel) ? '' : 'none';

    showScreen('results');

    // Animate stars in
    slots.forEach((slot, i) => {
      if (i < stars) {
        setTimeout(() => {
          slot.classList.add('earned');
          Audio.tick();
        }, 400 + i * 350);
      }
    });

    if (stars > 0) {
      setTimeout(() => Audio.fanfare(), 400 + stars * 350);
      setTimeout(() => Confetti.burst(window.innerWidth / 2, window.innerHeight / 3, 120), 400 + stars * 350);
    }
  }

  // ===== INIT =====
  function init() {
    // Mount mascots
    mascotHomeEl = Mascot.build();
    document.getElementById('mascotHome').appendChild(mascotHomeEl);
    Mascot.setMood(mascotHomeEl, 'happy');

    mascotGameEl = Mascot.build();
    document.getElementById('mascotGame').appendChild(mascotGameEl);
    Mascot.setMood(mascotGameEl, 'happy');

    mascotResultsEl = Mascot.build();
    document.getElementById('mascotResults').appendChild(mascotResultsEl);

    renderHome();

    // Buttons
    document.getElementById('playBtn').addEventListener('click', () => {
      startLevel(progress.lastLevel || 1);
    });
    document.getElementById('backBtn').addEventListener('click', () => {
      renderHome();
      showScreen('home');
    });
    document.getElementById('againBtn').addEventListener('click', () => startLevel(state.currentLevel));
    document.getElementById('nextBtn').addEventListener('click', () => {
      const next = Math.min(state.currentLevel + 1, 5);
      startLevel(next);
    });
    document.getElementById('homeBtn').addEventListener('click', () => {
      renderHome();
      showScreen('home');
    });

    // Mute
    const muteBtn = document.getElementById('muteBtn');
    function syncMute() {
      muteBtn.textContent = Audio.isMuted() ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', Audio.isMuted() ? 'Unmute sound' : 'Mute sound');
    }
    syncMute();
    muteBtn.addEventListener('click', () => { Audio.toggleMute(); syncMute(); });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { startLevel };
})();
