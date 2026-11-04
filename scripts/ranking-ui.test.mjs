import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h, useState } from "react";
import { installDom } from "./cloud-dom-support.mjs";
import { LeaderboardDialog } from "../src/components/game/LeaderboardDialog.tsx";
import { Hud } from "../src/components/game/Hud.tsx";
import { ApiClientError } from "../src/game/persistence/cloud/GameApiClient.ts";
import { GameEventBus } from "../src/game/bridge/GameEventBus.ts";
import { canOpenSharedMenu } from "../src/game/systems/gameMenuAvailability.ts";
import { createDefaultProgressState, createRuntimeStageState } from "../src/game/core/constants.ts";
import { MILESTONES } from "../src/game/cloud/progression.ts";
const dom=installDom(),{render,screen,act,cleanup,within}=await import("@testing-library/react");
const userEvent=(await import("@testing-library/user-event")).default;
test.afterEach(()=>cleanup());test.after(()=>dom.window.close());
const rows=(count,nickname="가나다라마바사아자차카타파하가나다라마바")=>Array.from({length:count},(_,i)=>({rank:i+1,nickname,deaths:i,location:MILESTONES.at(-1).label}));
const response=(data=[])=>({rows:data,generatedAt:"2026-11-04T00:00:00.000Z"});
function Harness({load,bus=new GameEventBus()}) {
 const [open,setOpen]=useState(false);
 return h("div",null,h("div",{inert:open},h("button",{className:"leaderboard-open-button",onClick(){bus.pauseReasons.set("leaderboard",true);setOpen(true);}},"랭킹")),
  open&&h(LeaderboardDialog,{load,onClose(){bus.pauseReasons.set("leaderboard",false);setOpen(false);}}));
}
test("loading and empty are distinct, and focus starts on close",async()=>{
 let resolve;render(h(LeaderboardDialog,{load:()=>new Promise(r=>{resolve=r;}),onClose(){}}));
 assert.ok(screen.getByText("랭킹을 불러오는 중…"));assert.equal(document.activeElement,screen.getByRole("button",{name:"랭킹 닫기"}));
 await act(async()=>resolve(response()));assert.ok(screen.getByText("아직 등록된 기록이 없어요."));assert.equal(screen.queryByRole("table"),null);
});
test("one and ten rows keep server order with only the four public columns and duplicate nicknames",async()=>{
 for(const count of [1,10]){
  const data=rows(count);render(h(LeaderboardDialog,{load:async()=>response(data),onClose(){}}));const table=await screen.findByRole("table");
  assert.deepEqual(within(table).getAllByRole("columnheader").map(el=>el.textContent),["순위","닉네임","데스 수","클리어 위치"]);
  assert.equal(within(table).getAllByRole("row").length,count+1);assert.equal(within(table).getAllByRole("rowheader").length,count);
  assert.deepEqual([...table.querySelectorAll("tbody tr")].map(tr=>tr.cells[0].textContent),data.map(row=>String(row.rank)));
  assert.equal(table.querySelectorAll("td").length,count*3);cleanup();
 }
});
test("HTML-like nickname is text, not markup; an eleven-row or private-field response is rejected",async()=>{
 render(h(LeaderboardDialog,{load:async()=>response(rows(1,"<b>코기</b>")),onClose(){}}));const text=await screen.findByText("<b>코기</b>");assert.equal(text.querySelector("b"),null);cleanup();
 for(const data of [rows(11),[{...rows(1)[0],email:"private@example.test"}]]){
  render(h(LeaderboardDialog,{load:async()=>response(data),onClose(){}}));await screen.findByRole("alert");assert.equal(screen.queryByRole("table"),null);assert.equal(screen.queryByText("아직 등록된 기록이 없어요."),null);assert.equal(document.body.textContent.includes("private@example.test"),false);cleanup();
 }
});
test("403/429/503 have safe error messages; retry creates one current request and succeeds",async()=>{
 for(const [status,code,label] of [[403,"FORBIDDEN","권한"],[429,"THROTTLED","요청이 많"],[503,"UNAVAILABLE","불러오지 못"]]){
  let calls=0,resolve;const load=async()=>{calls++;if(calls===1)throw new ApiClientError(status,code,"SECRET_STACK");return new Promise(r=>{resolve=r;});};
  render(h(LeaderboardDialog,{load,onClose(){}}));assert.ok((await screen.findByRole("alert")).textContent.includes(label));assert.equal(document.body.textContent.includes("SECRET_STACK"),false);
  await act(async()=>screen.getByRole("button",{name:"다시 시도"}).click());assert.equal(calls,2);assert.equal(screen.queryByRole("button",{name:"다시 시도"}),null);
  await act(async()=>resolve(response(rows(1))));assert.ok(screen.getByRole("table"));cleanup();
 }
});
test("Escape closes, aborts, restores ranking button focus and leaves save-error/manual reasons",async()=>{
 const bus=new GameEventBus(),signals=[];let resolve;
 render(h(Harness,{bus,load:signal=>{signals.push(signal);return new Promise(r=>{resolve=r;});}}));
 const user=userEvent.setup();await user.click(screen.getByRole("button",{name:"랭킹",exact:true}));const dialog=screen.getByRole("dialog");assert.equal(dialog.closest("[inert]"),null);
 assert.ok(screen.getByRole("button",{name:"랭킹",exact:true}).closest("[inert]"));bus.pauseReasons.set("save-error",true);bus.pauseReasons.set("manual",true);
 await user.keyboard("{Escape}");assert.equal(signals[0].aborted,true);assert.equal(screen.queryByRole("dialog"),null);assert.equal(document.activeElement.textContent,"랭킹");
 assert.ok(bus.pauseReasons.has("save-error"));assert.ok(bus.pauseReasons.has("manual"));assert.equal(bus.pauseReasons.has("leaderboard"),false);
 await act(async()=>resolve(response(rows(1))));assert.equal(screen.queryByRole("table"),null);
});
test("focus cycles over close/retry and each reopen fetches fresh data",async()=>{
 let calls=0;render(h(Harness,{load:async()=>{calls++;if(calls===1)throw new Error("offline");return response(rows(1,"새 기록"));}}));const user=userEvent.setup();
 await user.click(screen.getByRole("button",{name:"랭킹",exact:true}));await screen.findByRole("alert");const close=screen.getByRole("button",{name:"랭킹 닫기"}),retry=screen.getByRole("button",{name:"다시 시도"});
 assert.equal(document.activeElement,close);await user.tab({shift:true});assert.equal(document.activeElement,retry);await user.tab();assert.equal(document.activeElement,close);
 await user.click(close);await user.click(screen.getByRole("button",{name:"랭킹",exact:true}));await screen.findByText("새 기록");assert.equal(calls,2);
});
test("actual HUD disables local-dev ranking without invoking API callback; shared menus exclude ranking",async()=>{
 let calls=0;const props={stageTitle:"모험",runtime:createRuntimeStageState("world-01-stage-1"),progress:createDefaultProgressState(),cooldowns:{},statusOpen:false,paused:false,worldSelectUnlocked:true,
 onToggleStatus(){},onTogglePause(){},onResetProgress(){},onOpenWorldSelect(){},onOpenShop(){},onOpenCatalog(){},onOpenPaint(){},onOpenLeaderboard(){calls++;},leaderboardEnabled:false};
 const view=render(h(Hud,props));const button=screen.getByRole("button",{name:"랭킹 (개발 모드)"});assert.equal(button.disabled,true);await userEvent.setup().click(button);assert.equal(calls,0);
 view.rerender(h(Hud,{...props,leaderboardEnabled:true}));await userEvent.setup().click(screen.getByRole("button",{name:"랭킹",exact:true}));assert.equal(calls,1);
 const state={stageId:"world-01-stage-1",mode:"play",introReady:true,paused:false,shopOpen:false,catalogOpen:false,paintOpen:false,worldSelectOpen:false,resetProgressDialogOpen:false,leaderboardOpen:false};
 assert.equal(canOpenSharedMenu(state),true);assert.equal(canOpenSharedMenu({...state,leaderboardOpen:true}),false);
});
