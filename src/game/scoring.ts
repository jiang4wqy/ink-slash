const POINTS_PER_FRUIT = 10;
const COMBO_WINDOW_MS = 400;
const STARTING_LIVES = 3;

// Score, combo chain and bomb tolerance (`lives` = ink drops left; each bomb
// hit costs one). Pure logic: time comes in as a parameter so tests (and the
// slow-motion timescale) stay in control of the clock.
export class Scoring {
  score = 0;
  lives = STARTING_LIVES;
  private comboCount = 0;
  private lastSliceAt = -Infinity;

  // Registers one sliced fruit at time `t` (ms). Returns the combo depth this
  // slice reached and the points it earned ((base + combo bonus) × multiplier,
  // where the multiplier comes from an active 「倍」 talisman).
  addSlice(t: number, multiplier = 1): { combo: number; gained: number } {
    this.comboCount = t - this.lastSliceAt <= COMBO_WINDOW_MS ? this.comboCount + 1 : 1;
    this.lastSliceAt = t;

    const bonus = this.comboCount >= 2 ? this.comboCount * 10 : 0;
    const gained = (POINTS_PER_FRUIT + bonus) * multiplier;
    this.score += gained;
    return { combo: this.comboCount, gained };
  }

  // Sliced a bomb. Three strikes and the run ends. Returns remaining drops.
  hitBomb(): number {
    this.lives = Math.max(0, this.lives - 1);
    return this.lives;
  }

  // 「墨」 talisman: one ink drop back, never above the starting three.
  restoreLife(): number {
    this.lives = Math.min(STARTING_LIVES, this.lives + 1);
    return this.lives;
  }

  reset(): void {
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.comboCount = 0;
    this.lastSliceAt = -Infinity;
  }
}

// Best score behind an injectable storage so tests never touch localStorage.
export class BestScore {
  value: number;

  constructor(private readonly storage: { get: () => string | null; set: (v: string) => void }) {
    const raw = Number(storage.get());
    this.value = Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  // Returns true (and persists) only when `score` beats the record.
  update(score: number): boolean {
    if (score <= this.value) return false;
    this.value = score;
    this.storage.set(String(score));
    return true;
  }
}
