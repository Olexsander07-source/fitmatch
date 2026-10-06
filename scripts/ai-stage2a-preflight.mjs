// Real Auth + memory + RLS preflight. Temporary credentials arrive on stdin.
import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
if(process.stdin.isTTY&&process.platform!=='win32')execFileSync('stty',['-echo'],{stdio:'inherit'});
const base='https://ypbhcgcwkpiujcakvaji.supabase.co';
const key=(await readFile(new URL('../fitmatch.js',import.meta.url),'utf8')).match(/key: '(sb_publishable_[^']+)'/)[1];
console.log('READY for hidden QA credentials');
const rl=createInterface({input:process.stdin});
const config=JSON.parse(await new Promise(resolve=>rl.once('line',resolve)));rl.close();
async function call(path,token=key,body,method=body?'POST':'GET'){
 const r=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,Origin:'https://fitgoin.com','Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});
 return {status:r.status,data:r.status===204?null:await r.json()};
}
const login=async a=>{const r=await call('/auth/v1/token?grant_type=password',key,{email:a.email,password:a.password});assert.equal(r.status,200);assert.equal(r.data.user.id,a.id);return r.data.access_token};
const [a,b]=config.accounts;let token=await login(a);console.log('PASS authenticated owner');
const data={goal:'Набор мышечной массы',experience:'beginner',days_per_week:3,minutes:35,setting:'home',equipment:'гантели 5 кг и коврик',restrictions:'',memory_confirmed_fields:['restrictions'],training_experience:'занимаюсь месяц',language:'ru',response_style:'short'};
assert.equal((await call('/rest/v1/fgi_ai_profiles',token,{user_id:a.id,data,consent_version:'2026-10-03'})).status,201);
const conv=await call('/rest/v1/fgi_ai_conversations',token,{user_id:a.id});assert.equal(conv.status,201);
const updated=await call('/functions/v1/fitgoin-ai',token,{action:'chat',module:'training',request_id:crypto.randomUUID(),conversation_id:conv.data[0].id,message:'Мой вес сейчас 81 кг. Какой у меня сейчас вес?'});
assert.equal(updated.status,200,updated.data.error);assert.equal(updated.data.memory_saved,true);assert.match(updated.data.answer,/81/);console.log('PASS live AI memory write/read');
await call('/auth/v1/logout',token,{},'POST');token=await login(a);
const restored=await call('/rest/v1/fgi_ai_profiles?user_id=eq.'+a.id,token);assert.equal(restored.data[0].data.weight_kg,81);assert.equal(restored.data[0].data.goal,data.goal);console.log('PASS memory persists across sign-out and fresh sign-in');
const other=await login(b),foreign=await call('/rest/v1/fgi_ai_profiles?user_id=eq.'+a.id,other);assert.deepEqual(foreign.data,[]);
const edited=await call('/rest/v1/fgi_ai_profiles?user_id=eq.'+a.id,other,{data:{}},'PATCH');assert.deepEqual(edited.data,[]);console.log('PASS real owner RLS');
await call('/auth/v1/logout',token,{},'POST');await call('/auth/v1/logout',other,{},'POST');
console.log('STAGE 2A PREFLIGHT COMPLETE');
