import { describe, expect, it } from "vitest";
import { mapNormToCanvas } from "./coords";

describe("mapNormToCanvas", () => {
  it("is a straight scale when video and canvas share the aspect ratio", () => {
    const p = mapNormToCanvas(0.5, 0.5, 16 / 9, 1280, 720);
    expect(p.x).toBeCloseTo(640);
    expect(p.y).toBeCloseTo(360);
    const q = mapNormToCanvas(0.25, 0.75, 16 / 9, 1280, 720);
    expect(q.x).toBeCloseTo(320);
    expect(q.y).toBeCloseTo(540);
  });

  it("crops top/bottom (object-fit cover) when the video is taller than the canvas", () => {
    // 4:3 video on a 16:9 canvas: horizontal fills, vertical is cropped.
    // Landmark at the very top of the video frame maps ABOVE the canvas.
    const top = mapNormToCanvas(0.5, 0, 4 / 3, 1920, 1080);
    expect(top.x).toBeCloseTo(960);
    expect(top.y).toBeLessThan(0);
    // The vertical centre still maps to the canvas centre.
    const mid = mapNormToCanvas(0.5, 0.5, 4 / 3, 1920, 1080);
    expect(mid.y).toBeCloseTo(540);
  });

  it("crops left/right when the video is wider than the canvas", () => {
    // 21:9 video on a 16:9 canvas: vertical fills, horizontal is cropped.
    const left = mapNormToCanvas(0, 0.5, 21 / 9, 1280, 720);
    expect(left.x).toBeLessThan(0);
    const mid = mapNormToCanvas(0.5, 0.5, 21 / 9, 1280, 720);
    expect(mid.x).toBeCloseTo(640);
  });
});
