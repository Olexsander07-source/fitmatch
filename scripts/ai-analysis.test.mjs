import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisIntent,safetyNotice,analyzeProgress,progressTurn,applyProgressProposal} from '../fitgoin-ai-analysis.mjs';
import {programFacts,validateProgram} from '../fitgoin-ai-program.mjs';
import {providerDocument} from '../fitgoin-ai-workout.mjs';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
const U='e63e0000-0000-4000-8000-000000000001',C='e63e4000-0000-4000-8000-000000000001',P='e63e1000-0000-4000-8000-000000000001',R='e63e3000-0000-4000-8000-000000000001',NOW=new Date('2026-10-10T13:00:00Z');
export const facts=()=>({goal:'Сила',experience:'intermediate',days_per_week:1,minutes:40,setting:'gym',equipment:'Штанга, скамья',restrictions:'',memory_confirmed_fields:['restrictions'],weekdays:[1],language:'ru'});
export function plan(data=facts()){
 return {id:P,title:'Силовая A',revision:1,profile_snapshot:programFacts(data),document:{schema_version:2,title:'Силовая A',summary:'Существующая программа.',progression:'Постепенно, без отказа.',schedule:{mode:'weekdays',weekdays:[1],timezone:'UTC'},workouts:[{id:'w1',number:1,day:1,title:'Силовая A',objective:'Силовая подготовка',minutes:40,warmup:'Спокойная разминка, 5 минут.',cooldown:'Спокойное завершение, 3 минуты.',exercises:[{id:'e1',name:'Жим штанги лёжа',sets:3,reps:'10',rest_seconds:90,minutes:6,technique:'Контролируй движение.',alternative:'Отжимания от стены',required_equipment:'Штанга, скамья',alternative_equipment:'Без оборудования'}]}]}};
}
export function history(difficulties=[9,8,9]){
 const p=plan();return {today:'2026-10-10',start_on:'2026-09-13',days:28,timezone:'UTC',measurements:[{recorded_on:'2026-09-13',weight_kg:85.6},{recorded_on:'2026-09-27',weight_kg:84.3},{recorded_on:'2026-10-10',weight_kg:83.5}],workouts:{completed_count:difficulties.length,active_count:0,pain_stops:false,recent:difficulties.map((difficulty,i)=>({id:`e63e5000-0000-4000-8000-00000000000${i+1}`,revision:0,plan_id:P,completed_at:`2026-10-0${9-i}T10:00:00Z`,data:{status:'completed',difficulty,workout:{id:'w1',title:'Силовая A'},sets:Array.from({length:3},()=>({exercise_id:'e1',exercise:'Жим штанги лёжа',reps:10,weight_kg:80,comment:''}))}}))},schedule:{known_days:27,unknown_days:0,planned:4,matched:3,unlinked_count:0},exercise_trends:[],food:{entries:0,days:0,has_saved_menu:true}};
}
const turn=(h=history(),data=facts(),p=plan(),intent={kind:'analyze',days:28},message='Проанализируй мой прогресс',target)=>progressTurn({intent,message,history:h,data,plan:p,target,conversation:C,now:NOW});

