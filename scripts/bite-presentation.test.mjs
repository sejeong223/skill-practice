import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerAnimator, BITE_PRESENTATION_MS } = require("../src/game/entities/PlayerAnimator.ts");

function harness() {
  const sprites = [];
  const missing = new Set();
  const scene = {
    time: { now: 0 },
    textures: { exists: key => !missing.has(key) },
    anims: { exists: () => true },
    add: { sprite(...args) { sprites.push(args); throw new Error("bite must not add a second Sprite"); } },
  };
  const player = {
    scene, x: 100, y: 120, originX: 0.5, originY: 99 / 128,
    scaleX: 1, scaleY: 1, alpha: 1, depth: 10, flipX: false,
    texture: { key: "corgi-run" }, frame: { name: 0 },
    body: { velocity: { x: 0, y: 0 }, width: 72, height: 40, offsetX: 20, offsetY: 59 },
    state: "idle", foot: 99,
    appearance: { run: "corgi-run", bark: "corgi-bark", bite: "corgi-bite" },
    getAppearanceTextures() { return this.appearance; },
    getAnimationState() { return this.state; },
    anims: { timeScale: 1, stop() {}, play() {} },
    on() {}, off() {},
    setTexture(key, frame = 0) { this.texture.key = key; this.frame.name = frame; return this; },
    setFrame(frame) { this.frame.name = frame; return this; },
    alignFeetToFrame(foot) { this.foot = foot; this.body.offsetY = foot - 40; },
  };
  return { sprites, missing, player, animator: new PlayerAnimator(player) };
}

test("E 물기는 코기 본체의 전신 4프레임만 표시하고 320ms에 현재 달리기로 복귀한다", () => {
  const { sprites, player, animator } = harness();
  const initial = { ...player.body };
  assert.equal(BITE_PRESENTATION_MS, 320);
  animator.triggerBite(1000);
  for (const [elapsed, frame, foot] of [
    [0, 0, 99], [79, 0, 99], [80, 1, 99], [159, 1, 99],
    [160, 2, 100], [239, 2, 100], [240, 3, 104], [319, 3, 104],
  ]) {
    player.x += 1;
    player.flipX = elapsed >= 160;
    animator.update(1000 + elapsed, 0);
    assert.equal(player.texture.key, "corgi-bite");
    assert.equal(player.frame.name, frame);
    assert.equal(player.foot, foot);
    assert.equal(player.body.width, initial.width);
    assert.equal(player.body.height, initial.height);
    assert.equal(player.body.offsetY, foot - 40);
  }
  assert.equal(sprites.length, 0, "얼굴 오버레이 Sprite를 생성하지 않아야 한다");
  animator.update(1320, 0);
  assert.equal(player.texture.key, "corgi-run");
  assert.equal(player.foot, 99);
  assert.equal(player.flipX, true);
});

test("의상 교체 중에도 현재 물기 프레임을 이어가고 W 짖기·사망·파괴에서 복귀한다", () => {
  const { player, animator, sprites } = harness();
  player.appearance = {
    run: "wear-bee-bodysuit-run", bark: "wear-bee-bodysuit-bark", bite: "wear-bee-bodysuit-bite",
  };
  player.setTexture(player.appearance.run);
  animator.triggerBite(100);
  animator.update(260, 0);
  assert.equal(player.texture.key, "wear-bee-bodysuit-bite");
  assert.equal(player.frame.name, 2);
  player.appearance = {
    run: "wear-banana-peel-suit-run", bark: "wear-banana-peel-suit-bark", bite: "wear-banana-peel-suit-bite",
  };
  player.setTexture(player.appearance.bite, 2);
  animator.update(300, 0);
  assert.equal(player.texture.key, "wear-banana-peel-suit-bite");
  assert.equal(player.frame.name, 2);
  animator.triggerBark();
  assert.equal(player.texture.key, "wear-banana-peel-suit-bark");
  animator.triggerBite(500);
  assert.equal(player.texture.key, "wear-banana-peel-suit-bite");
  animator.stopBite();
  assert.equal(player.texture.key, "wear-banana-peel-suit-run");
  animator.triggerBite(900);
  animator.destroy();
  assert.equal(player.texture.key, "wear-banana-peel-suit-run");
  assert.equal(sprites.length, 0);
});

test("물기 텍스처 누락은 시각 연출만 건너뛰고 진행 중 누락도 안전하게 복귀한다", () => {
  const { player, missing, animator } = harness();
  player.appearance = { run: "wear-bee-bodysuit-run", bark: "wear-bee-bodysuit-bark", bite: null };
  player.setTexture(player.appearance.run);
  animator.triggerBite(0);
  assert.equal(player.texture.key, player.appearance.run);
  player.appearance = { ...player.appearance, bite: "wear-bee-bodysuit-bite" };
  animator.triggerBite(100);
  assert.equal(player.texture.key, player.appearance.bite);
  missing.add(player.appearance.bite);
  animator.update(180, 0);
  assert.equal(player.texture.key, player.appearance.run);
  animator.destroy();
});
