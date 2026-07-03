// 一闪 · 墨斩 — main loop. Pure logic lives in src/game (unit-tested); this
// file owns the DOM, input plumbing, timing and draw order.

import { Sfx } from "./audio/sfx";
import { Blade } from "./game/blade";
import type { BladeSegment } from "./game/blade";
import { segmentCircleHit } from "./game/collision";
import { GRAVITY, isOffscreen, sliceFruit, stepFruit } from "./game/fruit";
import type { Fruit, FruitHalf } from "./game/fruit";
import { Scoring, BestScore } from "./game/scoring";
import { Spawner } from "./game/spawner";
import { GameFlow } from "./game/state";
import { mapNormToCanvas } from "./gesture/coords";
import { HandTracker } from "./gesture/handTracker";
import { OneEuroFilter2D } from "./gesture/oneEuro";
import {
  FONT_STACK,
  drawButton,
  drawComboStamp,
  drawCountdown,
  drawCursor,
  drawGameOverPanel,
  drawLives,
  drawScore,
  drawTitle,
  hitButton
} from "./render/hud";
import type { ButtonSpec, ComboStamp } from "./render/hud";
import { drawFruit, drawHalf } from "./render/fruitPainter";
import { makePaperCanvas } from "./render/paper";
import { SplashSystem, JUICE } from "./render/splash";
import { drawTrail } from "./render/trail";

const COUNTDOWN_SEC = 3;
const WAVE_INTERVAL_MS = 1900;
const MAX_AIRBORNE = 9;
const SLOWMO_MS = 600;
const SLOWMO_SCALE = 0.35;
const DWELL_MS = 900;
const FIXED_DT = 1 / 120;

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const video = document.getElementById("cam") as HTMLVideoElement;
const ctx = canvas.getContext("2d")!;

// --- View & paper ------------------------------------------------------------
let viewW = 0;
let viewH = 0;
let paper: HTMLCanvasElement | null = null;

