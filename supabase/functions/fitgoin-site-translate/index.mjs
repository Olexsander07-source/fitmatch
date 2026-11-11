const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS=['goal','bio','education','titles','achievements'];
const LANGUAGES=new Set(['fr','en','ru']);
const reply=(data,status,h)=>new Response(JSON.stringify(data),{status,headers:{...h,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const firstKey=raw=>{try{const parsed=JSON.parse(raw||'{}');return parsed.default||Object.values(parsed)[0]||'';}catch{return '';}};
const safeText=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
async function sha(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function validateSiteTranslation(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!LANGUAGES.has(input.target_language))throw Error('invalid_request');
 const ids=input.coach_ids,fields=input.fields;
 if(!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some(x=>typeof x!=='string'||!UUID.test(x)))throw Error('invalid_coaches');
 if(!Array.isArray(fields)||!fields.length||fields.length>5||new Set(fields).size!==fields.length||fields.some(x=>!FIELDS.includes(x)))throw Error('invalid_fields');
 return {ids,fields,language:input.target_language};
}
export function createSiteTranslationHandler({env,fetcher=fetch}={}){
 const get=k=>typeof env==='function'?env(k):env?.[k];
 const base=String(get('SUPABASE_URL')||'').replace(/\/$/,'');
 const secret=get('SUPABASE_SERVICE_ROLE_KEY')||firstKey(get('SUPABASE_SECRET_KEYS'));
 const allowed=String(get('AI_ALLOWED_ORIGINS')||'https://fitgoin.com,https://www.fitgoin.com').split(',').map(x=>x.trim());
 const translator=String(get('FGI_TRANSLATE_URL')||'https://translate.fitgoin.com').replace(/\/+$/,'');
 let endpoint='';
 try{const u=new URL(translator+'/translate');if(u.protocol==='https:'&&u.hostname&&!u.username&&!u.password&&!u.search&&!u.hash)endpoint=u.href;}catch{}
 const rest=async(path,{method='GET',body,prefer}={})=>{
  const resp=await fetcher(base+path,{method,headers:{apikey:secret,Authorization:'Bearer '+secret,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(!resp.ok)throw Error('backend_unavailable');
  return resp.status===204?null:resp.json();
 };
 return async request=>{
  const origin=request.headers.get('origin');
  const headers={'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
  if(!origin||!allowed.includes(origin))return reply({error:'origin_not_allowed'},403,headers);
  headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405,headers);
  if(!base||!secret||!endpoint)return reply({error:'translation_unavailable'},503,headers);
  if(Number(request.headers.get('content-length'))>1500)return reply({error:'invalid_request'},413,headers);
  try{
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply({error:'json_required'},415,headers);
   const raw=await request.text();
   if(new TextEncoder().encode(raw).length>1500)return reply({error:'invalid_request'},413,headers);
   let input;try{input=JSON.parse(raw);}catch{return reply({error:'invalid_request'},400,headers);}
   let ids,fields,language;try{({ids,fields,language}=validateSiteTranslation(input));}catch{return reply({error:'invalid_request'},400,headers);}
   // No arbitrary text: translate only server-read, published coach fields.
   const params=new URLSearchParams({select:['id','published',...fields].join(','),id:'in.('+ids.join(',')+')',published:'eq.true'});
   const profiles=await rest('/rest/v1/fgi_coaches?'+params);
   if(!Array.isArray(profiles)||profiles.length!==ids.length)return reply({error:'profile_not_public'},404,headers);
   const cacheParams=new URLSearchParams({select:'coach_id,field_name,source_sha256,translated_text',coach_id:'in.('+ids.join(',')+')',field_name:'in.('+fields.join(',')+')',target_language:'eq.'+language});
   const cached=await rest('/rest/v1/fgi_public_profile_translations?'+cacheParams);
   if(!Array.isArray(cached))throw Error('backend_unavailable');
   const byKey=new Map(cached.map(x=>[x.coach_id+':'+x.field_name,x]));
   const result={},pending=[];
   for(const profile of profiles){
    result[profile.id]={};
    for(const field of fields){
     const source=safeText(profile[field],field==='bio'?1500:900);
     if(!source){result[profile.id][field]='';continue;}
     const sourceHash=await sha(source),prior=byKey.get(profile.id+':'+field);
     if(prior?.source_sha256===sourceHash){result[profile.id][field]=safeText(prior.translated_text,9000);continue;}
     pending.push({id:profile.id,field,source,sourceHash});
    }
   }
   if(pending.length){
    const quota=await rest('/rest/v1/rpc/fgi_claim_public_translation_budget',{method:'POST',body:{p_count:pending.length}});
    if(quota!==true)return reply({error:'translation_daily_limit',translations:result},429,headers);
    let apiKey=String(get('FGI_TRANSLATE_API_KEY')||'').trim();
    if(!apiKey){const stored=await rest('/rest/v1/rpc/fgi_chat_translate_key',{method:'POST',body:{}});apiKey=String(stored?.api_key||'').trim();}
    if(!apiKey)return reply({error:'translation_unavailable',translations:result},503,headers);
    for(let index=0;index<pending.length;index+=2){
     const translated=await Promise.all(pending.slice(index,index+2).map(async item=>{
      let response;
      try{response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({q:item.source,source:'auto',target:language,format:'text',api_key:apiKey}),signal:AbortSignal.timeout(14000)});}catch{throw Error('translation_unavailable');}
      if(!response.ok)throw Error(response.status===429?'translation_daily_limit':'translation_unavailable');
      const data=await response.json(),output=safeText(data?.translatedText,9000);
      if(!output||output.length>9000)throw Error('translation_unavailable');
      return {...item,output};
     }));
     for(const item of translated){
      await rest('/rest/v1/fgi_public_profile_translations?on_conflict=coach_id,field_name,target_language',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:[{coach_id:item.id,field_name:item.field,target_language:language,source_sha256:item.sourceHash,translated_text:item.output,updated_at:new Date().toISOString()}]});
      result[item.id][item.field]=item.output;
     }
    }
   }
   return reply({translations:result},200,headers);
  }catch(error){const limit=error?.message==='translation_daily_limit';return reply({error:limit?'translation_daily_limit':'translation_unavailable'},limit?429:503,headers);}
 };
}
if(typeof Deno!=='undefined')Deno.serve(createSiteTranslationHandler({env:k=>Deno.env.get(k)}));
