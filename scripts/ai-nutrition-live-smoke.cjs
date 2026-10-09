// Real production Auth/REST/Edge/UI acceptance. Only synthetic, temporary QA
// accounts are used; passwords arrive on stdin and are never written to evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
if(process.stdin.isTTY&&process.platform!=='win32')require('node:child_process').execFileSync('stty',['-echo'],{stdio:'inherit'});
const {chromium}=require(process.env.FGI_PLAYWRIGHT_MODULE||'playwright-core');
let redactError=value=>String(value);
async function input(){const rl=readline.createInterface({input:process.stdin});console.log('READY: ephemeral QA credentials on stdin, never logged.');const line=await new Promise(r=>rl.once('line',r));rl.close();return JSON.parse(line);}
(async()=>{
 const {owner,other,program_id}=await input(),base='https://fitgoin.com/',api='https://ypbhcgcwkpiujcakvaji.supabase.co',checks=[],trace=[],errors=[],failures=[],loaded=new Set();
 const key=fs.readFileSync(path.join(__dirname,'..','fitmatch.js'),'utf8').match(/key: '(sb_publishable_[^']+)'/)[1],proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
 redactError=value=>[owner,other].reduce((s,a)=>s.replaceAll(a.password,'[redacted]').replaceAll(a.email,'[QA email]'),String(value)).replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted token]');
 const browser=await chromium.launch({headless:true,executablePath:process.env.FGI_CHROME,args:process.platform==='win32'?[]:['--no-sandbox'],...(proxy?{proxy:{server:new URL(proxy).origin}}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Paris',ignoreHTTPSErrors:Boolean(proxy)}),page=await context.newPage();
 page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>{if(r.url().startsWith(base))failures.push({url:r.url(),error:r.failure()?.errorText})});
 page.on('response',r=>{if(r.url().startsWith(base)){if(r.status()>=400)failures.push({url:r.url(),status:r.status()});else loaded.add(new URL(r.url()).pathname)}});
 const pass=(name,extra={})=>{checks.push({name,passed:true,...extra});console.log('PASS '+name)};
 const ready=async()=>{await page.waitForFunction(()=>document.getElementById('fitgoinAI')?.getAttribute('aria-busy')==='false');await page.locator('#fitgoinAI [data-ai-form=chat] button[type=submit]:enabled').waitFor();};
 const command=async message=>{
  await ready();const response=page.waitForResponse(r=>r.url().startsWith(api+'/functions/v1/fitgoin-ai')&&r.request().method()==='POST'&&JSON.parse(r.request().postData()||'{}').action==='chat');
  await page.locator('#fitgoinAI [name=message]').fill(message);await page.locator('#fitgoinAI [data-ai-form=chat] button[type=submit]').click();
  const r=await response,data=await r.json();trace.push({message,status:r.status(),answer:data.answer||null,nutrition_estimate:data.nutrition_estimate||null,memory_saved:data.memory_saved||false,missing_fields:data.missing_fields||[],error:data.error||null});
  assert.equal(r.status(),200,JSON.stringify({status:r.status(),error:data.error}));await ready();return data;
 };
 const profile=()=>page.evaluate(async({key,api})=>{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');const db=createClient(api,key);const {data,error}=await db.from('fgi_ai_profiles').select('data').single();if(error)throw Error('Own profile read failed');return data.data;},{key,api});
 try{
  await page.goto(base+'?stage3a_verify='+Date.now());await page.waitForFunction(()=>typeof document.getElementById('authOpen')?.onclick==='function');
  const cookies=page.locator('#cookieBanner [data-cookie-choice=necessary]');if(await cookies.isVisible())await cookies.click();
  await page.locator('#authOpen').click();await page.locator('#authDialog[open]').waitFor();
  await page.locator('#authForm [name=email]').fill(owner.email);await page.locator('#authForm [name=password]').fill(owner.password);await page.locator('#authForm button[type=submit]').click();
  await page.locator('#authDialog').waitFor({state:'hidden'});await page.goto(base+'#ai');await page.locator('#ai.active').waitFor();await ready();
  await page.locator('#fitgoinAI [data-ai-module]').selectOption('nutrition');await ready();
  const calculated=await command('Рассчитай мои калории и БЖУ'),estimate=calculated.nutrition_estimate;
  assert(estimate);assert.equal(calculated.kind,null);assert.equal(estimate.inputs.age,28);assert.equal(estimate.inputs.height_cm,180);assert.equal(estimate.inputs.weight_kg,80);assert.equal(estimate.inputs.activity,'light');assert.equal(estimate.inputs.days_per_week,3);assert.equal(estimate.inputs.program_id,program_id);assert.equal(estimate.inputs.planned_workouts,3);assert.equal(estimate.goal,'loss');assert.equal(estimate.meals,undefined);assert.match(calculated.answer,/приблизительн/);pass('real calculation uses own saved measurements, goal, activity, frequency and active program', {estimate});
  const saved=await command('Я не ем рыбу');assert.equal(saved.memory_saved,true);assert.deepEqual((await profile()).nutrition_preferences.excluded_foods,['рыба']);pass('explicit fish exclusion is confirmed only after a durable save');
  await command('Я не ем свинину. Мои пищевые предпочтения: растительная пища. Мои пищевые ограничения: без молока. Я предпочитаю 4 приема пищи в день');
  const prefs=await profile();assert.deepEqual(prefs.nutrition_preferences.excluded_foods,['рыба','свинина']);assert.equal(prefs.nutrition_preferences.restrictions,'без молока');assert.equal(prefs.nutrition_preferences.meals_per_day,4);assert.equal(prefs.diet,'растительная пища');pass('restrictions, meal count and preferences share existing private memory');
  await page.reload();await ready();await page.locator('#fitgoinAI [data-ai-module]').selectOption('nutrition');await ready();
  assert.deepEqual((await profile()).nutrition_preferences,prefs.nutrition_preferences);const remembered=await command('Что я не ем?');assert.match(remembered.answer,/рыба/);assert.match(remembered.answer,/свинина/);assert.match(remembered.answer,/растительная пища/);pass('reload and actual chat restore durable food memory');
  await command('Сегодня я не ем мясо');assert.deepEqual((await profile()).nutrition_preferences,prefs.nutrition_preferences);pass('a one-day food choice does not overwrite durable preferences');
  await command('Я снова ем рыбу');assert.deepEqual((await profile()).nutrition_preferences.excluded_foods,['свинина']);pass('explicit correction removes only the corrected excluded food');
  const calories={loss:estimate.calories};
  for(const [goal,label] of [['gain','набор мышечной массы'],['maintain','поддержание веса'],['performance','улучшение спортивной формы']]){
   const result=await command('Моя цель в питании — '+label+'. Рассчитай мои калории и БЖУ');assert.equal(result.nutrition_estimate.goal,goal);assert.deepEqual(result.nutrition_estimate.preferences.excluded_foods,['свинина']);calories[goal]=result.nutrition_estimate.calories;
  }
  assert(calories.loss<calories.maintain);assert(calories.gain>calories.maintain);assert.equal(calories.performance,calories.maintain);assert.equal((await profile()).goal,'Похудение');pass('four nutrition goals work without changing the saved training goal',{calories});
  const advice=await command('Объясни, как учитывать мои ограничения при выборе источников белка, без меню.');assert(advice.answer.length>30);assert.equal(advice.kind,null);pass('ordinary real AI nutrition advice receives saved preferences',{answer:advice.answer});
  const blocked=await command('Рассчитай мне рацион на 900 ккал');assert.equal(blocked.nutrition_estimate,undefined);assert.match(blocked.answer,/специалист/);pass('extreme calorie request returns no personalized prescription');
  // A separate SDK client does not replace the owner's UI session. Only safe
  // summaries leave the page; the second JWT never leaves browser memory.
  const isolation=await page.evaluate(async({key,api,owner,other})=>{
   const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');const db=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false,storageKey:'stage3a-other'}});
   const login=await db.auth.signInWithPassword({email:other.email,password:other.password});if(login.error)throw Error('Second QA login failed');const token=login.data.session.access_token;
   const call=async body=>{const r=await fetch(api+'/functions/v1/fitgoin-ai',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'chat',module:'nutrition',request_id:crypto.randomUUID(),...body})});return {status:r.status(),data:await r.json()};};
   try{
    const foreign=await db.from('fgi_ai_profiles').select('data').eq('user_id',owner.id);const update=await db.from('fgi_ai_profiles').update({data:{}}).eq('user_id',owner.id).select('user_id');
    const rpc=await db.rpc('fgi_ai_complete',{p_user:owner.id,p_id:crypto.randomUUID(),p_conversation:owner.conversation_id,p_consent:new Date().toISOString(),p_input:'bypass',p_output:'saved',p_citations:[],p_kind:null,p_document:null,p_result:{}});
    const forged=await call({conversation_id:owner.conversation_id,user_id:owner.id,message:'Что я не ем?'});
    const conversation=await db.from('fgi_ai_conversations').insert({user_id:other.id,title:'Temporary nutrition acceptance'}).select('id').single();if(conversation.error)throw Error('Second QA conversation failed');
    const missing=await call({conversation_id:conversation.data.id,message:'Рассчитай мои калории и БЖУ'});
    const supplied=await call({conversation_id:conversation.data.id,message:'Мне 35 лет. Рост 172 см. Вес 65 кг. Моя общая активность — умеренная. Моя цель в питании — поддержание веса'});
    const own=await db.from('fgi_ai_profiles').select('data').single();
    return {foreignError:foreign.error?.code||null,foreignRows:foreign.data?.length,updateRows:update.data?.length,rpcDenied:Boolean(rpc.error),forgedStatus:forged.status,missing,supplied,own:own.data?.data};
   }finally{const {error}=await db.auth.signOut();if(error)throw Error('Second QA sign-out failed');}
  },{key,api,owner,other});
  assert.equal(isolation.foreignRows,0);assert.equal(isolation.updateRows,0);assert(isolation.rpcDenied);assert.equal(isolation.forgedStatus,403);assert.deepEqual((await profile()).nutrition_preferences.excluded_foods,['свинина']);pass('a real second JWT cannot read, update or bypass the owner food memory');
  assert.equal(isolation.missing.status,200);assert.equal(isolation.missing.data.nutrition_estimate,undefined);assert.deepEqual(isolation.missing.data.missing_fields,['age','height_cm','weight_kg','activity','nutrition_goal']);assert.match(isolation.missing.data.answer,/лет.*рост/);pass('a new account is asked for missing facts without invented measurements');
  assert.equal(isolation.supplied.status,200);assert.equal(isolation.supplied.data.nutrition_estimate.inputs.weight_kg,65);assert.equal(isolation.supplied.data.nutrition_estimate.inputs.height_cm,172);assert.equal(isolation.supplied.data.nutrition_estimate.inputs.age,35);assert.equal(isolation.supplied.data.nutrition_estimate.inputs.program_id,null);assert.equal(isolation.own.nutrition_pending,false);assert.equal(isolation.own.nutrition_preferences.excluded_foods,undefined);pass('explicit missing facts complete the pending calculation using only the second account');
  for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);if(process.env.FGI_AI_QA_OUT&&[390,1440].includes(width)){fs.mkdirSync(process.env.FGI_AI_QA_OUT,{recursive:true});await page.locator('#fitgoinAI').screenshot({path:path.join(process.env.FGI_AI_QA_OUT,'production-stage3a-'+width+'.png')});}}pass('authorized production nutrition fits four screen widths');
  for(const file of ['fitgoin-ai.js','fitgoin-ai-memory.mjs','fitgoin-ai-program.mjs','fitgoin-ai-workout.mjs'])assert(loaded.has('/'+file),'module not loaded '+file);pass('existing deployed AI modules load successfully');
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);pass('no page errors or failed first-party requests');
  if(process.env.FGI_AI_QA_OUT)fs.writeFileSync(path.join(process.env.FGI_AI_QA_OUT,'production-stage3a.json'),JSON.stringify({at:new Date().toISOString(),base,live:true,data:'synthetic ephemeral QA accounts; real Auth, REST, Edge and UI',passed:true,checks,trace,pageErrors:errors,failedRequests:failures},null,2));
 }finally{
  try{await page.evaluate(async({key,api})=>{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');const db=createClient(api,key);const {error}=await db.auth.signOut();if(error)throw Error('QA sign-out failed');},{key,api});await page.waitForFunction(()=>!localStorage.getItem('sb-ypbhcgcwkpiujcakvaji-auth-token'));}catch{console.error('QA logout unconfirmed; remove temporary accounts and sessions.');}
  await browser.close();
 }
})().catch(e=>{console.error(redactError(e.message));process.exitCode=1});
