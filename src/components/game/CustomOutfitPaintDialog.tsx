"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import type { CustomOutfitDesign, CustomOutfitId } from "@/game/core/types";
import {
  CUSTOM_OUTFIT_CELL_COUNT, CUSTOM_OUTFIT_HEIGHT, CUSTOM_OUTFIT_PALETTE, CUSTOM_OUTFIT_WIDTH,
  eraseCell, fillRegion, paintCell, undoChange, type PaintState, type PaintTool,
} from "@/game/data/customOutfitPaint";
import { colorizeCustomOutfitPixels, customOutfitCellForPixel, customOutfitPixelForCell, isWhiteSuitPixel } from "@/game/entities/customOutfitTexture";

const slots: readonly CustomOutfitId[] = ["custom-outfit-1", "custom-outfit-2", "custom-outfit-3"];
const blankCells = (): (string | null)[] => Array(CUSTOM_OUTFIT_CELL_COUNT).fill(null);

export interface CustomOutfitPaintDialogProps {
  readonly designs: readonly CustomOutfitDesign[];
  readonly onSave: (id: CustomOutfitId, cells: (string | null)[]) => void;
  readonly onClose: (source: "button" | "keyboard") => void;
}

export function CustomOutfitPaintDialog({ designs, onSave, onClose }: CustomOutfitPaintDialogProps): ReactElement {
  const [slot, setSlot] = useState<CustomOutfitId>("custom-outfit-1");
  const [paint, setPaint] = useState<PaintState>(() => ({
    cells: [...(designs.find((item) => item.id === "custom-outfit-1")?.cells ?? blankCells())], undo: [],
  }));
  const paintRef = useRef(paint);
  const [savedCells, setSavedCells] = useState<(string | null)[]>(() => [...paint.cells]);
  const [mask, setMask] = useState<boolean[] | null>(null);
  const [template, setTemplate] = useState<Uint8ClampedArray | null>(null);
  const [maskError, setMaskError] = useState(false);
  const [tool, setTool] = useState<PaintTool>("pen");
  const [color, setColor] = useState("#E95F68");
  const [cursor, setCursor] = useState(0);
  const [canvasFocused, setCanvasFocused] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"overwrite" | "discard-close" | "discard-slot" | null>(null);
  const [pendingSlot, setPendingSlot] = useState<CustomOutfitId>("custom-outfit-1");
  const pendingCloseSource = useRef<"button" | "keyboard">("button");
  const strokeRecorded = useRef(false);
  const pointerActive = useRef(false);
  const lastPointerIndex = useRef(-1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const existing = designs.some((item) => item.id === slot);
  const dirty = paint.cells.some((cell, index) => cell !== savedCells[index]);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      const source = document.createElement("canvas");
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const context = source.getContext("2d", { willReadFrequently: true });
      if (!context) { setMaskError(true); return; }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, source.width, source.height).data;
      const nextMask = Array<boolean>(CUSTOM_OUTFIT_CELL_COUNT).fill(false);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
        if (!isWhiteSuitPixel(pixels, source.width, x, y)) continue;
        const cell = customOutfitCellForPixel(x, y);
        if (cell >= 0) nextMask[cell] = true;
      }
      setTemplate(new Uint8ClampedArray(pixels));
      setMask(nextMask);
    };
    image.onerror = () => setMaskError(true);
    image.src = "/assets/pixel/characters/corgi/equipment/custom-outfit-template-run.png";
    return () => { image.onload = null; image.onerror = null; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context || !mask || !template) return;
    const colored = colorizeCustomOutfitPixels(template, 448, 128, "run", {
      id: slot, cells: paint.cells, updatedAt: "",
    });
    const frame = context.createImageData(448, 128);
    frame.data.set(colored);
    context.clearRect(0, 0, 112, 128);
    context.putImageData(frame, 0, 0);
    if (canvasFocused) {
      const { x, y } = customOutfitPixelForCell(cursor % CUSTOM_OUTFIT_WIDTH, Math.floor(cursor / CUSTOM_OUTFIT_WIDTH));
      context.fillStyle = "#37162E";
      context.fillRect(x, y, 1, 1);
    }
  }, [canvasFocused, cursor, mask, paint.cells, slot, template]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    return () => document.querySelector<HTMLElement>(".paint-open-button")?.focus();
  }, []);

  useEffect(() => {
    if (confirmAction) dialogRef.current?.querySelector<HTMLButtonElement>(".custom-paint-confirm button")?.focus();
  }, [confirmAction]);

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  const loadSlot = useCallback((id: CustomOutfitId): void => {
    const cells = [...(designs.find((item) => item.id === id)?.cells ?? blankCells())];
    setSlot(id);
    paintRef.current = { cells, undo: [] };
    setPaint(paintRef.current);
    setSavedCells([...cells]);
    setConfirmAction(null);
  }, [designs]);

  const requestClose = useCallback((source: "button" | "keyboard"): void => {
    if (dirty) {
      pendingCloseSource.current = source;
      setConfirmAction("discard-close");
    } else onClose(source);
  }, [dirty, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (confirmAction) setConfirmAction(null);
        else requestClose("keyboard");
        return;
      }
      if (event.key !== "Tab") return;
      const scope = confirmAction ? dialogRef.current?.querySelector(".custom-paint-confirm") : dialogRef.current;
      const focusables = [...(scope?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), canvas[tabindex]") ?? [])];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirmAction, requestClose]);

  const applyIndex = useCallback((index: number, startStroke: boolean): void => {
    if (!mask) return;
    const previous = paintRef.current;
    const cells = tool === "pen" ? paintCell(previous.cells, index, color, mask)
      : tool === "eraser" ? eraseCell(previous.cells, index, mask)
        : startStroke ? fillRegion(previous.cells, index, color, mask) : previous.cells;
    if (cells === previous.cells) return;
    const record = !strokeRecorded.current;
    strokeRecorded.current = true;
    paintRef.current = { cells, undo: record ? [...previous.undo.slice(-19), [...previous.cells]] : previous.undo };
    setPaint(paintRef.current);
  }, [color, mask, tool]);

  const applyStroke = (from: number, to: number): void => {
    if (to < 0) return;
    if (from < 0) { applyIndex(to, false); return; }
    let x = from % CUSTOM_OUTFIT_WIDTH;
    let y = Math.floor(from / CUSTOM_OUTFIT_WIDTH);
    const endX = to % CUSTOM_OUTFIT_WIDTH;
    const endY = Math.floor(to / CUSTOM_OUTFIT_WIDTH);
    const dx = Math.abs(endX - x);
    const dy = Math.abs(endY - y);
    const sx = x < endX ? 1 : -1;
    const sy = y < endY ? 1 : -1;
    let error = dx - dy;
    while (true) {
      applyIndex(y * CUSTOM_OUTFIT_WIDTH + x, false);
      if (x === endX && y === endY) break;
      const doubled = error * 2;
      if (doubled > -dy) { error -= dy; x += sx; }
      if (doubled < dx) { error += dx; y += sy; }
    }
  };

  const indexFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - bounds.left) / bounds.width * 112);
    const y = Math.floor((event.clientY - bounds.top) / bounds.height * 128);
    return x >= 0 && x < 112 && y >= 0 && y < 128 ? customOutfitCellForPixel(x, y) : -1;
  };

  const save = (): void => {
    if (!mask || maskError || paint.cells.length !== CUSTOM_OUTFIT_CELL_COUNT ||
        paint.cells.some((cell) => cell !== null && !/^#[0-9A-Fa-f]{6}$/.test(cell))) return;
    if (existing) { setConfirmAction("overwrite"); return; }
    onSave(slot, [...paint.cells]);
    setSavedCells([...paint.cells]);
  };

  const confirm = (): void => {
    if (confirmAction === "overwrite") {
      onSave(slot, [...paint.cells]);
      setSavedCells([...paint.cells]);
    } else if (confirmAction === "discard-close") onClose(pendingCloseSource.current);
    else if (confirmAction === "discard-slot") loadSlot(pendingSlot);
    setConfirmAction(null);
  };

  return (
    <div className="custom-paint-overlay">
      <div className="custom-paint-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-paint-title" ref={dialogRef}>
        <header className="custom-paint-header" inert={confirmAction !== null}>
          <div><span className="custom-paint-kicker">CORGI PIXEL ATELIER</span><h2 id="custom-paint-title">코기 옷 그림판</h2></div>
          <button ref={closeButtonRef} type="button" aria-label="그림판 닫기" onClick={() => requestClose("button")}>×</button>
        </header>
        <div className="custom-paint-body" inert={confirmAction !== null}>
          <nav className="custom-paint-slots" aria-label="그림 저장 슬롯">
            {slots.map((id, index) => <button key={id} type="button" aria-pressed={slot === id}
              onClick={() => {
                if (id === slot) return;
                if (dirty) { setPendingSlot(id); setConfirmAction("discard-slot"); }
                else loadSlot(id);
              }}>{index + 1}번 옷 {designs.some((design) => design.id === id) ? "✓" : "빈 슬롯"}</button>)}
          </nav>
          <p className="custom-paint-help">흰 옷 부분만 칠할 수 있어요. 그림은 저장한 뒤 카탈로그에서 입힐 수 있어요.</p>
          <canvas ref={canvasRef} width={112} height={128} tabIndex={0}
            className="custom-paint-canvas" aria-label="픽셀 옷 그리기 영역. 방향키로 이동, Enter 또는 Space로 칠하기"
            onFocus={() => setCanvasFocused(true)} onBlur={() => setCanvasFocused(false)}
            onPointerDown={(event) => {
              event.preventDefault();
              pointerActive.current = true;
              strokeRecorded.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
              lastPointerIndex.current = indexFromPointer(event);
              applyIndex(lastPointerIndex.current, true);
            }}
            onPointerMove={(event) => {
              if (!pointerActive.current || tool === "fill") return;
              const next = indexFromPointer(event);
              applyStroke(lastPointerIndex.current, next);
              lastPointerIndex.current = next;
            }}
            onPointerUp={() => { pointerActive.current = false; }}
            onPointerCancel={() => { pointerActive.current = false; }}
            onKeyDown={(event) => {
              const x = cursor % CUSTOM_OUTFIT_WIDTH;
              const y = Math.floor(cursor / CUSTOM_OUTFIT_WIDTH);
              if (event.key === "ArrowLeft" && x > 0) setCursor(cursor - 1);
              else if (event.key === "ArrowRight" && x < CUSTOM_OUTFIT_WIDTH - 1) setCursor(cursor + 1);
              else if (event.key === "ArrowUp" && y > 0) setCursor(cursor - CUSTOM_OUTFIT_WIDTH);
              else if (event.key === "ArrowDown" && y < CUSTOM_OUTFIT_HEIGHT - 1) setCursor(cursor + CUSTOM_OUTFIT_WIDTH);
              else if (event.key === "Enter" || event.key === " ") { strokeRecorded.current = false; applyIndex(cursor, true); }
              else return;
              event.preventDefault();
              event.stopPropagation();
            }} />
          <div className="custom-paint-toolbar" aria-label="그리기 도구">
            {(["pen", "eraser", "fill"] as const).map((next) => <button key={next} type="button" aria-pressed={tool === next}
              onClick={() => setTool(next)}>{next === "pen" ? "펜" : next === "eraser" ? "지우개" : "채우기"}</button>)}
            <button type="button" disabled={paint.undo.length === 0} onClick={() => {
              paintRef.current = undoChange(paintRef.current);
              setPaint(paintRef.current);
            }}>되돌리기</button>
          </div>
          <div className="custom-paint-palette" aria-label="색상 선택">
            {CUSTOM_OUTFIT_PALETTE.map((swatch) => <button key={swatch} type="button" title={swatch} aria-label={`색상 ${swatch}`}
              aria-pressed={color === swatch} style={{ backgroundColor: swatch }} onClick={() => setColor(swatch)} />)}
            <label>자유 색상 <input type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} /></label>
          </div>
          <div className="custom-paint-actions">
            <span role="status">{maskError ? "옷 마스크를 불러오지 못했습니다." : !mask ? "옷을 준비하는 중..." : dirty ? "저장하지 않은 변경이 있어요." : "저장된 상태예요."}</span>
            <button type="button" disabled={!mask || maskError} onClick={save}>{existing ? "덮어쓰기" : "이 옷 저장"}</button>
          </div>
        </div>
        {confirmAction && <div className="custom-paint-confirm" role="alertdialog" aria-modal="true" aria-label="그림판 변경 확인">
          <p>{confirmAction === "overwrite" ? "이 슬롯의 옷을 새 그림으로 덮어쓸까요?" : "저장하지 않은 그림을 버릴까요?"}</p>
          <div><button type="button" onClick={() => setConfirmAction(null)}>계속 편집</button><button type="button" onClick={confirm}>{confirmAction === "overwrite" ? "덮어쓰기" : "버리기"}</button></div>
        </div>}
      </div>
    </div>
  );
}
