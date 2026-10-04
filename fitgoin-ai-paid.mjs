// Public product descriptions and deterministic validation; no credentials.
import {AIError} from './fitgoin-ai-core.mjs';

export const PLANS = {
  training:{name:'AI-тренировки',amount:2000,modules:['training']},
  nutrition:{name:'AI-питание',amount:1000,modules:['nutrition']},
  bundle:{name:'FitGoIn AI · полный пакет',amount:3000,modules:['training','nutrition']}
};
export const MEDIA_CONSENT='2026-10-04-media';
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const str={type:'string'},num={type:'number'},list={type:'array',items:str};
export const FOOD_SCHEMA=obj({title:str,uncertainty:str,items:{type:'array',items:obj({name:str,portion:str,calories_low:num,calories_high:num,protein_g:num,fat_g:num,carbs_g:num})},questions:list,warnings:list});
export const TECHNIQUE_SCHEMA=obj({title:str,observations:list,suggestions:list,limitations:list,needs_trainer:{type:'boolean'}});
export function actionModule(action,requested) {
  if(['nutrition','food_photo'].includes(action))return 'nutrition';
  if(['training','technique'].includes(action))return 'training';
  return requested==='nutrition'?'nutrition':'training';
}
export function hasAccess(access,module) {return Boolean(access?.modules?.includes(module));}
export function validateImages(images,action,consent) {
  if(consent!==MEDIA_CONSENT||!Array.isArray(images)||images.length<1||images.length>(action==='food_photo'?1:6))throw new AIError('media_consent_required',422);
  let total=0;
  return images.map(image=>{
    if(image?.mime!=='image/jpeg'||typeof image.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)||image.base64.length%4)throw new AIError('invalid_image',422);
    total+=image.base64.length;if(total>2400000)throw new AIError('request_too_large',413);
    let bytes;try{bytes=Uint8Array.from(atob(image.base64),x=>x.charCodeAt(0));}catch{throw new AIError('invalid_image',422);}
    if(bytes.length<100||bytes.length>700000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new AIError('invalid_image',422);
    return {type:'input_image',image_url:'data:image/jpeg;base64,'+image.base64,detail:'low'};
  });
}
const validText=(s,n=1200)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const validList=s=>Array.isArray(s)&&s.length<=12&&s.every(x=>validText(x));
function matches(value,schema){
  if(schema.type==='object')return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===schema.required.length&&schema.required.every(k=>Object.hasOwn(value,k)&&matches(value[k],schema.properties[k]));
  if(schema.type==='array')return Array.isArray(value)&&value.length<=12&&value.every(v=>matches(v,schema.items));
  if(schema.type==='number')return Number.isFinite(value);
  return typeof value===schema.type;
}
export function validateMedia(action,d) {
  if(!matches(d,action==='food_photo'?FOOD_SCHEMA:TECHNIQUE_SCHEMA)||!validText(d.title,120)||JSON.stringify(d).length>15000)throw new AIError('invalid_analysis',502);
  if(action==='food_photo') {
    if(!validText(d.uncertainty)||!validList(d.questions)||!validList(d.warnings)||!Array.isArray(d.items)||d.items.length>12)throw new AIError('invalid_analysis',502);
    for(const item of d.items){
      if(!validText(item.name,120)||!validText(item.portion,200))throw new AIError('invalid_analysis',502);
      for(const key of ['calories_low','calories_high','protein_g','fat_g','carbs_g'])if(!Number.isFinite(item[key])||item[key]<0||item[key]>5000)throw new AIError('invalid_analysis',502);
      if(item.calories_high<item.calories_low||item.calories_high>3000||['protein_g','fat_g','carbs_g'].some(k=>item[k]>300))throw new AIError('invalid_analysis',502);
      const kcal=item.protein_g*4+item.fat_g*9+item.carbs_g*4;
      if(kcal<item.calories_low*.6||kcal>item.calories_high*1.5+50)throw new AIError('invalid_analysis',502);
    }
    const total=Object.fromEntries(['calories_low','calories_high','protein_g','fat_g','carbs_g'].map(k=>[k,Math.round(d.items.reduce((s,x)=>s+x[k],0))]));
    if(total.calories_high>5000)throw new AIError('invalid_analysis',502);
    return {...d,total};
  }
  if(!validList(d.observations)||!validList(d.suggestions)||!validList(d.limitations)||!d.limitations.length||typeof d.needs_trainer!=='boolean')throw new AIError('invalid_analysis',502);
  return d;
}
export function analysisText(action,d) {
  if(action==='food_photo')return [d.title,...d.items.map(x=>`${x.name} (${x.portion}): ≈ ${Math.round(x.calories_low)}–${Math.round(x.calories_high)} kcal`),`≈ ${d.total.calories_low}–${d.total.calories_high} kcal · P ${d.total.protein_g} / F ${d.total.fat_g} / C ${d.total.carbs_g} g`,d.uncertainty,...d.questions,...d.warnings].join('\n');
  return [d.title,...d.observations,...d.suggestions,...d.limitations].join('\n');
}
export function normalizeFood(v={}) {
  const finite=(x,max)=>x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=max?Number(x):null;
  const row={name:String(v.name||'').trim().slice(0,160),calories_low:finite(v.calories_low,5000),calories_high:finite(v.calories_high,5000),protein_g:finite(v.protein_g,600),fat_g:finite(v.fat_g,600),carbs_g:finite(v.carbs_g,600)};
  if(!row.name||Object.values(row).some(x=>x===null)||row.calories_high<row.calories_low)throw new AIError('invalid_food');return row;
}
function calendarText(s){return String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,x=>'\\'+x);}
export function trainingCalendar(profile,hour='18:00',now=new Date()) {
  if(!/^\d{2}:\d{2}$/.test(hour)||Number(hour.slice(0,2))>23||Number(hour.slice(3))>59)throw new AIError('invalid_time');
  const days=[...new Set((profile.weekdays||[]).filter(x=>Number.isInteger(x)&&x>=0&&x<=6))];if(!days.length)throw new AIError('profile_incomplete');
  const date=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(days.includes(date.getDay())&&Number(hour.replace(':',''))<=now.getHours()*100+now.getMinutes())date.setDate(date.getDate()+1);
  while(!days.includes(date.getDay()))date.setDate(date.getDate()+1);
  const stamp=`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}T${hour.replace(':','')}00`;
  const weekday=['SU','MO','TU','WE','TH','FR','SA'];
  // Floating local time: the calendar uses the user's local timezone and DST.
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FitGoIn//Training//RU','BEGIN:VEVENT','UID:'+crypto.randomUUID()+'@fitgoin.com','DTSTAMP:'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART:'+stamp,`DURATION:PT${Math.max(10,Math.min(90,Number(profile.minutes)||30))}M`,'RRULE:FREQ=WEEKLY;BYDAY='+days.map(x=>weekday[x]).join(','),'SUMMARY:'+calendarText('FitGoIn · тренировка'),'DESCRIPTION:'+calendarText('Открой FitGoIn: https://fitgoin.com/#ai. Учти самочувствие перед тренировкой.'),'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:FitGoIn training','END:VALARM','END:VEVENT','END:VCALENDAR'];
  return lines.join('\r\n')+'\r\n';
}
