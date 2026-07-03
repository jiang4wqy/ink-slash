// Procedural xuan-paper texture, rendered once per resize to an offscreen
// canvas: warm base, long thin fibres, soft blotches and a darker edge
// vignette. Zero image assets.
export function makePaperCanvas(w: number, h: number, rng: () => number = Math.random): HTMLCanvasElement {
  const paper = document.createElement("canvas");
  paper.width = w;
  paper.height = h;
  const ctx = paper.getContext("2d")!;

  // Warm paper base with a soft top-light gradient.
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#efe8d8");
  base.addColorStop(0.5, "#eae2d0");
  base.addColorStop(1, "#e3dac6");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Fibres: long, faint, slightly wavy hairlines.
  ctx.lineWidth = 1;
  for (let i = 0; i < Math.floor((w * h) / 9000); i += 1) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 20 + rng() * 90;
    const ang = rng() * Math.PI;
    const bow = (rng() - 0.5) * 10;
    ctx.strokeStyle = rng() < 0.5 ? "rgba(120, 105, 85, 0.05)" : "rgba(255, 252, 240, 0.10)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(ang) * len * 0.5 + Math.cos(ang + Math.PI / 2) * bow,
      y + Math.sin(ang) * len * 0.5 + Math.sin(ang + Math.PI / 2) * bow,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len
    );
    ctx.stroke();
  }

  // Soft blotches (paper sizing irregularities).
  for (let i = 0; i < 14; i += 1) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 40 + rng() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rng() < 0.5 ? "150, 135, 110" : "252, 248, 238";
    g.addColorStop(0, `rgba(${tone}, 0.045)`);
    g.addColorStop(1, `rgba(${tone}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Edge vignette: aged, slightly darker borders.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  v.addColorStop(0, "rgba(90, 75, 55, 0)");
  v.addColorStop(1, "rgba(90, 75, 55, 0.16)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  return paper;
}