test('3E actual span and decimal weights are calculated without assuming four complete weeks',()=>{
 const r=analyzeProgress(history(),facts(),plan());assert.equal(r.summary.weight_delta,-2.1);assert.match(r.answer,/снизился на 2,1 кг/);assert.match(r.answer,/2026-09-13 по 2026-10-10 \(27 дн/);
 const h=history();h.measurements=[{recorded_on:'2026-10-05',weight_kg:85},{recorded_on:'2026-10-10',weight_kg:84}];assert.match(analyzeProgress(h).answer,/\(5 дн/);assert.doesNotMatch(analyzeProgress(h).answer,/четыре недели/);
});
test('3E empty and same-day measurements cannot produce a weight trend',()=>{
 for(const measurements of [[],[{recorded_on:'2026-10-10',weight_kg:85}],[{recorded_on:'2026-10-10',weight_kg:85},{recorded_on:'2026-10-10',weight_kg:84}]]){const h=history([]);h.measurements=measurements;const r=analyzeProgress(h);assert.equal(r.summary.weight_delta,null);assert.match(r.answer,/динамик|Динамик/);assert.doesNotMatch(r.answer,/снизился|увеличился/);}
});
test('3E complete aggregate is not replaced by the twelve-row display sample',()=>{const h=history();h.workouts.completed_count=231;assert.equal(analyzeProgress(h).summary.completed_count,231);assert.match(analyzeProgress(h).answer,/интервал: 231/);});
test('3E exercise load trends compare only actual sessions with equal recorded sets and reps',()=>{const h=history([]),summary={sets_count:3,known_reps:3,known_weights:3,min_reps:8,max_reps:8};h.exercise_trends=[{name:'Жим лёжа',sessions:[{...summary,recorded_on:'2026-10-09',min_weight:80,max_weight:80},{...summary,recorded_on:'2026-09-27',min_weight:75,max_weight:75}]}];assert.match(analyzeProgress(h).answer,/изменение рабочего веса \+5 кг/);h.exercise_trends[0].sessions[0].known_weights=2;assert.match(analyzeProgress(h).answer,/сравнение нагрузки ненадёжно/);assert.doesNotMatch(analyzeProgress(h).answer,/\+5 кг/);});
test('3E known dated calendar can show a ratio; sequence or missing calendar never invents a denominator',()=>{
 const h=history();assert.match(analyzeProgress(h).answer,/3 из 4/);h.schedule={known_days:0,unknown_days:27,planned:0,matched:0};assert.match(analyzeProgress(h).answer,/не рассчитываю/);assert.doesNotMatch(analyzeProgress(h).answer,/из 4|из 12/);
});
test('3E unknown difficulty is not treated as zero or easy and breaks a heavy streak',()=>{const h=history([9,null,9]);assert.equal(analyzeProgress(h,facts(),plan()).proposal,null);assert.match(analyzeProgress(h).answer,/2 оценок/);});
test('3E three real heavy sessions propose a bounded volume reduction, never an automatic edit',()=>{
 const p=plan(),original=structuredClone(p),r=turn(history(),facts(),p);assert.equal(r.extra.program_edit_pending.operation,'reduce_volume');assert.deepEqual(r.extra.program_edit_pending.changes,[{workout_id:'w1',exercise_id:'e1',field:'sets',before:3,after:2}]);assert.equal(r.extra.kind,undefined);assert.deepEqual(p,original);assert.match(r.answer,/пока не изменена/);
});
test('3E refusing the proposal does not produce or overwrite a program',()=>{const initial=turn(),data={...facts(),program_edit_pending:initial.extra.program_edit_pending};const r=turn(history(),data,plan(),{kind:'decline'},'Не меняй программу');assert.equal(r.extra.program_edit_pending,null);assert.equal(r.extra.kind,undefined);assert.match(r.answer,/отменена/);});
test('3E confirmation returns a new version through the existing versioning contract and preserves the old document',()=>{
 const initial=turn(),p=plan(),old=structuredClone(p.document),data={...facts(),program_edit_pending:initial.extra.program_edit_pending},r=turn(history(),data,p,{kind:'confirm'},'Сохрани адаптацию');
 assert.equal(r.extra.kind,'training');assert.notEqual(r.extra.plan_id,P);assert.equal(r.extra.program_previous_id,P);assert.equal(r.extra.document.workouts[0].exercises[0].sets,2);assert.equal(r.extra.document.workouts[0].warmup,old.workouts[0].warmup);assert.equal(r.extra.document.workouts[0].cooldown,old.workouts[0].cooldown);assert.equal(r.extra.document.workouts[0].exercises[0].rest_seconds,90);assert.deepEqual(p.document,old);assert.equal(r.extra.program_edit_pending,null);validateProgram(providerDocument(r.extra.document),facts());
});
test('3E changed plan, profile, evidence, expired proposal, conversation or draft cannot be accepted',()=>{
 const initial=turn(),base={...facts(),program_edit_pending:initial.extra.program_edit_pending};
 for(const [data,p,h] of [[base,{...plan(),id:'e63e1000-0000-4000-8000-000000000002'},history()],[{...base,minutes:30},plan(),history()],[base,plan(),history([5,8,9])],[{...base,program_edit_pending:{...base.program_edit_pending,created_at:'2026-10-08T00:00:00Z'}},plan(),history()],[{...base,program_edit_pending:{...base.program_edit_pending,conversation_id:R}},plan(),history()]])assert.throws(()=>turn(h,data,p,{kind:'confirm'},'Сохрани адаптацию'),/progress_proposal_changed/);
 assert.throws(()=>turn(history(),base,plan(),{kind:'confirm'},'Сохрани адаптацию',{program_id:P,draft_id:R}),/progress_proposal_changed/);
});
test('3E JSONB key ordering does not invalidate an unchanged proposal or snapshot',()=>{const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,v])=>[k,reorder(v)])):v;const pending=reorder(turn().extra.program_edit_pending);assert.equal(turn(history(),{...facts(),program_edit_pending:pending},plan(),{kind:'confirm'},'Сохрани адаптацию').extra.kind,'training');});
test('3E light sessions without actually recorded targets cannot trigger progression',()=>{const h=history([2,3]);h.workouts.recent[0].data.sets=[];assert.equal(analyzeProgress(h,facts(),plan()).proposal,null);});
test('3E two light, recorded sessions propose one extra rep; technique and no-pain confirmation are necessary',()=>{
 const h=history([2,3]),initial=turn(h),data={...facts(),program_edit_pending:initial.extra.program_edit_pending};assert.equal(initial.extra.program_edit_pending.operation,'increase_reps');assert.equal(turn(h,data,plan(),{kind:'confirm'},'Да').extra.kind,undefined);
 assert.equal(turn(h,data,plan(),{kind:'confirm'},'Да, если техника уверенная и боли нет').extra.kind,undefined);
 const r=turn(h,data,plan(),{kind:'confirm'},'Подтверждаю прогрессию: техника уверенная, боли нет.');assert.equal(r.extra.document.workouts[0].exercises[0].reps,'11');assert.equal(r.extra.document.workouts[0].exercises[0].sets,3);
});
test('3E progression does not shorten rest or exceed the known time budget',()=>{const p=plan();p.document.workouts[0].minutes=40;p.document.workouts[0].exercises[0].minutes=32;assert.throws(()=>applyProgressProposal(p,facts(),{operation:'increase_reps',changes:[{workout_id:'w1',exercise_id:'e1',field:'reps',before:'10',after:'11'}]}),/invalid_plan/);});
test('3E a measured weight change can be analysed while equipment or schedule changes still block an old plan',()=>{const p=plan({...facts(),weight_kg:85}),d={...facts(),weight_kg:83.5};assert(analyzeProgress(history(),d,p).proposal);assert.equal(analyzeProgress(history(),{...d,equipment:'Гантели'},p).proposal,null);});
test('3E pain, injury restrictions, stopped-for-pain and active workouts block upward or downward automatic adaptation',()=>{
 for(const mutate of [h=>h.workouts.pain_stops=true,h=>h.workouts.active_count=1,h=>h.workouts.recent[0].data.comment='Колено болит',h=>h.measurements[0].notes='После занятия боль в колене']){const h=history([2,3]);mutate(h);assert.equal(analyzeProgress(h,facts(),plan()).proposal,null);}
 assert.equal(analyzeProgress(history([2,3]),{...facts(),needs_professional:true},plan()).proposal,null);
 assert.equal(analyzeProgress(history(),{...facts(),current_workout:{plan_id:P,workout_id:'w1',index:0}},plan()).proposal,null);
});
test('3E planned menu never proves adherence; partial actual food totals identify coverage and uncertainty',()=>{const h=history([]);h.food={entries:3,days:2,has_saved_menu:true,calories_low:2400,calories_high:3000,protein_g:120,fat_g:80,carbs_g:240};const s=analyzeProgress(h).answer;assert.match(s,/3 записей за 2 из 28/);assert.match(s.replace(/[\u00a0\u202f]/g,''),/1200–1500 ккал/);assert.match(s,/полнота дня не подтверждена/);assert.match(s,/не подтверждает, что ты его соблюдаешь/);});
test('3E plateau, rapid gain and target advice use dated measurements, not menu assumptions',()=>{
 const h=history([]);h.measurements=[{recorded_on:'2026-09-13',weight_kg:84},{recorded_on:'2026-09-27',weight_kg:84.1},{recorded_on:'2026-10-10',weight_kg:84}];assert.match(analyzeProgress(h).answer,/Прежде чем менять калорийность/);
 h.measurements.at(-1).weight_kg=90;assert.match(analyzeProgress(h).answer,/темп набора/);
 h.measurements.at(-1).weight_kg=80;assert.match(analyzeProgress(h,{goal:'Похудение',target:'До 80 кг'}).answer,/обновление цели/);assert.doesNotMatch(analyzeProgress(h,{goal:'Сила',target:'Жим 80 кг'}).answer,/обновление цели/);
});
test('3E missing or unlinked workouts can suggest a realistic calendar but do not assert the user skipped',()=>{const h=history([]);h.schedule={known_days:27,unknown_days:0,planned:12,matched:2,unlinked_count:0};assert.match(analyzeProgress(h,facts(),plan()).answer,/Если ты пропускал/);h.schedule.unlinked_count=1;assert.doesNotMatch(analyzeProgress(h,facts(),plan()).answer,/Если ты пропускал/);});
test('3E normal questions have no blanket medical warning; dangerous symptoms interrupt ordinary advice',()=>{
 assert.equal(safetyNotice('Проанализируй мой прогресс'),null);assert.equal(safetyNotice('Боли в груди нет, техника уверенная'),null);assert.equal(safetyNotice('У меня нет боли и травм'),null);
 for(const s of ['У меня сильная боль в груди','Я потерял сознание на тренировке','У меня резкая одышка','У меня серьёзная травма']){const r=safetyNotice(s);assert.equal(r.level,'urgent');assert(r.current);assert.match(r.answer,/срочная медицинская помощь/);}
 assert.equal(safetyNotice('У меня нет боли в колене, но сильная боль в груди').level,'urgent');
 assert.equal(safetyNotice('Что делать, если сильная боль в груди?').current,false);
});
test('3E analysis routing covers periods and approval while preserving a pending workout completion',()=>{
 assert.equal(analysisIntent('Проанализируй мой прогресс за 4 недели').days,28);assert.equal(analysisIntent('Сколько тренировок я сделал за 14 дней?').days,14);assert.equal(analysisIntent('Проанализируй вес за 90 дней').days,null);assert.equal(analysisIntent('Что мне сегодня есть?'),null);
 assert.equal(analysisIntent('Проанализируй мой прогресс за последние 14 дней').days,14);assert.equal(analysisIntent('Сколько тренировок я сделал за неделю?'),null);assert.equal(analysisIntent('Покажи изменение моего веса'),null);assert.equal(analysisIntent('Как изменился мой вес за четыре недели?').days,28);
 assert.equal(analysisIntent('Да',{program_edit_pending:{kind:'progress_analysis'},workout_log_pending:{mode:'completion'}}),null);
 assert.equal(analysisIntent('Подтверждаю завершение тренировки',{program_edit_pending:{kind:'progress_analysis'},workout_log_pending:{mode:'completion'}}),null);
 assert.equal(analysisIntent('Подтверждаю прогрессию: техника уверенная, боли нет',{program_edit_pending:{kind:'progress_analysis'}}).kind,'confirm');
});
test('3E an existing exercise replacement proposal is not overwritten by progress advice',()=>{const r=turn(history(),{...facts(),program_edit_pending:{mode:'proposal',replacements:[]}});assert.equal(r.extra.program_edit_pending,undefined);assert.match(r.answer,/Сначала прими или отмени/);});

