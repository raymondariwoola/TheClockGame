// Web Speech API wrapper - Professor Hoot's voice
const Voice = (() => {
  const synth = window.speechSynthesis;
  const supported = !!synth;
  let voices = [];
  let selectedVoice = null;
  let muted = localStorage.getItem('cq_voice_muted') === '1';
  let rate = parseFloat(localStorage.getItem('cq_voice_rate') || '1.0');
  let savedVoiceName = localStorage.getItem('cq_voice_name') || null;
  const listeners = new Set();

  // Preferred voices in order — these sound the friendliest for kids
  const PREFERRED = [
    'Samantha', 'Karen', 'Moira', 'Tessa', 'Daniel', 'Fiona', 'Allison',
    'Ava', 'Susan', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Libby',
    'Google UK English Female', 'Google US English',
  ];

  function loadVoices() {
    if (!supported) return;
    voices = synth.getVoices().filter(v => v.lang && v.lang.startsWith('en'));
    if (voices.length === 0) return;

    // Use saved choice if it still exists
    if (savedVoiceName) {
      const found = voices.find(v => v.name === savedVoiceName);
      if (found) { selectedVoice = found; notify(); return; }
    }

    // Otherwise pick best available preferred voice
    for (const name of PREFERRED) {
      const found = voices.find(v => v.name === name || v.name.includes(name));
      if (found) { selectedVoice = found; notify(); return; }
    }
    // Fallback: any local female-sounding voice, then first
    selectedVoice = voices.find(v => /female|woman/i.test(v.name)) || voices[0];
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

  function speak(text, opts = {}) {
    if (!supported || muted || !text) return Promise.resolve();
    const { interrupt = false, pitch = 1.1, rate: r = rate, volume = 1, onend } = opts;
    if (interrupt) synth.cancel();
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      if (selectedVoice) u.voice = selectedVoice;
      u.pitch = pitch;
      u.rate = r;
      u.volume = volume;
      u.onend = () => { if (onend) onend(); resolve(); };
      u.onerror = () => resolve();
      // Tiny delay helps Chrome avoid swallowing the first utterance
      setTimeout(() => synth.speak(u), 10);
    });
  }

  function cancel() { if (supported) synth.cancel(); }

  function setVoiceByName(name) {
    const found = voices.find(v => v.name === name);
    if (found) {
      selectedVoice = found;
      savedVoiceName = name;
      localStorage.setItem('cq_voice_name', name);
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

  // ===== Time-to-words =====
  // Speaks a time naturally based on the difficulty level
  function timeToWords(h, m, levelId = 5) {
    const hourWord = String(h);
    if (m === 0) return `${hourWord} o'clock`;
    if (m === 15) return `quarter past ${hourWord}`;
    if (m === 30) return `half past ${hourWord}`;
    if (m === 45) {
      const next = h === 12 ? 1 : h + 1;
      return `quarter to ${next}`;
    }
    // For five-minute and free intervals
    if (m < 30) {
      return `${m} minutes past ${hourWord}`;
    }
    const next = h === 12 ? 1 : h + 1;
    return `${60 - m} minutes to ${next}`;
  }

  function getVoices() { return voices.slice(); }
  function getSelected() { return selectedVoice; }
  function isMuted() { return muted; }
  function getRate() { return rate; }
  function isSupported() { return supported; }

  return {
    speak, cancel, setVoiceByName, setRate, toggleMute,
    timeToWords, getVoices, getSelected, isMuted, getRate,
    isSupported, onChange,
  };
})();

// ===== Phrase banks =====
const Phrases = (() => {
  const correct = [
    "That's right!", "Brilliant!", "Wonderful!", "You got it!",
    "Spot on!", "Amazing!", "Fantastic!", "Yes! Correct!",
    "You're a clock wizard!", "Beautiful!", "Nailed it!",
  ];
  const wrong = [
    "Oh no, not quite.", "So close!", "Hmm, try again next time.",
    "Almost! It was {correct}.", "Not this time. It was {correct}.",
    "Oops! The clock said {correct}.",
  ];
  const streak3 = ["On fire!", "Three in a row!", "You're heating up!"];
  const streak5 = ["Unstoppable!", "Five in a row! Incredible!", "You're on a roll!"];
  const streak7 = ["Seven straight! Wow!", "Amazing streak!"];
  const streak10 = ["LEGENDARY!", "Ten in a row! You're a clock master!"];
  const idle = [
    "Take your time.", "Look carefully at the hands.",
    "What does the short hand say?", "You can do it!",
  ];
  const lastQuestion = ["Last one — make it count!", "Final question!"];
  const newRound = ["Let's play!", "Here we go!", "Get ready!"];
  const lowScore = ["Don't worry, practice makes perfect!", "Try again — you've got this!"];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function withName(text, name) {
    if (!name) return text;
    // 30% chance to insert name naturally
    if (Math.random() < 0.4) {
      const prefixes = [`${name}, `, ``];
      const suffixes = [``, `, ${name}!`, ` ${name}!`];
      if (Math.random() < 0.5) return prefixes[0] + text.charAt(0).toLowerCase() + text.slice(1);
      return text.replace(/[.!]$/, '') + suffixes[1 + Math.floor(Math.random() * 2)];
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

// ===== Level tutorials =====
const Tutorials = {
  1: "On this level, look at the short hand. Whichever number it points to, that's the hour. The big hand stays on 12, so it's always exactly o'clock.",
  2: "Now the big hand can be on the 12, meaning o'clock, or on the 6, which means half past. Half past means thirty minutes after the hour.",
  3: "When the big hand is on the 3, it's quarter past. On the 9, it's quarter to the next hour. Look carefully!",
  4: "The big hand can now be on any five-minute mark. Each number on the clock counts five more minutes.",
  5: "Clock master mode! The big hand can point anywhere. Count the minutes by fives, then add the extra ticks.",
};
