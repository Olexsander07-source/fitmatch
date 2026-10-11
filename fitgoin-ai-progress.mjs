// Controlled history answers: no provider, inferred performances or estimated measurements.
import {AIError} from './fitgoin-ai-core.mjs';
import {validTimezone} from './fitgoin-ai-program.mjs';
const zone=tz=>validTimezone(tz)||'UTC';
const plain=v=>String(v||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
export const kg=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
export function localDay(now=new Date(),timezone='UTC'){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone(timezone),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');
}
export function validMeasurementDate(day,today){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<'2000-01-01'||day>today)return false;
 const value=new Date(day+'T12:00:00Z');return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===day;
}
const months=['январ','феврал','март','апрел','ма','июн','июл','август','сентябр','октябр','ноябр','декабр'];
function measurementDay(text,today){
 const iso=text.match(/\b(\d{4}-\d{2}-\d{2})\b/),numeric=text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/),named=text.match(/\b(\d{1,2})\s+(январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])(?:\s+(\d{4}))?/);
 if([iso,numeric,named].filter(Boolean).length>1)throw new AIError('invalid_progress',422);
 if(iso)return iso[1];
 if(numeric)return `${numeric[3]}-${numeric[2].padStart(2,'0')}-${numeric[1].padStart(2,'0')}`;
 if(named)return `${named[3]||today.slice(0,4)}-${String(months.findIndex(x=>named[2].startsWith(x))+1).padStart(2,'0')}-${named[1].padStart(2,'0')}`;
 if(/позавчера/.test(text))return new Date(Date.parse(today+'T12:00:00Z')-2*86400000).toISOString().slice(0,10);
 if(/вчера/.test(text))return new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 if(/январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|позавчера|раньше|неделю назад|в прошлом|\b\d{1,2}[./]\d{1,2}\b|\b\d{4}\b/.test(text))return null;
 return today;
}
export function progressIntent(message){
 const m=plain(message).split(/комментарий:|заметка:/)[0].trim();
 if(/(?:мой вес|я вешу|я весил|запиши (?:мой )?вес|сохрани (?:мой )?вес)/.test(m)&&!/[?]/.test(m)&&!/(сколько|покажи|какой|истори|изменени)/.test(m)){if(/рост|оборудован|тренироваться|цель|минут|опыт/.test(m.split(/комментарий:|заметка:/)[0]))return null;return {kind:'record_weight'};}
 if(/(весил.*раньше|изменени.*вес|истори.*вес|вес.*истори|покажи.*вес)/.test(m))return {kind:'weights'};
 if(/(когда.*(?:тренировал|тренировк).*(послед|раз)|когда.*последн.*трениров|последн.*раз.*тренировал)/.test(m))return {kind:'last_workout'};
 if(/сколько.*трениров.*(?:недел|7 дней|семь дней)/.test(m))return {kind:'week_workouts'};
 if(/(?:истори[яю].*трениров|(?:какие|покажи|показать).*(?:последн.*трениров|трениров.*(?:выполн|заверш|сделал)|истори.*трениров))/.test(m))return {kind:'workouts'};
 if(/(?:какой|сколько).*(?:вес|килограмм|кг|повтор|подход).*(?:прошл|последн)|(?:прошл|последн).*(?:жал|жим|присед|тяга|отжим)/.test(m)){
  const query=m.replace(/^.*?(?:вес|килограмм|кг|повторений|подходов)\s*/,'').replace(/(?:в прошлый раз|прошлый раз|в последн[а-я ]+раз).*$/,'').replace(/\b(?:я|на|в|у|меня)\b/g,'').trim();
  const terms=/леж|лежа/.test(m)&&/жал|жим/.test(m)?['жим','леж']:/стоя/.test(m)&&/жал|жим/.test(m)?['жим','стоя']:/жал|жим/.test(m)?['жим']:/присед/.test(m)?['присед']:/тяга/.test(m)?['тяга']:/отжим/.test(m)?['отжим']:query.split(/[^а-яa-z0-9]+/).filter(x=>x.length>=3).slice(0,4);
  return {kind:'exercise',terms};
 }
 // An unsupported personal-history question must not fall through to a model.
 if(/(?:раньше|прошл|истори|последн|уже выпол|сделал за)/.test(m)&&/вес|трениров|жим|повтор|подход/.test(m))return {kind:'clarify'};
 return null;
}
export function weightRecord(message,timezone='UTC',now=new Date()){
 const raw=String(message).trim(),m=plain(raw).split(/комментарий:|заметка:/)[0].trim(),today=localDay(now,timezone);
 if(/например|допустим|если|хочу|буду|не вешу|цитат|[«»"“”]/.test(m))return {answer:'Для записи укажи свой фактический вес в кг и дату измерения.'};
 const values=[...m.matchAll(/(?:мой вес(?: сейчас)?|я вешу|я весил|запиши (?:мой )?вес|сохрани (?:мой )?вес)\s*(?:—|:|=)?\s*(\d+(?:[.,]\d+)?)\s*(кг|kg|килограмм\w*|lb|фунт\w*)?/g)];
 if(values.length!==1||[...m.matchAll(/\d+(?:[.,]\d+)?\s*(?:кг|kg|килограмм|lb|фунт)/g)].length>1||/\bили\b/.test(m))return {answer:'Укажи одно измерение, например: «Запиши мой вес 83,5 кг, дата 2026-10-01».'};
 if(!/^(кг|kg|килограмм)/.test(values[0][2]||''))return {answer:'Укажи вес в килограммах (кг). Без единицы измерения запись не сохраняю.'};
 const weight=Number(values[0][1].replace(',','.')),date=measurementDay(m,today);
 if(!Number.isFinite(weight)||weight<20||weight>300||Math.abs(weight*100-Math.round(weight*100))>1e-7)throw new AIError('invalid_progress',422);
 if(date===null)return {answer:'Укажи точную дату измерения в формате ГГГГ-ММ-ДД. Предыдущие значения останутся в истории.'};
 if(!validMeasurementDate(date,today))throw new AIError('invalid_progress',422);
 const notes=raw.match(/(?:комментарий|заметка)\s*:\s*(.*)$/is)?.[1]?.trim()||'';
 if(notes.length>1500)throw new AIError('invalid_progress',422);
 return {record:{recorded_on:date,weight_kg:weight,notes,timezone:zone(timezone),source:'chat'},answer:`Измерение сохранено: ${date} — ${kg(weight)} кг. Предыдущие записи сохранены; вес профиля соответствует последнему измерению по дате.`};
}
const workoutDate=(s,tz)=>new Intl.DateTimeFormat('ru-RU',{timeZone:validTimezone(tz),dateStyle:'medium',timeStyle:'short'}).format(new Date(s.completed_at));
export function historyAnswer(intent,history,timezone='UTC'){
 const sessions=Array.isArray(history.workouts)?history.workouts:[],weights=Array.isArray(history.weights)?history.weights:[];
 const done=sessions.filter(s=>s.completed_at&&s.data?.status==='completed');
 if(intent.kind==='last_workout')return done.length?`Последняя сохранённая выполненная тренировка: ${workoutDate(done[0],timezone)} — ${done[0].data.workout?.title||'Тренировка'}.`:'Пока нет сохранённых выполненных тренировок. Открытые и остановленные занятия не считаются выполненными.';
 if(intent.kind==='week_workouts')return `За последние 7 календарных дней (${history.week_start} — ${history.today}, ${zone(timezone)}) сохранено выполненных тренировок: ${Number(history.workout_count_week)||0}. Открытые и остановленные занятия не учитываются.`;
 if(intent.kind==='workouts')return done.length?'Последние сохранённые выполненные тренировки:\n'+done.map(s=>`${workoutDate(s,timezone)} — ${s.data.workout?.title||'Тренировка'}${s.data.duration_minutes!=null?' · '+s.data.duration_minutes+' мин':''}`).join('\n'):'История выполненных тренировок пока пуста. План программы не означает выполнения.';
 if(intent.kind==='weights')return weights.length?'Последние измерения веса:\n'+weights.map(x=>`${x.recorded_on} — ${kg(x.weight_kg)} кг${x.notes?' · '+x.notes:''}`).join('\n')+'\n'+(history.first_weight&&history.latest_weight&&history.first_weight.id!==history.latest_weight.id?`Изменение между первым (${history.first_weight.recorded_on}, ${kg(history.first_weight.weight_kg)} кг) и последним (${history.latest_weight.recorded_on}, ${kg(history.latest_weight.weight_kg)} кг) измерением: ${kg(history.latest_weight.weight_kg-history.first_weight.weight_kg)} кг.`:'Для сравнения нужно хотя бы два сохранённых измерения.'): 'История измерений веса пока пуста. Вес из профиля без известной даты измерения не превращаю в историческую запись.';
 if(intent.kind==='exercise'){
  if(!intent.terms?.length)return 'Укажи название упражнения, например «Какой вес я жал лёжа в прошлый раз?».';
  const found=new Map();
  for(const s of history.exercise_workouts||[])if(s.data?.status==='completed')for(const set of s.data.sets||[]){const name=String(set.exercise||'');if(intent.terms.every(t=>plain(name).includes(t))){const key=plain(name);if(!found.has(key))found.set(key,{name,session:s,sets:[]});if(found.get(key).session.id===s.id)found.get(key).sets.push(set);}}
  if(found.size>1)return 'В истории есть несколько подходящих упражнений: '+[...found.values()].map(x=>x.name).join(', ')+'. Укажи полное название.';
  if(!found.size)return 'Для этого упражнения нет сохранённых фактических результатов в выполненных тренировках. Плановые веса и повторения не считаю результатами.';
  const {name,session,sets}=[...found.values()][0];
  return `${name}, последняя запись в выполненной тренировке ${workoutDate(session,timezone)}:\n`+sets.map((s,i)=>`Подход ${i+1}: ${s.weight_kg!=null?kg(s.weight_kg)+' кг':'вес не указан'}${s.reps!=null?' · '+s.reps+' повторений':' · повторения не указаны'}`).join('\n');
 }
 return 'Из сохранённой истории могу показать измерения веса, последние выполненные тренировки, число тренировок за последние 7 дней и записанные результаты конкретного упражнения. Уточни запрос.';
}
