// SVG analog clock - drawn entirely in code
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

  function build(container) {
    container.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);

    svg.innerHTML = `
      <defs>
        <radialGradient id="faceGrad" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stop-color="#fffbe8"/>
          <stop offset="70%" stop-color="#fff0c4"/>
          <stop offset="100%" stop-color="#f0c878"/>
        </radialGradient>
        <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
          <stop offset="85%" stop-color="#c8932a"/>
          <stop offset="100%" stop-color="#8a6020"/>
        </radialGradient>
        <radialGradient id="jewelGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ff9b9b"/>
          <stop offset="60%" stop-color="#d94545"/>
          <stop offset="100%" stop-color="#7a1a1a"/>
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3"/>
        </filter>
      </defs>

      <!-- Outer rim -->
      <circle cx="${CX}" cy="${CY}" r="${R + 18}" fill="url(#rimGrad)"/>
      <circle cx="${CX}" cy="${CY}" r="${R + 12}" fill="#2a1437"/>
      <!-- Face -->
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#faceGrad)"/>
    `;

    // Minute tick marks
    for (let m = 0; m < 60; m++) {
      const angle = (m * 6 - 90) * Math.PI / 180;
      const isHour = m % 5 === 0;
      const inner = isHour ? R - 18 : R - 8;
      const x1 = CX + Math.cos(angle) * inner;
      const y1 = CY + Math.sin(angle) * inner;
      const x2 = CX + Math.cos(angle) * (R - 2);
      const y2 = CY + Math.sin(angle) * (R - 2);
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x1); tick.setAttribute('y1', y1);
      tick.setAttribute('x2', x2); tick.setAttribute('y2', y2);
      tick.setAttribute('stroke', isHour ? '#3a2a1a' : '#8a6020');
      tick.setAttribute('stroke-width', isHour ? 4 : 1.5);
      tick.setAttribute('stroke-linecap', 'round');
      svg.appendChild(tick);
    }

    // Numbers 1-12
    for (let n = 1; n <= 12; n++) {
      const angle = (n * 30 - 90) * Math.PI / 180;
      const tx = CX + Math.cos(angle) * (R - 38);
      const ty = CY + Math.sin(angle) * (R - 38);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      const bold = (n === 12 || n === 3 || n === 6 || n === 9);
      text.setAttribute('font-family', 'Fredoka, sans-serif');
      text.setAttribute('font-size', bold ? 36 : 30);
      text.setAttribute('font-weight', bold ? 700 : 600);
      text.setAttribute('fill', bold ? '#2a1437' : '#5a3d1a');
      text.textContent = n;
      svg.appendChild(text);
    }

    // Hour hand - outer group translates to centre, inner group rotates (transform-origin = 0,0 naturally)
    const hourWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hourWrap.setAttribute('transform', `translate(${CX} ${CY})`);
    hourHand = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hourHand.setAttribute('class', 'hour-hand');
    hourHand.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
    hourHand.innerHTML = `
      <line x1="0" y1="18" x2="0" y2="-90"
            stroke="#2a1437" stroke-width="12" stroke-linecap="round"/>
    `;
    hourWrap.appendChild(hourHand);
    svg.appendChild(hourWrap);

    // Minute hand
    const minuteWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    minuteWrap.setAttribute('transform', `translate(${CX} ${CY})`);
    minuteHand = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    minuteHand.setAttribute('class', 'minute-hand');
    minuteHand.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
    minuteHand.innerHTML = `
      <line x1="0" y1="24" x2="0" y2="-130"
            stroke="#a02828" stroke-width="7" stroke-linecap="round"/>
    `;
    minuteWrap.appendChild(minuteHand);
    svg.appendChild(minuteWrap);

    // Centre jewel
    const jewel = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    jewel.innerHTML = `
      <circle cx="${CX}" cy="${CY}" r="14" fill="#2a1437"/>
      <circle cx="${CX}" cy="${CY}" r="10" fill="url(#jewelGrad)"/>
      <circle cx="${CX - 3}" cy="${CY - 3}" r="3" fill="#fff" opacity="0.7"/>
    `;
    svg.appendChild(jewel);

    container.appendChild(svg);
    svgEl = svg;

    // Reset
    currentHourAngle = 0;
    currentMinuteAngle = 0;
    hourHand.style.transform = 'rotate(0deg)';
    minuteHand.style.transform = 'rotate(0deg)';
  }

  // Set time with smooth rotation (no backwards spin)
  function setTime(hour, minute) {
    if (!hourHand || !minuteHand) return;
    const h = hour % 12;
    const targetMinuteRaw = minute * 6;
    const targetHourRaw = (h * 30) + (minute * 0.5);

    // Normalise: pick shortest path so we don't spin backwards weirdly
    const normalise = (current, target) => {
      const delta = ((target - (current % 360)) + 540) % 360 - 180;
      return current + delta;
    };
    currentMinuteAngle = normalise(currentMinuteAngle, targetMinuteRaw);
    currentHourAngle = normalise(currentHourAngle, targetHourRaw);

    hourHand.style.transform = `rotate(${currentHourAngle}deg)`;
    minuteHand.style.transform = `rotate(${currentMinuteAngle}deg)`;
  }

  return { build, setTime };
})();
