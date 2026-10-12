import {UUID,PUBLIC_COLUMNS,SearchError,validateSearch,resolveSport,fitsCoach,publicCoach} from './core.mjs';

const PAGE_SIZE=250,MAX_SCAN=1000,MAX_BODY=4096;
const json=(data,status,headers)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function mapKey(value) { try { const parsed=JSON.parse(value||'{}');return parsed.default||Object.values(parsed)[0]||''; }catch{return '';} }
async function boundedBody(request) {
  if(Number(request.headers.get('content-length'))>MAX_BODY)throw new SearchError('request_too_large',413);
  const reader=request.body?.getReader();if(!reader)throw new SearchError('invalid_request');
  let size=0,parts=[];
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>MAX_BODY){await reader.cancel();throw new SearchError('request_too_large',413);}
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }catch { throw new SearchError('invalid_request'); }
}
export function createCoachSearchHandler({env,fetcher=fetch}={}) {
  const get=name=>typeof env==='function'?env(name):env?.[name];
  const base=(get('SUPABASE_URL')||'').replace(/\/$/,'');
  const publicKey=get('SUPABASE_ANON_KEY')||mapKey(get('SUPABASE_PUBLISHABLE_KEYS'));
  const origins=(get('AI_ALLOWED_ORIGINS')||'https://fitgoin.com,https://www.fitgoin.com').split(',').map(s=>s.trim()).filter(Boolean);
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
    if(origin && !origins.includes(origin))return json({error:'origin_not_allowed'},403,headers);
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json({error:'method_not_allowed'},405,headers);
    try {
      if(!base || !publicKey)throw new SearchError('backend_unavailable',503);
      const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
      if(!token)throw new SearchError('authentication_required',401);
      const deadline=Date.now()+20000;
      const read=async(path)=>{
        let response;
        try {response=await fetcher(base+path,{method:'GET',headers:{apikey:publicKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(Math.max(1,Math.min(5000,deadline-Date.now())))});}catch{throw new SearchError('backend_unavailable',503);}
        if(response.status===401 || response.status===403)throw new SearchError(path==='/auth/v1/user'?'authentication_required':'backend_unavailable',path==='/auth/v1/user'?401:503);
        if(!response.ok)throw new SearchError('backend_unavailable',503);
        try{return await response.json();}catch{throw new SearchError('backend_unavailable',503);}
      };
      // Same Auth verification as fitgoin-ai. Never decode/trust a caller user_id.
      const actor=(await read('/auth/v1/user'))?.id;
      if(!UUID.test(actor||''))throw new SearchError('authentication_required',401);
      if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw new SearchError('json_required',415);
      const p=validateSearch(await boundedBody(request));
      const dictionary=new URLSearchParams({select:'id,name',order:'id.asc',limit:'500'});
      const sports=await read('/rest/v1/fgi_sports?'+dictionary);
      if(!Array.isArray(sports) || sports.length>=500)throw new SearchError('backend_unavailable',503);
      const sport=resolveSport(p.sport,sports);
      const coaches=[];let cursor=p.cursor||'',scanned=0,hasMore=false,scanLimited=false;
      while(scanned<MAX_SCAN) {
        if(Date.now()>=deadline)throw new SearchError('backend_unavailable',503);
        const params=new URLSearchParams({select:PUBLIC_COLUMNS.join(','),published:'eq.true',order:'id.asc',limit:String(Math.min(PAGE_SIZE,MAX_SCAN-scanned))});
        params.append('id','neq.'+actor);
        if(cursor)params.append('id','gt.'+cursor);
        if(sport)params.set('sport','eq.'+sport.id);
        if(p.format)params.set('format',p.format==='Онлайн'?'in.("Онлайн","Онлайн и офлайн")':'in.("Офлайн","Онлайн и офлайн")');
        if(p.period)params.set('period','eq.'+p.period);
        if(p.budget!==undefined){params.set('price','lte.'+p.budget);params.append('price','not.is.null');}
        if(p.language)params.set('languages','cs.{'+p.language+'}');
        if(p.availability)params.set('availability','cs.{'+p.availability+'}');
        if(p.min_experience_years!==undefined)params.set('experience_years','gte.'+p.min_experience_years);
        const requested=Math.min(PAGE_SIZE,MAX_SCAN-scanned);
        const rows=await read('/rest/v1/fgi_coaches?'+params);
        if(!Array.isArray(rows) || rows.length>requested)throw new SearchError('backend_unavailable',503);
        let previous=cursor;
        for(let i=0;i<rows.length;i++) {
          const row=rows[i];
          if(!UUID.test(row?.id||'') || previous && row.id.toLowerCase()<=previous.toLowerCase())throw new SearchError('backend_unavailable',503);
          previous=cursor=row.id;scanned++;
          // Recheck strict filters and publication even if the upstream response is unexpected.
          if(fitsCoach(row,p,actor,sport))coaches.push(publicCoach(row,sports));
          if(coaches.length===p.limit){hasMore=i<rows.length-1 || rows.length===requested;break;}
        }
        if(coaches.length===p.limit || rows.length<requested)break;
        if(scanned>=MAX_SCAN){hasMore=true;scanLimited=true;}
      }
      return json({coaches,has_more:hasMore,next_cursor:hasMore?cursor:null,scan_limit_reached:scanLimited,ignored_filters:p.ignored_filters},200,headers);
    }catch(error) {
      return json({error:error instanceof SearchError?error.code:'backend_unavailable'},error instanceof SearchError?error.status:503,headers);
    }
  };
}
if(typeof Deno!=='undefined' && import.meta.main)Deno.serve(createCoachSearchHandler({env:name=>Deno.env.get(name)}));

