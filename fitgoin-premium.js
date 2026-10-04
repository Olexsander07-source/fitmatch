import {BRAND_IMAGES,escapeHTML as esc,workspaceRole,entryPage,guardedPage,formDraft,restoreDraft,safeWorkspace,bookmarkIds} from './fitgoin-premium-core.mjs';
import {t,translate} from './fitgoin-i18n.mjs';

export function mountPremium(opts) {
  let actor=null,epoch=0,state={},loaded=false,loadPromise=null,saveTimer=null,saveChain=Promise.resolve(),coachStep=0,restoredCoach=false,restoredMatch=false,previewed=null;
  const $=id=>document.getElementById(id);
  const db=()=>opts.getDB();
  const assert=e=>{if(e!==epoch||opts.getUser()?.id!==actor)throw Error('session_changed');};
  const role=()=>workspaceRole(opts.getProfile(),opts.getCoach());
  const draftStatus=(text,error=false)=>{const el=$('workspaceDraftStatus');el.textContent=text;el.classList.toggle('error',error);};
  function setSession(user) {
    if(actor===user?.id)return;
    epoch++;clearTimeout(saveTimer);saveTimer=null;actor=user?.id||null;state={};loaded=false;loadPromise=null;coachStep=0;restoredCoach=false;restoredMatch=false;previewed=null;
    draftStatus('');$('coachOnboardingBar').hidden=true;
    // No credentials or private profile data are cached here.
    document.querySelectorAll('[data-signup-confirmed]').forEach(el=>el.removeAttribute('data-signup-confirmed'));
    decorate();
  }
  async function load() {
    if(!actor)return;
    if(loaded)return state;
    if(loadPromise)return loadPromise;
    const e=epoch,id=actor;
    loadPromise=(async()=>{
      const result=await db().from('fgi_user_workspace').select('data,updated_at').eq('user_id',id).maybeSingle();assert(e);
      if(result.error)throw result.error;
      state=safeWorkspace(result.data?.data);loaded=true;coachStep=Math.max(0,Math.min(4,Number(state.coach_draft?.step)||0));return state;
    })();
    try{return await loadPromise;}finally{if(e===epoch)loadPromise=null;}
  }
  function persist(immediate=false) {
    if(!actor||!loaded)return Promise.resolve();
    clearTimeout(saveTimer);
    if(!immediate){draftStatus(t('saving'));saveTimer=setTimeout(()=>persist(true).catch(()=>{}),650);return Promise.resolve();}
    const e=epoch,id=actor,snapshot=safeWorkspace(state);
    saveChain=saveChain.catch(()=>{}).then(async()=>{
      assert(e);draftStatus(t('saving'));
      const result=await db().from('fgi_user_workspace').upsert({user_id:id,data:snapshot},{onConflict:'user_id'});assert(e);
      if(result.error)throw result.error;
      draftStatus(t('draft'));
    }).catch(error=>{if(e===epoch){draftStatus(t('saveError'),true);opts.notice(t('saveError'));}throw error;});
    return saveChain;
  }
  function decorate() {
    const trainer=actor&&role()==='coach';
    document.querySelectorAll('[data-client-nav]').forEach(el=>el.hidden=!actor||trainer);
    document.querySelectorAll('[data-coach-nav]').forEach(el=>el.hidden=!trainer);
    $('accountOpen').textContent=actor?(trainer?t('trainerCard'):t('space')):t('join');
    $('coachOnboardingBar').hidden=!trainer||opts.getPage()!=='account'||opts.getAccountTab()==='settings';
    if(trainer)updateCoachSteps();
    translate();
  }
  function route(id) {
    if(id==='home'&&actor) return entryPage(opts.getProfile(),opts.getCoach(),state)==='profile'?'own-profile':entryPage(opts.getProfile(),opts.getCoach(),state);
    return guardedPage(id,Boolean(actor),role());
  }
  function entered(id) {
    decorate();
    if(id==='match')restoreMatch();
    if(id==='account'&&role()==='coach'){
      if(opts.getAccountTab()==='settings')return;
      opts.setAccountTab(coachStep===4?'media':'profile');updateCoachSteps();
    }
    if(loaded&&['ai','dashboard','match','inbox','account'].includes(id)) {state.last_page=id;persist();}
  }
  async function accountLoaded() {
    await load();
    if(!restoredCoach&&role()==='coach'){
      const draft=state.coach_draft;
      if(draft?.fields&&(!opts.getCoach()||Date.parse(draft.saved_at)>Date.parse(opts.getCoach().updated_at||opts.getCoach().created_at||''))){restoreDraft($('coachForm'),draft.fields);$('coachForm').dataset.dirty='1';}
      restoredCoach=true;
    }
    restoreMatch();decorate();
  }
  function restoreMatch() {
    if(!loaded||restoredMatch)return;
    if(state.match_draft){restoreDraft($('matchForm'),state.match_draft.fields);opts.setMatchStep(state.match_draft.step||0);}
    restoredMatch=true;
  }
  function saveMatch(step) {
    if(!loaded)return;
    state.match_draft={fields:formDraft($('matchForm')),step:Math.max(0,Math.min(6,step))};persist();
  }
  function saveCoachDraft() {
    if(!loaded||!actor||role()!=='coach')return;
    state.coach_draft={fields:formDraft($('coachForm')),step:coachStep,saved_at:new Date().toISOString()};persist();
  }
  function updateCoachSteps() {
    const names=t('coachSteps');
    $('coachStepTrack').innerHTML=names.map((name,i)=>`<span class="coach-step-dot${i===coachStep?' active':''}"${i===coachStep?' aria-current="step"':''}><b>${i<coachStep?'✓':i+1}</b><span>${esc(name)}</span></span>`).join('');
    $('coachProgressFill').style.width=`${(coachStep+1)/6*100}%`;
    document.querySelectorAll('[data-coach-step]').forEach(el=>el.hidden=Number(el.dataset.coachStep)!==coachStep);
    document.querySelector('[data-coach-prev]').hidden=coachStep===0;
    const nextButton=document.querySelector('[data-coach-next]');
    nextButton.dataset.i18n=coachStep===3?'saveAndPortfolio':'next';
    nextButton.textContent=t(nextButton.dataset.i18n);
    const pub=$('coachForm').elements.published;
    pub.closest('label').hidden=!opts.getCoach()?.published;
  }
  function changeCoachStep(next) {
    coachStep=Math.max(0,Math.min(4,next));
    opts.setAccountTab(coachStep===4?'media':'profile');updateCoachSteps();saveCoachDraft();
    $('coachOnboardingBar').scrollIntoView({block:'start',behavior:'instant'});
  }
  async function coachSaved(published) {
    delete state.coach_draft;coachStep=published?5:4;restoredCoach=true;
    await persist(true);
    if(published)await opts.openOwn();else{opts.setAccountTab('media');updateCoachSteps();}
  }
  function profileRendered(coach) {
    if(coach.id!==actor)return;
    previewed={id:coach.id,epoch};
    const banner=document.createElement('section');banner.className='profile-preview';
    if(!coach.published){
      banner.innerHTML=`<div><p class="eyebrow">06 / 06 · PREVIEW</p><h2>${esc(t('preview'))}</h2><p>${esc(t('previewCopy'))}</p><p data-publish-status role="status"></p></div><div class="actions"><button class="btn" data-coach-edit>${esc(t('edit'))}</button><button class="btn primary" data-publish-profile>${esc(t('publish'))}</button></div>`;
      $('profileContent').prepend(banner);
    }else{
      const owner=document.createElement('div');owner.className='owner-profile-note actions';
      owner.innerHTML='<p>Это твоя опубликованная карточка.</p><button type="button" class="text-btn" data-hide-profile>Скрыть из каталога</button>';
      $('profileContent').prepend(owner);
    }
  }
  async function publish(button,published) {
    const coach=opts.getCoach(),e=epoch;
    if(!actor||coach?.id!==actor||role()!=='coach')return;
    if(published&&(previewed?.id!==actor||previewed.epoch!==e))throw Error('Сначала открой предпросмотр своей карточки.');
    if(button.disabled)return;button.disabled=true;
    try{
      const result=await db().from('fgi_coaches').update({published}).eq('id',actor).select().single();assert(e);if(result.error)throw result.error;
      delete state.coach_draft;await persist(true);await opts.reload();assert(e);await opts.openOwn();opts.notice(published?'Карточка опубликована в каталоге FitGoIn.':'Карточка скрыта из каталога. Переписка и данные сохранены.');
    }finally{if(e===epoch)button.disabled=false;}
  }
  document.addEventListener('click',event=>{
    const signup=event.target.closest('[data-signup-role]');if(signup){opts.signup(signup.dataset.signupRole);return;}
    const path=event.target.closest('[data-choose-path]');if(path){
      const e=epoch;
      if(!actor){opts.signup('client');return;}
      (async()=>{await load();assert(e);state.introduction_seen=true;state.preferred_path=path.dataset.choosePath==='ai'?'ai':'human';await persist(true);assert(e);opts.navigate(state.preferred_path==='ai'?'ai':'match');})().catch(error=>{if(e===epoch)opts.notice(opts.explain(error));});return;
    }
    if(event.target.closest('[data-coach-next]')){
      const visible=document.querySelector(`[data-coach-step="${coachStep}"]`);
      const invalid=[...visible.querySelectorAll('input,select,textarea')].find(el=>!el.checkValidity());if(invalid){invalid.reportValidity();return;}
      if(coachStep<3)changeCoachStep(coachStep+1);else $('coachForm').requestSubmit();return;
    }
    if(event.target.closest('[data-coach-prev]')){changeCoachStep(coachStep-1);return;}
    if(event.target.closest('[data-coach-edit]')){coachStep=0;opts.setAccountTab('profile');opts.navigate('account');return;}
    if(event.target.closest('[data-coach-settings]')){opts.setAccountTab('settings');opts.navigate('account');return;}
    if(event.target.closest('[data-coach-preview]')){if(opts.getCoach())opts.openOwn().catch(e=>opts.notice(opts.explain(e)));return;}
    const pub=event.target.closest('[data-publish-profile],[data-hide-profile]');if(pub)publish(pub,pub.hasAttribute('data-publish-profile')).catch(e=>opts.notice(opts.explain(e)));
  });
  $('coachForm').addEventListener('input',saveCoachDraft);
  $('matchForm').addEventListener('input',()=>saveMatch(opts.getMatchStep()));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)persist(true).catch(()=>{});});
  window.addEventListener('online',()=>persist(true).catch(()=>{}));
  $('coachForm').addEventListener('invalid',event=>{const step=event.target.closest('[data-coach-step]');if(step)changeCoachStep(Number(step.dataset.coachStep));},true);
  // Brand images only. Load the next image lazily; no animation when hidden or reduced motion.
  let heroIndex=0,heroPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,heroPending=false,heroTimer=null;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const asset=name=>`./assets/brand/${name}-${matchMedia('(max-width:650px)').matches?800:1600}.webp`;
  const heroButton=$('pauseHero');
  function heroControls(){heroButton.textContent=heroPaused?'Включить фон':'Пауза фона';heroButton.setAttribute('aria-pressed',String(heroPaused));}
  function scheduleHero(){clearInterval(heroTimer);heroTimer=null;heroControls();if(heroPaused||document.hidden)return;heroTimer=setInterval(async()=>{
    if(opts.getPage()!=='home'||heroPending)return;heroPending=true;
    const next=(heroIndex+1)%BRAND_IMAGES.length,img=new Image();img.decoding='async';img.src=asset(BRAND_IMAGES[next]);
    try{await img.decode();if(heroPaused||document.hidden||opts.getPage()!=='home')return;const frame=document.createElement('div');frame.className='backdrop-frame';frame.style.backgroundImage=`url("${img.src}")`;$('heroImage').append(frame);requestAnimationFrame(()=>frame.classList.add('is-visible'));setTimeout(()=>{$('heroImage').style.backgroundImage=`url("${img.src}")`;frame.remove();},1600);heroIndex=next;document.querySelectorAll('.hero-indicator i').forEach((el,i)=>el.classList.toggle('active',i===heroIndex));}catch{/* Existing loaded brand image remains. */}finally{heroPending=false;}
  },8500);}
  heroButton.onclick=()=>{heroPaused=!heroPaused;scheduleHero();};
  document.addEventListener('visibilitychange',scheduleHero);motion.addEventListener('change',()=>{heroPaused=motion.matches;scheduleHero();});scheduleHero();
  translate();
  return {setSession,load,accountLoaded,decorate,route,entered,saveMatch,saveCoachDraft,coachSaved,profileRendered,
    startPage:()=>entryPage(opts.getProfile(),opts.getCoach(),state),
    async savedIds(){await load();return bookmarkIds(state.saved_ai);},
    async toggleSaved(id){await load();const ids=bookmarkIds(state.saved_ai);state.saved_ai=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id].slice(-100);await persist(true);return state.saved_ai;},
    async clearSaved(){await load();state.saved_ai=[];await persist(true);},
    flush:()=>persist(true)
  };
}
