// Shared, dependency-free language and translation validation.
export const CHAT_LANGUAGE_NAMES=Object.freeze({
  ar:'العربية',bg:'Български',cs:'Čeština',da:'Dansk',de:'Deutsch',el:'Ελληνικά',
  en:'English',es:'Español',fi:'Suomi',fr:'Français',hi:'हिन्दी',hr:'Hrvatski',
  hu:'Magyar',it:'Italiano',ja:'日本語',ko:'한국어',nl:'Nederlands',no:'Norsk',
  pl:'Polski',pt:'Português',ro:'Română',ru:'Русский',sk:'Slovenčina',sv:'Svenska',
  tr:'Türkçe',uk:'Українська',zh:'中文',
});
const COUNTRIES=Object.freeze({
  FR:'fr',MC:'fr',DE:'de',AT:'de',ES:'es',IT:'it',PT:'pt',BR:'pt',
  RU:'ru',BY:'ru',UA:'uk',PL:'pl',GB:'en',US:'en',IE:'en',AU:'en',NZ:'en',
  NL:'nl',SE:'sv',NO:'no',DK:'da',FI:'fi',GR:'el',CZ:'cs',SK:'sk',
  HU:'hu',RO:'ro',BG:'bg',HR:'hr',TR:'tr',JP:'ja',KR:'ko',
  CN:'zh',TW:'zh',IN:'hi',SA:'ar',AE:'ar',EG:'ar',MA:'ar',DZ:'ar',
});
const multilingual=new Set(['BE','CH','LU','CA','IN','SG','ZA']);
export const validChatLanguage=value=>typeof value==='string'&&Object.hasOwn(CHAT_LANGUAGE_NAMES,value)?value:null;
export function chatLanguageForRegion({country='',browserLanguage='',siteLanguage='en',manualSite=false,chatChoice=''}={}){
  if(validChatLanguage(chatChoice))return chatChoice;
  if(manualSite&&validChatLanguage(siteLanguage))return siteLanguage;
  const nation=String(country).toUpperCase();
  const browser=String(browserLanguage).toLowerCase().split(/[-_]/)[0];
  if(multilingual.has(nation)&&validChatLanguage(browser))return browser;
  if(COUNTRIES[nation])return COUNTRIES[nation];
  if(validChatLanguage(browser))return browser;
  return validChatLanguage(siteLanguage)||'en';
}
export class TranslationError extends Error {
  constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
export function validateTranslateRequest(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TranslationError('invalid_request');
  const language=validChatLanguage(input.target_language);
  if(!language)throw new TranslationError('unsupported_language',422);
  if(!Array.isArray(input.message_ids)||!input.message_ids.length||input.message_ids.length>6)throw new TranslationError('invalid_message_ids');
  const ids=input.message_ids;
  if(ids.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)throw new TranslationError('invalid_message_ids');
  return {language,ids};
}
export function parseTranslationResult(value,rows){
  const raw=Array.isArray(value)?value:value?.translations;
  if(!Array.isArray(raw)||raw.length!==rows.length)throw new TranslationError('invalid_provider_output',502);
  const allowed=new Set(rows.map(r=>r.id));
  const answers=new Map();
  for(const entry of raw){
    if(!entry||!allowed.has(entry.id)||typeof entry.translation!=='string'||!entry.translation.trim()||entry.translation.length>10000||answers.has(entry.id))
      throw new TranslationError('invalid_provider_output',502);
    answers.set(entry.id,entry.translation.trim());
  }
  if(answers.size!==rows.length)throw new TranslationError('invalid_provider_output',502);
  return answers;
}
