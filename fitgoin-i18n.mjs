import {frCatalog,staticFrench} from './fitgoin-fr.mjs';
// One catalog for the new experience. Stable stored sports/goals remain unchanged.
export const messages = {
  ru: {
    platform:'GLOBAL TRAINER PLATFORM', tagline:'Find the one who fits you.',
    heroCopy:'Твой спорт. Твои цели. Свой человек рядом.', find:'Найти моего тренера', join:'Стать тренером', login:'Войти', already:'Уже с нами?',
    home:'Главная', ranking:'Рейтинг тренеров', space:'Моё пространство', trainerCard:'Моя карточка', edit:'Редактировать профиль', inbox:'Сообщения', ai:'FitGoIn AI', match:'Найти тренера', settings:'Настройки',
    welcomeEyebrow:'ТВОЙ ПЕРВЫЙ ШАГ', welcomeTitle:'Двигаться к цели проще вместе.', welcomeCopy:'С чего начнём? Помощник сохранит твой спортивный профиль, а MATCH поможет найти специалиста на FitGoIn.',
    aiTitle:'Свой спортивный помощник', aiCopy:'Персональные тренировки, питание и история прогресса. AI-ответы доступны по подписке; профиль и дневник — без оплаты.', aiStart:'Начать с AI',
    humanTitle:'Тренер, который понимает тебя', humanCopy:'Опыт, формат, язык и твои цели. Несколько коротких вопросов — и подходящие реальные тренеры.', humanStart:'Найти своего тренера',
    dashboardTitle:'Твоё пространство.', dashboardCopy:'Выбирай следующий шаг в своём темпе.', continueMatch:'Продолжить подбор', openAI:'Открыть помощника',
    personal:'ПЕРСОНАЛЬНЫЙ ПОДХОД', account:'Аккаунт', goal:'Твоя цель', coachProfile:'Профиль тренера', confirm:'Подтверждение',
    signupClient:'Создай своё пространство.', signupCoach:'Давай познакомимся.', signupClientHint:'Имя, email и пароль — и можно выбрать свой путь.', signupCoachHint:'Создай аккаунт. После подтверждения email оформим твою карточку.',
    emailSignup:'Создать аккаунт', confirmationHint:'Если аккаунт создан, письмо уже отправлено. Проверь входящие и папку «Спам». После подтверждения вернись на FitGoIn.',
    searching:'Ищем человека, который подходит тебе.', searchingCopy:'Сравниваем твою анкету с опубликованными профилями тренеров.', results:'Твой MATCH', change:'Изменить пожелания', directory:'Все тренеры',
    coachSteps:['Знакомство','Профессия','Условия','Твой подход','Портфолио','Предпросмотр'], next:'Дальше', back:'Назад', draft:'Черновик сохранён', saving:'Сохраняем…', saveError:'Не удалось сохранить черновик. Изменения пока только в этой вкладке. Не закрывай её до успешного сохранения.',
    preview:'Предпросмотр карточки', previewCopy:'Так клиенты увидят твой профиль. Проверь текст, фото и условия перед публикацией.', publish:'Опубликовать профиль', saveAndPortfolio:'Сохранить и добавить фото', sendShortcut:'Ctrl / ⌘ + Enter — отправить', portfolioNext:'Посмотреть карточку перед публикацией',
    photoLater:'Портрет и портфолио добавим на следующем шаге.', saved:'Сохранённое', newChat:'Новый разговор', history:'История', training:'Мои тренировки', nutrition:'Моё питание', progress:'Мой прогресс', profile:'Мой профиль', access:'Доступ к AI',
    chatEyebrow:'ТВОЙ ПЕРСОНАЛЬНЫЙ ПОМОЩНИК', chatTitle:'Что сделаем для твоей цели?', chatCopy:'План, маленький шаг или ответ на вопрос — начни с того, что нужно сегодня.',
    quickToday:'Моя тренировка', quickQuestion:'Задать вопрос', quickTraining:'Создать программу', quickNutrition:'Питание', quickTime:'У меня только 25 минут', quickTechnique:'Объяснить упражнение', quickResearch:'Найти исследования', quickCoach:'Найти тренера',
    question:'Твой вопрос', placeholder:'Расскажи, что нужно сегодня…', send:'Отправить', stop:'Остановить', copy:'Копировать', save:'Сохранить', removeSaved:'Убрать из сохранённого', regenerate:'Новый вариант',
    noSaved:'Сохрани полезный ответ кнопкой под сообщением — он появится здесь.', menu:'Разделы помощника', close:'Закрыть', typing:'Помощник готовит ответ',
    source:'Источники', photo:'Фото еды', technique:'Фото / видео техники', document:'Текстовый файл', sourceSearch:'Проверить в интернете', privateSearch:'Для поиска задавай общий спортивный вопрос без личных данных.',
    consent:'Твои данные остаются личными. Передача сводки тренеру — только с твоего разрешения.', help:'Помощь и поддержка', founder:'Основатель',
    intakeSteps:['Цель и опыт','График и оборудование','Питание и предпочтения','Проверка и согласие'], intakeTitle:'Познакомимся с тобой.', intakeCopy:'Несколько коротких шагов. Эти данные помогут адаптировать ответы и планы.', intakeDone:'Сохранить и открыть помощника',
  },
  en: {
    platform:'GLOBAL TRAINER PLATFORM', tagline:'Find the one who fits you.', heroCopy:'Your sport. Your goals. Your person.', find:'Find my trainer', join:'Join as trainer', login:'Log in', already:'Already with us?',
    home:'Home', ranking:'Trainer rankings', space:'My space', trainerCard:'My trainer card', edit:'Edit profile', inbox:'Messages', ai:'FitGoIn AI', match:'Find a trainer', settings:'Settings',
    welcomeEyebrow:'YOUR FIRST STEP', welcomeTitle:'Better together. Your way.', welcomeCopy:'Where shall we start? AI remembers your sports profile, while MATCH helps you find the right professional on FitGoIn.',
    aiTitle:'Your sports assistant', aiCopy:'Personal training, nutrition and progress history. AI responses require a subscription; your profile and diary are free.', aiStart:'Start with AI',
    humanTitle:'A trainer who gets you', humanCopy:'Experience, format, language and your goals. A few short questions connect you with real trainers.', humanStart:'Find my trainer',
    dashboardTitle:'Your space.', dashboardCopy:'Take your next step at your own pace.', continueMatch:'Continue my MATCH', openAI:'Open my assistant',
    personal:'PERSONAL BY DESIGN', account:'Account', goal:'Your goal', coachProfile:'Trainer profile', confirm:'Confirmation',
    signupClient:'Create your space.', signupCoach:'Let’s meet.', signupClientHint:'Your name, email and password. Then choose your path.', signupCoachHint:'Create an account. After confirming your email, we’ll build your trainer card.', emailSignup:'Create account', confirmationHint:'If your account was created, a confirmation email is on its way. Check your inbox and spam folder, confirm your email, then return to FitGoIn.',
    searching:'Finding the one who fits you.', searchingCopy:'Comparing your preferences with published trainer profiles.', results:'Your MATCH', change:'Edit preferences', directory:'All trainers',
    coachSteps:['About you','Profession','Services','Your approach','Portfolio','Preview'], next:'Continue', back:'Back', draft:'Draft saved', saving:'Saving…', saveError:'Your draft could not be saved. Your changes are only in this tab. Keep it open until saving succeeds.',
    preview:'Preview your trainer card', previewCopy:'This is how clients will see your profile. Check your photos, story and services before publishing.', publish:'Publish profile', saveAndPortfolio:'Save and add photos', sendShortcut:'Ctrl / ⌘ + Enter to send', portfolioNext:'Preview my card before publishing', photoLater:'Add your portrait and portfolio in the next step.',
    saved:'Saved', newChat:'New conversation', history:'History', training:'My training', nutrition:'My nutrition', progress:'My progress', profile:'My profile', access:'AI access',
    chatEyebrow:'YOUR PERSONAL SPORTS ASSISTANT', chatTitle:'What will we do for your goal?', chatCopy:'A plan, a small step or an answer. Start with what you need today.',
    quickToday:'My workout', quickQuestion:'Ask a question', quickTraining:'Build my training plan', quickNutrition:'Help with nutrition', quickTime:'I have just 25 minutes', quickTechnique:'Explain an exercise', quickResearch:'Find research', quickCoach:'Find a trainer',
    question:'Your question', placeholder:'Tell me what you need today…', send:'Send', stop:'Stop', copy:'Copy', save:'Save', removeSaved:'Unsave', regenerate:'Another version', noSaved:'Save a useful answer using the button below it. It will appear here.', menu:'Assistant sections', close:'Close', typing:'Your assistant is preparing an answer',
    source:'Sources', photo:'Food photo', technique:'Exercise photo / video', document:'Text file', sourceSearch:'Check online', privateSearch:'Search general sports questions without personal information.', consent:'Your data stays private. Sharing a summary with a trainer requires your permission.', help:'Help and support', founder:'Founder',
    intakeSteps:['Goal and experience','Schedule and equipment','Nutrition and preferences','Review and consent'], intakeTitle:'Let’s get to know you.', intakeCopy:'A few short steps to help personalize your answers and plans.', intakeDone:'Save and open my assistant',
  }
};
// Languages supported by this interface. Region selects the initial language only.
messages.fr = frCatalog;

