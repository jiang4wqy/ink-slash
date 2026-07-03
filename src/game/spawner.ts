import { GRAVITY, makeFruit } from "./fruit";
import type { Fruit, FruitKind } from "./fruit";
import type { StageConfig } from "./stage";

const FRUIT_KINDS: FruitKind[] = ["persimmon", "plum", "watermelon", "gourd"];
const TALISMAN_KINDS: FruitKind[] = ["fu_slow", "fu_double", "fu_life"];

const RADII: Record<FruitKind, number> = {
  persimmon: 44,
  plum: 34,
  watermelon: 60,
  gourd: 48,
  bomb: 34,
  fu_slow: 30,
  fu_double: 30,
  fu_life: 30
};

// Wave generation is driven entirely by the current stage's config — density,
// bomb danger and talisman generosity all come from stage.ts.
export class Spawner {
  private nextId = 1;

  constructor(private readonly rng: () => number) {}

  next(cfg: StageConfig, w: number, h: number): Fruit[] {
    const size = Math.max(
      1,
      Math.min(cfg.maxWave, Math.ceil(cfg.maxWave * (0.5 + this.rng() * 0.5)))
    );
    const wave: Fruit[] = [];
    for (let i = 0; i < size; i += 1) {
      wave.push(this.spawnOne(w, h));
    }

    // A bomb may replace one fruit — never all of them.
    if (wave.length >= 2 && this.rng() < cfg.bombChance) {
      const target = wave[Math.floor(this.rng() * wave.length)];
      target.kind = "bomb";
      target.r = RADII.bomb;
    }

    // At most one talisman rides along as a bonus (extra, replaces nothing).
    if (this.rng() < cfg.talismanChance) {
      const kind = TALISMAN_KINDS[Math.floor(this.rng() * TALISMAN_KINDS.length)];
      const talisman = this.spawnOne(w, h);
      talisman.kind = kind;
      talisman.r = RADII[kind];
      wave.push(talisman);
    }
    return wave;
  }

  private spawnOne(w: number, h: number): Fruit {
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
