import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {messages,chooseLocale,setLocale,getLocale,t,translate,browserTranslationActive,translateStaticLiteral} from '../fitgoin-i18n.mjs';
import {staticFrench} from '../fitgoin-fr.mjs';
import {approvedPlanCardsHTML} from '../fitgoin-ai.js';

test('French covers every existing translation key and array step',()=>{
  const missing=Object.keys(messages.ru).filter(key=>!(key in messages.fr));
  assert.deepEqual(missing,[],'French catalogue is incomplete');
  for(const [key,value] of Object.entries(messages.ru)){
    const fr=messages.fr[key];
    assert.ok(typeof fr==='string'||Array.isArray(fr),'Missing French value: '+key);
    if(Array.isArray(value))assert.equal(fr.length,value.length,'Translation steps differ: '+key);
  }
});
test('country is primary, manual choice wins, language and time zone are fallbacks',()=>{
  assert.equal(chooseLocale({country:'FR',languages:['ru-RU']}),'fr');
  assert.equal(chooseLocale({country:'MC',languages:['en-US']}),'fr');
  assert.equal(chooseLocale({saved:'ru',country:'FR',languages:['fr-FR']}),'ru');
  assert.equal(chooseLocale({saved:'fr',country:'GB'}),'fr');
  assert.equal(chooseLocale({country:'GB',languages:['ru-RU']}),'en');
  assert.equal(chooseLocale({country:'RU',languages:['en-US']}),'ru');
  assert.equal(chooseLocale({languages:['ru-RU'],timeZone:'Europe/Paris'}),'fr');
  assert.equal(chooseLocale({languages:['fr-CA']}),'fr');
  assert.equal(chooseLocale({languages:['en-US']}),'en');
});
test('locale switching preserves stable semantic data and finds static translations',()=>{
  setLocale('fr');
  assert.equal(getLocale(),'fr');
  assert.equal(t('find'),'Trouver mon coach');
  assert.equal(t('emailSignup'),'Créer un compte');
  assert.equal(staticFrench['На каком языке общаться?'],'Dans quelle langue veux-tu échanger ?');
  setLocale('ru');
  assert.equal(t('find'),'Найти моего тренера');
});
test('untagged static labels also resolve in English without modifying personal content',()=>{
  assert.equal(translateStaticLiteral('Найти моего тренера','en'),'Find my trainer');
  assert.equal(translateStaticLiteral('Найти моего тренера','fr'),'Trouver mon coach');
  assert.equal(translateStaticLiteral('Найти моего тренера','ru'),'Найти моего тренера');
  assert.equal(translateStaticLiteral('Unknown private message','en'),'Unknown private message');
});

test('localization files are included in production and user messages remain protected',()=>{
  const build=readFileSync(new URL('build.mjs',import.meta.url),'utf8');
  const src=readFileSync(new URL('../fitgoin-i18n.mjs',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(build,/fitgoin-fr\.mjs/);
  assert.match(html,/id="languageSelect"/);
  assert.match(src,/#messages,#threads,#profileContent/);
  assert.match(src,/choiceKey='fitgoin_locale_preference_v1'/);
});

test('Chrome translated DOM is not rewritten by the native translation observer',()=>{
  let changed=0,hasFont=true;
  const doc={
    documentElement:{classList:{contains:()=>false}},
    querySelector:()=>hasFont?{}:null,
    querySelectorAll:()=>{changed++;return [];}
  };
  assert.equal(browserTranslationActive(doc),true);
  const previous=globalThis.document;
  try{
    globalThis.document=doc;
    translate(doc);
    assert.equal(changed,0,'native translation must not touch Google font-wrapped text');
    doc.documentElement.classList.contains=key=>key==='translated-ltr';
    hasFont=false;
    assert.equal(browserTranslationActive(doc),true);
    translate(doc);
    assert.equal(changed,0);
  }finally{
    if(previous===undefined)delete globalThis.document;
    else globalThis.document=previous;
  }
});

test('branding and Google font wrappers preserve layout without disabling language translation',()=>{
  const css=readFileSync(new URL('../fitgoin-premium.css',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(css,/font\[style\*="vertical-align"\]/);
  assert.match(css,/display:\s*contents\s*!important/);
  assert.match(html,/class="logo notranslate" translate="no"/);
  assert.match(html,/class="hero-mark notranslate" translate="no"/);
  assert.doesNotMatch(html,/<html[^>]+translate="no"/);
});

test('approved Trial, Pro and Premium are shown without executable checkout',()=>{
 const pricing=readFileSync(new URL('../ai-pricing.html',import.meta.url),'utf8');
 const build=readFileSync(new URL('build.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const terms=readFileSync(new URL('../terms.html',import.meta.url),'utf8');
  assert(build.includes("'ai-pricing.html'"));
  assert(index.includes('href="./ai-pricing.html"'));
 for(const value of ['AI Trial','AI Pro','AI Premium','19,90','24,90','1 000 000','gpt-6-luna'.replace('gpt-6-luna','GPT-6 Luna'),'GPT-6.1 Terra']){
   assert(pricing.includes(value),'Missing approved offer value '+value);
 }
 assert.equal((pricing.match(/<button class="soon" disabled/g)||[]).length,3);
 assert.match(terms,/оплата и бесплатная неделя пока не активированы/);
});

test('in-app AI access shows ONLY approved Trial, Pro and Premium in every locale',()=>{
 const source=readFileSync(new URL('../fitgoin-ai.js',import.meta.url),'utf8');
 const start=source.indexOf('  function accessView(){');
 const end=source.indexOf('  function mediaForm(kind)',start);
 assert(start>0&&end>start);
 const actualAccessView=source.slice(start,end);
 assert.match(actualAccessView,/approvedPlanCardsHTML\(\)/);
 assert.doesNotMatch(actualAccessView,/Object\.entries\(PLANS\)/);
 assert.doesNotMatch(actualAccessView,/button\('checkout'/);
 for(const locale of ['ru','fr','en']){
   setLocale(locale);
   const html=approvedPlanCardsHTML();
   assert.equal((html.match(/class="panel fgi-ai-offer"/g)||[]).length,3,locale);
   for(const id of ['trial','pro','premium'])assert(html.includes('data-ai-offer="'+id+'"'),locale+': '+id);
   for(const price of ['0 €','19,90 €','24,90 €'])assert(html.includes(price),locale+': '+price);
   for(const oldPrice of ['20 €','10 €','30 €'])assert(!html.includes('>'+oldPrice),locale+': legacy '+oldPrice);
   assert(!/data-ai-action="checkout"|Выбрать тариф|Choose plan|Choisir/.test(html),locale);
   assert(html.includes('data-i18n="offerTrialRestriction"'),locale);
   assert(html.includes('data-i18n="offerProPlans"'),locale);
 }
 setLocale('ru');
});