// Labels for demonstrations next to training exercises.
Object.assign(messages.ru, {exerciseVideoShow:'Посмотреть видео',exerciseVideoUnavailable:'Для этого упражнения встроенного видео пока нет. Можно поискать демонстрацию по названию; проверь, что упражнение и оборудование совпадают.',exerciseVideoSearch:'Найти видео',exerciseVideoOpen:'Открыть видео',exerciseVideoSource:'Источник видео',exerciseVideoEnglish:'Видео с YouTube на английском языке.',exerciseVideoUnsupported:'Браузер не поддерживает это видео.',exerciseVideoQuery:'техника выполнения',exerciseVideoLoading:'Загружаем видео…',exerciseVideoError:'Не удалось загрузить видео. Попробуй открыть его отдельно или найти другое.'});
Object.assign(messages.en, {exerciseVideoShow:'Watch demonstration',exerciseVideoUnavailable:'There is no embedded video for this exercise yet. You can search by name; check that the movement and equipment match.',exerciseVideoSearch:'Find a video',exerciseVideoOpen:'Open video',exerciseVideoSource:'Video source',exerciseVideoEnglish:'YouTube video in English.',exerciseVideoUnsupported:'Your browser cannot play this video.',exerciseVideoQuery:'exercise technique',exerciseVideoLoading:'Loading video…',exerciseVideoError:'Could not load the video. Try opening it separately or finding another.'});
Object.assign(messages.fr, {exerciseVideoShow:'Voir la démonstration',exerciseVideoUnavailable:'Aucune vidéo intégrée pour cet exercice pour le moment. Vous pouvez chercher par nom ; vérifiez que le mouvement et le matériel correspondent.',exerciseVideoSearch:'Chercher une vidéo',exerciseVideoOpen:'Ouvrir la vidéo',exerciseVideoSource:'Source de la vidéo',exerciseVideoEnglish:'Vidéo YouTube en anglais.',exerciseVideoUnsupported:'Votre navigateur ne peut pas lire cette vidéo.',exerciseVideoQuery:'technique exercice',exerciseVideoLoading:'Chargement de la vidéo…',exerciseVideoError:'Impossible de charger la vidéo. Essayez de l’ouvrir séparément ou d’en trouver une autre.'});

