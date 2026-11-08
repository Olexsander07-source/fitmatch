import {LOCAL_RADIUS_KM,LOCAL_CATEGORY_TYPES,LOCAL_CATEGORIES,validCity,cityCenter,normalizePlaces} from '../../../fitgoin-local-core.mjs';

const response=(payload,status=200,headers={})=>new Response(JSON.stringify(payload),{status,headers:{...headers,
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function firstKey(text){
  try {const json=JSON.parse(text||'{}');return json.default||Object.values(json)[0]||'';}catch{return '';}
}
async function resultJSON(fetcher,url,init) {
  let r;
  try {r=await fetcher(url,{...init,signal:AbortSignal.timeout(12000)});}
  catch {throw {code:'service_unavailable',status:503};}
  if(!r.ok)throw {code:url.endsWith('/auth/v1/user')?'authentication_required':'service_unavailable',status:url.endsWith('/auth/v1/user')?401:503};
  try {return await r.json();}catch{throw {code:'service_unavailable',status:503};}
}
export function createLocalHandler({env=(name)=>Deno.env.get(name),fetcher=fetch}={}) {
  const get=name=>typeof env==='function'?env(name):env?.[name];
  const supabaseURL=String(get('SUPABASE_URL')||'').replace(/\/$/,'');
  const publicKey=get('SUPABASE_ANON_KEY')||firstKey(get('SUPABASE_PUBLISHABLE_KEYS'));
  const secret=get('SUPABASE_SERVICE_ROLE_KEY')||firstKey(get('SUPABASE_SECRET_KEYS'));
  const mapsKey=get('GOOGLE_MAPS_SERVER_API_KEY');
  const enabled=get('FGI_LOCAL_GEO_ENABLED')==='true';
  const allowed=String(get('AI_ALLOWED_ORIGINS')||'https://fitgoin.com,https://www.fitgoin.com').split(',').map(x=>x.trim());
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
      'Access-Control-Allow-Methods':'OPTIONS,GET,POST'};
    if(origin&&!allowed.includes(origin))return response({error:'origin_not_allowed'},403,headers);
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method==='GET')return response({configured:Boolean(enabled&&mapsKey&&supabaseURL&&publicKey&&secret),
      enabled, radius_km:LOCAL_RADIUS_KM, categories:LOCAL_CATEGORIES,
      prices_connected:false, source:'Google Maps Platform'},200,headers);
    if(request.method!=='POST')return response({error:'method_not_allowed'},405,headers);
    const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if(!token||!supabaseURL||!publicKey||!secret)return response({error:'authentication_required'},401,headers);
    if(Number(request.headers.get('content-length'))>1800)return response({error:'invalid_request'},413,headers);
    let body;
    try{const raw=await request.text();if(raw.length>1800)throw Error('too_long');body=JSON.parse(raw);}
    catch{return response({error:'invalid_request'},400,headers);}
    const city=validCity(body?.city);
    const category=body?.category;
    const lang=['fr','en','ru'].includes(body?.language)?body.language:'fr';
    if(body?.consent!==true)return response({error:'location_consent_required'},422,headers);
    if(!city||!LOCAL_CATEGORIES.includes(category))return response({error:'invalid_location'},422,headers);
    try {
      const auth=await resultJSON(fetcher,supabaseURL+'/auth/v1/user',{
        headers:{apikey:publicKey,Authorization:'Bearer '+token}});
      if(!auth?.id||!/^[a-f0-9-]{36}$/i.test(auth.id))return response({error:'authentication_required'},401,headers);
      // Even authenticated users cannot trigger paid provider calls until enabled.
      if(!enabled||!mapsKey)return response({error:'geo_not_configured'},503,headers);
      const entitlement=await resultJSON(fetcher,supabaseURL+'/rest/v1/rpc/fgi_ai_access',{
        method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},
        body:JSON.stringify({p_user:auth.id,p_live:get('AI_BILLING_MODE')!=='test'})});
      if(!Array.isArray(entitlement?.modules)||!entitlement.modules.length)return response({error:'subscription_required'},402,headers);
      const approved=await resultJSON(fetcher,supabaseURL+'/rest/v1/rpc/fgi_local_claim',{
        method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},
        body:JSON.stringify({p_user:auth.id})});
      if(approved!==true)return response({error:'geo_rate_limited'},429,headers);
      const query=new URL('https://maps.googleapis.com/maps/api/geocode/json');
      query.searchParams.set('address',city);
      query.searchParams.set('language',lang);
      query.searchParams.set('key',mapsKey);
      const geocoded=await resultJSON(fetcher,query.toString(),{headers:{Accept:'application/json'}});
      const center=cityCenter(geocoded);
      if(center.error)return response({error:center.error,...(center.choices?{choices:center.choices}:{})},422,headers);
      const found=await resultJSON(fetcher,'https://places.googleapis.com/v1/places:searchNearby',{
        method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':mapsKey,
          'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.businessStatus'},
        body:JSON.stringify({includedTypes:LOCAL_CATEGORY_TYPES[category],maxResultCount:20,
          rankPreference:'DISTANCE',languageCode:lang,
          locationRestriction:{circle:{center:{latitude:center.lat,longitude:center.lng},radius:LOCAL_RADIUS_KM*1000}}})});
      if(!Array.isArray(found?.places))throw {code:'service_unavailable',status:503};
      return response({city:center.name,center:{latitude:center.lat,longitude:center.lng},
        radius_km:LOCAL_RADIUS_KM, distance_method:'straight_line',category,
        results:normalizePlaces(found.places,center,{category}),source:'Google Maps Platform',
        checked_at:new Date().toISOString(),price_status:'not_verified'},200,headers);
    } catch(error){
      const code=['authentication_required','service_unavailable','geo_rate_limited'].includes(error?.code)?error.code:'service_unavailable';
      // Never echo provider URLs, city, user info, API keys or request bodies.
      return response({error:code},error?.status||503,headers);
    }
  };
}
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')Deno.serve(createLocalHandler());
