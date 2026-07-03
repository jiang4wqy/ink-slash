import { describe, expect, it } from "vitest";
import { Blade } from "./blade";

const VIEW_H = 720; // gate threshold at reference height = exactly 600 px/s

describe("Blade", () => {
  it("returns null for the first point (no segment yet)", () => {
    const b = new Blade();
    expect(b.push({ x: 100, y: 100, t: 0 }, VIEW_H)).toBeNull();
  });

  it("computes segment speed from the last two points", () => {
    const b = new Blade();
    b.push({ x: 0, y: 0, t: 0 }, VIEW_H);
    const seg = b.push({ x: 30, y: 40, t: 100 }, VIEW_H); // 50px in 0.1s = 500 px/s
    expect(seg).not.toBeNull();
    expect(seg!.speed).toBeCloseTo(500);
    expect(seg!.ax).toBe(0);
    expect(seg!.bx).toBe(30);
  });

  it("arms only above the 600 px/s gate (scaled by viewport height)", () => {
    const slow = new Blade();
    slow.push({ x: 0, y: 0, t: 0 }, VIEW_H);
    expect(slow.push({ x: 50, y: 0, t: 100 }, VIEW_H)!.armed).toBe(false); // 500 px/s

    const fast = new Blade();
    fast.push({ x: 0, y: 0, t: 0 }, VIEW_H);
    expect(fast.push({ x: 70, y: 0, t: 100 }, VIEW_H)!.armed).toBe(true); // 700 px/s

    // Double viewport height doubles the threshold: 700 px/s no longer arms.
    const tall = new Blade();
    tall.push({ x: 0, y: 0, t: 0 }, VIEW_H * 2);
    expect(tall.push({ x: 70, y: 0, t: 100 }, VIEW_H * 2)!.armed).toBe(false);
  });

  it("keeps only the last 300ms of trail points", () => {
    const b = new Blade();
    for (let i = 0; i <= 10; i += 1) {
      b.push({ x: i * 10, y: 0, t: i * 100 }, VIEW_H);
    }
    const trail = b.trail(1000);
    expect(trail.length).toBe(4); // t = 700, 800, 900, 1000
    expect(trail[0].t).toBe(700);
  });

  it("treats a teleport-sized jump as a new stroke, never an armed segment", () => {
    // A hand-tracking reorder can jump the point across the screen in one
    // frame; that must not produce a phantom slash.
    const b = new Blade();
    b.push({ x: 100, y: 100, t: 0 }, VIEW_H);
    const jump = b.push({ x: 100, y: 100 + VIEW_H * 0.5, t: 16 }, VIEW_H); // half a screen in 16ms
    expect(jump).toBeNull();
    // The next normal-speed point continues from the NEW location.
    const next = b.push({ x: 130, y: 100 + VIEW_H * 0.5, t: 116 }, VIEW_H);
    expect(next).not.toBeNull();
    expect(next!.ax).toBe(100);
    expect(next!.ay).toBe(100 + VIEW_H * 0.5);
  });

  it("clear resets the segment chain", () => {
    const b = new Blade();
    b.push({ x: 0, y: 0, t: 0 }, VIEW_H);
    b.clear();
    expect(b.push({ x: 10, y: 0, t: 50 }, VIEW_H)).toBeNull();
    expect(b.trail(50).length).toBe(1);
  });
});
