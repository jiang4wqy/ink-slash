import { GRAVITY, makeFruit } from "./fruit";
import type { Fruit, FruitKind } from "./fruit";

// Bomb probability ramps 8% -> 15% linearly, capped at 500 points.
export function bombChance(score: number): number {
  const t = Math.min(1, Math.max(0, score / 500));
  return 0.08 + t * 0.07;
}

const FRUIT_KINDS: FruitKind[] = ["persimmon", "plum", "watermelon", "gourd"];

const RADII: Record<FruitKind, number> = {
  persimmon: 34,
  plum: 26,
  watermelon: 46,
  gourd: 38,
  bomb: 30
};

const NO_BOMB_BEFORE = 30; // opening waves stay safe

export class Spawner {
  private nextId = 1;

  constructor(private readonly rng: () => number) {}

  next(score: number, w: number, h: number): Fruit[] {
    const size = Math.min(5, 1 + Math.floor(score / 120) + (this.rng() < 0.4 ? 1 : 0));
    const wave: Fruit[] = [];
    for (let i = 0; i < size; i += 1) {
      wave.push(this.spawnOne(score, w, h));
    }

    // A bomb may replace one fruit — never all of them, never in the opening.
    if (score >= NO_BOMB_BEFORE && wave.length >= 2 && this.rng() < bombChance(score)) {
      const target = wave[Math.floor(this.rng() * wave.length)];
      target.kind = "bomb";
      target.r = RADII.bomb;
    }
    return wave;
  }

  private spawnOne(_score: number, w: number, h: number): Fruit {
    const kind = FRUIT_KINDS[Math.floor(this.rng() * FRUIT_KINDS.length)];
    const r = RADII[kind];
    const x = w * (0.08 + this.rng() * 0.84);

    // Launch from just below the bottom; pick the apex as a fraction of the
    // screen height and solve the kinematics backwards (vy = -sqrt(2·g·rise)).
    const y = h + r;
    const apexFromBottom = 0.4 + this.rng() * 0.4; // 40%-80% up the screen
    const rise = apexFromBottom * h + r;
    const vy = -Math.sqrt(2 * GRAVITY * rise);

    const inward = x < w / 2 ? 1 : -1;
    const vx = inward * (10 + this.rng() * 80);

    const fruit = makeFruit({ id: this.nextId, kind, x, y, vx, vy, r });
    this.nextId += 1;
    fruit.vrot = (this.rng() - 0.5) * 4;
    return fruit;
  }
}