function fitCanvas(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = canvas.clientWidth;
  viewH = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(viewW * dpr));
  canvas.height = Math.max(1, Math.floor(viewH * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paper = makePaperCanvas(viewW, viewH);
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// --- Game state ----------------------------------------------------------------
const flow = new GameFlow();
const scoring = new Scoring();
const bestScore = new BestScore({
  get: () => localStorage.getItem("ink-slash:best"),
  set: (v) => localStorage.setItem("ink-slash:best", v)
});
const spawner = new Spawner(Math.random);
const splash = new SplashSystem();
const sfx = new Sfx();

let fruits: Fruit[] = [];
let halves: FruitHalf[] = [];
let stamps: ComboStamp[] = [];
let countdownEndsAt = 0;
let nextWaveAt = 0;
let slowmoUntil = 0;
let shake = 0;
let endedByBomb = false;
let isNewRecord = false;
let menuError: string | null = null;
let cameraLoading = false;

// --- Input: blades (mouse or fingertips) ---------------------------------------
type BladeSlot = { blade: Blade; filter: OneEuroFilter2D; lastSeen: number; pos: { x: number; y: number } | null };

function newSlot(): BladeSlot {
  return { blade: new Blade(), filter: new OneEuroFilter2D(), lastSeen: 0, pos: null };
}

let inputMode: "mouse" | "hand" = "mouse";
const slots: BladeSlot[] = [newSlot(), newSlot()];
const tracker = new HandTracker();
let lastFrameAt = performance.now();

// Segments produced this frame, consumed by the slice pass.
let frameSegments: BladeSegment[] = [];

function feedBlade(slot: BladeSlot, x: number, y: number, now: number, dt: number): void {
  const p = slot.filter.filter({ x, y }, dt);
  slot.pos = p;
  slot.lastSeen = now;
  const seg = slot.blade.push({ x: p.x, y: p.y, t: now }, viewH);
  if (seg) {
    frameSegments.push(seg);
    if (seg.armed && flow.state === "playing") sfx.whoosh(seg.speed);
  }
}

canvas.addEventListener("pointermove", (e) => {
  if (inputMode !== "mouse") return;
  const now = performance.now();
  const dt = Math.max(1, now - (slots[0].lastSeen || now - 16)) / 1000;
  feedBlade(slots[0], e.clientX, e.clientY, now, dt);
});

canvas.addEventListener("pointerdown", (e) => {
  sfx.resume();
  if (inputMode !== "mouse") return;
  const b = buttonAt(e.clientX, e.clientY);
  if (b) activateButton(b.id);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) lastFrameAt = performance.now();
});

// --- Buttons & dwell ------------------------------------------------------------
const dwell = new Map<string, number>(); // button id -> dwell start ms

function menuButtons(): ButtonSpec[] {
  const w = Math.min(360, viewW - 48);
  const x = (viewW - w) / 2;
  const base = viewH * 0.46;
  if (flow.state === "menu") {
    return [
      { id: "camera", x, y: base, w, h: 72, label: "启用摄像头", sub: "隔空挥指斩果 · 画面仅本地处理" },
      { id: "mouse", x, y: base + 92, w, h: 60, label: "鼠标模式", sub: "无摄像头也能玩" },
      { id: "mute", x, y: base + 172, w, h: 44, label: sfx.muted ? "音效：关" : "音效：开" }
    ];
  }
  if (flow.state === "gameover") {
    return [
      { id: "replay", x, y: viewH * 0.52, w, h: 72, label: "再来一局" },
      { id: "home", x, y: viewH * 0.52 + 92, w, h: 56, label: "回主页" }
    ];
  }
  return [];
}

function buttonAt(px: number, py: number): ButtonSpec | null {
  return menuButtons().find((b) => hitButton(b, px, py)) ?? null;
}

function activateButton(id: string): void {
  sfx.resume();
  if (id === "mouse") {
    inputMode = "mouse";
    stopCamera();
    startRun();
  } else if (id === "camera") {
    void startCamera();
  } else if (id === "mute") {
    sfx.toggleMute();
  } else if (id === "replay") {
    flow.replay();
    beginCountdown();
  } else if (id === "home") {
    flow.toMenu();
    stopCamera();
    inputMode = "mouse";
  }
  dwell.clear();
}

async function startCamera(): Promise<void> {
  if (cameraLoading) return;
  menuError = null;
  if (!navigator.mediaDevices?.getUserMedia) {
    menuError = "当前浏览器不支持摄像头访问，可先用鼠标模式。";
    return;
  }
  cameraLoading = true;
  try {
    await tracker.init(video);
    video.classList.add("cam-on");
    inputMode = "hand";
    startRun();
  } catch (error) {
    menuError =
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "摄像头权限被拒绝。请允许摄像头后重试，或使用鼠标模式。"
        : error instanceof Error
          ? error.message
          : "摄像头初始化失败，可先用鼠标模式。";
    stopCamera();
  } finally {
    cameraLoading = false;
  }
}

function stopCamera(): void {
  tracker.stop();
  video.classList.remove("cam-on");
}

function startRun(): void {
  flow.start();
  beginCountdown();
}

function beginCountdown(): void {
  scoring.reset();
  fruits = [];
  halves = [];
  stamps = [];
  splash.clear();
  endedByBomb = false;
  isNewRecord = false;
  slowmoUntil = 0;
  shake = 0;
  countdownEndsAt = performance.now() + COUNTDOWN_SEC * 1000;
}

function endRun(byBomb: boolean): void {
  endedByBomb = byBomb;
  isNewRecord = bestScore.update(scoring.score);
  flow.gameOver();
  sfx.bell();
  dwell.clear();
}

// --- Slice pass -------------------------------------------------------------------
function applySlices(now: number): void {
  for (const seg of frameSegments) {
    if (!seg.armed) continue;
    const dirX = seg.bx - seg.ax;
    const dirY = seg.by - seg.ay;
    for (const f of fruits) {
      if (f.sliced) continue;
      if (!segmentCircleHit(seg.ax, seg.ay, seg.bx, seg.by, f.x, f.y, f.r)) continue;

      if (f.kind === "bomb") {
        f.sliced = true;
        splash.inkExplosion(f.x, f.y);
        sfx.bomb();
        shake = 26;
        endRun(true);
        return;
      }

      halves.push(...sliceFruit(f, dirX, dirY));
      splash.burst(f.x, f.y, dirX, dirY, JUICE[f.kind]);
      const { combo } = scoring.addSlice(now);
      sfx.slice(combo);
      if (combo >= 2) {
        stamps.push({ x: f.x, y: f.y - f.r - 16, n: combo, age: 0 });
        sfx.pluck(combo);
      }
      if (combo >= 3) slowmoUntil = now + SLOWMO_MS;
      shake = Math.min(14, shake + 5);
    }
    fruits = fruits.filter((f) => !f.sliced);
  }
}

// --- Fixed-step world update --------------------------------------------------------
let accumulator = 0;

function updateWorld(realDt: number, now: number): void {
  const scale = now < slowmoUntil ? SLOWMO_SCALE : 1;
  accumulator += realDt * scale;

  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    for (const f of fruits) stepFruit(f, FIXED_DT, GRAVITY);
    for (const h of halves) {
      stepFruit(h, FIXED_DT, GRAVITY);
      h.age += FIXED_DT;
    }
    splash.update(FIXED_DT);
  }
  halves = halves.filter((h) => h.age < 1.2 && h.y < viewH + 200);
  for (const s of stamps) s.age += realDt;
  stamps = stamps.filter((s) => s.age < 1.1);
  shake = Math.max(0, shake - realDt * 60);

  // Misses: unsliced fruit falling past the bottom.
  const missed = fruits.filter((f) => isOffscreen(f, viewW, viewH));
  if (missed.length > 0) {
    fruits = fruits.filter((f) => !isOffscreen(f, viewW, viewH));
    for (const f of missed) {
      if (f.kind === "bomb") continue; // dodging a bomb is free
      if (scoring.missFruit() === 0) {
        endRun(false);
        return;
      }
    }
  }

  // Next wave.
  if (now >= nextWaveAt && fruits.length < MAX_AIRBORNE) {
    fruits.push(...spawner.next(scoring.score, viewW, viewH));
    nextWaveAt = now + WAVE_INTERVAL_MS;
  }
}

