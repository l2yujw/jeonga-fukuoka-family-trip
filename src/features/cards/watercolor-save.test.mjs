import assert from 'node:assert/strict';
import {mock,test} from 'node:test';
import {getWatercolorTemplate} from './watercolor-template-spec.ts';
import {createWatercolorDraft,projectWatercolorLayout} from './watercolor-layout.ts';
const authId='33333333-3333-4333-8333-333333333333';
const originalSession={trip:{id:'11111111-1111-4111-8111-111111111111',title:'가족',startDate:'2026-09-11',endDate:'2026-09-13'},member:{id:'22222222-2222-4222-8222-222222222222',name:'테스트'}};
const photoId='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const t=getWatercolorTemplate('one_moment');
const args=()=>({availablePhotoIds:[photoId],layout:projectWatercolorLayout(t,[{slotId:'om1',photoId,placement:{zoom:1,rotation:0,offsetX:0,offsetY:0}}],createWatercolorDraft(t,originalSession.trip)),templateKey:t.key,resultPng:new Blob(['PNG-snapshot'],{type:'image/png'}),tripSession:structuredClone(originalSession),expectedAuthUserId:authId});
let mode,events,row,currentSession,authHook;
function reset(next){mode=next;events=[];row=null;currentSession=structuredClone(originalSession);authHook=null;}
const storage={
 async upload(path,blob,options){events.push(['upload',path,await blob.text(),options]);if(mode==='upload-reject')return{error:{statusCode:'413',message:'too large'}};if(mode==='upload-lost')throw new TypeError('network lost');if(mode==='member-change')currentSession.member.id='changed';return{error:null};},
 async remove(paths){events.push(['remove',paths]);return{error:null};},
 async createSignedUrls(paths){events.push(['sign']);return{data:paths.map(path=>({path,signedUrl:'signed-result',error:null})),error:null};},
};
const db={storage:{from:()=>storage},from(table){assert.equal(table,'memory_cards');return{
 insert(payload){events.push(['insert',structuredClone(payload)]);return{select(){return{async single(){
   if(mode==='insert-reject')return{data:null,error:{code:'42501',message:'denied'}};
   row={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',...structuredClone(payload),created_at:'2026-09-11',updated_at:'2026-09-11'};
   if(['committed-lost','read-failed','read-empty'].includes(mode))throw new TypeError('response lost');return{data:row,error:null};
 }}}};},
 select(){const filters=[];return{eq(k,v){filters.push([k,v]);return this;},async maybeSingle(){events.push(['read',filters]);if(mode==='read-failed')throw new TypeError('read offline');return{data:mode==='read-empty'?null:row,error:null};}};},
 };}};
await mock.module(new URL('../boarding/current-trip-session.ts',import.meta.url).href,{exports:{getCurrentAuthSession:async()=>{authHook?.();return{user:{id:authId}};},getCurrentTripSession:async()=>currentSession}});
await mock.module(new URL('../../lib/supabase/client.ts',import.meta.url).href,{exports:{getSupabaseBrowserClient:()=>db}});
const{createMemoryCard,verifyMemoryCardSave,MemoryCardOutcomeUnknown}=await import('./memory-card-repository.ts');
const count=name=>events.filter(([e])=>e===name).length;
test('v4 finalize failure classification protects committed or uncertain results without duplicate insert',async()=>{
 reset('upload-reject');await assert.rejects(createMemoryCard(args()),/too large/);assert.equal(count('insert'),0);assert.equal(count('remove'),0);
 reset('insert-reject');await assert.rejects(createMemoryCard(args()),/denied/);assert.equal(count('insert'),1);assert.deepEqual(events.find(([e])=>e==='remove')[1],[events.find(([e])=>e==='upload')[1]]);
 reset('committed-lost');const saved=await createMemoryCard(args());assert.equal(saved.isFinalized,true);assert.equal(count('insert'),1);assert.equal(count('remove'),0);assert.equal(count('read'),1);
 for(const failure of ['read-failed','read-empty','upload-lost']){
  reset(failure);let pending;
  await assert.rejects(createMemoryCard(args()),error=>{assert.ok(error instanceof MemoryCardOutcomeUnknown);pending=error.attempt;return true;});
  const insertCount=count('insert');assert.equal(count('remove'),0);assert.equal(await verifyMemoryCardSave(pending),null);assert.equal(count('insert'),insertCount);assert.equal(count('remove'),0);
  assert.equal(pending.resultPng.type,'image/png');assert.ok(pending.payload.result_storage_path);
  if(failure==='read-empty'){mode='success';assert.ok(await verifyMemoryCardSave(pending));assert.equal(count('insert'),1);}
 }
});
test('snapshot survives caller mutation and identity changes cannot reuse its row/blob',async()=>{
 reset('success');const input=args(),frozen=structuredClone(input.layout);authHook=()=>{input.layout.textValues.overlay_title='later';input.layout.caption='later';input.tripSession.member.id='different';};
 const saved=await createMemoryCard(input);assert.equal(saved.isFinalized,true);assert.deepEqual(events.find(([e])=>e==='insert')[1].layout_json,frozen);assert.equal(events.find(([e])=>e==='insert')[1].creator_member_id,originalSession.member.id);
 reset('member-change');await assert.rejects(createMemoryCard(args()),/탑승 정보/);assert.equal(count('insert'),0);
 reset('success');await assert.rejects(createMemoryCard({...args(),expectedAuthUserId:'another'}),/인증 정보/);assert.equal(count('upload'),0);
 reset('read-empty');let pending;await assert.rejects(createMemoryCard(args()),e=>{pending=e.attempt;return true;});currentSession.member.id='changed';await assert.rejects(verifyMemoryCardSave(pending),/탑승 정보/);assert.equal(count('insert'),1);assert.equal(count('remove'),0);
});
