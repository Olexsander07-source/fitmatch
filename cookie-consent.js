const COOKIE_NAME='fitgoin_cookie_consent_v1';
const MAX_AGE=60*60*24*180;
const bannerI18n={
 en:{title:'Cookie settings',message:'FitGoIn uses essential storage for sign-in and security. Optional analytics cookies are not enabled without your consent.',details:'More about cookies and browser storage',reject:'Reject optional cookies',accept:'Accept optional cookies'},
 fr:{title:'Paramètres des cookies',message:'FitGoIn utilise le stockage indispensable à la connexion et à la sécurité. Les cookies analytiques facultatifs ne sont pas activés sans votre consentement.',details:'En savoir plus sur les cookies et le stockage local',reject:'Refuser les cookies facultatifs',accept:'Accepter les cookies facultatifs'}
};
function cookieLanguage(){
 let selected='';try{selected=localStorage.getItem('fitgoin_locale_preference_v1')||'';}catch{}
 const fallback=(document.documentElement.lang||navigator.language||'ru').slice(0,2);
 return ['ru','fr','en'].includes(selected)?selected:fallback;
}
function translateBanner(language){
 const b=document.getElementById('cookieBanner'),t=bannerI18n[language];
 if(!b)return;
 const original={title:'Настройки cookie',message:'FitGoIn использует необходимые технологии хранения для входа и безопасности. Необязательные аналитические cookie не активируются без твоего согласия.',details:'Подробнее о cookie и локальном хранилище',reject:'Отклонить необязательные',accept:'Принять необязательные'};
 const data=t||original;
 b.querySelector('#cookieTitle').textContent=data.title;
 b.querySelector('.cookie-card > div > p:not(.eyebrow):not(.hint)').textContent=data.message;
 b.querySelector('.cookie-card .hint a').textContent=data.details;
 b.querySelector('[data-cookie-choice="necessary"]').textContent=data.reject;
 b.querySelector('[data-cookie-choice="optional"]').textContent=data.accept;
}
document.addEventListener('fitgoin:localechange',e=>translateBanner(e.detail?.locale));

function readChoice(){
  const row=document.cookie.split('; ').find(v=>v.startsWith(COOKIE_NAME+'='));
  return row?decodeURIComponent(row.split('=').slice(1).join('=')):'';
}
function applyChoice(choice){
  const value=choice==='optional'?'optional':'necessary';
  window.fitgoinCookieConsent=Object.freeze({
    necessary:true,
    analytics:value==='optional',
    marketing:false,
    version:1
  });
  window.dispatchEvent(new CustomEvent('fitgoin:consent',{detail:window.fitgoinCookieConsent}));
}
function saveChoice(choice){
  const value=choice==='optional'?'optional':'necessary';
  document.cookie=`${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax; Secure`;
  applyChoice(value);
  document.getElementById('cookieBanner')?.remove();
}
function showBanner(force=false){
  if(document.getElementById('cookieBanner'))return;
  const current=readChoice();
  if(current && !force){applyChoice(current);return;}
  const wrap=document.createElement('section');
  wrap.id='cookieBanner';
  wrap.className='cookie-banner';
  wrap.setAttribute('role','dialog');
  wrap.setAttribute('aria-labelledby','cookieTitle');
  wrap.innerHTML=`<div class="cookie-card">
    <div>
      <p class="eyebrow">FITGOIN · COOKIE</p>
      <h2 id="cookieTitle">Настройки cookie</h2>
      <p>FitGoIn использует необходимые технологии хранения для входа и безопасности. Необязательные аналитические cookie не активируются без твоего согласия.</p>
      <p class="hint"><a href="./cookies.html">Подробнее о cookie и локальном хранилище</a></p>
    </div>
    <div class="cookie-actions">
      <button class="btn primary" type="button" data-cookie-choice="necessary">Отклонить необязательные</button>
      <button class="btn primary" type="button" data-cookie-choice="optional">Принять необязательные</button>
    </div>
  </div>`;
  document.body.append(wrap);
  translateBanner(cookieLanguage());
}
document.addEventListener('click',event=>{
  const choice=event.target.closest('[data-cookie-choice]')?.dataset.cookieChoice;
  if(choice)saveChoice(choice);
  if(event.target.closest('[data-cookie-settings]'))showBanner(true);
});
document.addEventListener('DOMContentLoaded',()=>showBanner(false));
applyChoice(readChoice()||'necessary');
