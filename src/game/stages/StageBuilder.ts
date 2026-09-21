import * as Phaser from "phaser";
import type { ProgressState, RuntimeStageState, StageDefinition } from "../core/types";
import { GameEventBus } from "../bridge/GameEventBus";
import { StageRuntime } from "./StageRuntime";
import { StageEntityFactory } from "./StageEntityFactory";
import type { LoadedMap } from "../maps/mapTypes";

export class StageBuilder {
  private readonly factory: StageEntityFactory;
  private readonly eventBus?: GameEventBus;
  private readonly progress?: ProgressState;

  public constructor(
    factory = new StageEntityFactory(),
    eventBus?: GameEventBus,
    progress?: ProgressState,
  ) {
    this.factory = factory;
    this.eventBus = eventBus;
    this.progress = progress;
  }

  public build(
    scene: Phaser.Scene,
    definition: StageDefinition,
    seed: number,
    runtimeState?: RuntimeStageState,
    loadedMap: LoadedMap | null = null,
  ): StageRuntime {
    const runtime = new StageRuntime(
      scene,
      definition,
      runtimeState,
      this.eventBus,
      this.factory,
      this.progress,
      loadedMap,
    );
    runtime.runtimeState.randomSeed = seed;
    runtime.build();
    return runtime;
  }
}
