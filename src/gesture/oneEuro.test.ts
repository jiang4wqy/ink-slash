import { describe, expect, it } from "vitest";
import { OneEuroFilter2D } from "./oneEuro";

const DT = 1 / 30;

describe("OneEuroFilter2D", () => {
  it("returns the first sample unchanged", () => {
    const f = new OneEuroFilter2D();
    const out = f.filter({ x: 0.42, y: 0.77 }, DT);
    expect(out.x).toBeCloseTo(0.42);
    expect(out.y).toBeCloseTo(0.77);
  });

  it("suppresses jitter when the point is nearly still", () => {
    const f = new OneEuroFilter2D();
    // Noisy samples around a fixed centre; deterministic pseudo-noise.
    const centre = { x: 0.5, y: 0.5 };
    const noise = (i: number) => Math.sin(i * 12.9898) * 0.004;
    let inVar = 0;
    let outVar = 0;
    let out = f.filter(centre, DT);
    for (let i = 1; i <= 120; i += 1) {
      const p = { x: centre.x + noise(i), y: centre.y + noise(i * 1.7) };
      out = f.filter(p, DT);
      if (i > 20) {
        // skip warm-up
        inVar += (p.x - centre.x) ** 2;
        outVar += (out.x - centre.x) ** 2;
      }
    }
    // The filter must remove most of the stationary jitter energy.
    expect(outVar).toBeLessThan(inVar * 0.25);
  });

  it("keeps lag under one frame of travel during fast motion", () => {
    const f = new OneEuroFilter2D();
    // Fast horizontal sweep: 1.2 screen-widths per second.
    const speed = 1.2;
    let x = 0;
    let out = f.filter({ x, y: 0.5 }, DT);
    for (let i = 0; i < 30; i += 1) {
      x += speed * DT;
      out = f.filter({ x, y: 0.5 }, DT);
    }
    const lag = x - out.x;
    expect(lag).toBeLessThan(speed * DT); // less than one frame behind
  });
});
