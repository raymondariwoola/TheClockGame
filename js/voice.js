// Web Speech API wrapper - Professor Hoot's voice
// Optimised for the most human-sounding output the browser can give us
const Voice = (() => {
  const synth = window.speechSynthesis;
  const supported = !!synth;
  let voices = [];
  let selectedVoice = null;
  let voiceQuality = 'standard'; // 'premium' | 'enhanced' | 'neural' | 'standard' | 'basic'
  let muted = localStorage.getItem('cq_voice_muted') === '1';
  let rate = parseFloat(localStorage.getItem('cq_voice_rate') || '1.0');
  let savedVoiceName = localStorage.getItem('cq_voice_name') || null;
  const listeners = new Set();

  // Voices known to be high quality and friendly for kids (in roughly best-first order)
  const FRIENDLY_NAMES = [
    // macOS / iOS Siri-derived (best free TTS available anywhere)
    'Ava', 'Zoe', 'Allison', 'Susan', 'Samantha', 'Karen', 'Moira',
    'Tessa', 'Fiona', 'Serena', 'Kate', 'Martha', 'Nicky',
    // iOS Siri voice slots (newer iOS surfaces these names)
    'Siri Female', 'Siri Male', 'Siri Voice 1', 'Siri Voice 2',
    'Siri Voice 3', 'Siri Voice 4',
    // macOS / iOS male
    'Daniel', 'Oliver', 'Tom', 'Aaron', 'Arthur',
    // Microsoft Edge neural
    'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Libby', 'Microsoft Sonia',
    'Microsoft Michelle', 'Microsoft Ana',
    // Microsoft male neural
    'Microsoft Guy', 'Microsoft Ryan',
    // Chrome / Google (Android + desktop Chrome)
    'Google UK English Female', 'Google UK English Male',
    'Google US English', 'Google US English Female', 'Google US English Male',
    'Google australian english', 'Google english',
    // Samsung / Android TTS engines
    'Samsung English', 'English (United States)', 'English (United Kingdom)',
  ];

  // Voices to actively avoid (joke / novelty voices on macOS, robotic legacy)
  const AVOID = [
    'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
    'deranged', 'good news', 'hysterical', 'jester', 'organ', 'pipe organ',
    'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
    'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley',
    // older robotic ones
    'fred', 'ralph', 'junior', 'kathy', 'princess', 'vicki',
  ];

  function scoreVoice(v) {
    const n = v.name.toLowerCase();

    // Hard reject novelty/old
    if (AVOID.some(bad => n.includes(bad))) return -1000;

    let score = 0;

    // Quality tier markers (macOS / iOS / Edge expose these in the name)
    if (n.includes('(premium)') || n.includes(' premium')) score += 100;
    if (n.includes('(enhanced)') || n.includes(' enhanced')) score += 60;
    if (n.includes('(natural)') || n.includes('neural') || n.includes('online')) score += 70;
    if (n.includes('siri')) score += 80;
    // Google network voices on Android/Chrome are noticeably more natural than
    // the bundled "espeak"-style fallbacks
    if (n.startsWith('google ')) score += 25;
    // Samsung neural voices on modern Galaxy devices
    if (n.includes('samsung')) score += 15;

    // Local vs remote (local = no network needed, lower latency)
    if (v.localService) score += 5;

    // Prefer friendly named voices
    const friendlyIdx = FRIENDLY_NAMES.findIndex(name => v.name.includes(name));
    if (friendlyIdx >= 0) score += Math.max(0, 40 - friendlyIdx);

    // Slight preference for English (we already filter, but US/GB > others)
    if (v.lang === 'en-US' || v.lang === 'en-GB') score += 5;
    if (v.lang === 'en-AU' || v.lang === 'en-IE') score += 3;

    // Mild female preference for "professor" character (most kids' edu apps research)
    // — only as a tiebreaker, not exclusionary
    if (/female|samantha|karen|aria|jenny|zoe|ava|allison|moira|tessa|fiona|susan/i.test(v.name)) {
      score += 3;
    }

    return score;
  }

  function detectQuality(v) {
    if (!v) return 'none';
    const n = v.name.toLowerCase();
    if (n.includes('(premium)') || n.includes(' premium') || n.includes('siri')) return 'premium';
    if (n.includes('(enhanced)') || n.includes(' enhanced')) return 'enhanced';
    if (n.includes('(natural)') || n.includes('neural') || n.includes('online')) return 'neural';
    // Google network voices (Chrome/Android) — pretty good, treat as neural-ish
    if (n.startsWith('google ') && !v.localService) return 'neural';
    if (FRIENDLY_NAMES.some(name => v.name.includes(name))) return 'standard';
    return 'basic';
  }

  // Detect the platform so we can show targeted "install a better voice" tips.
  // Returns: 'ios' | 'android' | 'mac' | 'windows' | 'other'
  function detectPlatform() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const plat = (navigator.platform || '').toLowerCase();
    // iPadOS 13+ reports as Mac but has touch
    const isIPad = /ipad/.test(ua) || (plat === 'macintel' && (navigator.maxTouchPoints || 0) > 1);
    if (/iphone|ipod/.test(ua) || isIPad) return 'ios';
    if (/android/.test(ua)) return 'android';
    if (/mac/.test(plat) || /mac os x/.test(ua)) return 'mac';
    if (/win/.test(plat) || /windows/.test(ua)) return 'windows';
    return 'other';
  }

  function loadVoices() {
    if (!supported) return;
    voices = synth.getVoices()
      .filter(v => v.lang && v.lang.toLowerCase().startsWith('en'))
      .filter(v => scoreVoice(v) > -1000); // drop novelty voices

    if (voices.length === 0) {
      voices = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    }
    if (voices.length === 0) return;

    // Use saved choice if it still exists
    if (savedVoiceName) {
      const found = voices.find(v => v.name === savedVoiceName);
      if (found) { selectedVoice = found; voiceQuality = detectQuality(found); notify(); return; }
    }

    // Otherwise pick highest scored
    voices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    selectedVoice = voices[0];
    voiceQuality = detectQuality(selectedVoice);
    notify();
  }

  function notify() { listeners.forEach(fn => fn()); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  if (supported) {
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.addEventListener('voiceschanged', loadVoices);
    }
  }

  // ===== Prosody-aware speak =====
  // Splits text on sentence boundaries, speaks each as its own utterance
  // with tiny pauses and slight pitch contour for naturalness.
  let activeSpeech = Promise.resolve();

  function speak(text, opts = {}) {
    if (!supported || muted || !text) return Promise.resolve();
    if (opts.interrupt) synth.cancel();

    // Slight per-call pitch jitter so consecutive utterances don't sound identical
    const basePitch = opts.pitch ?? 1.05;
    const baseRate = opts.rate ?? rate;
    const jitter = (Math.random() - 0.5) * 0.06; // ±0.03
    const pitch = basePitch + jitter;

    // Split on sentence-ending punctuation, keeping the punctuation
    const chunks = chunkSentences(text);
    // Chain onto any in-flight speech so back-to-back calls queue naturally
    // unless the caller explicitly interrupted above.
    const prior = opts.interrupt ? Promise.resolve() : activeSpeech;
    const p = prior.then(() => chainChunks(chunks, pitch, baseRate, opts));
    activeSpeech = p.catch(() => {}); // never let a rejection break the chain
    return p;
  }

  function whenDone() { return activeSpeech; }
  function isSpeaking() { return !!(supported && (synth.speaking || synth.pending)); }

  function chunkSentences(text) {
    // Match a sentence then trailing punctuation. Keeps "Yes!" and "Really?" intact.
    const parts = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text];
    return parts.map(s => s.trim()).filter(Boolean);
  }

  function chainChunks(chunks, pitch, baseRate, opts) {
    return chunks.reduce((p, chunk, i) => {
      return p.then(() => {
        return speakOne(chunk, {
          ...opts,
          // Last chunk of a question lifts pitch slightly (natural intonation)
          pitch: pitch + (/[?]$/.test(chunk) ? 0.08 : 0) + (i > 0 ? -0.01 : 0),
          rate: baseRate * (chunk.length < 10 ? 0.95 : 1.0), // short exclamations slower
        });
      }).then(() => pause(i < chunks.length - 1 ? 90 : 0));
    }, Promise.resolve());
  }

  function pause(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function speakOne(text, opts = {}) {
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      if (selectedVoice) u.voice = selectedVoice;
      u.pitch = Math.max(0, Math.min(2, opts.pitch ?? 1.05));
      u.rate = Math.max(0.1, Math.min(2, opts.rate ?? rate));
      u.volume = opts.volume ?? 1;
      u.onend = resolve;
      u.onerror = resolve;
      // Tiny delay helps Chrome avoid swallowing utterances after cancel()
      setTimeout(() => synth.speak(u), 8);
    });
  }

  function cancel() { if (supported) synth.cancel(); }

  function setVoiceByName(name) {
    const found = voices.find(v => v.name === name);
    if (found) {
      selectedVoice = found;
      voiceQuality = detectQuality(found);
      savedVoiceName = name;
      localStorage.setItem('cq_voice_name', name);
      notify();
    }
  }

  function setRate(r) {
    rate = Math.max(0.6, Math.min(1.6, r));
    localStorage.setItem('cq_voice_rate', rate.toString());
  }

  function toggleMute() {
    muted = !muted;
    if (muted) cancel();
    localStorage.setItem('cq_voice_muted', muted ? '1' : '0');
    return muted;
  }

  // ===== Time-to-words (school-style English) =====
  // Matches the "Telling Time" chart Toby's school uses:
  // five past, ten past, quarter past, twenty past, twenty-five past, half past,
  // twenty-five to, twenty to, quarter to, ten to, five to.
  const FIVE_MIN_PHRASES = {
    0:  (h, n) => `${h} o'clock`,
    5:  (h, n) => `five past ${h}`,
    10: (h, n) => `ten past ${h}`,
    15: (h, n) => `quarter past ${h}`,
    20: (h, n) => `twenty past ${h}`,
    25: (h, n) => `twenty-five past ${h}`,
    30: (h, n) => `half past ${h}`,
    35: (h, n) => `twenty-five to ${n}`,
    40: (h, n) => `twenty to ${n}`,
    45: (h, n) => `quarter to ${n}`,
    50: (h, n) => `ten to ${n}`,
    55: (h, n) => `five to ${n}`,
  };

  function timeToWords(h, m, levelId = 5) {
    const next = h === 12 ? 1 : h + 1;
    const phraseFn = FIVE_MIN_PHRASES[m];
    if (phraseFn) return phraseFn(h, next);
    // Non-multiple of 5 (Level 5 only) — fall back to numeric phrasing
    if (m < 30) return `${m} minutes past ${h}`;
    return `${60 - m} minutes to ${next}`;
  }

  function getVoices() { return voices.slice(); }
  function getSelected() { return selectedVoice; }
  function getQuality() { return voiceQuality; }
  function isMuted() { return muted; }
  function getRate() { return rate; }
  function isSupported() { return supported; }

  return {
    speak, cancel, setVoiceByName, setRate, toggleMute,
    timeToWords, getVoices, getSelected, getQuality, isMuted, getRate,
    isSupported, onChange, whenDone, isSpeaking, detectPlatform,
  };
})();

