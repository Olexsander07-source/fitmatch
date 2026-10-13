import {coachCardResults,readCoachCards} from './fitgoin-coach-card-core.mjs';
// Controlled natural-language adapter; coach facts and MATCH come only from search_coaches.
import {matchSportKey,matchNorm,trustedRating} from './fitgoin-match-core.mjs';
const SPORTS={fitness:'Фитнес',bodybuilding:'Бодибилдинг',crossfit:'Кроссфит',running:'Бег',yoga:'Йога',swimming:'Плавание',cycling:'Велоспорт',tennis:'Теннис',combat:'Единоборства',football:'Футбол'};
const PATTERNS={fitness:/фитнес|fitness/iu,bodybuilding:/бодибилдинг|bodybuilding/iu,crossfit:/кроссфит|crossfit/iu,running:/\b(?:run|running)\b|(?:по |для )бег[ау]?|(?:^|\s)бег(?:$|\s|[.!?])/iu,yoga:/йог[аеиу]|yoga/iu,swimming:/плавани|swimming/iu,cycling:/велоспорт|велосипед|cycling/iu,tennis:/теннис|tennis/iu,combat:/единоборств|бокс|boxing|mma|мма/iu,football:/футбол|football/iu};
const PREFIX='Подбор тренера: ',MEMORY_OFF=' Поиск без использования памяти.';
const QUESTIONS={choice:'нужен живой тренер или программа AI?',sport:'какой вид спорта нужен?',period:'50 € и другие суммы могут означать разную стоимость. Бюджет за занятие, месяц или программу?',city:'в каком городе нужны очные занятия? Точный адрес не нужен.',currency:'укажите бюджет в евро и единицу оплаты: занятие, месяц или программа.',cheaper:'у найденных тренеров нет сопоставимой известной цены. Укажите новый предел в евро и, если нужно, единицу оплаты.',gender:'в профилях нет достоверного поля пола. Не могу применить это условие. Можно явно убрать ограничение по полу или начать новый поиск.',unsupported:'для этого условия нет проверенного фильтра. Уточните поддерживаемые условия или явно уберите неподдерживаемое ограничение.',constraints:'не могу однозначно разобрать условия. Повторите запрос «Найди тренера…» с одним видом спорта, языком и форматом, сохранив обязательные ограничения.'};
const question=key=>({answer:PREFIX+QUESTIONS[key],status:'needs_clarification',question:key});
export function explicitCoachRequest(text) {
  if(/^(?:как|почему|что|чем|how|why|what)(?:\s|[?!.,]|$)/iu.test(text.trim()))return false;
  return /тренер|тренувальник|coach|trainer/iu.test(text)&&/най[дт]|ищ[уеи]|нуж[ен]|хочу|хотел|подбер|подобра|find|need|want|looking|шука|знай/iu.test(text);
}
const bareGoal=text=>/^(?:я\s+)?(?:хочу|хотел(?:а)? бы|want to)\s+(?:набрать\s+мышечн\S*\s+масс\S*|нарастить\s+мышц\S*|gain muscle)[.!\s]*$/iu.test(text.trim());
const comparison=text=>/^(?:сравни(?:те)?\s+(?:первого\s+и\s+второго|этих\s+двух)(?:\s+тренеров)?|кто\s+из\s+этих\s+двух(?:\s+тренеров)?\s+лучше\s+подходит|почему\s+у\s+первого\s+match\s+выше)(?:\s+без памяти)?[?!.\s]*$/iu.test(text.trim());
export const coachCancelRequest=text=>/^(?:отмени|отменить|отмена|cancel)\s+(?:поиск(?:\s+тренер\S*)?|coach search)[.!\s]*$/iu.test(text.trim());
const refinement=text=>!/(?:как|почему|зачем|упражнени|программ|питани|белк)/iu.test(text)&&/^(?:покажи|только|до\s*\d|убери|сними|хочу\s+(?:женщину|мужчину)|онлайн|офлайн|город\s*[:—-]|без памяти|не используй память|попробуй ещ[её] раз|повтори поиск)/iu.test(text.trim());
export const coachCandidate=text=>explicitCoachRequest(text)||bareGoal(text)||comparison(text)||refinement(text)||coachCancelRequest(text);
const deniedMemory=text=>/без памяти|не (?:используй|использовать) (?:память|мои данные)|without (?:my )?memory/iu.test(text);
const cancelled=text=>/(?:^|\s)не (?:ищи|нужен)\s*(?:мне\s*)?тренер|отмен[аи].*поиск|cancel.*(?:coach|search)/iu.test(text);
function questionKey(body) {const plain=body?.endsWith(MEMORY_OFF)?body.slice(0,-MEMORY_OFF.length):body;return Object.keys(QUESTIONS).find(k=>plain===PREFIX+QUESTIONS[k]);}
function parse(text,draft={},replyKey=null) {
  const p={...draft},n=matchNorm(text);let issue=null;
  const sports=Object.entries(PATTERNS).filter(([,pattern])=>pattern.test(n)).map(([key])=>SPORTS[key]);
  if(sports.length===1){p.sport=sports[0];if(p.sport!==SPORTS.combat)delete p.specialization;}else if(sports.length>1)issue='constraints';
  if(!sports.length&&(replyKey==='sport'||/тренер\S*\s+по\s+/iu.test(n)))issue='constraints';
  if(/бокс|boxing/iu.test(n)){p.sport=SPORTS.combat;p.specialization='Бокс';}
  if(/\b(?:mma|мма)\b/iu.test(n)){p.sport=SPORTS.combat;p.specialization='ММА';}
  const online=/онлайн|online|дистанцион/iu.test(n),offline=/офлайн|offline|очн[а-я]* занят|рядом со мной|near me/iu.test(n);
  if(online&&offline)issue='constraints';else if(online)p.format='Онлайн';else if(offline)p.format='Офлайн';
  const langs=[['ru',/русскоязыч|русском|русский|russian/iu],['uk',/украиноязыч|українськ|украинском|ukrainian/iu],['en',/англоязыч|английском|english/iu],['fr',/франкоязыч|французском|french/iu],['de',/немецком|немецкоязыч|german/iu],['es',/испанском|испаноязыч|spanish/iu]].filter(([,pattern])=>pattern.test(n));
  if(langs.length===1)p.language=langs[0][0];else if(langs.length>1||!langs.length&&/языч|язык|на \S+ском/iu.test(n))issue='constraints';
  const amount=n.match(/(?:до|не (?:более|дороже)|бюджет(?:ом)?|under|up to)\s*(\d+(?:[.,]\d+)?)/iu)||n.match(/(\d+(?:[.,]\d+)?)\s*(?:€|евро|eur)/iu);
  if(amount){p.budget=Number(amount[1].replace(',','.'));if(!/€|евро|eur/iu.test(n))issue='currency';}
  else if(/(?:до|бюджет|не дороже)\s*[-+]?\d/iu.test(n))issue='constraints';
  if(/\$|доллар|usd|грив|uah|рубл|rub|£|gbp/iu.test(n))issue='currency';
  if(p.budget!==undefined && (p.budget<0||p.budget>100))issue='constraints';
  if(/за (?:одно )?занятие|за тренировку|\/занятие|per session/iu.test(n)||replyKey==='period'&&/^(?:за )?(?:занятие|тренировку)[.!\s]*$/iu.test(n))p.period='занятие';
  else if(/(?:за|в) месяц|per month/iu.test(n)||replyKey==='period'&&/^(?:за )?месяц[.!\s]*$/iu.test(n))p.period='месяц';
  else if(/за программу|per program/iu.test(n)||replyKey==='period'&&/^(?:за )?программу?[.!\s]*$/iu.test(n))p.period='программа';
  else if(/за час|в час|per hour|\/час/iu.test(n))issue='currency';
  const location=text.match(/(?:город\s*[:—-]?|(?:офлайн|очн\S*)\s+в)\s+([\p{L}][\p{L} .'-]{1,80})(?=$|[,;!])/iu);
  if(location)p.city=location[1].trim();
  else if(replyKey==='city'&&/^[\p{L}][\p{L} .'-]{1,80}$/u.test(text.trim())&&!/тренер|спасибо|почему|что|как|программ|онлайн/iu.test(text))p.city=text.trim();
  if(/набрать мышечн\S* масс|набор мышечн\S* масс|gain muscle/iu.test(n))p.goal='Набор мышечной массы';
  if(/похудени|снизить вес|weight loss/iu.test(n))p.goal='Похудение';
  const experience=n.match(/(?:опыт(?:ом)?|стаж(?:ем)?)\s*(?:от|не менее)?\s*(\d+)\s*(?:лет|год)/iu);
  if(experience){p.min_experience_years=Number(experience[1]);if(p.min_experience_years>80)issue='constraints';}
  if(/женщин|мужчин|женск\S* тренер|мужск\S* тренер|female|male trainer/iu.test(n))issue='gender';
  if(/сертифиц|диплом|начинающ|новичк|профессиональн\S* уров|рейтинг.*(?:выше|от|не менее)|только.*доступн/iu.test(n))issue='unsupported';
  if(/(?:не|только не|кроме)\s+(?:онлайн|офлайн|русск|англ|бокс|фитнес|йог)|от\s*\d+\s*(?:€|евро)|(?:до|бюджет)\s*\d+.*(?:до|бюджет)\s*\d+/iu.test(n))issue='constraints';
  return {p,issue};
}
// Transient state uses the existing owner-scoped conversation messages, never profile memory.
// Only assistant metadata written by fgi_ai_complete is accepted. User text cannot supply snapshots.
const PARAM_KEYS=['sport','specialization','goal','format','budget','period','language','city','country','availability','min_experience_years'];
function parameters(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const p={};
  for(const k of PARAM_KEYS)if(Object.hasOwn(value,k)){
    const v=value[k];
    if(k==='budget'){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)return null;}
    else if(k==='min_experience_years'){if(!Number.isInteger(v)||v<0||v>80)return null;}
    else if(typeof v!=='string'||!v.trim()||v.length>(['goal','specialization'].includes(k)?300:150)||/[\u0000-\u001f\u007f]/.test(v))return null;
    p[k]=v;
  }
  if(p.format&&!['Онлайн','Офлайн'].includes(p.format)||p.period&&!['занятие','месяц','программа'].includes(p.period)||p.language&&!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(p.language)||p.availability&&!['morning','day','evening','weekend'].includes(p.availability))return null;
  p.soft_fields=Array.isArray(value.soft_fields)?value.soft_fields.filter(k=>['goal','specialization','availability'].includes(k)):[];
  return {...p,limit:3};
}
function searchState(rows) {
  let latest=null,result=null;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i],m=row.role==='assistant'?row.coach_search:null;
    if(m?.schema_version!==1)continue;
    if(m.status==='cancelled')break;
    if(!latest){const p=parameters(m.parameters);if(p)latest={parameters:p,useMemory:m.use_memory!==false,memoryFields:Array.isArray(m.memory_fields)?m.memory_fields.filter(k=>['sport','goal','city'].includes(k)):[],pending:m.pending||null};}
    if(!result&&['results','no_results'].includes(m.status)){
      const p=parameters(m.parameters);
      if(p)result={...m,parameters:p,coaches:m.status==='results'?readCoachCards(m):[]};
    }
    if((latest&&result)||m.reset_context===true)break;
  }
  return {latest,result};
}
export function coachTurn({message,history=[],data={},useMemory=true,programPending=false}={}) {
  const rows=history.slice(-40),last=rows.at(-1),replyKey=last?.role==='assistant'?questionKey(last.body):null;
  const state=searchState(rows),goal=bareGoal(message)&&!programPending;
  const refine=refinement(message),compare=comparison(message);
  const reset=/новый поиск|поиск заново|начни заново/iu.test(message);
  const explicit=explicitCoachRequest(message)||reset;
  let allowMemory=useMemory&&!deniedMemory(message)&&!(replyKey&&last.body.endsWith(MEMORY_OFF));
  if(state.latest&&!reset)allowMemory=allowMemory&&state.latest.useMemory;
  let draft=state.latest&&!reset?{...state.latest.parameters}:{};
  let pending=state.latest&&!reset?state.latest.pending:null;
  let memoryFields=state.latest&&!reset?[...state.latest.memoryFields]:[];
  let soft=[...(draft.soft_fields||[])];delete draft.soft_fields;delete draft.limit;
  // Apply a current refusal before every branch, including comparison and clarification.
  if(!allowMemory){for(const k of new Set([...soft,...memoryFields]))delete draft[k];soft=[];memoryFields=[];}
  const finish=(turn,p=draft)=>({...turn,parameters:{...p,soft_fields:soft,limit:3},useMemory:allowMemory,memoryFields,resetContext:reset||!state.latest,pending:turn.status==='needs_clarification'?turn.question:null});
  const ask=key=>{const turn=question(key);if(!allowMemory)turn.answer+=MEMORY_OFF;return finish(turn);};
  if(cancelled(message))return explicit||replyKey||state.latest?finish({answer:PREFIX+'поиск отменён.',status:'cancelled'}):null;
  if(compare){
    if(!state.result)return finish({answer:'В этом разговоре нет сохранённых результатов с условиями поиска. Сначала найдите тренеров; сравню только найденные профили.',status:'needs_clarification'});
    if(pending&&Object.hasOwn(QUESTIONS,pending))return ask(pending);
    if(state.result.coaches.length<2)return finish({answer:'В последнем поиске найдено меньше двух тренеров. Для сравнения нужны два реальных результата; можно изменить условия поиска.',status:'needs_clarification'});
    if(!draft.sport)return ask('sport');
    return finish({status:'compare',ids:state.result.coaches.slice(0,2).map(c=>c.id)});
  }
  if(!explicit&&!goal&&!replyKey&&!refine)return null;
  if(!explicit&&!goal&&!refine&&/^(?:как|почему|что|расскажи|объясни|how|why|what)(?:\s|[?!.,]|$)/iu.test(message.trim()))return null;
  if(refine&&!explicit&&!state.latest&&!replyKey)return {answer:'Нет условий предыдущего поиска в этом разговоре. Укажите вид спорта или попросите найти тренера.',status:'needs_clarification',question:'sport'};
  if(goal&&!explicit&&!state.latest){draft=parse(message,draft).p;return ask('choice');}
  if(replyKey==='choice'&&!explicit){
    if(/программ|\bai\b|\bии\b/iu.test(message))return null;
    if(!/живой|человек|тренер|coach|human/iu.test(message))return ask('choice');
  }
  // Backward-compatible intake reconstruction for messages saved before 4F.
  if(!state.latest&&replyKey&&!explicit){
    const start=rows.findLastIndex(row=>row.role==='user'&&(explicitCoachRequest(row.body)||bareGoal(row.body)));
    if(start<0)return null;
    for(let i=start;i<rows.length;i++)if(rows[i].role==='user'){
      const key=i>0&&rows[i-1].role==='assistant'?questionKey(rows[i-1].body):null;
      const parsed=parse(rows[i].body,draft,key);draft=parsed.p;if(parsed.issue)pending=parsed.issue;
      if(deniedMemory(rows[i].body))allowMemory=false;
    }
  }
  const removePrice=/(?:убери|сними|без)\s+(?:ограничени\S*\s+по\s+цене|ограничени\S*\s+цен\S*|бюджет\S*|лимит\S*\s+(?:цены|по цене))/iu.test(message);
  const removeUnsupported=/(?:убери|сними)\s+(?:ограничени\S*\s+по\s+полу|неподдерживаем\S*\s+ограничени\S*)/iu.test(message);
  if(removeUnsupported)pending=null;
  const parsed=parse(message,draft,replyKey);draft=parsed.p;
  if(Object.values(PATTERNS).some(pattern=>pattern.test(message)))memoryFields=memoryFields.filter(k=>k!=='sport');
  if(/город\s*[:—-]|офлайн\s+в/iu.test(message)||replyKey==='city')memoryFields=memoryFields.filter(k=>k!=='city');
  if(removePrice){delete draft.budget;delete draft.period;}
  // Explicit goals must no longer be treated as soft preferences from memory.
  if(/набрать мышечн\S* масс|набор мышечн\S* масс|gain muscle|похудени|снизить вес|weight loss/iu.test(message)){soft=soft.filter(k=>k!=='goal');memoryFields=memoryFields.filter(k=>k!=='goal');}
  if(parsed.issue)return ask(parsed.issue);
  if(pending==='currency'&&!removePrice&&!/(?:€|евро|eur)/iu.test(message))return ask('currency');
  if(['gender','unsupported','constraints'].includes(pending)&&!removeUnsupported&&!reset&&!(explicit&&!state.latest))return ask(pending);
  if(pending==='cheaper'&&!removePrice&&!/(?:до|бюджет|€|евро|eur)/iu.test(message))return ask('cheaper');
  if(/дешевле|cheaper/iu.test(message)){
    const cards=state.result?.coaches||[];
    const prices=cards.filter(c=>c.price_known&&c.currency==='EUR');
    if(!cards.length||prices.length!==cards.length||new Set(prices.map(c=>c.period)).size!==1||draft.period&&draft.period!==prices[0].period)return ask('cheaper');
    const ceiling=Math.min(...prices.map(c=>c.price),draft.budget??100);
    if(ceiling<=0)return finish({answer:'Найденные тренеры имеют цену 0 €; более низкую неотрицательную цену искать невозможно. Другие условия сохранены.',status:'needs_clarification'});
    draft.budget=Number((Math.ceil(ceiling*100)/100-0.01).toFixed(2));draft.period=prices[0].period;
  }
  const knownRefinement=/онлайн|офлайн|дистанцион|франкоязыч|русскоязыч|украиноязыч|англоязыч|немецкоязыч|испаноязыч|дешевле|без памяти|не используй память|до\s*\d|€|евро|город\s*[:—-]|попробуй ещ[её] раз|повтори поиск/iu.test(message)||Object.values(PATTERNS).some(pattern=>pattern.test(message));
  if(refine&&!explicit&&!removePrice&&!removeUnsupported&&!knownRefinement)return ask('unsupported');
  if(allowMemory){
    if(!draft.sport){const values=data.preferred_sports;const value=Array.isArray(values)&&values.length===1?values[0]:data.sport;const key=matchSportKey(value);if(SPORTS[key]){draft.sport=SPORTS[key];memoryFields.push('sport');}}
    if(!draft.goal&&typeof data.goal==='string'&&data.goal.trim()){draft.goal=data.goal.trim();soft.push('goal');memoryFields.push('goal');}
    if(!draft.city&&draft.format==='Офлайн'&&/рядом со мной|near me/iu.test(message)&&typeof data.city==='string'&&data.city.trim()){draft.city=data.city.trim();memoryFields.push('city');}
  }
  if(!draft.sport)return ask('sport');
  if(draft.budget!==undefined&&!draft.period)return ask('period');
  if(draft.format==='Офлайн'&&!draft.city)return ask('city');
  // City is relevant to offline training; switching online never requires an address.
  // Preserve it for a later offline turn, but do not send it as an online restriction.
  return finish({status:'search'});
}
const safeText=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[\[\]<>`]/g,'').slice(0,300);
export function coachAnswer(payload) {
  if(!payload||!Array.isArray(payload.coaches)||payload.coaches.length>3)throw Error('invalid_coach_response');
  const ids=[];
  const items=payload.coaches.map(c=>{
    if(!/^[0-9a-f-]{36}$/i.test(c.id||'')||!c.name||!Number.isInteger(c.match?.percent)||c.match.percent<0||c.match.percent>100||!Array.isArray(c.match.reasons)||!Array.isArray(c.match.criteria))throw Error('invalid_coach_response');
    ids.push(c.id);
    const price=c.price_known===true&&typeof c.price==='number'&&Number.isFinite(c.price)&&c.price>=0&&['занятие','месяц','программа'].includes(c.period)&&c.currency==='EUR'?`${c.price} € / ${c.period}`:'цена не указана';
    const rating=trustedRating(c)?`; рейтинг ${c.rating} (${c.reviews_count} отзывов)`:'';
    const location=c.format==='Онлайн'?'':c.city?`; город: ${safeText(c.city)}`:'';
    return `${safeText(c.name)} — MATCH ${c.match.percent}%\n${safeText(c.sport_name)}; ${safeText(c.format)}; ${price}${location}${rating}.\n${c.match.reasons.map(safeText).join('; ')}.\nПрофиль: https://fitgoin.com/?trainer=${c.id}`;
  });
  return {answer:items.length?'Нашёл тренеров в FitGoIn. MATCH рассчитан по известным условиям; неизвестные данные не подтверждают совпадение.\n\n'+items.join('\n\n'):'Подходящих публичных тренеров по этим условиям в FitGoIn не найдено. Можно расширить вид спорта, формат или бюджет — только после вашего согласия изменить ограничения.',status:items.length?'results':'no_results',ids};
}
function comparisonAnswer(coaches,ids) {
  const selected=ids.map(id=>coaches.find(c=>c.id===id));
  if(selected.some(c=>!c))return 'Результаты поиска изменились: один из выбранных профилей больше не входит в актуальную подборку. Показываю текущие результаты; выберите двух тренеров заново.';
  const [a,b]=selected,m1=a.match,m2=b.match;
  if(!Array.isArray(m1.criteria)||!Array.isArray(m2.criteria)||m1.total!==m2.total)throw Error('invalid_comparison_proof');
  const name=c=>safeText(c.name);
  const lead=m1.percent===m2.percent?'По рассчитанному MATCH совместимость одинаковая.':`По рассчитанному MATCH лучше подходит ${name(m1.percent>m2.percent?a:b)}.`;
  const lines=[lead,`${name(a)}: MATCH ${m1.percent}% (${m1.earned}/${m1.total} баллов). ${name(b)}: MATCH ${m2.percent}% (${m2.earned}/${m2.total} баллов).`];
  const status={matched:'совпадает',mismatch:'не совпадает',unknown:'недостаточно данных'};
  for(const x of m1.criteria){const y=m2.criteria.find(c=>c.key===x.key);if(!y)throw Error('invalid_comparison_proof');lines.push(`${safeText(x.label)}: ${name(a)} — ${status[x.status]} (${x.earned}/${x.weight}); ${name(b)} — ${status[y.status]} (${y.earned}/${y.weight}).`);}
  const price=c=>c.price_known?`${c.price} € / ${safeText(c.period)}`:'цена не указана';
  lines.push(`Стоимость: ${name(a)} — ${price(a)}; ${name(b)} — ${price(b)}.`);
  if(a.price_known&&b.price_known&&a.period!==b.period)lines.push('Единицы оплаты различаются; цены напрямую не сравниваю.');
  for(const c of selected){
    lines.push(`${name(c)}: формат ${safeText(c.format||'не указан')}; опыт ${c.experience_years===null?'не указан':c.experience_years+' лет'}; рейтинг ${c.rating?c.rating+' ('+c.reviews_count+' отзывов)':'не подтверждён отзывами'}.`);
  }
  lines.push('Вывод относится к текущим условиям поиска и опубликованным данным. Неизвестные характеристики не подтверждают преимущество.');
  return lines.join('\n\n');
}
export async function searchForCoaches({turn,url,token,publicKey,fetcher=fetch}={}) {
  const meta={schema_version:1,parameters:turn.parameters||{},use_memory:turn.useMemory!==false,memory_fields:turn.memoryFields||[],reset_context:turn.resetContext===true,pending:turn.pending||null};
  if(!['search','compare'].includes(turn.status))return {answer:turn.answer,coach_search:{...meta,status:turn.status,question:turn.question||null}};
  try {
    const p={...turn.parameters};if(p.format==='Онлайн'){delete p.city;delete p.country;}
    const response=await fetcher(url+'/functions/v1/search_coaches',{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(p),signal:AbortSignal.timeout(25000)});
    const payload=await response.json();
    if(!response.ok)return {answer:'Поиск тренеров сейчас не удалось выполнить. Условия сохранены; попробуйте ещё раз.',coach_search:{...meta,status:'unavailable'}};
    const result=coachAnswer(payload),coaches=coachCardResults(payload);
    const answer=turn.status==='compare'&&coaches.length?comparisonAnswer(coaches,turn.ids):result.answer;
    return {answer,coach_search:{...meta,status:result.status,ids:result.ids,coaches,...(turn.status==='compare'?{presentation:'comparison'}:{})}};
  }catch{return {answer:'Поиск тренеров сейчас недоступен. Условия сохранены; попробуйте ещё раз позже.',coach_search:{...meta,status:'unavailable'}};}
}
