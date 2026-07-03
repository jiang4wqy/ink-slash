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

// A small ink-drawn katana that rides the blade point, aligned to the motion
// direction — the "hilt" of the player's invisible sword.
export function drawKatana(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  const S = 46; // overall length in px

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineCap = "round";

  // Blade: a gently curved stroke ending at the cursor point (0,0).
  ctx.strokeStyle = "rgba(58, 60, 66, 0.9)";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-S * 0.52, S * 0.055);
  ctx.quadraticCurveTo(-S * 0.2, -S * 0.02, 0, 0);
  ctx.stroke();
  // Edge highlight.
  ctx.strokeStyle = "rgba(246, 243, 235, 0.75)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-S * 0.5, S * 0.03);
  ctx.quadraticCurveTo(-S * 0.2, -S * 0.035, -S * 0.02, -S * 0.012);
  ctx.stroke();

  // Tsuba (guard).
  ctx.fillStyle = "rgba(42, 35, 32, 0.95)";
  ctx.beginPath();
  ctx.ellipse(-S * 0.54, S * 0.055, S * 0.055, S * 0.1, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Wrapped handle with a diamond pattern.
  ctx.strokeStyle = "rgba(74, 44, 42, 0.95)";
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(-S * 0.57, S * 0.06);
  ctx.lineTo(-S * 0.82, S * 0.1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(230, 222, 205, 0.8)";
  ctx.lineWidth = 1.2;
  for (const t of [0.63, 0.7, 0.77]) {
    ctx.beginPath();
    ctx.moveTo(-S * t, S * 0.035);
    ctx.lineTo(-S * (t + 0.035), S * 0.125);
    ctx.stroke();
  }

  ctx.restore();
}
