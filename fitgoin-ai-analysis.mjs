// Stage 3E: calculations use the owner's journal, never model-generated history.
import {AIError,UUID} from './fitgoin-ai-core.mjs';
import {programFacts,programBlocked,validateProgram,reconcileProgramTime} from './fitgoin-ai-program.mjs';
import {providerDocument,cursorForVersion} from './fitgoin-ai-workout.mjs';
import {kg} from './fitgoin-ai-progress.mjs';

const lower=s=>String(s||'').toLocaleLowerCase().replace(/ё/g,'е').trim();
const examples=/пример|например|цитат|гипотет|если бы|мой друг|мой брат|for example|hypothet/i;
const confirm=/^(?:да|согласен|подтверждаю|примени изменение|сохрани изменение|сохрани адаптацию|подтверждаю прогрессию)(?:[.!]*$|[,: ]+)/i;
const decline=/^(?:нет|не надо|пока не надо|не хочу (?:менять|изменять|применять)|не меняй|не изменяй|оставь программу|откажусь|отмена|отмени изменение|отмени адаптацию|cancel|no)(?:[.!]*$|[,: ]+)/i;
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v)?Number(v):null;
const difficulty=r=>{const n=number(r.data?.difficulty);return Number.isInteger(n)&&n>=1&&n<=10?n:null;};
const round=v=>Math.round(v*100)/100;
const dayTime=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?Date.parse(d+'T00:00:00Z'):NaN;
const gap=(a,b)=>Math.round((dayTime(b)-dayTime(a))/86400000);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
// A measured weight change is the input to this analysis, not an implicit
// change of equipment, schedule or goal. The confirmed version takes a fresh
// complete snapshot; other changed sports facts still require a full review.
function analysisPlanOutdated(plan,data){
 const omitWeight=o=>Object.fromEntries(Object.entries(o||{}).filter(([k])=>k!=='weight_kg'));
 const saved=omitWeight(plan?.profile_snapshot),current=omitWeight(programFacts(data));
 return plan?.document?.schema_version!==2||Object.keys(saved).length!==Object.keys(current).length||Object.keys(current).some(k=>JSON.stringify(saved[k])!==JSON.stringify(current[k]));
}

// Negated symptoms are not a new injury. Hypothetical questions get conditional
// education; only an actual personal report can stop a session/set a safety flag.
function symptomText(message){return lower(message).split(/[.!?;,\n]+|\s+но\s+|\s+but\s+/).filter(s=>!/(?:нет|без|не испытываю|не чувствую|не было|не болит|no |without ).*(?:бол|травм|одыш|сознани|pain|injur|breath)|(?:бол|травм|одыш)[^.!?]{0,40}(?:нет|не было|отсутств)/i.test(s)).join('. ');}
export function safetyNotice(message){
 const s=symptomText(message),urgent=/боль[^.!?]{0,45}груд|груд[^.!?]{0,45}бол|потер(?:ял[аи]?|я|ять)[^.!?]{0,20}сознани|обморок|резк[^.!?]{0,25}одыш|(?:сильн|серьезн)[^.!?]{0,30}(?:одыш|травм|кровотеч)|не могу дышать|задыхаюсь|перелом|severe chest pain|passed out|cannot breathe|major injury/i.test(s);
 const pain=/мне больно|(?:у меня|сейчас|сегодня|после тренировки).*(?:болит|боль|травм)|injured|i feel pain/i.test(s);
 if(!urgent&&!pain)return null;
 const current=!examples.test(message)&&!/(?:что делать[, ]+(?:при|если)|что такое|если (?:будет|возникнет)|what if)/i.test(message);
 return {level:urgent?'urgent':'pain',current,answer:urgent?`${current?'Останови тренировку.':'Если это происходит сейчас, останови тренировку.'} При боли в груди, потере сознания, резкой одышке или серьёзной травме нужна срочная медицинская помощь. Обратись в местную экстренную службу; не продолжай нагрузку и не садись за руль. AI не может определить причину симптомов.`:`${current?'Останови болезненное движение и тренировку.':'Если движение вызывает боль, остановись.'} До оценки специалистом нагрузку не увеличиваем. Персональную адаптацию при травме нужно согласовать со специалистом.`};
}

