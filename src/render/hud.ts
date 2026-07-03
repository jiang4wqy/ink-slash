// HUD & screens: calligraphic score, ink-droplet lives, red seal combo
// stamps, paper-card buttons with a dwell progress ring, title / countdown /
// game-over compositions. Pure draw functions — state lives in main.

const INK = "#2a2320";
const SEAL_RED = "#b3372b";

export const FONT_STACK = `"STKaiti", "KaiTi", "DFKai-SB", "Noto Serif SC", serif`;
const font = (px: number, weight = 700) => `${weight} ${px}px ${FONT_STACK}`;

export type ButtonSpec = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
};

export function hitButton(b: ButtonSpec, px: number, py: number): boolean {
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

// Paper-card button. `progress` (0..1) is the fingertip dwell ring; at 1 the
// button activates.
export function drawButton(ctx: CanvasRenderingContext2D, b: ButtonSpec, hover: boolean, progress: number): void {
  ctx.save();

  // Card with a hand-cut shadow.
  ctx.fillStyle = "rgba(42, 35, 32, 0.14)";
  ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
  ctx.fillStyle = hover ? "#f6efdf" : "#f1e9d7";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = hover ? 3 : 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(Math.min(30, b.h * 0.4));
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 - (b.sub ? 10 : 0));
  if (b.sub) {
    ctx.font = font(14, 400);
    ctx.fillStyle = "rgba(42, 35, 32, 0.62)";
    ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 18);
  }

  // Dwell ring at the right edge, sealed in red.
  if (progress > 0) {
    const cx = b.x + b.w - 26;
    const cy = b.y + b.h / 2;
    ctx.strokeStyle = "rgba(179, 55, 43, 0.25)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = SEAL_RED;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawScore(ctx: CanvasRenderingContext2D, score: number, best: number): void {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = INK;
  ctx.font = font(64);
  ctx.fillText(String(score), 28, 18);
  ctx.font = font(17, 400);
  ctx.fillStyle = "rgba(42, 35, 32, 0.65)";
  ctx.fillText(`最高 ${best}`, 31, 92);
  ctx.restore();
}

// Stage progress under the score: 「第X幕」 + 本幕得分/目标.
export function drawStageInfo(ctx: CanvasRenderingContext2D, stage: number, stageScore: number, target: number): void {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = font(22);
  ctx.fillStyle = INK;
  const label = stage <= 10 ? `第${CN_NUM[stage]}幕` : `第${stage}幕`;
  ctx.fillText(label, 31, 118);
  ctx.font = font(17, 400);
  ctx.fillStyle = stageScore >= target ? "#4a6a3a" : "rgba(42, 35, 32, 0.65)";
  ctx.fillText(`目标 ${Math.min(stageScore, target)} / ${target}`, 31, 146);
  ctx.restore();
}

