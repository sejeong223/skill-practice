import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerController } = require("../src/game/systems/PlayerController.ts");
const { PlayerAnimator } = require("../src/game/entities/PlayerAnimator.ts");
const { PlayerWearables } = require("../src/game/entities/PlayerWearables.ts");
const { SkillSystem } = require("../src/game/systems/SkillSystem.ts");
const { SKILL_DEFINITIONS } = require("../src/game/data/skills.ts");
const { DEFAULT_PLAYER_TUNING } = require("../src/game/entities/playerTypes.ts");

function createGame() {
  const listeners = new Map();
  const images = [];
  const missing = new Set();
  const skillEvents = [];
  const scene = {
    time: { now: 0 },
    textures: { exists: key => !missing.has(key) },
    anims: { exists: () => true, create() {}, remove() {}, generateFrameNumbers: () => [] },
    events: { on() {}, off() {} },
    add: { image(x, y, key, frame = 0) {
      const image = { x, y, texture: { key }, frame: { name: frame }, visible: true,
        setDepth(value) { this.depth = value; return this; },
        setTexture(value, nextFrame = 0) { this.texture.key = value; this.frame.name = nextFrame; return this; },
        setFrame(value) { this.frame.name = value; return this; },
        setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
        setOrigin(nx, ny) { this.originX = nx; this.originY = ny; return this; },
        setScale(nx, ny) { this.scaleX = nx; this.scaleY = ny; return this; },
        setFlipX(value) { this.flipX = value; return this; },
        setVisible(value) { this.visible = value; return this; },
        destroy() { this.destroyed = true; } };
      images.push(image); return image;
    } },
  };
  const player = {
    scene, x: 100, y: 200, depth: 10, visible: true, active: true,
    originX: 0.5, originY: 99 / 128, scaleX: 1, scaleY: 1, flipX: false,
    texture: { key: "corgi-run" }, frame: { name: 0 }, state: "idle", foot: 99,
    body: { blocked: { down: true }, touching: { down: false }, velocity: { x: 0, y: 0 },
      width: 72, height: 40, offsetY: 59, setGravityY(value) { this.gravityY = value; } },
    appearance: { run: "corgi-run", bark: "corgi-bark", bite: "corgi-bite",
      pirouette: "corgi-pirouette", pirouetteMirror: "corgi-pirouette-mirror" },
    on(event, callback, context) { const entries = listeners.get(event) ?? []; entries.push({ callback, context }); listeners.set(event, entries); },
    off(event, callback) { listeners.set(event, (listeners.get(event) ?? []).filter(entry => entry.callback !== callback)); },
    emit(event, payload) { for (const entry of listeners.get(event) ?? []) entry.callback.call(entry.context, payload); },
    getControlOverride() { return null; }, isControlLocked() { return false; },
    getAppearanceTextures() { return this.appearance; },
    setAppearanceTextures(value) { this.appearance = value; },
    getAnimationState() { return this.state; }, setAnimationState(value) { this.state = value; },
    setTexture(key, frame = 0) { this.texture.key = key; this.frame.name = frame; return this; },
    setFrame(frame) { this.frame.name = frame; return this; },
    setVelocityX(value) { this.body.velocity.x = value; return this; },
    setVelocityY(value) { this.body.velocity.y = value; return this; },
    setFlipX(value) { this.flipX = value; return this; },
    alignFeetToFrame(value) { this.foot = value; this.originY = value / 128; this.body.offsetY = value - 40; },
    anims: { timeScale: 1, stop() {}, play() {} },
  };
  const input = { snapshot: { left: false, right: false, jumpPressed: false }, getSnapshot() { return this.snapshot; } };
  const controller = new PlayerController(player, input, DEFAULT_PLAYER_TUNING);
  const animator = new PlayerAnimator(player);
  const wearables = new PlayerWearables(scene, player);
  const skills = new SkillSystem(player, SKILL_DEFINITIONS, { emit: (event, payload) => skillEvents.push({ event, payload }) },
    undefined, ["bark", "bite", "double-jump"]);
  const starts = [];
  player.on("player-jump-started", event => starts.push(event));
  function frame(delta, { jumpPressed = false, left = false, right = false, grounded, velocityY } = {}) {
    input.snapshot = { left, right, jumpPressed };
    if (grounded !== undefined) player.body.blocked.down = grounded;
    if (velocityY !== undefined) player.body.velocity.y = velocityY;
    scene.time.now += delta;
    controller.update(scene.time.now, delta);
    animator.update(scene.time.now, delta);
    wearables.sync();
  }
  return { player, scene, input, controller, animator, wearables, skills, skillEvents, images, missing, starts, frame };
}

