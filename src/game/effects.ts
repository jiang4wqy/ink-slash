// Talisman power-up effects. Time comes in as a parameter (ms) so the logic
// stays pure and testable; life restoration lives in Scoring.restoreLife.

export type TalismanKind = "fu_slow" | "fu_double" | "fu_life";

const SLOW_MS = 3000;
const SLOW_SCALE = 0.5;
const DOUBLE_MS = 6000;

export class Effects {
  private slowUntil = 0;
  private doubleUntil = 0;

  activate(kind: TalismanKind, now: number): void {
    if (kind === "fu_slow") this.slowUntil = now + SLOW_MS;
    else if (kind === "fu_double") this.doubleUntil = now + DOUBLE_MS;
    // fu_life is a one-shot handled by the caller (Scoring.restoreLife).
  }

  timeScale(now: number): number {
    return now < this.slowUntil ? SLOW_SCALE : 1;
  }

  scoreMultiplier(now: number): 1 | 2 {
    return now < this.doubleUntil ? 2 : 1;
  }

  // Remaining seconds per effect (0 when inactive) — feeds the HUD readout.
  remaining(now: number): { slow: number; double: number } {
    return {
      slow: Math.max(0, (this.slowUntil - now) / 1000),
      double: Math.max(0, (this.doubleUntil - now) / 1000)
    };
  }

  reset(): void {
    this.slowUntil = 0;
    this.doubleUntil = 0;
  }
}
