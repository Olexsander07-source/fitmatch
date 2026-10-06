// Shared validation. This file contains no credentials or provider calls.
export const CONSENT_VERSION = '2026-10-03';
export const LANGUAGES = {ru:'Русский',uk:'Українська',en:'English',fr:'Français',de:'Deutsch',es:'Español',it:'Italiano',pt:'Português',pl:'Polski',ar:'العربية'};
export const GOALS = ['Похудение','Набор мышечной массы','Сила','Выносливость','Подготовка к соревнованиям','Техника','Подвижность','Общее здоровье'];
export const ALLERGENS = ['gluten','milk','egg','fish','shellfish','peanut','soy','nuts','celery','mustard','sesame','sulphites','lupin','molluscs'];
export const ALLERGEN_LABELS = ['Глютен','Молоко','Яйца','Рыба','Ракообразные','Арахис','Соя','Орехи','Сельдерей','Горчица','Кунжут','Сульфиты','Люпин','Моллюски'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CHAT_HISTORY_LIMIT = 40;
// Keep complete recent turns and full message bodies. No invented summary or
// permanent memory: the database remains the source of conversation history.
export function recentChatContext(rows, characterBudget=22000) {
  const turns=[];
  for(const row of rows) {
    if(!['user','assistant'].includes(row.role)||typeof row.body!=='string'||!row.body.trim())continue;
    const previous=turns.at(-1);
    if(row.request_id&&previous?.id===row.request_id)previous.messages.push({role:row.role,content:row.body});
    else turns.push({id:row.request_id,messages:[{role:row.role,content:row.body}]});
  }
  let used=0;const selected=[];
  for(const turn of turns.toReversed()) {
    const size=turn.messages.reduce((sum,m)=>sum+m.content.length,0);
    if(used+size>characterBudget)break;
    selected.unshift(...turn.messages);used+=size;
  }
  while(selected[0]?.role==='assistant')selected.shift();
  return {messages:selected,truncated:selected.length<rows.length};
}
export class AIError extends Error {
  constructor(code, status=400) { super(code); this.code=code; this.status=status; }
}
const text = (v,n=500) => typeof v==='string' ? v.trim().slice(0,n) : '';
const choice = (v,values,fallback) => values.includes(v) ? v : fallback;
const number = (v,min,max,fallback=null) => v!=='' && v!==null && Number.isFinite(Number(v)) && Number(v)>=min && Number(v)<=max ? Number(v) : fallback;
export function normalizeProfile(v={}) {
  return {
    goal:choice(v.goal,GOALS,''), sport:text(v.sport,80), age:number(v.age,13,100), height_cm:number(v.height_cm,100,230), weight_kg:number(v.weight_kg,30,300),
    experience:choice(v.experience,['beginner','intermediate','advanced'],'beginner'), setting:choice(v.setting,['home','gym','outdoor'],'home'), equipment:text(v.equipment,600),
    days_per_week:number(v.days_per_week,1,6,3), minutes:number(v.minutes,10,90,30), weekdays:Array.isArray(v.weekdays)?[...new Set(v.weekdays.filter(x=>Number.isInteger(x)&&x>=0&&x<=6))].slice(0,6):[],
    diet:text(v.diet,600), activity:choice(v.activity,['sedentary','light','active'],'light'), allergies:Array.isArray(v.allergies)?[...new Set(v.allergies.filter(x=>ALLERGENS.includes(x)))]:[], restrictions:text(v.restrictions,800),
    needs_professional:Boolean(v.needs_professional), language:choice(v.language,Object.keys(LANGUAGES),'ru'), response_style:choice(v.response_style,['short','detailed'],'short'),
    city:text(v.city,100), format:choice(v.format,['','Онлайн','Офлайн'],''), budget:number(v.budget,0,100), period:choice(v.period,['занятие','месяц','программа'],'занятие'),
    availability:choice(v.availability,['','morning','day','evening','weekend'],''), target:text(v.target,300)
  };
}
export function missingProfile(v, nutrition=false) {
  const p=normalizeProfile(v), missing=[];
  if(!p.goal) missing.push('goal'); if(!p.age)missing.push('age');
  if(!nutrition){if(!p.sport)missing.push('sport');if(p.weekdays.length!==p.days_per_week)missing.push('weekdays');}
  if(nutrition){ if(!p.weight_kg)missing.push('weight_kg'); if(!p.height_cm)missing.push('height_cm'); }
  return missing;
}
export function limitedProfile(p) { return p.age<18 || p.needs_professional || Boolean(p.restrictions.trim()) || (p.goal==='Похудение'&&p.height_cm&&p.weight_kg&&p.weight_kg/(p.height_cm/100)**2<18.5); }
export function nutritionEstimate(profile) {
  const p=normalizeProfile(profile);
  if(missingProfile(p,true).length||limitedProfile(p))throw new AIError('professional_required');
  // Mifflin–St Jeor (1990, PMID: 2305711). Use a range for the two coefficients;
  // activity and real energy needs are estimates, to be reviewed against progress.
  const base=10*p.weight_kg+6.25*p.height_cm-5*p.age;
  const factor={sedentary:1.2,light:1.4,active:1.6}[p.activity];
  let low=(base-161)*factor,high=(base+5)*factor;
  if(p.goal==='Похудение'){low-=Math.min(300,low*.15);high-=Math.min(300,high*.15);}
  if(p.goal==='Набор мышечной массы'){low+=150;high+=150;}
  if(low<1600||high>4500)throw new AIError('professional_required');
  return {calories_low:Math.round(low/50)*50,calories_high:Math.round(high/50)*50,protein_low:Math.round(p.weight_kg*1.4),protein_high:Math.round(p.weight_kg*2),method:'Mifflin–St Jeor; approximate activity, no individual metabolic measurement'};
}
export function safeURL(v) {
  try { const u=new URL(v); return u.protocol==='https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function cleanCitations(items) {
  if(!Array.isArray(items))return [];
  return [...new Map(items.filter(x=>x && safeURL(x.url)).map(x=>[safeURL(x.url),{url:safeURL(x.url),title:text(x.title,180)||new URL(x.url).hostname}])).values()].slice(0,12);
}
const string = {type:'string'};
const integer = {type:'integer'};
const numeric = {type:'number'};
const object = properties => ({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const array = items => ({type:'array',items});
const exercise = object({name:string,sets:integer,reps:string,rest_seconds:integer,minutes:numeric,technique:string,alternative:string});
const workout = object({day:integer,title:string,minutes:integer,warmup:string,cooldown:string,exercises:array(exercise)});
export const TRAINING_SCHEMA = object({title:string,summary:string,progression:string,workouts:array(workout)});
const meal = object({name:string,ingredients:array(string),allergens:array({type:'string',enum:ALLERGENS}),calories:integer,protein_g:numeric,fat_g:numeric,carbs_g:numeric,recipe:string,substitutions:array(string)});
export const NUTRITION_SCHEMA = object({title:string,summary:string,calories_low:integer,calories_high:integer,protein_g:integer,fat_g:integer,carbs_g:integer,meals:array(meal),shopping_list:array(string)});
export const CHAT_SCHEMA = object({answer:string,needs_search:{type:'boolean'},search_query:string});
function conforms(value,schema) {
  if(schema.type==='object')return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===schema.required.length&&schema.required.every(key=>Object.hasOwn(value,key)&&conforms(value[key],schema.properties[key]));
  if(schema.type==='array')return Array.isArray(value)&&value.length<=40&&value.every(x=>conforms(x,schema.items));
  if(schema.type==='integer')return Number.isInteger(value);
  if(schema.type==='number')return Number.isFinite(value);
  return typeof value==='string'&&(!schema.enum||schema.enum.includes(value));
}
function insist(ok) { if(!ok)throw new AIError('invalid_plan',502); }
function short(v,max=2000) { return typeof v==='string'&&v.trim().length>0&&v.length<=max; }
// A rest interval is never shortened to squeeze a workout into the available time.
export function adaptWorkout(workout, minutes, readiness={}) {
  if(readiness.pain)throw new AIError('professional_required',422);
  const total=Math.max(10,Math.min(90,Math.floor(Number(minutes)||workout.minutes)));
  const tired=(Number.isFinite(readiness.sleep)&&readiness.sleep<6) || (Number.isFinite(readiness.energy)&&readiness.energy<=2) || Number(readiness.soreness)>=4;
  const allowance=Math.max(2,total-8); // Keep time for warm-up and cooldown.
  let budget=allowance;
  const exercises=[];
  for(const original of workout.exercises) {
    if(budget<2)break;
    const e={...original};
    e.sets=tired?Math.max(1,e.sets-1):e.sets;
    const perSet=Math.max(.75,(original.minutes/original.sets));
    e.sets=Math.min(e.sets,Math.floor(budget/perSet));
    while(e.sets>0&&Math.max(perSet*e.sets,(e.sets*20+(e.sets-1)*e.rest_seconds)/60)>budget)e.sets--;
    if(e.sets<1)continue;
    e.minutes=Math.max(1,Math.ceil(Math.max(perSet*e.sets,(e.sets*20+(e.sets-1)*e.rest_seconds)/60)*10)/10);
    if(e.minutes>budget)continue;
    budget-=e.minutes;exercises.push(e);
  }
  return {...workout,minutes:total,exercises,adaptation:tired?'Из-за усталости уменьшаем число подходов. Разминка и отдых сохраняются; нагрузку не увеличиваем.':total<workout.minutes?'Уменьшаем объём под доступное время. Разминка и отдых сохраняются.':'Оставляем запланированный объём. Учитывай технику и самочувствие.'};
}
export function weeklyReview(sessions,profile,now=Date.now()) {
  const p=normalizeProfile(profile),recent=sessions.filter(s=>s.completed_at&&Date.parse(s.completed_at)>=now-7*86400000&&Date.parse(s.completed_at)<=now);
  const completed=recent.filter(s=>s.data?.status==='completed'&&s.data?.sets?.length);
  const sets=completed.flatMap(s=>s.data.sets),rpe=sets.map(s=>Number(s.rpe)).filter(x=>Number.isFinite(x)&&x>=1&&x<=10);
  return {completed:completed.length,planned:p.days_per_week,sets:sets.length,average_rpe:rpe.length?Math.round(rpe.reduce((s,x)=>s+x,0)/rpe.length*10)/10:null,stopped_for_pain:recent.some(s=>s.data?.stopped_for_pain),message:recent.some(s=>s.data?.stopped_for_pain)?'Есть остановка из-за боли. Не увеличивай нагрузку; нужна оценка специалиста.':completed.length<p.days_per_week?'Не компенсируй пропуски двойной нагрузкой. Продолжи с посильного объёма и дня восстановления.':'Оцени восстановление и технику перед изменением программы. Число занятий само по себе не означает готовность увеличить вес.'};
}
export function validatePlan(kind, document, profile) {
  const p=normalizeProfile(profile);
  insist(document&&typeof document==='object'&&JSON.stringify(document).length<=60000);
  insist(conforms(document,kind==='training'?TRAINING_SCHEMA:NUTRITION_SCHEMA));
  insist(!missingProfile(p,kind==='nutrition').length && !limitedProfile(p));
  insist(short(document.title,120)&&short(document.summary,3000));
  if(kind==='training') {
    insist(short(document.progression,2000)&&Array.isArray(document.workouts)&&document.workouts.length===p.days_per_week);
    const days=new Set();
    for(const w of document.workouts) {
      insist(Number.isInteger(w.day)&&p.weekdays.includes(w.day)&&!days.has(w.day));days.add(w.day);
      insist(short(w.title,120)&&Number.isInteger(w.minutes)&&w.minutes>=10&&w.minutes<=p.minutes);
      insist(short(w.warmup,2000)&&short(w.cooldown,2000)&&Array.isArray(w.exercises)&&w.exercises.length>=1&&w.exercises.length<=8);
      let time=8;
      for(const e of w.exercises) {
        insist(short(e.name,120)&&short(e.reps,60)&&short(e.technique,1500)&&short(e.alternative,200));
        insist(Number.isInteger(e.sets)&&e.sets>=1&&e.sets<=5&&Number.isInteger(e.rest_seconds)&&e.rest_seconds>=30&&e.rest_seconds<=240);
        insist(Number.isFinite(e.minutes)&&e.minutes>=1&&e.minutes<=30);
        insist(e.minutes*60 >= e.sets*20 + Math.max(0,e.sets-1)*e.rest_seconds);
        time+=e.minutes;
      }
      insist(time<=w.minutes+1);
    }
  } else if(kind==='nutrition') {
    insist(Number.isInteger(document.calories_low)&&Number.isInteger(document.calories_high));
    insist(document.calories_low>=1600&&document.calories_high<=4500&&document.calories_high>=document.calories_low&&document.calories_high-document.calories_low<=600);
    for(const key of ['protein_g','fat_g','carbs_g'])insist(Number.isInteger(document[key])&&document[key]>=0&&document[key]<=600);
    insist(document.protein_g>=p.weight_kg*1.2&&document.protein_g<=p.weight_kg*2.2&&document.fat_g>=40&&document.carbs_g>=100);
    const estimate=nutritionEstimate(p);
    insist(Math.abs(document.calories_low-estimate.calories_low)<=100&&Math.abs(document.calories_high-estimate.calories_high)<=100);
    const macroCalories=document.protein_g*4+document.fat_g*9+document.carbs_g*4;
    insist(macroCalories>=document.calories_low*.9&&macroCalories<=document.calories_high*1.1);
    insist(Array.isArray(document.meals)&&document.meals.length>=3&&document.meals.length<=6&&Array.isArray(document.shopping_list)&&document.shopping_list.length<=30);
    let calories=0;
    const totals={protein_g:0,fat_g:0,carbs_g:0};
    for(const m of document.meals) {
      insist(short(m.name,120)&&short(m.recipe,1800)&&Array.isArray(m.ingredients)&&m.ingredients.length>=1&&m.ingredients.length<=16&&m.ingredients.every(x=>short(x,200)));
      insist(Array.isArray(m.allergens)&&m.allergens.every(x=>ALLERGENS.includes(x))&&m.allergens.every(x=>!p.allergies.includes(x)));
      insist(Array.isArray(m.substitutions)&&m.substitutions.length<=6&&m.substitutions.every(x=>short(x,300)));
      insist(Number.isInteger(m.calories)&&m.calories>=50&&m.calories<=1600);
      for(const key of Object.keys(totals)){insist(Number.isFinite(m[key])&&m[key]>=0&&m[key]<=300);totals[key]+=m[key];}
      insist(Math.abs(m.calories-(m.protein_g*4+m.fat_g*9+m.carbs_g*4))<=Math.max(80,m.calories*.15));
      calories+=m.calories;
    }
    insist(calories>=document.calories_low*.9&&calories<=document.calories_high*1.1);
    for(const key of Object.keys(totals))insist(Math.abs(totals[key]-document[key])<=Math.max(10,document[key]*.15));
    insist(document.shopping_list.every(x=>short(x,200)));
  } else throw new AIError('invalid_action');
  return document;
}
export function progressSeries(rows,key='weight_kg') {
  return rows.filter(r=>Number.isFinite(Number(r[key]))&&r[key]!==null).sort((a,b)=>a.recorded_on.localeCompare(b.recorded_on)).map(r=>({date:r.recorded_on,value:Number(r[key])}));
}
export function achievements(sessions) {
  const completed=sessions.filter(x=>x.completed_at&&x.data?.status==='completed'&&x.data?.sets?.length);
  const out=[];if(completed.length>=1)out.push('Первая тренировка');if(completed.length>=10)out.push('10 тренировок');if(completed.length>=30)out.push('30 тренировок');
  return out;
}
export function coachQuestions(p) {
  return [`Как вы строите программу для цели «${p.goal||'общее здоровье'}»?`,'Как вы проверяете технику и адаптируете нагрузку?','Как часто мы будем оценивать прогресс?','Что входит в стоимость и как устроена связь между занятиями?','Как учитываются ограничения и рекомендации врача?'];
}
