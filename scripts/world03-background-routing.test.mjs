import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const worldMaps = await readFile(new URL('../src/game/data/worldMaps.ts', import.meta.url), 'utf8');
const worlds = await readFile(new URL('../src/game/data/worlds.ts', import.meta.url), 'utf8');
const source = worldMaps.slice(
  worldMaps.indexOf('export function getWorld03StageTheme('),
  worldMaps.indexOf('export const WORLD_MAP_THEMES:'),
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { getWorld03StageTheme } = context.exports;
const base = {
  layers: [
    { kind: 'background-far', assetKey: 'far' },
    { kind: 'background-mid', assetKey: 'base-mid' },
    { kind: 'gameplay', assetKey: 'gameplay' },
  ],
};
const midKey = (theme) => theme.layers.find((layer) => layer.kind === 'background-mid').assetKey;

test('월드 3 일반 네 구역과 보스가 각각 해당 중경을 사용한다', () => {
  for (const suffix of ['1', '2', '3', '4', 'boss']) {
    assert.equal(midKey(getWorld03StageTheme(`world-03-stage-${suffix}`, base)),
      `world-03-background-mid-${suffix}`);
  }
  assert.match(worlds,
    /getWorld03StageTheme\(stageId, getWorld02StageTheme\(stageId, theme\)\)\.layers/);
});

test('다른 월드와 월드 3의 비대상 스테이지는 기본 레이어를 유지한다', () => {
  assert.equal(getWorld03StageTheme('world-02-stage-2', base), base);
  assert.equal(getWorld03StageTheme('world-03-stage-5', base), base);
  const changed = getWorld03StageTheme('world-03-stage-boss', base);
  assert.equal(changed.layers[0].assetKey, 'far');
  assert.equal(changed.layers[2].assetKey, 'gameplay');
});

test('월드 3 보스도 실제 플랫폼 범위에 맞춰 시각 바닥을 그린다', async () => {
  const scene = await readFile(new URL('../src/game/scenes/StageScene.ts', import.meta.url), 'utf8');
  assert.match(scene, /stage\.id === "world-03-stage-boss"\) && !this\.loadedMap/);
  assert.match(scene, /stage\.kind === "boss" \? 16 : 0/);
  assert.match(scene, /\.tileSprite\(bounds\.left, visualTop, bounds\.width, height, "world-03-construction-floor"\)/);
  assert.match(worlds, /x: isBoss \? length \/ 2 : 16,[\s\S]*?width: length - 32/);
});
