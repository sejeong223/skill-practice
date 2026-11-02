import type Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { GameplayEventBus } from "../core/events";
import type { World04DebugEntry, World04Layout, World04RuntimePort } from "../data/world04Types";
import type { PlayerController } from "./PlayerController";
import { World04TerrainSystem } from "./World04TerrainSystem";
import { World04GroundSystem } from "./World04GroundSystem";
import { World04AirSystem } from "./World04AirSystem";

export class World04HazardSystem {
  private readonly terrain: World04TerrainSystem;
  private readonly ground: World04GroundSystem;
  private readonly air: World04AirSystem;
  private readonly port: World04RuntimePort;
  private destroyed = false;
  private deathLatched = false;
  private pendingAbort = false;
  private generation = 0;
  public constructor(scene: Phaser.Scene, player: Player, private readonly controller: PlayerController, layout: World04Layout,
    eventBus: GameplayEventBus, getCheckpointId: () => string | null, canUpdate: () => boolean) {
    this.port = {
      isActive: () => !this.destroyed && canUpdate(), isDashing: () => controller.isDashing(),
      kill: (sourceId, risk) => {
        if (!this.port.isActive() || this.deathLatched || this.pendingAbort || (risk === "attack" && controller.isDashing())) return false;
        this.deathLatched = true; this.pendingAbort = true;
        eventBus.emit("death-requested", { stageId: layout.stageId, cause: risk === "fall" ? "fall" : "trap", checkpointId: getCheckpointId(), gimmickId: sourceId, outcome: "instant-death", now: scene.time.now });
        return true;
      },
    };
    this.terrain = new World04TerrainSystem(scene, player, layout, this.port);
    this.ground = new World04GroundSystem(scene, player, controller, layout, this.port);
    this.air = new World04AirSystem(scene, player, layout, this.port);
  }
  public beforePlayerUpdate(): void {
    if (this.port.isActive() && !this.pendingAbort) this.controller.setSurfaceModifier(this.ground.sampleSurface());
    else this.controller.clearSurfaceModifier();
  }
  public afterPlayerUpdate(deltaMs: number): boolean {
    if (this.pendingAbort) { this.pendingAbort = false; return true; }
    if (!this.port.isActive()) return false;
    const generation = this.generation;
    for (const child of [this.terrain, this.ground, this.air]) {
      if (child.update(deltaMs) || generation !== this.generation) { this.pendingAbort = false; return true; }
    }
    return false;
  }
  public resetForAttempt(spawnX: number): void {
    if (this.destroyed) return;
    this.generation++; this.deathLatched = false; this.controller.clearSurfaceModifier();
    this.terrain.resetForAttempt(spawnX); this.ground.resetForAttempt(spawnX); this.air.resetForAttempt(spawnX);
  }
  public getDebugState(): readonly World04DebugEntry[] { return [...this.terrain.getDebugState(), ...this.ground.getDebugState(), ...this.air.getDebugState()]; }
  public destroy(): void {
    if (this.destroyed) return; this.destroyed = true; this.generation++; this.controller.clearSurfaceModifier();
    this.terrain.destroy(); this.ground.destroy(); this.air.destroy();
  }
}
