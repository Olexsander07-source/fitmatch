// Deterministic local budget calculations. Only verified external quotes should enter this module.
export const LOCAL_RADIUS_KM = 15;
const finite=(v,min=0)=>typeof v==='number'&&Number.isFinite(v)&&v>=min;
export function distanceKm(a,b){
 if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;
 if(Math.abs(a.lat)>90||Math.abs(b.lat)>90||Math.abs(a.lon)>180||Math.abs(b.lon)>180)return null;
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function withinLocalRadius(origin,point,radius=LOCAL_RADIUS_KM){
 const km=distanceKm(origin,point);
 return km!==null&&finite(radius)&&radius<=50&&km<=radius;
}
// Input contract: offers = [{place, coordinates:{lat,lon}, items:[{sku, price, quantity, unit, url, checked_at}], currency}].
// Nothing with an unverified position, quote, unit, source or timestamp counts as a found offer.
export function compareLocalBasket({origin,requirements,offers,radius=LOCAL_RADIUS_KM,currency='EUR'}={}){
 if(!Array.isArray(requirements)||!Array.isArray(offers))throw new TypeError('invalid_list');
 const needs=requirements.map(r=>({sku:String(r?.sku||'').trim(),quantity:Number(r?.quantity),unit:String(r?.unit||'').trim()}));
 if(needs.some(r=>!r.sku||!r.unit||!finite(r.quantity,0.000001)))throw new TypeError('invalid_requirement');
 const rows=[];
 for(const offer of offers){
  const km=distanceKm(origin,offer?.coordinates);
  if(km===null||km>radius||offer.currency!==currency)continue;
  const picks=[];let total=0;
  for(const need of needs){
   const matches=(offer.items||[]).filter(q=>q?.sku===need.sku&&q.unit===need.unit&&finite(q.price)&&finite(q.quantity,0.000001)&&typeof q.url==='string'&&/^https:\/\//i.test(q.url)&&Number.isFinite(Date.parse(q.checked_at)));
   const cheapest=matches.map(q=>({...q,required_packs:Math.ceil(need.quantity/q.quantity),cost:Math.ceil(need.quantity/q.quantity)*q.price})).sort((a,b)=>a.cost-b.cost)[0];
   if(!cheapest){picks.push({sku:need.sku,status:'unpriced'});continue;}
   total+=cheapest.cost;
   picks.push({sku:need.sku,status:'priced',cost:Math.round(cheapest.cost*100)/100,packs:cheapest.required_packs,source:cheapest.url,checked_at:cheapest.checked_at});
  }
  const complete=picks.every(p=>p.status==='priced');
  rows.push({place:offer.place,km:Math.round(km*10)/10,currency,complete,total:complete?Math.round(total*100)/100:null,priced_subtotal:Math.round(total*100)/100,items:picks});
 }
 return rows.sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.complete?a.total-b.total:a.km-b.km));
}
export function budgetBreakdown({weeklyFood,gymMonthly=null,equipmentOnce=null,weeksPerMonth=52/12}={}){
 if(!finite(weeklyFood)||!finite(weeksPerMonth,0.001)||[gymMonthly,equipmentOnce].some(x=>x!==null&&!finite(x)))throw new TypeError('invalid_price');
 const monthlyFood=weeklyFood*weeksPerMonth;
 const fixedMonthly=gymMonthly??0;
 return {currency:'EUR',weekly_food:Math.round(weeklyFood*100)/100,monthly_food:Math.round(monthlyFood*100)/100,monthly_gym:gymMonthly,one_time_equipment:equipmentOnce,monthly_recurring:Math.round((monthlyFood+fixedMonthly)*100)/100,first_month_with_equipment:equipmentOnce===null?null:Math.round((monthlyFood+fixedMonthly+equipmentOnce)*100)/100};
}
