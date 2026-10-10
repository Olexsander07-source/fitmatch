// Actual frontend + handler, with isolated in-memory Auth/REST fixtures.
// This does not replace the separate real PostgreSQL/RLS or production checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomUUID}=require('node:crypto');
const {chromium}=require(process.env.FGI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..'),out=process.env.FGI_QA_OUTPUT||path.join(repo,'qa','ai-stage3b');
const OWNER='e63b0000-0000-4000-8000-000000000001',OTHER='e63b0000-0000-4000-8000-000000000002';
const checks=[],errors=[];let rows,cache,fault,providerCalls=0;
const result=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function reset(){
 rows={fgi_ai_profiles:[{user_id:OWNER,consent_version:'2026-10-03',consented_at:'2026-10-09T09:00:00Z',updated_at:'2026-10-09T10:00:00Z',data:{age:28,height_cm:180,weight_kg:80,activity:'light',goal:'Похудение',allergies:[],restrictions:'',days_per_week:3,nutrition_preferences:{meals_per_day:4,excluded_foods:['рыба']}}},{user_id:OTHER,consent_version:'2026-10-03',consented_at:'2026-10-09T09:00:00Z',updated_at:'2026-10-09T10:00:00Z',data:{age:30,height_cm:170,weight_kg:65,activity:'light',goal:'Общее здоровье',allergies:[],diet:'Я веган',nutrition_preferences:{goal:'maintain',meals_per_day:3}}}],fgi_ai_conversations:[],fgi_ai_messages:[],fgi_ai_plans:[],fgi_ai_food:[],fgi_ai_workouts:[],fgi_ai_progress:[],fgi_ai_shares:[]};cache=new Map();fault=null;
}
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fitgoin-ai.css"><link rel="stylesheet" href="/fitgoin-premium.css"></head><body><main class="container section fgi-ai"><div id="root"></div></main><script type="module">
import {mountFitGoInAI} from '/fitgoin-ai.js';
let user={id:'${OWNER}'};
const db={auth:{getSession:async()=>({data:{session:user?{user,access_token:user.id}:null}})},from(table){const spec={table,filters:[],orders:[]};const q={select(){return q},eq(k,v){spec.filters.push([k,v]);return q},gt(){return q},in(k,v){spec.filters.push([k,v,true]);return q},order(k,o){spec.orders.push([k,o?.ascending!==false]);return q},limit(n){spec.limit=n;return q},range(){return q},single(){spec.one=true;return q},maybeSingle(){spec.one=true;return q},insert(v){spec.mutation='insert';spec.payload=v;return q},upsert(v){spec.mutation='upsert';spec.payload=v;return q},update(v){spec.mutation='update';spec.payload=v;return q},delete(){spec.mutation='delete';return q},then(resolve,reject){return fetch('/fixture/db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...spec,actor:user?.id})}).then(r=>r.json()).then(resolve,reject)}};return q}};
window.ai=mountFitGoInAI(document.getElementById('root'),{getDB:()=>db,getUser:()=>user,endpoint:location.origin+'/api/fitgoin-ai',billingEndpoint:location.origin+'/api/billing',sports:()=>[['fitness','Фитнес']],matches:()=>[],coachName:()=>'',login:()=>{},navigate:()=>{}});
window.account=id=>{user=id?{id}:null;window.ai.setSession(user)};window.ai.setSession(user);
</script></body></html>`;
(async()=>{
 reset();fs.mkdirSync(out,{recursive:true});
 const {createAIHandler}=await import('../supabase/functions/fitgoin-ai/index.mjs');
 const handle=createAIHandler({env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-private',OPENAI_API_KEY:'fixture-provider',AI_BILLING_MODE:'test'},fetcher:async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;
  if(url.endsWith('/auth/v1/user'))return result({id:String(options.headers.Authorization||options.headers.authorization).replace('Bearer ','')});
  if(url.endsWith('/rpc/fgi_ai_access'))return result({modules:['nutrition'],friend:true});
  if(url.endsWith('/rpc/fgi_ai_claim')){const key=body.p_user+':'+body.p_id,old=cache.get(key);if(old)return result(old.hash!==body.p_hash?{error:'request_conflict'}:old.result?{cached:old.result}:{error:'request_pending'});cache.set(key,{hash:body.p_hash});return result({remaining:29,search_remaining:3});}
  if(url.endsWith('/rpc/fgi_ai_complete')){
   if(fault==='commit')return result({error:'offline'},503);
   const r=body.p_result,p=rows.fgi_ai_profiles.find(x=>x.user_id===body.p_user);
   if(p.updated_at!==body.p_consent)return result({code:'P0001',message:'consent_changed'},400);
   if(r.memory_patch)Object.assign(p.data,r.memory_patch);
   if(Object.hasOwn(r,'nutrition_plan_pending'))p.data.nutrition_plan_pending=r.nutrition_plan_pending;
   if(body.p_kind==='nutrition'){const previous=rows.fgi_ai_plans.find(x=>x.user_id===body.p_user&&x.status==='active');if(previous)previous.status='archived';rows.fgi_ai_plans.push({id:r.plan_id,user_id:body.p_user,kind:'nutrition',status:'active',revision:rows.fgi_ai_plans.filter(x=>x.user_id===body.p_user).length+1,supersedes_id:previous?.id||null,document:body.p_document,created_at:new Date().toISOString()});}
   for(const role of ['user','assistant'])rows.fgi_ai_messages.push({id:randomUUID(),user_id:body.p_user,conversation_id:body.p_conversation,request_id:body.p_id,role,body:role==='user'?body.p_input:body.p_output,citations:[],created_at:new Date().toISOString()});
   p.updated_at=new Date(Date.parse(p.updated_at)+1).toISOString();cache.get(body.p_user+':'+body.p_id).result=r;return result(null);
  }
  if(url.endsWith('/rpc/fgi_ai_fail'))return result(null);
  if(url.includes('/rest/v1/')){const u=new URL(url),table=u.pathname.split('/').at(-1);let data=rows[table]||[];if(fault==='read'&&table==='fgi_ai_plans')return result({error:'offline'},503);for(const [k,v]of u.searchParams)if(v.startsWith('eq.'))data=data.filter(x=>String(x[k])===v.slice(3));return result(data);}
  if(url.includes('api.openai.com')){providerCalls++;return result({error:'unavailable'},503);}
  throw Error('Unexpected fixture endpoint');
 }});
 const server=http.createServer(async(req,res)=>{try{
  if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html);}
  const chunks=[];if(req.method==='POST')for await(const c of req)chunks.push(c);const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
  if(req.url==='/fixture/db'){
   if(fault==='load'&&body.table==='fgi_ai_profiles')return res.end(JSON.stringify({data:null,error:{message:'fixture offline'}}));
   const list=rows[body.table]||[],matches=x=>body.filters.every(([k,v,many])=>many?v.includes(x[k]):x[k]===v)&&(!x.user_id||x.user_id===body.actor);let found=list.filter(matches);
   if(body.mutation==='insert'||body.mutation==='upsert'){const row={id:randomUUID(),title:'FitGoIn AI',created_at:new Date().toISOString(),...body.payload};list.push(row);found=[row];}
   if(body.mutation==='update')found.forEach(x=>Object.assign(x,body.payload));
   for(const [k,asc]of body.orders.reverse())found.sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(asc?1:-1));
   if(body.limit)found=found.slice(0,body.limit);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:body.one?found[0]||null:found,error:null}));
  }
  if(req.url.startsWith('/api/')){const r=body.action==='access'?result({modules:['nutrition'],friend:true,subscriptions:[],checkout_enabled:false}):await handle(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai',{method:req.method,headers:{Authorization:req.headers.authorization||'',Origin:'https://fitgoin.com','Content-Type':'application/json'},...(req.method==='POST'?{body:JSON.stringify(body)}:{})}));res.writeHead(r.status,{'Content-Type':'application/json'});return res.end(await r.text());}
  const filename=path.resolve(repo,'.'+req.url.split('?')[0]);if(!filename.startsWith(repo+path.sep))throw Error('Bad fixture path');res.setHeader('Content-Type',filename.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(filename));
 }catch{res.writeHead(500);res.end('Fixture failed');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.FGI_CHROME,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage',...(process.env.FGI_SINGLE_PROCESS?['--single-process','--no-zygote']:[])]});
 const pass=(name,width)=>{checks.push({name,width,passed:true});console.log('PASS '+name+' '+width)};
 const context=await browser.newContext();
 try{
  for(const width of [360,390,768,1440]){
   reset();const page=await context.newPage();await page.setViewportSize({width,height:950});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   const ready=()=>page.waitForFunction(()=>document.getElementById('root')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('[data-ai-view=nutrition]'));
   const open=async view=>{await ready();if(width<900)await page.locator('[data-ai-action=menu]').click();await page.locator('[data-ai-view='+view+']').click();};
   await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await open('nutrition');await page.locator('[data-ai-action=create-nutrition]:enabled').click();await page.locator('[data-nutrition-draft=true]').waitFor();await ready();
   const original=structuredClone(rows.fgi_ai_profiles[0].data.nutrition_plan_pending.document);assert.equal(rows.fgi_ai_plans.length,0);assert.equal(original.meals.length,4);assert(!original.meals.flatMap(m=>m.items).some(x=>x.allergens.includes('fish')));pass('create honours saved food exclusions and meal count without accepting',width);
   await page.locator('[data-ai-action=nutrition-replace][data-item-id=meal-2-food-2]').click();await page.locator('.ai-nutrition-changes').waitFor();await ready();const edited=structuredClone(rows.fgi_ai_profiles[0].data.nutrition_plan_pending.document);assert.notDeepEqual(edited,original);
   for(const x of original.meals.flatMap(m=>m.items))if(x.id!=='meal-2-food-2')assert.deepEqual(edited.meals.flatMap(m=>m.items).find(y=>y.id===x.id),x);assert.equal(rows.fgi_ai_plans.length,0);pass('one product replacement keeps every other exact portion',width);
   await page.locator('[data-ai-action=nutrition-confirm]').click();await page.locator('[data-nutrition-draft=false]').waitFor();await ready();assert.equal(rows.fgi_ai_plans.length,1);assert.deepEqual(rows.fgi_ai_plans[0].document,edited);const accepted=structuredClone(rows.fgi_ai_plans[0]);pass('explicit confirmation accepts the edited menu once',width);
   await page.reload();await open('nutrition');await page.locator('[data-nutrition-draft=false]').waitFor();const replacement=edited.meals.flatMap(m=>m.items).find(x=>x.id==='meal-2-food-2');assert((await page.locator('[data-food-id=meal-2-food-2]').innerText()).includes(replacement.name+' — '+replacement.portion));assert.deepEqual(rows.fgi_ai_plans[0],accepted);pass('page reload restores exact accepted portions',width);
   await page.evaluate(()=>window.account(null));await page.locator('[data-ai-action=login]').waitFor();await page.evaluate(id=>window.account(id),OWNER);await open('nutrition');await page.locator('[data-nutrition-draft=false]').waitFor();assert.deepEqual(rows.fgi_ai_plans[0],accepted);pass('sign out and sign in restore the current version',width);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('[data-ai-action=nutrition-replace]').first().evaluate(x=>x.getBoundingClientRect().height>=44));pass('mobile layout fits viewport and touch buttons',width);
   if([390,1440].includes(width))await page.screenshot({path:path.join(out,'nutrition-'+width+'.png'),fullPage:true});
   await page.locator('[data-ai-action=create-nutrition]').click();await page.locator('[data-nutrition-draft=true]').waitFor();await ready();assert.deepEqual(rows.fgi_ai_plans[0],accepted);await page.locator('[data-ai-action=nutrition-cancel]').click();await page.locator('[data-nutrition-draft=false]').waitFor();pass('new proposals and cancellation preserve the accepted version',width);
   await page.evaluate(id=>window.account(id),OTHER);await open('nutrition');assert.equal(await page.locator('[data-nutrition-draft=false]').count(),0);assert.equal(await page.locator('.ai-meal-card').count(),0);pass('switching account clears previous UI data',width);
   await page.evaluate(id=>window.account(id),OWNER);await open('nutrition');await page.locator('[data-ai-action=create-nutrition]').click();await page.locator('[data-nutrition-draft=true]').waitFor();await ready();fault='commit';await page.locator('[data-ai-action=nutrition-confirm]').click();await page.locator('[data-ai-status].error').waitFor();assert.deepEqual(rows.fgi_ai_plans[0],accepted);assert(rows.fgi_ai_profiles[0].data.nutrition_plan_pending);pass('Supabase commit failure cannot replace or claim to save a plan',width);
   fault='load';await page.reload();await page.locator('[data-ai-status].error').waitFor();assert.equal(await page.locator('.ai-meal-card').count(),0);pass('database load failure has a visible error without stale cards',width);
   await page.evaluate(()=>localStorage.clear());await page.close();
  }
  assert.equal(providerCalls,0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'ui-acceptance.json'),JSON.stringify({date:new Date().toISOString(),environment:'local actual frontend and handler; isolated Auth/REST fixtures',passed:true,checks,providerCalls,errors},null,2));console.log('PASS '+checks.length+' checks; no provider calls or JS errors');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
