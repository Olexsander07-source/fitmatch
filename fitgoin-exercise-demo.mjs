// Exercise demonstrations are matched by specific, curated names only. A plan
// can contain arbitrary AI-written names, so never guess a similar movement.
const normalize = value => String(value ?? '').toLocaleLowerCase()
  .normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/ё/g, 'е')
  .replace(/[^a-z0-9а-я]+/gu, ' ').trim().replace(/\s+/g, ' ');

// Your Move explicitly permits these 25 free videos inside commercial apps:
// https://ymove.app/free-exercise-videos. The files are included in the app.
const clip = (id, aliases) => ({provider:'ymove', id, aliases});
// These are the same embeddable videos linked from the original creator's page.
const youtube = (id, source, aliases) => ({provider:'youtube', id, source, aliases});
export const EXERCISE_DEMOS = [
  clip('fd0eaa34-d14b-4421-b41c-1669f93253b3', ['barbell back squat','barbell squat','back squat with barbell','приседания со штангой','присед со штангой на плечах','приседания со штангой на плечах','squat avec barre','squat barre sur le dos']),
  clip('dd7e706c-2086-4f4b-867f-d7fece2f720d', ['barbell bench press','barbell flat bench press','bench press with barbell','жим штанги лежа','жим лежа со штангой','жим штанги лежа на горизонтальной скамье','developpe couche avec barre','developpe couche barre']),
  clip('b59952ca-1551-4c07-835d-ab78bfe9953c', ['barbell deadlift','conventional barbell deadlift','conventional deadlift','классическая становая тяга со штангой','становая тяга со штангой','souleve de terre avec barre','souleve de terre classique']),
  clip('a16f0235-20eb-4306-b9cc-c01ae51b3b9b', ['dumbbell lateral raise','standing dumbbell lateral raise','standing dumbbell lateral raises','разведение гантелей в стороны стоя','подъем гантелей через стороны стоя','махи гантелями в стороны стоя','elevations laterales avec halteres debout']),
  clip('b11e6c6f-b2e8-44ca-95dc-adf0dcd34426', ['hammer curl','hammer curls','dumbbell hammer curls','сгибание рук с гантелями молот','сгибания рук с гантелями молот','молотковые сгибания с гантелями','curl marteau avec halteres']),
  clip('d3fece95-c7e2-4794-ba8f-65a5b3e30a28', ['single arm dumbbell row legs apart','one arm dumbbell row legs apart','тяга гантели одной рукой в наклоне без опоры','tirage haltere un bras jambes ecartees']),
  clip('a2a797d0-f6f6-436e-8616-6c1d93e73d67', ['dumbbell goblet squat','goblet squat with dumbbell','goblet squat dumbbell','гоблет приседание с гантелью','гоблет приседания с гантелью','приседания с гантелью у груди','squat goblet avec haltere']),
  clip('13263f92-5fe2-4d92-bec0-808f8b315620', ['kettlebell swing','kettlebell swings','махи гирей','махи гирей двумя руками','свинг гирей','swing avec kettlebell','kettlebell swing a deux mains']),
  clip('3880aaa4-e1c0-4153-95d0-da44ea01e099', ['kettlebell push press','толчковый жим гири','push press avec kettlebell']),
  clip('e7175536-9d7d-4f5d-8d49-26c3411eac80', ['kettlebell romanian deadlift','romanian deadlift with kettlebell','румынская тяга с гирей','румынская становая тяга с гирей','souleve de terre roumain avec kettlebell']),
  clip('198d4a7d-bc23-41f8-ad67-4fe9ab876b89', ['goblet squat with kettlebell','kettlebell goblet squat','гоблет приседания с гирей','приседания с гирей у груди','squat goblet avec kettlebell']),
  clip('e2b1d801-055a-4dc5-ad6e-486e3dbfcfb7', ['mid cable crossover','cable crossover mid','сведение рук в кроссовере на уровне груди','сведение рук в кроссовере средний блок','ecarte a la poulie hauteur poitrine']),
  clip('856b4128-b57d-4b08-b0de-7f19b4553020', ['lying cable leg curl','сгибание ног лежа в кроссовере','сгибание ноги лежа на нижнем блоке','leg curl allonge a la poulie']),
  clip('02f17b45-d37d-4452-9082-4679e06f8c03', ['high to low cable woodchop','cable woodchop high to low','дровосек на верхнем блоке','дровосек в кроссовере сверху вниз','rotation buste poulie haute vers le bas']),
  clip('5971eaa2-5264-49cc-99c2-1310305c5342', ['lat pulldown','lat pull down','тяга верхнего блока','тяга верхнего блока к груди','tirage vertical poitrine','tirage vertical poulie haute']),
  clip('77976f52-b13a-4fd0-addf-f4404e3a8e95', ['seated cable row close v bar','seated cable row close grip v bar','тяга горизонтального блока сидя узким хватом v рукоять','tirage horizontal assis poignee v']),
  clip('20cc4825-dd52-4887-99db-c492546741dc', ['seated machine chest press','machine chest press','жим в грудном тренажере сидя','жим от груди в тренажере сидя','chest press a la machine assis']),
  clip('710d4aa4-e4ea-4fad-8930-a7b9bf582cae', ['cable lateral raise','single arm cable lateral raise','подъем руки в сторону на блоке','подъем руки через сторону в кроссовере','elevation laterale a la poulie']),
  clip('d9b9cf47-c5ff-4672-b8a8-2fe5f4845231', ['cable rope face pull','rope face pull','face pull with rope','тяга каната к лицу на блоке','тяга верхнего блока к лицу с канатом','face pull a la poulie avec corde']),
  clip('f32940f7-7da6-4741-a72f-13e52c56a79c', ['cable bicep curl rope','rope cable bicep curl','сгибание рук на бицепс с канатом на блоке','curl biceps a la poulie avec corde']),
  clip('3875dae4-14a6-4533-84d3-ef9acbadbaea', ['cable tricep pushdown','cable triceps pushdown','разгибание рук на верхнем блоке на трицепс','разгибание рук на блоке на трицепс','extension triceps a la poulie haute']),
  clip('a1c3384e-62db-4595-9b97-df2e7f131234', ['overhead cable rope extension','overhead rope triceps extension','разгибание рук с канатом из за головы на блоке','extension triceps au dessus de la tete a la poulie avec corde']),
  clip('af0c3d19-5ee2-4a19-8688-f8504bb33e3c', ['leg extension','seated leg extension','разгибание ног в тренажере','разгибание ног сидя в тренажере','leg extension a la machine']),
  clip('d0bc669e-0d78-46f0-95f1-86503ab746e1', ['leg press','machine leg press','жим ногами в тренажере','жим ногами','presse a cuisses']),
  clip('5611abf4-57f7-4153-b29d-a17cd7e2907d', ['glute kickback machine','machine glute kickback','отведение ноги назад в ягодичном тренажере','kickback fessier a la machine']),
  youtube('l83R5PblSMA','PureGym',['bodyweight squat','bodyweight squats','приседания без веса','приседания с собственным весом','squat au poids du corps','squats au poids du corps']),
  youtube('Env8gAr_QnE','PureGym',['push up','push ups','standard push up','отжимания от пола','отжимание от пола','pompes classiques','pompe classique']),
  youtube('X9sGmsGYYE0','PureGym',['knee push up','knee push ups','push ups from knees','отжимания с колен','отжимания от пола с колен','pompes sur les genoux']),
  youtube('q4rDeHYMcIg','PureGym',['forearm plank','plank on forearms','планка на локтях','планка на предплечьях','planche sur les avant bras']),
  youtube('g8-Ge9S0aUw','PureGym',['forward lunge','forward lunges','bodyweight forward lunge','выпады вперед без веса','выпады вперед с собственным весом','fentes avant au poids du corps']),
  youtube('xrPteyQLGAo','PureGym',['reverse lunge','reverse lunges','bodyweight reverse lunge','обратные выпады без веса','выпады назад без веса','fentes arriere au poids du corps']),
  youtube('tqp5XQPpTxY','PureGym',['glute bridge','bodyweight glute bridge','ягодичный мостик без веса','ягодичный мостик с собственным весом','pont fessier au poids du corps']),
  youtube('rvpC9QkTc3Y','Margaret Martin',['chair squat','squat to chair','присед к стулу','приседания к стулу','приседания на стул','squat sur chaise']),
  youtube('Yw9RPfBRjx0','Community Medical Centers',['wall push up','wall push ups','push up against wall','отжимание от стены','отжимания от стены','pompes au mur'])
];

