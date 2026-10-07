import assert from "node:assert/strict";
import test from "node:test";
import { CutsceneTimeline } from "../src/game/cutscenes/CutsceneTimeline.ts";
import { getBeatPlaybackMs, getCaptionPlaybackMs } from "../src/game/cutscenes/cutsceneTiming.ts";

const beat = (id, durationMs) => ({ id, durationMs, skipAllowedAfterSeen: true });
const wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

test("caption timing preserves short scenes and gives long text reading time", () => {
  assert.equal(getCaptionPlaybackMs(2400, ""), 2400);
  assert.equal(getCaptionPlaybackMs(2400, "짧은 말"), 2400);
  assert.equal(getCaptionPlaybackMs(1000, "가".repeat(50)), 1200 + 50 * 65);
  assert.equal(getCaptionPlaybackMs(1000, "🐕"), 1265);
});

test("beat timing includes narration, every dialogue line, and the item card", () => {
  const scriptedBeat = {
    ...beat("rib", 1800),
    narration: "갈비뼈 등장",
    dialogue: [
      { speaker: "owner", text: "기다려" },
      { speaker: "corgi", text: "멍" },
    ],
    itemCard: { title: "왕갈비뼈", description: "맛있는 간식" },
  };
  const visibleText = "갈비뼈 등장 기다려 멍 왕갈비뼈 맛있는 간식";
  assert.equal(getBeatPlaybackMs(scriptedBeat), 1200 + Array.from(visibleText).length * 65);
  assert.equal(getBeatPlaybackMs(beat("silent", 4100)), 4100);
});

test("optional manual advance still plays all beats automatically", async () => {
  const timeline = new CutsceneTimeline();
  const seen = [];
  await timeline.play([beat("first", 25), beat("second", 25)], (entry) => seen.push(entry.id), true);
  assert.deepEqual(seen, ["first", "second"]);
});

test("manual advance cancels its scheduled timer", async () => {
  const timeline = new CutsceneTimeline();
  const seen = [];
  const finished = timeline.play([beat("first", 250), beat("second", 30)], (entry) => seen.push(entry.id), true);
  await wait(130);
  timeline.advance();
  await finished;
  await wait(130);
  assert.deepEqual(seen, ["first", "second"]);
});

test("skipping cancels the next scheduled beat", async () => {
  const timeline = new CutsceneTimeline();
  const seen = [];
  const finished = timeline.play([beat("first", 60), beat("second", 60)], (entry) => seen.push(entry.id), true);
  timeline.skip();
  await finished;
  await wait(90);
  assert.deepEqual(seen, ["first"]);
});
