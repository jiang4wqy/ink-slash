// One Euro filter — adaptive low-pass: heavy smoothing when still (no jitter),
// light smoothing during fast motion (low latency). The right filter for a
// slashing fingertip, where lag directly ruins the blade feel.

// BETA tuned for slashing: latency during a fast sweep must stay under one
// frame of travel (see oneEuro.test.ts), which needs cutoff ≳ 4.8Hz at
// 1.2 screens/s. When still the derivative ≈ 0, so jitter suppression keeps
// working at MIN_CUTOFF regardless of BETA.
const MIN_CUTOFF = 1.2;
const BETA = 3.5;
const D_CUTOFF = 1;

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class OneEuroAxis {
  private hasPrev = false;
  private prevValue = 0;
  private prevDeriv = 0;

  filter(value: number, dt: number): number {
    if (!this.hasPrev) {
      this.hasPrev = true;
      this.prevValue = value;
      return value;
    }
    const dValue = (value - this.prevValue) / dt;
    const aD = alpha(D_CUTOFF, dt);
    const deriv = aD * dValue + (1 - aD) * this.prevDeriv;
    this.prevDeriv = deriv;

    const cutoff = MIN_CUTOFF + BETA * Math.abs(deriv);
    const a = alpha(cutoff, dt);
    const result = a * value + (1 - a) * this.prevValue;
    this.prevValue = result;
    return result;
  }
}

export class OneEuroFilter2D {
  private readonly ax = new OneEuroAxis();
  private readonly ay = new OneEuroAxis();

  filter(p: { x: number; y: number }, dtSec: number): { x: number; y: number } {
    const dt = Math.min(0.1, Math.max(0.001, dtSec));
    return { x: this.ax.filter(p.x, dt), y: this.ay.filter(p.y, dt) };
  }
}
