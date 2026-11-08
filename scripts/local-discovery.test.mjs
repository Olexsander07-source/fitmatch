import test from 'node:test';
import assert from 'node:assert/strict';
import {validCity,cityCenter,distanceKm,normalizePlaces} from '../fitgoin-local-core.mjs';
import {createLocalHandler} from '../supabase/functions/fitgoin-local-discovery/index.mjs';
import {localDiscoveryHTML,localLabel} from '../fitgoin-ai-local.mjs';

const actor='20000000-0000-4000-8000-000000000001';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'public-key',
  SUPABASE_SERVICE_ROLE_KEY:'server-key',GEOAPIFY_API_KEY:'test-key',
  FGI_LOCAL_GEO_ENABLED:'true',AI_ALLOWED_ORIGINS:'https://fitgoin.com'};
const geo={results:[{result_type:'city',formatted:'Toulouse, France',lat:43.6045,lon:1.444,rank:{confidence_city_level:1}}]};
const places={type:'FeatureCollection',features:[
 {type:'Feature',properties:{place_id:'place-123456',name:'Salle Test',formatted:'Rue Test, Toulouse',lat:43.605,lon:1.445}},
 {type:'Feature',properties:{place_id:'place-123457',name:'Outside',lat:44.12,lon:1.445}},
 {type:'Feature',properties:{place_id:'place-123458',name:'Closed',lat:43.606,lon:1.446,datasource:{raw:{disused:'yes'}}}},
 {type:'Feature',properties:{place_id:'place-123459',name:'Other',lat:43.607,lon:1.447}}
]};
const request=(body,origin='https://fitgoin.com')=>new Request('https://project.supabase.co/functions/v1/fitgoin-local-discovery',
 {method:'POST',headers:{Authorization:'Bearer user-token',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const body={city:'Toulouse, France',category:'gyms',language:'fr',consent:true};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const fake=(opts={})=>{
 let calls=[];
 const fetcher=async (url,init={})=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return reply(opts.auth===false?{error:'invalid'}:{id:actor},opts.auth===false?401:200);
  if(url.endsWith('/rest/v1/rpc/fgi_ai_access'))return reply({modules:opts.access===false?[]:['training']});
  if(url.endsWith('/rest/v1/rpc/fgi_local_claim'))return reply(opts.quota===false?false:true);
  if(url.startsWith('https://api.geoapify.com/v1/geocode/search'))return reply(opts.geocode??geo,opts.providerStatus??200);
  if(url.startsWith('https://api.geoapify.com/v2/places'))return reply(opts.places??places,opts.providerStatus??200);
  throw Error('Unexpected outbound fetch');
 };
 return {handler:createLocalHandler({env:{...env,...opts.env},fetcher}),calls};
};
test('only city names allowed; no specific street, address or personal data',()=>{
 for(const x of ['Toulouse','Paris, France','Saint-Étienne','Lyon, France'])assert.equal(validCity(x),x);
 for(const x of ['12 rue Voltaire','test@example.com','https://example.com','',3,'a'.repeat(102)])assert.equal(validCity(x),null);
});
test('distance filtering creates safe map links and does not invent prices',()=>{
 assert.equal(distanceKm({lat:43.6045,lng:1.444},{lat:43.6045,lng:1.444}),0);
 assert.equal(distanceKm({lat:43.6045,lng:1.444},{lat:44.1,lng:1.444})>15,true);
 const results=normalizePlaces(places.features,{lat:43.6045,lng:1.444},{category:'gyms'});
 assert.equal(results.length,2);assert.equal(results[0].price,null);
 assert.equal(new URL(results[0].maps_url).hostname,'www.openstreetmap.org');
});
test('ambiguous or low confidence cities do not silently select a wrong place',()=>{
 const result=cityCenter({results:[...geo.results,{...geo.results[0],formatted:'Toulouse, Other Country'}]});
 assert.equal(result.error,'ambiguous_city');
 assert.equal(cityCenter({results:[]}).error,'city_not_found');
 assert.equal(cityCenter({results:[{...geo.results[0],rank:{confidence_city_level:0.2}}]}).error,'city_not_found');
});
test('missing key or server switch causes no Geoapify requests',async()=>{
 for(const missing of [{GEOAPIFY_API_KEY:''},{FGI_LOCAL_GEO_ENABLED:'false'}]){
  const t=fake({env:missing});const r=await t.handler(request(body));
  assert.equal(r.status,503);assert.equal((await r.json()).error,'geo_not_configured');
  assert.equal(t.calls.length,1);assert(t.calls[0].url.endsWith('/auth/v1/user'));
 }
});
test('bounded Geoapify request returns verified locations within the radius',async()=>{
 const t=fake();const r=await t.handler(request(body));assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.radius_km,15);assert.equal(data.source,'Geoapify');
 assert.equal(data.category,'gyms');assert.equal(data.results.length,2);
 assert.equal(data.results[0].name,'Salle Test');assert.equal(data.results[0].price_status,'not_verified');
 assert(!JSON.stringify(data).includes('test-key'));
 const geocode=new URL(t.calls.find(x=>x.url.startsWith('https://api.geoapify.com/v1/')).url);
 assert.equal(geocode.searchParams.get('text'),'Toulouse, France');
 assert.equal(geocode.searchParams.get('type'),'city');
 const nearby=new URL(t.calls.find(x=>x.url.startsWith('https://api.geoapify.com/v2/')).url);
 assert.equal(nearby.searchParams.get('categories'),'sport.fitness.gym,sport.fitness.fitness_centre');
 assert.equal(nearby.searchParams.get('filter'),'circle:1.444,43.6045,15000');
 assert.equal(nearby.searchParams.get('limit'),'20');
});
test('quota exhausted and denied origin never call Geoapify',async()=>{
 const a=fake({quota:false});assert.equal((await a.handler(request(body))).status,429);
 assert.equal(a.calls.filter(x=>x.url.startsWith('https://api.geoapify.com')).length,0);
 const b=fake();assert.equal((await b.handler(request(body,'https://attacker.example'))).status,403);
 assert.equal(b.calls.length,0);
});
test('consent and authenticated user are mandatory',async()=>{
 const a=fake();assert.equal((await a.handler(request({...body,consent:false}))).status,422);assert.equal(a.calls.length,0);
 const b=fake({auth:false});assert.equal((await b.handler(request(body))).status,401);assert.equal(b.calls.length,1);
});
test('provider errors do not reveal keys or URLs',async()=>{
 const t=fake({providerStatus:401});const r=await t.handler(request(body));
 assert.equal(r.status,503);assert(!JSON.stringify(await r.json()).includes('test-key'));
});
test('GET readiness does not call provider or expose secrets',async()=>{
 const t=fake({env:{FGI_LOCAL_GEO_ENABLED:'false'}});const r=await t.handler(new Request('https://example.com/'));
 const data=await r.json();assert.equal(data.configured,false);assert.equal(data.prices_connected,false);
 assert.equal(data.source,'Geoapify');assert.equal(t.calls.length,0);
});
test('local UI remains hidden until enabled, escapes text, blocks unsafe links, and attributes data',()=>{
 const disabled=localDiscoveryHTML({city:'Toulouse, France',language:'fr',ready:false});
 assert(!disabled.includes('data-ai-form="local"'));assert.equal(localLabel('ru'),'Рядом 15 км');
 const enabled=localDiscoveryHTML({city:'Toulouse, France',language:'ru',ready:true,
  result:{city:'Toulouse, France',radius_km:15,checked_at:'2026-11-08T10:00:00Z',category:'gyms',results:[
   {name:'<img src=x onerror=alert(1)>',address:'Rue',distance_km:1.2,maps_url:'javascript:alert(1)'}]}});
 assert(enabled.includes('data-ai-form="local"'));assert(enabled.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert(!enabled.includes('<img src=x'));assert(!enabled.includes('href="javascript:'));
 assert(enabled.includes('Цена не подтверждена'));assert(enabled.includes('Powered by Geoapify'));
 assert(enabled.includes('OpenStreetMap contributors'));
});
test('users without AI access do not consume provider quota',async()=>{
 const a=fake({access:false});const r=await a.handler(request(body));
 assert.equal(r.status,402);assert.equal((await r.json()).error,'subscription_required');
 assert.equal(a.calls.filter(x=>x.url.startsWith('https://api.geoapify.com')).length,0);
 assert.equal(a.calls.filter(x=>x.url.endsWith('/rpc/fgi_local_claim')).length,0);
});

test('simple Geoapify secret enables search, while explicit false disables it',async()=>{
 const simple={GEOAPIFY_API_KEY:'',Geoapify:'simple-test-key',FGI_LOCAL_GEO_ENABLED:undefined};
 const active=fake({env:simple});
 const ready=await active.handler(new Request('https://example.com/'));
 assert.equal((await ready.json()).configured,true);
 const result=await active.handler(request(body));
 assert.equal(result.status,200);
 const query=new URL(active.calls.find(x=>x.url.startsWith('https://api.geoapify.com/v1/')).url);
 assert.equal(query.searchParams.get('apiKey'),'simple-test-key');
 const stopped=fake({env:{...simple,FGI_LOCAL_GEO_ENABLED:'false'}});
 const r=await stopped.handler(request(body));
 assert.equal(r.status,503);
 assert.equal(stopped.calls.filter(x=>x.url.startsWith('https://api.geoapify.com')).length,0);
});

test('standard secret also enables search without a separate switch',async()=>{
 const t=fake({env:{FGI_LOCAL_GEO_ENABLED:undefined}});
 const ready=await t.handler(new Request('https://example.com/'));
 assert.equal((await ready.json()).configured,true);
 assert.equal((await t.handler(request(body))).status,200);
 const stopped=fake({env:{FGI_LOCAL_GEO_ENABLED:'false'}});
 assert.equal((await stopped.handler(request(body))).status,503);
 assert.equal(stopped.calls.filter(x=>x.url.startsWith('https://api.geoapify.com')).length,0);
});
