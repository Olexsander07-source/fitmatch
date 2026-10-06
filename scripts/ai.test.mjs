import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONSENT_VERSION,normalizeProfile,missingProfile,limitedProfile,adaptWorkout,validatePlan,nutritionEstimate,cleanCitations,progressSeries,achievements,recentChatContext} from '../fitgoin-ai-core.mjs';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
import {sportsMemory,missingSportsMemory,prepareMemoryPatch} from '../fitgoin-ai-memory.mjs';
import {programIntent,PROGRAM_SCHEMA,programFacts,reconcileProgramTime,validateProgram,finalizeProgram,calendarWorkout,programOutdated} from '../fitgoin-ai-program.mjs';

const USER='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002',CONV='20000000-0000-4000-8000-000000000001',REQUEST='30000000-0000-4000-8000-000000000001';
const PROFILE={...normalizeProfile({goal:'Похудение',sport:'fitness',age:28,height_cm:180,weight_kg:80,days_per_week:3,minutes:30,weekdays:[1,3,5],equipment:'Коврик',language:'ru'}),memory_confirmed_fields:['restrictions']};
const training=()=>({title:'Первые недели',summary:'Спокойная программа',progression:'При стабильной технике и восстановлении обсуди небольшое увеличение нагрузки.',workouts:[1,3,5].map(day=>({day,title:'Всё тело',minutes:30,warmup:'5 минут лёгкой разминки',cooldown:'3 минуты спокойного завершения',exercises:[{name:'Присед к стулу',sets:3,reps:'8–12',rest_seconds:60,minutes:5,technique:'Сохраняй устойчивое положение.',alternative:'Вставание со стула'},{name:'Отжимание от стены',sets:3,reps:'8–12',rest_seconds:60,minutes:5,technique:'Держи корпус ровно.',alternative:'Отжимание от высокой опоры'}]}))});
const nutrition=()=>({title:'Примерный день',summary:'Количество продуктов приблизительное.',calories_low:1950,calories_high:2200,protein_g:120,fat_g:60,carbs_g:233,meals:[1,2,3].map(n=>({name:'Блюдо '+n,ingredients:['Курица 150 г','Рис 150 г','Овощи'],allergens:[],calories:650,protein_g:40,fat_g:20,carbs_g:77.5,recipe:'Приготовь продукты.',substitutions:['Индейка вместо курицы']})),shopping_list:['Курица','Рис','Овощи']});
const providerResponse=(document={answer:'Начни с профиля.'},extras={})=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(document),annotations:extras.citations||[]}]},...(extras.output||[])]});
function setup(change={}) {
  const calls=[];
  let listing=0,providerCall=0;
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'private-test',OPENAI_API_KEY:'provider-test',...change.env};
  const fetcher=async(url,options={})=>{
    const body=options.body instanceof FormData?options.body:options.body?JSON.parse(options.body):null;
    calls.push({url,headers:options.headers,body,method:options.method});
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
    if(url.endsWith('/auth/v1/user'))return json({id:USER},change.invalidAuth?401:200);
    if(url.includes('/fgi_ai_profiles?'))return json(change.noConsent?[]:[{data:change.profile||PROFILE,consent_version:CONSENT_VERSION,consented_at:'2026-10-03T08:00:00Z',updated_at:change.updatedAt||'2026-10-03T09:00:00Z'}]);
    if(url.includes('/fgi_ai_conversations?'))return json(change.foreignConversation?[]:[{id:CONV}]);
    if(url.includes('/fgi_ai_food?'))return json(change.food||[]);
    if(url.includes('/fgi_ai_messages?'))return json(change.history||[]);
    if(url.includes('/fgi_ai_workouts?'))return json(change.workouts||[]);
    if(url.includes('/fgi_ai_plans?'))return json(change.plans||[]);
    if(url.endsWith('/rpc/fgi_ai_access'))return json(change.access||{modules:['training','nutrition'],friend:true});
    if(url.endsWith('/rpc/fgi_ai_reserve'))return json(change.reserve||{reserved:true});
    if(url.endsWith('/rpc/fgi_ai_claim'))return json(change.claim||{remaining:29,search_remaining:3});
    if(url.endsWith('/rpc/fgi_ai_claim_search'))return json(change.searchClaim||{search_remaining:2});
    if(url.endsWith('/rpc/fgi_ai_complete'))return json(change.completeFails?{error:'consent_changed'}:null,change.completeFails?400:200);
    if(url.includes('/rpc/'))return json(null);
    if(url.includes('/storage/v1/object/list/'))return json(listing++===0?(change.photos||[]):[]);
    if(url.includes('/storage/v1/object/'))return json([]);
    if(url.endsWith('/audio/transcriptions'))return json({text:'Следующее упражнение'});
    if(url.includes('api.openai.com'))return json(change.responses?.[providerCall++]||change.response||providerResponse(),change.providerStatus||200);
    if(url.includes('/rest/v1/'))return json([]);
    throw Error('Unexpected endpoint');
  };
  const handle=createAIHandler({env,fetcher});
  const request=(body={},headers={})=>handle(new Request('https://test.supabase.co/functions/v1/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer signed-user-token','Content-Type':'application/json',Origin:'https://fitgoin.com',...headers},body:JSON.stringify({action:'chat',request_id:REQUEST,conversation_id:CONV,message:'С чего начать?',...body})}));
  return {handle,request,calls};
}
test('profile bounds, missing intake and medically restricted personalization',()=>{
  const p=normalizeProfile({age:-5,height_cm:999,weight_kg:'NaN',days_per_week:100,language:'unknown',weekdays:[1,1,8],allergies:['milk','made-up']});
  assert.equal(p.age,null);assert.equal(p.days_per_week,3);assert.deepEqual(p.weekdays,[1]);assert.deepEqual(p.allergies,['milk']);assert(missingProfile(p,true).includes('weight_kg'));
  assert(limitedProfile({...PROFILE,age:17}));assert(limitedProfile({...PROFILE,needs_professional:true}));assert.equal(limitedProfile(PROFILE),false);
});
test('time adaptation preserves rests and keeps recorded plan immutable',()=>{
  const w=training().workouts[0],copy=structuredClone(w),adapted=adaptWorkout(w,12,{sleep:5,energy:2});
  assert.deepEqual(w,copy);assert(adapted.exercises.length>0);assert(adapted.exercises.reduce((s,e)=>s+e.minutes,8)<=12);assert(adapted.exercises.every(e=>e.rest_seconds===60&&e.sets<3));
});
test('training validation rejects impossible durations, extra data and duplicate days',()=>{
  assert.equal(validatePlan('training',training(),PROFILE).title,'Первые недели');
  const impossible=training();impossible.workouts[0].exercises[0].minutes=.5;assert.throws(()=>validatePlan('training',impossible,PROFILE),/invalid_plan/);
  const duplicate=training();duplicate.workouts[1].day=1;assert.throws(()=>validatePlan('training',duplicate,PROFILE));
  assert.throws(()=>validatePlan('training',{...training(),user_id:OTHER},PROFILE));
  assert.throws(()=>validatePlan('training',training(),{...PROFILE,needs_professional:true}));
});
test('nutrition estimate and meal totals cannot silently become extreme or allergenic',()=>{
  assert.deepEqual([nutritionEstimate(PROFILE).calories_low,nutritionEstimate(PROFILE).calories_high],[1950,2200]);
  validatePlan('nutrition',nutrition(),PROFILE);
  const n=nutrition();n.calories_low=900;assert.throws(()=>validatePlan('nutrition',n,PROFILE));
  const mismatched=nutrition();mismatched.meals[0].calories=1500;assert.throws(()=>validatePlan('nutrition',mismatched,PROFILE));
  const allergic=nutrition();allergic.meals[0].allergens=['milk'];assert.throws(()=>validatePlan('nutrition',allergic,{...PROFILE,allergies:['milk']}));
});
test('citations require HTTPS; progress uses actual data rather than sample points',()=>{
  assert.deepEqual(cleanCitations([{url:'javascript:alert(1)',title:'evil'},{url:'https://who.int/a',title:'WHO'},{url:'https://who.int/a',title:'WHO'}]),[{url:'https://who.int/a',title:'WHO'}]);
  assert.deepEqual(progressSeries([{recorded_on:'2026-10-02',weight_kg:null},{recorded_on:'2026-10-01',weight_kg:80},{recorded_on:'2026-10-03',weight_kg:79}]),[{date:'2026-10-01',value:80},{date:'2026-10-03',value:79}]);
  assert.deepEqual(achievements([{completed_at:'now',data:{sets:[]}}]),[]);
});
test('public readiness has no credentials and performs no provider or database call',async()=>{
  const s=setup({env:{OPENAI_API_KEY:''}}),response=await s.handle(new Request('https://test.supabase.co/functions/v1/fitgoin-ai'));
  const body=await response.json();assert.equal(body.configured,false);assert(!JSON.stringify(body).includes('private-test'));assert.equal(s.calls.length,0);
});
test('invalid sessions, foreign conversations and missing consent cannot spend tokens',async()=>{
  for(const options of [{invalidAuth:true},{foreignConversation:true},{noConsent:true},{env:{OPENAI_API_KEY:''}}]){
    const s=setup(options),r=await s.request();assert(r.status>=400);assert(!s.calls.some(x=>x.url.includes('api.openai.com')||x.url.includes('fgi_ai_claim')));
  }
});
test('server identity is verified and ignores body user_id, quota and model overrides',async()=>{
  const s=setup(),r=await s.request({user_id:OTHER,model:'expensive',limit:100000});assert.equal(r.status,200);
  assert.equal(s.calls.find(x=>x.url.includes('fgi_ai_claim')).body.p_user,USER);
  assert.equal(s.calls.find(x=>x.url.includes('fgi_ai_complete')).body.p_user,USER);
  const payload=s.calls.find(x=>x.url.includes('api.openai.com')).body;assert.equal(payload.model,'gpt-4.1');assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert(!payload.instructions.includes('private-test'));
});
test('idempotent result and quota exhaustion do not repeat an external API call',async()=>{
  const cached=setup({claim:{cached:{answer:'Saved',remaining:20}}});assert.equal((await (await cached.request()).json()).answer,'Saved');assert(!cached.calls.some(x=>x.url.includes('api.openai.com')));
  const quota=setup({claim:{error:'daily_limit'}});assert.equal((await quota.request()).status,429);assert(!quota.calls.some(x=>x.url.includes('api.openai.com')));
});
test('web search omits profile/history and requires actual retrieved evidence',async()=>{
  const options={response:providerResponse({answer:'Исследования с ограничениями.'},{output:[{type:'web_search_call',status:'completed'}],citations:[{type:'url_citation',url:'https://pubmed.ncbi.nlm.nih.gov/123/',title:'Research'}]})};
  const s=setup(options);assert.equal((await s.request({action:'search',message:'Найди исследования о белке.'})).status,200);
  const payload=s.calls.find(x=>x.url.includes('api.openai.com')).body;assert.equal(payload.input.length,1);assert(!JSON.stringify(payload.input).includes('weight_kg'));assert(payload.tools[0].filters.allowed_domains.includes('pubmed.ncbi.nlm.nih.gov'));assert.equal(payload.tool_choice.type,'web_search');
  const fake=setup({response:providerResponse({answer:'Я поискал в интернете.'})});assert.equal((await fake.request({action:'search'})).status,502);assert(!fake.calls.some(x=>x.url.includes('fgi_ai_complete')));
});
test('invalid plan/refusal/incomplete result is not stored; failure releases pending claim',async()=>{
  for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]},providerResponse({...training(),workouts:[]})]){
    const s=setup({response});assert((await s.request({action:'training'})).status>=400);assert(!s.calls.some(x=>x.url.includes('fgi_ai_complete')));assert(s.calls.some(x=>x.url.includes('fgi_ai_fail')));
  }
});
test('profile restriction and consent cancellation prevent a plan being stored',async()=>{
  const restricted=setup({profile:{...PROFILE,age:17}});assert.equal((await restricted.request({action:'training'})).status,422);assert(!restricted.calls.some(x=>x.url.includes('api.openai.com')));
  const deleted=setup({completeFails:true});assert.equal((await deleted.request()).status,503);assert(deleted.calls.some(x=>x.url.includes('fgi_ai_fail')));
});
test('transcription is explicit, bounded, not stored and does not execute a command',async()=>{
  const s=setup();const r=await s.request({action:'transcribe',audio:btoa('x'.repeat(300)),mime:'audio/webm',duration:3});assert.equal(r.status,200);assert.equal((await r.json()).text,'Следующее упражнение');assert(!s.calls.some(x=>x.url.includes('fgi_ai_complete')));
  const tooLong=setup();assert.equal((await tooLong.request({action:'transcribe',audio:'a',mime:'audio/webm',duration:900})).status,400);assert(!tooLong.calls.some(x=>x.url.includes('api.openai.com')));
});
test('data deletion works without an OpenAI key and deletes only the authenticated folder',async()=>{
  const photo='40000000-0000-4000-8000-000000000001.jpg',s=setup({env:{OPENAI_API_KEY:''},photos:[{id:'photo',name:photo},{id:'evil',name:'../../other.jpg'}]});
  const response=await s.request({action:'delete_data',confirm:'wrong'});assert.equal(response.status,400);
  assert.equal((await s.request({action:'delete_data',confirm:CONSENT_VERSION,user_id:OTHER})).status,200);
  assert.deepEqual(s.calls.find(x=>x.method==='DELETE').body.prefixes,[`${USER}/${photo}`]);
  const empty=setup({env:{OPENAI_API_KEY:''}});assert.equal((await empty.request({action:'delete_data',confirm:CONSENT_VERSION,user_id:OTHER})).status,200);assert.equal(empty.calls.find(x=>x.url.includes('fgi_ai_delete')).body.p_user,USER);assert(!empty.calls.some(x=>x.url.includes('api.openai.com')));
});
test('uncertainty automatically invokes a separate search with only a generic topic',async()=>{
  const first=providerResponse({answer:'Нужно проверить исследования.',needs_search:true,search_query:'protein intake resistance training systematic review'});
  const second=providerResponse({answer:'Исследования показывают диапазон.',needs_search:false,search_query:''},{output:[{type:'web_search_call',status:'completed'}],citations:[{type:'url_citation',url:'https://pubmed.ncbi.nlm.nih.gov/456/',title:'Study'}]});
  const s=setup({responses:[first,second]});assert.equal((await s.request()).status,200);
  const queries=s.calls.filter(x=>x.url.includes('api.openai.com'));assert.equal(queries.length,2);assert.equal(queries[1].body.input.length,1);assert(!JSON.stringify(queries[1].body.input).includes('profile'));assert(s.calls.some(x=>x.url.includes('fgi_ai_claim_search')));
  const privateQuery=setup({response:providerResponse({answer:'Search',needs_search:true,search_query:'fitness for 28 year old in Paris'})});assert.equal((await privateQuery.request()).status,422);assert.equal(privateQuery.calls.filter(x=>x.url.includes('api.openai.com')).length,1);
});
test('CORS rejects an unapproved origin before authentication or any mutation',async()=>{
  const s=setup();assert.equal((await s.request({}, {Origin:'https://evil.example'})).status,403);assert.equal(s.calls.length,0);
});
test('provider credit, credential and rate failures are distinguished without leaking error bodies',async()=>{
  const logs=[],original=console.warn;console.warn=value=>logs.push(value);
  try{
    for(const [status,code,expected] of [[429,'insufficient_quota','provider_quota'],[429,'credit_balance_exhausted','provider_quota'],[429,'rate_limit_exceeded','provider_busy'],[401,'invalid_api_key','provider_authentication'],[403,'model_not_found','provider_permissions']]){
      const s=setup({providerStatus:status,response:{error:{code,message:'DO_NOT_LOG_PRIVATE_PROVIDER_BODY'}}});
      const response=await s.request();assert.equal(response.status,503);assert.equal((await response.json()).error,expected);
      assert(!s.calls.some(x=>x.url.includes('fgi_ai_complete')));assert(s.calls.some(x=>x.url.includes('fgi_ai_fail')));
    }
    assert.equal(logs.length,5);assert(!logs.join('').includes('DO_NOT_LOG_PRIVATE_PROVIDER_BODY'));assert(!logs.join('').includes('provider-test'));
  }finally{console.warn=original;}
});
test('monthly resource exhaustion and an unpriced model stop before any provider expense',async()=>{
  const exhausted=setup({reserve:{error:'monthly_limit'}}),response=await exhausted.request();
  assert.equal(response.status,429);assert.equal((await response.json()).error,'monthly_limit');
  assert(!exhausted.calls.some(x=>x.url.includes('api.openai.com')));assert(exhausted.calls.some(x=>x.url.includes('fgi_ai_fail')));
  const unknown=setup({env:{OPENAI_MODEL:'unpriced-model'}});assert.equal((await unknown.request()).status,503);assert(!unknown.calls.some(x=>x.url.includes('api.openai.com')));
});
test('nutrition uses confirmed food history and training receives only its own context',async()=>{
  const options={profile:{...PROFILE,diet:'vegan',allergies:['milk']},food:[{name:'CONFIRMED_FOOD',recorded_on:'2026-10-04',calories_low:100,calories_high:150}],workouts:[{completed_at:'2026-10-04T10:00:00Z',data:{sets:[{exercise:'ACTUAL_WORKOUT',reps:10}]}}]};
  const diet=setup(options);assert.equal((await diet.request({module:'nutrition'})).status,200);
  const dietContext=JSON.stringify(diet.calls.find(x=>x.url.includes('api.openai.com')).body.input);
  assert(dietContext.includes('CONFIRMED_FOOD'));assert(!dietContext.includes('ACTUAL_WORKOUT'));assert(!diet.calls.some(x=>x.url.includes('/fgi_ai_workouts?')));
  assert(diet.calls.some(x=>x.url.includes('module=eq.nutrition')));
  const sports=setup(options);assert.equal((await sports.request({module:'training'})).status,200);
  const sportsContext=JSON.stringify(sports.calls.find(x=>x.url.includes('api.openai.com')).body.input);
  assert(sportsContext.includes('ACTUAL_WORKOUT'));assert(!sportsContext.includes('CONFIRMED_FOOD'));assert(!sportsContext.includes('vegan'));assert(!sportsContext.includes('milk'));
  assert(!sports.calls.some(x=>x.url.includes('/fgi_ai_food?')));assert(sports.calls.some(x=>x.url.includes('module=eq.training')));
});
test('food-photo round trip stores only the assessment and leaves logging to user confirmation',async()=>{
  const assessment={title:'Рис',uncertainty:'Размер порции приблизительный.',items:[{name:'Рис',portion:'Около 150 г',calories_low:160,calories_high:250,protein_g:4,fat_g:1,carbs_g:40}],questions:[],warnings:['Проверь состав.']};
  const bytes=new Uint8Array(300);bytes.set([255,216,255]);const base64=btoa(String.fromCharCode(...bytes));
  const s=setup({response:providerResponse(assessment)}),response=await s.request({action:'food_photo',images:[{mime:'image/jpeg',base64}],media_consent:'2026-10-04-media'});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.analysis.total.calories_high,250);assert.equal(result.module,'nutrition');
  assert(!s.calls.some(x=>x.url.includes('/fgi_ai_food?')));
  const persisted=s.calls.find(x=>x.url.includes('fgi_ai_complete')).body;assert(!JSON.stringify(persisted).includes(base64));assert.equal(persisted.p_result.analysis.title,'Рис');
  const payload=s.calls.find(x=>x.url.includes('api.openai.com')).body;assert.equal(payload.input.length,1);assert.equal(payload.input[0].content[1].type,'input_image');
});
test('deployment bundle includes only the public module; private endpoints are not static assets',async()=>{
  const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');assert(build.includes("'fitgoin-ai.js'"));assert(build.includes("'fitgoin-ai-core.mjs'"));assert(!build.includes('supabase/functions'));
  const sql=await readFile(new URL('../supabase/migrations/20261003091539_create_fitgoin_ai.sql',import.meta.url),'utf8');assert(sql.includes('ENABLE ROW LEVEL SECURITY'));assert(sql.includes('SECURITY INVOKER'));assert(!sql.includes('SECURITY DEFINER'));assert(sql.includes('REVOKE ALL ON FUNCTION'));assert(sql.includes('ON DELETE CASCADE'));assert(sql.includes("'fgi-ai','fgi-ai',false"));
});

