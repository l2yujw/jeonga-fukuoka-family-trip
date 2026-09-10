import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {WATERCOLOR_TEMPLATES,getWatercolorTemplate,getWatercolorFieldBox} from './watercolor-template-spec.ts';
import {createWatercolorDraft,projectWatercolorLayout,setWatercolorDraftValue,parseMemoryCardLayoutV4,normalizeWatercolorText,isWatercolorDate,validateWatercolorValues,watercolorPayloadBytes,finalizeWatercolorLayout,setWatercolorTripDateDisplay} from './watercolor-layout.ts';
import {layoutWatercolorText,wrapWatercolorText,supportsWatercolorGlyphs,watercolorCanvasFailure,paintWatercolorScene} from './watercolor-scene.ts';
import {getMemoryCardRenderTemplate,getRandomPhotoCount,parseMemoryCardRenderModel,buildMemoryCardLayoutV3,createMemoryCardRenderModel,mapPersistedMemoryCardRows} from './memory-card.ts';
import {getMemoryCardExportDimensions} from './memory-card-export.ts';
const trip={title:'우리 가족',startDate:'2026-09-11',endDate:'2026-09-13'};
const id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const mapping=t=>t.slots.map((s,i)=>({slotId:s.id,photoId:id(i+1),placement:{zoom:1,rotation:0,offsetX:0,offsetY:0}}));
const make=t=>projectWatercolorLayout(t,mapping(t),createWatercolorDraft(t,trip));
test('all eight new drafts use the exact family title with blank notes and unchanged dates',()=>{
 for(const t of WATERCOLOR_TEMPLATES){
  const draft=createWatercolorDraft(t,trip),layout=projectWatercolorLayout(t,mapping(t),draft);
  assert.equal(layout.textValues[t.primary],'전가네 가족여행',t.key);
  assert.equal(layout.caption,'전가네 가족여행',t.key);
  assert.equal(t.fields.find(f=>f.id===t.primary).defaultPolicy,'전가네 가족여행');
  for(const [key,value] of Object.entries(layout.textValues))if(key!==t.primary)assert.equal(value,null,`${t.key}:${key}`);
  assert.equal(layout.dateValues['trip.start'],trip.startDate);
  assert.equal(layout.dateValues['trip.end'],trip.endDate);
  for(const [key,value] of Object.entries(layout.dateValues))if(!key.startsWith('trip.'))assert.equal(value,null);
  assert.deepEqual(parseMemoryCardLayoutV4(t.key,layout),layout);
 }
});
test('empty Album composer retries leave the draft intact until a template is available',async()=>{
 const source=await readFile(new URL('./memory-cards-view.tsx',import.meta.url),'utf8');
 const callback=source.slice(source.indexOf('  const activateTemplate ='),source.indexOf('  const openPhotoSelection ='));
 const state={};
 const activate=runInNewContext(stripTypeScriptTypes(`${callback}\nactivateTemplate;`),{
  savingRef:{current:false},editingFieldId:null,selectedSlotId:null,photoBaseline:{current:null},
  templateKey:null,templateDrafts:{current:{}},tripSession:{trip},structuredClone,
  getMemoryCardTemplate:getWatercolorTemplate,createWatercolorDraft,
  setTemplateKey:value=>{state.key=value;},setPhotoDraft:value=>{state.photo=value;},
  setTextDraft:value=>{state.text=value;},setSceneValidation:()=>{},setSelectedSlotId:()=>{},
 });
 activate(null);activate(null);assert.deepEqual(state,{});
 activate('one_moment');assert.equal(state.key,'one_moment');
 assert.equal(state.photo.photoIds.length,0);
 assert.deepEqual(state.text,createWatercolorDraft(getWatercolorTemplate('one_moment'),trip));
});
test('all 8 v4 templates preserve all 74 independent catalog fields and full export bounds',()=>{
 assert.deepEqual(WATERCOLOR_TEMPLATES.map(t=>t.slots.length),[4,4,6,2,3,6,1,1]);
 assert.deepEqual(WATERCOLOR_TEMPLATES.map(t=>t.fields.length),[9,5,16,7,11,18,4,4]);
 assert.equal(WATERCOLOR_TEMPLATES.flatMap(t=>t.fields).length,74);
 for(const t of WATERCOLOR_TEMPLATES){
  assert.equal(getRandomPhotoCount(t.key,8,4),t.slots.length);
  let d=createWatercolorDraft(t,trip);const slots=mapping(t);
  for(const [i,f]of t.fields.entries()){
   if(f.kind==='plainText')d=setWatercolorDraftValue(d,f,slots,`기억 ${i+1}`);
   else if(f.photoSlotId)d=setWatercolorDraftValue(d,f,slots,'2024-02-29');
  }
  const layout=projectWatercolorLayout(t,slots,d),parsed=parseMemoryCardLayoutV4(t.key,layout);
  assert.deepEqual(parsed,layout);assert.equal(layout.caption,layout.textValues[t.primary]);
  assert.deepEqual(getMemoryCardExportDimensions({templateKey:t.key,renderModel:createMemoryCardRenderModel(layout)},{width:1080,height:1920}),{width:1080,height:1920});
  assert.deepEqual(getMemoryCardExportDimensions({templateKey:t.key,renderModel:createMemoryCardRenderModel(layout)},{width:720,height:1280}),{width:720,height:1280});
  for(const f of t.fields){const b=getWatercolorFieldBox(t,f);assert.ok(b.w>0&&b.h>0&&b.x>=0&&b.y>=0&&b.x+b.w<=1080&&b.y+b.h<=1920);}
 }
});
test('strict v4 boundary rejects malformed keys/types/count/order/revision/placements/dates/unsafe text',()=>{
 const t=getWatercolorTemplate('polaroid_moodboard'),base=make(t);
 const mutations=[v=>v.version=5,v=>v.templateRevision='unknown',v=>v.url='https://invalid',v=>delete v.textValues.subtitle,v=>v.textValues.extra='x',v=>v.textValues.subtitle={},v=>v.slots.pop(),v=>v.slots.reverse(),v=>v.slots[1].photoId=v.slots[0].photoId,v=>v.slots[1].photoId=v.slots[0].photoId.toUpperCase(),v=>v.slots[0].photoId='not-uuid',v=>v.slots[0].placement.zoom=Infinity,v=>v.slots[0].placement.zoom=0,v=>v.slots[0].placement.rotation=180,v=>v.slots[0].placement.offsetX=10001,v=>v.slots[0].placement.url='x',v=>v.dateValues['trip.start']='2026-02-30',v=>v.dateValues['trip.end']=null,v=>v.dateValues['trip.start']='2027-01-01',v=>v.textValues.subtitle='\0',v=>v.textValues.subtitle='\ud800',v=>v.textValues.subtitle='x'.repeat(32768),v=>v.textValues.subtitle=' '.repeat(32768),v=>v.textValues.subtitle='a\nb\nc',v=>v.caption='different'];
 for(const mutate of mutations){const v=structuredClone(base);mutate(v);assert.equal(parseMemoryCardLayoutV4(t.key,v),null,String(mutate));}
 const decomposed=structuredClone(base);decomposed.textValues.subtitle='  한글\r\n끝  ';
 assert.equal(parseMemoryCardLayoutV4(t.key,decomposed).textValues.subtitle,'  한글\n끝  ');
 assert.equal(normalizeWatercolorText(' \n\t '),null);
 assert.equal(normalizeWatercolorText('<b>plain text</b>'),'<b>plain text</b>');
 assert.ok(watercolorPayloadBytes({a:'한'})>JSON.stringify({a:'한'}).length);
});
test('Gregorian dates preserve date-only values and paired clearing',()=>{
 for(const date of ['0001-01-01','9999-12-31','2000-02-29','2024-02-29'])assert.ok(isWatercolorDate(date));
 for(const date of ['0000-01-01','1900-02-29','2026-02-29','2026-13-01','2026-04-31','2026-1-1','2026-01-01T00:00Z'])assert.equal(isWatercolorDate(date),false);
 const t=WATERCOLOR_TEMPLATES[0],v=make(t);v.dateValues['trip.start']=v.dateValues['trip.end']=null;
 assert.deepEqual(validateWatercolorValues(t,v),{});
});
test('annotation roles follow photo IDs across reorder/replacement/hero and working copies cancel intact',()=>{
 for(const key of ['polaroid_moodboard','editorial_collage','film_contact_sheet']){
  const t=getWatercolorTemplate(key),slots=mapping(t);let d=createWatercolorDraft(t,trip);
  for(const [i,f]of t.fields.filter(f=>f.photoSlotId).entries())d=setWatercolorDraftValue(d,f,slots,f.kind==='isoDate'?'2024-02-29':`사진 ${i}`);
  const original=structuredClone(d),working=structuredClone(d),f=t.fields.find(f=>f.photoSlotId);
  const changed=setWatercolorDraftValue(working,f,slots,'working');assert.deepEqual(d,original);assert.notDeepEqual(changed,d);
  const reordered=slots.map((s,i)=>({...s,photoId:slots[(i+1)%slots.length].photoId}));
  const moved=projectWatercolorLayout(t,reordered,d);
  for(const f of t.fields.filter(f=>f.photoSlotId)){const photoId=reordered.find(s=>s.slotId===f.photoSlotId).photoId;assert.equal((f.kind==='isoDate'?moved.dateValues:moved.textValues)[f.id],d.annotationsByPhotoId[photoId]?.[f.role]??null);}
  const replaced=slots.map(s=>({...s,photoId:id(99)}));assert.equal(projectWatercolorLayout(t,replaced,d).textValues[f.id],null);
  assert.deepEqual(projectWatercolorLayout(t,slots,d),projectWatercolorLayout(t,slots,original));
  if(key==='editorial_collage')assert.equal(t.fields.some(f=>f.photoSlotId==='e1'),false);
 }
});
test('shared logical line plans keep graphemes/newlines/spaces and reject overflow/glyph gaps',()=>{
 const measure=s=>[...s].length*12;
 assert.deepEqual(wrapWatercolorText('a\n\nb ',30,measure),['a','','b ']);
 const family='👨‍👩‍👧';assert.deepEqual(wrapWatercolorText(family+family,1,measure),[family,family]);
 assert.ok(supportsWatercolorGlyphs('한글 123 ♥♡–·','pen'));assert.equal(supportsWatercolorGlyphs('🦄','pen'),false);
 const t=getWatercolorTemplate('four_cut'),v=make(t);v.textValues.vertical_title='한글';v.caption='한글';
 const c={font:'',measureText:s=>({width:measure(s)})};const plan=layoutWatercolorText(t,v,c).find(p=>p.field.id==='vertical_title');
 assert.deepEqual(plan.runs.map(r=>r.text),['한','글']);assert.equal(plan.box.r,0);assert.ok(plan.runs[1].y>plan.runs[0].y);
 v.textValues.vertical_title='한'.repeat(22);assert.ok(layoutWatercolorText(t,v,c).find(p=>p.field.id==='vertical_title').error);
});
test('frozen legacy registry and finalized PNG survive unsupported metadata and missing sources',()=>{
 for(const [key,count] of [['polaroid_moodboard',6],['editorial_collage',5],['four_cut',4]]){
  const layout=buildMemoryCardLayoutV3(key,Array.from({length:count},(_,i)=>id(i+1))),model=createMemoryCardRenderModel(layout);
  assert.equal(getMemoryCardRenderTemplate(key,model).slots.length,count);
  if(key==='four_cut')assert.equal(getMemoryCardRenderTemplate(key,model).exportBounds.width,540);
  assert.equal(parseMemoryCardRenderModel(key,4,{...make(getWatercolorTemplate(key)),templateRevision:'future'}),null);
 }
 const row={id:id(50),trip_id:id(51),creator_member_id:id(52),creator_auth_user_id:id(53),template_key:'four_cut',layout_version:99,layout_json:{},result_storage_path:'unchanged/result.png',created_at:'2026-09-11',updated_at:'2026-09-11'};
 const card=mapPersistedMemoryCardRows([row],new Map(),id(53),new Map([[row.result_storage_path,'signed-runtime']]))[0];
 assert.equal(card.isFinalized,true);assert.equal(card.renderModel,null);assert.equal(card.resultSignedUrl,'signed-runtime');assert.equal(card.resultStoragePath,row.result_storage_path);
});
test('only clean decoration assets and licensed font bytes are delivered with source hashes',async()=>{
 const root=new URL('../../../private-assets/cards/templates/watercolor-2026-v1/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 for(const asset of manifest){assert.equal(asset.containsPersonalData,false);assert.equal(createHash('sha256').update(await readFile(new URL(asset.asset,root))).digest('hex'),asset.sha256);assert.ok(asset.width<941&&asset.height<1672);}
 const sql14=await readFile(new URL('../../../docs/data/14_MEMORY_CARD_IMMUTABLE_RENDER_MIGRATION.sql',import.meta.url));
 assert.equal(createHash('sha256').update(sql14).digest('hex'),'188f9b771a2e01dda4182b933b85ad96e852529fc758e28cc83a9a2ffd5d1a77');
});
test('SQL15 statically retains the v3 predicate and mirrors all v4 catalog limits inside the owner boundary',async()=>{
 const sql=await readFile(new URL('../../../docs/data/15_MEMORY_CARD_TEMPLATE_TEXT_V4_MIGRATION.sql',import.meta.url),'utf8');
 const old=await readFile(new URL('../../../docs/data/14_MEMORY_CARD_IMMUTABLE_RENDER_MIGRATION.sql',import.meta.url),'utf8');
 const legacy=old.slice(old.indexOf("jsonb_typeof(layout_json) = 'object'"),old.indexOf('\n);')).trim();
 assert.ok(sql.includes(legacy));
 const validator=sql.slice(0,sql.indexOf('  end case;'));
 for(const t of WATERCOLOR_TEMPLATES){
  const block=validator.split(`when '${t.key}' then`)[1].split(/\n    when |\n    else /)[0];
  const rules=JSON.parse(block.match(/text_rules := '(.*?)'::jsonb/)[1]);
  assert.deepEqual(rules,Object.fromEntries(t.fields.filter(f=>f.kind==='plainText').map(f=>[f.id,[f.maxCodePoints,f.maxLines]])));
  assert.deepEqual([...block.match(/date_keys := array\[(.*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]),t.fields.filter(f=>f.kind==='isoDate').map(f=>f.id));
 }
 const policy=sql.slice(sql.indexOf('create policy'));
 assert.match(policy,/creator_auth_user_id = \(select auth.uid\(\)\)[\s\S]*and result_storage_path is not null[\s\S]*and \(\s*\(layout_version = 3/);
 assert.match(policy,/or \(layout_version = 4\s+and public\.is_memory_card_watercolor_v4/);
 assert.match(policy,/p.trip_id=memory_cards.trip_id/);
 assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/security definer|for update|update public\.memory_cards|grant update/i);
 assert.match(sql,/immutable security invoker set search_path = ''/);
});

test('720 fallback classification requires a positive-size Canvas limit signal, preserving security and encoder errors',()=>{
 const canvas={width:1080,height:1920,toDataURL:()=> 'data:,'};
 assert.equal(watercolorCanvasFailure(canvas,'encode-failed').message,'memory-card-canvas-size-exceeded');
 assert.equal(watercolorCanvasFailure({...canvas,toDataURL:()=> 'data:image/png;base64,valid'},'encode-failed').message,'encode-failed');
 assert.equal(watercolorCanvasFailure({...canvas,width:0},'empty-canvas').message,'empty-canvas');
 const security=new DOMException('tainted','SecurityError');
 assert.equal(watercolorCanvasFailure({...canvas,toDataURL:()=>{throw security;}},'encode-failed'),security);
});

test('Wave A selector and both galleries use cached v4 miniatures and global Card Info entry points',async()=>{
 const [view,preview]=await Promise.all(['memory-cards-view.tsx','watercolor-preview.tsx'].map(f=>readFile(new URL(f,import.meta.url),'utf8')));
 const composer=view.slice(view.indexOf('if (composerStep && template && draftLayout)'),view.indexOf('const savedTemplate',view.indexOf('if (composerStep && template && draftLayout)')));
 assert.equal((composer.match(/<WatercolorThumbnail templateKey=\{item.key\}/g)??[]).length,3);
 assert.doesNotMatch(composer,/<TemplateGlyph templateKey=\{item.key\}/);
 assert.match(composer,/showAllTemplates[\s\S]*MEMORY_CARD_TEMPLATES\.map/);
 assert.equal((composer.match(/카드 정보 편집/g)??[]).length,2);
 assert.match(preview,/miniatures = new Map/);assert.match(preview,/memo\(function WatercolorThumbnail/);
 assert.match(preview,/canvas.width = 180; canvas.height = 320/);
 assert.doesNotMatch(preview,/toDataURL|toBlob|renderWatercolorPng/);
});

test('Wave A keeps Polaroid frame captions, upright Four Cut columns, and Editorial hero plus 3 plus 2',()=>{
 const p=getWatercolorTemplate('polaroid_moodboard');assert.equal(p.slots.length,4);
 for(const [i,s]of p.slots.entries()){
  const f=p.fields.find(f=>f.photoSlotId===s.id),b=getWatercolorFieldBox(p,f);
  assert.equal(f.anchorSlotId,s.id);assert.equal(b.r,s.r);
  assert.ok(f.y>=s.viewport.y+s.viewport.height);assert.ok(f.y+f.h<=s.h);
  assert.ok(Math.abs(s.r)>0);if(i>=2)assert.ok(s.y>p.slots[i-2].y);
 }
 const four=getWatercolorTemplate('four_cut');assert.equal(four.slots.length,4);
 for(const f of four.fields.filter(f=>f.vertical)){
  assert.equal(f.r,0);assert.ok(f.x+f.w<four.slots[0].x);
 }
 four.slots.forEach((s,i)=>{assert.equal(s.x,four.slots[0].x);assert.equal(s.w,four.slots[0].w);assert.equal(s.h,four.slots[0].h);if(i)assert.ok(s.y-four.slots[i-1].y-s.h<s.h*.1);});
 const e=getWatercolorTemplate('editorial_collage'),[hero,...episodes]=e.slots;
 assert.equal(e.slots.length,6);assert.ok(hero.x>e.fields[0].x+e.fields[0].w);
 assert.ok(hero.h>episodes[0].h*2);assert.equal(new Set(episodes.slice(0,3).map(s=>s.y)).size,1);
 assert.equal(new Set(episodes.slice(3).map(s=>s.y)).size,1);assert.ok(episodes[3].y>episodes[0].y);
 assert.ok(episodes[3].w>episodes[0].w);assert.ok(e.panels.at(-1).w>hero.w);
});

test('Wave B postcard notes remain below their own photo and fit two lines inside the rotated paper',()=>{
 const t=getWatercolorTemplate('postcard_duo');
 for(const slot of t.slots){
  const f=t.fields.find(f=>f.photoSlotId===slot.id);
  assert.equal(f.anchorSlotId,slot.id);
  assert.equal(getWatercolorFieldBox(t,f).r,slot.r);
  assert.ok(f.y>=slot.viewport.y+slot.viewport.height);
  assert.ok(f.y+f.h<=slot.h);
  assert.ok(f.lineHeight*2<=f.h);
 }
});

test('all eight empty scenes expose each photo area only in the editor and keep placeholders out of exports',()=>{
 for(const t of WATERCOLOR_TEMPLATES){
  const words=[],gradients=[];
  const c=new Proxy({fillText:text=>words.push(text),createPattern:()=>({}),createLinearGradient:()=>{gradients.push(true);return {addColorStop(){}};}},{get:(target,key)=>target[key]??(()=>{})});
  const layout=projectWatercolorLayout(t,[],createWatercolorDraft(t,{title:'',startDate:'',endDate:''}));
  const scene={template:t,layout,images:new Map(),art:new Map(),text:[],errors:{}};
  const before=structuredClone(layout);
  paintWatercolorScene(c,scene,180,true);
  assert.equal(words.filter(w=>w==='사진 선택').length,t.slots.length,t.key);
  if(t.key==='one_moment')assert.equal(gradients.length,0);
  words.length=0;paintWatercolorScene(c,scene,1080);
  assert.equal(words.includes('사진 선택'),false,t.key);
  assert.deepEqual(layout,before);
 }
});


test('all text is optional: all eight blank/date-off layouts finalize with no painted text runs',()=>{
 const context={measureText:s=>({width:s.length*10})};
 for(const t of WATERCOLOR_TEMPLATES){
  const slots=mapping(t);let d=createWatercolorDraft(t,trip);
  for(const field of t.fields.filter(f=>f.kind==='plainText'))d=setWatercolorDraftValue(d,field,slots,'  \n  ');
  d=setWatercolorTripDateDisplay(d,false,trip);
  const layout=finalizeWatercolorLayout(t.key,projectWatercolorLayout(t,slots,d));
  assert.equal(layout.caption,null);assert.ok(Object.values(layout.textValues).every(v=>v===null));
  assert.ok(Object.values(layout.dateValues).every(v=>v===null));
  assert.ok(layoutWatercolorText(t,layout,context).every(plan=>plan.runs.length===0));
 }
});
test('trip date display restores canonical dates and remembers an explicitly edited ordered pair',()=>{
 const t=WATERCOLOR_TEMPLATES[0];let d=createWatercolorDraft(t,trip);
 d=setWatercolorTripDateDisplay(d,false,trip);
 assert.equal(d.cardValues['trip.start'],null);assert.equal(d.cardValues['trip.end'],null);
 d=setWatercolorTripDateDisplay(d,true,trip);
 assert.equal(d.cardValues['trip.start'],trip.startDate);assert.equal(d.cardValues['trip.end'],trip.endDate);
 d.cardValues['trip.start']='2026-09-12';d.cardValues['trip.end']='2026-09-12';
 d=setWatercolorTripDateDisplay(setWatercolorTripDateDisplay(d,false,trip),true,trip);
 assert.equal(d.cardValues['trip.start'],'2026-09-12');assert.equal(d.cardValues['trip.end'],'2026-09-12');
 assert.deepEqual(validateWatercolorValues(t,projectWatercolorLayout(t,mapping(t),d)),{});
 assert.equal('hiddenTripDates' in finalizeWatercolorLayout(t.key,projectWatercolorLayout(t,mapping(t),d)),false);
});
test('Film photo dates are individually optional, independent of trip display, and never taken from uploads',()=>{
 const t=getWatercolorTemplate('film_contact_sheet'),slots=mapping(t),field=t.fields.find(f=>f.photoSlotId&&f.kind==='isoDate');
 let d=createWatercolorDraft(t,trip);assert.equal(projectWatercolorLayout(t,slots,d).dateValues[field.id],null);
 d=setWatercolorDraftValue(d,field,slots,'2026-09-12');d=setWatercolorTripDateDisplay(d,false,trip);
 let layout=finalizeWatercolorLayout(t.key,projectWatercolorLayout(t,slots,d));
 assert.equal(layout.dateValues[field.id],'2026-09-12');assert.equal(layout.dateValues['trip.start'],null);
 d=setWatercolorDraftValue(d,field,slots,null);layout=finalizeWatercolorLayout(t.key,projectWatercolorLayout(t,slots,d));
 assert.ok(Object.values(layout.dateValues).every(v=>v===null));
 for(const key of ['one_moment','instant_memory'])assert.equal(getWatercolorTemplate(key).fields.some(f=>f.photoSlotId),false);
 assert.equal(getWatercolorTemplate('editorial_collage').fields.some(f=>f.photoSlotId==='e1'),false);
});