test("점프 승인에서 착지까지 600ms 회전하고 한 틱 남은 접지 신호를 견딘다", () => {
  const game = createGame();
  const { player, starts, frame } = game;
  const bodyBefore = { width: player.body.width, height: player.body.height, offsetY: player.body.offsetY };
  frame(0, { jumpPressed: true, right: true });
  assert.deepEqual(starts, [{ kind: "normal", facingLeft: false }]);
  assert.equal(player.body.velocity.y, -460);
  assert.equal(player.state, "jump");
  assert.equal(player.texture.key, "corgi-pirouette");
  for (const [at, expected] of [[74, 0], [75, 1], [150, 2], [300, 4], [450, 6], [525, 7], [600, 0]]) {
    const previous = game.scene.time.now;
    frame(at - previous, { grounded: false });
    assert.equal(player.frame.name, expected, `frame at ${at}ms`);
  }
  frame(200, { grounded: false });
  assert.equal(player.frame.name, 0);
  frame(16, { grounded: true, velocityY: 0 });
  assert.equal(player.texture.key, "corgi-run");
  assert.deepEqual({ width: player.body.width, height: player.body.height, offsetY: player.body.offsetY }, bodyBefore);
  game.animator.destroy(); game.wearables.destroy();
});

test("누른 채 재입력, 단순 낙하와 튕김은 회전을 다시 시작하지 않는다", () => {
  const game = createGame();
  game.frame(16, { jumpPressed: true });
  game.frame(100, { jumpPressed: true, grounded: false });
  game.frame(100, { jumpPressed: false, grounded: false });
  assert.equal(game.starts.length, 1);
  game.frame(16, { grounded: true, velocityY: 0 });
  game.frame(100, { grounded: false, velocityY: 200 });
  assert.equal(game.player.texture.key, "corgi-run");
  game.frame(100, { grounded: false, velocityY: -300 });
  assert.equal(game.starts.length, 1);
  assert.equal(game.player.texture.key, "corgi-run");
  game.animator.destroy(); game.wearables.destroy();
});

test("공중 역방향 조작과 W/E 스킬 사용은 전투 상태를 갱신하고 그림은 이륙 방향을 유지한다", () => {
  const game = createGame();
  game.frame(0, { jumpPressed: true, right: true });
  game.frame(300, { grounded: false, left: true });
  assert.equal(game.player.flipX, true);
  assert.equal(game.player.texture.key, "corgi-pirouette-mirror");
  assert.equal(game.player.frame.name, 4);
  assert.equal(game.skills.use("bark", 300).accepted, true);
  game.animator.triggerBark();
  assert.equal(game.skills.use("bite", 300).accepted, true);
  game.animator.triggerBite(300);
  game.frame(75, { grounded: false, left: true });
  assert.equal(game.player.texture.key, "corgi-pirouette-mirror");
  assert.equal(game.player.frame.name, 5);
  assert.equal(game.skills.getRemainingCooldown("bite", 300), 6000);
  assert.equal(game.skillEvents.filter(({ event }) => event === "skill-used").length, 2);
  game.animator.destroy(); game.wearables.destroy();
});

