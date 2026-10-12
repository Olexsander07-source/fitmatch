import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoachSearchHandler} from '../supabase/functions/search_coaches/index.mjs';
import {validateSearch,resolveSport,PUBLIC_COLUMNS,fitsCoach} from '../supabase/functions/search_coaches/core.mjs';

const USER='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002';
const SPORT='20000000-0000-4000-8000-000000000001',SPORT2='20000000-0000-4000-8000-000000000002';
const id=i=>'30000000-0000-4000-8000-'+String(i).padStart(12,'0');
const sports=[{id:SPORT,name:'Бодибилдинг'},{id:SPORT2,name:'Йога'}];
const coach=(i,extra={})=>({id:id(i),name:'Тренер '+i,sport:SPORT,goal:'Сила, Похудение',format:'Онлайн и офлайн',price:40,period:'занятие',city:'Nice',country:'France',languages:['ru','fr'],availability:['evening'],experience_years:5,published:true,rating:0,reviews_count:0,verified:false,bio:'Описание',...extra});
function setup({rows=[coach(1)],actor=USER,invalidAuth=false,dbFailure=false,upstreamIgnoresFilters=false,env={}}={}) {
  const calls=[];
  const handler=createCoachSearchHandler({env:{SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:'never-read',...env},fetcher:async(url,options)=>{
    const u=new URL(url);calls.push({url:u,options});
    if(u.pathname==='/auth/v1/user')return Response.json({id:actor},{status:invalidAuth?401:200});
    if(dbFailure)return new Response('private database error: secret',{status:500});
    if(u.pathname==='/rest/v1/fgi_sports')return Response.json(sports);
    assert.equal(u.pathname,'/rest/v1/fgi_coaches');
    const p=u.searchParams;let data=[...rows].sort((a,b)=>a.id.localeCompare(b.id));
    const after=p.getAll('id').find(x=>x.startsWith('gt.'))?.slice(3);
    data=data.filter(x=>!after || x.id>after);
    if(!upstreamIgnoresFilters) {
      data=data.filter(x=>x.published===true && x.id!==actor);
      if(p.has('sport'))data=data.filter(x=>x.sport===p.get('sport').slice(3));
      if(p.has('period'))data=data.filter(x=>x.period===p.get('period').slice(3));
      if(p.has('price'))data=data.filter(x=>x.price!=null && x.price<=Number(p.get('price').slice(4)));
      if(p.has('format'))data=data.filter(x=>p.get('format').includes('"'+x.format+'"'));
      if(p.has('languages'))data=data.filter(x=>x.languages?.includes(p.get('languages').slice(4,-1)));
      if(p.has('availability'))data=data.filter(x=>x.availability?.includes(p.get('availability').slice(4,-1)));
      if(p.has('experience_years'))data=data.filter(x=>x.experience_years>=Number(p.get('experience_years').slice(4)));
    }
    return Response.json(data.slice(0,Number(p.get('limit'))));
  }});
  const request=(input={},headers={})=>handler(new Request('https://test.supabase.co/functions/v1/search_coaches',{method:'POST',headers:{Authorization:'Bearer user-session','Content-Type':'application/json',...headers},body:JSON.stringify(input)}));
  return {handler,request,calls};
}
async function result(setup,input,headers){const response=await setup.request(input,headers);return {status:response.status,data:await response.json(),response};}

