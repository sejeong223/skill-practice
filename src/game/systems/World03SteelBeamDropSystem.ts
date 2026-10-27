import type * as Phaser from "phaser";
import type { GameplayEventBus } from "../core/events";
import type { StageId } from "../core/types";
import {
  WORLD03_STEEL_BEAM_HITBOX_HEIGHT,
  WORLD03_STEEL_BEAM_HITBOX_WIDTH,
  WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND,
  type World03SteelBeamDefinition,
} from "../data/world03SteelBeams";
import type { Player } from "../entities/Player";
import { DEFAULT_PLAYER_TUNING } from "../entities/playerTypes";
import { sweptAabbOverlap, type AxisAlignedBounds } from "./world03SteelBeamCollision";

type BeamStatus = "armed" | "falling" | "landed" | "finished" | "skipped";

interface BeamRuntime {
  readonly definition: World03SteelBeamDefinition;
  status: BeamStatus;
  sprite?: Phaser.GameObjects.Image;
  previousY: number;
  landedRemainingMs: number;
}

const SPAWN_CENTER_Y = -128;
const FLOOR_TOP_Y = 504;
const LANDED_CENTER_Y = FLOOR_TOP_Y - WORLD03_STEEL_BEAM_HITBOX_HEIGHT / 2;
const LANDED_LIFETIME_MS = 300;

function playerBodyBounds(player: Player): AxisAlignedBounds | null {
  const body = player.body;
  if (!body) return null;
  const bounds = { left: body.left, right: body.right, top: body.top, bottom: body.bottom };
  return [bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite) ? bounds : null;
}

function beamBounds(x: number, y: number): AxisAlignedBounds {
  return {
    left: x - WORLD03_STEEL_BEAM_HITBOX_WIDTH / 2,
    right: x + WORLD03_STEEL_BEAM_HITBOX_WIDTH / 2,
    top: y - WORLD03_STEEL_BEAM_HITBOX_HEIGHT / 2,
    bottom: y + WORLD03_STEEL_BEAM_HITBOX_HEIGHT / 2,
  };
}

function centerX(bounds: AxisAlignedBounds): number {
  return (bounds.left + bounds.right) / 2;
}

export class World03SteelBeamDropSystem {
  private readonly beams: BeamRuntime[];
  private previousPlayerBounds: AxisAlignedBounds | null;
  private deathPending = false;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly eventBus: GameplayEventBus,
    private readonly stageId: StageId,
    definitions: readonly World03SteelBeamDefinition[],
    private readonly getCheckpointId: () => string | null,
    private readonly canHandleContact: () => boolean,
    private readonly isBackpedaling: () => boolean,
  ) {
    this.beams = definitions.map((definition) => ({
      definition,
      status: "armed",
      previousY: SPAWN_CENTER_Y,
      landedRemainingMs: 0,
    }));
    this.previousPlayerBounds = playerBodyBounds(player);
  }

  public update(deltaMs: number): void {
    if (this.destroyed || this.deathPending || !this.canHandleContact()) return;
    const currentPlayerBounds = playerBodyBounds(this.player);
    if (!currentPlayerBounds) return;
    const previousPlayerBounds = this.previousPlayerBounds ?? currentPlayerBounds;
    const elapsed = Number.isFinite(deltaMs) ? Math.min(50, Math.max(0, deltaMs)) : 0;
    const currentCenter = centerX(currentPlayerBounds);

    for (const beam of this.beams) {
      const beamLeft = beam.definition.x - WORLD03_STEEL_BEAM_HITBOX_WIDTH / 2;
      if (beam.status === "armed" &&
          currentPlayerBounds.right >= beamLeft &&
          (currentCenter <= beam.definition.x || previousPlayerBounds.right < beamLeft)) {
        beam.sprite = this.scene.add.image(beam.definition.x, SPAWN_CENTER_Y, "world-03-falling-steel-beam")
          .setOrigin(0.5).setDepth(11);
        beam.previousY = SPAWN_CENTER_Y;
        beam.status = "falling";
        // Begin falling next frame so the corgi has time for a quick backward turn.
        continue;
      }
      if (beam.status === "falling" && beam.sprite) {
        if (this.isBackpedaling()) {
          // A quick turn must overcome the normal run acceleration before impact.
          this.player.setVelocityX(-DEFAULT_PLAYER_TUNING.runSpeed);
        }
        const nextY = Math.min(
          LANDED_CENTER_Y,
          beam.previousY + WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND * elapsed / 1000,
        );
        beam.sprite.setY(nextY);
        if (sweptAabbOverlap(
          beamBounds(beam.definition.x, beam.previousY),
          beamBounds(beam.definition.x, nextY),
          previousPlayerBounds,
          currentPlayerBounds,
        )) {
          this.deathPending = true;
          this.eventBus.emit("death-requested", {
            stageId: this.stageId,
            cause: "trap",
            checkpointId: this.getCheckpointId(),
            now: this.scene.time.now,
          });
          return;
        }
        beam.previousY = nextY;
        if (nextY >= LANDED_CENTER_Y) {
          beam.status = "landed";
          beam.landedRemainingMs = LANDED_LIFETIME_MS;
        }
      } else if (beam.status === "landed") {
        beam.landedRemainingMs = Math.max(0, beam.landedRemainingMs - elapsed);
        if (beam.landedRemainingMs === 0) {
          beam.sprite?.destroy();
          beam.sprite = undefined;
          beam.status = "finished";
        }
      }
    }
    this.previousPlayerBounds = currentPlayerBounds;
  }

  public resetForAttempt(respawnX: number): void {
    if (this.destroyed) return;
    const safeRespawnX = Number.isFinite(respawnX) ? respawnX : 0;
    for (const beam of this.beams) {
      beam.sprite?.destroy();
      beam.sprite = undefined;
      beam.previousY = SPAWN_CENTER_Y;
      beam.landedRemainingMs = 0;
      beam.status = beam.definition.x < safeRespawnX ? "skipped" : "armed";
    }
    this.previousPlayerBounds = playerBodyBounds(this.player);
    this.deathPending = false;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const beam of this.beams) {
      beam.sprite?.destroy();
      beam.sprite = undefined;
    }
    this.beams.length = 0;
  }
}
