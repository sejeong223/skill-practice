import type Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { World04Rect } from "../data/world04Types";
export function playerRect(player: Player): World04Rect {
  const b = player.body; return { x: b.x, y: b.y, width: b.width, height: b.height };
}
export function syncPlayerHistory(player: Player): void {
  player.body.updateFromGameObject();
  player.body.prev.copy(player.body.position); player.body.prevFrame.copy(player.body.position);
}
export interface World04SolidHandle {
  readonly zone: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.StaticBody;
  setRect(rect: World04Rect | null): void;
  destroy(): void;
}
export function createWorld04Solid(scene: Phaser.Scene, player: Player, rect: World04Rect, onContact?: () => void): World04SolidHandle {
  const zone = scene.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0);
  scene.physics.add.existing(zone, true);
  const body = zone.body as Phaser.Physics.Arcade.StaticBody;
  const collider = scene.physics.add.collider(player, zone, onContact);
  let destroyed = false;
  return { zone, body,
    setRect(r) {
      body.enable = !!r;
      if (r) { zone.setPosition(r.x, r.y).setSize(r.width, r.height); body.setSize(r.width, r.height); body.updateFromGameObject(); }
    },
    destroy() { if (destroyed) return; destroyed = true; collider.destroy(); zone.destroy(); },
  };
}
