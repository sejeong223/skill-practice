"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { InputAction, ProgressState, RuntimeStageState, StageId, ToolDefinition } from "@/game/core/types";
import { createDefaultProgressState, createRuntimeStageState } from "@/game/core/constants";
import { SKILL_DEFINITIONS } from "@/game/data/skills";
import { TOOL_DEFINITIONS } from "@/game/data/tools";
import { getStageDefinition } from "@/game/data";
import { INTRO_CUTSCENE } from "@/game/data/cutscenes/intro";
import { GameEventBus, type GameEventType } from "@/game/bridge/GameEventBus";
import { AutoSaveCoordinator } from "@/game/persistence/AutoSaveCoordinator";
import { ProgressStore } from "@/game/persistence/ProgressStore";
import { EconomySystem } from "@/game/systems/EconomySystem";
import { GameEventBridge } from "./GameEventBridge";
import { CutsceneOverlay } from "./CutsceneOverlay";
import { GameOverlay } from "./GameOverlay";
import { PhaserGame } from "./PhaserGame";
import { IntroTitleOverlay } from "./IntroTitleOverlay";
import { DeathCounterOverlay } from "./DeathCounterOverlay";
import { ResetProgressDialog } from "./ResetProgressDialog";

export interface GameShellProps {
  readonly initialStageId: StageId;
  readonly onExit?: () => void;
}
type UiMode = "safe" | "play" | "cutscene" | "dead" | "stage-clear";

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
  const [sharedProgressState] = useState<ProgressState>(() => createDefaultProgressState());
  const [progress, setProgress] = useState<ProgressState>(() => cloneProgress(sharedProgressState));
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeStageState>(() => createRuntimeStageState(initialStageId));
  const progressRef = useRef<ProgressState>(sharedProgressState);
  const runtimeRef = useRef<RuntimeStageState>(runtime);
  const economyRef = useRef<EconomySystem | null>(null);
  const autoSaveRef = useRef<AutoSaveCoordinator | null>(null);
  const [toast, setToast] = useState("진행 상태를 준비하는 중...");
  const [mode, setMode] = useState<UiMode>("safe");
  const [paused, setPaused] = useState(false);
  const [deathOverlayVisible, setDeathOverlayVisible] = useState(false);
  const [deathOverlayCount, setDeathOverlayCount] = useState(0);
  const [resetProgressDialogOpen, setResetProgressDialogOpen] = useState(false);
  const deathOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeStageId, setActiveStageId] = useState<StageId>(initialStageId);
  const [bossHearts, setBossHearts] = useState<0 | 1 | 2 | 3 | undefined>();
  const [introGateStep, setIntroGateStep] = useState<"intro" | "title" | "ready">("intro");

  useEffect(() => {
    const removeStage = eventBus.on("stage-started", ({ stageId }) => {
      setActiveStageId(stageId);
      setBossHearts(stageId === "world-01-stage-boss" ? 3 : undefined);
      Object.assign(runtimeRef.current, createRuntimeStageState(stageId));
      setRuntime({ ...runtimeRef.current });
      setProgress(cloneProgress(progressRef.current));
    });
    const removeHearts = eventBus.on("boss-hearts-changed", ({ remaining }) => setBossHearts(remaining));
    const removeCheckpoint = eventBus.on("checkpoint-activated", ({ checkpointId }) => {
      runtimeRef.current.checkpointId = checkpointId;
      setRuntime({ ...runtimeRef.current });
    });
    const removeCoins = eventBus.on("coin-changed", ({ currentStageCoins }) => {
      runtimeRef.current.currentStageCoins = currentStageCoins;
      setRuntime({ ...runtimeRef.current });
    });
    return () => { removeStage(); removeHearts(); removeCheckpoint(); removeCoins(); };
  }, [eventBus]);

  useEffect(() => {
    const removeStart = eventBus.on("cutscene-started", (payload) => {
      if (payload.cutsceneId === "intro-home") setIntroGateStep("intro");
    });
    const removeFinish = eventBus.on("cutscene-finished", (payload) => {
      if (payload.cutsceneId === "intro-home") setIntroGateStep("title");
    });
    return () => {
      removeStart();
      removeFinish();
    };
  }, [eventBus]);

  useEffect(() => {
    const loaded = storeRef.current.load();
    Object.assign(progressRef.current, cloneProgress(loaded));
    setProgress(cloneProgress(progressRef.current));
    setIntroGateStep(
      loaded.onboardingCompleted
        ? "ready"
        : loaded.seenCutsceneIds.includes(INTRO_CUTSCENE.id)
          ? "title"
          : "intro",
    );
    economyRef.current = new EconomySystem(progressRef.current, runtimeRef.current, eventBus);
    const autoSave = new AutoSaveCoordinator(storeRef.current, progressRef.current, eventBus);
    autoSaveRef.current = autoSave;
    setProgressLoaded(true);
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

  useEffect(() => {
    const unsubscribe = eventBus.on("pause-state-changed", ({ paused: nextPaused }) => {
      setPaused(nextPaused);
    });
    return unsubscribe;
  }, [eventBus]);

  useEffect(() => () => {
    if (deathOverlayTimeoutRef.current) {
      clearTimeout(deathOverlayTimeoutRef.current);
    }
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
    if (messages[type]) setToast(messages[type]);
    if (type === "death-count-updated") {
      setProgress(cloneProgress(progressRef.current));
    }
    if (type === "cutscene-started") setMode("cutscene");
    if (type === "cutscene-finished" || type === "stage-started") setMode("play");
    if (type === "stage-clear-scene-opened") setMode("stage-clear");
    if (type === "stage-started") setStatusOpen(false);
    if (type === "death") {
      setDeathOverlayCount(progressRef.current.deathsTotal);
      setDeathOverlayVisible(true);
      setMode("dead");
      if (deathOverlayTimeoutRef.current) {
        clearTimeout(deathOverlayTimeoutRef.current);
      }
      deathOverlayTimeoutRef.current = setTimeout(() => {
        setDeathOverlayVisible(false);
        setMode("play");
        deathOverlayTimeoutRef.current = null;
      }, 900);
    }
  }, []);

  const handleNameConfirm = useCallback((name: string): void => {
    const safeName = name.trim().replace(/[<>]/g, "").slice(0, 20) || "코기";
    const next = cloneProgress(progressRef.current);
    next.playerName = safeName;
    next.onboardingCompleted = true;
    replaceProgress(next);
    setToast("무법지대 뒷골목으로 출발!");
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

  const handleResetProgress = useCallback((): void => {
    autoSaveRef.current?.destroy();
    autoSaveRef.current = null;
    storeRef.current.clear();
    window.location.reload();
  }, []);

  const stage = getStageDefinition(activeStageId);
  return (
    <div className="game-shell">
      <div className="game-content-frame">
        {progressLoaded && <PhaserGame className="phaser-viewport" gameEventBus={eventBus} progressState={sharedProgressState} />}
        <GameEventBridge eventBus={eventBus} onEvent={handleEvent} />
        <CutsceneOverlay eventBus={eventBus} onSkip={() => eventBus.emit("cutscene-skip-requested", {})} />
        {introGateStep === "title" && <IntroTitleOverlay initialName={progress.playerName} onConfirm={handleNameConfirm} />}
        {introGateStep === "ready" && mode !== "stage-clear" && <GameOverlay stageTitle={stage.title} runtime={runtime} progress={progress} skills={SKILL_DEFINITIONS} tools={TOOL_DEFINITIONS} cooldowns={{}} bossHearts={activeStageId === "world-01-stage-boss" ? bossHearts : undefined} alive={mode !== "dead" && mode !== "cutscene"} safeZone={mode === "safe"} statusOpen={statusOpen} onEquip={handleEquip} onPurchase={handlePurchase} onKeybindChange={handleKeybindChange} onToggleStatus={() => setStatusOpen((open) => !open)} paused={paused} onTogglePause={() => eventBus.emit("pause-requested", { paused: !paused })} onResetProgress={() => setResetProgressDialogOpen(true)} />}
        {resetProgressDialogOpen && (
          <ResetProgressDialog
            onCancel={() => setResetProgressDialogOpen(false)}
            onConfirm={handleResetProgress}
          />
        )}
        <DeathCounterOverlay deathCount={deathOverlayCount} visible={deathOverlayVisible} />
        {introGateStep === "ready" && mode !== "stage-clear" && <div className="game-toast" role="status">{toast}</div>}
        {onExit && <button className="exit-button" type="button" onClick={onExit}>나가기</button>}
      </div>
    </div>
  );
}
