import * as Phaser from "phaser";
import { GameplayEventBus } from "../core/events";
import type { StageId } from "../core/types";
import type { World02PigeonPassDefinition } from "../data/world02PigeonDrops";
import { Player } from "../entities/Player";

const BIRD_START_OFFSET = 240;
const BIRD_END_OFFSET = 320;
const WARNING_OFFSET = 80;
const SAND_TOP_Y = 504;
const SPLAT_LIFETIME_MS = 300;
const WING_FRAME_MS = 120;

type PassStatus = "armed" | "flying" | "released" | "finished";

interface PigeonPass {
  readonly definition: World02PigeonPassDefinition;
  status: PassStatus;
  flightElapsedMs: number;
  splatRemainingMs: number;
  bird?: Phaser.GameObjects.Sprite;
  dropping?: Phaser.Physics.Arcade.Sprite;
  warning?: Phaser.GameObjects.Graphics;
  splat?: Phaser.GameObjects.Image;
  overlap?: Phaser.Physics.Arcade.Collider;
}

export class World02PigeonDropSystem {
  private readonly passes: PigeonPass[];
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly eventBus: GameplayEventBus,
    private readonly stageId: StageId,
    definitions: readonly World02PigeonPassDefinition[],
    private readonly getCheckpointId: () => string | null,
    private readonly canHandleContact: () => boolean,
  ) {
    this.passes = definitions.map((definition) => ({
      definition,
      status: "armed",
      flightElapsedMs: 0,
      splatRemainingMs: 0,
    }));
  }

  public update(deltaMs: number): void {
    if (this.destroyed || !this.canHandleContact()) return;
    const elapsed = Number.isFinite(deltaMs) ? Math.min(50, Math.max(0, deltaMs)) : 0;

    for (const pass of this.passes) {
      if (pass.status === "armed" && this.player.x >= pass.definition.triggerX) {
        this.startFlight(pass);
      }
      if (pass.bird) {
        pass.flightElapsedMs += elapsed;
        pass.bird.x -= pass.definition.birdSpeedX * elapsed / 1000;
        pass.bird.setFrame(Math.floor(pass.flightElapsedMs / WING_FRAME_MS) % 3);
        if (pass.status === "flying" && pass.bird.x <= pass.definition.dropX + WARNING_OFFSET) {
          this.showWarning(pass);
        }
        if (pass.status === "flying" && pass.bird.x <= pass.definition.dropX) {
          this.releaseDropping(pass);
        }
        if (pass.bird.x <= pass.definition.dropX - BIRD_END_OFFSET) {
          this.destroyBird(pass);
        }
      }
      const droppingBody = pass.dropping?.body as Phaser.Physics.Arcade.Body | null | undefined;
      if (pass.status === "released" && droppingBody && droppingBody.bottom >= SAND_TOP_Y) {
        this.landDropping(pass);
      }
      if (pass.splat) {
        pass.splatRemainingMs = Math.max(0, pass.splatRemainingMs - elapsed);
        if (pass.splatRemainingMs === 0) this.destroySplat(pass);
      }
      if (pass.status === "released" && !pass.bird && !pass.dropping && !pass.splat) {
        this.destroyWarning(pass);
        pass.status = "finished";
      }
    }
  }

  public resetForAttempt(respawnX: number): void {
    if (this.destroyed) return;
    for (const pass of this.passes) {
      this.clearPass(pass);
      pass.status = pass.definition.triggerX < respawnX ? "finished" : "armed";
      pass.flightElapsedMs = 0;
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const pass of this.passes) {
      this.clearPass(pass);
      pass.status = "finished";
    }
  }

  private startFlight(pass: PigeonPass): void {
    pass.status = "flying";
    pass.bird = this.scene.add.sprite(
      pass.definition.dropX + BIRD_START_OFFSET,
      pass.definition.flightY,
      "world-02-pigeon-fly",
      0,
    ).setDepth(4);
  }

  private showWarning(pass: PigeonPass): void {
    if (pass.warning) return;
    const warning = this.scene.add.graphics()
      .setPosition(pass.definition.dropX, SAND_TOP_Y - 5)
      .setDepth(11);
    warning.fillStyle(0xff927c, 0.95);
    warning.fillEllipse(0, 0, 54, 18);
    warning.fillStyle(0x683852, 0.9);
    warning.fillEllipse(0, 0, 46, 12);
    warning.fillStyle(0xffdbc8, 0.95);
    warning.fillEllipse(0, -1, 26, 5);
    pass.warning = warning;
  }

  private releaseDropping(pass: PigeonPass): void {
    pass.status = "released";
    const dropping = this.scene.physics.add.sprite(
      pass.definition.dropX,
      pass.definition.flightY + 20,
      "world-02-pigeon-dropping",
    ).setDepth(9);
    dropping.body.setAllowGravity(false);
    dropping.body.setSize(14, 20, true);
    dropping.setVelocity(0, pass.definition.droppingSpeedY);
    pass.dropping = dropping;
    pass.overlap = this.scene.physics.add.overlap(this.player, dropping, () => {
      this.handleDroppingContact(pass);
    });
  }

  private handleDroppingContact(pass: PigeonPass): void {
    if (this.destroyed || pass.status !== "released" || !pass.dropping || !this.canHandleContact()) return;
    pass.status = "finished";
    this.clearPass(pass);
    // DeathSystem can synchronously reset the stage while this overlap is running.
    this.eventBus.emit("death-requested", {
      stageId: this.stageId,
      cause: "trap",
      checkpointId: this.getCheckpointId(),
      now: this.scene.time.now,
    });
  }

  private landDropping(pass: PigeonPass): void {
    this.destroyDropping(pass);
    pass.splat = this.scene.add.image(pass.definition.dropX, SAND_TOP_Y - 1, "world-02-pigeon-splat")
      .setOrigin(0.5, 1)
      .setDepth(4);
    pass.splatRemainingMs = SPLAT_LIFETIME_MS;
  }

  private destroyBird(pass: PigeonPass): void {
    if (pass.bird?.active) pass.bird.destroy();
    pass.bird = undefined;
  }

  private destroyDropping(pass: PigeonPass): void {
    if (pass.overlap?.active) pass.overlap.destroy();
    pass.overlap = undefined;
    if (pass.dropping?.active) pass.dropping.destroy();
    pass.dropping = undefined;
  }

  private destroyWarning(pass: PigeonPass): void {
    if (pass.warning?.active) pass.warning.destroy();
    pass.warning = undefined;
  }

  private destroySplat(pass: PigeonPass): void {
    if (pass.splat?.active) pass.splat.destroy();
    pass.splat = undefined;
    pass.splatRemainingMs = 0;
  }

  private clearPass(pass: PigeonPass): void {
    this.destroyDropping(pass);
    this.destroyBird(pass);
    this.destroyWarning(pass);
    this.destroySplat(pass);
  }
}
