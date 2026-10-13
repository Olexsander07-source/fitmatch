import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {coachTurn} from '../fitgoin-ai-coaches.mjs';
import {coachCardSnapshot} from '../fitgoin-coach-card-core.mjs';
import {coachCardsHTML} from '../fitgoin-ai-coach-cards.mjs';
import {CONSENT_VERSION} from '../fitgoin-ai-core.mjs';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
import {createCoachSearchHandler} from '../supabase/functions/search_coaches/index.mjs';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const SPORT=id(100),SPORT2=id(101),USER=id(1),OTHER=id(2),CONV=id(50),SECOND=id(51);
const coach=(n,extra={})=>({id:id(n),name:'Тестовый тренер '+n,sport:SPORT,goal:'Похудение',format:'Онлайн и офлайн',price:45,period:'занятие',city:'Киев',languages:['ru','fr'],experience_years:5,published:true,availability:[],score:0,rating:0,reviews_count:0,email:'SECRET',phone:'SECRET',stripe_account_id:'SECRET',...extra});
// Full production handlers. Only network/Auth/database/provider boundaries are fixtures.
function setup(options={}) {
  const calls=[],messages=new Map(),profiles=new Map([[USER,{sport:'fitness',goal:'Похудение'}],[OTHER,{sport:'yoga'}]]);
  let rows=options.rows??[coach(10),coach(11,{price:35,goal:''})],fail=false;
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',OPENAI_API_KEY:'configured'};
  const actor=o=>o.headers?.Authorization==='Bearer other-token'?OTHER:USER;
  const key=(a,c,m)=>[a,c,m].join('/');
  const fetcher=async(url,o={})=>{
    const u=new URL(url),p=u.searchParams,body=o.body?JSON.parse(o.body):null,a=actor(o);
    calls.push({url,body,headers:o.headers});
    if(u.pathname==='/auth/v1/user')return Response.json({id:a});
    if(u.pathname==='/rest/v1/fgi_ai_profiles')return Response.json([{data:profiles.get(a),consent_version:CONSENT_VERSION,updated_at:'2026-10-13T00:00:00Z'}]);
    if(u.pathname==='/rest/v1/fgi_ai_conversations')return Response.json(p.get('user_id')==='eq.'+a&&[CONV,SECOND].includes(p.get('id')?.slice(3))?[{id:p.get('id').slice(3)}]:[]);
    if(u.pathname==='/rest/v1/fgi_ai_messages'){
      assert.equal(p.get('user_id'),'eq.'+a);assert(p.get('select').includes('coach_search'));
      return Response.json([...(messages.get(key(a,p.get('conversation_id').slice(3),p.get('module').slice(3)))||[])].slice(-40).reverse());
    }
    if(u.pathname==='/rest/v1/rpc/fgi_ai_access')return Response.json({friend:true,modules:['training','nutrition']});
    if(u.pathname==='/rest/v1/rpc/fgi_ai_claim')return Response.json({remaining:29,search_remaining:3});
    if(u.pathname==='/rest/v1/rpc/fgi_ai_complete'){
      const k=key(body.p_user,body.p_conversation,body.p_result.module),h=messages.get(k)||[];
      h.push({role:'user',body:body.p_input},{role:'assistant',body:body.p_output,coach_search:body.p_result.coach_search});messages.set(k,h);return Response.json(null);
    }
    if(u.pathname==='/functions/v1/search_coaches')return fail?Response.json({error:'backend_unavailable'},{status:503}):search(new Request(url,o));
    if(u.pathname==='/rest/v1/fgi_sports')return Response.json([{id:SPORT,name:'Фитнес'},{id:SPORT2,name:'Йога'}]);
    if(u.pathname==='/rest/v1/fgi_coaches')return Response.json(rows);
    if(url.includes('api.openai.com'))return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Обычный ответ',needs_search:false,search_query:'',memory_updates:[]})}]}]});
    if(u.pathname.startsWith('/rest/v1/'))return Response.json([]);
    throw Error('Unexpected endpoint '+url);
  };
  const search=createCoachSearchHandler({env,fetcher}),ai=createAIHandler({env,fetcher});
  async function send(message,{user=USER,conversation=CONV,module='training',...extra}={}){
    const response=await ai(new Request(env.SUPABASE_URL+'/functions/v1/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer '+(user===OTHER?'other-token':'owner-token'),'Content-Type':'application/json',Origin:'https://fitgoin.com'},body:JSON.stringify({action:'chat',request_id:crypto.randomUUID(),conversation_id:conversation,module,message,...extra})}));
    assert.equal(response.status,200);return response.json();
  }
  return {send,calls,messages,profiles,setRows:v=>{rows=v;},setFail:v=>{fail=v;},searches:()=>calls.filter(c=>c.url.endsWith('/functions/v1/search_coaches')),history:()=>messages.get(key(USER,CONV,'training'))||[]};
}
test('4F sequence changes only budget, format or language and removes price together with unit',async()=>{
  const s=setup();await s.send('Найди русскоязычного офлайн тренера город: Киев, до 50 € за занятие');
  await s.send('До 40 €');let p=s.searches().at(-1).body;assert.equal(p.budget,40);assert.equal(p.language,'ru');assert.equal(p.city,'Киев');assert.equal(p.sport,'Фитнес');assert.equal(p.goal,'Похудение');assert.deepEqual(p.soft_fields,['goal']);
  await s.send('Только онлайн');p=s.searches().at(-1).body;assert.equal(p.format,'Онлайн');assert.equal(p.city,undefined);assert.equal(p.budget,40);assert.equal(p.language,'ru');
  await s.send('Покажи франкоязычных');p=s.searches().at(-1).body;assert.equal(p.language,'fr');assert.equal(p.budget,40);assert.equal(p.format,'Онлайн');
  await s.send('Убери ограничение по цене');p=s.searches().at(-1).body;assert.equal(p.budget,undefined);assert.equal(p.period,undefined);assert.equal(p.language,'fr');
  await s.send('Только офлайн');p=s.searches().at(-1).body;assert.equal(p.city,'Киев');assert.equal(p.format,'Офлайн');
  assert.equal(s.searches().length,6);assert(!s.calls.some(c=>c.url.includes('api.openai.com')));assert(!s.calls.filter(c=>c.url.endsWith('/rpc/fgi_ai_complete')).some(c=>c.body.p_result.memory_patch));
});
test('4F repeated supported filter remains a valid search',async()=>{const s=setup();await s.send('Найди франкоязычного тренера');await s.send('Покажи франкоязычных');assert.equal(s.searches().length,2);});
test('4F cheaper means less than every displayed known comparable price',async()=>{const s=setup();await s.send('Найди тренера');const r=await s.send('Покажи дешевле');assert.equal(s.searches().at(-1).body.budget,34.99);assert.equal(s.searches().at(-1).body.period,'занятие');assert.equal(r.coach_search.status,'no_results');});
for(const rows of [[coach(10,{price:null})],[coach(10),coach(11,{period:'месяц'})],[]])test('4F unknown/mixed/empty prices ask for a ceiling without guessing',async()=>{const s=setup({rows});await s.send('Найди тренера');const r=await s.send('Покажи дешевле');assert.equal(r.coach_search.question,'cheaper');assert.equal(s.searches().length,1);await s.send('До 40 € за занятие');assert.equal(s.searches().at(-1).body.budget,40);});
test('4F cheaper than zero is impossible, not a negative budget',async()=>{const s=setup({rows:[coach(10,{price:0})]});await s.send('Найди тренера');const r=await s.send('Покажи дешевле');assert(r.answer.includes('0 €'));assert.equal(s.searches().length,1);});
test('4F budget without an earlier unit asks once and retains the other filters',async()=>{const s=setup();await s.send('Найди русскоязычного онлайн тренера');assert.equal((await s.send('До 40 €')).coach_search.question,'period');await s.send('За месяц');const p=s.searches().at(-1).body;assert.equal(p.budget,40);assert.equal(p.period,'месяц');assert.equal(p.language,'ru');assert.equal(p.format,'Онлайн');});
test('4F unsupported gender is never inferred and remains pending until explicitly removed',async()=>{const s=setup();await s.send('Найди русскоязычного тренера до 50 € за занятие');const r=await s.send('Хочу женщину-тренера');assert.equal(r.coach_search.question,'gender');assert(r.answer.includes('нет достоверного поля пола'));assert.equal(s.searches().length,1);await s.send('Только онлайн');assert.equal(s.searches().length,1);await s.send('Убери ограничение по полу');const p=s.searches().at(-1).body;assert.equal(p.budget,50);assert.equal(p.language,'ru');assert.equal(p.format,'Онлайн');assert(!Object.hasOwn(p,'gender'));});
for(const text of ['Только сертифицированных','Покажи розовых','Покажи италоязычных','Только для новичков'])test('4F unsupported condition: '+text,async()=>{const s=setup();await s.send('Найди тренера');const r=await s.send(text);assert.equal(r.coach_search.status,'needs_clarification');assert.equal(s.searches().length,1);});
for(const text of ['Сравни первого и второго','Кто из этих двух лучше подходит?','Почему у первого MATCH выше?'])test('4F comparison uses refreshed profiles and exact backend points: '+text,async()=>{const s=setup();await s.send('Найди тренера');const r=await s.send(text);assert.equal(s.searches().length,2);assert.equal(r.coach_search.presentation,'comparison');assert(r.answer.includes('MATCH 100% (50/50 баллов)'));assert(r.answer.includes('MATCH 60% (30/50 баллов)'));assert(r.answer.includes('недостаточно данных (0/20)'));assert(r.answer.includes('лучше подходит Тестовый тренер 10'));assert(!JSON.stringify(r).includes('SECRET'));assert(r.coach_search.coaches.every(c=>c.match.criteria.length===2));});
test('4F equal MATCH does not fabricate a winner',async()=>{const s=setup({rows:[coach(10),coach(11)]});await s.send('Найди тренера');assert((await s.send('Сравни первого и второго')).answer.includes('совместимость одинаковая'));});
test('4F comparison does not compare monthly and session prices directly',async()=>{const s=setup({rows:[coach(10),coach(11,{period:'месяц'})]});await s.send('Найди тренера');assert((await s.send('Сравни первого и второго')).answer.includes('цены напрямую не сравниваю'));});
test('4F changed/unpublished selected profile is not compared or shown again',async()=>{const s=setup();await s.send('Найди тренера');s.setRows([coach(10),coach(11,{published:false}),coach(12)]);const r=await s.send('Сравни первого и второго');assert(r.answer.includes('Результаты поиска изменились'));assert(!r.coach_search.ids.includes(id(11)));assert(!r.answer.includes('Тестовый тренер 11'));});
for(const rows of [[],[coach(10)]])test('4F fewer than two results gives an honest comparison refusal',async()=>{const s=setup({rows});await s.send('Найди тренера');const r=await s.send('Сравни первого и второго');assert(r.answer.includes('меньше двух'));assert.equal(s.searches().length,1);});
test('4F latest empty results invalidate older result ordinals',async()=>{const s=setup();await s.send('Найди тренера');await s.send('До 10 € за занятие');const r=await s.send('Сравни первого и второго');assert(r.answer.includes('меньше двух'));assert.equal(s.searches().length,2);});
test('4F a regular sports message retains the normal AI path and later search context',async()=>{const s=setup();await s.send('Найди русскоязычного тренера');assert.equal((await s.send('Как выполнять приседания?')).answer,'Обычный ответ');await s.send('Только онлайн');assert.equal(s.searches().at(-1).body.language,'ru');assert.equal(s.searches().length,2);});
test('4F opt-out removes fields sourced from memory, not explicit filters',async()=>{const s=setup();await s.send('Найди русскоязычного тренера');const q=await s.send('Без памяти');assert.equal(q.coach_search.question,'sport');await s.send('Фитнес');const p=s.searches().at(-1).body;assert.equal(p.goal,undefined);assert.equal(p.language,'ru');assert.equal(p.sport,'Фитнес');});
test('4F explicit goal overrides a soft remembered preference',async()=>{const s=setup();await s.send('Найди тренера');await s.send('Найди тренера для похудения');assert(!s.searches().at(-1).body.soft_fields.includes('goal'));});
test('4F state survives handler recreation using persisted message metadata',async()=>{const s=setup();await s.send('Найди онлайн тренера до 50 € за занятие');const history=JSON.parse(JSON.stringify(s.history()));const turn=coachTurn({message:'До 40 €',history,data:{sport:'yoga'}});assert.equal(turn.parameters.sport,'Фитнес');assert.equal(turn.parameters.budget,40);assert.equal(turn.parameters.format,'Онлайн');});
test('4F contexts are isolated by user, conversation and module',async()=>{const s=setup();await s.send('Найди русскоязычного тренера до 50 € за занятие');for(const extra of [{user:OTHER},{conversation:SECOND},{module:'nutrition'}]){const r=await s.send('Только онлайн',extra);assert.equal(r.coach_search.status,'needs_clarification');assert(!r.coach_search.parameters.budget);assert(!r.coach_search.parameters.language);}assert.equal(s.searches().length,1);await s.send('До 40 €');assert.equal(s.searches().at(-1).body.budget,40);});
test('4F user-role metadata cannot inject another user search or profiles',()=>{const r=coachTurn({message:'Сравни первого и второго',history:[{role:'user',coach_search:{schema_version:1,status:'results',parameters:{sport:'Фитнес'},coaches:[coach(10),coach(11)]}}]});assert(r.answer.includes('нет сохранённых результатов'));});
test('4F cancelled/new search discards previous conditions',async()=>{const s=setup();await s.send('Найди русскоязычного тренера до 50 € за занятие');await s.send('Отмени поиск');const r=await s.send('Только онлайн');assert.equal(r.coach_search.status,'needs_clarification');await s.send('Начни новый поиск тренера по йоге');const p=s.searches().at(-1).body;assert.equal(p.sport,'Йога');assert.equal(p.budget,undefined);assert.equal(p.language,undefined);});
test('4F bounded history safely asks for a search instead of hallucinating old results',()=>{const history=Array.from({length:40},(_,i)=>({role:i%2?'assistant':'user',body:'Обычный текст'}));assert(coachTurn({message:'Сравни первого и второго',history}).answer.includes('нет сохранённых результатов'));});
test('4F invalid MATCH proof fails closed',()=>{assert.throws(()=>coachCardSnapshot({id:id(10),name:'X',match:{percent:100,version:'2026-10-12',reasons:[],earned:30,total:30,criteria:[{key:'sport',label:'Спорт',weight:30,earned:0,status:'unknown'}]}}));});
test('4F comparison explanation remains fully visible above current cards',async()=>{const s=setup();await s.send('Найди тренера');const r=await s.send('Сравни первого и второго');const source=await readFile(new URL('../fitgoin-ai.js',import.meta.url),'utf8'),a=source.indexOf('  function messageHTML('),b=source.indexOf('\n  function ',a+5);const context=vm.createContext({coachCardsHTML,cleanCitations:()=>[],esc:s=>String(s),actor:USER,opts:{},t:x=>x,button:()=>'',savedIds:[],messages:[]});vm.runInContext(source.slice(a,b)+';globalThis.renderMessage=messageHTML',context);const html=context.renderMessage({role:'assistant',body:r.answer,coach_search:r.coach_search});assert(html.includes('недостаточно данных (0/20)'));assert(html.includes('data-ai-coach-id='));});
test('4F failed budget refinement and retry retain the new strict budget',async()=>{const s=setup();await s.send('Найди тренера до 50 € за занятие');s.setFail(true);assert.equal((await s.send('До 40 €')).coach_search.status,'unavailable');s.setFail(false);await s.send('Попробуй ещё раз');assert.equal(s.searches().at(-1).body.budget,40);});
test('4F comparison after failed refinement never restores an older budget',async()=>{const s=setup();await s.send('Найди тренера до 50 € за занятие');s.setFail(true);await s.send('До 40 €');s.setFail(false);const r=await s.send('Сравни первого и второго');assert.equal(s.searches().at(-1).body.budget,40);assert(r.answer.includes('Результаты поиска изменились'));});
test('4F a new incomplete search cannot compare results from an older search',async()=>{const s=setup();await s.send('Найди тренера');await s.send('Начни новый поиск тренера по йоге до 40 €');const r=await s.send('Сравни первого и второго');assert(r.answer.includes('нет сохранённых результатов'));assert.equal(s.searches().length,1);});
test('4F metadata stays within the existing 16 KB bound with three backend proofs',async()=>{const s=setup({rows:[coach(10),coach(11),coach(12)]});const r=await s.send('Найди русскоязычного офлайн тренера город: Киев, до 50 € за занятие');assert(Buffer.byteLength(JSON.stringify(r.coach_search))<16000);assert.equal(r.coach_search.coaches.length,3);});
