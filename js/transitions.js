// Screen transitions — clock-themed iris wipe with spinning clock face.
// Keeps the vanilla, no-build promise. All CSS lives in styles.css.
const Transitions = (() => {
  let overlay = null;
  let busy = false;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'screen-transition';
    overlay.innerHTML = `
      <div class="st-iris"></div>
      <div class="st-clock" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd166" stroke-width="4"/>
          <line class="st-hand st-hour" x1="50" y1="50" x2="50" y2="26" stroke="#fffbe8" stroke-width="6" stroke-linecap="round"/>
          <line class="st-hand st-minute" x1="50" y1="50" x2="50" y2="14" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>
          <circle cx="50" cy="50" r="4" fill="#d94545"/>
        </svg>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  // Animate a tap-origin "burst" emanating from the clicked element.
  // Used as a hint that the tap mattered before the wipe takes over.
  function tapBurst(originEl) {
    if (!originEl) return;
    const rect = originEl.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = 'tap-burst';
    burst.style.left = (rect.left + rect.width / 2) + 'px';
    burst.style.top = (rect.top + rect.height / 2) + 'px';
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 700);
  }

  // Wipe in from origin (x,y) → cover → callback → wipe out.
  // origin: {x, y} in viewport coords, defaults to centre.
  function wipe(callback, opts = {}) {
    if (busy) { callback && callback(); return; }
    busy = true;
    const ov = ensureOverlay();
    const origin = opts.origin || { x: innerWidth / 2, y: innerHeight / 2 };
    ov.style.setProperty('--ox', origin.x + 'px');
    ov.style.setProperty('--oy', origin.y + 'px');
    const tone = opts.tone || 'gold'; // gold|teal|pink
    ov.dataset.tone = tone;

    ov.classList.remove('out');
    ov.classList.add('in');

    // After wipe-in completes, run callback (the screen swap) and wipe out.
    const COVER_MS = 360;
    const HOLD_MS = 120;
    const OUT_MS = 460;
    setTimeout(() => {
      try { callback && callback(); } catch (e) { console.error(e); }
      setTimeout(() => {
        ov.classList.remove('in');
        ov.classList.add('out');
        setTimeout(() => {
          ov.classList.remove('out');
          busy = false;
        }, OUT_MS);
      }, HOLD_MS);
    }, COVER_MS);
  }

  // Quick flair: a sparkle/scale pulse on an element. Good for "you tapped this!".
  function pulse(el) {
    if (!el) return;
    el.classList.remove('tile-pulse');
    void el.offsetWidth; // restart animation
    el.classList.add('tile-pulse');
    setTimeout(() => el.classList.remove('tile-pulse'), 600);
  }

  // Cascade-in helper: stagger child reveals.
  // Children get `.cascade-item` class with --i index var; CSS does the rest.
  function cascade(parent, selector = '*') {
    if (!parent) return;
    const kids = [...parent.querySelectorAll(selector)];
    kids.forEach((k, i) => {
      k.classList.remove('cascade-in');
      k.style.setProperty('--i', i);
      void k.offsetWidth;
      k.classList.add('cascade-in');
    });
  }

  return { wipe, pulse, tapBurst, cascade };
})();
