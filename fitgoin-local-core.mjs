// FitGoIn local discovery: validate places before showing them. No guessed prices.
export const LOCAL_RADIUS_KM = 15;
export const LOCAL_CATEGORY_TYPES = Object.freeze({
  gyms: ['sport.fitness.gym','sport.fitness.fitness_centre'],
  equipment: ['commercial.outdoor_and_sport'],
  groceries: ['commercial.supermarket','commercial.convenience']
});
export const LOCAL_CATEGORIES = Object.freeze(Object.keys(LOCAL_CATEGORY_TYPES));
const numeric=x=>typeof x==='number'&&Number.isFinite(x);

export function validCity(value) {
  if(typeof value!=='string')return null;
  const s=value.trim().replace(/\s+/g,' ');
  if(s.length<2||s.length>100||!(/^[\p{L}\p{M}][\p{L}\p{M}\s,.'’\-]*$/u.test(s)))return null;
  if(/(^|[,\s])(?:rue|street|avenue|road|boulevard|apt|appartement)([,\s]|$)/i.test(s))return null;
  return s;
}
export function cityCenter(geocode) {
  if(!Array.isArray(geocode?.results))return {error:'city_not_found'};
  const seen=new Set();
  const candidates=geocode.results.filter(x=>{
    const confidence=x?.rank?.confidence_city_level ?? x?.rank?.confidence;
    if(x?.result_type!=='city'||!numeric(x.lat)||!numeric(x.lon)||
      Math.abs(x.lat)>90||Math.abs(x.lon)>180||
      (numeric(confidence)&&confidence<0.8)||!x.formatted)return false;
    const key=[x.formatted.toLowerCase(),x.lat,x.lon].join('|');
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
  if(!candidates.length)return {error:'city_not_found'};
  if(candidates.length>1)return {error:'ambiguous_city',choices:candidates.slice(0,4).map(x=>String(x.formatted).slice(0,180))};
  const g=candidates[0];
  return {name:String(g.formatted).slice(0,180),lat:g.lat,lng:g.lon};
}
export function distanceKm(a,b) {
  if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(numeric)||
    Math.abs(a.lat)>90||Math.abs(b.lat)>90||Math.abs(a.lng)>180||Math.abs(b.lng)>180)return null;
  const k=Math.PI/180, dlat=(b.lat-a.lat)*k,dlng=(b.lng-a.lng)*k;
  const h=Math.sin(dlat/2)**2+Math.cos(a.lat*k)*Math.cos(b.lat*k)*Math.sin(dlng/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function normalizePlaces(features,center,{category,max=20}={}) {
  if(!LOCAL_CATEGORIES.includes(category)||!Array.isArray(features))return [];
  const seen=new Set(),out=[];
  for(const feature of features){
    const p=feature?.properties||{},coordinates=feature?.geometry?.coordinates;
    const id=typeof p.place_id==='string'&&/^[A-Za-z0-9_-]{5,250}$/.test(p.place_id)?p.place_id:null;
    const name=String(p.name||'').trim().slice(0,180);
    const loc={lat:p.lat??coordinates?.[1],lng:p.lon??coordinates?.[0]};
    const km=distanceKm(center,loc),raw=p?.datasource?.raw||{};
    if(!id||!name||km===null||km>LOCAL_RADIUS_KM||seen.has(id)||
       raw.disused||raw.abandoned||raw.shop==='vacant')continue;
    seen.add(id);
    const maps='https://www.openstreetmap.org/?mlat='+encodeURIComponent(loc.lat)+'&mlon='+encodeURIComponent(loc.lng)+
      '#map=17/'+encodeURIComponent(loc.lat)+'/'+encodeURIComponent(loc.lng);
    out.push({
      place_id:id,category,name,address:String(p.formatted||[p.address_line1,p.address_line2].filter(Boolean).join(', ')).slice(0,240),
      distance_km:Math.round(km*10)/10,maps_url:maps,price:null,price_status:'not_verified'
    });
  }
  return out.sort((a,b)=>a.distance_km-b.distance_km).slice(0,max);
}
