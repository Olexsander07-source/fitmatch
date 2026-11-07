import {TranslationError,validateTranslateRequest} from '../../../fitgoin-chat-translation-core.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const mapKey=v=>{try{const d=JSON.parse(v||'{}');return d.default||Object.values(d)[0]||'';}catch{return '';}};
const reply=(value,status,h)=>new Response(JSON.stringify(value),{status,headers:{...h,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createTranslationHandler({env,fetcher=fetch}={}){
  const get=k=>typeof env==='function'?env(k):env?.[k];
  const base=(get('SUPABASE_URL')||'').replace(/\/$/,'');
  const pub=get('SUPABASE_ANON_KEY')||mapKey(get('SUPABASE_PUBLISHABLE_KEYS'));
  const secret=get('SUPABASE_SERVICE_ROLE_KEY')||mapKey(get('SUPABASE_SECRET_KEYS'));
  // Only our own LibreTranslate installation is allowed. No OpenAI, Azure or
  // public translation mirror. The URL and API key come from Edge secrets.
  const translatorUrl=String(get('FGI_TRANSLATE_URL')||'').trim().replace(/\/+$/,'');
  const translatorKey=String(get('FGI_TRANSLATE_API_KEY')||'').trim();
  let translateEndpoint='';
  try{
    const endpoint=new URL(translatorUrl+'/translate');
    if(endpoint.protocol==='https:'&&endpoint.hostname&&
       !endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash&&
       translatorKey)translateEndpoint=endpoint.href;
  }catch{}

  const allowed=(get('AI_ALLOWED_ORIGINS')||'https://fitgoin.com,https://www.fitgoin.com').split(',').map(x=>x.trim());
  return async req=>{
    const origin=req.headers.get('origin');
    const headers={'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
    if(origin&&!allowed.includes(origin))return reply({error:'origin_not_allowed'},403,headers);
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply({error:'method_not_allowed'},405,headers);
    try {
      if(!base||!pub||!secret||!translateEndpoint)throw new TranslationError('translation_unavailable',503);
      const jwt=req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
      if(!jwt)throw new TranslationError('authentication_required',401);
      if(Number(req.headers.get('content-length'))>4000)throw new TranslationError('request_too_large',413);
      const inputString=await req.text();
      if(new TextEncoder().encode(inputString).byteLength>4000)throw new TranslationError('request_too_large',413);
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw new TranslationError('json_required',415);
      let input;try{input=JSON.parse(inputString);}catch{throw new TranslationError('invalid_request');}
      const {ids,language}=validateTranslateRequest(input);
      const rest=async(path,{admin=false,method='GET',body,prefer}={})=>{
        let resp;const key=admin?secret:pub,token=admin?secret:jwt;
        try{resp=await fetcher(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});}
        catch{throw new TranslationError('backend_unavailable',503);}
        if(!resp.ok)throw new TranslationError(!admin&&resp.status===401?'authentication_required':'backend_unavailable',!admin&&resp.status===401?401:503);
        if(resp.status===204)return null;
        try{return await resp.json();}catch{throw new TranslationError('backend_unavailable',503);}
      };
      // Auth identifies caller; RLS decides exactly which message rows it can see.
      const identity=await rest('/auth/v1/user');const actor=identity?.id;
      if(!UUID.test(actor||''))throw new TranslationError('authentication_required',401);
      const messages=await rest('/rest/v1/fgi_messages?'+new URLSearchParams({select:'id,sender_id,body',id:'in.('+ids.join(',')+')'}));
      if(!Array.isArray(messages)||messages.length!==ids.length||messages.some(m=>!ids.includes(m.id)||typeof m.body!=='string'))throw new TranslationError('message_not_accessible',403);
      const incoming=messages.filter(m=>m.sender_id!==actor&&m.body.trim()&&m.body.length<=4000);
      const skipped=messages.filter(m=>m.sender_id===actor||!m.body?.trim()||m.body.length>4000).map(m=>m.id);
      if(!incoming.length)return reply({translations:[],skipped},200,headers);
      const params=new URLSearchParams({select:'message_id,translated_text',target_language:'eq.'+language,message_id:'in.('+incoming.map(m=>m.id).join(',')+')'});
      const readCached=()=>rest('/rest/v1/fgi_message_translations?'+params,{admin:true});
      const cached=await readCached();if(!Array.isArray(cached))throw new TranslationError('backend_unavailable',503);
      let present=new Map(cached.map(x=>[x.message_id,x.translated_text]));
      const remaining=incoming.filter(m=>!present.has(m.id));
      if(remaining.length){
        const midnight=new Date().toISOString().slice(0,10)+'T00:00:00Z';
        const count=await rest('/rest/v1/fgi_message_translations?'+new URLSearchParams({select:'message_id',requested_by:'eq.'+actor,created_at:'gte.'+midnight,limit:'121'}),{admin:true});
        if(!Array.isArray(count)||count.length+remaining.length>120)throw new TranslationError('translation_daily_limit',429);
        const translated=new Map();
        // Process in small batches to avoid exhausting the owner's translation CPU.
        // The messages are never sent to a third-party translation service.
        for(let offset=0;offset<remaining.length;offset+=2){
          await Promise.all(remaining.slice(offset,offset+2).map(async m=>{
            let response;
            try{
              response=await fetcher(translateEndpoint,{
                method:'POST',
                headers:{'Content-Type':'application/json','Accept':'application/json'},
                body:JSON.stringify({q:m.body,source:'auto',target:language,format:'text',api_key:translatorKey}),
                signal:AbortSignal.timeout(20000)
              });
            }catch{
              console.warn('chat_translate: selfhost_unreachable');
              throw new TranslationError('translation_unavailable',503);
            }
            if(!response.ok){
              // Never log or return private message bodies, private endpoints or credentials.
              console.warn('chat_translate: selfhost_error',JSON.stringify({status:response.status}));
              if(response.status===429)throw new TranslationError('translation_daily_limit',429);
              if(response.status===400||response.status===422)throw new TranslationError('unsupported_language',422);
              throw new TranslationError('translation_unavailable',503);
            }
            let value;
            try{value=await response.json();}catch{throw new TranslationError('translation_unavailable',503);}
            const result=value?.translatedText;
            if(typeof result!=='string'||!result.trim()||result.length>10000)
              throw new TranslationError('translation_unavailable',503);
            translated.set(m.id,result.trim());
          }));
        }
        const rows=remaining.map(m=>({message_id:m.id,target_language:language,translated_text:translated.get(m.id),requested_by:actor}));
        await rest('/rest/v1/fgi_message_translations?on_conflict=message_id,target_language',{admin:true,method:'POST',body:rows,prefer:'resolution=ignore-duplicates,return=representation'});
        // Return only committed translations. Never fabricate a successful save.
        const verified=await readCached();
        if(!Array.isArray(verified)||verified.length!==incoming.length)throw new TranslationError('backend_unavailable',503);
        present=new Map(verified.map(x=>[x.message_id,x.translated_text]));
      }
      return reply({translations:incoming.map(m=>({id:m.id,body:present.get(m.id)})),skipped},200,headers);
    }catch(err){const known=err instanceof TranslationError;return reply({error:known?err.code:'translation_unavailable'},known?err.status:503,headers);}
  };
}
if(typeof Deno!=='undefined')Deno.serve(createTranslationHandler({env:k=>Deno.env.get(k)}));