test("공중 장비 교체와 더블 점프 재시작, 초기화 및 파괴 뒤 잔여 회전이 없다", () => {
  const game = createGame();
  game.wearables.setEquipment("bee-bodysuit", "prince-crown");
  game.frame(0, { jumpPressed: true });
  game.frame(225, { grounded: false });
  assert.equal(game.player.texture.key, "wear-bee-bodysuit-pirouette");
  assert.equal(game.images.at(-1).frame.name, 3);
  game.wearables.setEquipment("banana-peel-suit", "birthday-party-hat");
  assert.equal(game.player.frame.name, 3);
  assert.equal(game.images.at(-1).texture.key, "wear-birthday-party-hat-pirouette");
  assert.equal(game.skills.use("double-jump", 225).accepted, true);
  assert.deepEqual(game.starts.at(-1), { kind: "double", facingLeft: false });
  assert.equal(game.player.frame.name, 0);
  game.frame(75, { grounded: false });
  assert.equal(game.player.frame.name, 1);
  game.player.emit("player-reset");
  assert.equal(game.player.texture.key, "wear-banana-peel-suit-run");
  game.animator.destroy(); game.wearables.destroy();
  assert.equal(game.images.at(-1).destroyed, true);
  const before = game.player.texture.key;
  game.player.emit("player-jump-started", { kind: "normal", facingLeft: false });
  assert.equal(game.player.texture.key, before);
});

test("누락된 회전 텍스처에서는 물리 크기를 유지하며 안전하게 기존 표시로 돌아온다", () => {
  const game = createGame();
  game.missing.add("corgi-pirouette-mirror");
  game.frame(0, { jumpPressed: true });
  assert.equal(game.player.texture.key, "corgi-run");
  assert.equal(game.player.body.width, 72);
  assert.equal(game.player.body.height, 40);
  game.animator.destroy(); game.wearables.destroy();
});

test("조기 착지와 재시도는 진행 중이던 회전을 즉시 정리한다", () => {
  const game = createGame();
  game.frame(0, { jumpPressed: true });
  game.frame(75, { grounded: false });
  game.frame(16, { grounded: true, velocityY: 0 });
  assert.equal(game.player.texture.key, "corgi-run");
  game.frame(0, { jumpPressed: true });
  assert.equal(game.player.texture.key, "corgi-pirouette");
  game.player.emit("player-reset");
  assert.equal(game.player.texture.key, "corgi-run");
  game.animator.destroy(); game.wearables.destroy();
});

test("회전 중 직접 색칠한 의상으로 갈아입어도 프레임을 유지하고 재설정에서 동적 시트를 정리한다", () => {
  const game = createGame();
  const dynamic = new Set();
  const removed = [];
  game.scene.textures = {
    exists: key => dynamic.has(key) || key.startsWith("custom-outfit-template") || key.startsWith("corgi-"),
    get: key => ({ getSourceImage: () => ({ key }) }),
    addCanvas: key => { dynamic.add(key); return { add() {}, refresh() {} }; },
    remove: key => { removed.push(key); dynamic.delete(key); },
  };
  const originalDocument = global.document;
  global.document = { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ source: null,
      drawImage(source) { this.source = source; },
      getImageData(x, y, width, height) {
        const data = new Uint8ClampedArray(width * height * 4);
        if (this.source?.key?.endsWith("-uv")) {
          for (let frame = 0; frame < 8; frame++) {
            const at = (44 * width + frame * 112 + 32) * 4;
            data[at] = 1; data[at + 3] = 255;
          }
        } else data.fill(255);
        return { data };
      }, putImageData() {} }),
  }) };
  try {
    game.frame(0, { jumpPressed: true });
    game.frame(225, { grounded: false });
    const design = { id: "review", updatedAt: "2026-10-28T00:00:00Z", cells: Array(56 * 32).fill("#E95F68") };
    game.wearables.setEquipment(null, "prince-crown", design);
    assert.equal(game.player.frame.name, 3);
    assert.ok(game.player.texture.key.endsWith("-pirouette"));
    assert.equal(dynamic.size, 5);
    game.frame(75, { grounded: false, left: true });
    assert.ok(game.player.texture.key.endsWith("-pirouette-mirror"));
    assert.equal(game.player.frame.name, 4);
    game.wearables.setEquipment(null, null);
    assert.equal(game.player.texture.key, "corgi-pirouette-mirror");
    assert.equal(game.player.frame.name, 4);
    assert.equal(dynamic.size, 0);
    assert.equal(removed.length, 5);
    game.animator.destroy(); game.wearables.destroy();
  } finally {
    global.document = originalDocument;
  }
});
