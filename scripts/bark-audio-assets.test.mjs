import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

test("실제 단발 짖음은 브라우저에서 재생 가능한 짧은 PCM 음원이다", () => {
  const wav = fs.readFileSync(new URL("../public/assets/audio/corgi-bark.wav",import.meta.url));
  assert.equal(wav.toString("ascii",0,4),"RIFF");
  assert.equal(wav.toString("ascii",8,12),"WAVE");
  assert.equal(wav.toString("ascii",36,40),"data");
  assert.equal(wav.readUInt16LE(20),1); assert.equal(wav.readUInt16LE(22),1);
  assert.equal(wav.readUInt32LE(24),44100); assert.equal(wav.readUInt16LE(34),16);
  const sampleCount=wav.readUInt32LE(40)/2;
  assert.equal(wav.length,44+sampleCount*2);
  assert.ok(sampleCount/44100>0.25 && sampleCount/44100<0.4);
  const samples=Array.from({length:sampleCount},(_,i)=>wav.readInt16LE(44+i*2)/32768);
  const peak=Math.max(...samples.map(Math.abs));
  const rms=Math.sqrt(samples.reduce((sum,s)=>sum+s*s,0)/samples.length);
  assert.ok(peak>0.7 && peak<0.9);
  assert.ok(rms>0.1);
  assert.ok(Math.abs(samples.reduce((sum,s)=>sum+s,0)/samples.length)<0.001);
  assert.equal(samples.at(-1),0);
});
test("짖기 이미지는 기존 112×128 프레임과 발 위치를 유지하는 필수 투명 에셋", async () => {
  const image=sharp(fileURLToPath(new URL("../public/assets/pixel/characters/corgi/corgi-bark.png",import.meta.url)));
  const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,112); assert.equal(info.height,128);
  let last=-1, transparent=0;
  for(let i=0;i<data.length;i+=4){if(data[i+3]>128)last=Math.floor(i/4/info.width);else if(data[i+3]===0)transparent++;}
  assert.equal(last,99); assert.ok(transparent>info.width*info.height/3);
  const manifest=JSON.parse(fs.readFileSync(new URL("../src/game/assets/assetManifest.json",import.meta.url)));
  const asset=manifest.find(a=>a.key==="corgi-bark"); assert.equal(asset.kind,"image"); assert.equal(asset.required,true);
});
