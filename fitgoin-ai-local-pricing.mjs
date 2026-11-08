// Compare sourced local grocery offers against an actual, structured nutrition plan.
// This module does not search stores, invent prices, or infer coordinates from a city.
// Feed only store offers with a validated location/distance and retailer product URL.
const roundMoney = n => Math.round((n + Number.EPSILON) * 100) / 100;
const okText = (s,max=160) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;

export function shoppingRequirements(document, days=7) {
  if (!Number.isInteger(days) || days < 1 || days > 31) return null;
  if (!document || !Array.isArray(document.meals)) return null;
  const quantities = new Map();
  for (const meal of document.meals) {
    if (!Array.isArray(meal.items)) return null;
    for (const item of meal.items) {
      if (!okText(item.food_id,80) || !okText(item.name,160) ||
          !Number.isFinite(item.quantity_g) || item.quantity_g <= 0 || item.quantity_g > 5000) return null;
      const old = quantities.get(item.food_id);
      quantities.set(item.food_id,{
        food_id:item.food_id,
        name:item.name,
        quantity_g:(old?.quantity_g||0) + item.quantity_g,
        weight_basis:item.weight_basis||''
      });
    }
  }
  if (!quantities.size || quantities.size > 50) return null;
  return [...quantities.values()].map(item=>({...item,quantity_g:item.quantity_g*days}));
}

export function localBasketQuote({document, city, offers=[], now=Date.now(), radius_km=15}={}) {
  if (!okText(city,100) || radius_km !== 15 || !Number.isFinite(now)) return {status:'invalid_location'};
  const daily=shoppingRequirements(document,1);
  if (!daily) return {status:'unsupported_plan',reason:'structured_food_quantities_required'};
  const current=[];
  for (const o of Array.isArray(offers)?offers:[]) {
    if (!o || !okText(o.food_id,80) || !okText(o.store,200) ||
        !Number.isFinite(o.price_eur) || o.price_eur<=0 || o.price_eur>2000 ||
        !Number.isFinite(o.pack_grams) || o.pack_grams<=0 || o.pack_grams>100000 ||
        !Number.isFinite(o.distance_km) || o.distance_km<0 || o.distance_km>radius_km ||
        !okText(o.source_url,2000) || !okText(o.checked_at,40) || o.available!==true) continue;
    let url,stamp;
    try {
      url=new URL(o.source_url);stamp=Date.parse(o.checked_at);
      if (url.protocol!=='https:' || url.username || url.password ||
          !Number.isFinite(stamp) || stamp>now+300000 || now-stamp>7*86400000)continue;
    } catch { continue; }
    current.push({...o,source_url:url.href});
  }
  const quotes=[7,30].map(days=>{
    const items=daily.map(food=>{
      const quantity_g=food.quantity_g*days;
      const candidates=current.filter(q=>q.food_id===food.food_id).map(q=>{
        const packs=Math.ceil(quantity_g/q.pack_grams);
        return {store:q.store,store_address:q.store_address||'',distance_km:q.distance_km,
          product_name:q.product_name||food.name,pack_grams:q.pack_grams,
          price_eur:q.price_eur,packs,subtotal_eur:roundMoney(packs*q.price_eur),
          source_url:q.source_url,checked_at:q.checked_at};
      }).sort((a,b)=>a.subtotal_eur-b.subtotal_eur||a.distance_km-b.distance_km);
      return {food_id:food.food_id,name:food.name,quantity_g,weight_basis:food.weight_basis,
        offer:candidates[0]||null};
    });
    const missing=items.filter(x=>!x.offer).map(x=>x.name);
    const subtotal_eur=roundMoney(items.reduce((sum,x)=>sum+(x.offer?.subtotal_eur||0),0));
    return {days,items,missing,subtotal_eur,
      // Never show a complete basket total when some products have no sourced quote.
      total_eur:missing.length?null:subtotal_eur,complete:missing.length===0};
  });
  return {status:current.length?'priced':'no_sourced_prices',city,radius_km,origin:'city_center',
    quotes,checked_at:new Date(now).toISOString(),
    note:'Store distances must be independently checked from the selected city centre. Cheapest per item may require visiting several shops; travel, delivery, loyalty discounts and substitutions are excluded. This assumes the same day of meals is repeated 7 or 30 times. Compare only matching edible/raw/dry weight bases.'};
}
