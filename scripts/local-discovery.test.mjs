import test from 'node:test';
import assert from 'node:assert/strict';
import {validCity,cityCenter,distanceKm,normalizePlaces} from '../fitgoin-local-core.mjs';
import {createLocalHandler} from '../supabase/functions/fitgoin-local-discovery/index.mjs';
import {localDiscoveryHTML,localLabel} from '../fitgoin-ai-local.mjs';

const actor='20000000-0000-4000-8000-000000000001';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'public-key',
  SUPABASE_SERVICE_ROLE_KEY:'server-key',GOOGLE_MAPS_SERVER_API_KEY:'test-key',
  FGI_LOCAL_GEO_ENABLED:'true',AI_ALLOWED_ORIGINS:'https://fitgoin.com'};
const geo={status:'OK',results:[{types:['locality','political'],formatted_address:'Toulouse, France',
  geometry:{location:{lat:43.6045,lng:1.444}}}]};
const places={places:[
 {id:'place-123456',displayName:{text:'Salle Test'},formattedAddress:'Rue Test, Toulouse',
  location:{latitude:43.605,longitude:1.445},googleMapsUri:'https://www.google.com/maps/place/Test',businessStatus:'OPERATIONAL'},
 {id:'place-123457',displayName:{text:'Outside'},formattedAddress:'far',
  location:{latitude:44.12,longitude:1.445},googleMapsUri:'https://www.google.com/maps/place/Far'},
 {id:'place-123458',displayName:{text:'Closed'},formattedAddress:'Rue',
  location:{latitude:43.606,longitude:1.446},businessStatus:'CLOSED_PERMANENTLY'},
 {id:'place-123459',displayName:{text:'Unsafe'},location:{latitude:43.607,longitude:1.447},
  googleMapsUri:'javascript:alert(1)'}
]};
const request=(body,origin='https://fitgoin.com')=>new Request('https://project.supabase.co/functions/v1/fitgoin-local-discovery',
 {method:'POST',headers:{Authorization:'Bearer user-token',Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify(body)});
const body={city:'Toulouse, France',category:'gyms',language:'fr',consent:true};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const fake=(opts={})=>{
 let calls=[];
 const fetcher=async (url,init={})=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return reply(opts.auth===false?{error:'invalid'}:{id:actor},opts.auth===false?401:200);
  if(url.endsWith('/rest/v1/rpc/fgi_local_claim'))return reply(opts.quota===false?false:true);
  if(url.startsWith('https://maps.googleapis.com/'))return reply(opts.geocode??geo);
  if(url.startsWith('https://places.googleapis.com/'))return reply(opts.places??places);
  throw Error('Unexpected outbound fetch');
 };
 return {handler:createLocalHandler({env:{...env,...opts.env},fetcher}),calls};
};
test('only city names allowed; no specific street, address or personal data',()=>{
 for(const x of ['Toulouse','Paris, France','Saint-Étienne','Lyon, France'])assert.equal(validCity(x),x);
 for(const x of ['12 rue Voltaire','test@example.com','https://example.com','',3,'a'.repeat(102)])assert.equal(validCity(x),null);
});
test('distance filtering and checked Google URLs do not invent tariffs',()=>{
 assert.equal(distanceKm({lat:43.6045,lng:1.444},{lat:43.6045,lng:1.444}),0);
 assert.equal(distanceKm({lat:43.6045,lng:1.444},{lat:44.1,lng:1.444})>15,true);
 const results=normalizePlaces(places.places,{lat:43.6045,lng:1.444},{category:'gyms'});
 assert.equal(results.length,2);assert.equal(results[0].price,null);
 assert.equal(results[0].maps_url,'https://www.google.com/maps/place/Test');
 assert.equal(results[1].maps_url,null);
});
test('ambiguous place names need clarification, not silent choice',()=>{
 const result=cityCenter({...geo,results:[...geo.results,{...geo.results[0],formatted_address:'Toulouse, Other Country'}]});
 assert.equal(result.error,'ambiguous_city');
 assert.equal(cityCenter({status:'ZERO_RESULTS',results:[]}).error,'city_not_found');
});
test('no key or explicit server switch: no paid Google requests',async()=>{
 const t=fake({env:{GOOGLE_MAPS_SERVER_API_KEY:''}});
 const response=await t.handler(request(body));
 assert.equal(response.status,503);assert.equal((await response.json()).error,'geo_not_configured');
 assert.equal(t.calls.length,1);assert(t.calls[0].url.endsWith('/auth/v1/user'));
});
test('real typed search gets bounded provider request and returns only verified locations',async()=>{
 const t=fake();const r=await t.handler(request(body));assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.radius_km,15);
 assert.equal(data.category,'gyms');assert.equal(data.results.length,2);
 assert.equal(data.results[0].name,'Salle Test');assert.equal(data.results[0].price_status,'not_verified');
 assert(!JSON.stringify(data).includes('test-key'));
 const req=t.calls.find(x=>x.url.startsWith('https://places.googleapis.com/'));
 const sent=JSON.parse(req.init.body);
 assert.deepEqual(sent.includedTypes,['gym','fitness_center']);
 assert.equal(sent.locationRestriction.circle.radius,15000);
 assert(!req.init.headers['X-Goog-FieldMask'].includes('priceRange'));
});
test('quota exhausted and denied origin never call Google',async()=>{
 const a=fake({quota:false});assert.equal((await a.handler(request(body))).status,429);
 assert.equal(a.calls.filter(x=>x.url.startsWith('https://maps.')).length,0);
 const b=fake();assert.equal((await b.handler(request(body,'https://attacker.example'))).status,403);
 assert.equal(b.calls.length,0);
});
test('consent and authenticated user are mandatory',async()=>{
 const a=fake();assert.equal((await a.handler(request({...body,consent:false}))).status,422);assert.equal(a.calls.length,0);
 const b=fake({auth:false});assert.equal((await b.handler(request(body))).status,401);
 assert.equal(b.calls.length,1);
});
test('GET readiness does not call paid APIs or expose secrets',async()=>{
 const t=fake({env:{FGI_LOCAL_GEO_ENABLED:'false'}});const r=await t.handler(new Request('https://example.com/'));
 const data=await r.json();assert.equal(data.configured,false);assert.equal(data.prices_connected,false);
 assert.equal(t.calls.length,0);
});

test('local UI remains hidden without API key and escapes server text',()=>{
 const disabled=localDiscoveryHTML({city:'Toulouse, France',language:'fr',ready:false});
 assert(!disabled.includes('data-ai-form="local"'));
 assert.equal(localLabel('ru'),'Рядом 15 км');
 const enabled=localDiscoveryHTML({city:'Toulouse, France',language:'ru',ready:true,
  result:{city:'Toulouse, France',radius_km:15,checked_at:'2026-11-08T10:00:00Z',category:'gyms',results:[
   {name:'<img src=x onerror=alert(1)>',address:'Rue',distance_km:1.2,maps_url:'https://www.google.com/maps/place/Test'}]}});
 assert(enabled.includes('data-ai-form="local"'));
 assert(enabled.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert(!enabled.includes('<img src=x'));
 assert(enabled.includes('Цена не подтверждена'));
});
