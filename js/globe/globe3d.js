// 3D globe engine built on globe.gl (three.js). Exposes the same interface as
// the 2D Lite engine so the rest of the app doesn't care which one is running.
import { CDN, COLORS, HOME_VIEW } from '../config.js';
import { pixelRatioFor } from '../core/tiers.js';

function loadScript(src, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const t = setTimeout(() => reject(new Error('Timed out loading ' + src)), timeout);
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function createGlobe3D(container, { caps, prefs, features, onPick, onReady, onContextLost }) {
  if (!window.Globe) await loadScript(CDN.globe);
  const GlobeCtor = window.Globe;
  if (typeof GlobeCtor !== 'function') throw new Error('Globe library unavailable');

  const tier = caps.tier;
  const opts = {
    rendererConfig: { antialias: tier !== 'C', alpha: true, powerPreference: 'high-performance' },
    animateIn: !caps.reducedMotion,
    waitForGlobeReady: true
  };
  let g;
  try { g = new GlobeCtor(container, opts); }
  catch { g = GlobeCtor(opts)(container); } // older factory-style API

  let selA3 = null, hovA3 = null, dots = [];
  let autoRotate = !!prefs.autoRotate && !caps.reducedMotion;
  let idleTimer = null, readyFired = false;

  const recOf = f => f?.properties?._rec;
  const capColor = () => f => {
    const a3 = recOf(f)?.a3;
    return a3 === selA3 ? COLORS.capSelected : a3 === hovA3 ? COLORS.capHover : COLORS.capIdle;
  };
  const strokeColor = () => f => recOf(f)?.a3 === selA3 ? COLORS.strokeSelected : COLORS.stroke;
  const altitude = () => f => {
    const a3 = recOf(f)?.a3;
    return a3 === selA3 ? 0.022 : a3 === hovA3 ? 0.012 : 0.006;
  };
  const pointColor = () => d => d.rec.a3 === selA3 ? COLORS.goldBright : d.rec.a3 === hovA3 ? '#fff3cf' : COLORS.gold;

  function refresh() {
    g.polygonCapColor(capColor()).polygonStrokeColor(strokeColor()).polygonAltitude(altitude());
    g.pointColor(pointColor());
  }

  // Antarctica's pole-covering polygon triangulates badly; it stays pickable
  // through onGlobeClick + geoContains instead.
  const polys = features.filter(f => f.properties._ok && recOf(f)?.a3 !== 'ATA');

  g.backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl(prefs.texture === 'night' ? CDN.textures.night : CDN.textures.day)
    .bumpImageUrl(tier === 'C' ? null : CDN.textures.bump)
    .showAtmosphere(true)
    .atmosphereColor(COLORS.blue)
    .atmosphereAltitude(0.17)
    .showGraticules(!!prefs.graticules)
    .polygonsData(polys)
    .polygonSideColor(() => COLORS.side)
    .polygonsTransitionDuration(caps.reducedMotion ? 0 : 280)
    .polygonLabel(f => caps.coarse ? '' : `<div class="globe-tip">${esc(recOf(f)?.name)}</div>`)
    .onPolygonHover(f => {
      const next = recOf(f)?.a3 || null;
      if (next === hovA3) return;
      hovA3 = next; container.style.cursor = f ? 'pointer' : 'grab'; refresh();
    })
    .onPolygonClick((f, _ev, coords) => onPick({ record: recOf(f), lat: coords?.lat, lng: coords?.lng }))
    .onGlobeClick(coords => onPick({ lat: coords?.lat, lng: coords?.lng }))
    .pointsData([])
    .pointLat(d => d.lat).pointLng(d => d.lng)
    .pointAltitude(0.014).pointRadius(0.32)
    .pointsMerge(false)
    .pointLabel(d => caps.coarse ? '' : `<div class="globe-tip">${esc(d.rec.name)}</div>`)
    .onPointHover(d => { hovA3 = d?.rec.a3 || null; container.style.cursor = d ? 'pointer' : 'grab'; refresh(); })
    .onPointClick(d => onPick({ record: d.rec }));
  refresh();

  if (typeof g.onGlobeReady === 'function') g.onGlobeReady(() => { readyFired = true; onReady?.(); });
  setTimeout(() => { if (!readyFired) { readyFired = true; onReady?.(); } }, 9000);

  // Renderer tuning
  try { g.renderer().setPixelRatio(pixelRatioFor(tier)); } catch { /* ignore */ }
  const canvas = g.renderer?.().domElement;
  canvas?.addEventListener('webglcontextlost', e => { e.preventDefault(); onContextLost?.(); });

  // Controls: rotate + zoom only, with inertia.
  const controls = g.controls();
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.08, enablePan: false,
    rotateSpeed: caps.coarse ? 0.55 : 0.45, zoomSpeed: 0.8,
    minDistance: 100 * 1.3, maxDistance: 100 * 4.6,
    autoRotate, autoRotateSpeed: 0.35
  });
  const pauseRotation = () => {
    controls.autoRotate = false;
    clearTimeout(idleTimer);
    if (autoRotate) idleTimer = setTimeout(() => { if (!selA3) controls.autoRotate = true; }, 20000);
  };
  controls.addEventListener?.('start', pauseRotation);

  g.pointOfView(HOME_VIEW, 0);

  const onVis = () => document.hidden ? g.pauseAnimation?.() : g.resumeAnimation?.();
  document.addEventListener('visibilitychange', onVis);

  const clampAlt = a => Math.min(3.6, Math.max(0.3, a));

  return {
    kind: '3d',
    setSelected(a3) {
      selA3 = a3 || null;
      if (selA3) { controls.autoRotate = false; clearTimeout(idleTimer); }
      else if (autoRotate) pauseRotation();
      refresh();
    },
    setDots(list) { dots = list; g.pointsData(dots); refresh(); },
    flyTo(view, ms = 1400) { if (view) g.pointOfView(view, caps.reducedMotion ? 0 : ms); },
    zoomBy(factor) { const p = g.pointOfView(); pauseRotation(); g.pointOfView({ ...p, altitude: clampAlt(p.altitude * factor) }, 350); },
    rotateBy(dLng, dLat) {
      const p = g.pointOfView(); pauseRotation();
      g.pointOfView({ lat: Math.max(-85, Math.min(85, p.lat + dLat)), lng: p.lng + dLng, altitude: p.altitude }, 250);
    },
    reset() { pauseRotation(); g.pointOfView(HOME_VIEW, caps.reducedMotion ? 0 : 1200); },
    setAutoRotate(on) { autoRotate = on && !caps.reducedMotion; controls.autoRotate = autoRotate && !selA3; },
    setTexture(t) { g.globeImageUrl(t === 'night' ? CDN.textures.night : CDN.textures.day); },
    setGraticules(on) { g.showGraticules(!!on); },
    resize(w, h) { g.width(w).height(h); },
    getAltitude() { return g.pointOfView().altitude; },
    getCenter() { const p = g.pointOfView(); return { lat: p.lat, lng: p.lng }; }
  };
}
