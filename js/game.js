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
        return p;
      }
    } catch (e) {}
    return {
      stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      unlocked: 1, lastLevel: 1,
      tutorialsSeen: {}, playerName: '',
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

    const playBtn = document.getElementById('playBtn');
    const lastLvl = LEVELS.find(l => l.id === progress.lastLevel) || LEVELS[0];
    playBtn.textContent = `▶ Play ${lastLvl.name}`;

    // Personalised tagline
    if (progress.playerName) {
      document.getElementById('tagline').textContent =
        `Welcome back, ${progress.playerName}! Ready to learn?`;
    }
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

    // Speak question
    Voice.cancel();
    const questionText = state.questionIdx === state.totalQuestions
      ? Phrases.lastQuestion() + " What time is it?"
      : "What time is it?";
    setTimeout(() => sayRaw(questionText), 400);

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
    btn.addEventListener('mouseenter', () => Audio.tick());
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

      // Voice: praise + maybe streak shout
      Voice.cancel();
      const streakPhrase = Phrases.streak(state.streak);
      if (streakPhrase) {
        // Excited shout, then move on
        sayRaw(streakPhrase, { pitch: 1.3, rate: 1.1 });
      } else {
        sayRaw(Phrases.withName(Phrases.correct(), progress.playerName), { pitch: 1.15 });
      }

      setTimeout(() => nextQuestion(), 1400);
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

      Voice.cancel();
      const [hh, mm] = correct.split(':').map(Number);
      const correctSpoken = Voice.timeToWords(hh, mm, state.currentLevel);
      sayRaw(Phrases.wrong(correctSpoken), { pitch: 0.95, rate: 0.95 });

      setTimeout(() => {
        Mascot.setMood(mascotGameEl, 'happy');
        nextQuestion();
      }, 2400);
    }
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

    showScreen('results');

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
    document.getElementById('playBtn').addEventListener('click', () => {
      startLevel(progress.lastLevel || 1);
    });
    document.getElementById('backBtn').addEventListener('click', () => {
      Voice.cancel();
      clearIdleTimer();
      renderHome();
      showScreen('home');
    });
    document.getElementById('againBtn').addEventListener('click', () => startLevel(state.currentLevel));
    document.getElementById('nextBtn').addEventListener('click', () => {
      const next = Math.min(state.currentLevel + 1, 5);
      startLevel(next);
    });
    document.getElementById('homeBtn').addEventListener('click', () => {
      Voice.cancel();
      renderHome();
      showScreen('home');
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
