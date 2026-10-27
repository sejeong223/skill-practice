import type * as Phaser from "phaser";
import type { StageId } from "../core/types";
import type { GameplayEventBus } from "../core/events";
import { getWorld03Obstacles, WORLD03_OBSTACLE_SCALE } from "../data/world03Construction";
import type { Player } from "../entities/Player";

type DrumPhase = "idle" | "rolling" | "stopped";

interface DrumRuntime {
  readonly originX: number;
  readonly radius: number;
  readonly image: Phaser.GameObjects.Image;
  readonly zone: Phaser.GameObjects.Zone;
  phase: DrumPhase;
  traveled: number;
}

const FLOOR_Y = 504;
const DRUM_TRIGGER_DISTANCE = 240;
const DRUM_TRAVEL_DISTANCE = 160;
const DRUM_SPEED_PX_PER_SECOND = 160;

export class World03ConstructionObstacles {
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private readonly zones: Phaser.GameObjects.Zone[] = [];
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly drums: DrumRuntime[] = [];
  private destroyed = false;
  private contactPending = false;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    stageId: StageId,
    eventBus: GameplayEventBus,
    getCheckpointId: () => string | null,
    private readonly canHandleContact: () => boolean,
  ) {
    for (const obstacle of getWorld03Obstacles(stageId)) {
      const drum = obstacle.kind === "cable-drum";
      const image = scene.add.image(
        obstacle.x,
        drum ? FLOOR_Y - obstacle.height / 2 : FLOOR_Y,
        `world-03-${obstacle.kind}`,
      )
        .setOrigin(0.5, drum ? 0.5 : 1)
        .setScale(WORLD03_OBSTACLE_SCALE)
        .setDepth(2);
      const zone = scene.add.zone(
        obstacle.x,
        FLOOR_Y - obstacle.height / 2,
        obstacle.width,
        obstacle.height,
      );
      scene.physics.add.existing(zone, true);
      (zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      this.sprites.push(image);
      this.zones.push(zone);
      if (drum) {
        this.drums.push({
          originX: obstacle.x,
          radius: obstacle.height / 2,
          image,
          zone,
          phase: "idle",
          traveled: 0,
        });
      }
      this.colliders.push(scene.physics.add.overlap(player, zone, () => {
        if (this.destroyed || this.contactPending || !canHandleContact()) return;
        this.contactPending = true;
        eventBus.emit("death-requested", {
          stageId,
          cause: "trap",
          checkpointId: getCheckpointId(),
          now: scene.time.now,
        });
      }));
    }
  }

  public update(deltaMs: number): void {
    if (this.destroyed || this.contactPending || !this.canHandleContact()) return;
    const elapsed = Number.isFinite(deltaMs) ? Math.min(50, Math.max(0, deltaMs)) : 0;
    for (const drum of this.drums) {
      const distanceAhead = drum.originX - this.player.x;
      if (drum.phase === "idle" && distanceAhead >= 0 && distanceAhead <= DRUM_TRIGGER_DISTANCE) {
        drum.phase = "rolling";
      }
      if (drum.phase !== "rolling") continue;
      const step = Math.min(DRUM_TRAVEL_DISTANCE - drum.traveled, DRUM_SPEED_PX_PER_SECOND * elapsed / 1000);
      drum.traveled += step;
      drum.image.setX(drum.originX - drum.traveled).setRotation(-drum.traveled / drum.radius);
      drum.zone.setX(drum.image.x);
      (drum.zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      if (drum.traveled >= DRUM_TRAVEL_DISTANCE) drum.phase = "stopped";
    }
  }

  public resetForAttempt(): void {
    if (this.destroyed) return;
    this.contactPending = false;
    for (const drum of this.drums) {
      drum.phase = "idle";
      drum.traveled = 0;
      drum.image.setX(drum.originX).setRotation(0);
      drum.zone.setX(drum.originX);
      (drum.zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const collider of this.colliders) collider.destroy();
    for (const zone of this.zones) zone.destroy();
    for (const image of this.sprites) image.destroy();
    this.colliders.length = 0;
    this.zones.length = 0;
    this.sprites.length = 0;
    this.drums.length = 0;
  }
}
