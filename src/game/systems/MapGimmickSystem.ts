import * as Phaser from "phaser";
import type {
  GimmickRuntimeStatus,
  MapChainTrigger,
  WorldGimmickDefinition,
} from "../core/contentTypes";
import type { StageMapDefinition } from "../core/contentTypes";
import type { GimmickRuntimeState, MapRuntimeSnapshot } from "../core/runtimeTypes";
import type { StageDefinition } from "../core/types";
import type { GameplayEventBus } from "../core/events";
import { getAssetFrameKey } from "../assets/assetManifest";
import { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";
import type { LoadedMap } from "../maps/mapTypes";
import { MapInteractionSystem } from "../maps/MapInteractionSystem";

type RuntimeEntry = GimmickRuntimeState;

const MAP_TRIGGER_BY_GIMMICK = {
  "walk-enter": "object-enter",
  "forward-jump": "player-jump",
  "jump-over": "jump-over",
  "timed-after-enter": "timer",
  collect: "object-hit",
  "checkpoint-touch": "checkpoint-reached",
  "jump-in-zone": "player-jump",
  "dialogue-enter": "dialogue-enter",
} as const;

export class MapGimmickSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly input: InputManager;
  private readonly stage: StageDefinition;
  private readonly map: StageMapDefinition;
  private readonly loadedMap: LoadedMap | null;
  private readonly eventBus: GameplayEventBus;
  private readonly mapInteraction: MapInteractionSystem;
  private readonly playerName: string;
  private readonly entries = new Map<string, RuntimeEntry>();
  private readonly visuals = new Map<string, Phaser.GameObjects.Image>();
  private readonly fakeSpikeVisuals = new Map<string, Phaser.GameObjects.Image>();
  private readonly spikeObjects = new Map<string, Phaser.GameObjects.Image>();
  private readonly wallBodies = new Map<string, Phaser.GameObjects.Rectangle>();
  private readonly riseBodies = new Map<string, Phaser.GameObjects.Rectangle>();
  private readonly pendingFatal = new Map<string, number>();
  private readonly wallDeathDeadlines = new Map<string, number>();
  private readonly collapsedTiles = new Map<
    string,
    Array<{ x: number; y: number; index: number }>
  >();
  private readonly triggeredChainSources = new Set<string>();
  private readonly unsubscribeMapObject: () => void;
  private bubble?: Phaser.GameObjects.Container;
  private bubbleText?: Phaser.GameObjects.Text;
  private readonly snapshotSeed: number;

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    input: InputManager,
    stage: StageDefinition,
    map: StageMapDefinition,
    eventBus: GameplayEventBus,
    mapInteraction: MapInteractionSystem,
    loadedMap: LoadedMap | null = null,
    playerName = "코기",
    private readonly getCheckpointId: () => string | null = () => null,
  ) {
    this.scene = scene;
    this.player = player;
    this.input = input;
    this.stage = stage;
    this.map = map;
    this.loadedMap = loadedMap;
    this.eventBus = eventBus;
    this.mapInteraction = mapInteraction;
    this.playerName = playerName.trim() || "코기";
    this.snapshotSeed = [...stage.id].reduce(
      (hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0,
      0,
    );

    for (const gimmick of map.gimmicks) {
      this.entries.set(gimmick.id, {
        gimmickId: gimmick.id,
        status: "armed",
        startedAt: null,
        counterpresses: 0,
        snapshotSeed: this.snapshotSeed,
      });
      this.createGimmickVisual(gimmick);
      this.createPhysicalTrigger(gimmick);
    }

    this.createFakeCheckpointSpikes();
    this.unsubscribeMapObject = eventBus.on("map-object-state-changed", (payload) => {
      const visual = this.fakeSpikeVisuals.get(payload.objectId);
      if (visual) {
        visual.setVisible(payload.active);
      }
    });
  }

  public update(time: number, _delta: number): void {
    void _delta;
    const input = this.input.getSnapshot();
    this.checkWorldBounds(time);
    this.updatePendingFatal(time);
    this.updateWallDeaths(time);
    this.updateChainSources(time);

    for (const gimmick of this.map.gimmicks) {
      const state = this.entries.get(gimmick.id);
      if (!state || state.status !== "armed") {
        if (gimmick.kind === "ground-rise" && state?.status === "triggered") {
          this.updateRisingGround(gimmick, state, time);
        } else if (
          gimmick.kind === "ground-collapse" &&
          state?.status === "triggered" &&
          this.player.x > gimmick.x + gimmick.width + 24 &&
          this.player.body.bottom < gimmick.y + gimmick.height
        ) {
          this.setStatus(gimmick, "escaped", time);
        }
        continue;
      }

      if (!this.overlapsGimmick(gimmick)) {
        if (
          gimmick.kind === "jump-pigeon" &&
          this.player.x > gimmick.x + gimmick.width
        ) {
          this.setStatus(gimmick, "escaped");
        }
        continue;
      }

      switch (gimmick.kind) {
        case "ant-trip":
          this.handleAnt(gimmick, time);
          break;
        case "ground-collapse":
          if (this.isGrounded() && !input.jumpPressed && this.player.body.velocity.y >= 0) {
            this.beginGimmick(gimmick, time, "object-enter");
            this.removeGround(gimmick);
          }
          break;
        case "ground-rise":
          if (this.isGrounded() && !input.jumpPressed && this.player.body.velocity.y >= 0) {
            this.setStatus(gimmick, "triggered", time);
          }
          break;
        case "forward-jump-wall":
          if (input.jumpPressed && this.isMovingForward()) {
            this.beginGimmick(gimmick, time, "player-jump");
            this.setPhysicalActive(this.wallBodies.get(gimmick.id), true);
          }
          break;
        case "revealed-white-spike":
          if (this.isGrounded() && !input.jumpPressed) {
            this.beginGimmick(gimmick, time, "object-enter");
            this.visuals.get(gimmick.id)?.setVisible(true);
          }
          break;
        case "jump-pigeon":
          if (input.jumpPressed) {
            this.beginGimmick(gimmick, time, "player-jump");
            this.visuals.get(gimmick.id)?.setVisible(true);
          }
          break;
        case "fake-bone-green":
        case "fake-bone-reverse":
        case "fake-bone-fire":
          this.beginGimmick(gimmick, time, "object-hit");
          this.changeBoneVisual(gimmick);
          break;
        case "fake-checkpoint":
          this.beginGimmick(gimmick, time, "checkpoint-reached");
          break;
        case "box-cat-arm":
        case "cloud-rain":
          if (input.jumpPressed || !this.isGrounded()) {
            this.beginDelayedJumpTrap(gimmick, time);
          }
          break;
        case "name-bubble-control-loss":
          this.beginGimmick(gimmick, time, "dialogue-enter");
          this.showNameBubble();
          break;
      }
    }

    this.updateNameBubble(input.jumpPressed, time);
  }

  public reset(snapshot: MapRuntimeSnapshot | null): void {
    this.pendingFatal.clear();
    this.wallDeathDeadlines.clear();
    this.triggeredChainSources.clear();
    this.restoreCollapsedTiles();
    this.player.clearAllControlOverrides();
    this.hideNameBubble();

    for (const gimmick of this.map.gimmicks) {
      const restored = snapshot?.gimmickStates[gimmick.id];
      const next: RuntimeEntry = restored
        ? { ...restored }
        : {
            gimmickId: gimmick.id,
            status: "armed",
            startedAt: null,
            counterpresses: 0,
            snapshotSeed: this.snapshotSeed,
          };
      this.entries.set(gimmick.id, next);
      this.visuals.get(gimmick.id)?.setVisible(this.isDefaultVisible(gimmick));
      if (["fake-bone-green", "fake-bone-reverse", "fake-bone-fire"].includes(gimmick.kind)) {
        const baseFrame = getAssetFrameKey("world-01-prop-bone-coin");
        if (baseFrame) this.visuals.get(gimmick.id)?.setFrame(baseFrame);
      }
      this.setPhysicalActive(this.wallBodies.get(gimmick.id), false);
      this.setPhysicalActive(this.riseBodies.get(gimmick.id), false);

      if (gimmick.kind === "ground-collapse" && next.status === "triggered") {
        this.removeGround(gimmick);
      }
    }

    for (const visual of this.fakeSpikeVisuals.values()) {
      visual.setVisible(false);
    }
    for (const visual of this.spikeObjects.values()) {
      visual.destroy();
    }
    this.spikeObjects.clear();
  }

  public getState(gimmickId: string): GimmickRuntimeState | undefined {
    const state = this.entries.get(gimmickId);
    if (!state) {
      return undefined;
    }
    return {
      gimmickId: state.gimmickId,
      status: state.status,
      startedAt: state.startedAt,
      counterpresses: state.counterpresses,
      snapshotSeed: state.snapshotSeed,
    };
  }

  public getSnapshotStates(): Readonly<Record<string, GimmickRuntimeState>> {
    return Object.fromEntries(
      [...this.entries.entries()].map(([id]) => [id, this.getState(id)]),
    ) as Readonly<Record<string, GimmickRuntimeState>>;
  }

  public destroy(): void {
    this.unsubscribeMapObject();
    this.hideNameBubble();
    this.restoreCollapsedTiles();
    for (const image of this.visuals.values()) image.destroy();
    for (const image of this.fakeSpikeVisuals.values()) image.destroy();
    for (const image of this.spikeObjects.values()) image.destroy();
    for (const body of this.wallBodies.values()) body.destroy();
    for (const body of this.riseBodies.values()) body.destroy();
    this.visuals.clear();
    this.fakeSpikeVisuals.clear();
    this.spikeObjects.clear();
    this.wallBodies.clear();
    this.riseBodies.clear();
  }

  private handleAnt(gimmick: WorldGimmickDefinition, now: number): void {
    if (this.isMovingBackward()) {
      this.setStatus(gimmick, "escaped", now);
      return;
    }
    this.beginGimmick(gimmick, now, "object-enter");
  }

  private beginDelayedJumpTrap(gimmick: WorldGimmickDefinition, now: number): void {
    this.setStatus(gimmick, "triggered", now);
    this.pendingFatal.set(gimmick.id, now + (gimmick.kind === "box-cat-arm" ? 180 : 360));
    this.eventBus.emit("gimmick-triggered", {
      stageId: this.stage.id,
      gimmickId: gimmick.id,
      kind: gimmick.kind,
      trigger: gimmick.trigger,
      now,
    });
    this.showTriggeredVisual(gimmick);
  }

  private updatePendingFatal(now: number): void {
    for (const [gimmickId, deadline] of this.pendingFatal) {
      const gimmick = this.map.gimmicks.find((candidate) => candidate.id === gimmickId);
      if (!gimmick) {
        this.pendingFatal.delete(gimmickId);
        continue;
      }

      if (this.isMovingBackward()) {
        this.setStatus(gimmick, "escaped", now);
        this.pendingFatal.delete(gimmickId);
        continue;
      }
      if (now >= deadline) {
        this.pendingFatal.delete(gimmickId);
        this.dispatchGimmick(gimmick, now, MAP_TRIGGER_BY_GIMMICK[gimmick.trigger]);
      }
    }
  }

  private updateWallDeaths(now: number): void {
    for (const [gimmickId, deadline] of this.wallDeathDeadlines) {
      if (now < deadline) continue;
      this.wallDeathDeadlines.delete(gimmickId);
      const gimmick = this.map.gimmicks.find((candidate) => candidate.id === gimmickId);
      if (gimmick) this.requestDeath(gimmick, now);
    }
  }

  private updateNameBubble(jumpPressed: boolean, now: number): void {
    const gimmick = this.map.gimmicks.find((candidate) => {
      if (candidate.kind !== "name-bubble-control-loss") return false;
      return this.entries.get(candidate.id)?.status === "triggered";
    });
    if (!gimmick) {
      return;
    }
    const state = this.entries.get(gimmick.id);
    if (!state || state.status !== "triggered" || state.startedAt === null) {
      return;
    }

    if (jumpPressed) {
      const counterpresses = this.player.registerEscapePress(gimmick.id);
      const next: RuntimeEntry = { ...state, counterpresses };
      this.entries.set(gimmick.id, next);
      this.eventBus.emit("gimmick-counterplay-progress", {
        gimmickId: gimmick.id,
        current: counterpresses,
        required: gimmick.counterplay.requiredPresses ?? 100,
        now,
      });
      if (counterpresses >= (gimmick.counterplay.requiredPresses ?? 100)) {
        this.setStatus(gimmick, "escaped", now);
        this.mapInteraction.triggerObject(gimmick.objectId, "input-mash", now);
        this.hideNameBubble();
        return;
      }
    }

    if (now - state.startedAt >= (gimmick.counterplay.windowMs ?? 2200)) {
      this.setStatus(gimmick, "dead", now);
      this.pendingFatal.delete(gimmick.id);
      this.mapInteraction.triggerObject(gimmick.objectId, "timer-expired", now);
    }
  }

  private updateRisingGround(
    gimmick: WorldGimmickDefinition,
    state: RuntimeEntry,
    now: number,
  ): void {
    if (state.startedAt === null) {
      return;
    }
    const riseAt = state.startedAt + 1000;
    if (now < riseAt) {
      return;
    }

    if (!this.riseBodies.get(gimmick.id)?.visible) {
      this.setPhysicalActive(this.riseBodies.get(gimmick.id), true);
      this.mapInteraction.triggerObject(gimmick.objectId, "timer", now);
      if (this.overlapsGimmick(gimmick)) {
        this.requestDeath(gimmick, now);
        return;
      }
    }

    if (now >= riseAt + 420) {
      this.setPhysicalActive(this.riseBodies.get(gimmick.id), false);
      this.setStatus(gimmick, "escaped", now);
    }
  }

  private createPhysicalTrigger(gimmick: WorldGimmickDefinition): void {
    const floorY = gimmick.y + gimmick.height;
    if (gimmick.kind === "forward-jump-wall") {
      const wall = this.scene.add.rectangle(
        gimmick.x + gimmick.width + 8,
        floorY - 68,
        16,
        96,
        0x000000,
        0,
      );
      this.scene.physics.add.existing(wall, true);
      (wall.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      wall.setVisible(false);
      this.scene.physics.add.collider(this.player, wall, () => {
        const state = this.entries.get(gimmick.id);
        if (!state || state.status !== "triggered" || this.player.body.velocity.x <= 0) {
          return;
        }
        this.handleWallImpact(gimmick, this.scene.time.now);
      });
      this.wallBodies.set(gimmick.id, wall);
    } else if (gimmick.kind === "ground-rise") {
      const slab = this.scene.add.rectangle(
        gimmick.x + gimmick.width / 2,
        floorY - 24,
        gimmick.width,
        48,
        0x9aa39a,
      );
      this.scene.physics.add.existing(slab, true);
      (slab.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      slab.setVisible(false);
      this.scene.physics.add.overlap(this.player, slab, () => {
        const state = this.entries.get(gimmick.id);
        if (state?.status === "triggered" && slab.visible) {
          this.requestDeath(gimmick, this.scene.time.now);
        }
      });
      this.riseBodies.set(gimmick.id, slab);
    }
  }

  private createGimmickVisual(gimmick: WorldGimmickDefinition): void {
    const frame = this.getVisualFrame(gimmick, false);
    if (!frame || !this.scene.textures.exists("world-01-props")) {
      return;
    }
    const image = this.scene.add.image(
      gimmick.x + gimmick.width / 2,
      this.getVisualY(gimmick),
      "world-01-props",
      frame,
    );
    image.setDisplaySize(...this.getVisualSize(gimmick));
    image.setDepth(gimmick.kind === "fake-checkpoint" ? 2 : 1);
    image.setVisible(this.isDefaultVisible(gimmick));
    this.visuals.set(gimmick.id, image);
  }

  private createFakeCheckpointSpikes(): void {
    for (const object of this.map.objectDefinitions.filter(
      (candidate) => candidate.properties.triggeredByFakeCheckpoint === true,
    )) {
      const key = "world-01-prop-white-spike-triggered";
      if (!this.scene.textures.exists(key)) {
        continue;
      }
      const image = this.scene.add.image(
        object.x + object.width / 2,
        object.y + object.height / 2,
        key,
      );
      image.setDisplaySize(48, 28).setDepth(4).setVisible(false);
      this.fakeSpikeVisuals.set(object.id, image);
    }
  }

  private updateChainSources(now: number): void {
    for (const object of this.map.objectDefinitions) {
      if (
        object.kind !== "interactive" ||
        typeof object.properties.chainId !== "string" ||
        !object.properties.chainId.startsWith("world01-cat-chain-") ||
        this.triggeredChainSources.has(object.id)
      ) {
        continue;
      }
      const rect = new Phaser.Geom.Rectangle(object.x, object.y, object.width, object.height);
      if (Phaser.Geom.Rectangle.Overlaps(this.getPlayerBounds(), rect)) {
        this.triggeredChainSources.add(object.id);
        this.mapInteraction.triggerObject(object.id, "object-enter", now);
      }
    }
  }

  private beginGimmick(
    gimmick: WorldGimmickDefinition,
    now: number,
    trigger: MapChainTrigger,
  ): void {
    if (this.entries.get(gimmick.id)?.status !== "armed") {
      return;
    }
    this.setStatus(gimmick, "triggered", now);
    this.eventBus.emit("gimmick-triggered", {
      stageId: this.stage.id,
      gimmickId: gimmick.id,
      kind: gimmick.kind,
      trigger,
      now,
    });
    this.dispatchGimmick(gimmick, now, trigger);
  }

  private dispatchGimmick(
    gimmick: WorldGimmickDefinition,
    now: number,
    trigger: MapChainTrigger,
  ): void {
    this.mapInteraction.triggerObject(
      gimmick.objectId,
      trigger,
      now,
    );
  }

  private setStatus(
    gimmick: WorldGimmickDefinition,
    status: GimmickRuntimeStatus,
    startedAt = this.scene.time.now,
  ): void {
    const previous = this.entries.get(gimmick.id);
    this.entries.set(gimmick.id, {
      gimmickId: gimmick.id,
      status,
      startedAt: status === "armed" ? null : previous?.startedAt ?? startedAt,
      counterpresses: previous?.counterpresses ?? 0,
      snapshotSeed: previous?.snapshotSeed ?? this.snapshotSeed,
    });
  }

  private requestDeath(gimmick: WorldGimmickDefinition, now: number): void {
    if (this.entries.get(gimmick.id)?.status === "dead") {
      return;
    }
    this.setStatus(gimmick, "dead", now);
    this.eventBus.emit("gimmick-outcome", {
      gimmickId: gimmick.id,
      outcome: gimmick.outcome.kind,
      deathCause: gimmick.outcome.deathCause,
      now,
    });
    this.eventBus.emit("death-requested", {
      stageId: this.stage.id,
      cause: gimmick.outcome.deathCause,
      checkpointId: this.getCheckpointId(),
      gimmickId: gimmick.id,
      outcome: gimmick.outcome.kind,
      now,
    });
  }

  private checkWorldBounds(now: number): void {
    if (this.player.body.bottom >= this.stage.mapHeight - 48) {
      const collapsedFloor = [...this.entries.values()].find((entry) => {
        const definition = this.map.gimmicks.find(
          (gimmick) => gimmick.id === entry.gimmickId,
        );
        return entry.status === "triggered" && definition?.kind === "ground-collapse";
      });
      const cause = collapsedFloor
        ? this.map.gimmicks.find((gimmick) => gimmick.id === collapsedFloor.gimmickId)
        : undefined;
      if (cause) this.requestDeath(cause, now);
      else this.requestFallDeath(now);
      return;
    }
    for (const entry of this.entries.values()) {
      if (entry.status !== "triggered") continue;
      const gimmick = this.map.gimmicks.find((candidate) => candidate.id === entry.gimmickId);
      if (!gimmick) continue;
      if (
        gimmick.outcome.kind === "forced-control-death" &&
        gimmick.outcome.controlOverride === "drift-backward" &&
        this.player.x - this.scene.cameras.main.scrollX <= this.player.displayWidth / 2
      ) {
        this.requestDeath(gimmick, now);
      } else if (
        gimmick.outcome.kind === "launch-death" &&
        this.player.body.top <= 0
      ) {
        this.requestDeath(gimmick, now);
      }
    }
  }

  private requestFallDeath(now: number): void {
    this.eventBus.emit("death-requested", {
      stageId: this.stage.id,
      cause: "fall",
      checkpointId: this.getCheckpointId(),
      now,
    });
  }

  private removeGround(gimmick: WorldGimmickDefinition): void {
    const layer = this.loadedMap?.layers.gameplay;
    if (!layer || this.collapsedTiles.has(gimmick.id)) {
      return;
    }
    const tileStartX = Math.floor(gimmick.x / this.map.tileWidth);
    const tileEndX = Math.ceil((gimmick.x + gimmick.width) / this.map.tileWidth);
    const floorRow = Math.floor((gimmick.y + gimmick.height) / this.map.tileHeight);
    const removed: Array<{ x: number; y: number; index: number }> = [];
    for (let x = tileStartX; x < tileEndX; x += 1) {
      for (let y = floorRow; y < floorRow + 2; y += 1) {
        const tile = layer.getTileAt(x, y);
        if (tile && tile.index >= 0) {
          removed.push({ x, y, index: tile.index });
          layer.removeTileAt(x, y, false);
        }
      }
    }
    this.collapsedTiles.set(gimmick.id, removed);
    this.scene.cameras.main.shake(90, 0.006);
  }

  private restoreCollapsedTiles(): void {
    const layer = this.loadedMap?.layers.gameplay;
    if (!layer) {
      this.collapsedTiles.clear();
      return;
    }
    for (const tiles of this.collapsedTiles.values()) {
      for (const tile of tiles) {
        layer.putTileAt(tile.index, tile.x, tile.y, true);
      }
    }
    this.collapsedTiles.clear();
  }

  private setPhysicalActive(
    object: Phaser.GameObjects.Rectangle | undefined,
    active: boolean,
  ): void {
    if (!object) {
      return;
    }
    object.setVisible(active);
    const body = object.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) {
      body.enable = active;
      body.updateFromGameObject();
    }
  }

  private handleWallImpact(gimmick: WorldGimmickDefinition, now: number): void {
    this.setPhysicalActive(this.wallBodies.get(gimmick.id), false);
    this.player.setVelocity(-420, -760);
    this.scene.cameras.main.shake(120, 0.012);
    this.wallDeathDeadlines.set(gimmick.id, now + 620);
  }

  private showTriggeredVisual(gimmick: WorldGimmickDefinition): void {
    if (gimmick.kind === "box-cat-arm") {
      const key = "world-01-prop-cat-box-triggered";
      if (this.scene.textures.exists(key)) {
        const image = this.scene.add.image(gimmick.x + gimmick.width / 2 + 28, this.getVisualY(gimmick), key);
        image.setDisplaySize(42, 32).setDepth(3);
        this.spikeObjects.set(gimmick.id, image);
      }
    }
    if (gimmick.kind === "cloud-rain") {
      this.scene.cameras.main.flash(80, 188, 207, 228, false);
    }
  }

  private changeBoneVisual(gimmick: WorldGimmickDefinition): void {
    const frame = this.getVisualFrame(gimmick, true);
    if (frame) {
      this.visuals.get(gimmick.id)?.setFrame(frame);
    }
  }

  private showNameBubble(): void {
    if (this.bubble) {
      return;
    }
    const background = this.scene.add.rectangle(178, 210, 300, 88, 0xfff8e7, 1)
      .setStrokeStyle(4, 0x473843);
    this.bubbleText = this.scene.add.text(66, 180, `${this.playerName}야~~`, {
      color: "#473843",
      fontFamily: "monospace",
      fontSize: "28px",
      fontStyle: "bold",
    });
    this.bubble = this.scene.add.container(0, 0, [background, this.bubbleText]);
    this.bubble.setScrollFactor(0).setDepth(1000);
  }

  private hideNameBubble(): void {
    this.bubble?.destroy(true);
    this.bubble = undefined;
    this.bubbleText = undefined;
  }

  private overlapsGimmick(gimmick: WorldGimmickDefinition): boolean {
    const floorY = gimmick.y + gimmick.height;
    let zone: Phaser.Geom.Rectangle;
    switch (gimmick.kind) {
      case "ant-trip":
        zone = new Phaser.Geom.Rectangle(gimmick.x, floorY - 28, gimmick.width, 28);
        break;
      case "revealed-white-spike":
        zone = new Phaser.Geom.Rectangle(gimmick.x + 12, floorY - 20, gimmick.width - 24, 20);
        break;
      case "jump-pigeon":
      case "box-cat-arm":
      case "cloud-rain":
        zone = new Phaser.Geom.Rectangle(gimmick.x - 12, floorY - 160, gimmick.width + 24, 160);
        break;
      default:
        zone = new Phaser.Geom.Rectangle(gimmick.x, gimmick.y, gimmick.width, gimmick.height);
    }
    return Phaser.Geom.Rectangle.Overlaps(this.getPlayerBounds(), zone);
  }

  private getPlayerBounds(): Phaser.Geom.Rectangle {
    const body = this.player.body;
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  private isGrounded(): boolean {
    return this.player.body.blocked.down || this.player.body.touching.down;
  }

  private isMovingForward(): boolean {
    return !this.player.flipX && this.player.body.velocity.x > 0;
  }

  private isMovingBackward(): boolean {
    return this.player.flipX && this.player.body.velocity.x < -16;
  }

  private getVisualFrame(
    gimmick: WorldGimmickDefinition,
    revealed: boolean,
  ): string | undefined {
    if (!revealed && [
      "fake-bone-green",
      "fake-bone-reverse",
      "fake-bone-fire",
    ].includes(gimmick.kind)) {
      return getAssetFrameKey("world-01-prop-bone-coin");
    }
    if (gimmick.kind === "fake-bone-green") {
      return getAssetFrameKey("world-01-prop-bone-coin-green");
    }
    if (gimmick.kind === "fake-bone-reverse") {
      return getAssetFrameKey("world-01-prop-bone-coin-reverse");
    }
    if (gimmick.kind === "fake-bone-fire") {
      return getAssetFrameKey("world-01-prop-bone-coin-fire");
    }
    return getAssetFrameKey("world-01-prop-" + gimmick.visualKey);
  }

  private getVisualY(gimmick: WorldGimmickDefinition): number {
    const floorY = gimmick.y + gimmick.height;
    switch (gimmick.kind) {
      case "ant-trip":
      case "box-cat-arm":
      case "revealed-white-spike":
        return floorY;
      case "fake-checkpoint":
        return floorY - 10;
      case "jump-pigeon":
        return floorY - 32;
      case "cloud-rain":
        return floorY - 120;
      case "name-bubble-control-loss":
        return floorY - 92;
      case "fake-bone-green":
      case "fake-bone-reverse":
      case "fake-bone-fire":
        return floorY - 58;
      default:
        return floorY - 16;
    }
  }

  private getVisualSize(gimmick: WorldGimmickDefinition): [number, number] {
    switch (gimmick.kind) {
      case "ant-trip": return [30, 20];
      case "fake-bone-green":
      case "fake-bone-reverse":
      case "fake-bone-fire": return [34, 26];
      case "fake-checkpoint": return [30, 56];
      case "box-cat-arm": return [42, 36];
      case "cloud-rain": return [56, 38];
      case "jump-pigeon": return [34, 32];
      case "revealed-white-spike": return [38, 28];
      case "name-bubble-control-loss": return [42, 34];
      default: return [32, 24];
    }
  }

  private isDefaultVisible(gimmick: WorldGimmickDefinition): boolean {
    return [
      "ant-trip",
      "fake-bone-green",
      "fake-bone-reverse",
      "fake-bone-fire",
      "fake-checkpoint",
      "box-cat-arm",
      "cloud-rain",
    ].includes(gimmick.kind);
  }
}
