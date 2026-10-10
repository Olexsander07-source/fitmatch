import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {parseExerciseResult,completionDetails,exerciseDetails,validateWorkoutInput,workoutLogIntent,workoutLogTurn,chooseWorkoutSession} from '../fitgoin-ai-workout-log.mjs';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
globalThis.crypto??=webcrypto;
const U='e63c0000-0000-4000-8000-000000000001',P='e63c1000-0000-4000-8000-000000000001',S='e63c2000-0000-4000-8000-000000000001',R='e63c3000-0000-4000-8000-000000000001',C='e63c4000-0000-4000-8000-000000000001';
const data={goal:'Сила',experience:'intermediate',days_per_week:1,minutes:40,setting:'gym',equipment:'Штанга, скамья',restrictions:'',memory_confirmed_fields:['restrictions']};
const workout={id:'w1',number:1,title:'Тренировка A',minutes:40,warmup:'Разминка',cooldown:'Завершение',exercises:[{id:'e1',name:'Жим штанги лёжа',sets:4,reps:'8',rest_seconds:90,technique:'Контроль движения',alternative:'Отжимания'},{id:'e2',name:'Жим стоя',sets:3,reps:'10',rest_seconds:60,technique:'Без боли',alternative:'Жим гантелей'}]};
const plan={id:P,status:'active',kind:'training',document:{workouts:[workout],schedule:{mode:'sequence'}},profile_snapshot:data};
const session=()=>({id:S,user_id:U,plan_id:P,revision:0,started_at:'2026-10-10T08:00:00Z',completed_at:null,data:{status:'active',workout:structuredClone(workout),index:0,sets:[],reports:[]}});
const turn=(intent,message,extra={})=>workoutLogTurn({plan,data,sessions:[session()],message,intent,requestId:R,...extra});

