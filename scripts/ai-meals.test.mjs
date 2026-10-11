import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
import {CONSENT_VERSION} from '../fitgoin-ai-core.mjs';
import {nutritionMemory} from '../fitgoin-ai-nutrition.mjs';
import {FOODS,createMealPlan,validateMealPlan,replaceFoods,mealIntent,mealsTurn,nutritionFacts} from '../fitgoin-ai-meals.mjs';

const USER='10000000-0000-4000-8000-000000000001',CONV='20000000-0000-4000-8000-000000000001';
const PROFILE={age:28,height_cm:180,weight_kg:80,activity:'light',goal:'Похудение',allergies:[],restrictions:'',days_per_week:3,nutrition_preferences:{meals_per_day:4}};
const items=d=>d.meals.flatMap(m=>m.items),plan=(data=PROFILE)=>createMealPlan(data).document;
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function harness(initial=PROFILE){
 const state={data:structuredClone(initial),updated:'2026-10-09T10:00:00.000Z',plans:[],calls:[],cache:new Map(),fault:null,completions:0};
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:'server-only',AI_BILLING_MODE:'test',OPENAI_API_KEY:''};
 const fetcher=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;state.calls.push({url,body});
  if(url.endsWith('/auth/v1/user'))return json({id:USER});
  if(url.includes('/fgi_ai_profiles?'))return json([{data:state.data,updated_at:state.updated,consented_at:'2026-10-09T09:00:00.000Z',consent_version:CONSENT_VERSION}]);
  if(url.includes('/fgi_ai_conversations?'))return json([{id:CONV}]);
  if(url.includes('/fgi_ai_plans?'))return state.fault==='read'?json({error:'offline'},503):json(url.includes('kind=eq.nutrition')?state.plans.filter(p=>p.status==='active'):[]);
  if(url.endsWith('/rpc/fgi_ai_access'))return json({modules:['training','nutrition'],friend:true});
  if(url.endsWith('/rpc/fgi_ai_claim')){const old=state.cache.get(body.p_id);if(old)return json(old.hash!==body.p_hash?{error:'request_conflict'}:old.result?{cached:old.result}:{error:'request_pending'});state.cache.set(body.p_id,{hash:body.p_hash});return json({remaining:29,search_remaining:3});}
  if(url.endsWith('/rpc/fgi_ai_complete')){
   if(state.fault==='write')return json({error:'offline'},503);
   state.completions++;const r=body.p_result;
   if(r.memory_patch)Object.assign(state.data,r.memory_patch);
   if(Object.hasOwn(r,'nutrition_plan_pending'))state.data.nutrition_plan_pending=r.nutrition_plan_pending;
   if(body.p_kind==='nutrition'){const old=state.plans.find(p=>p.status==='active');if(old)old.status='archived';state.plans.push({id:r.plan_id,kind:'nutrition',status:'active',revision:state.plans.length+1,document:body.p_document,profile_snapshot:r.profile_snapshot});}
   state.updated=new Date(Date.parse(state.updated)+1).toISOString();state.cache.get(body.p_id).result=structuredClone(r);return json(null);
  }
  if(url.endsWith('/rpc/fgi_ai_fail'))return json(null);
  throw Error('Unexpected external call '+url);
 };
 const handle=createAIHandler({env,fetcher});
 const request=(message,extra={})=>handle(new Request('https://test.supabase.co/functions/v1/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer actual-verification-required',Origin:'https://fitgoin.com','Content-Type':'application/json'},body:JSON.stringify({action:'chat',module:'nutrition',message,conversation_id:CONV,request_id:randomUUID(),...extra})}));
 return {state,request};
}
test('all requested Russian menu intents and explicit confirmations are recognized',()=>{
 for(const s of ['Составь мне питание','Что мне сегодня есть?','Составь меню на день','Хочу похудеть','Хочу набрать массу'])assert.equal(mealIntent(s),'create');
 for(const s of ['Замени курицу','Я не люблю овсянку','У меня нет риса','Сделай дешевле','Сделай быстрее в приготовлении','Я не ем рыбу'])assert.equal(mealIntent(s),'replace');
 assert.equal(mealIntent('Сохрани рацион'),'confirm');assert.equal(mealIntent('Да'),null);assert.equal(mealIntent('Например, составь меню'),null);assert.equal(mealIntent('Я не ем рыбу?'),null);
});
test('2–8 saved meal counts produce realistic bounded portions with coherent daily totals',()=>{
 for(const n of [2,3,4,5,6,7,8]){const p={...PROFILE,nutrition_preferences:{meals_per_day:n}},d=plan(p);assert.equal(d.meals.length,n);assert.equal(validateMealPlan(d,p).calories,d.calories);assert.equal(d.calories,Math.round(d.protein_g*4+d.fat_g*9+d.carbs_g*4));assert(Math.abs(d.calories-d.targets.calories)<d.targets.calories*.02);assert(Math.abs(d.protein_g-d.targets.protein_g)<8);assert.equal(new Set(items(d).map(x=>x.id)).size,items(d).length);for(const x of items(d)){assert(x.quantity_g>=FOODS[x.food_id].min&&x.quantity_g<=FOODS[x.food_id].max);assert(x.weight_basis);assert.equal(x.calories,Math.round(x.protein_g*4+x.fat_g*9+x.carbs_g*4));}}
});
test('a single saved meal asks for a practical count without inventing a fasting diet',()=>{
 const r=createMealPlan({...PROFILE,nutrition_preferences:{meals_per_day:1}});assert.equal(r.status,'missing');assert.deepEqual(r.missing,['meals_per_day']);assert.equal(r.document,undefined);
});
test('extra meals are edible snacks and never a portion of cooking oil on its own',()=>{
 for(const diet of ['', 'Я веган'])for(const n of [5,6,7,8]){
  const data={...PROFILE,diet,nutrition_preferences:{meals_per_day:n}},d=plan(data);
  assert.equal(d.meals.length,n);validateMealPlan(d,data);
  for(const m of d.meals)assert(m.items.some(x=>!['olive_oil','sunflower_oil'].includes(x.food_id)));
 }
});
test('a broad fish exclusion also replaces salmon, without excluding a positive fish preference',()=>{
 const p={...PROFILE,diet:'Люблю рыбу'},d=plan(p);
 assert(items(d).some(x=>FOODS[x.food_id].animal==='fish'));
 const fish=d.meals.find(m=>m.items.some(x=>x.food_id==='white_fish')),x=fish.items.find(x=>x.food_id==='white_fish');
 const salmon=replaceFoods(d,p,'Замени рыбу на лосось',{meal_id:fish.id,item_id:x.id}).document;
 const result=mealsTurn(p,'Я не ем рыбу','chat','nutrition',{id:randomUUID(),document:salmon});
 assert(!items(result.extra.nutrition_plan_pending.document).some(x=>FOODS[x.food_id].animal==='fish'));
});
test('a completed menu clears an older pending calorie calculation atomically',()=>{
 const r=mealsTurn({...PROFILE,nutrition_pending:true},'Составь меню на день','chat','nutrition',null);
 assert.equal(r.extra.memory_patch.nutrition_pending,false);assert.equal(r.extra.nutrition_plan_pending.mode,'proposal');
});
test('saved exclusions, vegan preferences and allergy categories are respected in every ingredient',()=>{
 for(const p of [{...PROFILE,diet:'Я веган'},{...PROFILE,diet:'Я вегетарианец'},{...PROFILE,diet:'Не люблю овсянку'},{...PROFILE,nutrition_preferences:{excluded_foods:['рыба','курица'],meals_per_day:3}},{...PROFILE,allergies:['milk','egg','fish','nuts','gluten']}]){const d=plan(p);validateMealPlan(d,p);assert(items(d).every(x=>!x.allergens.some(a=>p.allergies.includes(a))));if(p.diet==='Я веган')assert(items(d).every(x=>!FOODS[x.food_id].animal));if(p.diet==='Не люблю овсянку')assert(!items(d).some(x=>x.food_id==='oats'));if(p.nutrition_preferences.excluded_foods)assert(!items(d).some(x=>['white_fish','salmon','chicken'].includes(x.food_id)));}
});
test('goals use the 3A nutrition goal, keep the sports goal and adjust the estimated menu',()=>{
 const lose=mealsTurn(PROFILE,'Хочу похудеть','chat','nutrition',null),gain=mealsTurn(PROFILE,'Хочу набрать массу','chat','nutrition',null);
 assert(gain.extra.nutrition_plan_pending.document.calories>lose.extra.nutrition_plan_pending.document.calories);
 assert.equal(gain.extra.memory_patch.nutrition_preferences.goal,'gain');assert.equal(gain.extra.memory_patch.goal,undefined);assert.equal(PROFILE.goal,'Похудение');
});
test('missing facts ask at most two questions and explicit facts resume a pending menu',()=>{
 const turn=mealsTurn({},'Составь меню на день','chat','nutrition',null);assert.equal(turn.extra.nutrition_plan_pending.mode,'request');assert.equal((turn.answer.match(/\?/g)||[]).length,2);
 const next=mealsTurn({nutrition_plan_pending:turn.extra.nutrition_plan_pending},'Мне 28 лет. Рост 180 см. Вес 80 кг. Моя общая активность — умеренная. Моя цель в питании — поддержание веса','chat','nutrition',null);assert.equal(next.extra.nutrition_plan_pending.mode,'proposal');
});
test('clinical profiles, minors and extreme calorie requests never produce a menu',()=>{
 for(const p of [{...PROFILE,age:17},{...PROFILE,needs_professional:true},{...PROFILE,restrictions:'Беременность'}])assert.equal(createMealPlan(p).status,'professional');
 assert.equal(createMealPlan(PROFILE,null,'Составь меню на 900 ккал').status,'professional');
});
test('a one-product replacement preserves all other exact ingredient objects and accepted menu',()=>{
 const d=plan(),copy=structuredClone(d),r=replaceFoods(d,PROFILE,'Замени курицу');assert.equal(r.changes.length,1);const changed=r.changes[0].item_id;
 for(const x of items(d))if(x.id!==changed)assert.deepEqual(items(r.document).find(y=>y.id===x.id),x);
 assert.deepEqual(d,copy);assert(Math.abs(r.document.calories-d.calories)<30);assert(Math.abs(r.document.protein_g-d.protein_g)<5);validateMealPlan(r.document,PROFILE);
});
test('temporary unavailable rice is replaced without adding a permanent exclusion',()=>{
 const first=mealsTurn(PROFILE,'Составь меню на день','chat','nutrition',null),p={...PROFILE,nutrition_plan_pending:first.extra.nutrition_plan_pending};
 const r=mealsTurn(p,'У меня нет риса','chat','nutrition',null);assert.equal(r.extra.memory_patch,undefined);assert.equal(r.extra.memory_saved,false);assert(!items(r.extra.nutrition_plan_pending.document).some(x=>x.food_id==='rice'));assert.deepEqual(PROFILE.nutrition_preferences,{meals_per_day:4});
});
test('permanent dislike and fish exclusion update food memory while preserving the accepted plan',()=>{
 for(const message of ['Я не люблю овсянку','Я не ем рыбу']){const d=plan(),current={id:randomUUID(),document:d},r=mealsTurn(PROFILE,message,'chat','nutrition',current);assert.equal(r.extra.kind,undefined);assert.equal(r.extra.memory_saved,true);assert(r.extra.memory_patch.nutrition_preferences.excluded_foods.length);assert.deepEqual(current.document,d);validateMealPlan(r.extra.nutrition_plan_pending.document,{...PROFILE,...r.extra.memory_patch});}
});
test('cheaper and faster replace eligible ingredients without regenerating the menu or losing balance',()=>{
 const d=plan();for(const msg of ['Сделай дешевле','Сделай быстрее в приготовлении']){const r=replaceFoods(d,PROFILE,msg);assert(r.changes.length>0);const ids=new Set(r.changes.map(x=>x.item_id));for(const x of items(d))if(!ids.has(x.id))assert.deepEqual(items(r.document).find(y=>y.id===x.id),x);assert(Math.abs(r.document.calories-d.calories)<d.calories*.1);assert(Math.abs(r.document.protein_g-d.protein_g)<12);validateMealPlan(r.document,PROFILE);}
});
test('specified replacements disclose substantial differences rather than claiming identical macros',()=>{
 const d=plan(),r=replaceFoods(d,PROFILE,'Замени курицу на фасоль');assert.match(r.answer,/Разница за день/);assert.match(r.answer,/заметно отличается/);assert.equal(r.changes.length,1);
});
test('an explicit unrelated food cannot replace a protein portion with pure oil',()=>{
 const d=plan(),copy=structuredClone(d),r=replaceFoods(d,PROFILE,'Замени курицу на оливковое масло');
 assert.equal(r.document,undefined);assert.deepEqual(d,copy);
});
test('ambiguous food occurrences require a precise card target',()=>{
 const d=plan();assert.equal(replaceFoods(d,PROFILE,'Замени овощи').document,undefined);const m=d.meals.find(x=>x.items.some(y=>y.food_id==='vegetables')),x=m.items.find(x=>x.food_id==='vegetables');const r=replaceFoods(d,PROFILE,'Замени этот продукт',{meal_id:m.id,item_id:x.id});assert.equal(r.document,undefined,'No other vegetable is in the bounded catalogue; do not invent one');assert.throws(()=>replaceFoods(d,PROFILE,'Замени продукт',{meal_id:'foreign',item_id:'foreign'}),/nutrition_plan_changed/);
});
test('stored JSONB key order is harmless while fake food composition and portions are rejected',()=>{
 const d=plan(),reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reorder(v[k])])):v;assert.deepEqual(validateMealPlan(reorder(d),PROFILE),d);
 for(const mutate of [x=>x.meals[0].items[0].protein_g=999,x=>x.meals[0].items[0].quantity_g=-1,x=>x.meals[0].items[0].food_id='provider-fantasy',x=>x.calories=900,x=>x.meals[0].items[0].allergens=[],x=>x.targets.calories=4500]){const copy=structuredClone(d);mutate(copy);assert.throws(()=>validateMealPlan(copy,PROFILE));}
});
test('confirmation requires a current draft and meaningful profile snapshot; casual answers do not accept',()=>{
 const a=mealsTurn(PROFILE,'Составь меню на день','chat','nutrition',null),p={...PROFILE,nutrition_plan_pending:a.extra.nutrition_plan_pending};assert.equal(mealsTurn(p,'Да','chat','nutrition',null),null);assert.equal(mealsTurn(p,'Сохрани рацион','chat','nutrition',null).extra.nutrition_saved,true);
 assert.throws(()=>mealsTurn({...p,weight_kg:85},'Сохрани рацион','chat','nutrition',null),/nutrition_plan_changed/);assert.throws(()=>mealsTurn(p,'Сохрани рацион','chat','nutrition',{id:randomUUID()}),/nutrition_plan_changed/);
 const r=mealsTurn(p,'Отмени черновик','chat','nutrition',null);assert.equal(r.extra.nutrition_plan_pending,null);assert.equal(r.extra.kind,undefined);
});
test('handler create → replace → confirm stores one accepted plan and exact nonce replay creates no duplicate',async()=>{
 const h=harness(),r1=await h.request('Составь меню на день');assert.equal(r1.status,200);assert.equal(h.state.plans.length,0);const first=structuredClone(h.state.data.nutrition_plan_pending.document);
 assert.equal((await h.request('Замени курицу')).status,200);const edited=structuredClone(h.state.data.nutrition_plan_pending.document);assert.notDeepEqual(edited,first);assert.equal(h.state.plans.length,0);
 const request_id=randomUUID(),confirm=await h.request('Сохрани рацион',{request_id});assert.equal(confirm.status,200);assert.equal((await confirm.json()).nutrition_saved,true);assert.equal(h.state.plans.length,1);assert.deepEqual(h.state.plans[0].document,edited);assert.equal(h.state.data.nutrition_plan_pending,null);
 const completes=h.state.completions,retry=await h.request('Сохрани рацион',{request_id});assert.equal(retry.status,200);assert.equal(h.state.completions,completes);assert.equal(h.state.plans.length,1);
 assert.equal((await h.request('Сохрани рацион')).status,200);assert.equal(h.state.plans.length,1);
 assert(!h.state.calls.some(x=>x.url.includes('api.openai.com')));
});
test('subsequent changes keep the accepted version until confirmation then archive it',async()=>{
 const h=harness();await h.request('Составь меню на день');await h.request('Сохрани рацион');const original=structuredClone(h.state.plans[0].document);
 await h.request('У меня нет риса');assert.deepEqual(h.state.plans[0].document,original);await h.request('Сохрани рацион');assert.equal(h.state.plans.length,2);assert.equal(h.state.plans[0].status,'archived');assert.equal(h.state.plans[1].status,'active');assert.equal(h.state.plans[1].revision,2);assert.deepEqual(h.state.plans[0].document,original);
});
test('database read and commit failures cannot report acceptance or replace the active version',async()=>{
 const h=harness();await h.request('Составь меню на день');await h.request('Сохрани рацион');const active=structuredClone(h.state.plans);
 h.state.fault='read';const read=await h.request('Составь меню на день');assert.equal(read.status,503);assert.equal((await read.json()).error,'backend_unavailable');assert.deepEqual(h.state.plans,active);
 h.state.fault=null;await h.request('Замени курицу');h.state.fault='write';const save=await h.request('Сохрани рацион');assert.equal(save.status,503);assert.equal((await save.json()).nutrition_saved,undefined);assert.deepEqual(h.state.plans,active);assert.equal(h.state.data.nutrition_plan_pending.mode,'proposal');
});
test('card targets are bound into nonce hashes and stale targets cannot confirm another draft',async()=>{
 const h=harness();await h.request('Составь меню на день');const target={plan_id:null,draft_id:h.state.data.nutrition_plan_pending.id},request_id=randomUUID();assert.equal((await h.request('Сохрани рацион',{request_id,nutrition_target:target})).status,200);
 const altered=await h.request('Сохрани рацион',{request_id,nutrition_target:{...target,draft_id:randomUUID()}});assert.equal(altered.status,409);assert.equal((await altered.json()).error,'request_conflict');
 await h.request('Составь меню на день');assert.equal((await h.request('Сохрани рацион',{nutrition_target:target})).status,409);assert.equal(h.state.plans.length,1);
});
