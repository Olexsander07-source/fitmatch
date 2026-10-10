// Actual results use the existing fgi_ai_workouts rows, never the planned dose.
// These controlled commands run before model generation. SQL commits them with
// the chat pair and delivery nonce, and rechecks the owner and row revision.
import {AIError,UUID} from './fitgoin-ai-core.mjs';
import {currentWorkout,workoutCommand} from './fitgoin-ai-workout.mjs';
import {programBlocked,programOutdated} from './fitgoin-ai-program.mjs';

const fold=s=>String(s||'').toLowerCase().replace(/ё/g,'е').trim();
const quoted=s=>/пример|например|цитат|гипотет|если бы|мой друг|мой брат|for example|hypothet/i.test(s);
const optionalNumber=(v,min,max,integer=false)=>{
 if(v===undefined||v===null||v==='')return null;
 if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isInteger(v))throw new AIError('invalid_workout_result',422);
 return v;
};
const text=(v,max)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw new AIError('invalid_workout_result',422);return v.trim();};
export function completionDetails(v={}){
 return {duration_minutes:optionalNumber(v.duration_minutes,1,1440),difficulty:optionalNumber(v.difficulty,1,10,true),comment:text(v.comment,1500)};
}
export function exerciseDetails(v={}){
 const sets=optionalNumber(v.sets,1,20,true),reps=optionalNumber(v.reps,1,200,true);
 if(sets===null||reps===null)throw new AIError('invalid_workout_result',422);
 return {sets,reps,weight_kg:optionalNumber(v.weight_kg,0,500),rpe:optionalNumber(v.rpe,1,10,true),comment:text(v.comment,500)};
}
export function validateWorkoutInput(target,payload){
 if(target!==undefined){
  if(!target||typeof target!=='object'||Array.isArray(target)||Object.keys(target).some(k=>!['session_id','exercise_id','revision','draft_id'].includes(k)))throw new AIError('invalid_workout_result',422);
  for(const key of ['session_id','draft_id'])if(target[key]!==undefined&&!UUID.test(target[key]))throw new AIError('invalid_workout_result',422);
  if(target.exercise_id!==undefined&&(typeof target.exercise_id!=='string'||!target.exercise_id||target.exercise_id.length>80))throw new AIError('invalid_workout_result',422);
  if(target.revision!==undefined&&(!Number.isInteger(target.revision)||target.revision<0))throw new AIError('invalid_workout_result',422);
 }
 if(payload!==undefined){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!['record','complete','cancel_completion','resume'].includes(payload.operation))throw new AIError('invalid_workout_result',422);
  const allowed=payload.operation==='record'?['operation','sets','reps','weight_kg','rpe','comment']:payload.operation==='complete'?['operation','confirmed','duration_minutes','difficulty','comment']:['operation'];
  if(Object.keys(payload).some(k=>!allowed.includes(k)))throw new AIError('invalid_workout_result',422);
  if(payload.operation==='record')exerciseDetails(payload);
  if(payload.operation==='complete'){if(payload.confirmed!==true)throw new AIError('confirmation_required',422);completionDetails(payload);}
 }
}
export function parseExerciseResult(message=''){
 const s=fold(message);
 if(quoted(s)||/^(?:хочу|буду|планирую|как|сколько|если|не |я не )/.test(s))return null;
 const dose=s.match(/(-?\d+)\s*(?:подход[а-я]*\s*(?:по\s*)?|[xх×]\s*)(-?\d+)\s*(?:повтор[а-я]*)?/);
 if(!dose)return null;
 const weight=s.match(/(-?\d+(?:[.,]\d+)?)\s*(?:кг|kg)(?:\s|[,.;]|$)/);
 const comment=message.match(/(?:комментарий|заметка)\s*:\s*(.+)$/i)?.[1]||'';
 const name=s.slice(0,dose.index).replace(/^(?:запиши|записать|сделал[аи]?|выполнил[аи]?)\s*/,'').replace(/-?\d+(?:[.,]\d+)?\s*(?:кг|kg)/g,'').replace(/[,:;.]+/g,' ').trim();
 return {name,...exerciseDetails({sets:Number(dose[1]),reps:Number(dose[2]),weight_kg:weight?Number(weight[1].replace(',','.')):null,comment})};
}
export function workoutLogIntent(message='',data={},payload){
 if(payload)return payload.operation;
 const s=fold(message);if(quoted(s))return null;
 if(/^(?:отмени|отменить|не сохраняй).*(?:завершен|результат|трениров)/.test(s))return 'cancel_completion';
 if(/^(?:подтверждаю|сохрани|сохранить|подтверди)\s+(?:завершение (?:этой )?тренировки|выполнение тренировки|(?:выполненную |завершенную )?тренировку|результат(?:ы)? тренировки)/.test(s)||data.workout_log_pending?.mode==='completion'&&!data.program_edit_pending&&/^(?:да|yes)[.!]*$/.test(s))return 'complete';
 if(/^(?:я\s+)?(?:закончил[аи]?|завершил[аи]?|выполнил[аи]?|заверши|закончить|закончим|finish|finished).*(?:трениров|workout)/.test(s))return 'prepare_completion';
 if(parseExerciseResult(message))return 'record';
 return null;
}
const detailsFromMessage=message=>{
 const s=fold(message),duration=s.match(/(?:за\s+|длительность\s*[:—-]?\s*)(\d+(?:[.,]\d+)?)\s*мин/),difficulty=s.match(/(?:сложность|тяжесть|rpe)\s*[:—-]?\s*(\d+)(?:\s*\/\s*10)?/);
 return completionDetails({duration_minutes:duration?Number(duration[1].replace(',','.')):null,difficulty:difficulty?Number(difficulty[1]):null,comment:message.match(/(?:комментарий|заметка)\s*:\s*(.+)$/i)?.[1]||''});
};
const cursor=(session,plan,index=session.data.index||0)=>session.plan_id===plan?.id?{plan_id:plan.id,workout_id:session.data.workout.id,session_id:session.id,index,started_at:session.started_at}:null;
const active=s=>!s.completed_at&&s.data?.status==='active'&&s.data.workout?.exercises?.length;
export function chooseWorkoutSession(sessions,data={},target){
 if(target?.session_id){const s=sessions.find(x=>x.id===target.session_id);if(!s)throw new AIError('workout_changed',409);return {session:s};}
 const candidates=sessions.filter(active),linked=candidates.find(x=>x.id===data.current_workout?.session_id);
 if(linked)return {session:linked};
 if(candidates.length===1)return {session:candidates[0]};
 if(candidates.length>1)return {choices:candidates.map(s=>({id:s.id,title:s.data.workout.title,started_at:s.started_at}))};
 return {session:null};
}
export function resultExercises(session,name,target){
 const list=session.data.workout.exercises.map((e,index)=>({...e,id:e.id||`legacy-exercise-${index}`,index}));
 if(target?.exercise_id)return list.filter(e=>e.id===target.exercise_id);
 if(/^(?:это упражнение|текущее упражнение|этот подход|this exercise)$/.test(name)||!name)return list.filter(e=>e.index===(session.data.index||0));
 const tokens=fold(name).split(/[^\p{L}\p{N}]+/u).filter(s=>s.length>2&&!['для','при','под','над'].includes(s)).map(s=>s.length>6?s.slice(0,-2):s);
 return tokens.length?list.filter(e=>tokens.every(t=>fold(e.name).includes(t))):[];
}
const reportKey=(e,details)=>({exercise_id:e.id,...details});
export function duplicateExerciseReport(session,e,details){
 const key=JSON.stringify(reportKey(e,details));return (session.data.reports||[]).some(r=>r.source==='chat'&&JSON.stringify(reportKey({id:r.exercise_id},exerciseDetails(r)))===key);
}
export function workoutLogTurn({plan,data,sessions=[],message='',intent,target,payload,timezone,programTarget,requestId}){
 let selection=chooseWorkoutSession(sessions,data,target),session=selection.session,changes=[];
 const extra=values=>({workout_changes:changes,...values});
 if(intent==='cancel_completion')return {answer:'Подтверждение завершения отменено. Тренировка и записанные подходы сохранены; она остаётся открытой.',extra:extra({workout_log_pending:null})};
 if(selection.choices)return {answer:'Найдено несколько незавершённых тренировок. Выбери, к какой относится результат; до выбора ничего не записываю.',extra:{workout_session_choices:selection.choices}};
 if(intent==='start'){
  const command=workoutCommand(plan,data,'start',message,timezone,programTarget);
  if(!command.current_workout)return {answer:command.answer,extra:command};
  const w=plan.document.workouts.find(x=>x.id===command.current_workout.workout_id);
  if(session&&active(session)){
   if(session.plan_id!==plan.id||session.data.workout.id!==w.id)return {answer:`Уже открыта «${session.data.workout.title}». Сначала заверши или останови её; записанные подходы не заменены.`,extra:{workout_view:true}};
   return {answer:`Продолжаем «${w.title}». Ранее записанные подходы сохранены.`,extra:{current_workout:cursor(session,plan),workout_view:true}};
  }
  session={id:crypto.randomUUID(),plan_id:plan.id,revision:0,started_at:new Date().toISOString(),data:{status:'active',workout:w,index:0,sets:[],reports:[]}};
  changes.push({operation:'start',session_id:session.id,plan_id:plan.id,workout_id:w.id,from_cursor:false});
  return {answer:command.answer,extra:extra({current_workout:cursor(session,plan),workout_log_pending:null,workout_view:true})};
 }
 // Promote the already-open 2C cursor on its first real result. SQL takes the
 // original known opening timestamp from the profile, not from a model/client.
 if(!session&&['record','prepare_completion','complete','next','rest','technique','stop'].includes(intent)){
  const legacy=currentWorkout(plan,data);
  if(legacy&&!legacy.cursor.session_id){session={id:crypto.randomUUID(),plan_id:plan.id,revision:0,started_at:legacy.cursor.started_at,data:{status:'active',workout:legacy.workout,index:legacy.cursor.index,sets:[],reports:[]}};changes.push({operation:'start',session_id:session.id,plan_id:plan.id,workout_id:legacy.workout.id,from_cursor:true});}
 }
 if(!session){
  const completed=sessions.find(s=>s.completed_at&&s.data?.status==='completed');
  return {answer:completed&&['complete','prepare_completion'].includes(intent)?'Последняя тренировка уже завершена и сохранена. Повторная запись не создана. Для следующего занятия нажми «Начать тренировку».':'Сначала открой нужную тренировку в «Моей программе». Уточни, к какой тренировке относится результат; до этого ничего не сохраняю.',extra:{}};
 }
 if(!active(session))return {answer:session.data.status==='completed'?'Эта тренировка уже завершена и сохранена. Повторная запись не создана.':'Эта тренировка остановлена. Для следующего занятия начни новую.',extra:{}};
 if(target?.revision!==undefined&&target.revision!==(session.revision||0))throw new AIError('workout_changed',409);
 if(intent==='resume')return {answer:`Продолжаем «${session.data.workout.title}». Записанные результаты сохранены.`,extra:{current_workout:cursor(session,plan),workout_selected:session.id,workout_view:true}};
 if(intent==='prepare_completion'){
  const details=detailsFromMessage(message),pending={id:crypto.randomUUID(),mode:'completion',session_id:session.id,session_revision:session.revision||0,details};
  return {answer:`Завершить «${session.data.workout.title}»? Записано подходов: ${(session.data.sets||[]).length}. ${details.duration_minutes===null?'Длительность не указана.':`Длительность: ${details.duration_minutes} мин.`} ${details.difficulty===null?'Сложность не указана.':`Сложность: ${details.difficulty}/10.`} Подтверди кнопкой или напиши «Подтверждаю завершение тренировки». До подтверждения тренировка остаётся открытой.`,extra:extra({current_workout:cursor(session,plan),workout_log_pending:pending,workout_view:true})};
 }
 if(intent==='complete'){
  const pending=data.workout_log_pending;
  if(!payload&&pending?.mode!=='completion')return {answer:'Сначала напиши «Я закончил тренировку» или нажми «Завершить тренировку», чтобы проверить результат перед сохранением.',extra:{}};
  if(pending?.mode==='completion'&&(pending.session_id!==session.id||pending.session_revision!==(session.revision||0)||target?.draft_id&&target.draft_id!==pending.id))throw new AIError('workout_changed',409);
  const details=completionDetails(payload||pending.details);
  changes.push({operation:'complete',session_id:session.id,revision:session.revision||0,confirmed:true,...details});
  return {answer:`Тренировка «${session.data.workout.title}» завершена и сохранена. Записанные подходы: ${(session.data.sets||[]).length}. ${details.duration_minutes===null?'Длительность не указана.':`${details.duration_minutes} мин.`} ${details.difficulty===null?'Сложность не указана.':`Сложность ${details.difficulty}/10.`}`,extra:extra({current_workout:null,workout_log_pending:null,workout_completed:session.id})};
 }
 if(intent==='record'){
  const parsed=payload?exerciseDetails(payload):parseExerciseResult(message),matches=resultExercises(session,parsed.name||'',target);
  if(matches.length!==1)return {answer:matches.length?'В этой тренировке есть несколько подходящих упражнений. Укажи полное название или выбери упражнение в карточке; результат пока не сохранён.':'Не нашёл это упражнение в открытой тренировке. Укажи его название из программы или открой нужную тренировку; результат пока не сохранён.',extra:changes.length?extra({current_workout:cursor(session,plan)}):{}};
  const e=matches[0],details=exerciseDetails(parsed);
  if(!payload&&duplicateExerciseReport(session,e,details))return {answer:`Результат «${e.name}» уже записан. Повторные подходы не добавлены.`,extra:{workout_view:true}};
  changes.push({operation:'record',session_id:session.id,revision:session.revision||0,record_id:requestId,exercise_id:e.id,source:payload?'form':'chat',...details});
  return {answer:`Записано в «${session.data.workout.title}»: ${e.name} — ${details.sets} × ${details.reps}${details.weight_kg===null?'':`, ${details.weight_kg} кг`}.`,extra:extra({current_workout:cursor(session,plan),workout_log_pending:null,workout_recorded:session.id,workout_view:true})};
 }
 if(intent==='stop'){
  changes.push({operation:'stop',session_id:session.id,revision:session.revision||0,stopped_for_pain:false});
  return {answer:'Тренировка остановлена. Записанные подходы сохранены; занятие не отмечено выполненным.',extra:extra({current_workout:null,workout_log_pending:null})};
 }
 const w=session.data.workout,e=w.exercises[session.data.index||0];
 if(['next','rest','technique'].includes(intent)&&(programBlocked(data)||session.plan_id===plan?.id&&programOutdated(plan,data)))return {answer:'Программа требует пересмотра под актуальные условия. Не продолжай через боль. Можно сохранить только фактически выполненные результаты или остановить тренировку.',extra:{workout_view:true}};
 if(intent==='next'){
  const index=Math.min(w.exercises.length,(session.data.index||0)+1),next=w.exercises[index];changes.push({operation:'move',session_id:session.id,revision:session.revision||0,index});
  return {answer:next?`Дальше: ${next.name}. По программе: ${next.sets} × ${next.reps}. ${next.technique}`:`Список упражнений закончен. Выполни завершение: ${w.cooldown}. Затем нажми «Завершить тренировку».`,extra:extra({current_workout:cursor(session,plan,index),workout_log_pending:null,workout_view:true})};
 }
 return {answer:e?(intent==='rest'?`В программе отдых: ${e.rest_seconds} секунд. Восстановись дольше, если нужно.`:`${e.name}: ${e.technique}`):'Список упражнений закончился. Выполни завершение и подтверди результат.',extra:extra({current_workout:cursor(session,plan),workout_view:true})};
}