test('3C parses actual grouped results and decimal working weight',()=>{
 assert.deepEqual(parseExerciseResult('Жим лёжа 80 кг, 4 подхода по 8'),{name:'жим лежа',sets:4,reps:8,weight_kg:80,rpe:null,comment:''});
 assert.equal(parseExerciseResult('Жим лёжа 82,5 кг, 4 × 8; комментарий: уверенно').weight_kg,82.5);
 assert.equal(parseExerciseResult('Жим лёжа 4x8').weight_kg,null);
});
test('3C examples, another person, future plans and questions are not logged',()=>{
 for(const s of ['Например: Жим лёжа 80 кг, 4 подхода по 8','Мой друг: Жим лёжа 80 кг, 4 подхода по 8','Буду жим лёжа 4x8','Хочу жим лёжа 4x8','Как жать 80 кг 4x8?'])assert.equal(parseExerciseResult(s),null,s);
 assert.equal(workoutLogIntent('Я не закончил тренировку'),null);
});
test('3C rejects invalid actual values without substituting defaults',()=>{
 for(const s of ['Жим лёжа -80 кг, 4x8','Жим лёжа 80 кг, 0x8','Жим лёжа 80 кг, 4x0','Жим лёжа 800 кг, 4x8','Жим лёжа 80 кг, 21x8'])assert.throws(()=>parseExerciseResult(s),/invalid_workout_result/);
 assert.deepEqual(completionDetails({}),{duration_minutes:null,difficulty:null,comment:''});
 assert.equal(exerciseDetails({sets:1,reps:8}).rpe,null);
 for(const v of [{difficulty:0},{difficulty:11},{duration_minutes:0},{duration_minutes:2000},{difficulty:7.5}])assert.throws(()=>completionDetails(v),/invalid_workout_result/);
});
test('3C validates structured forms, own targets and explicit confirmation',()=>{
 validateWorkoutInput({session_id:S,exercise_id:'e1',revision:0},{operation:'record',sets:1,reps:8});
 assert.throws(()=>validateWorkoutInput({user_id:U},{}),/invalid_workout_result/);
 assert.throws(()=>validateWorkoutInput({session_id:'invalid'}),/invalid_workout_result/);
 assert.throws(()=>validateWorkoutInput({}, {operation:'complete',confirmed:false}),/confirmation_required/);
 assert.throws(()=>validateWorkoutInput({}, {operation:'complete',confirmed:true,duration_minutes:10,user_id:U}),/invalid_workout_result/);
});
test('3C chat completion is a proposal until separately confirmed',()=>{
 const p=turn('prepare_completion','Я закончил тренировку');
 assert.equal(p.extra.workout_changes.length,0);assert.equal(p.extra.workout_log_pending.mode,'completion');
 assert.deepEqual(p.extra.workout_log_pending.details,{duration_minutes:null,difficulty:null,comment:''});
 const saved=turn('complete','Подтверждаю завершение тренировки',{data:{...data,workout_log_pending:p.extra.workout_log_pending}});
 assert.equal(saved.extra.workout_changes[0].operation,'complete');assert.equal(saved.extra.current_workout,null);
 assert.equal(saved.extra.workout_changes[0].duration_minutes,null);
 assert.equal(workoutLogIntent('да',{...data,workout_log_pending:p.extra.workout_log_pending}),'complete');
 assert.notEqual(workoutLogIntent('да',{...data,workout_log_pending:p.extra.workout_log_pending,program_edit_pending:{mode:'proposal'}}),'complete');
});
test('3C completion stores only explicitly supplied duration, difficulty and comment',()=>{
 const t=turn('prepare_completion','Я закончил тренировку за 45 минут, сложность 8/10; комментарий: хорошо');
 assert.deepEqual(t.extra.workout_log_pending.details,{duration_minutes:45,difficulty:8,comment:'хорошо'});
 assert.match(turn('complete','Сохрани тренировку').answer,/Сначала/);
});
test('3C stale confirmations cannot discard newer exercise results',()=>{
 const pending=turn('prepare_completion','Я закончил тренировку').extra.workout_log_pending;
 const row=session();row.revision=1;
 assert.throws(()=>turn('complete','Подтверждаю завершение тренировки',{sessions:[row],data:{...data,workout_log_pending:pending}}),/workout_changed/);
 assert.throws(()=>turn('record','Жим лёжа 4x8',{target:{session_id:S,revision:99}}),/workout_changed/);
});
test('3C repeated completion uses the existing completed record',()=>{
 const row=session();row.completed_at='2026-10-10T09:00:00Z';row.data.status='completed';
 const t=turn('prepare_completion','Я закончил тренировку',{sessions:[row]});assert.match(t.answer,/уже завершена/);assert.equal(t.extra.workout_changes,undefined);
 const explicit=turn('complete','Подтверждаю завершение тренировки',{sessions:[row],target:{session_id:S},payload:{operation:'complete',confirmed:true}});assert.match(explicit.answer,/уже завершена/);
 const staleCursor=turn('prepare_completion','Я закончил тренировку',{sessions:[row],data:{...data,current_workout:{plan_id:P,workout_id:'w1',index:0,session_id:S,started_at:row.started_at}}});assert.equal(staleCursor.extra.workout_changes,undefined);assert.match(staleCursor.answer,/уже завершена/);
});
test('3C exercise result is tied to the actual snapshot and does not change a program',()=>{
 const before=structuredClone(plan),t=turn('record','Жим лёжа 80 кг, 4 подхода по 8');
 assert.equal(t.extra.workout_changes[0].exercise_id,'e1');assert.equal(t.extra.workout_changes[0].sets,4);assert.equal(t.extra.workout_changes[0].session_id,S);assert.deepEqual(plan,before);
});
test('3C ambiguous exercise and workout require clarification without writing results',()=>{
 const ambiguous=turn('record','Жим 80 кг, 4 подхода по 8');assert.match(ambiguous.answer,/несколько/);assert.equal(ambiguous.extra.workout_changes,undefined);
 const missing=turn('record','Присед 80 кг, 4 подхода по 8');assert.match(missing.answer,/Не нашёл/);
 const other=session();other.id=R;assert.equal(chooseWorkoutSession([session(),other],{}).choices.length,2);
 const t=turn('record','Жим лёжа 4x8',{sessions:[session(),other]});assert.equal(t.extra.workout_changes,undefined);assert.match(t.answer,/несколько незавершённых/);
 assert.throws(()=>chooseWorkoutSession([session()],{}, {session_id:R}),/workout_changed/);
});
test('3C repeated grouped report is not appended but genuine form sets remain appendable',()=>{
 const row=session();row.data.reports=[{exercise_id:'e1',sets:4,reps:8,weight_kg:80,rpe:null,comment:'',source:'chat'}];
 const t=turn('record','Жим лёжа 80 кг, 4 подхода по 8',{sessions:[row]});assert.match(t.answer,/уже записан/);assert.equal(t.extra.workout_changes,undefined);
 assert.equal(turn('record','Записать',{sessions:[row],target:{exercise_id:'e1'},payload:{operation:'record',sets:1,reps:8,weight_kg:80}}).extra.workout_changes[0].source,'form');
});
test('3C starting the open workout resumes its sets instead of creating a second session',()=>{
 const t=turn('start','Начинаем тренировку 1');assert.match(t.answer,/Продолжаем/);assert.equal(t.extra.workout_changes,undefined);assert.equal(t.extra.current_workout.session_id,S);
 const legacy={...data,current_workout:{plan_id:P,workout_id:'w1',index:1,started_at:'2026-10-10T08:00:00Z'}};
 const promoted=turn('prepare_completion','Я закончил тренировку',{sessions:[],data:legacy});assert.equal(promoted.extra.workout_changes[0].from_cursor,true);assert.equal(promoted.extra.workout_log_pending.session_revision,0);
});
test('3C next/stop preserve actual sets and stop does not mark completed',()=>{
 assert.equal(turn('next','Что дальше?').extra.workout_changes[0].index,1);
 const t=turn('stop','Останови тренировку');assert.equal(t.extra.workout_changes[0].operation,'stop');assert.match(t.answer,/не отмечено выполненным/);
 assert.equal(turn('cancel_completion','Отмени завершение').extra.workout_log_pending,null);
});
test('3C legacy guided exercises without IDs use stable indices in the same stored snapshot',()=>{
 const row=session();delete row.data.workout.exercises[0].id;
 const t=turn('record','Жим лёжа 80 кг, 4 подхода по 8',{sessions:[row]});assert.equal(t.extra.workout_changes[0].exercise_id,'legacy-exercise-0');assert.equal(row.data.workout.exercises[0].id,undefined);
});
test('3C completion commands do not hijack existing program replacement confirmations',()=>{
 assert.equal(workoutLogIntent('Подтверждаю замену в тренировке'),null);assert.equal(workoutLogIntent('Сохрани изменения программы тренировок'),null);
 const t=turn('next','Что дальше?',{data:{...data,needs_professional:true}});assert.match(t.answer,/пересмотра/);assert.equal(t.extra.workout_changes,undefined);
});
function handlerFixture({failure=false}={}){
 const calls=[];const fetcher=async(url,o={})=>{const body=o.body?JSON.parse(o.body):null;calls.push({url,body});const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
  if(url.endsWith('/auth/v1/user'))return json({id:U});if(url.includes('/fgi_ai_profiles?'))return json([{data,consent_version:'2026-10-03',consented_at:'2026-10-10T07:00:00Z',updated_at:'2026-10-10T07:00:00Z'}]);
  if(url.includes('/fgi_ai_conversations?'))return json([{id:C}]);if(url.includes('/fgi_ai_plans?'))return json([plan]);if(url.includes('/fgi_ai_workouts?'))return json([session()]);
  if(url.endsWith('/rpc/fgi_ai_access'))return json({modules:['training'],friend:true});if(url.endsWith('/rpc/fgi_ai_claim'))return json({remaining:29});
  if(url.endsWith('/rpc/fgi_ai_complete'))return json(failure?{code:'P0001',message:'workout_changed'}:null,failure?400:200);
  if(url.endsWith('/rpc/fgi_ai_fail'))return json(null);throw Error('unexpected model or endpoint');
 };const handler=createAIHandler({env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',OPENAI_API_KEY:''},fetcher});
 return {calls,request:(more={})=>handler(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer fixture',Origin:'https://fitgoin.com','Content-Type':'application/json'},body:JSON.stringify({action:'chat',module:'training',conversation_id:C,request_id:R,message:'Жим лёжа 80 кг, 4 подхода по 8',...more})}))};
}
test('3C actual handler records through one atomic RPC without any model call',async()=>{
 const f=handlerFixture(),response=await f.request(),out=await response.json();assert.equal(response.status,200);assert.equal(out.workout_recorded,S);assert.equal(out.workout_changes,undefined);
 const rpc=f.calls.find(c=>c.url.endsWith('/rpc/fgi_ai_complete'));assert.equal(rpc.body.p_user,U);assert.equal(rpc.body.p_result.workout_changes[0].sets,4);assert(f.calls.filter(c=>c.url.includes('/fgi_ai_workouts?')).every(c=>c.url.includes(`user_id=eq.${U}`)));
});
test('3C actual handler reports a stale or foreign session as failure, never saved',async()=>{
 const f=handlerFixture({failure:true}),r=await f.request();assert.equal(r.status,409);assert.equal((await r.json()).error,'workout_changed');assert(f.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_fail')));
 const foreign=handlerFixture(),r2=await foreign.request({workout_target:{session_id:R}});assert.equal(r2.status,409);assert(!foreign.calls.some(c=>c.url.endsWith('/rpc/fgi_ai_complete')));
});
