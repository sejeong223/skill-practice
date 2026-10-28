import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerAnimator, PIROUETTE_DURATION_MS } = require("../src/game/entities/PlayerAnimator.ts");
const { PlayerWearables } = require("../src/game/entities/PlayerWearables.ts");
const { SkillSystem } = require("../src/game/systems/SkillSystem.ts");
const { SKILL_DEFINITIONS } = require("../src/game/data/skills.ts");
const { colorizeCustomOutfitPixels } = require("../src/game/entities/customOutfitTexture.ts");

function harness() {
  const listeners = new Map();
  const images = [];
  const missing = new Set();
  const scene = {
    time: { now: 0 },
    textures: { exists: key => !missing.has(key) },
    anims: { exists: () => true },
    events: { on() {}, off() {} },
    add: { image(x, y, key, frame = 0) {
      const image = { x, y, texture: { key }, frame: { name: frame },
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
    body: { blocked: { down: true }, touching: { down: false },
      velocity: { x: 0, y: 0 }, width: 72, height: 40, offsetY: 59 },
    appearance: { run: "corgi-run", bark: "corgi-bark", bite: "corgi-bite",
      pirouette: "corgi-pirouette", pirouetteMirror: "corgi-pirouette-mirror" },
    on(event, callback, context) { const entries = listeners.get(event) ?? []; entries.push({ callback, context }); listeners.set(event, entries); },
    off(event, callback) { listeners.set(event, (listeners.get(event) ?? []).filter(entry => entry.callback !== callback)); },
    emit(event, payload) { for (const entry of listeners.get(event) ?? []) entry.callback.call(entry.context, payload); },
    getAppearanceTextures() { return this.appearance; },
    setAppearanceTextures(value) { this.appearance = value; },
    getAnimationState() { return this.state; },
    setAnimationState(value) { this.state = value; },
    setTexture(key, frame = 0) { this.texture.key = key; this.frame.name = frame; return this; },
    setFrame(frame) { this.frame.name = frame; return this; },
    setVelocityY(value) { this.body.velocity.y = value; return this; },
    alignFeetToFrame(value) { this.foot = value; this.originY = value / 128; this.body.offsetY = value - 40; },
    anims: { timeScale: 1, stop() {}, play() {} },
  };
  const animator = new PlayerAnimator(player);
  return { player, scene, images, missing, animator };
}

test("일반 점프는 600ms에 전신 한 바퀴를 돌고 착지까지 옆모습을 유지한다", () => {
  const { player, animator, images } = harness();
  const body = { width: player.body.width, height: player.body.height, offsetY: player.body.offsetY };
  assert.equal(PIROUETTE_DURATION_MS, 600);
  player.setVelocityY(-460);
  player.emit("player-jump-started", { kind: "normal", facingLeft: false });
  assert.equal(player.texture.key, "corgi-pirouette");
  assert.equal(player.frame.name, 0);
  animator.update(16, 16); // launch frame still says grounded
  assert.equal(player.texture.key, "corgi-pirouette");
  player.body.blocked.down = false;
  player.state = "jump";
  for (const [delta, frame] of [[59, 1], [75, 2], [150, 4], [150, 6], [75, 7], [75, 0]]) {
    animator.update(0, delta);
    assert.equal(player.frame.name, frame);
  }
  animator.update(0, 500);
  assert.equal(player.frame.name, 0);
  assert.equal(player.foot, 99);
  assert.deepEqual({ width: player.body.width, height: player.body.height, offsetY: player.body.offsetY }, body);
  assert.equal(images.length, 0, "the corgi stays on its single physics sprite");
  player.body.blocked.down = true;
  player.body.velocity.y = 0;
  player.state = "run";
  animator.update(0, 16);
  assert.equal(player.texture.key, "corgi-run");
  animator.destroy();
});

test("공중 좌우 이동은 전투 flipX를 바꾸되 회전 그림 방향은 시트 보정으로 유지한다", () => {
  const { player, animator } = harness();
  player.setVelocityY(-460);
  player.emit("player-jump-started", { kind: "normal", facingLeft: false });
  player.body.blocked.down = false;
  animator.update(0, 300);
  assert.equal(player.frame.name, 4);
  player.flipX = true;
  animator.update(0, 0);
  assert.equal(player.texture.key, "corgi-pirouette-mirror");
  assert.equal(player.frame.name, 4);
  assert.equal(player.flipX, true, "combat still sees the changed facing");
  animator.destroy();
});

test("공중 W/E 스킬은 회전을 가리지 않고 더블 점프 이벤트는 0프레임부터 재시작한다", () => {
  const { player, animator } = harness();
  player.setVelocityY(-460);
  player.emit("player-jump-started", { kind: "normal", facingLeft: false });
  player.body.blocked.down = false;
  animator.update(0, 300);
  animator.triggerBark();
  animator.triggerBite(300);
  animator.update(0, 80);
  assert.equal(player.texture.key, "corgi-pirouette");
  assert.equal(player.frame.name, 5);
  const skills = new SkillSystem(player, SKILL_DEFINITIONS, undefined, undefined, ["double-jump"]);
  assert.equal(skills.use("double-jump", 400).accepted, true);
  assert.equal(player.body.velocity.y, -420);
  assert.equal(player.frame.name, 0);
  animator.update(0, 75);
  assert.equal(player.frame.name, 1);
  player.emit("player-reset");
  assert.equal(player.texture.key, "corgi-run");
  animator.destroy();
});

test("회전 중 의상·장신구 교체는 같은 프레임을 유지한다", () => {
  const { player, scene, images, animator } = harness();
  const wearables = new PlayerWearables(scene, player);
  wearables.setEquipment("bee-bodysuit", "prince-crown");
  player.setVelocityY(-460);
  player.emit("player-jump-started", { kind: "normal", facingLeft: false });
  player.body.blocked.down = false;
  animator.update(0, 225);
  wearables.sync();
  assert.equal(player.texture.key, "wear-bee-bodysuit-pirouette");
  assert.equal(player.frame.name, 3);
  assert.equal(images.at(-1).texture.key, "wear-prince-crown-pirouette");
  assert.equal(images.at(-1).frame.name, 3);
  wearables.setEquipment("banana-peel-suit", "birthday-party-hat");
  assert.equal(player.texture.key, "wear-banana-peel-suit-pirouette");
  assert.equal(player.frame.name, 3);
  assert.equal(images.at(-1).texture.key, "wear-birthday-party-hat-pirouette");
  player.flipX = true;
  animator.update(0, 0);
  wearables.sync();
  assert.equal(player.texture.key, "wear-banana-peel-suit-pirouette-mirror");
  assert.equal(images.at(-1).texture.key, "wear-birthday-party-hat-pirouette-mirror");
  assert.equal(images.at(-1).flipX, true);
  animator.destroy();
  wearables.destroy();
});

test("사용자 색칠 의상은 회전 8프레임의 UV 천만 색칠한다", async () => {
  const directory = new URL("../public/assets/pixel/characters/corgi/equipment/", import.meta.url);
  const design = { id: "custom-1", updatedAt: "2026-10-28T00:00:00Z", cells: Array(56 * 32).fill("#E95F68") };
  for (const suffix of ["", "-mirror"]) {
    const image = (name) => sharp(fileURLToPath(new URL(name, directory))).ensureAlpha().raw().toBuffer();
    const template = new Uint8ClampedArray(await image(`custom-outfit-template-pirouette${suffix}.png`));
    const uv = new Uint8ClampedArray(await image(`custom-outfit-template-pirouette${suffix}-uv.png`));
    const pose = suffix ? "pirouetteMirror" : "pirouette";
    const colored = colorizeCustomOutfitPixels(template, 896, 128, pose, design, uv);
    for (let frame = 0; frame < 8; frame++) {
      let painted = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
        const at = (y * 896 + frame * 112 + x) * 4;
        if (uv[at + 3] >= 200) {
          assert.deepEqual([...colored.subarray(at, at + 3)], [0xE9, 0x5F, 0x68]);
          painted++;
        } else assert.deepEqual(colored.subarray(at, at + 4), template.subarray(at, at + 4));
      }
      assert.ok(painted > 250, `${pose}/${frame}: paintable fabric missing`);
    }
  }
});
