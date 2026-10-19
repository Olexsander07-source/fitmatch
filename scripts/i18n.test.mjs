import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {messages,chooseLocale,setLocale,getLocale,t} from '../fitgoin-i18n.mjs';
import {staticFrench} from '../fitgoin-fr.mjs';

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
test('localization files are included in production and user messages remain protected',()=>{
  const build=readFileSync(new URL('build.mjs',import.meta.url),'utf8');
  const src=readFileSync(new URL('../fitgoin-i18n.mjs',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(build,/fitgoin-fr\.mjs/);
  assert.match(html,/id="languageSelect"/);
  assert.match(src,/#messages,#threads,#profileContent/);
  assert.match(src,/choiceKey='fitgoin_locale_preference_v1'/);
});