export function analysisIntent(message,data={},target){
 const s=lower(message),pending=data.program_edit_pending;
 if(examples.test(s))return null;
 if(/^покажи изменение моего веса[.!?]*$/.test(s))return null; // Existing 3D history command.
 if(/^сколько.*трениров.*(?:за (?:последнюю )?неделю|за 7 дней|за семь дней)[.!?]*$/.test(s))return null;
 if(data.workout_log_pending&&!target?.draft_id&&!/адаптац|изменени|прогресси|программ/.test(s)&&(confirm.test(s)||decline.test(s)))return null;
 if(target?.draft_id||pending?.kind==='progress_analysis'){
  if(decline.test(s))return {kind:'decline'};
  if(confirm.test(s))return {kind:'confirm'};
 }
 if(/^(?:не меняй|не изменяй|оставь)(?: мою)? программ/.test(s))return {kind:'decline'};
 if(!/проанализ|анализ.*(?:вес|трениров|питан|прогресс)|оцени.*(?:прогресс|нагруз|результат|вес)|(?:мой|мои|моего) (?:прогресс|результаты|успехи)|(?:динамик|(?:изменени|изменил(?:ся|ась|ись))|темп).*(?:вес|результат)|вес (?:стоит|не меняется)|(?:застой|плато).*(?:вес|похуд)|(?:увелич|сниз|уменьш|скоррект|адапт).*(?:нагруз|объем|программ|график)|(?:слишком|постоянно).*(?:легк|тяжел).*трениров|трениров.*(?:слишком|постоянно).*(?:легк|тяжел)|сколько.*трениров.*(?:за .*недел|за .*дн|за месяц)|(?:выполн|соблюд).*(?:график|расписани)|(?:достиг|достигнута).*(?:цель|веса)/i.test(s))return null;
 let days=28;
 const explicit=s.match(/за (?:последн(?:ие|их|юю|ий|ую) )?(\d+)\s*(дн|день|дней|недел)/);
 if(explicit)days=Number(explicit[1])*(explicit[2].startsWith('недел')?7:1);
 else if(/четыре недели|четырех недель|4 недели/.test(s))days=28;
 else if(/за (?:последнюю )?неделю/.test(s))days=7;
 else if(/за (?:последний )?месяц/.test(s))days=30;
 return {kind:'analyze',days:days>=7&&days<=56?days:null};
}

function weightSummary(rows){
 const byDay=new Map();
 for(const r of rows||[]){const v=number(r.weight_kg);if(v!==null&&v>=20&&v<=300&&Number.isFinite(dayTime(r.recorded_on)))byDay.set(r.recorded_on,{...r,weight_kg:v});}
 const samples=[...byDay.values()].sort((a,b)=>a.recorded_on.localeCompare(b.recorded_on)),first=samples[0],last=samples.at(-1),span=first&&last?gap(first.recorded_on,last.recorded_on):0;
 const delta=span>0?round(last.weight_kg-first.weight_kg):null;
 const range=samples.length?Math.max(...samples.map(x=>x.weight_kg))-Math.min(...samples.map(x=>x.weight_kg)):0;
 return {samples,first,last,span,delta,plateau:samples.length>=3&&span>=14&&range<=.5,rapid_gain:samples.length>=3&&span>=14&&delta>0&&delta/first.weight_kg/span*7>.01};
}
const completed=h=>(h.workouts?.recent||[]).filter(x=>x.data?.status==='completed'&&Number.isFinite(Date.parse(x.completed_at))).sort((a,b)=>Date.parse(b.completed_at)-Date.parse(a.completed_at));
function riskIn(history,data){return programBlocked(data)||Boolean(history.workouts?.pain_stops)||completed(history).some(x=>symptomText((x.data.comment||'')+'. '+(x.data.sets||[]).map(s=>s.comment||'').join('. ')).match(/болит|боль|травм|pain|injur/))||(history.measurements||[]).some(x=>symptomText(x.notes||'').match(/болит|боль|травм|pain|injur/));}

