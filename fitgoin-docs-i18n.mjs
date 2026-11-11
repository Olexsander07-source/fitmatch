import {docContent} from './fitgoin-docs-content.mjs';
import {chooseLocale} from './fitgoin-i18n.mjs';

const file=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
const translations=docContent[file];
const panel=document.querySelector('main .panel');
if(translations&&panel){
 const original=panel.innerHTML;
 const key='fitgoin_locale_preference_v1';
 const valid=v=>['fr','en','ru'].includes(String(v||'').toLowerCase())?String(v).toLowerCase():'';
 const params=new URLSearchParams(location.search);
 let saved='';try{saved=localStorage.getItem(key)||'';}catch{}
 const query=valid(params.get('lang'));
 if(query)saved=query;
 let manuallyChosen=Boolean(valid(saved));
 const languages=navigator.languages?.length?[...navigator.languages]:[navigator.language];
 const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const titles={
  support:{en:'Support',fr:'Assistance',ru:'Поддержка'},
  legal:{en:'Legal information',fr:'Mentions légales',ru:'Правовая информация'},
  privacy:{en:'Privacy Policy',fr:'Politique de confidentialité',ru:'Политика конфиденциальности'},
  terms:{en:'Terms of Use',fr:'Conditions d’utilisation',ru:'Условия использования'},
  cookies:{en:'Cookie Policy',fr:'Politique relative aux cookies',ru:'Cookie Policy'}
 };
 const footer={
  en:{'Настройки cookie':'Cookie settings','Конфиденциальность':'Privacy','Условия':'Terms','Правовая информация':'Legal information','FitGoIn — главная':'FitGoIn — home'},
  fr:{'Настройки cookie':'Paramètres des cookies','Конфиденциальность':'Confidentialité','Условия':'Conditions','Правовая информация':'Mentions légales','FitGoIn — главная':'FitGoIn — accueil'}
 };
 const footerNodes=[...document.querySelectorAll('footer a,footer button,header .logo')].map(node=>({node,text:node.textContent.trim(),aria:node.getAttribute('aria-label')}));
 const header=document.querySelector('header.header');
 const label=document.createElement('label');
 label.className='fgi-doc-language';
 label.setAttribute('for','fgiDocLang');
 const caption=document.createElement('span');
 caption.className='sr-only';caption.textContent='Language / Langue / Язык';
 const select=document.createElement('select');select.id='fgiDocLang';select.setAttribute('aria-label','Language / Langue / Язык');
 for(const [value,title] of [['fr','🇫🇷 FR'],['en','🇬🇧 EN'],['ru','🇷🇺 RU']])select.add(new Option(title,value));
 label.append(caption,select);
 header?.append(label);
 function apply(lang,{persist=false}={}){
  const language=valid(lang)||'en';
  panel.innerHTML=language==='ru'?original:translations[language]||original;
  document.documentElement.lang=language;
  document.title=(titles[file]?.[language]||'FitGoIn')+' — FitGoIn';
  select.value=language;
  for(const {node,text,aria} of footerNodes){
    if(node.matches('.logo')){if(aria)node.setAttribute('aria-label',footer[language]?.[aria]||aria);continue;}
    node.textContent=footer[language]?.[text]||text;
  }
  if(persist){manuallyChosen=true;try{localStorage.setItem(key,language);}catch{}}
  document.dispatchEvent(new CustomEvent('fitgoin:localechange',{detail:{locale:language}}));
 }
 select.addEventListener('change',()=>apply(select.value,{persist:true}));
 apply(chooseLocale({saved,languages,timeZone}));
 if(!manuallyChosen){
  const traceSignal=typeof AbortSignal?.timeout==='function'?AbortSignal.timeout(3500):undefined;
  fetch('/cdn-cgi/trace',{cache:'no-store',signal:traceSignal})
  .then(r=>r.ok?r.text():'')
  .then(body=>{const country=body.match(/^loc=([A-Z]{2})$/m)?.[1];if(country&&!manuallyChosen)apply(chooseLocale({country,languages,timeZone}));})
  .catch(()=>{});
 }
}
