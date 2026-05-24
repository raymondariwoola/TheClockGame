// Lightweight pointer-based drag helpers
// Two flavours used by activities:
//   DragDrop.makeDraggable(el, opts)   — element follows pointer; emits drop callbacks
//   DragDrop.angleDrag(el, onAngle)    — radial drag returning angle in degrees (for clock hands)
const DragDrop = (() => {

  // ---------- Generic draggable card with drop targets ----------
  // opts: { onDragStart, onDrag, onDrop(target|null), getTargets() => [HTMLElement] }
  function makeDraggable(el, opts = {}) {
    let dragging = false;
    let ox = 0, oy = 0;        // pointer offset from element origin
    let startX = 0, startY = 0; // element initial page pos
    let lastTarget = null;

    const setHover = (target) => {
      if (lastTarget === target) return;
      if (lastTarget) lastTarget.classList.remove('drop-hover');
      if (target) target.classList.add('drop-hover');
      lastTarget = target;
    };

    const findTarget = (x, y) => {
      const targets = (opts.getTargets && opts.getTargets()) || [];
      for (const t of targets) {
        const r = t.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t;
      }
      return null;
    };

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      const r = el.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      startX = r.left;
      startY = r.top;
      el.classList.add('dragging');
      el.style.zIndex = 1000;
      try { el.setPointerCapture(e.pointerId); } catch {}
      opts.onDragStart && opts.onDragStart();
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX - ox;
      const y = e.clientY - oy;
      el.style.position = 'fixed';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      setHover(findTarget(e.clientX, e.clientY));
      opts.onDrag && opts.onDrag(e);
    };

    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      const target = findTarget(e.clientX, e.clientY);
      setHover(null);
      try { el.releasePointerCapture(e.pointerId); } catch {}
      // Reset visual; caller decides what to do with target
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.zIndex = '';
      opts.onDrop && opts.onDrop(target);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }

  // ---------- Radial drag (for clock hands) ----------
  // hostEl  : element whose centre is the pivot
  // grabEl  : element to capture pointer events on (often === hostEl or a wrapper)
  // onAngle(deg) called while dragging with 0 = 12 o'clock, clockwise.
  function angleDrag(hostEl, grabEl, onAngle, onEnd) {
    let dragging = false;

    const compute = (e) => {
      const r = hostEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // atan2: 0 = +x (3 o'clock), we want 0 = -y (12 o'clock), clockwise
      let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      if (deg < 0) deg += 360;
      return deg;
    };

    const onDown = (e) => {
      dragging = true;
      try { grabEl.setPointerCapture(e.pointerId); } catch {}
      onAngle(compute(e));
      e.preventDefault();
    };
    const onMove = (e) => { if (dragging) onAngle(compute(e)); };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      try { grabEl.releasePointerCapture(e.pointerId); } catch {}
      onEnd && onEnd();
    };

    grabEl.addEventListener('pointerdown', onDown);
    grabEl.addEventListener('pointermove', onMove);
    grabEl.addEventListener('pointerup', onUp);
    grabEl.addEventListener('pointercancel', onUp);

    return () => {
      grabEl.removeEventListener('pointerdown', onDown);
      grabEl.removeEventListener('pointermove', onMove);
      grabEl.removeEventListener('pointerup', onUp);
      grabEl.removeEventListener('pointercancel', onUp);
    };
  }

  return { makeDraggable, angleDrag };
})();