function candidate(history,data,plan){
 if(!plan||programBlocked(data)||analysisPlanOutdated(plan,data)||history.workouts?.active_count||data.current_workout&&!data.current_workout.session_id||riskIn(history,data))return null;
 const rows=completed(history),last3=rows.slice(0,3),evidence=rs=>rs.map(r=>({id:r.id,revision:r.revision}));
 if(last3.length===3&&last3.every(r=>r.plan_id===plan.id&&difficulty(r)>=8)){
  const changes=plan.document.workouts.flatMap(w=>{const e=[...w.exercises].filter(e=>e.sets>=2).sort((a,b)=>b.sets-a.sets)[0];return e?[{workout_id:w.id,exercise_id:e.id,field:'sets',before:e.sets,after:e.sets-1}]:[];});
  if(changes.length)return {operation:'reduce_volume',changes,evidence:evidence(last3),reason:'Три последние завершённые тренировки этой программы оценены на 8–10 из 10. Предлагаю временно снизить объём: убрать один подход у одного упражнения в каждом занятии. Отдых, разминка, завершение и остальные упражнения сохраняются.'};
 }
 // No progression just because a plan says 3×10. Two actual, consecutive
 // sessions for this workout must contain the prescribed reps/sets.
 for(const w of plan.document.workouts){
  const recent=rows.filter(r=>r.data.workout?.id===w.id).slice(0,2);
  if(recent.length!==2||recent.some(r=>r.plan_id!==plan.id||difficulty(r)===null||difficulty(r)>3))continue;
  for(const e of w.exercises){
   if(!/^\d+$/.test(e.reps)||Number(e.reps)<5||Number(e.reps)>=20)continue;
   if(recent.some(r=>{const sets=(r.data.sets||[]).filter(s=>s.exercise_id===e.id);return sets.length<e.sets||sets.some(s=>number(s.reps)===null||number(s.reps)<Number(e.reps));}))continue;
   return {operation:'increase_reps',changes:[{workout_id:w.id,exercise_id:e.id,field:'reps',before:e.reps,after:String(Number(e.reps)+1)}],evidence:evidence(recent),reason:`Два последних занятия «${w.title}» оценены как лёгкие (1–3/10), и целевые подходы и повторения «${e.name}» записаны выполненными. Предлагаю добавить только одно повторение в этом упражнении, сохранив рабочий вес. Для применения отдельно подтверди уверенную технику и отсутствие боли.`};
  }
 }
 return null;
}

function exerciseLines(trends){
 const lines=[];
 for(const t of trends||[]){
  const [last,prev]=t.sessions||[];if(!last||!prev)continue;
  const a=prev,b=last;
  const comparable=a.sets_count===b.sets_count&&a.known_reps===a.sets_count&&b.known_reps===b.sets_count&&a.known_weights===a.sets_count&&b.known_weights===b.sets_count&&a.min_reps===a.max_reps&&b.min_reps===b.max_reps&&a.min_reps===b.min_reps&&a.min_weight===a.max_weight&&b.min_weight===b.max_weight;
  if(comparable)lines.push(`${t.name}: ${a.sets_count} × ${a.min_reps}, ${kg(a.min_weight)} кг (${a.recorded_on}) → ${kg(b.min_weight)} кг (${b.recorded_on}); изменение рабочего веса ${b.min_weight-a.min_weight>0?'+':''}${kg(round(b.min_weight-a.min_weight))} кг. Это записанные подходы, а не оценка максимальной силы.`);
  else lines.push(`${t.name}: есть записи за ${a.recorded_on} и ${b.recorded_on}, но подходы, повторения или известный вес различаются. Прямое сравнение нагрузки ненадёжно.`);
 }
 return lines;
}

