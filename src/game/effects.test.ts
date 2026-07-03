import { describe, expect, it } from "vitest";
import { Effects } from "./effects";

describe("Effects", () => {
  it("fu_slow slows time to 0.5 for 3 seconds", () => {
    const e = new Effects();
    expect(e.timeScale(1000)).toBe(1);
    e.activate("fu_slow", 1000);
    expect(e.timeScale(1001)).toBe(0.5);
    expect(e.timeScale(3999)).toBe(0.5);
    expect(e.timeScale(4001)).toBe(1);
  });

  it("fu_double doubles the score multiplier for 6 seconds", () => {
    const e = new Effects();
    expect(e.scoreMultiplier(1000)).toBe(1);
    e.activate("fu_double", 1000);
    expect(e.scoreMultiplier(1001)).toBe(2);
    expect(e.scoreMultiplier(6999)).toBe(2);
    expect(e.scoreMultiplier(7001)).toBe(1);
  });

  it("reports remaining seconds for the HUD", () => {
    const e = new Effects();
    e.activate("fu_slow", 1000);
    e.activate("fu_double", 1000);
    const r = e.remaining(2000);
    expect(r.slow).toBeCloseTo(2);
    expect(r.double).toBeCloseTo(5);
  });

  it("reset clears all active effects", () => {
    const e = new Effects();
    e.activate("fu_slow", 1000);
    e.activate("fu_double", 1000);
    e.reset();
    expect(e.timeScale(1001)).toBe(1);
    expect(e.scoreMultiplier(1001)).toBe(1);
  });
});
