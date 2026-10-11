import test from 'node:test';
import assert from 'node:assert/strict';
import {localDay,validMeasurementDate,progressIntent,weightRecord,historyAnswer} from '../fitgoin-ai-progress.mjs';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
const NOW=new Date('2026-10-10T22:30:00Z'),U='e63d0000-0000-4000-8000-000000000001',C='e63d4000-0000-4000-8000-000000000001',R='e63d3000-0000-4000-8000-000000000001';
const row=(id,date,status='completed',sets=[])=>({id,completed_at:date,data:{status,workout:{title:'Силовая A'},sets}});
test('3D recognises every required history command without conflating planned frequency',()=>{
 for(const [text,kind] of [['Сегодня я вешу 84 кг','record_weight'],['Запиши мой вес 83,5 кг','record_weight'],['Сколько я весил раньше?','weights'],['Покажи изменение моего веса','weights'],['Когда я тренировался последний раз?','last_workout'],['Сколько тренировок я сделал за неделю?','week_workouts'],['Покажи последние тренировки','workouts'],['Какие тренировки я уже выполнил?','workouts'],['Какой вес я жал в прошлый раз?','exercise']])assert.equal(progressIntent(text)?.kind,kind,text);
 assert.equal(progressIntent('Сколько раз в неделю мне тренироваться?'),null);assert.equal(progressIntent('Хочу похудеть'),null);assert.equal(progressIntent('Мой вес 82 кг, тренироваться могу 30 минут'),null);
});
test('3D missing timezone falls back to UTC rather than losing a measurement',()=>assert.equal(weightRecord('Мой вес сейчас 82 кг',null,NOW).record.recorded_on,'2026-10-10'));
test('3D new measurement respects local day and decimal comma',()=>{
 assert.equal(localDay(NOW,'Europe/Paris'),'2026-10-11');
 const r=weightRecord('Запиши мой вес 83,5 кг','Europe/Paris',NOW);assert.equal(r.record.weight_kg,83.5);assert.equal(r.record.recorded_on,'2026-10-11');
});
test('3D exact ISO, Russian named date and numeric date are actual dates, not overwritten today',()=>{
 for(const text of ['Запиши мой вес 85 кг 2026-10-01','Запиши мой вес 85 кг, 1 октября 2026','Запиши мой вес 85 кг, 01.10.2026'])assert.equal(weightRecord(text,'UTC',NOW).record.recorded_on,'2026-10-01');
 assert.equal(weightRecord('Вчера я вешу 84 кг','UTC',NOW).record.recorded_on,'2026-10-09');
 assert.equal(weightRecord('Позавчера мой вес 84 кг','UTC',NOW).record.recorded_on,'2026-10-08');
});
test('3D unknown past date, example, hypothetical and wrong units are not measurements',()=>{
 for(const t of ['Раньше я весил 85 кг','Например «Сегодня я вешу 84 кг»','Если мой вес 84 кг','Запиши мой вес 185 lb','Запиши мой вес 84','Запиши мой вес 84 кг или 85 кг','Мой вес 84 кг в октябре'])assert.equal(weightRecord(t,'UTC',NOW).record,undefined,t);
});
test('3D invalid, future dates and weights fail before any persistence',()=>{
 assert.equal(validMeasurementDate('2026-02-30','2026-10-10'),false);assert.equal(validMeasurementDate('2026-13-01','2026-10-10'),false);
 for(const t of ['Запиши мой вес 19 кг','Запиши мой вес 301 кг','Запиши мой вес 83,555 кг','Запиши мой вес 84 кг 2026-02-30','Запиши мой вес 84 кг 2026-11-01'])assert.throws(()=>weightRecord(t,'UTC',NOW),/invalid_progress/);
});
test('3D date and question in a comment do not change the actual measurement',()=>{const message='Сегодня я вешу 84 кг; комментарий: Какой вес будет 1 ноября 2026?';assert.equal(progressIntent(message).kind,'record_weight');assert.equal(weightRecord(message,'UTC',NOW).record.recorded_on,'2026-10-10');});
test('3D explicit comment is retained exactly',()=>assert.equal(weightRecord('Сегодня я вешу 84 кг; комментарий: После пробуждения','UTC',NOW).record.notes,'После пробуждения'));
test('3D empty history does not manufacture weight dates or workouts',()=>{
 for(const kind of ['weights','last_workout','workouts','exercise'])assert.match(historyAnswer({kind,terms:['жим']},{},'UTC'),/пуста|нет|пуст|не.*счита/);
});
test('3D stopped and active rows are not completed workouts',()=>{
 const h={workouts:[row('s','2026-10-10T10:00:00Z','stopped'),row('a',null,'active')]};assert.match(historyAnswer({kind:'last_workout'},h),/нет/);
});
test('3D last workout, list and exact week total reflect saved rows and supplied DB count',()=>{
 const h={workouts:[row('s','2026-10-09T10:00:00Z')],workout_count_week:231,week_start:'2026-10-04',today:'2026-10-10'};
 assert.match(historyAnswer({kind:'last_workout'},h,'Europe/Paris'),/9 окт.*12:00/);assert.match(historyAnswer({kind:'workouts'},h),/Силовая A/);assert.match(historyAnswer({kind:'week_workouts'},h),/231/);
});
test('3D missing exercise load or reps is explicitly unknown',()=>{
 const s=row('s','2026-10-09T10:00:00Z','completed',[{exercise:'Жим лёжа',weight_kg:null,reps:null}]);
 const answer=historyAnswer({kind:'exercise',terms:['жим','леж']},{exercise_workouts:[s]});assert.match(answer,/вес не указан/);assert.match(answer,/повторения не указаны/);assert.doesNotMatch(answer,/80|8 повтор/);
});
test('3D previous bench loads come from the latest completed session, not another exercise',()=>{
 const newest=row('new','2026-10-09T10:00:00Z','completed',[{exercise:'Жим лёжа',weight_kg:80,reps:8},{exercise:'Жим стоя',weight_kg:40,reps:10}]);const old=row('old','2026-10-01T10:00:00Z','completed',[{exercise:'Жим лёжа',weight_kg:75,reps:8}]);
 const answer=historyAnswer({kind:'exercise',terms:['жим','леж']},{exercise_workouts:[newest,old]});assert.match(answer,/80 кг.*8 повтор/);assert.doesNotMatch(answer,/75|40/);
 assert.match(historyAnswer({kind:'exercise',terms:['жим']},{exercise_workouts:[newest,old]}),/несколько/);
});
test('3D weight comparison uses chronological first and last saved rows',()=>{
 const first={id:'a',recorded_on:'2026-10-01',weight_kg:85},last={id:'b',recorded_on:'2026-10-10',weight_kg:83.5};
 const answer=historyAnswer({kind:'weights'},{weights:[last,first],first_weight:first,latest_weight:last});assert.match(answer,/-1,5 кг/);assert.match(answer,/2026-10-01/);
});
function fixture({failure=false,cached=false}={}){
 const calls=[];const json=(v,status=200)=>new Response(JSON.stringify(v),{status});const fetcher=async(url,o={})=>{
  const body=o.body?JSON.parse(o.body):null;calls.push({url,body});
  if(url.endsWith('/auth/v1/user'))return json({id:U});if(url.includes('/fgi_ai_profiles?'))return json([{data:{goal:'Сила'},consent_version:'2026-10-03',consented_at:'2026-10-09T10:00:00Z',updated_at:'2026-10-09T10:00:00Z'}]);
  if(url.includes('/fgi_ai_conversations?'))return json([{id:C}]);if(url.includes('/fgi_ai_plans?'))return json([]);
  if(url.endsWith('/rpc/fgi_ai_access'))return json({modules:['training'],friend:true});if(url.endsWith('/rpc/fgi_ai_claim'))return json(cached?{cached:{answer:'Ранее сохранено',progress_saved:true}}:{remaining:29});
  if(url.endsWith('/rpc/fgi_ai_history'))return failure?json({},503):json({workouts:[],weights:[],workout_count_week:0,week_start:'2026-10-04',today:'2026-10-10'});
  if(url.endsWith('/rpc/fgi_ai_complete'))return json(null);if(url.endsWith('/rpc/fgi_ai_fail'))return json(null);throw Error('Unexpected provider call');
 };
 const handle=createAIHandler({env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'},fetcher});
 return {calls,request:message=>handle(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer fixture',Origin:'https://fitgoin.com','Content-Type':'application/json'},body:JSON.stringify({action:'chat',module:'training',user_id:'forged',conversation_id:C,request_id:R,message,timezone:'Europe/Paris'})}))};
}
test('3D actual handler creates the measurement atomically for the verified Auth owner with no model',async()=>{
 const f=fixture(),response=await f.request('Запиши мой вес 83,5 кг 2026-10-01'),out=await response.json();assert.equal(response.status,200);assert(out.progress_saved);assert.equal(out.progress_record,undefined);const c=f.calls.find(x=>x.url.endsWith('/rpc/fgi_ai_complete'));assert.equal(c.body.p_user,U);assert.equal(c.body.p_result.progress_record.weight_kg,83.5);assert.equal(c.body.p_id,R);
});
test('3D actual handler reads service history for Auth owner, never a client supplied user',async()=>{
 const f=fixture(),response=await f.request('Когда я тренировался последний раз?');assert.equal(response.status,200);assert.match((await response.json()).answer,/нет/);assert.equal(f.calls.find(x=>x.url.endsWith('/rpc/fgi_ai_history')).body.p_user,U);
});
test('3D API history failure cannot be represented as empty or as successfully saved',async()=>{
 const f=fixture({failure:true}),response=await f.request('Покажи последние тренировки');assert.equal(response.status,503);assert.equal((await response.json()).error,'backend_unavailable');assert(!f.calls.some(x=>x.url.endsWith('/rpc/fgi_ai_complete')));
});
test('3D delivery replay returns existing answer without another measurement or history read',async()=>{
 const f=fixture({cached:true}),response=await f.request('Запиши мой вес 83,5 кг');assert.equal(response.status,200);assert(!f.calls.some(x=>/fgi_ai_complete|fgi_ai_history/.test(x.url)));
});
