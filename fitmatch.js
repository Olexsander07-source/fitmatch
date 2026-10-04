/* FitGoIn production frontend.
   Здесь используется только публичный ключ. Никогда не вставляйте service_role или Stripe secret key. */
import {mountFitGoInAI} from './fitgoin-ai.js?v=20261004-premium';
import {mountPremium} from './fitgoin-premium.js';
import {workspaceRole,BRAND_IMAGES} from './fitgoin-premium-core.mjs';
import {t} from './fitgoin-i18n.mjs';
let aiAssistant=null;
let premium=null;
const CONFIG = Object.freeze({
  url: 'https://ypbhcgcwkpiujcakvaji.supabase.co',
  key: 'sb_publishable_Lsrk07A5aXJH7YypVR8QGQ_TQPwhfOV',
  sdk: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm',
  bucket: 'fgi-media',
  chatBucket: 'fgi-chat'
});
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = v => String(v ?? '').trim().toLocaleLowerCase().replace(/ё/g,'е');
const parts = v => String(v ?? '').split(/[,;\n]/).map(norm).filter(Boolean);
const langs = {en:'English',fr:'Français',uk:'Українська',ru:'Русский',de:'Deutsch',es:'Español',it:'Italiano',pt:'Português',pl:'Polski',ar:'العربية'};
const goals = ['Похудение','Набор мышечной массы','Сила','Выносливость','Подготовка к соревнованиям','Техника','Подвижность','Общее здоровье'];
const availabilityLabels = {morning:'Утро',day:'День',evening:'Вечер',weekend:'Выходные'};
const directions = [
  ['bodybuilding','Bodybuilding','бодибилдинг','1581009146145-b5ef050c2e1e'],
  ['fitness','Fitness','фитнес','1517836357463-d25dfeac3438'],
  ['crossfit','CrossFit','кроссфит','1517963879433-6ad2b056d712'],
  ['running','Running','бег','1552674605-db6ffd4facb5'],
  ['yoga','Yoga','йога','1545389336-cf090694435e'],
  ['swimming','Swimming','плавание','1530549387789-4c1017266635'],
  ['cycling','Cycling','велоспорт','1532298229144-0ec0c57515c7'],
  ['tennis','Tennis','теннис','1622279457486-62dcc4a431d6'],
  ['combat','Combat sports','единоборства','1549719386-74dfcbf7dbed'],
  ['football','Football','футбол','1579952363873-27f3bade9f55']
];
let db, user = null, own = null, profileRecord = null, sports = [], coaches = [], threads = [], activeThread = null;
let currentPage = 'home', pendingAction = '', authEpoch = 0, catalogueEpoch = 0, threadEpoch = 0;
let chatRows = [], pendingMessage = null, chatBusy = false, inboxBusy = false, signupEmail = '';
let signupRole = 'client';
let accountTab = 'profile';
const backgroundMotion = matchMedia('(prefers-reduced-motion: reduce)');
let backgroundPaused = backgroundMotion.matches, backgroundRotation = null;
let pendingChatAttachment = null, pendingChatPreviewURL = '', pendingChatDurationMs = null, pendingMessageFile = null, chatMediaURLs = new Map();
let voiceSession = null;
let currentCall = null, incomingCall = null, callPeer = null, callLocalStream = null, callSignalLastId = 0, callPollBusy = false, callMuted = false, callCameraOff = false, callFacingMode = 'user', callClock = 0, callRemoteIce = [], lastIncomingCallPoll = 0, lastCallHeartbeat = 0;
const CALL_ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
let presence = new Map(), presenceFetchedAt = 0, presenceTimer = 0;
const PRESENCE_ONLINE_MS = 75000;
let phoneMode = 'login', pendingPhone = '', pendingPhoneName = '', phoneResendUntil = 0, phoneTimer = 0;
let catalogueError = '', setupReady = false, visibleProfile = '', galleryEpoch = 0, accountVersion = 0, matchStep = 0;
const publicOnly = c => c.published !== false;
const sportName = id => sports.find(s => String(s.id) === String(id))?.name || String(id || 'Спорт не указан');
function sportKey(id) {
  const value = norm(sportName(id));
  const aliases = {'бокс':'combat','boxing':'combat','mma':'combat','велосипед':'cycling'};
  return aliases[value] || directions.find(d => d.slice(0,3).some(v => norm(v) === value))?.[0] || norm(id);
}
function sportImage(id) {
  const name=sportKey(id)==='combat'?'boxing':sportKey(id)==='yoga'?'online':'coaching';
  return `./assets/brand/${name}-${matchMedia('(max-width:650px)').matches?800:1600}.webp`;
}
function sportBackgrounds(id) {
  return [...new Set([sportImage(id),...BRAND_IMAGES.map(name=>`./assets/brand/${name}-${matchMedia('(max-width:650px)').matches?800:1600}.webp`)])];
}
function updateBackgroundControls() {
  document.querySelectorAll('[data-background-pause]').forEach(button=>{
    button.textContent=backgroundPaused?'Включить фон':'Пауза фона';
    button.setAttribute('aria-label',backgroundPaused?'Включить смену фона':'Остановить смену фона');
    button.setAttribute('aria-pressed',String(backgroundPaused));
  });
}
function finishBackgroundFade(rotation) {
  clearTimeout(rotation.fadeTimer);rotation.fadeTimer=0;
  if(!rotation.next)return;
  rotation.layers.forEach(({element,frame})=>{element.style.backgroundImage=`url("${rotation.next}")`;frame.classList.remove('is-visible');});
  rotation.next='';
}
function stopBackgroundRotation() {
  if(!backgroundRotation)return;
  clearInterval(backgroundRotation.timer);finishBackgroundFade(backgroundRotation);
  backgroundRotation.layers.forEach(({frame})=>frame.remove());backgroundRotation=null;
}
function scheduleBackgroundRotation() {
  const rotation=backgroundRotation;
  updateBackgroundControls();if(!rotation)return;
  clearInterval(rotation.timer);rotation.timer=0;
  if(backgroundPaused || document.hidden){finishBackgroundFade(rotation);return;}
  rotation.timer=setInterval(()=>{
    if(backgroundRotation!==rotation || rotation.next || backgroundPaused || document.hidden)return;
    let next=rotation.index;
    for(let offset=1;offset<rotation.photos.length;offset++){
      const candidate=(rotation.index+offset)%rotation.photos.length;
      if(rotation.ready.has(rotation.photos[candidate])){next=candidate;break;}
    }
    if(next===rotation.index)return;
    rotation.index=next;rotation.next=rotation.photos[next];
    rotation.layers.forEach(({frame})=>{frame.style.backgroundImage=`url("${rotation.next}")`;frame.classList.add('is-visible');});
    rotation.fadeTimer=setTimeout(()=>{if(backgroundRotation===rotation)finishBackgroundFade(rotation);},950);
  },5000);
}
function startBackgroundRotation(key,sport,elements) {
  const photos=sportBackgrounds(sport),rotationKey=`${currentPage}:${key}:${photos.join('|')}`;
  if(backgroundRotation?.key===rotationKey && backgroundRotation.layers.every(({element},i)=>element===elements[i]))return;
  stopBackgroundRotation();
  const layers=elements.map(element=>{
    element.style.backgroundImage=`url("${photos[0]}")`;
    const frame=document.createElement('div');frame.className='backdrop-frame';element.append(frame);
    return {element,frame};
  });
  const rotation={key:rotationKey,photos,layers,index:0,ready:new Set([photos[0]]),next:'',timer:0,fadeTimer:0};
  backgroundRotation=rotation;
  photos.slice(1).forEach(url=>{
    const photo=new Image();photo.decoding='async';
    photo.onload=()=>{if(backgroundRotation===rotation && photo.naturalWidth)rotation.ready.add(url);};
    photo.src=url;
  });
  scheduleBackgroundRotation();
}
function safeURL(value, payment = false) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    if (payment && (u.hostname !== 'buy.stripe.com' || u.search || u.hash || !/^\/(test_)?[A-Za-z0-9]+$/.test(u.pathname))) return '';
    return u.href;
  } catch { return ''; }
}
function mediaURL(path) { return path ? db.storage.from(CONFIG.bucket).getPublicUrl(path).data.publicUrl : ''; }
function photoHTML(c, cls = 'coach-photo') {
  const url = c.avatar_path ? mediaURL(c.avatar_path) : '';
  const initials = String(c.name || '?').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  return url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(c.name)}" loading="lazy" decoding="async">` : `<div class="initials" aria-label="Фото не добавлено">${esc(initials)}</div>`;
}
function priceText(c) { return c.price == null || c.price === '' ? 'Цена по запросу' : `${Number(c.price).toLocaleString('fr-FR')} € / ${c.period || 'занятие'}`; }
function message(id, value = '', error = false) { $(id).textContent = value; $(id).className = error ? 'error' : 'success'; }
function notice(value = '') { $('notice').textContent = value; $('notice').hidden = !value; }
function explain(e) {
  const raw = e?.message || String(e), code = e?.code || '';
  if (/invalid login credentials/i.test(raw)) return 'Неверный email или пароль.';
  if (/email not confirmed/i.test(raw)) return 'Сначала подтверди email. На странице регистрации можно запросить письмо повторно.';
  if (/rate.limit|too many|over_email_send_rate_limit/i.test(raw + code)) return 'Превышен лимит запросов. Подожди перед повторной попыткой.';
  if (/email_address_not_authorized|email address not authorized/i.test(raw + code)) return 'Отправка на этот email не настроена. Владельцу сайта нужно подключить SMTP в Supabase.';
  if (/phone.*(disabled|not enabled)|sms.*provider|unsupported.*phone/i.test(raw + code)) return 'Вход по телефону пока не активирован. Владельцу FitGoIn нужно включить Phone Auth и SMS-провайдера в Supabase.';
  if (/invalid.*phone|phone.*invalid/i.test(raw + code)) return 'Проверь номер телефона и используй международный формат, например +33612345678.';
  if (/otp.*expired|token.*expired|invalid.*otp|token.*invalid/i.test(raw + code)) return 'Код неверный или уже истёк. Запроси новый SMS-код.';
  if (/signups.*not.*allowed.*otp|user.*not.*found/i.test(raw + code)) return 'Не удалось отправить код для входа. Проверь номер или выбери регистрацию по телефону.';
  if (/PGRST205|42P01/.test(code)) return 'Схема базы FitGoIn не готова. Владельцу сайта нужно проверить миграции Supabase.';
  if (/23505/.test(code)) return 'Такая запись уже существует. Обнови данные и повтори действие.';
  if (/42501|row.level.security|permission denied/i.test(code + raw)) return 'Нет доступа к операции. Проверь вход и правила доступа Supabase.';
  if (/NotAllowedError|permission denied|Permission denied/i.test(raw)) return 'Разреши доступ к микрофону и камере в браузере и попробуй ещё раз.';
  if (/NotFoundError|Requested device not found/i.test(raw)) return 'Нужный микрофон или камера не найдены на устройстве.';
  if (/Failed to fetch|NetworkError|fetch failed|AbortError|timed out/i.test(raw)) return 'Нет ответа сервера. Проверь интернет и повтори действие; результат предыдущего запроса мог сохраниться.';
  return raw;
}
function unwrap(result) { if (result.error) throw result.error; return result.data; }
function requireDB() { if (!db) throw Error('Подключение ещё не готово. Подожди или обнови страницу.'); }
async function timedFetch(input, init = {}) {
  const controller=new AbortController(),abort=()=>controller.abort();
  const timer=setTimeout(abort,20000);init.signal?.addEventListener('abort',abort,{once:true});
  if(init.signal?.aborted)abort();
  try{return await fetch(input,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
}
function requireUser(action = '') {
  requireDB();
  if (user) return true;
  pendingAction = action; $('authDialog').showModal(); return false;
}
function closeDialogs() { document.querySelectorAll('dialog[open]:not(#callDialog):not(#incomingCallDialog)').forEach(d => d.close()); }
function page(id, push = true) {
  if (!$(id)?.classList.contains('page')) id = 'home';
  const routed=premium?.route(id)||id;
  if(routed==='login'){requireUser(id);return;}
  if(routed==='own-profile'){openProfile(user.id,push).catch(e=>notice(explain(e)));return;}
  id=routed;
  if (['account','inbox','ai','welcome','dashboard','match','matches','coaches','sports','ranking'].includes(id) && !requireUser(id)) return;
  if(currentPage==='ai' && id!=='ai')aiAssistant?.leave();
  closeDialogs(); stopBackgroundRotation(); currentPage = id;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  $('nav').classList.remove('open'); $('menu').setAttribute('aria-expanded','false');
  if (push) {
    const u=new URL(location.href);u.searchParams.delete('trainer');
    if(id==='signup')u.searchParams.set('signup',signupRole);else u.searchParams.delete('signup');
    u.hash=id==='home'?'':`#${id}`;
    history.pushState({page:id},'',u.pathname+u.search+u.hash);
  }
  window.scrollTo({top:0,behavior:'instant'});
  if (id === 'inbox') loadThreads().catch(e => message('chatMessage',explain(e),true));
  if (id === 'account') loadAccount().catch(e => message('coachMessage',explain(e),true));
  if (id === 'ai') aiAssistant?.open();
  premium?.entered(id);
}
async function run(form, target, work) {
  if (form.dataset.busy) return;
  form.dataset.busy = '1'; const buttons = [...form.querySelectorAll('button')];
  const disabled = buttons.map(b => b.disabled); buttons.forEach(b => b.disabled = true);
  message(target,'Выполняется…');
  try { requireDB(); await work(); } catch(e) { message(target,explain(e),true); }
  finally { delete form.dataset.busy; buttons.forEach((b,i)=>b.disabled = disabled[i]); }
}
function bindForm(id, target, work) {
  $(id).addEventListener('submit', e => { e.preventDefault(); if(e.currentTarget.reportValidity()) run(e.currentTarget,target,()=>work(new FormData(e.target),e.target)); });
}
function opt(select, entries, placeholder) {
  const old = select.value;
  select.replaceChildren(new Option(placeholder,''), ...entries.map(([v,t])=>new Option(t,v)));
  if ([...select.options].some(o=>o.value===old)) select.value=old;
}
function renderSports() {
  const entries = sports.map(s=>[s.id,s.name]);
  opt($('sportFilter'),entries,'Все виды спорта'); opt($('matchSport'),entries,'Выбери спорт'); opt($('coachSport'),entries,'Выбери спорт');
  const cards = sports.map(s=>`<button class="sport-card" data-sport="${esc(s.id)}" style="background-image:url('${sportImage(s.id)}')"><strong>${esc(s.name)}</strong><span>Найти тренера ↗</span></button>`);
  $('homeSports').innerHTML=cards.slice(0,4).join(''); $('sportsList').innerHTML=cards.join('');
}
function normalizeCoach(c, legacy = false) {
  return {...c,id:String(c.id),sport:String(c.sport ?? c.sport_id ?? ''),legacy,
    published:legacy ? true : c.published, user_id:legacy ? c.user_id : c.id,
    achievements:c.achievements || c.achievements_summary || '', languages:Array.isArray(c.languages)?c.languages:[],
    availability:Array.isArray(c.availability)?c.availability:[],
    price:c.price == null || c.price === '' ? null : Number(c.price)};
}
async function allRows(table) {
  const rows=[];
  for (let start=0;;start+=500) {
    const batch=unwrap(await db.from(table).select('*').order('id').range(start,start+499));
    rows.push(...batch); if(batch.length<500) return rows;
  }
}
async function loadCatalogue() {
  requireDB(); const epoch=++catalogueEpoch;
  const result=await Promise.allSettled([allRows('fgi_sports'),allRows('fgi_coaches')]);
  if(epoch!==catalogueEpoch) return;
  setupReady=result[0].status==='fulfilled' && result[1].status==='fulfilled';
  const data = i => result[i].status==='fulfilled' ? result[i].value : [];
  sports=data(0).map(s=>({...s,id:String(s.id)}));
  if(!sports.length) sports=directions.map(d=>({id:d[0],name:d[1]}));
  coaches=data(1).map(c=>normalizeCoach(c));
  catalogueError = !setupReady ? 'Каталог временно недоступен. Проверь миграции Supabase.' : '';
  if (!setupReady) {
    const failed=result.find(r=>r.status==='rejected');
    if(failed) catalogueError += ' '+explain(failed.reason);
  }
  if(user===null) coaches=coaches.filter(publicOnly);
  renderSports(); renderCatalogue();
  const allGoals=[...new Set([...goals,...coaches.flatMap(c=>String(c.goal || '').split(/[,;\n]/).map(s=>s.trim()).filter(Boolean))])];
  opt($('matchGoal'),allGoals.map(g=>[g,g]),'Пока не решил');
  if(catalogueError) notice(catalogueError); else notice('');
}
function formatFits(c, wanted) { return !wanted || c.format === wanted || c.format === 'Онлайн и офлайн'; }
function card(c, match) {
  return `<article class="coach-card">${photoHTML(c)}${match?`<div class="match-badge">${match.percent}% MATCH</div>`:''}<div class="card-body"><h3>${esc(c.name || 'Тренер')}</h3><p>${esc(sportName(c.sport))} · ${esc(c.city || c.format || '')}</p><div class="tags">${[c.goal,c.format,c.verified?'✓ Проверен':null,Number(c.score)>0?'Баллы профиля: '+Number(c.score):null].filter(Boolean).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="card-bottom"><span>${Number(c.rating)>0?`★ ${Number(c.rating).toFixed(1)}`:'Пока без рейтинга'}</span><span>${esc(priceText(c))}</span></div>${match?`<ul class="match-reasons">${match.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:''}<div class="match-card-actions">${match && !c.legacy?`<button class="btn primary" data-contact="${esc(c.id)}">Написать ↗</button>`:''}<button class="btn" data-profile="${esc(c.id)}">Открыть профиль ↗</button></div></div></article>`;
}
function renderCatalogue() {
  const list=coaches.filter(publicOnly);
  const filtered=list.filter(c=>(!$('sportFilter').value || sportKey(c.sport)===sportKey($('sportFilter').value)) && formatFits(c,$('formatFilter').value) && norm([c.name,c.city,c.goal,c.bio,sportName(c.sport)].join(' ')).includes(norm($('search').value)));
  $('coachesList').innerHTML=filtered.map(c=>card(c)).join('') || `<p class="empty">${esc(catalogueError || 'Тренеров по этим параметрам пока нет. Измени фильтры или создай первый профиль.')}</p>`;
  $('coachCount').textContent=`Найдено: ${filtered.length}`;
  $('topCoaches').innerHTML=[...list].sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,3).map(c=>card(c)).join('') || '<p class="empty">Здесь появятся первые тренеры FitGoIn.</p>';
  $('rankingList').innerHTML=[...list].sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)).map((c,i)=>`<button class="ranking-row" data-profile="${esc(c.id)}"><strong>${i+1}</strong><span>${esc(c.name)}<br><small>${esc(sportName(c.sport))}</small></span><span>${Number(c.rating)>0?`★ ${Number(c.rating).toFixed(1)}`:'Без рейтинга'}</span></button>`).join('') || '<p class="empty">Рейтинг появится после добавления тренеров.</p>';
  const banner=$('categoryBanner'), sport=$('sportFilter').value; banner.hidden=!sport;
  if(sport) { banner.style.backgroundImage=`linear-gradient(90deg,#111e12e6,#111e1233),url('${sportImage(sport)}')`; banner.innerHTML=`<p class="eyebrow">FITGOIN</p><h2>${esc(sportName(sport))}</h2><p>${filtered.length} тренеров по текущим фильтрам</p><button class="btn primary" data-match-sport="${esc(sport)}">Подобрать по целям ↗</button>`; }
}
function updateMatchWizard() {
  const steps=[...document.querySelectorAll('#matchForm .match-step')];if(!steps.length)return;
  matchStep=Math.max(0,Math.min(matchStep,steps.length-1));
  steps.forEach((step,i)=>step.classList.toggle('active',i===matchStep));
  $('matchPrev').hidden=matchStep===0;$('matchNext').hidden=matchStep===steps.length-1;$('matchSubmit').hidden=matchStep!==steps.length-1;
  $('matchStepText').textContent=`Вопрос ${matchStep+1} из ${steps.length}`;
  $('matchStepLabel').textContent=steps[matchStep].dataset.stepLabel || '';
  $('matchProgressFill').style.width=`${((matchStep+1)/steps.length)*100}%`;
}
function moveMatchStep(direction) {
  const steps=[...document.querySelectorAll('#matchForm .match-step')];
  if(direction>0){const required=steps[matchStep]?.querySelector('[required]');if(required && !required.reportValidity())return;}
  matchStep=Math.max(0,Math.min(matchStep+direction,steps.length-1));updateMatchWizard();
  premium?.saveMatch(matchStep);
}
function resetMatchWizard(clear=false) {
  if(clear)$('matchForm')?.reset();matchStep=0;
  if($('matchSummary'))$('matchSummary').hidden=true;if($('matchResults'))$('matchResults').replaceChildren();
  updateMatchWizard();
}
function calculateMatch(c, p) {
  if(sportKey(c.sport)!==sportKey(p.sport)) return null;
  let earned=30,total=30; const reasons=['✓ Спорт совпадает'];
  const citySelected=Boolean(p.city && p.format!=='Онлайн');
  const budgetSelected=p.budget!=='';
  const criteria=[
    [Boolean(p.goal),20,parts(c.goal).includes(norm(p.goal)),'Цель'],
    [Boolean(p.format),15,formatFits(c,p.format),'Формат'],
    [citySelected,15,norm(c.city)===norm(p.city) && c.format!=='Онлайн','Город / очные занятия'],
    [budgetSelected,10,c.price!=null && c.period===p.period && c.price<=Number(p.budget),'Бюджет'],
    [Boolean(p.language),5,c.languages.includes(p.language),'Язык'],
    [Boolean(p.availability),5,c.availability.includes(p.availability),'Удобное время']
  ];
  for(const [selected,weight,ok,label] of criteria){
    if(!selected)continue;
    total+=weight;if(ok)earned+=weight;
    reasons.push(`${ok?'✓':'—'} ${label}${ok?' совпадает':' не совпадает или не указан'}`);
  }
  return {percent:Math.min(100,Math.round(earned/total*100)),reasons};
}
function matchPreferenceSummary(p) {
  const items=[
    sportName(p.sport),p.goal,p.format,
    p.city && p.format!=='Онлайн'?p.city:'',
    p.budget!==''?`до ${Number(p.budget).toLocaleString('fr-FR')} € / ${p.period}`:'',
    p.language?(langs[p.language]||p.language):'',
    p.availability?(availabilityLabels[p.availability]||p.availability):''
  ].filter(Boolean);
  return items.map(v=>`<span class="tag">${esc(v)}</span>`).join('');
}
async function findMatch(form) {
  if(!requireUser('match'))return;
  const epoch=authEpoch;premium?.saveMatch(matchStep);page('searching');
  await new Promise(resolve=>setTimeout(resolve,backgroundMotion.matches?0:650));
  if(epoch!==authEpoch||currentPage!=='searching')return;
  const p=Object.fromEntries(new FormData(form));notice('');
  const ranked=coaches.filter(publicOnly).filter(c=>c.id!==user?.id).map(c=>({c,m:calculateMatch(c,p)})).filter(x=>x.m)
    .sort((a,b)=>b.m.percent-a.m.percent || Number(b.c.rating||0)-Number(a.c.rating||0) || Number(b.c.score||0)-Number(a.c.score||0))
    .slice(0,3);
  const summary=$('matchSummary');summary.hidden=false;
  summary.innerHTML=`<p class="eyebrow">ТВОЙ MATCH</p><h2>${ranked.length?`Нашли ${ranked.length} ${ranked.length===1?'подходящего тренера':'лучших совпадения'}`:'Пока нет точного совпадения'}</h2><div class="tags">${matchPreferenceSummary(p)}</div><p class="muted">Процент рассчитан только по выбранным тобой параметрам. Он показывает совпадение анкет, а не гарантирует результат тренировок.</p>`;
  $('matchResults').innerHTML=ranked.map(x=>card(x.c,x.m)).join('') || `<p class="empty">${esc(catalogueError || 'Тренеров по этому спорту пока нет. Попробуй другой вид спорта или вернись позже.')}</p>`;
  page('matches');
}
async function openProfile(id, push = true) {
  const c=coaches.find(c=>c.id===id); if(!c) throw Error('Профиль не найден. Обнови каталог.');
  visibleProfile=id; page('profile',false);
  if(push){const u=new URL(location.href);u.searchParams.set('trainer',id);u.hash='';history.pushState({page:'profile',profile:id},'',u.pathname+u.search);}
  const payment=safeURL(c.payment_url,true);
  $('profileContent').innerHTML=`
    <header class="profile-cover"><div class="sport-backdrop" style="background-image:url('${esc(sportImage(c.sport))}')" aria-hidden="true"></div>
      <div class="profile-cover-content"><div class="profile-cover-toolbar"><button class="text-btn profile-back" data-page="coaches">← К тренерам</button><button type="button" class="text-btn backdrop-pause" data-background-pause>Пауза фона</button></div><p class="eyebrow">FITGOIN · ${esc(sportName(c.sport))}</p><h1>${esc(c.name)}</h1><p class="profile-location">${esc([[c.city,c.country].filter(Boolean).join(', '),c.format].filter(Boolean).join(' · '))}</p>
        <div class="tags">${c.languages.map(l=>`<span class="tag">${esc(langs[l] || l)}</span>`).join('')}${c.verified?'<span class="tag">✓ Проверен</span>':''}</div>
      </div>
    </header>
    <article class="profile-layout profile-details"><div class="portrait">${photoHTML(c)}</div><div class="profile-info panel">
      <p class="workspace-kicker">ТРЕНИРОВКИ С ТРЕНЕРОМ</p><h2>${esc(priceText(c))}</h2><div class="actions">${c.id===user?.id?'<button class="btn primary" data-coach-edit>Редактировать профиль</button>':!c.legacy?`<button class="btn primary" data-contact="${esc(c.id)}">Написать тренеру ↗</button>`:'<p class="hint">Этот тренер ещё не подключил сообщения в новой версии.</p>'}</div>
      ${payment?`<p class="section-small"><a class="btn" href="${esc(payment)}" target="_blank" rel="noopener noreferrer">${new URL(payment).pathname.startsWith('/test_')?'Тестовая оплата Stripe':'Оплатить у тренера'} ↗</a></p><p class="hint">Ссылку добавил тренер. Проверь продавца, услугу, сумму и период на странице Stripe. Подтверждение платежа приходит от Stripe; здесь статус оплаты не отслеживается.</p>`:'<p class="hint">Онлайн-оплата пока не подключена. Обсуди стоимость с тренером.</p>'}
      <h3 class="section-small">О тренере</h3><p class="multiline">${esc(c.bio || 'Описание пока не добавлено.')}</p><p>Опыт: ${c.experience_years==null?'не указан':esc(c.experience_years)+' лет'}</p>
      ${[['Цели / специализация',c.goal],['Образование',c.education],['Титулы',c.titles],['Достижения',c.achievements]].map(([t,v])=>v?`<h3>${t}</h3><p class="multiline">${esc(v)}</p>`:'').join('')}
      ${c.availability.length?`<h3>Удобное время</h3><div class="profile-schedule">${c.availability.map(key=>`<span class="tag">${esc(availabilityLabels[key]||key)}</span>`).join('')}</div>`:''}
      <p class="hint">Достижения и титулы указаны тренером. Рейтинг: ${Number(c.rating)>0?Number(c.rating).toFixed(1):'ещё не сформирован'}.</p>
    </div></article><div id="profileGallery" class="section-small"></div>`;
  premium?.profileRendered(c);
  startBackgroundRotation(c.id,c.sport,[$('profileBackdrop'),$('profileContent').querySelector('.sport-backdrop')]);
  if(!c.legacy) {
    try { const items=unwrap(await db.from('fgi_media').select('*').eq('coach_id',c.id).order('created_at',{ascending:false})); if(visibleProfile===id && $('profileGallery')) $('profileGallery').innerHTML=galleryHTML(items,false); }
    catch(e){if(visibleProfile===id && $('profileGallery')) $('profileGallery').textContent=explain(e);}
  }
}
function coachWorkspaceActive() {
  return Boolean(user && workspaceRole(profileRecord,own)==='coach');
}
function renderAccountWorkspace() {
  const coachMode=coachWorkspaceActive(),form=$('coachForm');
  $('account').classList.toggle('trainer-account',coachMode);
  $('account').classList.toggle('client-account',Boolean(user && !coachMode));
  $('account').classList.toggle('styled-account',Boolean(user));
  $('workspaceBackdrop').hidden=!user;
  $('accountBackgroundPause').hidden=!user;
  $('accountTitle').innerHTML=coachMode?'Кабинет <em>тренера.</em>':'Кабинет <em>клиента.</em>';
  $('accountIntro').textContent=coachMode?'Анкета, фотографии и общение с клиентами — всё под рукой.':'Тренеры, сообщения и личные данные — всё под рукой.';
  $('coachOverview').hidden=!user;$('workspaceSidebar').hidden=!coachMode;
  $('clientSidebar').hidden=!user || coachMode;
  $('workspaceIdentityLabel').textContent=coachMode?'ТВОЙ ПРОФИЛЬ':'ТВОЙ АККАУНТ';
  if(own){
    const profileURL=new URL(location.href);profileURL.searchParams.set('trainer',own.id);profileURL.searchParams.delete('signup');profileURL.hash='';
    $('coachOverview').setAttribute('href',profileURL.pathname+profileURL.search);
    $('coachOverview').setAttribute('aria-label','Открыть мою анкету');
  }else{
    $('coachOverview').removeAttribute('href');$('coachOverview').removeAttribute('aria-label');
  }
  $('workspaceProfileArrow').hidden=!own;
  form.hidden=!coachMode || accountTab!=='profile';
  $('workspaceMedia').hidden=!coachMode || accountTab!=='media';
  $('workspaceSettings').hidden=coachMode && accountTab!=='settings';
  $('workspaceSettingsHeading').hidden=!user;$('clientCoachStart').hidden=coachMode;
  $('workspaceSettingsIntro').textContent=coachMode?'Контакты твоего аккаунта. Имя в публичной анкете меняется отдельно.':'Имя и контактные данные твоего аккаунта.';
  $('mediaEditor').hidden=!own;$('mediaLock').hidden=Boolean(own);
  if(coachMode){
    $('workspaceSettings').setAttribute('role','tabpanel');
    $('workspaceSettings').setAttribute('aria-labelledby','workspaceTabSettings');
    $('workspaceSettings').tabIndex=0;
  }else{
    $('workspaceSettings').removeAttribute('role');$('workspaceSettings').removeAttribute('aria-labelledby');$('workspaceSettings').removeAttribute('tabindex');
  }
  $('workspaceTabs').setAttribute('aria-orientation',matchMedia('(max-width:900px)').matches?'horizontal':'vertical');
  $('workspaceTabs').querySelectorAll('[data-account-tab]').forEach(button=>{
    const selected=button.dataset.accountTab===accountTab;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  if(!coachMode){
    if(currentPage==='account'){
      if(user)startBackgroundRotation(user.id,'fitness',[$('accountBackdrop'),$('workspaceBackdrop')]);else stopBackgroundRotation();
    }
    const name=$('clientForm').elements.full_name.value.trim() || profileRecord?.full_name || user?.user_metadata?.full_name || 'Твой аккаунт';
    $('workspaceName').textContent=name;
    $('workspaceSpecialty').textContent='Найди тренера, который подходит тебе.';
    const photo={name},photoKey=JSON.stringify(photo);
    if($('workspaceAvatar').dataset.photo!==photoKey){$('workspaceAvatar').innerHTML=photoHTML(photo,'workspace-photo');$('workspaceAvatar').dataset.photo=photoKey;}
    $('workspacePublication').textContent='Клиент FitGoIn';
    $('workspacePublication').classList.remove('is-published');
    $('workspacePublicationHint').textContent='Выбирай тренеров и общайся напрямую.';
    return;
  }
  if(currentPage==='account')startBackgroundRotation(user.id,form.elements.sport.value || own?.sport || 'fitness',[$('accountBackdrop'),$('workspaceBackdrop')]);
  const name=form.elements.name.value.trim() || profileRecord?.full_name || 'Твой профиль';
  $('workspaceName').textContent=name;
  $('workspaceSpecialty').textContent=[form.elements.sport.value?sportName(form.elements.sport.value):'Выбери вид спорта',form.elements.format.value].filter(Boolean).join(' · ');
  const photo={name,avatar_path:own?.avatar_path},photoKey=JSON.stringify(photo);
  for(const id of ['workspaceAvatar','workspaceMediaAvatar'])if($(id).dataset.photo!==photoKey){$(id).innerHTML=photoHTML(photo,'workspace-photo');$(id).dataset.photo=photoKey;}
  const published=Boolean(own && own.published!==false);
  $('workspacePublication').textContent=!own?'Новая анкета':published?'В каталоге':'Скрыта из каталога';
  $('workspacePublication').classList.toggle('is-published',published);
  $('workspacePublicationHint').textContent=!own?'Сохрани анкету, чтобы начать.':published?'Клиенты могут найти тебя в каталоге.':'Анкета сохранена. Включи показ в каталоге и сохрани изменения, когда будешь готов.';
  $('coachSaveState').textContent=form.dataset.dirty?'Есть несохранённые изменения.':own?'Все изменения сохранены.':'После сохранения можно добавить фотографии.';
  const checks=[
    ['Основные данные','name',Boolean(form.elements.name.value.trim() && form.elements.sport.value)],
    ['Формат и место','format',Boolean(form.elements.format.value && (form.elements.format.value==='Онлайн' || form.elements.city.value.trim()))],
    ['О себе','bio',Boolean(form.elements.bio.value.trim())],
    ['Языки общения','languages',Boolean(form.querySelector('[name=languages]:checked'))],
    ['Удобное время','availability',Boolean(form.querySelector('[name=availability]:checked'))],
    ['Фото профиля','photo',Boolean(own?.avatar_path)]
  ];
  const done=checks.filter(item=>item[2]).length;
  $('workspaceProgress').value=done;$('workspaceProgressText').textContent=`${done} / ${checks.length}`;
  $('workspaceChecklist').innerHTML=checks.map(([label,field,complete])=>`<button type="button" class="checklist-item${complete?' complete':''}" data-workspace-field="${field}" aria-label="${label}: ${complete?'заполнено':'добавить'}"><span aria-hidden="true">${complete?'✓':'+'}</span>${label}</button>`).join('');
  $('removeAvatar').hidden=!own?.avatar_path;
}
function setAccountTab(tab) {
  accountTab=['profile','media','settings'].includes(tab)?tab:'profile';renderAccountWorkspace();
}
function bindAccountWorkspace() {
  $('account').addEventListener('click',event=>{
    const tab=event.target.closest('[data-account-tab]');
    if(tab){setAccountTab(tab.dataset.accountTab);return;}
    const step=event.target.closest('[data-workspace-field]');if(!step)return;
    const field=step.dataset.workspaceField;setAccountTab(field==='photo'?'media':'profile');
    const target=field==='photo'?(own?$('avatarForm').elements.photo:$('mediaLock').querySelector('button')):$('coachForm').querySelector(`[name="${field}"]`);
    target?.focus({preventScroll:true});target?.scrollIntoView({behavior:'smooth',block:'center'});
  });
  $('workspaceTabs').addEventListener('keydown',event=>{
    const tabs=[...$('workspaceTabs').querySelectorAll('[role=tab]')],index=tabs.indexOf(event.target);
    if(index<0 || !['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+tabs.length)%tabs.length;
    setAccountTab(tabs[next].dataset.accountTab);tabs[next].focus();
  });
  const mobile=matchMedia('(max-width:900px)');
  $('workspaceProgressDetails').open=!mobile.matches;
  mobile.addEventListener('change',()=>{$('workspaceProgressDetails').open=!mobile.matches;renderAccountWorkspace();});
  $('coachForm').addEventListener('invalid',event=>{const details=event.target.closest('details');if(details)details.open=true;},true);
}
function authUI() {
  const isCoach=coachWorkspaceActive();
  $('authOpen').textContent=user?'Кабинет':'Войти';$('authOpen').hidden=Boolean(user);
  $('accountOpen').textContent=user?'Мой кабинет':'Стать тренером';
  $('clientSignupOpen').hidden=Boolean(user);
  $('accountFindCoach').hidden=isCoach;
  document.querySelector('.header-actions').classList.toggle('account-nav',Boolean(user));
  document.querySelector('.header-actions').classList.toggle('guest-nav',!user);
  $('accountEmail').textContent=user?.email || user?.phone || '';
  renderAccountWorkspace();
  premium?.decorate();
}
function authChanged(event, session) {
  const previous=user,next=session?.user || null, changed=user?.id!==next?.id;
  user=next;if(changed)own=null;
  premium?.setSession(user);
  aiAssistant?.setSession(user);
  if(changed){authEpoch++;threadEpoch++;catalogueEpoch++;own=null;profileRecord=null;activeThread=null;threads=[];chatRows=[];pendingMessage=null;visibleProfile='';presence.clear();presenceFetchedAt=0;
    cancelVoiceRecording();cleanupCallLocal();$('threads').replaceChildren();$('messages').replaceChildren();$('myGallery').replaceChildren();$('profileContent').replaceChildren();$('chatTitle').textContent='Выбери диалог';$('chatPresence').textContent='';$('messageForm').hidden=true;$('messageForm').reset();clearChatAttachment();clearChatMediaURLs();$('clientForm').reset();delete $('clientForm').dataset.dirty;$('coachForm').reset();delete $('coachForm').dataset.dirty;accountTab='profile';$('coachForm').hidden=true;$('clientCoachStart').hidden=false;$('mediaEditor').hidden=true;
    resetMatchWizard(true);stopPresenceHeartbeat();if(user)setTimeout(startPresenceHeartbeat,0);
    if(!user){coaches=coaches.filter(publicOnly);if(currentPage!=='home'&&currentPage!=='signup') page('home');}
    setTimeout(()=>{loadCatalogue().then(()=>user?loadAccount():null).catch(e=>notice(explain(e)));},0);
  }
  authUI();
  if(event==='PASSWORD_RECOVERY') {pendingAction='';closeDialogs();$('resetDialog').showModal();}
}
async function afterLogin() {
  closeDialogs(); const action=pendingAction;premium?.setSession(user);aiAssistant?.setSession(user);
  await loadCatalogue(); await loadAccount();
  if((action==='coach-onboarding'||user.user_metadata?.signup_intent==='coach')&&!coachWorkspaceActive())await startCoachOnboarding();
  await premium?.accountLoaded();
  pendingAction='';authUI();
  if(action.startsWith('contact:')) await contact(action.slice(8));
  else if(coachWorkspaceActive()&&own)await openProfile(own.id);
  else page(coachWorkspaceActive()?'account':!action||action==='account'?premium?.startPage()||'welcome':action);
}
function redirectURL() { return location.origin+location.pathname; } // Сохраняет /имя-репозитория/ GitHub Pages.
function setSignupRole(role) {
  signupRole=role==='coach'?'coach':'client';
  const coach=signupRole==='coach';
  $('signupRoleLabel').textContent=coach?'РЕГИСТРАЦИЯ ТРЕНЕРА':'РЕГИСТРАЦИЯ КЛИЕНТА';
  $('signupTitle').textContent=t(coach?'signupCoach':'signupClient');
  $('signupHint').textContent=t(coach?'signupCoachHint':'signupClientHint');
  $('signupNextStep').textContent=t(coach?'coachProfile':'goal');
}
function openSignup(role) {
  $('signupForm').closest('.narrow').removeAttribute('data-signup-confirmed');
  message('signupMessage','');
  setSignupRole(role);pendingAction=signupRole==='coach'?'coach-onboarding':'account';page('signup');
}
async function loadAccount() {
  if(!user) return; const epoch=authEpoch, id=user.id, version=++accountVersion;
  const [profileResult,coachResult]=await Promise.all([
    db.from('profiles').select('id,full_name,phone,role,is_active').eq('id',id).maybeSingle(),
    db.from('fgi_coaches').select('*').eq('id',id).maybeSingle()
  ]);
  const profile=unwrap(profileResult),record=unwrap(coachResult);
  if(epoch!==authEpoch || version!==accountVersion) return;
  profileRecord=profile;own=record;
  const clientForm=$('clientForm');
  if(!clientForm.dataset.dirty && !clientForm.dataset.busy){
    clientForm.elements.full_name.value=profile?.full_name || user.user_metadata?.full_name || '';
    clientForm.elements.phone.value=profile?.phone || user.phone || '';
  }
  const form=$('coachForm');
  if(!form.dataset.dirty && !form.dataset.busy){
    for(const [name,control] of Object.entries(Object.fromEntries([...form.elements].filter(e=>e.name).map(e=>[e.name,e])))) {
      if(name==='languages' || name==='availability') continue;
      if(control.type==='checkbox') control.checked=record?.[name] ?? false;
      else control.value=record?.[name] ?? (name==='name'?(profile?.full_name || user.user_metadata?.full_name || ''):name==='format'?'Онлайн':name==='period'?'занятие':'');
    }
    if(record?.sport && ![...$('coachSport').options].some(o=>o.value===record.sport)) $('coachSport').add(new Option(sportName(record.sport),record.sport));
    if(record) $('coachSport').value=record.sport;
    form.querySelectorAll('[name=languages]').forEach(i=>i.checked=record?.languages?.includes(i.value) || false);
    form.querySelectorAll('[name=availability]').forEach(i=>i.checked=record?.availability?.includes(i.value) || false);
    $('coachPayment').open=Boolean(record?.payment_url);
  }
  authUI();
  await premium?.accountLoaded();
  if(record) await loadMyGallery();
}
async function startCoachOnboarding() {
  if(!requireUser('coach-onboarding'))return;
  const epoch=authEpoch;
  unwrap(await db.rpc('fgi_start_trainer_onboarding'));
  if(epoch!==authEpoch)return;
  await loadAccount();
  if(!coachWorkspaceActive())throw Error('Не удалось подтвердить роль тренера. Обнови страницу.');
}
const actionTimes=new Map();
function rateGate(key, wait=10000) {
  const now=Date.now(),last=actionTimes.get(key)||0;
  if(now-last<wait) throw Error('Подожди несколько секунд перед повторной попыткой.');
  actionTimes.set(key,now);
}
function assertStrongPassword(value) {
  const password=String(value || '');
  if(password.length<6) throw Error('Пароль: минимум 6 символов.');
  return password;
}
function normalizePhone(value) {
  const phone=String(value || '').trim().replace(/[()\s.-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(phone)) throw Error('Введи номер в международном формате, например +33612345678.');
  return phone;
}
function updatePhoneResendButton() {
  const button=$('phoneResend'); if(!button)return;
  const seconds=Math.max(0,Math.ceil((phoneResendUntil-Date.now())/1000));
  button.disabled=seconds>0;
  button.textContent=seconds>0?`Отправить код повторно (${seconds})`:'Отправить код повторно';
  if(!seconds && phoneTimer){clearInterval(phoneTimer);phoneTimer=0;}
}
function startPhoneResendTimer() {
  phoneResendUntil=Date.now()+60000;
  if(phoneTimer)clearInterval(phoneTimer);
  updatePhoneResendButton();
  phoneTimer=setInterval(updatePhoneResendButton,1000);
}
function openPhoneAuth(mode) {
  phoneMode=mode==='signup'?'signup':'login';pendingPhone='';pendingPhoneName='';
  const request=$('phoneRequestForm'),otp=$('phoneOtpForm');
  request.reset();otp.reset();request.hidden=false;otp.hidden=true;
  $('phoneTitle').textContent=phoneMode==='signup'?'Регистрация по телефону':'Вход по телефону';
  $('phoneNameWrap').hidden=phoneMode!=='signup';
  request.elements.name.required=phoneMode==='signup';
  $('phoneSend').textContent=phoneMode==='signup'?'Получить код и зарегистрироваться':'Получить код для входа';
  message('phoneMessage','');message('phoneOtpMessage','');
  updatePhoneResendButton();closeDialogs();$('phoneDialog').showModal();
}
async function requestPhoneOtp(phone,name='') {
  if(Date.now()<phoneResendUntil) throw Error('Подожди до повторной отправки SMS-кода.');
  const options={channel:'sms',shouldCreateUser:phoneMode==='signup'};
  if(phoneMode==='signup') options.data={full_name:name,signup_intent:signupRole};
  unwrap(await db.auth.signInWithOtp({phone,options}));
  startPhoneResendTimer();
}
function bindAuth() {
  $('phoneSignupOpen').onclick=()=>openPhoneAuth('signup');
  $('phoneLoginOpen').onclick=()=>openPhoneAuth('login');
  bindForm('phoneRequestForm','phoneMessage',async(f,form)=>{
    const phone=normalizePhone(f.get('phone'));
    const name=String(f.get('name')||'').trim();
    if(phoneMode==='signup' && !name)throw Error('Введи имя.');
    await requestPhoneOtp(phone,name);
    pendingPhone=phone;pendingPhoneName=name;
    form.hidden=true;$('phoneOtpForm').hidden=false;$('phoneOtpForm').reset();
    message('phoneOtpMessage',`Код отправлен на ${phone}. Введи 6 цифр из SMS.`);
    $('phoneOtpForm').elements.token.focus();
  });
  bindForm('phoneOtpForm','phoneOtpMessage',async(f,form)=>{
    if(!pendingPhone)throw Error('Сначала запроси SMS-код.');
    const token=String(f.get('token')||'').trim();
    if(!/^\d{6}$/.test(token))throw Error('Введи 6 цифр из SMS.');
    const data=unwrap(await db.auth.verifyOtp({phone:pendingPhone,token,type:'sms'}));
    if(!data?.session || !data?.user)throw Error('Не удалось подтвердить код. Запроси новый SMS-код.');
    if(phoneTimer){clearInterval(phoneTimer);phoneTimer=0;}phoneResendUntil=0;
    user=data.user;authUI();form.reset();message('phoneOtpMessage','');await afterLogin();
  });
  $('phoneResend').onclick=()=>run($('phoneOtpForm'),'phoneOtpMessage',async()=>{
    if(!pendingPhone)throw Error('Сначала введи номер телефона.');
    await requestPhoneOtp(pendingPhone,pendingPhoneName);
    message('phoneOtpMessage',`Новый код отправлен на ${pendingPhone}.`);
  });
  $('phoneChange').onclick=()=>{
    $('phoneOtpForm').hidden=true;$('phoneRequestForm').hidden=false;
    $('phoneRequestForm').elements.phone.value=pendingPhone;
    if(phoneMode==='signup')$('phoneRequestForm').elements.name.value=pendingPhoneName;
    message('phoneMessage','');message('phoneOtpMessage','');
  };
  bindForm('authForm','authMessage',async(f,form)=>{
    const data=unwrap(await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:f.get('password')}));
    user=data.user;authUI();form.reset();message('authMessage','');await afterLogin();
  });
  bindForm('signupForm','signupMessage',async(f,form)=>{
    if(String(f.get('website')||'').trim()){form.reset();message('signupMessage','Запрос принят.');return;}
    rateGate('signup',15000);
    signupEmail=String(f.get('email')).trim();
    const name=String(f.get('name')).trim();if(!name)throw Error('Введи имя.');
    const data=unwrap(await db.auth.signUp({email:signupEmail,password:assertStrongPassword(f.get('password')),options:{emailRedirectTo:redirectURL(),data:{full_name:name,signup_intent:signupRole}}}));
    form.elements.password.value='';
    if(data.session){user=data.user;authUI();message('signupMessage','Аккаунт создан.');await afterLogin();}
    else {message('signupMessage',t('confirmationHint'));$('signupForm').closest('.narrow').setAttribute('data-signup-confirmed','true');}
  });
  $('resend').onclick=()=>run($('resend'),'signupMessage',async()=>{rateGate('resend',15000);
    const email=$('signupForm').elements.email.value.trim() || signupEmail;
    if(!email || !$('signupForm').elements.email.checkValidity()) throw Error('Введи корректный email в поле регистрации.');
    unwrap(await db.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectURL()}}));
    message('signupMessage','Запрос на повторное письмо принят. Доставка зависит от настроек почты.');
  });
  $('forgot').onclick=()=>run($('forgot'),'authMessage',async()=>{rateGate('forgot',15000);
    const input=$('authForm').elements.email; if(!input.value || !input.reportValidity()) throw Error('Введи email в поле выше.');
    unwrap(await db.auth.resetPasswordForEmail(input.value.trim(),{redirectTo:redirectURL()}));
    message('authMessage','Если аккаунт с этим адресом существует, придёт ссылка для смены пароля.');
  });
  bindForm('resetForm','resetMessage',async(f,form)=>{
    if(!user) throw Error('Ссылка недействительна или истекла. Запроси восстановление ещё раз.');
    if(f.get('password')!==f.get('confirm')) throw Error('Пароли не совпадают.');
    unwrap(await db.auth.updateUser({password:assertStrongPassword(f.get('password'))})); form.reset();message('resetMessage','Пароль изменён.');$('resetDialog').close();notice('Пароль изменён.');
  });
  $('signOut').onclick=()=>run($('signOut'),'coachMessage',async()=>{try{await endCurrentCall(true);}catch{}try{await touchPresence(false);}catch{}unwrap(await db.auth.signOut());authChanged('SIGNED_OUT',null);page('home');});
}
function bindClient() {
  bindAccountWorkspace();
  $('clientForm').addEventListener('input',()=>{$('clientForm').dataset.dirty='1';$('clientForm').dataset.revision=String(Number($('clientForm').dataset.revision || 0)+1);renderAccountWorkspace();});
  bindForm('clientForm','clientMessage',async(f)=>{
    if(!requireUser('account'))return;
    const actor=user.id,epoch=authEpoch,revision=$('clientForm').dataset.revision;
    const full_name=String(f.get('full_name')||'').trim();
    const phone=String(f.get('phone')||'').trim();
    if(!full_name)throw Error('Введи имя.');
    const saved=unwrap(await db.from('profiles').update({full_name,phone:phone || null}).eq('id',actor).select('id,full_name,phone,role,is_active').single());
    if(epoch!==authEpoch || user?.id!==actor)return;
    profileRecord=saved;if(revision===$('clientForm').dataset.revision)delete $('clientForm').dataset.dirty;message('clientMessage','Данные аккаунта сохранены.');
    if(!own && !$('coachForm').dataset.dirty)$('coachForm').elements.name.value=full_name;
    renderAccountWorkspace();
  });
  $('becomeCoach').onclick=()=>run($('becomeCoach'),'clientMessage',async()=>{await startCoachOnboarding();accountTab='profile';page('account');});
}
function bindCoach() {
  $('coachForm').addEventListener('input',()=>{const form=$('coachForm');form.dataset.dirty='1';form.dataset.revision=String(Number(form.dataset.revision || 0)+1);renderAccountWorkspace();});
  bindForm('coachForm','coachMessage',async(f)=>{
    if(!requireUser('account')) return;
    if(!setupReady) throw Error('Схема базы FitGoIn не готова. Проверь миграции Supabase.');
    const actor=user.id,epoch=authEpoch,revision=$('coachForm').dataset.revision;
    const payload={id:actor};
    for(const name of ['name','sport','goal','format','city','country','period','bio','education','titles','achievements','payment_url']) payload[name]=String(f.get(name)||'').trim();
    if(!payload.name || !payload.sport) throw Error('Заполни имя и вид спорта.');
    payload.price=f.get('price')===''?null:Number(f.get('price'));
    if(payload.price!=null && (!Number.isFinite(payload.price) || payload.price<0 || payload.price>100)) throw Error('Цена должна быть от 0 до 100 €.');
    payload.experience_years=f.get('experience_years')===''?null:Number(f.get('experience_years'));
    payload.languages=f.getAll('languages');payload.availability=f.getAll('availability');payload.published=own?.published===true&&f.has('published');
    if(payload.payment_url && !safeURL(payload.payment_url,true)) throw Error('Допускается только Payment Link вида https://buy.stripe.com/… без параметров после ссылки.');
    if(payload.payment_url)payload.payment_url=safeURL(payload.payment_url,true);
    const saved=unwrap(await db.from('fgi_coaches').upsert(payload,{onConflict:'id'}).select().single());
    if(epoch!==authEpoch) return;
    accountVersion++;own=saved;if(revision===$('coachForm').dataset.revision)delete $('coachForm').dataset.dirty;
    message('coachMessage','Профиль сохранён. Теперь можно загрузить фотографии.');$('mediaEditor').hidden=false;authUI();
    await loadCatalogue();await loadAccount();
    await premium?.coachSaved(payload.published);
  });
  $('coachOverview').onclick=event=>{if(own && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey){event.preventDefault();openProfile(own.id).catch(e=>notice(explain(e)));}};
}
async function prepareImage(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file?.type)) throw Error('Выбери JPEG, PNG или WebP. Для HEIC на iPhone сначала экспортируй фото в JPEG.');
  if(file.size>12*1024*1024) throw Error('Файл больше 12 МБ. Уменьши его перед загрузкой.');
  const url=URL.createObjectURL(file), img=new Image();
  try {
    img.src=url; await img.decode();
    if(img.naturalWidth*img.naturalHeight>50000000) throw Error('Слишком большое разрешение. Уменьши изображение.');
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
    if(!blob || blob.size>4*1024*1024) throw Error('Не удалось подготовить фото до 4 МБ.'); return blob;
  } finally {URL.revokeObjectURL(url);}
}
async function uploadPhoto(file, actor) {
  const blob=await prepareImage(file);if(user?.id!==actor) throw Error('Войди снова перед загрузкой.');
  const path=`${actor}/${crypto.randomUUID()}.jpg`;
  unwrap(await db.storage.from(CONFIG.bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'60'}));return path;
}
async function cleanupPhoto(path) {
  if(!path) return;
  unwrap(await db.storage.from(CONFIG.bucket).remove([path]));
}
function galleryHTML(items, edit) {
  const names={coach:'Мои фото',client:'Результаты клиентов',achievement:'Достижения / сертификаты'};
  return Object.entries(names).map(([kind,title])=>{
    const group=items.filter(i=>i.kind===kind);if(!group.length)return '';
    return `<h3 class="section-small">${title}</h3><div class="gallery">${group.map(i=>`<figure><a href="${esc(mediaURL(i.path))}" target="_blank" rel="noopener noreferrer"><img src="${esc(mediaURL(i.path))}" alt="${esc(i.caption || title)}" loading="lazy"></a><figcaption>${esc(i.caption || '')}</figcaption>${edit?`<button class="text-btn" data-delete-photo="${esc(i.id)}" data-path="${esc(i.path)}">Удалить фото</button>`:''}</figure>`).join('')}</div>`;
  }).join('') || '<p class="muted">Фотографии ещё не добавлены.</p>';
}
async function loadMyGallery() {
  if(!own || !user) return;const epoch=authEpoch,ticket=++galleryEpoch;
  const items=unwrap(await db.from('fgi_media').select('*').eq('coach_id',user.id).order('created_at',{ascending:false}));
  if(epoch===authEpoch && ticket===galleryEpoch) $('myGallery').innerHTML=galleryHTML(items,true);
}
function bindMedia() {
  bindForm('avatarForm','avatarMessage',async(f,form)=>{
    if(!own || !user) throw Error('Сначала сохрани профиль.');
    const actor=user.id,old=own.avatar_path,path=await uploadPhoto(f.get('photo'),actor);
    try {const saved=unwrap(await db.from('fgi_coaches').update({avatar_path:path}).eq('id',actor).select().single());if(user?.id===actor){accountVersion++;own=saved;}}
    catch(e){
      // Ответ мог потеряться после успешной записи. Не удаляем фото, пока не проверим ссылку в базе.
      const check=await db.from('fgi_coaches').select('*').eq('id',actor).maybeSingle();
      if(check.error)throw Error('Не удалось подтвердить сохранение аватара. Обнови кабинет перед повторной загрузкой. Файл: '+path);
      if(check.data?.avatar_path===path){if(user?.id===actor){accountVersion++;own=check.data;}}
      else{try{await cleanupPhoto(path);}catch{throw Error(explain(e)+' Новое фото осталось в хранилище: '+path);}throw e;}
    }
    if(old) {try{await cleanupPhoto(old);}catch{notice('Новый аватар сохранён, но старый файл не удалён. Повтори удаление старого файла через Storage.');}}
    if(user?.id!==actor)return;form.reset();message('avatarMessage','Фото профиля сохранено.');renderAccountWorkspace();await loadCatalogue();
  });
  $('removeAvatar').onclick=()=>run($('avatarForm'),'avatarMessage',async()=>{
    if(!own || !user) throw Error('Сначала сохрани профиль.');
    const actor=user.id; await cleanupPhoto(own.avatar_path);
    const saved=unwrap(await db.from('fgi_coaches').update({avatar_path:null}).eq('id',actor).select().single());
    if(user?.id!==actor)return;accountVersion++;own=saved;
    message('avatarMessage','Фото профиля удалено.');renderAccountWorkspace();await loadCatalogue();
  });
  bindForm('galleryForm','galleryMessage',async(f,form)=>{
    if(!own || !user) throw Error('Сначала сохрани профиль.');
    const files=f.getAll('photos').filter(f=>f.size),actor=user.id,kind=String(f.get('kind'));
    if(!files.length || files.length>6) throw Error('Выбери от 1 до 6 фотографий.');
    if(kind==='client' && !f.has('consent')) throw Error('Для фотографий клиентов нужно их согласие на публикацию.');
    let count=0;
    try {
      for(const file of files){
        const path=await uploadPhoto(file,actor);
        try{unwrap(await db.from('fgi_media').insert({coach_id:actor,path,kind,caption:String(f.get('caption')||'').trim(),consent:f.has('consent')}));}
        catch(e){
          const check=await db.from('fgi_media').select('*').eq('path',path).maybeSingle();
          if(check.error)throw Error('Результат сохранения не подтверждён. Обнови кабинет перед повтором. Файл: '+path);
          if(!check.data){try{await cleanupPhoto(path);}catch{throw Error(explain(e)+' Файл остался в Storage: '+path);}throw e;}
        }
        count++;message('galleryMessage',`Сохранено ${count} из ${files.length}`);
      }
      if(user?.id===actor){form.reset();message('galleryMessage',`Добавлено фотографий: ${count}.`);}
    } catch(e){throw Error(`Сохранено ${count} из ${files.length}. ${explain(e)} Выбери повторно только несохранённые фото.`);}
    finally {if(user?.id===actor)await loadMyGallery();}
  });
}
async function deletePhoto(button) {
  if(!user) throw Error('Войди в аккаунт.');
  button.disabled=true;
  try {
    // Сначала удаляем публичный файл: даже при ошибке удаления записи само фото исчезнет.
    await cleanupPhoto(button.dataset.path);
    unwrap(await db.from('fgi_media').delete().eq('id',button.dataset.deletePhoto).eq('coach_id',user.id).select());
    await loadMyGallery();message('galleryMessage','Фото удалено.');
  } finally {button.disabled=false;}
}
const CHAT_IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const CHAT_VIDEO_TYPES=new Set(['video/mp4','video/webm','video/quicktime']);
const CHAT_AUDIO_TYPES=new Set(['audio/webm','audio/mp4','audio/ogg','audio/mpeg']);
function chatAttachmentMime(file) {
  const raw=String(file?.type||'').split(';')[0].trim().toLowerCase();
  if(CHAT_IMAGE_TYPES.has(raw) || CHAT_VIDEO_TYPES.has(raw) || CHAT_AUDIO_TYPES.has(raw))return raw;
  if(raw==='video/x-m4v')return 'video/mp4';
  const name=String(file?.name||'').toLowerCase();
  if(/\.mov$/.test(name))return 'video/quicktime';
  if(/\.(mp4|m4v)$/.test(name))return 'video/mp4';
  if(/\.webm$/.test(name))return 'video/webm';
  return raw;
}
function clearChatAttachment() {
  if(pendingChatPreviewURL){URL.revokeObjectURL(pendingChatPreviewURL);pendingChatPreviewURL='';}
  pendingChatAttachment=null;pendingChatDurationMs=null;
  if($('chatFile'))$('chatFile').value='';
  if($('chatAttachmentPreview')){$('chatAttachmentPreview').replaceChildren();$('chatAttachmentPreview').hidden=true;}
  if($('clearChatFile'))$('clearChatFile').hidden=true;
}
function showChatAttachment(file,durationMs=null) {
  clearChatAttachment();pendingMessage=null;pendingMessageFile=null;
  if(!file?.size)return;
  const mime=chatAttachmentMime(file);
  if(!CHAT_IMAGE_TYPES.has(mime) && !CHAT_VIDEO_TYPES.has(mime) && !CHAT_AUDIO_TYPES.has(mime))throw Error('Неподдерживаемый тип вложения.');
  if(CHAT_IMAGE_TYPES.has(mime) && file.size>12*1024*1024)throw Error('Фото больше 12 МБ.');
  if(CHAT_VIDEO_TYPES.has(mime) && file.size>50*1024*1024)throw Error('Видео больше 50 МБ. Сейчас это максимальный размер одного файла в FitGoIn.');
  if(CHAT_AUDIO_TYPES.has(mime) && file.size>15*1024*1024)throw Error('Голосовое сообщение больше 15 МБ.');
  pendingChatAttachment=file;pendingChatDurationMs=durationMs;pendingChatPreviewURL=URL.createObjectURL(file);
  const box=$('chatAttachmentPreview');box.hidden=false;
  if(CHAT_IMAGE_TYPES.has(mime)){
    const img=document.createElement('img');img.src=pendingChatPreviewURL;img.alt='Предпросмотр фотографии';box.append(img);
  } else if(CHAT_VIDEO_TYPES.has(mime)){
    const video=document.createElement('video');video.src=pendingChatPreviewURL;video.controls=true;video.preload='metadata';box.append(video);
  } else {
    const audio=document.createElement('audio');audio.src=pendingChatPreviewURL;audio.controls=true;audio.preload='metadata';box.append(audio);
  }
  const meta=document.createElement('p');meta.className='hint';
  const duration=durationMs?` · ${formatVoiceTime(durationMs)}`:'';
  meta.textContent=`${file.name || 'Вложение'} · ${Math.max(1,Math.round(file.size/1024))} КБ${duration}`;box.append(meta);
  $('clearChatFile').hidden=false;
}
function chatFileExtension(mime) {
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','audio/webm':'webm','audio/mp4':'m4a','audio/ogg':'ogg','audio/mpeg':'mp3'})[mime] || 'bin';
}
function formatVoiceTime(ms) {
  const total=Math.max(0,Math.floor(Number(ms||0)/1000)),minutes=Math.floor(total/60),seconds=String(total%60).padStart(2,'0');
  return `${minutes}:${seconds}`;
}
function setVoiceUI(recording) {
  $('voiceStart').hidden=recording;$('voiceStop').hidden=!recording;$('voiceCancel').hidden=!recording;
  if(!recording)$('voiceTimer').textContent='0:00';
}
function stopVoiceTracks(session) {
  session.stream?.getTracks().forEach(track=>track.stop());session.stream=null;
  if(session.tick){clearInterval(session.tick);session.tick=0;}
}
function supportedVoiceMime() {
  if(typeof MediaRecorder==='undefined')return '';
  for(const type of ['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'])if(MediaRecorder.isTypeSupported?.(type))return type;
  return '';
}
async function fixVoiceWebMDuration(blob,durationMs) {
  if(!String(blob.type).startsWith('audio/webm') || !Number.isFinite(durationMs) || durationMs<=0 || blob.size>15*1024*1024)return blob;
  // MediaRecorder may omit WebM Duration. Only edit Info; encoded audio stays untouched.
  // https://www.matroska.org/technical/elements.html (Duration, TimestampScale)
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
  function element(offset,limit=bytes.length) {
    let idLength=1,sizeLength=1;
    while(idLength<=4 && !(bytes[offset] & (0x80>>(idLength-1))))idLength++;
    if(idLength>4 || offset+idLength>=limit)return null;
    const sizeOffset=offset+idLength;
    while(sizeLength<=8 && !(bytes[sizeOffset] & (0x80>>(sizeLength-1))))sizeLength++;
    if(sizeLength>8 || sizeOffset+sizeLength>limit)return null;
    let id=0,size=BigInt(bytes[sizeOffset] & ((0x80>>(sizeLength-1))-1));
    for(let i=0;i<idLength;i++)id=id*256+bytes[offset+i];
    for(let i=1;i<sizeLength;i++)size=size*256n+BigInt(bytes[sizeOffset+i]);
    const unknown=size===(1n<<BigInt(7*sizeLength))-1n,data=sizeOffset+sizeLength;
    if(!unknown && size>BigInt(limit-data))return null;
    return {id,offset,sizeOffset,sizeLength,data,end:unknown?limit:data+Number(size),unknown};
  }
  function sizeBytes(size,width) {
    let value=BigInt(size);
    while(width<=8 && value>=(1n<<BigInt(7*width))-1n)width++;
    if(width>8)return null;
    const result=new Uint8Array(width);
    for(let i=width-1;i>=0;i--){result[i]=Number(value & 255n);value>>=8n;}
    result[0]|=0x80>>(width-1);return result;
  }
  const header=element(0);
  if(header?.id!==0x1a45dfa3 || header.unknown)return blob;
  const segment=element(header.end);
  if(segment?.id!==0x18538067)return blob;
  let info=null,indexed=false;
  for(let p=segment.data;p<segment.end;){
    const entry=element(p,segment.end);if(!entry)return blob;
    if(entry.id===0xbf)return blob;
    if(entry.id===0x1549a966)info=entry;
    if(entry.id===0x114d9b74 || entry.id===0x1c53bb6b)indexed=true;
    if(entry.unknown)break;p=entry.end;
  }
  if(!info || info.unknown)return blob;
  let scale=1000000,duration=null;
  for(let p=info.data;p<info.end;){
    const entry=element(p,info.end);if(!entry || entry.unknown || entry.id===0xbf)return blob;
    if(entry.id===0x2ad7b1){scale=0;for(let i=entry.data;i<entry.end;i++)scale=scale*256+bytes[i];}
    if(entry.id===0x4489)duration=entry;
    p=entry.end;
  }
  if(!Number.isSafeInteger(scale) || scale<=0)return blob;
  const ticks=durationMs*1000000/scale;
  if(duration){
    const length=duration.end-duration.data;if(length!==4 && length!==8)return blob;
    const current=length===4?view.getFloat32(duration.data):view.getFloat64(duration.data);
    if(Number.isFinite(current) && current>0)return blob;
    if(length===4)view.setFloat32(duration.data,ticks);else view.setFloat64(duration.data,ticks);
    return new Blob([bytes],{type:blob.type});
  }
  // Adding bytes would invalidate seek/cue offsets in indexed files. Those are left intact.
  if(indexed)return blob;
  const extra=new Uint8Array(11);extra.set([0x44,0x89,0x88]);new DataView(extra.buffer).setFloat64(3,ticks);
  const infoSize=sizeBytes(info.end-info.data+extra.length,info.sizeLength);
  if(!infoSize)return blob;
  const delta=extra.length+infoSize.length-info.sizeLength;
  if(!segment.unknown){
    const segmentSize=sizeBytes(segment.end-segment.data+delta,segment.sizeLength);
    if(!segmentSize || segmentSize.length!==segment.sizeLength)return blob;
    bytes.set(segmentSize,segment.sizeOffset);
  }
  return new Blob([bytes.subarray(0,info.sizeOffset),infoSize,bytes.subarray(info.data,info.end),extra,bytes.subarray(info.end)],{type:blob.type});
}
function voiceContextIsCurrent(session) {
  return voiceSession===session && !session.cancelled && user?.id===session.actor && activeThread?.id===session.threadId && threadEpoch===session.epoch && authEpoch===session.authEpoch;
}
function finishVoiceSession(session,result) {
  stopVoiceTracks(session);session.resolve(result);
  if(voiceSession===session){voiceSession=null;setVoiceUI(false);}
}
function cancelVoiceRecording() {
  const session=voiceSession;if(!session)return;
  session.cancelled=true;
  if(session.recorder?.state!=='inactive')try{session.recorder?.stop();}catch{}
  finishVoiceSession(session,{cancelled:true});
}
async function stopVoiceRecording() {
  const session=voiceSession;if(!session)return;
  if(!session.recorder)throw Error('Дождись начала записи.');
  if(session.recorder.state!=='inactive'){
    session.stoppedAt=performance.now();session.recorder.stop();message('chatMessage','Готовим голосовое…');
  }
  const result=await session.ready;
  if(result.error)throw result.error;
  return result;
}
async function startVoiceRecording() {
  if(!user || !activeThread)throw Error('Сначала выбери диалог.');
  if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined')throw Error('Запись голосовых не поддерживается этим браузером.');
  if(voiceSession)return;
  clearChatAttachment();pendingMessage=null;pendingMessageFile=null;
  const session={actor:user.id,threadId:activeThread.id,epoch:threadEpoch,authEpoch,chunks:[],cancelled:false};
  session.ready=new Promise(resolve=>session.resolve=resolve);voiceSession=session;
  setVoiceUI(true);message('chatMessage','Подключаем микрофон…');
  try{
    session.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    if(!voiceContextIsCurrent(session)){finishVoiceSession(session,{cancelled:true});return;}
    const mimeType=supportedVoiceMime(),options=mimeType?{mimeType}:undefined,stream=session.stream;
    const recorder=new MediaRecorder(stream,options);session.recorder=recorder;
    recorder.ondataavailable=e=>{if(e.data?.size && !session.cancelled)session.chunks.push(e.data);};
    recorder.onerror=()=>{
      const error=Error('Ошибка записи голоса. Попробуй ещё раз.');
      if(voiceContextIsCurrent(session))message('chatMessage',explain(error),true);
      session.cancelled=true;finishVoiceSession(session,{error});
    };
    recorder.onstop=async()=>{
      const duration=Math.min(300000,Math.max(1,(session.stoppedAt??performance.now())-session.startedAt));
      stopVoiceTracks(session);
      if(!voiceContextIsCurrent(session)){finishVoiceSession(session,{cancelled:true});return;}
      try{
        const type=String(session.chunks[0]?.type || recorder.mimeType || '').split(';')[0].trim().toLowerCase();
        if(!CHAT_AUDIO_TYPES.has(type))throw Error('Формат записи не поддерживается. Попробуй другой браузер.');
        let blob=new Blob(session.chunks,{type});if(!blob.size)throw Error('Запись получилась пустой. Попробуй ещё раз.');
        if(blob.size>15*1024*1024)throw Error('Голосовое сообщение слишком большое.');
        blob=await fixVoiceWebMDuration(blob,duration);
        if(!voiceContextIsCurrent(session)){finishVoiceSession(session,{cancelled:true});return;}
        const file=new File([blob],`voice-${Date.now()}.${chatFileExtension(type)}`,{type});
        showChatAttachment(file,duration);message('chatMessage',$('messageForm').dataset.busy?'Отправляем голосовое…':'Голосовое готово. Нажми «Отправить».');
        finishVoiceSession(session,{file});
      }catch(error){
        if(voiceContextIsCurrent(session))message('chatMessage',explain(error),true);
        finishVoiceSession(session,{error});
      }
    };
    session.startedAt=performance.now();recorder.start();message('chatMessage','Идёт запись… Нажми «Отправить», когда закончишь.');
    session.tick=setInterval(()=>{
      const elapsed=performance.now()-session.startedAt;$('voiceTimer').textContent=formatVoiceTime(elapsed);
      if(elapsed>=300000)stopVoiceRecording().catch(e=>message('chatMessage',explain(e),true));
    },250);
  }catch(error){
    const current=voiceContextIsCurrent(session);finishVoiceSession(session,{error});if(current)throw error;
  }
}
async function prepareChatAttachment(file,durationMs=null) {
  const mime=chatAttachmentMime(file);
  if(CHAT_IMAGE_TYPES.has(mime)){
    const blob=await prepareImage(file);
    return {blob,kind:'image',mime:'image/jpeg',size:blob.size,ext:'jpg',duration_ms:null};
  }
  if(CHAT_VIDEO_TYPES.has(mime)){
    if(file.size>50*1024*1024)throw Error('Видео больше 50 МБ. Сейчас это максимальный размер одного файла в FitGoIn.');
    return {blob:file,kind:'video',mime,size:file.size,ext:chatFileExtension(mime),duration_ms:null};
  }
  if(CHAT_AUDIO_TYPES.has(mime)){
    if(file.size>15*1024*1024)throw Error('Голосовое сообщение больше 15 МБ.');
    return {blob:file,kind:'audio',mime,size:file.size,ext:chatFileExtension(mime),duration_ms:durationMs?Math.min(3600000,Math.max(1,Math.round(durationMs))):null};
  }
  throw Error('Неподдерживаемый тип вложения.');
}
async function uploadChatVideoResumable(file,path,mime) {
  const session=unwrap(await db.auth.getSession()).session;
  if(!session?.access_token)throw Error('Войди снова перед загрузкой видео.');
  const {Upload}=await import('https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm');
  await new Promise((resolve,reject)=>{
    const upload=new Upload(file,{
      endpoint:'https://ypbhcgcwkpiujcakvaji.storage.supabase.co/storage/v1/upload/resumable',
      retryDelays:[0,3000,5000,10000,20000],
      headers:{authorization:`Bearer ${session.access_token}`,apikey:CONFIG.key},
      uploadDataDuringCreation:true,
      removeFingerprintOnSuccess:true,
      chunkSize:6*1024*1024,
      metadata:{bucketName:CONFIG.chatBucket,objectName:path,contentType:mime,cacheControl:'3600'},
      onError:error=>reject(error),
      onProgress:(sent,total)=>{
        if(total>0 && pendingChatAttachment===file){
          const percent=Math.max(1,Math.min(99,Math.round(sent/total*100)));
          message('chatMessage',`Загрузка видео: ${percent}%…`);
        }
      },
      onSuccess:()=>resolve()
    });
    upload.start();
  });
}
async function uploadChatAttachment(file,actor,threadId,durationMs=null) {
  const prepared=await prepareChatAttachment(file,durationMs);
  if(user?.id!==actor || activeThread?.id!==threadId)throw Error('Диалог изменился. Выбери файл заново.');
  const path=`${actor}/${threadId}/${crypto.randomUUID()}.${prepared.ext}`;
  if(prepared.kind==='video')await uploadChatVideoResumable(prepared.blob,path,prepared.mime);
  else unwrap(await db.storage.from(CONFIG.chatBucket).upload(path,prepared.blob,{contentType:prepared.mime,upsert:false,cacheControl:'3600'}));
  return {...prepared,path};
}
async function removeChatAttachment(path) {
  if(!path)return;
  unwrap(await db.storage.from(CONFIG.chatBucket).remove([path]));
}
function clearChatMediaURLs() {
  for(const cached of chatMediaURLs.values())if(cached.blobURL)URL.revokeObjectURL(cached.blobURL);
  chatMediaURLs.clear();
}
async function ensureChatMediaURLs(rows) {
  const now=Date.now(),epoch=threadEpoch,sessionEpoch=authEpoch;let changed=false;
  await Promise.all(rows.filter(m=>m.media_path).map(async m=>{
    const cached=chatMediaURLs.get(m.media_path);
    if(cached && cached.expires>now+60000)return;
    const data=unwrap(await db.storage.from(CONFIG.chatBucket).createSignedUrl(m.media_path,3600));
    if(epoch!==threadEpoch || sessionEpoch!==authEpoch)return;
    chatMediaURLs.set(m.media_path,{...cached,url:data.signedUrl,expires:now+3500000});changed=true;
  }));
  return changed;
}
function chatMediaHTML(m) {
  if(!m.media_path)return '';
  const cached=chatMediaURLs.get(m.media_path),url=(m.kind==='audio' && cached?.blobURL) || cached?.url || '';
  if(!url)return '<span class="chat-media-loading">Вложение загружается…</span>';
  if(m.kind==='image')return `<a class="chat-media-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img class="chat-message-image" src="${esc(url)}" alt="Фото в сообщении" loading="lazy"></a>`;
  if(m.kind==='video')return `<video class="chat-message-video" src="${esc(url)}" controls preload="metadata"></video>`;
  if(m.kind==='audio')return `<audio class="chat-message-audio" src="${esc(url)}" controls preload="metadata"></audio><span class="chat-media-loading" data-audio-status>🎙️ Голосовое${m.duration_ms>0?` · ${formatVoiceTime(Math.max(1000,m.duration_ms))}`:''}</span>`;
  return '';
}
function syncChatAudioSource(audio,m) {
  const cached=chatMediaURLs.get(m.media_path),url=cached?.blobURL || cached?.url;
  if(!url || !audio.paused || audio.getAttribute('src')===url)return;
  const position=audio.currentTime;
  if(position>0)audio.addEventListener('loadedmetadata',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(position,audio.duration);},{once:true});
  audio.src=url;audio.load();
}
function bindChatAudio(audio,m) {
  if(audio.dataset.bound)return;audio.dataset.bound='1';
  const epoch=threadEpoch,sessionEpoch=authEpoch,status=audio.parentElement.querySelector('[data-audio-status]');
  const label=`🎙️ Голосовое${m.duration_ms>0?` · ${formatVoiceTime(Math.max(1000,m.duration_ms))}`:''}`;
  let attempted=false;
  async function repairWebM() {
    if(attempted || m.media_mime!=='audio/webm' || !(m.duration_ms>0) || m.media_size>15*1024*1024)return;
    attempted=true;
    const cached=chatMediaURLs.get(m.media_path);if(!cached || cached.blobURL)return;
    try{
      const response=await timedFetch(cached.url);
      if(!response.ok)throw Error('Не удалось загрузить голосовое.');
      const original=new Blob([await response.blob()],{type:'audio/webm'}),blob=await fixVoiceWebMDuration(original,m.duration_ms);
      if(epoch!==threadEpoch || sessionEpoch!==authEpoch || !audio.isConnected || chatMediaURLs.get(m.media_path)!==cached)return;
      if(blob===original)return;
      cached.blobURL=URL.createObjectURL(blob);syncChatAudioSource(audio,m);
    }catch{if(epoch===threadEpoch && sessionEpoch===authEpoch && audio.isConnected)status.textContent='Не удалось загрузить голосовое. Обнови диалог и попробуй ещё раз.';}
  }
  audio.addEventListener('loadedmetadata',()=>{if(!Number.isFinite(audio.duration) || audio.duration<=0)repairWebM();});
  audio.addEventListener('canplay',()=>status.textContent=label);
  audio.addEventListener('error',()=>{status.textContent='Не удалось воспроизвести голосовое. Обнови диалог и попробуй ещё раз.';repairWebM();});
  audio.addEventListener('pause',()=>syncChatAudioSource(audio,m));
  audio.addEventListener('ended',()=>syncChatAudioSource(audio,m));
}
function callThread(call){return threads.find(t=>t.id===call?.thread_id) || null;}
function callPartnerName(call){const t=callThread(call);return t?threadTitle(t):'Пользователь FitGoIn';}
function callSupported(){return typeof RTCPeerConnection!=='undefined' && Boolean(navigator.mediaDevices?.getUserMedia);}
function stopCallClock(){if(callClock){clearInterval(callClock);callClock=0;}}
function updateCallDuration(){
  if(!currentCall?.answered_at){$('callDuration').textContent='0:00';return;}
  const ms=Math.max(0,Date.now()-new Date(currentCall.answered_at).getTime());
  $('callDuration').textContent=formatVoiceTime(ms);
}
function startCallClock(){stopCallClock();updateCallDuration();callClock=setInterval(updateCallDuration,1000);}
function setCallStatus(text,error=false){$('callStatus').textContent=text;$('callStatus').className=error?'error':'muted';}
function stopCallMedia(){
  callLocalStream?.getTracks().forEach(t=>t.stop());callLocalStream=null;
  if(callPeer){callPeer.onicecandidate=null;callPeer.ontrack=null;callPeer.onconnectionstatechange=null;try{callPeer.close();}catch{}callPeer=null;}
  const audio=$('callRemoteAudio');if(audio){audio.srcObject=null;}
  const remoteVideo=$('callRemoteVideo');if(remoteVideo){remoteVideo.srcObject=null;}
  const localVideo=$('callLocalVideo');if(localVideo){localVideo.srcObject=null;}
  callRemoteIce=[];callSignalLastId=0;callMuted=false;callCameraOff=false;callFacingMode='user';lastCallHeartbeat=0;stopCallClock();
}
function closeCallUI(){
  if($('callDialog')?.open)$('callDialog').close();
  if($('incomingCallDialog')?.open)$('incomingCallDialog').close();
  $('callDialog')?.classList.remove('video-mode');
  $('callVideoStage').hidden=true;$('toggleCamera').hidden=true;$('switchCamera').hidden=true;
  $('muteCall').textContent='🎙️ Выключить микрофон';$('toggleCamera').textContent='📷 Выключить камеру';$('callDuration').textContent='0:00';
}
function cleanupCallLocal(){
  stopCallMedia();currentCall=null;incomingCall=null;closeCallUI();
}
async function sendCallSignal(type,payload,call=currentCall){
  if(!user || !call)throw Error('Звонок уже завершён.');
  unwrap(await db.from('fgi_call_signals').insert({call_id:call.id,sender_id:user.id,signal_type:type,payload}));
}
async function flushCallIce(){
  if(!callPeer?.remoteDescription || !callRemoteIce.length)return;
  const pending=callRemoteIce.splice(0);
  for(const candidate of pending){try{await callPeer.addIceCandidate(candidate);}catch{}}
}
async function processCallSignal(signal){
  if(!currentCall || signal.call_id!==currentCall.id || signal.sender_id===user?.id)return;
  if(signal.signal_type==='answer' && currentCall.caller_id===user.id && !callPeer?.remoteDescription){
    await callPeer.setRemoteDescription(signal.payload);await flushCallIce();return;
  }
  if(signal.signal_type==='offer' && currentCall.callee_id===user.id && !callPeer?.remoteDescription){
    await callPeer.setRemoteDescription(signal.payload);await flushCallIce();return;
  }
  if(signal.signal_type==='ice'){
    if(callPeer?.remoteDescription)await callPeer.addIceCandidate(signal.payload);
    else callRemoteIce.push(signal.payload);
  }
}
async function pollCallSignals(){
  if(!currentCall || !user)return;
  const rows=unwrap(await db.from('fgi_call_signals').select('*').eq('call_id',currentCall.id).gt('id',callSignalLastId).order('id',{ascending:true}).limit(100));
  for(const signal of rows){callSignalLastId=Math.max(callSignalLastId,Number(signal.id)||0);await processCallSignal(signal);}
}
async function waitForCallOffer(callId){
  for(let i=0;i<12;i++){
    const row=unwrap(await db.from('fgi_call_signals').select('*').eq('call_id',callId).eq('signal_type','offer').order('id',{ascending:false}).limit(1).maybeSingle());
    if(row)return row;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Не удалось получить данные звонка. Попроси собеседника позвонить ещё раз.');
}
function createCallPeer(call){
  if(callPeer)try{callPeer.close();}catch{}
  const peer=new RTCPeerConnection({iceServers:CALL_ICE_SERVERS});callPeer=peer;callRemoteIce=[];
  callLocalStream?.getTracks().forEach(track=>peer.addTrack(track,callLocalStream));
  peer.ontrack=event=>{
    const stream=event.streams?.[0] || new MediaStream([event.track]);
    if(call.kind==='video'){
      const video=$('callRemoteVideo');video.srcObject=stream;video.play().catch(()=>{});
    } else {
      const audio=$('callRemoteAudio');audio.srcObject=stream;audio.play().catch(()=>{});
    }
  };
  peer.onicecandidate=event=>{if(event.candidate && currentCall?.id===call.id)sendCallSignal('ice',event.candidate.toJSON?event.candidate.toJSON():event.candidate,call).catch(()=>{});};
  peer.onconnectionstatechange=()=>{
    if(peer.connectionState==='connected')setCallStatus('Разговор');
    else if(peer.connectionState==='connecting')setCallStatus('Соединение…');
    else if(peer.connectionState==='failed')setCallStatus('Не удалось установить прямое соединение. Заверши звонок и попробуй снова.',true);
  };
  return peer;
}
function showActiveCall(call,status='Соединение…'){
  const isVideo=call.kind==='video';
  $('callName').textContent=callPartnerName(call);$('callTitle').textContent=isVideo?'Видеозвонок':'Аудиозвонок';setCallStatus(status);
  $('callVideoStage').hidden=!isVideo;$('toggleCamera').hidden=!isVideo;$('switchCamera').hidden=!isVideo;
  $('callDialog').classList.toggle('video-mode',isVideo);
  if(isVideo && callLocalStream){$('callLocalVideo').srcObject=callLocalStream;$('callLocalVideo').play().catch(()=>{});}
  if(!$('callDialog').open)$('callDialog').showModal();
}
async function startAudioCall(){
  if(!callSupported())throw Error('Аудиозвонки не поддерживаются этим браузером.');
  if(!user || !activeThread)throw Error('Сначала выбери диалог.');
  if(currentCall || incomingCall)throw Error('Сначала заверши текущий звонок.');
  cancelVoiceRecording();
  const actor=user.id,thread=activeThread,callee=counterpartId(thread);
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  try{
    const call=unwrap(await db.from('fgi_calls').insert({thread_id:thread.id,caller_id:actor,callee_id:callee,kind:'audio'}).select().single());
    if(user?.id!==actor){stream.getTracks().forEach(t=>t.stop());return;}
    currentCall=call;callLocalStream=stream;callSignalLastId=0;callMuted=false;lastCallHeartbeat=Date.now();showActiveCall(call,'Вызов…');
    const peer=createCallPeer(call),offer=await peer.createOffer({offerToReceiveAudio:true});await peer.setLocalDescription(offer);
    await sendCallSignal('offer',{type:peer.localDescription.type,sdp:peer.localDescription.sdp},call);
  }catch(e){stream.getTracks().forEach(t=>t.stop());cleanupCallLocal();throw e;}
}
async function startVideoCall(){
  if(!callSupported())throw Error('Видеозвонки не поддерживаются этим браузером.');
  if(!user || !activeThread)throw Error('Сначала выбери диалог.');
  if(currentCall || incomingCall)throw Error('Сначала заверши текущий звонок.');
  cancelVoiceRecording();
  const actor=user.id,thread=activeThread,callee=counterpartId(thread);
  callFacingMode='user';
  const stream=await navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
    video:{facingMode:{ideal:callFacingMode},width:{ideal:1280},height:{ideal:720}}
  });
  try{
    const call=unwrap(await db.from('fgi_calls').insert({thread_id:thread.id,caller_id:actor,callee_id:callee,kind:'video'}).select().single());
    if(user?.id!==actor){stream.getTracks().forEach(t=>t.stop());return;}
    currentCall=call;callLocalStream=stream;callSignalLastId=0;callMuted=false;callCameraOff=false;lastCallHeartbeat=Date.now();showActiveCall(call,'Вызов…');
    const peer=createCallPeer(call),offer=await peer.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});await peer.setLocalDescription(offer);
    await sendCallSignal('offer',{type:peer.localDescription.type,sdp:peer.localDescription.sdp},call);
  }catch(e){stream.getTracks().forEach(t=>t.stop());cleanupCallLocal();throw e;}
}
async function switchCallCamera(){
  if(currentCall?.kind!=='video' || !callLocalStream || !callPeer)throw Error('Переключение камеры доступно только во время видеозвонка.');
  const next=callFacingMode==='user'?'environment':'user';
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:next},width:{ideal:1280},height:{ideal:720}},audio:false});
  const nextTrack=stream.getVideoTracks()[0];if(!nextTrack){stream.getTracks().forEach(t=>t.stop());throw Error('Не удалось открыть другую камеру.');}
  const sender=callPeer.getSenders().find(x=>x.track?.kind==='video');if(!sender){nextTrack.stop();throw Error('Видео ещё не подключено.');}
  const oldTrack=callLocalStream.getVideoTracks()[0];
  await sender.replaceTrack(nextTrack);
  oldTrack?.stop();
  callLocalStream=new MediaStream([...callLocalStream.getAudioTracks(),nextTrack]);
  callFacingMode=next;callCameraOff=false;$('toggleCamera').textContent='📷 Выключить камеру';
  $('callLocalVideo').srcObject=callLocalStream;$('callLocalVideo').play().catch(()=>{});
}
async function acceptIncomingCall(){
  const call=incomingCall;if(!call || !user)throw Error('Вызов уже завершён.');
  if(!callSupported())throw Error('Звонки не поддерживаются этим браузером.');
  const isVideo=call.kind==='video';callFacingMode='user';
  const actor=user.id,stream=await navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
    video:isVideo?{facingMode:{ideal:callFacingMode},width:{ideal:1280},height:{ideal:720}}:false
  });
  try{
    currentCall=call;incomingCall=null;callLocalStream=stream;callSignalLastId=0;callMuted=false;callCameraOff=false;lastCallHeartbeat=Date.now();
    if($('incomingCallDialog').open)$('incomingCallDialog').close();showActiveCall(call,'Подключаемся…');
    const peer=createCallPeer(call),offerSignal=await waitForCallOffer(call.id);
    await peer.setRemoteDescription(offerSignal.payload);await flushCallIce();
    currentCall=unwrap(await db.from('fgi_calls').update({status:'accepted'}).eq('id',call.id).select().single());
    const answer=await peer.createAnswer();await peer.setLocalDescription(answer);
    await sendCallSignal('answer',{type:peer.localDescription.type,sdp:peer.localDescription.sdp},currentCall);
    startCallClock();await pollCallSignals();
  }catch(e){
    stream.getTracks().forEach(t=>t.stop());
    try{await db.from('fgi_calls').update({status:'declined'}).eq('id',call.id);}catch{}
    cleanupCallLocal();throw e;
  }
}
async function declineIncomingCall(){
  const call=incomingCall;if(!call)return;
  incomingCall=null;if($('incomingCallDialog').open)$('incomingCallDialog').close();
  const result=await db.from('fgi_calls').update({status:'declined'}).eq('id',call.id);if(result.error && result.error.code!=='PGRST116')throw result.error;
}
async function endCurrentCall(silent=false){
  const call=currentCall;
  if(call && user && ['ringing','accepted'].includes(call.status)){
    const result=await db.from('fgi_calls').update({status:'ended'}).eq('id',call.id);
    if(result.error && !silent)throw result.error;
  }
  cleanupCallLocal();
}
async function checkIncomingCall(){
  if(!user || currentCall)return;
  if(incomingCall){
    const row=unwrap(await db.from('fgi_calls').select('*').eq('id',incomingCall.id).maybeSingle());
    if(!row || row.status!=='ringing'){incomingCall=null;if($('incomingCallDialog').open)$('incomingCallDialog').close();}
    return;
  }
  if(Date.now()-lastIncomingCallPoll<3000)return;lastIncomingCallPoll=Date.now();
  const since=new Date(Date.now()-90000).toISOString();
  const call=unwrap(await db.from('fgi_calls').select('*').eq('callee_id',user.id).eq('status','ringing').gte('created_at',since).order('created_at',{ascending:false}).limit(1).maybeSingle());
  if(!call)return;
  incomingCall=call;$('incomingCallTitle').textContent=call.kind==='video'?'Входящий видеозвонок':'Входящий аудиозвонок';$('incomingCallName').textContent=callPartnerName(call);
  message('incomingCallMessage','');if(!$('incomingCallDialog').open)$('incomingCallDialog').showModal();
}
async function refreshCurrentCall(){
  if(!currentCall || !user)return;
  const row=unwrap(await db.from('fgi_calls').select('*').eq('id',currentCall.id).maybeSingle());
  if(!row || ['declined','ended','missed'].includes(row.status)){
    const text=row?.status==='declined'?'Звонок отклонён.':row?.status==='missed'?'Нет ответа.':'Звонок завершён.';
    cleanupCallLocal();notice(text);return;
  }
  const was=currentCall.status;currentCall=row;
  if(row.status==='accepted' && was!=='accepted'){setCallStatus('Соединение…');startCallClock();}
  await pollCallSignals();
  if(Date.now()-lastCallHeartbeat>20000){
    lastCallHeartbeat=Date.now();
    const heartbeat=await db.from('fgi_calls').update({status:row.status}).eq('id',row.id).select().single();
    if(!heartbeat.error)currentCall=heartbeat.data;
  }
}
async function pollCallState(){
  if(callPollBusy || !user || !db)return;callPollBusy=true;
  try{if(currentCall)await refreshCurrentCall();else await checkIncomingCall();}catch(e){if(currentCall)message('callMessage',explain(e),true);}
  finally{callPollBusy=false;}
}
async function contact(id) {
  if(!requireUser('contact:'+id))return;
  if(id===user.id){page('inbox');return;}
  const c=coaches.find(c=>c.id===id && !c.legacy); if(!c)throw Error('Сообщения этому тренеру пока недоступны.');
  const actor=user.id;
  let thread=unwrap(await db.from('fgi_threads').select('*').eq('coach_id',id).eq('client_id',actor).maybeSingle());
  if(!thread){
    const result=await db.from('fgi_threads').insert({coach_id:id,client_id:actor,client_name:(String(profileRecord?.full_name || user.user_metadata?.full_name || '').trim() || 'Клиент').slice(0,100)}).select().single();
    if(result.error?.code==='23505')thread=unwrap(await db.from('fgi_threads').select('*').eq('coach_id',id).eq('client_id',actor).single());else thread=unwrap(result);
  }
  if(user?.id!==actor)return;page('inbox');await openThread(thread);
}
function threadTitle(t) {return t.coach_id===user?.id?`${t.client_name || 'Клиент'} · ${t.client_id.slice(0,6)}`:coaches.find(c=>c.id===t.coach_id)?.name || 'Тренер';}
function counterpartId(t) { return t ? (t.coach_id===user?.id?t.client_id:t.coach_id) : ''; }
function presenceState(id) {
  const row=presence.get(id),seen=row?.last_seen_at?new Date(row.last_seen_at).getTime():0;
  return {online:Boolean(row?.online) && seen>0 && Date.now()-seen<PRESENCE_ONLINE_MS,seen};
}
function presenceLabel(id) {
  const state=presenceState(id); if(state.online)return 'Онлайн'; if(!state.seen)return 'Не в сети';
  const diff=Math.max(0,Date.now()-state.seen);
  if(diff<120000)return 'Был(а) недавно';
  if(diff<3600000)return `Был(а) ${Math.max(1,Math.floor(diff/60000))} мин назад`;
  return `Был(а) ${new Date(state.seen).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`;
}
function presenceHTML(id) {
  const state=presenceState(id),label=presenceLabel(id);
  return `<span class="presence-badge ${state.online?'online':'offline'}" title="${esc(label)}"><span class="presence-dot" aria-hidden="true"></span><span>${esc(label)}</span></span>`;
}
function updateActivePresence() {
  const box=$('chatPresence'); if(!box)return;
  if(!activeThread){box.textContent='';box.className='presence-text';return;}
  const id=counterpartId(activeThread),state=presenceState(id);
  box.textContent=presenceLabel(id);box.className=`presence-text ${state.online?'online':'offline'}`;
}
async function loadPresence(force=false) {
  if(!user || !db)return;
  const ids=[...new Set(threads.map(counterpartId).filter(Boolean))];
  if(!ids.length){presence.clear();presenceFetchedAt=Date.now();updateActivePresence();return;}
  if(!force && Date.now()-presenceFetchedAt<10000){updateActivePresence();return;}
  const rows=unwrap(await db.from('fgi_presence').select('user_id,online,last_seen_at').in('user_id',ids));
  presence=new Map(rows.map(row=>[row.user_id,row]));presenceFetchedAt=Date.now();updateActivePresence();
}
async function touchPresence(online=true,actor=user?.id) {
  if(!actor || !db)return;
  unwrap(await db.from('fgi_presence').upsert({user_id:actor,online},{onConflict:'user_id'}));
}
function stopPresenceHeartbeat() {
  if(presenceTimer){clearInterval(presenceTimer);presenceTimer=0;}
}
function startPresenceHeartbeat() {
  stopPresenceHeartbeat(); if(!user || !db)return;
  touchPresence(document.visibilityState==='visible').catch(()=>{});
  presenceTimer=setInterval(()=>{if(user && document.visibilityState==='visible')touchPresence(true).catch(()=>{});},30000);
}

