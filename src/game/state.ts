export type GameState = "menu" | "countdown" | "playing" | "stageclear" | "gameover";

// Tiny explicit state machine; illegal transitions are no-ops so stray UI
// events (double clicks, late timers) can never corrupt the flow.
export class GameFlow {
  state: GameState = "menu";

  start(): void {
    if (this.state === "menu") this.state = "countdown";
  }

  countdownDone(): void {
    if (this.state === "countdown") this.state = "playing";
  }

  // Stage target reached → interstitial banner → next act.
  stageClear(): void {
    if (this.state === "playing") this.state = "stageclear";
  }

  stageClearDone(): void {
    if (this.state === "stageclear") this.state = "playing";
  }

  gameOver(): void {
    if (this.state === "playing") this.state = "gameover";
  }

  replay(): void {
    if (this.state === "gameover") this.state = "countdown";
  }

  toMenu(): void {
    if (this.state === "gameover") this.state = "menu";
  }
}
