// Actual frontend + handler, with isolated in-memory Auth/REST fixtures.
// This does not replace the separate real PostgreSQL/RLS or production checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomUUID}=require('node:crypto');
const {chromium}=require(process.env.FGI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..'),out=process.env.FGI_QA_OUTPUT||path.join(repo,'qa','ai-stage3e');
const OWNER='e63d0000-0000-4000-8000-000000000001',OTHER='e63d0000-0000-4000-8000-000000000002';
const checks=[],errors=[];let rows,cache,fault,providerCalls=0,programFacts,requests=[];
function syncWeight(user){const latest=rows.fgi_ai_progress.filter(x=>x.user_id===user&&x.weight_kg!=null).sort((a,b)=>b.recorded_on.localeCompare(a.recorded_on)||Date.parse(b.recorded_at)-Date.parse(a.recorded_at))[0];if(latest)rows.fgi_ai_profiles.find(x=>x.user_id===user).data.weight_kg=latest.weight_kg;}
const result=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function reset(){
 const data={goal:'Сила',experience:'intermediate',days_per_week:1,minutes:40,setting:'gym',equipment:'Штанга, скамья',restrictions:'',memory_confirmed_fields:['restrictions'],weekdays:[new Date().getDay()],language:'ru',response_style:'short',nutrition_preferences:{meals_per_day:4}};
 const workout={id:'w1',number:1,day:new Date().getDay(),title:'Силовая тренировка A',minutes:40,warmup:'Пять минут спокойной разминки',cooldown:'Три минуты спокойного завершения',objective:'Базовая сила',exercises:[{id:'e1',name:'Жим штанги лёжа',sets:3,reps:'10',minutes:6,rest_seconds:90,technique:'Контролируй движение.',alternative:'Отжимания от стены',required_equipment:'Штанга, скамья',alternative_equipment:'Без оборудования'},{id:'e2',name:'Жим стоя',sets:3,reps:'10',minutes:6,rest_seconds:60,technique:'Выполняй без боли.',alternative:'Отжимания от стены',required_equipment:'Штанга',alternative_equipment:'Без оборудования'}]};
 rows={fgi_ai_profiles:[{user_id:OWNER,consent_version:'2026-10-03',consented_at:'2026-10-09T09:00:00Z',updated_at:'2026-10-09T10:00:00Z',data},{user_id:OTHER,consent_version:'2026-10-03',consented_at:'2026-10-09T09:00:00Z',updated_at:'2026-10-09T10:00:00Z',data:{goal:'Общее здоровье',restrictions:'',language:'ru'}}],fgi_ai_conversations:[],fgi_ai_messages:[],fgi_ai_plans:[{id:'e63d1000-0000-4000-8000-000000000001',user_id:OWNER,kind:'training',status:'active',revision:1,title:'Твоя программа',profile_snapshot:programFacts(data),document:{schema_version:2,title:'Твоя программа',summary:'Существующая программа.',progression:'Обсуди нагрузку с тренером.',schedule:{mode:'weekdays',weekdays:[new Date().getDay()],timezone:'UTC'},workouts:[workout]}}],fgi_ai_food:[],fgi_ai_workouts:[],fgi_ai_progress:[],fgi_ai_shares:[]};cache=new Map();fault=null;requests=[];
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
  if(url.endsWith('/rpc/fgi_ai_access'))return result({modules:['training','nutrition'],friend:true});
  if(url.endsWith('/rpc/fgi_ai_claim')){const key=body.p_user+':'+body.p_id,old=cache.get(key);if(old)return result(old.hash!==body.p_hash?{error:'request_conflict'}:old.result?{cached:old.result}:{error:'request_pending'});cache.set(key,{hash:body.p_hash});return result({remaining:29,search_remaining:3});}
  if(url.endsWith('/rpc/fgi_ai_progress_analysis')){
   if(fault==='analysis')return result({error:'fixture unavailable'},503);
   const today=new Date().toISOString().slice(0,10),start_on=new Date(Date.now()-(body.p_days-1)*86400000).toISOString().slice(0,10),weights=rows.fgi_ai_progress.filter(x=>x.user_id===body.p_user&&x.recorded_on>=start_on&&x.recorded_on<=today).sort((a,b)=>a.recorded_on.localeCompare(b.recorded_on)||Date.parse(a.recorded_at)-Date.parse(b.recorded_at));
   const done=rows.fgi_ai_workouts.filter(x=>x.user_id===body.p_user&&x.data.status==='completed'&&x.completed_at.slice(0,10)>=start_on).sort((a,b)=>Date.parse(b.completed_at)-Date.parse(a.completed_at)),f=rows.fgi_ai_food.filter(x=>x.user_id===body.p_user&&x.recorded_on>=start_on),totals={entries:f.length,days:new Set(f.map(x=>x.recorded_on)).size,has_saved_menu:rows.fgi_ai_plans.some(x=>x.user_id===body.p_user&&x.kind==='nutrition'&&x.status==='active')};
   for(const k of ['calories_low','calories_high','protein_g','fat_g','carbs_g'])totals[k]=f.reduce((n,x)=>n+x[k],0);
   return result({today,start_on,days:body.p_days,timezone:body.p_timezone,measurements:weights,workouts:{completed_count:done.length,active_count:rows.fgi_ai_workouts.filter(x=>x.user_id===body.p_user&&x.data.status==='active').length,pain_stops:rows.fgi_ai_workouts.some(x=>x.user_id===body.p_user&&x.data.stopped_for_pain),recent:done.slice(0,12)},schedule:{known_days:0,unknown_days:body.p_days-1,planned:0,matched:0,unlinked_count:done.length},exercise_trends:[],food:body.p_food?totals:null});
  }
  if(url.endsWith('/rpc/fgi_ai_history')){
   if(fault==='history')return result({error:'fixture unavailable'},503);
   const done=rows.fgi_ai_workouts.filter(x=>x.user_id===body.p_user&&x.data.status==='completed').sort((a,b)=>Date.parse(b.completed_at)-Date.parse(a.completed_at));
   const weights=rows.fgi_ai_progress.filter(x=>x.user_id===body.p_user&&x.weight_kg!=null).sort((a,b)=>b.recorded_on.localeCompare(a.recorded_on)||Date.parse(b.recorded_at)-Date.parse(a.recorded_at));
   const today=new Date().toISOString().slice(0,10),week_start=new Date(Date.now()-6*86400000).toISOString().slice(0,10);
   return result({today,week_start,workout_count_week:done.filter(x=>x.completed_at.slice(0,10)>=week_start).length,workouts:done.slice(0,10),weights:weights.slice(0,20),first_weight:weights.at(-1)||null,latest_weight:weights[0]||null,exercise_workouts:done});
  }
  if(url.endsWith('/rpc/fgi_ai_complete')||url.endsWith('/rpc/fgi_ai_progress_complete')){
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
   if(r.progress_record){const old=rows.fgi_ai_progress.find(x=>x.id===body.p_id);if(!old){rows.fgi_ai_progress.push({id:body.p_id,user_id:body.p_user,...r.progress_record,recorded_at:new Date().toISOString()});syncWeight(body.p_user);}}
   if(Object.hasOwn(r,'current_workout'))p.data.current_workout=r.current_workout;
   if(Object.hasOwn(r,'workout_log_pending'))p.data.workout_log_pending=r.workout_log_pending;
   if(r.memory_patch)Object.assign(p.data,r.memory_patch);
   if(Object.hasOwn(r,'program_edit_pending'))p.data.program_edit_pending=r.program_edit_pending;
   if(body.p_kind==='training'){const old=rows.fgi_ai_plans.find(x=>x.user_id===body.p_user&&x.kind==='training'&&x.status==='active');if(old)old.status='archived';rows.fgi_ai_plans.push({id:r.plan_id,user_id:body.p_user,kind:'training',title:body.p_document.title,status:'active',revision:(old?.revision||0)+1,supersedes_id:old?.id||null,profile_snapshot:r.profile_snapshot,document:body.p_document,created_at:new Date().toISOString()});}
   if(Object.hasOwn(r,'nutrition_plan_pending'))p.data.nutrition_plan_pending=r.nutrition_plan_pending;
   if(body.p_kind==='nutrition'){const previous=rows.fgi_ai_plans.find(x=>x.user_id===body.p_user&&x.status==='active');if(previous)previous.status='archived';rows.fgi_ai_plans.push({id:r.plan_id,user_id:body.p_user,kind:'nutrition',status:'active',revision:rows.fgi_ai_plans.filter(x=>x.user_id===body.p_user).length+1,supersedes_id:previous?.id||null,document:body.p_document,created_at:new Date().toISOString()});}
   for(const role of ['user','assistant'])rows.fgi_ai_messages.push({id:randomUUID(),user_id:body.p_user,conversation_id:body.p_conversation,request_id:body.p_id,role,body:role==='user'?body.p_input:body.p_output,citations:[],created_at:new Date().toISOString()});
   p.updated_at=new Date(Date.parse(p.updated_at)+1).toISOString();cache.get(body.p_user+':'+body.p_id).result=Object.fromEntries(Object.entries(r).filter(([k])=>!['workout_changes','progress_record','measurement_timezone','analysis_change'].includes(k)));return result(null);
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
   if((fault==='form_commit')&&body.table==='fgi_ai_progress'&&body.mutation)return res.end(JSON.stringify({data:null,error:{message:'fixture failure'}}));
   if(body.mutation==='insert'||body.mutation==='upsert'){const duplicate=list.find(x=>x.id===body.payload.id);if(duplicate){found=[duplicate];}else{const row={id:randomUUID(),title:'FitGoIn AI',created_at:new Date().toISOString(),...body.payload};if(body.table==='fgi_ai_progress'){row.recorded_at=new Date().toISOString();list.push(row);syncWeight(row.user_id);}else list.push(row);found=[row];}}
   if(fault==='form_uncertain'&&body.table==='fgi_ai_progress'&&body.mutation)return res.end(JSON.stringify({data:null,error:{message:'fixture uncertain'}}));
   if(body.mutation==='update')found.forEach(x=>Object.assign(x,body.payload));
   for(const [k,asc]of body.orders.reverse())found.sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(asc?1:-1));
   if(body.limit)found=found.slice(0,body.limit);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:body.one?found[0]||null:found,error:null}));
  }
  if(req.url.startsWith('/api/')){if(req.method==='POST')requests.push(body);const r=body.action==='access'?result({modules:['training','nutrition'],friend:true,subscriptions:[],checkout_enabled:false}):await handle(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai',{method:req.method,headers:{Authorization:req.headers.authorization||'',Origin:'https://fitgoin.com','Content-Type':'application/json'},...(req.method==='POST'?{body:JSON.stringify(body)}:{})}));if(fault==='uncertain'&&body.message==='Сохрани адаптацию'){fault=null;res.writeHead(200,{'Content-Type':'application/json'});return res.end('{');}res.writeHead(r.status,{'Content-Type':'application/json'});return res.end(await r.text());}
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
   await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await open('progress');
   const analyze=async()=>{await open('progress');await page.locator('[data-ai-action=analyze-progress]').click();await ready();};
   await analyze();assert((await page.locator('[data-analysis-answer]').innerText()).includes('измерений веса нет'));assert.equal(await page.locator('[data-progress-proposal]').count(),0);assert.equal(rows.fgi_ai_plans.length,1);pass('empty history cannot fabricate measurements or an adaptation',width);
   const on=d=>new Date(Date.now()-d*86400000).toISOString().slice(0,10);
   rows.fgi_ai_progress.push(...[[27,85.6],[13,84.3],[0,83.5]].map(([days,weight_kg])=>({id:randomUUID(),user_id:OWNER,recorded_on:on(days),recorded_at:new Date().toISOString(),weight_kg,notes:''})));syncWeight(OWNER);
   const original=rows.fgi_ai_plans[0],originalDoc=structuredClone(original.document);
   rows.fgi_ai_workouts.push(...[1,4,7].map((days,i)=>({id:randomUUID(),user_id:OWNER,plan_id:original.id,revision:0,started_at:on(days)+'T09:00:00Z',completed_at:on(days)+'T10:00:00Z',data:{status:'completed',difficulty:9,workout:structuredClone(original.document.workouts[0]),sets:Array.from({length:3},()=>({exercise_id:'e1',exercise:'Жим штанги лёжа',reps:10,weight_kg:80,comment:''}))}})));
   await analyze();assert((await page.locator('[data-analysis-answer]').innerText()).includes('снизился на 2,1 кг'));assert((await page.locator('[data-analysis-answer]').innerText()).includes('интервал: 3'));assert.equal(await page.locator('[data-progress-proposal]').count(),1);assert.equal(original.document.workouts[0].exercises[0].sets,3);pass('actual dates, counts and heavy-session proposal leave the active program untouched',width);
   await page.reload();await open('progress');assert.equal(await page.locator('[data-progress-proposal]').count(),1);pass('private proposal survives reload without becoming a program',width);
   await page.locator('[data-ai-action=cancel-progress-edit]').click();await ready();assert.equal(rows.fgi_ai_plans.length,1);assert.equal(await page.locator('[data-progress-proposal]').count(),0);assert.deepEqual(original.document,originalDoc);pass('explicit refusal preserves the program and all actual exercise results',width);
   await analyze();const requestCount=rows.fgi_ai_messages.length;fault='commit';await page.locator('[data-ai-action=confirm-progress-edit]').click();await ready();await page.locator('[data-ai-status].error').waitFor();assert.equal(rows.fgi_ai_plans.length,1);assert.equal(rows.fgi_ai_messages.length,requestCount);fault=null;pass('confirmation API failure cannot falsely acknowledge a saved version',width);
   fault='uncertain';await page.locator('[data-ai-action=confirm-progress-edit]').click();await ready();await page.locator('[data-ai-status].error').waitFor();assert.equal(rows.fgi_ai_plans.length,2);await page.locator('[data-ai-action=refresh]').click();await ready();assert.equal(rows.fgi_ai_plans.length,2);pass('lost confirmation response is recovered from history without another program version',width);
   const next=rows.fgi_ai_plans.find(x=>x.kind==='training'&&x.status==='active');assert.equal(next.document.workouts[0].exercises[0].sets,2);assert.equal(next.document.workouts[0].exercises[1].sets,3);assert.equal(original.status,'archived');assert.deepEqual(original.document,originalDoc);assert.equal(next.supersedes_id,original.id);assert.equal(rows.fgi_ai_workouts[0].data.sets[0].weight_kg,80);pass('confirmed new version preserves the previous program, other exercises and journal',width);
   const body=requests.filter(x=>x.message==='Сохрани адаптацию').at(-1);const replay=await page.evaluate(async({body,owner})=>{const r=await fetch('/api/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer '+owner,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};},{body,owner:OWNER});assert.equal(replay.status,200);assert.equal(rows.fgi_ai_plans.length,2);pass('same confirmation nonce cannot create a duplicate program version',width);
   await page.reload();await open('today');assert((await page.locator('[data-active-program]').innerText()).includes('ВЕРСИЯ 2'));pass('reload loads the confirmed active version from saved rows',width);
   rows.fgi_ai_workouts.push(...[1,2].map(days=>({id:randomUUID(),user_id:OWNER,plan_id:next.id,revision:0,started_at:new Date(Date.now()-days*3600000).toISOString(),completed_at:new Date(Date.now()-days*3600000+1000).toISOString(),data:{status:'completed',difficulty:2,workout:structuredClone(next.document.workouts[0]),sets:Array.from({length:2},()=>({exercise_id:'e1',exercise:'Жим штанги лёжа',reps:10,weight_kg:80,comment:''}))}})));
   await analyze();assert.equal(await page.locator('[data-ai-progression-consent]').count(),1);await page.locator('[data-ai-action=confirm-progress-edit]').click();await ready();assert.equal(rows.fgi_ai_plans.length,2);assert((await page.locator('[data-ai-status]').innerText()).includes('Подтверди'));await page.locator('[data-ai-progression-consent]').check();await page.locator('[data-ai-action=confirm-progress-edit]').click();await ready();assert.equal(rows.fgi_ai_plans.length,3);assert.equal(rows.fgi_ai_plans.find(x=>x.status==='active'&&x.kind==='training').document.workouts[0].exercises[0].reps,'11');pass('light-session progression requires explicit technique/no-pain confirmation',width);
   fault='analysis';await analyze();await page.locator('[data-ai-status].error').waitFor();assert.equal(await page.locator('[data-analysis-answer]').count(),0);fault=null;pass('analysis RPC failure does not display a fabricated or stale report',width);
   await analyze();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('[data-ai-action=analyze-progress]').evaluate(x=>x.getBoundingClientRect().height>=44));if([390,1440].includes(width))await page.screenshot({path:path.join(out,'analysis-'+width+'.png'),fullPage:true});pass('progress analysis cards fit mobile and desktop viewports with usable controls',width);
   await page.evaluate(id=>window.account(id),OTHER);await open('progress');assert.equal(await page.locator('[data-progress-proposal]').count(),0);await analyze();assert((await page.locator('[data-analysis-answer]').innerText()).includes('интервал: 0'));assert(!(await page.locator('[data-analysis-answer]').innerText()).includes('2,1'));pass('account switch clears the previous report and proposal',width);
   await page.evaluate(()=>window.account(null));await page.locator('[data-ai-action=login]').waitFor();await page.evaluate(id=>window.account(id),OWNER);await open('today');assert((await page.locator('[data-active-program]').innerText()).includes('ВЕРСИЯ 3'));pass('logout and re-login restore the owner active version only',width);
   const active={id:randomUUID(),user_id:OWNER,revision:0,started_at:new Date().toISOString(),completed_at:null,data:{status:'active',workout:structuredClone(next.document.workouts[0]),sets:[]}};rows.fgi_ai_workouts.push(active);
   await chat('У меня сильная боль в груди, проанализируй мой прогресс');assert((await page.locator('.fgi-ai-message:not(.from-user)').last().innerText()).includes('срочная медицинская помощь'));assert.equal(rows.fgi_ai_profiles[0].data.needs_professional,true);assert.equal(rows.fgi_ai_plans.length,3);assert.equal(active.data.status,'stopped');assert.equal(active.data.stopped_for_pain,true);pass('dangerous symptoms stop the actual session and ordinary recommendations',width);
   fault='commit';await chat('У меня резкая одышка');assert((await page.locator('[data-ai-status]').innerText()).includes('срочная медицинская помощь'));assert((await page.locator('[data-ai-status]').innerText()).includes('не подтверждено'));pass('urgent advice remains visible during a Supabase save failure',width);fault=null;
   await page.evaluate(()=>sessionStorage.clear());await page.close();
  }
  assert.equal(providerCalls,0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'ui-acceptance.json'),JSON.stringify({date:new Date().toISOString(),environment:'local actual frontend and handler; isolated Auth/REST fixtures',passed:true,checks,providerCalls,errors},null,2));console.log('PASS '+checks.length+' checks; no provider calls or JS errors');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
