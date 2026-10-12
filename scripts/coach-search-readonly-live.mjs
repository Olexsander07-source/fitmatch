// Reads only existing public records; creates no account/session or fixture.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createCoachSearchHandler} from '../supabase/functions/search_coaches/index.mjs';
import {PUBLIC_COLUMNS,publicCoach} from '../supabase/functions/search_coaches/core.mjs';
const source=await readFile(new URL('../fitmatch.js',import.meta.url),'utf8');
const base=source.match(/url:\s*'([^']+)'/)?.[1],key=source.match(/key:\s*'([^']+)'/)?.[1];
assert.equal(base,'https://ypbhcgcwkpiujcakvaji.supabase.co');assert.ok(key?.startsWith('sb_publishable_'));
const checks=[];
async function get(table,extra={}) {
 const p=new URLSearchParams({select:table==='fgi_sports'?'id,name':PUBLIC_COLUMNS.join(','),order:'id.asc',limit:'250',...extra});
 if(table==='fgi_coaches')p.set('published','eq.true');
 const r=await fetch(base+'/rest/v1/'+table+'?'+p,{headers:{apikey:key},signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200);const rows=await r.json();assert.ok(Array.isArray(rows));return rows;
}
const sports=await get('fgi_sports'),coaches=await get('fgi_coaches');
checks.push({name:'existing public catalogue through actual Data API',status:'passed',count:coaches.length});
const sport=sports.find(s=>s.name==='Бодибилдинг');assert.ok(sport);
let rows=await get('fgi_coaches',{sport:'eq.'+sport.id});assert.ok(rows.every(c=>c.sport===sport.id));checks.push({name:'actual sport filtering',status:'passed',count:rows.length});
rows=await get('fgi_coaches',{format:'in.("Онлайн","Онлайн и офлайн")'});assert.ok(rows.every(c=>['Онлайн','Онлайн и офлайн'].includes(c.format)));checks.push({name:'actual online filtering',status:'passed',count:rows.length});
rows=await get('fgi_coaches',{format:'in.("Офлайн","Онлайн и офлайн")'});assert.ok(rows.every(c=>['Офлайн','Онлайн и офлайн'].includes(c.format)));checks.push({name:'actual offline filtering',status:'passed',count:rows.length});
rows=await get('fgi_coaches',{languages:'cs.{ru}'});assert.ok(rows.every(c=>c.languages.includes('ru')));checks.push({name:'actual language filtering',status:'passed',count:rows.length});
const p=new URLSearchParams({select:PUBLIC_COLUMNS.join(','),published:'eq.true',period:'eq.занятие',order:'id.asc',limit:'250'});p.append('price','lte.40');p.append('price','not.is.null');
const budgetResponse=await fetch(base+'/rest/v1/fgi_coaches?'+p,{headers:{apikey:key},signal:AbortSignal.timeout(15000)});assert.equal(budgetResponse.status,200);rows=await budgetResponse.json();assert.ok(rows.every(c=>c.price!==null&&c.price<=40&&c.period==='занятие'));checks.push({name:'actual strict budget and unit; unknown prices excluded',status:'passed',count:rows.length});
for(const c of coaches){assert.equal(c.published,true);const projected=publicCoach(c,sports);for(const k of ['email','phone','payment_url','stripe_account_id','stripe_onboarding_complete','stripe_transfers_enabled','user_id','published'])assert.ok(!Object.hasOwn(projected,k));}
checks.push({name:'public projection on actual rows',status:'passed'});
const handler=createCoachSearchHandler({env:{SUPABASE_URL:base,SUPABASE_ANON_KEY:key}});
const denied=await handler(new Request(base+'/functions/v1/search_coaches',{method:'POST',headers:{Authorization:'Bearer invalid-stage4b-session','Content-Type':'application/json'},body:'{}'}));assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'authentication_required'});
checks.push({name:'local handler rejects invalid token through actual Supabase Auth',status:'passed'});
const report={time:new Date().toISOString(),scope:'Read-only public Data API and actual Auth rejection; NOT a deployed endpoint or successful authenticated endpoint acceptance',checks};
await mkdir(new URL('../docs/qa/',import.meta.url),{recursive:true});await writeFile(new URL('../docs/qa/coach-search-stage4b-20261012.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

