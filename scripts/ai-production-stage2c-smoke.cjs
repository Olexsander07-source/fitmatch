// Actual deployed site + Auth + saved workout acceptance. Temporary QA account
// credentials arrive on stdin, are never logged, and must be removed afterwards.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
if(process.stdin.isTTY&&process.platform!=='win32')require('node:child_process').execFileSync('stty',['-echo'],{stdio:'inherit'});
const {chromium}=require(process.env.FGI_PLAYWRIGHT_MODULE||'playwright-core');
let redactError=value=>String(value);
async function input(){const rl=readline.createInterface({input:process.stdin});console.log('READY: temporary production QA account on stdin; never logged.');const line=await new Promise(r=>rl.once('line',r));rl.close();return JSON.parse(line);}
(async()=>{
 const {account,program_id}=await input(),base='https://fitgoin.com/',checks=[],errors=[],failures=[],loaded=new Set(),proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
 redactError=value=>String(value).replaceAll(account.password,'[redacted]').replaceAll(account.email,'[QA email]');
 const browser=await chromium.launch({headless:true,executablePath:process.env.FGI_CHROME,args:process.platform==='win32'?[]:['--no-sandbox'],...(proxy?{proxy:{server:new URL(proxy).origin}}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Paris',ignoreHTTPSErrors:Boolean(proxy)}),page=await context.newPage();
 page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.url().startsWith(base))failures.push({url:r.url(),error:r.failure()?.errorText})});
 page.on('response',r=>{if(r.url().startsWith(base)){if(r.status()>=400)failures.push({url:r.url(),status:r.status()});else loaded.add(new URL(r.url()).pathname)}});
 const pass=(name,extra={})=>{checks.push({name,passed:true,...extra});console.log('PASS '+name)};
 const ready=async()=>{await page.waitForFunction(()=>document.getElementById('fitgoinAI')?.getAttribute('aria-busy')==='false');await page.locator('#fitgoinAI [data-ai-form=chat] button[type=submit]:enabled').waitFor();};
 const command=async({message,selector})=>{
  await ready();const response=page.waitForResponse(r=>r.url().startsWith('https://ypbhcgcwkpiujcakvaji.supabase.co/functions/v1/fitgoin-ai')&&r.request().method()==='POST'&&JSON.parse(r.request().postData()||'{}').action==='chat');
  if(selector)await page.locator(selector).first().click();else{await page.locator('#fitgoinAI [name=message]').fill(message);await page.locator('#fitgoinAI [data-ai-form=chat] button[type=submit]').click();}
  const r=await response;const data=await r.json();assert.equal(r.status(),200,JSON.stringify({status:r.status(),error:data.error}));await ready();return data;
 };
 try{
  await page.goto(base+'?stage2c_verify='+Date.now());await page.waitForFunction(()=>typeof document.getElementById('authOpen')?.onclick==='function');
  const cookies=page.locator('#cookieBanner [data-cookie-choice=necessary]');if(await cookies.isVisible())await cookies.click();
  await page.locator('#fitgoinAI [data-ai-action=login]').waitFor({state:'attached'});
  await page.locator('#authOpen').click();await page.locator('#authDialog[open]').waitFor();
  await page.locator('#authForm [name=email]').fill(account.email);await page.locator('#authForm [name=password]').fill(account.password);await page.locator('#authForm button[type=submit]').click();
  await page.locator('#authDialog').waitFor({state:'hidden'});await page.goto(base+'#ai');await page.locator('#ai.active').waitFor();await ready();
  assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),program_id);pass('actual production login loads the expected private active program');
  const shown=await command({message:'Покажи мою программу'});assert.equal(shown.program_id,program_id);assert.equal(shown.kind,null);pass('production chat reads the saved program without regeneration');
  const started=await command({selector:'[data-ai-action=start-workout]'});assert.equal(started.current_workout.plan_id,program_id);await page.locator('[data-current-workout]').waitFor();pass('production program button opens the actual workout in the existing chat');
  const technique=await command({selector:'[data-ai-action=simple-technique]'});assert(technique.answer.length>20);pass('production workout technique command returns stored exercise context');
  await page.reload();await ready();await page.locator('[data-current-workout]').waitFor();assert.equal(await page.locator('[data-active-program]').getAttribute('data-active-program'),program_id);pass('production reload restores the same program and current workout');
  for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);if(process.env.FGI_AI_QA_OUT){fs.mkdirSync(process.env.FGI_AI_QA_OUT,{recursive:true});await page.locator('[data-current-workout]').screenshot({path:path.join(process.env.FGI_AI_QA_OUT,'production-stage2c-'+width+'.png')});}}pass('authorized production workout fits four screen widths');
  for(const file of ['fitgoin-ai.js','fitgoin-ai-memory.mjs','fitgoin-ai-program.mjs','fitgoin-ai-workout.mjs'])assert(loaded.has('/'+file),'module not loaded '+file);pass('all deployed AI memory program and workout modules load');
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);pass('no production page errors or failed first-party requests');
  if(process.env.FGI_AI_QA_OUT)fs.writeFileSync(path.join(process.env.FGI_AI_QA_OUT,'production-stage2c.json'),JSON.stringify({at:new Date().toISOString(),base,live:true,fixture:false,passed:true,program_id,checks,pageErrors:errors,failedRequests:failures},null,2));
 }finally{
  try{
   const key=fs.readFileSync(path.join(__dirname,'..','fitmatch.js'),'utf8').match(/key: '(sb_publishable_[^']+)'/)[1];
   await page.evaluate(async key=>{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');const db=createClient('https://ypbhcgcwkpiujcakvaji.supabase.co',key);const {error}=await db.auth.signOut();if(error)throw Error('QA sign-out failed');},key);
   await page.waitForFunction(()=>!localStorage.getItem('sb-ypbhcgcwkpiujcakvaji-auth-token'));
  }catch{console.error('QA logout could not be confirmed; remove the temporary account and sessions.');}
  await browser.close();
 }
})().catch(e=>{console.error(redactError(e.message));process.exitCode=1});
