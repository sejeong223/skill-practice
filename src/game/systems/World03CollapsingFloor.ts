import type * as Phaser from "phaser";
import type { StageId } from "../core/types";
import { getWorld03CollapseZones, type World03CollapseZone } from "../data/world03Construction";
import type { Player } from "../entities/Player";
import { shouldCollapseWorld03Floor } from "./world03CollapseTrigger";

interface FloorSection {
  readonly zone: Phaser.GameObjects.Zone;
  readonly collider: Phaser.Physics.Arcade.Collider;
}

interface CollapseSection extends FloorSection {
  readonly definition: World03CollapseZone;
  readonly cavity: Phaser.GameObjects.Rectangle;
  readonly slab: Phaser.GameObjects.TileSprite;
  collapsed: boolean;
  fallElapsedMs: number;
}

const SLAB_START_Y = 499;
const SLAB_FALL_DISTANCE = 96;
const SLAB_FALL_DURATION_MS = 180;

export class World03CollapsingFloor {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly originalBody: Phaser.Physics.Arcade.StaticBody;
  private readonly solidSections: FloorSection[] = [];
  private readonly collapseSections: CollapseSection[] = [];

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    stageId: StageId,
    originalFloor: Phaser.GameObjects.Rectangle,
    mapWidth: number,
    mapHeight: number,
  ) {
    this.scene = scene;
    this.player = player;
    this.originalBody = originalFloor.body as Phaser.Physics.Arcade.StaticBody;
    const zones = getWorld03CollapseZones(stageId);
    if (zones.length === 0) return;

    const floorTop = 504;
    const visualTop = floorTop - 5;
    const visualHeight = mapHeight - visualTop;
    const textureHeight = scene.textures.get("world-03-construction-floor").getSourceImage().height;
    let cursor = 0;
    for (const definition of zones) {
      this.solidSections.push(this.createFloorSection(cursor, definition.x));
      const section = this.createFloorSection(definition.x, definition.x + definition.width);
      const cavity = scene.add.rectangle(definition.x, visualTop, definition.width, visualHeight, 0x172126)
        .setOrigin(0).setDepth(-1).setVisible(false);
      const slab = scene.add.tileSprite(definition.x, visualTop, definition.width, visualHeight,
        "world-03-construction-floor")
        .setOrigin(0).setDepth(-0.5).setTilePosition(definition.x, 0)
        .setTileScale(1, visualHeight / textureHeight).setVisible(false);
      this.collapseSections.push({ ...section, definition, cavity, slab, collapsed: false, fallElapsedMs: 0 });
      cursor = definition.x + definition.width;
    }
    this.solidSections.push(this.createFloorSection(cursor, mapWidth));
    this.originalBody.enable = false;
  }

  public update(deltaMs = 0): void {
    const elapsed = Number.isFinite(deltaMs) ? Math.min(50, Math.max(0, deltaMs)) : 0;
    const body = this.player.body;
    const approach = {
      left: body.left,
      right: body.right,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      grounded: body.blocked.down || body.touching.down,
    };
    for (const section of this.collapseSections) {
      if (!section.collapsed && shouldCollapseWorld03Floor(section.definition, approach)) {
        section.collapsed = true;
        (section.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        section.cavity.setVisible(true);
        section.slab.setVisible(true).setAlpha(1).setY(SLAB_START_Y);
      }
      if (!section.collapsed || section.fallElapsedMs >= SLAB_FALL_DURATION_MS) continue;
      section.fallElapsedMs = Math.min(SLAB_FALL_DURATION_MS, section.fallElapsedMs + elapsed);
      const progress = section.fallElapsedMs / SLAB_FALL_DURATION_MS;
      section.slab.setY(SLAB_START_Y + SLAB_FALL_DISTANCE * progress)
        .setAlpha(1 - progress)
        .setVisible(progress < 1);
    }
  }

  public resetForAttempt(): void {
    for (const section of this.collapseSections) {
      section.collapsed = false;
      section.fallElapsedMs = 0;
      (section.zone.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      section.cavity.setVisible(false);
      section.slab.setVisible(false).setAlpha(1).setY(SLAB_START_Y);
    }
  }

  public destroy(): void {
    this.originalBody.enable = true;
    for (const section of [...this.solidSections, ...this.collapseSections]) {
      section.collider.destroy();
      section.zone.destroy();
    }
    for (const section of this.collapseSections) {
      section.cavity.destroy();
      section.slab.destroy();
    }
    this.solidSections.length = 0;
    this.collapseSections.length = 0;
  }

  private createFloorSection(left: number, right: number): FloorSection {
    const zone = this.scene.add.zone((left + right) / 2, 520, right - left, 32);
    this.scene.physics.add.existing(zone, true);
    (zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    return { zone, collider: this.scene.physics.add.collider(this.player, zone) };
  }
}
