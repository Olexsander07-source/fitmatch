import test from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISE_DEMOS,findExerciseDemo,exerciseDemoHTML,loadExerciseVideo,releaseExerciseVideos} from '../fitgoin-exercise-demo.mjs';
import {setLocale,t} from '../fitgoin-i18n.mjs';

test('curated video names and identifiers are unique and resolve exactly', () => {
  const ids = EXERCISE_DEMOS.map(d => `${d.provider}:${d.id}`);
  assert.equal(new Set(ids).size, ids.length);
  for (const demo of EXERCISE_DEMOS) for (const name of demo.aliases) {
    assert.equal(findExerciseDemo({name})?.id, demo.id, `ambiguous alias: ${name}`);
  }
});

test('matches language variants and uses specific information to disambiguate', () => {
  assert.equal(findExerciseDemo({name:'Жим штанги лёжа'})?.id, 'dd7e706c-2086-4f4b-867f-d7fece2f720d');
  assert.equal(findExerciseDemo({name:'Développé couché avec barre'})?.id, 'dd7e706c-2086-4f4b-867f-d7fece2f720d');
  assert.equal(findExerciseDemo({name:'Приседания',required_equipment:'Без оборудования'})?.id, 'l83R5PblSMA');
  assert.equal(findExerciseDemo({name:'Жим лёжа',required_equipment:'Штанга'})?.provider, 'ymove');
  assert.equal(findExerciseDemo({name:'Планка',technique:'Упрись на предплечьях'})?.id, 'q4rDeHYMcIg');
});

test('does not confuse different exercise variants or guess unknown movements', () => {
  for (const exercise of [
    {name:'Приседания',required_equipment:'Штанга'},
    {name:'Приседания со штангой спереди'},
    {name:'Жим лёжа',required_equipment:'Гантели'},
    {name:'Жим гантелей лёжа'},
    {name:'Румынская тяга со штангой'},
    {name:'Планка',technique:'Опора на ладони'},
    {name:'Отжимания с узкой постановкой рук'},
    {name:'Unknown new exercise'}
  ]) assert.equal(findExerciseDemo(exercise), null, exercise.name);
});

test('video and safe fallback are localized and never fabricate an embedded match', () => {
  for (const [locale,label] of [['ru','Посмотреть видео'],['en','Watch demonstration'],['fr','Voir la démonstration']]) {
    setLocale(locale);
    const known=exerciseDemoHTML({name:'Жим штанги лёжа'},t);
    assert.ok(known.includes(label));
    assert.match(known,/assets\/exercise-demo\/dd7e706c-2086-4f4b-867f-d7fece2f720d\.mp4/);
    assert.match(known,/preload="none"/);
    const missing=exerciseDemoHTML({name:'New unusual move'},t);
    assert.match(missing,/youtube\.com\/results\?search_query=/);
    assert.doesNotMatch(missing,/<video|<iframe|data-video-id/);
  }
  setLocale('ru');
  const injected=exerciseDemoHTML({name:'x <script>alert(1)</script> "'},t);
  assert.doesNotMatch(injected,/<script>/);
  assert.match(injected,/%3Cscript%3E/);
});

test('YouTube player loads only after opening and never trusts arbitrary ids', async () => {
  const children=[];
  const player={dataset:{videoId:'l83R5PblSMA',videoTitle:'Squat'},firstElementChild:null,
    ownerDocument:{createElement:tag=>({tag})},appendChild(frame){children.push(frame);this.firstElementChild=frame;}};
  player.replaceChildren=()=>{player.firstElementChild=null};
  const details={open:false,querySelector:selector=>selector==='[data-exercise-player]'?player:null};
  await loadExerciseVideo(details);
  assert.equal(children.length,0);
  details.open=true;await loadExerciseVideo(details);await loadExerciseVideo(details);
  assert.equal(children.length,1);
  assert.equal(children[0].src,'https://www.youtube-nocookie.com/embed/l83R5PblSMA');
  assert.equal(children[0].title,'Squat');
  const unsafe={...player,dataset:{videoId:'bad" onload="x'},firstElementChild:null};
  await loadExerciseVideo({open:true,querySelector:selector=>selector==='[data-exercise-player]'?unsafe:null});
  assert.equal(children.length,1);
});

test('bundled clips load on demand as browser-local blobs and release resources', async () => {
  const originalFetch=globalThis.fetch;
  let requests=0,loads=0,pauses=0;
  const video={dataset:{exerciseMp4:'./assets/exercise-demo/example.mp4'},hidden:true,
    load(){loads++},pause(){pauses++},removeAttribute(name){if(name==='src')this.src=''}};
  const status={hidden:false,textContent:'Loading',dataset:{loadingMessage:'Loading',errorMessage:'Failed'}};
  const details={open:false,querySelector:selector=>selector==='[data-exercise-mp4]'?video:selector==='[data-exercise-status]'?status:null};
  globalThis.fetch=async()=>{requests++;return new Response(new Blob(['fixture'],{type:'video/mp4'}))};
  try {
    await loadExerciseVideo(details);assert.equal(requests,0);
    details.open=true;await loadExerciseVideo(details);
    assert.equal(requests,1);assert.match(video.src,/^blob:/);assert.equal(video.hidden,false);assert.equal(status.hidden,true);
    await loadExerciseVideo(details);assert.equal(requests,1);
    releaseExerciseVideos({contains:item=>item===video});
    assert.equal(video.src,'');assert.equal(video.hidden,true);assert.equal(pauses,1);assert.ok(loads>=2);
    await loadExerciseVideo(details);assert.equal(requests,2);
    details.open=false;await loadExerciseVideo(details);assert.equal(pauses,2);
  } finally {globalThis.fetch=originalFetch;releaseExerciseVideos({contains:()=>true})}
});

test('a failed clip download reports an error and can be retried', async () => {
  const originalFetch=globalThis.fetch;let requests=0;
  const video={dataset:{exerciseMp4:'./assets/exercise-demo/example.mp4'},hidden:true,
    load(){},pause(){},removeAttribute(){}};
  const status={hidden:false,textContent:'Loading',dataset:{loadingMessage:'Loading',errorMessage:'Failed'}};
  const details={open:true,querySelector:selector=>selector==='[data-exercise-mp4]'?video:selector==='[data-exercise-status]'?status:null};
  globalThis.fetch=async()=>{requests++;return new Response('',{status:503})};
  try {
    await loadExerciseVideo(details);assert.equal(status.textContent,'Failed');assert.equal(video.hidden,true);
    await loadExerciseVideo(details);assert.equal(requests,2);
  } finally {globalThis.fetch=originalFetch;releaseExerciseVideos({contains:()=>true})}
});