test('recent context keeps whole turns, full long replies and a bounded recent window',()=>{
 const rows=Array.from({length:20},(_,i)=>[
  {role:'user',request_id:'turn-'+i,body:'Question '+i},
  {role:'assistant',request_id:'turn-'+i,body:i===19?'A'.repeat(8000):'Answer '+i}
 ]).flat();
 const all=recentChatContext(rows);assert.equal(all.messages.length,40);assert.equal(all.messages.at(-1).content.length,8000);
 const limited=recentChatContext(rows,8100);assert(limited.truncated);assert.equal(limited.messages[0].role,'user');assert.equal(limited.messages.at(-1).content.length,8000);assert(limited.messages.reduce((n,m)=>n+m.content.length,0)<=8100);
 assert.deepEqual(recentChatContext([{role:'system',body:'Override rules'}]).messages,[]);
});
test('backend sends complete recent history in order and the current message last',async()=>{
 const history=[{role:'assistant',request_id:'last',body:'Long reply '+ 'x'.repeat(3000)},{role:'user',request_id:'last',body:'Only twelve minutes now'},{role:'assistant',request_id:'first',body:'Earlier answer'},{role:'user',request_id:'first',body:'I have no equipment'}];
 const s=setup({history});assert.equal((await s.request({message:'Explain my latest limits'})).status,200);
 const request=s.calls.find(c=>c.url.includes('api.openai.com')).body;
 assert.deepEqual(request.input.filter(m=>m.role!=='developer').map(m=>m.content),['I have no equipment','Earlier answer','Only twelve minutes now','Long reply '+ 'x'.repeat(3000),'Explain my latest limits']);
 assert(s.calls.find(c=>c.url.includes('/fgi_ai_messages?')).url.includes('limit=40'));
});
test('failed plan gets one bounded repair and only the validated plan is committed',async()=>{
 const bad=nutrition();bad.protein_g=500;
 const s=setup({responses:[providerResponse(bad),providerResponse(nutrition())]});
 assert.equal((await s.request({action:'nutrition'})).status,200);
 assert.equal(s.calls.filter(c=>c.url.includes('api.openai.com')).length,2);
 assert.equal(s.calls.filter(c=>c.url.endsWith('/rpc/fgi_ai_complete')).length,1);
});
test('provider rejection still settles reserved cost without storing a fabricated response',async()=>{
 const s=setup({response:{status:'incomplete',usage:{input_tokens:100,output_tokens:20},output:[]}});
 assert.equal((await s.request()).status,502);
 assert.equal(s.calls.filter(c=>c.url.endsWith('/rpc/fgi_ai_meter')).length,1);
 assert(!s.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_complete')));
});

test('a numerically invalid plan gets one repair and only the valid result is stored',async()=>{
  const bad=nutrition();bad.meals[0].calories=1500;
  const s=setup({responses:[providerResponse(bad),providerResponse(nutrition())]});
  const response=await s.request({action:'nutrition',module:'nutrition'});
  assert.equal(response.status,200);
  const calls=s.calls.filter(x=>x.url.includes('api.openai.com'));
  assert.equal(calls.length,2);
  const saved=s.calls.find(x=>x.url.includes('fgi_ai_complete'));
  assert.deepEqual(saved.body.p_document,nutrition());
  const reserve=s.calls.find(x=>x.url.includes('fgi_ai_reserve')).body.p_amount;
  assert(reserve>.45,'Reserve must cover both possible provider calls');
});
test('invalid repair remains rejected and both billed attempts are metered',async()=>{
  const bad={...training(),workouts:[]};
  const billed={...providerResponse(bad),usage:{input_tokens:100,output_tokens:50}};
  const s=setup({response:billed});
  assert.equal((await s.request({action:'training'})).status,502);
  assert.equal(s.calls.filter(x=>x.url.includes('api.openai.com')).length,2);
  assert(!s.calls.some(x=>x.url.includes('fgi_ai_complete')));
  const cost=s.calls.find(x=>x.url.includes('fgi_ai_meter')).body;
  assert.equal(cost.p_input,200);assert.equal(cost.p_output,100);assert(cost.p_actual>0);
});
test('provider quota errors never trigger a plan repair',async()=>{
  const s=setup({providerStatus:429,response:{error:{code:'credit_balance_exhausted'}}});
  const response=await s.request({action:'training'});
  assert.equal(response.status,503);
  assert.equal(s.calls.filter(x=>x.url.includes('api.openai.com')).length,1);
  assert(!s.calls.some(x=>x.url.includes('fgi_ai_complete')));
});

test('sports memory has no invented form defaults and distinguishes unknown restrictions from none',()=>{
 assert.deepEqual(sportsMemory({}),{});assert.equal(missingSportsMemory({}).length,7);
 assert.deepEqual(missingSportsMemory({goal:'Сила',experience:'beginner',days_per_week:3,minutes:30,setting:'home',equipment:'Коврик',restrictions:''}),['restrictions']);
 assert.deepEqual(missingSportsMemory({goal:'Сила',experience:'beginner',days_per_week:3,minutes:30,setting:'home',equipment:'Коврик',restrictions:'',memory_confirmed_fields:['restrictions']}),[]);
});
test('explicit current updates merge once, preserve other data and invalidate old place/schedule assumptions',()=>{
 const message='Мой вес сейчас 82 кг. Теперь могу тренироваться 4 раза в неделю. Я теперь тренируюсь в зале.';
 const updates=[{field:'weight_kg',value:'82',evidence:'Мой вес сейчас 82 кг'},{field:'days_per_week',value:'4',evidence:'Теперь могу тренироваться 4 раза в неделю'},{field:'setting',value:'gym',evidence:'Я теперь тренируюсь в зале'}];
 const saved=prepareMemoryPatch({...PROFILE,name:'Макс',diet:'vegan',memory_confirmed_fields:['equipment']},updates,message);
 assert.equal(saved.data.weight_kg,82);assert.equal(saved.data.days_per_week,4);assert.equal(saved.data.setting,'gym');assert.equal(saved.data.name,'Макс');assert.equal(saved.data.diet,'vegan');assert.equal(saved.data.equipment,'');assert.deepEqual(saved.data.weekdays,[]);assert(missingSportsMemory(saved.data).includes('equipment'));
});
test('memory rejects unsupported evidence, inferred fields, third-party examples, duplicates and unsafe numbers',()=>{
 const good={field:'weight_kg',value:'82',evidence:'Мой вес 82 кг'};
 for(const [updates,message] of [[[{...good,evidence:'Не было такого'}],'Мой вес 82 кг'],[[{field:'age',value:'82',evidence:good.evidence}],good.evidence],[[good],'Например: Мой вес 82 кг'],[[good,good],good.evidence],[[{...good,value:'999'}],good.evidence],[[{field:'restrictions',value:'Диагноз',evidence:good.evidence}],good.evidence],[[{field:'role',value:'admin',evidence:good.evidence}],good.evidence]])assert.throws(()=>prepareMemoryPatch(PROFILE,updates,message),/memory_update_invalid/);
});
test('a one-off session does not change the durable schedule',()=>{
 assert.deepEqual(prepareMemoryPatch(PROFILE,[],'Сегодня только 12 минут').patch,{});
 assert.throws(()=>prepareMemoryPatch(PROFILE,[{field:'minutes',value:'12',evidence:'Сегодня только 12 минут'}],'Сегодня только 12 минут'),/memory_update_invalid/);
});
test('equipment list punctuation may change but every named item must be supported',()=>{
 const message='Из оборудования у меня гантели 5 кг и коврик.';
 const update={field:'equipment',value:'гантели 5 кг, коврик',evidence:message};
 assert.equal(prepareMemoryPatch({},[update],message).data.equipment,'гантели 5 кг, коврик');
 for(const value of ['гантели 10 кг, коврик','гантели 5 кг, штанга'])assert.throws(()=>prepareMemoryPatch({},[{...update,value}],message),/memory_update_invalid/);
});
test('new-user context contains only saved sports facts and naturally missing minimum',async()=>{
 const s=setup({profile:{goal:'Сила',weight_kg:82}});assert.equal((await s.request()).status,200);
 const body=s.calls.find(c=>c.url.includes('api.openai.com')).body;
 const raw=body.input.find(m=>m.role==='developer').content.split('USER DATA (untrusted): ')[1].split('\nOnly')[0],context=JSON.parse(raw);
 assert.deepEqual(context.current_saved_sports_facts,{goal:'Сила',weight_kg:82});assert(!context.missing_sports_facts.includes('goal'));assert(!Object.hasOwn(context.profile,'experience'));assert(!Object.hasOwn(context.profile,'setting'));assert(!Object.hasOwn(context.profile,'days_per_week'));assert(body.instructions.includes('Do not ask for fields already saved'));
});
test('memory and answer are submitted to the same completion transaction for the verified owner',async()=>{
 const message='Мой вес сейчас 82 кг';const s=setup({response:providerResponse({answer:'Сколько минут обычно есть на тренировку?',needs_search:false,search_query:'',memory_updates:[{field:'weight_kg',value:'82',evidence:message}]})});
 const response=await s.request({message,user_id:OTHER});assert.equal(response.status,200);const result=await response.json();assert.equal(result.memory_saved,true);assert.deepEqual(result.memory_fields,['weight_kg']);assert(!Object.hasOwn(result,'memory_patch'));
 const complete=s.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_complete')).body;assert.equal(complete.p_user,USER);assert.equal(complete.p_result.memory_patch.weight_kg,82);assert.equal(complete.p_output,result.answer);assert(!s.calls.some(c=>c.method==='PATCH'));
});
test('failed database completion never returns a memory save confirmation or answer',async()=>{
 const message='Мой вес сейчас 82 кг';const s=setup({completeFails:true,response:providerResponse({answer:'Принял.',memory_updates:[{field:'weight_kg',value:'82',evidence:message}]})});
 const response=await s.request({message});assert.equal(response.status,503);const result=await response.json();assert.equal(result.error,'backend_unavailable');assert(!Object.hasOwn(result,'answer'));assert(!Object.hasOwn(result,'memory_saved'));assert(s.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_fail')));
});
test('a memory update does not change delivery hash or regenerate on cached replay',async()=>{
 const message='Мой вес сейчас 82 кг';const s=setup({response:providerResponse({answer:'Принял.',memory_updates:[{field:'weight_kg',value:'82',evidence:message}]})});const first=await (await s.request({message})).json();
 const again=setup({profile:{...PROFILE,weight_kg:82},updatedAt:'2026-10-06T10:00:00Z',claim:{cached:first}});assert.deepEqual(await (await again.request({message})).json(),first);
 const hash=c=>c.calls.find(x=>x.url.endsWith('/rpc/fgi_ai_claim')).body.p_hash;assert.equal(hash(s),hash(again));assert(!again.calls.some(c=>c.url.includes('api.openai.com')));
});
test('direct memory questions use saved facts even if the model gives a different number',async()=>{
 const s=setup({profile:{...PROFILE,weight_kg:82},response:providerResponse({answer:'Ты весишь 80 кг.',memory_updates:[]})});const result=await (await s.request({message:'Какой у меня сейчас вес?'})).json();assert(result.answer.includes('82'));assert(!result.answer.includes('80'));
 const missing=setup({profile:{},response:providerResponse({answer:'80 кг.',memory_updates:[]})});const unknown=await (await missing.request({message:'Какой у меня сейчас вес?'})).json();assert(!unknown.answer.includes('80'));assert.equal(unknown.memory_saved,false);
});
test('rejected memory extraction cannot reach the database completion transaction',async()=>{
 const s=setup({response:providerResponse({answer:'Сохранил.',memory_updates:[{field:'weight_kg',value:'82',evidence:'Мой вес 82 кг'}]})});const response=await s.request({message:'Расскажи про разминку'});assert.equal(response.status,422);assert.equal((await response.json()).error,'memory_update_invalid');assert(!s.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_complete')));
});
const program=()=>({...training(),workouts:training().workouts.map((w,i)=>({...w,day:i+1,objective:'Общее развитие силы',exercises:w.exercises.map(e=>({...e,required_equipment:'Без оборудования',alternative_equipment:'Без оборудования'}))}))});
test('2B recognizes creation and all saved-program queries, without treating examples as actions',()=>{
 for(const s of ['Составь мне программу','Создай программу тренировок','Что мне лучше тренировать?'])assert.equal(programIntent(s),'create');
 for(const s of ['Покажи мою программу','Какая у меня программа?'])assert.equal(programIntent(s),'show');
 assert.equal(programIntent('Что я тренирую сегодня?'),'today');assert.equal(programIntent('Что я тренирую завтра?'),'tomorrow');assert.equal(programIntent('Например, создай программу тренировок'),null);
});
test('2B validates actual seven facts without inventing age or weekdays, rejecting missing constraints and unavailable equipment',()=>{
 const p={...PROFILE};delete p.age;delete p.sport;delete p.weekdays;
 validateProgram(program(),p);
 const unknown={...p};delete unknown.memory_confirmed_fields;assert.throws(()=>validateProgram(program(),unknown),/profile_incomplete/);
 const wrong=program();wrong.workouts[0].exercises[0].required_equipment='Штанга';assert.throws(()=>validateProgram(wrong,p),/invalid_plan/);
 const timed=program();timed.workouts[0].exercises[0].reps='10 минут';assert.throws(()=>validateProgram(timed,p),/invalid_plan/);
 const noFallback=program();noFallback.workouts[0].exercises[0].required_equipment='Коврик';noFallback.workouts[0].exercises[0].alternative_equipment='коврик';assert.throws(()=>validateProgram(noFallback,p),/invalid_plan/);
 const harder=program();harder.workouts[0].exercises[0].alternative='Отжимания от пола';assert.throws(()=>validateProgram(harder,p),/invalid_plan/);
});
test('2B calendar uses saved explicit weekdays, timezone and date rollover; sequence never implies today',()=>{
 const data={...PROFILE,weekdays:[]},doc=finalizeProgram(program(),data,'Europe/Paris',()=>crypto.randomUUID());
 const plan={id:REQUEST,kind:'training',status:'active',document:doc,profile_snapshot:programFacts(data)};
 assert.equal(calendarWorkout(plan).state,'unscheduled');assert(doc.workouts.every(w=>w.day===-1&&w.id&&w.exercises[0].id));
 const scheduled={...plan,document:finalizeProgram(program(),{...data,weekdays:[1,3,5]},'Europe/Paris')};
 assert.equal(calendarWorkout(scheduled,1,'Europe/Paris',new Date('2026-10-04T22:30:00Z')).state,'rest');
 assert.equal(calendarWorkout(scheduled,0,'Europe/Paris',new Date('2026-10-04T22:30:00Z')).workout.day,1);
 assert.equal(programOutdated({...plan,profile_snapshot:Object.fromEntries(Object.entries(plan.profile_snapshot).reverse())},data),false);
 assert.equal(programOutdated(plan,{...data,equipment:'Штанга'}),true);
});
test('2B continuous cardio can have no inter-set rest, but repeated sets retain at least 30 seconds',()=>{
 const doc=program(),e=doc.workouts[0].exercises[0];Object.assign(e,{name:'Ходьба в удобном темпе',sets:1,reps:'10 минут',minutes:10,rest_seconds:0,alternative:'Спокойная ходьба с короткими паузами'});validateProgram(doc,PROFILE);
 e.sets=2;assert.throws(()=>validateProgram(doc,PROFILE),error=>error.program_rule==='rest_seconds');
});
test('2B duration arithmetic preserves prescribed volume and rejects an over-budget corrected program',()=>{
 const doc=program(),e=doc.workouts[0].exercises[0];e.minutes=1;e.rest_seconds=90;
 const fixed=reconcileProgramTime(doc);assert.equal(fixed.workouts[0].exercises[0].minutes,4);assert.equal(fixed.workouts[0].exercises[0].sets,e.sets);assert.equal(fixed.workouts[0].exercises[0].rest_seconds,90);validateProgram(fixed,PROFILE);assert.equal(e.minutes,1);
 e.reps='10 минут';assert.throws(()=>validateProgram(reconcileProgramTime(doc),PROFILE),error=>error.program_rule==='workout_duration');
});
test('2B chat uses the saved profile to generate and commit a structured program with previous-version guard',async()=>{
 const old={id:OTHER,title:'Предыдущая',kind:'training',status:'active',document:{},revision:1};
 const s=setup({plans:[old],responses:[providerResponse({answer:'Проверяю данные.',memory_updates:[]}),providerResponse(program())]});
 const response=await s.request({message:'Составь мне программу',timezone:'Europe/Paris'}),result=await response.json();assert.equal(response.status,200);assert.equal(result.program_saved,true);
 const generation=s.calls.filter(c=>c.url.includes('api.openai.com')).at(-1).body;
 assert.deepEqual(generation.text.format.schema,PROGRAM_SCHEMA);assert(generation.input[0].content.includes('Коврик'));assert.equal(result.document.schema_version,2);
 const write=s.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_complete')).body;assert.equal(write.p_kind,'training');assert.equal(write.p_user,USER);assert.equal(write.p_result.program_previous_id,OTHER);assert.deepEqual(write.p_result.profile_snapshot,programFacts(PROFILE));
});
test('2B intake asks only missing fields and durable pending intent creates after the final memory reply',async()=>{
 const partial={...PROFILE};delete partial.equipment;delete partial.minutes;
 const missing=setup({profile:partial,response:providerResponse({answer:'Какая у тебя цель?',memory_updates:[]})});
 const question=await (await missing.request({message:'Создай программу тренировок'})).json();assert.equal(question.kind,null);assert.equal(question.program_pending,true);assert.deepEqual(question.missing_fields,['minutes','equipment']);assert(!question.answer.includes('цель'));assert(missing.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_complete')).body.p_result.program_pending);
 const message='Из оборудования у меня коврик. Обычно тренируюсь по 30 минут.';
 const finish=setup({profile:{...partial,program_pending:true},responses:[providerResponse({answer:'Спасибо.',memory_updates:[{field:'equipment',value:'коврик',evidence:'Из оборудования у меня коврик.'},{field:'minutes',value:'30',evidence:'Обычно тренируюсь по 30 минут.'}]}),providerResponse(program())]});
 const result=await (await finish.request({message})).json();assert.equal(result.program_saved,true);assert.equal(result.memory_saved,true);assert.equal(result.profile_snapshot.equipment,'коврик');
});
test('2B saved-program queries never regenerate or spend provider tokens, including unknown dates',async()=>{
 const data={...PROFILE,weekdays:[]},plan={id:OTHER,kind:'training',status:'active',revision:3,title:'Сохранённая',document:finalizeProgram(program(),data,'Europe/Paris'),profile_snapshot:programFacts(data)};
 for(const message of ['Покажи мою программу','Какая у меня программа?','Что я тренирую сегодня?','Что я тренирую завтра?']){
  const s=setup({profile:data,plans:[plan],env:{OPENAI_API_KEY:''}}),response=await s.request({message});assert.equal(response.status,200);const result=await response.json();assert.equal(result.program_id,OTHER);assert.equal(result.kind,null);assert(!s.calls.some(c=>c.url.includes('api.openai.com')||c.url.includes('fgi_ai_reserve')));if(message.includes('тренирую'))assert.match(result.answer,/не могу однозначно/);
 }
});
test('2B failed program transaction returns no save claim or generated program',async()=>{
 const s=setup({completeFails:true,response:providerResponse(program())}),response=await s.request({action:'training'});assert.equal(response.status,503);const result=await response.json();assert.equal(result.error,'backend_unavailable');assert.equal(result.answer,undefined);assert.equal(result.document,undefined);assert.equal(result.program_saved,undefined);
});
