import type { BladePoint } from "../game/blade";

const INK = "42, 35, 32";

// Renders the blade trail as a tapered ink stroke: thick wet head at the
// newest point, thinning and fading toward the tail — one brush flick.
export function drawTrail(ctx: CanvasRenderingContext2D, points: BladePoint[], now: number): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    // 0 at the oldest visible age (300ms), 1 at "just drawn".
    const fresh = Math.max(0, Math.min(1, 1 - (now - b.t) / 300));

    // Outer bleed: soft grey halo like wet ink soaking into paper.
    ctx.strokeStyle = `rgba(${INK}, ${0.10 * fresh})`;
    ctx.lineWidth = 3 + 15 * fresh;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Core stroke.
    ctx.strokeStyle = `rgba(${INK}, ${0.28 + 0.6 * fresh})`;
    ctx.lineWidth = 1 + 7 * fresh;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Blade tip: a small wet dot.
  const tip = points[points.length - 1];
  const tipFresh = Math.max(0, 1 - (now - tip.t) / 120);
  if (tipFresh > 0) {
    ctx.fillStyle = `rgba(${INK}, ${0.75 * tipFresh})`;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
