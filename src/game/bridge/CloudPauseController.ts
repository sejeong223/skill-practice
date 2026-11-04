import type * as Phaser from "phaser";
import type { GameEventBus } from "./GameEventBus";
import { hasForcedPause } from "./PauseReasons";

/** Own only the pauses introduced here; never resume a scene paused by another system. */
export class CloudPauseController {
  private owned = new Map<Phaser.Scene, boolean>();
  private watched = new Set<Phaser.Scene>();
  private unsubscribe: () => void;
  constructor(private readonly game: Phaser.Game, private readonly bus: GameEventBus) {
    this.unsubscribe = bus.pauseReasons.subscribe(this.sync);
    game.events.on("prestep", this.sync);
    game.events.on("ready", this.sync);
    this.sync();
  }
  private sync = (): void => {
    const paused = hasForcedPause(this.bus.pauseReasons.snapshot());
    for (const scene of this.game.scene.scenes) {
      if (!this.watched.has(scene)) {
        this.watched.add(scene);
        scene.sys.events.on("create", this.sync);
        scene.sys.events.on("resume", this.sync);
        scene.sys.events.on("shutdown", this.onShutdown, scene);
      }
      if (paused && scene.sys.isActive()) {
        if (!this.owned.has(scene)) this.owned.set(scene, scene.input?.enabled ?? false);
        if (scene.input) scene.input.enabled = false;
        scene.sys.pause();
      }
    }
    if (!paused) for (const [scene, inputEnabled] of this.owned) {
      this.owned.delete(scene);
      if (scene.sys.isPaused()) { if (scene.input) scene.input.enabled = inputEnabled; scene.sys.resume(); }
    }
  };
  private onShutdown = (sys: Phaser.Scenes.Systems): void => { this.owned.delete(sys.scene); };
  destroy(): void {
    this.unsubscribe(); this.game.events.off("prestep", this.sync); this.game.events.off("ready", this.sync);
    for (const scene of this.watched) {
      scene.sys.events.off("create", this.sync); scene.sys.events.off("resume", this.sync);
      scene.sys.events.off("shutdown", this.onShutdown, scene);
    }
    this.watched.clear(); this.owned.clear();
  }
}
