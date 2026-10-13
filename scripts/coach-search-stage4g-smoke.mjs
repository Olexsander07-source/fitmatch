// Full existing frontend + actual AI/search/MATCH handlers. Public catalogue is read live.
// Auth, consent, paid access, writes and ordinary provider replies are LOCAL fixtures.
// All production browser traffic is GET-only; no account, grant or coach message is created.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
import {createCoachSearchHandler} from '../supabase/functions/search_coaches/index.mjs';
import {PUBLIC_COLUMNS} from '../supabase/functions/search_coaches/core.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.FGI_PLAYWRIGHT_MODULE||'playwright-core');
const repo=fileURLToPath(new URL('../',import.meta.url)),source=await readFile(resolve(repo,'fitmatch.js'),'utf8');
const base=source.match(/url:\s*'([^']+)'/)[1],publicKey=source.match(/key:\s*'([^']+)'/)[1];
async function publicRead(table,select){const r=await fetch(`${base}/rest/v1/${table}?select=${select}&order=id.asc${table==='fgi_coaches'?'&published=eq.true':''}`,{headers:{apikey:publicKey},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
const [coaches,sports]=await Promise.all([publicRead('fgi_coaches',PUBLIC_COLUMNS.join(',')),publicRead('fgi_sports','id,name')]);
assert(coaches.length>=1);const arthur=coaches.find(c=>c.name==='Артур'),olex=coaches.find(c=>c.name==='Olexander Yartcev');assert(arthur&&olex);
const uid='4a400000-0000-4000-8000-000000000001',other='4a400000-0000-4000-8000-000000000002';
const users=[uid,other],tables={profiles:users.map((id,i)=>({id,role:'client',full_name:'LOCAL QA '+(i+1),client_data:{}})),fgi_ai_profiles:users.map((user_id,i)=>({user_id,consent_version:'2026-10-03',consented_at:'2026-10-13T00:00:00Z',updated_at:'2026-10-13T00:00:00Z',data:{sport:i?'bodybuilding':'combat'}})),fgi_ai_conversations:[],fgi_ai_messages:[],fgi_threads:[],fgi_messages:[],fgi_presence:[]};
const calls=[],checks=[],failures=[],claims=new Map();let tick=Date.now(),origin,ai,search;
const stamp=()=>new Date(++tick).toISOString();
const actor=h=>{const token=new Headers(h).get('Authorization');return token==='Bearer local-owner'?uid:token==='Bearer local-other'?other:null;};
function filtered(rows,p){
  return rows.filter(row=>[...p].every(([k,v])=>{
    if(['select','order','limit','offset','or','on_conflict'].includes(k))return true;
    if(v.startsWith('eq.'))return String(row[k])===v.slice(3);
    if(v.startsWith('neq.'))return String(row[k])!==v.slice(4);
    if(v==='not.is.null')return row[k]!=null;
    if(v==='is.null')return row[k]==null;
    if(v.startsWith('gt.'))return String(row[k])>v.slice(3);
    if(v.startsWith('gte.'))return Number(row[k])>=Number(v.slice(4));
    if(v.startsWith('lte.'))return row[k]!=null&&Number(row[k])<=Number(v.slice(4));
    if(v.startsWith('cs.{'))return Array.isArray(row[k])&&row[k].includes(v.slice(4,-1));
    if(v.startsWith('in.('))return v.slice(4,-1).split(',').map(x=>x.replaceAll('"','')).includes(String(row[k]));
    throw Error('Unsupported fixture filter '+k+' '+v);
  })).sort((a,b)=>{for(const item of (p.get('order')||'').split(',')){const [key,direction]=item.split('.'),v=String(a[key]??'').localeCompare(String(b[key]??''));if(v)return direction==='desc'?-v:v;}return 0;}).slice(Number(p.get('offset')||0),Number(p.get('offset')||0)+Number(p.get('limit')||1000));
}
async function fixtureFetch(url,o={}){
  const u=new URL(url),path=u.pathname,p=u.searchParams,body=o.body?JSON.parse(o.body):null,a=actor(o.headers),method=o.method||'GET';
  calls.push({path,host:u.hostname,method,actor:a,body});
  if(path==='/auth/v1/user')return Response.json(a?{id:a}:{error:'invalid_token'},{status:a?200:401});
  if(path==='/functions/v1/search_coaches')return search(new Request(url,o));
  if(path.startsWith('/rest/v1/rpc/')){
    const name=path.split('/').at(-1);
    if(name==='fgi_ai_access')return Response.json({friend:true,modules:['training','nutrition']});
    if(name==='fgi_ai_claim'){claims.set(body.p_id,body.p_user);return Response.json({remaining:29,search_remaining:3});}
    if(name==='fgi_ai_complete'){
      assert.equal(claims.get(body.p_id),body.p_user);assert(tables.fgi_ai_conversations.some(c=>c.id===body.p_conversation&&c.user_id===body.p_user));
      for(const [role,text] of [['user',body.p_input],['assistant',body.p_output]])tables.fgi_ai_messages.push({id:crypto.randomUUID(),role,body:text,request_id:body.p_id,user_id:body.p_user,conversation_id:body.p_conversation,module:body.p_result.module,citations:[],created_at:stamp(),coach_search:role==='assistant'?body.p_result.coach_search:null});
      return Response.json(null);
    }
    if(name==='fgi_ai_fail')return Response.json(null);
    throw Error('Unexpected fixture RPC '+name);
  }
  if(url.includes('api.openai.com'))return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'LOCAL ordinary AI reply',needs_search:false,search_query:'',memory_updates:[]})}]}]});
  if(!path.startsWith('/rest/v1/'))throw Error('Unexpected fixture endpoint '+path);
  const table=path.split('/').at(-1);
  let rows=table==='fgi_coaches'?coaches:table==='fgi_sports'?sports:tables[table]||[];
  if(table.startsWith('fgi_ai_')){assert(a,'owner bearer required');rows=rows.filter(row=>row.user_id===a);}
  if(table==='profiles')rows=rows.filter(row=>row.id===a);
  if(['fgi_threads','fgi_messages'].includes(table))rows=rows.filter(row=>table==='fgi_threads'?row.client_id===a||row.coach_id===a:tables.fgi_threads.some(t=>t.id===row.thread_id&&(t.client_id===a||t.coach_id===a)));
  if(method==='GET')return Response.json(filtered(rows,p));
  assert(a,'no anonymous fixture writes');
  if(table==='fgi_threads'&&method==='POST'){
    assert.equal(body.client_id,a);assert(coaches.some(c=>c.id===body.coach_id&&c.published));
    const existing=tables.fgi_threads.find(t=>t.client_id===a&&t.coach_id===body.coach_id);if(existing)return Response.json({code:'23505'},{status:409});
    const row={...body,id:crypto.randomUUID(),created_at:stamp(),updated_at:stamp()};tables.fgi_threads.push(row);return Response.json([row]);
  }
  if(table==='fgi_ai_conversations'&&method==='POST'){
    assert.equal(body.user_id,a);const row={...body,id:body.id||crypto.randomUUID(),created_at:stamp(),updated_at:stamp()};tables[table].push(row);return Response.json([row]);
  }
  if(table==='profiles'&&['POST','PATCH'].includes(method)){assert(!body.id||body.id===a);Object.assign(tables.profiles.find(x=>x.id===a),body);return Response.json(filtered(tables.profiles,p));}
  if(table==='fgi_presence'&&['POST','PATCH'].includes(method))return Response.json([]);
  throw Error('Unexpected fixture write '+method+' '+table);
}
const sdk=`export function createClient(url,key){
let selected=new URL(location.href).searchParams.get('qa_user')==='b',user={id:selected?'${other}':'${uid}',email:'local-qa@example.invalid',user_metadata:{full_name:'LOCAL QA',signup_intent:'client'}},callbacks=[];
const token=()=>selected?'local-other':'local-owner';
function from(table){let p=new URLSearchParams({select:'*'}),method='GET',body,one=false;const q={};
q.select=v=>{p.set('select',v||'*');return q;};for(const name of ['eq','neq','gt','gte','lte','in','is','not'])q[name]=(k,v,w)=>{p.append(k,name==='in'?'in.('+v.join(',')+')':name==='not'?v+'.'+w:name+'.'+v);return q;};
q.or=v=>{p.set('or','('+v+')');return q;};q.order=(k,o={})=>{p.set('order',[p.get('order'),k+'.'+(o.ascending===false?'desc':'asc')].filter(Boolean).join(','));return q;};q.limit=v=>{p.set('limit',v);return q;};q.range=(a,b)=>{p.set('offset',a);p.set('limit',b-a+1);return q;};
for(const [name,verb] of [['insert','POST'],['upsert','POST'],['update','PATCH'],['delete','DELETE']])q[name]=v=>{method=verb;body=v;return q;};q.single=q.maybeSingle=()=>{one=true;return q;};
q.then=(ok,bad)=>fetch(url+'/rest/v1/'+table+'?'+p,{method,headers:{apikey:key,Authorization:'Bearer '+token(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}).then(async r=>{const value=await r.json();return r.ok?{data:one?(value[0]||null):value,error:null}:{data:null,error:value};}).then(ok,bad);return q;}
const db={from,auth:{getSession:async()=>({data:{session:user?{user,access_token:token()}:null},error:null}),onAuthStateChange:cb=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{user=null;callbacks.forEach(cb=>cb('SIGNED_OUT',null));return {error:null};}},channel(){const c={on(){return c;},subscribe(){return c;},unsubscribe(){return Promise.resolve();}};return c;},removeChannel:async()=>{},storage:{from:bucket=>({getPublicUrl:path=>({data:{publicUrl:url+'/storage/v1/object/public/'+bucket+'/'+path}})})}};
window.__qaSwitchUser=()=>{selected=!selected;user={id:selected?'${other}':'${uid}',email:'local-qa@example.invalid',user_metadata:{full_name:'LOCAL QA'}};callbacks.forEach(cb=>cb('SIGNED_IN',{user,access_token:token()}));};return db;}`;
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'};
const server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,origin||'http://localhost');
  if(u.pathname==='/__qa/sdk.mjs'){res.setHeader('Content-Type','text/javascript');res.end(sdk);return;}
  if(u.pathname.startsWith('/__qa/')){
    const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks).toString();
    const path=u.pathname.slice('/__qa'.length),headers={...req.headers};delete headers.host;headers.origin=origin;
    let response;
    if(req.method==='GET'&&path.startsWith('/storage/v1/object/public/fgi-media/'))response=await fetch(base+path);
    else if(path==='/functions/v1/fitgoin-ai')response=await ai(new Request(base+path,{method:req.method,headers,...(body?{body}:{})}));
    else if(path==='/functions/v1/fitgoin-ai-billing')response=Response.json({friend:true,modules:['training','nutrition'],checkout_enabled:false});
    else response=await fixtureFetch(base+path+u.search,{method:req.method,headers,...(body?{body}:{})});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const path=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(path.includes('..')||path.startsWith('.')||path.startsWith('supabase/')||path.startsWith('scripts/')||!mime[extname(path)]){res.writeHead(404).end();return;}
  let content=await readFile(resolve(repo,path));
  // Only endpoint/SDK configuration is injected. All application functions are unchanged.
  if(path==='fitmatch.js')content=content.toString().replace("url: '"+base+"'","url: '"+origin+"/__qa'").replace(/sdk:\s*'[^']+'/,"sdk: '"+origin+"/__qa/sdk.mjs'");
  res.setHeader('Content-Type',mime[extname(path)]);res.end(content);
}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(e.message)}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
const env={SUPABASE_URL:base,SUPABASE_ANON_KEY:publicKey,SUPABASE_SERVICE_ROLE_KEY:'local-service-fixture',OPENAI_API_KEY:'local-provider-fixture',AI_ALLOWED_ORIGINS:origin};
ai=createAIHandler({env,fetcher:fixtureFetch});search=createCoachSearchHandler({env,fetcher:fixtureFetch});
const browser=await chromium.launch({executablePath:process.env.FGI_CHROME,headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const cache=new Map();
async function pageFor(local=true,width=390){
  const page=await browser.newPage({viewport:{width,height:950},ignoreHTTPSErrors:true});page.setDefaultTimeout(20000);
  await page.route('https://**',async route=>{
    const request=route.request(),u=new URL(request.url());
    if(local&&u.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm'){await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'text/javascript',body:sdk});return;}
    if(local&&u.origin===base&&!u.pathname.startsWith('/storage/')){
      const r=await fetch(origin+'/__qa'+u.pathname+u.search,{method:request.method(),headers:request.headers(),...(request.postData()?{body:request.postData()}:{})});await route.fulfill({status:r.status,headers:{...Object.fromEntries(r.headers),'Access-Control-Allow-Origin':origin},body:Buffer.from(await r.arrayBuffer())});return;
    }
    if(request.method()!=='GET'||!['fitgoin.com','www.fitgoin.com','ypbhcgcwkpiujcakvaji.supabase.co','cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)){await route.abort();return;}
    try{let response=cache.get(u.href);if(!response){const h={...request.headers()};delete h.cookie;delete h.host;for(let attempt=0;attempt<2;attempt++){const r=await fetch(u.href,{headers:h,signal:AbortSignal.timeout(20000)});response={status:r.status,contentType:r.headers.get('content-type')||'application/octet-stream',body:Buffer.from(await r.arrayBuffer())};if(![502,503,504].includes(r.status))break;}if(response.status===200)cache.set(u.href,response);}await route.fulfill(response);}catch{await route.abort();}
  });return page;
}
const add=(name,scope='local full application / live public records')=>{checks.push({name,status:'passed',scope});console.log(name+' passed');};
try{
  const page=await pageFor(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#ai');try{await page.locator('#ai.active textarea[name="message"]').waitFor();}catch(e){console.log(JSON.stringify({errors,active:await page.locator('.page.active').evaluateAll(rows=>rows.map(r=>r.id)),notice:await page.locator('body').innerText().then(s=>s.slice(0,1500)),calls:calls.slice(-10).map(c=>({path:c.path,method:c.method}))}));throw e;}
  if(await page.locator('#cookieBanner:visible').count())await page.locator('[data-cookie-choice="necessary"]').click();
  async function send(message){const n=tables.fgi_ai_messages.filter(m=>m.role==='assistant'&&m.user_id===uid).length;await page.locator('#ai textarea[name="message"]').fill(message);await page.locator('#ai form:has(textarea[name="message"]) button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#ai form:has(textarea[name="message"]) button[type="submit"]')?.disabled);for(let i=0;i<100;i++){const rows=tables.fgi_ai_messages.filter(m=>m.role==='assistant'&&m.user_id===uid);if(rows.length>n)return rows.at(-1);await new Promise(r=>setTimeout(r,50));}throw Error('No completion for '+message);}
  let m=await send('Найди мне тренера');assert.equal(m.coach_search.coaches[0].id,arthur.id);assert.equal(m.coach_search.coaches[0].match.percent,100);await page.locator('[data-ai-coach-id="'+arthur.id+'"]').waitFor();add('1 request -> actual public coach -> shared MATCH -> rendered card');
  await page.locator('[data-ai-coach-id="'+arthur.id+'"] [data-ai-action="coach-profile"]').click();await page.locator('#profile.active #profileContent h1').waitFor();assert.equal((await page.locator('#profileContent h1').textContent()).trim(),arthur.name);assert.equal(new URL(page.url()).searchParams.get('trainer'),arthur.id);add('11 card opens existing selected trainer profile and UUID route');
  await page.locator('#profile [data-contact="'+arthur.id+'"]').click();await page.locator('#inbox.active').waitFor();assert.equal(tables.fgi_threads.at(-1).coach_id,arthur.id);assert.equal(tables.fgi_messages.length,0);add('existing contact creates only a LOCAL owned thread and opens inbox; no coach message');
  await page.goto(origin+'/#ai');await page.reload();await page.locator('#ai.active textarea[name="message"]').waitFor();
  m=await send('Мне нужен тренер по боксу');assert.equal(m.coach_search.status,'no_results');assert.equal(m.coach_search.parameters.specialization,'Бокс');add('2 boxing specialization uses real empty specialization data, honest no results');
  await send('Начни новый поиск: нужен онлайн-тренер до 50 €');assert.equal(tables.fgi_ai_messages.at(-1).coach_search.question,'period');m=await send('За занятие');assert.equal(m.coach_search.status,'no_results');add('3 online 50 EUR clarifies unit and excludes actual unknown prices');
  m=await send('Начни новый поиск: найди русскоязычного тренера');assert.equal(m.coach_search.coaches[0].id,arthur.id);assert.equal(m.coach_search.parameters.language,'ru');add('4 Russian language is backed by actual profile language');
  m=await send('Начни новый поиск: нужен тренер рядом со мной');assert.equal(m.coach_search.question,'city');m=await send('Киев');assert.equal(m.coach_search.status,'no_results');add('5 nearby clarifies city, does not invent offline location or distance');
  await send('Начни новый поиск: найди мне тренера');m=await send('Покажи дешевле');assert.equal(m.coach_search.question,'cheaper');add('6 cheaper with actual unknown prices asks for numeric budget');
  await send('Начни новый поиск: найди русскоязычного тренера');m=await send('Только онлайн');assert.equal(m.coach_search.parameters.format,'Онлайн');assert.equal(m.coach_search.parameters.language,'ru');assert.equal(m.coach_search.coaches[0].id,arthur.id);add('7 online refinement preserves language and refreshes current cards');
  m=await send('Сравни этих двух тренеров');assert(m.body.includes('меньше двух'));assert(!calls.some(c=>c.host==='api.openai.com'));add('8 comparison refuses to fabricate a second real coach');
  m=await send('Начни новый поиск: найди тренера по йоге');assert.equal(m.coach_search.status,'no_results');await page.locator('.fgi-ai-coach-empty').last().waitFor();add('9 actual zero-result sport has a clear empty state');
  m=await send('Начни новый поиск: найди франкоязычного онлайн тренера по бодибилдингу');assert.equal(m.coach_search.coaches[0].id,olex.id);const card=page.locator('[data-ai-coach-id="'+olex.id+'"]').last();await card.waitFor();assert((await card.textContent()).includes('Цена не указана'));assert.equal(await card.locator('.fgi-ai-coach-rating').count(),0);assert(!(await card.textContent()).includes('Опыт:'));add('10 incomplete actual profile does not invent price, experience or rating');
  await page.evaluate(()=>{document.querySelector('.fgi-ai-messages').style.maxHeight='none';document.querySelector('.fgi-ai-messages').style.overflow='visible';});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert((await card.locator('[data-ai-action="coach-profile"]').boundingBox()).height>=44);add('12 actual full application and card fit mobile 390px');
  await card.locator('[data-ai-action="coach-profile"]').click();await page.locator('#profileContent h1').waitFor();assert.equal((await page.locator('#profileContent h1').textContent()).trim(),olex.name);assert.equal(new URL(page.url()).searchParams.get('trainer'),olex.id);add('second actual coach card opens its own existing profile');
  await page.goto(origin+'/#ai');await page.reload();await page.locator('#ai.active textarea[name="message"]').waitFor();await page.reload();await page.locator('[data-ai-coach-id="'+olex.id+'"]').waitFor();add('actual completion metadata restores cards after application reload');
  const second=await pageFor();await second.goto(origin+'/?qa_user=b#ai');await second.locator('#ai.active textarea[name="message"]').waitFor();if(await second.locator('#cookieBanner:visible').count())await second.locator('[data-cookie-choice="necessary"]').click();await second.locator('#ai textarea[name="message"]').fill('Только онлайн');await second.locator('#ai form:has(textarea[name="message"]) button[type="submit"]').click();await second.getByText('Нет условий предыдущего поиска в этом разговоре.',{exact:false}).waitFor();assert.equal(tables.fgi_ai_messages.filter(r=>r.user_id===other&&r.role==='assistant').at(-1).coach_search.parameters.language,undefined);assert.equal(await second.locator('.fgi-ai-coach-card').count(),0);add('13 second local authenticated user does not receive first user context or cards');await second.close();
  assert.deepEqual(errors,[]);add('full application has no JavaScript errors during chain');await page.close();
  const live=await pageFor(false,390);live.setDefaultTimeout(45000);await live.goto('https://fitgoin.com/',{waitUntil:'domcontentloaded',timeout:45000});await live.locator('[data-profile="'+arthur.id+'"]').first().waitFor({state:'attached'});if(await live.locator('#cookieBanner:visible').count())await live.locator('[data-cookie-choice="necessary"]').click();
  await live.locator('#home [data-signup-role="client"]').click();await live.locator('#signup.active').waitFor();assert((await live.locator('#signupRoleLabel').textContent()).includes('КЛИЕНТА'));add('live client registration entry and role label','production public GET-only');
  await live.locator('button.logo[data-page="home"]').click();await live.locator('#home [data-signup-role="coach"]').click();await live.locator('#signup.active').waitFor();assert((await live.locator('#signupRoleLabel').textContent()).includes('ТРЕНЕРА'));add('live coach registration entry and role label','production public GET-only');
  await live.locator('button.logo[data-page="home"]').click();await live.locator('#authOpen').click();await live.locator('#authDialog[open]').waitFor();await live.locator('#authDialog [data-close]').click();add('live login dialog remains available','production public GET-only');
  for(const c of [arthur,olex]){await live.goto('https://fitgoin.com/?trainer='+c.id);await live.locator('#profileContent h1').waitFor();assert.equal((await live.locator('#profileContent h1').textContent()).trim(),c.name);add('live existing profile route '+c.name,'production public GET-only');}
  assert.equal(await live.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);add('live profile mobile layout has no horizontal overflow','production public GET-only');await live.close();
  console.log('Full chain checks passed: '+checks.length);
}catch(e){failures.push({error:e.message});throw e;}finally{
  const report={date:new Date().toISOString(),scope:'Full existing index/fitmatch/AI UI and actual backend handlers, live public Supabase coach/sport rows; endpoint/SDK configuration, Auth, consent, access, persistence, provider and thread writes are local controlled fixtures. Production browser uses public GET-only forwarder. This is NOT a paid authenticated production AI conversation.',real_public_coaches:coaches.map(c=>({id:c.id,name:c.name})),passed:checks.length,checks,failures,production_data_writes:0,coach_messages_sent:0};
  if(process.env.FGI_G_QA_REPORT)await writeFile(process.env.FGI_G_QA_REPORT,JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));
}
