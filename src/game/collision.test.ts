import { describe, expect, it } from "vitest";
import { segmentCircleHit } from "./collision";

describe("segmentCircleHit", () => {
  it("hits when the segment passes through the circle centre", () => {
    expect(segmentCircleHit(0, 50, 100, 50, 50, 50, 10)).toBe(true);
  });

  it("hits when only an endpoint is inside the circle", () => {
    expect(segmentCircleHit(48, 50, 200, 200, 50, 50, 10)).toBe(true);
  });

  it("hits a small circle swept over by a long fast-swipe segment", () => {
    // Two frames of a fast slash: (0,0) -> (800,600); fruit r=24 sits on the path.
    expect(segmentCircleHit(0, 0, 800, 600, 400, 300, 24)).toBe(true);
  });

  it("misses a parallel segment outside the radius", () => {
    expect(segmentCircleHit(0, 0, 100, 0, 50, 30, 10)).toBe(false);
  });

  it("misses when the near endpoint stops short of the circle", () => {
    expect(segmentCircleHit(0, 50, 30, 50, 50, 50, 10)).toBe(false);
  });

  it("degenerates to a point test for a zero-length segment", () => {
    expect(segmentCircleHit(50, 50, 50, 50, 52, 50, 5)).toBe(true);
    expect(segmentCircleHit(50, 50, 50, 50, 70, 50, 5)).toBe(false);
  });
});