const index = new Map();
for (const demo of EXERCISE_DEMOS) for (const alias of demo.aliases) {
  const key = normalize(alias);
  // An ambiguous alias is deliberately unusable rather than choosing a guess.
  if (index.has(key)) index.set(key, null);
  else index.set(key, demo);
}
const noEquipment = value => /^(?:без оборудования|без инвентаря|собственный вес|bodyweight|body weight|no equipment|none|sans materiel|poids du corps|коврик|mat)$/.test(normalize(value));

export function findExerciseDemo(exercise) {
  const name = normalize(exercise?.name);
  const exact = index.get(name);
  if (exact) return exact;
  // Only resolve generic squats when the program explicitly states bodyweight.
  if (['приседания','приседание','squat','squats'].includes(name) && noEquipment(exercise?.required_equipment)) {
    return index.get(normalize('bodyweight squat'));
  }
  const technique = normalize(exercise?.technique);
  if (['планка','plank','planche'].includes(name) && /(?:на локтях|на предплечьях|forearms|sur les avant bras)/.test(technique)) {
    return index.get(normalize('forearm plank'));
  }
  if (['жим лежа','bench press','developpe couche'].includes(name) && /^(?:штанга|barbell|barre)$/.test(normalize(exercise?.required_equipment))) {
    return index.get(normalize('barbell bench press'));
  }
  return null;
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Text descriptions are already shown alongside the card by FitGoIn. Unknown
// movements get an explicitly labelled search, never a guessed demonstration.
export function exerciseDemoHTML(exercise, t) {
  const name = String(exercise?.name || '').trim();
  if (!name) return '';
  const demo = findExerciseDemo(exercise);
  const search = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' ' + t('exerciseVideoQuery'));
  const searchLink = `<a href="${esc(search)}" target="_blank" rel="noopener noreferrer">${esc(t('exerciseVideoSearch'))} ↗</a>`;
  const heading = esc(t('exerciseVideoShow'));
  if (!demo) return `<details class="ai-exercise-demo"><summary>${heading}</summary><p>${esc(t('exerciseVideoUnavailable'))}</p><p>${searchLink}</p></details>`;
  const source = demo.provider === 'ymove' ? 'Your Move' : demo.source;
  const title = `${t('exerciseVideoShow')}: ${name}`;
  let player;
  if (demo.provider === 'ymove') {
    const url = `./assets/exercise-demo/${demo.id}.mp4`;
    player = `<p class="hint" role="status" data-exercise-status data-loading-message="${esc(t('exerciseVideoLoading'))}" data-error-message="${esc(t('exerciseVideoError'))}">${esc(t('exerciseVideoLoading'))}</p><video class="ai-exercise-video" controls playsinline preload="none" hidden data-exercise-mp4="${esc(url)}" aria-label="${esc(title)}">${esc(t('exerciseVideoUnsupported'))}</video><p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('exerciseVideoOpen'))} ↗</a></p>`;
  } else {
    // The iframe is created only when a visitor opens this specific video.
    player = `<div class="ai-exercise-video-frame" data-exercise-player data-video-id="${esc(demo.id)}" data-video-title="${esc(title)}"></div><p class="hint">${esc(t('exerciseVideoEnglish'))}</p><p><a href="https://www.youtube.com/watch?v=${esc(demo.id)}" target="_blank" rel="noopener noreferrer">${esc(t('exerciseVideoOpen'))} ↗</a></p>`;
  }
  return `<details class="ai-exercise-demo"><summary>${heading}</summary>${player}<p class="hint">${esc(t('exerciseVideoSource'))}: ${esc(source)}</p><p>${searchLink}</p></details>`;
}

