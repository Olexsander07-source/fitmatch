// Actual frontend + handler, with isolated in-memory Auth/REST fixtures.
// This does not replace the separate real PostgreSQL/RLS or production checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomUUID}=require('node:crypto');
const {chromium}=require(process.env.FGI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..'),out=process.env.FGI_QA_OUTPUT||path.join(repo,'qa','ai-stage3c');
const OWNER='e63c0000-0000-4000-8000-000000000001',OTHER='e63c0000-0000-4000-8000-000000000002';
const checks=[],errors=[];let rows,cache,fault,providerCalls=0,programFacts;
const result=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function reset(){
 const data={goal:'Сила',experience:'intermediate',days_per_week:1,minutes:40,setting:'gym',equipment:'Штанга, скамья',restrictions:'',memory_confirmed_fields:['restrictions'],weekdays:[new Date().getDay()],language:'ru',response_style:'short',nutrition_preferences:{meals_per_day:4}};
 const workout={id:'w1',number:1,day:new Date().getDay(),title:'Силовая тренировка A',minutes:40,warmup:'Пять минут спокойной разминки',cooldown:'Три минуты спокойного завершения',objective:'Базовая сила',exercises:[{id:'e1',name:'Жим штанги лёжа',sets:4,reps:'8',rest_seconds:90,technique:'Контролируй движение.',alternative:'Отжимания от стены',required_equipment:'Штанга, скамья'},{id:'e2',name:'Жим стоя',sets:3,reps:'10',rest_seconds:60,technique:'Выполняй без боли.',alternative:'Жим гантелей',required_equipment:'Штанга'}]};
 rows={fgi_ai_profiles:[{user_id:OWNER,consent_version:'2026-10-03',consented_at:'2026-10-09T09:00:00Z',updated_at:'2026-10-09T10:00:00Z',data},{user_id:OTHER,consent_version:'2026-10-03',consented_at:'2026-10-09T09:00:00Z',updated_at:'2026-10-09T10:00:00Z',data:{goal:'Общее здоровье',restrictions:'',language:'ru'}}],fgi_ai_conversations:[],fgi_ai_messages:[],fgi_ai_plans:[{id:'e63c1000-0000-4000-8000-000000000001',user_id:OWNER,kind:'training',status:'active',revision:1,title:'Твоя программа',profile_snapshot:programFacts(data),document:{schema_version:2,title:'Твоя программа',summary:'Существующая программа.',progression:'Обсуди нагрузку с тренером.',schedule:{mode:'weekdays',weekdays:[new Date().getDay()],timezone:'UTC'},workouts:[workout]}}],fgi_ai_food:[],fgi_ai_workouts:[],fgi_ai_progress:[],fgi_ai_shares:[]};cache=new Map();fault=null;
}
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fitgoin-ai.css"><link rel="stylesheet" href="/fitgoin-premium.css"></head><body><main class="container section fgi-ai"><div id="root"></div></main><script type="module">
import {mountFitGoInAI} from '/fitgoin-ai.js';
let user={id:'${OWNER}'};
const db={auth:{getSession:async()=>({data:{session:user?{user,access_token:user.id}:null}})},from(table){const spec={table,filters:[],orders:[]};const q={select(){return q},eq(k,v){spec.filters.push([k,v]);return q},gt(){return q},in(k,v){spec.filters.push([k,v,true]);return q},order(k,o){spec.orders.push([k,o?.ascending!==false]);return q},limit(n){spec.limit=n;return q},range(){return q},single(){spec.one=true;return q},maybeSingle(){spec.one=true;return q},insert(v){spec.mutation='insert';spec.payload=v;return q},upsert(v){spec.mutation='upsert';spec.payload=v;return q},update(v){spec.mutation='update';spec.payload=v;return q},delete(){spec.mutation='delete';return q},then(resolve,reject){return fetch('/fixture/db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...spec,actor:user?.id})}).then(r=>r.json()).then(resolve,reject)}};return q}};
window.ai=mountFitGoInAI(document.getElementById('root'),{getDB:()=>db,getUser:()=>user,endpoint:location.origin+'/api/fitgoin-ai',billingEndpoint:location.origin+'/api/billing',sports:()=>[['fitness','Фитнес']],matches:()=>[],coachName:()=>'',login:()=>{},navigate:()=>{}});
window.account=id=>{user=id?{id}:null;window.ai.setSession(user)};window.ai.setSession(user);
</script></body></html>`;
(async()=>{
 ({programFacts}=await import('../fitgoin-ai-program.mjs'));reset();fs.mkdirSync(out,{recursive:true});
 const {createAIHandler}=await import('../supabase/functions/fitgoin-ai/index.mjs');
 const handle=createAIHandler({env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-private',OPENAI_API_KEY:'fixture-provider',AI_BILLING_MODE:'test'},fetcher:async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;
  if(url.endsWith('/auth/v1/user'))return result({id:String(options.headers.Authorization||options.headers.authorization).replace('Bearer ','')});
  if(url.endsWith('/rpc/fgi_ai_access'))return result({modules:['training'],friend:true});
  if(url.endsWith('/rpc/fgi_ai_claim')){const key=body.p_user+':'+body.p_id,old=cache.get(key);if(old)return result(old.hash!==body.p_hash?{error:'request_conflict'}:old.result?{cached:old.result}:{error:'request_pending'});cache.set(key,{hash:body.p_hash});return result({remaining:29,search_remaining:3});}
  if(url.endsWith('/rpc/fgi_ai_complete')){
   if(fault==='commit')return result({error:'offline'},503);
   const r=body.p_result,p=rows.fgi_ai_profiles.find(x=>x.user_id===body.p_user);
   if(p.updated_at!==body.p_consent)return result({code:'P0001',message:'consent_changed'},400);
   for(const change of r.workout_changes||[]){
    let row=rows.fgi_ai_workouts.find(x=>x.id===change.session_id&&x.user_id===body.p_user);
    if(change.operation==='start'){const plan=rows.fgi_ai_plans.find(x=>x.id===change.plan_id&&x.user_id===body.p_user),w=plan.document.workouts.find(x=>x.id===change.workout_id);row={id:change.session_id,user_id:body.p_user,plan_id:plan.id,revision:0,started_at:change.from_cursor?p.data.current_workout.started_at:new Date().toISOString(),completed_at:null,data:{status:'active',workout:structuredClone(w),index:change.from_cursor?p.data.current_workout.index:0,sets:[],reports:[],rest_until:null}};rows.fgi_ai_workouts.push(row);continue;}
    if(!row||change.revision!==row.revision)return result({code:'P0001',message:'workout_changed'},400);
    if(change.operation==='record'){const index=row.data.workout.exercises.findIndex(x=>x.id===change.exercise_id),e=row.data.workout.exercises[index];for(let i=0;i<change.sets;i++)row.data.sets.push({exercise_id:e.id,exercise_index:index,exercise:e.name,reps:change.reps,weight_kg:change.weight_kg,rpe:change.rpe,comment:change.comment,record_id:change.record_id,recorded_at:new Date().toISOString()});row.data.reports.push(change);row.data.rest_until=new Date(Date.now()+e.rest_seconds*1000).toISOString();}
    if(change.operation==='move'){row.data.index=change.index;row.data.rest_until=null;}
    if(change.operation==='complete'){row.completed_at=new Date().toISOString();Object.assign(row.data,{status:'completed',duration_minutes:change.duration_minutes,difficulty:change.difficulty,comment:change.comment});}
    if(change.operation==='stop'){row.completed_at=new Date().toISOString();Object.assign(row.data,{status:'stopped',stopped_for_pain:change.stopped_for_pain});}
    row.revision++;
   }
   if(Object.hasOwn(r,'current_workout'))p.data.current_workout=r.current_workout;
   if(Object.hasOwn(r,'workout_log_pending'))p.data.workout_log_pending=r.workout_log_pending;
   if(r.memory_patch)Object.assign(p.data,r.memory_patch);
   if(Object.hasOwn(r,'nutrition_plan_pending'))p.data.nutrition_plan_pending=r.nutrition_plan_pending;
   if(body.p_kind==='nutrition'){const previous=rows.fgi_ai_plans.find(x=>x.user_id===body.p_user&&x.status==='active');if(previous)previous.status='archived';rows.fgi_ai_plans.push({id:r.plan_id,user_id:body.p_user,kind:'nutrition',status:'active',revision:rows.fgi_ai_plans.filter(x=>x.user_id===body.p_user).length+1,supersedes_id:previous?.id||null,document:body.p_document,created_at:new Date().toISOString()});}
   for(const role of ['user','assistant'])rows.fgi_ai_messages.push({id:randomUUID(),user_id:body.p_user,conversation_id:body.p_conversation,request_id:body.p_id,role,body:role==='user'?body.p_input:body.p_output,citations:[],created_at:new Date().toISOString()});
   p.updated_at=new Date(Date.parse(p.updated_at)+1).toISOString();cache.get(body.p_user+':'+body.p_id).result=Object.fromEntries(Object.entries(r).filter(([k])=>k!=='workout_changes'));return result(null);
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
  if(req.url.startsWith('/api/')){const r=body.action==='access'?result({modules:['training'],friend:true,subscriptions:[],checkout_enabled:false}):await handle(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai',{method:req.method,headers:{Authorization:req.headers.authorization||'',Origin:'https://fitgoin.com','Content-Type':'application/json'},...(req.method==='POST'?{body:JSON.stringify(body)}:{})}));res.writeHead(r.status,{'Content-Type':'application/json'});return res.end(await r.text());}
  const filename=path.resolve(repo,'.'+req.url.split('?')[0]);if(!filename.startsWith(repo+path.sep))throw Error('Bad fixture path');res.setHeader('Content-Type',filename.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(filename));
 }catch{res.writeHead(500);res.end('Fixture failed');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.FGI_CHROME,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage',...(process.env.FGI_SINGLE_PROCESS?['--single-process','--no-zygote']:[])]});
 const pass=(name,width)=>{checks.push({name,width,passed:true});console.log('PASS '+name+' '+width)};
 const context=await browser.newContext();
 try{
  for(const width of [360,390,768,1440]){
   reset();const page=await context.newPage();await page.setViewportSize({width,height:950});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   const ready=()=>page.waitForFunction(()=>document.getElementById('root')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('[data-ai-view=today]'));
   const open=async view=>{await ready();if(width<900)await page.locator('[data-ai-action=menu]').click();await page.locator('[data-ai-view='+view+']').click();};
   const chat=async message=>{await open('ask');await page.locator('[data-ai-form=chat] [name=message]').fill(message);await page.locator('[data-ai-form=chat]').evaluate(f=>f.requestSubmit());await ready();};
   await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await open('today');const program=structuredClone(rows.fgi_ai_plans[0]),nutrition=structuredClone(rows.fgi_ai_profiles[0].data.nutrition_preferences);
   await page.locator('[data-ai-action=start-workout]').first().click();await page.locator('[data-workout-session]').waitFor();await ready();assert.equal(rows.fgi_ai_workouts.length,1);const id=rows.fgi_ai_workouts[0].id;pass('today starts the existing program in one shared session',width);
   await chat('Жим лёжа 80 кг, 4 подхода по 8');assert.equal(rows.fgi_ai_workouts[0].data.sets.length,4);assert(rows.fgi_ai_workouts[0].data.sets.every(x=>x.exercise_id==='e1'&&x.weight_kg===80&&x.rpe===null));pass('chat records correct exercise without inventing difficulty',width);
   await chat('Жим лёжа 80 кг, 4 подхода по 8');assert.equal(rows.fgi_ai_workouts[0].data.sets.length,4);pass('repeated grouped result does not duplicate sets',width);
   await page.reload();await open('today');await page.locator('[data-workout-session]').waitFor();assert.equal(rows.fgi_ai_workouts[0].id,id);await page.locator('[data-ai-action=next-exercise]').click();await ready();assert.equal(rows.fgi_ai_workouts[0].data.index,1);const form=page.locator('[data-ai-form=set]');await form.locator('[name=reps]').fill('10');await form.locator('[name=weight_kg]').fill('35');await form.locator('[name=comment]').fill('Контроль движения');await form.evaluate(f=>f.requestSubmit());await ready();assert.equal(rows.fgi_ai_workouts[0].data.sets.length,5);assert.equal(rows.fgi_ai_workouts[0].data.sets.at(-1).rpe,null);pass('reload restores session and form records next exercise with optional fields',width);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('[data-ai-action=finish-workout]').evaluate(x=>x.getBoundingClientRect().height>=44));if([390,1440].includes(width))await page.screenshot({path:path.join(out,'workout-'+width+'.png'),fullPage:true});pass('mobile viewport and touch controls remain usable',width);
   await page.locator('[data-ai-action=finish-workout]').click();assert.equal(rows.fgi_ai_workouts[0].completed_at,null);assert.equal(await page.locator('[data-ai-form=workout-completion] [name=difficulty]').inputValue(),'');await page.locator('[data-ai-action=close-dialog]').click();assert.equal(rows.fgi_ai_workouts[0].completed_at,null);pass('finish opens confirmation and cancellation leaves session active',width);
   await chat('Я закончил тренировку за 45 минут, сложность 8/10; комментарий: хорошая тренировка');await page.locator('[data-workout-completion]').waitFor();assert.equal(rows.fgi_ai_workouts[0].completed_at,null);await page.reload();await open('ask');await page.locator('[data-ai-action=confirm-workout]').click();assert.equal(await page.locator('[name=duration_minutes]').inputValue(),'45');assert.equal(await page.locator('[name=difficulty]').inputValue(),'8');await page.locator('[data-ai-form=workout-completion]').evaluate(f=>f.requestSubmit());await ready();const accepted=structuredClone(rows.fgi_ai_workouts[0]);assert.equal(accepted.data.status,'completed');assert.equal(accepted.data.duration_minutes,45);assert.equal(accepted.data.difficulty,8);assert.equal(accepted.data.comment,'хорошая тренировка');pass('chat proposal survives refresh and explicit confirmation saves known values',width);
   await page.reload();await open('progress');const history=page.locator('details').filter({hasText:'Силовая тренировка A'});await history.locator('summary').click();assert((await history.innerText()).includes('80 кг'));assert((await history.innerText()).includes('хорошая тренировка'));assert.deepEqual(rows.fgi_ai_workouts[0],accepted);if([390,1440].includes(width))await page.screenshot({path:path.join(out,'history-'+width+'.png'),fullPage:true});pass('completed results and comment reload from saved history',width);
   await chat('Я закончил тренировку');assert.equal(rows.fgi_ai_workouts.length,1);assert.deepEqual(rows.fgi_ai_workouts[0],accepted);pass('repeat completion leaves record and timestamp unchanged',width);
   await page.evaluate(id=>window.account(id),OTHER);await open('progress');assert.equal(await page.locator('details').filter({hasText:'Силовая тренировка A'}).count(),0);pass('account change clears previous results from UI',width);
   await page.evaluate(id=>window.account(id),OWNER);await open('today');await page.locator('[data-ai-action=start-workout]').first().click();await ready();assert.equal(rows.fgi_ai_workouts.length,2);await page.locator('[data-ai-action=finish-workout]').click();fault='commit';await page.locator('[data-ai-form=workout-completion]').evaluate(f=>f.requestSubmit());await page.locator('[data-ai-status].error').waitFor();assert.equal(rows.fgi_ai_workouts[1].completed_at,null);assert.deepEqual(rows.fgi_ai_workouts[0],accepted);assert.deepEqual(rows.fgi_ai_plans[0],program);assert.deepEqual(rows.fgi_ai_profiles[0].data.nutrition_preferences,nutrition);pass('commit failure cannot finish or change a saved program or nutrition',width);
   fault='load';await page.reload();await page.locator('[data-ai-status].error').waitFor();assert.equal(await page.locator('[data-workout-session]').count(),0);pass('database load failure shows error without stale session',width);
   await page.evaluate(()=>sessionStorage.clear());await page.close();
  }
  assert.equal(providerCalls,0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'ui-acceptance.json'),JSON.stringify({date:new Date().toISOString(),environment:'local actual frontend and handler; isolated Auth/REST fixtures',passed:true,checks,providerCalls,errors},null,2));console.log('PASS '+checks.length+' checks; no provider calls or JS errors');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