// Stage timer as a burning incense stick (一炷香) on the right edge: the
// remaining fraction is the unburnt length; an ember glows at the tip.
export function drawIncenseTimer(ctx: CanvasRenderingContext2D, w: number, h: number, fraction: number): void {
  const x = w - 34;
  const top = h * 0.24;
  const len = h * 0.42;
  const f = Math.max(0, Math.min(1, fraction));
  const burntTo = top + len * (1 - f);

  ctx.save();
  // Holder dish at the bottom.
  ctx.fillStyle = "rgba(42, 35, 32, 0.55)";
  ctx.beginPath();
  ctx.ellipse(x, top + len + 12, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Remaining stick.
  ctx.strokeStyle = "rgba(94, 66, 50, 0.85)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, burntTo);
  ctx.lineTo(x, top + len + 6);
  ctx.stroke();

  if (f > 0) {
    // Ember + a wisp of smoke.
    const flicker = 0.75 + 0.25 * Math.sin(performance.now() / 90);
    ctx.fillStyle = `rgba(216, 96, 40, ${flicker})`;
    ctx.beginPath();
    ctx.arc(x, burntTo, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 85, 80, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, burntTo - 6);
    ctx.quadraticCurveTo(x + 6, burntTo - 18, x - 3, burntTo - 30);
    ctx.stroke();
    // Low-time warning: the last 25% pulses red.
    if (f < 0.25) {
      ctx.fillStyle = `rgba(179, 55, 43, ${0.25 * flicker})`;
      ctx.beginPath();
      ctx.arc(x, burntTo, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Interstitial between stages: 「第X幕 完」 + the next act's target.
export function drawStageBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clearedStage: number,
  nextTarget: number,
  t01: number
): void {
  const alpha = t01 < 0.15 ? t01 / 0.15 : t01 > 0.85 ? (1 - t01) / 0.15 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = font(72);
  const label = clearedStage <= 10 ? `第${CN_NUM[clearedStage]}幕 · 完` : `第${clearedStage}幕 · 完`;
  ctx.fillText(label, w / 2, h * 0.42);
  ctx.font = font(24, 400);
  ctx.fillStyle = "rgba(42, 35, 32, 0.7)";
  ctx.fillText(`下一幕 目标 ${nextTarget}`, w / 2, h * 0.42 + 48);

  ctx.translate(w / 2 + 190, h * 0.42 - 24);
  ctx.rotate(0.08);
  ctx.fillStyle = SEAL_RED;
  ctx.fillRect(-24, -24, 48, 48);
  ctx.fillStyle = "#f6efdf";
  ctx.font = font(20);
  ctx.textBaseline = "middle";
  ctx.fillText("見", 0, -9);
  ctx.fillText("参", 0, 11);
  ctx.restore();
}

// Active talisman effects under the score: 「凍 2.1s」「倍 4.3s」.
export function drawEffects(ctx: CanvasRenderingContext2D, remaining: { slow: number; double: number }): void {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = font(20);
  let y = 182; // below the stage info block
  if (remaining.slow > 0) {
    ctx.fillStyle = "#4a6a96";
    ctx.fillText(`凍 ${remaining.slow.toFixed(1)}s`, 31, y);
    y += 28;
  }
  if (remaining.double > 0) {
    ctx.fillStyle = SEAL_RED;
    ctx.fillText(`倍 ${remaining.double.toFixed(1)}s`, 31, y);
  }
  ctx.restore();
}

// Remaining lives as ink droplets; spent lives are hollow outlines.
export function drawLives(ctx: CanvasRenderingContext2D, lives: number, w: number): void {
  ctx.save();
  for (let i = 0; i < 3; i += 1) {
    const cx = w - 36 - i * 40;
    const cy = 44;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.bezierCurveTo(cx + 13, cy + 2, cx + 9, cy + 14, cx, cy + 14);
    ctx.bezierCurveTo(cx - 9, cy + 14, cx - 13, cy + 2, cx, cy - 16);
    if (i < lives) {
      ctx.fillStyle = INK;
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(42, 35, 32, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

// `label` overrides the default 「N连斩」 text (talisman pickups use it, with
// `color` for a non-seal accent).
export type ComboStamp = { x: number; y: number; n: number; age: number; label?: string; color?: string };

// Red hanko seal slamming onto the paper: pops in, lingers, fades.
export function drawComboStamp(ctx: CanvasRenderingContext2D, s: ComboStamp): void {
  const IN = 0.12;
  const LIFE = 1.1;
  if (s.age > LIFE) return;
  const pop = s.age < IN ? 1.6 - (0.6 * s.age) / IN : 1;
  const alpha = s.age < LIFE - 0.35 ? 1 : Math.max(0, (LIFE - s.age) / 0.35);

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(-0.08);
  ctx.scale(pop, pop);
  ctx.globalAlpha = alpha;

  const label = s.label ?? (s.n <= 10 ? `${CN_NUM[s.n]}连斩` : `${s.n}连斩`);
  ctx.font = font(26);
  const wText = ctx.measureText(label).width;
  const pad = 12;
  const w = wText + pad * 2;
  const h = 46;

  const sealColor = s.color ?? SEAL_RED;
  ctx.fillStyle = sealColor;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // Worn seal edge.
  ctx.strokeStyle = sealColor;
  ctx.globalAlpha = alpha * 0.5;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "#f6efdf";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 2);
  ctx.restore();
}

export function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.textAlign = "center";

  ctx.fillStyle = INK;
  ctx.font = font(Math.min(96, w * 0.11));
  ctx.textBaseline = "alphabetic";
  ctx.fillText("一闪 · 墨斩", w / 2, h * 0.3);

  ctx.font = font(20, 400);
  ctx.fillStyle = "rgba(42, 35, 32, 0.7)";
  ctx.fillText("指尖即刀，墨迹为痕 —— 隔空斩落飞来的果实", w / 2, h * 0.3 + 44);

  // Artist's red seal, slightly tilted.
  ctx.translate(w / 2 + Math.min(96, w * 0.11) * 2.6, h * 0.3 - 30);
  ctx.rotate(0.06);
  ctx.fillStyle = SEAL_RED;
  ctx.fillRect(-20, -20, 40, 40);
  ctx.fillStyle = "#f6efdf";
  ctx.font = font(17);
  ctx.textBaseline = "middle";
  ctx.fillText("墨", 0, -8);
  ctx.fillText("斩", 0, 10);
  ctx.restore();
}

export function drawCountdown(ctx: CanvasRenderingContext2D, w: number, h: number, remainingSec: number): void {
  const n = Math.ceil(remainingSec);
  const frac = 1 - (remainingSec - Math.floor(remainingSec)); // 0→1 within each second
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, frac * 3);
  ctx.fillStyle = INK;
  ctx.font = font(180);
  ctx.fillText(String(CN_NUM[n] ?? n), w / 2, h / 2 * (0.9 + 0.1 * frac));
  ctx.restore();
}

export function drawGameOverPanel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  score: number,
  best: number,
  isRecord: boolean
): void {
  ctx.save();
  ctx.textAlign = "center";

  ctx.fillStyle = INK;
  ctx.font = font(72);
  ctx.textBaseline = "alphabetic";
  ctx.fillText("终局", w / 2, h * 0.26);

  ctx.font = font(30, 400);
  ctx.fillText(`得分 ${score}`, w / 2, h * 0.26 + 62);
  ctx.font = font(19, 400);
  ctx.fillStyle = "rgba(42, 35, 32, 0.65)";
  ctx.fillText(isRecord ? "新纪录！" : `最高 ${best}`, w / 2, h * 0.26 + 96);

  if (isRecord) {
    ctx.translate(w / 2 + 130, h * 0.26 + 88);
    ctx.rotate(0.1);
    ctx.fillStyle = SEAL_RED;
    ctx.fillRect(-26, -18, 52, 36);
    ctx.fillStyle = "#f6efdf";
    ctx.font = font(19);
    ctx.textBaseline = "middle";
    ctx.fillText("新録", 0, 1);
  }
  ctx.restore();
}

// Fingertip cursor (menu screens): a small ink ring so players can aim before
// any trail exists.
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(42, 35, 32, 0.8)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = SEAL_RED;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