// Approved future AI offers shown on the in-app access screen. The actual Stripe
// products and current server entitlements stay unchanged until billing launch.
const aiOfferTranslations={
  ru:{
    offerAccessTitle:'Доступ к FitGoIn AI',offerRefresh:'Проверить доступ',
    offerPrelaunchNotice:'Новые тарифы утверждены, но подписки и бесплатная неделя ещё не активированы. Оплата картой пока отключена; списаний не будет.',
    offerWeek:'/ 7 дней',offerMonth:'/ месяц',
    offerTrialDescription:'7 дней бесплатного ознакомления с AI-тренером.',
    offerTrialTokens:'1 000 000 токенов на все 7 дней без ежедневного сброса.',
    offerTrialChat:'Общение с AI и общие советы по тренировкам и питанию.',
    offerTrialRestriction:'Без персональных программ тренировок и питания, поиска в интернете и анализа фото.',
    offerProDescription:'Полноценный персональный AI-тренер.',
    offerProPlans:'Персональные программы тренировок и питания с корректировкой в диалоге.',
    offerProMemory:'Память, дневник тренировок и анализ прогресса.',
    offerProSearch:'До 30 поисков в месяц по проверенным научным и официальным источникам.',
    offerPremiumDescription:'Расширенные возможности персонального AI-тренера.',
    offerPremiumAll:'Все возможности AI Pro.',
    offerPremiumMedia:'Анализ фото еды и видимой техники упражнений по фото и выбранным кадрам видео; подробные отчёты.',
    offerPremiumSearch:'До 100 интернет-поисков в месяц по проверенным источникам.',
    offerComingSoon:'Скоро доступно · оформление пока закрыто.',
    offerFriendNotice:'Твой доступ по приглашению сохраняется.',
    offerAccessUnavailable:'Сервер проверки текущего доступа временно недоступен.',
    offerAllFeatures:'Все условия Trial, Pro и Premium',
    offerUsageNotice:'AI автоматически выбирает Luna для обычных вопросов и Terra для сложных задач. После запуска будут действовать лимиты использования и расходов; подписки не безлимитные.',
    offerExistingAccessSafe:'Существующий доступ к AI и сохранённые данные не меняются до запуска новой системы.',
    offerTerms:'Условия FitGoIn AI',
    offerExistingTitle:'Существующая подписка',offerManageExisting:'Управлять текущей подпиской / отменить'
  },
  en:{
    offerAccessTitle:'Access to FitGoIn AI',offerRefresh:'Check access',
    offerPrelaunchNotice:'The new plans are confirmed, but subscriptions and the free trial are not yet active. Card payments are disabled, so no charges will be made.',
    offerWeek:'/ 7 days',offerMonth:'/ month',
    offerTrialDescription:'A free seven-day introduction to your AI coach.',
    offerTrialTokens:'1,000,000 tokens shared across all 7 days, with no daily reset.',
    offerTrialChat:'AI chat and general training and nutrition guidance.',
    offerTrialRestriction:'No personalized workout or nutrition plans, online research or photo analysis.',
    offerProDescription:'Your full personal AI coach.',
    offerProPlans:'Personalized training and nutrition plans, with adjustments by chat.',
    offerProMemory:'Memory, workout diary and progress analysis.',
    offerProSearch:'Up to 30 searches per month of verified official and scientific sources.',
    offerPremiumDescription:'Advanced capabilities for your personal AI coach.',
    offerPremiumAll:'Everything in AI Pro.',
    offerPremiumMedia:'Food photo assessments, exercise technique analysis from photos and selected video frames, and detailed reports.',
    offerPremiumSearch:'Up to 100 verified-source web searches per month.',
    offerComingSoon:'Coming soon · enrollment is not yet open.',
    offerFriendNotice:'Your invitation-based access remains available.',
    offerAccessUnavailable:'The current access verification service is temporarily unavailable.',
    offerAllFeatures:'Full Trial, Pro and Premium plan details',
    offerUsageNotice:'AI automatically uses Luna for everyday questions and Terra for complex tasks. Usage and cost limits will apply when subscriptions launch; plans are not unlimited.',
    offerExistingAccessSafe:'Your existing AI access and saved data will not change before the new plans launch.',
    offerTerms:'FitGoIn AI terms',
    offerExistingTitle:'Existing subscription',offerManageExisting:'Manage or cancel existing subscription'
  },
  fr:{
    offerAccessTitle:'Accès à FitGoIn AI',offerRefresh:'Vérifier mon accès',
    offerPrelaunchNotice:"Les nouvelles offres sont confirmées, mais les abonnements et l'essai gratuit ne sont pas encore activés. Le paiement par carte est désactivé : aucun prélèvement n'aura lieu.",
    offerWeek:'/ 7 jours',offerMonth:'/ mois',
    offerTrialDescription:"Sept jours gratuits pour découvrir ton coach IA.",
    offerTrialTokens:'1 000 000 de tokens sur les 7 jours, sans remise à zéro quotidienne.',
    offerTrialChat:"Discussions avec l'IA et conseils généraux sur le sport et la nutrition.",
    offerTrialRestriction:"Sans programmes d'entraînement ou de nutrition personnalisés, recherche web ni analyse photo.",
    offerProDescription:'Ton coach IA personnel complet.',
    offerProPlans:"Programmes d'entraînement et de nutrition personnalisés, modifiables en discutant.",
    offerProMemory:'Mémoire, journal des séances et analyse des progrès.',
    offerProSearch:"Jusqu'à 30 recherches mensuelles sur des sources officielles et scientifiques fiables.",
    offerPremiumDescription:'Des capacités avancées pour ton coach IA personnel.',
    offerPremiumAll:"Toutes les fonctionnalités d'AI Pro.",
    offerPremiumMedia:"Estimation des repas sur photo, analyse de la technique à partir de photos et d'images vidéo sélectionnées, et bilans détaillés.",
    offerPremiumSearch:"Jusqu'à 100 recherches web mensuelles sur des sources fiables.",
    offerComingSoon:'Bientôt disponible · inscriptions non ouvertes.',
    offerFriendNotice:"Ton accès sur invitation est conservé.",
    offerAccessUnavailable:"Le service de vérification de l'accès est temporairement indisponible.",
    offerAllFeatures:'Tous les détails des offres Trial, Pro et Premium',
    offerUsageNotice:"L'IA choisit automatiquement Luna pour les questions courantes et Terra pour les tâches complexes. Des limites d'utilisation et de coût s'appliqueront au lancement ; les abonnements ne sont pas illimités.",
    offerExistingAccessSafe:"Ton accès IA actuel et tes données sauvegardées restent inchangés jusqu'au lancement des nouvelles offres.",
    offerTerms:"Conditions de FitGoIn AI",
    offerExistingTitle:'Abonnement existant',offerManageExisting:"Gérer ou résilier mon abonnement actuel"
  }
};
for(const [language,catalog] of Object.entries(aiOfferTranslations)) Object.assign(messages[language],catalog);

