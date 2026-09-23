"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { InputAction, ProgressState, RuntimeStageState, StageId, ToolDefinition } from "@/game/core/types";
import { createDefaultProgressState, createRuntimeStageState } from "@/game/core/constants";
import { SKILL_DEFINITIONS } from "@/game/data/skills";
import { TOOL_DEFINITIONS } from "@/game/data/tools";
import { getStageDefinition } from "@/game/data";
import { GameEventBus, type GameEventType } from "@/game/bridge/GameEventBus";
import { AutoSaveCoordinator } from "@/game/persistence/AutoSaveCoordinator";
import { ProgressStore } from "@/game/persistence/ProgressStore";
import { EconomySystem } from "@/game/systems/EconomySystem";
import { GameEventBridge } from "./GameEventBridge";
import { CutsceneOverlay } from "./CutsceneOverlay";
import { GameOverlay } from "./GameOverlay";
import { PhaserGame } from "./PhaserGame";
import { IntroTitleOverlay } from "./IntroTitleOverlay";

export interface GameShellProps {
  readonly initialStageId: StageId;
  readonly onExit?: () => void;
}
type UiMode = "safe" | "play" | "cutscene" | "dead";

function cloneProgress(progress: ProgressState): ProgressState {
  return {
    ...progress,
    clearedStages: [...progress.clearedStages],
    unlockedSkills: [...progress.unlockedSkills],
    ownedToolIds: [...progress.ownedToolIds],
    collectedItems: [...progress.collectedItems],
    deathsByStage: { ...progress.deathsByStage },
    seenCutsceneIds: [...progress.seenCutsceneIds],
    discoveredDrawbackIds: [...progress.discoveredDrawbackIds],
    keybinds: { ...progress.keybinds },
  };
}

export function GameShell({ initialStageId, onExit }: GameShellProps): ReactElement {
  const eventBus = useMemo(() => new GameEventBus(), []);
  const storeRef = useRef(new ProgressStore());
  const [progress, setProgress] = useState<ProgressState>(() => createDefaultProgressState());
  const [runtime] = useState<RuntimeStageState>(() => createRuntimeStageState(initialStageId));
  const progressRef = useRef<ProgressState>(progress);
  const runtimeRef = useRef<RuntimeStageState>(runtime);
  const economyRef = useRef<EconomySystem | null>(null);
  const autoSaveRef = useRef<AutoSaveCoordinator | null>(null);
  const [toast, setToast] = useState("진행 상태를 준비하는 중...");
  const [mode, setMode] = useState<UiMode>("safe");
  const [introGateStep, setIntroGateStep] = useState<"intro" | "title" | "ready">("intro");

  useEffect(() => eventBus.on("cutscene-finished", (payload) => {
    if (payload.cutsceneId === "intro-home") setIntroGateStep("title");
  }), [eventBus]);

  useEffect(() => {
    const loaded = storeRef.current.load();
    Object.assign(progressRef.current, cloneProgress(loaded));
    setProgress(cloneProgress(progressRef.current));
    economyRef.current = new EconomySystem(progressRef.current, runtimeRef.current, eventBus);
    const autoSave = new AutoSaveCoordinator(storeRef.current, progressRef.current, eventBus);
    autoSaveRef.current = autoSave;
    return () => {
      autoSave.destroy();
      autoSaveRef.current = null;
      eventBus.clear();
    };
  }, [eventBus]);

  const replaceProgress = useCallback((next: ProgressState): void => {
    Object.assign(progressRef.current, cloneProgress(next));
    setProgress(cloneProgress(progressRef.current));
  }, []);

  const handleEvent = useCallback((type: GameEventType): void => {
    const messages: Partial<Record<GameEventType, string>> = {
      "coin-changed": "코인 상태가 저장되었습니다.",
      "tool-purchased": "새 도구를 금고에 넣었습니다.",
      "collectible-found": "수집품 기록을 갱신했습니다.",
      "death-count-updated": "사망 통계를 저장했습니다.",
      "keybinds-changed": "키 설정을 저장했습니다.",
      "stage-completed": "스테이지 클리어를 저장했습니다.",
    };
    setToast(messages[type] ?? "게임 이벤트: " + type);
    if (type === "cutscene-started") setMode("cutscene");
    if (type === "cutscene-finished" || type === "stage-started") setMode("play");
    if (type === "death") setMode("dead");
  }, []);

  const handleNameConfirm = useCallback((name: string): void => {
    const safeName = name.replace(/[<>]/g, "").trim().slice(0, 20) || "코기";
    const next = cloneProgress(progressRef.current);
    next.playerName = safeName;
    replaceProgress(next);
    eventBus.emit("player-name-confirmed", { playerName: safeName });
    setIntroGateStep("ready");
  }, [eventBus, replaceProgress]);

  const handlePurchase = useCallback((tool: ToolDefinition): void => {
    if (mode !== "safe") return;
    if (economyRef.current?.purchaseTool(tool.id)) {
      replaceProgress(progressRef.current);
    }
  }, [mode, replaceProgress]);

  const handleEquip = useCallback((tool: ToolDefinition): void => {
    if (mode === "cutscene" || mode === "dead") return;
    if (!progressRef.current.ownedToolIds.includes(tool.id)) return;
    const next = cloneProgress(progressRef.current);
    if (tool.slot === "attack") next.equippedAttackToolId = tool.id;
    else next.equippedDefenseToolId = tool.id;
    replaceProgress(next);
    eventBus.emit("equipment-change-requested", {
      [tool.slot === "attack" ? "attackToolId" : "defenseToolId"]: tool.id,
    });
  }, [eventBus, mode, replaceProgress]);

  const handleKeybindChange = useCallback((action: InputAction, key: string): void => {
    const next = cloneProgress(progressRef.current);
    next.keybinds[action] = key;
    replaceProgress(next);
    eventBus.emit("keybinds-changed", { keybinds: { ...next.keybinds } });
  }, [eventBus, replaceProgress]);

  const stage = getStageDefinition(initialStageId);
  return (
    <div className="game-shell">
      <PhaserGame className="phaser-viewport" gameEventBus={eventBus} />
      <GameEventBridge eventBus={eventBus} onEvent={handleEvent} />
      <CutsceneOverlay eventBus={eventBus} onSkip={() => eventBus.emit("cutscene-skip-requested", {})} />
      {introGateStep === "title" && <IntroTitleOverlay initialName={progress.playerName} onConfirm={handleNameConfirm} />}
      {introGateStep === "ready" && <GameOverlay stageTitle={stage.title} runtime={runtime} progress={progress} skills={SKILL_DEFINITIONS} tools={TOOL_DEFINITIONS} cooldowns={{}} alive={mode !== "dead" && mode !== "cutscene"} safeZone={mode === "safe"} onEquip={handleEquip} onPurchase={handlePurchase} onKeybindChange={handleKeybindChange} />}
      <div className="game-toast" role="status">{toast}</div>
      {onExit && <button className="exit-button" type="button" onClick={onExit}>나가기</button>}
    </div>
  );
}
