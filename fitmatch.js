/* FitGoIn. Заменить fitmatch.js целиком. SQL для однократной настройки — в конце файла.
   Здесь используется только публичный ключ. Никогда не вставляйте service_role или Stripe secret key. */
const CONFIG = Object.freeze({
  url: 'https://ypbhcgcwkpiujcakvaji.supabase.co',
  key: sb_publishable_nTFEIL9TZgkqbue1Eu46JA_tndRELM6 ,
  sdk: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm',
  bucket: 'fgi-media'
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
  const url = c.avatar_path ? mediaURL(c.avatar_path) : safeURL(c.image_url || c.avatar_url);
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
  if (/PGRST205|42P01/.test(code)) return 'Новые таблицы ещё не настроены. Владельцу сайта нужно выполнить SQL из конца fitmatch.js.';
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
  if (push) history.pushState({page:id}, '', `#${id}`);
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
  const result=await Promise.allSettled([allRows('fgi_sports'),allRows('fgi_coaches'),allRows('sports'),allRows('coaches')]);
  if(epoch!==catalogueEpoch) return;
  setupReady=result[0].status==='fulfilled' && result[1].status==='fulfilled';
  const data = i => result[i].status==='fulfilled' ? result[i].value : [];
  sports=[...new Map([...data(2),...data(0)].map(s=>[String(s.id),{...s,id:String(s.id)}])).values()];
  if(!sports.length) sports=directions.map(d=>({id:d[0],name:d[1]}));
  const current=data(1).map(c=>normalizeCoach(c));
  const owners=new Set(current.map(c=>c.id));
  // После миграции старый публичный каталог не возвращает скрытые владельцем анкеты.
  coaches=setupReady ? current : [...current,...data(3).filter(c=>!owners.has(String(c.user_id))).map(c=>normalizeCoach(c,true))];
  catalogueError = !setupReady ? 'Обновлённые функции ещё не подключены. Владельцу сайта нужно выполнить SQL из fitmatch.js.' : '';
  if (!setupReady && result[1].status==='rejected') catalogueError += ' '+explain(result[1].reason);
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
async function openProfile(id) {
  const c=coaches.find(c=>c.id===id); if(!c) throw Error('Профиль не найден. Обнови каталог.');
  visibleProfile=id; page('profile'); const payment=safeURL(c.payment_url,true);
  $('profileContent').innerHTML=`<button class="text-btn" data-page="coaches">← К тренерам</button><article class="profile-layout"><div class="portrait">${photoHTML(c)}</div><div class="profile-info"><p class="eyebrow">FITGOIN · ${esc(sportName(c.sport))}</p><h1>${esc(c.name)}</h1><p>${esc([c.city,c.country].filter(Boolean).join(', '))} · ${esc(c.format || '')}</p><div class="tags">${c.languages.map(l=>`<span class="tag">${esc(langs[l] || l)}</span>`).join('')}${c.verified?'<span class="tag">✓ Проверен</span>':''}</div><h2>${esc(priceText(c))}</h2><div class="actions">${!c.legacy?`<button class="btn primary" data-contact="${esc(c.id)}">Написать тренеру ↗</button>`:'<p class="hint">Этот тренер ещё не подключил сообщения в новой версии.</p>'}${c.id===user?.id?'<button class="btn" data-page="account">Редактировать</button>':''}</div>${payment?`<p class="section-small"><a class="btn" href="${esc(payment)}" target="_blank" rel="noopener noreferrer">${new URL(payment).pathname.startsWith('/test_')?'Тестовая оплата Stripe':'Оплатить у тренера'} ↗</a></p><p class="hint">Ссылку добавил тренер. Проверь продавца, услугу, сумму и период на странице Stripe. Подтверждение платежа приходит от Stripe; здесь статус оплаты не отслеживается.</p>`:'<p class="hint">Онлайн-оплата пока не подключена. Обсуди стоимость с тренером.</p>'}<h3 class="section-small">О тренере</h3><p class="multiline">${esc(c.bio || 'Описание пока не добавлено.')}</p><p>Опыт: ${c.experience_years==null?'не указан':esc(c.experience_years)+' лет'}</p>${[['Цели / специализация',c.goal],['Образование',c.education],['Титулы',c.titles],['Достижения',c.achievements]].map(([t,v])=>v?`<h3>${t}</h3><p class="multiline">${esc(v)}</p>`:'').join('')}<p class="hint">Достижения и титулы указаны тренером. Рейтинг: ${Number(c.rating)>0?Number(c.rating).toFixed(1):'ещё не сформирован'}.</p></div></article><div id="profileGallery" class="section-small"></div>`;
  if(!c.legacy) {
    try { const items=unwrap(await db.from('fgi_media').select('*').eq('coach_id',c.id).order('created_at',{ascending:false})); if(visibleProfile===id && $('profileGallery')) $('profileGallery').innerHTML=galleryHTML(items,false); }
    catch(e){if(visibleProfile===id && $('profileGallery')) $('profileGallery').textContent=explain(e);}
  }
}
function authUI() { $('authOpen').textContent=user?'Кабинет':'Войти'; $('accountOpen').textContent=user?'Мой профиль':'Стать тренером'; $('accountEmail').textContent=user?.email || ''; }
function authChanged(event, session) {
  const next=session?.user || null, changed=user?.id!==next?.id; user=next; authUI();
  if(changed){authEpoch++;threadEpoch++;catalogueEpoch++;own=null;activeThread=null;threads=[];chatRows=[];pendingMessage=null;visibleProfile='';
    $('threads').replaceChildren();$('messages').replaceChildren();$('myGallery').replaceChildren();$('profileContent').replaceChildren();$('chatTitle').textContent='Выбери диалог';$('messageForm').hidden=true;$('messageForm').reset();$('coachForm').reset();delete $('coachForm').dataset.dirty;$('mediaEditor').hidden=true;
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
function bindAuth() {
  bindForm('authForm','authMessage',async(f,form)=>{
    const data=unwrap(await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:f.get('password')}));
    user=data.user;authUI();form.reset();message('authMessage','');await afterLogin();
  });
  bindForm('signupForm','signupMessage',async(f,form)=>{
    signupEmail=String(f.get('email')).trim();
    const name=String(f.get('name')).trim();if(!name)throw Error('Введи имя.');
    const data=unwrap(await db.auth.signUp({email:signupEmail,password:f.get('password'),options:{emailRedirectTo:redirectURL(),data:{full_name:name}}}));
    form.elements.password.value='';
    if(data.session){user=data.user;authUI();message('signupMessage','Аккаунт создан.');await afterLogin();}
    else message('signupMessage','Запрос принят. Если адрес можно зарегистрировать, придёт письмо со ссылкой подтверждения. Проверь входящие и спам. Если аккаунт уже есть — войди или восстанови пароль.');
  });
  $('resend').onclick=()=>run($('resend'),'signupMessage',async()=>{
    const email=$('signupForm').elements.email.value.trim() || signupEmail;
    if(!email || !$('signupForm').elements.email.checkValidity()) throw Error('Введи корректный email в поле регистрации.');
    unwrap(await db.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectURL()}}));
    message('signupMessage','Запрос на повторное письмо принят. Доставка зависит от настроек почты.');
  });
  $('forgot').onclick=()=>run($('forgot'),'authMessage',async()=>{
    const input=$('authForm').elements.email; if(!input.value || !input.reportValidity()) throw Error('Введи email в поле выше.');
    unwrap(await db.auth.resetPasswordForEmail(input.value.trim(),{redirectTo:redirectURL()}));
    message('authMessage','Если аккаунт с этим адресом существует, придёт ссылка для смены пароля.');
  });
  bindForm('resetForm','resetMessage',async(f,form)=>{
    if(!user) throw Error('Ссылка недействительна или истекла. Запроси восстановление ещё раз.');
    if(f.get('password')!==f.get('confirm')) throw Error('Пароли не совпадают.');
    unwrap(await db.auth.updateUser({password:f.get('password')})); form.reset();message('resetMessage','Пароль изменён.');$('resetDialog').close();notice('Пароль изменён.');
  });
  $('signOut').onclick=()=>run($('signOut'),'coachMessage',async()=>{unwrap(await db.auth.signOut());authChanged('SIGNED_OUT',null);page('home');});
}
function bindCoach() {
  $('coachForm').addEventListener('input',()=>{$('coachForm').dataset.dirty='1';});
  bindForm('coachForm','coachMessage',async(f)=>{
    if(!requireUser('account')) return;
    if(!setupReady) throw Error('Сначала выполни однократную настройку SQL из конца файла.');
    const actor=user.id,epoch=authEpoch;
    const payload={id:actor};
    for(const name of ['name','sport','goal','format','city','country','period','bio','education','titles','achievements','payment_url']) payload[name]=String(f.get(name)||'').trim();
    if(!payload.name || !payload.sport) throw Error('Заполни имя и вид спорта.');
    payload.price=f.get('price')===''?null:Number(f.get('price'));
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
    const saved=unwrap(await db.from('fgi_coaches').update({avatar_path:null,image_url:null}).eq('id',actor).select().single());
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
async function loadThreads() {
  if(!user || !db || inboxBusy)return;inboxBusy=true;const epoch=authEpoch;
  try {
    const data=(await allRows('fgi_threads')).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    if(epoch!==authEpoch)return;threads=data;
    $('threads').innerHTML=data.map(t=>`<button class="thread ${activeThread?.id===t.id?'active':''}" data-thread="${esc(t.id)}">${esc(threadTitle(t))}</button>`).join('') || '<p class="muted">Диалогов пока нет. Открой тренера и нажми «Написать».</p>';
  } finally {inboxBusy=false;}
}
async function openThread(t) {
  activeThread=t;chatRows=[];pendingMessage=null;threadEpoch++;
  $('messages').replaceChildren();$('messageForm').hidden=false;$('messageForm').reset();$('chatTitle').textContent=threadTitle(t);message('chatMessage','');
  $('olderMessages').hidden=true;await pollMessages(true);await loadThreads();
}
function drawMessages(stick = false) {
  const box=$('messages'),atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<70;
  box.innerHTML=chatRows.map(m=>`<div class="bubble ${m.sender_id===user?.id?'mine':''}">${esc(m.body)}<time datetime="${esc(m.created_at)}">${esc(new Date(m.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</time></div>`).join('');
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
  bindForm('messageForm','chatMessage',async(f,form)=>{
    if(!user || !activeThread)throw Error('Выбери диалог.');
    const body=String(f.get('body')).trim();if(!body)throw Error('Напиши сообщение.');
    const actor=user.id,thread=activeThread.id,epoch=threadEpoch;
    if(!pendingMessage || pendingMessage.body!==body || pendingMessage.thread_id!==thread)pendingMessage={client_nonce:crypto.randomUUID(),thread_id:thread,sender_id:actor,body};
    const result=await db.from('fgi_messages').insert(pendingMessage).select().single();
    let row;
    if(result.error?.code==='23505')row=unwrap(await db.from('fgi_messages').select('*').eq('client_nonce',pendingMessage.client_nonce).single());else row=unwrap(result);
    if(epoch!==threadEpoch || actor!==user?.id)return;
    pendingMessage=null;form.reset();message('chatMessage','Отправлено.');
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
  window.addEventListener('popstate',()=>{const target=location.hash.slice(1);try{page($(target)?.classList.contains('page')?target:'home',false);}catch(e){notice(explain(e));}});
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
  bindUI();bindAuth();bindCoach();bindMedia();bindChat();
  notice('Подключаем FitGoIn…');
  try {
    const {createClient}=await import(CONFIG.sdk);
    db=createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'},global:{fetch:timedFetch}});
    db.auth.onAuthStateChange(authChanged); // Callback синхронный: никаких вложенных вызовов Supabase Auth.
    const data=unwrap(await db.auth.getSession());user=data.session?.user || null;authUI();
    await loadCatalogue();
    if(callbackError){closeDialogs();$('authDialog').showModal();message('authMessage','Ссылка недействительна: '+callbackError,true);history.replaceState(null,'',redirectURL());}
    else if(callback.get('type')==='recovery' && user){closeDialogs();$('resetDialog').showModal();}
    else if($(requestedPage)?.classList.contains('page'))page(requestedPage,false);
    if(user)await loadAccount();
  } catch(e){notice('Не удалось подключить все функции. '+explain(e));}
}
init();

/* FITGOIN_SETUP_SQL_BEGIN
ОДНОКРАТНАЯ НАСТРОЙКА В SUPABASE → SQL EDITOR → NEW QUERY → RUN.
Скопируйте только SQL между строками BEGIN; и COMMIT; включительно.
Скрипт добавляет таблицы fgi_*. Старые sports/coaches не удаляет и не изменяет.
Перед выполнением сохраните резервную копию базы. Настройки SMTP этим SQL не меняются.
SQL импортирует доступные старые анкеты с существующим владельцем Auth, по одной на аккаунт.
Исходные записи остаются в coaches. Для переноса анкет без владельца сначала назначьте им user_id.

BEGIN;
CREATE TABLE IF NOT EXISTS public.fgi_sports (
  id text PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120)
);
CREATE TABLE IF NOT EXISTS public.fgi_coaches (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
  sport text NOT NULL CHECK(length(sport) BETWEEN 1 AND 150),
  goal text NOT NULL DEFAULT '' CHECK(length(goal)<=300),
  format text NOT NULL DEFAULT 'Онлайн' CHECK(format IN ('Онлайн','Офлайн','Онлайн и офлайн')),
  price numeric(10,2) CHECK(price BETWEEN 0 AND 100000),
  period text NOT NULL DEFAULT 'занятие' CHECK(period IN ('занятие','месяц','программа')),
  bio text NOT NULL DEFAULT '' CHECK(length(bio)<=4000),
  city text NOT NULL DEFAULT '' CHECK(length(city)<=100),
  country text NOT NULL DEFAULT '' CHECK(length(country)<=100),
  languages text[] NOT NULL DEFAULT '{}' CHECK(cardinality(languages)<=30),
  experience_years integer CHECK(experience_years BETWEEN 0 AND 80),
  education text NOT NULL DEFAULT '' CHECK(length(education)<=2000),
  titles text NOT NULL DEFAULT '' CHECK(length(titles)<=2000),
  achievements text NOT NULL DEFAULT '' CHECK(length(achievements)<=3000),
  avatar_path text CHECK(avatar_path IS NULL OR avatar_path LIKE id::text || '/%'),
  image_url text,
  payment_url text NOT NULL DEFAULT '' CHECK(payment_url='' OR payment_url ~ '^https://buy[.]stripe[.]com/(test_)?[a-zA-Z0-9]+$'),
  published boolean NOT NULL DEFAULT true,
  rating numeric(3,2) NOT NULL DEFAULT 0 CHECK(rating BETWEEN 0 AND 5),
  score numeric NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fgi_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.fgi_coaches(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE CHECK(path LIKE coach_id::text || '/%'),
  kind text NOT NULL CHECK(kind IN ('coach','client','achievement')),
  caption text NOT NULL DEFAULT '' CHECK(length(caption)<=300),
  consent boolean NOT NULL DEFAULT false CHECK(kind<>'client' OR consent),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fgi_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.fgi_coaches(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text NOT NULL DEFAULT 'Клиент' CHECK(length(client_name) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id,client_id), CHECK(coach_id<>client_id)
);
CREATE TABLE IF NOT EXISTS public.fgi_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_nonce uuid NOT NULL UNIQUE,
  thread_id uuid NOT NULL REFERENCES public.fgi_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fgi_media_owner ON public.fgi_media(coach_id);
CREATE INDEX IF NOT EXISTS fgi_threads_client ON public.fgi_threads(client_id);
CREATE INDEX IF NOT EXISTS fgi_messages_thread ON public.fgi_messages(thread_id,id);

-- Копирование старых sports/coaches без изменения их схемы и без удаления записей.
DO $migration$
DECLARE r jsonb; owner_id uuid; sport_id text;
BEGIN
  IF to_regclass('public.sports') IS NOT NULL THEN
    FOR r IN EXECUTE 'SELECT to_jsonb(s) FROM public.sports s' LOOP
      IF coalesce(r->>'id','')<>'' AND coalesce(r->>'name','')<>'' THEN
        INSERT INTO public.fgi_sports(id,name) VALUES(r->>'id',left(r->>'name',120)) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  IF to_regclass('public.coaches') IS NOT NULL THEN
    FOR r IN EXECUTE 'SELECT to_jsonb(c) FROM public.coaches c ORDER BY to_jsonb(c)->>''id''' LOOP
      owner_id:=NULL;
      SELECT u.id INTO owner_id FROM auth.users u WHERE u.id::text=r->>'user_id';
      IF owner_id IS NULL THEN CONTINUE; END IF;
      sport_id:=coalesce(nullif(r->>'sport',''),nullif(r->>'sport_id',''),'fitness');
      INSERT INTO public.fgi_coaches(id,name,sport,goal,format,price,period,bio,city,country,languages,experience_years,education,titles,achievements,image_url,rating,score,verified)
      VALUES(owner_id,left(coalesce(nullif(trim(r->>'name'),''),'Тренер'),100),left(sport_id,150),left(coalesce(r->>'goal',''),300),
        CASE WHEN r->>'format' IN ('Онлайн','Офлайн','Онлайн и офлайн') THEN r->>'format' ELSE 'Онлайн' END,
        CASE WHEN r->>'price' ~ '^[0-9]+([.][0-9]+)?$' THEN least((r->>'price')::numeric,100000) ELSE NULL END,
        CASE WHEN r->>'period' IN ('занятие','месяц','программа') THEN r->>'period' ELSE 'месяц' END,
        left(coalesce(r->>'bio',''),4000),left(coalesce(r->>'city',''),100),left(coalesce(r->>'country',''),100),
        CASE WHEN jsonb_typeof(r->'languages')='array' THEN ARRAY(SELECT jsonb_array_elements_text(r->'languages') LIMIT 30) ELSE '{}'::text[] END,
        CASE WHEN r->>'experience_years' ~ '^[0-9]+$' THEN least((r->>'experience_years')::numeric,80)::integer ELSE NULL END,
        left(coalesce(r->>'education',''),2000),left(coalesce(r->>'titles',''),2000),left(coalesce(r->>'achievements',r->>'achievements_summary',''),3000),
        coalesce(nullif(r->>'image_url',''),r->>'avatar_url'),
        CASE WHEN r->>'rating' ~ '^[0-9]+([.][0-9]+)?$' THEN least((r->>'rating')::numeric,5) ELSE 0 END,
        CASE WHEN r->>'score' ~ '^[0-9]+([.][0-9]+)?$' THEN (r->>'score')::numeric ELSE 0 END,
        coalesce(r->>'verified','false')='true')
      ON CONFLICT(id) DO NOTHING;
    END LOOP;
  END IF;
END $migration$;
INSERT INTO public.fgi_sports(id,name)
SELECT v.id,v.name FROM (VALUES
 ('bodybuilding','Bodybuilding','бодибилдинг'),('fitness','Fitness','фитнес'),
 ('crossfit','CrossFit','кроссфит'),('running','Running','бег'),('yoga','Yoga','йога'),
 ('swimming','Swimming','плавание'),('cycling','Cycling','велоспорт'),
 ('tennis','Tennis','теннис'),('combat','Combat sports','единоборства'),('football','Football','футбол')
) AS v(id,name,alias)
WHERE NOT EXISTS(SELECT 1 FROM public.fgi_sports s WHERE lower(trim(s.name)) IN (lower(v.name),v.alias))
ON CONFLICT DO NOTHING;

ALTER TABLE public.fgi_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fgi_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fgi_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fgi_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fgi_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fgi_sports,public.fgi_coaches,public.fgi_media,public.fgi_threads,public.fgi_messages FROM anon,authenticated;
GRANT SELECT ON public.fgi_sports,public.fgi_coaches,public.fgi_media TO anon,authenticated;
GRANT SELECT ON public.fgi_threads,public.fgi_messages TO authenticated;
GRANT INSERT(id,name,sport,goal,format,price,period,bio,city,country,languages,experience_years,education,titles,achievements,avatar_path,image_url,payment_url,published)
 ON public.fgi_coaches TO authenticated;
GRANT UPDATE(name,sport,goal,format,price,period,bio,city,country,languages,experience_years,education,titles,achievements,avatar_path,image_url,payment_url,published)
 ON public.fgi_coaches TO authenticated;
-- UPSERT включает id в UPDATE, но смена владельца всё равно запрещена RLS.
GRANT UPDATE(id) ON public.fgi_coaches TO authenticated;
GRANT INSERT(coach_id,path,kind,caption,consent),DELETE ON public.fgi_media TO authenticated;
GRANT INSERT(coach_id,client_id,client_name) ON public.fgi_threads TO authenticated;
GRANT INSERT(client_nonce,thread_id,sender_id,body) ON public.fgi_messages TO authenticated;
GRANT USAGE ON SEQUENCE public.fgi_messages_id_seq TO authenticated;

DROP POLICY IF EXISTS fgi_sports_read ON public.fgi_sports;
CREATE POLICY fgi_sports_read ON public.fgi_sports FOR SELECT TO anon,authenticated USING(true);
DROP POLICY IF EXISTS fgi_coaches_read ON public.fgi_coaches;
CREATE POLICY fgi_coaches_read ON public.fgi_coaches FOR SELECT TO anon,authenticated USING(published OR id=(SELECT auth.uid()));
DROP POLICY IF EXISTS fgi_coaches_insert ON public.fgi_coaches;
CREATE POLICY fgi_coaches_insert ON public.fgi_coaches FOR INSERT TO authenticated WITH CHECK(id=(SELECT auth.uid()));
DROP POLICY IF EXISTS fgi_coaches_update ON public.fgi_coaches;
CREATE POLICY fgi_coaches_update ON public.fgi_coaches FOR UPDATE TO authenticated USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));
DROP POLICY IF EXISTS fgi_media_read ON public.fgi_media;
CREATE POLICY fgi_media_read ON public.fgi_media FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=coach_id));
DROP POLICY IF EXISTS fgi_media_insert ON public.fgi_media;
CREATE POLICY fgi_media_insert ON public.fgi_media FOR INSERT TO authenticated WITH CHECK(coach_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS fgi_media_delete ON public.fgi_media;
CREATE POLICY fgi_media_delete ON public.fgi_media FOR DELETE TO authenticated USING(coach_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS fgi_threads_read ON public.fgi_threads;
CREATE POLICY fgi_threads_read ON public.fgi_threads FOR SELECT TO authenticated USING((SELECT auth.uid()) IN (client_id,coach_id));
DROP POLICY IF EXISTS fgi_threads_insert ON public.fgi_threads;
CREATE POLICY fgi_threads_insert ON public.fgi_threads FOR INSERT TO authenticated
 WITH CHECK(client_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=coach_id AND c.published));
DROP POLICY IF EXISTS fgi_messages_read ON public.fgi_messages;
CREATE POLICY fgi_messages_read ON public.fgi_messages FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.fgi_threads t WHERE t.id=thread_id AND (SELECT auth.uid()) IN (t.client_id,t.coach_id)));
DROP POLICY IF EXISTS fgi_messages_insert ON public.fgi_messages;
CREATE POLICY fgi_messages_insert ON public.fgi_messages FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.fgi_threads t WHERE t.id=thread_id AND (SELECT auth.uid()) IN (t.client_id,t.coach_id)));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('fgi-media','fgi-media',true,4194304,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=4194304,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS fgi_storage_insert ON storage.objects;
CREATE POLICY fgi_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='fgi-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=(SELECT auth.uid())));
DROP POLICY IF EXISTS fgi_storage_read ON storage.objects;
CREATE POLICY fgi_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='fgi-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS fgi_storage_delete ON storage.objects;
CREATE POLICY fgi_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='fgi-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
-- Дополнительное ограничение защищает новый bucket даже при старых широких storage-политиках.
DROP POLICY IF EXISTS fgi_storage_guard ON storage.objects;
CREATE POLICY fgi_storage_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(bucket_id<>'fgi-media' OR (storage.foldername(name))[1]=(SELECT auth.uid())::text)
 WITH CHECK(bucket_id<>'fgi-media' OR ((storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=(SELECT auth.uid()))));
NOTIFY pgrst,'reload schema';
COMMIT;
FITGOIN_SETUP_SQL_END */