// ===== Phrase banks - written with natural punctuation for prosody =====
const Phrases = (() => {
  // Using commas, em-dashes, and ellipses gives the TTS natural breathing points
  const correct = [
    "That's right!", "Brilliant!", "Wonderful, well done!",
    "Yes! You got it.", "Spot on!", "Amazing!",
    "Fantastic — keep going!", "Yes, correct!",
    "Wow, you're a clock wizard!", "Beautiful!", "Nailed it!",
    "Oh, perfect!", "Yes! That's the one.",
  ];
  const wrong = [
    "Oh no, not quite.", "So close!",
    "Hmm... try again next time.",
    "Almost! It was {correct}.",
    "Not this time. It was {correct}.",
    "Oops! The clock said {correct}.",
    "Close, but it was {correct}.",
  ];
  const streak3 = ["You're on fire!", "Three in a row!", "Ooh, you're heating up!"];
  const streak5 = ["Unstoppable!", "Five in a row — incredible!", "Wow, you're on a roll!"];
  const streak7 = ["Seven straight! Wow.", "Amazing streak!"];
  const streak10 = ["Legendary!", "Ten in a row — you're a clock master!"];
  const idle = [
    "Take your time...", "Look carefully at the hands.",
    "What does the short hand say?", "You can do it!",
    "Hmm, which one do you think?",
  ];
  const lastQuestion = ["Last one — make it count!", "Final question!"];
  const newRound = ["Let's play!", "Here we go!", "Get ready!", "Okay, ready?"];
  const lowScore = [
    "Don't worry — practice makes perfect!",
    "Try again, you've got this!",
    "That's okay, let's give it another go.",
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function withName(text, name) {
    if (!name) return text;
    if (Math.random() < 0.4) {
      if (Math.random() < 0.5) {
        return `${name}, ` + text.charAt(0).toLowerCase() + text.slice(1);
      }
      return text.replace(/[.!]$/, '') + `, ${name}!`;
    }
    return text;
  }

  return {
    correct: () => pick(correct),
    wrong: (c) => pick(wrong).replace('{correct}', c),
    streak: (n) => {
      if (n >= 10) return pick(streak10);
      if (n >= 7) return pick(streak7);
      if (n >= 5) return pick(streak5);
      if (n >= 3) return pick(streak3);
      return null;
    },
    idle: () => pick(idle),
    lastQuestion: () => pick(lastQuestion),
    newRound: () => pick(newRound),
    lowScore: () => pick(lowScore),
    withName,
  };
})();

// ===== Level tutorials - conversational with breathing pauses =====
const Tutorials = {
  1: "Okay! On this level, look at the short hand. Whichever number it points to — that's the hour. The big hand stays on twelve, so it's always exactly o'clock.",
  2: "Now the big hand can be on twelve, meaning o'clock... or on the six, which means half past. Half past means thirty minutes after the hour.",
  3: "When the big hand is on the three, it's quarter past. On the nine, it's quarter to the next hour. Look carefully!",
  4: "The big hand can now be on any five-minute mark. Each number on the clock counts five more minutes.",
  5: "Clock master mode! The big hand can point anywhere. Count the minutes by fives, then add the extra ticks.",
};
