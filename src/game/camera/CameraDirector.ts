import * as Phaser from "phaser";
import type { MapSectionDefinition } from "../core/contentTypes";
import type { StageDefinition } from "../core/types";
import { Player } from "../entities/Player";

export class CameraDirector {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly player: Player;
  private readonly stage: StageDefinition;

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    stage: StageDefinition,
  ) {
    this.camera = scene.cameras.main;
    this.player = player;
    this.stage = stage;
  }

  public followPlayer(): void {
    this.camera.setBounds(
      0,
      0,
      this.stage.mapWidth,
      this.stage.mapHeight,
    );
    this.camera.startFollow(this.player, true, 0.08, 0, -320, 0);
  }

  public setSectionMode(section?: MapSectionDefinition): void {
    const followsVertical = Boolean(
      section?.vertical && this.stage.mapHeight > this.camera.height,
    );

    this.camera.setFollowOffset(-320, 0);
    // startFollow snaps scroll immediately; changing sections must keep the
    // current camera position and the existing follow target.
    this.camera.setLerp(0.08, followsVertical ? 0.08 : 0);
  }

  public pauseFollow(): void {
    this.camera.stopFollow();
  }

  public playCutscene(
    x: number,
    y: number,
    durationMs = 700,
    zoom = 1.15,
  ): void {
    this.pauseFollow();
    this.camera.pan(x, y, durationMs, "Sine.easeInOut");
    this.camera.zoomTo(zoom, durationMs, "Sine.easeInOut");
  }

  public endCutscene(): void {
    this.camera.zoomTo(1, 350, "Sine.easeInOut");
    this.followPlayer();
  }

  public fadeToBlack(durationMs = 250): void {
    this.camera.fade(durationMs, 0, 0, 0);
  }

  public shake(durationMs = 160, intensity = 0.006): void {
    this.camera.shake(durationMs, intensity);
  }
}
