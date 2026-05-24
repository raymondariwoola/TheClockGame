// Web Audio API - all sounds generated on the fly
const Audio = (() => {
  let ctx = null;
  let muted = localStorage.getItem('cq_muted') === '1';

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.18, startOffset = 0, attack = 0.01, release = 0.1) {
    if (muted) return;
    const c = getCtx(); if (!c) return;
    const t0 = c.currentTime + startOffset;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.linearRampToValueAtTime(vol * 0.7, t0 + dur - release);
    gain.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // C major triad ascending
  function correct() {
    tone(523.25, 0.18, 'triangle', 0.2, 0);     // C5
    tone(659.25, 0.18, 'triangle', 0.2, 0.1);   // E5
    tone(783.99, 0.32, 'triangle', 0.22, 0.2);  // G5
  }

  function wrong() {
    tone(196.00, 0.18, 'sine', 0.22, 0);    // G3
    tone(146.83, 0.32, 'sine', 0.2, 0.12);  // D3
  }

  function fanfare() {
    tone(523.25, 0.14, 'triangle', 0.22, 0);
    tone(659.25, 0.14, 'triangle', 0.22, 0.12);
    tone(783.99, 0.14, 'triangle', 0.22, 0.24);
    tone(1046.5, 0.32, 'triangle', 0.25, 0.36);
    tone(783.99, 0.32, 'triangle', 0.2, 0.36);
  }

  function tick() {
    tone(1200, 0.04, 'square', 0.06, 0, 0.005, 0.02);
  }

  function sparkle() {
    [659.25, 783.99, 987.77, 1318.5, 1567.98].forEach((f, i) => {
      tone(f, 0.1, 'triangle', 0.16, i * 0.06);
    });
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem('cq_muted', muted ? '1' : '0');
    return muted;
  }

  function isMuted() { return muted; }

  return { correct, wrong, fanfare, tick, sparkle, toggleMute, isMuted };
})();
