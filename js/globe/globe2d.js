// Lite mode: a rotatable orthographic globe drawn on a 2D canvas with d3-geo.
// Used when WebGL is unavailable, too slow, or chosen in Settings.
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate } from 'd3-geo';
import { HOME_VIEW, COLORS } from '../config.js';
import { pickFeature } from '../data/world.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const altToZoom = alt => clamp(2.5 / (alt + 0.3), 0.85, 14);

export function createGlobe2D(container, { caps, prefs, features, onPick, onReady }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'globe2d';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const proj = geoOrthographic().clipAngle(90).precision(0.6);
  const path = geoPath(proj, ctx);
  const graticule = geoGraticule10();
  const sphere = { type: 'Sphere' };

  let W = 1, H = 1, dpr = 1, baseR = 100;
  let rot = [-HOME_VIEW.lng, -HOME_VIEW.lat, 0];
  let zoom = altToZoom(HOME_VIEW.altitude);
  let selA3 = null, hovA3 = null, dots = [];
  let showGrat = !!prefs.graticules;
  let autoRotate = !!prefs.autoRotate && !caps.reducedMotion;
  let lastInteraction = 0, drawQueued = false, tween = null, spinRaf = null;
  const polys = features.filter(f => f.properties._ok);

  function apply() { proj.translate([W / 2, H / 2]).scale(baseR * zoom).rotate(rot); }
  function requestDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(() => { drawQueued = false; draw(); }); } }

  function draw() {
    apply();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const r = baseR * zoom, cx = W / 2, cy = H / 2;

    // Atmosphere glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.14);
    glow.addColorStop(0, 'rgba(127,178,255,0.35)');
    glow.addColorStop(1, 'rgba(127,178,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.14, 0, TAU); ctx.fill();

    // Ocean
    const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, '#16325c'); ocean.addColorStop(1, '#0a1730');
    ctx.beginPath(); path(sphere); ctx.fillStyle = ocean; ctx.fill();

    if (showGrat) { ctx.beginPath(); path(graticule); ctx.strokeStyle = 'rgba(127,178,255,0.14)'; ctx.lineWidth = 0.6; ctx.stroke(); }

    // Land
    ctx.beginPath(); for (const f of polys) path(f);
    ctx.fillStyle = '#22385a'; ctx.fill();
    ctx.strokeStyle = COLORS.stroke; ctx.lineWidth = 0.6; ctx.stroke();

    for (const f of polys) {
      const a3 = f.properties._rec?.a3;
      if (a3 !== selA3 && a3 !== hovA3) continue;
      ctx.beginPath(); path(f);
      ctx.fillStyle = a3 === selA3 ? COLORS.capSelected : COLORS.capHover; ctx.fill();
      ctx.strokeStyle = COLORS.strokeSelected; ctx.lineWidth = a3 === selA3 ? 1.4 : 1; ctx.stroke();
    }

    // Small-country dots (only the visible hemisphere)
    const centre = [-rot[0], -rot[1]];
    for (const d of dots) {
      if (geoDistance(centre, [d.lng, d.lat]) > Math.PI / 2 - 0.02) continue;
      const [x, y] = proj([d.lng, d.lat]);
      const on = d.rec.a3 === selA3 || d.rec.a3 === hovA3;
      ctx.beginPath(); ctx.arc(x, y, on ? 4.5 : 2.8, 0, TAU);
      ctx.fillStyle = on ? COLORS.goldBright : COLORS.gold; ctx.fill();
    }

    // Rim
    ctx.beginPath(); path(sphere); ctx.strokeStyle = 'rgba(214,180,106,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // ---- interaction ----
  const pointers = new Map();
  let drag = null, pinch = null;

  function localXY(e) { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }
  function insideDisc([x, y]) { return Math.hypot(x - W / 2, y - H / 2) <= baseR * zoom; }
  function stopMotion() { lastInteraction = performance.now(); tween = null; }

  function dotAt(xy) {
    const centre = [-rot[0], -rot[1]];
    let best = null, bestD = 14;
    for (const d of dots) {
      if (geoDistance(centre, [d.lng, d.lat]) > Math.PI / 2) continue;
      const [x, y] = proj([d.lng, d.lat]);
      const dist = Math.hypot(x - xy[0], y - xy[1]);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, localXY(e));
    stopMotion();
    if (pointers.size === 1) {
      drag = { start: localXY(e), rot: [...rot], t: performance.now(), moved: false };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom };
      if (drag) drag.moved = true;
    }
  });

  canvas.addEventListener('pointermove', e => {
    const xy = localXY(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, xy);
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      zoom = clamp(pinch.zoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, 0.85, 14);
      requestDraw(); return;
    }
    if (drag && pointers.size === 1) {
      const dx = xy[0] - drag.start[0], dy = xy[1] - drag.start[1];
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      const k = 57.3 / (baseR * zoom); // degrees per pixel at the disc centre
      rot = [drag.rot[0] + dx * k, clamp(drag.rot[1] - dy * k, -89, 89), 0];
      requestDraw(); return;
    }
    if (e.pointerType === 'mouse' && !pointers.size) {
      const ll = insideDisc(xy) ? proj.invert(xy) : null;
      const d = dotAt(xy);
      let a3 = d?.rec.a3 || null;
      if (!a3 && ll) a3 = pickFeature(polys, ll[0], ll[1])?.properties._rec?.a3 || null;
      if (a3 !== hovA3) { hovA3 = a3; canvas.style.cursor = a3 ? 'pointer' : 'grab'; requestDraw(); }
    }
  });

  function endPointer(e) {
    const xy = pointers.get(e.pointerId) || localXY(e);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) { // continue dragging with the remaining finger
      const remaining = [...pointers.values()][0];
      drag = { start: remaining, rot: [...rot], t: performance.now(), moved: true };
      return;
    }
    if (drag && !drag.moved && performance.now() - drag.t < 500 && e.type === 'pointerup') {
      const d = dotAt(xy);
      if (d) onPick({ record: d.rec });
      else if (insideDisc(xy)) { const ll = proj.invert(xy); if (ll) onPick({ lng: ll[0], lat: ll[1] }); }
    }
    drag = null; lastInteraction = performance.now();
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (hovA3 && !pointers.size) { hovA3 = null; requestDraw(); } });
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); stopMotion();
    zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 0.85, 14); requestDraw();
  }, { passive: false });

  // ---- animation ----
  function spin(now) {
    spinRaf = requestAnimationFrame(spin);
    if (tween) {
      const t = clamp((now - tween.t0) / tween.ms, 0, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const [lng, lat] = tween.interp(e);
      rot = [-lng, -lat, 0];
      zoom = tween.z0 + (tween.z1 - tween.z0) * e;
      draw();
      if (t >= 1) tween = null;
      return;
    }
    if (autoRotate && !selA3 && !pointers.size && now - lastInteraction > 20000) {
      rot = [rot[0] + 0.06, rot[1], 0]; draw();
    }
  }
  spinRaf = requestAnimationFrame(spin);
  lastInteraction = performance.now() - 20000; // allow idle spin right away

  const onVis = () => {
    if (document.hidden) { cancelAnimationFrame(spinRaf); spinRaf = null; }
    else if (!spinRaf) spinRaf = requestAnimationFrame(spin);
  };
  document.addEventListener('visibilitychange', onVis);

  function flyTo(view, ms = 1100) {
    if (!view) return;
    const from = [-rot[0], -rot[1]];
    const z1 = altToZoom(view.altitude);
    if (caps.reducedMotion || ms === 0) { rot = [-view.lng, -view.lat, 0]; zoom = z1; requestDraw(); return; }
    tween = { t0: performance.now(), ms, interp: geoInterpolate(from, [view.lng, view.lat]), z0: zoom, z1 };
  }

  const engine = {
    kind: 'lite',
    setSelected(a3) { selA3 = a3 || null; requestDraw(); },
    setDots(list) { dots = list; requestDraw(); },
    flyTo,
    zoomBy(f) { stopMotion(); flyTo({ lng: -rot[0], lat: -rot[1], altitude: Math.max(0.05, 2.5 / zoom - 0.3) * f }, 300); },
    rotateBy(dLng, dLat) { stopMotion(); rot = [rot[0] - dLng, clamp(rot[1] - dLat, -89, 89), 0]; requestDraw(); },
    reset() { stopMotion(); flyTo(HOME_VIEW, 1000); },
    setAutoRotate(on) { autoRotate = on && !caps.reducedMotion; },
    setTexture() { /* Lite mode uses flat colours */ },
    setGraticules(on) { showGrat = !!on; requestDraw(); },
    resize(w, h) {
      W = Math.max(1, w); H = Math.max(1, h);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      baseR = Math.min(W, H) * 0.42;
      draw();
    },
    getAltitude() { return 2.5 / zoom - 0.3; },
    getCenter() { return { lng: -rot[0], lat: -rot[1] }; }
  };
  setTimeout(() => onReady?.(), 0);
  return engine;
}
