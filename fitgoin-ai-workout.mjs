// Conversation edits and a current-workout cursor, using the existing profile/plan.
// There is no set tracking, completion history or second assistant here.
import {AIError} from './fitgoin-ai-core.mjs';
import {prepareMemoryPatch} from './fitgoin-ai-memory.mjs';
import {PROGRAM_SCHEMA,programFacts,programBlocked,programOutdated,calendarWorkout,availableEquipment,reconcileProgramTime,validateProgram,validTimezone} from './fitgoin-ai-program.mjs';

const lower=s=>String(s||'').toLocaleLowerCase().replace(/ё/g,'е').trim();
const example=/пример|например|цитат|гипотет|если бы|мой друг|мой брат|for example|hypothet/i;
const dayWords=[/воскрес|sunday/,/понедель|monday/,/вторник|tuesday/,/сред[ауе]|средам|wednesday/,/четверг|thursday/,/пятниц|friday/,/суббот|saturday/];
const equipment=[['Штанга',/штанг|barbell/],['Гантели',/гантел|dumbbell/],['Скамья',/скамь|bench/],['Турник',/турник|pull.?up/],['Гиря',/гир[яьи]|kettlebell/],['Резинки',/резин|эспандер|band/],['Тренажёр',/тренажер|machine/]];
export function explicitScheduleOnly(message){
 const s=lower(message),words=s.match(/[\p{L}]+/gu)||[];
 const allowed=new Set(['я','теперь','только','могу','тренироваться','тренируюсь','тренировки','тренировок','дни','недели','по','в','и','i','can','train','only','now','on','and']);
 return !/[\p{N}]|\?/u.test(s)&&words.length>0&&words.some(w=>dayWords.some(r=>r.test(w)))&&words.every(w=>allowed.has(w)||dayWords.some(r=>r.test(w)));
}

