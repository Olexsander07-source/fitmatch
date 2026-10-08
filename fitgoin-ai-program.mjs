// Structured programs built from the existing consented sports memory.
import {AIError,TRAINING_SCHEMA} from './fitgoin-ai-core.mjs';
import {sportsMemory,missingSportsMemory,MEMORY_LABELS} from './fitgoin-ai-memory.mjs';
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const string={type:'string'};
const oldWorkout=TRAINING_SCHEMA.properties.workouts.items;
export const PROGRAM_SCHEMA=obj({...TRAINING_SCHEMA.properties,workouts:{type:'array',items:obj({...oldWorkout.properties,objective:string,exercises:{type:'array',items:obj({...oldWorkout.properties.exercises.items.properties,sets:{type:'integer',enum:[1,2,3,4,5]},rest_seconds:{type:'integer',enum:[0,30,45,60,90,120,150,180,240]},required_equipment:string,alternative_equipment:string})}})}});
export function programIntent(message=''){
 const s=message.trim();
 if(/пример|например|цитат|гипотет|for example|hypothet/i.test(s))return null;
 if(/^(?:не создавай|отмени|пока не надо|cancel)/i.test(s))return 'cancel';
 if(/(?:что|какая|какую|what).*(?:завтра|tomorrow)/i.test(s)&&/тренир|трениров|workout/i.test(s))return 'tomorrow';
 if(/(?:что|какая|какую|what).*(?:сегодня|today)/i.test(s)&&/тренир|трениров|workout/i.test(s))return 'today';
 if(/^(?:покажи|какая|какова|show|what).*(?:мо[яюей]|у меня|my).*(?:программ|план|program|plan)/i.test(s))return 'show';
 if(/^(?:составь|создай|обнови|перестрой|переделай|зроби|створи|create|build|update).*(?:программ|трениров|workout|training|програм|тренув)/i.test(s)||/^что мне лучше тренировать[?!.]*$/i.test(s))return 'create';
 return null;
}
export const programFacts=(data={})=>({...Object.fromEntries(Object.entries(sportsMemory(data)).filter(([k])=>k!=='name')),weekdays:Array.isArray(data.weekdays)?data.weekdays:[],...(data.unavailable_equipment?.length?{unavailable_equipment:data.unavailable_equipment}:{})});
export function programBlocked(data={}){
 const p=sportsMemory(data);
 return (p.age!==undefined&&p.age<18)||Boolean(data.needs_professional)||Boolean(p.restrictions?.trim())||(p.goal==='Похудение'&&p.height_cm&&p.weight_kg&&p.weight_kg/(p.height_cm/100)**2<18.5);
}
export function missingProgramQuestion(data){
 const missing=missingSportsMemory(data),labels=missing.slice(0,2).map(k=>MEMORY_LABELS[k].toLocaleLowerCase());
 return `Для программы осталось уточнить: ${labels.join(' и ')}. ${missing.includes('restrictions')&&missing.length<=2?'Есть ли важные ограничения или травмы? Если их нет, так и скажи.':'Расскажи об этом; уже сохранённые данные повторять не нужно.'}`;
}
const lower=s=>String(s).toLocaleLowerCase().replace(/ё/g,'е');
const equipmentGroups=[/гантел|dumbbell/,/коврик|mat\b/,/штанг|barbell/,/скамь|bench/,/турник|pull.?up/,/резин|эспандер|band/,/гир[яьи]|kettlebell/,/тренажер|machine/];
export function availableEquipment(required,inventory,excluded=[]){
 if(/^(?:без оборудования|собственный вес|none|bodyweight|no equipment)$/i.test(required.trim()))return true;
 const wanted=lower(required),actual=lower(inventory);
 if(excluded.some(x=>equipmentGroups.some(r=>r.test(lower(x))&&r.test(wanted))||wanted.includes(lower(x))))return false;
 const groups=equipmentGroups.filter(r=>r.test(wanted));
 const amounts=required.match(/\d+(?:[.,]\d+)?/g)||[];
 if(amounts.some(n=>!(inventory.match(/\d+(?:[.,]\d+)?/g)||[]).includes(n)))return false;
 return groups.length?groups.every(r=>r.test(actual)):actual.includes(wanted);
}
export function usableAlternative(exercise,inventory,level,excluded=[]){
 const e=exercise,alternative=lower(e.alternative),primary=lower(e.required_equipment),gear=lower(e.alternative_equipment);
 if(!availableEquipment(gear,inventory,excluded)||alternative===lower(e.name))return false;
 if(equipmentGroups.some(r=>r.test(primary)&&r.test(gear)))return false;
 if(level==='beginner'&&/пистолет|одноног|на одной ноге|pistol|one.leg|single.leg/i.test(alternative))return false;
 if(level==='beginner'&&/отжиман|push.?up/i.test(alternative)&&!(/стен|колен|wall|knee|высок|incline/i.test(alternative)))return false;
 return true;
}
function conforms(value,schema){
 if(schema.type==='object')return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===schema.required.length&&schema.required.every(k=>Object.hasOwn(value,k)&&conforms(value[k],schema.properties[k]));
 if(schema.type==='array')return Array.isArray(value)&&value.length<=40&&value.every(v=>conforms(v,schema.items));
 if(schema.type==='integer')return Number.isInteger(value);
 if(schema.type==='number')return Number.isFinite(value);
 return typeof value==='string';
}
function insist(ok,rule='bounds',details){if(!ok){const error=new AIError('invalid_plan',502);error.program_rule=rule;if(details)error.program_details=details;throw error}}
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
function exerciseSeconds(e){
 const times=[...e.reps.matchAll(/\d+(?:[.,]\d+)?/g)].map(x=>Number(x[0].replace(',','.'))),timed=/сек|second|минут|minute/i.test(e.reps);
 const effort=timed&&times.length?Math.max(...times)*(/минут|minute/i.test(e.reps)?60:1):20;
 return e.sets*effort+(e.sets-1)*e.rest_seconds;
}
// Time is arithmetic, not a new prescription. Preserve sets, reps and rests;
// correct underestimated durations, then reject anything beyond the budget.
export function reconcileProgramTime(doc){
 if(!conforms(doc,PROGRAM_SCHEMA))return doc;
 return {...doc,workouts:doc.workouts.map(w=>{
  const exercises=w.exercises.map(e=>({...e,minutes:Math.max(e.minutes,Math.ceil(exerciseSeconds(e)/30)/2)}));
  return {...w,exercises,minutes:Math.max(w.minutes,Math.ceil(8+exercises.reduce((n,e)=>n+e.minutes,0)))};
 })};
}
export function validateProgram(doc,data){
 if(missingSportsMemory(data).length)throw new AIError('profile_incomplete',422);
 if(programBlocked(data))throw new AIError('professional_required',422);
 const p=sportsMemory(data);
 insist(conforms(doc,PROGRAM_SCHEMA)&&JSON.stringify(doc).length<60000,'schema');
 insist(text(doc.title,120)&&text(doc.summary,1000)&&text(doc.progression,1000),'program_text');
 insist(doc.workouts.length===p.days_per_week,'workout_count');
 const days=new Set();
 for(const w of doc.workouts){
  insist(w.day>=1&&w.day<=p.days_per_week&&!days.has(w.day),'sequence');days.add(w.day);
  insist(text(w.title,120)&&text(w.objective,250)&&text(w.warmup,400)&&text(w.cooldown,400),'workout_text');
  insist(w.minutes>=10&&w.minutes<=p.minutes,'workout_duration',{workout:w.day,received_minutes:w.minutes,max_minutes:p.minutes,exercise_minutes:w.exercises.map(e=>e.minutes)});
  insist(w.exercises.length>=1&&w.exercises.length<=6,'exercise_count');
  let total=8;
  for(const e of w.exercises){
   insist(text(e.name,120)&&text(e.reps,60)&&text(e.technique,300)&&text(e.alternative,200)&&text(e.required_equipment,120)&&text(e.alternative_equipment,120),'exercise_text');
   insist(e.sets>=1&&e.sets<=5,'sets');
   insist(e.rest_seconds>=0&&e.rest_seconds<=240&&(e.sets===1||e.rest_seconds>=30),'rest_seconds');
   insist(e.minutes>=.5&&e.minutes<=30,'exercise_duration');
   insist(availableEquipment(e.required_equipment,p.equipment,data.unavailable_equipment),'equipment');
   insist(usableAlternative(e,p.equipment,p.experience,data.unavailable_equipment),'alternative');
   insist(e.minutes*60>=exerciseSeconds(e),'exercise_time',{workout:w.day,exercise:w.exercises.indexOf(e)+1,received_minutes:e.minutes,min_minutes:Math.ceil(exerciseSeconds(e)/30)/2});
   total+=e.minutes;
  }
  insist(total<=w.minutes,'workout_time',{workout:w.day,total_minutes:total,workout_minutes:w.minutes,max_minutes:p.minutes});
 }
 return doc;
}
export function validTimezone(value){try{if(typeof value!=='string'||value.length>80)return null;new Intl.DateTimeFormat('en',{timeZone:value}).format();return value}catch{return null}}
export function finalizeProgram(doc,data,timezone,id=()=>crypto.randomUUID()){
 const weekdays=Array.isArray(data.weekdays)?[...new Set(data.weekdays.filter(x=>Number.isInteger(x)&&x>=0&&x<=6))]:[];
 const scheduled=weekdays.length===data.days_per_week;
 return {...doc,schema_version:2,schedule:{mode:scheduled?'weekdays':'sequence',weekdays:scheduled?weekdays:[],timezone:validTimezone(timezone)},workouts:[...doc.workouts].sort((a,b)=>a.day-b.day).map((w,i)=>({...w,id:id(),number:i+1,day:scheduled?weekdays[i]:-1,exercises:w.exercises.map(e=>({...e,id:id()}))}))};
}
export function activeProgram(rows){return rows.find(x=>x.kind==='training'&&x.status==='active')||rows.find(x=>x.kind==='training'&&x.status===undefined)||null}
export function programOutdated(plan,data={}){const saved=plan?.profile_snapshot||{},current=programFacts(data);return Boolean(plan?.document?.schema_version===2)&&(programBlocked(data)||Object.keys(saved).length!==Object.keys(current).length||Object.keys(current).some(k=>JSON.stringify(saved[k])!==JSON.stringify(current[k])))}
export function calendarWorkout(plan,offset=0,timezone,now=new Date()){
 if(!plan)return {state:'missing'};
 const d=plan.document;
 if(d?.schema_version!==2||d.schedule?.mode!=='weekdays')return {state:'unscheduled'};
 const zone=validTimezone(timezone)||validTimezone(d.schedule.timezone);
 if(!zone)return {state:'timezone_missing'};
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const date=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+offset));
 const workout=d.workouts.find(w=>w.day===date.getUTCDay());
 return {state:workout?'workout':'rest',workout,date:date.toISOString().slice(0,10),timezone:zone};
}
export function savedProgramAnswer(plan,intent,data,timezone){
 if(!plan)return 'У тебя пока нет сохранённой программы. Напиши «Составь мне программу», и я проверю спортивные данные.';
 const stale=programOutdated(plan,data)?' Спортивные данные изменились после создания; программу нужно пересмотреть перед использованием.':'';
 if(intent==='show')return `Твоя сохранённая программа: «${plan.title}», версия ${plan.revision||1}. ${plan.document.workouts?.length||0} тренировок. Открой карточки ниже: упражнения, подходы, повторения, отдых и замены.${stale}`;
 const day=calendarWorkout(plan,intent==='tomorrow'?1:0,timezone);
 if(day.state==='unscheduled')return `Программа сохранена как последовательность тренировок без привязки к дням недели. Поэтому не могу однозначно определить тренировку ${intent==='tomorrow'?'на завтра':'на сегодня'}. Открой программу и выбери тренировку по порядку.${stale}`;
 if(day.state==='timezone_missing')return 'В программе не указан часовой пояс. Без него не могу однозначно определить сегодняшний или завтрашний день. Сама программа доступна ниже.';
 return day.state==='rest'?`${day.date}: по сохранённому расписанию тренировки нет.${stale}`:`${day.date}: тренировка ${day.workout.number} — ${day.workout.title}. Цель: ${day.workout.objective}.${stale}`;
}
