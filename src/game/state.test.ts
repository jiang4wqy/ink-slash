import { describe, expect, it } from "vitest";
import { GameFlow } from "./state";

describe("GameFlow", () => {
  it("walks the happy path menu → countdown → playing → gameover", () => {
    const g = new GameFlow();
    expect(g.state).toBe("menu");
    g.start();
    expect(g.state).toBe("countdown");
    g.countdownDone();
    expect(g.state).toBe("playing");
    g.gameOver();
    expect(g.state).toBe("gameover");
  });

  it("clearing a stage passes through the interstitial and back into play", () => {
    const g = new GameFlow();
    g.start();
    g.countdownDone();
    g.stageClear();
    expect(g.state).toBe("stageclear");
    g.stageClearDone();
    expect(g.state).toBe("playing");
  });

  it("stageClear is only reachable from playing", () => {
    const g = new GameFlow();
    g.stageClear();
    expect(g.state).toBe("menu");
    g.start();
    g.stageClear();
    expect(g.state).toBe("countdown");
  });

  it("replay returns to countdown, toMenu returns home", () => {
    const g = new GameFlow();
    g.start();
    g.countdownDone();
    g.gameOver();
    g.replay();
    expect(g.state).toBe("countdown");
    g.countdownDone();
    g.gameOver();
    g.toMenu();
    expect(g.state).toBe("menu");
  });

  it("pauses from playing and resumes back to playing", () => {
    const g = new GameFlow();
    g.start();
    g.countdownDone();
    g.pause();
    expect(g.state).toBe("paused");
    g.resume();
    expect(g.state).toBe("playing");
  });

  it("restart from pause goes to countdown; home from pause goes to menu", () => {
    const g = new GameFlow();
    g.start();
    g.countdownDone();
    g.pause();
    g.restart();
    expect(g.state).toBe("countdown");

    const h = new GameFlow();
    h.start();
    h.countdownDone();
    h.pause();
    h.toMenu();
    expect(h.state).toBe("menu");
  });

  it("pause is only reachable from playing", () => {
    const g = new GameFlow();
    g.pause();
    expect(g.state).toBe("menu");
    g.start();
    g.pause();
    expect(g.state).toBe("countdown");
    g.countdownDone();
    g.gameOver();
    g.pause();
    expect(g.state).toBe("gameover");
  });

  it("ignores illegal transitions", () => {
    const g = new GameFlow();
    g.countdownDone(); // not in countdown
    expect(g.state).toBe("menu");
    g.gameOver(); // not playing
    expect(g.state).toBe("menu");
    g.start();
    g.start(); // already counting down
    expect(g.state).toBe("countdown");
    g.replay(); // not in gameover
    expect(g.state).toBe("countdown");
  });
});