export function analyzeProgress(history,data={},plan){
 if(!history||!/^\d{4}-\d{2}-\d{2}$/.test(history.start_on||'')||!/^\d{4}-\d{2}-\d{2}$/.test(history.today||''))throw new AIError('backend_unavailable',503);
 const w=weightSummary(history.measurements),lines=[`Разбор сохранённых данных: ${history.start_on} — ${history.today} (${history.timezone}).`];
 if(w.delta===null)lines.push(w.samples.length?'Есть измерения только за одну дату. Для динамики нужны хотя бы две разные даты.':'В этом интервале измерений веса нет. Динамику веса определить нельзя.');
 else lines.push(`С ${w.first.recorded_on} по ${w.last.recorded_on} (${w.span} дн.) вес ${w.delta<0?'снизился':w.delta>0?'увеличился':'не изменился'}${w.delta!==0?' на '+kg(Math.abs(w.delta))+' кг':''}: ${kg(w.first.weight_kg)} → ${kg(w.last.weight_kg)} кг. Использованы ${w.samples.length} даты; при нескольких измерениях в день — последнее.`);
 const rows=completed(history),schedule=history.schedule;
 if(history.workouts){
  lines.push(`Выполнено тренировок за весь указанный интервал: ${history.workouts.completed_count}. Остановленные и незавершённые занятия исключены.`);
  if(schedule?.known_days>0&&schedule.planned>0)lines.push(`По известным датам сохранённого календаря: ${schedule.matched} из ${schedule.planned} плановых занятий имеют связанную запись о завершении. Проверены ${schedule.known_days} полных дней; ${schedule.unknown_days} дней без достоверного календаря и сегодняшний незаконченный день исключены.${schedule.unlinked_count?' Есть занятия без однозначной связи с плановым днём; они не доказывают пропуски.':''}`);
  else lines.push('Плановые занятия за этот период неизвестны или календарных занятий в проверенных датах нет. Сравнение «выполнено из запланированных» не рассчитываю.');
  const rated=rows.filter(r=>difficulty(r)!==null);
  lines.push(rated.length?`Сложность в последних ${rows.length} завершённых записях: ${rated.length} оценок, средняя ${kg(round(rated.reduce((n,r)=>n+difficulty(r),0)/rated.length))}/10. Неуказанные оценки не заменяются нулём.`:'Субъективная сложность не записана; по ней нельзя оценить нагрузку.');
  const exercises=exerciseLines(history.exercise_trends);lines.push(...(exercises.length?exercises:['Сопоставимых сохранённых результатов упражнений за две даты нет. Динамику силы не придумываю.']));
 }else lines.push('История тренировок не включена в этот разбор.');
 if(history.food){
  const f=history.food;lines.push(f.entries?`Фактический дневник питания: ${f.entries} записей за ${f.days} из ${history.days} дней. Среднее по записанным дням: ${kg(round(number(f.calories_low)/f.days))}–${kg(round(number(f.calories_high)/f.days))} ккал; белки ${kg(round(number(f.protein_g)/f.days))} г, жиры ${kg(round(number(f.fat_g)/f.days))} г, углеводы ${kg(round(number(f.carbs_g)/f.days))} г. Это сумма внесённых продуктов, полнота дня не подтверждена.`:'Фактических записей питания за этот период нет.');
  if(f.has_saved_menu)lines.push('Сохранённое меню — план питания; оно не подтверждает, что ты его соблюдаешь.');
 }else lines.push('Дневник питания не включён в этот разбор.');
 const fresh=w.last&&gap(w.last.recorded_on,history.today)<=7;
 if(fresh&&w.plateau)lines.push('Измерения за две или более недели меняются мало. Прежде чем менять калорийность, проверь условия взвешивания и полноту фактического дневника питания; соблюдение меню из этих данных неизвестно.');
 if(fresh&&w.rapid_gain)lines.push('Зафиксирован заметный темп набора веса. Проверь повторные измерения и фактическую калорийность; план меню не показывает реальное потребление. По этим данным нельзя установить причину изменения веса.');
 const target=lower(data.target),targetMatch=!/жим|присед|тяга/.test(target)&&target.match(/(?:вес(?:ить)?|до|достичь)\s*(\d+(?:[.,]\d+)?)\s*кг/);
 if(fresh&&targetMatch){const value=Number(targetMatch[1].replace(',','.'));if(value>=20&&value<=300&&(data.goal==='Похудение'&&w.last.weight_kg<=value||data.goal==='Набор мышечной массы'&&w.last.weight_kg>=value))lines.push(`Последнее измерение достигло указанного в профиле целевого веса ${kg(value)} кг. Предлагаю обсудить обновление цели; сама цель и программа не изменены.`);}
 let proposal=candidate(history,data,plan);
 if(riskIn(history,data)){lines.push('Есть ограничения или запись о боли/травме. Обычную прогрессию не предлагаю; восстановление и изменение нагрузки нужно обсудить со специалистом.');proposal=null;}
 else if(history.workouts?.active_count||data.current_workout&&!data.current_workout.session_id){lines.push('Сейчас есть незавершённая тренировка. Адаптацию программы обсудим после её завершения или остановки.');proposal=null;}
 else if(plan&&analysisPlanOutdated(plan,data)){lines.push('Спортивные условия изменились. Сначала пересмотри актуальность программы; адаптацию по прежним данным не сохраняю.');proposal=null;}
 else if(proposal)lines.push(proposal.reason);
 else if(schedule?.known_days>=7&&schedule.planned>=3&&schedule.matched/schedule.planned<.6&&schedule.unlinked_count===0){const count=plan?.document.workouts.length,suggested=count>1?Math.max(1,Math.min(count-1,Math.ceil(count*schedule.matched/schedule.planned))):null;lines.push('В журнале меньше завершённых занятий, чем в известном календаре. Если ты пропускал тренировки, '+(suggested?`предлагаю обсудить ${suggested} занятий в неделю вместо ${count}, выбрав удобные дни и сохранив подходящий состав программы.`:'предлагаю выбрать более удобные постоянные дни, чтобы график было легче соблюдать.')+' Отсутствие записи само по себе не доказывает пропуск. График не изменён.');}
 else lines.push('Данных для обоснованного увеличения или снижения нагрузки недостаточно. Если программа подходит и самочувствие обычное, пока сохрани текущую программу и продолжай записывать результаты.');
 if(rows.slice(0,3).some(r=>difficulty(r)>=8))lines.push('Проверь сон, восстановление и фактическое питание вместе с нагрузкой. По одному запланированному меню нельзя оценить достаточность питания.');
 return {answer:lines.join('\n\n'),proposal,summary:{start_on:history.start_on,end_on:history.today,timezone:history.timezone,weight_delta:w.delta,weight_first:w.first?.recorded_on||null,weight_last:w.last?.recorded_on||null,completed_count:history.workouts?.completed_count??null}};
}