function fixture({failure,cached=false,modules=['training','nutrition'],data=facts(),h=history(),p=plan(),sessions=[]}={}){
 const calls=[],json=(v,status=200)=>new Response(JSON.stringify(v),{status});
 const handle=createAIHandler({env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'},fetcher:async(url,o={})=>{
  const body=o.body?JSON.parse(o.body):null;calls.push({url,body});
  if(url.endsWith('/auth/v1/user'))return json({id:U});if(url.includes('/fgi_ai_profiles?'))return json([{data,consent_version:'2026-10-03',consented_at:'2026-10-09T10:00:00Z',updated_at:'2026-10-09T10:00:00Z'}]);
  if(url.includes('/fgi_ai_conversations?'))return json([{id:C}]);if(url.includes('/fgi_ai_plans?'))return json(p?[p]:[]);if(url.includes('/fgi_ai_workouts?'))return json(sessions);
  if(url.endsWith('/rpc/fgi_ai_access'))return json({modules,friend:true});if(url.endsWith('/rpc/fgi_ai_claim'))return json(failure==='quota'?{error:'daily_limit'}:cached?{cached:{answer:'Ранее сохранено',program_saved:true}}:{remaining:29});
  if(url.endsWith('/rpc/fgi_ai_progress_analysis'))return failure==='history'?json({},503):json(h);
  if(/\/rpc\/fgi_ai_(?:progress_complete|complete)$/.test(url))return failure==='commit'?json({},503):failure==='stale'?json({code:'P0001',message:'progress_proposal_changed'},400):json(null);
  if(url.endsWith('/rpc/fgi_ai_fail'))return json(null);throw Error('Unexpected provider call');
 }});
 return {calls,request:(message,extra={})=>handle(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer fixture',Origin:'https://fitgoin.com','Content-Type':'application/json'},body:JSON.stringify({action:'chat',module:'training',user_id:'forged',conversation_id:C,request_id:R,message,timezone:'UTC',...extra})}))};
}
test('3E actual handler verifies Auth owner and gates both data modules; no model is needed for calculations',async()=>{const f=fixture({modules:['training']}),r=await f.request('Проанализируй мой прогресс');assert.equal(r.status,200);const rpc=f.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_progress_analysis'));assert.equal(rpc.body.p_user,U);assert.equal(rpc.body.p_food,false);assert.equal(rpc.body.p_training,true);assert(!f.calls.some(c=>c.url.includes('api.openai')));});
test('3E actual handler does not acknowledge success after history or commit failure',async()=>{for(const failure of ['history','commit']){const f=fixture({failure}),r=await f.request('Проанализируй мой прогресс');assert.equal(r.status,503);assert.equal((await r.json()).error,'backend_unavailable');}});
test('3E actual handler gives safety priority over a weight write and ordinary analysis',async()=>{const f=fixture(),r=await f.request('У меня сильная боль в груди. Сегодня я вешу 84 кг, проанализируй прогресс');assert.equal(r.status,200);const saved=f.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_complete')).body.p_result;assert.equal(saved.memory_patch.needs_professional,true);assert.equal(saved.progress_record,undefined);assert.equal(saved.kind,null);assert(!f.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_progress_analysis')));});
test('3E urgent safety advice stops the real active cursor with a revision guard, without marking completion',async()=>{const f=fixture({sessions:[{id:R,revision:4,data:{status:'active'}}]}),r=await f.request('У меня резкая одышка');assert.equal(r.status,200);const saved=f.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_complete')).body.p_result;assert.deepEqual(saved.workout_changes,[{operation:'stop',session_id:R,revision:4,stopped_for_pain:true}]);assert.equal(saved.current_workout,null);assert.equal(saved.workout_completed,undefined);});
test('3E urgent advice remains visible on a quota or save failure without a false save claim',async()=>{for(const failure of ['quota','commit']){const f=fixture({failure}),r=await f.request('У меня сильная боль в груди');assert.equal(r.status,200);const body=await r.json();assert.match(body.answer,/срочная медицинская помощь/);assert.equal(body.answer_saved,false);assert.equal(body.safety_warning,true);assert.equal(body.program_saved,undefined);}});
test('3E actual handler uses guarded confirmation RPC, hides internal commands and maps stale state to 409',async()=>{
 const proposal=turn().extra.program_edit_pending;proposal.created_at=new Date().toISOString();const data={...facts(),program_edit_pending:proposal};
 const f=fixture({data}),r=await f.request('Сохрани адаптацию');assert.equal(r.status,200);assert.equal((await r.json()).analysis_change,undefined);assert(f.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_progress_complete')));
 const bad=fixture({data,failure:'stale'}),s=await bad.request('Сохрани адаптацию');assert.equal(s.status,409);assert.equal((await s.json()).error,'progress_proposal_changed');
});
test('3E confirmation replay cannot write another version or read another snapshot',async()=>{const f=fixture({cached:true}),r=await f.request('Сохрани адаптацию',{program_target:{program_id:P,draft_id:R}});assert.equal(r.status,200);assert(!f.calls.some(c=>/progress_complete|progress_analysis|\/rpc\/fgi_ai_complete$/.test(c.url)));});
test('3E a pending adaptation never steals the existing workout completion form',async()=>{
 const p=plan(),session={id:R,revision:0,plan_id:P,started_at:'2026-10-10T10:00:00Z',completed_at:null,data:{status:'active',workout:p.document.workouts[0],sets:[],reports:[],index:0}};
 const data={...facts(),program_edit_pending:turn().extra.program_edit_pending,current_workout:{plan_id:P,session_id:R,workout_id:'w1',index:0,started_at:session.started_at}};
 const f=fixture({data,sessions:[session]}),r=await f.request('Подтверждаю завершение тренировки',{workout_target:{session_id:R,revision:0},workout_payload:{operation:'complete',confirmed:true,duration_minutes:null,difficulty:9,comment:''}});
 assert.equal(r.status,200);assert.equal((await r.json()).workout_completed,R);assert(!f.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_progress_analysis')));assert(!f.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_progress_complete')));assert.equal(f.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_complete')).body.p_result.workout_changes[0].operation,'complete');
});
