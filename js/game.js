// Game state, level config, main loop + voice integration
const Game = (() => {
  const LEVELS = [
    { id: 1, name: "⭐ O'Clock", icon: '⭐', generate: () => ({ h: rand(1, 12), m: 0 }) },
    { id: 2, name: '🌙 Half Past', icon: '🌙', generate: () => ({ h: rand(1, 12), m: pick([0, 30]) }) },
    { id: 3, name: '🌟 Quarter Hours', icon: '🌟', generate: () => ({ h: rand(1, 12), m: pick([0, 15, 30, 45]) }) },
    { id: 4, name: '🚀 Five Minutes', icon: '🚀', generate: () => ({ h: rand(1, 12), m: rand(0, 11) * 5 }) },
    { id: 5, name: '🏆 Clock Master', icon: '🏆', generate: () => ({ h: rand(1, 12), m: rand(0, 59) }) },
  ];

  const STORAGE_KEY = 'cq_progress_v1';

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
  let mascotHomeEl, mascotGameEl, mascotResultsEl, modalMascotEl, tutorialMascotEl;
  let idleTimer = null;
  let lastInteraction = Date.now();
  const IDLE_DELAY = 15000;

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (!p.tutorialsSeen) p.tutorialsSeen = {};
        if (!p.playerName) p.playerName = '';
        if (!p.activities) p.activities = {};
        if (typeof p.endlessBest !== 'number') p.endlessBest = 0;
        return p;
      }
    } catch (e) {}
    return {
      stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      unlocked: 1, lastLevel: 1,
      tutorialsSeen: {}, playerName: '',
      activities: {}, endlessBest: 0,
    };
  }
  function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }

  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function formatTime(h, m) { return `${h}:${m.toString().padStart(2, '0')}`; }

  // ===== Voice helpers =====
  function say(text, opts = {}) {
    const named = Phrases.withName(text, progress.playerName);
    setMascotSpeaking(true);
    return Voice.speak(named, opts).then(() => setMascotSpeaking(false));
  }
  function sayRaw(text, opts = {}) {
    setMascotSpeaking(true);
    return Voice.speak(text, opts).then(() => setMascotSpeaking(false));
  }
  function setMascotSpeaking(on) {
    [mascotHomeEl, mascotGameEl, mascotResultsEl, modalMascotEl, tutorialMascotEl].forEach(el => {
      if (!el) return;
      const svg = el.querySelector('.mascot') || el;
      if (on) svg.classList.add('speaking');
      else svg.classList.remove('speaking');
    });
  }

  function generateDistractors(correct, levelId) {
    const distractors = new Set();
    const correctKey = formatTime(correct.h, correct.m);
    let attempts = 0;
    while (distractors.size < 3 && attempts < 50) {
      attempts++;
      let candidate;
      const strategy = rand(1, 4);
      if (strategy === 1) {
        const h = ((correct.h - 1 + (Math.random() < 0.5 ? 1 : -1) + 12) % 12) + 1;
        candidate = { h, m: correct.m };
      } else if (strategy === 2) {
        candidate = { h: correct.h, m: LEVELS[levelId - 1].generate().m };
      } else if (strategy === 3) {
        const h = (correct.h % 12) + 1;
        candidate = { h, m: LEVELS[levelId - 1].generate().m };
      } else {
        candidate = LEVELS[levelId - 1].generate();
      }
      const key = formatTime(candidate.h, candidate.m);
      if (key !== correctKey) distractors.add(key);
    }
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

  // Transition wrapper — wipe before swapping screens. origin: pointer event or element.
  function transitionTo(id, origin, tone) {
    if (typeof Transitions === 'undefined') { showScreen(id); return; }
    let pt = null;
    if (origin) {
      if (origin.clientX != null) pt = { x: origin.clientX, y: origin.clientY };
      else if (origin.getBoundingClientRect) {
        const r = origin.getBoundingClientRect();
        pt = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    if (origin && origin.getBoundingClientRect) Transitions.tapBurst(origin);
    Transitions.wipe(() => showScreen(id), { origin: pt, tone: tone || 'gold' });
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
        card.addEventListener('click', (e) => {
          if (typeof Transitions !== 'undefined') Transitions.pulse(card);
          setTimeout(() => startLevel(lvl.id, e), 180);
        });
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startLevel(lvl.id, card); }
        });
      }
      grid.appendChild(card);
    });

    const playBtn = document.getElementById('playBtn');
    const lastLvl = LEVELS.find(l => l.id === progress.lastLevel) || LEVELS[0];
    playBtn.textContent = `▶ Play ${lastLvl.name}`;

    // Personalised tagline
    if (progress.playerName) {
      document.getElementById('tagline').textContent =
        `Welcome back, ${progress.playerName}! Ready to learn?`;
    }

    renderActivityGrid();
  }

  // ===== ACTIVITY LIBRARY =====
  function renderActivityGrid() {
    const grid = document.getElementById('activityGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Activities.list.forEach(a => {
      const tile = document.createElement('div');
      tile.className = 'activity-tile';
      tile.setAttribute('role', 'listitem');
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('aria-label', `${a.name}: ${a.blurb}`);
      tile.innerHTML = `
        <span class="act-icon">${a.icon}</span>
        <div class="act-name">${a.name}</div>
        <div class="act-blurb">${a.blurb}</div>
      `;
      tile.addEventListener('click', (e) => {
        if (typeof Transitions !== 'undefined') Transitions.pulse(tile);
        setTimeout(() => openModePicker(a, e), 160);
      });
      tile.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModePicker(a, tile); }
      });
      grid.appendChild(tile);
    });
  }

  // ===== MODE PICKER =====
  const MODES = [
    { id: 'practice', name: 'Practice', icon: '🧘', sub: 'No pressure', blurb: 'Untimed, with hints. Play as long as you like.' },
    { id: 'quiz', name: 'Quiz', icon: '🎯', sub: '10 questions', blurb: 'Ten questions, earn stars.' },
    { id: 'timed', name: 'Timed', icon: '⏱️', sub: '60 seconds', blurb: 'Beat the clock — answer as many as you can in 60s.' },
    { id: 'memorize', name: 'Memorize', icon: '🧠', sub: 'Flash & recall', blurb: 'The clock flashes then hides. Answer from memory!' },
    { id: 'sandbox', name: 'Sandbox', icon: '🎨', sub: 'Free play', blurb: 'No score, just play.' },
  ];

  let pickerCtx = null;
  function openModePicker(activity, origin) {
    pickerCtx = { activity, levelId: progress.lastLevel || 1, modeId: 'quiz', origin };
    const modal = document.getElementById('modePickerModal');
    document.getElementById('modePickerTitle').textContent = `${activity.icon}  ${activity.name}`;
    document.getElementById('modePickerBlurb').textContent = activity.blurb;

    // Level pills
    const levelRow = document.getElementById('modeLevelRow');
    levelRow.innerHTML = '';
    [1, 2, 3, 4, 5].forEach(lvl => {
      const allowed = activity.supports.levels.includes(lvl);
      const pill = document.createElement('button');
      pill.className = 'mode-pill' + (lvl === pickerCtx.levelId && allowed ? ' selected' : '');
      pill.textContent = `Level ${lvl}`;
      if (!allowed) pill.disabled = true;
      pill.addEventListener('click', () => {
        if (!allowed) return;
        pickerCtx.levelId = lvl;
        levelRow.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
      });
      levelRow.appendChild(pill);
    });
    // Ensure default selected level is actually allowed
    if (!activity.supports.levels.includes(pickerCtx.levelId)) {
      pickerCtx.levelId = activity.supports.levels[0];
      levelRow.querySelectorAll('.mode-pill').forEach((p, i) => {
        p.classList.toggle('selected', !p.disabled && Number(p.textContent.replace('Level ', '')) === pickerCtx.levelId);
      });
    }

    // Mode pills
    const modeRow = document.getElementById('modeChoices');
    modeRow.innerHTML = '';
    MODES.forEach(m => {
      if (!activity.supports.modes.includes(m.id)) return;
      const pill = document.createElement('button');
      pill.className = 'mode-pill' + (m.id === pickerCtx.modeId ? ' selected' : '');
      pill.innerHTML = `<span class="mp-icon">${m.icon}</span>${m.name}<span class="mp-sub">${m.sub}</span>`;
      pill.title = m.blurb;
      pill.addEventListener('click', () => {
        pickerCtx.modeId = m.id;
        modeRow.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
      });
      modeRow.appendChild(pill);
    });
    if (!activity.supports.modes.includes(pickerCtx.modeId)) {
      pickerCtx.modeId = activity.supports.modes[0];
      const first = modeRow.querySelector('.mode-pill');
      if (first) first.classList.add('selected');
    }

    modal.hidden = false;
    // Cascade in the level + mode pills
    if (typeof Transitions !== 'undefined') {
      requestAnimationFrame(() => {
        Transitions.cascade(levelRow, '.mode-pill');
        Transitions.cascade(modeRow, '.mode-pill');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const cancel = document.getElementById('modePickerCancel');
    const start = document.getElementById('modePickerStart');
    if (cancel) cancel.addEventListener('click', () => {
      document.getElementById('modePickerModal').hidden = true;
    });
    if (start) start.addEventListener('click', (e) => {
      const origin = pickerCtx && pickerCtx.origin ? pickerCtx.origin : e.currentTarget;
      document.getElementById('modePickerModal').hidden = true;
      if (pickerCtx) startActivity(pickerCtx.activity.id, pickerCtx.modeId, pickerCtx.levelId, origin);
    });
  });

  // ===== ACTIVITY RUNTIME =====
  // Mode loop: runs activity.run() repeatedly under the rules of the chosen mode.
  let activityState = null;

  function buildActivityCtx(activity, levelId, modeId) {
    const promptEl = document.querySelector('#screen-game .question');
    const bodyEl = document.getElementById('answers');
    const clockWrap = document.querySelector('#screen-game .clock-wrap');
    const holdHint = document.querySelector('#screen-game .hold-hint');
    promptEl.classList.add('activity-prompt');
    holdHint && holdHint.classList.add('hidden');
    // Neutralise the classic .answers grid so activities can lay themselves out freely.
    // fourChoice() opts back into 2-col grid via .four-choice wrapper.
    bodyEl.classList.add('activity-host');

    return {
      activityId: activity.id,
      levelId, modeId,
      body: bodyEl,

      setPrompt(html) { promptEl.innerHTML = html; },
      say(text, opts) { return sayRaw(Phrases.withName(text, progress.playerName), opts); },
      sayTimeWords(h, m, opts) { return sayRaw(Voice.timeToWords(h, m), opts); },

      showClock(time) {
        clockWrap.classList.remove('hidden');
        if (!clockWrap.dataset.built) {
          Clock.build(document.getElementById('clock'));
          clockWrap.dataset.built = '1';
        }
        if (time) Clock.setTime(time.h, time.m);
      },
      hideClock() { clockWrap.classList.add('hidden'); },

      // Flash a clock briefly then hide for "memorize" mode
      flashClock(time, ms) {
        return new Promise((resolve) => {
          this.showClock(time);
          this.say('Look carefully…', { interrupt: true });
          setTimeout(() => {
            this.hideClock();
            this.say('What time was it?');
            resolve();
          }, ms || 2200);
        });
      },

      celebrate() {
        Audio.correct();
        Mascot.setMood(mascotGameEl, 'excited');
        mascotGameEl.classList.add('celebrate');
        setTimeout(() => mascotGameEl.classList.remove('celebrate'), 700);
        const r = mascotGameEl.getBoundingClientRect();
        Confetti.burst(window.innerWidth / 2, window.innerHeight / 3, 70);
      },

      fail(correctPhrase) {
        Audio.wrong();
        Mascot.setMood(mascotGameEl, 'sad');
        const clockEl = document.getElementById('clock');
        clockEl.classList.add('shake');
        setTimeout(() => clockEl.classList.remove('shake'), 500);
        setTimeout(() => Mascot.setMood(mascotGameEl, 'happy'), 1200);
      },

      // Voice + min delay between questions
      afterAnswer(correct) {
        const phrase = correct
          ? (Phrases.streak(activityState ? activityState.streak + 1 : 1) || Phrases.correct())
          : Phrases.wrong('')
              .replace(/\s*(It was|The clock said|it was)\s*\.\s*/g, '')
              .replace(/\s+\./g, '.')
              .trim() || "Not quite — try again!";
        const named = Phrases.withName(phrase, progress.playerName);
        const voiceP = sayRaw(named, { pitch: correct ? 1.15 : 0.95, interrupt: true });
        return new Promise(resolve => waitForVoiceThen(voiceP, correct ? 800 : 1200, resolve));
      },
    };
  }

  function startActivity(activityId, modeId, levelId, origin) {
    const activity = Activities.get(activityId);
    if (!activity) return;

    activityState = {
      activity, modeId, levelId,
      questionIdx: 0, correctCount: 0, streak: 0, score: 0,
      lives: 3, timerEnd: 0, totalQuestions: 10,
      stopped: false,
    };
    progress.lastLevel = levelId;
    saveProgress();

    // Wire game screen
    document.getElementById('levelName').textContent = `${activity.icon} ${activity.name}`;
    document.getElementById('score').textContent = '0';
    document.getElementById('streakBadge').hidden = true;
    document.getElementById('qNum').textContent = '1';

    // Show or hide quiz counter / timer based on mode
    const stats = document.querySelector('#screen-game .topbar-stats');
    setupModeHud(stats, modeId);

    // Pre-build clock; activities can hide it
    const clockWrap = document.querySelector('#screen-game .clock-wrap');
    clockWrap.classList.remove('hidden');
    clockWrap.dataset.built = '';
    transitionTo('game', origin, 'teal');
    Mascot.setMood(mascotGameEl, 'happy');

    const greet = Phrases.newRound();
    sayRaw(Phrases.withName(greet, progress.playerName));

    setTimeout(() => runModeLoop(activity, modeId, levelId), 800);
  }

  function setupModeHud(stats, modeId) {
    // Remove any previous HUD
    stats.querySelectorAll('.mode-hud').forEach(n => n.remove());
    const hud = document.createElement('span');
    hud.className = 'mode-hud';

    if (modeId === 'quiz' || modeId === 'memorize') {
      // questions counter is already there (#qNum)
    } else if (modeId === 'practice') {
      // hide question counter
      const qStat = stats.querySelector('.stat[aria-label="Question number"]');
      if (qStat) qStat.style.visibility = 'hidden';
    } else if (modeId === 'timed') {
      const qStat = stats.querySelector('.stat[aria-label="Question number"]');
      if (qStat) qStat.style.visibility = 'hidden';
      const timer = document.createElement('span');
      timer.className = 'timer-pill';
      timer.id = 'modeTimer';
      timer.textContent = '60s';
      hud.appendChild(timer);
    } else if (modeId === 'endless') {
      const lives = document.createElement('span');
      lives.className = 'lives-pill';
      lives.id = 'modeLives';
      lives.textContent = '❤️❤️❤️';
      hud.appendChild(lives);
    }
    if (hud.children.length) stats.appendChild(hud);
  }

  async function runModeLoop(activity, modeId, levelId) {
    const ctx = buildActivityCtx(activity, levelId, modeId);

    if (modeId === 'sandbox') {
      await activity.run(ctx);
      backToHome();
      return;
    }

    if (modeId === 'timed') {
      const DURATION = 60_000;
      activityState.timerEnd = Date.now() + DURATION;
      const timerEl = document.getElementById('modeTimer');
      const ticker = setInterval(() => {
        const rem = Math.max(0, activityState.timerEnd - Date.now());
        timerEl.textContent = `${Math.ceil(rem / 1000)}s`;
        if (rem < 10_000) timerEl.classList.add('warn');
        if (rem === 0) {
          clearInterval(ticker);
          activityState.stopped = true;
        }
      }, 250);

      while (!activityState.stopped && Date.now() < activityState.timerEnd) {
        const result = await activity.run(ctx);
        if (activityState.stopped) break;
        recordAnswer(result.correct);
      }
      clearInterval(ticker);
      endRoundFor(activity, modeId, levelId);
      return;
    }

    if (modeId === 'practice') {
      // run forever; the back button exits via backToHome
      activityState.totalQuestions = Infinity;
      while (!activityState.stopped) {
        const result = await activity.run(ctx);
        if (activityState.stopped) break;
        recordAnswer(result.correct);
      }
      return;
    }

    // Default: quiz / memorize — 10 questions
    activityState.totalQuestions = 10;
    while (!activityState.stopped && activityState.questionIdx < activityState.totalQuestions) {
      document.getElementById('qNum').textContent = activityState.questionIdx + 1;
      const result = await activity.run(ctx);
      if (activityState.stopped) break;
      recordAnswer(result.correct);
    }
    endRoundFor(activity, modeId, levelId);
  }

  function recordAnswer(correct) {
    activityState.questionIdx++;
    if (correct) {
      activityState.correctCount++;
      activityState.streak++;
      let pts = 10;
      if (activityState.streak >= 5) pts = 20;
      else if (activityState.streak >= 3) pts = 15;
      activityState.score += pts;
      document.getElementById('score').textContent = activityState.score;
      const sb = document.getElementById('streakBadge');
      if (activityState.streak >= 3) {
        sb.hidden = false;
        document.getElementById('streakNum').textContent = activityState.streak;
        if ([3, 5, 7, 10].includes(activityState.streak)) Audio.sparkle();
      }
      // Timed mode: bonus seconds for streaks of 3
      if (activityState.modeId === 'timed' && activityState.streak >= 3 && activityState.streak % 3 === 0) {
        activityState.timerEnd += 3000;
        const t = document.getElementById('modeTimer');
        t && t.classList.add('warn');
        setTimeout(() => t && t.classList.remove('warn'), 800);
      }
    } else {
      activityState.streak = 0;
      document.getElementById('streakBadge').hidden = true;
    }
  }

  function endRoundFor(activity, modeId, levelId) {
    const correct = activityState.correctCount;
    const total = (modeId === 'timed') ? activityState.questionIdx : activityState.totalQuestions;
    let stars = 0;
    if (modeId === 'timed') {
      // Star thresholds for timed: 5/10/15+ correct in 60s
      if (correct >= 15) stars = 3;
      else if (correct >= 10) stars = 2;
      else if (correct >= 5) stars = 1;
    } else {
      if (correct >= total - 1) stars = 3;
      else if (correct >= Math.ceil(total * 0.6)) stars = 2;
      else if (correct >= Math.ceil(total * 0.3)) stars = 1;
    }

    // Save activity progress
    if (!progress.activities[activity.id]) progress.activities[activity.id] = { stars: {}, bestTimed: {}, lastMode: modeId };
    const a = progress.activities[activity.id];
    a.lastMode = modeId;
    if (modeId === 'timed') {
      const prev = a.bestTimed[levelId] || 0;
      if (correct > prev) a.bestTimed[levelId] = correct;
    } else {
      const prevStars = a.stars[levelId] || 0;
      a.stars[levelId] = Math.max(prevStars, stars);
    }
    // Legacy stars system still tracks the original Tell Time / level path:
    if (activity.id === 'tell-time' && (modeId === 'quiz' || modeId === 'memorize')) {
      const prev = progress.stars[levelId] || 0;
      progress.stars[levelId] = prev + stars;
      if (progress.stars[levelId] >= 5 && levelId < 5 && progress.unlocked < levelId + 1) {
        progress.unlocked = levelId + 1;
      }
    }
    saveProgress();

    showResults({ activity, modeId, levelId, correct, total, stars });
  }

  function showResults({ activity, modeId, levelId, correct, total, stars }) {
    let title = 'Great job!';
    let mood = 'happy';
    let spoken = '';

    if (modeId === 'timed') {
      title = `${correct} in 60s!`;
      mood = correct >= 10 ? 'excited' : 'happy';
      spoken = correct >= 10 ? `Wow! You got ${correct} answers in one minute!` : `You got ${correct}. Try again to beat it!`;
    } else if (stars === 3) {
      title = 'Amazing! ⭐⭐⭐'; mood = 'excited';
      spoken = `Amazing! You got ${correct} out of ${total}! Three stars!`;
    } else if (stars === 2) {
      title = 'Well done!'; mood = 'happy';
      spoken = `Well done! ${correct} out of ${total}. Two stars!`;
    } else if (stars === 1) {
      title = 'Good try!'; mood = 'happy';
      spoken = `Good try! ${correct} correct. One star!`;
    } else {
      title = 'Keep practising!'; mood = 'sad';
      spoken = Phrases.lowScore();
    }

    document.getElementById('resultsTitle').textContent = title;
    document.getElementById('finalScore').textContent = activityState.score;
    document.getElementById('finalCorrect').textContent = `${correct}`;
    const correctLine = document.querySelector('.results-correct');
    if (correctLine) correctLine.innerHTML = `<span id="finalCorrect">${correct}</span> ${modeId === 'timed' ? 'correct answers' : `out of ${total} correct`}`;

    const slots = document.querySelectorAll('.star-slot');
    slots.forEach(s => s.classList.remove('earned'));

    Mascot.setMood(mascotResultsEl, mood);
    document.getElementById('nextBtn').style.display = 'none';
    document.getElementById('unlockMsg').hidden = true;

    transitionTo('results', null, 'pink');

    slots.forEach((slot, i) => {
      if (i < stars) {
        setTimeout(() => {
          slot.classList.add('earned');
          Audio.tick();
        }, 400 + i * 350);
      }
    });

    if (stars > 0 || (modeId === 'timed' && correct >= 5)) {
      setTimeout(() => Audio.fanfare(), 400 + stars * 350);
      setTimeout(() => Confetti.burst(window.innerWidth / 2, window.innerHeight / 3, 120), 400 + stars * 350);
    }

    Voice.cancel();
    setTimeout(() => sayRaw(Phrases.withName(spoken, progress.playerName), { pitch: stars >= 2 ? 1.2 : 1.0 }), 600);

    // Wire results buttons to replay this activity
    const again = document.getElementById('againBtn');
    again.onclick = (e) => startActivity(activity.id, modeId, levelId, e);
    const home = document.getElementById('homeBtn');
    home.onclick = () => backToHome();
  }

  function backToHome() {
    if (activityState) activityState.stopped = true;
    Voice.cancel();
    clearIdleTimer();
    // Restore the question counter visibility
    const qStat = document.querySelector('#screen-game .stat[aria-label="Question number"]');
    if (qStat) qStat.style.visibility = '';
    renderHome();
    transitionTo('home', null, 'gold');
  }

  // ===== TUTORIAL =====
  function maybeShowTutorial(levelId, onComplete) {
    if (progress.tutorialsSeen[levelId]) { onComplete(); return; }
    const text = Tutorials[levelId];
    const title = LEVELS[levelId - 1].name;
    document.getElementById('tutorialTitle').textContent = title;
    document.getElementById('tutorialText').textContent = text;
    const overlay = document.getElementById('tutorialOverlay');
    overlay.hidden = false;
    Voice.cancel();
    sayRaw(text);

    document.getElementById('tutorialClose').onclick = () => {
      Voice.cancel();
      setMascotSpeaking(false);
      overlay.hidden = true;
      progress.tutorialsSeen[levelId] = true;
      saveProgress();
      onComplete();
    };
  }

  // ===== GAME =====
  function startLevel(levelId, origin) {
    state.currentLevel = levelId;
    state.questionIdx = 0;
    state.score = 0;
    state.correctCount = 0;
    state.streak = 0;
    state.answering = false;
    progress.lastLevel = levelId;
    saveProgress();

    // Restore classic-flow DOM state in case we were in an activity.
    const promptEl = document.querySelector('#screen-game .question');
    const holdHint = document.querySelector('#screen-game .hold-hint');
    const bodyEl = document.getElementById('answers');
    const clockWrap = document.querySelector('#screen-game .clock-wrap');
    promptEl && promptEl.classList.remove('activity-prompt');
    holdHint && holdHint.classList.remove('hidden');
    bodyEl && bodyEl.classList.remove('activity-host');
    clockWrap && clockWrap.classList.remove('hidden');
    promptEl && (promptEl.textContent = 'What time does the clock show?');

    document.getElementById('levelName').textContent = LEVELS[levelId - 1].name;
    document.getElementById('score').textContent = '0';
    document.getElementById('streakBadge').hidden = true;
    Clock.build(document.getElementById('clock'));
    transitionTo('game', origin, 'gold');
    Mascot.setMood(mascotGameEl, 'happy');

    maybeShowTutorial(levelId, () => {
      const greet = Phrases.newRound();
      sayRaw(Phrases.withName(greet, progress.playerName));
      setTimeout(() => nextQuestion(), 800);
    });
  }

  function nextQuestion() {
    if (state.questionIdx >= state.totalQuestions) return endRound();

    state.questionIdx++;
    document.getElementById('qNum').textContent = state.questionIdx;

    const lvl = LEVELS[state.currentLevel - 1];
    state.currentTime = lvl.generate();
    Clock.setTime(state.currentTime.h, state.currentTime.m);

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
      const ring = document.createElement('span');
      ring.className = 'hold-ring';
      btn.appendChild(ring);
      attachAnswerHandlers(btn, opt, correctStr);
      answersEl.appendChild(btn);
    });

    state.answering = true;

    // Speak question — queues after any in-flight praise so the previous
    // sentence isn't cut off. Small lead-in so the visual settles first.
    const questionText = state.questionIdx === state.totalQuestions
      ? Phrases.lastQuestion() + " What time is it?"
      : "What time is it?";
    setTimeout(() => sayRaw(questionText), 250);

    resetIdleTimer();
  }

  // ===== Answer hold-to-hear =====
  function attachAnswerHandlers(btn, opt, correctStr) {
    let holdTimer = null;
    let didHold = false;
    let pointerDown = false;

    const start = (e) => {
      if (!state.answering) return;
      pointerDown = true;
      didHold = false;
      btn.classList.add('holding');
      holdTimer = setTimeout(() => {
        didHold = true;
        const [hh, mm] = opt.split(':').map(Number);
        Voice.cancel();
        sayRaw(Voice.timeToWords(hh, mm, state.currentLevel), { interrupt: true });
      }, 400);
      resetIdleTimer();
    };
    const end = (e) => {
      if (!pointerDown) return;
      pointerDown = false;
      btn.classList.remove('holding');
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (!didHold) {
        // Treat as click
        handleAnswer(btn, opt, correctStr);
      }
    };
    const cancel = () => {
      pointerDown = false;
      btn.classList.remove('holding');
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    };

    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('pointercancel', cancel);
    // Hover tick — but stay silent while Hoot is speaking so we never compete with the voice
    btn.addEventListener('mouseenter', () => { if (!Voice.isSpeaking()) Audio.tick(); });
    // Prevent native click double-fire
    btn.addEventListener('click', e => e.preventDefault());
  }

  function handleAnswer(btn, chosen, correct) {
    if (!state.answering) return;
    state.answering = false;
    clearIdleTimer();
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
        if (state.streak === 3 || state.streak === 5 || state.streak === 7 || state.streak === 10) {
          Audio.sparkle();
        }
      }

      Audio.correct();
      Mascot.setMood(mascotGameEl, 'excited');
      mascotGameEl.classList.add('celebrate');
      setTimeout(() => mascotGameEl.classList.remove('celebrate'), 700);

      const rect = btn.getBoundingClientRect();
      Confetti.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, state.streak >= 5 ? 120 : 70);

      // Voice: praise + maybe streak shout. Interrupt any lingering idle nudge.
      const streakPhrase = Phrases.streak(state.streak);
      const voiceP = streakPhrase
        ? sayRaw(streakPhrase, { pitch: 1.3, rate: 1.1, interrupt: true })
        : sayRaw(Phrases.withName(Phrases.correct(), progress.playerName), { pitch: 1.15, interrupt: true });

      // Advance only after the praise has finished speaking (with a small floor
      // so the celebration doesn't feel rushed even on very short voice lines).
      waitForVoiceThen(voiceP, 900, () => nextQuestion());
    } else {
      btn.classList.add('wrong');
      allBtns.forEach(b => { if (b.textContent === correct) b.classList.add('correct'); });
      state.streak = 0;
      document.getElementById('streakBadge').hidden = true;
      Audio.wrong();
      Mascot.setMood(mascotGameEl, 'sad');

      const clockEl = document.getElementById('clock');
      clockEl.classList.add('shake');
      setTimeout(() => clockEl.classList.remove('shake'), 500);

      const [hh, mm] = correct.split(':').map(Number);
      const correctSpoken = Voice.timeToWords(hh, mm, state.currentLevel);
      const voiceP = sayRaw(Phrases.wrong(correctSpoken), { pitch: 0.95, rate: 0.95, interrupt: true });

      waitForVoiceThen(voiceP, 1400, () => {
        Mascot.setMood(mascotGameEl, 'happy');
        nextQuestion();
      });
    }
  }

  // Wait for the voice promise to settle AND a minimum visual delay, whichever is longer.
  // Capped so a misbehaving TTS engine can't stall the game indefinitely.
  function waitForVoiceThen(voicePromise, minDelay, fn) {
    const MAX_WAIT = 8000;
    const minP = new Promise(r => setTimeout(r, minDelay));
    const capP = new Promise(r => setTimeout(r, MAX_WAIT));
    Promise.race([Promise.all([voicePromise, minP]), capP]).then(fn);
  }

  // ===== Idle nudges =====
  function resetIdleTimer() {
    lastInteraction = Date.now();
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      if (state.answering) {
        document.getElementById('clock').classList.add('idle-nudge');
        setTimeout(() => document.getElementById('clock').classList.remove('idle-nudge'), 3000);
        sayRaw(Phrases.idle(), { pitch: 1.05, rate: 0.95 });
        // Schedule a second nudge
        idleTimer = setTimeout(() => {
          if (state.answering) sayRaw("Try a hint? Tap the lightbulb!", { pitch: 1.1 });
        }, 18000);
      }
    }, IDLE_DELAY);
  }
  function clearIdleTimer() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  // ===== Hint system =====
  function giveHint() {
    if (!state.answering) return;
    const { h, m } = state.currentTime;
    let hint;
    if (state.currentLevel === 1) {
      hint = `Look at the short hand. It's pointing at ${h}. So it's ${h} o'clock.`;
    } else if (m === 0) {
      hint = `The big hand is on the 12. That means it's exactly o'clock. The short hand points at ${h}.`;
    } else if (m === 15) {
      hint = `The big hand is on the 3. That's quarter past. The short hand is just past ${h}.`;
    } else if (m === 30) {
      hint = `The big hand is on the 6. That's half past. The short hand is between ${h} and ${h % 12 + 1}.`;
    } else if (m === 45) {
      const next = h === 12 ? 1 : h + 1;
      hint = `The big hand is on the 9. That's quarter to. It's almost ${next}.`;
    } else {
      hint = `Count the big hand by fives. It's ${m} minutes past ${h}.`;
    }
    Voice.cancel();
    sayRaw(hint, { rate: 0.9, pitch: 1.05 });
    resetIdleTimer();
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

    let title = 'Great job!';
    let mood = 'happy';
    let spoken = '';
    if (stars === 3) {
      title = 'Amazing! ⭐⭐⭐'; mood = 'excited';
      spoken = `Amazing! You got ${correct} out of 10! Three stars!`;
    } else if (stars === 2) {
      title = 'Well done!'; mood = 'happy';
      spoken = `Well done! ${correct} out of 10. Two stars!`;
    } else if (stars === 1) {
      title = 'Good try!'; mood = 'happy';
      spoken = `Good try! ${correct} correct. One star!`;
    } else {
      title = 'Keep practising!'; mood = 'sad';
      spoken = Phrases.lowScore();
    }

    document.getElementById('resultsTitle').textContent = title;
    document.getElementById('finalScore').textContent = state.score;
    document.getElementById('finalCorrect').textContent = correct;
    document.getElementById('unlockMsg').hidden = !unlocked;

    const slots = document.querySelectorAll('.star-slot');
    slots.forEach(s => s.classList.remove('earned'));

    Mascot.setMood(mascotResultsEl, mood);

    const nextBtn = document.getElementById('nextBtn');
    nextBtn.style.display = (state.currentLevel < 5 && progress.unlocked > state.currentLevel) ? '' : 'none';

    transitionTo('results', null, 'pink');

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

    // Voice
    Voice.cancel();
    setTimeout(() => {
      sayRaw(Phrases.withName(spoken, progress.playerName), { pitch: stars >= 2 ? 1.2 : 1.0 });
      if (unlocked) {
        setTimeout(() => {
          sayRaw(`You unlocked a new level! ${LEVELS[state.currentLevel].name.replace(/^[^\s]+\s/, '')}!`,
            { pitch: 1.25 });
        }, 2500);
      }
    }, 600 + stars * 350);
  }

  // ===== NAME MODAL =====
  function showNameModal(initial = true) {
    const modal = document.getElementById('nameModal');
    const input = document.getElementById('nameInput');
    input.value = progress.playerName || '';
    modal.hidden = false;
    setTimeout(() => input.focus(), 200);

    if (initial) {
      setTimeout(() => sayRaw("Hi there! I'm Professor Hoot. What's your name?", { pitch: 1.15 }), 400);
    }

    const close = (save) => {
      const newName = input.value.trim().slice(0, 20);
      if (save && newName) {
        progress.playerName = newName;
        saveProgress();
        sayRaw(`Nice to meet you, ${newName}!`, { pitch: 1.2 });
      } else if (save === false && initial) {
        sayRaw("No problem! Let's play.", { pitch: 1.15 });
      }
      modal.hidden = true;
      renderHome();
    };

    document.getElementById('nameSave').onclick = () => close(true);
    document.getElementById('nameSkip').onclick = () => close(false);
    input.onkeydown = (e) => { if (e.key === 'Enter') close(true); };
  }

  // ===== SETTINGS =====
  function buildSettings() {
    const sel = document.getElementById('voiceSelect');
    const badge = document.getElementById('voiceQualityBadge');
    const tip = document.getElementById('voiceTip');

    const QUALITY_LABEL = {
      premium: 'Premium', enhanced: 'Enhanced', neural: 'Neural',
      standard: 'Standard', basic: 'Basic',
    };

    const TIPS = {
      basic: `<strong>Tip:</strong> The current voice sounds robotic. Install a free <strong>Premium</strong> voice for a much more human result:
        <br>• <strong>Mac:</strong> System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → tick a "(Premium)" voice (Ava, Zoe, Samantha).
        <br>• <strong>Windows:</strong> Use Microsoft Edge — it has free neural voices (Aria, Jenny).`,
      standard: `<strong>Want better?</strong> Mac users can install free <strong>Premium</strong> voices (Ava, Zoe) under System Settings → Accessibility → Spoken Content. Edge users get free neural voices.`,
    };

    const updateBadgeAndTip = () => {
      const q = Voice.getQuality();
      badge.className = 'quality-badge ' + q;
      badge.textContent = QUALITY_LABEL[q] || '';
      const tipText = TIPS[q];
      if (tipText) { tip.innerHTML = tipText; tip.hidden = false; }
      else tip.hidden = true;
    };

    const updateVoiceList = () => {
      const voices = Voice.getVoices();
      sel.innerHTML = '';
      if (voices.length === 0) {
        sel.innerHTML = '<option>No voices available</option>';
        sel.disabled = true;
        return;
      }
      sel.disabled = false;
      voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        if (Voice.getSelected() && v.name === Voice.getSelected().name) opt.selected = true;
        sel.appendChild(opt);
      });
      updateBadgeAndTip();
    };
    updateVoiceList();
    Voice.onChange(updateVoiceList);

    sel.addEventListener('change', () => {
      Voice.setVoiceByName(sel.value);
      updateBadgeAndTip();
      sayRaw("Hi! How do I sound now?", { interrupt: true });
    });

    const rateSlider = document.getElementById('rateSlider');
    const rateVal = document.getElementById('rateVal');
    rateSlider.value = Voice.getRate();
    rateVal.textContent = parseFloat(rateSlider.value).toFixed(2) + '×';
    rateSlider.addEventListener('input', () => {
      Voice.setRate(parseFloat(rateSlider.value));
      rateVal.textContent = parseFloat(rateSlider.value).toFixed(2) + '×';
    });
    rateSlider.addEventListener('change', () => {
      sayRaw("How does this speed sound?", { interrupt: true });
    });

    const nameField = document.getElementById('nameField');
    nameField.value = progress.playerName || '';
    nameField.addEventListener('change', () => {
      progress.playerName = nameField.value.trim().slice(0, 20);
      saveProgress();
      renderHome();
    });

    document.getElementById('testVoice').addEventListener('click', () => {
      sayRaw("Hi! I'm Professor Hoot, your clock teacher. Let's learn together!", { interrupt: true });
    });

    document.getElementById('resetProgress').addEventListener('click', () => {
      if (confirm('Reset all stars, unlocked levels, and player name?')) {
        localStorage.removeItem(STORAGE_KEY);
        progress = loadProgress();
        renderHome();
        sayRaw("All progress reset. Fresh start!", { interrupt: true });
      }
    });

    document.getElementById('settingsClose').addEventListener('click', () => {
      document.getElementById('settingsModal').hidden = true;
      Voice.cancel();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      Voice.cancel();
      nameField.value = progress.playerName || '';
      rateSlider.value = Voice.getRate();
      rateVal.textContent = parseFloat(rateSlider.value).toFixed(2) + '×';
      updateVoiceList();
      document.getElementById('settingsModal').hidden = false;
    });
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

    modalMascotEl = Mascot.build();
    document.getElementById('modalMascot').appendChild(modalMascotEl);
    Mascot.setMood(modalMascotEl, 'excited');

    tutorialMascotEl = Mascot.build();
    document.getElementById('tutorialMascot').appendChild(tutorialMascotEl);
    Mascot.setMood(tutorialMascotEl, 'happy');

    renderHome();
    buildSettings();

    // Buttons
    document.getElementById('playBtn').addEventListener('click', (e) => {
      startLevel(progress.lastLevel || 1, e);
    });
    document.getElementById('backBtn').addEventListener('click', () => {
      Voice.cancel();
      clearIdleTimer();
      renderHome();
      transitionTo('home', null, 'gold');
    });
    document.getElementById('againBtn').addEventListener('click', (e) => startLevel(state.currentLevel, e));
    document.getElementById('nextBtn').addEventListener('click', (e) => {
      const next = Math.min(state.currentLevel + 1, 5);
      startLevel(next, e);
    });
    document.getElementById('homeBtn').addEventListener('click', () => {
      Voice.cancel();
      renderHome();
      transitionTo('home', null, 'gold');
    });
    document.getElementById('hintBtn').addEventListener('click', giveHint);
    document.getElementById('repeatBtn').addEventListener('click', () => {
      if (!state.answering) return;
      Voice.cancel();
      sayRaw("What time is it?", { interrupt: true });
    });

    // Sound effects mute
    const muteBtn = document.getElementById('muteBtn');
    function syncMute() {
      muteBtn.textContent = Audio.isMuted() ? '🔇' : '🔊';
      muteBtn.classList.toggle('off', Audio.isMuted());
      muteBtn.setAttribute('aria-label', Audio.isMuted() ? 'Unmute sound effects' : 'Mute sound effects');
    }
    syncMute();
    muteBtn.addEventListener('click', () => { Audio.toggleMute(); syncMute(); });

    // Voice mute
    const voiceBtn = document.getElementById('voiceBtn');
    function syncVoice() {
      voiceBtn.textContent = Voice.isMuted() ? '🤫' : '🗣️';
      voiceBtn.classList.toggle('off', Voice.isMuted());
      voiceBtn.setAttribute('aria-label', Voice.isMuted() ? 'Enable voice' : 'Mute voice');
    }
    syncVoice();
    voiceBtn.addEventListener('click', () => { Voice.toggleMute(); syncVoice(); });

    if (!Voice.isSupported()) {
      voiceBtn.disabled = true; voiceBtn.classList.add('off');
      voiceBtn.title = 'Voice not supported in this browser';
    }

    // First-time name prompt (after first user interaction so audio context can resume)
    if (!progress.playerName && !localStorage.getItem('cq_name_skipped')) {
      const onFirstClick = () => {
        setTimeout(() => showNameModal(true), 300);
        localStorage.setItem('cq_name_skipped', '1'); // only prompt once even if skipped
        document.removeEventListener('click', onFirstClick);
      };
      document.addEventListener('click', onFirstClick, { once: true });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { startLevel };
})();
