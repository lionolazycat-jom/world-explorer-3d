// 3D globe engine built on globe.gl (three.js). Exposes the same interface as
// the 2D Lite engine so the rest of the app doesn't care which one is running.
import { CDN, COLORS, HOME_VIEW } from '../config.js';
import { pixelRatioFor } from '../core/tiers.js';
import { polityColor } from '../data/history.js';

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
const tip = (html) => `<div class="globe-tip">${html}</div>`;

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

  let selA3 = null, hovF = null;
  let scene = { overlay: null, compare: true, markers: [], paths: [] };
  let autoRotate = !!prefs.autoRotate && !caps.reducedMotion;
  let idleTimer = null, readyFired = false;

  const recOf = f => f?.properties?._rec;
  const isHist = f => !!f?.properties?._hist;
  const inOverlay = () => !!scene.overlay;

  const capColor = () => f => {
    if (isHist(f)) {
      if (f === hovF) return 'rgba(255,240,200,0.55)';
      return polityColor(f, { highlight: scene.overlay?.highlight });
    }
    if (inOverlay()) return COLORS.capIdle;
    const a3 = recOf(f)?.a3;
    return a3 === selA3 ? COLORS.capSelected : f === hovF ? COLORS.capHover : COLORS.capIdle;
  };
  const strokeColor = () => f => {
    if (isHist(f)) return f.properties.BORDERPRECISION >= 3 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)';
    if (inOverlay()) return 'rgba(127,178,255,0.55)';
    return recOf(f)?.a3 === selA3 ? COLORS.strokeSelected : COLORS.stroke;
  };
  const altitude = () => f => {
    if (isHist(f)) {
      const hl = scene.overlay?.highlight;
      return f === hovF ? 0.02 : hl && hl.test(f.properties.NAME) ? 0.016 : 0.01;
    }
    if (inOverlay()) return 0.005;
    const a3 = recOf(f)?.a3;
    return a3 === selA3 ? 0.022 : f === hovF ? 0.012 : 0.006;
  };
  const sideColor = () => f => isHist(f) ? 'rgba(255,255,255,0.05)' : COLORS.side;

  function refresh() {
    g.polygonCapColor(capColor()).polygonStrokeColor(strokeColor()).polygonAltitude(altitude()).polygonSideColor(sideColor());
  }

  // Antarctica's pole-covering polygon triangulates badly; it stays pickable
  // through onGlobeClick + geoContains instead.
  const modern = features.filter(f => f.properties._ok && recOf(f)?.a3 !== 'ATA');
  function applyPolygons() {
    const hist = scene.overlay?.features || [];
    const base = scene.overlay ? (scene.compare ? modern : []) : modern;
    hovF = null;
    g.polygonsData(base.concat(hist));
    refresh();
  }

  g.backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl(prefs.texture === 'night' ? CDN.textures.night : CDN.textures.day)
    .bumpImageUrl(tier === 'C' ? null : CDN.textures.bump)
    .showAtmosphere(true)
    .atmosphereColor(COLORS.blue)
    .atmosphereAltitude(0.17)
    .showGraticules(!!prefs.graticules)
    .polygonsTransitionDuration(caps.reducedMotion ? 0 : 280)
    .polygonLabel(f => {
      if (caps.coarse) return '';
      if (isHist(f)) return tip(`${esc(f.properties.NAME)}<br><small>approximate · c. ${esc(f.properties._yearLabel || '')}</small>`);
      return inOverlay() ? '' : tip(esc(recOf(f)?.name));
    })
    .onPolygonHover(f => {
      if (f === hovF) return;
      if (f && inOverlay() && !isHist(f)) f = null;
      hovF = f || null; container.style.cursor = f ? 'pointer' : 'grab'; refresh();
    })
    .onPolygonClick((f, _ev, coords) => {
      if (isHist(f)) onPick({ polity: f, lat: coords?.lat, lng: coords?.lng });
      else onPick({ record: recOf(f), lat: coords?.lat, lng: coords?.lng });
    })
    .onGlobeClick(coords => onPick({ lat: coords?.lat, lng: coords?.lng }))
    // Markers: small-country dots, place pins, event pins
    .pointsData([])
    .pointLat(d => d.lat).pointLng(d => d.lng)
    .pointAltitude(d => d.alt).pointRadius(d => d.r).pointColor(d => d.color)
    .pointsMerge(false)
    .pointsTransitionDuration(0)
    .pointLabel(d => caps.coarse ? '' : tip(esc(d.label)))
    .onPointHover(d => { container.style.cursor = d ? 'pointer' : 'grab'; })
    .onPointClick(d => onPick({ marker: d }))
    // Routes
    .pathsData([])
    .pathPoints(d => d.pts).pathPointLat(p => p[1]).pathPointLng(p => p[0]).pathPointAlt(0.012)
    .pathColor(d => d.color).pathStroke(2)
    .pathDashLength(0.035).pathDashGap(0.012)
    .pathDashAnimateTime(caps.reducedMotion ? 0 : 16000)
    .pathTransitionDuration(0)
    .pathLabel(d => caps.coarse ? '' : tip(`${esc(d.name)}<br><small>schematic route</small>`))
    .onPathClick(d => onPick({ route: d.id }));
  applyPolygons();

  if (typeof g.onGlobeReady === 'function') g.onGlobeReady(() => { readyFired = true; onReady?.(); });
  setTimeout(() => { if (!readyFired) { readyFired = true; onReady?.(); } }, 9000);

  try { g.renderer().setPixelRatio(pixelRatioFor(tier)); } catch { /* ignore */ }
  const canvas = g.renderer?.().domElement;
  canvas?.addEventListener('webglcontextlost', e => { e.preventDefault(); onContextLost?.(); });

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
    if (autoRotate) idleTimer = setTimeout(() => { if (!selA3 && !inOverlay()) controls.autoRotate = true; }, 20000);
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
    // scene: { overlay: {features, highlight?: RegExp, yearLabel} | null, compare, markers, paths }
    setScene(next) {
      const overlayChanged = next.overlay !== scene.overlay || next.compare !== scene.compare;
      scene = { ...scene, ...next };
      if (scene.overlay) {
        scene.overlay.features.forEach(f => { f.properties._yearLabel = scene.overlay.yearLabel; });
        controls.autoRotate = false;
      }
      if (overlayChanged) applyPolygons(); else refresh();
      g.pointsData(scene.markers || []);
      g.pathsData(scene.paths || []);
    },
    flyTo(view, ms = 1400) { if (view) { pauseRotation(); g.pointOfView(view, caps.reducedMotion ? 0 : ms); } },
    zoomBy(factor) { const p = g.pointOfView(); pauseRotation(); g.pointOfView({ ...p, altitude: clampAlt(p.altitude * factor) }, 350); },
    rotateBy(dLng, dLat) {
      const p = g.pointOfView(); pauseRotation();
      g.pointOfView({ lat: Math.max(-85, Math.min(85, p.lat + dLat)), lng: p.lng + dLng, altitude: p.altitude }, 250);
    },
    reset() { pauseRotation(); g.pointOfView(HOME_VIEW, caps.reducedMotion ? 0 : 1200); },
    setAutoRotate(on) { autoRotate = on && !caps.reducedMotion; controls.autoRotate = autoRotate && !selA3 && !inOverlay(); },
    setTexture(t) { g.globeImageUrl(t === 'night' ? CDN.textures.night : CDN.textures.day); },
    setGraticules(on) { g.showGraticules(!!on); },
    resize(w, h) { g.width(w).height(h); },
    getAltitude() { return g.pointOfView().altitude; },
    getCenter() { const p = g.pointOfView(); return { lat: p.lat, lng: p.lng }; }
  };
}
