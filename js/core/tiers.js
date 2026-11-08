// Device capability detection → rendering tier.
// A: desktop-class GPU (8K textures OK)  B: typical laptop/modern phone
// C: low-end (no bump map, low pixel ratio)  D: no WebGL → Lite (2D) mode

export function detectCapabilities() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  let gl = null, webgl2 = false, maxTex = 0;
  try {
    const canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2');
    webgl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { gl = null; }

  const mem = navigator.deviceMemory || (coarse ? 3 : 8);
  const cores = navigator.hardwareConcurrency || 4;

  if (!gl) return { webgl: false, webgl2: false, maxTex: 0, coarse, mem, cores, tier: 'D', reducedMotion };

  let tier = 'B';
  if (!coarse && cores >= 8 && mem >= 8 && maxTex >= 8192) tier = 'A';
  else if (mem <= 2 || cores <= 2 || maxTex < 4096) tier = 'C';

  return { webgl: true, webgl2, maxTex, coarse, mem, cores, tier, reducedMotion };
}

export function applyQualityOverride(caps, quality) {
  if (!caps.webgl) return caps;
  if (quality === 'high') return { ...caps, tier: 'A' };
  if (quality === 'low') return { ...caps, tier: 'C' };
  return caps;
}

export function pixelRatioFor(tier) {
  const dpr = window.devicePixelRatio || 1;
  const cap = tier === 'A' ? 2 : tier === 'B' ? 1.5 : 1.25;
  return Math.min(dpr, cap);
}

// Measures real frame rate for `ms`; resolves to frames per second.
export function measureFps(ms = 3000) {
  return new Promise(resolve => {
    let frames = 0; const start = performance.now();
    function tick(now) {
      frames++;
      if (now - start >= ms) resolve(frames * 1000 / (now - start));
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
