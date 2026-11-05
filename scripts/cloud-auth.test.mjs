import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h, StrictMode } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { AuthController } from "../src/auth/AuthController.ts";
import { AuthProvider } from "../src/auth/AuthProvider.tsx";
import { LoginGate } from "../src/components/game/LoginGate.tsx";
import { createMsalClientLoader, loadAuthConfig, gameMode } from "../src/auth/msal.ts";
import { GameApiClient } from "../src/game/persistence/cloud/GameApiClient.ts";
import { GAME_AUTH_HEADER } from "../src/game/cloud/contracts.ts";
import { activeAccount } from "./cloud-test-support.mjs";
import { installDom } from "./cloud-dom-support.mjs";
const dom=installDom();
const {render,screen,waitFor,cleanup,act}=await import("@testing-library/react");
const userEvent=(await import("@testing-library/user-event")).default;
test.after(()=>dom.window.close());test.afterEach(()=>cleanup());
const config={tenantId:"11111111-1111-4111-8111-111111111111",webClientId:"22222222-2222-4222-8222-222222222222",apiClientId:"33333333-3333-4333-8333-333333333333",redirectUri:"http://localhost:3000/"};
const account={homeAccountId:"home-account",tenantId:config.tenantId};
function fakeClient(accounts=[account]) {
 let active=null;
 const calls={initialize:0,redirect:0,login:[],token:[],logout:[]};
 return {calls,initialize:async()=>{calls.initialize++;},handleRedirectPromise:async()=>{calls.redirect++;return null;},
 getAllAccounts:()=>accounts,getActiveAccount:()=>active,setActiveAccount:a=>{active=a;},
 loginRedirect:async r=>{calls.login.push(r);},logoutRedirect:async r=>{calls.logout.push(r);},
 acquireTokenSilent:async r=>{calls.token.push(r);return{accessToken:"ACCESS",idToken:"ID-DO-NOT-SEND"};}};
}
const controllerFor=client=>new AuthController(()=>config,createMsalClientLoader(()=>client));
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json",...headers}});
test("public config fails closed for missing IDs, placeholders, wrong origin or unsafe redirects",()=>{
 const valid={tenant:config.tenantId,web:config.webClientId,api:config.apiClientId,redirect:config.redirectUri};
 assert.deepEqual(loadAuthConfig(valid),config);
 for(const update of [{tenant:""},{web:"YOUR-ID"},{api:"00000000-0000-0000-0000-000000000000"},{redirect:"http://other.test/"},{redirect:"https://example.test/"},{redirect:"http://localhost:3000/?token=x"}])assert.throws(()=>loadAuthConfig({...valid,...update}));
 assert.equal(gameMode("local-dev","production"),"cloud");assert.equal(gameMode("local-dev","development"),"local-dev");assert.equal(gameMode(undefined,"development"),"cloud");
});
test("Strict Mode creates one initialization/redirect flow and only signed-in children mount",async()=>{
 const client=fakeClient(),controller=controllerFor(client);
 render(h(StrictMode,null,h(AuthProvider,{controller},h(LoginGate,null,h("p",null,"모험 준비")))));
 await screen.findByText("모험 준비");assert.equal(client.calls.initialize,1);assert.equal(client.calls.redirect,1);
});
test("multiple accounts or wrong tenant requires explicit account selection",async()=>{
 for(const accounts of [[account,{...account,homeAccountId:"other"}],[{...account,tenantId:config.apiClientId}]]){
  const client=fakeClient(accounts),controller=controllerFor(client);await controller.initialize();assert.equal(controller.getSnapshot().status,"signed-out");assert.equal(client.getActiveAccount(),null);
 }
});
test("cancelled login offers keyboard retry and overlapping sign-ins do not duplicate redirect",async()=>{
 const client=fakeClient([]);client.loginRedirect=async r=>{client.calls.login.push(r);throw new Error("cancel");};const controller=controllerFor(client);
 render(h(AuthProvider,{controller},h(LoginGate,null,h("p",null,"게임"))));
 const button=await screen.findByRole("button",{name:"Microsoft 계정으로 로그인"});button.focus();await userEvent.setup().keyboard("{Enter}");
 await screen.findByRole("alert");assert.equal(client.calls.login.length,1);assert.equal(screen.queryByText("게임"),null);
 await act(()=>Promise.all([controller.signIn(),controller.signIn()]));assert.equal(client.calls.login.length,2);assert.equal(client.calls.login[0].prompt,"select_account");
});
test("silent token uses delegated scope and access token; interactive expiry pauses for explicit re-login",async()=>{
 const client=fakeClient(),controller=controllerFor(client);await controller.initialize();assert.equal(await controller.getAccessToken(),"ACCESS");
 assert.deepEqual(client.calls.token[0].scopes,["api://"+config.apiClientId+"/access_as_user"]);
 assert.equal(client.calls.token[0].redirectUri,"http://localhost:3000/auth/redirect/");
 client.acquireTokenSilent=async()=>{throw new InteractionRequiredAuthError("interaction_required");};
 await assert.rejects(controller.getAccessToken());assert.equal(controller.getSnapshot().status,"reauth-required");assert.equal(client.calls.login.length,0);
});
test("logout invalidates in-flight token responses and clears active account",async()=>{
 const client=fakeClient(),controller=controllerFor(client);await controller.initialize();let resolve;
 client.acquireTokenSilent=()=>new Promise(r=>{resolve=r;});const pending=controller.getAccessToken();await controller.signOut();resolve({accessToken:"late"});
 await assert.rejects(pending,e=>e.name==="AbortError");assert.equal(controller.getSnapshot().accountKey,null);assert.equal(client.getActiveAccount(),null);assert.equal(client.calls.logout.length,1);
});
test("configuration error renders retry instead of guest gameplay",async()=>{
 const controller=new AuthController(()=>{throw new Error("secret should not be shown");});render(h(AuthProvider,{controller},h(LoginGate,null,h("p",null,"게임"))));
 await screen.findByRole("alert");assert.equal(screen.queryByText("게임"),null);assert.ok(!screen.getByRole("alert").textContent.includes("secret"));
 await waitFor(()=>assert.ok(screen.getByRole("button")));
});
test("API retries 401 once with forced silent refresh and sends Bearer access token only",async()=>{
 const {bootstrap}=await activeAccount(),tokens=[],requests=[];
 const api=new GameApiClient(async force=>{tokens.push(force);return force?"REFRESH":"ACCESS";},async(url,init)=>{requests.push({url,init});return requests.length===1?json({error:{code:"UNAUTHENTICATED"}},401):json(bootstrap);});
 assert.deepEqual(await api.bootstrap(),bootstrap);assert.deepEqual(tokens,[false,true]);assert.equal(requests[0].url,"/api/game/bootstrap");
 assert.equal(requests[0].init.headers[GAME_AUTH_HEADER],"Bearer ACCESS");assert.equal(requests[1].init.headers[GAME_AUTH_HEADER],"Bearer REFRESH");
 assert.equal(requests[0].init.headers.Authorization,undefined);
 assert.equal(requests[0].init.cache,"no-store");
});
test("second 401 requests reauthentication; 403 and other errors never retry login",async()=>{
 let calls=0,reauth=0;const api=new GameApiClient(async()=>"token",async()=>{calls++;return new Response("unauthorized",{status:401});},()=>{reauth++;});
 await assert.rejects(api.bootstrap(),e=>e.status===401);assert.equal(calls,2);assert.equal(reauth,1);
 for(const [status,code] of [[403,"FORBIDDEN"],[409,"SESSION_LOST"],[429,"THROTTLED"],[503,"UNAVAILABLE"]]){
  let count=0;const client=new GameApiClient(async()=>"token",async()=>{count++;return json({error:{code,message:"try",retryAfterMs:1234}},status);});
  await assert.rejects(client.bootstrap(),e=>e.status===status&&e.code===code&&e.retryAfterMs===1234);assert.equal(count,1);
 }
});
test("invalid server data never becomes defaults; abort suppresses late results and fetch dispatch",async()=>{
 const invalid=new GameApiClient(async()=>"token",async()=>json({}));await assert.rejects(invalid.bootstrap(),e=>e.code==="UNSUPPORTED_SAVE");
 let resolve,calls=0;const ac=new AbortController(),api=new GameApiClient(()=>new Promise(r=>{resolve=r;}),async()=>{calls++;return json({});});
 const pending=api.bootstrap(ac.signal);ac.abort();resolve("late");await assert.rejects(pending,e=>e.name==="AbortError");assert.equal(calls,0);
 const ac2=new AbortController(),late=new GameApiClient(async()=>"token",async()=>{ac2.abort();return json({});});
 await assert.rejects(late.bootstrap(ac2.signal),e=>e.name==="AbortError");
});
test("API methods serialize mutation metadata and validate lease/reset/ranking responses",async()=>{
 const {bootstrap}=await activeAccount(),paths=[],input={requestId:"request"},ack={requestId:crypto.randomUUID(),runId:bootstrap.current.runId,version:2,sequence:1,best:null,committedAt:bootstrap.serverTime};
 const api=new GameApiClient(async()=>"token",async(path,init)=>{paths.push(path);if(init.method==="POST")assert.deepEqual(JSON.parse(init.body),input);
  return path.endsWith("release")?new Response(null,{status:204}):json(path.endsWith("acquire")?bootstrap:path.endsWith("heartbeat")?bootstrap.lease:path.endsWith("leaderboard")?{rows:[],generatedAt:bootstrap.serverTime}:ack);
 });
 await api.acquire(input);await api.heartbeat(input);await api.release(input);await api.save(input);await api.reset(input);assert.deepEqual((await api.leaderboard()).rows,[]);assert.equal(paths.length,6);
});
