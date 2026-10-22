export const CUSTOM_OUTFIT_WIDTH = 56;
export const CUSTOM_OUTFIT_HEIGHT = 32;
export const CUSTOM_OUTFIT_CELL_COUNT = CUSTOM_OUTFIT_WIDTH * CUSTOM_OUTFIT_HEIGHT;
export const CUSTOM_OUTFIT_PALETTE = [
  "#37162E", "#5F3942", "#B0645D", "#E95F68", "#EE8EAE", "#F4D460",
  "#82B956", "#70C7E6", "#B8EEF0", "#E9B36D", "#FFFFFF", "#000000",
] as const;

export type PaintTool = "pen" | "eraser" | "fill";
export interface PaintState {
  cells: (string | null)[];
  undo: (string | null)[][];
}

export function isPaintableCell(mask: readonly boolean[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CUSTOM_OUTFIT_CELL_COUNT && mask[index] === true;
}

export function paintCell(cells: readonly (string | null)[], index: number, color: string, mask: readonly boolean[]): (string | null)[] {
  if (cells.length !== CUSTOM_OUTFIT_CELL_COUNT || !isPaintableCell(mask, index) ||
      !/^#[0-9A-Fa-f]{6}$/.test(color) || cells[index] === color) return cells as (string | null)[];
  const next = [...cells];
  next[index] = color;
  return next;
}

export function eraseCell(cells: readonly (string | null)[], index: number, mask: readonly boolean[]): (string | null)[] {
  if (cells.length !== CUSTOM_OUTFIT_CELL_COUNT || !isPaintableCell(mask, index) || cells[index] === null)
    return cells as (string | null)[];
  const next = [...cells];
  next[index] = null;
  return next;
}

export function fillRegion(cells: readonly (string | null)[], index: number, color: string | null, mask: readonly boolean[]): (string | null)[] {
  if (cells.length !== CUSTOM_OUTFIT_CELL_COUNT || !isPaintableCell(mask, index) ||
      color !== null && !/^#[0-9A-Fa-f]{6}$/.test(color) || cells[index] === color) return cells as (string | null)[];
  const source = cells[index];
  const next = [...cells];
  const visited = new Uint8Array(CUSTOM_OUTFIT_CELL_COUNT);
  const queue = [index];
  visited[index] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!isPaintableCell(mask, current) || next[current] !== source) continue;
    next[current] = color;
    const x = current % CUSTOM_OUTFIT_WIDTH;
    const y = Math.floor(current / CUSTOM_OUTFIT_WIDTH);
    const neighbors = [
      x > 0 ? current - 1 : -1,
      x < CUSTOM_OUTFIT_WIDTH - 1 ? current + 1 : -1,
      y > 0 ? current - CUSTOM_OUTFIT_WIDTH : -1,
      y < CUSTOM_OUTFIT_HEIGHT - 1 ? current + CUSTOM_OUTFIT_WIDTH : -1,
    ];
    for (const neighbor of neighbors) {
      if (neighbor >= 0 && visited[neighbor] === 0 && isPaintableCell(mask, neighbor) && next[neighbor] === source) {
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
  }
  return next;
}

export function undoChange(state: PaintState): PaintState {
  if (state.undo.length === 0) return state;
  return { cells: [...state.undo[state.undo.length - 1]], undo: state.undo.slice(0, -1) };
}
