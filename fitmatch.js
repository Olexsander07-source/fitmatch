/* FitGoIn production frontend.
   Здесь используется только публичный ключ. Никогда не вставляйте service_role или Stripe secret key. */
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
let db, user = null, own = null, sports = [], coaches = [], threads = [], activeThread = null;
let currentPage = 'home', pendingAction = '', authEpoch = 0, catalogueEpoch = 0, threadEpoch = 0;
let chatRows = [], pendingMessage = null, chatBusy = false, inboxBusy = false, signupEmail = '';
let pendingChatAttachment = null, pendingChatPreviewURL = '', chatMediaURLs = new Map();
let presence = new Map(), presenceFetchedAt = 0, presenceTimer = 0;
const PRESENCE_ONLINE_MS = 75000;
let phoneMode = 'login', pendingPhone = '', pendingPhoneName = '', phoneResendUntil = 0, phoneTimer = 0;
let catalogueError = '', setupReady = false, visibleProfile = '', galleryEpoch = 0, accountVersion = 0;
const publicOnly = c => c.published !== false;
const sportName = id => sports.find(s => String(s.id) === String(id))?.name || String(id || 'Спорт не указан');
function sportKey(id) {
  const value = norm(sportName(id));
  const aliases = {'бокс':'combat','boxing':'combat','mma':'combat','велосипед':'cycling'};
  return aliases[value] || directions.find(d => d.slice(0,3).some(v => norm(v) === value))?.[0] || norm(id);
}
function sportImage(id) {
  const d = directions.find(d => d[0] === sportKey(id)) || directions[1];
  return `https://images.unsplash.com/photo-${d[3]}?auto=format&fit=crop&w=1000&q=80`;
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
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); }
function page(id, push = true) {
  if (!$(id)?.classList.contains('page')) id = 'home';
  if (['account','inbox'].includes(id) && !requireUser(id)) return;
  closeDialogs(); currentPage = id;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  $('nav').classList.remove('open'); $('menu').setAttribute('aria-expanded','false');
  if (push) {
    const u=new URL(location.href);u.searchParams.delete('trainer');u.hash=id==='home'?'':`#${id}`;
    history.pushState({page:id},'',u.pathname+u.search+u.hash);
  }
  window.scrollTo({top:0,behavior:'instant'});
  if (id === 'inbox') loadThreads().catch(e => message('chatMessage',explain(e),true));
  if (id === 'account') loadAccount().catch(e => message('coachMessage',explain(e),true));
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
  opt($('matchGoal'),allGoals.map(g=>[g,g]),'Любая цель');
  if(catalogueError) notice(catalogueError); else notice('');
}
function formatFits(c, wanted) { return !wanted || c.format === wanted || c.format === 'Онлайн и офлайн'; }
function card(c, match) {
  return `<article class="coach-card">${photoHTML(c)}${match?`<div class="match-badge">${match.percent}% MATCH</div>`:''}<div class="card-body"><h3>${esc(c.name || 'Тренер')}</h3><p>${esc(sportName(c.sport))} · ${esc(c.city || c.format || '')}</p><div class="tags">${[c.goal,c.format,c.verified?'✓ Проверен':null,Number(c.score)>0?'Баллы профиля: '+Number(c.score):null].filter(Boolean).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="card-bottom"><span>${Number(c.rating)>0?`★ ${Number(c.rating).toFixed(1)}`:'Пока без рейтинга'}</span><span>${esc(priceText(c))}</span></div>${match?`<ul class="match-reasons">${match.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:''}<button class="btn" data-profile="${esc(c.id)}">Открыть профиль ↗</button></div></article>`;
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
function calculateMatch(c, p) {
  if(sportKey(c.sport)!==sportKey(p.sport)) return null;
  let earned=40,total=40; const reasons=['✓ Спорт совпадает'];
  const criteria=[
    [p.goal,30,parts(c.goal).includes(norm(p.goal)),'Цель'],[p.format,25,formatFits(c,p.format),'Формат'],
    [p.language,20,c.languages.includes(p.language),'Язык'],
    [p.city,15,norm(c.city)===norm(p.city) && c.format!=='Онлайн','Город / очные занятия'],
    [p.budget!==''?true:false,10,c.price!=null && c.period===p.period && c.price<=Number(p.budget),'Бюджет и период']
  ];
  for(const [selected,weight,ok,label] of criteria) if(selected){ total+=weight; if(ok)earned+=weight; reasons.push(`${ok?'✓':'—'} ${label}${ok?' совпадает':' не совпадает или не указан'}`); }
  return {percent:Math.min(100,Math.round(earned/total*100)),reasons};
}
function findMatch(form) {
  const p=Object.fromEntries(new FormData(form));
  if(p.city && p.format==='Онлайн') {notice('Для онлайн-тренировок убери город или выбери очный формат.');return;}
  notice('');
  const ranked=coaches.filter(publicOnly).map(c=>({c,m:calculateMatch(c,p)})).filter(x=>x.m).sort((a,b)=>b.m.percent-a.m.percent);
  $('matchResults').innerHTML=ranked.map(x=>card(x.c,x.m)).join('') || `<p class="empty">${esc(catalogueError || 'Тренеров по этому спорту пока нет.')}</p>`;
}
async function openProfile(id, push = true) {
  const c=coaches.find(c=>c.id===id); if(!c) throw Error('Профиль не найден. Обнови каталог.');
  visibleProfile=id; page('profile',false);
  if(push){const u=new URL(location.href);u.searchParams.set('trainer',id);u.hash='';history.pushState({page:'profile',profile:id},'',u.pathname+u.search);}
  const payment=safeURL(c.payment_url,true);
  $('profileContent').innerHTML=`<button class="text-btn" data-page="coaches">← К тренерам</button><article class="profile-layout"><div class="portrait">${photoHTML(c)}</div><div class="profile-info"><p class="eyebrow">FITGOIN · ${esc(sportName(c.sport))}</p><h1>${esc(c.name)}</h1><p>${esc([c.city,c.country].filter(Boolean).join(', '))} · ${esc(c.format || '')}</p><div class="tags">${c.languages.map(l=>`<span class="tag">${esc(langs[l] || l)}</span>`).join('')}${c.verified?'<span class="tag">✓ Проверен</span>':''}</div><h2>${esc(priceText(c))}</h2><div class="actions">${!c.legacy?`<button class="btn primary" data-contact="${esc(c.id)}">Написать тренеру ↗</button>`:'<p class="hint">Этот тренер ещё не подключил сообщения в новой версии.</p>'}${c.id===user?.id?'<button class="btn" data-page="account">Редактировать</button>':''}</div>${payment?`<p class="section-small"><a class="btn" href="${esc(payment)}" target="_blank" rel="noopener noreferrer">${new URL(payment).pathname.startsWith('/test_')?'Тестовая оплата Stripe':'Оплатить у тренера'} ↗</a></p><p class="hint">Ссылку добавил тренер. Проверь продавца, услугу, сумму и период на странице Stripe. Подтверждение платежа приходит от Stripe; здесь статус оплаты не отслеживается.</p>`:'<p class="hint">Онлайн-оплата пока не подключена. Обсуди стоимость с тренером.</p>'}<h3 class="section-small">О тренере</h3><p class="multiline">${esc(c.bio || 'Описание пока не добавлено.')}</p><p>Опыт: ${c.experience_years==null?'не указан':esc(c.experience_years)+' лет'}</p>${[['Цели / специализация',c.goal],['Образование',c.education],['Титулы',c.titles],['Достижения',c.achievements]].map(([t,v])=>v?`<h3>${t}</h3><p class="multiline">${esc(v)}</p>`:'').join('')}<p class="hint">Достижения и титулы указаны тренером. Рейтинг: ${Number(c.rating)>0?Number(c.rating).toFixed(1):'ещё не сформирован'}.</p></div></article><div id="profileGallery" class="section-small"></div>`;
  if(!c.legacy) {
    try { const items=unwrap(await db.from('fgi_media').select('*').eq('coach_id',c.id).order('created_at',{ascending:false})); if(visibleProfile===id && $('profileGallery')) $('profileGallery').innerHTML=galleryHTML(items,false); }
    catch(e){if(visibleProfile===id && $('profileGallery')) $('profileGallery').textContent=explain(e);}
  }
}
function authUI() { $('authOpen').textContent=user?'Кабинет':'Войти'; $('accountOpen').textContent=user?'Мой профиль':'Стать тренером'; $('accountEmail').textContent=user?.email || user?.phone || ''; }
function authChanged(event, session) {
  const previous=user,next=session?.user || null, changed=user?.id!==next?.id;
  user=next; authUI();
  if(changed){authEpoch++;threadEpoch++;catalogueEpoch++;own=null;activeThread=null;threads=[];chatRows=[];pendingMessage=null;visibleProfile='';presence.clear();presenceFetchedAt=0;
    $('threads').replaceChildren();$('messages').replaceChildren();$('myGallery').replaceChildren();$('profileContent').replaceChildren();$('chatTitle').textContent='Выбери диалог';$('chatPresence').textContent='';$('messageForm').hidden=true;$('messageForm').reset();clearChatAttachment();chatMediaURLs.clear();$('coachForm').reset();delete $('coachForm').dataset.dirty;$('mediaEditor').hidden=true;
    stopPresenceHeartbeat();if(user)setTimeout(startPresenceHeartbeat,0);
    if(!user){coaches=coaches.filter(publicOnly);if(['account','inbox','profile'].includes(currentPage)) page('home');}
    setTimeout(()=>{loadCatalogue().then(()=>user?loadAccount():null).catch(e=>notice(explain(e)));},0);
  }
  if(event==='PASSWORD_RECOVERY') {pendingAction='';closeDialogs();$('resetDialog').showModal();}
}
async function afterLogin() {
  closeDialogs(); const action=pendingAction; pendingAction='';
  await loadCatalogue(); await loadAccount();
  if(action.startsWith('contact:')) await contact(action.slice(8)); else page(action || 'account');
}
function redirectURL() { return location.origin+location.pathname; } // Сохраняет /имя-репозитория/ GitHub Pages.
async function loadAccount() {
  if(!user) return; const epoch=authEpoch, id=user.id, version=++accountVersion;
  const record=unwrap(await db.from('fgi_coaches').select('*').eq('id',id).maybeSingle());
  if(epoch!==authEpoch || version!==accountVersion) return; own=record;
  const form=$('coachForm');
  if(form.dataset.dirty || form.dataset.busy) return; // Не затирать уже начатое редактирование поздним ответом.
  for(const [name,control] of Object.entries(Object.fromEntries([...form.elements].filter(e=>e.name).map(e=>[e.name,e])))) {
    if(name==='languages') continue;
    if(control.type==='checkbox') control.checked=record?.[name] ?? true;
    else control.value=record?.[name] ?? (name==='name'?user.user_metadata?.full_name || '':name==='format'?'Онлайн':name==='period'?'занятие':'');
  }
  if(record?.sport && ![...$('coachSport').options].some(o=>o.value===record.sport)) $('coachSport').add(new Option(sportName(record.sport),record.sport));
  if(record) $('coachSport').value=record.sport;
  form.querySelectorAll('[name=languages]').forEach(i=>i.checked=record?.languages?.includes(i.value) || false);
  $('mediaEditor').hidden=!record; $('myProfile').hidden=!record;
  if(record) await loadMyGallery();
}
const actionTimes=new Map();
function rateGate(key, wait=10000) {
  const now=Date.now(),last=actionTimes.get(key)||0;
  if(now-last<wait) throw Error('Подожди несколько секунд перед повторной попыткой.');
  actionTimes.set(key,now);
}
function assertStrongPassword(value) {
  const password=String(value || '');
  const strong=password.length>=12 && /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password) && /\p{N}/u.test(password) && /[\p{P}\p{S}]/u.test(password);
  if(!strong) throw Error('Пароль: минимум 12 символов, строчная и заглавная буква, цифра и специальный знак.');
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
  if(phoneMode==='signup') options.data={full_name:name};
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
    const data=unwrap(await db.auth.signUp({email:signupEmail,password:assertStrongPassword(f.get('password')),options:{emailRedirectTo:redirectURL(),data:{full_name:name}}}));
    form.elements.password.value='';
    if(data.session){user=data.user;authUI();message('signupMessage','Аккаунт создан.');await afterLogin();}
    else message('signupMessage','Запрос принят. Если адрес можно зарегистрировать, придёт письмо со ссылкой подтверждения. Проверь входящие и спам. Если аккаунт уже есть — войди или восстанови пароль.');
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
  $('signOut').onclick=()=>run($('signOut'),'coachMessage',async()=>{try{await touchPresence(false);}catch{}unwrap(await db.auth.signOut());authChanged('SIGNED_OUT',null);page('home');});
}
function bindCoach() {
  $('coachForm').addEventListener('input',()=>{$('coachForm').dataset.dirty='1';});
  bindForm('coachForm','coachMessage',async(f)=>{
    if(!requireUser('account')) return;
    if(!setupReady) throw Error('Схема базы FitGoIn не готова. Проверь миграции Supabase.');
    const actor=user.id,epoch=authEpoch;
    const payload={id:actor};
    for(const name of ['name','sport','goal','format','city','country','period','bio','education','titles','achievements','payment_url']) payload[name]=String(f.get(name)||'').trim();
    if(!payload.name || !payload.sport) throw Error('Заполни имя и вид спорта.');
    payload.price=f.get('price')===''?null:Number(f.get('price'));
    if(payload.price!=null && (!Number.isFinite(payload.price) || payload.price<0 || payload.price>100)) throw Error('Цена должна быть от 0 до 100 €.');
    payload.experience_years=f.get('experience_years')===''?null:Number(f.get('experience_years'));
    payload.languages=f.getAll('languages');payload.published=f.has('published');
    if(payload.payment_url && !safeURL(payload.payment_url,true)) throw Error('Допускается только Payment Link вида https://buy.stripe.com/… без параметров после ссылки.');
    if(payload.payment_url)payload.payment_url=safeURL(payload.payment_url,true);
    const saved=unwrap(await db.from('fgi_coaches').upsert(payload,{onConflict:'id'}).select().single());
    if(epoch!==authEpoch) return;
    accountVersion++;own=saved;delete $('coachForm').dataset.dirty;
    message('coachMessage','Профиль сохранён. Теперь можно загрузить фотографии.');$('mediaEditor').hidden=false;$('myProfile').hidden=false;
    await loadCatalogue();await loadMyGallery();
  });
  $('myProfile').onclick=()=>{if(own) openProfile(own.id).catch(e=>notice(explain(e)));};
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
    if(user?.id!==actor)return;form.reset();message('avatarMessage','Фото профиля сохранено.');await loadCatalogue();
  });
  $('removeAvatar').onclick=()=>run($('avatarForm'),'avatarMessage',async()=>{
    if(!own || !user) throw Error('Сначала сохрани профиль.');
    const actor=user.id; await cleanupPhoto(own.avatar_path);
    const saved=unwrap(await db.from('fgi_coaches').update({avatar_path:null}).eq('id',actor).select().single());
    if(user?.id!==actor)return;accountVersion++;own=saved;
    message('avatarMessage','Аватар удалён.');await loadCatalogue();
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
function clearChatAttachment() {
  if(pendingChatPreviewURL){URL.revokeObjectURL(pendingChatPreviewURL);pendingChatPreviewURL='';}
  pendingChatAttachment=null;
  if($('chatFile'))$('chatFile').value='';
  if($('chatAttachmentPreview')){$('chatAttachmentPreview').replaceChildren();$('chatAttachmentPreview').hidden=true;}
  if($('clearChatFile'))$('clearChatFile').hidden=true;
}
function showChatAttachment(file) {
  clearChatAttachment();
  if(!file?.size)return;
  if(!CHAT_IMAGE_TYPES.has(file.type) && !CHAT_VIDEO_TYPES.has(file.type))throw Error('Можно отправлять JPEG, PNG, WebP, MP4, WebM или MOV.');
  if(CHAT_IMAGE_TYPES.has(file.type) && file.size>12*1024*1024)throw Error('Фото больше 12 МБ.');
  if(CHAT_VIDEO_TYPES.has(file.type) && file.size>50*1024*1024)throw Error('Видео больше 50 МБ.');
  pendingChatAttachment=file;pendingChatPreviewURL=URL.createObjectURL(file);
  const box=$('chatAttachmentPreview');box.hidden=false;
  if(CHAT_IMAGE_TYPES.has(file.type)){
    const img=document.createElement('img');img.src=pendingChatPreviewURL;img.alt='Предпросмотр фотографии';box.append(img);
  } else {
    const video=document.createElement('video');video.src=pendingChatPreviewURL;video.controls=true;video.preload='metadata';box.append(video);
  }
  const meta=document.createElement('p');meta.className='hint';meta.textContent=`${file.name || 'Вложение'} · ${Math.max(1,Math.round(file.size/1024))} КБ`;box.append(meta);
  $('clearChatFile').hidden=false;
}
function chatFileExtension(mime) {
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','audio/webm':'webm','audio/mp4':'m4a','audio/ogg':'ogg','audio/mpeg':'mp3'})[mime] || 'bin';
}
async function prepareChatAttachment(file) {
  if(CHAT_IMAGE_TYPES.has(file?.type)){
    const blob=await prepareImage(file);
    return {blob,kind:'image',mime:'image/jpeg',size:blob.size,ext:'jpg',duration_ms:null};
  }
  if(CHAT_VIDEO_TYPES.has(file?.type)){
    if(file.size>50*1024*1024)throw Error('Видео больше 50 МБ.');
    return {blob:file,kind:'video',mime:file.type,size:file.size,ext:chatFileExtension(file.type),duration_ms:null};
  }
  throw Error('Неподдерживаемый тип вложения.');
}
async function uploadChatAttachment(file,actor,threadId) {
  const prepared=await prepareChatAttachment(file);
  if(user?.id!==actor || activeThread?.id!==threadId)throw Error('Диалог изменился. Выбери файл заново.');
  const path=`${actor}/${threadId}/${crypto.randomUUID()}.${prepared.ext}`;
  unwrap(await db.storage.from(CONFIG.chatBucket).upload(path,prepared.blob,{contentType:prepared.mime,upsert:false,cacheControl:'3600'}));
  return {...prepared,path};
}
async function removeChatAttachment(path) {
  if(!path)return;
  unwrap(await db.storage.from(CONFIG.chatBucket).remove([path]));
}
async function ensureChatMediaURLs(rows) {
  const now=Date.now();
  await Promise.all(rows.filter(m=>m.media_path).map(async m=>{
    const cached=chatMediaURLs.get(m.media_path);
    if(cached && cached.expires>now+60000)return;
    const data=unwrap(await db.storage.from(CONFIG.chatBucket).createSignedUrl(m.media_path,3600));
    chatMediaURLs.set(m.media_path,{url:data.signedUrl,expires:now+3500000});
  }));
}
function chatMediaHTML(m) {
  if(!m.media_path)return '';
  const url=chatMediaURLs.get(m.media_path)?.url || '';
  if(!url)return '<span class="chat-media-loading">Вложение загружается…</span>';
  if(m.kind==='image')return `<a class="chat-media-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img class="chat-message-image" src="${esc(url)}" alt="Фото в сообщении" loading="lazy"></a>`;
  if(m.kind==='video')return `<video class="chat-message-video" src="${esc(url)}" controls preload="metadata"></video>`;
  if(m.kind==='audio')return `<audio class="chat-message-audio" src="${esc(url)}" controls preload="metadata"></audio>`;
  return '';
}
async function contact(id) {
  if(!requireUser('contact:'+id))return;
  if(id===user.id){page('inbox');return;}
  const c=coaches.find(c=>c.id===id && !c.legacy); if(!c)throw Error('Сообщения этому тренеру пока недоступны.');
  const actor=user.id;
  let thread=unwrap(await db.from('fgi_threads').select('*').eq('coach_id',id).eq('client_id',actor).maybeSingle());
  if(!thread){
    const result=await db.from('fgi_threads').insert({coach_id:id,client_id:actor,client_name:(String(user.user_metadata?.full_name || '').trim() || 'Клиент').slice(0,100)}).select().single();
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
  activeThread=t;chatRows=[];pendingMessage=null;threadEpoch++;clearChatAttachment();
  $('messages').replaceChildren();$('messageForm').hidden=false;$('messageForm').reset();$('chatTitle').textContent=threadTitle(t);message('chatMessage','');
  try{await loadPresence(true);}catch{} updateActivePresence();
  $('olderMessages').hidden=true;await pollMessages(true);await loadThreads();
}
function drawMessages(stick = false) {
  const box=$('messages'),atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<70;
  box.innerHTML=chatRows.map(m=>{
    const body=m.body?`<div class="message-body">${esc(m.body)}</div>`:'';
    return `<div class="bubble ${m.sender_id===user?.id?'mine':''}">${chatMediaHTML(m)}${body}<time datetime="${esc(m.created_at)}">${esc(new Date(m.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</time></div>`;
  }).join('');
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
    try{await ensureChatMediaURLs(chatRows);}catch(e){message('chatMessage','Не удалось загрузить одно из вложений. '+explain(e),true);}
    if(rows.length || initial)drawMessages(initial);
    if(older)box.scrollTop=top+(box.scrollHeight-height);
    if(initial || older)$('olderMessages').hidden=rows.length<50;
    if($('chatMessage').dataset.pollError){message('chatMessage','');delete $('chatMessage').dataset.pollError;}
  } catch(e) {if(epoch===threadEpoch){message('chatMessage',explain(e),true);$('chatMessage').dataset.pollError='1';}}
  finally {chatBusy=false;}
}
function bindChat() {
  $('refreshThreads').onclick=()=>loadThreads().catch(e=>message('chatMessage',explain(e),true));
  $('olderMessages').onclick=()=>pollMessages(false,true);
  $('chatFile').addEventListener('change',e=>{try{showChatAttachment(e.target.files?.[0]);message('chatMessage','');}catch(err){clearChatAttachment();message('chatMessage',explain(err),true);}});
  $('clearChatFile').onclick=()=>clearChatAttachment();
  bindForm('messageForm','chatMessage',async(f,form)=>{
    if(!user || !activeThread)throw Error('Выбери диалог.');
    const body=String(f.get('body')).trim(),file=pendingChatAttachment;
    if(!body && !file)throw Error('Напиши сообщение или добавь фото/видео.');
    const actor=user.id,thread=activeThread.id,epoch=threadEpoch;
    if(!pendingMessage || pendingMessage.body!==body || pendingMessage.thread_id!==thread || Boolean(pendingMessage.media_path)!==Boolean(file)){
      let media=null;
      if(file)media=await uploadChatAttachment(file,actor,thread);
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
          const path=pendingMessage.media_path;pendingMessage=null;
          if(path){try{await removeChatAttachment(path);}catch{}}
          throw result.error;
        }
      }
    } else row=result.data;
    if(epoch!==threadEpoch || actor!==user?.id)return;
    pendingMessage=null;form.reset();clearChatAttachment();message('chatMessage','Отправлено.');
    // Не добавляем строку перед опросом: иначе можно пропустить одновременное сообщение собеседника.
    await pollMessages(chatRows.length===0); if(!chatRows.some(m=>m.id===row.id))await pollMessages();
  });
  setInterval(()=>{if(document.visibilityState==='visible' && currentPage==='inbox' && user){pollMessages();loadThreads().catch(e=>message('chatMessage',explain(e),true));}},4000);
}
function bindUI() {
  $('menu').onclick=()=>{$('nav').classList.toggle('open');$('menu').setAttribute('aria-expanded',String($('nav').classList.contains('open')));};
  $('authOpen').onclick=()=>{if(user)page('account');else $('authDialog').showModal();};
  $('accountOpen').onclick=()=>{try{page('account');}catch(e){notice(explain(e));}};
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    Promise.resolve().then(async()=>{
      if(b.dataset.page)page(b.dataset.page);
      if(b.dataset.action==='login')$('authDialog').showModal();
      if(b.hasAttribute('data-close'))b.closest('dialog').close();
      if(b.dataset.sport){$('sportFilter').value=b.dataset.sport;page('coaches');renderCatalogue();}
      if(b.dataset.matchSport){$('matchSport').value=b.dataset.matchSport;page('match');}
      if(b.dataset.profile)await openProfile(b.dataset.profile);
      if(b.dataset.contact){if(b.dataset.busy)return;b.dataset.busy='1';b.disabled=true;try{await contact(b.dataset.contact);}finally{delete b.dataset.busy;b.disabled=false;}}
      if(b.dataset.thread){const t=threads.find(t=>t.id===b.dataset.thread);if(t)await openThread(t);}
      if(b.dataset.deletePhoto)await deletePhoto(b);
    }).catch(e=>notice(explain(e)));
  });
  document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const box=document.createElement('div');box.className='initials';box.textContent='Фото недоступно';box.style.fontSize='18px';e.target.replaceWith(box);}},true);
  $('search').oninput=renderCatalogue;$('sportFilter').onchange=renderCatalogue;$('formatFilter').onchange=renderCatalogue;
  $('matchForm').onsubmit=e=>{e.preventDefault();findMatch(e.target);};
  opt($('matchLanguage'),Object.entries(langs),'Любой язык');
  $('coachLanguages').innerHTML=Object.entries(langs).map(([id,name])=>`<label class="check"><input type="checkbox" name="languages" value="${id}">${name}</label>`).join('');
  $('goals').innerHTML=goals.map(g=>`<option value="${esc(g)}"></option>`).join('');
  opt($('matchGoal'),goals.map(g=>[g,g]),'Любая цель');
  window.addEventListener('popstate',()=>{const trainer=new URLSearchParams(location.search).get('trainer');if(trainer){openProfile(trainer,false).catch(e=>notice(explain(e)));return;}const target=location.hash.slice(1);try{page($(target)?.classList.contains('page')?target:'home',false);}catch(e){notice(explain(e));}});
  document.addEventListener('visibilitychange',()=>{if(!user || !db)return;if(document.visibilityState==='visible')startPresenceHeartbeat();else{stopPresenceHeartbeat();touchPresence(false).catch(()=>{});}});
  let index=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hero(){if(!sports.length)return;$('heroImage').style.backgroundImage=`url('${sportImage(sports[index++%sports.length].id)}')`;}
  const pauseButton=$('pauseHero');pauseButton.textContent=paused?'Включить смену фона':'Пауза фона';
  pauseButton.onclick=()=>{paused=!paused;pauseButton.textContent=paused?'Включить смену фона':'Пауза фона';};
  sports=directions.map(d=>({id:d[0],name:d[1]}));renderSports();renderCatalogue();hero();
  setInterval(()=>{if(!paused && currentPage==='home' && document.visibilityState==='visible')hero();},7000);
}
async function init() {
  const callback=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
  const callbackError=callback.get('error_description') || query.get('error_description');
  const requestedPage=location.hash.slice(1); // Считываем до обработки Auth SDK.
  const requestedTrainer=query.get('trainer');
  bindUI();bindAuth();bindCoach();bindMedia();bindChat();
  notice('Подключаем FitGoIn…');
  try {
    const {createClient}=await import(CONFIG.sdk);
    db=createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'},global:{fetch:timedFetch}});
    db.auth.onAuthStateChange(authChanged); // Callback синхронный: никаких вложенных вызовов Supabase Auth.
    const data=unwrap(await db.auth.getSession());user=data.session?.user || null;authUI();if(user)startPresenceHeartbeat();
    await loadCatalogue();
    if(callbackError){closeDialogs();$('authDialog').showModal();message('authMessage','Ссылка недействительна: '+callbackError,true);history.replaceState(null,'',redirectURL());}
    else if(callback.get('type')==='recovery' && user){closeDialogs();$('resetDialog').showModal();}
    else if(requestedTrainer) await openProfile(requestedTrainer,false);
    else if($(requestedPage)?.classList.contains('page'))page(requestedPage,false);
    if(user)await loadAccount();
  } catch(e){notice('Не удалось подключить все функции. '+explain(e));}
}
init();


/* Database schema is managed by Supabase migrations in supabase/migrations/. */