// The Russian source HTML also contains untagged, static labels. Reuse the
// curated locale catalogs for their English translations instead of leaving
// those labels in Russian. Conflicting translations are deliberately skipped.
const englishLiterals=new Map();
function registerEnglish(source,translation){
  if(typeof source!=='string'||typeof translation!=='string')return;
  const key=source.trim();
  if(!key||key===translation)return;
  if(englishLiterals.has(key)&&englishLiterals.get(key)!==translation)englishLiterals.set(key,null);
  else if(!englishLiterals.has(key))englishLiterals.set(key,translation);
}
for(const [key,original] of Object.entries(messages.ru)){
  const english=messages.en[key];
  if(Array.isArray(original)&&Array.isArray(english)){
    original.forEach((value,i)=>registerEnglish(value,english[i]));
  }else registerEnglish(original,english);
}
export function translateStaticLiteral(value,language){
  const text=String(value||'').trim();
  if(language==='fr')return staticFrench[text]||text;
  if(language==='en')return englishLiterals.get(text)||text;
  return text;
}

const choiceKey='fitgoin_locale_preference_v1';
const savedTexts=new WeakMap(),savedAttributes=new WeakMap();
const ignoreContent='script,style,[data-i18n],[translate="no"],#messages,#threads,#profileContent,#coachesList,#rankingList,#matchResults,#fitgoinAI,#myGallery,#chatAttachmentPreview';
// Native FR/EN/RU localization must not compete with browser/Google translation.
// Chrome/Google normally injects layout-affecting <font> wrappers; once present,
// leave that translated DOM intact until the visitor explicitly changes the
// built-in FitGoIn language picker. No external calls or translation services.
export function browserTranslationActive(doc=typeof document!=='undefined'?document:null){
  if(!doc?.documentElement)return false;
  const classes=doc.documentElement.classList;
  return classes?.contains('translated-ltr')||classes?.contains('translated-rtl')||
    Boolean(doc.querySelector?.('font[style*="vertical-align"]'));
}

