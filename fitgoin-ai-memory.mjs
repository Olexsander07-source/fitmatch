// One durable sports profile: fgi_ai_profiles.data. No credentials or storage here.
import {AIError,GOALS,CHAT_SCHEMA} from './fitgoin-ai-core.mjs';

export const MEMORY_FIELDS=['name','age','height_cm','weight_kg','goal','target','experience','training_experience','setting','equipment','days_per_week','minutes','restrictions','preferred_sports'];
export const MEMORY_LABELS={name:'Имя',age:'Возраст',height_cm:'Рост, см',weight_kg:'Вес, кг',goal:'Цель',target:'Желаемый результат',experience:'Уровень подготовки',training_experience:'Опыт тренировок',setting:'Место тренировок',equipment:'Оборудование',days_per_week:'Тренировок в неделю',minutes:'Минут на тренировку',restrictions:'Сообщённые ограничения',preferred_sports:'Предпочитаемые виды спорта'};
const ranges={age:[13,100],height_cm:[100,230],weight_kg:[30,300],days_per_week:[1,6],minutes:[10,90]};
const enums={goal:GOALS,experience:['beginner','intermediate','advanced'],setting:['home','gym','outdoor']};
const limits={name:100,target:300,training_experience:300,equipment:600,restrictions:800};
const labels={beginner:'Начинающий',intermediate:'Есть опыт',advanced:'Опытный',home:'Дома',gym:'В зале',outdoor:'На улице'};
const lower=v=>String(v).toLocaleLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const ambiguous=/пример|например|цитат|если бы|представим|гипотет|for example|hypothet|suppose|if i were|mon ami|si j’étais|наприклад|мой (?:брат|друг|клиент)|моя (?:сестра|жена|клиентка)|текст для обсуждения/i;
const numericWords={1:['один','одна','раз','one','une','одна'],2:['два','две','two','deux','два'],3:['три','three','trois'],4:['четыре','four','quatre','чотири'],5:['пять','five','cinq','п’ять'],6:['шесть','six','шість'],30:['полчаса','half an hour','une demi-heure']};
export const MEMORY_CHAT_SCHEMA={...CHAT_SCHEMA,properties:{...CHAT_SCHEMA.properties,memory_updates:{type:'array',items:{type:'object',additionalProperties:false,properties:{field:{type:'string',enum:MEMORY_FIELDS},value:{type:'string'},evidence:{type:'string'}},required:['field','value','evidence']}}},required:[...CHAT_SCHEMA.required,'memory_updates']};
export const MEMORY_RULES=`DURABLE SPORTS MEMORY: The existing FitGoIn app can now persist a small sports-profile patch atomically with a chat reply. Only extract explicit, current, first-person facts from the LATEST USER MESSAGE into memory_updates. Never extract from assistant replies, older history, account data, examples, quotes, third-party descriptions, hypotheses, questions or uploaded documents. Never infer a missing age, goal, weight, schedule, equipment or injury. A one-off 'today I have 12 minutes' is not the usual session length. Do not save casual topics or every sentence.
Use only the permitted fields. Each update needs evidence copied verbatim from this latest user message, including words identifying the field, not just a bare number. value is a string: numeric fields use the numeric value in kg/cm/minutes; goal uses one of ${JSON.stringify(GOALS)}; experience uses beginner/intermediate/advanced; setting uses home/gym/outdoor. Text fields copy the relevant exact words; preferred_sports is a comma-separated list of the sports the user explicitly named. Empty restrictions means the user explicitly said there are none. Equipment 'Без оборудования' requires an explicit statement that no equipment is available. Do not invent the equipment of a gym. A changed training place clears old equipment unless the user specifies the new equipment; ask what is available there. For an unclear change ask one short clarifying question and emit no update for it. Emit each field at most once.
The application will append a save confirmation ONLY AFTER the database transaction succeeds. Do not say that you saved/updated/remembered data yourself. Do not create programs while collecting memory. Read CURRENT SAVED SPORTS FACTS, not default form values. If a value is absent say it is not supplied.
For a new or incomplete user naturally collect at most two related missing facts per reply, starting with goal and level, then weekly frequency and typical minutes, then place and equipment, then important limitations. Do not ask for fields already saved or explicitly supplied now. Name, age, height, weight and detailed experience are optional unless needed for the current request; do not demand all of them to chat. Finish this short introduction once the seven basic sports facts are known. Never treat an unknown limitation as 'none'. Reported injuries are user statements, not diagnoses. Existing consent, safety and module access rules still apply.`;

