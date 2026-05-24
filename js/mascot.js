// Owl mascot SVG - Professor Hoot
const Mascot = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function build() {
    // Returns an SVG element of the owl
    const svg = `
<svg class="mascot" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#b89b75"/>
      <stop offset="100%" stop-color="#7a5e3f"/>
    </radialGradient>
    <radialGradient id="bellyGrad" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#fff5dc"/>
      <stop offset="100%" stop-color="#e8c98a"/>
    </radialGradient>
    <radialGradient id="eyeWhite" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e0e0e0"/>
    </radialGradient>
  </defs>

  <!-- Wings (behind body) -->
  <ellipse class="wing wing-l" cx="40" cy="120" rx="22" ry="40" fill="#6b4f33" transform="rotate(-15 40 120)"/>
  <ellipse class="wing wing-r" cx="160" cy="120" rx="22" ry="40" fill="#6b4f33" transform="rotate(15 160 120)"/>

  <!-- Body -->
  <ellipse cx="100" cy="120" rx="62" ry="68" fill="url(#bodyGrad)"/>

  <!-- Belly -->
  <ellipse cx="100" cy="135" rx="40" ry="48" fill="url(#bellyGrad)"/>

  <!-- Feet -->
  <ellipse cx="78" cy="184" rx="10" ry="5" fill="#ffb347"/>
  <ellipse cx="122" cy="184" rx="10" ry="5" fill="#ffb347"/>

  <!-- Eyes -->
  <g class="eye eye-l">
    <circle cx="78" cy="92" r="22" fill="url(#eyeWhite)" stroke="#3a2a1a" stroke-width="2"/>
    <circle class="eye-pupil" cx="78" cy="92" r="10" fill="#1a0f04"/>
    <circle cx="74" cy="88" r="3.5" fill="#fff"/>
  </g>
  <g class="eye eye-r">
    <circle cx="122" cy="92" r="22" fill="url(#eyeWhite)" stroke="#3a2a1a" stroke-width="2"/>
    <circle class="eye-pupil" cx="122" cy="92" r="10" fill="#1a0f04"/>
    <circle cx="118" cy="88" r="3.5" fill="#fff"/>
  </g>

  <!-- Beak -->
  <path class="beak" d="M 92 110 Q 100 122 108 110 Q 100 116 92 110 Z" fill="#ffb347" stroke="#c97f1f" stroke-width="1.5"/>

  <!-- Graduation cap -->
  <g class="cap">
    <rect x="62" y="38" width="76" height="14" rx="3" fill="#2a1437"/>
    <polygon points="100,18 152,38 100,52 48,38" fill="#2a1437"/>
    <circle cx="100" cy="32" r="3" fill="#ffd166"/>
    <!-- Tassel -->
    <line x1="100" y1="32" x2="138" y2="55" stroke="#ffd166" stroke-width="2"/>
    <circle cx="138" cy="58" r="4" fill="#ffd166"/>
  </g>

  <!-- Eyebrows (shown when sad/excited) -->
  <path class="brow brow-l" d="M 62 76 Q 78 70 92 76" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>
  <path class="brow brow-r" d="M 108 76 Q 122 70 138 76" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>
</svg>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = svg.trim();
    return wrap.firstChild;
  }

  function setMood(el, mood) {
    if (!el) return;
    el.classList.remove('mascot--happy', 'mascot--sad', 'mascot--excited');
    if (mood) el.classList.add(`mascot--${mood}`);
  }

  return { build, setMood };
})();