export function conversationMemory(data,updates,message){
 const s=lower(message),explicit=!example.test(s),days=explicit&&!/сегодня|завтра|на эту неделю|today|tomorrow|this week/i.test(s)&&/только|могу|тренир|теперь|дни|only|train/i.test(s)&&!s.endsWith('?')?dayWords.map((r,i)=>r.test(s)?i:-1).filter(i=>i>=0):[];
 const negativeSegments=[...s.matchAll(/(?:нет |недоступ\w* |без |i (?:do not|don't) have |no )([^.!?;]+?)(?=,?\s*(?:но |зато |есть |и есть )|[.!?;]|$)/g)].map(x=>x[1]);
 const absent=explicit&&!/сегодня|today|на эту тренировку/i.test(s)?equipment.filter(([,r])=>negativeSegments.some(x=>r.test(x))).map(([name])=>name):[];
 const filtered=updates.filter(u=>u.field!=='weekdays'&&!(days.length&&u.field==='days_per_week')&&!(absent.length&&u.field==='equipment'&&(!/но (?:у меня )?есть|зато (?:у меня )?есть/i.test(s)||/нет|без |no |unavailable/i.test(u.value))));
 const m=prepareMemoryPatch(data,filtered,message);
 if(days.length){
  if(days.length>6||Object.hasOwn(m.patch,'days_per_week')&&m.patch.days_per_week!==days.length)throw new AIError('memory_update_invalid',422);
  m.patch.weekdays=days;m.patch.days_per_week=days.length;
  m.fields=[...new Set([...m.fields,'days_per_week','weekdays'])];
  m.patch.memory_confirmed_fields=[...new Set([...(m.patch.memory_confirmed_fields||data.memory_confirmed_fields||[]),'days_per_week'])];
 }
 if(absent.length){
  const exclusions=[...new Set([...(data.unavailable_equipment||[]),...absent])];
  if(exclusions.length>8)throw new AIError('memory_update_invalid',422);
  m.patch.unavailable_equipment=exclusions;
  if(m.data.equipment){
   const inventory=m.data.equipment.split(/\s*[,;]\s*|\s+(?:и|and|et)\s+/iu).filter(x=>!equipment.some(([name,r])=>absent.includes(name)&&r.test(lower(x))));
   m.patch.equipment=inventory.length?inventory.join(', '):'Без оборудования';
  }
  m.fields=[...new Set([...m.fields,'equipment'])];
 }
 // An explicit positive inventory resets prior exclusions for those named items.
 if(!absent.length&&Object.hasOwn(m.patch,'equipment')&&m.patch.equipment){
  m.patch.unavailable_equipment=(data.unavailable_equipment||[]).filter(name=>!equipment.some(([n,r])=>n===name&&r.test(lower(m.patch.equipment))));
 }
 m.data={...data,...m.patch};return m;
}

export function workoutIntent(message=''){
 const s=lower(message);if(example.test(s))return null;
 if(/^(?:да[,! ]*)?(?:сохрани|подтверждаю|согласен|применяй|примени|давай заменим|confirm)(?:\b|\s|$)/iu.test(s)||/^(?:да|yes)[.!]*$/.test(s))return 'confirm';
 if(/^(?:отмени замену|не заменяй|cancel replacement)/.test(s))return 'cancel_edit';
 if(/^(?:начинаем|начать|начни|начнем|начинаю|start).*(?:трениров|workout)/.test(s)||/^тренировка\s+\d+[.!]*$/.test(s))return 'start';
 if(/^(?:что дальше|следующее упражнение|дальше|next)[?!.]*$/.test(s))return 'next';
 if(/^(?:закончим|заверши|останови|закончить|stop|finish).*(?:трениров|workout)/.test(s))return 'stop';
 if(/мне больно|у меня (?:сейчас )?болит|i feel pain/.test(s))return 'pain';
 if(/сколько (?:мне )?отдыхать|how long.*rest/.test(s))return 'rest';
 if(/как (?:правильно )?(?:делать|выполнить).*(?:это|упражнен)|how.*(?:this exercise|perform)/.test(s))return 'technique';
 if(/(?:чем|как|на что).*(?:замени|заменить)|what.*replace/.test(s))return 'suggest';
 if(/^(?:пожалуйста[, ]*)?(?:замени|заменить|replace)|мне неудобно (?:делать|выполнять)|у меня нет (?:этого |этой )?(?:тренажера|штанги|гантел)/.test(s))return 'replace';
 return null;
}

export function currentWorkout(plan,data={}){
 const c=data.current_workout;
 if(!plan||c?.plan_id!==plan.id||!Number.isInteger(c.index)||c.index<0)return null;
 const workout=plan.document.workouts?.find(w=>w.id===c.workout_id);
 if(!workout||c.index>workout.exercises.length)return null;
 return {cursor:c,workout,exercise:workout.exercises[c.index]||null};
}
export function workoutCommand(plan,data,intent,message,timezone,target){
 const current=currentWorkout(plan,data),noPlan='Сохранённой программы пока нет. Напиши «Составь мне программу».';
 if(!plan)return {answer:noPlan};
 if(intent==='stop')return {answer:'Режим текущей тренировки закрыт. Результаты подходов не записывались.',current_workout:null};
 if(programBlocked(data))return {answer:'С указанными ограничениями персональную тренировку нужно согласовать со специалистом. При боли остановись.',current_workout:null};
 if(programOutdated(plan,data))return {answer:'Спортивные данные изменились. Сначала адаптируем программу под актуальные условия; прежнюю тренировку сейчас не запускаем.',current_workout:null};
 if(intent==='start'){
  if(target?.program_id&&target.program_id!==plan.id)throw new AIError('program_changed',409);
  const number=message.match(/тренировк[ауеи]\s*(\d+)/i)?.[1];
  let w=target?.workout_id?plan.document.workouts.find(x=>x.id===target.workout_id):number?plan.document.workouts.find(x=>x.number===Number(number)):current?.workout;
  if((target?.workout_id||number)&&!w)throw new AIError('invalid_workout',422);
  if(!w){const day=calendarWorkout(plan,0,timezone);if(day.state==='workout')w=day.workout;else return {answer:day.state==='rest'?'По расписанию сегодня отдых. Если хочешь выбрать другое занятие, укажи номер тренировки.':'Дни недели не заданы. Выбери номер тренировки из сохранённой программы.',workout_choices:plan.document.workouts.map(x=>({id:x.id,number:x.number,title:x.title}))};}
  return {answer:`Начинаем тренировку ${w.number} — ${w.title}. Сначала разминка: ${w.warmup}. Затем первое упражнение: ${w.exercises[0].name}.`,current_workout:{plan_id:plan.id,workout_id:w.id,index:0,started_at:new Date().toISOString()},workout_view:true};
 }
 if(!current)return {answer:'Сначала начни тренировку из своей сохранённой программы и выбери упражнение.'};
 if(intent==='next'){
  const index=Math.min(current.workout.exercises.length,current.cursor.index+1),next=current.workout.exercises[index];
  return {answer:next?`Дальше: ${next.name}. ${next.sets} × ${next.reps}. Отдых: ${next.rest_seconds} секунд. ${next.technique}`:`Список упражнений закончен. Завершение: ${current.workout.cooldown}. Можно закрыть режим тренировки.`,current_workout:{...current.cursor,index},workout_view:true};
 }
 if(!current.exercise)return {answer:'Список упражнений закончен. Выполни спокойное завершение или выбери тренировку заново.'};
 const e=current.exercise;
 return {answer:intent==='rest'?(e.rest_seconds===0?'Это один непрерывный подход; межподходного отдыха нет. Восстановись перед следующим упражнением.':`Для «${e.name}» в программе указан отдых ${e.rest_seconds} секунд. Если нужно, восстановись дольше.`):`${e.name}: ${e.technique} Выполняй движение спокойно, без боли. Если инструкция непонятна, уточни деталь или обратись к тренеру.`,workout_view:true};
}

export function targetsForEdit(plan,data,message,target,pending){
 if(!plan?.document?.workouts)return [];
 if(target?.program_id&&target.program_id!==plan.id)throw new AIError('program_changed',409);
 const s=lower(message),current=currentWorkout(plan,data);
 const number=s.match(/тренировк[а-я]*\s*(\d+)/)?.[1];
 const source=pending?.mode==='select'&&/^(?:в )?тренировк/.test(s)?pending.request:s;
 const stems=lower(source).replace(/^(?:чем |пожалуйста[, ]*)?(?:замени|заменить|replace)\s*/,'').split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>3&&!/трениров|упражнен|неудоб|делать|выполн|замен|пожалуй/.test(w)).map(w=>w.slice(0,w.length>6?-2:4));
 if(/присед/.test(source))stems.push('присед');
 if(/жим/.test(source))stems.push('жим');
 const generic=/это упражнение|этого тренажера|мне неудобно|this exercise/.test(source);
 return plan.document.workouts.flatMap(w=>w.exercises.map((e,index)=>({workout:w,exercise:e,index}))).filter(x=>{
  if(number&&x.workout.number!==Number(number))return false;
  if(target?.exercise_id)return x.exercise.id===target.exercise_id&&(!target.workout_id||x.workout.id===target.workout_id);
  if(generic&&current)return x.exercise.id===current.exercise?.id&&x.workout.id===current.workout.id;
  if(/жим.*леж/.test(source)&&!/жим.*леж/.test(lower(x.exercise.name)))return false;
  return stems.length&&stems.some(stem=>lower(x.exercise.name).includes(stem));
 });
}
export function equipmentTargets(plan,data){return (plan?.document.workouts||[]).flatMap(w=>w.exercises.filter(e=>!availableEquipment(e.required_equipment,data.equipment||'',data.unavailable_equipment)).map(e=>({workout:w,exercise:e})));}
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const EDIT_SCHEMA=object({explanation:{type:'string'},replacements:{type:'array',items:object({workout_id:{type:'string'},exercise_id:{type:'string'},exercise:PROGRAM_SCHEMA.properties.workouts.items.properties.exercises.items})}});

export function providerDocument(doc){
 const pick=(value,schema)=>Object.fromEntries(Object.entries(schema.properties).map(([k,v])=>[k,v.type==='array'?value[k].map(item=>v.items.type==='object'?pick(item,v.items):item):value[k]]));
 return {...pick(doc,PROGRAM_SCHEMA),workouts:doc.workouts.map((w,i)=>({...pick(w,PROGRAM_SCHEMA.properties.workouts.items),day:i+1}))};
}
export function rescheduleProgram(doc,data,timezone){
 const weekdays=data.weekdays||[],scheduled=weekdays.length===data.days_per_week;
 return {...doc,schedule:{mode:scheduled?'weekdays':'sequence',weekdays:scheduled?weekdays:[],timezone:validTimezone(timezone)||validTimezone(doc.schedule?.timezone)},workouts:doc.workouts.map((w,i)=>({...w,number:i+1,day:scheduled?weekdays[i]:-1}))};
}
export function applyExerciseEdits(plan,data,targets,changes,timezone){
 if(!Array.isArray(changes)||changes.length!==targets.length)throw new AIError('invalid_plan',502);
 const found=new Set();let doc=structuredClone(plan.document);
 for(const change of changes){
  if(Object.keys(change).length!==3||!change.exercise||Object.keys(change.exercise).length!==Object.keys(PROGRAM_SCHEMA.properties.workouts.items.properties.exercises.items.properties).length)throw new AIError('invalid_plan',502);
  const key=change.workout_id+':'+change.exercise_id,t=targets.find(x=>x.workout.id===change.workout_id&&x.exercise.id===change.exercise_id);
  if(!t||found.has(key))throw new AIError('invalid_plan',502);found.add(key);
  const w=doc.workouts.find(x=>x.id===change.workout_id),index=w.exercises.findIndex(x=>x.id===change.exercise_id);
  if(lower(change.exercise.name)===lower(w.exercises[index].name))throw new AIError('invalid_plan',502);
  w.exercises[index]={...change.exercise,id:change.exercise_id};
 }
 const plain=reconcileProgramTime(providerDocument(doc));validateProgram(plain,data);
 doc.workouts=doc.workouts.map((w,i)=>({...w,minutes:plain.workouts[i].minutes,exercises:w.exercises.map((e,j)=>({...e,minutes:plain.workouts[i].exercises[j].minutes}))}));
 return rescheduleProgram(doc,data,timezone);
}
export function adaptationNeeded(before,after){return ['goal','target','experience','training_experience','days_per_week','minutes','setting','equipment','restrictions','weekdays','unavailable_equipment'].some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));}
export function scheduleOnly(before,after){return ['goal','target','experience','training_experience','days_per_week','minutes','setting','equipment','restrictions','unavailable_equipment'].every(k=>JSON.stringify(before[k])===JSON.stringify(after[k]));}
export function equipmentOnly(before,after){return ['goal','target','experience','training_experience','days_per_week','minutes','restrictions'].every(k=>JSON.stringify(before[k])===JSON.stringify(after[k]));}
export function cursorForVersion(cursor,oldPlan,newID,doc){
 if(!cursor||!oldPlan||cursor.plan_id!==oldPlan.id)return null;
 const w=doc.workouts.find(w=>w.id===cursor.workout_id);return w?{...cursor,plan_id:newID,index:Math.min(cursor.index,w.exercises.length)}:null;
}
