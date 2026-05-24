// SVG analog clock - drawn entirely in code
// Main clock (singleton) + miniClock factory for activities showing multiple clocks
const Clock = (() => {
  const SIZE = 400;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 170;

  let svgEl = null;
  let hourHand = null;
  let minuteHand = null;
  let currentHourAngle = 0;
  let currentMinuteAngle = 0;
  let interactive = null; // { hourDrag, minuteDrag, snap, onChange }
  let uidCounter = 0;

  // Build clock SVG into any container. Returns the svg element and handles.
  // opts.size : px (default 400, used for viewBox math)
  // opts.showMinuteTicks : default true
  // opts.handStyle : 'classic' (default) or 'simple' (matches school worksheets)
  function buildInto(container, opts = {}) {
    const size = opts.size || SIZE;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size / SIZE) * R;
    const showMinuteTicks = opts.showMinuteTicks !== false;
    const handStyle = opts.handStyle || 'classic';

    container.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    // Unique IDs per instance so multiple clocks on one page don't clash
    const uid = ++uidCounter;
    const faceId = `faceGrad_${uid}`;
    const rimId = `rimGrad_${uid}`;
    const jewelId = `jewelGrad_${uid}`;

    const defs = `
      <defs>
        <radialGradient id="${faceId}" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stop-color="#fffbe8"/>
          <stop offset="70%" stop-color="#fff0c4"/>
          <stop offset="100%" stop-color="#f0c878"/>
        </radialGradient>
        <radialGradient id="${rimId}" cx="50%" cy="50%" r="50%">
          <stop offset="85%" stop-color="#c8932a"/>
          <stop offset="100%" stop-color="#8a6020"/>
        </radialGradient>
        <radialGradient id="${jewelId}" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ff9b9b"/>
          <stop offset="60%" stop-color="#d94545"/>
          <stop offset="100%" stop-color="#7a1a1a"/>
        </radialGradient>
      </defs>
    `;
    svg.innerHTML = defs;

    // Rim + face
    const rim = `
      <circle cx="${cx}" cy="${cy}" r="${r + 18 * (size / SIZE)}" fill="url(#${rimId})"/>
      <circle cx="${cx}" cy="${cy}" r="${r + 12 * (size / SIZE)}" fill="#2a1437"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${faceId})"/>
    `;
    svg.insertAdjacentHTML('beforeend', rim);

    // Ticks
    if (showMinuteTicks) {
      for (let m = 0; m < 60; m++) {
        const a = (m * 6 - 90) * Math.PI / 180;
        const isHour = m % 5 === 0;
        const inner = isHour ? r - 18 * (size / SIZE) : r - 8 * (size / SIZE);
        const outer = r - 2 * (size / SIZE);
        const x1 = cx + Math.cos(a) * inner;
        const y1 = cy + Math.sin(a) * inner;
        const x2 = cx + Math.cos(a) * outer;
        const y2 = cy + Math.sin(a) * outer;
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', x1); tick.setAttribute('y1', y1);
        tick.setAttribute('x2', x2); tick.setAttribute('y2', y2);
        tick.setAttribute('stroke', isHour ? '#3a2a1a' : '#8a6020');
        tick.setAttribute('stroke-width', isHour ? 4 * (size / SIZE) : 1.5 * (size / SIZE));
        tick.setAttribute('stroke-linecap', 'round');
        svg.appendChild(tick);
      }
    }

    // Numbers 1-12
    // For mini clocks (small displayed size), boost numbers so kids can read easily.
    const isMini = !!opts.miniClock;
    const numScale = isMini ? 1.4 : 1.0;
    for (let n = 1; n <= 12; n++) {
      const a = (n * 30 - 90) * Math.PI / 180;
      const tx = cx + Math.cos(a) * (r - 38 * (size / SIZE));
      const ty = cy + Math.sin(a) * (r - 38 * (size / SIZE));
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      const bold = (n === 12 || n === 3 || n === 6 || n === 9);
      text.setAttribute('font-family', 'Fredoka, sans-serif');
      text.setAttribute('font-size', (bold ? 36 : 30) * (size / SIZE) * numScale);
      text.setAttribute('font-weight', bold ? 800 : 700);
      text.setAttribute('fill', '#2a1437');
      text.textContent = n;
      svg.appendChild(text);
    }

    // Hands
    const hourColor = handStyle === 'simple' ? '#1a0f2a' : '#2a1437';
    const minColor = handStyle === 'simple' ? '#1a0f2a' : '#a02828';
    const handBoost = isMini ? 1.4 : 1.0;
    const hourW = (handStyle === 'simple' ? 8 : 12) * (size / SIZE) * handBoost;
    const minW = (handStyle === 'simple' ? 5 : 7) * (size / SIZE) * handBoost;

    const hourWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hourWrap.setAttribute('transform', `translate(${cx} ${cy})`);
    const hourG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hourG.setAttribute('class', 'hour-hand');
    hourG.style.transition = opts.noTransition ? 'none' : 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
    hourG.innerHTML = `
      <line x1="0" y1="${18 * (size / SIZE)}" x2="0" y2="${-90 * (size / SIZE)}"
            stroke="${hourColor}" stroke-width="${hourW}" stroke-linecap="round"/>
    `;
    hourWrap.appendChild(hourG);
    svg.appendChild(hourWrap);

    const minuteWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    minuteWrap.setAttribute('transform', `translate(${cx} ${cy})`);
    const minuteG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    minuteG.setAttribute('class', 'minute-hand');
    minuteG.style.transition = opts.noTransition ? 'none' : 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
    minuteG.innerHTML = `
      <line x1="0" y1="${24 * (size / SIZE)}" x2="0" y2="${-130 * (size / SIZE)}"
            stroke="${minColor}" stroke-width="${minW}" stroke-linecap="round"/>
    `;
    minuteWrap.appendChild(minuteG);
    svg.appendChild(minuteWrap);

    // Centre jewel
    const jewel = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    jewel.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${14 * (size / SIZE)}" fill="#2a1437"/>
      <circle cx="${cx}" cy="${cy}" r="${10 * (size / SIZE)}" fill="url(#${jewelId})"/>
      <circle cx="${cx - 3 * (size / SIZE)}" cy="${cy - 3 * (size / SIZE)}" r="${3 * (size / SIZE)}" fill="#fff" opacity="0.7"/>
    `;
    svg.appendChild(jewel);

    container.appendChild(svg);
    return { svg, hourG, minuteG };
  }

  function build(container) {
    interactive = null;
    const { svg, hourG, minuteG } = buildInto(container);
    svgEl = svg;
    hourHand = hourG;
    minuteHand = minuteG;
    currentHourAngle = 0;
    currentMinuteAngle = 0;
    hourHand.style.transform = 'rotate(0deg)';
    minuteHand.style.transform = 'rotate(0deg)';
  }

  // Position hands at h:m with shortest-path animation
  function setTime(hour, minute) {
    if (!hourHand || !minuteHand) return;
    const h = hour % 12;
    const targetMinuteRaw = minute * 6;
    const targetHourRaw = (h * 30) + (minute * 0.5);
    const normalise = (current, target) => {
      const delta = ((target - (current % 360)) + 540) % 360 - 180;
      return current + delta;
    };
    currentMinuteAngle = normalise(currentMinuteAngle, targetMinuteRaw);
    currentHourAngle = normalise(currentHourAngle, targetHourRaw);
    hourHand.style.transform = `rotate(${currentHourAngle}deg)`;
    minuteHand.style.transform = `rotate(${currentMinuteAngle}deg)`;
  }

  // Read current time as {h: 1..12, m: 0..59} based on hand positions
  function getTime() {
    const minDeg = ((currentMinuteAngle % 360) + 360) % 360;
    const hourDeg = ((currentHourAngle % 360) + 360) % 360;
    const m = Math.round(minDeg / 6) % 60;
    let h = Math.floor(hourDeg / 30) % 12;
    if (h === 0) h = 12;
    return { h, m };
  }

  // ===== Interactive drag mode =====
  // snapMinutes: snap minute hand to nearest N minutes (5 by default)
  // onChange: called with {h, m} whenever the user moves a hand
  function setInteractive(opts = {}) {
    if (!svgEl) return;
    const snapMinutes = opts.snapMinutes || 5;
    const onChange = opts.onChange || (() => {});

    // Wrap each hand in an invisible thicker hit area for easy grabbing
    const addHandle = (handG, color, hitWidth) => {
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hit.setAttribute('x1', 0); hit.setAttribute('y1', 0);
      hit.setAttribute('x2', 0);
      hit.setAttribute('y2', handG.querySelector('line').getAttribute('y2'));
      hit.setAttribute('stroke', color);
      hit.setAttribute('stroke-width', hitWidth);
      hit.setAttribute('stroke-linecap', 'round');
      hit.setAttribute('opacity', 0);
      hit.style.pointerEvents = 'stroke';
      hit.style.cursor = 'grab';
      handG.appendChild(hit);
      return hit;
    };

    const hourHit = addHandle(hourHand, 'transparent', 40);
    const minuteHit = addHandle(minuteHand, 'transparent', 36);

    // No transition during drag — feels sluggish otherwise
    const setTransition = (on) => {
      const t = on ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none';
      hourHand.style.transition = t;
      minuteHand.style.transition = t;
    };

    const fireChange = () => onChange(getTime());

    const dragMinute = DragDrop.angleDrag(svgEl, minuteHit, (deg) => {
      setTransition(false);
      // Snap to nearest snapMinutes increment
      const snap = snapMinutes * 6;
      const snapped = Math.round(deg / snap) * snap;
      currentMinuteAngle = snapped;
      minuteHand.style.transform = `rotate(${snapped}deg)`;
      // Hour hand drifts proportionally with minutes — keep visually honest
      // Recompute hour angle from current displayed hour + new minute position
      const m = (Math.round(snapped / 6)) % 60;
      const baseHour = Math.floor(((currentHourAngle % 360) + 360) % 360 / 30);
      const newHourDeg = baseHour * 30 + m * 0.5;
      currentHourAngle = newHourDeg;
      hourHand.style.transform = `rotate(${newHourDeg}deg)`;
      fireChange();
    }, () => { setTransition(true); });

    const dragHour = DragDrop.angleDrag(svgEl, hourHit, (deg) => {
      setTransition(false);
      // Snap to nearest hour (every 30°)
      const snapped = Math.round(deg / 30) * 30;
      currentHourAngle = snapped + ((Math.round(currentMinuteAngle / 6) % 60) * 0.5);
      hourHand.style.transform = `rotate(${currentHourAngle}deg)`;
      fireChange();
    }, () => { setTransition(true); });

    interactive = { dragMinute, dragHour };
    svgEl.classList.add('interactive');
  }

  // Convenience: create a small read-only mini clock displaying h:m.
  // Used by Tick-the-Clock and Match-Up.
  function miniClock(h, m, size = 150) {
    const div = document.createElement('div');
    div.className = 'mini-clock';
    div.style.width = size + 'px';
    div.style.height = size + 'px';
    const { hourG, minuteG } = buildInto(div, { size: 400, noTransition: true, handStyle: 'simple', miniClock: true });
    // Use SIZE=400 viewBox math; CSS scales the SVG to size px
    const hh = h % 12;
    const minDeg = m * 6;
    const hourDeg = hh * 30 + m * 0.5;
    hourG.style.transform = `rotate(${hourDeg}deg)`;
    minuteG.style.transform = `rotate(${minDeg}deg)`;
    return div;
  }

  return { build, setTime, getTime, setInteractive, miniClock, buildInto };
})();
