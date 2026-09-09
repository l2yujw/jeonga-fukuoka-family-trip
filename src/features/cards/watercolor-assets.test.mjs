import assert from 'node:assert/strict';
import {mock,test} from 'node:test';
let authorized=true;
await mock.module(new URL('../boarding/server/request-context.ts',import.meta.url).href,{exports:{resolveInviteTrip:async()=>authorized?{id:'trip'}:null}});
const {GET}=await import('../../app/api/cards-asset/[asset]/route.ts');
const request=(token='test-only')=>({cookies:{get:()=>token?{value:token}:undefined},headers:new Headers()});
test('Cards private route requires invite authority and exact asset allowlist, including fonts',async()=>{
 for(const name of ['wc-paper.png','wc-polaroid-flower.png','wc-editorial-flower.png']){
  const response=await GET(request(),{params:Promise.resolve({asset:name})});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('cache-control'),'private, no-store');const b=new Uint8Array(await response.arrayBuffer());assert.deepEqual([...b.slice(0,8)],[137,80,78,71,13,10,26,10]);
 }
 assert.equal((await GET(request(),{params:Promise.resolve({asset:'wc-NanumMyeongjo-Regular.ttf'})})).headers.get('content-type'),'font/ttf');
 for(const asset of ['../manifest.json','wc-../../paper.png','__proto__','constructor','wc-unknown.png'])assert.equal((await GET(request(),{params:Promise.resolve({asset})})).status,404);
 assert.equal((await GET(request(''),{params:Promise.resolve({asset:'wc-paper.png'})})).status,401);
 authorized=false;assert.equal((await GET(request(),{params:Promise.resolve({asset:'wc-paper.png'})})).status,401);
});
