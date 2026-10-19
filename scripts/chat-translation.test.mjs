import test from 'node:test';
import assert from 'node:assert/strict';
import {chatLanguageForRegion,validateTranslateRequest,parseTranslationResult} from '../fitgoin-chat-translation-core.mjs';
import {createTranslationHandler} from '../supabase/functions/fitgoin-chat-translate/index.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const sender='22222222-2222-4222-8222-222222222222';
const mockEnv={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'secret-test',OPENAI_API_KEY:'openai-test'};
const wrap=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
function setup({foreign=false,used=0}={}){
  const cache=new Map();let providerCalls=0,visibleReads=0;
  const fetcher=async(url,opts={})=>{
    const path=new URL(url);
    if(path.pathname==='/auth/v1/user')return wrap({id:actor});
    if(path.pathname==='/rest/v1/fgi_messages'){
      visibleReads++;
      return wrap(foreign?[]:[{id:101,sender_id:sender,body:'Bonjour, quand est le rendez-vous ?'}]);
    }
    if(path.pathname==='/rest/v1/fgi_message_translations'&&opts.method==='POST'){
      for(const item of JSON.parse(opts.body))cache.set(item.message_id+'-'+item.target_language,item.translated_text);
      return wrap([]);
    }
    if(path.pathname==='/rest/v1/fgi_message_translations'){
      if(path.searchParams.has('requested_by'))return wrap(Array(used).fill({message_id:999}));
      const ids=path.searchParams.get('message_id')?.match(/\d+/g)||[];
      const language=path.searchParams.get('target_language')?.slice(3);
      return wrap(ids.filter(id=>cache.has(id+'-'+language)).map(id=>({message_id:Number(id),translated_text:cache.get(id+'-'+language)})));
    }
    if(url==='https://api.openai.com/v1/responses'){
      providerCalls++;
      const input=JSON.parse(JSON.parse(opts.body).input[0].content[0].text);
      return wrap({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({translations:input.map(x=>({id:x.id,translation:'Здравствуйте, когда встреча?'}))})}]}]});
    }
    throw Error('Unexpected request '+url);
  };
  const handler=createTranslationHandler({env:mockEnv,fetcher});
  const req=(ids=[101],target='ru',jwt=true)=>new Request('https://example.supabase.co/functions/v1/fitgoin-chat-translate',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fitgoin.com',...(jwt?{Authorization:'Bearer valid-session'}:{})},body:JSON.stringify({message_ids:ids,target_language:target})});
  return {cache,handler,req,get providerCalls(){return providerCalls;},get visibleReads(){return visibleReads;}};
}
test('language is based on country, manual selection always wins',()=>{
  assert.equal(chatLanguageForRegion({country:'FR',browserLanguage:'ru-RU'}),'fr');
  assert.equal(chatLanguageForRegion({country:'DE',browserLanguage:'fr-FR'}),'de');
  assert.equal(chatLanguageForRegion({country:'FR',browserLanguage:'ru-RU',manualSite:true,siteLanguage:'ru'}),'ru');
  assert.equal(chatLanguageForRegion({country:'CH',browserLanguage:'de-CH'}),'de');
  assert.equal(chatLanguageForRegion({country:'PL',chatChoice:'uk'}),'uk');
  assert.equal(chatLanguageForRegion({country:'NL',browserLanguage:'nl-NL'}),'nl');
});
test('strict translated message IDs and output integrity',()=>{
  assert.deepEqual(validateTranslateRequest({target_language:'fr',message_ids:[1,2]}),{language:'fr',ids:[1,2]});
  assert.throws(()=>validateTranslateRequest({target_language:'fr',message_ids:[1,1]}));
  assert.throws(()=>validateTranslateRequest({target_language:'xx',message_ids:[1]}));
  assert.throws(()=>parseTranslationResult({translations:[{id:2,translation:'Oui'}]},[{id:1}]));
});
test('uses RLS first, translates once, and caches the result',async()=>{
  const ctx=setup(),first=await ctx.handler(ctx.req());
  assert.equal(first.status,200);
  const body=await first.json();
  assert.deepEqual(body.translations,[{id:101,body:'Здравствуйте, когда встреча?'}]);
  assert.equal(ctx.providerCalls,1);
  const again=await ctx.handler(ctx.req());
  assert.equal(again.status,200);
  assert.equal(ctx.providerCalls,1);
  assert.equal(ctx.visibleReads,2); // membership verified on each request, including cache hits
});
test('rejects other users messages before calling provider or reading cache',async()=>{
  const ctx=setup({foreign:true}),result=await ctx.handler(ctx.req());
  assert.equal(result.status,403);
  assert.equal(ctx.providerCalls,0);
  assert.equal(ctx.cache.size,0);
});
test('anonymous requests and attempts to translate >6 IDs are denied',async()=>{
  const ctx=setup();
  assert.equal((await ctx.handler(ctx.req([101],'ru',false))).status,401);
  assert.equal((await ctx.handler(ctx.req([1,2,3,4,5,6,7]))).status,400);
});
test('daily safety cap prevents provider spending',async()=>{
  const ctx=setup({used:120}),res=await ctx.handler(ctx.req());
  assert.equal(res.status,429);
  assert.equal(ctx.providerCalls,0);
});
