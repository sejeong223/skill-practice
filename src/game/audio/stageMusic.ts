import type { StageId, WorldId } from "../core/types";
import type { MusicKey } from "./audioManifest";

export const STAGE_MUSIC_BY_WORLD: Readonly<Record<WorldId, {
  readonly normal: MusicKey;
  readonly boss: MusicKey;
}>> = {
  "world-01": { normal: "world-01-peaceful", boss: "world-01-calico" },
  "world-02": { normal: "world-02-amusement", boss: "boss" },
  "world-03": { normal: "world-03-factory", boss: "boss" },
  "world-04": { normal: "world-04-rooftop", boss: "boss" },
  "world-05": { normal: "world-05-kingdom", boss: "boss" },
};

export function getStageMusicKey(stageId: StageId): MusicKey {
  const worldId = stageId.split("-stage-")[0] as WorldId;
  const music = STAGE_MUSIC_BY_WORLD[worldId];
  return stageId.endsWith("-boss") ? music.boss : music.normal;
}
