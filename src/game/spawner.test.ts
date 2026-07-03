import { describe, expect, it } from "vitest";
import { GRAVITY } from "./fruit";
import { Spawner, bombChance, waveInterval } from "./spawner";

// Deterministic LCG so wave assertions are reproducible.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const W = 1280;
const H = 900;

describe("bombChance", () => {
  it("ramps linearly from 8% to 15%, capped at 500 points", () => {
    expect(bombChance(0)).toBeCloseTo(0.08);
    expect(bombChance(250)).toBeCloseTo(0.115);
    expect(bombChance(500)).toBeCloseTo(0.15);
    expect(bombChance(1000)).toBeCloseTo(0.15);
  });
});

describe("waveInterval", () => {
  it("starts at 1900ms and tightens to a 1100ms floor as score climbs", () => {
    expect(waveInterval(0)).toBe(1900);
    expect(waveInterval(200)).toBeLessThan(1900);
    expect(waveInterval(200)).toBeGreaterThan(1100);
    expect(waveInterval(2000)).toBe(1100);
  });
});

describe("Spawner.next", () => {
  it("spawns 1-2 fruits early and up to 7 (never more) at high score", () => {
    const s = new Spawner(lcg(7));
    for (let i = 0; i < 50; i += 1) {
      const early = s.next(0, W, H).length;
      expect(early).toBeGreaterThanOrEqual(1);
      expect(early).toBeLessThanOrEqual(2);
    }
    let sawSeven = false;
    for (let i = 0; i < 60; i += 1) {
      const wave = s.next(800, W, H);
      const fruitsOnly = wave.filter((f) => !f.kind.startsWith("fu_"));
      expect(fruitsOnly.length).toBeLessThanOrEqual(7); // fruit cap
      expect(wave.length).toBeLessThanOrEqual(8); // +1 bonus talisman at most
      if (fruitsOnly.length === 7) sawSeven = true;
    }
    expect(sawSeven).toBe(true);
  });

  it("ramps wave size gradually (循序渐进): mid-game waves sit between early and late", () => {
    const s = new Spawner(lcg(9));
    let midMax = 0;
    for (let i = 0; i < 50; i += 1) {
      midMax = Math.max(midMax, s.next(180, W, H).length);
    }
    expect(midMax).toBeGreaterThanOrEqual(3);
    expect(midMax).toBeLessThanOrEqual(5);
  });

  it("launches every fruit from below the bottom edge with an apex 35%-85% up the screen", () => {
    const s = new Spawner(lcg(21));
    for (let i = 0; i < 40; i += 1) {
      for (const f of s.next(200, W, H)) {
        expect(f.y).toBeGreaterThan(H); // enters from below
        expect(f.vy).toBeLessThan(0);
        const apexRise = (f.vy * f.vy) / (2 * GRAVITY); // height gained above launch
        const apexFromBottom = (apexRise - (f.y - H)) / H;
        expect(apexFromBottom).toBeGreaterThanOrEqual(0.35);
        expect(apexFromBottom).toBeLessThanOrEqual(0.85);
      }
    }
  });

  it("gives horizontal velocity pointing toward the screen interior", () => {
    const s = new Spawner(lcg(3));
    for (let i = 0; i < 40; i += 1) {
      for (const f of s.next(100, W, H)) {
        if (f.x < W / 2) expect(f.vx).toBeGreaterThan(0);
        else expect(f.vx).toBeLessThan(0);
      }
    }
  });

  it("never spawns bombs before 30 points, and never a bomb-only wave", () => {
    const s = new Spawner(lcg(11));
    for (let i = 0; i < 60; i += 1) {
      const wave = s.next(0, W, H);
      expect(wave.every((f) => f.kind !== "bomb")).toBe(true);
    }
    let sawBomb = false;
    for (let i = 0; i < 200; i += 1) {
      const wave = s.next(400, W, H);
      if (wave.some((f) => f.kind === "bomb")) {
        sawBomb = true;
        expect(wave.some((f) => f.kind !== "bomb")).toBe(true);
      }
    }
    expect(sawBomb).toBe(true);
  });

  it("spawns talismans only after 50 points, at most one per wave", () => {
    const s = new Spawner(lcg(13));
    for (let i = 0; i < 60; i += 1) {
      const wave = s.next(0, W, H);
      expect(wave.every((f) => !f.kind.startsWith("fu_"))).toBe(true);
    }
    let sawTalisman = false;
    for (let i = 0; i < 300; i += 1) {
      const wave = s.next(300, W, H);
      const talismans = wave.filter((f) => f.kind.startsWith("fu_"));
      expect(talismans.length).toBeLessThanOrEqual(1);
      if (talismans.length === 1) sawTalisman = true;
    }
    expect(sawTalisman).toBe(true);
  });

  it("assigns unique ids across waves", () => {
    const s = new Spawner(lcg(5));
    const ids = new Set<number>();
    for (let i = 0; i < 20; i += 1) {
      for (const f of s.next(300, W, H)) {
        expect(ids.has(f.id)).toBe(false);
        ids.add(f.id);
      }
    }
  });
});
