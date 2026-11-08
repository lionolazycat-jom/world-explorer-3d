// Static starfield painted once per resize — costs nothing while idle.
export function initStars() {
  const c = document.getElementById('stars');
  const ctx = c.getContext('2d');
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    seed = 7;
    const n = Math.round(w * h / 5200);
    for (let i = 0; i < n; i++) {
      const r = rand() < 0.92 ? rand() * 0.8 + 0.2 : rand() * 1.2 + 0.8;
      ctx.globalAlpha = 0.25 + rand() * 0.6;
      ctx.fillStyle = rand() < 0.15 ? '#f3d38a' : rand() < 0.3 ? '#b9d3ff' : '#ffffff';
      ctx.beginPath(); ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(paint, 150); });
  paint();
}
