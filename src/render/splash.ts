// Ink & juice feedback: flying droplets and persistent wash blots that soak
// into the paper and fade. Object list capped so long play sessions never
// accumulate unbounded draw work.

type Droplet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  age: number;
  life: number;
};

type Blot = {
  x: number;
  y: number;
  r: number;
  color: string;
  age: number;
  life: number;
  lobes: { ang: number; dist: number; r: number }[];
};

const MAX_DROPLETS = 90;
const MAX_BLOTS = 30;
const DROPLET_GRAVITY = 900;

export class SplashSystem {
  private droplets: Droplet[] = [];
  private blots: Blot[] = [];

  constructor(private readonly rng: () => number = Math.random) {}

  // A slice at (x,y): droplets spray biased along the cut direction, and one
  // irregular wash blot stains the paper. `color` is an "r, g, b" triple.
  burst(x: number, y: number, dirX: number, dirY: number, color: string): void {
    const len = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / len;
    const uy = dirY / len;

    for (let i = 0; i < 14; i += 1) {
      const along = (this.rng() - 0.3) * 260;
      const spread = (this.rng() - 0.5) * 180;
      this.droplets.push({
        x,
        y,
        vx: ux * along - uy * spread,
        vy: uy * along + ux * spread - 60,
        r: 1.5 + this.rng() * 3.5,
        color,
        age: 0,
        life: 0.5 + this.rng() * 0.4
      });
    }

    const lobes = Array.from({ length: 7 }, () => ({
      ang: this.rng() * Math.PI * 2,
      dist: this.rng() * 14,
      r: 6 + this.rng() * 16
    }));
    this.blots.push({ x, y, r: 16 + this.rng() * 10, color, age: 0, life: 4, lobes });

    if (this.droplets.length > MAX_DROPLETS) this.droplets.splice(0, this.droplets.length - MAX_DROPLETS);
    if (this.blots.length > MAX_BLOTS) this.blots.splice(0, this.blots.length - MAX_BLOTS);
  }

  // Bomb: a heavy black ink explosion.
  inkExplosion(x: number, y: number): void {
    for (let i = 0; i < 3; i += 1) {
      const a = this.rng() * Math.PI * 2;
      this.burst(x, y, Math.cos(a), Math.sin(a), "30, 24, 20");
    }
  }

  update(dt: number): void {
    for (const d of this.droplets) {
      d.vy += DROPLET_GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.age += dt;
    }
    for (const b of this.blots) b.age += dt;
    this.droplets = this.droplets.filter((d) => d.age < d.life);
    this.blots = this.blots.filter((b) => b.age < b.life);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const b of this.blots) {
      const alpha = 0.34 * Math.max(0, 1 - b.age / b.life);
      ctx.fillStyle = `rgba(${b.color}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      for (const l of b.lobes) {
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(l.ang) * (b.r + l.dist), b.y + Math.sin(l.ang) * (b.r + l.dist), l.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const d of this.droplets) {
      const alpha = 0.8 * Math.max(0, 1 - d.age / d.life);
      ctx.fillStyle = `rgba(${d.color}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear(): void {
    this.droplets = [];
    this.blots = [];
  }
}

// Juice colours per fruit kind ("r, g, b" triples for rgba composition).
export const JUICE: Record<string, string> = {
  persimmon: "212, 108, 30",
  plum: "142, 58, 100",
  watermelon: "188, 58, 50",
  gourd: "182, 142, 66",
  bomb: "30, 24, 20"
};
