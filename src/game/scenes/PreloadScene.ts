import * as Phaser from "phaser";
import { PIXEL_ASSETS } from "../assets/assetManifest";
import type { PixelAssetDefinition } from "../assets/assetTypes";
import type { ProgressState } from "../core/types";
import { STAGE_IDS } from "../core/constants";
import { FEEDBACK_AUDIO } from "../audio/audioManifest";
import { getWorld01Respawn } from "../systems/world01Respawn";

export class PreloadScene extends Phaser.Scene {
  private loadError: string | null = null;

  public constructor() {
    super("PreloadScene");
  }

  public preload(): void {
    const progressBar = this.add.graphics();
    const progressTrack = this.add.graphics();
    const barWidth = 360;
    const barHeight = 18;
    const barX = (this.scale.width - barWidth) / 2;
    const barY = this.scale.height / 2;

    progressTrack.fillStyle(0xead8b2, 1);
    progressTrack.fillRoundedRect(barX, barY, barWidth, barHeight, 6);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x9a4d56, 1);
      progressBar.fillRoundedRect(
        barX,
        barY,
        Math.max(4, barWidth * value),
        barHeight,
        6,
      );
    });

    this.load.on(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      (file: Phaser.Loader.File) => {
        const asset = PIXEL_ASSETS.find((candidate) => candidate.key === file.key);

        const feedback = Object.values(FEEDBACK_AUDIO).find(sound => sound.cacheKey === file.key);
        if (feedback) {
          this.loadError = "필수 효과음을 불러오지 못했습니다: " + feedback.url;
        } else if (asset?.required) {
          this.loadError =
            "필수 에셋을 불러오지 못했습니다: " + asset.key + " (" + asset.url + ")";
        }
      },
    );

    this.load.once("complete", () => {
      progressBar.destroy();
      progressTrack.destroy();
    });

    for (const asset of PIXEL_ASSETS) {
      if (asset.required) {
        this.loadAsset(asset);
      }
    }
    for (const sound of Object.values(FEEDBACK_AUDIO)) {
      // Decode through Tone's context, not Phaser's separately suspended context.
      this.load.binary(sound.cacheKey, sound.url);
    }
  }

  public create(): void {
    const progress = this.registry.get("progressState") as ProgressState | undefined;
    if (!this.loadError && progress?.onboardingCompleted) {
      const firstUncleared = STAGE_IDS.find(
        (stageId) => !progress.clearedStages.includes(stageId),
      );
      const world01Complete = STAGE_IDS.slice(0, 5).every(
        (stageId) => progress.clearedStages.includes(stageId),
      );
      if (!firstUncleared || (world01Complete && firstUncleared === "world-02-stage-1")) {
        this.scene.start("World01StageClearScene", {
          stageId: "world-01-stage-boss",
          nextStageId: "world-02-stage-1",
        });
        return;
      }
      this.scene.start("StageScene", {
        ...(firstUncleared.startsWith("world-01-")
          ? getWorld01Respawn(progress) : { stageId: firstUncleared }),
        playerName: progress.playerName,
      });
      return;
    }

    this.scene.start("IntroScene", {
      assetLoadError: this.loadError,
    });
  }

  private loadAsset(asset: PixelAssetDefinition): void {
    switch (asset.kind) {
      case "image":
        this.load.image(asset.key, asset.url);
        break;
      case "spritesheet":
        if (asset.frameWidth && asset.frameHeight) {
          this.load.spritesheet(asset.key, asset.url, {
            frameWidth: asset.frameWidth,
            frameHeight: asset.frameHeight,
          });
        }
        break;
      case "atlas":
        this.load.atlas(
          asset.key,
          asset.url,
          asset.url.replace(/\.[^/.]+$/, ".json"),
        );
        break;
      case "audio":
        this.load.audio(asset.key, asset.url);
        break;
      case "tilemap":
        this.load.tilemapTiledJSON(asset.key, asset.url);
        break;
    }
  }
}
