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
import { StageRun } from "./game/stage";
import { Effects } from "./game/effects";
import type { TalismanKind } from "./game/effects";
import { GameFlow } from "./game/state";
import { mapNormToCanvas } from "./gesture/coords";
import { HandTracker } from "./gesture/handTracker";
import { OneEuroFilter2D } from "./gesture/oneEuro";
import {
  FONT_STACK,
  drawButton,
  drawEffects,
  drawComboStamp,
  drawCountdown,
  drawCursor,
  drawGameOverPanel,
  drawLives,
  drawScore,
  drawStageBanner,
  drawStageInfo,
  drawIncenseTimer,
  drawTitle,
  hitButton
} from "./render/hud";
import type { ButtonSpec, ComboStamp } from "./render/hud";
import { drawFruit, drawHalf } from "./render/fruitPainter";
import { makePaperCanvas, seasonForStage } from "./render/paper";
import type { Season } from "./render/paper";
import { SplashSystem, JUICE } from "./render/splash";
import { drawKatana, drawTrail } from "./render/trail";

const COUNTDOWN_SEC = 3;
const STAGECLEAR_MS = 2600;
const MAX_AIRBORNE = 14;
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
let currentSeason: Season = 0;

function fitCanvas(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = canvas.clientWidth;
  viewH = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(viewW * dpr));
  canvas.height = Math.max(1, Math.floor(viewH * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paper = makePaperCanvas(viewW, viewH, currentSeason);
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// --- Game state ----------------------------------------------------------------
const flow = new GameFlow();
const scoring = new Scoring();
// Storage access is guarded: private-browsing modes can throw on any
// localStorage touch, and losing the best score must never crash the game.
const bestScore = new BestScore({
  get: () => {
    try {
      return localStorage.getItem("ink-slash:best");
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      localStorage.setItem("ink-slash:best", v);
    } catch {
      // best-effort persistence only
    }
  }
});
const spawner = new Spawner(Math.random);
const splash = new SplashSystem();
const sfx = new Sfx();
const effects = new Effects();

let fruits: Fruit[] = [];
let halves: FruitHalf[] = [];
let stamps: ComboStamp[] = [];
let stageRun = new StageRun(1);
let stageClearStartedAt = 0;
let countdownEndsAt = 0;
let nextWaveAt = 0;
let slowmoUntil = 0;
let shake = 0;
let gameOverReason: "bomb" | "time" | null = null;
let finalShortfall = 0;
let isNewRecord = false;
let menuError: string | null = null;
let cameraLoading = false;

// --- Input: blades (mouse or fingertips) ---------------------------------------
type BladeSlot = {
  blade: Blade;
  filter: OneEuroFilter2D;
  lastSeen: number;
  pos: { x: number; y: number } | null;
  angle: number;
};

function newSlot(): BladeSlot {
  return { blade: new Blade(), filter: new OneEuroFilter2D(), lastSeen: 0, pos: null, angle: -Math.PI / 4 };
}

// Ghost level for the full-screen camera ink-wash (0 off, 1 faint, 2 strong).
// Blended under the game, it lets you see yourself with zero occlusion, and
// your hand lines up 1:1 with the blade.
function loadGhost(): number {
  try {
    const v = Number(localStorage.getItem("ink-slash:ghost"));
    return v === 0 || v === 2 ? v : 1;
  } catch {
    return 1;
  }
}
let ghostLevel = loadGhost();
function cycleGhost(): void {
  ghostLevel = (ghostLevel + 1) % 3;
  try {
    localStorage.setItem("ink-slash:ghost", String(ghostLevel));
  } catch {
    // best-effort persistence only
  }
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
    if (seg.speed > 90) slot.angle = Math.atan2(seg.by - seg.ay, seg.bx - seg.ax);
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

// Any first interaction anywhere unlocks audio (belt-and-suspenders for the
// autoplay policy).
window.addEventListener("pointerdown", () => sfx.resume(), { once: true });
window.addEventListener("keydown", () => sfx.resume(), { once: true });

// While the tab is hidden the loop pauses but wall-clock deadlines keep
// ticking; shift them by the pause so a returning player resumes exactly
// where they left off (no instant countdown expiry / wave flood).
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = performance.now();
  } else if (hiddenAt > 0) {
    const now = performance.now();
    const pause = now - hiddenAt;
    lastFrameAt = now;
    countdownEndsAt += pause;
    nextWaveAt += pause;
    slowmoUntil += pause;
  }
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
      { id: "mute", x, y: base + 172, w, h: 44, label: sfx.muted ? "音效：关" : "音效：开" },
      { id: "ghost", x, y: base + 232, w, h: 44, label: `人影：${["关", "淡", "浓"][ghostLevel]}` }
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
  } else if (id === "ghost") {
    cycleGhost();
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
  effects.reset();
  stageRun = new StageRun(1);
  setSeason(seasonForStage(1));
  gameOverReason = null;
  finalShortfall = 0;
  isNewRecord = false;
  slowmoUntil = 0;
  shake = 0;
  countdownEndsAt = performance.now() + COUNTDOWN_SEC * 1000;
}

function setSeason(season: Season): void {
  if (season !== currentSeason) {
    currentSeason = season;
    paper = makePaperCanvas(viewW, viewH, currentSeason);
  }
}

function endRun(reason: "bomb" | "time"): void {
  gameOverReason = reason;
  finalShortfall = stageRun.shortfall;
  isNewRecord = bestScore.update(scoring.score);
  flow.gameOver();
  sfx.bell();
  dwell.clear();
}

// --- Slice pass -------------------------------------------------------------------
// Touch-to-slice: ANY blade contact cuts — no minimum swipe speed. Moving
// blades contribute their swept segments; a stationary blade (parked mouse /
// resting fingertip) still cuts fruit that flies into it via a zero-length
// "contact point" segment. sliceFruit derives the cut direction from the
// fruit's own motion when the blade isn't moving.
function applySlices(now: number): void {
  const cutters = [...frameSegments];
  for (const s of slots) {
    if (s.pos) cutters.push({ ax: s.pos.x, ay: s.pos.y, bx: s.pos.x, by: s.pos.y, speed: 0, armed: false });
  }

  for (const seg of cutters) {
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
        stamps.push({ x: f.x, y: f.y - f.r - 16, n: 0, age: 0, label: "墨爆！", color: "#2a2320" });
        if (scoring.hitBomb() === 0) {
          endRun("bomb");
          return;
        }
        continue;
      }

      // Talisman pickup: activate its effect, no halves, no miss risk.
      if (f.kind.startsWith("fu_")) {
        f.sliced = true;
        const kind = f.kind as TalismanKind;
        effects.activate(kind, now);
        if (kind === "fu_life") scoring.restoreLife();
        splash.burst(f.x, f.y, dirX, dirY, JUICE[f.kind]);
        sfx.pluck(5);
        const meta =
          kind === "fu_slow"
            ? { label: "凍 · 时缓", color: "#4a6a96" }
            : kind === "fu_double"
              ? { label: "倍 · 双倍", color: undefined }
              : { label: "墨 +1", color: "#2a2320" };
        stamps.push({ x: f.x, y: f.y - f.r - 16, n: 0, age: 0, ...meta });
        continue;
      }

      halves.push(...sliceFruit(f, dirX, dirY));
      splash.burst(f.x, f.y, dirX, dirY, JUICE[f.kind]);
      const { combo, gained } = scoring.addSlice(now, effects.scoreMultiplier(now));
      stageRun.addPoints(gained);
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
  const scale = Math.min(now < slowmoUntil ? SLOWMO_SCALE : 1, effects.timeScale(now));
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

  // Dropped fruit costs nothing — the pressure is the incense clock and bombs.
  fruits = fruits.filter((f) => !isOffscreen(f, viewW, viewH));

  // The incense clock burns in game time, so 「凍」 stretches the stage too.
  stageRun.tick(realDt * scale * 1000);
  if (stageRun.cleared) {
    flow.stageClear();
    stageClearStartedAt = now;
    fruits = [];
    halves = [];
    sfx.pluck(7);
    return;
  }
  if (stageRun.failed) {
    endRun("time");
    return;
  }

  // Next wave, at the current stage's cadence.
  if (now >= nextWaveAt && fruits.length < MAX_AIRBORNE) {
    fruits.push(...spawner.next(stageRun.config, viewW, viewH));
    nextWaveAt = now + stageRun.config.waveIntervalMs;
  }
}

// --- Input per frame -----------------------------------------------------------------
function pollHands(now: number, realDt: number): void {
  if (inputMode !== "hand") return;
  const tips = tracker
    .detect(now)
    .map((tip) => mapNormToCanvas(tip.x, tip.y, tracker.videoAspect, viewW, viewH));

  // MediaPipe gives no stable hand ids and compacts its output array, so a
  // hand leaving the frame shifts the survivor to index 0. Match tips to
  // slots by proximity instead of index — otherwise one hand's coordinates
  // pollute the other hand's filter and stroke (phantom cross-screen slash).
  const SNAP_RADIUS = viewH * 0.25;
  const pairs: { t: number; s: number; d: number }[] = [];
  tips.forEach((p, t) =>
    slots.forEach((slot, s) => {
      if (slot.pos) pairs.push({ t, s, d: Math.hypot(p.x - slot.pos.x, p.y - slot.pos.y) });
    })
  );
  pairs.sort((a, b) => a.d - b.d);

  const claimedTips = new Set<number>();
  const usedSlots = new Set<number>();
  for (const { t, s, d } of pairs) {
    if (claimedTips.has(t) || usedSlots.has(s) || d > SNAP_RADIUS) continue;
    claimedTips.add(t);
    usedSlots.add(s);
    feedBlade(slots[s], tips[t].x, tips[t].y, now, realDt);
  }

  // Unmatched tips (new hand / big jump) take a free slot as a FRESH stroke.
  tips.forEach((p, t) => {
    if (claimedTips.has(t)) return;
    const idx = slots.findIndex((_, i) => !usedSlots.has(i));
    if (idx < 0) return;
    usedSlots.add(idx);
    slots[idx].blade.clear();
    slots[idx].filter = new OneEuroFilter2D();
    feedBlade(slots[idx], p.x, p.y, now, realDt);
  });

  // Slots that matched nothing go stale after a short grace period.
  slots.forEach((slot, i) => {
    if (!usedSlots.has(i) && now - slot.lastSeen > 280) {
      slot.blade.clear();
      slot.filter = new OneEuroFilter2D();
      slot.pos = null;
    }
  });
}

function updateDwell(now: number): void {
  // Dwell-to-activate is a hand-tracking affordance. Mouse users click — and
  // that click doubles as the user gesture that unlocks the AudioContext
  // (hover alone is not a user activation, so a dwell-activated 启用摄像头
  // would leave the whole camera session silent under autoplay policy).
  if (inputMode !== "hand") return;
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
// The camera as a faint grey ink-wash across the whole paper (multiply blend):
// you see yourself without covering the game, and your hand is exactly where
// the blade is.
function drawGhost(): void {
  if (ghostLevel === 0 || inputMode !== "hand" || video.videoWidth === 0) return;
  const p00 = mapNormToCanvas(0, 0, tracker.videoAspect, viewW, viewH);
  const p11 = mapNormToCanvas(1, 1, tracker.videoAspect, viewW, viewH);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = ghostLevel === 1 ? 0.16 : 0.3;
  ctx.filter = "grayscale(1) contrast(0.9) brightness(1.15)";
  // Mirror horizontally to match the mirrored blade coordinates.
  ctx.translate(viewW, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, viewW - p11.x, p00.y, p11.x - p00.x, p11.y - p00.y);
  ctx.restore();
}

function render(now: number): void {
  ctx.clearRect(0, 0, viewW, viewH);
  if (paper) ctx.drawImage(paper, 0, 0, viewW, viewH);
  drawGhost();

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
    drawStageInfo(ctx, stageRun.stage, stageRun.stageScore, stageRun.config.target);
    drawLives(ctx, scoring.lives, viewW);
  } else if (flow.state === "playing") {
    drawScore(ctx, scoring.score, bestScore.value);
    drawStageInfo(ctx, stageRun.stage, stageRun.stageScore, stageRun.config.target);
    drawLives(ctx, scoring.lives, viewW);
    drawIncenseTimer(ctx, viewW, viewH, stageRun.timeFraction());
    drawEffects(ctx, effects.remaining(now));
    for (const s of slots) {
      if (s.pos) drawKatana(ctx, s.pos.x, s.pos.y, s.angle);
    }
  } else if (flow.state === "stageclear") {
    drawStageBanner(
      ctx,
      viewW,
      viewH,
      stageRun.stage,
      stageRun.next().config.target,
      Math.min(1, (now - stageClearStartedAt) / STAGECLEAR_MS)
    );
    drawScore(ctx, scoring.score, bestScore.value);
    drawLives(ctx, scoring.lives, viewW);
  } else if (flow.state === "gameover") {
    drawGameOverPanel(ctx, viewW, viewH, scoring.score, bestScore.value, isNewRecord);
    ctx.font = `400 18px ${FONT_STACK}`;
    ctx.fillStyle = "rgba(42, 35, 32, 0.65)";
    ctx.textAlign = "center";
    const stageLabel = `止步第${stageRun.stage}幕`;
    ctx.fillText(
      gameOverReason === "bomb"
        ? `墨爆三度，刀已卷刃 —— ${stageLabel}`
        : `一炷香尽，还差 ${finalShortfall} 分 —— ${stageLabel}`,
      viewW / 2,
      viewH * 0.44
    );
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
      },
      get stage() {
        return {
          n: stageRun.stage,
          stageScore: stageRun.stageScore,
          target: stageRun.config.target,
          remainingMs: stageRun.remainingMs
        };
      },
      // Synchronous single frame — lets headless tests pump the loop directly,
      // immune to hidden-tab timer throttling.
      step() {
        tick(performance.now());
      }
    }
  });
}

function tick(now: number): void {
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
    if (flow.state === "stageclear" && now - stageClearStartedAt >= STAGECLEAR_MS) {
      stageRun = stageRun.next();
      setSeason(seasonForStage(stageRun.stage));
      flow.stageClearDone();
      nextWaveAt = now + 500;
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
}

function frame(): void {
  tick(performance.now());
  schedule(frame);
}

schedule(frame);
