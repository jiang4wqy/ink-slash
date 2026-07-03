import { describe, expect, it } from "vitest";
import { BestScore, Scoring } from "./scoring";

describe("Scoring", () => {
  it("awards 10 points for a single slice", () => {
    const s = new Scoring();
    const r = s.addSlice(1000);
    expect(r.combo).toBe(1);
    expect(s.score).toBe(10);
  });

  it("builds a combo inside the 400ms window and pays N×10 bonus at each new depth", () => {
    const s = new Scoring();
    s.addSlice(1000); // 10
    const second = s.addSlice(1200); // 10 + bonus 20
    expect(second.combo).toBe(2);
    const third = s.addSlice(1399); // 10 + bonus 30
    expect(third.combo).toBe(3);
    expect(s.score).toBe(10 + (10 + 20) + (10 + 30));
  });

  it("resets the combo outside the window", () => {
    const s = new Scoring();
    s.addSlice(1000);
    s.addSlice(1200);
    const later = s.addSlice(1700); // window measured from last slice (1200): 500ms gap
    expect(later.combo).toBe(1);
  });

  it("counts down 3 lives on misses and reports game over at zero", () => {
    const s = new Scoring();
    expect(s.lives).toBe(3);
    expect(s.missFruit()).toBe(2);
    expect(s.missFruit()).toBe(1);
    expect(s.missFruit()).toBe(0);
  });

  it("applies a score multiplier to base points and combo bonus", () => {
    const s = new Scoring();
    s.addSlice(1000, 2); // 10 × 2 = 20
    expect(s.score).toBe(20);
    const second = s.addSlice(1200, 2); // (10 + 20) × 2 = 60
    expect(second.gained).toBe(60);
    expect(s.score).toBe(80);
  });

  it("restoreLife adds one ink drop, capped at 3", () => {
    const s = new Scoring();
    expect(s.restoreLife()).toBe(3); // already full
    s.missFruit();
    s.missFruit();
    expect(s.restoreLife()).toBe(2);
    expect(s.lives).toBe(2);
  });

  it("reset restores score, combo and lives", () => {
    const s = new Scoring();
    s.addSlice(1000);
    s.missFruit();
    s.reset();
    expect(s.score).toBe(0);
    expect(s.lives).toBe(3);
    expect(s.addSlice(5000).combo).toBe(1);
  });
});

describe("BestScore", () => {
  function memoryStorage(): { get: () => string | null; set: (v: string) => void; writes: number } {
    let value: string | null = null;
    const box = {
      writes: 0,
      get: () => value,
      set: (v: string) => {
        value = v;
        box.writes += 1;
      }
    };
    return box;
  }

  it("starts from the stored value and only writes on a new record", () => {
    const storage = memoryStorage();
    storage.set("120");
    storage.writes = 0;

    const best = new BestScore(storage);
    expect(best.value).toBe(120);
    expect(best.update(80)).toBe(false);
    expect(storage.writes).toBe(0);
    expect(best.update(200)).toBe(true);
    expect(best.value).toBe(200);
    expect(storage.writes).toBe(1);
  });

  it("treats corrupt storage as zero", () => {
    const storage = memoryStorage();
    storage.set("not-a-number");
    const best = new BestScore(storage);
    expect(best.value).toBe(0);
  });
});
