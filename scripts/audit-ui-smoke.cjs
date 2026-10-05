/* Full-audit regressions. Real browser and site code, explicit backend/media
   fixtures. No emails, model calls, payments or real account changes. */
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.FGI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..'),out=process.env.FGI_UI_OUTPUT||path.join(repo,'docs/qa/full-audit');
const sdk=fs.readFileSync(path.join(__dirname,'fixtures/supabase.mjs'),'utf8');
const CLIENT='90000000-0000-4000-8000-000000000001';
const OTHER='90000000-0000-4000-8000-000000000003';
const server=http.createServer((req,res)=>{
 const file=path.resolve(repo,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!file.startsWith(repo+path.sep)){res.writeHead(403);return res.end();}
 try{res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('missing');}
});
async function tab(page,id){if(!await page.locator('[data-ai-view="'+id+'"]').isVisible())await page.locator('[data-ai-action=menu]').click();await page.locator('[data-ai-view="'+id+'"]').click();}
async function fakeVoice(page){await page.evaluate(()=>{
 window.qaTranscript='Первоначальный текст';window.qaStoppedTracks=0;
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){window.qaStoppedTracks++}}]})}});
 window.MediaRecorder=class{
  static isTypeSupported(){return true}
  constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive'}
  start(){this.state='recording'}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['a'.repeat(500)],{type:this.mimeType})});this.onstop?.();}
 };
});}
async function transcribe(page,text){await page.evaluate(text=>qaTranscript=text,text);await page.locator('[data-ai-action=voice]').first().click();await page.waitForTimeout(650);await page.locator('[data-ai-action=voice]').first().click();await page.locator('[data-ai-voice-text]').waitFor();}
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.FGI_CHROME,args:['--no-sandbox']}),errors=[],results=[];
 async function make(mode='returning',width=390,seed=null,ready=true,cookie=''){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  if(seed)await context.addInitScript(seed=>window.qaSeed=seed,seed);
  if(cookie)await context.addCookies([{name:'fitgoin_cookie_consent_v1',value:cookie,url:base}]);
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/vendor/supabase-client.mjs',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
  await page.route('**/auth/v1/settings',async route=>route.fulfill({json:await page.evaluate(()=>qaAuthSettings),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey'}}));
  await page.route('**/functions/v1/**',async route=>{
   const req=route.request(),body=req.method()==='POST'?req.postDataJSON():{};
   if(req.method()==='GET')return route.fulfill({json:{configured:ready}});
   if(body.action==='access')return route.fulfill({json:{modules:['training','nutrition'],friend:true,checkout_enabled:false,subscriptions:[]}});
   if(body.action==='transcribe')return route.fulfill({json:{text:await page.evaluate(()=>qaTranscript)}});
   return route.fulfill({json:{remaining:29}});
  });
  await page.goto(base+'/?qa='+mode);await page.waitForFunction(()=>window.qaRows&&document.querySelector('#notice')?.hidden);
  if(await page.locator('#cookieBanner').count())await page.locator('[data-cookie-choice=necessary]').click();
  if(mode==='returning')await page.locator('.ai-empty,[data-ai-view]').first().waitFor({state:'attached'});
  return{page,context,setReady:value=>ready=value};
 }
 async function done(context,label,width=390){results.push({label,width,status:'passed'});await context.close();}
 try{
  // Use the actual pinned SDK here. Block all external JavaScript requests;
  // API data is local to this QA test and is not an auth acceptance test.
  {
   const context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage(),externalScripts=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const url=route.request().url();if(url.startsWith(base+'/'))return route.continue();requests.push({method:route.request().method(),url});if(route.request().resourceType()==='script')externalScripts.push(url);
    const json=url.includes('/auth/v1/settings')?{external:{phone:false}}:url.includes('/functions/v1/')?{configured:true}:url.includes('/fgi_sports')?[{id:'fitness',name:'Fitness'}]:url.includes('/fgi_coaches')?[{id:OTHER,name:'Local SDK fixture',sport:'fitness',languages:[],availability:[],published:true}]:[];
    return route.fulfill({json,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type,x-client-info,range,range-unit,prefer','access-control-allow-methods':'GET,POST,OPTIONS'}});
   });
   await page.goto(base);await page.waitForFunction(()=>document.querySelector('#notice')?.hidden&&document.querySelectorAll('#coachesList [data-profile]').length===1).catch(async error=>{console.error('Actual SDK bootstrap:',await page.evaluate(()=>({notice:document.querySelector('#notice')?.textContent,SDK:typeof window.supabase?.createClient,cards:document.querySelector('#coachesList')?.textContent})),errors,requests);throw error;});
   assert.deepEqual(externalScripts,[]);assert.equal(await page.evaluate(()=>typeof window.supabase.createClient),'function');
   await page.locator('[data-cookie-choice=necessary]').click();await page.locator('#home [data-signup-role=client]').click();await page.locator('#signup.active').waitFor();
   await done(context,'Actual pinned SDK boots with no external JavaScript; guest navigation works');
  }
  {
   const {page,context}=await make('guest',390,null,true,'%E0%A4%A');
   assert.equal(await page.locator('#phoneLoginOpen').isVisible(),false);assert.equal(await page.locator('#phoneSignupOpen').isVisible(),false);
   assert.equal(await page.evaluate(()=>fitgoinCookieConsent.analytics),false);
   await page.addInitScript(()=>window.qaInitialAuthSettings={external:{phone:true}});await page.reload();await page.waitForFunction(()=>!document.querySelector('#phoneLoginOpen').hidden);
   await page.locator('#authOpen').click();await page.locator('#phoneLoginOpen').click();await page.locator('#phoneDialog[open]').waitFor();
   await done(context,'Disabled Phone Auth is hidden; capability changes enable its dialog; malformed consent recovers');
  }
  {
   const {page,context,setReady}=await make('returning',390,null,false);await page.locator('.ai-empty').waitFor();
   assert.equal(await page.locator('[data-ai-form=chat] button[type=submit]').isDisabled(),true);
   setReady(true);await tab(page,'access');await page.locator('[data-ai-action=refresh]').click();await page.locator('[data-ai-status]').filter({hasText:'Готово'}).waitFor();await tab(page,'ask');
   assert.equal(await page.locator('[data-ai-form=chat] button[type=submit]').isDisabled(),false);
   await done(context,'Refresh rechecks provider configuration after a transient readiness failure');
  }
  {
   const recent='80000000-0000-4000-8000-000000000001',old='80000000-0000-4000-8000-000000000002';
   const message='Открой #account, #inbox, #match и #coaches.';
   const {page,context}=await make('returning',390,{
    fgi_ai_conversations:[{id:recent,user_id:CLIENT,title:'Recent',created_at:'2026-10-05T06:00:00Z'},{id:old,user_id:CLIENT,title:'Old',created_at:'2026-10-01T06:00:00Z'}],
    fgi_ai_messages:[{id:recent,user_id:CLIENT,conversation_id:recent,role:'assistant',body:message,created_at:'2026-10-05T06:00:00Z'},{id:old,user_id:CLIENT,conversation_id:old,role:'assistant',body:'Сохранённый ответ из другого диалога',created_at:'2026-10-01T06:00:00Z'}],
    fgi_user_workspace:[{user_id:CLIENT,data:{introduction_seen:true,preferred_path:'ai',saved_ai:[old]}}]
   });
   await page.locator('[data-ai-action=platform-link]').first().waitFor();assert.equal(await page.locator('[data-ai-action=platform-link]').count(),4);
   await page.locator('[data-ai-action=platform-link][data-destination=account]').click();await page.locator('#account.active').waitFor();
   if(!await page.locator('#nav [data-page=ai]').isVisible())await page.locator('#menu').click();await page.locator('#nav [data-page=ai]').click();await tab(page,'saved');
   await page.evaluate(()=>{window.qaSpoken=[];Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(value){qaSpoken.push(value.text)}}});Object.defineProperty(navigator,'clipboard',{value:undefined});});
   await page.locator('[data-ai-action=speak]').click();assert.deepEqual(await page.evaluate(()=>qaSpoken),['Сохранённый ответ из другого диалога']);
   await page.locator('[data-ai-action=copy]').click();await page.locator('[data-ai-status]').filter({hasText:'скопируй вручную'}).waitFor();
   await done(context,'AI platform links navigate; saved answers can speak; unsupported clipboard shows a useful fallback');
  }
  {
   const {page,context}=await make();await page.locator('.ai-empty').waitFor();await fakeVoice(page);await transcribe(page,'Первоначальный текст');
   await page.locator('[data-ai-voice-text]').fill('Исправленный текст пользователя');await page.locator('[data-ai-action=voice-use]').click();
   await page.waitForFunction(()=>document.querySelector('[data-ai-form=chat] [name=message]')?.value==='Исправленный текст пользователя');
   assert((await page.evaluate(()=>qaStoppedTracks))>=1);await done(context,'Edited voice transcription is preserved before confirmation; microphone stops');
  }
  {
   const workout={title:'Fixture workout',minutes:25,warmup_minutes:5,cooldown_minutes:5,exercises:[{name:'Первое упражнение',sets:2,reps:'8',rest_seconds:60},{name:'Второе упражнение',sets:2,reps:'8',rest_seconds:60}]};
   const {page,context}=await make('returning',390,{fgi_ai_workouts:[{id:'70000000-0000-4000-8000-000000000001',user_id:CLIENT,started_at:'2026-10-05T06:00:00Z',data:{status:'active',workout,index:0,sets:[],rest_until:null}}]});
   await tab(page,'today');await fakeVoice(page);await transcribe(page,'следующее упражнение');await page.evaluate(()=>qaDbMutationError='fgi_ai_workouts');
   await page.locator('[data-ai-action=voice-use]').click();await page.locator('[data-ai-status].error').waitFor();assert.equal(await page.evaluate(()=>qaRows.fgi_ai_workouts[0].data.index),0);
   assert.match(await page.locator('.fgi-ai-guided').textContent(),/Первое упражнение/);
   await done(context,'A failed voice transition keeps the current exercise instead of skipping it');
  }
  for(const kind of ['committed','unconfirmed','rejected']){
   const {page,context}=await make('returning',390);await page.locator('.ai-empty').waitFor();await tab(page,'progress');
   const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=50;c.height=50;c.getContext('2d').fillRect(0,0,50,50);return c.toDataURL('image/jpeg').split(',')[1]});
   await page.locator('[data-ai-form=progress] [name=notes]').fill('QA lost response');await page.locator('[data-ai-form=progress] [name=photo]').setInputFiles({name:'progress.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg,'base64')});
   await page.evaluate(kind=>{if(kind==='rejected')qaDbMutationError='fgi_ai_progress';else qaDbReplyLost='fgi_ai_progress';if(kind==='unconfirmed')qaDbSelectError='fgi_ai_progress';},kind);
   await page.locator('[data-ai-form=progress] button[type=submit]').click();
   await page.locator('[data-ai-status]').filter({hasText:kind==='committed'?'Запись сохранена':kind==='unconfirmed'?'Не удалось подтвердить':'Не удалось сохранить'}).waitFor();
   const uploads=await page.evaluate(()=>qaStorageWrites.filter(x=>x.kind==='upload')),removed=await page.evaluate(()=>qaStorageWrites.filter(x=>x.kind==='remove').flatMap(x=>x.paths));
   assert.equal(uploads.length,1);assert.equal(uploads[0].bucket,'fgi-ai');
   if(kind==='rejected'){assert.deepEqual(removed,[uploads[0].path]);assert.equal(await page.evaluate(()=>qaRows.fgi_ai_progress.length),0);}
   else{assert.deepEqual(removed,[]);assert.equal(await page.evaluate(()=>qaRows.fgi_ai_progress[0].photo_path),uploads[0].path);}
   await done(context,'Progress photo '+kind+': retained after uncertain/committed write, removed only after proven rejection');
  }
  {
   const {page,context}=await make('returning',1440);await page.locator('.ai-empty').waitFor();await tab(page,'progress');
   const download=page.waitForEvent('download');await page.locator('[data-ai-action=export]').click();const exported=await download;
   assert.match(exported.suggestedFilename(),/^fitgoin-ai-.*\.json$/);const data=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));assert.equal(data.profiles[0].user_id,CLIENT);assert(Array.isArray(data.messages));
   await tab(page,'today');const calendar=page.waitForEvent('download');await page.locator('[data-ai-action=calendar]').click();const downloaded=await calendar;
   assert.equal(downloaded.suggestedFilename(),'fitgoin-training.ics');const ics=fs.readFileSync(await downloaded.path(),'utf8');assert(ics.includes('BEGIN:VCALENDAR'));assert(ics.includes('BEGIN:VALARM'));
   await done(context,'Export downloads owned AI data and a valid training calendar',1440);
  }
  {
   const {page,context}=await make('returning');await page.goto(base+'/?qa=returning&callback_qa=recovery#type=recovery');await page.locator('#resetDialog[open]').waitFor();
   await page.locator('#resetForm [name=password]').fill('QA-new-password-123');await page.locator('#resetForm [name=confirm]').fill('different-password');await page.locator('#resetForm button[type=submit]').click();await page.locator('#resetMessage').filter({hasText:'не совпадают'}).waitFor();
   await page.locator('#resetForm [name=confirm]').fill('QA-new-password-123');await page.locator('#resetForm button[type=submit]').click();await page.waitForFunction(()=>qaPasswordUpdate?.password==='QA-new-password-123');await page.locator('#resetDialog').waitFor({state:'hidden'});
   await done(context,'Recovery callback opens the reset form, rejects mismatched passwords and submits a matching pair');
  }
  {
   const {page,context}=await make('guest');await page.goto(base+'/?qa=guest&callback_qa=expired#error=access_denied&error_description=Link%20expired');await page.locator('#authDialog[open]').waitFor();await page.locator('#authMessage').filter({hasText:'Link expired'}).waitFor();assert.equal(new URL(page.url()).hash,'');
   await done(context,'Expired auth callback shows the error and removes callback data from the URL');
  }
  {
   const {page,context}=await make('coach-published',1440);await page.locator('#profile.active').waitFor();await page.locator('#profileContent [data-coach-media]').click();await page.locator('#account.active').waitFor();await page.locator('#avatarForm').waitFor();
   const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=50;c.height=50;c.getContext('2d').fillRect(0,0,50,50);return c.toDataURL('image/jpeg').split(',')[1]}),photo={name:'coach.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg,'base64')};
   await page.locator('#avatarForm [name=photo]').setInputFiles(photo);await page.locator('#avatarForm button[type=submit]').click();await page.locator('#avatarMessage').filter({hasText:'сохранено'}).waitFor();assert(await page.evaluate(()=>qaRows.fgi_coaches.find(c=>c.id===qaActor()).avatar_path));
   await page.locator('#galleryForm [name=kind]').selectOption('client');await page.locator('#galleryForm [name=photos]').setInputFiles(photo);await page.locator('#galleryForm button[type=submit]').click();await page.locator('#galleryMessage').filter({hasText:'согласие'}).waitFor();assert.equal(await page.evaluate(()=>qaRows.fgi_media.length),0);
   await page.locator('#galleryForm [name=consent]').check();await page.locator('#galleryForm button[type=submit]').click();await page.waitForFunction(()=>qaRows.fgi_media.length===1);assert.equal(await page.evaluate(()=>qaRows.fgi_media[0].consent),true);
   await page.locator('#myGallery [data-delete-photo]').click();await page.waitForFunction(()=>qaRows.fgi_media.length===0);await page.locator('#removeAvatar').click();await page.locator('#avatarMessage').filter({hasText:'удалено'}).waitFor();assert.equal(await page.evaluate(()=>qaRows.fgi_coaches.find(c=>c.id===qaActor()).avatar_path),null);
   await done(context,'Trainer avatar, consent-gated client gallery, gallery deletion and avatar removal work',1440);
  }
  {
   const {page,context}=await make('client-new');await page.goto(base+'/?qa=client-new&trainer='+OTHER);await page.locator('#profile.active').waitFor();await page.locator('#profileContent [data-contact]').click();await page.locator('#inbox.active').waitFor();await page.locator('#messageForm').waitFor();
   const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=50;c.height=50;c.getContext('2d').fillRect(0,0,50,50);return c.toDataURL('image/jpeg').split(',')[1]});
   await page.locator('#chatFile').setInputFiles({name:'chat.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg,'base64')});await page.locator('#messageForm [name=body]').fill('QA attachment');await page.locator('#messageForm button[type=submit]').click();await page.waitForFunction(()=>qaRows.fgi_messages.some(m=>m.kind==='image'&&m.body==='QA attachment'));
   const row=await page.evaluate(()=>qaRows.fgi_messages.find(m=>m.kind==='image'));assert.equal(row.sender_id,CLIENT);assert(row.media_path.startsWith(CLIENT+'/'));assert.equal(await page.evaluate(()=>qaStorageWrites.find(x=>x.kind==='upload').bucket),'fgi-chat');await page.locator('#messages img').waitFor();
   await done(context,'A chat photo is sent with its text, owned path and private chat bucket');
  }
  assert.deepEqual(errors,[]);const report={at:new Date().toISOString(),fixture:true,realSdkOfflineBootstrap:true,hardwareSimulated:true,results,pageErrors:errors,status:'passed'};
  fs.writeFileSync(path.join(out,'audit-regressions.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
