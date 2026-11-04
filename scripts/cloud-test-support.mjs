import { randomUUID } from "node:crypto";
import { accountFromDocuments, parseDocument } from "../api/src/documents.ts";
import { ApiError, RepositoryConflict } from "../api/src/errors.ts";
import { bootstrapAccount } from "../api/src/services/account.ts";
import { acquireSession } from "../api/src/services/session.ts";
export const tenantId="11111111-1111-4111-8111-111111111111";
export const identity=(oid="44444444-4444-4444-8444-444444444444",namespace="prod")=>({tenantId,objectId:oid,namespace,playerId:namespace+":"+tenantId+":"+oid});
export function fakeClock(){
 let time=Date.parse("2026-11-04T00:00:00.000Z");
 const now=()=>new Date(time);now.advance=ms=>{time+=ms;};return now;
}
export class InMemoryGameRepository {
 docs=new Map();counter=0;commitCalls=0;beforeCommit=null;failRead=null;failCommit=null;failOperation=-1;
 key(playerId,id){return playerId+"/"+id;}
 async readAccount(id){
  if(this.failRead)throw this.failRead;
  const found=["profile","current","best","session"].map(k=>this.docs.get(this.key(id.playerId,k))).filter(Boolean);
  if(!found.length)return null;
  if(found.length!==4)throw new ApiError(503,"UNSUPPORTED_SAVE","partial account");
  return accountFromDocuments(found.map(v=>({value:parseDocument(structuredClone(v.value),id.playerId),etag:v.etag})));
 }
 async readReceipt(playerId,requestId){const r=this.docs.get(this.key(playerId,"receipt:"+requestId));return r?parseDocument(structuredClone(r.value),playerId):null;}
 async commit(playerId,operations){
  this.commitCalls++;
  if(this.beforeCommit){const hook=this.beforeCommit;this.beforeCommit=null;await hook(playerId,operations,this);}
  if(this.failCommit){const err=this.failCommit;this.failCommit=null;throw err;}
  const next=new Map(this.docs);
  for(const [i,op] of operations.entries()){
   if(i===this.failOperation){this.failOperation=-1;throw new RepositoryConflict();}
   if(op.doc.playerId!==playerId)throw new ApiError(403,"FORBIDDEN","wrong owner");
   const key=this.key(playerId,op.doc.id),old=next.get(key);
   if(op.type==="create"?Boolean(old):!old||old.etag!==op.etag)throw new RepositoryConflict();
   next.set(key,{value:parseDocument(structuredClone(op.doc),playerId),etag:String(++this.counter)});
  }
  this.docs=next;
 }
 async *scanBest(namespace,deadline){
  for(const item of this.docs.values()){
   if(Date.now()>deadline)throw new ApiError(503,"UNAVAILABLE","deadline");
   if(item.value.kind==="best"&&item.value.namespace===namespace&&item.value.eligible)yield structuredClone(item.value);
  }
 }
 snapshot(){return structuredClone([...this.docs.entries()]);}
}
export async function activeAccount(repo=new InMemoryGameRepository(),id=identity(),now=fakeClock()){
 await bootstrapAccount(id,repo,now);
 const sessionId=randomUUID();
 const bootstrap=await acquireSession(id,{requestId:randomUUID(),sessionId,takeover:false},repo,now);
 return {repo,id,now,sessionId,bootstrap,lease:{sessionId,generation:bootstrap.lease.generation}};
}

