import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSiteTranslation,createSiteTranslationHandler} from '../supabase/functions/fitgoin-site-translate/index.mjs';

const id='11111111-1111-4111-8111-111111111111';
const base='https://example.supabase.co';
const origin='https://fitgoin.com';
const source='Подготовка к марафону';
const request=(body,site=origin)=>new Request(base+'/functions/v1/fitgoin-site-translate',{method:'POST',headers:{origin:site,'content-type':'application/json'},body:JSON.stringify(body)});
const payload={target_language:'fr',coach_ids:[id],fields:['bio']};
test('rejects arbitrary text, invalid IDs and overly broad requests',()=>{
 assert.throws(()=>validateSiteTranslation({target_language:'fr',coach_ids:[id],fields:['messages']}));
 assert.throws(()=>validateSiteTranslation({target_language:'fr',coach_ids:[id,id],fields:['bio']}));
 assert.throws(()=>validateSiteTranslation({target_language:'xx',coach_ids:[id],fields:['bio']}));
 assert.deepEqual(validateSiteTranslation(payload).fields,['bio']);
});
test('public-only translations are server sourced, metered and cached',async()=>{
 const events=[];
 const handler=createSiteTranslationHandler({env:{SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:'service-secret',FGI_TRANSLATE_API_KEY:'site-key'},fetcher:async(url,options)=>{
  events.push({url,options});
  if(url.startsWith(base+'/rest/v1/fgi_coaches?'))return Response.json([{id,published:true,bio:source}]);
  if(url.startsWith(base+'/rest/v1/fgi_public_profile_translations?'))return Response.json([]);
  if(url.endsWith('/rpc/fgi_claim_public_translation_budget'))return Response.json(true);
  if(url.endsWith('/translate'))return Response.json({translatedText:'Préparation au marathon'});
  if(url.includes('on_conflict='))return new Response(null,{status:204});
  throw Error('unexpected request '+url);
 }});
 const result=await handler(request({...payload,text:'private message never translated'}));
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.translations[id].bio,'Préparation au marathon');
 const translated=events.filter(x=>x.url.endsWith('/translate'));
 assert.equal(translated.length,1);
 assert.equal(JSON.parse(translated[0].options.body).q,source);
 assert.ok(!events.some(x=>String(x.options?.body||'').includes('private message')));
 assert.ok(events.some(x=>x.url.includes('on_conflict=')));
});
test('blocks different origin and unpublished coaches before sending data',async()=>{
 let calls=0;
 const handler=createSiteTranslationHandler({env:{SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:'secret'},fetcher:async(url)=>{
  calls++;
  if(url.includes('fgi_coaches'))return Response.json([]);
  throw Error('unexpected');
 }});
 assert.equal((await handler(request(payload,'https://attacker.test'))).status,403);
 assert.equal(calls,0);
 assert.equal((await handler(request(payload))).status,404);
 assert.equal(calls,1);
});
