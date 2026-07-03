import type { Fruit, FruitHalf, FruitKind } from "../game/fruit";

// Sumi-e fruit painting: a dark ink outline drawn as two slightly offset
// ellipse strokes (a wobbly brush line), a translucent colour wash that lets
// the paper grain show through, and small ink details per kind.

const INK = "#2a2320";

type EdibleKind = "persimmon" | "plum" | "watermelon" | "gourd";
type TalismanKind = "fu_slow" | "fu_double" | "fu_life";

type Palette = { wash: string; wash2: string; detail: string };

const PALETTES: Record<EdibleKind, Palette> = {
  persimmon: { wash: "rgba(224, 122, 41, 0.55)", wash2: "rgba(190, 84, 25, 0.35)", detail: "#4a5d3a" },
  plum: { wash: "rgba(148, 62, 108, 0.55)", wash2: "rgba(110, 40, 85, 0.38)", detail: "#4a3540" },
  watermelon: { wash: "rgba(96, 132, 74, 0.6)", wash2: "rgba(62, 96, 50, 0.42)", detail: "#3c5232" },
  gourd: { wash: "rgba(196, 158, 82, 0.5)", wash2: "rgba(158, 120, 56, 0.35)", detail: "#6b5426" }
};

// Interior colours revealed on the cut face of each half.
const FLESH: Record<EdibleKind, string> = {
  persimmon: "rgba(240, 158, 74, 0.75)",
  plum: "rgba(214, 134, 130, 0.72)",
  watermelon: "rgba(206, 74, 66, 0.78)",
  gourd: "rgba(228, 205, 150, 0.75)"
};

// Paper talismans (power-ups): kanji + accent colour on a paper slip.
const TALISMANS: Record<TalismanKind, { glyph: string; color: string }> = {
  fu_slow: { glyph: "凍", color: "#4a6a96" },
  fu_double: { glyph: "倍", color: "#b3372b" },
  fu_life: { glyph: "墨", color: "#2a2320" }
};

function isTalisman(kind: FruitKind): kind is TalismanKind {
  return kind.startsWith("fu_");
}

function brushEllipse(ctx: CanvasRenderingContext2D, r: number, squashY: number): void {
  // Two offset passes of varying width fake a hand-drawn brush contour.
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * squashY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.ellipse(r * 0.03, r * 0.04, r * 0.98, r * squashY * 0.97, 0.06, 0, Math.PI * 2);
  ctx.stroke();
}

