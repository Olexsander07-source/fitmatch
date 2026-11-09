// Isolated browser check: local fixtures only; no real account or AI calls.
const {createServer}=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.FGI_AI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=path.resolve(__dirname,'..');
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/fitgoin-ai.css"><link rel="stylesheet" href="/fitgoin-premium.css"></head><body><div id="root" class="fgi-ai"></div><script type="module">
import {mountFitGoInAI} from '/fitgoin-ai.js';
import {setLocale} from '/fitgoin-i18n.mjs';
const params=new URLSearchParams(location.search),mode=params.get('mode')||'plan';
setLocale(params.get('locale')||'ru');
const user={id:'fixture-user'};
const exercises=[
 {id:'bench',name:'Жим штанги лёжа',sets:3,reps:'8',rest_seconds:60,minutes:5,technique:'Спокойно и подконтрольно.',required_equipment:'Штанга',alternative:'Отжимания'},
 {id:'squat',name:'Приседания без веса',sets:3,reps:'10',rest_seconds:60,minutes:5,technique:'Сохраняй устойчивость.',required_equipment:'Без оборудования',alternative:'Присед к стулу'},
 {id:'unknown',name:'Упражнение без совпадения',sets:2,reps:'8',rest_seconds:60,minutes:5,technique:'Контроль движения.',required_equipment:'Без оборудования',alternative:'Отдых'}];
const workout={id:'workout-1',number:1,day:-1,title:'Тренировка',minutes:30,warmup:'Разминка',cooldown:'Завершение',exercises};
const plan={id:'plan-1',kind:'training',status:'active',title:'Моя программа',revision:1,document:{summary:'Программа',progression:'Постепенно',workouts:[workout]}};
const data={goal:'Тонус',days_per_week:3,minutes:30};
if(mode==='simple')data.current_workout={plan_id:plan.id,workout_id:workout.id,index:0};
if(mode==='proposal')data.program_edit_pending={mode:'proposal',program_id:plan.id,replacements:[{exercise:{name:'Отжимание от стены',technique:'Сохраняй корпус ровным.'}}]};
const profile={id:'profile-1',user_id:user.id,data};
const sessions=mode==='active'?[{id:'session-1',revision:0,started_at:new Date().toISOString(),data:{status:'active',workout,index:0,sets:[]}}]:[];
function query(table){const filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},order(){return q},limit(){return q},gt(){return q},in(){return q},maybeSingle(){return Promise.resolve({data:table==='fgi_ai_profiles'?profile:null,error:null})},then(ok,fail){const rows=table==='fgi_ai_plans'&&filters.kind==='training'?[plan]:table==='fgi_ai_workouts'?sessions:[];return Promise.resolve({data:rows,error:null}).then(ok,fail)}};return q}
const db={from:query,auth:{getSession:async()=>({data:{session:{user,access_token:'fixture-token'}},error:null})}};
window.ai=mountFitGoInAI(document.getElementById('root'),{getDB:()=>db,getUser:()=>user,endpoint:'/api/fitgoin-ai',sports:()=>[],matches:()=>[],navigate:()=>{},login:()=>{}});window.changeLocale=locale=>{setLocale(locale);window.ai.refreshUI()};window.ai.setSession(user);
</script></body></html>`;
const types={'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.mp4':'video/mp4'};
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(fixture);return}
  if(url.pathname.startsWith('/api/')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({configured:true,friend:true,modules:['training'],checkout_enabled:false}));return}
  const file=path.resolve(repo,'.'+url.pathname);
  if(!file.startsWith(repo+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
  const size=fs.statSync(file).size,headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
  // Simulate Cloudflare's static assets, which ignore Range even for MP4.
  res.writeHead(200,{...headers,'Content-Length':size});fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.FGI_AI_CHROME||undefined});
 try{
  for(const width of [390,1200]){
   const page=await browser.newPage({viewport:{width,height:860}});const errors=[];let embeds=0,videoRequests=0;
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',request=>{if(request.url().includes('/assets/exercise-demo/'))videoRequests++});
   await page.route('https://www.youtube-nocookie.com/**',route=>{embeds++;route.fulfill({status:200,contentType:'text/html',body:'<html><body>Embedded demo fixture</body></html>'})});
   await page.goto(base+'/fixture?mode=plan');
   await page.locator('details.ai-program-details > summary').click();
   const bench=page.locator('[data-program-exercise="bench"]'),squat=page.locator('[data-program-exercise="squat"]'),unknown=page.locator('[data-program-exercise="unknown"]');
   assert.equal(videoRequests,0,'clip loaded before opening its demonstration');
   await bench.locator('.ai-exercise-demo > summary').click();
   const video=bench.locator('video');assert.equal(await video.count(),1);
   await page.waitForFunction(()=>document.querySelector('[data-program-exercise="bench"] video')?.src.startsWith('blob:'));
   await video.evaluate(async v=>{await v.play()});
   await page.waitForFunction(()=>document.querySelector('[data-program-exercise="bench"] video')?.videoWidth>0);
   await bench.locator('.ai-exercise-demo > summary').click();
   await page.waitForFunction(()=>!document.querySelector('[data-program-exercise="bench"] video')?.getAttribute('src'));
   assert.equal(embeds,0,'YouTube loaded before opening its demonstration');
   await squat.locator('.ai-exercise-demo > summary').click();
   await page.waitForFunction(()=>Boolean(document.querySelector('[data-program-exercise="squat"] iframe')));
   assert.match(await squat.locator('iframe').getAttribute('src'),/youtube-nocookie\.com\/embed\/l83R5PblSMA/);
   await unknown.locator('.ai-exercise-demo > summary').click();
   assert.equal(await unknown.locator('video,iframe').count(),0);
   assert.match(await unknown.innerText(),/встроенного видео пока нет/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`overflow at ${width}`);
   await page.evaluate(()=>window.changeLocale('fr'));
   await page.locator('details.ai-program-details > summary').click();
   assert.match(await page.locator('[data-program-exercise="bench"] .ai-exercise-demo > summary').innerText(),/Voir la démonstration/);
   assert.deepEqual(errors,[]);console.log(`PASS program, video playback, fallback, language and layout ${width}px`);await page.close();
  }
  for(const [mode,selector] of [['simple','[data-current-exercise="bench"] .ai-exercise-demo'],['active','.fgi-ai-guided .ai-exercise-demo'],['proposal','[data-edit-proposal] .ai-exercise-demo']]){
   const page=await browser.newPage({viewport:{width:390,height:860}});await page.goto(base+'/fixture?mode='+mode);await page.locator(selector).waitFor();assert.equal(await page.locator(selector).count(),1);console.log('PASS '+mode+' includes exercise demonstration');await page.close();
  }
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
