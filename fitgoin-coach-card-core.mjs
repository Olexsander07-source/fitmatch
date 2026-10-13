// Public, bounded snapshots made only by the controlled coach-search branch.
import {MATCH_VERSION,matchPercent,trustedRating} from './fitgoin-match-core.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(value,max=300)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
export function coachCardSnapshot(c) {
  const m=c?.match;
  if(!UUID.test(c?.id||'')||!text(c.name,150)||!m||!Number.isInteger(m.percent)||m.percent<0||m.percent>100||m.version!==MATCH_VERSION||!Array.isArray(m.reasons)||m.reasons.length>7)throw Error('invalid_coach_card');
  if(m.earned!==undefined&&m.total!==undefined&&matchPercent(m.earned,m.total)!==m.percent)throw Error('invalid_coach_card');
  const knownPrice=c.price_known===true&&typeof c.price==='number'&&Number.isFinite(c.price)&&c.price>=0&&c.currency==='EUR'&&['занятие','месяц','программа'].includes(c.period);
  const path=text(c.avatar_path,250);
  const avatar=path.startsWith(c.id+'/')&&/^[a-z0-9/-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)&&!path.includes('..')?path:null;
  const rating=trustedRating(c);
  return {id:c.id,name:text(c.name,150),sport:text(c.sport,150),sport_name:text(c.sport_name,150),specialization:text(c.specialization??c.goal),format:['Онлайн','Офлайн','Онлайн и офлайн'].includes(c.format)?c.format:null,
    price:knownPrice?c.price:null,price_known:knownPrice,period:knownPrice?c.period:null,currency:'EUR',avatar_path:avatar,
    experience_years:Number.isInteger(c.experience_years)&&c.experience_years>=0&&c.experience_years<=80?c.experience_years:null,
    rating:rating||null,reviews_count:rating?Number(c.reviews_count):0,
    match:{percent:m.percent,reasons:m.reasons.map(r=>text(r,250)),version:m.version}};
}
export function coachCardResults(payload) {
  if(!payload||!Array.isArray(payload.coaches)||payload.coaches.length>3)throw Error('invalid_coach_cards');
  const cards=payload.coaches.map(coachCardSnapshot);if(new Set(cards.map(c=>c.id)).size!==cards.length)throw Error('invalid_coach_cards');return cards;
}
export function readCoachCards(metadata,actor='') {
  if(metadata?.schema_version!==1||metadata.status!=='results'||!Array.isArray(metadata.coaches)||metadata.coaches.length<1||metadata.coaches.length>3)return [];
  try{return coachCardResults({coaches:metadata.coaches}).filter(c=>c.id!==actor);}catch{return [];}
}
