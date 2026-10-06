// Live acceptance: actual Supabase Auth/REST/RLS, Edge Function and OpenAI.
// Two temporary QA accounts must be provisioned and removed by the operator.
// Supply {accounts:[{id,email,password},...],database_error_only?:true} on stdin.
// At READY_DATABASE_CONFLICT, send CONTINUE, then poll the printed pending
// request with separate short SQL calls; update QA weight to 83 after claim.
// A separate SQL connection is required: shared HTTP proxy requests may queue.
// Never store credentials.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),readline=require('node:readline');
const {chromium}=require(process.env.FGI_AI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..'),base='https://ypbhcgcwkpiujcakvaji.supabase.co';
const key=fs.readFileSync(path.join(repo,'fitmatch.js'),'utf8').match(/key: '(sb_publishable_[^']+)'/)[1];
const checks=[],requests=[],times=new Map();let session,dbRace=false;
function check(name,details={}){checks.push({name,passed:true,...details});console.log('PASS '+name+(Object.keys(details).length?' '+JSON.stringify(details):''));}
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
window.db=supabase.createClient(${JSON.stringify(base)},${JSON.stringify(key)},{auth:{storageKey:'stage2a-live-auth'},global:{fetch:(url,init)=>{const u=new URL(url);return fetch('/supabase-proxy'+u.pathname+u.search,init)}}});let user=(await db.auth.getSession()).data.session?.user||null;
window.ai=mountFitGoInAI(document.getElementById('root'),{getDB:()=>db,getUser:()=>user,endpoint:location.origin+'/api/fitgoin-ai',sports:()=>['fitness'],matches:()=>[],navigate:()=>{},login:()=>{}});ai.setSession(user);
window.qaLogin=async credentials=>{const {data,error}=await db.auth.signInWithPassword(credentials);if(error)throw Error('QA login failed: '+JSON.stringify({status:error.status,code:error.code,message:error.message}));user=data.user;ai.setSession(user);return user.id};
window.qaLogout=async()=>{await db.auth.signOut();user=null;ai.setSession(null)};
</script></body></html>`;
(async()=>{
 const config=await credentials();assert.equal(config.accounts.length,2);const [a,b]=config.accounts;
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
   if(body.action==='chat')requests.push(entry);
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
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port+'/fixture';
 try{
  await page.goto(url);await page.waitForFunction(()=>window.qaLogin);
  const login=async account=>{assert.equal(await page.evaluate(c=>qaLogin(c),{email:account.email,password:account.password}),account.id);session=await page.evaluate(async()=> (await db.auth.getSession()).data.session);};
  const profile=async account=>{const r=await rest(session.access_token,'fgi_ai_profiles',{filter:'?user_id=eq.'+account.id});assert.equal(r.status,200);return r.data[0]};
  const ready=async()=>{try{await page.locator('[data-ai-form=chat] button[type=submit]:enabled').waitFor({timeout:45000})}catch(error){console.error('UI STATE '+(await page.locator('#root').innerText()).slice(0,2500));throw error}};
  const send=async(message,expect=200)=>{
   const recent=(times.get(session.user.id)||[]).filter(t=>Date.now()-t<61000);
   if(recent.length>=4){const wait=61050-(Date.now()-recent[0]);console.log('WAIT existing rate limit '+Math.ceil(wait/1000)+'s');await new Promise(r=>setTimeout(r,wait));}
   const list=(times.get(session.user.id)||[]).filter(t=>Date.now()-t<61000);list.push(Date.now());times.set(session.user.id,list);
   await ready();const count=requests.length;await page.locator('[data-ai-form=chat] [name=message]').fill(message);await page.locator('[data-ai-form=chat] button[type=submit]').click();
   const stop=Date.now()+75000;while((requests.length===count||!requests.at(-1).status)&&Date.now()<stop)await new Promise(r=>setTimeout(r,200));
   const entry=requests.at(-1);assert(entry&&requests.length===count+1,'one outbound request');assert.equal(entry.status,expect,JSON.stringify({message,error:entry.result?.error,field:entry.result?.memory_field,reason:entry.result?.memory_reason,status:entry.status}));
   await page.waitForFunction(()=>document.getElementById('root').getAttribute('aria-busy')==='false',{},{timeout:25000});
   console.log('CHAT '+JSON.stringify({message,status:entry.status,fields:entry.result?.memory_fields,answer:entry.result?.answer,error:entry.result?.error,elapsed_ms:entry.elapsed_ms}));return entry;
  };
  let p,r;
  if(!config.database_error_only){
  await login(a);await page.locator('[data-ai-form=memory-consent]').waitFor();assert.equal(await profile(a),undefined);
  await page.locator('[data-ai-form=memory-consent] [name=consent]').check();await page.locator('[data-ai-form=memory-consent] button').click();await ready();
  const fresh=await profile(a);assert.deepEqual(fresh.data,{language:'ru',response_style:'short'});check('new user consent creates no invented sports facts');
  const hello=await send('Привет! Давай познакомимся.');assert.equal(hello.result.memory_saved,false);assert.match(hello.result.answer,/цел|уров|опыт|подготов/i);check('new user receives short natural introduction');
  await send('Моя цель — набрать мышечную массу. Я новичок.');p=await profile(a);assert.equal(p.data.goal,'Набор мышечной массы');assert.equal(p.data.experience,'beginner');check('goal and level saved from ordinary chat');
  await send('Я могу тренироваться 3 раза в неделю, обычно по 45 минут. Тренируюсь дома.');p=await profile(a);assert.equal(p.data.days_per_week,3);assert.equal(p.data.minutes,45);assert.equal(p.data.setting,'home');check('frequency duration and location saved');
  await send('Из оборудования у меня гантели 5 кг и коврик. Ограничений и травм нет. Меня зовут Алексей. Мне 28 лет. Мой рост 180 см, вес 80 кг. Предпочитаю фитнес и плавание. Опыт тренировок: занимаюсь месяц.');p=await profile(a);
  for(const [k,v] of Object.entries({name:'Алексей',age:28,height_cm:180,weight_kg:80}))assert.equal(p.data[k],v);assert.match(p.data.equipment,/гантели/);assert.equal(p.data.restrictions,'');assert(p.data.memory_confirmed_fields.includes('restrictions'));assert(p.data.preferred_sports.length>=2);assert.match(p.data.training_experience,/месяц/);check('minimum introduction and optional sports facts really persisted');
  const update=await send('Мой вес сейчас 82 кг. Теперь я могу тренироваться 4 раза в неделю.');p=await profile(a);assert.equal(p.data.weight_kg,82);assert.equal(p.data.days_per_week,4);assert.equal(p.data.name,'Алексей');check('latest weight and frequency replace old values');
  const cached=await page.evaluate(async body=>{const s=(await db.auth.getSession()).data.session;const r=await fetch('/api/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}},update.body);
  assert.equal(cached.status,200);assert.equal(cached.data.answer,update.result.answer);assert.equal((await profile(a)).updated_at,p.updated_at);const pair=await rest(session.access_token,'fgi_ai_messages',{filter:'?request_id=eq.'+update.body.request_id});assert.equal(pair.data.length,2);check('same request retry neither regenerates nor duplicates memory/messages');
  await page.reload();await ready();assert.match(await page.locator('.ai-memory-summary').textContent(),/82/);assert.match(await page.locator('.ai-memory-summary').textContent(),/Алексей/);check('page refresh restores saved memory and history');
  await page.evaluate(()=>qaLogout());await login(a);await ready();check('fresh Auth login restores memory');
  await page.locator('[data-ai-action=menu]').click();await page.locator('[data-ai-action=new-chat]').click();await ready();assert.equal(await page.locator('.fgi-ai-message').count(),0);
  for(const [question,pattern] of [['Какая у меня цель?',/Набор мышечной массы/],['Сколько раз в неделю я тренируюсь?',/4 раз/],['Какой у меня сейчас вес?',/82 кг/],['Где я тренируюсь?',/Дома/],['Какое оборудование у меня есть?',/гантели/]]){const e=await send(question);assert.match(e.result.answer,pattern)}check('new conversation answers all five memory questions from database');
  await send('Я теперь тренируюсь в зале.');p=await profile(a);assert.equal(p.data.setting,'gym');assert.equal(p.data.equipment,'');assert(!p.data.memory_confirmed_fields.includes('equipment'));check('new location clears obsolete equipment instead of inventing gym inventory');
  await page.evaluate(()=>qaLogout());await login(b);await page.locator('[data-ai-form=memory-consent]').waitFor();
  const own=await rest(session.access_token,'fgi_ai_profiles',{method:'POST',body:{user_id:b.id,data:{goal:'Сила',weight_kg:70,language:'ru',response_style:'short'},consent_version:'2026-10-03',consented_at:new Date().toISOString()}});assert.equal(own.status,201);await page.reload();await ready();
  const partial=await send('Привет! Хочу познакомиться и заполнить недостающие данные.');assert(!/какая.*цел|какова.*цел|какой.*вес|сколько.*веш/i.test(partial.result.answer));assert.match(partial.result.answer,/уров|опыт|подготов|недел|минут|мест/i);assert(!partial.result.answer.includes('Алексей'));check('partial profile keeps known goal/weight and asks missing facts only');
  r=await rest(session.access_token,'fgi_ai_profiles',{filter:'?user_id=eq.'+a.id});assert.equal(r.status,200);assert.deepEqual(r.data,[]);check('second account cannot read first account memory');
  r=await rest(session.access_token,'fgi_ai_profiles',{method:'PATCH',filter:'?user_id=eq.'+a.id,body:{data:{weight_kg:999}}});assert.equal(r.status,200);assert.deepEqual(r.data,[]);check('second account cannot update first account memory');
  r=await rest(session.access_token,'fgi_ai_profiles',{method:'POST',body:{user_id:a.id,data:{},consent_version:'2026-10-03',consented_at:new Date().toISOString()}});assert.equal(r.status,403);check('second account cannot insert memory under another owner');
  r=await rest(session.access_token,'fgi_ai_profiles',{method:'PATCH',filter:'?user_id=eq.'+b.id,body:{user_id:a.id}});assert.equal(r.status,403);check('owner reassignment blocked by WITH CHECK');
  r=await rest(key,'fgi_ai_profiles');assert([401,403].includes(r.status)||Array.isArray(r.data)&&r.data.length===0);check('anonymous browser cannot read memory');
  r=await rest(session.access_token,'rpc/fgi_ai_complete',{method:'POST',body:{p_user:a.id,p_id:crypto.randomUUID(),p_conversation:update.body.conversation_id,p_consent:p.updated_at,p_input:'forged',p_output:'forged',p_citations:[],p_kind:null,p_document:null,p_result:{module:'training'}}});assert([401,403,404].includes(r.status));check('ordinary JWT cannot invoke privileged completion RPC',{status:r.status});
  const foreign=await page.evaluate(async id=>{const s=(await db.auth.getSession()).data.session;const r=await fetch('/api/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'chat',module:'training',request_id:crypto.randomUUID(),conversation_id:id,user_id:'e62a0000-0000-4000-8000-000000000001',message:'Какой у меня вес?'})});return {status:r.status,data:await r.json()}},update.body.conversation_id);assert.equal(foreign.status,403);assert.equal(foreign.data.error,'invalid_conversation');check('Edge Function verifies Auth owner despite forged user_id');
  await page.evaluate(()=>qaLogout());await login(a);await ready();p=await profile(a);assert.equal(p.data.weight_kg,82);check('denied foreign writes leave original memory intact');
  }else{await login(a);await ready();}
  const conflictMessage='Мой вес сейчас 86 кг. Объясни в десяти предложениях, как не ошибиться при измерении веса.';
  const beforeConflict=await page.locator('.fgi-ai-message.from-user:not(.ai-outgoing)').filter({hasText:conflictMessage}).count();
  dbRace=true;const failed=await send(conflictMessage,503);assert.equal(failed.result.error,'backend_unavailable');assert.equal(failed.result.answer,undefined);assert.equal(failed.result.memory_saved,undefined);p=await profile(a);assert.equal(p.data.weight_kg,83);
  r=await rest(session.access_token,'fgi_ai_messages',{filter:'?request_id=eq.'+failed.body.request_id});assert.deepEqual(r.data,[]);assert.equal(await page.locator('.fgi-ai-message.from-user:not(.ai-outgoing)').filter({hasText:conflictMessage}).count(),beforeConflict);check('real database version conflict rolls back reply and memory without false confirmation');
  await page.reload();await page.locator('[data-ai-action=retry-message]').waitFor();assert.match(await page.locator('.ai-memory-summary').textContent(),/83/);check('reload after database error shows actual persisted value');
  for(const table of ['fgi_ai_plans','fgi_ai_workouts','fgi_ai_food','fgi_ai_progress']){r=await rest(session.access_token,table,{filter:'?user_id=eq.'+a.id});assert.equal(r.status,200);assert.deepEqual(r.data,[])}check('Stage 2A creates no programs workouts food or progress');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);check('live mobile chat has no horizontal overflow',{width:390});assert.deepEqual(errors,[]);check('no browser JavaScript errors');
  if(process.env.FGI_AI_QA_OUT){fs.mkdirSync(process.env.FGI_AI_QA_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.FGI_AI_QA_OUT,'memory-mobile.png'),fullPage:true});fs.writeFileSync(path.join(process.env.FGI_AI_QA_OUT,'memory-live-results.json'),JSON.stringify({live:true,scope:config.database_error_only?'database-error-mobile':'full',checks,requests:requests.map(e=>({action:e.action,status:e.status,elapsed_ms:e.elapsed_ms,memory_fields:e.result?.memory_fields,error:e.result?.error}))},null,2));}
  console.log('LIVE COMPLETE '+checks.length+' checks');
 }finally{await page.evaluate(()=>qaLogout()).catch(()=>{});await browser.close();server.close();config.accounts.forEach(a=>a.password='');}
})().catch(error=>{console.error(error.message);process.exitCode=1});