function valueFor(field,value){
 if(ranges[field]){if(value===null||value===undefined||value==='')return undefined;const n=Number(String(value).replace(',','.'));const [min,max]=ranges[field];return Number.isFinite(n)&&n>=min&&n<=max&&(!['age','days_per_week','minutes'].includes(field)||Number.isInteger(n))?n:undefined;}
 if(enums[field])return enums[field].includes(value)?value:undefined;
 if(field==='preferred_sports'){const items=Array.isArray(value)?value:typeof value==='string'?value.split(/[,;]/):[];return items.length&&items.length<=6&&items.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=80)?[...new Set(items.map(x=>x.trim()))]:undefined;}
 if(!Object.hasOwn(limits,field)||typeof value!=='string'||value.length>limits[field]||/[\u0000-\u001f]/.test(value))return undefined;
 if(!value.trim()&&!['equipment','restrictions'].includes(field))return undefined;
 return value.trim();
}
export function sportsMemory(data={},accountName=''){
 const confirmed=Array.isArray(data.memory_confirmed_fields)?data.memory_confirmed_fields:[];
 const facts={};for(const field of MEMORY_FIELDS){if(!Object.hasOwn(data,field))continue;const value=valueFor(field,data[field]);if(value!==undefined&&(!(typeof value==='string')||value||confirmed.includes(field)))facts[field]=value;}
 if(!facts.name&&typeof accountName==='string'&&accountName.trim())facts.name=accountName.trim().slice(0,100);
 if(!facts.preferred_sports&&typeof data.sport==='string'&&data.sport.trim())facts.preferred_sports=[data.sport.trim().slice(0,80)];
 return facts;
}
export function missingSportsMemory(data={}){const facts=sportsMemory(data);return ['goal','experience','days_per_week','minutes','setting','equipment','restrictions'].filter(field=>!Object.hasOwn(facts,field));}
function supportedNumber(field,n,evidence){
 const anchors={age:/лет|возраст|age|ans|рок/i,height_cm:/рост|height|taille|зріст|см|cm/i,weight_kg:/вес|веш|weight|weigh|poids|pèse|ваг|kg|кг|кило/i,days_per_week:/недел|week|semaine|тижд/i,minutes:/минут|minute|полчаса|half an hour|demi-heure/i};
 if(!anchors[field].test(evidence))return false;
 const values=[...evidence.matchAll(/\d+(?:[.,]\d+)?/g)].map(x=>Number(x[0].replace(',','.')));
 return values.includes(n)||(field==='height_cm'&&values.some(x=>x>=1&&x<=2.3&&Math.abs(x*100-n)<.01))||(numericWords[n]||[]).some(word=>lower(evidence).includes(word));
}
function supportedCategory(field,value,evidence){
 const e=lower(evidence);const hints={goal:{'Похудение':/похуд|сброс|lose weight|perdre.*poids|схуд/,'Набор мышечной массы':/мышеч|muscle|массу|prise de masse/,'Сила':/сил|strong|strength|force/,'Выносливость':/вынослив|endurance|витрив/,'Подготовка к соревнованиям':/соревн|compet|состязан/,'Техника':/техник|technique/,'Подвижность':/подвиж|гибк|mobility|souplesse/,'Общее здоровье':/здоров|health|sante|santé/},experience:{beginner:/нович|начина|beginner|debut|début|початк|начал|начинаю/,intermediate:/есть опыт|intermediate|some experience|не нович|средний/,advanced:/опытн|advanced|expert|продвин|experiment|expériment/},setting:{home:/дом|home|maison|вдома/,gym:/зал|gym|salle/,outdoor:/улиц|outdoor|dehors|на вулиц/}};
 return hints[field]?.[value]?.test(e)||e.includes(lower(value));
}
function invalid(field,reason){const error=new AIError('memory_update_invalid',422);if(MEMORY_FIELDS.includes(field))error.memory_field=field;error.memory_reason=reason;return error;}
export function prepareMemoryPatch(data,updates,message){
 if(!Array.isArray(updates)||updates.length>MEMORY_FIELDS.length)throw new AIError('memory_update_invalid',422);
 if(!updates.length)return {patch:{},fields:[],data};
 if(ambiguous.test(message))throw new AIError('memory_update_invalid',422);
 const patch={},fields=[],seen=new Set();
 for(const update of updates){
  const {field,value,evidence}=update||{};
  if(!MEMORY_FIELDS.includes(field)||seen.has(field)||typeof value!=='string'||typeof evidence!=='string'||evidence.trim().length<3||evidence.length>1200||!message.includes(evidence)||evidence.trim().endsWith('?'))throw new AIError('memory_update_invalid',422);
  const parsed=valueFor(field,value);if(parsed===undefined)throw invalid(field,'invalid_value');
  if(ranges[field]&&!supportedNumber(field,parsed,evidence))throw invalid(field,'numeric_evidence');
  if(enums[field]&&!supportedCategory(field,parsed,evidence))throw invalid(field,'category_evidence');
  if(['minutes','setting','equipment','days_per_week'].includes(field)&&/сегодня только|только сегодня|на эту тренировку|this session|just today|aujourd’hui seulement/i.test(message))throw new AIError('memory_update_invalid',422);
  if(field==='restrictions'&&!parsed&&!/нет|без травм|no |none|aucun|немає/i.test(evidence))throw new AIError('memory_update_invalid',422);
  if(field==='equipment'&&!parsed&&!/нет.{0,15}оборуд|без оборуд|no equipment|sans matériel/i.test(evidence))throw new AIError('memory_update_invalid',422);
  if(!ranges[field]&&!enums[field]&&parsed!==''){
   // Lists may use commas instead of the user's conjunction; every item must
   // still be an exact phrase from the cited message, with no added inventory.
   const terms=Array.isArray(parsed)?parsed:field==='equipment'?parsed.split(/\s*[,;]\s*|\s+(?:и|and|et)\s+/iu):[parsed];const noEquipment=field==='equipment'&&/нет.{0,15}оборуд|без оборуд|no equipment|sans matériel/i.test(evidence);
   if(!noEquipment&&terms.some(term=>!lower(evidence).includes(lower(term))))throw invalid(field,'text_evidence');
  }
  seen.add(field);fields.push(field);patch[field]=parsed;
 }
 // A new place never silently inherits equipment from the old place.
 const placeChanged=Object.hasOwn(patch,'setting')&&patch.setting!==data.setting;
 if(placeChanged&&!Object.hasOwn(patch,'equipment'))patch.equipment='';
 if(Object.hasOwn(patch,'days_per_week')&&data.weekdays?.length!==patch.days_per_week)patch.weekdays=[];
 if(patch.preferred_sports)patch.sport=patch.preferred_sports[0];
 if(patch.restrictions)patch.needs_professional=true;
 const known=new Set((Array.isArray(data.memory_confirmed_fields)?data.memory_confirmed_fields:[]).filter(x=>MEMORY_FIELDS.includes(x)));fields.forEach(x=>known.add(x));
 if(placeChanged&&!fields.includes('equipment'))known.delete('equipment');
 patch.memory_confirmed_fields=[...known];
 return {patch,fields,data:{...data,...patch}};
}
export function memoryDisplayValue(field,value){return Array.isArray(value)?value.join(', '):labels[value]||String(value||(['equipment','restrictions'].includes(field)?'Нет':'Не указано'));}
export function memoryQuestionAnswer(message,facts){
 const text=lower(message).replace(/[?!.]+$/,'');const questions=[['goal',/^(?:какая у меня цель|какая моя цель|what is my goal|quel est mon objectif)$/],['days_per_week',/^(?:сколько раз в неделю я тренируюсь|сколько у меня тренировок в неделю|how many times a week do i train)$/],['weight_kg',/^(?:какой у меня сейчас вес|какой мой вес|сколько я вешу|what is my (?:current )?weight)$/],['setting',/^(?:где я тренируюсь|где я занимаюсь|where do i train)$/],['equipment',/^(?:какое оборудование у меня есть|какое у меня оборудование|what equipment do i have)$/],['name',/^(?:как меня зовут|what is my name)$/]];
 const found=questions.find(([,pattern])=>pattern.test(text));if(!found)return null;const field=found[0];const english=/^[a-z]/.test(text);
 if(!Object.hasOwn(facts,field))return english?'This information has not been saved yet. Tell me if you want to add it.':'Эти данные пока не сохранены. Можешь сообщить их, если хочешь добавить в спортивный профиль.';
 if(english)return `According to your saved profile: ${englishLabels[field]} — ${englishValue(field,facts[field])}${field==='weight_kg'?' kg':field==='days_per_week'?' times a week':''}.`;
 const unit=field==='weight_kg'?' кг':field==='days_per_week'?' раз в неделю':'';return `По сохранённым данным: ${MEMORY_LABELS[field].toLocaleLowerCase()} — ${memoryDisplayValue(field,facts[field])}${unit}.`;
}
const englishLabels={name:'Name',age:'Age',height_cm:'Height, cm',weight_kg:'Weight, kg',goal:'Goal',target:'Desired result',experience:'Training level',training_experience:'Training experience',setting:'Training location',equipment:'Equipment',days_per_week:'Sessions per week',minutes:'Minutes per session',restrictions:'Reported limitations',preferred_sports:'Preferred sports'};
const englishChoices={beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced',home:'At home',gym:'At a gym',outdoor:'Outdoors','Похудение':'Weight loss','Набор мышечной массы':'Muscle gain','Сила':'Strength','Выносливость':'Endurance','Подготовка к соревнованиям':'Competition preparation','Техника':'Technique','Подвижность':'Mobility','Общее здоровье':'General health'};
function englishValue(field,value){return Array.isArray(value)?value.join(', '):englishChoices[value]||String(value||(['equipment','restrictions'].includes(field)?'None':'Not provided'));}
export function memoryConfirmation(fields,data,message=''){
 const english=/^[\s\d\p{P}]*[a-z]/iu.test(message)&&!/[а-яё]/i.test(message);
 return (english?'Saved to your sports profile:\n':'Сохранено в твоём спортивном профиле:\n')+fields.map(field=>`${english?englishLabels[field]:MEMORY_LABELS[field]}: ${english?englishValue(field,data[field]):memoryDisplayValue(field,data[field])}`).join('\n');
}
