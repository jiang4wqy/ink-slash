import { describe, expect, it } from "vitest";
import { GRAVITY } from "./fruit";
import { Spawner } from "./spawner";
import { stageConfig } from "./stage";

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

describe("Spawner.next (stage-config driven)", () => {
  it("respects the stage's wave-size cap, plus at most one bonus talisman", () => {
    const s = new Spawner(lcg(7));
    for (let i = 0; i < 50; i += 1) {
      const wave = s.next(stageConfig(1), W, H);
      const fruitsOnly = wave.filter((f) => !f.kind.startsWith("fu_"));
      expect(fruitsOnly.length).toBeGreaterThanOrEqual(1);
      expect(fruitsOnly.length).toBeLessThanOrEqual(stageConfig(1).maxWave);
    }
    let sawMax = false;
    for (let i = 0; i < 60; i += 1) {
      const wave = s.next(stageConfig(6), W, H);
      const fruitsOnly = wave.filter((f) => !f.kind.startsWith("fu_"));
      expect(fruitsOnly.length).toBeLessThanOrEqual(stageConfig(6).maxWave);
      expect(wave.length).toBeLessThanOrEqual(stageConfig(6).maxWave + 1);
      if (fruitsOnly.length === stageConfig(6).maxWave) sawMax = true;
    }
    expect(sawMax).toBe(true);
  });

  it("launches every fruit from below the bottom edge with an apex 35%-85% up the screen", () => {
    const s = new Spawner(lcg(21));
    for (let i = 0; i < 40; i += 1) {
      for (const f of s.next(stageConfig(3), W, H)) {
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
      for (const f of s.next(stageConfig(2), W, H)) {
        if (f.x < W / 2) expect(f.vx).toBeGreaterThan(0);
        else expect(f.vx).toBeLessThan(0);
      }
    }
  });

  it("never spawns bombs or talismans when the stage config forbids them", () => {
    const s = new Spawner(lcg(11));
    for (let i = 0; i < 80; i += 1) {
      const wave = s.next(stageConfig(1), W, H); // stage 1: bombChance 0, talismanChance 0
      expect(wave.every((f) => f.kind !== "bomb" && !f.kind.startsWith("fu_"))).toBe(true);
    }
  });

  it("spawns bombs and talismans at later stages, never a bomb-only wave", () => {
    const s = new Spawner(lcg(13));
    let sawBomb = false;
    let sawTalisman = false;
    for (let i = 0; i < 300; i += 1) {
      const wave = s.next(stageConfig(4), W, H);
      const talismans = wave.filter((f) => f.kind.startsWith("fu_"));
      expect(talismans.length).toBeLessThanOrEqual(1);
      if (talismans.length === 1) sawTalisman = true;
      if (wave.some((f) => f.kind === "bomb")) {
        sawBomb = true;
        expect(wave.some((f) => f.kind !== "bomb")).toBe(true);
      }
    }
    expect(sawBomb).toBe(true);
    expect(sawTalisman).toBe(true);
  });

  it("assigns unique ids across waves", () => {
    const s = new Spawner(lcg(5));
    const ids = new Set<number>();
    for (let i = 0; i < 20; i += 1) {
      for (const f of s.next(stageConfig(5), W, H)) {
        expect(ids.has(f.id)).toBe(false);
        ids.add(f.id);
      }
    }
  });
});
