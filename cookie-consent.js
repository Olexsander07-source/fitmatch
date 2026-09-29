const COOKIE_NAME='fitgoin_cookie_consent_v1';
const MAX_AGE=60*60*24*365;

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
      <button class="btn" type="button" data-cookie-choice="necessary">Только необходимые</button>
      <button class="btn primary" type="button" data-cookie-choice="optional">Разрешить необязательные</button>
    </div>
  </div>`;
  document.body.append(wrap);
}
document.addEventListener('click',event=>{
  const choice=event.target.closest('[data-cookie-choice]')?.dataset.cookieChoice;
  if(choice)saveChoice(choice);
  if(event.target.closest('[data-cookie-settings]'))showBanner(true);
});
document.addEventListener('DOMContentLoaded',()=>showBanner(false));
applyChoice(readChoice()||'necessary');
