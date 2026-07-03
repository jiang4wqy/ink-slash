import { describe, expect, it } from "vitest";
import { StageRun, stageConfig } from "./stage";

describe("stageConfig", () => {
  it("stage 1 is a gentle opening: no bombs, small slow waves", () => {
    const c = stageConfig(1);
    expect(c.bombChance).toBe(0);
    expect(c.maxWave).toBe(2);
    expect(c.waveIntervalMs).toBe(2200);
    expect(c.target).toBe(100);
    expect(c.durationMs).toBe(40000);
    expect(c.talismanChance).toBe(0);
  });

  it("later stages get faster, denser, more dangerous — with floors and caps", () => {
    const c5 = stageConfig(5);
    expect(c5.waveIntervalMs).toBeLessThan(stageConfig(2).waveIntervalMs);
    expect(c5.maxWave).toBeGreaterThan(stageConfig(2).maxWave);
    expect(c5.bombChance).toBeGreaterThan(0);
    expect(stageConfig(20).waveIntervalMs).toBeGreaterThanOrEqual(1000);
    expect(stageConfig(20).maxWave).toBeLessThanOrEqual(7);
    expect(stageConfig(20).bombChance).toBeLessThanOrEqual(0.16);
    expect(stageConfig(2).talismanChance).toBeGreaterThan(0);
  });

  it("targets climb monotonically", () => {
    expect(stageConfig(2).target).toBeGreaterThan(stageConfig(1).target);
    expect(stageConfig(3).target).toBeGreaterThan(stageConfig(2).target);
  });
});

describe("StageRun", () => {
  it("tracks stage score and clears when the target is reached in time", () => {
    const run = new StageRun(1);
    expect(run.stage).toBe(1);
    run.tick(10000); // 10s pass
    run.addPoints(stageConfig(1).target);
    expect(run.cleared).toBe(true);
    expect(run.failed).toBe(false);
  });

  it("fails when time runs out below the target", () => {
    const run = new StageRun(1);
    run.addPoints(stageConfig(1).target - 10);
    run.tick(40001);
    expect(run.failed).toBe(true);
    expect(run.cleared).toBe(false);
    expect(run.shortfall).toBe(10);
  });

  it("advances to the next stage with a fresh clock and score", () => {
    const run = new StageRun(1);
    run.addPoints(200);
    const next = run.next();
    expect(next.stage).toBe(2);
    expect(next.stageScore).toBe(0);
    expect(next.remainingMs).toBe(stageConfig(2).durationMs);
  });

  it("reports remaining time as a 0..1 fraction for the incense-stick HUD", () => {
    const run = new StageRun(1);
    expect(run.timeFraction()).toBeCloseTo(1);
    run.tick(20000);
    expect(run.timeFraction()).toBeCloseTo(0.5);
    run.tick(30000);
    expect(run.timeFraction()).toBe(0);
  });
});
