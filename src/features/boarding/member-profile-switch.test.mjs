import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock, test } from "node:test";
import { NextRequest } from "next/server.js";
import { hashInviteToken } from "./server/invite.ts";
import { signSwitchIntent, verifySwitchIntent, SWITCH_COOKIE_NAME } from "./server/switch-intent.ts";

process.env.SUPABASE_SECRET_KEY = "synthetic-test-signing-key-never-used-remotely";
const id = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const trip = {id:id(1),slug:"jeonga-fukuoka-2026",title:"QA",destination:"후쿠오카",start_date:"2026-09-11",end_date:"2026-09-13",invite_token_hash:hashInviteToken("synthetic-invite")};
const a=id(10), b=id(11), fresh=id(12), ma=id(20), mb=id(21), stamp="2026-09-10T00:00:00Z";
let rows, events, rpcError, currentAuth;
function reset(claimed=true) {
  rows={trips:[trip],family_members:[{id:ma,trip_id:trip.id,name:"류정원",display_role:"QA 가족",boarded_at:stamp},{id:mb,trip_id:trip.id,name:"주인공",display_role:"QA 가족",boarded_at:claimed?stamp:null}],trip_memberships:[{id:id(30),trip_id:trip.id,auth_user_id:a,family_member_id:ma},...(claimed?[{id:id(31),trip_id:trip.id,auth_user_id:b,family_member_id:mb}]:[])]};
  events=[];rpcError=false;currentAuth=a;
}
const db={auth:{getSession:async()=>({data:{session:{user:{id:currentAuth},access_token:currentAuth}},error:null})},from(table){
  let filters=[], action="select", value;
  const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},not(){return q;},is(k,v){filters.push([k,v]);return q;},insert(v){action="insert";value=v;return q;},update(v){action="update";value=v;return q;},maybeSingle(){return run();},single(){return run();},then(resolve,reject){return run().then(resolve,reject);}};
  async function run(){
    const selected=rows[table].filter(row=>filters.every(([k,v])=> k.includes(".") ? true : row[k]===v));
    if(action==="insert"){
      events.push("insert");
      if(rows[table].some(r=>r.trip_id===value.trip_id&&(r.auth_user_id===value.auth_user_id||r.family_member_id===value.family_member_id)))return{data:null,error:{code:"23505"}};
      rows[table].push({id:id(40),...value});return{data:null,error:null};
    }
    if(action==="update"){events.push("update");selected.forEach(row=>Object.assign(row,value));}
    let row=selected[0]??null;
    if(row&&table==="trip_memberships")row={...row,family_members:rows.family_members.find(m=>m.id===row.family_member_id),trips:trip};
    return{data:row,error:null};
  }
  return q;
},async rpc(name,args){
  events.push("rpc");assert.equal(name,"transfer_trip_membership_for_switch");
  if(rpcError)return{error:{message:"synthetic rollback"},data:null};
  const current=rows.trip_memberships.find(r=>r.auth_user_id===args.p_auth_user_id&&r.trip_id===args.p_trip_id);
  const target=rows.family_members.find(r=>r.id===args.p_target_member_id&&r.trip_id===args.p_trip_id);
  if(!current||!target)return{error:{message:"invalid membership"},data:null};
  if(current.family_member_id===target.id)return{data:{status:"already_target",boarded_at:target.boarded_at},error:null};
  if(current.id!==args.p_expected_membership_id)return{error:{message:"stale membership"},data:null};
  rows.trip_memberships=rows.trip_memberships.filter(r=>r.id!==current.id&&r.family_member_id!==target.id);
  rows.trip_memberships.push({id:id(41),trip_id:trip.id,auth_user_id:args.p_auth_user_id,family_member_id:target.id});
  rows.family_members.find(r=>r.id===current.family_member_id).boarded_at=null;
  target.boarded_at??=stamp;
  return{data:{status:"transferred",boarded_at:target.boarded_at},error:null};
}};
await mock.module(new URL("../../lib/supabase/admin.ts",import.meta.url).href,{exports:{createSupabaseAdminClient:()=>db}});
await mock.module(new URL("../../lib/supabase/client.ts",import.meta.url).href,{exports:{getSupabaseBrowserClient:()=>db}});
await mock.module(new URL("../../lib/supabase/server.ts",import.meta.url).href,{exports:{createSupabaseServerClient:()=>({auth:{getUser:async token=>({data:{user:{id:token,is_anonymous:true}},error:null})}})}});
const switching=await import("../../app/api/member-switch/route.ts");
const {POST:preview}=await import("../../app/api/member-preview/route.ts");
const {POST:claim}=await import("../../app/api/claim-member/route.ts");
const {getCurrentTripSession}=await import("./current-trip-session.ts");
function request(path,method="POST",body,token,auth=a,invite=true){
  return new NextRequest(`http://localhost/api/${path}`,{method,headers:{...(auth?{Authorization:`Bearer ${auth}`} : {}),"Content-Type":"application/json",Cookie:[invite?"jeonga_trip_invite=synthetic-invite":"",token!==undefined?`${SWITCH_COOKIE_NAME}=${token}`:""].filter(Boolean).join("; ")},...(body?{body:JSON.stringify(body)}:{})});
}
const token=()=>signSwitchIntent({authUserId:a,tripId:trip.id,membershipId:id(30)});
const target=()=>({memberId:mb});

