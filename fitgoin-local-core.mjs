// FitGoIn local discovery: validate places before showing them. No guessed prices.
export const LOCAL_RADIUS_KM = 15;
export const LOCAL_CATEGORY_TYPES = Object.freeze({
  gyms: ['gym','fitness_center'],
  equipment: ['sporting_goods_store'],
  groceries: ['supermarket','grocery_store']
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
  if(geocode?.status!=='OK'||!Array.isArray(geocode.results))return {error:'city_not_found'};
  const allowed=new Set(['locality','postal_town','administrative_area_level_3']);
  const candidates=geocode.results.filter(x=>!x.partial_match&&x?.types?.some(t=>allowed.has(t))&&
    numeric(x?.geometry?.location?.lat)&&numeric(x?.geometry?.location?.lng)&&
    Math.abs(x.geometry.location.lat)<=90&&Math.abs(x.geometry.location.lng)<=180);
  if(!candidates.length)return {error:'city_not_found'};
  if(candidates.length>1)return {error:'ambiguous_city',choices:candidates.slice(0,4).map(x=>x.formatted_address).filter(Boolean)};
  const g=candidates[0];
  return {name:String(g.formatted_address||'').slice(0,180),lat:g.geometry.location.lat,lng:g.geometry.location.lng};
}
export function distanceKm(a,b) {
  if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(numeric)||
    Math.abs(a.lat)>90||Math.abs(b.lat)>90||Math.abs(a.lng)>180||Math.abs(b.lng)>180)return null;
  const k=Math.PI/180, dlat=(b.lat-a.lat)*k,dlng=(b.lng-a.lng)*k;
  const h=Math.sin(dlat/2)**2+Math.cos(a.lat*k)*Math.cos(b.lat*k)*Math.sin(dlng/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
function safeMapsUrl(s) {
  try {
    const u=new URL(s);
    return u.protocol==='https:'&&(u.hostname==='google.com'||u.hostname.endsWith('.google.com'))&&u.pathname.startsWith('/maps/')?u.href:null;
  } catch { return null; }
}
export function normalizePlaces(places,center,{category,max=20}={}) {
  if(!LOCAL_CATEGORIES.includes(category)||!Array.isArray(places))return [];
  const seen=new Set(),out=[];
  for(const item of places){
    const id=typeof item?.id==='string'&&/^[A-Za-z0-9_-]{5,250}$/.test(item.id)?item.id:null;
    const name=String(item?.displayName?.text||'').trim().slice(0,180);
    const loc={lat:item?.location?.latitude,lng:item?.location?.longitude};
    const km=distanceKm(center,loc);
    if(!id||!name||km===null||km>LOCAL_RADIUS_KM||seen.has(id)||item.businessStatus==='CLOSED_PERMANENTLY')continue;
    seen.add(id);
    out.push({
      place_id:id, category, name, address:String(item.formattedAddress||'').slice(0,240),
      distance_km:Math.round(km*10)/10, maps_url:safeMapsUrl(item.googleMapsUri),
      // Google Places does not provide a reliable gym membership or SKU price list.
      price:null, price_status:'not_verified'
    });
  }
  return out.sort((a,b)=>a.distance_km-b.distance_km).slice(0,max);
}
