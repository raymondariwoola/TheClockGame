// Activity registry + implementations.
// Each activity is { id, name, icon, blurb, supports, run(ctx) }.
// ctx is provided by the mode loop in game.js and gives the activity
// a sandboxed DOM host plus shared helpers (voice, audio, fx).
//
// Each activity's run(ctx) presents ONE question and resolves with
// { correct: bool, time?: ms } when the player has answered.
// Modes wrap this in a loop (Quiz: 10 questions, Timed: 60s, etc).

const Activities = (() => {
  // ---------- shared helpers ----------
  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function fmtTime(h, m) { return `${h}:${m.toString().padStart(2, '0')}`; }

  // Generate a time according to a level (1=o'clock, 2=half past, ...)
  function genTime(levelId) {
    const h = rand(1, 12);
    if (levelId === 1) return { h, m: 0 };
    if (levelId === 2) return { h, m: pick([0, 30]) };
    if (levelId === 3) return { h, m: pick([0, 15, 30, 45]) };
    if (levelId === 4) return { h, m: rand(0, 11) * 5 };
    return { h, m: rand(0, 11) * 5 }; // Level 5: still 5-min ticks (school-level)
  }

  // ---------- shared UI: 4-choice picker ----------
  // Renders options as buttons. Resolves with chosen index.
  // opts: { onHover(idx), holdToHear(idx) }
  function fourChoice(host, options, correctIdx, opts = {}) {
    return new Promise((resolve) => {
      host.innerHTML = '';
      const wrap = el('div', 'four-choice');
      options.forEach((label, i) => {
        const btn = el('button', 'choice-btn');
        btn.textContent = label;
        btn.setAttribute('aria-label', `Answer: ${String(label).replace(':', ' ')}`);
        const ring = el('span', 'hold-ring'); btn.appendChild(ring);

        let holdTimer = null, didHold = false, pdown = false;
        btn.addEventListener('pointerdown', () => {
          if (btn.disabled) return;
          pdown = true; didHold = false; btn.classList.add('holding');
          holdTimer = setTimeout(() => { didHold = true; opts.holdToHear && opts.holdToHear(i); }, 400);
        });
        const endPress = () => {
          if (!pdown) return; pdown = false; btn.classList.remove('holding');
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
          if (!didHold) finish(i, btn);
        };
        btn.addEventListener('pointerup', endPress);
        btn.addEventListener('pointerleave', () => {
          pdown = false; btn.classList.remove('holding');
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        });
        btn.addEventListener('pointercancel', () => { pdown = false; btn.classList.remove('holding'); if (holdTimer) clearTimeout(holdTimer); });
        btn.addEventListener('mouseenter', () => { opts.onHover && opts.onHover(i); });
        btn.addEventListener('click', e => e.preventDefault());

        wrap.appendChild(btn);
      });
      host.appendChild(wrap);

      function finish(chosen, btn) {
        const allBtns = wrap.querySelectorAll('.choice-btn');
        allBtns.forEach(b => b.disabled = true);
        const correct = chosen === correctIdx;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) allBtns[correctIdx].classList.add('correct');
        // small delay so visual confirmation lands
        setTimeout(() => resolve({ chosenIdx: chosen, correct, btn }), 350);
      }
    });
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  // Distractors: plausible-near-miss times for multiple choice
  function makeDistractors(correct, levelId, count = 3) {
    const seen = new Set([fmtTime(correct.h, correct.m)]);
    const out = [];
    let tries = 0;
    while (out.length < count && tries < 60) {
      tries++;
      const strat = rand(1, 4);
      let c;
      if (strat === 1) c = { h: ((correct.h - 1 + (Math.random() < 0.5 ? 1 : -1) + 12) % 12) + 1, m: correct.m };
      else if (strat === 2) c = { h: correct.h, m: genTime(levelId).m };
      else if (strat === 3) c = { h: (correct.h % 12) + 1, m: genTime(levelId).m };
      else c = genTime(levelId);
      const k = fmtTime(c.h, c.m);
      if (!seen.has(k)) { seen.add(k); out.push(c); }
    }
    while (out.length < count) {
      const c = genTime(levelId);
      const k = fmtTime(c.h, c.m);
      if (!seen.has(k)) { seen.add(k); out.push(c); }
    }
    return out;
  }

  // =========================================================
  // 1. TELL TIME — classic: read clock, pick the time
  // =========================================================
  const tellTime = {
    id: 'tell-time',
    name: 'Tell the Time',
    icon: '🕐',
    blurb: 'Look at the clock — pick the right time.',
    supports: { levels: [1, 2, 3, 4, 5], modes: ['practice', 'quiz', 'timed', 'memorize'] },
    run(ctx) {
      return new Promise(async (resolve) => {
        const t = genTime(ctx.levelId);
        const distractors = makeDistractors(t, ctx.levelId);
        const all = shuffle([t, ...distractors]);
        const labels = all.map(x => fmtTime(x.h, x.m));
        const correctIdx = all.findIndex(x => x.h === t.h && x.m === t.m);

        ctx.showClock(t);
        ctx.setPrompt('What time is it?');

        // Memorize mode: flash then hide
        if (ctx.modeId === 'memorize') {
          await ctx.flashClock(t, 2200);
        } else {
          ctx.say('What time is it?');
        }

        const onHover = (i) => { if (!Voice.isSpeaking()) Audio.tick(); };
        const holdToHear = (i) => {
          const [hh, mm] = labels[i].split(':').map(Number);
          ctx.sayTimeWords(hh, mm, { interrupt: true });
        };

        const { correct } = await fourChoice(ctx.body, labels, correctIdx, { onHover, holdToHear });
        if (correct) ctx.celebrate();
        else ctx.fail(Voice.timeToWords(t.h, t.m));
        await ctx.afterAnswer(correct);
        resolve({ correct });
      });
    },
  };

  // =========================================================
  // 2. WORD-TIME — read clock, pick the WRITTEN phrase
  // (e.g. "quarter past four")
  // =========================================================
  const wordTime = {
    id: 'word-time',
    name: 'Read the Time',
    icon: '📖',
    blurb: 'Match the clock to the right words.',
    supports: { levels: [1, 2, 3, 4], modes: ['practice', 'quiz', 'timed'] },
    run(ctx) {
      return new Promise(async (resolve) => {
        const t = genTime(ctx.levelId);
        const distractors = makeDistractors(t, ctx.levelId);
        const all = shuffle([t, ...distractors]);
        const labels = all.map(x => Voice.timeToWords(x.h, x.m));
        const correctIdx = all.findIndex(x => x.h === t.h && x.m === t.m);

        ctx.showClock(t);
        ctx.setPrompt('What time does the clock show?');
        ctx.say('What time does the clock show?');

        const { correct } = await fourChoice(ctx.body, labels, correctIdx, {
          holdToHear: (i) => ctx.say(labels[i], { interrupt: true }),
        });
        if (correct) ctx.celebrate(); else ctx.fail(Voice.timeToWords(t.h, t.m));
        await ctx.afterAnswer(correct);
        resolve({ correct });
      });
    },
  };

  // =========================================================
  // 3. DRAW HANDS — drag the hands onto a blank clock
  // =========================================================
  const drawHands = {
    id: 'draw-hands',
    name: 'Draw the Hands',
    icon: '✏️',
    blurb: 'Drag the hands to show the time.',
    supports: { levels: [1, 2, 3, 4], modes: ['practice', 'quiz', 'timed'] },
    run(ctx) {
      return new Promise(async (resolve) => {
        const t = genTime(ctx.levelId);
        const phrase = Voice.timeToWords(t.h, t.m);
        ctx.setPrompt(`Show me <strong>${phrase}</strong>`);
        ctx.say(`Can you show me ${phrase}?`);

        // Start clock at 12:00 and make it interactive
        ctx.showClock({ h: 12, m: 0 });
        Clock.setInteractive({ snapMinutes: 5, onChange: () => { /* live readout if we want */ } });

        // Action bar: Check / Hint buttons
        ctx.body.innerHTML = '';
        const bar = el('div', 'action-bar');
        const check = el('button', 'btn btn-play', '✓ Check');
        const hint = el('button', 'btn-icon hint-btn', '💡');
        hint.title = 'Hint';
        bar.appendChild(check); bar.appendChild(hint);
        ctx.body.appendChild(bar);

        const readout = el('div', 'time-readout');
        ctx.body.appendChild(readout);
        const refresh = () => {
          const t2 = Clock.getTime();
          readout.textContent = `Your clock: ${Voice.timeToWords(t2.h, t2.m)}`;
        };
        Clock.setInteractive({ snapMinutes: 5, onChange: refresh });
        refresh();

        hint.addEventListener('click', () => {
          let msg;
          if (t.m === 0) msg = `Put the big hand on the 12, and the small hand on the ${t.h}.`;
          else if (t.m === 15) msg = `Big hand on the 3 for quarter past. Small hand just past ${t.h}.`;
          else if (t.m === 30) msg = `Big hand on the 6 for half past. Small hand between ${t.h} and ${t.h % 12 + 1}.`;
          else if (t.m === 45) msg = `Big hand on the 9 for quarter to. Small hand near ${t.h % 12 + 1}.`;
          else if (t.m < 30) msg = `Big hand on the ${t.m / 5}. Small hand just past ${t.h}.`;
          else msg = `Big hand on the ${t.m / 5}. Small hand near ${t.h % 12 + 1}.`;
          ctx.say(msg, { interrupt: true });
        });

        check.addEventListener('click', () => {
          const placed = Clock.getTime();
          const correct = placed.h === t.h && placed.m === t.m;
          check.disabled = true;
          if (correct) ctx.celebrate();
          else ctx.fail(phrase);
          ctx.afterAnswer(correct).then(() => resolve({ correct }));
        });
      });
    },
  };

  // =========================================================
  // 4. TICK THE CLOCK — pick the mini-clock that matches the prompt
  // =========================================================
  const tickClock = {
    id: 'tick-clock',
    name: 'Tick the Clock',
    icon: '✅',
    blurb: 'Which clock shows the time?',
    supports: { levels: [1, 2, 3, 4], modes: ['practice', 'quiz', 'timed'] },
    run(ctx) {
      return new Promise(async (resolve) => {
        const t = genTime(ctx.levelId);
        const distractors = makeDistractors(t, ctx.levelId, 3);
        const all = shuffle([t, ...distractors]);
        const correctIdx = all.findIndex(x => x.h === t.h && x.m === t.m);
        const phrase = Voice.timeToWords(t.h, t.m);

        ctx.hideClock();
        ctx.setPrompt(`Tick the clock showing <strong>${phrase}</strong>`);
        ctx.say(`Find the clock showing ${phrase}.`);

        ctx.body.innerHTML = '';
        const grid = el('div', 'clock-grid');
        const cards = all.map((time, i) => {
          const card = el('button', 'clock-card');
          card.appendChild(Clock.miniClock(time.h, time.m, 140));
          const tick = el('div', 'tick-mark', '✓');
          card.appendChild(tick);
          card.setAttribute('aria-label', `Clock ${i + 1}`);
          grid.appendChild(card);
          return card;
        });
        ctx.body.appendChild(grid);

        cards.forEach((card, i) => {
          card.addEventListener('click', () => {
            cards.forEach(c => c.disabled = true);
            const correct = i === correctIdx;
            card.classList.add(correct ? 'correct' : 'wrong');
            if (!correct) cards[correctIdx].classList.add('correct');
            if (correct) ctx.celebrate(); else ctx.fail(phrase);
            ctx.afterAnswer(correct).then(() => resolve({ correct }));
          });
        });
      });
    },
  };

  // =========================================================
  // 5. MATCH-UP — drag time labels to clocks
  // =========================================================
  const matchUp = {
    id: 'match-up',
    name: 'Match Up',
    icon: '🔗',
    blurb: 'Match each clock to its time.',
    supports: { levels: [2, 3, 4], modes: ['practice', 'quiz'] },
    run(ctx) {
      return new Promise((resolve) => {
        const times = [];
        const seen = new Set();
        while (times.length < 4) {
          const t = genTime(ctx.levelId);
          const k = fmtTime(t.h, t.m);
          if (!seen.has(k)) { seen.add(k); times.push(t); }
        }
        const labelOrder = shuffle([...times]);

        ctx.hideClock();
        ctx.setPrompt('Drag each label onto the matching clock.');
        ctx.say('Drag each time onto the matching clock.');

        ctx.body.innerHTML = '';
        const board = el('div', 'matchup-board');

        // Left column: 4 clocks (drop targets)
        const left = el('div', 'matchup-clocks');
        const clockSlots = times.map((t, i) => {
          const slot = el('div', 'matchup-slot');
          slot.dataset.key = fmtTime(t.h, t.m);
          slot.appendChild(Clock.miniClock(t.h, t.m, 120));
          const tag = el('div', 'matchup-result'); slot.appendChild(tag);
          left.appendChild(slot);
          return slot;
        });
        board.appendChild(left);

        // Right column: 4 draggable labels
        const right = el('div', 'matchup-labels');
        const labels = labelOrder.map((t, i) => {
          const lab = el('div', 'matchup-label');
          lab.textContent = Voice.timeToWords(t.h, t.m);
          lab.dataset.key = fmtTime(t.h, t.m);
          right.appendChild(lab);
          return lab;
        });
        board.appendChild(right);
        ctx.body.appendChild(board);

        let placed = 0;
        let mistakes = 0;
        labels.forEach(lab => {
          let original = null;
          DragDrop.makeDraggable(lab, {
            getTargets: () => clockSlots.filter(s => !s.dataset.taken),
            onDragStart: () => { original = lab.getBoundingClientRect(); },
            onDrop: (target) => {
              if (!target) return;
              const correct = target.dataset.key === lab.dataset.key;
              if (correct) {
                target.dataset.taken = '1';
                target.querySelector('.matchup-result').textContent = lab.textContent;
                target.classList.add('correct');
                lab.style.visibility = 'hidden';
                Audio.correct();
                placed++;
                if (placed === 4) {
                  setTimeout(() => {
                    if (mistakes === 0) { ctx.celebrate(); ctx.say('Perfect match!'); }
                    else ctx.say('All matched!');
                    ctx.afterAnswer(mistakes === 0).then(() => resolve({ correct: mistakes === 0 }));
                  }, 400);
                }
              } else {
                Audio.wrong();
                mistakes++;
                target.classList.add('shake-once');
                setTimeout(() => target.classList.remove('shake-once'), 500);
              }
            },
          });
        });
      });
    },
  };

  // =========================================================
  // 6. ORDER DURATIONS — sort cards shortest → longest
  // =========================================================
  const DURATIONS = [
    { label: '5 minutes', mins: 5 },
    { label: '10 minutes', mins: 10 },
    { label: '15 minutes', mins: 15 },
    { label: '20 minutes', mins: 20 },
    { label: 'half an hour', mins: 30 },
    { label: '45 minutes', mins: 45 },
    { label: '50 minutes', mins: 50 },
    { label: 'one hour', mins: 60 },
    { label: '90 minutes', mins: 90 },
    { label: '2 hours', mins: 120 },
  ];
  const orderDurations = {
    id: 'order-durations',
    name: 'Order Durations',
    icon: '📏',
    blurb: 'Sort the times shortest to longest.',
    supports: { levels: [1, 2, 3, 4], modes: ['practice', 'quiz'] },
    run(ctx) {
      return new Promise((resolve) => {
        const four = shuffle([...DURATIONS]).slice(0, 4);
        const correct = [...four].sort((a, b) => a.mins - b.mins);
        const startOrder = shuffle([...four]);

        ctx.hideClock();
        ctx.setPrompt('Put these in order — <strong>shortest</strong> to <strong>longest</strong>.');
        ctx.say('Put these times in order from shortest to longest.');

        ctx.body.innerHTML = '';
        const list = el('div', 'order-list');
        const cards = startOrder.map((d) => {
          const c = el('div', 'order-card');
          c.dataset.mins = d.mins;
          c.innerHTML = `<span class="order-label">${d.label}</span><span class="order-grip">⋮⋮</span>`;
          list.appendChild(c);
          return c;
        });
        ctx.body.appendChild(list);

        // Simple touch reordering: tap a card, tap another to swap
        let selected = null;
        cards.forEach(c => {
          c.addEventListener('click', () => {
            if (!selected) { selected = c; c.classList.add('selected'); }
            else if (selected === c) { c.classList.remove('selected'); selected = null; }
            else {
              // swap DOM order
              const a = selected, b = c;
              const ap = a.nextSibling;
              if (ap === b) { list.insertBefore(b, a); }
              else {
                const bp = b.nextSibling;
                list.insertBefore(b, a);
                list.insertBefore(a, bp);
              }
              a.classList.remove('selected'); selected = null;
              Audio.tick();
            }
          });
        });

        const labels = el('div', 'order-ends');
        labels.innerHTML = '<span>↑ shortest</span><span>longest ↓</span>';
        ctx.body.insertBefore(labels, list);

        const bar = el('div', 'action-bar');
        const check = el('button', 'btn btn-play', '✓ Check Order');
        bar.appendChild(check);
        ctx.body.appendChild(bar);

        check.addEventListener('click', () => {
          const current = [...list.children].map(c => Number(c.dataset.mins));
          const ok = current.every((m, i) => m === correct[i].mins);
          check.disabled = true;
          [...list.children].forEach((c, i) => {
            c.classList.add(Number(c.dataset.mins) === correct[i].mins ? 'correct' : 'wrong');
          });
          if (ok) ctx.celebrate();
          else ctx.fail(`The order is ${correct.map(c => c.label).join(', then ')}.`);
          ctx.afterAnswer(ok).then(() => resolve({ correct: ok }));
        });
      });
    },
  };

  // =========================================================
  // 7. TIME FACTS — arithmetic about hours/minutes
  // =========================================================
  function buildFactsBank() {
    return [
      // minutes <-> hours
      () => ({ q: 'How many minutes in 1 hour?', a: 60 }),
      () => ({ q: 'How many minutes in half an hour?', a: 30 }),
      () => ({ q: 'How many minutes in a quarter of an hour?', a: 15 }),
      () => ({ q: 'How many minutes in 2 hours?', a: 120 }),
      () => ({ q: '1 hour and 30 minutes equals how many minutes?', a: 90 }),
      () => ({ q: '1 hour and 15 minutes equals how many minutes?', a: 75 }),
      () => ({ q: 'How many half-hours are in 2 hours?', a: 4 }),
      () => ({ q: 'How many quarter-hours are in 1 hour?', a: 4 }),
      () => { const n = rand(1, 6); return { q: `How many minutes in ${n} hours?`, a: n * 60 }; },
      () => { const n = rand(2, 6); return { q: `How many half-hours are in ${n} hours?`, a: n * 2 }; },
      () => { const n = rand(2, 4); return { q: `${n} hours and 30 minutes equals how many minutes?`, a: n * 60 + 30 }; },
    ];
  }
  const FACTS_BANK = buildFactsBank();

  const timeFacts = {
    id: 'time-facts',
    name: 'Time Facts',
    icon: '🧮',
    blurb: 'How many minutes? Quick maths!',
    supports: { levels: [1, 2, 3, 4], modes: ['practice', 'quiz', 'timed'] },
    run(ctx) {
      return new Promise(async (resolve) => {
        const { q, a } = pick(FACTS_BANK)();
        // Build 4 plausible choices around 'a'
        const opts = new Set([a]);
        while (opts.size < 4) {
          let cand;
          const r = rand(1, 3);
          if (r === 1) cand = a + (rand(0, 1) ? 15 : -15);
          else if (r === 2) cand = a + (rand(0, 1) ? 30 : -30);
          else cand = a + rand(-2, 2) * 5;
          if (cand > 0 && cand !== a) opts.add(cand);
        }
        const all = shuffle([...opts]);
        const correctIdx = all.indexOf(a);

        ctx.hideClock();
        ctx.setPrompt(q);
        ctx.say(q);

        const labels = all.map(x => String(x));
        const { correct } = await fourChoice(ctx.body, labels, correctIdx, {
          holdToHear: (i) => ctx.say(`${labels[i]}`, { interrupt: true }),
        });
        if (correct) ctx.celebrate(); else ctx.fail(`The answer is ${a}.`);
        await ctx.afterAnswer(correct);
        resolve({ correct });
      });
    },
  };

  // =========================================================
  // 8. WORD PROBLEMS — story → 4-choice
  // =========================================================
  const WORD_PROBLEMS = [
    () => ({ q: 'A machine makes one toy every minute. How many toys does it make in one hour?', a: 60 }),
    () => ({ q: 'A bus takes half an hour. How many minutes is that?', a: 30 }),
    () => ({ q: 'Sam reads for 15 minutes, then 15 more minutes. How many minutes did he read?', a: 30 }),
    () => ({ q: 'School starts at 9 o\'clock and ends at 3 o\'clock. How many hours is that?', a: 6 }),
    () => ({ q: 'It is half past 4. In half an hour, what time will it be?', a: '5 o\'clock', t: { h: 5, m: 0 } }),
    () => ({ q: 'It is 3 o\'clock. In one hour, what time will it be?', a: '4 o\'clock', t: { h: 4, m: 0 } }),
    () => ({ q: 'It is quarter past 2. In 15 minutes, what time will it be?', a: 'half past 2', t: { h: 2, m: 30 } }),
    () => ({ q: 'A film is 2 hours long. How many minutes is that?', a: 120 }),
    () => ({ q: 'How many minutes are between 4 o\'clock and quarter past 4?', a: 15 }),
    () => ({ q: 'How many minutes are between half past 3 and 4 o\'clock?', a: 30 }),
    () => { const n = rand(2, 5); return { q: `A timer rings every 10 minutes. How many times does it ring in ${n * 10} minutes?`, a: n }; },
    () => { const n = rand(2, 4); return { q: `Each lesson is 30 minutes. How long are ${n} lessons in minutes?`, a: n * 30 }; },
  ];

  const wordProblems = {
    id: 'word-problems',
    name: 'Story Problems',
    icon: '📚',
    blurb: 'Solve fun time stories.',
    supports: { levels: [2, 3, 4], modes: ['practice', 'quiz'] },
    run(ctx) {
      return new Promise(async (resolve) => {
        const p = pick(WORD_PROBLEMS)();
        const isTime = typeof p.a === 'string';
        let options, correctIdx;
        if (isTime) {
          // pick 3 distractor time phrases
          const distractors = new Set([p.a]);
          while (distractors.size < 4) {
            const tt = genTime(3);
            const phrase = Voice.timeToWords(tt.h, tt.m);
            if (!distractors.has(phrase)) distractors.add(phrase);
          }
          options = shuffle([...distractors]);
          correctIdx = options.indexOf(p.a);
        } else {
          const set = new Set([p.a]);
          while (set.size < 4) {
            const delta = pick([-30, -15, -10, -5, 5, 10, 15, 30]);
            const cand = p.a + delta;
            if (cand > 0 && !set.has(cand)) set.add(cand);
          }
          options = shuffle([...set]);
          correctIdx = options.indexOf(p.a);
        }

        ctx.hideClock();
        ctx.setPrompt(p.q);
        ctx.say(p.q);

        const labels = options.map(String);
        const { correct } = await fourChoice(ctx.body, labels, correctIdx, {
          holdToHear: (i) => ctx.say(labels[i], { interrupt: true }),
        });
        if (correct) ctx.celebrate(); else ctx.fail(`The answer is ${p.a}.`);
        await ctx.afterAnswer(correct);
        resolve({ correct });
      });
    },
  };

  // =========================================================
  // 9. TURNS & DIRECTION
  // =========================================================
  const TURN_QUESTIONS = [
    () => ({ q: 'Which way do clock hands move?', a: 'Clockwise', opts: ['Clockwise', 'Anticlockwise', 'Backwards', 'Side to side'] }),
    () => ({ q: 'How many degrees is a quarter turn?', a: '90°', opts: ['90°', '45°', '180°', '360°'] }),
    () => ({ q: 'How many degrees is a half turn?', a: '180°', opts: ['90°', '180°', '270°', '360°'] }),
    () => ({ q: 'A full turn brings you back to where you started. How many degrees?', a: '360°', opts: ['90°', '180°', '270°', '360°'] }),
    () => ({ q: 'You face North. Quarter turn clockwise — which way do you face now?', a: 'East', opts: ['North', 'East', 'South', 'West'] }),
    () => ({ q: 'You face North. Half turn — which way do you face?', a: 'South', opts: ['North', 'East', 'South', 'West'] }),
    () => ({ q: 'You face North. Quarter turn anticlockwise — which way?', a: 'West', opts: ['North', 'East', 'South', 'West'] }),
    () => ({ q: 'Three quarter turn clockwise from North?', a: 'West', opts: ['North', 'East', 'South', 'West'] }),
    () => ({ q: 'Is a quarter turn a small turn or a big turn?', a: 'Small turn', opts: ['Small turn', 'Big turn', 'Full turn', 'No turn'] }),
  ];

  const turns = {
    id: 'turns',
    name: 'Turns & Direction',
    icon: '🔄',
    blurb: 'Clockwise, quarter turns, and more.',
    supports: { levels: [1, 2, 3, 4], modes: ['practice', 'quiz', 'timed'] },
    run(ctx) {
      return new Promise(async (resolve) => {
        const q = pick(TURN_QUESTIONS)();
        const correctIdx = q.opts.indexOf(q.a);

        ctx.hideClock();
        ctx.setPrompt(q.q);
        ctx.say(q.q);

        const { correct } = await fourChoice(ctx.body, q.opts, correctIdx, {
          holdToHear: (i) => ctx.say(q.opts[i], { interrupt: true }),
        });
        if (correct) ctx.celebrate(); else ctx.fail(`The answer is ${q.a}.`);
        await ctx.afterAnswer(correct);
        resolve({ correct });
      });
    },
  };

  // =========================================================
  // 10. BUILD-A-CLOCK — sandbox, no scoring
  // =========================================================
  const buildClock = {
    id: 'build-clock',
    name: 'Build-a-Clock',
    icon: '🛠️',
    blurb: 'Free play — drag the hands anywhere!',
    supports: { levels: [1], modes: ['sandbox'] },
    run(ctx) {
      // Sandbox: never resolves until user exits. Mode loop handles exit.
      return new Promise((resolve) => {
        ctx.setPrompt('Drag the hands to set any time you like!');
        ctx.showClock({ h: 12, m: 0 });

        ctx.body.innerHTML = '';
        const readout = el('div', 'time-readout big');
        ctx.body.appendChild(readout);

        const bar = el('div', 'action-bar');
        const challengeBtn = el('button', 'btn btn-secondary', '🎯 Challenge Me');
        const sayBtn = el('button', 'btn btn-secondary', '🔊 Say the Time');
        const exitBtn = el('button', 'btn btn-play', '✓ Done');
        bar.appendChild(challengeBtn); bar.appendChild(sayBtn); bar.appendChild(exitBtn);
        ctx.body.appendChild(bar);

        const target = el('div', 'sandbox-target');
        ctx.body.appendChild(target);

        let challenge = null;
        const refresh = () => {
          const t = Clock.getTime();
          readout.textContent = Voice.timeToWords(t.h, t.m);
          if (challenge && t.h === challenge.h && t.m === challenge.m) {
            ctx.say('Yes! You got it!', { interrupt: true });
            Audio.sparkle();
            challenge = null;
            target.textContent = '';
          }
        };
        Clock.setInteractive({ snapMinutes: 5, onChange: refresh });
        refresh();

        challengeBtn.addEventListener('click', () => {
          const t = genTime(3);
          challenge = t;
          target.textContent = `Show me: ${Voice.timeToWords(t.h, t.m)}`;
          ctx.say(`Can you show me ${Voice.timeToWords(t.h, t.m)}?`, { interrupt: true });
        });
        sayBtn.addEventListener('click', () => {
          const t = Clock.getTime();
          ctx.say(Voice.timeToWords(t.h, t.m), { interrupt: true });
        });
        exitBtn.addEventListener('click', () => resolve({ correct: true, exit: true }));
      });
    },
  };

  // ---------- registry ----------
  const list = [tellTime, wordTime, drawHands, tickClock, matchUp, orderDurations, timeFacts, wordProblems, turns, buildClock];
  function get(id) { return list.find(a => a.id === id); }

  return { list, get, genTime, fmtTime };
})();
