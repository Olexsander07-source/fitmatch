import {CONSENT_VERSION,LANGUAGES,GOALS,ALLERGENS,ALLERGEN_LABELS,normalizeProfile,missingProfile,limitedProfile,adaptWorkout,cleanCitations,progressSeries,achievements,coachQuestions,weeklyReview} from './fitgoin-ai-core.mjs';
import {PLANS,MEDIA_CONSENT,hasAccess,actionModule,analysisText,normalizeFood,trainingCalendar} from './fitgoin-ai-paid.mjs';
import {imageForAI,videoForAI} from './fitgoin-ai-media.mjs';
import {t} from './fitgoin-i18n.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const labels={goal:'цель',sport:'спорт',age:'возраст',weekdays:'дни недели',weight_kg:'вес',height_cm:'рост'};
const ERRORS={authentication_required:'Войди в аккаунт снова.',ai_not_configured:'Сервер AI ещё не подключён. Профиль и дневник доступны; ответы появятся после подключения.',consent_required:'Открой профиль и дай согласие на работу AI.',profile_incomplete:'Сначала заполни обязательные поля спортивного профиля.',professional_required:'Для персональной программы с этими данными нужна оценка тренера или врача. AI может отвечать на общие вопросы.',daily_limit:'Дневной лимит AI исчерпан. Он обновится в 00:00 UTC. Сохранённые планы и дневник остаются доступными.',rate_limit:'Слишком много запросов подряд. Повтори через минуту.',request_pending:'Этот запрос ещё выполняется. Подожди и обнови историю.',request_failed:'Предыдущая попытка не завершилась. Отправь новый запрос.',request_conflict:'Повторный запрос отличается от исходного. Отправь его заново.',provider_busy:'AI временно занят. Повтори позже.',provider_unavailable:'AI сейчас недоступен. Повтори позже.',provider_refused:'AI не смог выполнить этот запрос. Попробуй задать вопрос о спорте иначе.',invalid_plan:'AI-план не прошёл проверку времени, нагрузки или питания и не был сохранён. Попробуй уточнить запрос.',provider_incomplete:'AI не закончил ответ. Повтори запрос.',search_unverified:'Поиск не вернул проверяемые источники. AI не будет выдавать это за найденное исследование.',invalid_audio:'Не удалось распознать запись. Запиши до 30 секунд ещё раз.',backend_unavailable:'Не удалось сохранить или загрузить данные. Повтори позже.',delete_retry:'Не все фотографии удалены. Повтори удаление.',invalid_conversation:'Этот диалог больше недоступен. Обнови раздел AI.'};
Object.assign(ERRORS,{connection_uncertain:'Не удалось подтвердить доставку. Проверь ответ перед повторной отправкой.',history_refresh_failed:'Ответ сохранён. Не удалось обновить историю; нажми «Обновить историю».',invalid_message:'Напиши вопрос длиной до 5000 символов.',service_unavailable:'Сервис временно недоступен. Повтори позже.',provider_quota:'AI недоступен из-за лимита сервиса. Свяжись с поддержкой FitGoIn; повторные попытки сейчас не помогут.',provider_authentication:'AI временно недоступен: требуется проверка подключения. Свяжись с поддержкой FitGoIn.',provider_permissions:'AI временно недоступен: требуется проверка доступа сервиса. Свяжись с поддержкой FitGoIn.'});
const field=(title,input)=>`<label>${title}${input}</label>`;
const options=(values,current)=>values.map(v=>{const [key,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(key)}"${key===current?' selected':''}>${esc(label)}</option>`;}).join('');
const select=(name,values,current)=>`<select name="${name}">${options(values,current)}</select>`;
const input=(name,value,type='text',extra='')=>`<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
const button=(action,label,primary=false,extra='')=>`<button type="button" class="btn${primary?' primary':''}" data-ai-action="${action}" ${extra}>${label}</button>`;
const dateNow=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const unwrap=result=>{if(result.error)throw Error('backend_unavailable');return result.data;};
function chart(rows,key,label) {
  const points=progressSeries(rows,key);if(!points.length)return `<p class="muted">${label}: пока нет записей.</p>`;
  const min=Math.min(...points.map(x=>x.value)),max=Math.max(...points.map(x=>x.value)),span=Math.max(1,max-min);
  const start=Date.parse(points[0].date),end=Date.parse(points.at(-1).date),range=Math.max(86400000,end-start);
  const xy=points.map(p=>[45+(Date.parse(p.date)-start)/range*510,130-(p.value-min)/span*85]);
  return `<figure class="fgi-ai-chart"><figcaption>${esc(label)} · ${points.length} записей</figcaption><svg viewBox="0 0 600 180" role="img" aria-label="${esc(label)} от ${points[0].value} до ${points.at(-1).value}"><path d="M45 30 V140 H570" fill="none" stroke="#637c82"/><polyline points="${xy.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#b5cbbb" stroke-width="3"/>${xy.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#b5cbbb"><title>${esc(points[i].date)}: ${points[i].value}</title></circle>`).join('')}<text x="4" y="38">${max}</text><text x="4" y="138">${min}</text><text x="45" y="168">${esc(points[0].date)}</text><text x="490" y="168">${esc(points.at(-1).date)}</text></svg></figure>`;
}
export function mountFitGoInAI(root,opts) {
  let actor=null,epoch=0,loaded=false,view='ask',profile=null,profileDraft=null,conversation=null,conversations=[],messages=[],plans=[],sessions=[],progress=[],shares=[],received=[],photoURLs=new Map();
  let intakeStep=0,profileConsent=false,savedIds=[],savedMessages=[],drawerOpen=false,requestActive=false,userStopped=false,searchDraft=false;
  let busy=false,status='',statusError=false,configured=false,controller=null,active=null,restTimer=null,recorder=null,micStream=null,voicePending=false,voiceTicket=0,voiceText='',draft='',lastLoad=0;
  let access={modules:[],checkout_enabled:false},food=[],analysis=null,module='training';
  let pending=null,historyLimit=80,moreHistory=false,preferredConversation=null;
  // Only this tab's draft and delivery state. Completed history lives in Supabase.
  const chatKey=()=>`fgi-ai-chat:${actor}`;
  function persistChat(){if(actor)try{sessionStorage.setItem(chatKey(),JSON.stringify({conversation_id:conversation?.id||preferredConversation,module,draft,searchDraft,pending}));}catch{}}
  function restoreChat(){try{const saved=JSON.parse(sessionStorage.getItem(chatKey())||'null');if(!saved)return;preferredConversation=saved.conversation_id;module=saved.module==='nutrition'?'nutrition':'training';draft=typeof saved.draft==='string'?saved.draft.slice(0,5000):'';searchDraft=Boolean(saved.searchDraft);if(saved.pending?.body?.request_id&&saved.pending.body.message?.length<=5000)pending=saved.pending;}catch{}}
  const billingEndpoint=opts.endpoint.replace(/\/fitgoin-ai\/?$/,'/fitgoin-ai-billing');
  const db=()=>opts.getDB();
  const q=s=>root.querySelector(s);
  const assert=e=>{if(e!==epoch||opts.getUser()?.id!==actor)throw Error('session_changed');};
  const notice=(message,error=false)=>{status=message;statusError=error;const target=q('[data-ai-status]');if(target){target.textContent=message;target.classList.toggle('error',error);}};
  function stopVoice(cancel=true) {
    voiceTicket++;voicePending=false;clearTimeout(recorder?.timeout);if(recorder&&recorder.state!=='inactive'){recorder.cancelled=cancel;recorder.stop();}
    micStream?.getTracks().forEach(t=>t.stop());micStream=null;
  }
  function reset() {
    if(actor)try{sessionStorage.removeItem(chatKey());}catch{}
    epoch++;controller?.abort();controller=null;stopVoice();clearInterval(restTimer);restTimer=null;
    actor=null;loaded=false;profile=null;profileDraft=null;conversation=null;conversations=[];messages=[];plans=[];sessions=[];progress=[];shares=[];received=[];photoURLs.clear();active=null;voiceText='';draft='';busy=false;status='';statusError=false;
    access={modules:[],checkout_enabled:false};food=[];analysis=null;module='training';pending=null;historyLimit=80;moreHistory=false;preferredConversation=null;
    intakeStep=0;profileConsent=false;savedIds=[];savedMessages=[];drawerOpen=false;requestActive=false;userStopped=false;searchDraft=false;view='ask';document.body.style.overflow='';
    if(window.speechSynthesis)window.speechSynthesis.cancel();
  }
  async function work(task) {
    if(busy)return;busy=true;userStopped=false;root.setAttribute('aria-busy','true');notice('Выполняется…');render();
    const e=epoch;
    try {await task(e);assert(e);if(status==='Выполняется…')notice('Готово.');}
    catch(error){if(e!==epoch||error.message==='session_changed')return;notice(error.name==='AbortError'?'Ответ занял слишком много времени. Обнови историю перед повторным запросом.':ERRORS[error.message]||({subscription_required:'Для этого модуля нужна активная подписка. Открой «Доступ к AI».',monthly_limit:'Месячный ресурс AI исчерпан. Сохранённые планы и дневник доступны; ресурс обновляется в начале месяца UTC.',billing_not_configured:'Оплата пока отключена до проверки подключения AI и Stripe.',billing_unavailable:'Сервис оплаты временно недоступен. Доступ нельзя подтвердить; повтори позже.',checkout_pending:'Есть незавершённая оплата другого тарифа. Заверши её или дождись истечения ссылки, прежде чем выбрать новый тариф.',subscription_exists:'У тебя уже есть подписка или незавершённая оплата. Измени тариф в управлении подпиской.',invalid_image:'Не удалось обработать фото. Выбери JPEG, PNG или WebP до 12 МБ.',invalid_video:'Выбери MP4, WebM или MOV длительностью 1–45 секунд, до 25 МБ.',media_consent_required:'Для анализа нужно отдельное согласие на отправку изображения в AI.',request_too_large:'Файл слишком большой. Выбери более короткое видео или уменьшенное фото.',invalid_analysis:'Оценка изображения не прошла проверку. Она не сохранена в дневник.',invalid_food:'Проверь название, калории и БЖУ: все поля обязательны.',search_query_private:'Для поиска сформулируй общий спортивный вопрос без имени, города, контактов и личных измерений.',budget_unavailable:'AI временно недоступен: требуется проверка серверных лимитов.'}[error.message])||'Не удалось выполнить действие. Проверь подключение и повтори.',true);}
    finally{if(e===epoch){busy=false;requestActive=false;root.setAttribute('aria-busy','false');if(userStopped)notice('Остановили ожидание ответа. Запрос мог завершиться и сохраниться на сервере. Обнови историю перед повторной отправкой.',true);render();}}
  }
  async function api(body,e=epoch,billing=false) {
    assert(e);const data=unwrap(await db().auth.getSession());assert(e);
    if(data.session?.user.id!==actor)throw Error('authentication_required');
    if(userStopped)throw new DOMException('Stopped','AbortError');
    const requestController=new AbortController();controller=requestController;const timeout=setTimeout(()=>requestController.abort(),65000);
    try{
      const response=await fetch(billing?billingEndpoint:opts.endpoint,{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:requestController.signal});
      let result;try{result=await response.json();}catch{throw Error('connection_uncertain');}assert(e);if(!response.ok){const error=Error(result.error||'provider_unavailable');error.confirmed=true;throw error;}return result;
    } catch(error){if(error instanceof TypeError)throw Error('connection_uncertain');throw error;
    } finally{clearTimeout(timeout);if(controller===requestController)controller=null;}
  }
  async function load(e=epoch) {
    if(!actor)return;const id=actor;
    const results=await Promise.all([
      db().from('fgi_ai_profiles').select('*').eq('user_id',id).maybeSingle(),
      db().from('fgi_ai_conversations').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(50),
      db().from('fgi_ai_plans').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(20),
      db().from('fgi_ai_workouts').select('*').eq('user_id',id).order('started_at',{ascending:false}).limit(200),
      db().from('fgi_ai_progress').select('*').eq('user_id',id).order('recorded_on',{ascending:false}).limit(365),
      db().from('fgi_ai_shares').select('*').eq('user_id',id).order('created_at',{ascending:false}),
      db().from('fgi_ai_shares').select('id,summary,created_at,expires_at').eq('coach_id',id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}),
      db().from('fgi_ai_food').select('*').eq('user_id',id).order('recorded_on',{ascending:false}).order('created_at',{ascending:false}).limit(365),
      api({action:'access'},e,true).catch(error=>{if(error.message==='session_changed')throw error;return {modules:[],checkout_enabled:false,unavailable:true};})
    ]);assert(e);
    [profile]=results.map(unwrap);conversations=unwrap(results[1]);conversation=conversations.find(x=>x.id===(conversation?.id||preferredConversation))||conversations[0]||null;plans=unwrap(results[2]);sessions=unwrap(results[3]);progress=unwrap(results[4]);shares=unwrap(results[5]);received=unwrap(results[6]);
    food=unwrap(results[7]);access=results[8];if(!hasAccess(access,module)&&access.modules?.length)module=access.modules[0];
    const unfinished=sessions.find(x=>!x.completed_at&&x.data?.workout&&x.data?.status==='active');
    if(!active&&unfinished)active=unfinished;
    if(conversation){const result=await db().from('fgi_ai_messages').select('*').eq('user_id',id).eq('conversation_id',conversation.id).order('created_at',{ascending:false}).order('request_id',{ascending:false}).order('role',{ascending:true}).limit(historyLimit+1);assert(e);const rows=unwrap(result);moreHistory=rows.length>historyLimit;messages=rows.slice(0,historyLimit).reverse();}
    else messages=[];
    if(pending&&messages.some(m=>m.request_id===pending.body.request_id&&m.role==='assistant')){if(draft.trim()===pending.body.message)draft='';pending=null;notice('Ответ найден в сохранённой истории.');}
    persistChat();
    savedIds=opts.savedIds?await opts.savedIds():[];assert(e);
    if(savedIds.length){savedMessages=unwrap(await db().from('fgi_ai_messages').select('*').eq('user_id',id).eq('role','assistant').in('id',savedIds).order('created_at',{ascending:false}).limit(100));assert(e);}else savedMessages=[];
    photoURLs.clear();
    for(const row of progress.filter(x=>x.photo_path).slice(0,12)){
      const result=await db().storage.from('fgi-ai').createSignedUrl(row.photo_path,600);assert(e);if(!result.error)photoURLs.set(row.photo_path,result.data.signedUrl);
    }
    loaded=true;lastLoad=Date.now();render();updateRest();
  }
  function profileView() {
    const p=normalizeProfile(profileDraft||profile?.data),ready=profile?.consent_version===CONSENT_VERSION||profileConsent;
    const sections=[
      field('Твоя цель',select('goal',[['','Выбери цель'],...GOALS],p.goal).replace('<select','<select required'))+
      field('Конкретный результат',input('target',p.target,'text','maxlength="300" placeholder="Например: вернуться к регулярным тренировкам"'))+
      field('Вид спорта',select('sport',[['','Выбери спорт'],...opts.sports()],p.sport))+
      field('Возраст',input('age',p.age,'number','min="13" max="100" required'))+
      field('Твой опыт',select('experience',[['beginner','Начинающий'],['intermediate','Есть опыт'],['advanced','Опытный']],p.experience)),
      field('Где занимаешься',select('setting',[['home','Дома'],['gym','В зале'],['outdoor','На улице']],p.setting))+
      field('Оборудование',input('equipment',p.equipment,'text','maxlength="600" placeholder="Коврик, гантели, оборудование зала…"'))+
      field('Тренировок в неделю',input('days_per_week',p.days_per_week,'number','min="1" max="6" step="1" required'))+
      field('Минут на тренировку',input('minutes',p.minutes,'number','min="10" max="90" step="1" required'))+
      `<fieldset class="fgi-ai-checks full"><legend>Дни тренировок · можно выбрать позже</legend>${[1,2,3,4,5,6,0].map(day=>`<label><input type="checkbox" name="weekday" value="${day}"${p.weekdays.includes(day)?' checked':''}>${DAYS[day]}</label>`).join('')}</fieldset>`,
      field('Рост, см · для питания',input('height_cm',p.height_cm,'number','min="100" max="230" step="0.1"'))+
      field('Вес, кг · для питания',input('weight_kg',p.weight_kg,'number','min="30" max="300" step="0.1"'))+
      field('Активность вне тренировок',select('activity',[['sedentary','В основном сижу'],['light','Хожу, немного двигаюсь'],['active','Много двигаюсь / физическая работа']],p.activity))+
      field('Питание и предпочтения',input('diet',p.diet,'text','maxlength="600" placeholder="Предпочтения и продукты, которые не нравятся"'))+
      field('Язык ответов',select('language',Object.entries(LANGUAGES),p.language))+
      field('Стиль общения',select('response_style',[['short','Коротко и по делу'],['detailed','С подробными объяснениями']],p.response_style))+
      `<fieldset class="fgi-ai-checks full"><legend>Аллергены · исключить из меню</legend>${ALLERGENS.map((x,i)=>`<label><input type="checkbox" name="allergy" value="${x}"${p.allergies.includes(x)?' checked':''}>${ALLERGEN_LABELS[i]}</label>`).join('')}</fieldset>`,
      `<div class="ai-intake-summary full"><strong>${esc(p.goal||'Выбери цель')}</strong><br>${esc(opts.sports().find(x=>x[0]===p.sport)?.[1]||p.sport||'Спорт можно добавить позже')} · ${p.days_per_week} раза в неделю · ${p.minutes} мин<br>${esc(p.setting==='gym'?'В зале':p.setting==='outdoor'?'На улице':'Дома')} · ${esc(p.equipment||'Оборудование не указано')}</div>`+
      field('Город для поиска тренера',input('city',p.city,'text','maxlength="100"'))+
      field('Формат с тренером',select('format',[['','Любой'],['Онлайн','Онлайн'],['Офлайн','Офлайн']],p.format))+
      field('Бюджет, € · необязательно',input('budget',p.budget,'number','min="0" max="100" step="0.01"'))+
      field('Бюджет за',select('period',['занятие','месяц','программа'],p.period))+
      field('Удобное время',select('availability',[['','Любое'],['morning','Утро'],['day','День'],['evening','Вечер'],['weekend','Выходные']],p.availability))+
      `<label class="full">Ограничения · можно не раскрывать подробности<textarea name="restrictions" maxlength="800" rows="2">${esc(p.restrictions)}</textarea></label><label class="fgi-ai-check full"><input type="checkbox" name="needs_professional"${p.needs_professional?' checked':''}>Есть травма, заболевание, беременность, расстройство пищевого поведения или серьёзная аллергия — персональную программу нужно согласовать со специалистом.</label><label class="fgi-ai-check fgi-ai-consent full"><input type="checkbox" name="consent" required${ready?' checked':''}>Я согласен сохранять спортивный профиль и историю в FitGoIn и передавать необходимые данные OpenAI для ответов AI. Данные о здоровье предоставляю добровольно. <a href="./privacy.html#ai" target="_blank" rel="noopener">Как используются данные</a></label><p class="hint full">AI не ставит диагнозы. При боли останови тренировку; при опасных симптомах обратись за срочной помощью. До 18 лет и при медицинских ограничениях персональная нагрузка и питание требуют специалиста.</p>`
    ];
    return `<div class="panel ai-intake"><p class="eyebrow">FITGOIN AI · 0${intakeStep+1} / 04</p><h2>${t('intakeTitle')}</h2><p class="muted">${t('intakeCopy')} До сохранения черновик доступен только в этой вкладке.</p><div class="coach-onboarding-progress"><i style="width:${(intakeStep+1)/4*100}%"></i></div><form data-ai-form="profile">${sections.map((body,i)=>`<fieldset class="ai-intake-step" data-ai-intake="${i}"${i!==intakeStep?' hidden':''}><legend><h3>${esc(t('intakeSteps')[i])}</h3></legend><div class="form-grid">${body}</div></fieldset>`).join('')}<div class="ai-intake-actions">${button('intake-prev',t('back'),false,intakeStep===0?'hidden':'')}${intakeStep===3?`<button class="btn primary" type="submit">${t('intakeDone')}</button>`:button('intake-next',t('next'),true)}</div></form></div>`;
  }
  function messageHTML(m) {
    const citations=cleanCitations(m.citations),isAssistant=m.role==='assistant';
    return `<article class="fgi-ai-message ${isAssistant?'':'from-user'}"><strong>${isAssistant?'✧ FitGoIn AI':'Ты'}</strong><p dir="auto">${esc(m.body)}</p>${citations.length?`<ol class="fgi-ai-sources" aria-label="${t('source')}">${citations.map(c=>`<li><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a></li>`).join('')}</ol>`:''}${isAssistant?`<div class="ai-message-actions">${button('copy',t('copy'),false,`data-message-id="${esc(m.id)}"`)}${button('save',savedIds.includes(m.id)?t('removeSaved'):t('save'),false,`data-message-id="${esc(m.id)}" aria-pressed="${savedIds.includes(m.id)}"${!opts.toggleSaved?' disabled':''}`)}${button('speak','Прослушать',false,`data-message-id="${esc(m.id)}"`)}${m.id===messages.filter(x=>x.role==='assistant').at(-1)?.id?button('regenerate',t('regenerate'),false,`data-message-id="${esc(m.id)}" title="Новый запрос расходует лимит AI"`):''}${[['account','Мой кабинет'],['inbox','Сообщения'],['match','MATCH'],['coaches','Тренеры']].filter(([id])=>new RegExp('#'+id+'\b').test(m.body)).map(([id,label])=>button('platform-link',label,false,`data-destination="${id}"`)).join('')}${button('feedback','Полезно',false,`data-message-id="${esc(m.id)}" data-useful="true"`)}${button('feedback','Есть проблема',false,`data-message-id="${esc(m.id)}" data-useful="false"`)}</div>`:''}</article>`;
  }
  function chatView() {
    const quick=[['today','◇','quickToday'],['training','＋','quickTraining'],['nutrition','◌','quickNutrition'],['coach','♡','quickCoach'],['question','?','quickQuestion']];
    const outgoing=pending?.body.conversation_id===conversation?.id?pending:null;
    return `<div class="fgi-ai-chat panel"><div class="ai-chat-heading"><h2>${esc(conversation?.title==='FitGoIn AI'?t('newChat'):conversation?.title||t('ai'))}</h2><label><span class="sr-only">Модуль</span><select data-ai-module>${options([['training','Тренировки'],['nutrition','Питание']],module)}</select></label></div>
      ${`<div class="ai-chat-shortcuts" aria-label="Быстрые действия">${quick.map(([id,icon,label])=>`<button type="button" class="ai-quick" data-ai-quick="${id}"${busy?' disabled':''}><span aria-hidden="true">${icon}</span>${t(label)}</button>`).join('')}</div>`}
      ${!messages.length&&!outgoing?`<div class="ai-empty"><div class="ai-empty-mark" aria-hidden="true">✧</div><p class="eyebrow">${t('chatEyebrow')}</p><h2>${t('chatTitle')}</h2><p>${t('chatCopy')}</p></div>`:''}
      <div class="fgi-ai-messages" role="log" aria-live="off" aria-label="История разговора">${moreHistory?button('more-history','Показать предыдущие сообщения'): ""}${messages.map(messageHTML).join('')}${outgoing?`<article class="fgi-ai-message from-user ai-outgoing" data-request-id="${esc(outgoing.body.request_id)}"><strong>Ты · ${requestActive?'Отправляется':outgoing.state==='failed'?'Не отправлено':'Проверяем доставку'}</strong><p dir="auto">${esc(outgoing.body.message)}</p>${!busy?`<div class="actions">${button('retry-message',outgoing.state==='failed'?'Повторить отправку':'Проверить ответ',true)}${button('refresh','Обновить историю')}</div>`:''}</article>`:''}${requestActive?`<div class="ai-typing" role="status"><i></i><i></i><i></i><span>${t('typing')}</span></div>`:''}</div>
      <form data-ai-form="chat" class="ai-compose"><label><span class="sr-only">${t('question')}</span><textarea name="message" rows="2" maxlength="5000" required placeholder="${t('placeholder')}" dir="auto">${esc(draft)}</textarea></label><div class="ai-compose-tools"><div class="ai-compose-media">${button('food-photo',t('photo'))}${button('technique',t('technique'))}${button('voice','Голос',false,!configured?'disabled':'')}${button('document',t('document'))}<input type="file" data-ai-document accept=".txt,.md,text/plain,text/markdown" hidden><label class="fgi-ai-check"><input type="checkbox" name="search"${searchDraft?' checked':''}>${t('sourceSearch')}</label></div>${requestActive?button('stop',t('stop')):`<button class="btn primary" type="submit"${!configured||busy||pending?.state==='uncertain'?' disabled':''}>${t('send')} ↗</button>`}</div><p class="hint">${t('privateSearch')} <span>${t('sendShortcut')}</span></p></form>
      <p class="ai-compose-note">${!hasAccess(access,module)?'AI-ответы в этом модуле доступны по подписке. ':''}AI может ошибаться. Он помогает со спортом и питанием; медицинские вопросы обсуждай со специалистом.</p></div>`;
  }
  function savedView(){return `<div class="ai-saved-list"><div><p class="eyebrow">FITGOIN AI</p><h2>${t('saved')}</h2></div>${savedMessages.length?savedMessages.map(messageHTML).join(''):`<div class="panel"><p class="muted">${t('noSaved')}</p>${button('view-ask',t('ai'),true)}</div>`}</div>`;}
  function menu(open){drawerOpen=open;const shell=q('.fgi-ai-shell');if(shell)shell.classList.toggle('drawer-open',open);const aside=q('.fgi-ai-sidebar');if(aside){aside.setAttribute('role',open?'dialog':'navigation');if(open)aside.setAttribute('aria-modal','true');else aside.removeAttribute('aria-modal');}q('[data-ai-action="menu"]')?.setAttribute('aria-expanded',String(open));document.body.style.overflow=open?'hidden':'';if(open)q('.ai-sidebar-close')?.focus();else q('[data-ai-action="menu"]')?.focus();}
  function accessView(){
    const descriptions={training:'Программы под твою цель, история подходов, адаптация по восстановлению, голосовой ввод и оценка техники по выбранным кадрам.',nutrition:'Примерное меню, замены продуктов, список покупок, оценка еды по фото и дневник питания.',bundle:'Оба модуля: тренировки и питание с раздельной историей и общим профилем.'};
    return `<div class="section-head"><h2>Доступ к FitGoIn AI</h2>${button('refresh','Проверить доступ')}</div><p>${access.friend?'Тебе предоставлен бесплатный доступ по приглашению.':''}${access.unavailable?'Сервер подписок сейчас недоступен. Сохранённые данные остаются доступны.':''}${!access.checkout_enabled?' Оплата пока отключена: подключение и проверка ещё не завершены.':''}</p><div class="fgi-ai-week">${Object.entries(PLANS).map(([key,plan])=>`<article class="panel"><h3>${esc(plan.name)}</h3><p class="fgi-ai-dose">${plan.amount/100} € / месяц</p><p>${esc(descriptions[key])}</p>${plan.modules.every(m=>hasAccess(access,m))?'<span class="tag">Доступ активен</span>':button('checkout','Выбрать тариф',true,`data-plan="${key}"${!access.checkout_enabled?' disabled':''}`)}</article>`).join('')}</div><div class="panel section-small"><p>До 30 запросов и 3 поисков в день UTC. Действует месячный ресурс AI; длинные программы, фото и исследования расходуют его быстрее. Сохранённые планы, дневник и подбор тренера доступны после окончания подписки.</p>${access.subscriptions?.length?access.subscriptions.map(s=>`<p>${esc(PLANS[s.plan]?.name||'Подписка')}: ${esc(s.status)}${s.paid_until?` · оплачено до ${esc(new Date(s.paid_until).toLocaleDateString())}`:''}${s.cancel_at_period_end?' · продление отключено':''}</p>`).join('')+button('portal','Управлять подпиской / отменить'):''}<p class="hint">После оплаты доступ подтвердит сервер. Возврат на сайт сам по себе подписку не активирует. Периодическая оплата и отмена управляются через Stripe. Условия: <a href="./terms.html#ai">FitGoIn AI</a>.</p></div>`;
  }
  function mediaForm(kind){return `<form data-ai-form="media" data-kind="${kind}"><h3>${kind==='food_photo'?'Оценить еду по фото':'Проверить видимую технику'}</h3><label>${kind==='food_photo'?'Фото блюда':'Фото или короткое видео'}<input name="media" type="file" accept="${kind==='food_photo'?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime'}" required></label>${field(kind==='food_photo'?'Что известно о порции и составе?':'Какое упражнение и что проверить?',`<textarea name="description" rows="2" maxlength="1200" placeholder="${kind==='food_photo'?'Например: рис 150 г, курица 100 г, масло 1 ч. л.':'Название упражнения, вес и твой вопрос'}"></textarea>`)}<label class="fgi-ai-check"><input name="consent" type="checkbox" required>Разрешаю отправить выбранное фото или шесть кадров видео в OpenAI для этого анализа.</label><p class="hint">Изображения подготовятся на устройстве без метаданных. Исходное видео и звук не отправляются. Фото и кадры не сохраняются в FitGoIn; текст оценки остаётся в твоей AI-истории. ${kind==='food_photo'?'Калории и состав приблизительные. Скрытые ингредиенты и аллергены по фото не определить.':'Кадры не показывают всю траекторию движения. AI не подтверждает безопасность техники и не заменяет тренера.'}</p><button class="btn primary" type="submit"${!configured?' disabled':''}>Получить оценку</button></form>`;}
  function foodView(){
    const rows=food.filter(r=>r.recorded_on===dateNow()),total=keys=>Object.fromEntries(keys.map(k=>[k,Math.round(rows.reduce((s,r)=>s+Number(r[k]||0),0))]));
    const sums=total(['calories_low','calories_high','protein_g','fat_g','carbs_g']);
    return `<div class="panel section-small">${mediaForm('food_photo')}</div>${analysis?.type==='food_photo'?`<div class="panel section-small"><h3>Проверь оценку</h3><p class="fgi-ai-pre">${esc(analysisText('food_photo',analysis.document))}</p>${analysis.document.items.length?button('confirm-food','Уточнить и записать в дневник',true):''}</div>`:''}<div class="panel section-small"><h3>Дневник питания · сегодня</h3><p>Записано: ≈ ${sums.calories_low}–${sums.calories_high} ккал · Б ${sums.protein_g} / Ж ${sums.fat_g} / У ${sums.carbs_g} г. Это сумма твоих записей, а не оценка всего дня.</p>${rows.map(r=>`<p>${esc(r.name)} · ≈ ${r.calories_low}–${r.calories_high} ккал ${button('remove-food','Удалить',false,`data-food-id="${esc(r.id)}"`)}</p>`).join('')}${button('manual-food','Добавить вручную')}<details><summary>Последние записи питания</summary>${food.slice(0,30).map(r=>`<p>${esc(r.recorded_on)} · ${esc(r.name)} · ≈ ${r.calories_low}–${r.calories_high} ккал</p>`).join('')||'<p>Записей пока нет.</p>'}</details></div>`;
  }
  function foodDialog(value={},source='manual'){
    dialog(`<h2>Подтверди порцию и оценку</h2><form data-ai-form="food" data-source="${source}"><div class="form-grid">${field('Название',input('name',value.name||'','text','maxlength="160" required'))}${field('Дата',input('recorded_on',dateNow(),'date','required'))}${['calories_low','calories_high','protein_g','fat_g','carbs_g'].map(k=>field(({calories_low:'Калории · нижняя оценка',calories_high:'Калории · верхняя оценка',protein_g:'Белки, г',fat_g:'Жиры, г',carbs_g:'Углеводы, г'})[k],input(k,value[k]??'','number',`min="0" max="${k.startsWith('calories')?5000:600}" step="0.1" required`))).join('')}</div><p class="hint">Исправь данные по фактической порции, упаковке или известному рецепту. Сохранение не изменяет твоё меню автоматически.</p><button class="btn primary" type="submit">Подтверждаю, сохранить</button></form>`);
  }
  const latest=kind=>plans.find(x=>x.kind===kind);
  function workoutCard(w,i) {return `<article class="panel fgi-ai-plan"><p class="eyebrow">${DAYS[w.day]} · ${w.minutes} мин</p><h3>${esc(w.title)}</h3><p>${esc(w.warmup)}</p><ol>${w.exercises.map(e=>`<li><strong>${esc(e.name)}</strong> · ${e.sets} × ${esc(e.reps)} · отдых ${e.rest_seconds} с</li>`).join('')}</ol>${button('start-workout','Начать тренировку',true,`data-workout="${i}"`)}</article>`;}
  function activeView() {
    const d=active.data,w=d.workout,index=d.index||0,e=w.exercises[index];
    if(!e)return `<div class="panel"><h2>Упражнения закончены</h2><p>Записано подходов: ${d.sets.length}.</p>${button('finish-workout','Завершить и сохранить',true)}</div>`;
    const done=d.sets.filter(s=>s.exercise_index===index).length;
    return `<div class="panel fgi-ai-guided"><p class="eyebrow">ТРЕНИРОВКА · ${index+1} / ${w.exercises.length}</p><h2>${esc(e.name)}</h2><p class="fgi-ai-dose">${e.sets} × ${esc(e.reps)} <span>· отдых ${e.rest_seconds} с</span></p><p>${esc(e.technique)}</p><p class="hint">Замена: ${esc(e.alternative)}</p><p class="muted">${esc(w.adaptation||'')} Записано: ${done} / ${e.sets} подходов.</p>
      <p class="fgi-ai-rest" data-ai-rest aria-live="off"></p><form data-ai-form="set"><div class="form-grid">${field('Повторений',input('reps','','number','min="1" max="200" step="1" required'))}${field('Вес, кг · необязательно',input('weight_kg','','number','min="0" max="500" step="0.25"'))}${field('Сложность, 1–10',input('rpe',7,'number','min="1" max="10" step="1" required'))}</div><button type="submit" class="btn primary"${done>=e.sets?' disabled':''}>Записать подход</button></form>
      <div class="actions">${button('next-exercise',done>=e.sets?'Следующее упражнение':'Пропустить / дальше')}${button('voice','Голосовая команда',false,!configured?'disabled':'')}${button('finish-workout','Завершить')}${button('pain-stop','Боль / остановить')}</div><details><summary>Разминка и завершение</summary><p>${esc(w.warmup)}</p><p>${esc(w.cooldown)}</p></details></div>`;
  }
  function todayView() {
    const p=normalizeProfile(profile?.data),training=latest('training'),nutrition=latest('nutrition'),today=new Date().getDay(),review=weeklyReview(sessions,p);
    const todayWorkout=training?.document.workouts.findIndex(x=>x.day===today)??-1;
    const complete=sessions.filter(s=>s.completed_at&&s.data?.status==='completed'&&s.data?.sets?.length);
    const weekAgo=Date.now()-7*86400000,count=complete.filter(s=>Date.parse(s.completed_at)>weekAgo).length;
    return `<div class="fgi-ai-stats"><div><small>Твоя цель</small><strong>${esc(p.goal||'Начнём с профиля')}</strong><span>${esc(p.target)}</span></div><div><small>За последние 7 дней</small><strong>${count} тренировок</strong><span>План: ${p.days_per_week} в неделю</span></div><div><small>Достижения</small><strong>${esc(achievements(sessions).at(-1)||'Первый шаг впереди')}</strong><span>Всего записано: ${complete.length}</span></div></div>
      ${active?activeView():`<div class="panel fgi-ai-day"><p class="eyebrow">СЕГОДНЯ · ${new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</p><h2>${todayWorkout>=0?esc(training.document.workouts[todayWorkout].title):training?'Восстановление и обычная активность':'Твой план начинается здесь'}</h2><p class="muted">${todayWorkout>=0?'Перед началом учтём время, сон и самочувствие.':training?'Сегодня нет тренировки по графику. Отдых помогает восстановиться. Если пропустил занятие, выбери его ниже и сохрани время на восстановление.':'Заполни спортивный профиль, затем создай программу под свою цель.'}</p><div class="actions">${todayWorkout>=0?button('start-workout','Начать сегодняшнюю',true,`data-workout="${todayWorkout}"`):button('view-profile','Мой профиль',true)}${button('create-training',training?'Обновить программу по результатам':'Создать программу',false,!configured?'disabled':'')}${button('view-ask','Спросить AI')}</div></div>`}
      <div class="panel section-small"><h3>Итоги последних 7 дней</h3><p>${review.completed} завершённых тренировок из ${review.planned} запланированных в неделю · ${review.sets} записанных подходов${review.average_rpe!==null?` · средняя сложность ${review.average_rpe}/10`:''}.</p><p>${esc(review.message)}</p><div class="actions">${button('calendar','Добавить график в календарь')}${button('technique','Оценить технику')}${button('view-access','Доступ к AI')}</div></div>
      ${training?`<div class="section-head"><div><h2>${esc(training.title)}</h2><p>${esc(training.document.summary)}</p></div></div><p class="hint">${esc(training.document.progression)}</p><div class="fgi-ai-week">${training.document.workouts.map(workoutCard).join('')}</div>`:''}
      <div class="panel section-small"><h3>Питание и восстановление</h3><p>${nutrition?`Примерный день: ${nutrition.document.calories_low}–${nutrition.document.calories_high} ккал.`:'Можно составить примерное меню, список покупок и варианты замены продуктов.'} Не тренируйся через боль. Вода — по жажде и условиям нагрузки; индивидуальные ограничения обсуждаются с врачом.</p><div class="actions">${button('view-nutrition','Моё питание')}${button('view-progress','Записать вес и самочувствие')}${button('view-coaches','Хочу заниматься с человеком')}</div></div>`;
  }
  function nutritionView() {
    const plan=latest('nutrition'),d=plan?.document;
    return `<div class="section-head"><div><h2>Моё питание</h2><p class="muted">Ориентировочное меню для здорового взрослого. Калории и БЖУ — оценки, которые нужно сверять с реальным прогрессом.</p></div>${button('create-nutrition',d?'Обновить меню':'Создать меню',true,!configured?'disabled':'')}</div>${!d?'<div class="panel"><p>Добавь рост, вес, пищевые предпочтения и ограничения в профиль. AI подготовит примерный день питания.</p>'+button('view-profile','Открыть профиль')+'</div>':`<div class="panel"><h3>${esc(d.title)}</h3><p>${esc(d.summary)}</p><div class="fgi-ai-stats"><div><small>Калории</small><strong>${d.calories_low}–${d.calories_high} ккал</strong></div><div><small>Белки / жиры / углеводы</small><strong>${d.protein_g} / ${d.fat_g} / ${d.carbs_g} г</strong></div></div><p class="hint">Количество продуктов приблизительное. При аллергии проверяй маркировку и риск перекрёстного загрязнения; AI не гарантирует безопасность блюда.</p></div><div class="fgi-ai-week">${d.meals.map(m=>`<article class="panel"><h3>${esc(m.name)}</h3><p class="hint">≈ ${m.calories} ккал · Б ${m.protein_g} / Ж ${m.fat_g} / У ${m.carbs_g} г</p><ul>${m.ingredients.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>${esc(m.recipe)}</p><details><summary>Замены</summary><ul>${m.substitutions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></article>`).join('')}</div><div class="panel section-small"><h3>Список покупок</h3><ul>${d.shopping_list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${button('nutrition-question','Задать вопрос о меню')}</div>`}${foodView()}`;
  }
  function progressView() {
    const today=progress.find(x=>x.recorded_on===dateNow())||{};
    return `<h2>Мой прогресс</h2><div class="fgi-ai-week"><div class="panel">${chart(progress,'weight_kg','Вес, кг')}</div><div class="panel">${chart(progress,'waist_cm','Талия, см')}</div></div>
      <div class="panel section-small"><h3>Запись за день</h3><form data-ai-form="progress"><div class="form-grid">${field('Дата',input('recorded_on',dateNow(),'date','required'))}${field('Вес, кг',input('weight_kg',today.weight_kg,'number','min="20" max="300" step="0.1"'))}${field('Талия, см',input('waist_cm',today.waist_cm,'number','min="20" max="300" step="0.1"'))}${field('Сон, часов',input('sleep_hours',today.sleep_hours,'number','min="0" max="24" step="0.5"'))}${field('Энергия, 1–5',input('energy',today.energy,'number','min="1" max="5" step="1"'))}${field('Личное фото · необязательно','<input name="photo" type="file" accept="image/jpeg,image/png,image/webp">')}</div>${field('Заметка',`<textarea name="notes" rows="2" maxlength="1500">${esc(today.notes)}</textarea>`)}<p class="hint">Фотография остаётся приватной. Она не анализируется AI и не передаётся тренеру. JPEG, PNG или WebP; после подготовки до 4 МБ.</p><button type="submit" class="btn primary">Сохранить запись</button></form></div>
      <div class="fgi-ai-history section-small">${progress.slice(0,30).map(r=>`<article class="panel"><strong>${esc(r.recorded_on)}</strong><p>${r.weight_kg!=null?`${r.weight_kg} кг · `:''}${r.waist_cm!=null?`${r.waist_cm} см · `:''}${r.sleep_hours!=null?`Сон ${r.sleep_hours} ч · `:''}${r.energy!=null?`Энергия ${r.energy}/5`:''}</p><p>${esc(r.notes)}</p>${photoURLs.has(r.photo_path)?`<img class="fgi-ai-photo" src="${esc(photoURLs.get(r.photo_path))}" alt="Личное фото прогресса ${esc(r.recorded_on)}" loading="lazy">`:''}${r.photo_path?button('remove-photo','Удалить фото',false,`data-progress-id="${esc(r.id)}"`):''}</article>`).join('')}</div>
      <div class="panel section-small"><h3>История тренировок</h3>${sessions.filter(s=>s.completed_at).slice(0,30).map(s=>`<details><summary>${esc(new Date(s.completed_at).toLocaleDateString())} · ${esc(s.data.workout?.title||'Тренировка')} · ${(s.data.sets||[]).length} подходов</summary><ul>${(s.data.sets||[]).map(x=>`<li>${esc(x.exercise)}: ${x.reps} повторений${x.weight_kg!=null?` · ${x.weight_kg} кг`:''} · сложность ${x.rpe}/10</li>`).join('')}</ul></details>`).join('')||'<p class="muted">Завершённые тренировки появятся здесь.</p>'}</div>
      <div class="panel section-small"><h3>Твои данные</h3><div class="actions">${button('export','Скачать историю')}${button('delete-data','Удалить данные AI')}</div><p class="hint">Удаление касается только FitGoIn AI: профиля, планов, переписки, прогресса, сводок для тренеров и личных AI-фотографий.</p></div>`;
  }
  function coachesView() {
    const p=normalizeProfile(profile?.data),matches=opts.matches(p).filter(x=>x.coach.id!==actor);
    return `<div class="section-head"><div><h2>Тренер, который подходит тебе</h2><p class="muted">Используем твой профиль и опубликованные анкеты FitGoIn. Процент — совпадение пожеланий, а не гарантия результата.</p></div>${button('view-profile','Изменить пожелания')}</div>
      <div class="fgi-ai-week">${matches.map(({coach:c,match:m})=>`<article class="panel"><p class="eyebrow">${m.percent}% MATCH</p><h3>${esc(c.name)}</h3><p>${esc(c.sport)} · ${esc(c.city||c.format)}</p><p>${c.price!=null?`${Number(c.price)} € / ${esc(c.period)}`:'Цена не указана'}</p><ul>${m.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><div class="actions">${button('coach-profile','Карточка',false,`data-coach="${esc(c.id)}"`)}${button('coach-contact','Написать',true,`data-coach="${esc(c.id)}"`)}${button('share-preview','Передать сводку',false,`data-coach="${esc(c.id)}"`)}</div></article>`).join('')||'<div class="panel"><p>По выбранному спорту пока нет опубликованных тренеров. Уточни спорт в профиле или посмотри каталог.</p>'+button('directory','Все тренеры')+'</div>'}</div>
      <div class="panel section-small"><h3>Что спросить перед началом</h3><ul>${coachQuestions(p).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
      ${shares.length?`<div class="panel section-small"><h3>Переданные сводки</h3><p class="hint">Тренер видит только текст сводки до указанной даты. Отзыв доступа не удаляет копию, которую тренер уже сохранил.</p>${shares.map(s=>`<details><summary>${esc(opts.coachName(s.coach_id))} · до ${esc(new Date(s.expires_at).toLocaleDateString())}</summary><p class="fgi-ai-pre">${esc(s.summary)}</p>${button('revoke-share','Отозвать доступ',false,`data-share="${esc(s.id)}"`)}</details>`).join('')}</div>`:''}
      ${received.length?`<div class="panel section-small"><h3>Клиенты поделились с тобой</h3>${received.map(s=>`<details><summary>Сводка от ${esc(new Date(s.created_at).toLocaleDateString())}</summary><p class="fgi-ai-pre">${esc(s.summary)}</p><p class="hint">До ${esc(new Date(s.expires_at).toLocaleDateString())}. Используй данные только для согласованной работы с клиентом.</p></details>`).join('')}</div>`:''}`;
  }
  function render() {
    if(!actor){root.innerHTML='<div class="ai-workspace-loading"><h2>Твой спортивный помощник</h2><p>AI-тренировки и питание по подписке. Профиль, дневник и подбор тренера доступны без оплаты. Войди, чтобы сохранить свою историю.</p>'+button('login','Войти и начать',true)+'</div>';return;}
    if(!loaded){root.innerHTML='<div class="ai-workspace-loading"><p>Загружаем твоего помощника…</p><p data-ai-status role="status"></p>'+button('refresh','Повторить загрузку')+'</div>';notice(status,statusError);return;}
    const oldLog=q('.fgi-ai-messages'),oldTop=oldLog?.scrollTop||0,atBottom=!oldLog||oldLog.scrollHeight-oldLog.scrollTop-oldLog.clientHeight<80;
    const focused=document.activeElement,restoreFocus=focused?.matches('[data-ai-form=chat] [name=message]')&&root.contains(focused),selection=restoreFocus?[focused.selectionStart,focused.selectionEnd]:null;
    const tabs=[['ask','✧','ai'],['today','◇','training'],['nutrition','◌','nutrition'],['progress','↗','progress'],['coaches','♡','match'],['saved','⌑','saved'],['profile','◎','profile'],['access','◈','access']];
    const show=!profile&&!['access','saved'].includes(view)?'profile':view;
    root.innerHTML=`<div class="fgi-ai-shell${drawerOpen?' drawer-open':''}"><button type="button" class="ai-drawer-backdrop" data-ai-action="close-menu" aria-label="${t('close')}"></button><aside class="fgi-ai-sidebar" role="navigation" aria-label="${t('menu')}"><button type="button" class="ai-sidebar-close" data-ai-action="close-menu" aria-label="${t('close')}">×</button><div class="ai-side-brand"><div class="ai-side-mark" aria-hidden="true">✧</div><div><strong>FitGoIn AI</strong><small>PERSONAL BY DESIGN</small></div></div>${button('new-chat','＋ '+t('newChat'))}<nav class="fgi-ai-nav" aria-label="${t('menu')}">${tabs.map(([key,icon,label])=>`<button class="btn${show===key?' primary':''}" type="button" data-ai-view="${key}" aria-current="${show===key?'page':'false'}"><span class="ai-nav-icon" aria-hidden="true">${icon}</span>${t(label)}</button>`).join('')}</nav><p class="ai-history-label">${t('history')}</p><div class="ai-history">${conversations.slice(0,20).map(c=>`<button type="button" data-ai-history="${esc(c.id)}" aria-current="${c.id===conversation?.id}" title="${esc(c.title)}">${esc(c.title)}</button>`).join('')||'<p class="hint">Новые разговоры появятся здесь.</p>'}</div><a class="ai-side-help" href="./support.html">${t('help')} ↗</a></aside><div class="fgi-ai-main"><div class="ai-workspace-top"><div class="actions"><button type="button" class="ai-mobile-menu" data-ai-action="menu" aria-label="${t('menu')}" aria-expanded="${drawerOpen}">☰</button><strong>${t(tabs.find(x=>x[0]===show)?.[2]||'ai')}</strong></div><span class="tag">${access.friend?'По приглашению':access.modules?.length?'Подписка активна':'AI по подписке'}</span></div><div class="fgi-ai-availability">${configured?'Твой профиль, планы и история — в одном месте.':'AI-ответы пока не подключены; профиль и дневник доступны.'}</div><p class="fgi-ai-status${statusError?' error':''}" data-ai-status role="status">${esc(status)}</p>${statusError?`<div class="ai-error-actions">${button('refresh','Обновить историю')}</div>`:''}
      ${voiceText?`<div class="panel fgi-ai-voice-review"><label>Проверь распознанный текст<textarea data-ai-voice-text rows="2" dir="auto">${esc(voiceText)}</textarea></label><div class="actions">${button('voice-use',active?'Выполнить команду / задать вопрос':'Перенести в вопрос',true)}${button('voice-dismiss','Закрыть')}</div><p class="hint">Голосовые команды выполняются только после подтверждения.</p></div>`:''}<div class="fgi-ai-content">${({profile:profileView,today:todayView,ask:chatView,nutrition:nutritionView,progress:progressView,coaches:coachesView,saved:savedView,access:accessView}[show]||chatView)()}</div></div><dialog data-ai-dialog></dialog></div>`;
    updateRest();
    const log=q('.fgi-ai-messages');if(log)log.scrollTop=atBottom?log.scrollHeight:oldTop;
    if(restoreFocus){const field=q('[data-ai-form=chat] [name=message]');field?.focus({preventScroll:true});if(field&&selection)field.setSelectionRange(...selection);}
  }
  async function ensureConversation(e) {
    if(conversation)return;
    const next=unwrap(await db().from('fgi_ai_conversations').insert({user_id:actor}).select().single());assert(e);conversation=next;
  }
  async function ask(action,message,e) {
    const selected=actionModule(action,module);
    if(!hasAccess(access,selected)){view='access';throw Error('subscription_required');}
    if(!profile)throw Error('consent_required');
    if(['training','nutrition'].includes(action)){
      const missing=missingProfile(profile.data,action==='nutrition');
      if(missing.length){view='profile';throw Error('profile_incomplete');}
      if(limitedProfile(normalizeProfile(profile.data)))throw Error('professional_required');
    }
    await ensureConversation(e);
    const body={action,module:selected,message,conversation_id:conversation.id,request_id:crypto.randomUUID()};
    await deliver(body,e);
  }
  async function deliver(body,e) {
    pending={body,state:'uncertain'};requestActive=true;
    if(draft.trim()===body.message)draft='';searchDraft=false;persistChat();render();
    notice(body.action==='search'?'Ищем и проверяем спортивные источники…':'AI готовит ответ…');
    let result;
    try{result=await api(body,e);}
    catch(error){
      assert(e);pending={body,state:error.confirmed&&error.message!=='request_pending'?'failed':'uncertain'};
      if(!draft)draft=body.message;persistChat();throw error;
    }
    assert(e);
    if(typeof result.answer!=='string'||!result.answer.trim())throw Error('connection_uncertain');
    pending=null;requestActive=false;persistChat();
    if(conversation.title==='FitGoIn AI'){
      // Cosmetic title failure must never turn a committed answer into a resend.
      const renamed=await db().from('fgi_ai_conversations').update({title:body.message.slice(0,80)}).eq('id',conversation.id).eq('user_id',actor).then(value=>value,()=>({error:true}));assert(e);
      if(!renamed.error)conversation.title=body.message.slice(0,80);
    }
    try{await load(e);}catch(error){assert(e);notice('Ответ сохранён на сервере. Не удалось обновить историю; нажми «Обновить».',true);throw Error('history_refresh_failed');}
    if(result.kind)view=result.kind==='nutrition'?'nutrition':'today';else view='ask';
    notice('Ответ сохранён в истории.');
  }
  async function retryMessage(e){
    if(!pending)return;const original=pending;
    await load(e);if(!pending)return;
    const body={...original.body};if(original.state==='failed')body.request_id=crypto.randomUUID();
    await deliver(body,e);
  }

  async function analyzeMedia(form,e) {
    const f=new FormData(form),kind=form.dataset.kind,selected=actionModule(kind);
    if(!hasAccess(access,selected)){view='access';throw Error('subscription_required');}
    if(!f.has('consent'))throw Error('media_consent_required');
    const file=f.get('media');if(!file?.size)throw Error('invalid_image');
    notice('Готовим изображение на твоём устройстве…');
    const images=file.type.startsWith('video/')?await videoForAI(file):[await imageForAI(file)];assert(e);
    await ensureConversation(e);notice('AI оценивает только выбранные изображения…');
    const message=String(f.get('description')||'').trim()||(kind==='food_photo'?'Оцени видимые продукты и неопределённость порции.':'Прокомментируй только видимые положения и ограничения оценки.');
    const result=await api({action:kind,module:selected,request_id:crypto.randomUUID(),conversation_id:conversation.id,message,images,media_consent:MEDIA_CONSENT},e);
    await load(e);analysis={type:kind,document:result.analysis};view=kind==='food_photo'?'nutrition':'ask';notice(kind==='food_photo'?'Оценка готова. Она не добавлена в дневник: проверь порцию и подтверди.':'Оценка выбранных кадров сохранена в разговоре.');
  }
  async function saveProfile(form,e) {
    const f=new FormData(form),data=normalizeProfile({...Object.fromEntries(f),weekdays:f.getAll('weekday').map(Number),allergies:f.getAll('allergy'),needs_professional:f.has('needs_professional')});
    if(!f.has('consent'))throw Error('consent_required');
    if(data.weekdays.length&&data.weekdays.length!==data.days_per_week){notice('Выбери столько дней недели, сколько тренировок указано, или оставь график пустым до создания программы.',true);return;}
    if(!data.goal){notice('Выбери цель. Спорт и график можно добавить перед созданием программы тренировок.',true);return;}
    unwrap(await db().from('fgi_ai_profiles').upsert({user_id:actor,data,consent_version:CONSENT_VERSION,consented_at:profile?.consented_at||new Date().toISOString()},{onConflict:'user_id'}));assert(e);profileDraft=null;intakeStep=0;profileConsent=false;await load(e);view='ask';notice('Профиль сохранён. Теперь помощник будет учитывать его в ответах.');
  }
  function dialog(content) {
    const d=q('[data-ai-dialog]');d.innerHTML=content+button('close-dialog','Закрыть');d.showModal();return d;
  }
  async function startWorkout(index) {
    if(active){notice('У тебя уже есть начатая тренировка. Заверши её или останови.',true);return;}
    const w=latest('training')?.document.workouts[index];if(!w)return;
    dialog(`<h2>Перед тренировкой</h2><form data-ai-form="start" data-index="${index}"><div class="form-grid">${field('Сколько минут есть?',input('minutes',w.minutes,'number','min="10" max="90" step="1" required'))}${field('Сон, часов',input('sleep',progress.find(r=>r.recorded_on===dateNow())?.sleep_hours??7,'number','min="0" max="24" step="0.5" required'))}${field('Энергия, 1–5',input('energy',progress.find(r=>r.recorded_on===dateNow())?.energy??3,'number','min="1" max="5" step="1" required'))}${field('Мышечная усталость, 0–5',input('soreness',0,'number','min="0" max="5" step="1" required'))}</div><label class="fgi-ai-check"><input type="checkbox" name="pain">Есть боль, травма или опасные симптомы</label><p class="hint">При усталости сократим объём. При боли тренировку нужно остановить и обратиться к специалисту.</p><button type="submit" class="btn primary">Начать</button></form>`);
  }
  async function begin(form,e) {
    const f=new FormData(form);if(f.has('pain')){notice('Не начинай тренировку через боль. Обратись к специалисту; при опасных симптомах — за срочной медицинской помощью.',true);return;}
    if(limitedProfile(normalizeProfile(profile.data)))throw Error('professional_required');
    const plan=latest('training'),w=plan?.document.workouts[Number(form.dataset.index)];if(!w)return;
    const readiness={sleep:Number(f.get('sleep')),energy:Number(f.get('energy')),soreness:Number(f.get('soreness')),pain:false};
    const adapted=adaptWorkout(w,Number(f.get('minutes')),readiness);
    if(!adapted.exercises.length){notice('За это время не помещается полноценное упражнение с разминкой. Выбери больше времени или день восстановления.',true);return;}
    const next=unwrap(await db().from('fgi_ai_workouts').insert({user_id:actor,plan_id:plan.id,data:{status:'active',workout:adapted,readiness,index:0,sets:[],rest_until:null}}).select().single());assert(e);active=next;view='today';notice('Тренировка начата. Разомнись перед первым упражнением.');
  }
  async function persistActive(e) {
    unwrap(await db().from('fgi_ai_workouts').update({data:active.data}).eq('id',active.id).eq('user_id',actor));assert(e);
  }
  function updateRest() {
    clearInterval(restTimer);restTimer=null;
    const update=()=>{const target=q('[data-ai-rest]');if(!target)return;const left=Math.max(0,Math.ceil((Date.parse(active?.data.rest_until||'')-Date.now())/1000)||0);target.textContent=left?`Отдых: ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`:'Начинай следующий подход, когда восстановишься.';if(!left){clearInterval(restTimer);restTimer=null;}};
    update();if(active?.data.rest_until&&Date.parse(active.data.rest_until)>Date.now())restTimer=setInterval(update,1000);
  }
  async function recordSet(values,e) {
    if(!active)return;const d=active.data,exercise=d.workout.exercises[d.index];if(!exercise)return;
    const done=d.sets.filter(s=>s.exercise_index===d.index).length;if(done>=exercise.sets)return;
    const reps=Number(values.reps),rpe=Number(values.rpe),weight=values.weight_kg===''||values.weight_kg==null?null:Number(values.weight_kg);
    if(!Number.isInteger(reps)||reps<1||reps>200||!Number.isInteger(rpe)||rpe<1||rpe>10||weight!==null&&(!Number.isFinite(weight)||weight<0||weight>500))return;
    const old=structuredClone(d);
    d.sets.push({exercise_index:d.index,exercise:exercise.name,reps,weight_kg:weight,rpe,recorded_at:new Date().toISOString()});d.rest_until=new Date(Date.now()+exercise.rest_seconds*1000).toISOString();
    try{await persistActive(e);}catch(error){if(e===epoch)active.data=old;throw error;}
    notice('Подход записан. Отдохни перед следующим.');
  }
  async function finish(e,pain=false) {
    if(!active)return;const data={...active.data,status:pain?'stopped':'completed',stopped_for_pain:pain};
    unwrap(await db().from('fgi_ai_workouts').update({data,completed_at:new Date().toISOString()}).eq('id',active.id).eq('user_id',actor));assert(e);
    if(pain){unwrap(await db().from('fgi_ai_profiles').update({data:{...normalizeProfile(profile.data),needs_professional:true}}).eq('user_id',actor));assert(e);}
    active=null;await load(e);view='today';
    notice(pain?'Тренировка остановлена. Не продолжай через боль. При серьёзных симптомах обратись за срочной помощью.':'Тренировка сохранена. Восстановись, а следующий план сможет учитывать результаты.',pain);
  }
  async function saveProgress(form,e) {
    const f=new FormData(form),day=String(f.get('recorded_on')),prior=progress.find(x=>x.recorded_on===day),file=f.get('photo');
    let path=prior?.photo_path||null,uploaded=null;
    if(file?.size){const blob=await opts.prepareImage(file);assert(e);path=`${actor}/${crypto.randomUUID()}.jpg`;unwrap(await db().storage.from('fgi-ai').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'60'}));uploaded=path;assert(e);}
    const optional=name=>f.get(name)===''?null:Number(f.get(name));
    try {unwrap(await db().from('fgi_ai_progress').upsert({user_id:actor,recorded_on:day,weight_kg:optional('weight_kg'),waist_cm:optional('waist_cm'),sleep_hours:optional('sleep_hours'),energy:optional('energy'),notes:String(f.get('notes')).slice(0,1500),photo_path:path},{onConflict:'user_id,recorded_on'}));assert(e);}
    catch(error){if(uploaded)await db().storage.from('fgi-ai').remove([uploaded]);throw error;}
    if(uploaded&&prior?.photo_path){unwrap(await db().storage.from('fgi-ai').remove([prior.photo_path]));assert(e);}
    if(day===dateNow()&&optional('weight_kg')!==null){unwrap(await db().from('fgi_ai_profiles').update({data:{...normalizeProfile(profile.data),weight_kg:optional('weight_kg')}}).eq('user_id',actor));assert(e);}
    await load(e);notice('Запись сохранена.');
  }
  function shareText(withMeasurements=false) {
    const p=normalizeProfile(profile.data),complete=sessions.filter(s=>s.completed_at&&s.data?.status==='completed'&&s.data?.sets?.length);
    return `Цель: ${p.goal}. ${p.target}\nСпорт: ${p.sport}. Опыт: ${p.experience}.\nГрафик: ${p.days_per_week} тренировок по ${p.minutes} минут.\nМесто: ${p.setting}. Оборудование: ${p.equipment||'не указано'}.\nЗаписано тренировок: ${complete.length}.\n${withMeasurements?`Возраст: ${p.age}. Рост: ${p.height_cm??'не указан'} см. Вес: ${p.weight_kg??'не указан'} кг.\n`:''}Вопросы тренеру:\n${coachQuestions(p).join('\n')}`;
  }
  function previewShare(coachId) {
    const d=dialog(`<h2>Передать сводку: ${esc(opts.coachName(coachId))}</h2><p>Тренер получит только показанный ниже текст на 14 дней. Фотографии, переписка и медицинские ограничения в него не входят.</p><form data-ai-form="share" data-coach="${esc(coachId)}"><label class="fgi-ai-check"><input type="checkbox" name="measurements">Добавить возраст, рост и вес</label><pre data-ai-share-preview>${esc(shareText())}</pre><label class="fgi-ai-check"><input type="checkbox" name="share_consent" required>Разрешаю этому тренеру увидеть именно эту сводку.</label><button type="submit" class="btn primary">Разрешить доступ</button></form>`);
    d.querySelector('[name=measurements]').onchange=event=>{d.querySelector('[data-ai-share-preview]').textContent=shareText(event.target.checked);};
  }
  async function exportData(e) {
    const result={version:CONSENT_VERSION,exported_at:new Date().toISOString()};
    for(const table of ['profiles','conversations','messages','plans','workouts','progress','shares','food','feedback']){
      const rows=[];for(let offset=0;;offset+=1000){const page=unwrap(await db().from(`fgi_ai_${table}`).select('*').eq('user_id',actor).order(table==='profiles'?'user_id':table==='feedback'?'message_id':'id').range(offset,offset+999));assert(e);rows.push(...page);if(page.length<1000)break;}result[table]=rows;
    }
    const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fitgoin-ai-${dateNow()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('История скачана. Фотографии хранятся отдельно; сохрани нужные фото из дневника перед удалением.');
  }
  async function voice() {
    if(recorder?.state==='recording'){stopVoice(false);return;}
    if(voicePending||recorder)return;
    if(busy)return;if(!profile){view='profile';render();notice('Сначала сохрани профиль и согласие.',true);return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notice('Запись голоса недоступна в этом браузере. Можно написать вопрос.',true);return;}
    const e=epoch,ticket=++voiceTicket;voicePending=true;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(e!==epoch||ticket!==voiceTicket){stream.getTracks().forEach(t=>t.stop());return;}
      voicePending=false;
      micStream=stream;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
      recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:{audioBitsPerSecond:64000});
      const current=recorder,chunks=[],started=Date.now();
      current.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      current.onerror=()=>{current.cancelled=true;if(current===recorder){stopVoice();notice('Не удалось записать голос.',true);}else{clearTimeout(current.timeout);stream.getTracks().forEach(t=>t.stop());}};
      current.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());if(current===recorder)recorder=null;clearTimeout(current.timeout);
        if(current.cancelled||e!==epoch)return;
        const blob=new Blob(chunks,{type:current.mimeType}),duration=(Date.now()-started)/1000;
        work(async ticket=>{
          if(blob.size>2000000||blob.size<100||duration<.5)throw Error('invalid_audio');
          const bytes=new Uint8Array(await blob.arrayBuffer());assert(ticket);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
          const result=await api({action:'transcribe',module:active?'training':module,request_id:crypto.randomUUID(),audio:btoa(binary),mime:current.mimeType.split(';')[0],duration:Math.min(30,duration)},ticket);voiceText=result.text;notice('Проверь распознанный текст. Он ещё не отправлен в разговор.');
        });
      };
      current.start(250);notice('Запись идёт · нажми «Остановить голос». До 30 секунд.');root.querySelectorAll('[data-ai-action=voice]').forEach(b=>b.textContent='Остановить голос');
      current.timeout=setTimeout(()=>{if(current===recorder)stopVoice(false);},29000);
    }catch{if(e===epoch&&ticket===voiceTicket){stopVoice();notice('Нет доступа к микрофону. Разреши его в настройках браузера или напиши вопрос.',true);}}
  }
  async function useVoice(e) {
    const text=(q('[data-ai-voice-text]')?.value.trim()||voiceText).replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));voiceText='';
    if(active){
      if(/^(следующее упражнение|наступна вправа|next exercise|exercice suivant|nächste übung|siguiente ejercicio|prossimo esercizio|próximo exercício|następne ćwiczenie|التمرين التالي)[.!]?$/i.test(text)){active.data.index++;active.data.rest_until=null;await persistActive(e);view='today';notice('Перешли к следующему упражнению.');return;}
      const match=text.match(/(?:сделал|сделала|зробив|зробила|did|fait|habe|hice|fatto|fiz|zrobiłem|zrobiłam|عملت|قمت ب)\s*(\d{1,3})\s*(?:повтор|reps|répét|wiederhol|repet|ripet|powtór|تكرار)/i);
      if(match){await recordSet({reps:Number(match[1]),rpe:7,weight_kg:null},e);view='today';return;}
      if(/сколько отдыхать|скільки відпочивати|how long.*rest|combien.*repos|wie lange.*pause|cuánto.*descans|quanto.*(?:ripos|descans)|ile.*odpoczy|كم.*راحة/i.test(text)){notice(`Отдых: ${active.data.workout.exercises[active.data.index]?.rest_seconds||60} секунд. При необходимости восстановись дольше.`);return;}
    }
    draft=text;view='ask';render();const textarea=q('[name=message]');if(textarea)textarea.focus();notice('Текст перенесён в вопрос. Проверь его и нажми «Отправить».');
  }
  root.addEventListener('submit',event=>{
    const form=event.target.closest('[data-ai-form]');if(!form)return;event.preventDefault();if(busy)return;
    const name=form.dataset.aiForm;
    if(name==='chat'){
      const f=new FormData(form),text=String(f.get('message')||'').trim();
      if(!text)return;
      if(pending?.state==='uncertain'){notice('Сначала проверь ответ на предыдущий запрос.',true);return;}
      const search=f.has('search')||/найди (?:исследован|источник)|поищи в интернете|search (?:the web|for studies)|trouve.*études|знайди.*дослідж/i.test(text);
      const plan=/^(?:составь|создай|обнови|перестрой|переделай|зроби|створи|create|build|update).*(?:программ|трениров|workout|training|програм|тренув)/i.test(text);
      const menu=/^(?:составь|создай|обнови|create|build|update).*(?:меню|питани|meal|nutrition)/i.test(text);
      work(e=>ask(search?'search':menu?'nutrition':plan?'training':'chat',text,e));return;
    }
    work(async e=>{
      if(name==='profile')await saveProfile(form,e);
      if(name==='progress')await saveProgress(form,e);
      if(name==='start')await begin(form,e);
      if(name==='media')await analyzeMedia(form,e);
      if(name==='food'){const f=new FormData(form),row=normalizeFood(Object.fromEntries(f));unwrap(await db().from('fgi_ai_food').insert({...row,user_id:actor,recorded_on:String(f.get('recorded_on')),source:form.dataset.source==='confirmed_photo'?'confirmed_photo':'manual'}));assert(e);analysis=null;await load(e);view='nutrition';notice('Подтверждённая запись добавлена в дневник.');}
      if(name==='set')await recordSet(Object.fromEntries(new FormData(form)),e);
      if(name==='share'){
        const f=new FormData(form);if(!f.has('share_consent'))return;
        unwrap(await db().from('fgi_ai_shares').insert({user_id:actor,coach_id:form.dataset.coach,summary:shareText(f.has('measurements')),expires_at:new Date(Date.now()+14*86400000).toISOString()}));assert(e);await load(e);notice('Доступ к показанной сводке разрешён на 14 дней. Можно написать тренеру и обсудить начало работы.');
      }
      if(name==='delete'){
        if(new FormData(form).get('confirm')!=='УДАЛИТЬ')return;await api({action:'delete_data',confirm:CONSENT_VERSION},e);active=null;pending=null;draft='';persistChat();await opts.clearSaved?.();assert(e);savedIds=[];savedMessages=[];profileDraft=null;profileConsent=false;intakeStep=0;await load(e);view='profile';notice('Твои данные FitGoIn AI удалены.');
      }
    });
  });
  root.addEventListener('click',event=>{
    const quick=event.target.closest('[data-ai-quick]');if(quick&&!busy){const action=quick.dataset.aiQuick;if(action==='today'||action==='coach'){view=action==='today'?'today':'coaches';render();return;}if(action==='question'){view='ask';render();q('[name=message]')?.focus();return;}if(draft.trim()){notice('Сначала отправь или измени уже набранный вопрос.');q('[name=message]')?.focus();return;}draft=action==='training'?'Создай недельную программу тренировок по моему профилю.':'Помоги с питанием: ';searchDraft=false;module=action==='nutrition'?'nutrition':'training';persistChat();render();q('[name=message]')?.focus();return;}
    const history=event.target.closest('[data-ai-history]');if(history&&!busy){conversation=conversations.find(x=>x.id===history.dataset.aiHistory)||null;historyLimit=80;persistChat();view='ask';menu(false);work(e=>load(e));return;}
    const tab=event.target.closest('[data-ai-view]');if(tab){if(busy)return;stopVoice();menu(false);view=tab.dataset.aiView;status='';render();return;}
    const b=event.target.closest('[data-ai-action]');if(!b)return;const action=b.dataset.aiAction;
    if(action==='voice'){voice();return;}
    if(action==='menu'){menu(true);return;}
    if(action==='close-menu'){menu(false);return;}
    if(action==='stop'&&requestActive){userStopped=true;controller?.abort();notice('Останавливаем ожидание…');return;}
    if(busy&&action!=='close-dialog')return;
    if(action.startsWith('view-')){view=action.slice(5);stopVoice();status='';render();return;}
    if(action==='login'){opts.login();return;}
    if(action==='directory'){opts.navigate('coaches');return;}
    if(action==='platform-link'&&['account','inbox','match','coaches'].includes(b.dataset.destination)){opts.navigate(b.dataset.destination);return;}
    if(action==='close-dialog'){q('[data-ai-dialog]')?.close();return;}
    if(action==='intake-next'||action==='intake-prev'){
      if(action==='intake-next'){const invalid=[...q(`[data-ai-intake="${intakeStep}"]`).querySelectorAll('input,select,textarea')].find(el=>!el.checkValidity());if(invalid){invalid.reportValidity();return;}}
      intakeStep=Math.max(0,Math.min(3,intakeStep+(action==='intake-next'?1:-1)));render();q('.ai-intake h2')?.scrollIntoView({block:'start',behavior:'instant'});return;
    }
    if(action==='food-photo'){dialog(mediaForm('food_photo'));return;}
    if(action==='document'){q('[data-ai-document]')?.click();return;}
    if(action==='copy'){const row=[...messages,...savedMessages].find(m=>m.id===b.dataset.messageId);if(row)navigator.clipboard.writeText(row.body).then(()=>notice('Ответ скопирован.')).catch(()=>notice('Браузер не разрешил копирование. Выдели текст сообщения и скопируй вручную.',true));return;}
    if(action==='start-workout'){startWorkout(Number(b.dataset.workout));return;}
    if(action==='manual-food'){foodDialog();return;}
    if(action==='confirm-food'&&analysis?.type==='food_photo'){foodDialog({name:analysis.document.title,...analysis.document.total},'confirmed_photo');return;}
    if(action==='technique'){dialog(mediaForm('technique'));return;}
    if(action==='share-preview'){previewShare(b.dataset.coach);return;}
    if(action==='delete-data'){dialog('<h2>Удалить данные AI?</h2><p>Будут удалены спортивный профиль, AI-переписка, планы, результаты, фотографии и переданные сводки. Основной аккаунт и сообщения тренерам сохранятся. Удаление AI-данных не отменяет подписку; её нужно отменить отдельно в «Доступ к AI».</p><form data-ai-form="delete"><label>Введи УДАЛИТЬ<input name="confirm" required pattern="УДАЛИТЬ" autocomplete="off"></label><button type="submit" class="btn">Удалить данные AI</button></form>');return;}
    if(action==='speak'){const text=messages.find(m=>m.id===b.dataset.messageId)?.body;if(text&&window.speechSynthesis){speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang=normalizeProfile(profile?.data).language;speechSynthesis.speak(speech);}return;}
    if(action==='voice-dismiss'){voiceText='';render();return;}
    if(action==='nutrition-question'){module='nutrition';draft='Помоги заменить продукты в моём меню: ';view='ask';render();return;}
    work(async e=>{
      if(action==='save'){savedIds=await opts.toggleSaved(b.dataset.messageId);assert(e);await load(e);notice(savedIds.includes(b.dataset.messageId)?'Ответ сохранён.':'Ответ убран из сохранённого.');}
      if(action==='regenerate'){const index=messages.findIndex(m=>m.id===b.dataset.messageId),previous=messages.slice(0,index).findLast(m=>m.role==='user');if(previous)await ask('chat','Предложи другой вариант ответа, сохраняя мои условия. Исходный вопрос: '+previous.body.slice(0,4500),e);}
      if(action==='checkout'||action==='portal'){const result=await api({action,plan:b.dataset.plan,request_id:crypto.randomUUID()},e,true);assert(e);const target=new URL(result.url);if(target.protocol!=='https:'||!(action==='checkout'?target.hostname==='checkout.stripe.com':target.hostname==='billing.stripe.com'))throw Error('billing_unavailable');window.location.assign(target.href);}
      if(action==='remove-food'){unwrap(await db().from('fgi_ai_food').delete().eq('id',b.dataset.foodId).eq('user_id',actor));assert(e);await load(e);notice('Запись питания удалена.');}
      if(action==='calendar'){const hour='18:00',ics=trainingCalendar(normalizeProfile(profile.data),hour),url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='fitgoin-training.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('График скачан: тренировки в 18:00 местного времени, напоминание за 15 минут. Время можно изменить в календаре.');}
      if(action==='feedback'){unwrap(await db().from('fgi_ai_feedback').upsert({user_id:actor,message_id:b.dataset.messageId,useful:b.dataset.useful==='true'},{onConflict:'user_id,message_id'}));assert(e);notice('Твоя оценка сохранена. Спасибо за обратную связь.');}
      if(action==='refresh')await load(e);
      if(action==='more-history'){historyLimit+=80;await load(e);notice('Предыдущие сообщения загружены.');}
      if(action==='retry-message')await retryMessage(e);
      if(action==='new-chat'){if(pending?.state==='uncertain'){notice('Сначала проверь доставку предыдущего вопроса.',true);return;}const next=unwrap(await db().from('fgi_ai_conversations').insert({user_id:actor}).select().single());assert(e);conversation=next;messages=[];draft='';searchDraft=false;historyLimit=80;pending=null;persistChat();view='ask';menu(false);await load(e);notice('Новый разговор. Твой профиль и результаты сохраняются.');}
      if(action==='create-training')await ask('training','Создай или обнови недельную программу по моему профилю, последним результатам и восстановлению.',e);
      if(action==='create-nutrition')await ask('nutrition','Составь примерный день питания по моим целям, предпочтениям и ограничениям.',e);
      if(action==='next-exercise'&&active){const old=structuredClone(active.data);active.data.index++;active.data.rest_until=null;try{await persistActive(e);}catch(error){if(e===epoch)active.data=old;throw error;}notice('Следующее упражнение. Не спеши, если ещё не восстановился.');}
      if(action==='finish-workout')await finish(e);
      if(action==='pain-stop')await finish(e,true);
      if(action==='coach-profile')await opts.openCoach(b.dataset.coach);
      if(action==='coach-contact')await opts.contact(b.dataset.coach);
      if(action==='voice-use')await useVoice(e);
      if(action==='export')await exportData(e);
      if(action==='revoke-share'){unwrap(await db().from('fgi_ai_shares').delete().eq('id',b.dataset.share).eq('user_id',actor));assert(e);await load(e);notice('Доступ к сводке отозван.');}
      if(action==='remove-photo'){
        const row=progress.find(x=>x.id===b.dataset.progressId);if(!row?.photo_path)return;
        unwrap(await db().storage.from('fgi-ai').remove([row.photo_path]));assert(e);unwrap(await db().from('fgi_ai_progress').update({photo_path:null}).eq('id',row.id).eq('user_id',actor));assert(e);await load(e);notice('Фото удалено.');
      }
    });
  });
  root.addEventListener('input',event=>{
    if(event.target.matches('[name=message]')){draft=event.target.value;persistChat();}
    if(event.target.matches('[name=search]')){searchDraft=event.target.checked;persistChat();}
    const form=event.target.closest('[data-ai-form=profile]');if(form){const f=new FormData(form);profileConsent=f.has('consent');profileDraft=normalizeProfile({...Object.fromEntries(f),weekdays:f.getAll('weekday').map(Number),allergies:f.getAll('allergy'),needs_professional:f.has('needs_professional')});}
  });
  root.addEventListener('change',event=>{if(event.target.matches('[data-ai-module]')&&!busy){module=event.target.value==='nutrition'?'nutrition':'training';persistChat();render();return;}if(event.target.matches('[data-ai-conversation]')&&!busy){conversation=conversations.find(x=>x.id===event.target.value)||null;work(e=>load(e));}});
  root.addEventListener('change',async event=>{if(!event.target.matches('[data-ai-document]'))return;const file=event.target.files?.[0],e=epoch;if(!file)return;try{if(file.size>50000||!/^.+\.(txt|md)$/i.test(file.name))throw Error('Выбери текстовый файл .txt или .md до 50 КБ.');const text=await file.text();assert(e);if(text.includes('\u0000')||text.length>4500)throw Error('Текст должен быть до 4500 символов. Сократи файл перед добавлением.');draft=('Текст для обсуждения:\n'+text).slice(0,5000);view='ask';render();notice('Текст добавлен в вопрос. Проверь личные данные и нажми «Отправить», когда будешь готов.');q('[name=message]')?.focus();}catch(error){if(e===epoch)notice(error.message,true);}});
  root.addEventListener('keydown',event=>{if(event.target.matches('[data-ai-form=chat] [name=message]')&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){event.preventDefault();if(!busy&&configured&&event.target.value.trim())event.target.form.requestSubmit();return;}if(!drawerOpen)return;if(event.key==='Escape'){event.preventDefault();menu(false);}if(event.key==='Tab'){const controls=[...q('.fgi-ai-sidebar').querySelectorAll('button:not([disabled]),a[href]')].filter(el=>!el.hidden);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  root.addEventListener('invalid',event=>{const section=event.target.closest('[data-ai-intake]');if(section&&section.hidden){intakeStep=Number(section.dataset.aiIntake);root.querySelectorAll('[data-ai-intake]').forEach(el=>el.hidden=Number(el.dataset.aiIntake)!==intakeStep);}},true);
  const stopHiddenVoice=()=>{if(document.hidden)stopVoice();};
  document.addEventListener('visibilitychange',stopHiddenVoice);
  render();
  fetch(opts.endpoint,{method:'GET',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).then(value=>{configured=Boolean(value?.configured);if(!busy)render();}).catch(()=>{});
  return {
    setSession(user){if(actor===user?.id)return;reset();actor=user?.id||null;if(actor)restoreChat();render();if(actor)setTimeout(()=>work(e=>load(e)),0);},
    open(){if(actor&&(!loaded||Date.now()-lastLoad>60000))work(e=>load(e));else render();},
    leave(){stopVoice();menu(false);if(window.speechSynthesis)window.speechSynthesis.cancel();},
    // Inspectable state contains the current user's public UI only; no auth tokens.
    destroy(){document.removeEventListener('visibilitychange',stopHiddenVoice);reset();root.replaceChildren();}
  };
}
