export type MouseTrajectoryKind = "curve" | "straight" | "fast";

export interface MouseTrajectoryState {
  readonly kind: MouseTrajectoryKind;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly ageMs: number;
  readonly turnSeed: number;
}

const KINDS: readonly MouseTrajectoryKind[] = ["curve", "straight", "fast"];
const SPEED: Readonly<Record<MouseTrajectoryKind, number>> = { curve: 260, straight: 300, fast: 420 };
const TURN: Readonly<Record<MouseTrajectoryKind, number>> = { curve: 3.3, straight: 1.4, fast: 2.5 };

export function mouseKindForSalvo(serial: number, index: 0 | 1, seedOffset: number): MouseTrajectoryKind {
  return KINDS[((serial * 2 + index + seedOffset) % KINDS.length + KINDS.length) % KINDS.length];
}

export function safeMouseSpawnX(playerX: number, bossX: number, arenaRight: number): number {
  return Math.min(arenaRight - 40, Math.max(bossX - 55, playerX + 190));
}

export function sampleMouseStep(
  mouse: MouseTrajectoryState,
  target: { readonly x: number; readonly y: number },
  deltaMs: number,
): MouseTrajectoryState {
  const delta = Math.max(0, Math.min(50, deltaMs));
  if (delta === 0) return mouse;
  const ageMs = mouse.ageMs + delta;
  const speed = SPEED[mouse.kind];
  const currentAngle = Math.atan2(mouse.vy, mouse.vx);
  const wobble = mouse.kind === "curve" ? Math.sin(ageMs / 190 + mouse.turnSeed) * 0.72 : 0;
  const targetAngle = Math.atan2(target.y - mouse.y, target.x - mouse.x) + wobble;
  const angleDelta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
  const maxTurn = TURN[mouse.kind] * delta / 1000;
  const angle = currentAngle + Math.max(-maxTurn, Math.min(maxTurn, angleDelta));
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return { ...mouse, x: mouse.x + vx * delta / 1000, y: mouse.y + vy * delta / 1000, vx, vy, ageMs };
}

export function chooseFurballX(playerX: number, serial: number, mouseXs: readonly number[]): number {
  const clamp = (x: number) => Math.max(180, Math.min(1080, x));
  let x = clamp(playerX + (serial % 2 === 0 ? -80 : 80));
  if (mouseXs.some(mouseX => Math.abs(mouseX - x) < 95)) {
    x = clamp(x + (serial % 2 === 0 ? -130 : 130));
  }
  return x;
}

export function sweptMouseBounds(previous: MouseTrajectoryState, current: MouseTrajectoryState) {
  return {
    x: Math.min(previous.x, current.x) - 11,
    y: Math.min(previous.y, current.y) - 8,
    width: Math.abs(current.x - previous.x) + 22,
    height: Math.abs(current.y - previous.y) + 16,
  };
}
