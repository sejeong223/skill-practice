import * as Phaser from "phaser";
import { GameplayEventBus } from "../core/events";
import type { StageId } from "../core/types";
import {
  WORLD02_PIGEON_DROP_OFFSETS,
  WORLD02_PIGEON_SPAWN_INTERVAL_MS,
  type World02PigeonPassDefinition,
} from "../data/world02PigeonDrops";
import { Player } from "../entities/Player";

const BIRD_START_OFFSET = 240;
const BIRD_END_OFFSET = 320;
const SAND_TOP_Y = 504;
const SPLAT_LIFETIME_MS = 300;
const WING_FRAME_MS = 120;

type DroppingStatus = "pending" | "falling" | "landed" | "finished";

interface PigeonDropping {
  readonly x: number;
  status: DroppingStatus;
  splatRemainingMs: number;
  sprite?: Phaser.Physics.Arcade.Sprite;
  splat?: Phaser.GameObjects.Image;
  overlap?: Phaser.Physics.Arcade.Collider;
}

interface PigeonFlight {
  readonly definition: World02PigeonPassDefinition;
  readonly drops: PigeonDropping[];
  bird?: Phaser.GameObjects.Sprite;
  flightElapsedMs: number;
}

export class World02PigeonDropSystem {
  private readonly flights: PigeonFlight[] = [];
  private spawnElapsedMs = 0;
  private spawnStarted = false;
  private minimumPassIndex = 0;
  private deathPending = false;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly eventBus: GameplayEventBus,
    private readonly stageId: StageId,
    private readonly definitions: readonly World02PigeonPassDefinition[],
    private readonly getCheckpointId: () => string | null,
    private readonly canHandleContact: () => boolean,
  ) {}

  public update(deltaMs: number): void {
    if (this.destroyed || this.deathPending || !this.canHandleContact()) return;
    const elapsed = Number.isFinite(deltaMs) ? Math.min(50, Math.max(0, deltaMs)) : 0;
    const definition = this.getActiveDefinition();
    if (definition && !this.spawnStarted) {
      this.spawnFlight(definition);
      this.spawnStarted = true;
    } else if (definition) {
      this.spawnElapsedMs += elapsed;
      if (this.spawnElapsedMs >= WORLD02_PIGEON_SPAWN_INTERVAL_MS) {
        this.spawnElapsedMs -= WORLD02_PIGEON_SPAWN_INTERVAL_MS;
        this.spawnFlight(definition);
      }
    }

    for (let index = this.flights.length - 1; index >= 0; index -= 1) {
      const flight = this.flights[index];
      if (flight.bird) {
        flight.flightElapsedMs += elapsed;
        flight.bird.x -= flight.definition.birdSpeedX * elapsed / 1000;
        flight.bird.setFrame(Math.floor(flight.flightElapsedMs / WING_FRAME_MS) % 3);
        for (const drop of flight.drops) {
          if (drop.status === "pending" && flight.bird.x <= drop.x) {
            this.releaseDropping(flight, drop);
          }
        }
        if (flight.bird.x <= flight.definition.dropX - BIRD_END_OFFSET) {
          this.destroyBird(flight);
        }
      }
      for (const drop of flight.drops) {
        const body = drop.sprite?.body as Phaser.Physics.Arcade.Body | null | undefined;
        if (drop.status === "falling" && body && body.bottom >= SAND_TOP_Y) {
          this.landDropping(drop);
        }
        if (drop.status === "landed") {
          drop.splatRemainingMs = Math.max(0, drop.splatRemainingMs - elapsed);
          if (drop.splatRemainingMs === 0) this.finishDropping(drop);
        }
      }
      if (!flight.bird && flight.drops.every((drop) => drop.status === "finished")) {
        this.flights.splice(index, 1);
      }
    }
  }

  public resetForAttempt(respawnX: number): void {
    if (this.destroyed) return;
    this.clearFlights();
    this.spawnElapsedMs = 0;
    this.spawnStarted = false;
    this.deathPending = false;
    const nextIndex = this.definitions.findIndex((definition) => definition.dropX >= respawnX);
    this.minimumPassIndex = nextIndex < 0 ? this.definitions.length : nextIndex;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearFlights();
  }

  private getActiveDefinition(): World02PigeonPassDefinition | undefined {
    if (this.minimumPassIndex >= this.definitions.length ||
        (this.minimumPassIndex === 0 && this.player.x < this.definitions[0].triggerX)) return undefined;
    let index = this.minimumPassIndex;
    while (index < this.definitions.length - 1 &&
      (this.player.x >= this.definitions[index + 1].triggerX ||
       this.player.x >= this.definitions[index].dropX + 160)) index += 1;
    const definition = this.definitions[index];
    return this.player.x < definition.dropX + 160 ? definition : undefined;
  }

  private spawnFlight(definition: World02PigeonPassDefinition): void {
    const bird = this.scene.add.sprite(
      definition.dropX + BIRD_START_OFFSET,
      definition.flightY,
      "world-02-pigeon-fly",
      0,
    ).setDepth(4);
    this.flights.push({
      definition,
      bird,
      flightElapsedMs: 0,
      drops: WORLD02_PIGEON_DROP_OFFSETS.map((offset) => ({
        x: definition.dropX + offset,
        status: "pending",
        splatRemainingMs: 0,
      })),
    });
  }

  private releaseDropping(flight: PigeonFlight, drop: PigeonDropping): void {
    drop.status = "falling";
    const sprite = this.scene.physics.add.sprite(
      drop.x,
      flight.definition.flightY + 20,
      "world-02-pigeon-dropping",
    ).setDepth(9);
    sprite.body.setAllowGravity(false);
    sprite.body.setSize(14, 20, true);
    sprite.setVelocity(0, flight.definition.droppingSpeedY);
    drop.sprite = sprite;
    drop.overlap = this.scene.physics.add.overlap(this.player, sprite, () => {
      this.handleDroppingContact(drop);
    });
  }

  private handleDroppingContact(drop: PigeonDropping): void {
    if (this.destroyed || this.deathPending || drop.status !== "falling" ||
        !drop.sprite || !this.canHandleContact()) return;
    this.deathPending = true;
    const checkpointId = this.getCheckpointId();
    this.clearFlights();
    // DeathSystem may reset this system synchronously while this overlap callback is running.
    this.eventBus.emit("death-requested", {
      stageId: this.stageId,
      cause: "trap",
      checkpointId,
      now: this.scene.time.now,
    });
  }

  private landDropping(drop: PigeonDropping): void {
    this.destroyDroppingSprite(drop);
    drop.status = "landed";
    drop.splat = this.scene.add.image(drop.x, SAND_TOP_Y - 1, "world-02-pigeon-splat")
      .setOrigin(0.5, 1)
      .setDepth(4);
    drop.splatRemainingMs = SPLAT_LIFETIME_MS;
  }

  private finishDropping(drop: PigeonDropping): void {
    this.clearDropping(drop);
    drop.status = "finished";
  }

  private destroyBird(flight: PigeonFlight): void {
    if (flight.bird?.active) flight.bird.destroy();
    flight.bird = undefined;
  }

  private destroyDroppingSprite(drop: PigeonDropping): void {
    if (drop.overlap?.active) drop.overlap.destroy();
    drop.overlap = undefined;
    if (drop.sprite?.active) drop.sprite.destroy();
    drop.sprite = undefined;
  }

  private clearDropping(drop: PigeonDropping): void {
    this.destroyDroppingSprite(drop);
    if (drop.splat?.active) drop.splat.destroy();
    drop.splat = undefined;
    drop.splatRemainingMs = 0;
  }

  private clearFlights(): void {
    for (const flight of this.flights) {
      this.destroyBird(flight);
      for (const drop of flight.drops) this.clearDropping(drop);
    }
    this.flights.length = 0;
  }
}
