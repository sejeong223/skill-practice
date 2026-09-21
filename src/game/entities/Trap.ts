import * as Phaser from "phaser";
import type { TrapDefinition } from "../core/contentTypes";

export class Trap extends Phaser.GameObjects.Rectangle {
  public readonly definition: TrapDefinition;
  public readonly triggerRegion: Phaser.Geom.Rectangle;

  public constructor(
    scene: Phaser.Scene,
    definition: TrapDefinition,
    x = definition.x,
    y = definition.y,
  ) {
    super(
      scene,
      x,
      y,
      definition.width,
      definition.height,
      definition.lethal ? 0xb42d65 : 0xf0b95f,
      0.65,
    );
    this.definition = definition;
    this.triggerRegion = new Phaser.Geom.Rectangle(
      x,
      y,
      definition.width,
      definition.height,
    );
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(-1);
  }

  public setTriggerPosition(x: number, y: number): void {
    this.setPosition(x, y);
    this.triggerRegion.setPosition(x, y);
  }
}
