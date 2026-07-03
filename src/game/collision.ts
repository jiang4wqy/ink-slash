// Swept-segment vs circle test. The blade between two frames is a segment;
// testing the segment (not just the sample points) means a fast slash at 30fps
// cannot tunnel through a fruit.
export function segmentCircleHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  // Closest point on the segment to the circle centre (t clamped to [0,1];
  // a zero-length segment degenerates to the point A).
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lenSq));
  const px = ax + t * dx;
  const py = ay + t * dy;
  const distSq = (cx - px) * (cx - px) + (cy - py) * (cy - py);
  return distSq <= r * r;
}
