import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { getLeaderboard, compareBestRows } from "../api/src/services/leaderboard.ts";
import { CosmosGameRepository } from "../api/src/repository.ts";
import { createGameService } from "../api/src/services/router.ts";
import { createGameHandlers } from "../api/src/functions/game.ts";
import { ApiError } from "../api/src/errors.ts";
import { docBase } from "../api/src/documents.ts";
import { fakeClock, identity } from "./cloud-test-support.mjs";

const now=fakeClock(),runId=randomUUID();
const row=(i,name="코기",rank=101,deaths=3)=>({
 ...docBase(identity(i.toString(16).padStart(8,"0")+"-0000-4000-8000-000000000000"),"best",now().toISOString()),
 kind:"best",displayName:name,eligible:true,record:{milestoneId:rank===101?"world-01:checkpoint-1":"world-02:start",progressRank:rank,deaths,runId}
});
const source=rows=>({async *scanBest(namespace){assert.equal(namespace,"prod");for(const r of rows)yield structuredClone(r);}});
for(const size of [0,1,9,10,11,200])test("returns exact public row count for "+size+" accounts",async()=>{
 const rows=Array.from({length:size},(_,i)=>row(i,"이름"+i)),r=await getLeaderboard(identity(),source(rows),now);
 assert.equal(r.rows.length,Math.min(10,size));assert.deepEqual(r.rows.map(r=>r.rank),Array.from({length:Math.min(10,size)},(_,i)=>i+1));
 for(const entry of r.rows)assert.deepEqual(Object.keys(entry).sort(),["rank","nickname","deaths","location"].sort());
 assert.equal(JSON.stringify(r).includes("playerId"),false);assert.equal(JSON.stringify(r).includes(runId),false);
});
test("150 reversed boundary ties are considered before truncating and normalized in Korean order",async()=>{
 const names=["다","나","가","각","간","갇","갈","감","갑","갓","강","개","거","고","구"];
 const rows=Array.from({length:150},(_,i)=>row(i,names[i%names.length]+String(i))),collator=new Intl.Collator("ko",{usage:"sort",sensitivity:"variant",numeric:false});
 const expected=[...rows].sort((a,b)=>collator.compare(a.displayName.normalize("NFC"),b.displayName.normalize("NFC"))||a.playerId.localeCompare(b.playerId)).slice(0,10).map(r=>r.displayName);
 assert.deepEqual((await getLeaderboard(identity(),source(rows.reverse()),now)).rows.map(r=>r.nickname),expected);
 const a=row(1,"가"),b=row(2,"가");assert.equal(compareBestRows(a,b),-1);assert.equal(compareBestRows(b,a),1);
});
test("progress then deaths then current nickname then stable playerId; time is irrelevant",async()=>{
 const a=row(1,"가",101,0),b=row(2,"하",200,999),c=row(3,"나",101,1),d=row(4,"나",101,0);
 a.updatedAt="2020-01-01T00:00:00.000Z";d.updatedAt="2099-01-01T00:00:00.000Z";
 assert.deepEqual((await getLeaderboard(identity(),source([c,d,a,b]),now)).rows.map(r=>r.nickname),["하","가","나","나"]);
 assert.equal(compareBestRows(row(5),row(6)),-1);assert.equal(compareBestRows(row(6),row(5)),1);
 d.displayName="가가";assert.deepEqual((await getLeaderboard(identity(),source([d,a]),now)).rows.map(r=>r.nickname),["가","가가"]);
});
test("unknown best schema and inconsistent rank fail instead of silently dropping rows",async()=>{
 for(const change of [r=>r.schemaVersion=2,r=>r.record.progressRank=599,r=>r.record=null]){
  const r=row(1);change(r);await assert.rejects(getLeaderboard(identity(),source([row(2),r]),now),e=>e.status===503);
 }
});
test("mid-scan failure never returns partial TOP10 and persistent 429 retains retry metadata",async()=>{
 let scans=0;
 const repo={async *scanBest(){scans++;yield row(1);throw new ApiError(429,"THROTTLED","retry",1);}};
 await assert.rejects(getLeaderboard(identity(),repo,now),e=>e.status===429&&e.retryAfterMs===1);assert.equal(scans,3);
 const failure={async *scanBest(){yield row(1);throw new ApiError(503,"UNAVAILABLE","timeout");}};
 await assert.rejects(getLeaderboard(identity(),failure,now),e=>e.status===503);
});
test("429 retry discards earlier partial candidates and completes a fresh scan",async()=>{
 let scans=0;const repo={async *scanBest(){scans++;if(scans===1){yield row(1,"이전이름");throw new ApiError(429,"THROTTLED","retry",1);}yield row(1,"새이름");}};
 const result=await getLeaderboard(identity(),repo,now);assert.deepEqual(result.rows.map(r=>r.nickname),["새이름"]);assert.equal(scans,2);
});
test("retry exceeding whole-request deadline returns 503 without sleeping or partial success",async()=>{
 const repo={async *scanBest(){yield row(1);throw new ApiError(429,"THROTTLED","retry",31000);}};
 await assert.rejects(getLeaderboard(identity(),repo,now),e=>e.status===503);
});
test("adapter pages all projected eligible prod records; test user still sees prod leaderboard",async()=>{
 const records=Array.from({length:210},(_,i)=>row(i,"코기"+i)),hidden={...row(1000,"테스트"),namespace:"test",eligible:false};
 let spec,options,pages=0;
 const container={items:{query(query,opts){spec=query;options=opts;let index=0;const filtered=[...records,hidden].filter(r=>r.namespace===query.parameters.find(p=>p.name==="@namespace").value&&r.eligible&&r.record);
  return {hasMoreResults:()=>index<filtered.length,fetchNext:async()=>{pages++;const resources=filtered.slice(index,index+100);index+=100;return{resources,requestCharge:2};}};
 }}};
 const r=await getLeaderboard(identity(undefined,"test"),new CosmosGameRepository(container),now);
 assert.equal(pages,3);assert.equal(options.maxItemCount,100);assert.equal(r.rows.length,10);assert.ok(!r.rows.some(r=>r.nickname==="테스트"));
 assert.ok(!spec.query.includes("SELECT *"));assert.ok(!spec.query.includes("TOP "));assert.ok(!spec.query.includes("progress"));
});
test("authenticated handler uses fixed ordering and no-store; missing/foreign auth denied before query",async()=>{
 let scans=0;const repo={async *scanBest(){scans++;yield row(1);}};
 const service=createGameService(repo,now),request={method:"GET",url:"https://example.test/api/game/leaderboard?limit=100&namespace=test",headers:new Headers()};
 const ok=await createGameHandlers(async()=>identity(),service).leaderboard(request,{});assert.equal(ok.status,200);assert.equal(ok.headers["Cache-Control"],"no-store");
 for(const status of [401,403]){const r=await createGameHandlers(async()=>{throw new ApiError(status,status===401?"UNAUTHENTICATED":"FORBIDDEN","denied");},service).leaderboard(request,{});assert.equal(r.status,status);}
 assert.equal(scans,1);
});