function washFill(ctx: CanvasRenderingContext2D, r: number, squashY: number, p: Palette): void {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, "rgba(255, 252, 244, 0.18)"); // unpainted highlight
  g.addColorStop(0.35, p.wash);
  g.addColorStop(1, p.wash2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.96, r * squashY * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintTalisman(ctx: CanvasRenderingContext2D, kind: TalismanKind, r: number): void {
  const t = TALISMANS[kind];
  const w = r * 1.3;
  const h = r * 2.1;

  // Paper slip with a hand-cut shadow and an accent border.
  ctx.fillStyle = "rgba(42, 35, 32, 0.16)";
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = "#f6efdf";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = t.color;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "rgba(42, 35, 32, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);

  ctx.fillStyle = t.color;
  ctx.font = `700 ${r * 1.05}px "STKaiti", "KaiTi", "DFKai-SB", "Noto Serif SC", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.glyph, 0, r * 0.05);
}

function paintBody(ctx: CanvasRenderingContext2D, kind: FruitKind, r: number): void {
  if (kind === "bomb") {
    paintBomb(ctx, r);
    return;
  }
  if (isTalisman(kind)) {
    paintTalisman(ctx, kind, r);
    return;
  }
  const p = PALETTES[kind];
  const squashY = kind === "plum" ? 0.92 : kind === "gourd" ? 1.0 : 0.95;

  if (kind === "gourd") {
    // Two-lobed calabash: small top sphere + big bottom sphere + waist cord.
    ctx.save();
    ctx.translate(0, r * 0.28);
    washFill(ctx, r * 0.78, 1, p);
    brushEllipse(ctx, r * 0.78, 1);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -r * 0.52);
    washFill(ctx, r * 0.5, 1, p);
    brushEllipse(ctx, r * 0.5, 1);
    ctx.restore();
    ctx.strokeStyle = "#8a2f2b";
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.14);
    ctx.quadraticCurveTo(0, -r * 0.02, r * 0.42, -r * 0.14);
    ctx.stroke();
    return;
  }

  washFill(ctx, r, squashY, p);

  if (kind === "watermelon") {
    // Ink stripes following the curve.
    ctx.strokeStyle = p.detail;
    ctx.lineWidth = Math.max(2.5, r * 0.11);
    for (const t of [-0.55, -0.18, 0.2, 0.58]) {
      ctx.beginPath();
      ctx.moveTo(t * r, -Math.sqrt(Math.max(0, 1 - t * t)) * r * squashY * 0.92);
      ctx.quadraticCurveTo(t * r * 1.5, 0, t * r, Math.sqrt(Math.max(0, 1 - t * t)) * r * squashY * 0.92);
      ctx.stroke();
    }
  }

  brushEllipse(ctx, r, squashY);

  if (kind === "persimmon") {
    // Calyx: four ink leaves on top.
    ctx.fillStyle = PALETTES.persimmon.detail;
    for (let i = 0; i < 4; i += 1) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.5;
      ctx.save();
      ctx.translate(Math.cos(a) * r * 0.18, -r * squashY * 0.88);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.2, r * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (kind === "plum") {
    // Stem with a leaf.
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, -r * squashY * 0.9);
    ctx.quadraticCurveTo(r * 0.16, -r * 1.28, r * 0.34, -r * 1.36);
    ctx.stroke();
    ctx.fillStyle = PALETTES.plum.detail;
    ctx.save();
    ctx.translate(r * 0.4, -r * 1.3);
    ctx.rotate(0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.26, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintBomb(ctx: CanvasRenderingContext2D, r: number): void {
  // Solid iron ball in heavy ink…
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#4a4340");
  g.addColorStop(0.5, "#221c1a");
  g.addColorStop(1, "#15100e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.stroke();

  // …with a red 危 warning glyph…
  ctx.fillStyle = "rgba(196, 60, 46, 0.95)";
  ctx.font = `700 ${r * 0.85}px "STKaiti", "KaiTi", "DFKai-SB", "Noto Serif SC", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("危", 0, r * 0.06);

  // …and a sparking fuse (flicker driven by time).
  ctx.strokeStyle = "#5a4632";
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(r * 0.1, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.42, -r * 1.3, r * 0.72, -r * 1.18);
  ctx.stroke();
  const spark = (performance.now() % 200) / 200;
  ctx.fillStyle = `rgba(226, 140, 42, ${0.6 + 0.4 * Math.sin(spark * Math.PI)})`;
  ctx.beginPath();
  ctx.arc(r * 0.72, -r * 1.18, r * (0.12 + 0.06 * Math.sin(spark * Math.PI * 2)), 0, Math.PI * 2);
  ctx.fill();
}

export function drawFruit(ctx: CanvasRenderingContext2D, f: Fruit): void {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.rot);
  paintBody(ctx, f.kind, f.r);
  ctx.restore();
}

// A separated half: the body clipped to one side of the cut line, plus the
// flat cut face showing the flesh colour (and seeds for watermelon).
export function drawHalf(ctx: CanvasRenderingContext2D, h: FruitHalf): void {
  const fade = Math.max(0, 1 - h.age / 1.1);
  if (fade <= 0 || h.kind === "bomb" || isTalisman(h.kind)) return;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(h.x, h.y);
  ctx.rotate(h.rot);

  // Clip to the half-plane on this half's side of the cut line.
  const a = h.cutAngle;
  ctx.rotate(a);
  ctx.beginPath();
  const R = h.r * 1.6;
  ctx.rect(-R, h.side === 1 ? 0 : -R, R * 2, R);
  ctx.clip();
  ctx.rotate(-a);

  paintBody(ctx, h.kind, h.r);

  // Cut face: a flesh-coloured band along the seam.
  ctx.rotate(a);
  ctx.fillStyle = FLESH[h.kind];
  ctx.fillRect(-h.r, h.side === 1 ? 0 : -h.r * 0.16, h.r * 2, h.r * 0.16);
  if (h.kind === "watermelon") {
    ctx.fillStyle = INK;
    for (const t of [-0.6, -0.25, 0.15, 0.55]) {
      ctx.beginPath();
      ctx.ellipse(t * h.r, h.side === 1 ? h.r * 0.07 : -h.r * 0.07, h.r * 0.05, h.r * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
