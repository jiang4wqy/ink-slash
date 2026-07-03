import { describe, expect, it } from "vitest";
import { isOffscreen, makeFruit, sliceFruit, stepFruit } from "./fruit";
import type { Fruit } from "./fruit";

const G = 1800; // px/s^2, the game's gravity

function sample(overrides: Partial<Fruit> = {}): Fruit {
  return {
    ...makeFruit({ id: 1, kind: "persimmon", x: 100, y: 500, vx: 40, vy: -900, r: 34 }),
    ...overrides
  };
}

describe("stepFruit", () => {
  it("integrates gravity: velocity then position", () => {
    const f = sample();
    stepFruit(f, 0.1, G);
    expect(f.vy).toBeCloseTo(-900 + G * 0.1);
    expect(f.y).toBeCloseTo(500 + (-900 + G * 0.1) * 0.1);
    expect(f.x).toBeCloseTo(100 + 40 * 0.1);
  });

  it("advances rotation by angular velocity", () => {
    const f = sample({ rot: 0, vrot: 2 });
    stepFruit(f, 0.5, G);
    expect(f.rot).toBeCloseTo(1);
  });
});

describe("sliceFruit", () => {
  it("marks the fruit sliced and splits it into two halves separating along the cut normal", () => {
    const f = sample();
    // Horizontal cut (blade direction 1,0) => normal is (0,±1): halves part vertically.
    const [a, b] = sliceFruit(f, 1, 0);
    expect(f.sliced).toBe(true);
    expect(Math.sign(a.vy - f.vy)).toBe(-Math.sign(b.vy - f.vy));
    expect(Math.abs(a.vx - b.vx)).toBeLessThan(Math.abs(a.vy - b.vy)); // mostly vertical separation
    expect(a.kind).toBe(f.kind);
    expect(a.cutAngle).toBeCloseTo(b.cutAngle);
  });

  it("halves spin in opposite directions", () => {
    const [a, b] = sliceFruit(sample(), 0, 1);
    expect(Math.sign(a.vrot)).toBe(-Math.sign(b.vrot));
  });

  it("falls back to the fruit's own travel direction for a zero-length cut (touch slice)", () => {
    // A stationary fingertip touched by a falling fruit: cut dir (0,0).
    const f = sample({ vx: 0, vy: 300 }); // falling straight down
    const [a, b] = sliceFruit(f, 0, 0);
    // Halves must still separate (perpendicular to the fall = horizontally).
    expect(Math.abs(a.vx - b.vx)).toBeGreaterThan(50);
    expect(Number.isFinite(a.cutAngle)).toBe(true);
  });
});

describe("isOffscreen", () => {
  it("is true only after falling below the bottom edge", () => {
    expect(isOffscreen(sample({ y: 900 + 35, vy: 100 }), 1280, 900)).toBe(true);
    expect(isOffscreen(sample({ y: 100 }), 1280, 900)).toBe(false);
  });

  it("is false while still rising below the bottom (spawn phase)", () => {
    expect(isOffscreen(sample({ y: 950, vy: -800 }), 1280, 900)).toBe(false);
  });
});
