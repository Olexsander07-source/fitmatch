import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {calculateMatch,matchPercent,rankCoaches,formMatchPreferences,MATCH_WEIGHTS,strictCoachFits,trustedRating} from '../fitgoin-match-core.mjs';

const sport='20000000-0000-4000-8000-000000000001',otherSport='20000000-0000-4000-8000-000000000002';
const sports=[{id:sport,name:'Бодибилдинг'},{id:otherSport,name:'Йога'}];
const id=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0');
const coach=(n,extra={})=>({id:id(n),name:'Тренер '+n,sport,goal:'Сила, Похудение',format:'Онлайн и офлайн',city:'Nice',country:'France',price:40,period:'занятие',languages:['ru'],availability:['evening'],rating:0,reviews_count:0,score:0,published:true,...extra});
const all={sport,goal:'Сила',format:'Офлайн',city:'Nice',budget:40,period:'занятие',language:'ru',availability:'evening'};
const calc=(c,p)=>calculateMatch(c,p,{sports});

test('original seven weights sum to 100',()=>assert.deepEqual(MATCH_WEIGHTS,{sport:30,goal:20,format:15,location:15,budget:10,language:5,availability:5}));
test('all requested data match gives exactly 100',()=>{
 const m=calc(coach(1),all);assert.equal(m.percent,100);assert.equal(m.total,100);assert.equal(m.earned,100);
});
test('missing or different sport gives 0 without inventing matching factors',()=>{
 for(const p of [{}, {...all,sport:''},{...all,sport:otherSport}]){const m=calc(coach(1),p);assert.equal(m.percent,0);assert.equal(m.earned,0);assert.equal(m.criteria.length,1);}
});
test('score is finite and bounded even for bad direct percent inputs',()=>{
 for(const earned of [-200,-1,0,30,100,101,1000,NaN,Infinity])for(const total of [0,30,100,NaN,Infinity]){const n=matchPercent(earned,total);assert.ok(Number.isInteger(n)&&n>=0&&n<=100);}
 assert.equal(matchPercent(101,100),100);assert.equal(matchPercent(-1,100),0);
});
test('unknown selected data never earn points or matched explanations',()=>{
 const m=calc(coach(1,{goal:'',format:'',city:'',price:null,languages:[],availability:[]}),all);
 assert.equal(m.percent,30);for(const c of m.criteria.slice(1)){assert.equal(c.status,'unknown');assert.equal(c.earned,0);}assert.ok(m.reasons.slice(1).every(r=>r.includes('недостаточно данных')));
});
test('missing optional preferences do not accidentally activate budget',()=>{
 for(const budget of [undefined,null,'']){const m=calc(coach(1,{price:null}),{sport,budget});assert.equal(m.percent,100);assert.equal(m.total,30);assert.equal(m.criteria.length,1);}
});
test('specialization reuses goal weight with explicit same-data explanations',()=>{
 const m=calc(coach(1),{sport,specialization:'похудение'});assert.equal(m.percent,100);assert.equal(m.total,50);assert.equal(m.criteria[1].key,'goal');assert.deepEqual(m.criteria[1].requested,['похудение']);assert.ok(m.reasons[1].includes('Специализация'));
 const no=calc(coach(1),{sport,specialization:'Выносливость'});assert.equal(no.percent,60);assert.equal(no.criteria[1].status,'mismatch');
});
test('goal plus specialization does not double-count the same 20-point factor',()=>{
 const yes=calc(coach(1),{sport,goal:'Сила',specialization:'Похудение'});assert.equal(yes.earned,50);assert.equal(yes.total,50);
 const no=calc(coach(1),{sport,goal:'Сила',specialization:'Выносливость'});assert.equal(no.earned,30);assert.equal(no.total,50);
});
test('every reason and percent derives from the same criterion records',()=>{
 const m=calc(coach(1,{goal:'',languages:['fr']}),all);
 assert.equal(m.percent,Math.round(m.criteria.reduce((n,c)=>n+c.earned,0)/m.criteria.reduce((n,c)=>n+c.weight,0)*100));
 assert.equal(m.reasons.length,m.criteria.length);m.criteria.forEach((c,i)=>{assert.ok(m.reasons[i].includes(c.label));assert.equal(m.reasons[i].startsWith('✓'),c.status==='matched');assert.equal(c.earned,c.status==='matched'?c.weight:0);});
});
test('strict budget precedes ranking and cannot be rescued by other high scores',()=>{
 const list=[coach(1,{price:50}),coach(2,{price:null}),coach(3,{period:'месяц'}),coach(4)];
 assert.deepEqual(rankCoaches(list,{...all,soft_fields:['goal','availability']},{sports}).map(x=>x.coach.id),[id(4)]);
});
test('strict language and format precede ranking; dual-mode trainer fits either',()=>{
 const list=[coach(1,{format:'Офлайн'}),coach(2,{languages:[]}),coach(3)];
 assert.deepEqual(rankCoaches(list,{sport,format:'Онлайн',language:'ru'},{sports}).map(x=>x.coach.id),[id(3)]);
 assert.equal(strictCoachFits(coach(3),{format:'Офлайн'},{sports}),true);
});
test('online needs no location and location is not a scored factor there',()=>{
 const m=calc(coach(1,{city:'',country:''}),{sport,format:'Онлайн'});assert.equal(m.percent,100);assert.ok(!m.criteria.some(c=>c.key==='location'));
 assert.equal(rankCoaches([coach(1)],{sport,format:'Онлайн',city:'Paris'},{sports}).length,0);
});
test('offline unknown/wrong location cannot pass; country disambiguates names',()=>{
 const list=[coach(1,{city:''}),coach(2,{country:'Other'}),coach(3)];assert.deepEqual(rankCoaches(list,{sport,format:'Офлайн',city:'Nice',country:'France'},{sports}).map(x=>x.coach.id),[id(3)]);
 const m=calc(coach(3),{sport,format:'Офлайн',country:'France'});assert.equal(m.total,60);assert.equal(m.percent,100);
});
test('actual trainer experience is only a strict minimum, not inferred user-level fit',()=>{
 assert.equal(rankCoaches([coach(1,{experience_years:null}),coach(2,{experience_years:5})],{sport,min_experience_years:5},{sports})[0].coach.id,id(2));
 assert.deepEqual(calc(coach(1,{experience_years:20}),{sport,level:'beginner'}),calc(coach(1,{experience_years:20}),{sport}));
});
test('rating tie-break requires an actual positive review count and valid range',()=>{
 assert.equal(trustedRating(coach(1,{rating:5})),0);assert.equal(trustedRating(coach(1,{rating:6,reviews_count:1})),0);assert.equal(trustedRating(coach(1,{rating:'4.5',reviews_count:2})),4.5);
 const list=[coach(1,{rating:5,reviews_count:0}),coach(2,{rating:4,reviews_count:1})];assert.equal(rankCoaches(list,{sport},{sports})[0].coach.id,id(2));
});
test('ties are MATCH then trustworthy rating then profile points then ID',()=>{
 const list=[coach(4,{score:2}),coach(3,{score:2}),coach(2,{rating:4,reviews_count:1}),coach(1,{goal:'',rating:5,reviews_count:5})];
 const p={sport,goal:'Сила',soft_fields:['goal']};const ids=rankCoaches(list,p,{sports,limit:10}).map(x=>x.coach.id);assert.deepEqual(ids,[id(2),id(3),id(4),id(1)]);
 assert.deepEqual(rankCoaches([...list].reverse(),p,{sports,limit:10}).map(x=>x.coach.id),ids);
});
test('default top three, empty catalogue, own and hidden profiles',()=>{
 assert.equal(rankCoaches(Array.from({length:5},(_,i)=>coach(i+1)),{sport},{sports}).length,3);
 assert.deepEqual(rankCoaches([],{sport},{sports}),[]);
 assert.deepEqual(rankCoaches([coach(1,{published:false}),coach(2),coach(3)],{sport},{sports,actor:id(2)}).map(x=>x.coach.id),[id(3)]);
});
test('ordinary form and backend preferences produce identical ranks and percentages',()=>{
 const rows=[coach(1,{goal:''}),coach(2),coach(3,{price:90}),coach(4,{format:'Онлайн'})];
 const form=formMatchPreferences({...all,budget:'40'}),backend={...all,soft_fields:['goal','specialization','availability']};
 assert.deepEqual(rankCoaches(rows,form,{sports}),rankCoaches(rows,backend,{sports}));
});
test('ordinary sport aliases preserve real dictionary ID equivalence',()=>{
 assert.equal(calc(coach(1),{sport:'bodybuilding'}).percent,100);assert.equal(calc(coach(1),{sport:'Бодибилдинг'}).percent,100);assert.equal(calc(coach(1),{sport}).percent,100);
});
test('legacy percentages remain identical on 128 fully selected data combinations',()=>{
 const source=execFileSync('git',['show','52d3189:fitmatch.js'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
 const start=source.indexOf('function calculateMatch(c, p) {'),end=source.indexOf('\nfunction matchPreferenceSummary',start);
 const legacy=vm.runInNewContext('('+source.slice(start,end).trim()+')',{sportKey:v=>v,parts:v=>String(v??'').split(/[,;\n]/).map(s=>s.trim().toLowerCase()).filter(Boolean),norm:v=>String(v??'').trim().toLowerCase(),formatFits:(c,w)=>!w||c.format===w||c.format==='Онлайн и офлайн'});
 for(let flags=0;flags<128;flags++) {
  const c=coach(1,{goal:flags&1?'Сила':'',format:flags&2?'Онлайн и офлайн':'Онлайн',city:flags&4?'Nice':'Paris',price:flags&8?40:null,period:flags&16?'занятие':'месяц',languages:flags&32?['ru']:[],availability:flags&64?['evening']:[]});
  assert.equal(calc(c,all).percent,legacy(c,all).percent,'combination '+flags);
 }
});
test('source and build use the one shared implementation',async()=>{
 const frontend=await readFile(new URL('../fitmatch.js',import.meta.url),'utf8'),backend=await readFile(new URL('../supabase/functions/search_coaches/index.mjs',import.meta.url),'utf8'),build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.ok(frontend.includes("from './fitgoin-match-core.mjs'"));assert.ok(!frontend.includes('function calculateMatch('));assert.ok(frontend.includes('const ranked=rankCoaches('));assert.ok(frontend.includes('matches:p=>rankCoaches('));assert.ok(backend.includes("from '../../../fitgoin-match-core.mjs'"));assert.ok(build.includes('fitgoin-match-core.mjs'));
});


test('ordinary form offline location does not constrain an online search',()=>{
 const p=formMatchPreferences({sport,format:'Онлайн',city:'Nice',country:'France',budget:''});
 assert.equal(rankCoaches([coach(1,{city:'Paris',country:'Other'})],p,{sports}).length,1);
});

test('actual ordinary findMatch adapter renders filtered ranked results',async()=>{
 const source=await readFile(new URL('../fitmatch.js',import.meta.url),'utf8');
 const start=source.indexOf('async function findMatch(form) {'),end=source.indexOf('\nasync function openProfile',start);
 const nodes={matchSummary:{},matchResults:{}};
 const rows=[coach(1,{price:60}),coach(2),coach(3,{goal:''}),coach(4,{published:false})];
 let context;context=vm.createContext({coaches:rows,sports,user:{id:'10000000-0000-4000-8000-000000000001'},authEpoch:0,matchStep:0,premium:null,currentPage:'match',backgroundMotion:{matches:true},setTimeout:f=>f(),requireUser:()=>true,page:p=>{context.currentPage=p},FormData:class{constructor(){return new Map(Object.entries({...all,budget:'40'}))}},rankCoaches,formMatchPreferences,notice:()=>{},catalogueError:'',$:key=>nodes[key],matchPreferenceSummary:()=>'',esc:String,card:(c,m)=>JSON.stringify({id:c.id,percent:m.percent})});
 const run=vm.runInContext('('+source.slice(start,end).trim()+')',context);await run({});
 assert.equal(context.currentPage,'matches');assert.equal(nodes.matchSummary.hidden,false);assert.ok(nodes.matchResults.innerHTML.includes(id(2)));assert.ok(nodes.matchResults.innerHTML.includes(id(3)));assert.ok(!nodes.matchResults.innerHTML.includes(id(1)));assert.ok(!nodes.matchResults.innerHTML.includes(id(4)));
});
test('existing recommendations callback invokes exactly the shared ranked results',async()=>{
 const source=await readFile(new URL('../fitmatch.js',import.meta.url),'utf8');const expression=source.match(/matches:(p=>[^\n]+)/)?.[1];assert.ok(expression);
 const rows=[coach(2),coach(1,{goal:''})],user={id:'10000000-0000-4000-8000-000000000001'};
 const callback=vm.runInNewContext('('+expression+')',{coaches:rows,sports,user,rankCoaches,formMatchPreferences});
 assert.deepEqual(callback(all),rankCoaches(rows,formMatchPreferences(all),{sports,actor:user.id}));
});

test('new sports already in the real dictionary need no invented alias or algorithm',()=>{
 const extra={id:'20000000-0000-4000-8000-000000000003',name:'Пилатес'};const c=coach(1,{sport:extra.id});
 const m=calculateMatch(c,{sport:'пилатес'},{sports:[...sports,extra]});assert.equal(m.percent,100);
 assert.equal(rankCoaches([c],{sport:'Пилатес'},{sports:[...sports,extra]}).length,1);
});
test('matching two unknown sport strings is not evidence of a real sport',()=>{
 const c=coach(1,{sport:'invented'});assert.equal(calculateMatch(c,{sport:'invented'},{sports}).percent,0);assert.equal(rankCoaches([c],{sport:'invented'},{sports}).length,0);
});