// --- Input per frame -----------------------------------------------------------------
function pollHands(now: number, realDt: number): void {
  if (inputMode !== "hand") return;
  const tips = tracker.detect(now);
  for (let i = 0; i < slots.length; i += 1) {
    const tip = tips[i];
    if (tip) {
      const p = mapNormToCanvas(tip.x, tip.y, tracker.videoAspect, viewW, viewH);
      feedBlade(slots[i], p.x, p.y, now, realDt);
    } else if (now - slots[i].lastSeen > 160) {
      // Hand lost: break the stroke and forget filter momentum.
      slots[i].blade.clear();
      slots[i].filter = new OneEuroFilter2D();
      slots[i].pos = null;
    }
  }
}

function updateDwell(now: number): void {
  const buttons = menuButtons();
  if (buttons.length === 0) return;
  const cursors = slots.map((s) => s.pos).filter((p): p is { x: number; y: number } => p !== null);

  for (const b of buttons) {
    const hovered = cursors.some((c) => hitButton(b, c.x, c.y));
    if (!hovered) {
      dwell.delete(b.id);
      continue;
    }
    const started = dwell.get(b.id) ?? now;
    if (!dwell.has(b.id)) dwell.set(b.id, started);
    if (now - started >= DWELL_MS) activateButton(b.id);
  }
}