async function loadThreads() {
  if(!user || !db || inboxBusy)return;inboxBusy=true;const epoch=authEpoch;
  try {
    const data=(await allRows('fgi_threads')).sort((a,b)=>(b.updated_at||b.created_at).localeCompare(a.updated_at||a.created_at));
    if(epoch!==authEpoch)return;threads=data;
    try{await loadPresence();}catch{}
    $('threads').innerHTML=data.map(t=>`<button class="thread ${activeThread?.id===t.id?'active':''}" data-thread="${esc(t.id)}"><span class="thread-name">${esc(threadTitle(t))}</span>${presenceHTML(counterpartId(t))}</button>`).join('') || '<p class="muted">Диалогов пока нет. Открой тренера и нажми «Написать».</p>';
    updateActivePresence();
  } finally {inboxBusy=false;}
}
async function openThread(t) {
  cancelVoiceRecording();activeThread=t;chatRows=[];pendingMessage=null;threadEpoch++;clearChatAttachment();clearChatMediaURLs();
  $('messages').replaceChildren();$('messageForm').hidden=false;$('messageForm').reset();$('audioCall').hidden=false;$('videoCall').hidden=false;$('chatTitle').textContent=threadTitle(t);message('chatMessage','');
  try{await loadPresence(true);}catch{} updateActivePresence();
  $('olderMessages').hidden=true;await pollMessages(true);await loadThreads();
}
function drawMessages(stick = false) {
  const box=$('messages'),atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<70;
  const existing=new Map([...box.children].map(node=>[node.dataset.messageId,node]));let cursor=box.firstElementChild;
  for(const m of chatRows){
    const body=m.body?`<div class="message-body">${esc(m.body)}</div>`:'';
    let node=existing.get(String(m.id));
    if(!node){node=document.createElement('div');node.className=`bubble ${m.sender_id===user?.id?'mine':''}`;node.dataset.messageId=String(m.id);}
    if(!node.childElementCount || node.querySelector('.chat-media-loading') && !node.querySelector('[data-audio-status]')){
      node.innerHTML=`${chatMediaHTML(m)}${body}<time datetime="${esc(m.created_at)}">${esc(new Date(m.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</time>`;
    }
    if(node!==cursor)box.insertBefore(node,cursor);cursor=node.nextElementSibling;
    const audio=node.querySelector('audio');if(audio){bindChatAudio(audio,m);syncChatAudioSource(audio,m);}
  }
  while(cursor){const next=cursor.nextElementSibling;cursor.remove();cursor=next;}
  if(stick || atBottom)box.scrollTop=box.scrollHeight;
}
async function pollMessages(initial = false, older = false) {
  if(!activeThread || !user || chatBusy)return;chatBusy=true;
  const id=activeThread.id,epoch=threadEpoch,actor=user.id;
  try {
    let q=db.from('fgi_messages').select('*').eq('thread_id',id);
    if(older && chatRows.length)q=q.lt('id',chatRows[0].id).order('id',{ascending:false}).limit(50);
    else if(!initial && chatRows.length)q=q.gt('id',chatRows.at(-1).id).order('id',{ascending:true}).limit(100);
    else q=q.order('id',{ascending:false}).limit(50);
    const rows=unwrap(await q);
    if(epoch!==threadEpoch || actor!==user?.id)return;
    const box=$('messages'),height=box.scrollHeight,top=box.scrollTop;
    chatRows=[...new Map([...chatRows,...rows].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id);
    let mediaChanged=false;
    try{mediaChanged=await ensureChatMediaURLs(chatRows);}catch(e){message('chatMessage','Не удалось загрузить одно из вложений. '+explain(e),true);}
    if(epoch!==threadEpoch || actor!==user?.id)return;
    if(rows.length || initial || mediaChanged)drawMessages(initial);
    if(older)box.scrollTop=top+(box.scrollHeight-height);
    if(initial || older)$('olderMessages').hidden=rows.length<50;
    if($('chatMessage').dataset.pollError){message('chatMessage','');delete $('chatMessage').dataset.pollError;}
  } catch(e) {if(epoch===threadEpoch){message('chatMessage',explain(e),true);$('chatMessage').dataset.pollError='1';}}
  finally {chatBusy=false;}
}
function bindChat() {
  $('refreshThreads').onclick=()=>loadThreads().catch(e=>message('chatMessage',explain(e),true));
  $('audioCall').onclick=()=>startAudioCall().catch(e=>message('chatMessage',explain(e),true));
  $('videoCall').onclick=()=>startVideoCall().catch(e=>message('chatMessage',explain(e),true));
  $('acceptCall').onclick=async()=>{const b=$('acceptCall');b.disabled=true;try{await acceptIncomingCall();}catch(e){message('incomingCallMessage',explain(e),true);}finally{b.disabled=false;}};
  $('declineCall').onclick=()=>declineIncomingCall().catch(e=>message('incomingCallMessage',explain(e),true));
  $('endCall').onclick=()=>endCurrentCall().catch(e=>message('callMessage',explain(e),true));
  $('muteCall').onclick=()=>{if(!callLocalStream)return;callMuted=!callMuted;callLocalStream.getAudioTracks().forEach(t=>t.enabled=!callMuted);$('muteCall').textContent=callMuted?'🎙️ Включить микрофон':'🎙️ Выключить микрофон';};
  $('toggleCamera').onclick=()=>{if(currentCall?.kind!=='video' || !callLocalStream)return;callCameraOff=!callCameraOff;callLocalStream.getVideoTracks().forEach(t=>t.enabled=!callCameraOff);$('toggleCamera').textContent=callCameraOff?'📷 Включить камеру':'📷 Выключить камеру';};
  $('switchCamera').onclick=()=>switchCallCamera().catch(e=>message('callMessage',explain(e),true));
  $('olderMessages').onclick=()=>pollMessages(false,true);
  $('chatFile').addEventListener('change',e=>{try{showChatAttachment(e.target.files?.[0]);message('chatMessage','');}catch(err){clearChatAttachment();message('chatMessage',explain(err),true);}});
  $('clearChatFile').onclick=()=>clearChatAttachment();
  $('voiceStart').onclick=()=>startVoiceRecording().catch(e=>message('chatMessage',explain(e),true));
  $('voiceStop').onclick=()=>stopVoiceRecording().catch(e=>message('chatMessage',explain(e),true));
  $('voiceCancel').onclick=()=>{cancelVoiceRecording();message('chatMessage','Запись отменена.');};
  bindForm('messageForm','chatMessage',async(f,form)=>{
    if(!user || !activeThread)throw Error('Выбери диалог.');
    const actor=user.id,thread=activeThread.id,epoch=threadEpoch,sessionEpoch=authEpoch;
    const recording=await stopVoiceRecording();
    if(recording?.cancelled || epoch!==threadEpoch || sessionEpoch!==authEpoch || actor!==user?.id || thread!==activeThread?.id)return;
    const body=String(f.get('body')).trim(),file=pendingChatAttachment;
    if(!body && !file)throw Error('Напиши сообщение, добавь файл или запиши голосовое.');
    if(!pendingMessage || pendingMessage.body!==body || pendingMessage.thread_id!==thread || pendingMessageFile!==file){
      let media=null;
      if(file)media=await uploadChatAttachment(file,actor,thread,pendingChatDurationMs);
      if(epoch!==threadEpoch || sessionEpoch!==authEpoch || actor!==user?.id || thread!==activeThread?.id){if(media?.path)try{await removeChatAttachment(media.path);}catch{}return;}
      pendingMessageFile=file || null;
      pendingMessage={
        client_nonce:crypto.randomUUID(),thread_id:thread,sender_id:actor,body,
        kind:media?.kind || 'text',media_path:media?.path || null,media_mime:media?.mime || null,
        media_size:media?.size || null,duration_ms:media?.duration_ms || null
      };
    }
    const result=await db.from('fgi_messages').insert(pendingMessage).select().single();
    let row;
    if(result.error){
      if(result.error.code==='23505')row=unwrap(await db.from('fgi_messages').select('*').eq('client_nonce',pendingMessage.client_nonce).single());
      else{
        const check=await db.from('fgi_messages').select('*').eq('client_nonce',pendingMessage.client_nonce).maybeSingle();
        if(check.error)throw Error('Не удалось подтвердить отправку. Обнови чат перед повтором.');
        if(check.data)row=check.data;
        else{
          const path=pendingMessage.media_path;pendingMessage=null;pendingMessageFile=null;
          if(path){try{await removeChatAttachment(path);}catch{}}
          throw result.error;
        }
      }
    } else row=result.data;
    if(epoch!==threadEpoch || actor!==user?.id)return;
    pendingMessage=null;pendingMessageFile=null;form.reset();clearChatAttachment();message('chatMessage','Отправлено.');
    // Не добавляем строку перед опросом: иначе можно пропустить одновременное сообщение собеседника.
    await pollMessages(chatRows.length===0); if(!chatRows.some(m=>m.id===row.id))await pollMessages();
  });
  setInterval(()=>{if(document.visibilityState==='visible' && currentPage==='inbox' && user){pollMessages();loadThreads().catch(e=>message('chatMessage',explain(e),true));}},4000);
  setInterval(()=>{if(document.visibilityState==='visible' && user)pollCallState();},800);
}
function bindUI() {
  $('menu').onclick=()=>{$('nav').classList.toggle('open');$('menu').setAttribute('aria-expanded',String($('nav').classList.contains('open')));};
  $('authOpen').onclick=()=>{pendingAction='';if(user)page('account');else $('authDialog').showModal();};
  $('clientSignupOpen').onclick=()=>openSignup('client');
  $('accountOpen').onclick=()=>{try{if(user&&coachWorkspaceActive()&&own)openProfile(own.id).catch(e=>notice(explain(e)));else if(user)page(coachWorkspaceActive()?'account':premium?.startPage()||'dashboard');else openSignup('coach');}catch(e){notice(explain(e));}};
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    Promise.resolve().then(async()=>{
      if(b.hasAttribute('data-background-pause')){backgroundPaused=!backgroundPaused;scheduleBackgroundRotation();}
      if(b.dataset.page){if(b.dataset.page==='signup')openSignup('client');else page(b.dataset.page);}
      if(b.dataset.action==='login')$('authDialog').showModal();
      if(b.hasAttribute('data-close'))b.closest('dialog').close();
      if(b.dataset.sport){$('sportFilter').value=b.dataset.sport;page('coaches');renderCatalogue();}
      if(b.dataset.matchSport){resetMatchWizard(true);$('matchSport').value=b.dataset.matchSport;matchStep=1;updateMatchWizard();page('match');}
      if(b.dataset.profile)await openProfile(b.dataset.profile);
      if(b.dataset.contact){if(b.dataset.busy)return;b.dataset.busy='1';b.disabled=true;try{await contact(b.dataset.contact);}finally{delete b.dataset.busy;b.disabled=false;}}
      if(b.dataset.thread){const t=threads.find(t=>t.id===b.dataset.thread);if(t)await openThread(t);}
      if(b.dataset.deletePhoto)await deletePhoto(b);
    }).catch(e=>notice(explain(e)));
  });
  document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const box=document.createElement('div');box.className='initials';box.textContent='Фото недоступно';box.style.fontSize='18px';e.target.replaceWith(box);}},true);
  $('search').oninput=renderCatalogue;$('sportFilter').onchange=renderCatalogue;$('formatFilter').onchange=renderCatalogue;
  $('matchPrev').onclick=()=>moveMatchStep(-1);$('matchNext').onclick=()=>moveMatchStep(1);
  $('matchForm').onsubmit=e=>{e.preventDefault();findMatch(e.target).catch(e=>notice(explain(e)));};
  opt($('matchLanguage'),Object.entries(langs),'Не важно');
  $('coachLanguages').innerHTML=Object.entries(langs).map(([id,name])=>`<label class="check"><input type="checkbox" name="languages" value="${id}">${name}</label>`).join('');
  $('goals').innerHTML=goals.map(g=>`<option value="${esc(g)}"></option>`).join('');
  opt($('matchGoal'),goals.map(g=>[g,g]),'Пока не решил');
  window.addEventListener('popstate',()=>{const query=new URLSearchParams(location.search),trainer=query.get('trainer');if(trainer){openProfile(trainer,false).catch(e=>notice(explain(e)));return;}const target=location.hash.slice(1);if(target==='signup')setSignupRole(query.get('signup'));try{page($(target)?.classList.contains('page')?target:'home',false);}catch(e){notice(explain(e));}});
  document.addEventListener('visibilitychange',()=>{if(!user || !db)return;if(document.visibilityState==='visible')startPresenceHeartbeat();else{stopPresenceHeartbeat();touchPresence(false).catch(()=>{});}});
  document.addEventListener('visibilitychange',scheduleBackgroundRotation);
  backgroundMotion.addEventListener('change',event=>{backgroundPaused=event.matches;scheduleBackgroundRotation();});
  sports=directions.map(d=>({id:d[0],name:d[1]}));renderSports();renderCatalogue();updateMatchWizard();
}
async function init() {
  const callback=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
  const callbackError=callback.get('error_description') || query.get('error_description');
  const requestedPage=location.hash.slice(1); // Считываем до обработки Auth SDK.
  const requestedTrainer=query.get('trainer');
  setSignupRole(query.get('signup'));
  bindUI();bindAuth();bindClient();bindCoach();bindMedia();bindChat();
  premium=mountPremium({getDB:()=>db,getUser:()=>user,getProfile:()=>profileRecord,getCoach:()=>own,getPage:()=>currentPage,getAccountTab:()=>accountTab,setAccountTab,
    getMatchStep:()=>matchStep,setMatchStep:value=>{matchStep=Number(value)||0;updateMatchWizard();},signup:openSignup,navigate:page,notice,explain,
    openOwn:()=>openProfile(user.id),reload:async()=>{await loadCatalogue();await loadAccount();}});
  notice('Подключаем FitGoIn…');
  try {
    const {createClient}=await import(CONFIG.sdk);
    db=createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'},global:{fetch:timedFetch}});
    aiAssistant=mountFitGoInAI($('fitgoinAI'),{
      getDB:()=>db,getUser:()=>user,endpoint:CONFIG.url+'/functions/v1/fitgoin-ai',
      login:()=>requireUser('ai'),navigate:page,prepareImage,openCoach:openProfile,contact,
      savedIds:()=>premium.savedIds(),toggleSaved:id=>premium.toggleSaved(id),clearSaved:()=>premium.clearSaved(),
      sports:()=>directions.map(([key,name])=>[key,name]),coachName:id=>coaches.find(c=>c.id===id)?.name||'Тренер',
      matches:p=>coaches.filter(publicOnly).filter(c=>c.id!==user?.id).map(coach=>({coach,match:calculateMatch(coach,{...p,budget:p.budget??''})})).filter(x=>x.match)
        .sort((a,b)=>b.match.percent-a.match.percent||Number(b.coach.rating||0)-Number(a.coach.rating||0)||Number(b.coach.score||0)-Number(a.coach.score||0)).slice(0,3)
    });
    db.auth.onAuthStateChange(authChanged); // Callback синхронный: никаких вложенных вызовов Supabase Auth.
    const data=unwrap(await db.auth.getSession());user=data.session?.user || null;premium.setSession(user);authUI();aiAssistant.setSession(user);if(user)startPresenceHeartbeat();
    await loadCatalogue();
    if(callbackError){closeDialogs();$('authDialog').showModal();message('authMessage','Ссылка недействительна: '+callbackError,true);history.replaceState(null,'',redirectURL());}
    else if(callback.get('type')==='recovery' && user){closeDialogs();$('resetDialog').showModal();}
    else if(requestedTrainer) await openProfile(requestedTrainer,false);
    else if($(requestedPage)?.classList.contains('page'))page(requestedPage,false);
    if(user){
      await loadAccount();
      if(!coachWorkspaceActive()&&user.user_metadata?.signup_intent==='coach')await startCoachOnboarding();
      if(!callbackError&&callback.get('type')!=='recovery'&&!requestedTrainer){
        if(!requestedPage||callback.get('type')==='signup'){if(own&&coachWorkspaceActive())await openProfile(own.id);else page(premium.startPage());}
        else page(requestedPage,false);
      }
    }
  } catch(e){notice('Не удалось подключить все функции. '+explain(e));}
}
init();


/* Database schema is managed by Supabase migrations in supabase/migrations/. */
