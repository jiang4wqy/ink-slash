export type BladePoint = { x: number; y: number; t: number };

export type BladeSegment = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  speed: number; // px/s
  armed: boolean;
};

const GATE_PX_PER_S = 600; // at the 720px reference viewport height
const REFERENCE_VIEW_H = 720;
const TRAIL_MS = 300;

// One blade (fingertip or mouse pointer). Feed filtered points in; get back
// the swept segment since the last point, with the velocity gate applied so a
// slow drift never slices. The trail buffer feeds the ink-stroke renderer.
export class Blade {
  private points: BladePoint[] = [];
  private hasSegment = false;

  push(p: BladePoint, viewH: number): BladeSegment | null {
    const prev = this.hasSegment ? this.points[this.points.length - 1] : undefined;
    this.points.push(p);
    this.prune(p.t);

    if (!prev) {
      this.hasSegment = true;
      return null;
    }

    const dt = Math.max(1, p.t - prev.t) / 1000;
    const speed = Math.hypot(p.x - prev.x, p.y - prev.y) / dt;
    const gate = (GATE_PX_PER_S * viewH) / REFERENCE_VIEW_H;
    return { ax: prev.x, ay: prev.y, bx: p.x, by: p.y, speed, armed: speed >= gate };
  }

  trail(now: number): BladePoint[] {
    this.prune(now);
    return this.points;
  }

  // Hand lost / stroke ended: break the segment chain AND drop the trail, so
  // the polyline renderer never draws a jump-line from the old stroke to the
  // next one.
  clear(): void {
    this.hasSegment = false;
    this.points = [];
  }

  private prune(now: number): void {
    const cutoff = now - TRAIL_MS;
    while (this.points.length > 0 && this.points[0].t < cutoff) {
      this.points.shift();
    }
  }
}
