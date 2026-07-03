export type FruitKind = "persimmon" | "plum" | "watermelon" | "gourd" | "bomb";

export type Fruit = {
  id: number;
  kind: FruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
  sliced: boolean;
};

// A separated half of a sliced fruit; `side` picks which half of the clip to
// draw, `cutAngle` is the cut line's angle so both halves share the same seam.
export type FruitHalf = {
  kind: FruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
  cutAngle: number;
  side: 1 | -1;
  age: number;
};

export function makeFruit(init: {
  id: number;
  kind: FruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}): Fruit {
  return { ...init, rot: 0, vrot: 0, sliced: false };
}

export function stepFruit(f: { x: number; y: number; vx: number; vy: number; rot: number; vrot: number }, dt: number, g: number): void {
  f.vy += g * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.rot += f.vrot * dt;
}

const SEPARATION_SPEED = 140; // px/s along the cut normal
const HALF_SPIN = 2.4; // rad/s, opposite for each half

// Splits a fruit along the blade direction (dirX, dirY): halves inherit the
// fruit's velocity plus opposite kicks along the cut normal.
export function sliceFruit(f: Fruit, dirX: number, dirY: number): [FruitHalf, FruitHalf] {
  f.sliced = true;
  const len = Math.hypot(dirX, dirY) || 1;
  const nx = -dirY / len;
  const ny = dirX / len;
  const cutAngle = Math.atan2(dirY, dirX);

  const half = (side: 1 | -1): FruitHalf => ({
    kind: f.kind,
    x: f.x + nx * side * f.r * 0.12,
    y: f.y + ny * side * f.r * 0.12,
    vx: f.vx + nx * side * SEPARATION_SPEED,
    vy: f.vy + ny * side * SEPARATION_SPEED,
    r: f.r,
    rot: f.rot,
    vrot: f.vrot + side * HALF_SPIN,
    cutAngle,
    side,
    age: 0
  });

  return [half(1), half(-1)];
}

export function isOffscreen(f: { y: number; vy: number; r: number }, _w: number, h: number): boolean {
  return f.y > h + f.r && f.vy > 0;
}
