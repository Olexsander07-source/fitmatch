// Isolated browser acceptance. Provider and database are explicit fixtures.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.FGI_AI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..'),output=process.env.FGI_AI_QA_OUT;
const fixture=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fitgoin-ai.css"><link rel="stylesheet" href="/fitgoin-premium.css"></head><body><div id="root"></div><script type="module">
import {mountFitGoInAI} from '/fitgoin-ai.js';
let user={id:'90000000-0000-4000-8000-000000000011'};const id=user.id;
window.rows=JSON.parse(sessionStorage.getItem('stage1-rows')||'null')||{fgi_ai_profiles:[{user_id:id,consent_version:'2026-10-03',data:{goal:'Общее здоровье',sport:'fitness',age:28,height_cm:180,weight_kg:80,days_per_week:3,minutes:30,weekdays:[1,3,5],language:'ru'}}],fgi_ai_conversations:[],fgi_ai_messages:[],fgi_ai_plans:[],fgi_ai_food:[],fgi_ai_workouts:[],fgi_ai_progress:[],fgi_ai_shares:[]};
window.keep=()=>sessionStorage.setItem('stage1-rows',JSON.stringify(rows));window.titleFails=false;window.historyFails=false;
const db={auth:{getSession:async()=>({data:{session:{user,access_token:'fixture-only'}}})},from(table){let filters=[],orders=[],mutation,payload,one=false,limit=10000;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(k,o={}){orders.push([k,o.ascending!==false]);return q},limit(n){limit=n;return q},single(){one=true;return q},maybeSingle(){one=true;return q},insert(v){mutation='insert';payload=v;return q},update(v){mutation='update';payload=v;return q},then(resolve,reject){if(table==='fgi_ai_messages'&&window.historyFails)return Promise.resolve({error:true}).then(resolve,reject);if(table==='fgi_ai_conversations'&&mutation==='update'&&window.titleFails)return Promise.resolve({error:true}).then(resolve,reject);let selected=(rows[table]||[]).filter(r=>filters.every(f=>f(r)));if(mutation==='insert'){const row={id:crypto.randomUUID(),title:'FitGoIn AI',created_at:new Date().toISOString(),...payload};rows[table].push(row);selected=[row];keep()}if(mutation==='update'){selected.forEach(r=>Object.assign(r,payload));keep()}for(const [key,asc] of orders.toReversed())selected.sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||''))*(asc?1:-1));selected=selected.slice(0,limit);return Promise.resolve({data:one?selected[0]||null:structuredClone(selected),error:null}).then(resolve,reject)}};return q}};
window.ai=mountFitGoInAI(document.getElementById('root'),{getDB:()=>db,getUser:()=>user,endpoint:location.origin+'/api/fitgoin-ai',sports:()=>['fitness'],matches:()=>[],coachName:()=>'',navigate:()=>{},login:()=>{}});ai.setSession(user);window.signOut=()=>{user=null;ai.setSession(null)};
</script></body></html>`;
const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture)}const file=path.resolve(repo,'.'+req.url.split('?')[0]);if(!file.startsWith(repo+path.sep)){res.writeHead(403);return res.end()}try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.FGI_AI_CHROME?{executablePath:process.env.FGI_AI_CHROME}:{}),args:['--no-sandbox']});
 const results=[];
 try{for(const width of [360,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[],requests=[];let mode='normal',release=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/fitgoin-ai*',async route=>{
   const req=route.request();if(req.method()==='GET')return route.fulfill({json:{configured:true}});
   const body=req.postDataJSON();if(body.action==='access')return route.fulfill({json:{modules:['training','nutrition'],friend:true,checkout_enabled:false}});
   requests.push(body);const selectedMode=mode;
   if(selectedMode==='held')await new Promise(r=>release=r);
   if(selectedMode==='quota')return route.fulfill({status:503,json:{error:'provider_quota'}});
   if(selectedMode==='html')return route.fulfill({status:502,contentType:'text/html',body:'<h1>Temporary gateway failure</h1>'});
   await page.evaluate(body=>{if(!rows.fgi_ai_messages.some(m=>m.request_id===body.request_id)){const created_at=new Date().toISOString();for(const role of ['user','assistant'])rows.fgi_ai_messages.push({id:crypto.randomUUID(),user_id:rows.fgi_ai_profiles[0].user_id,conversation_id:body.conversation_id,request_id:body.request_id,role,body:role==='user'?body.message:'Ответ: '+body.message,created_at,module:body.module});keep()}},body);
   if(selectedMode==='lost')return route.abort('failed');
   return route.fulfill({json:{answer:'Ответ: '+body.message,module:body.module,remaining:20}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.locator('[data-ai-form=chat] button[type=submit]:enabled').waitFor();
  const field=page.locator('[data-ai-form=chat] [name=message]'),send=page.locator('[data-ai-form=chat] button[type=submit]');
  assert.deepEqual(await page.locator('[data-ai-quick]').allTextContents(),['◇Моя тренировка','＋Создать программу','◌Питание','♡Найти тренера','?Задать вопрос']);
  mode='held';await field.fill('Первый вопрос');await send.click();await page.locator('.ai-typing').waitFor();assert.equal(await page.locator('.ai-outgoing p').textContent(),'Первый вопрос');
  await field.fill('Следующий вопрос');await field.press('Control+Enter');assert.equal(requests.length,1,'double-submit while pending');release();
  await page.locator('[data-ai-status]').filter({hasText:'Ответ сохранён в истории.'}).waitFor();assert.equal(await field.inputValue(),'Следующий вопрос','preserve next draft');
  mode='normal';await send.click();await page.locator('.fgi-ai-message').filter({hasText:'Ответ: Следующий вопрос'}).waitFor();assert.equal(await page.locator('.fgi-ai-message').count(),4);
  await page.reload();await page.locator('[data-ai-form=chat] button[type=submit]:enabled').waitFor();assert.equal(await page.locator('.fgi-ai-message').count(),4,'reload preserves completed messages');
  mode='quota';await field.fill('Вопрос при ошибке');await send.click();await page.locator('[data-ai-status]').filter({hasText:'лимита сервиса'}).waitFor();assert.equal(await field.inputValue(),'Вопрос при ошибке');assert(await page.locator('[data-ai-action=retry-message]').isVisible());assert.equal(await page.locator('.ai-typing').count(),0);
  mode='normal';await page.locator('[data-ai-action=retry-message]').click();await page.locator('.fgi-ai-message').filter({hasText:'Ответ: Вопрос при ошибке'}).waitFor();assert.notEqual(requests.at(-1).request_id,requests.at(-2).request_id,'definite failure gets a new request');
  mode='lost';await field.fill('Ответ потерялся в сети');await send.click();await page.locator('[data-ai-action=retry-message]').waitFor();const count=requests.length;
  await page.reload();await page.locator('.fgi-ai-message').filter({hasText:'Ответ: Ответ потерялся в сети'}).waitFor();assert.equal(await page.locator('.ai-outgoing').count(),0);assert.equal(await field.inputValue(),'');assert.equal(requests.length,count,'recover saved response without a duplicate generation');
  mode='html';await field.fill('Не JSON');await send.click();await page.locator('[data-ai-status]').filter({hasText:'подтвердить доставку'}).waitFor();const nonce=requests.at(-1).request_id;
  await page.reload();await page.locator('[data-ai-action=retry-message]').waitFor();mode='normal';await page.locator('[data-ai-action=retry-message]').click();await page.locator('.fgi-ai-message').filter({hasText:'Ответ: Не JSON'}).waitFor();assert.equal(requests.at(-1).request_id,nonce,'uncertain delivery keeps request ID');
  await page.evaluate(()=>{window.titleFails=true;rows.fgi_ai_conversations[0].title='FitGoIn AI';keep()});await field.fill('Ошибка заголовка');await send.click();await page.locator('.fgi-ai-message').filter({hasText:'Ответ: Ошибка заголовка'}).waitFor();assert.equal(await page.locator('.ai-outgoing').count(),0,'title failure does not cause resend');
  await page.evaluate(()=>window.historyFails=true);await field.fill('Сохранено, но история не обновилась');await send.click();await page.locator('[data-ai-status]').filter({hasText:'Ответ сохранён. Не удалось обновить историю'}).waitFor();const beforeRefresh=requests.length;
  await page.evaluate(()=>window.historyFails=false);await page.locator('.ai-error-actions [data-ai-action=refresh]').click();await page.locator('.fgi-ai-message').filter({hasText:'Ответ: Сохранено, но история не обновилась'}).waitFor();assert.equal(requests.length,beforeRefresh,'failed refresh does not regenerate');
  await page.evaluate(()=>{const conversation_id=rows.fgi_ai_conversations[0].id,user_id=rows.fgi_ai_profiles[0].user_id;rows.fgi_ai_messages=Array.from({length:55},(_,n)=>{const request_id=crypto.randomUUID(),created_at=new Date(Date.now()-1000000+n*1000).toISOString();return ['user','assistant'].map(role=>({id:crypto.randomUUID(),request_id,created_at,conversation_id,user_id,role,module:'training',body:(role==='user'?'Вопрос ':'Ответ ')+n+' '+ 'Длинное сообщение '.repeat(20)}))}).flat();keep()});
  await page.reload();await page.locator('[data-ai-action=more-history]').waitFor();assert.equal(await page.locator('.fgi-ai-message').count(),80);
  assert(await page.locator('.fgi-ai-messages').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight<5),'auto-scroll to latest');
  await page.locator('.fgi-ai-messages').evaluate(el=>el.scrollTop=0);await page.locator('[data-ai-action=more-history]').click();await page.waitForFunction(()=>document.querySelectorAll('.fgi-ai-message').length===110);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow');
  await page.locator('.fgi-ai-messages').evaluate(el=>el.scrollTop=el.scrollHeight);await field.fill('Черновик после обновления');await page.reload();await field.waitFor();assert.equal(await field.inputValue(),'Черновик после обновления');
  if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'ai-chat-'+width+'.png'),fullPage:true})}
  await page.evaluate(()=>signOut());assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.startsWith('fgi-ai-chat:'))),false,'private draft cleared on sign-out');
  assert.deepEqual(errors,[]);results.push({width,passed:true,scenarios:['first-message','typing','double-submit','next-draft','reload','API-quota','lost-response','non-JSON','same-nonce-retry','title-failure','refresh-failure','110-message-history','auto-scroll','draft-reload','sign-out-privacy','mobile-overflow']});await page.close();
 }
 if(output)fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({mock:true,results},null,2));console.log(JSON.stringify({mock:true,results}));
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
