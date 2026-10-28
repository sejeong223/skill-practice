import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { STAGE_IDS, WORLD02_PLAYABLE_STAGE_IDS, getNextStageId, getPreviousWorld02StageId } from "../src/game/core/constants.ts";
import { WORLD03_ENTRANCE_CUTSCENE } from "../src/game/data/cutscenes/worlds.ts";

const worlds = await readFile(new URL('../src/game/data/worlds.ts', import.meta.url), 'utf8');
const maps = await readFile(new URL('../src/game/data/worldMaps.ts', import.meta.url), 'utf8');
const cutscenes = await readFile(new URL('../src/game/data/cutscenes/worlds.ts', import.meta.url), 'utf8');

test("normal campaign stages advance in the declared order", () => {
  assert.equal(getNextStageId("world-01-stage-1"), "world-01-stage-2");
  assert.equal(getNextStageId("world-01-stage-4"), "world-01-stage-boss");
  assert.equal(getNextStageId("world-02-stage-1"), "world-02-stage-2");
  assert.equal(getNextStageId("world-02-stage-2"), "world-02-stage-3");
  assert.equal(getNextStageId("world-02-stage-3"), "world-02-stage-boss");
  assert.equal(getNextStageId("world-02-stage-4"), "world-02-stage-boss");
  assert.deepEqual(WORLD02_PLAYABLE_STAGE_IDS, ["world-02-stage-1", "world-02-stage-2", "world-02-stage-3", "world-02-stage-boss"]);
  assert.ok(STAGE_IDS.includes("world-02-stage-4"));
  assert.equal(getPreviousWorld02StageId("world-02-stage-2"), "world-02-stage-1");
  assert.equal(getPreviousWorld02StageId("world-02-stage-3"), "world-02-stage-2");
  assert.equal(getPreviousWorld02StageId("world-02-stage-1"), null);
  assert.equal(getPreviousWorld02StageId("world-02-stage-boss"), null);
});

test("world-one boss route points to the manual World 2 handoff", () => {
  assert.equal(getNextStageId("world-01-stage-boss"), "world-02-stage-1");
});

test("unknown and final campaign stages have no next stage", () => {
  assert.equal(getNextStageId("world-05-stage-boss"), null);
  assert.equal(getNextStageId("unknown-stage"), null);
  assert.equal(getNextStageId(STAGE_IDS.at(-1)), null);
});

test("later worlds use the decided locations and bosses", () => {
  for (const value of ["공사장", "냥아치 아지트 (고물상)", "캣타워 공성전", "고등어", "턱시도", "메인쿤", "공사장 진입로", "레미콘 구역", "비계 통로", "자재 야적장"]) {
    assert.ok(worlds.includes(`"${value}"`), value);
  }
});

test("construction stages select four distinct image layers without changing saved stage IDs", () => {
  assert.match(maps, /function getWorld03StageTheme/);
  for (let index = 1; index <= 4; index++) {
    const stageId = `world-03-stage-${index}`;
    assert.ok(STAGE_IDS.includes(stageId));
  }
  assert.match(maps, /background-mid-\$\{match\[1\]\}/);
});

test("world 3 and 4 intros and later boss intros match their locations", () => {
  assert.equal(WORLD03_ENTRANCE_CUTSCENE.id, "world-03-intro");
  assert.equal(WORLD03_ENTRANCE_CUTSCENE.stageId, "world-03-stage-1");
  assert.ok(WORLD03_ENTRANCE_CUTSCENE.beats[0].narration.includes("공사장"));
  for (const [id, landmark] of [
    ["world-04-intro", "고물상"],
    ["world-03-boss-intro", "고등어"],
    ["world-04-boss-intro", "턱시도"], ["world-05-boss-intro", "메인쿤"],
  ]) {
    const script = cutscenes.slice(cutscenes.indexOf(`id: "${id}"`));
    assert.ok(script.startsWith(`id: "${id}"`), id);
    assert.ok(script.slice(0, 280).includes(landmark), id);
  }
  assert.match(cutscenes, /네 녀석이 치즈 태비냐\? 턱시도는 어디로 갔어!/);
});
