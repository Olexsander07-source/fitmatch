// Live acceptance: actual Supabase Auth/REST/RLS, Edge Function and OpenAI.
// Two temporary QA accounts must be provisioned and removed by the operator.
// Supply {accounts:[{id,email,password},...],database_error_only?:true,schedule_only?:true,boundary_only?:true} on stdin.
// At READY_DATABASE_CONFLICT, send CONTINUE, then poll the printed pending
// request with separate short SQL calls; update QA weight to 83 after claim.
// A separate SQL connection is required: shared HTTP proxy requests may queue.
// Never store credentials.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),readline=require('node:readline');
if(process.stdin.isTTY&&process.platform!=='win32')require('node:child_process').execFileSync('stty',['-echo'],{stdio:'inherit'});
const {chromium}=require(process.env.FGI_AI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..'),base='https://ypbhcgcwkpiujcakvaji.supabase.co';
const key=fs.readFileSync(path.join(repo,'fitmatch.js'),'utf8').match(/key: '(sb_publishable_[^']+)'/)[1];
const checks=[],requests=[],previousRequests=[],times=new Map();let session,dbRace=false,mode='core';
function saveEvidence(completed=false){if(!process.env.FGI_AI_QA_OUT)return;fs.mkdirSync(process.env.FGI_AI_QA_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.FGI_AI_QA_OUT,'program-live-'+mode+'.json'),JSON.stringify({live:true,completed,checks,requests:[...previousRequests,...requests.map(e=>({action:e.action,status:e.status,elapsed_ms:e.elapsed_ms,program_saved:e.result?.program_saved,program_id:e.result?.program_id,plan_id:e.result?.plan_id,error:e.result?.error,request_id:e.body.request_id}))]},null,2))}
function check(name,details={}){checks.push({name,passed:true,...details});console.log('PASS '+name+(Object.keys(details).length?' '+JSON.stringify(details):''));saveEvidence();}
async function rest(token,table,{method='GET',filter='',body}={}){
 const r=await fetch(base+'/rest/v1/'+table+filter,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data};
}
async function credentials(){const rl=readline.createInterface({input:process.stdin});console.log('READY: temporary QA credentials on stdin; values will not be logged.');const line=await new Promise(resolve=>rl.once('line',resolve));rl.close();return JSON.parse(line);}
async function continueDatabaseRace(id){
 const rl=readline.createInterface({input:process.stdin});console.log('READY_DATABASE_CONFLICT '+id);
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Database race handoff timed out')),50000);rl.once('line',line=>{clearTimeout(timer);line.trim()==='CONTINUE'?resolve():reject(Error('Invalid database race control'))})})}finally{rl.close()}
}
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fitgoin-ai.css"><link rel="stylesheet" href="/fitgoin-premium.css"></head><body><div id="root"></div><script src="/qa-sdk.js"></script><script type="module">
import {mountFitGoInAI} from '/fitgoin-ai.js';
window.db=supabase.createClient(${JSON.stringify(base)},${JSON.stringify(key)},{auth:{storageKey:'stage2b-live-auth'},global:{fetch:(url,init)=>{const u=new URL(url);return fetch('/supabase-proxy'+u.pathname+u.search,init)}}});let user=(await db.auth.getSession()).data.session?.user||null;
window.ai=mountFitGoInAI(document.getElementById('root'),{getDB:()=>db,getUser:()=>user,endpoint:location.origin+'/api/fitgoin-ai',sports:()=>['fitness'],matches:()=>[],navigate:()=>{},login:()=>{}});ai.setSession(user);
window.qaLogin=async credentials=>{const {data,error}=await db.auth.signInWithPassword(credentials);if(error)throw Error('QA login failed: '+JSON.stringify({status:error.status,code:error.code,message:error.message}));user=data.user;ai.setSession(user);return user.id};
window.qaLogout=async()=>{await db.auth.signOut();user=null;ai.setSession(null)};
</script></body></html>`;
(async()=>{
 const config=await credentials();assert.equal(config.accounts.length,2);const [a,b]=config.accounts;mode=config.stage2c_only?'stage2c':config.database_error_only?'error':config.schedule_only?'schedule':config.boundary_only?'boundary':'core';
 if(config.stage2c_resume&&process.env.FGI_AI_QA_OUT){const evidence=JSON.parse(fs.readFileSync(path.join(process.env.FGI_AI_QA_OUT,'program-live-stage2c.json'),'utf8'));assert(evidence.checks.length>=4);checks.push(...evidence.checks);previousRequests.push(...evidence.requests);}
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html)}
  if(req.url==='/qa-sdk.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(process.env.FGI_AI_QA_SDK))}
  if(req.url.startsWith('/supabase-proxy/')){
   let raw='';for await(const chunk of req)raw+=chunk;
   try{const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];const remote=await fetch(base+req.url.slice('/supabase-proxy'.length),{method:req.method,headers,body:raw||undefined});const text=await remote.text();res.writeHead(remote.status,{'Content-Type':remote.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(text)}catch{res.writeHead(502,{'Content-Type':'application/json'});res.end('{"error":"qa_rest_proxy_failed"}')}return;
  }
  if(req.url.startsWith('/api/')){
   let raw='';for await(const chunk of req)raw+=chunk;
   const body=raw?JSON.parse(raw):{},entry={action:body.action,body,started:Date.now()};
   if(['chat','training'].includes(body.action))requests.push(entry);
   try{
    if(dbRace&&body.action==='chat'){dbRace=false;await continueDatabaseRace(body.request_id);}
    const pending=fetch(base+'/functions/v1/'+req.url.split('/').at(-1),{method:req.method,headers:{Origin:'https://fitgoin.com',apikey:key,...(req.headers.authorization?{Authorization:req.headers.authorization}:{}),'Content-Type':'application/json'},body:raw||undefined,signal:AbortSignal.timeout(70000)});
    const remote=await pending,text=await remote.text();entry.status=remote.status;try{entry.result=JSON.parse(text)}catch{}entry.elapsed_ms=Date.now()-entry.started;
    if(body.action!=='chat')console.log('BACKEND '+JSON.stringify({action:body.action||req.method,status:remote.status,configured:entry.result?.configured,elapsed_ms:entry.elapsed_ms}));
    res.writeHead(remote.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(text);
   }catch{entry.status=502;entry.result={error:'qa_proxy_failed'};res.writeHead(502,{'Content-Type':'application/json'});res.end('{"error":"qa_proxy_failed"}')}return;
  }
  const file=path.resolve(repo,'.'+req.url.split('?')[0]);if(!file.startsWith(repo+path.sep)){res.writeHead(403);return res.end()}
  try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.FGI_AI_CHROME,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Paris'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port+'/fixture';
 try{
  await page.goto(url);await page.waitForFunction(()=>window.qaLogin);
  const login=async account=>{assert.equal(await page.evaluate(c=>qaLogin(c),{email:account.email,password:account.password}),account.id);session=await page.evaluate(async()=> (await db.auth.getSession()).data.session);};
  const profile=async account=>{const r=await rest(session.access_token,'fgi_ai_profiles',{filter:'?user_id=eq.'+account.id});assert.equal(r.status,200);return r.data[0]};
  const ready=async()=>{await page.waitForFunction(()=>document.getElementById('root').getAttribute('aria-busy')==='false',null,{timeout:45000});if(!await page.locator('[data-ai-form=chat]').count()){const link=page.locator('[data-ai-action=view-ask]');if(await link.count())await link.first().click();else{await page.locator('[data-ai-action=menu]').click();await page.locator('[data-ai-view=ask]').click();}}if(await page.locator('.fgi-ai-shell.drawer-open').count())await page.locator('.ai-sidebar-close').click();try{await page.locator('[data-ai-form=chat] button[type=submit]:enabled').waitFor({timeout:45000})}catch(error){console.error('UI STATE '+(await page.locator('#root').innerText()).slice(0,2500));throw error}};
  const send=async(message,expect=200,selector=null)=>{
   const recent=(times.get(session.user.id)||[]).filter(t=>Date.now()-t<61000);
   if(recent.length>=4){const wait=61050-(Date.now()-recent[0]);console.log('WAIT existing rate limit '+Math.ceil(wait/1000)+'s');await new Promise(r=>setTimeout(r,wait));}
   const list=(times.get(session.user.id)||[]).filter(t=>Date.now()-t<61000);list.push(Date.now());times.set(session.user.id,list);
   await ready();const count=requests.length;if(selector)await page.locator(selector).first().click();else{await page.locator('[data-ai-form=chat] [name=message]').fill(message);await page.locator('[data-ai-form=chat] button[type=submit]').click();}
   const stop=Date.now()+75000;while((requests.length===count||!requests.at(-1).status)&&Date.now()<stop)await new Promise(r=>setTimeout(r,200));
   const entry=requests.at(-1);assert(entry&&requests.length===count+1,'one outbound request');assert.equal(entry.status,expect,JSON.stringify({message,error:entry.result?.error,program_rule:entry.result?.program_rule,field:entry.result?.memory_field,reason:entry.result?.memory_reason,status:entry.status}));
   try{await page.waitForFunction(()=>document.getElementById('root').getAttribute('aria-busy')==='false',{},{timeout:65000})}catch(error){console.error('UI AFTER RESPONSE '+(await page.locator('#root').innerText()).slice(0,2500));saveEvidence();throw error;}
   console.log('CHAT '+JSON.stringify({message,status:entry.status,fields:entry.result?.memory_fields,answer:entry.result?.answer,error:entry.result?.error,elapsed_ms:entry.elapsed_ms}));return entry;
  };

  let p,r,first;
  const programs=async()=>{const r=await rest(session.access_token,'fgi_ai_plans',{filter:'?kind=eq.training&order=created_at.desc'});assert.equal(r.status,200);return r.data};
  const current=async()=>{const rows=await programs();assert.equal(rows.filter(x=>x.status==='active').length,1);return rows.find(x=>x.status==='active')};
  await login(a);
  await page.locator('[data-ai-form=memory-consent], [data-ai-form=chat]').first().waitFor({timeout:45000});
  if(config.stage2c_only&&!await page.locator('[data-ai-form=chat]').count()){
   await page.locator('[data-ai-form=memory-consent] [name=consent]').check();await page.locator('[data-ai-form=memory-consent] button[type=submit]').click();
  }
  await ready();
  if(!config.stage2c_only&&!config.database_error_only&&!config.schedule_only&&!config.boundary_only){
   p=await profile(a);assert.equal(p.data.goal,'Набор мышечной массы');assert.equal(p.data.weight_kg,81);assert.equal(p.data.age,undefined);check('2A memory loaded in authenticated mobile browser');
   const created=await send('Составь мне программу');assert.equal(created.result.program_saved,true);assert.equal(created.result.kind,'training');first=await current();
   assert.equal(first.id,created.result.plan_id);assert.equal(first.revision,1);assert.equal(first.profile_snapshot.goal,p.data.goal);assert.equal(first.profile_snapshot.equipment,p.data.equipment);assert.equal(first.document.workouts.length,3);assert.equal(first.document.schedule.mode,'sequence');
   assert(first.document.workouts.every(w=>w.id&&w.objective&&w.minutes<=35&&w.exercises.every(e=>e.id&&e.technique&&e.alternative&&e.required_equipment)));
   check('full sports memory produces a real structured persisted personalized program',{plan_id:first.id,workouts:3,revision:first.revision});
   assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),first.id);assert.equal(await page.locator('[data-program-workout]').count(),3);assert(await page.locator('.ai-program-exercises h4').count()>=3);check('mobile program displays structured exercise cards and instructions');
   for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);if(process.env.FGI_AI_QA_OUT){fs.mkdirSync(process.env.FGI_AI_QA_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.FGI_AI_QA_OUT,'program-'+width+'.png'),fullPage:true})}}check('program has no horizontal overflow at four viewport widths');
   await page.setViewportSize({width:390,height:844});await page.reload();await ready();assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),first.id);check('reload restores the same saved active program');
   await page.evaluate(()=>qaLogout());await login(a);await ready();const show=await send('Покажи мою программу');assert.equal(show.result.program_id,first.id);assert.equal(show.result.kind,null);assert.equal((await programs()).length,1);assert.equal(await page.locator('.ai-program-details').getAttribute('open'),'');check('fresh sign-in and show query read the database without regenerating');
   const tomorrow=await send('Что я тренирую завтра?');assert.equal(tomorrow.result.program_id,first.id);assert.match(tomorrow.result.answer,/не могу однозначно/);check('unknown schedule never invents tomorrow');
   const replay=await page.evaluate(async body=>{const s=(await db.auth.getSession()).data.session;const r=await fetch('/api/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}},created.body);assert.equal(replay.status,200);assert.equal(replay.data.plan_id,first.id);assert.equal((await programs()).length,1);check('creation retry returns original program and creates no duplicate');
   await page.evaluate(()=>qaLogout());await login(b);await page.locator('[data-ai-form=memory-consent]').waitFor();
   for(const method of ['GET','PATCH','DELETE']){r=await rest(session.access_token,'fgi_ai_plans',{method,filter:'?id=eq.'+first.id,...(method==='PATCH'?{body:{title:'forged'}}:{})});if(method==='PATCH')assert([401,403].includes(r.status)||Array.isArray(r.data)&&r.data.length===0);else{assert.equal(r.status,200);assert.deepEqual(r.data,[])}}check('second JWT cannot read update or delete first program');
   r=await rest(session.access_token,'rpc/fgi_ai_complete',{method:'POST',body:{p_user:a.id,p_id:crypto.randomUUID(),p_conversation:created.body.conversation_id,p_consent:p.updated_at,p_input:'forged',p_output:'forged',p_citations:[],p_kind:'training',p_document:first.document,p_result:{module:'training',plan_id:crypto.randomUUID()}}});assert([401,403,404].includes(r.status));check('ordinary browser JWT cannot forge a server program');
   const partial={goal:'Выносливость',experience:'intermediate',days_per_week:2,minutes:25,setting:'outdoor',language:'ru',response_style:'short'};
   r=await rest(session.access_token,'fgi_ai_profiles',{method:'POST',body:{user_id:b.id,data:partial,consent_version:'2026-10-03'}});assert.equal(r.status,201);await page.reload();await ready();
   const incomplete=await send('Создай программу тренировок');assert.equal(incomplete.result.program_pending,true);assert.deepEqual(incomplete.result.missing_fields,['equipment','restrictions']);assert.equal((await programs()).length,0);assert(!/какая.*цел|какой.*уров|сколько.*недел|сколько.*минут/i.test(incomplete.result.answer));check('intake asks only missing equipment and restrictions; no premature program saved');
   await page.reload();await ready();assert.equal((await profile(b)).data.program_pending,true);const finished=await send('У меня нет оборудования. Ограничений и травм нет.');assert.equal(finished.result.program_saved,true);const second=await current();assert.equal(second.document.workouts.length,2);assert.equal(second.profile_snapshot.equipment,'Без оборудования');assert.equal(second.profile_snapshot.goal,'Выносливость');assert.equal(second.profile_snapshot.setting,'outdoor');assert.notDeepEqual(second.document.workouts,first.document.workouts);check('answer completes durable intake and creates a different personalized program');
   r=await rest(session.access_token,'fgi_ai_plans',{filter:'?user_id=eq.'+a.id});assert.deepEqual(r.data,[]);check('program isolation still holds after second account creates its own');
   await page.evaluate(()=>qaLogout());await login(a);await ready();assert.equal((await current()).id,first.id);check('denied foreign writes preserve first active program');
  }
  if(config.stage2c_only){
   let active,before,answer;
   if(!config.stage2c_tail){
   if(!config.stage2c_resume){
   assert.equal((await programs()).length,0);assert.equal((await profile(a)).data.goal,undefined);
   const intake=await send('Составь мне программу');assert.equal(intake.result.program_pending,true);assert(intake.result.missing_fields.includes('goal'));assert.equal((await programs()).length,0);check('new user starts with genuine missing data and no fabricated program');
   const created=await send('Хочу набрать мышечную массу. Я новичок, занимаюсь месяц. Могу тренироваться 4 раза в неделю по 35 минут дома. У меня есть штанга, гантели 5 кг, скамья и коврик. Ограничений и травм нет.');
   assert.equal(created.result.program_saved,true);active=await current();assert.equal(active.document.workouts.length,4);assert.equal((await profile(a)).data.goal,'Набор мышечной массы');check('conversation fills new-user memory and actually creates and saves a personalized program',{plan_id:active.id});
   await page.reload();await ready();assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),active.id);
   await page.evaluate(()=>qaLogout());await login(a);await ready();const show=await send('Покажи мою программу');assert.equal(show.result.program_id,active.id);check('memory and the exact active program survive reload and fresh sign-in');
   before=active;answer=await send('Теперь могу тренироваться только 3 раза в неделю.');assert.equal(answer.result.program_saved,true);active=await current();assert.equal(active.document.workouts.length,3);assert.equal((await profile(a)).data.days_per_week,3);assert.equal((await programs()).find(p=>p.id===before.id).status,'archived');check('spoken frequency change saves memory and an adapted active version, retaining the old version');
   }else{active=await current();assert.equal(active.document.workouts.length,3);assert.equal((await profile(a)).data.days_per_week,3);}
   before=active;answer=await send('Теперь только понедельник, среда и пятница');assert.equal(answer.result.program_saved,true);active=await current();assert.deepEqual(active.document.schedule.weekdays,[1,3,5]);assert.deepEqual((await profile(a)).data.weekdays,[1,3,5]);assert.deepEqual(active.document.workouts.map(w=>({...w,day:-1})),before.document.workouts.map(w=>({...w,day:-1})));check('weekday-only edit preserves every workout and exercise while saving the schedule');
   for(const query of ['Что сегодня тренируем?','Что я тренирую завтра?']){answer=await send(query);assert.equal(answer.result.program_id,active.id);assert.equal(answer.result.kind,null);assert.equal((await current()).id,active.id);}check('today and tomorrow use the real stored schedule without a new program');
   answer=await send('Начинаем тренировку');if(!answer.result.current_workout){assert(answer.result.workout_choices?.length||/отдых/.test(answer.result.answer));answer=await send('Начать из карточки',200,'[data-ai-action=start-workout]');}
   let state=(await profile(a)).data.current_workout;assert.equal(state.plan_id,active.id);assert(await page.locator('[data-current-workout]').isVisible());const workout=active.document.workouts.find(w=>w.id===state.workout_id);assert.equal(await page.locator('[data-current-exercise]').count(),workout.exercises.length);check('start command and existing program button open a mobile workout inside the same chat');
   answer=await send('Сколько отдыхать?',200,'[data-ai-action=simple-rest]');assert(answer.result.answer.includes(String(workout.exercises[state.index].rest_seconds))||workout.exercises[state.index].rest_seconds===0);
   answer=await send('Как правильно делать это упражнение?',200,'[data-ai-action=simple-technique]');assert(answer.result.answer.includes(workout.exercises[state.index].technique));
   answer=await send('Что дальше?',200,'[data-ai-action=simple-next]');assert.equal((await profile(a)).data.current_workout.index,1);check('rest, technique and next use the actual current exercise, with no invented set completion');
   before=active;state=(await profile(a)).data.current_workout;let target=before.document.workouts.find(w=>w.id===state.workout_id).exercises[state.index];
   const targetButton=`[data-current-exercise="${target.id}"] [data-ai-action=simple-replace]`;answer=await send('Замена выбранного упражнения',200,targetButton);assert.equal(answer.result.program_saved,true);active=await current();const replaced=active.document.workouts.find(w=>w.id===state.workout_id).exercises[state.index];assert.equal(replaced.id,target.id);assert.notEqual(replaced.name,target.name);
   for(const w of before.document.workouts){const n=active.document.workouts.find(n=>n.id===w.id);for(const e of w.exercises)if(e.id!==target.id)assert.deepEqual(n.exercises.find(x=>x.id===e.id),e);}assert.equal((await profile(a)).data.current_workout.plan_id,active.id);check('replacement button changes only the selected exercise and carries the cursor to the saved version',{from:target.name,to:replaced.name});
   before=active;answer=await send('Чем заменить это упражнение?');assert.equal(answer.result.program_edit_pending.mode,'proposal');assert.equal((await current()).id,before.id);await page.reload();await ready();assert(await page.locator('[data-edit-proposal]').isVisible());answer=await send('Сохрани замену',200,'[data-ai-action=confirm-edit]');assert.equal(answer.result.program_saved,true);active=await current();assert.notEqual(active.id,before.id);assert.equal((await profile(a)).data.program_edit_pending,null);check('suggested replacement persists after reload but activates only after successful confirmation');
   before=active;const dependent=before.document.workouts.flatMap(w=>w.exercises.filter(e=>/штанг|barbell/i.test(e.required_equipment)).map(e=>e.id));answer=await send('У меня нет штанги');assert.equal(answer.result.program_saved,true);active=await current();p=await profile(a);assert(!/штанг/i.test(p.data.equipment));assert(p.data.unavailable_equipment.includes('Штанга'));assert(active.document.workouts.every(w=>w.exercises.every(e=>!/штанг|barbell/i.test(e.required_equipment))));
   for(const w of before.document.workouts)for(const e of w.exercises)if(!dependent.includes(e.id))assert.deepEqual(active.document.workouts.find(n=>n.id===w.id).exercises.find(n=>n.id===e.id),e);check('barbell denial updates inventory and replaces only dependent saved exercises',{dependent_exercises:dependent.length});
   const squat=active.document.workouts.flatMap(w=>w.exercises.filter(e=>/присед/i.test(e.name)).map(e=>({w,e})));
   answer=await send('Замени приседания');if(squat.length>1){assert.equal(answer.result.program_edit_pending.mode,'select');answer=await send('В тренировке '+squat[0].w.number);assert.equal(answer.result.program_saved,true);}else if(squat.length===1)assert.equal(answer.result.program_saved,true);else assert.equal(answer.result.program_saved,undefined);active=await current();check('squat request changes an actual saved target or asks for selection, never inventing one',{saved_squat_targets:squat.length});
   before=active;answer=await send('Я теперь хожу в зал');assert.equal(answer.result.program_saved,undefined);assert.equal(answer.result.program_pending,true);assert.deepEqual(answer.result.missing_fields,['equipment']);assert.equal((await current()).id,before.id);assert.equal((await profile(a)).data.setting,'gym');check('new gym setting clears unknown equipment and preserves the old program until clarification');
   answer=await send('В зале есть гантели 5 кг, скамья и коврик.');assert.equal(answer.result.program_saved,true);active=await current();assert.equal(active.profile_snapshot.setting,'gym');assert(!active.document.workouts.some(w=>w.exercises.some(e=>/штанг/i.test(e.required_equipment))));check('explicit gym inventory completes adaptation with a genuinely saved active version');
   answer=await send('Я могу тренироваться 4 раза в неделю');assert.equal(answer.result.program_saved,true);active=await current();assert.equal(active.document.workouts.length,4);assert.equal((await profile(a)).data.days_per_week,4);assert.equal(active.document.schedule.mode,'sequence');check('four-day change creates four real workouts and invalidates the incompatible three-day schedule');
   answer=await send('Какая у меня цель?');assert.match(answer.result.answer,/мышечн/);check('goal answer uses saved personal memory');
   for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(process.env.FGI_AI_QA_OUT)await page.screenshot({path:path.join(process.env.FGI_AI_QA_OUT,'stage2c-'+width+'.png'),fullPage:true});}await page.setViewportSize({width:390,height:844});check('real saved program and workout UI fit four screen widths');
   await page.evaluate(()=>qaLogout());await login(b);await page.locator('[data-ai-form=memory-consent]').waitFor();
   for(const table of ['fgi_ai_profiles','fgi_ai_plans']){r=await rest(session.access_token,table,{filter:'?user_id=eq.'+a.id});assert.equal(r.status,200);assert.deepEqual(r.data,[]);r=await rest(session.access_token,table,{method:'PATCH',filter:'?user_id=eq.'+a.id,body:table==='fgi_ai_plans'?{title:'forged'}:{data:{goal:'forged'}}});assert([401,403].includes(r.status)||Array.isArray(r.data)&&r.data.length===0);r=await rest(session.access_token,table,{method:'DELETE',filter:'?user_id=eq.'+a.id});assert.equal(r.status,200);assert.deepEqual(r.data,[]);}check('second real JWT cannot read modify or delete the first memory, cursor, proposal or program');
   r=await rest(session.access_token,'rpc/fgi_ai_complete',{method:'POST',body:{p_user:a.id,p_id:crypto.randomUUID(),p_conversation:requests[0].body.conversation_id,p_consent:new Date().toISOString(),p_input:'forged',p_output:'forged',p_citations:[],p_kind:'training',p_document:active.document,p_result:{module:'training',plan_id:crypto.randomUUID()}}});assert([401,403,404].includes(r.status));check('manual Supabase API cannot call privileged program completion');
   }else{active=await current();assert.equal(active.document.workouts.length,4);if(!config.stage2c_database_only){await page.evaluate(()=>qaLogout());await login(b);await page.locator('[data-ai-form=memory-consent], [data-ai-form=chat]').first().waitFor({timeout:45000});}}
   if(!config.stage2c_database_only){
   if(await page.locator('[data-ai-form=memory-consent]').count()){await page.locator('[data-ai-form=memory-consent] [name=consent]').check();await page.locator('[data-ai-form=memory-consent] button[type=submit]').click();}await ready();answer=await send('Покажи мою программу');assert.equal(answer.result.program_view,false);assert.equal((await programs()).length,0);check('second account sees its own empty program instead of the first account data');
   await page.evaluate(()=>qaLogout());await login(a);await ready();assert.equal((await current()).id,active.id);
   }before=active;const beforeCount=(await programs()).length;dbRace=true;
   const failed=await send(config.failure_message||'Теперь могу тренироваться только 3 раза в неделю',503);assert.equal(failed.result.error,'backend_unavailable');assert.equal(failed.result.program_saved,undefined);assert.equal(failed.result.memory_saved,undefined);assert.equal(failed.result.answer,undefined);assert.equal((await current()).id,before.id);assert.equal((await programs()).length,beforeCount);assert.equal((await profile(a)).data.days_per_week,4);assert.deepEqual((await rest(session.access_token,'fgi_ai_messages',{filter:'?request_id=eq.'+failed.body.request_id})).data,[]);check('real concurrent database change rejects stale memory and program atomically, with no false success');
   await page.reload();await page.locator('[data-ai-action=retry-message]').waitFor();assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),before.id);check('old active program remains visible after a failed adaptation and reload');
  }
  if(config.database_error_only){
   const before=await current(),beforeCount=(await programs()).length;dbRace=true;const failed=await send('Создай программу тренировок',503);assert.equal(failed.result.error,'backend_unavailable');assert.equal(failed.result.answer,undefined);assert.equal(failed.result.program_saved,undefined);
   assert.equal((await current()).id,before.id);assert.equal((await programs()).length,beforeCount);r=await rest(session.access_token,'fgi_ai_messages',{filter:'?request_id=eq.'+failed.body.request_id});assert.deepEqual(r.data,[]);check('actual database conflict returns no save confirmation and retains previous program',{active_id:before.id,versions:beforeCount});
   await page.reload();await page.locator('[data-ai-action=retry-message]').waitFor();assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),before.id);check('reload after failed replacement retains old program and delivery controls');
  }
  if(config.schedule_only){
   const before=await current(),savedProfile=await profile(a),data={...savedProfile.data,weekdays:[1,3,5]};
   r=await rest(session.access_token,'fgi_ai_profiles',{method:'PATCH',filter:'?user_id=eq.'+a.id,body:{data}});assert.equal(r.status,200);await page.reload();await ready();
   const replacement=await send('Обнови программу тренировок');assert.equal(replacement.result.program_saved,true);const next=await current(),versions=await programs();assert.notEqual(next.id,before.id);assert.equal(next.revision,before.revision+1);assert.equal(next.supersedes_id,before.id);assert.equal(versions.find(x=>x.id===before.id).status,'archived');assert.equal(next.document.schedule.mode,'weekdays');assert.deepEqual(next.document.schedule.weekdays,[1,3,5]);
   check('successful real replacement archives prior program and activates the next revision',{revision:next.revision,previous_id:before.id,active_id:next.id});
   for(const [query,offset] of [['Что я тренирую сегодня?',0],['Что я тренирую завтра?',1]]){
    const answer=await send(query),date=await page.evaluate(offset=>{const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));const day=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day+offset));return {iso:day.toISOString().slice(0,10),weekday:day.getUTCDay()}},offset),workout=next.document.workouts.find(x=>x.day===date.weekday);
    assert.equal(answer.result.program_id,next.id);assert(answer.result.answer.includes(date.iso));assert(workout?answer.result.answer.includes(workout.title):answer.result.answer.includes('тренировки нет'));assert.equal((await programs()).length,versions.length);check('saved schedule answers '+(offset?'tomorrow':'today')+' without regenerating',{date:date.iso,scheduled:Boolean(workout)});
   }
   await page.reload();await ready();assert.equal((await current()).id,next.id);assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),next.id);check('replacement remains active after reload');
  }
  if(config.boundary_only){
   const created=await send('Что мне лучше тренировать?');assert.equal(created.result.program_saved,true);const saved=await current();assert.equal(saved.id,created.result.plan_id);check('what should I train creates an actual saved personal program');
   p=await profile(a);const partial={...p.data,program_pending:true};delete partial.equipment;r=await rest(session.access_token,'fgi_ai_profiles',{method:'PATCH',filter:'?user_id=eq.'+a.id,body:{data:partial}});assert.equal(r.status,200);await page.reload();await ready();await page.locator('[data-ai-module]').selectOption('nutrition');
   const otherModule=await send('Расскажи об общих принципах восстановления.');assert.equal(otherModule.result.kind,null);assert.equal(otherModule.result.program_saved,undefined);assert.equal(otherModule.result.program_pending,undefined);assert.equal((await programs()).length,1);assert.equal((await profile(a)).data.program_pending,true);check('pending training intake cannot intercept the other AI module');
   p=await profile(a);r=await rest(session.access_token,'fgi_ai_profiles',{method:'PATCH',filter:'?user_id=eq.'+a.id,body:{data:{...p.data,equipment:saved.profile_snapshot.equipment,needs_professional:true}}});assert.equal(r.status,200);await page.reload();await ready();await page.locator('[data-ai-module]').selectOption('training');
   const review=await send('Покажи мою программу');assert.equal(review.result.program_id,saved.id);assert.match(review.result.answer,/пересмотреть/);assert.match(await page.locator('[data-active-program]').innerText(),/Спортивные данные изменились/);assert.equal((await programs()).length,1);check('new professional-review flag warns in saved answer and mobile UI without replacing the program');
  }
  assert.deepEqual(errors,[]);check('no browser JavaScript errors');
  saveEvidence(true);
  console.log('LIVE COMPLETE '+checks.length+' checks');
 }catch(error){
  if(process.env.FGI_AI_QA_OUT){fs.mkdirSync(process.env.FGI_AI_QA_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.FGI_AI_QA_OUT,'failure-'+mode+'.png'),fullPage:true}).catch(()=>{});}
  console.error('FAILURE UI '+JSON.stringify(await page.evaluate(()=>({width:innerWidth,scrollX,scrollY,shell:document.querySelector('.fgi-ai-shell')?.className,side:document.querySelector('.fgi-ai-sidebar')?{visibility:getComputedStyle(document.querySelector('.fgi-ai-sidebar')).visibility,transform:getComputedStyle(document.querySelector('.fgi-ai-sidebar')).transform,box:document.querySelector('.fgi-ai-sidebar').getBoundingClientRect().toJSON()}:null})).catch(()=>({}))));saveEvidence();throw error;
 }finally{await page.evaluate(()=>qaLogout()).catch(()=>{});await browser.close();server.close();config.accounts.forEach(a=>a.password='');}
})().catch(error=>{console.error(error.message);process.exitCode=1});
