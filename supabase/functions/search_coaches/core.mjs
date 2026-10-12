// Strict candidate retrieval only. The existing frontend MATCH is unchanged.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PUBLIC_COLUMNS = Object.freeze(['id','name','sport','goal','format','price','period','bio','city','country','languages','experience_years','education','titles','achievements','avatar_path','rating','reviews_count','verified','availability','published']);
const INPUT_KEYS = new Set(['sport','specialization','goal','format','budget','period','language','city','country','availability','min_experience_years','limit','cursor']);
const FORMATS = ['Онлайн','Офлайн'];
const PERIODS = ['занятие','месяц','программа'];
const TIMES = ['morning','day','evening','weekend'];
export class SearchError extends Error {
  constructor(code,status=400) { super(code); this.code=code; this.status=status; }
}
export const norm = value => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
const tokens = value => String(value ?? '').split(/[,;\n]/).map(norm).filter(Boolean);
export function validateSearch(input) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new SearchError('invalid_request');
  for(const key of Object.keys(input)) {
    if(['level','preparation_level'].includes(key))throw new SearchError('unsupported_level_filter',422);
    if(!INPUT_KEYS.has(key))throw new SearchError('unknown_filter');
  }
  const out={};
  for(const key of ['sport','specialization','goal','format','period','language','city','country','availability','cursor']) {
    const value=input[key];
    if(value===undefined || value===null || value==='')continue;
    const max=['specialization','goal'].includes(key)?300:150;
    if(typeof value!=='string' || value.length>max || /[\u0000-\u001f\u007f]/.test(value))throw new SearchError('invalid_'+key);
    const clean=value.normalize('NFC').trim();if(clean)out[key]=clean;
  }
  if(out.format && !FORMATS.includes(out.format))throw new SearchError('invalid_format');
  if(out.period && !PERIODS.includes(out.period))throw new SearchError('invalid_period');
  if(out.language) {
    if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(out.language))throw new SearchError('invalid_language');
    out.language=out.language.toLowerCase();
  }
  if(out.availability && !TIMES.includes(out.availability))throw new SearchError('invalid_availability');
  if(out.cursor && !UUID.test(out.cursor))throw new SearchError('invalid_cursor');
  if(input.budget!==undefined && input.budget!==null && input.budget!=='') {
    if(typeof input.budget!=='number' || !Number.isFinite(input.budget) || input.budget<0 || input.budget>100)throw new SearchError('invalid_budget');
    if(!out.period)throw new SearchError('budget_period_required',422);
    out.budget=input.budget;
  }
  if(input.min_experience_years!==undefined && input.min_experience_years!==null) {
    if(!Number.isInteger(input.min_experience_years) || input.min_experience_years<0 || input.min_experience_years>80)throw new SearchError('invalid_experience');
    out.min_experience_years=input.min_experience_years;
  }
  const limit=input.limit??3;
  if(!Number.isInteger(limit) || limit<1 || limit>20)throw new SearchError('invalid_limit');
  out.limit=limit;
  return out;
}
export function resolveSport(value,sports) {
  if(!value)return null;
  const candidates=sports.filter(s=>UUID.test(s.id) && (norm(s.id)===norm(value) || norm(s.name)===norm(value)));
  if(candidates.length!==1)throw new SearchError(candidates.length?'ambiguous_sport':'unknown_sport',422);
  return candidates[0];
}
export function fitsCoach(c,p,actor,sport) {
  if(!c || !UUID.test(c.id) || c.id.toLowerCase()===actor.toLowerCase() || c.published!==true)return false;
  if(sport && norm(c.sport)!==norm(sport.id))return false;
  if(p.format && c.format!==p.format && c.format!=='Онлайн и офлайн')return false;
  if((p.city || p.country) && p.format!=='Онлайн' && c.format!=='Офлайн' && c.format!=='Онлайн и офлайн')return false;
  if(p.city && norm(c.city)!==norm(p.city))return false;
  if(p.country && norm(c.country)!==norm(p.country))return false;
  const goals=tokens(c.goal);
  if(p.goal && !goals.includes(norm(p.goal)))return false;
  if(p.specialization && !goals.includes(norm(p.specialization)))return false;
  if(p.language && (!Array.isArray(c.languages) || !c.languages.some(l=>norm(l)===p.language)))return false;
  if(p.availability && (!Array.isArray(c.availability) || !c.availability.includes(p.availability)))return false;
  if(p.period && c.period!==p.period)return false;
  if(p.budget!==undefined && (c.price===null || c.price===undefined || c.price==='' || !Number.isFinite(Number(c.price)) || Number(c.price)<0 || Number(c.price)>p.budget))return false;
  if(p.min_experience_years!==undefined && (!Number.isInteger(c.experience_years) || c.experience_years<p.min_experience_years))return false;
  return true;
}
export function publicCoach(c,sports) {
  const out={};
  for(const key of PUBLIC_COLUMNS)if(key!=='published' && Object.hasOwn(c,key))out[key]=c[key];
  out.sport_name=sports.find(s=>s.id===c.sport)?.name??null;
  out.price=c.price===null || c.price===undefined || c.price===''?null:Number(c.price);
  if(!Number.isFinite(out.price) && out.price!==null)out.price=null;
  out.currency='EUR';
  out.price_known=out.price!==null;
  out.profile_path='/?trainer='+encodeURIComponent(c.id);
  return out;
}