// Static assets return the full file for Range requests, which Safari may not
// play. Fetch each small clip on demand and play a local blob URL instead.
// The map also lets the UI cancel/release memory when a card is closed or
// the app rerenders while a download is in flight.
const activeVideos = new Map();
function releaseVideo(video) {
  const state = activeVideos.get(video);
  if (!state) return;
  activeVideos.delete(video);
  state.controller.abort();
  if (state.objectURL) URL.revokeObjectURL(state.objectURL);
  video.pause();
  video.removeAttribute('src');
  video.hidden = true;
  video.load();
}
export function releaseExerciseVideos(root) {
  for (const video of activeVideos.keys()) if (root.contains(video)) releaseVideo(video);
}

export async function loadExerciseVideo(details) {
  if (!details) return;
  const video = details.querySelector('[data-exercise-mp4]');
  const player = details.querySelector('[data-exercise-player]');
  if (!details.open) {
    if (video) releaseVideo(video);
    if (player) player.replaceChildren();
    return;
  }
  if (video) {
    if (activeVideos.has(video)) return;
    const status = details.querySelector('[data-exercise-status]');
    const state = {controller:new AbortController(),objectURL:null};
    activeVideos.set(video,state);
    if (status) {status.hidden=false;status.textContent=status.dataset.loadingMessage||status.textContent;}
    try {
      const response = await fetch(video.dataset.exerciseMp4,{signal:state.controller.signal});
      if (!response.ok) throw new Error('video_unavailable');
      const blob = await response.blob();
      if (activeVideos.get(video)!==state || !details.open) return;
      state.objectURL = URL.createObjectURL(blob);
      video.src = state.objectURL;
      video.hidden = false;
      if (status) status.hidden = true;
      video.load();
    } catch (error) {
      if (activeVideos.get(video)!==state) return;
      activeVideos.delete(video);
      if (status) {status.hidden=false;status.textContent=status.dataset.errorMessage||'Video unavailable';}
    }
    return;
  }
  if (!player || player.firstElementChild) return;
  const id = player.dataset.videoId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '')) return;
  const frame = player.ownerDocument.createElement('iframe');
  frame.src = `https://www.youtube-nocookie.com/embed/${id}`;
  frame.title = player.dataset.videoTitle || 'Exercise video';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.allowFullscreen = true;
  player.appendChild(frame);
}