let locale='ru', observing=false, queued=false, manuallyChosen=false, regionCountry='';
export function getRegionCountry(){return regionCountry;}
export function hasManualLocale(){return manuallyChosen;}
const validLocale=value=>['ru','en','fr'].includes(String(value).toLowerCase())?String(value).toLowerCase():null;

export function chooseLocale({saved='',country='',languages=[],timeZone=''}={}) {
  const chosen=validLocale(saved);if(chosen)return chosen;
  const nation=String(country).toUpperCase();
  if(nation==='FR'||nation==='MC')return 'fr';
  if(nation==='RU'||nation==='BY')return 'ru';
  if(['GB','US','AU','NZ','IE'].includes(nation))return 'en';
  // Paris time zone is a regional fallback when a country header is unavailable.
  if(!nation&&timeZone==='Europe/Paris')return 'fr';
  const list=Array.isArray(languages)?languages:[languages];
  for(const tag of list){
    const value=String(tag||'').toLowerCase();
    const region=value.match(/^[a-z]{2,3}[-_]([a-z]{2})\b/)?.[1]?.toUpperCase();
    if(region==='FR'||region==='MC')return 'fr';
    const lang=value.split(/[-_]/)[0];
    if(validLocale(lang))return lang;
  }
  return 'en';
}
export function t(key) {
  return messages[locale]?.[key] ?? (locale==='fr'?messages.en[key]:messages.ru[key]) ?? messages.ru[key] ?? key;
}
export function getLocale(){return locale;}
export function setLocale(next,{persist=false}={}){
  const resolved=validLocale(next)||'ru',changed=locale!==resolved;
  locale=resolved;
  if(typeof document!=='undefined'){
    if(!browserTranslationActive()||persist){
      document.documentElement.lang=locale;
      translate(document,{force:persist});
    }
    const select=document.getElementById('languageSelect');
    if(select)select.value=locale;
  }
  if(persist){
    manuallyChosen=true;
    try{localStorage.setItem(choiceKey,locale);}catch{/* Private browsing may disable storage. */}
  }
  if(changed&&typeof document!=='undefined')
    document.dispatchEvent(new CustomEvent('fitgoin:localechange',{detail:{locale}}));
}
function applyLiteralText(root){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(!node.parentElement||node.parentElement.closest(ignoreContent))continue;
    let source=savedTexts.get(node);
    if(source===undefined){
      source=node.nodeValue;
      if(!staticFrench[source.trim()]&&!englishLiterals.has(source.trim()))continue;
      savedTexts.set(node,source);
    }
    const bare=source.trim(),replacement=translateStaticLiteral(bare,locale);
    const transformed=source.replace(bare,replacement);
    if(node.nodeValue!==transformed)node.nodeValue=transformed;
  }
}
function applyAttributes(root){
  if(!root?.querySelectorAll)return;
  const targets=root.querySelectorAll('[placeholder],[aria-label],[title]');
  for(const el of targets){
    if(el.closest('[translate="no"],#messages,#threads,#fitgoinAI,#profileContent'))continue;
    let attrs=savedAttributes.get(el);
    if(!attrs){attrs=new Map();savedAttributes.set(el,attrs);}
    for(const name of ['placeholder','aria-label','title']){
      if(!el.hasAttribute(name))continue;
      if(!attrs.has(name)){
        const value=el.getAttribute(name);
        if(!staticFrench[value]&&!englishLiterals.has(value))continue;
        attrs.set(name,value);
      }
      if(!attrs.has(name))continue;
      const original=attrs.get(name),value=translateStaticLiteral(original,locale);
      if(el.getAttribute(name)!==value)el.setAttribute(name,value);
    }
  }
}
export function translate(root=document,{force=false}={}){
  if(typeof document==='undefined'||!root||(!force&&browserTranslationActive()))return;
  for(const el of root.querySelectorAll('[data-i18n]')){
    const value=t(el.dataset.i18n);
    if(typeof value==='string'&&el.textContent!==value)el.textContent=value;
  }
  applyLiteralText(root.nodeType===9?root.body:root);
  applyAttributes(root);
}
export function initLocale(){
  if(typeof document==='undefined')return;
  let saved='';
  try{saved=localStorage.getItem(choiceKey)||'';}catch{/* No storage available. */}
  const query=new URLSearchParams(location.search).get('lang');
  if(validLocale(query))saved=query;
  manuallyChosen=Boolean(validLocale(saved));
  const languages=navigator.languages?.length?[...navigator.languages]:[navigator.language];
  const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selected=chooseLocale({saved,languages,timeZone});
  setLocale(selected);
  const picker=document.getElementById('languageSelect');
  if(picker){picker.value=selected;picker.addEventListener('change',e=>setLocale(e.target.value,{persist:true}));}
  // Cloudflare provides an approximate country on our own domain, with no third-party translator.
  if(!manuallyChosen&&typeof fetch==='function'){
    const traceSignal=typeof AbortSignal?.timeout==='function'?AbortSignal.timeout(3500):undefined;
    fetch('/cdn-cgi/trace',{cache:'no-store',signal:traceSignal})
      .then(res=>res.ok?res.text():'')
      .then(body=>{
        const country=body.match(/^loc=([A-Z]{2})$/m)?.[1];
        if(country){
          regionCountry=country;
          document.dispatchEvent(new CustomEvent('fitgoin:regionchange',{detail:{country}}));
          if(!manuallyChosen&&!browserTranslationActive()){
            const next=chooseLocale({country,languages,timeZone});
            if(next!==locale)setLocale(next);
          }
        }
      }).catch(()=>{/* Keep the browser/region fallback. */});
  }
  if(!observing&&typeof MutationObserver!=='undefined'){
    observing=true;
    new MutationObserver(records=>{
      if(browserTranslationActive()||!records.some(record=>record.type==='childList'&&record.addedNodes.length))return;
      if(queued)return;queued=true;
      queueMicrotask(()=>{queued=false;translate();});
    }).observe(document.body,{childList:true,subtree:true});
  }
}
