// Server-controlled estimates and explicit food memory in the existing profile.
import {AIError,nutritionEstimate} from './fitgoin-ai-core.mjs';
import {prepareMemoryPatch} from './fitgoin-ai-memory.mjs';

const norm=s=>String(s||'').toLocaleLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const goals=['loss','gain','maintain','performance'];
const goalLabels={loss:'снижение веса',gain:'набор мышечной массы',maintain:'поддержание веса',performance:'улучшение спортивной формы'};
const activityLabels={sedentary:'низкая',light:'умеренная',active:'высокая'};
const incidental=/например|цитат|мо(?:й|ему|его) (?:друг|клиент|брат)|моя (?:подруга|сестра)|если|представим|for example|my friend|hypothet|if |par exemple|mon ami|«|»|[“”"]/iu;
const temporary=/сегодня|завтра|на эту неделю|на этой неделе|один раз|today|tomorrow|this week|aujourd.hui|demain/iu;
const clinical=/беремен|кормлю груд|диабет|анорекс|булими|расстройств.*пищев|тяжел.*аллерг|pregnan|breastfeed|diabet|anorex|bulimi|eating disorder|severe allerg/iu;
const medicalText=d=>[d.restrictions,d.diet,d.nutrition_preferences?.restrictions,d.nutrition_preferences?.preferences].filter(x=>typeof x==='string').join(' ');
const text=(x,n)=>typeof x==='string'&&x.trim().length<=n&&!/[\u0000-\u001f]/.test(x)?x.trim():undefined;
const canonicalFood=s=>norm(s).replace(/^(?:рыбу|рыбы|fish|poisson)$/u,'рыба').replace(/^(?:свинину|свинины|pork)$/u,'свинина');
function invalid(){return new AIError('memory_update_invalid',422);}
export function nutritionPreferences(data={}){
 const p=data.nutrition_preferences===undefined?{}:data.nutrition_preferences;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['excluded_foods','restrictions','preferences','meals_per_day','goal'].includes(k)))throw invalid();
 const result={};
 if(p.excluded_foods!==undefined){if(!Array.isArray(p.excluded_foods)||p.excluded_foods.length>12||p.excluded_foods.some(x=>!text(x,100)))throw invalid();result.excluded_foods=[...new Set(p.excluded_foods.map(canonicalFood))];}
 for(const [key,max] of [['restrictions',800],['preferences',600]])if(p[key]!==undefined){const v=text(p[key],max);if(v===undefined)throw invalid();result[key]=v;}
 if(data.diet!==undefined){const v=text(data.diet,600);if(v===undefined)throw invalid();if(v)result.preferences=v;else delete result.preferences;}
 if(p.meals_per_day!==undefined){if(!Number.isInteger(p.meals_per_day)||p.meals_per_day<1||p.meals_per_day>8)throw invalid();result.meals_per_day=p.meals_per_day;}
 if(p.goal!==undefined){if(!goals.includes(p.goal))throw invalid();result.goal=p.goal;}
 return result;
}
export function nutritionCalculationIntent(message){
 const s=norm(message);return !/например|for example|мой друг|my friend|формул|formula|«|»|[“”"]/iu.test(s)&&/(калори|бжу|macros|calories|calorie|proteins? fats?)/iu.test(s)&&/(рассч|посчит|сколько|мои|мне|моя|calculate|estimate|my |combien|calcule)/iu.test(s);
}
export function nutritionMemory(data,message){
 const previous=nutritionPreferences(data),prefs={...previous},fields=[],patch={},updates=[];
 if(incidental.test(message))return {patch,fields,data};
 for(const raw of message.split(/[!;\n]+|\.(?!\d)/u)){
  const s=norm(raw);if(!s||(s.includes('?')&&!nutritionCalculationIntent(s)))continue;let m;
  if(!temporary.test(raw)){
  if((m=s.match(/^(?:я не ем|i (?:do not|don't) eat|je ne mange pas) (.+)$/u))){
   const foods=m[1].split(/\s*[,]\s*|\s+(?:и|and|et)\s+/u).map(canonicalFood);
   if(foods.some(x=>!text(x,100)))throw invalid();prefs.excluded_foods=[...new Set([...(prefs.excluded_foods||[]),...foods])];fields.push('excluded_foods');
  }else if((m=s.match(/^(?:я (?:теперь|снова) ем|i eat (?:again|now)) (.+)$/u))){
   const remove=m[1].split(/\s*[,]\s*|\s+(?:и|and)\s+/u).map(canonicalFood);prefs.excluded_foods=(prefs.excluded_foods||[]).filter(x=>!remove.includes(x));fields.push('excluded_foods');
  }else if((m=s.match(/^(?:мои пищевые ограничения|my dietary restrictions)\s*[:—-]\s*(.+)$/u))){prefs.restrictions=/^(?:нет|none)$/u.test(m[1])?'':m[1];fields.push('restrictions');}
  else if((m=s.match(/^(?:мои пищевые предпочтения|в питании я предпочитаю|my food preferences)\s*[:—-]?\s*(.+)$/u))){patch.diet=m[1];fields.push('diet');}
  else if(/^(?:я вегетарианец|я вегетарианка|я веган|я веганка|i am vegan|i am vegetarian)$/u.test(s)){patch.diet=s;fields.push('diet');}
  else if((m=s.match(/^(?:я предпочитаю|я хочу|хочу|i prefer) (\d)\s*(?:приема? пищи|приемов пищи|meals)(?: в день| per day)?$/u))||(m=s.match(/^(?:я хочу|хочу) есть (\d) раза? в день$/u))){prefs.meals_per_day=Number(m[1]);fields.push('meals_per_day');}
  else if((m=s.match(/^(?:моя цель (?:по питанию|в питании)|my nutrition goal)\s*[:—-]?\s*(.+)$/u))||(m=s.match(/^(?:я хочу|хочу|i want to)\s+(похудеть|снизить вес|набирать мышечную массу|набрать мышечную массу|поддерживать вес|улучшить спортивную форму|lose weight|gain muscle|maintain weight|improve performance)(?:\s|$)/u))){
   const v=m[1];prefs.goal=/похуд|сниз.*вес|сниж.*вес|weight loss|lose weight/u.test(v)?'loss':/мышеч|набор.*масс|muscle gain|gain muscle/u.test(v)?'gain':/поддерж|maintain/u.test(v)?'maintain':/спортив.*форм|performance/u.test(v)?'performance':null;fields.push('goal');
  }else if((m=s.match(/^(?:моя общая активность|my overall activity)\s*[:—-]?\s*(низкая|умеренная|высокая|sedentary|light|active)$/u))){patch.activity=({низкая:'sedentary',умеренная:'light',высокая:'active'})[m[1]]||m[1];fields.push('activity');}
  }
  if(/^(?:я |у меня |i am |i have )/iu.test(s)&&clinical.test(s))updates.push({field:'restrictions',value:raw.trim(),evidence:raw.trim()});
  // Numeric facts still use the Stage 2 validator and verbatim evidence.
  for(const [field,pattern] of [['age',/(?:мне|мой возраст)\s*(\d{1,3})\s*(?:лет|года?|год)/iu],['height_cm',/(?:мой рост|рост)\s*[:—-]?\s*(\d{3}(?:[.,]\d+)?)\s*см/iu],['weight_kg',/(?:мой вес|я вешу|вес)\s*[:—-]?\s*(\d{2,3}(?:[.,]\d+)?)\s*кг/iu]]){
   const found=raw.match(pattern);if(found)updates.push({field,value:found[1],evidence:found[0]});
  }
 }
 const memory=prepareMemoryPatch(data,updates,message);
 if(fields.some(x=>!['activity','diet'].includes(x))){const saved={...prefs};delete saved.preferences;patch.nutrition_preferences=nutritionPreferences({nutrition_preferences:saved});}
 if(patch.diet!==undefined&&text(patch.diet,600)===undefined)throw invalid();
 Object.assign(patch,memory.patch);const unique=[...new Set([...memory.fields,...fields.map(x=>['activity','diet'].includes(x)?x:'nutrition_preferences.'+x)])];
 return {patch,fields:unique,data:{...data,...patch}};
}
function nutritionGoal(data,prefs){
 if(prefs.goal)return prefs.goal;
 return ({'Похудение':'loss','Набор мышечной массы':'gain','Сила':'performance','Выносливость':'performance','Подготовка к соревнованиям':'performance'})[data.goal];
}
export function personalNutrition(data,program=null,currentMessage=''){
 const prefs=nutritionPreferences(data),goal=nutritionGoal(data,prefs),missing=[];
 for(const [key,min,max] of [['age',13,100],['height_cm',100,230],['weight_kg',30,300]])if(typeof data[key]!=='number'||!Number.isFinite(data[key])||data[key]<min||data[key]>max||(key==='age'&&!Number.isInteger(data[key])))missing.push(key);
 if(!Object.hasOwn(activityLabels,data.activity))missing.push('activity');if(!goal)missing.push('nutrition_goal');
 const questions={age:'Сколько тебе лет?',height_cm:'Какой у тебя рост в сантиметрах?',weight_kg:'Какой сейчас вес в килограммах?',activity:'Какая общая активность с учётом тренировок: низкая, умеренная или высокая? Например: «Моя общая активность — умеренная».',nutrition_goal:'Какая цель по питанию: снижение, набор, поддержание веса или спортивная форма? Например: «Моя цель в питании — поддержание веса».'};
 const requestedCalories=[...currentMessage.matchAll(/(?:на|не более|рацион\s*[:—-]?|diet|intake|only)\s*(\d{2,5})\s*(?:ккал|kcal|calories)/giu)].map(x=>Number(x[1]));
 if(clinical.test(medicalText(data)+' '+currentMessage)||data.needs_professional||(typeof data.age==='number'&&data.age<18)||data.restrictions?.trim()||requestedCalories.some(x=>x<1600||x>4500)||/голодать|голодов|purging|vomit|очищение.*рвот/iu.test(currentMessage))return {status:'professional',answer:'С указанными возрастом, ограничениями или запросом жёсткой диеты индивидуальные калории и БЖУ нужно обсудить со специалистом. Я могу объяснить общие принципы питания; экстремальную диету не предлагаю.'};
 if(missing.length)return {status:'missing',missing,answer:'Для расчёта не хватает данных. '+missing.slice(0,2).map(x=>questions[x]).join(' ')};
 let base;try{base=nutritionEstimate({...data,goal:goal==='loss'?'Похудение':goal==='gain'?'Набор мышечной массы':'Общее здоровье'});}catch(error){if(!(error instanceof AIError))throw error;return {status:'professional',answer:'Этот расчёт выходит за осторожные границы автоматического помощника. Обсуди индивидуальное питание со специалистом; снижать калории до экстремальных значений не предлагаю.'};}
 const calories=Math.round((base.calories_low+base.calories_high)/100)*50,protein=Math.round(data.weight_kg*(goal==='gain'?1.8:1.6)),fat=Math.round(calories*.3/9),carbs=Math.round((calories-protein*4-fat*9)/4);
 if(protein*4>calories*.35||fat<40||carbs<130)return {status:'professional',answer:'Для этих параметров обычная формула БЖУ недостаточно надёжна. Нужна индивидуальная оценка специалиста, а не жёсткое ограничение продуктов.'};
 const workouts=Array.isArray(program?.document?.workouts)?program.document.workouts:[],profileFrequency=Number.isInteger(data.days_per_week)&&data.days_per_week>=1&&data.days_per_week<=6?data.days_per_week:null;
 const estimate={...base,calories,protein_g:protein,fat_g:fat,carbs_g:carbs,goal,inputs:{age:data.age,height_cm:data.height_cm,weight_kg:data.weight_kg,activity:data.activity,days_per_week:profileFrequency,program_id:program?.id||null,planned_workouts:workouts.length||null},preferences:prefs,assumptions:['Диапазон использует оба коэффициента Mifflin–St Jeor; пол не угадывается.','Коэффициент общей активности уже включает тренировки; расход по программе повторно не прибавляется.','Программа описывает запланированные занятия, а не выполненные тренировки.']};
 const programNote=workouts.length?` Сохранённая программа: ${workouts.length} запланированных тренировок${profileFrequency&&profileFrequency!==workouts.length?' (частота в профиле отличается — программу стоит пересмотреть)':''}.`:profileFrequency?` По профилю: ${profileFrequency} тренировок в неделю.`:'';
 const prefNote=prefs.excluded_foods?.length?` Учитываю исключённые продукты: ${prefs.excluded_foods.join(', ')}.`:'';
 return {status:'ready',estimate,answer:`Ориентир для цели «${goalLabels[goal]}»: ${base.calories_low}–${base.calories_high} ккал в сутки. Для средней точки ${calories} ккал: белки ≈ ${protein} г, жиры ≈ ${fat} г, углеводы ≈ ${carbs} г. По сохранённым данным: ${data.age} лет, ${data.height_cm} см, ${data.weight_kg} кг; общая активность — ${activityLabels[data.activity]}.${programNote}${prefNote}\n\nЭто приблизительная оценка, а не медицинское назначение. Диапазон учитывает два коэффициента формулы без угадывания пола. Активность включает тренировки; их расход не прибавляю второй раз. Реальная потребность может отличаться.`};
}
export function nutritionTurn(data,message,module,program=null){
 const calculate=nutritionCalculationIntent(message),read=/^(?:что я не ем|какие у меня пищевые предпочтения|покажи мои пищевые предпочтения|what are my food preferences)[?!.]*$/iu.test(message.trim());
 const memory=nutritionMemory(data,message),continueCalculation=data.nutrition_pending===true&&memory.fields.length>0;
 if(!calculate&&!read&&!memory.fields.some(x=>x.startsWith('nutrition_preferences.')||['activity','diet'].includes(x))&&!continueCalculation)return null;
 if(calculate&&module!=='nutrition')return {answer:'Для персонального расчёта калорий и БЖУ выбери «AI-питание» в доступных тебе AI-модулях.',extra:{}};
 const prefs=nutritionPreferences(memory.data);let answer='',estimate=null,missing=[];
 if(read){const labels=[];if(prefs.excluded_foods?.length)labels.push('Не ешь: '+prefs.excluded_foods.join(', '));if(prefs.restrictions)labels.push('Пищевые ограничения: '+prefs.restrictions);if(prefs.preferences)labels.push('Предпочтения: '+prefs.preferences);if(prefs.meals_per_day)labels.push('Приёмов пищи в день: '+prefs.meals_per_day);if(prefs.goal)labels.push('Цель питания: '+goalLabels[prefs.goal]);answer=labels.length?'По сохранённой памяти:\n'+labels.join('\n'):'Пищевые предпочтения пока не сохранены. Можно сообщить, например: «Я не ем рыбу».';}
 if((calculate||continueCalculation)&&module==='nutrition'){
  const result=personalNutrition(memory.data,program,message);answer=result.answer;estimate=result.estimate||null;missing=result.missing||[];memory.patch.nutrition_pending=result.status==='missing';
 }
 if(memory.fields.length){const labels={excluded_foods:'исключённые продукты',restrictions:'пищевые ограничения',diet:'пищевые предпочтения',preferences:'предпочтения',meals_per_day:'число приёмов пищи',goal:'цель питания',activity:'общая активность',age:'возраст',height_cm:'рост',weight_kg:'вес'};answer='Сохранено в твоей памяти: '+memory.fields.map(x=>labels[x.split('.').at(-1)]).join(', ')+'.'+(answer?'\n\n'+answer:'');}
 return {answer,extra:{memory_saved:memory.fields.length>0,memory_fields:memory.fields,...(Object.keys(memory.patch).length?{memory_patch:memory.patch}:{}),...(estimate?{nutrition_estimate:estimate}:{}),...(missing.length?{missing_fields:missing}:{})}};
}
export const NUTRITION_MEMORY_RULES='CURRENT SAVED NUTRITION PREFERENCES are explicit durable facts. Respect excluded foods, preferences and dietary restrictions in ordinary nutrition advice. Do not invent allergens or medical facts. The backend handles exact calorie/macronutrient calculations and explicit food-memory updates. Never claim to save a food preference yourself. For unsupported wording ask a concise clarification such as "Мои пищевые предпочтения: ...". Do not turn a one-day choice, quote or third-party fact into permanent memory. Do not create menus, meal recipes or shopping lists for a basic calorie/macronutrient request. The current training program is planned activity, not completed workouts.';
