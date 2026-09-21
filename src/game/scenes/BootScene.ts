import * as Phaser from "phaser";
import { CONTENT_REGISTRY } from "../data";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super("BootScene");
  }

  public create(): void {
    this.registry.set("contentRegistry", CONTENT_REGISTRY);
    this.scene.start("PreloadScene");
  }
}
