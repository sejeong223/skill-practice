import type { StageId } from "../core/types";

export type CutsceneSpeaker = "narrator" | "owner" | "corgi" | "cat";

export interface CameraAction {
  readonly kind: "pan" | "zoom" | "shake" | "fade";
  readonly x?: number;
  readonly y?: number;
  readonly value?: number;
  readonly durationMs?: number;
}

export interface ActorAction {
  readonly actor: "corgi" | "owner" | "tuxedo-cat" | "rib" | "slipper";
  readonly action: "enter" | "reveal" | "steal" | "taunt" | "hold" | "throw" | "leap";
  readonly x?: number;
  readonly y?: number;
}

export interface DialogueLine {
  readonly speaker: CutsceneSpeaker;
  readonly text: string;
}

export interface ItemCardData {
  readonly title: string;
  readonly description: string;
}

export interface CutsceneBeat {
  readonly id: string;
  readonly durationMs: number;
  readonly camera?: readonly CameraAction[];
  readonly actors?: readonly ActorAction[];
  readonly narration?: string;
  readonly dialogue?: readonly DialogueLine[];
  readonly itemCard?: ItemCardData;
  readonly soundCue?: string;
  readonly musicKey?: string;
  readonly skipAllowedAfterSeen: boolean;
}

export interface CutsceneScript {
  readonly id: string;
  readonly stageId?: StageId;
  readonly beats: readonly CutsceneBeat[];
}
