import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chatLanguageForRegion,validateTranslateRequest,parseTranslationResult} from '../fitgoin-chat-translation-core.mjs';
import {createTranslationHandler} from '../supabase/functions/fitgoin-chat-translate/index.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const sender='22222222-2222-4222-8222-222222222222';
const mockEnv={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'secret-test',FGI_TRANSLATE_URL:'https://translate.fitgoin.test',FGI_TRANSLATE_API_KEY:'test-private-key'};
const wrap=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
function setup({foreign=false,used=0,providerFailure='',noEnvKey=false}={}){
  const cache=new Map();let providerCalls=0,visibleReads=0,vaultReads=0;
  const fetcher=async(url,opts={})=>{
    const path=new URL(url);
    if(path.pathname==='/auth/v1/user')return wrap({id:actor});
    if(path.pathname==='/rest/v1/rpc/fgi_chat_translate_key'){vaultReads++;return wrap({api_key:'test-private-key'});}
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
    if(url==='https://translate.fitgoin.test/translate'){
      providerCalls++;
      const input=JSON.parse(opts.body);
      assert.deepEqual(Object.keys(input).sort(),['api_key','format','q','source','target'].sort());
      assert.equal(input.api_key,'test-private-key');
      assert.equal(input.source,'auto');
      assert.equal(input.target,'ru');
            if(providerFailure==='busy')return new Response(JSON.stringify({error:'too_many_requests'}),{status:429});
      if(providerFailure==='unsupported')return new Response(JSON.stringify({error:'unsupported'}),{status:400});
      if(providerFailure==='invalid-key')return new Response(JSON.stringify({error:'key'}),{status:401});
      return wrap({translatedText:'Здравствуйте, когда встреча?'});
    }
    throw Error('Unexpected request '+url);
  };
  const handler=createTranslationHandler({env:noEnvKey?{...mockEnv,FGI_TRANSLATE_API_KEY:''}:mockEnv,fetcher});
  const req=(ids=[101],target='ru',jwt=true)=>new Request('https://example.supabase.co/functions/v1/fitgoin-chat-translate',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fitgoin.com',...(jwt?{Authorization:'Bearer valid-session'}:{})},body:JSON.stringify({message_ids:ids,target_language:target})});
  return {cache,handler,req,get providerCalls(){return providerCalls;},get visibleReads(){return visibleReads;},get vaultReads(){return vaultReads;}};
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
  assert.throws(()=>validateTranslateRequest({target_language:'nl',message_ids:[1]})); // not installed on private engine
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

test('self-hosted translate failures do not cache bad results',async()=>{
  const ctx=setup({providerFailure:'busy'}),res=await ctx.handler(ctx.req());
  assert.equal(res.status,429);
  assert.deepEqual(await res.json(),{error:'translation_daily_limit'});
  assert.equal(ctx.cache.size,0);
  assert.equal(ctx.providerCalls,1);
});
test('an invalid private translator API key is not exposed',async()=>{
  const ctx=setup({providerFailure:'invalid-key'}),res=await ctx.handler(ctx.req());
  assert.equal(res.status,503);
  assert.deepEqual(await res.json(),{error:'translation_unavailable'});
  assert.equal(ctx.cache.size,0);
});
test('unknown target language from self-hosted server is reported without caching',async()=>{
  const ctx=setup({providerFailure:'unsupported'}),res=await ctx.handler(ctx.req());
  assert.equal(res.status,422);
  assert.deepEqual(await res.json(),{error:'unsupported_language'});
  assert.equal(ctx.cache.size,0);
});
test('private translator configuration is mandatory (never use public translation services)',async()=>{
  const base=setup();
  const handler=createTranslationHandler({env:{...mockEnv,FGI_TRANSLATE_URL:'http://localhost:5000'}});
  const res=await handler(base.req());
  assert.equal(res.status,503);
  assert.deepEqual(await res.json(),{error:'translation_unavailable'});
  assert.equal(base.providerCalls,0);
});
test('translation backend contains no OpenAI or Microsoft translation API calls',()=>{
  const source=readFileSync(new URL('../supabase/functions/fitgoin-chat-translate/index.mjs',import.meta.url),'utf8');
  assert(source.includes('FGI_TRANSLATE_URL'));
  assert(source.includes('FGI_TRANSLATE_API_KEY'));
  assert(!source.includes('api.openai.com'));
  assert(!source.includes('cognitive.microsofttranslator.com'));
});

test('private Vault key is used only after RLS and is never exposed to the browser',async()=>{
  const ctx=setup({noEnvKey:true});
  const first=await ctx.handler(ctx.req());
  assert.equal(first.status,200);
  assert.equal(ctx.vaultReads,1);
  assert.equal(ctx.providerCalls,1);
  const cached=await ctx.handler(ctx.req());
  assert.equal(cached.status,200);
  assert.equal(ctx.vaultReads,1);
  const foreign=setup({noEnvKey:true,foreign:true});
  assert.equal((await foreign.handler(foreign.req())).status,403);
  assert.equal(foreign.vaultReads,0);
  const anonymous=setup({noEnvKey:true});
  assert.equal((await anonymous.handler(anonymous.req([101],'ru',false))).status,401);
  assert.equal(anonymous.vaultReads,0);
});

test('chat interface offers retry after failure without removing original messages',()=>{
  const source=readFileSync(new URL('../fitmatch.js',import.meta.url),'utf8');
  assert(source.includes("retry.dataset.chatTranslationRetry=''"));
  assert(source.includes('translationFailures.delete(translationKey(row))'));
  assert(source.includes('Перевод временно недоступен'));
  assert(source.includes('Повторить перевод'));
  assert(source.includes('displayed=translated&&!showingOriginal?translated:row.body'));
});
