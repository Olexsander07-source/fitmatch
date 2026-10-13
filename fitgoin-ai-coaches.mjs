import {coachCardResults} from './fitgoin-coach-card-core.mjs';
// Controlled natural-language adapter; coach facts and MATCH come only from search_coaches.
import {matchSportKey,matchNorm,trustedRating} from './fitgoin-match-core.mjs';
const SPORTS={fitness:'Фитнес',bodybuilding:'Бодибилдинг',crossfit:'Кроссфит',running:'Бег',yoga:'Йога',swimming:'Плавание',cycling:'Велоспорт',tennis:'Теннис',combat:'Единоборства',football:'Футбол'};
const PATTERNS={fitness:/фитнес|fitness/iu,bodybuilding:/бодибилдинг|bodybuilding/iu,crossfit:/кроссфит|crossfit/iu,running:/\b(?:run|running)\b|(?:по |для )бег[ау]?|(?:^|\s)бег(?:$|\s|[.!?])/iu,yoga:/йог[аеиу]|yoga/iu,swimming:/плавани|swimming/iu,cycling:/велоспорт|велосипед|cycling/iu,tennis:/теннис|tennis/iu,combat:/единоборств|бокс|boxing|mma|мма/iu,football:/футбол|football/iu};
const PREFIX='Подбор тренера: ',MEMORY_OFF=' Поиск без использования памяти.';
const QUESTIONS={choice:'нужен живой тренер или программа AI?',sport:'какой вид спорта нужен?',period:'50 € и другие суммы могут означать разную стоимость. Бюджет за занятие, месяц или программу?',city:'в каком городе нужны очные занятия? Точный адрес не нужен.',currency:'укажите бюджет в евро и единицу оплаты: занятие, месяц или программа.',constraints:'не могу однозначно разобрать условия. Повторите запрос «Найди тренера…» с одним видом спорта, языком и форматом, сохранив обязательные ограничения.'};
const question=key=>({answer:PREFIX+QUESTIONS[key],status:'needs_clarification',question:key});
export function explicitCoachRequest(text) {
  if(/^(?:как|почему|что|чем|how|why|what)(?:\s|[?!.,]|$)/iu.test(text.trim()))return false;
  return /тренер|тренувальник|coach|trainer/iu.test(text)&&/най[дт]|ищ[уеи]|нуж[ен]|хочу|хотел|подбер|подобра|find|need|want|looking|шука|знай/iu.test(text);
}
const bareGoal=text=>/^(?:я\s+)?(?:хочу|хотел(?:а)? бы|want to)\s+(?:набрать\s+мышечн\S*\s+масс\S*|нарастить\s+мышц\S*|gain muscle)[.!\s]*$/iu.test(text.trim());
export const coachCandidate=text=>explicitCoachRequest(text)||bareGoal(text);
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
  if(online&&offline)issue='constraints';else if(online){p.format='Онлайн';delete p.city;delete p.country;}else if(offline)p.format='Офлайн';
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
  if(/(?:не|только не|кроме)\s+(?:онлайн|офлайн|русск|англ|бокс|фитнес|йог)|от\s*\d+\s*(?:€|евро)|(?:до|бюджет)\s*\d+.*(?:до|бюджет)\s*\d+/iu.test(n))issue='constraints';
  return {p,issue};
}
// History is already owner/RLS checked by the caller. Only user-role text supplies filters.
// A pending question exists only when the latest assistant message is our exact question.
export function coachTurn({message,history=[],data={},useMemory=true,programPending=false}={}) {
  const rows=history.slice(-40),last=rows.at(-1),replyKey=last?.role==='assistant'?questionKey(last.body):null;
  const explicit=explicitCoachRequest(message),goal=bareGoal(message)&&!programPending;
  let allowMemory=useMemory&&!deniedMemory(message)&&!(replyKey&&last.body.endsWith(MEMORY_OFF));
  const ask=key=>{const turn=question(key);if(!allowMemory)turn.answer+=MEMORY_OFF;return turn;};
  if(cancelled(message))return explicit||replyKey?{answer:PREFIX+'поиск отменён.',status:'cancelled'}:null;
  if(!explicit&&!goal&&!replyKey)return null;
  // A normal sports question after an intake prompt must use the existing AI route.
  if(!explicit&&!goal&&/^(?:как|почему|что|расскажи|объясни|how|why|what)(?:\s|[?!.,]|$)/iu.test(message.trim()))return null;
  if(goal&&!explicit)return ask('choice');
  if(replyKey==='choice'&&!explicit){
    if(/программ|\bai\b|\bии\b/iu.test(message))return null;
    if(!/живой|человек|тренер|coach|human/iu.test(message))return ask('choice');
  }
  let draft={},priorIssue=null;
  if(replyKey&&!explicit){
    const start=rows.findLastIndex(row=>row.role==='user'&&(explicitCoachRequest(row.body)||bareGoal(row.body)));
    if(start<0)return null;
    for(let i=start;i<rows.length;i++)if(rows[i].role==='user'){
      const key=i>0&&rows[i-1].role==='assistant'?questionKey(rows[i-1].body):null;
      const parsed=parse(rows[i].body,draft,key);draft=parsed.p;if(parsed.issue)priorIssue=parsed.issue;
      if(deniedMemory(rows[i].body))allowMemory=false;
    }
  }
  const {p,issue}=parse(message,draft,replyKey);
  if(issue)return ask(issue);
  if(priorIssue&&!explicit){
    if(priorIssue==='currency'&&!/(?:€|евро|eur)/iu.test(message))return ask('currency');
    if(priorIssue==='constraints')return ask('constraints');
  }
  const soft=[];
  if(allowMemory){
    if(!p.sport){const values=data.preferred_sports;const value=Array.isArray(values)&&values.length===1?values[0]:data.sport;const key=matchSportKey(value);if(SPORTS[key])p.sport=SPORTS[key];}
    if(!p.goal&&typeof data.goal==='string'&&data.goal.trim()){p.goal=data.goal.trim();soft.push('goal');}
    if(!p.city&&p.format==='Офлайн'&&/рядом со мной|near me/iu.test(message)&&typeof data.city==='string'&&data.city.trim())p.city=data.city.trim();
  }
  if(!p.sport)return ask('sport');
  if(p.budget!==undefined&&!p.period)return ask('period');
  if(p.format==='Офлайн'&&!p.city)return ask('city');
  if(p.format==='Онлайн'){delete p.city;delete p.country;}
  return {status:'search',parameters:{...p,soft_fields:soft,limit:3}};
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
export async function searchForCoaches({turn,url,token,publicKey,fetcher=fetch}={}) {
  if(turn.status!=='search')return {answer:turn.answer,coach_search:{schema_version:1,status:turn.status,question:turn.question||null}};
  try {
    const response=await fetcher(url+'/functions/v1/search_coaches',{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(turn.parameters),signal:AbortSignal.timeout(25000)});
    const payload=await response.json();
    if(!response.ok)return {answer:'Поиск тренеров сейчас не удалось выполнить. Условия не изменены; попробуйте ещё раз.',coach_search:{schema_version:1,status:'unavailable'}};
    const result=coachAnswer(payload),coaches=coachCardResults(payload);return {answer:result.answer,coach_search:{schema_version:1,status:result.status,ids:result.ids,coaches}};
  }catch{return {answer:'Поиск тренеров сейчас недоступен. Попробуйте ещё раз позже.',coach_search:{schema_version:1,status:'unavailable'}};}
}
