import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WORLD_CUTSCENES, WORLD03_ENTRANCE_CUTSCENE } from "../src/game/data/cutscenes/worlds.ts";

const lines = [
  "지옥의 놀이터를 헤쳐 나온 코기의 앞에 웅장한 위엄을 드러낸 곳은... 철근과 시멘트 가루가 춤추는 위험천만 공사장.",
  "사방에서 들려오는 진동드릴 소음과 굴착기의 굉음 속에서, 냥아치들은 이미 자신들만의 요새를 구축하고 있었다.",
  "콜록콜록! 이 먼지 구덩이에 시멘트 냄새까지... 강아지 호흡기 다 망가지겠네!",
  "시뻘건 철근이 사방으로 널려 있고, 발 밑은 아직 굳지 않은 촉촉한 시멘트가 코기의 짧은 다리를 유혹하고 있었다.",
  "누가 봐도 냥아치들의 덫이지만, 15cm 다리의 왕갈비뼈 집착 본능은 위험을 아예 지워버렸다.",
  "먼지 좀 마시면 어때! 내 갈비뼈만 찾으면 그만이다, 기다려라 냥아치들!",
];

test("월드 3 인트로는 확정된 여섯 대사를 한 번만 등록한다", () => {
  assert.equal(WORLD_CUTSCENES.filter((scene) => scene.id === "world-03-intro").length, 1);
  assert.ok(WORLD_CUTSCENES.includes(WORLD03_ENTRANCE_CUTSCENE));
  assert.equal(WORLD03_ENTRANCE_CUTSCENE.stageId, "world-03-stage-1");
  assert.deepEqual(WORLD03_ENTRANCE_CUTSCENE.beats.map((beat) => beat.id), [
    "construction-reveal", "construction-noise", "corgi-cough",
    "rebar-cement", "rib-instinct", "corgi-resolved",
  ]);
  assert.deepEqual(WORLD03_ENTRANCE_CUTSCENE.beats.map((beat) =>
    beat.narration ?? beat.dialogue?.[0]?.text,
  ), lines);
  assert.deepEqual(WORLD03_ENTRANCE_CUTSCENE.beats.map((beat) =>
    beat.dialogue?.[0]?.speaker ?? "narrator",
  ), ["narrator", "narrator", "corgi", "narrator", "narrator", "corgi"]);
  assert.ok(WORLD03_ENTRANCE_CUTSCENE.beats.every((beat) => beat.skipAllowedAfterSeen));
  assert.equal(WORLD03_ENTRANCE_CUTSCENE.beats[0].musicKey, "world-03-factory");
  assert.equal(WORLD03_ENTRANCE_CUTSCENE.beats[1].soundCue, "world-03-drill");
});

test("세 장의 전용 픽셀 그림은 필수 PNG로 등록된다", async () => {
  const manifest = JSON.parse(await readFile(new URL("../src/game/assets/assetManifest.json", import.meta.url), "utf8"));
  const assets = [
    ["world-03-entrance-construction", "world-03-construction-pov.png", false],
    ["world-03-entrance-corgi-cough", "world-03-corgi-cough.png", true],
    ["world-03-entrance-corgi-resolved", "world-03-corgi-resolved.png", true],
  ];
  for (const [key, filename, transparent] of assets) {
    const matches = manifest.filter((asset) => asset.key === key);
    assert.equal(matches.length, 1, key);
    const [asset] = matches;
    assert.deepEqual({ kind: asset.kind, worldId: asset.worldId, required: asset.required },
      { kind: "image", worldId: "world-03", required: true });
    assert.equal(asset.url, `/assets/pixel/cutscenes/world-03/${filename}`);
    const png = await readFile(new URL(`../public${asset.url}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.ok(width >= 1000 && height >= 700, `${key}: 충분한 해상도`);
    if (transparent) {
      assert.equal(width, height, `${key}: 정사각형 초상화`);
      assert.equal(png[25], 6, `${key}: RGBA PNG`);
    } else {
      assert.ok(width / height > 1.5, `${key}: 가로 배경`);
    }
  }
  assert.equal(manifest.some((asset) => asset.key === "world-03-map-placeholder"), false);
  assert.ok(manifest.some((asset) => asset.key === "world-02-map-placeholder"));
  assert.ok(manifest.some((asset) => asset.key === "world-03-background-mid-1"));
});
