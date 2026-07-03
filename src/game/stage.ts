// Stage (幕) system: each stage is a timed act with a score target. Reaching
// the target advances to a faster, denser act; running out of time ends the
// run. Bombs are the other failure axis (handled by Scoring's ink drops).

export type StageConfig = {
  target: number;
  durationMs: number;
  waveIntervalMs: number;
  maxWave: number;
  bombChance: number;
  talismanChance: number;
};

export function stageConfig(n: number): StageConfig {
  return {
    target: 100 + (n - 1) * 70,
    durationMs: 40000,
    waveIntervalMs: Math.max(1000, 2200 - (n - 1) * 150),
    maxWave: Math.min(7, 1 + n),
    bombChance: n === 1 ? 0 : Math.min(0.16, 0.04 + 0.02 * n),
    talismanChance: n >= 2 ? 0.09 : 0
  };
}

// One stage in progress. Time is fed in as (scaled) elapsed ms so the 「凍」
// talisman naturally freezes the incense clock along with the world.
export class StageRun {
  readonly stage: number;
  readonly config: StageConfig;
  stageScore = 0;
  remainingMs: number;

  constructor(stage: number) {
    this.stage = stage;
    this.config = stageConfig(stage);
    this.remainingMs = this.config.durationMs;
  }

  tick(elapsedMs: number): void {
    this.remainingMs = Math.max(0, this.remainingMs - elapsedMs);
  }

  addPoints(points: number): void {
    this.stageScore += points;
  }

  get cleared(): boolean {
    return this.stageScore >= this.config.target;
  }

  get failed(): boolean {
    return this.remainingMs <= 0 && !this.cleared;
  }

  get shortfall(): number {
    return Math.max(0, this.config.target - this.stageScore);
  }

  next(): StageRun {
    return new StageRun(this.stage + 1);
  }

  timeFraction(): number {
    return this.remainingMs / this.config.durationMs;
  }
}
