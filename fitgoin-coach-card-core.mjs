// Public, bounded snapshots made only by the controlled coach-search branch.
import {MATCH_VERSION,MATCH_WEIGHTS,matchPercent,trustedRating} from './fitgoin-match-core.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(value,max=300)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
export function coachCardSnapshot(c) {
  const m=c?.match;
  if(!UUID.test(c?.id||'')||!text(c.name,150)||!m||!Number.isInteger(m.percent)||m.percent<0||m.percent>100||m.version!==MATCH_VERSION||!Array.isArray(m.reasons)||m.reasons.length>7)throw Error('invalid_coach_card');
  if(m.earned!==undefined&&m.total!==undefined&&matchPercent(m.earned,m.total)!==m.percent)throw Error('invalid_coach_card');
  let proof={};
  if(m.criteria!==undefined){
    if(!Array.isArray(m.criteria)||m.criteria.length<1||m.criteria.length>7||new Set(m.criteria.map(c=>c.key)).size!==m.criteria.length)throw Error('invalid_coach_card');
    const criteria=m.criteria.map(c=>{
      if(!Object.hasOwn(MATCH_WEIGHTS,c.key)||c.weight!==MATCH_WEIGHTS[c.key]||!['matched','mismatch','unknown'].includes(c.status)||c.earned!==(c.status==='matched'?c.weight:0)||!text(c.label,100))throw Error('invalid_coach_card');
      // These values are the public backend proof; bound JSON and strip every other key.
      const value=v=>{const encoded=JSON.stringify(v??null);if(encoded.length>1500)throw Error('invalid_coach_card');return JSON.parse(encoded);};
      return {key:c.key,label:text(c.label,100),weight:c.weight,earned:c.earned,status:c.status,requested:value(c.requested),actual:value(c.actual)};
    });
    const earned=criteria.reduce((s,c)=>s+c.earned,0),total=criteria.reduce((s,c)=>s+c.weight,0);
    if(earned!==m.earned||total!==m.total||matchPercent(earned,total)!==m.percent)throw Error('invalid_coach_card');
    proof={criteria,earned,total};
  }
  const knownPrice=c.price_known===true&&typeof c.price==='number'&&Number.isFinite(c.price)&&c.price>=0&&c.currency==='EUR'&&['занятие','месяц','программа'].includes(c.period);
  const path=text(c.avatar_path,250);
  const avatar=path.startsWith(c.id+'/')&&/^[a-z0-9/-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)&&!path.includes('..')?path:null;
  const rating=trustedRating(c);
  return {id:c.id,name:text(c.name,150),sport:text(c.sport,150),sport_name:text(c.sport_name,150),specialization:text(c.specialization??c.goal),format:['Онлайн','Офлайн','Онлайн и офлайн'].includes(c.format)?c.format:null,
    price:knownPrice?c.price:null,price_known:knownPrice,period:knownPrice?c.period:null,currency:'EUR',avatar_path:avatar,
    experience_years:Number.isInteger(c.experience_years)&&c.experience_years>=0&&c.experience_years<=80?c.experience_years:null,
    rating:rating||null,reviews_count:rating?Number(c.reviews_count):0,
    languages:Array.isArray(c.languages)?c.languages.filter(l=>typeof l==='string'&&/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(l)).slice(0,20):[],city:text(c.city,150)||null,country:text(c.country,150)||null,
    match:{percent:m.percent,reasons:m.reasons.map(r=>text(r,250)),version:m.version,...proof}};
}
export function coachCardResults(payload) {
  if(!payload||!Array.isArray(payload.coaches)||payload.coaches.length>3)throw Error('invalid_coach_cards');
  const cards=payload.coaches.map(coachCardSnapshot);if(new Set(cards.map(c=>c.id)).size!==cards.length)throw Error('invalid_coach_cards');return cards;
}
export function readCoachCards(metadata,actor='') {
  if(metadata?.schema_version!==1||metadata.status!=='results'||!Array.isArray(metadata.coaches)||metadata.coaches.length<1||metadata.coaches.length>3)return [];
  try{return coachCardResults({coaches:metadata.coaches}).filter(c=>c.id!==actor);}catch{return [];}
}
