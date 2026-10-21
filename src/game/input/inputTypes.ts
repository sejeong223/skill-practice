export interface KeybindMap {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  attack: string[];
  dash: string[];
  bark: string[];
  pause: string[];
}

export interface InputSnapshot {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  attackPressed: boolean;
  dashPressed: boolean;
  barkPressed: boolean;
  pausePressed: boolean;
  pauseHeld: boolean;
}