// --- Render -----------------------------------------------------------------------------
function render(now: number): void {
  ctx.clearRect(0, 0, viewW, viewH);
  if (paper) ctx.drawImage(paper, 0, 0, viewW, viewH);

  ctx.save();
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  splash.draw(ctx);
  for (const h of halves) drawHalf(ctx, h);
  for (const f of fruits) drawFruit(ctx, f);
  for (const s of slots) drawTrail(ctx, s.blade.trail(now), now);
  for (const s of stamps) drawComboStamp(ctx, s);
  ctx.restore();

  if (flow.state === "menu") {
    drawTitle(ctx, viewW, viewH);
    if (cameraLoading) {
      ctx.font = `400 18px ${FONT_STACK}`;
      ctx.fillStyle = "rgba(42, 35, 32, 0.7)";
      ctx.textAlign = "center";
      ctx.fillText("正在加载手部模型…", viewW / 2, viewH * 0.42);
    }
    if (menuError) {
      ctx.font = `400 16px ${FONT_STACK}`;
      ctx.fillStyle = "#8a2f2b";
      ctx.textAlign = "center";
      ctx.fillText(menuError, viewW / 2, viewH * 0.42);
    }
  } else if (flow.state === "countdown") {
    drawCountdown(ctx, viewW, viewH, Math.max(0, (countdownEndsAt - now) / 1000));
    drawScore(ctx, scoring.score, bestScore.value);
    drawLives(ctx, scoring.lives, viewW);
  } else if (flow.state === "playing") {
    drawScore(ctx, scoring.score, bestScore.value);
    drawLives(ctx, scoring.lives, viewW);
  } else if (flow.state === "gameover") {
    drawGameOverPanel(ctx, viewW, viewH, scoring.score, bestScore.value, isNewRecord);
    if (endedByBomb) {
      ctx.font = `400 18px ${FONT_STACK}`;
      ctx.fillStyle = "rgba(42, 35, 32, 0.65)";
      ctx.textAlign = "center";
      ctx.fillText("斩中了铁炮弹……", viewW / 2, viewH * 0.44);
    }
  }

  for (const b of menuButtons()) {
    const started = dwell.get(b.id);
    const cursors = slots.map((s) => s.pos).filter((p): p is { x: number; y: number } => p !== null);
    const hovered = cursors.some((c) => hitButton(b, c.x, c.y));
    drawButton(ctx, b, hovered, started ? Math.min(1, (now - started) / DWELL_MS) : 0);
  }

  // Fingertip cursors on non-playing screens (aiming aid).
  if (flow.state !== "playing") {
    for (const s of slots) if (s.pos) drawCursor(ctx, s.pos.x, s.pos.y);
  }
}


// --- Main loop ----------------------------------------------------------------------------
// `?tick` swaps rAF for a timer — a debug affordance for headless testing and
// environments that throttle requestAnimationFrame.
const useTimerLoop = new URLSearchParams(location.search).has("tick");
function schedule(fn: () => void): void {
  if (useTimerLoop) setTimeout(fn, 16);
  else requestAnimationFrame(fn);
}

// Read-only introspection for headless E2E, only exposed in ?tick debug mode.
if (useTimerLoop) {
  Object.defineProperty(window, "__ink", {
    value: {
      get state() {
        return flow.state;
      },
      get score() {
        return scoring.score;
      },
      get lives() {
        return scoring.lives;
      },
      get fruits() {
        return fruits.map((f) => ({ id: f.id, kind: f.kind, x: f.x, y: f.y, r: f.r }));
      }
    }
  });
}

function frame(): void {
  const now = performance.now();
  const realDt = Math.min(0.1, (now - lastFrameAt) / 1000);
  lastFrameAt = now;

  if (useTimerLoop || !document.hidden) {
    // Self-heal the canvas size: covers late stylesheet layout and viewport
    // changes that never fire a resize event.
    if (canvas.clientWidth !== viewW || canvas.clientHeight !== viewH) fitCanvas();

    // NOTE: mouse segments arrive via pointermove events BETWEEN frames, so
    // frameSegments is consumed-then-cleared at the END of the frame — never
    // cleared up front, or mouse slices would be wiped before applySlices.
    pollHands(now, realDt);

    if (flow.state === "countdown" && now >= countdownEndsAt) {
      flow.countdownDone();
      nextWaveAt = now + 400;
    }
    if (flow.state === "playing") {
      applySlices(now);
      updateWorld(realDt, now);
    } else {
      splash.update(realDt);
      updateDwell(now);
    }
    frameSegments = [];
    render(now);
  }

  schedule(frame);
}

schedule(frame);