test('sport ID and actual dictionary name return only that sport',async()=>{
  const s=setup({rows:[coach(1),coach(2,{sport:SPORT2})]});
  for(const sport of [SPORT,' бодибилдинг '])assert.deepEqual((await result(s,{sport})).data.coaches.map(x=>x.id),[id(1)]);
  assert.equal((await result(s,{sport:'invented'})).status,422);
});
test('valid sport with no coaches returns empty results',async()=>{
  const r=await result(setup(),{sport:SPORT2});assert.equal(r.status,200);assert.deepEqual(r.data.coaches,[]);assert.equal(r.data.has_more,false);
});
test('strict budget excludes unknown price, expensive price and different unit',async()=>{
  const s=setup({rows:[coach(1),coach(2,{price:null}),coach(3,{price:60}),coach(4,{period:'месяц'})]});
  const r=await result(s,{budget:40,period:'занятие'});assert.deepEqual(r.data.coaches.map(x=>x.id),[id(1)]);
  assert.equal((await result(s,{budget:50})).data.error,'budget_period_required');
});
test('zero budget retains only a known free offer',async()=>{
  const r=await result(setup({rows:[coach(1,{price:0}),coach(2,{price:null})]}),{budget:0,period:'занятие'});assert.deepEqual(r.data.coaches.map(x=>x.id),[id(1)]);
});
test('language is strict and unknown language does not match',async()=>{
  const s=setup({rows:[coach(1),coach(2,{languages:[]})]});assert.equal((await result(s,{language:'RU'})).data.coaches.length,1);assert.equal((await result(s,{language:'de'})).data.coaches.length,0);
});
test('online needs no location and explicitly reports ignored offline location',async()=>{
  const s=setup({rows:[coach(1,{format:'Онлайн',city:''}),coach(2,{format:'Офлайн'})]});
  const r=await result(s,{format:'Онлайн',city:'Paris',country:'France'});assert.deepEqual(r.data.coaches.map(x=>x.id),[id(1)]);assert.deepEqual(r.data.ignored_filters,['city','country']);
});
test('offline includes dual mode, excludes online, and matches city/country exactly',async()=>{
  const s=setup({rows:[coach(1),coach(2,{format:'Онлайн'}),coach(3,{city:'Paris'}),coach(4,{country:'Other'}),coach(5,{city:''})]});
  const r=await result(s,{format:'Офлайн',city:' nice ',country:'france'});assert.deepEqual(r.data.coaches.map(x=>x.id),[id(1)]);assert.ok(r.data.coaches.every(x=>!Object.hasOwn(x,'distance')));
});
test('location without mode selects only actual offline-capable profiles',async()=>{
  const r=await result(setup({rows:[coach(1),coach(2,{format:'Онлайн'})]}),{city:'Nice'});assert.deepEqual(r.data.coaches.map(x=>x.id),[id(1)]);
});
test('goal and specialization both use existing explicit goal tokens',async()=>{
  const s=setup({rows:[coach(1),coach(2,{goal:'Сила'}),coach(3,{goal:''})]});
  assert.deepEqual((await result(s,{goal:'сила',specialization:'похудение'})).data.coaches.map(x=>x.id),[id(1)]);
  assert.equal((await result(s,{goal:'развитие силы'})).data.coaches.length,0);
});
test('availability and experience require known actual values; no level field is invented',async()=>{
  const s=setup({rows:[coach(1),coach(2,{availability:[],experience_years:null})]});
  assert.equal((await result(s,{availability:'evening',min_experience_years:5})).data.coaches.length,1);
  assert.equal((await result(s,{level:'beginner'})).data.error,'unsupported_level_filter');
});
test('unpublished and own profiles excluded even if upstream ignores filtering',async()=>{
  const r=await result(setup({rows:[coach(1,{published:false}),coach(2,{id:USER}),coach(3)],upstreamIgnoresFilters:true}),{});assert.deepEqual(r.data.coaches.map(x=>x.id),[id(3)]);
});
test('public projection strips private and payment fields',async()=>{
  const r=await result(setup({rows:[coach(1,{email:'private',phone:'private',stripe_account_id:'acct_private',payment_url:'private',user_id:OTHER,secret:'private',metadata:{private:true}})]}),{});
  const c=r.data.coaches[0];for(const key of ['email','phone','stripe_account_id','payment_url','user_id','secret','metadata','published'])assert.ok(!Object.hasOwn(c,key));
  assert.equal(c.sport_name,'Бодибилдинг');assert.equal(c.currency,'EUR');assert.equal(c.price_known,true);
});
test('unknown price preserved as null without asserting affordability',async()=>{
  const c=(await result(setup({rows:[coach(1,{price:null})]}),{})).data.coaches[0];assert.equal(c.price,null);assert.equal(c.price_known,false);
});
test('missing, rejected, or forged Auth cannot read catalogue',async()=>{
  const a=setup();assert.equal((await result(a,{}, {Authorization:''})).status,401);assert.equal(a.calls.length,0);
  const b=setup({invalidAuth:true});assert.equal((await result(b,{})).status,401);assert.equal(b.calls.length,1);
  const c=setup({actor:'not-a-user'});assert.equal((await result(c,{})).status,401);assert.equal(c.calls.length,1);
});
test('uses the caller token for every read and never the service role',async()=>{
  const s=setup();await result(s,{});for(const call of s.calls){assert.equal(call.options.headers.Authorization,'Bearer user-session');assert.equal(call.options.headers.apikey,'public-key');assert.equal(call.options.method,'GET');}
  assert.deepEqual(s.calls[2].url.searchParams.get('select').split(','),PUBLIC_COLUMNS);
});
test('different verified callers are isolated and cannot choose a user ID',async()=>{
  const rows=[coach(1,{id:USER}),coach(2,{id:OTHER})].sort((a,b)=>a.id.localeCompare(b.id));
  assert.equal((await result(setup({rows,actor:USER}),{})).data.coaches[0].id,OTHER);
  assert.equal((await result(setup({rows,actor:OTHER}),{})).data.coaches[0].id,USER);
  const s=setup();assert.equal((await result(s,{user_id:OTHER})).data.error,'unknown_filter');assert.equal(s.calls.length,1);
});
test('pagination is stable and does not skip filtered candidates',async()=>{
  const s=setup({rows:[coach(1,{city:'Paris'}),coach(2),coach(3,{city:'Paris'}),coach(4)]});
  const first=(await result(s,{city:'Nice',limit:1})).data;assert.equal(first.coaches[0].id,id(2));assert.equal(first.has_more,true);
  const second=(await result(s,{city:'Nice',limit:1,cursor:first.next_cursor})).data;assert.equal(second.coaches[0].id,id(4));assert.equal(second.has_more,false);
});
test('scans later pages for strict text filters instead of truncating at first batch',async()=>{
  const rows=Array.from({length:251},(_,i)=>coach(i+1,{city:i===250?'Nice':'Other'}));
  const s=setup({rows});assert.equal((await result(s,{city:'Nice'})).data.coaches[0].id,id(251));assert.equal(s.calls.filter(x=>x.url.pathname==='/rest/v1/fgi_coaches').length,2);
});
test('bounded scan returns continuation, never false completeness',async()=>{
  const rows=Array.from({length:1001},(_,i)=>coach(i+1,{city:i===1000?'Nice':'Other'}));const s=setup({rows});
  const first=(await result(s,{city:'Nice'})).data;assert.equal(first.scan_limit_reached,true);assert.equal(first.has_more,true);assert.equal(first.next_cursor,id(1000));
  assert.equal((await result(s,{city:'Nice',cursor:first.next_cursor})).data.coaches[0].id,id(1001));
});
test('validation rejects type confusion, SQL/select injection and arbitrary query controls',async()=>{
  for(const input of [{budget:'40'},{budget:Infinity},{budget:-1},{budget:101},{format:'online'},{language:'ru},id.neq.x'},{cursor:'x'},{limit:21},{limit:0},{select:'*'},{sql:'select *'},{goal:['Сила']},{min_experience_years:1.5}])assert.throws(()=>validateSearch(input));
  assert.equal(resolveSport(SPORT,sports).id,SPORT);assert.throws(()=>resolveSport('unknown',sports));
});
test('location punctuation is treated as literal text, never as a query expression',async()=>{
  const s=setup();const r=await result(s,{city:'Nice),published.eq.false'});assert.equal(r.data.coaches.length,0);
  assert.equal(s.calls[2].url.searchParams.has('city'),false);assert.equal(s.calls[2].url.searchParams.get('published'),'eq.true');
});
test('wrong content type, malformed JSON and oversized streams rejected',async()=>{
  const s=setup();assert.equal((await result(s,{}, {'Content-Type':'text/plain'})).status,415);
  for(const [body,status] of [['{',400],[' '.repeat(4097),413]]){const r=await s.handler(new Request('https://test/search',{method:'POST',headers:{Authorization:'Bearer user-session','Content-Type':'application/json'},body}));assert.equal(r.status,status);}
});
test('CORS denies foreign origins, handles preflight, and GET exposes no catalogue',async()=>{
  const s=setup();assert.equal((await result(s,{}, {Origin:'https://attacker.test'})).status,403);assert.equal(s.calls.length,0);
  const preflight=await s.handler(new Request('https://test/search',{method:'OPTIONS',headers:{Origin:'https://fitgoin.com'}}));assert.equal(preflight.status,204);
  assert.equal((await s.handler(new Request('https://test/search'))).status,405);
});
test('backend failures are sanitized and responses cannot be cached',async()=>{
  const r=await result(setup({dbFailure:true}),{});assert.equal(r.status,503);assert.deepEqual(r.data,{error:'backend_unavailable'});assert.equal(r.response.headers.get('cache-control'),'no-store');
});
test('publishable key mapping works without a secret',async()=>{
  const s=setup({env:{SUPABASE_ANON_KEY:'',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'mapped-public'})}});assert.equal((await result(s,{})).status,200);assert.ok(s.calls.every(c=>c.options.headers.apikey==='mapped-public'));
});
test('strict predicates resist upstream data that violate any selected filter',()=>{
  const p=validateSearch({sport:SPORT,goal:'Сила',specialization:'Похудение',format:'Офлайн',city:'Nice',country:'France',budget:40,period:'занятие',language:'ru',availability:'evening',min_experience_years:5});
  for(const change of [{sport:SPORT2},{goal:''},{format:'Онлайн'},{city:''},{country:''},{price:null},{price:'bad'},{price:41},{period:'месяц'},{languages:[]},{availability:[]},{experience_years:null}])assert.equal(fitsCoach(coach(1,change),p,USER,sports[0]),false);
});