export function applyProgressProposal(plan,data,proposal){
 const doc=structuredClone(plan.document);
 if(!['reduce_volume','increase_reps'].includes(proposal.operation)||!Array.isArray(proposal.changes)||proposal.changes.length<1||proposal.changes.length>6)throw new AIError('progress_proposal_changed',409);
 for(const c of proposal.changes){const w=doc.workouts.find(w=>w.id===c.workout_id),e=w?.exercises.find(e=>e.id===c.exercise_id);if(!e||e[c.field]!==c.before)throw new AIError('progress_proposal_changed',409);
  if(proposal.operation==='reduce_volume'&&c.field==='sets'&&Number.isInteger(c.before)&&c.before>=2&&c.after===c.before-1)e.sets=c.after;
  else if(proposal.operation==='increase_reps'&&proposal.changes.length===1&&c.field==='reps'&&/^\d+$/.test(c.before)&&Number(c.before)>=5&&Number(c.before)<20&&c.after===String(Number(c.before)+1)){e.reps=c.after;e.minutes+=.5;w.minutes=Math.max(w.minutes,Math.ceil(8+w.exercises.reduce((n,e)=>n+e.minutes,0)));}
  else throw new AIError('progress_proposal_changed',409);
 }
 const plain=reconcileProgramTime(providerDocument(doc));validateProgram(plain,data);
 doc.workouts=doc.workouts.map((w,i)=>({...w,minutes:plain.workouts[i].minutes,exercises:w.exercises.map((e,j)=>({...e,minutes:plain.workouts[i].exercises[j].minutes}))}));
 return doc;
}

