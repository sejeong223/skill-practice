import * as Phaser from "phaser";
import type { MapSectionDefinition } from "../core/contentTypes";
import type { StageDefinition } from "../core/types";
import { Player } from "../entities/Player";
import type { LoadedMap } from "../maps/mapTypes";
import { MapInteractionSystem } from "../maps/MapInteractionSystem";
import { StageRuntime } from "../stages/StageRuntime";

interface BoundedObject {
  getBounds?: () => Phaser.Geom.Rectangle;
}

export class MapDebugOverlay {
  private readonly scene: Phaser.Scene;
  private readonly stage: StageDefinition;
  private readonly runtime: StageRuntime;
  private readonly player: Player;
  private readonly mapInteraction: MapInteractionSystem;
  private readonly loadedMap: LoadedMap | null;
  private readonly text: Phaser.GameObjects.Text;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly toggleKey?: Phaser.Input.Keyboard.Key;
  private visible = true;

  public constructor(
    scene: Phaser.Scene,
    stage: StageDefinition,
    runtime: StageRuntime,
    player: Player,
    mapInteraction: MapInteractionSystem,
    loadedMap: LoadedMap | null,
  ) {
    this.scene = scene;
    this.stage = stage;
    this.runtime = runtime;
    this.player = player;
    this.mapInteraction = mapInteraction;
    this.loadedMap = loadedMap;
    this.graphics = scene.add.graphics().setDepth(1500);
    this.text = scene.add.text(12, 12, "", {
      color: "#f8f1de",
      backgroundColor: "#272331cc",
      fontFamily: "monospace",
      fontSize: "13px",
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(1600).setResolution(2);

    if (scene.input.keyboard) {
      this.toggleKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
      this.toggleKey.on("down", this.toggle, this);
    }
  }

  public update(): void {
    if (!this.visible) {
      return;
    }

    const camera = this.scene.cameras.main;
    const section = this.getCurrentSection();
    const mapState = this.mapInteraction.getDebugState();
    const activeObjects = Object.entries(mapState.objectStates)
      .filter(([, state]) => state.active)
      .map(([id]) => id)
      .slice(0, 5);
    const screenX = (this.player.x - camera.scrollX) * camera.zoom;

    this.text.setText([
      "[F1] map debug",
      "stage: " + this.stage.id + " / " + this.stage.worldId,
      "section: " + (section ? section.index + " " + section.role : "none"),
      "attempt: " + this.runtime.runtimeState.attempt +
        "  seed: " + this.runtime.runtimeState.randomSeed,
      "checkpoint: " + (this.runtime.runtimeState.checkpointId ?? "none"),
      "chains: " + (mapState.firedChainIds.join(",") || "none"),
      "objects: " + (activeObjects.join(",") || "none"),
      "player screen x: " + Math.round(screenX) +
        "  camera: " + Math.round(camera.scrollX) + "," + Math.round(camera.scrollY),
      "bounds: " + this.stage.mapWidth + "x" + this.stage.mapHeight,
    ]);

    this.drawDiagnostics(section);
  }

  public destroy(): void {
    this.toggleKey?.off("down", this.toggle, this);
    if (this.toggleKey) {
      this.scene.input.keyboard?.removeKey(this.toggleKey, true);
    }
    this.text.destroy();
    this.graphics.destroy();
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
    this.graphics.setVisible(this.visible);
  }

  private getCurrentSection(): MapSectionDefinition | undefined {
    return this.stage.map?.sections.find(
      (section) =>
        this.player.x >= section.x &&
        this.player.x < section.x + section.width,
    );
  }

  private drawDiagnostics(section?: MapSectionDefinition): void {
    this.graphics.clear();

    if (section) {
      this.graphics.lineStyle(2, 0x72d6a2, 0.9);
      this.graphics.strokeRect(section.x, 0, section.width, this.stage.mapHeight);
    }

    const body = this.player.body;
    this.graphics.lineStyle(2, 0xf4d35e, 1);
    this.graphics.strokeRect(body.x, body.y, body.width, body.height);

    for (const record of this.runtime.getEntities()) {
      const bounded = record.entity as unknown as BoundedObject;
      const bounds = bounded.getBounds?.();
      if (!bounds) {
        continue;
      }

      const color =
        record.kind === "trap"
          ? this.isLethalTrap(record.entity) ? 0xe85d75 : 0xf0b95f
          : record.kind === "checkpoint"
            ? 0x72d6a2
            : record.kind === "exit"
              ? 0x67b7dc
              : 0xffffff;
      this.graphics.lineStyle(1, color, 0.85);
      this.graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    const foreground = this.loadedMap?.layers.foreground;
    if (foreground) {
      const bounds = foreground.getBounds();
      this.graphics.lineStyle(1, 0xd88cff, 0.7);
      this.graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
  }

  private isLethalTrap(entity: Phaser.GameObjects.GameObject): boolean {
    const trap = entity as unknown as { definition?: { lethal?: boolean } };
    return trap.definition?.lethal === true;
  }
}
