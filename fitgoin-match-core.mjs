// Single deterministic MATCH for ordinary search and backend candidates.
export const MATCH_VERSION='2026-10-12';
export const MATCH_WEIGHTS=Object.freeze({sport:30,goal:20,format:15,location:15,budget:10,language:5,availability:5});
export const SOFT_FIELDS=Object.freeze(['goal','specialization','availability']);
export const matchNorm=value=>String(value??'').normalize('NFC').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
const parts=value=>String(value??'').split(/[,;\n]/).map(matchNorm).filter(Boolean);
const FORMATS=['Онлайн','Офлайн','Онлайн и офлайн'],PERIODS=['занятие','месяц','программа'];
const SPORT_NAMES=[['bodybuilding','бодибилдинг'],['fitness','фитнес'],['crossfit','кроссфит'],['running','бег'],['yoga','йога'],['swimming','плавание'],['cycling','велоспорт','велосипед'],['tennis','теннис'],['combat','combat sports','единоборства','бокс','boxing','mma'],['football','футбол']];
export function matchSportKey(value,sports=[]) {
  const entry=sports.find(s=>matchNorm(s.id)===matchNorm(value) || matchNorm(s.name)===matchNorm(value));
  const name=entry?.name??value;
  const normalized=matchNorm(name);
  return SPORT_NAMES.find(group=>group.includes(normalized))?.[0]??matchNorm(entry?.id??value);
}
const knownSport=(value,sports)=>Boolean(matchNorm(value)) && (SPORT_NAMES.some(group=>group.includes(matchNorm(value))) || sports.some(s=>matchNorm(s.id)===matchNorm(value) || matchNorm(s.name)===matchNorm(value)));
export const formatFits=(c,wanted)=>!wanted || c.format===wanted || c.format==='Онлайн и офлайн';
export const hasBudget=p=>p.budget!==undefined && p.budget!==null && p.budget!=='';
const priceNumber=value=>value!==undefined && value!==null && value!=='' && Number.isFinite(Number(value)) && Number(value)>=0?Number(value):null;
const same=(a,b)=>Boolean(matchNorm(a)) && matchNorm(a)===matchNorm(b);
export function formMatchPreferences(p) {
  return {...p,city:p.format==='Онлайн'?'':p.city,country:p.format==='Онлайн'?'':p.country,budget:hasBudget(p)?Number(p.budget):'',period:hasBudget(p)?p.period:'',soft_fields:[...SOFT_FIELDS]};
}
export function strictCoachFits(c,p,{sports=[],actor=''}={}) {
  if(!c || !c.id || c.published!==true || actor && matchNorm(c.id)===matchNorm(actor))return false;
  if(p.sport && (!knownSport(c.sport,sports) || !knownSport(p.sport,sports) || matchSportKey(c.sport,sports)!==matchSportKey(p.sport,sports)))return false;
  if(p.format && (!FORMATS.includes(p.format) || !formatFits(c,p.format)))return false;
  if((p.city || p.country) && p.format!=='Онлайн' && !['Офлайн','Онлайн и офлайн'].includes(c.format))return false;
  if(p.city && !same(c.city,p.city) || p.country && !same(c.country,p.country))return false;
  const soft=p.soft_fields??[];
  if(p.goal && !soft.includes('goal') && !parts(c.goal).includes(matchNorm(p.goal)))return false;
  if(p.specialization && !soft.includes('specialization') && !parts(c.goal).includes(matchNorm(p.specialization)))return false;
  if(p.language && (!Array.isArray(c.languages) || !c.languages.some(l=>same(l,p.language))))return false;
  if(p.availability && !soft.includes('availability') && (!Array.isArray(c.availability) || !c.availability.includes(p.availability)))return false;
  if(p.period && c.period!==p.period)return false;
  if(hasBudget(p) && (priceNumber(p.budget)===null || !PERIODS.includes(p.period) || priceNumber(c.price)===null || priceNumber(c.price)>Number(p.budget)))return false;
  if(p.min_experience_years!==undefined && (!Number.isInteger(c.experience_years) || c.experience_years<p.min_experience_years))return false;
  return true;
}
export function matchPercent(earned,total) {
  return Number.isFinite(earned) && Number.isFinite(total) && total>0?Math.max(0,Math.min(100,Math.round(earned/total*100))):0;
}
export function calculateMatch(c,p,{sports=[]}={}) {
  const criteria=[];
  const add=(key,label,selected,known,ok,requested,actual)=>{
    if(!selected)return;
    const weight=MATCH_WEIGHTS[key],status=!known?'unknown':ok?'matched':'mismatch';
    criteria.push({key,label,weight,earned:status==='matched'?weight:0,status,requested,actual:known?actual:null});
  };
  const sportKnown=knownSport(c.sport,sports) && knownSport(p.sport,sports);
  const sportFits=sportKnown && matchSportKey(c.sport,sports)===matchSportKey(p.sport,sports);
  add('sport','Спорт',true,sportKnown,sportFits,p.sport||null,c.sport||null);
  // Missing/different sport is 0, never a fabricated match. Ranking excludes
  // a mismatched required sport before reaching this calculation.
  if(sportFits) {
    const goals=[p.goal,p.specialization].filter(Boolean),actualGoals=parts(c.goal);
    add('goal',p.goal&&p.specialization?'Цель / специализация':p.specialization?'Специализация':'Цель',goals.length>0,actualGoals.length>0,goals.every(g=>actualGoals.includes(matchNorm(g))),goals,actualGoals);
    add('format','Формат',Boolean(p.format),FORMATS.includes(c.format)&&FORMATS.includes(p.format),formatFits(c,p.format),p.format,c.format);
    const locationSelected=Boolean((p.city||p.country) && p.format!=='Онлайн');
    const locationKnown=(!p.city || Boolean(matchNorm(c.city))) && (!p.country || Boolean(matchNorm(c.country))) && FORMATS.includes(c.format);
    add('location','Местоположение / очные занятия',locationSelected,locationKnown,(!p.city||same(c.city,p.city)) && (!p.country||same(c.country,p.country)) && c.format!=='Онлайн',{city:p.city||null,country:p.country||null},{city:c.city||null,country:c.country||null});
    const price=priceNumber(c.price);
    add('budget','Бюджет',hasBudget(p),price!==null && PERIODS.includes(c.period) && priceNumber(p.budget)!==null && PERIODS.includes(p.period),price!==null && c.period===p.period && price<=Number(p.budget),{amount:hasBudget(p)?Number(p.budget):null,period:p.period||null},{amount:price,period:c.period||null});
    add('language','Язык',Boolean(p.language),Array.isArray(c.languages)&&c.languages.length>0,Array.isArray(c.languages)&&c.languages.some(l=>same(l,p.language)),p.language,c.languages);
    add('availability','Удобное время',Boolean(p.availability),Array.isArray(c.availability)&&c.availability.length>0,Array.isArray(c.availability)&&c.availability.includes(p.availability),p.availability,c.availability);
  }
  const earned=criteria.reduce((sum,item)=>sum+item.earned,0),total=criteria.reduce((sum,item)=>sum+item.weight,0);
  const reasons=criteria.map(item=>item.status==='matched'?`✓ ${item.label} совпадает`:item.status==='unknown'?`— ${item.label}: недостаточно данных`:`— ${item.label} не совпадает`);
  return {percent:matchPercent(earned,total),reasons,criteria,earned,total,version:MATCH_VERSION};
}
export function trustedRating(c) {
  const rating=Number(c.rating),reviews=Number(c.reviews_count);
  return Number.isInteger(reviews) && reviews>0 && Number.isFinite(rating) && rating>=1 && rating<=5?rating:0;
}
const profileScore=c=>Number.isFinite(Number(c.score)) && Number(c.score)>=0?Number(c.score):0;
export function compareMatches(a,b) {
  const value=b.match.percent-a.match.percent || trustedRating(b.coach)-trustedRating(a.coach) || profileScore(b.coach)-profileScore(a.coach);
  if(value)return value;
  const left=matchNorm(a.coach.id),right=matchNorm(b.coach.id);
  return left<right?-1:left>right?1:0;
}
export function rankCoaches(coaches,p,{sports=[],actor='',limit=3}={}) {
  return coaches.filter(c=>strictCoachFits(c,p,{sports,actor})).map(coach=>({coach,match:calculateMatch(coach,p,{sports})})).sort(compareMatches).slice(0,limit);
}