export function progressTurn({intent,message,history,data,plan,target,conversation,now=new Date()}){
 const pending=data.program_edit_pending;
 if(target?.draft_id&&(!UUID.test(target.draft_id)||!UUID.test(target.program_id||'')||Object.keys(target).some(k=>!['draft_id','program_id'].includes(k))))throw new AIError('progress_proposal_changed',409);
 if(intent.kind==='decline'){
  if(pending?.kind!=='progress_analysis')return {answer:'Изменение программы не применяю. Активная версия сохранена.',extra:{}};
  if(pending.conversation_id!==conversation||target&&(target.draft_id!==pending.id||target.program_id!==pending.program_id))throw new AIError('progress_proposal_changed',409);
  return {answer:'Предложенная адаптация отменена. Программа, её предыдущие версии и результаты тренировок сохранены.',extra:{program_edit_pending:null,analysis_change:{operation:'cancel',draft_id:pending.id}}};
 }
 if(intent.kind==='confirm'){
  if(pending?.kind!=='progress_analysis'||pending.mode!=='proposal'||pending.program_id!==plan?.id||pending.conversation_id!==conversation||target&&(target.draft_id!==pending.id||target.program_id!==plan.id)||!Number.isFinite(Date.parse(pending.created_at))||now-Date.parse(pending.created_at)>86400000||Date.parse(pending.created_at)>now.getTime()+60000||!same(pending.profile_snapshot,programFacts(data)))throw new AIError('progress_proposal_changed',409);
  const recommendation=analyzeProgress(history,data,plan).proposal;
  if(!recommendation||!same([recommendation.operation,recommendation.changes,recommendation.evidence],[pending.operation,pending.changes,pending.evidence]))throw new AIError('progress_proposal_changed',409);
  const explicitProgression=!/[?]/.test(message)&&!/(?:^|\s)(?:если|может|возможно|вероятно|наверное|if|provided)(?:\s|$)/i.test(message)&&/техника (?:уверенная|стабильная|хорошая)|technique is (?:good|sound)/i.test(message)&&/боли нет|без боли|no pain/i.test(message);
  if(pending.operation==='increase_reps'&&!explicitProgression)return {answer:'Для прогрессии подтверди оба условия: техника уверенная и боли нет. До этого программа не меняется.',extra:{program_view:true}};
  const doc=applyProgressProposal(plan,data,pending),id=crypto.randomUUID();
  return {answer:'Подтверждённая адаптация сохранена в новой активной версии. Предыдущая версия программы и фактические результаты тренировок сохранены.',extra:{kind:'training',plan_id:id,document:doc,program_saved:true,program_pending:false,program_previous_id:plan.id,profile_snapshot:programFacts(data),program_edit_pending:null,current_workout:cursorForVersion(data.current_workout,plan,id,doc),analysis_change:{operation:'confirm',draft_id:pending.id}}};
 }
 if(!intent.days)return {answer:'Разбор поддерживает интервал от 7 до 56 дней. Укажи этот интервал; расчёты за другой период не подменяю данными за месяц.',extra:{}};
 const report=analyzeProgress(history,data,plan),extra={progress_analysis:{...report.summary,answer:report.answer}};
 if(report.proposal){
  if(pending&&pending.kind!=='progress_analysis')return {answer:report.answer+'\n\nСначала прими или отмени уже предложенную замену упражнения. Новое предложение не заменяет её.',extra};
  try{applyProgressProposal(plan,data,report.proposal);}catch(error){if(error instanceof AIError&&error.code==='invalid_plan')return {answer:report.answer+'\n\nПредложение не укладывается в проверенный бюджет времени. Новую версию не предлагаю сохранять; обсуди вариант с тренером.',extra};throw error;}
  const proposal={mode:'proposal',kind:'progress_analysis',id:crypto.randomUUID(),program_id:plan.id,conversation_id:conversation,created_at:now.toISOString(),days:intent.days,start_on:history.start_on,timezone:history.timezone,profile_snapshot:programFacts(data),...report.proposal};
  extra.program_edit_pending=proposal;extra.program_view=true;
  const details=proposal.changes.map(c=>{const w=plan.document.workouts.find(w=>w.id===c.workout_id),e=w.exercises.find(e=>e.id===c.exercise_id);return `${w.title} · ${e.name}: ${c.before} → ${c.after} ${c.field==='sets'?'подходов':'повторений'}`;}).join('; ');
  return {answer:report.answer+'\n\nПредлагаемые изменения: '+details+'.\nПрограмма пока не изменена. '+(proposal.operation==='increase_reps'?'Для согласия напиши «Подтверждаю прогрессию: техника уверенная, боли нет».':'Напиши «Сохрани адаптацию» для согласия.')+' Для отказа — «Не меняй программу».',extra};
 }
 return {answer:report.answer,extra};
}
