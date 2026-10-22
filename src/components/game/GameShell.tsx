"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { CustomOutfitId, InputAction, ProgressState, RuntimeStageState, SelectableWorldId, StageId, ToolDefinition, WorldSelectionRequest } from "@/game/core/types";
import { createDefaultProgressState, createRuntimeStageState } from "@/game/core/constants";
import { SKILL_DEFINITIONS } from "@/game/data/skills";
import { TOOL_DEFINITIONS } from "@/game/data/tools";
import { getMarketProduct, MARKET_PRODUCTS } from "@/game/data/marketCatalog";
import { getOwnedCatalogEntries, type OwnedCatalogEntry } from "@/game/data/ownedItemCatalog";
import { getStageDefinition } from "@/game/data";
import { INTRO_CUTSCENE } from "@/game/data/cutscenes/intro";
import { GameEventBus, type GameEventType } from "@/game/bridge/GameEventBus";
import { AutoSaveCoordinator } from "@/game/persistence/AutoSaveCoordinator";
import { ShopAudioController } from "@/game/audio/ShopAudioController";
import { ProgressStore } from "@/game/persistence/ProgressStore";
import { sanitizeCustomOutfits } from "@/game/persistence/migrations";
import { EconomySystem, type PurchaseResult } from "@/game/systems/EconomySystem";
import { isWorldSelectionUnlocked } from "@/game/systems/worldSelection";
import { canOpenSharedMenu } from "@/game/systems/gameMenuAvailability";
import { prepareDevelopmentIntroProgress } from "@/game/systems/developmentIntroStart";
import { GameEventBridge } from "./GameEventBridge";
import { CutsceneOverlay } from "./CutsceneOverlay";
import { GameOverlay } from "./GameOverlay";
import { PhaserGame } from "./PhaserGame";
import { IntroTitleOverlay } from "./IntroTitleOverlay";
import { DeathCounterOverlay } from "./DeathCounterOverlay";
import { ResetProgressDialog } from "./ResetProgressDialog";
import { SnackCoinCounter } from "./SnackCoinCounter";
import { PauseOverlay } from "./PauseOverlay";
import { WorldSelectDialog } from "./WorldSelectDialog";
import { BossCombatOverlay } from "./BossCombatOverlay";
import { ShopPanel } from "./ShopPanel";
import { OwnedItemCatalogDialog } from "./OwnedItemCatalogDialog";
import { CustomOutfitPaintDialog } from "./CustomOutfitPaintDialog";

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
    ownedCosmeticIds: [...progress.ownedCosmeticIds],
    customOutfits: progress.customOutfits.map((design) => ({ ...design, cells: [...design.cells] })),
    collectedCoinIds: [...progress.collectedCoinIds],
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
  const shopAudioRef = useRef<ShopAudioController | null>(null);
  const [toast, setToast] = useState("진행 상태를 준비하는 중...");
  const [mode, setMode] = useState<UiMode>("safe");
  const [paused, setPaused] = useState(false);
  const [deathOverlayVisible, setDeathOverlayVisible] = useState(false);
  const [deathOverlayCount, setDeathOverlayCount] = useState(0);
  const [resetProgressDialogOpen, setResetProgressDialogOpen] = useState(false);
  const [worldSelectOpen, setWorldSelectOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [paintOpen, setPaintOpen] = useState(false);
  const deathOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeStageId, setActiveStageId] = useState<StageId>(initialStageId);
  const [bossHearts, setBossHearts] = useState<0 | 1 | 2 | 3 | undefined>();
  const [world02EntranceActive, setWorld02EntranceActive] = useState(false);
  const [introGateStep, setIntroGateStep] = useState<"intro" | "title" | "ready">("intro");
  const menuAvailable = canOpenSharedMenu({
    stageId: activeStageId, mode, introReady: introGateStep === "ready", paused,
    shopOpen, catalogOpen, paintOpen, worldSelectOpen, resetProgressDialogOpen,
  });

  useEffect(() => {
    const removeStage = eventBus.on("stage-started", ({ stageId }) => {
      shopAudioRef.current?.destroy();
      shopAudioRef.current = null;
      setPaused(false);
      setWorldSelectOpen(false);
      setShopOpen(false);
      setCatalogOpen(false);
      setPaintOpen(false);
      setActiveStageId(stageId);
      setBossHearts(getStageDefinition(stageId).kind === "boss" ? 3 : undefined);
      if (progressRef.current.selectedWorldId !== null) {
        const stageWorldId = stageId.startsWith("world-01-") ? "world-01"
          : stageId.startsWith("world-02-") ? "world-02" : null;
        if (progressRef.current.selectedWorldId !== stageWorldId) {
          progressRef.current.selectedWorldId = stageWorldId;
          autoSaveRef.current?.flush();
        }
      }
      Object.assign(runtimeRef.current, createRuntimeStageState(stageId));
      setRuntime({ ...runtimeRef.current });
      setProgress(cloneProgress(progressRef.current));
    });
    const removeHearts = eventBus.on("boss-hearts-changed", ({ remaining }) => setBossHearts(remaining));
    const removeCheckpoint = eventBus.on("checkpoint-activated", ({ checkpointId }) => {
      runtimeRef.current.checkpointId = checkpointId;
      setRuntime({ ...runtimeRef.current });
    });
    const removeCoins = eventBus.on("coin-changed", ({ currentStageCoins, bankedCoins }) => {
      runtimeRef.current.currentStageCoins = currentStageCoins;
      progressRef.current.bankedCoins = bankedCoins;
      setRuntime({ ...runtimeRef.current });
      setProgress(cloneProgress(progressRef.current));
    });
    const removeWorldSelection = eventBus.on("world-selection-committed", () => {
      setWorldSelectOpen(false);
      setProgress(cloneProgress(progressRef.current));
    });
    return () => { removeStage(); removeHearts(); removeCheckpoint(); removeCoins(); removeWorldSelection(); };
  }, [eventBus]);

  useEffect(() => {
    const removeStart = eventBus.on("cutscene-started", (payload) => {
      if (payload.cutsceneId === "intro-home") setIntroGateStep("intro");
      if (payload.cutsceneId === "world-02-intro") setWorld02EntranceActive(true);
    });
    const removeFinish = eventBus.on("cutscene-finished", (payload) => {
      if (payload.cutsceneId === "intro-home") setIntroGateStep("title");
      if (payload.cutsceneId === "world-02-intro") setWorld02EntranceActive(false);
    });
    const removeStage = eventBus.on("stage-started", () => setWorld02EntranceActive(false));
    return () => {
      removeStart();
      removeFinish();
      removeStage();
    };
  }, [eventBus]);

  useEffect(() => {
    const loaded = prepareDevelopmentIntroProgress(
      storeRef.current.load(), process.env.NODE_ENV === "development",
    );
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
    shopAudioRef.current?.destroy();
    shopAudioRef.current = null;
    if (deathOverlayTimeoutRef.current) {
      clearTimeout(deathOverlayTimeoutRef.current);
    }
  }, []);

  const handleEvent = useCallback((type: GameEventType): void => {
    const messages: Partial<Record<GameEventType, string>> = {
      "tool-purchased": "새 도구를 금고에 넣었습니다.",
      "collectible-found": "수집품 기록을 갱신했습니다.",
      "death-count-updated": "사망 통계를 저장했습니다.",
      "keybinds-changed": "키 설정을 저장했습니다.",
    };
    if (messages[type]) setToast(messages[type]);
    if (type === "death-count-updated") {
      setProgress(cloneProgress(progressRef.current));
    }
    if (type === "cutscene-started") setMode("cutscene");
    if (type === "cutscene-finished" || type === "stage-started") setMode("play");
    if (type === "skill-unlock-scene-opened" || type === "stage-clear-scene-opened") setMode("stage-clear");
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

  const equipOwnedEntry = useCallback((entry: OwnedCatalogEntry): void => {
    const current = progressRef.current;
    if (entry.category === "weapon") {
      current.equippedAttackToolId = entry.toolId;
      eventBus.emit("equipment-change-requested", { attackToolId: entry.toolId });
    } else if (entry.category === "shield") {
      current.equippedDefenseToolId = entry.toolId;
      eventBus.emit("equipment-change-requested", { defenseToolId: entry.toolId });
    } else if (entry.category === "outfit" && entry.customOutfitId !== undefined) {
      const design = current.customOutfits.find((item) => item.id === entry.customOutfitId);
      if (!design) return;
      current.equippedCustomOutfitId = design.id;
      current.equippedOutfitId = null;
      eventBus.emit("custom-outfit-change-requested", { id: design.id, design });
    } else if (entry.category === "outfit" && entry.cosmeticId !== undefined) {
      current.equippedOutfitId = entry.cosmeticId;
      current.equippedCustomOutfitId = null;
      eventBus.emit("cosmetic-change-requested", { outfitId: entry.cosmeticId });
    } else if (entry.category === "accessory" && entry.cosmeticId !== undefined) {
      current.equippedAccessoryId = entry.cosmeticId;
      eventBus.emit("cosmetic-change-requested", { accessoryId: entry.cosmeticId });
    }
    setProgress(cloneProgress(current));
    autoSaveRef.current?.flush();
  }, [eventBus]);

  const handleEquip = useCallback((tool: ToolDefinition): void => {
    if (mode === "cutscene" || mode === "dead") return;
    const entry = getOwnedCatalogEntries(progressRef.current).find((item) => item.id === tool.id);
    if (entry && (entry.category === "weapon" || entry.category === "shield") &&
        (tool.slot === "attack" ? entry.category === "weapon" : entry.category === "shield")) equipOwnedEntry(entry);
  }, [equipOwnedEntry, mode]);

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

  const handleOpenWorldSelect = useCallback((): void => {
    if (mode !== "play" || paused || shopOpen || catalogOpen || paintOpen || !isWorldSelectionUnlocked(progressRef.current)) return;
    setWorldSelectOpen(true);
    eventBus.emit("pause-requested", { paused: true });
  }, [catalogOpen, eventBus, mode, paintOpen, paused, shopOpen]);

  const handleOpenShop = useCallback((): void => {
    if (!menuAvailable) return;
    setStatusOpen(false);
    setShopOpen(true);
    eventBus.emit("shop-state-changed", { open: true, closeViaEscape: false });
    eventBus.emit("pause-requested", { paused: true });
    if (typeof Audio !== "undefined") {
      try {
        shopAudioRef.current ??= new ShopAudioController();
        void shopAudioRef.current.enter();
      } catch {
        // An unavailable audio device must not prevent entering the shop.
      }
    }
  }, [eventBus, menuAvailable]);

  const handleCloseShop = useCallback((source: "button" | "keyboard"): void => {
    if (!shopOpen) return;
    void shopAudioRef.current?.exit();
    setShopOpen(false);
    eventBus.emit("shop-state-changed", { open: false, closeViaEscape: source === "keyboard" });
    eventBus.emit("pause-requested", { paused: false });
  }, [eventBus, shopOpen]);

  const handleOpenCatalog = useCallback((): void => {
    if (!menuAvailable) return;
    setStatusOpen(false);
    setCatalogOpen(true);
    eventBus.emit("catalog-state-changed", { open: true, closeViaEscape: false });
    eventBus.emit("pause-requested", { paused: true });
  }, [eventBus, menuAvailable]);

  const handleCloseCatalog = useCallback((source: "button" | "keyboard"): void => {
    if (!catalogOpen) return;
    setCatalogOpen(false);
    eventBus.emit("catalog-state-changed", { open: false, closeViaEscape: source === "keyboard" });
    eventBus.emit("pause-requested", { paused: false });
  }, [catalogOpen, eventBus]);

  const handleOpenPaint = useCallback((): void => {
    if (!menuAvailable) return;
    setStatusOpen(false);
    setPaintOpen(true);
    eventBus.emit("paint-state-changed", { open: true, closeViaEscape: false });
    eventBus.emit("pause-requested", { paused: true });
  }, [eventBus, menuAvailable]);

  const handleClosePaint = useCallback((source: "button" | "keyboard"): void => {
    if (!paintOpen) return;
    setPaintOpen(false);
    eventBus.emit("paint-state-changed", { open: false, closeViaEscape: source === "keyboard" });
    eventBus.emit("pause-requested", { paused: false });
  }, [eventBus, paintOpen]);

  const handleSaveCustomOutfit = useCallback((id: CustomOutfitId, cells: (string | null)[]): void => {
    if (!paintOpen || mode !== "play") return;
    const next = cloneProgress(progressRef.current);
    const updated = sanitizeCustomOutfits([
      ...next.customOutfits.filter((design) => design.id !== id),
      { id, cells, updatedAt: new Date().toISOString() },
    ]);
    if (!updated.some((design) => design.id === id)) return;
    next.customOutfits = updated;
    replaceProgress(next);
    eventBus.emit("custom-outfit-saved", { design: updated.find((design) => design.id === id)! });
    autoSaveRef.current?.flush();
  }, [eventBus, mode, paintOpen, replaceProgress]);

  const handleMarketEquip = useCallback((id: string): void => {
    if (!shopOpen || mode !== "play") return;
    const product = getMarketProduct(id);
    if (!product) return;
    const entry = getOwnedCatalogEntries(progressRef.current).find((item) => item.id === product.id && item.category === product.category);
    if (entry) equipOwnedEntry(entry);
  }, [equipOwnedEntry, mode, shopOpen]);

  const handleCatalogEquip = useCallback((id: string): void => {
    if (!catalogOpen || mode !== "play") return;
    const entry = getOwnedCatalogEntries(progressRef.current).find((item) => item.id === id);
    if (entry) equipOwnedEntry(entry);
  }, [catalogOpen, equipOwnedEntry, mode]);

  const unequipCosmetic = useCallback((category: "outfit" | "accessory"): void => {
    const current = progressRef.current;
    if (category === "outfit") {
      if (current.equippedOutfitId === null && current.equippedCustomOutfitId === null) return;
      current.equippedOutfitId = null;
      current.equippedCustomOutfitId = null;
      eventBus.emit("custom-outfit-change-requested", { id: null, design: null });
    } else {
      if (current.equippedAccessoryId === null) return;
      current.equippedAccessoryId = null;
    }
    setProgress(cloneProgress(current));
    eventBus.emit("cosmetic-change-requested", category === "outfit" ? { outfitId: null } : { accessoryId: null });
    autoSaveRef.current?.flush();
  }, [eventBus]);

  const handleMarketUnequip = useCallback((category: "outfit" | "accessory"): void => {
    if (!shopOpen || mode !== "play") return;
    unequipCosmetic(category);
  }, [mode, shopOpen, unequipCosmetic]);

  const handleCatalogUnequip = useCallback((category: "outfit" | "accessory"): void => {
    if (!catalogOpen || mode !== "play") return;
    unequipCosmetic(category);
  }, [catalogOpen, mode, unequipCosmetic]);

  const handleMarketPurchase = useCallback((id: string): PurchaseResult => {
    if (!shopOpen || mode !== "play") return { ok: false, reason: "unknown-item" };
    const result = economyRef.current?.purchaseMarketProduct(id) ?? { ok: false, reason: "unknown-item" };
    if (result.ok) {
      handleMarketEquip(id);
      setProgress(cloneProgress(progressRef.current));
      autoSaveRef.current?.flush();
    }
    return result;
  }, [handleMarketEquip, mode, shopOpen]);

  const handleCancelWorldSelect = useCallback((): void => {
    setWorldSelectOpen(false);
    eventBus.emit("pause-requested", { paused: false });
  }, [eventBus]);

  const handleSelectWorld = useCallback((selection: WorldSelectionRequest): void => {
    eventBus.emit("world-selection-requested", selection);
  }, [eventBus]);

  const stage = getStageDefinition(activeStageId);
  const worldSelectUnlocked = isWorldSelectionUnlocked(progress) &&
    (activeStageId.startsWith("world-01-") || activeStageId.startsWith("world-02-"));
  const currentWorldId: SelectableWorldId = activeStageId.startsWith("world-02-") ? "world-02" : "world-01";
  return (
    <div className="game-shell">
      <div className="game-content-frame">
        <BossCombatOverlay eventBus={eventBus} stageId={activeStageId} barkKeybind={progress.keybinds.bark}
          visible={progressLoaded && introGateStep === "ready" && mode === "play" && !paused && !world02EntranceActive} />
        {progressLoaded && introGateStep === "ready" && !world02EntranceActive && <SnackCoinCounter balance={progress.bankedCoins} />}
        {progressLoaded && <PhaserGame className="phaser-viewport" gameEventBus={eventBus} progressState={sharedProgressState} />}
        <GameEventBridge eventBus={eventBus} onEvent={handleEvent} />
        <CutsceneOverlay eventBus={eventBus} onSkip={() => eventBus.emit("cutscene-skip-requested", {})} />
        {introGateStep === "title" && <IntroTitleOverlay initialName={progress.playerName} onConfirm={handleNameConfirm} />}
        {introGateStep === "ready" && mode !== "stage-clear" && !world02EntranceActive && <GameOverlay stageTitle={stage.title} runtime={runtime} progress={progress} skills={SKILL_DEFINITIONS} tools={TOOL_DEFINITIONS} cooldowns={{}} bossHearts={stage.kind === "boss" ? bossHearts : undefined} alive={mode !== "dead" && mode !== "cutscene"} statusOpen={statusOpen} onEquip={handleEquip} onKeybindChange={handleKeybindChange} onToggleStatus={() => setStatusOpen((open) => !open)} paused={paused} onTogglePause={() => eventBus.emit("pause-requested", { paused: !paused })} onResetProgress={() => setResetProgressDialogOpen(true)} worldSelectUnlocked={worldSelectUnlocked} onOpenWorldSelect={handleOpenWorldSelect} onOpenShop={handleOpenShop} onOpenCatalog={handleOpenCatalog} onOpenPaint={handleOpenPaint} />}
        {paused && introGateStep === "ready" && !worldSelectOpen && !shopOpen && !catalogOpen && !paintOpen && <PauseOverlay onResume={() => eventBus.emit("pause-requested", { paused: false })} />}
        {shopOpen && <ShopPanel bankedCoins={progress.bankedCoins} products={MARKET_PRODUCTS} progress={progress}
          onPurchase={handleMarketPurchase} onEquip={handleMarketEquip} onUnequip={handleMarketUnequip} onClose={handleCloseShop} />}
        {catalogOpen && <OwnedItemCatalogDialog progress={progress} entries={getOwnedCatalogEntries(progress)}
          onEquip={handleCatalogEquip} onUnequip={handleCatalogUnequip} onClose={handleCloseCatalog} />}
        {paintOpen && <CustomOutfitPaintDialog designs={progress.customOutfits} onSave={handleSaveCustomOutfit} onClose={handleClosePaint} />}
        {worldSelectOpen && (
          <WorldSelectDialog
            currentWorldId={currentWorldId}
            onSelect={handleSelectWorld}
            onCancel={handleCancelWorldSelect}
          />
        )}
        {resetProgressDialogOpen && (
          <ResetProgressDialog
            onCancel={() => setResetProgressDialogOpen(false)}
            onConfirm={handleResetProgress}
          />
        )}
        <DeathCounterOverlay deathCount={deathOverlayCount} visible={deathOverlayVisible} />
        {introGateStep === "ready" && mode !== "stage-clear" && !world02EntranceActive && <div className="game-toast" role="status">{toast}</div>}
        {onExit && !world02EntranceActive && <button className="exit-button" type="button" onClick={onExit}>나가기</button>}
      </div>
    </div>
  );
}