test("signed intent binds auth/trip/membership, expires at 5 minutes, rejects tampering",()=>{
  const now=1000000, identity={authUserId:a,tripId:trip.id,membershipId:id(30)}, signed=signSwitchIntent(identity,now);
  assert.deepEqual(verifySwitchIntent(signed,a,trip.id,now),{...identity,expiresAt:now+300000});
  for(const invalid of [signed+"x",signed.replace(/^./,"!"),"bad",".","x".repeat(2049)])assert.equal(verifySwitchIntent(invalid,a,trip.id,now),null);
  assert.equal(verifySwitchIntent(signed,b,trip.id,now),null);
  assert.equal(verifySwitchIntent(signed,a,id(2),now),null);
  assert.equal(verifySwitchIntent(signed,a,trip.id,now+300000),null);
});
test("Home authorization retains membership; GET validates; DELETE cancels",async()=>{
  reset();const before=structuredClone(rows);
  const response=await switching.POST(request("member-switch"));
  assert.equal(response.status,200);assert.equal((await response.json()).status,"switch_ready");
  const cookie=response.cookies.get(SWITCH_COOKIE_NAME).value;
  assert.match(response.headers.get("set-cookie"),/HttpOnly/i);assert.match(response.headers.get("set-cookie"),/SameSite=lax/i);assert.match(response.headers.get("set-cookie"),/Max-Age=300/);assert.match(response.headers.get("set-cookie"),/Path=\//);
  assert.deepEqual(rows,before);assert.deepEqual(events,[]);
  assert.equal((await(await switching.GET(request("member-switch","GET",null,cookie))).json()).active,true);
  const cancelled=await switching.DELETE(request("member-switch","DELETE",null,cookie));assert.match(cancelled.headers.get("set-cookie"),/Max-Age=0/);assert.deepEqual(rows,before);
  assert.equal((await switching.POST(request("member-switch","POST",null,undefined,fresh))).status,409);
});
test("ordinary fresh claim/preview conflict remains; client switch flag cannot grant takeover",async()=>{
  reset();const before=structuredClone(rows);
  const response=await claim(request("claim-member","POST",{...target(),switchMode:true},undefined,fresh));
  assert.equal(response.status,409);assert.equal((await response.json()).code,"MEMBER_ALREADY_CLAIMED");
  assert.equal((await preview(request("member-preview","POST",{name:"주인공"},undefined,fresh))).status,409);
  assert.equal((await claim(request("claim-member","POST",target()))).status,409);
  assert.deepEqual(rows,before);assert.deepEqual(events,[]);
});
for(const claimed of [false,true])test(`explicit preview is read-only; final transfer succeeds (claimed=${claimed})`,async()=>{
  reset(claimed);const signed=token(),before=structuredClone(rows);
  const response=await preview(request("member-preview","POST",{name:"주인공"},signed));
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.claimedElsewhere,claimed);assert.equal("auth_user_id" in body,false);assert.deepEqual(rows,before);assert.deepEqual(events,[]);
  const confirmed=await claim(request("claim-member","POST",target(),signed));assert.equal(confirmed.status,200);assert.equal((await confirmed.json()).member.id,mb);assert.match(confirmed.headers.get("set-cookie"),/Max-Age=0/);assert.deepEqual(events,["rpc"]);
  assert.equal(rows.trip_memberships.length,1);assert.equal(rows.family_members[0].boarded_at,null);assert.equal(rows.family_members[1].boarded_at,stamp);
  currentAuth=b;assert.equal(await getCurrentTripSession(),null);currentAuth=a;assert.equal((await getCurrentTripSession()).member.id,mb);
  const after=structuredClone(rows);assert.equal((await claim(request("claim-member","POST",target(),signed))).status,200);assert.deepEqual(rows,after);
});
test("RPC failure preserves intent, both memberships, boarded state and retry access",async()=>{
  reset();rpcError=true;const before=structuredClone(rows),signed=token();
  const response=await claim(request("claim-member","POST",target(),signed));assert.equal(response.status,500);assert.equal(response.headers.has("set-cookie"),false);assert.deepEqual(rows,before);assert.equal((await getCurrentTripSession()).member.id,ma);assert.deepEqual(events,["rpc"]);
  rpcError=false;assert.equal((await claim(request("claim-member","POST",target(),signed))).status,200);
});
test("expired/tampered intent is cleared, stale membership cannot preview/take over",async()=>{
  reset();const before=structuredClone(rows);
  for(const signed of [token()+"x",signSwitchIntent({authUserId:a,tripId:trip.id,membershipId:id(30)},Date.now()-300001)]){
    for(const route of [claim,preview]){const response=await route(request("test","POST",{name:"주인공",...target()},signed));assert.equal(response.status,409);assert.match(response.headers.get("set-cookie"),/Max-Age=0/);}
    assert.equal((await(await switching.GET(request("member-switch","GET",null,signed))).json()).active,false);
  }
  assert.deepEqual(rows,before);assert.deepEqual(events,[]);
  rows.trip_memberships=rows.trip_memberships.filter(r=>r.auth_user_id!==a);
  assert.equal((await preview(request("member-preview","POST",{name:"주인공"},token()))).status,409);
  assert.equal((await claim(request("claim-member","POST",target(),token()))).status,500);
});
test("same current target is idempotent; cross-trip target/auth and missing invite are rejected",async()=>{
  reset();const before=structuredClone(rows);
  assert.equal((await claim(request("claim-member","POST",{memberId:ma},token()))).status,200);assert.deepEqual(rows,before);
  assert.equal((await claim(request("claim-member","POST",{memberId:id(99)},token()))).status,404);
  for(const route of [switching.POST,preview,claim]){
    assert.equal((await route(request("test","POST",{name:"주인공",...target()},token(),a,false))).status,403);
    assert.equal((await route(request("test","POST",{name:"주인공",...target()},token(),null))).status,401);
  }
});
test("migration 16 is service-role only, transactionally scoped, immutable authorship",async()=>{
  const sql=await readFile(new URL("../../../docs/data/16_MEMBER_PROFILE_TRANSFER_MIGRATION.sql",import.meta.url),"utf8");
  assert.match(sql,/security definer\nset search_path = ''/);assert.match(sql,/from public, anon, authenticated;/);assert.match(sql,/grant execute[\s\S]*to service_role;/);
  assert.equal((sql.match(/grant execute/g)||[]).length,1);assert.match(sql,/fm.id = p_target_member_id and fm.trip_id = p_trip_id\n  for update/);
  assert.match(sql,/current_membership_id <> p_expected_membership_id/);assert.match(sql,/set boarded_at = null/);assert.match(sql,/coalesce\(boarded_at, now\(\)\)/);
  assert.doesNotMatch(sql,/public\.(photos|memory_cards)|auth\.users|alter table|create policy/);
});
test("Landing invite/forward and switch entry; Boarding retains pending on failure and locks submit",async()=>{
  const source=await readFile(new URL("./landing-entry.tsx",import.meta.url),"utf8");
  assert.match(source,/if \(invalidInvite\) return;/);assert.match(source,/if \(!switching.active\)[\s\S]*router.replace\("\/home"\)/);assert.match(source,/setSwitchExpiresAt\(switching.expiresAt\)/);
  assert.match(source,/getMemberSwitchState\("DELETE"\)/);assert.doesNotMatch(source,/localStorage|sessionStorage/);
  const boarding=await readFile(new URL("./boarding-flow.tsx",import.meta.url),"utf8");
  assert.match(boarding,/claimPendingRef.current\) return;[\s\S]*claimPendingRef.current = true/);assert.equal((boarding.match(/fetch\("\/api\/claim-member"/g)||[]).length,1);
  assert.match(boarding,/if \(!response.ok \|\| !isCurrentTripSession\(body\)\)[\s\S]*setError\(message\);\s*return;\s*}\s*clearPendingMember\(\)/);
  assert.match(boarding,/다른 기기에서 사용 중/);
});
