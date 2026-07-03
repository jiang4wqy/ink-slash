// Procedural xuan-paper texture, rendered once per resize/stage to an
// offscreen canvas: seasonal base tint + motif (stages cycle 春夏秋冬), long
// thin fibres, soft blotches and a darker edge vignette. Zero image assets.

export type Season = 0 | 1 | 2 | 3; // 春 夏 秋 冬

const SEASON_TONES: Record<Season, [string, string, string]> = {
  0: ["#f1e7dc", "#ece0d2", "#e5d7c6"], // 春 warm blush
  1: ["#eaeadb", "#e4e6d2", "#dcdfc6"], // 夏 bamboo green
  2: ["#f1e5d2", "#ecdcc4", "#e5d2b4"], // 秋 persimmon warmth
  3: ["#e9eaec", "#e2e4e8", "#d8dbe0"] // 冬 cool snow grey
};

export function seasonForStage(stage: number): Season {
  return (((stage - 1) % 4) + 4) % 4 as Season;
}

export function makePaperCanvas(
  w: number,
  h: number,
  season: Season = 0,
  rng: () => number = Math.random
): HTMLCanvasElement {
  const paper = document.createElement("canvas");
  paper.width = w;
  paper.height = h;
  const ctx = paper.getContext("2d")!;

  // Seasonal paper base with a soft top-light gradient.
  const tones = SEASON_TONES[season];
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, tones[0]);
  base.addColorStop(0.5, tones[1]);
  base.addColorStop(1, tones[2]);
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

  drawSeasonMotif(ctx, w, h, season, rng);

  // Edge vignette: aged, slightly darker borders.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  v.addColorStop(0, "rgba(90, 75, 55, 0)");
  v.addColorStop(1, "rgba(90, 75, 55, 0.16)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  return paper;
}

const INK = "rgba(52, 44, 38, 0.5)";

// Seasonal corner motifs, painted with loose ink strokes so they read as part
// of the paper, not game objects.
function drawSeasonMotif(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  season: Season,
  rng: () => number
): void {
  ctx.save();
  ctx.lineCap = "round";

  if (season === 0) {
    // 春 — blossom branch sweeping in from the top-right.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w + 10, h * 0.06);
    ctx.quadraticCurveTo(w * 0.86, h * 0.1, w * 0.72, h * 0.2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.83, h * 0.115);
    ctx.quadraticCurveTo(w * 0.79, h * 0.05, w * 0.74, h * 0.04);
    ctx.stroke();
    for (let i = 0; i < 12; i += 1) {
      const t = rng();
      const bx = w * (0.72 + t * 0.24) + (rng() - 0.5) * 30;
      const by = h * (0.04 + t * 0.15) + (rng() - 0.5) * 30;
      ctx.fillStyle = `rgba(214, 134, 148, ${0.25 + rng() * 0.3})`;
      ctx.beginPath();
      ctx.arc(bx, by, 4 + rng() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (season === 1) {
    // 夏 — bamboo stalks along the left edge.
    for (const [x0, lw, alpha] of [
      [w * 0.045, 9, 0.4],
      [w * 0.095, 6, 0.28]
    ] as const) {
      ctx.strokeStyle = `rgba(74, 96, 62, ${alpha})`;
      ctx.lineWidth = lw;
      let y = h;
      while (y > -20) {
        const segment = 70 + rng() * 50;
        ctx.beginPath();
        ctx.moveTo(x0 + (h - y) * 0.02, y);
        ctx.lineTo(x0 + (h - y + segment) * 0.02, y - segment);
        ctx.stroke();
        y -= segment + 6;
      }
      for (let i = 0; i < 5; i += 1) {
        const ly = h * (0.1 + rng() * 0.5);
        const lx = x0 + (h - ly) * 0.02;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(0.5 + rng() * 0.8);
        ctx.fillStyle = `rgba(74, 96, 62, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.ellipse(24, 0, 26, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  } else if (season === 2) {
    // 秋 — maple leaves drifting down the right side.
    for (let i = 0; i < 10; i += 1) {
      const lx = w * (0.68 + rng() * 0.3);
      const ly = h * rng() * 0.9;
      const r = 6 + rng() * 8;
      ctx.fillStyle = `rgba(${170 + rng() * 40}, ${70 + rng() * 30}, 40, ${0.2 + rng() * 0.25})`;
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2 + rng();
        ctx.beginPath();
        ctx.ellipse(lx + Math.cos(a) * r * 0.5, ly + Math.sin(a) * r * 0.5, r * 0.55, r * 0.28, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // 冬 — a bare branch and sparse snow.
    ctx.strokeStyle = "rgba(60, 56, 60, 0.45)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.14);
    ctx.quadraticCurveTo(w * 0.14, h * 0.16, w * 0.26, h * 0.1);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.152);
    ctx.quadraticCurveTo(w * 0.2, h * 0.2, w * 0.27, h * 0.21);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (let i = 0; i < 40; i += 1) {
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 1 + rng() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
