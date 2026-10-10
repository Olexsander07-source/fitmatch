// Stage 3B: bounded basic menus. Portions and totals are computed here, never
// trusted to a provider or a client. This module belongs to the backend bundle.
import {AIError,UUID,ALLERGENS} from './fitgoin-ai-core.mjs';
import {nutritionMemory,nutritionPreferences,personalNutrition} from './fitgoin-ai-nutrition.mjs';

export const FOOD_CATALOG_VERSION='2026-10-09-basic-1';
const norm=s=>String(s||'').toLocaleLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const round=n=>Math.round(n*10)/10;
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
// Approximate generic composition per 100 g of the stated product. Energy uses
// 4/9/4 consistently; brands, fibre and cooking yields cause real differences.
// Basic food groups: NHS Eatwell Guide. Composition reference: USDA FDC.
const food=(name,aliases,group,p,f,c,min,max,step,allergens=[],animal='',cost=1,minutes=5,basis='готовый продукт')=>({name,aliases,group,p,f,c,min,max,step,allergens,animal,cost,minutes,basis});
export const FOODS=Object.freeze({
 oats:food('Овсяные хлопья',/овсян|овсяные|oats/iu,'starch',13,7,60,20,120,5,['gluten'],'',1,5,'сухие хлопья; варить на воде'),
 buckwheat:food('Гречка',/греч/iu,'starch',12,3,64,20,140,5,[],'',1,15,'сухая крупа'),
 rice:food('Рис',/(?:^|[^а-я])рис(?:а|у|ом|е)?(?:$|[^а-я])|rice/iu,'starch',7,1,78,20,150,5,[],'',1,20,'сухая крупа'),
 pasta:food('Макароны из твёрдой пшеницы',/макарон|паст[ау]/iu,'starch',12,2,70,20,140,5,['gluten'],'',1,12,'сухие макароны'),
 bread:food('Цельнозерновой хлеб',/хлеб/iu,'starch',9,3,43,20,180,5,['gluten'],'',1,1),
 potato:food('Картофель',/картоф|картош/iu,'starch',2,0.2,17,100,450,10,[],'',1,20,'отварной, без масла'),
 chicken:food('Куриное филе',/куриц|курин|chicken/iu,'protein',23,2,0,60,260,10,[],'meat',2,20,'сырое филе без кожи; приготовить полностью'),
 turkey:food('Филе индейки',/индей/iu,'protein',24,2,0,60,260,10,[],'meat',3,20,'сырое филе; приготовить полностью'),
 white_fish:food('Филе белой рыбы',/рыб|треск|минта|fish/iu,'protein',18,1,0,60,280,10,['fish'],'fish',2,15,'сырое филе; приготовить полностью'),
 salmon:food('Лосось',/лосос|семг/iu,'protein',20,13,0,60,220,10,['fish'],'fish',3,15,'сырое филе; приготовить полностью'),
 egg:food('Яйца',/яйц|яиц|egg/iu,'protein',13,10,1,50,150,50,['egg'],'egg',1,10,'съедобная часть; 1 среднее яйцо ≈ 50 г'),
 tofu:food('Тофу',/тофу/iu,'protein',13,7,2,80,350,10,['soy'],'',2,8),
 lentils:food('Чечевица',/чечев/iu,'protein',9,0.5,20,80,350,10,[],'',1,5,'варёная или консервированная, слить жидкость'),
 beans:food('Фасоль',/фасол/iu,'protein',8,0.5,20,80,350,10,[],'',1,3,'консервированная, слить жидкость и промыть'),
 yogurt:food('Натуральный йогурт 2%',/йогур|skyr/iu,'protein',8,2,4,100,350,10,['milk'],'dairy',2,1,'без сахара'),
 cottage:food('Творог 5%',/творог/iu,'protein',17,5,3,80,250,10,['milk'],'dairy',2,1),
 banana:food('Банан',/банан/iu,'fruit',1,0.3,23,60,240,10,[],'',1,1,'без кожуры; 1 средний банан ≈ 120 г'),
 apple:food('Яблоко',/яблок/iu,'fruit',0.3,0.2,14,80,250,10,[],'',1,1,'съедобная часть'),
 vegetables:food('Овощи (морковь, огурец, помидор)',/овощ|морков|огур|помидор/iu,'vegetable',1.5,0.3,5,100,300,10,[],'',1,5),
 olive_oil:food('Оливковое масло',/оливков.*масл/iu,'fat',0,100,0,3,25,1,[],'',2,1),
 sunflower_oil:food('Подсолнечное масло',/подсолнеч.*масл/iu,'fat',0,100,0,3,25,1,[],'',1,1),
 almonds:food('Миндаль',/миндал|орех/iu,'fat',21,50,13,5,35,5,['nuts'],'',3,1),
 seeds:food('Семечки подсолнечника',/семеч/iu,'fat',21,51,12,5,35,5,[],'',1,1)
});
const ids=Object.keys(FOODS);
function fail(code='invalid_nutrition_plan',status=422){throw new AIError(code,status);}
const safeText=(s,max)=>typeof s==='string'&&s.length<=max&&!/[\u0000-\u001f]/u.test(s);
function foodIDs(s){const n=norm(s);return ids.filter(id=>FOODS[id].aliases.test(n)||n.includes(norm(FOODS[id].name))||/рыб|fish/iu.test(n)&&FOODS[id].animal==='fish'||/мяс[оа]/iu.test(n)&&FOODS[id].animal==='meat');}
export function nutritionFacts(data){
 const prefs=nutritionPreferences(data);
 return {age:data.age??null,height_cm:data.height_cm??null,weight_kg:data.weight_kg??null,activity:data.activity??null,goal:prefs.goal||data.goal||null,days_per_week:data.days_per_week??null,diet:data.diet||'',preferences:prefs,allergies:[...(data.allergies||[])].filter(x=>ALLERGENS.includes(x)).sort(),restrictions:data.restrictions||'',needs_professional:Boolean(data.needs_professional)};
}
export function allowedFood(id,data,temporary=[]){
 const f=FOODS[id];if(!f)return false;const prefs=nutritionPreferences(data),text=norm([data.diet,prefs.preferences,prefs.restrictions,...(prefs.excluded_foods||[]),...temporary].filter(Boolean).join('; '));
 if((data.allergies||[]).some(a=>f.allergens.includes(a)))return false;
 if(/веган|растительн|vegan|plant.based/iu.test(text)&&f.animal)return false;
 if(/вегетариан|vegetarian/iu.test(text)&&['meat','fish'].includes(f.animal))return false;
 if(/без мяса|не ем мясо/iu.test(text)&&f.animal==='meat')return false;
 if(/без рыбы|не ем рыбу|не люблю рыбу|морепродукт/iu.test(text)&&f.animal==='fish')return false;
 if(/без молоч|без молока|не ем молоч|лактоз|milk.free|dairy.free/iu.test(text)&&f.animal==='dairy')return false;
 if(/без глютен|безглютен|gluten.free/iu.test(text)&&f.allergens.includes('gluten'))return false;
 const excluded=[...(prefs.excluded_foods||[]),...temporary];
 // Legacy diet text may already contain explicit dislikes/exclusions.
 for(const part of text.split(/[;,.]+/u))if(/не люблю|не ем|без |не нрав|нет /iu.test(part))excluded.push(part);
 return !excluded.some(s=>foodIDs(s).includes(id)||/^(?:мясо|мяса)$/u.test(norm(s))&&f.animal==='meat'||/^(?:молоко|молочные продукты)$/u.test(norm(s))&&f.animal==='dairy'||/^(?:рыба|рыбу|рыбы)$/u.test(norm(s))&&f.animal==='fish');
}
function portion(id,q){
 const f=FOODS[id];if(id==='egg')return `${q/50} шт. (≈ ${q} г)`;
 if(id==='banana'&&q%120===0)return `${q/120} шт. (≈ ${q} г)`;
 return `${q} г`;
}
function item(id,q,key){
 const f=FOODS[id];if(!f||!Number.isFinite(q)||q<f.min||q>f.max||q/f.step!==Math.round(q/f.step))fail();
 const p=round(f.p*q/100),fat=round(f.f*q/100),c=round(f.c*q/100);
 return {id:key,food_id:id,name:f.name,quantity_g:q,portion:portion(id,q),weight_basis:f.basis,calories:Math.round(4*p+9*fat+4*c),protein_g:p,fat_g:fat,carbs_g:c,allergens:[...f.allergens]};
}
function totals(items){const p=round(items.reduce((s,x)=>s+x.protein_g,0)),f=round(items.reduce((s,x)=>s+x.fat_g,0)),c=round(items.reduce((s,x)=>s+x.carbs_g,0));return {calories:Math.round(4*p+9*f+4*c),protein_g:p,fat_g:f,carbs_g:c};}
function recipe(items){return items.map(x=>`${x.name} — ${x.portion}; ${x.weight_basis}.`).join(' ')+' Готовь без дополнительного масла, кроме указанного в составе.';}
function documentFor(meals,estimate){
 const all=meals.flatMap(m=>m.items),total=totals(all),shopping=new Map();
 for(const x of all)shopping.set(x.food_id,(shopping.get(x.food_id)||0)+x.quantity_g);
 return {schema_version:3,catalog_version:FOOD_CATALOG_VERSION,title:'Твой базовый рацион на день',summary:'Простые продукты и понятные порции. Это приблизительное меню для здорового взрослого; учитывай маркировку и переносимость.',...total,calories_low:estimate.calories_low,calories_high:estimate.calories_high,targets:{calories:estimate.calories,protein_g:estimate.protein_g,fat_g:estimate.fat_g,carbs_g:estimate.carbs_g},meals:meals.map(m=>({...m,...totals(m.items),ingredients:m.items.map(x=>`${x.name} — ${x.portion} (${x.weight_basis})`),allergens:[...new Set(m.items.flatMap(x=>x.allergens))],recipe:recipe(m.items),substitutions:[]})),shopping_list:[...shopping].map(([id,q])=>`${FOODS[id].name} — ${q} г (${FOODS[id].basis})`),assumptions:['БЖУ рассчитаны из указанных порций; калории согласованы по формуле 4/9/4.','Сухая и готовая масса явно различаются. Вода при приготовлении меняет массу, а не количество БЖУ.','Состав и масса продуктов различаются: проверь этикетку. Проверяй аллергены и следы; AI не гарантирует отсутствие перекрёстного загрязнения.']};
}
function pick(candidates,data,temporary=[]){return candidates.find(id=>allowedFood(id,data,temporary))||fail('nutrition_preferences_conflict');}
export function createMealPlan(data,program=null,message=''){
 const calc=personalNutrition(data,program,message);if(calc.status!=='ready')return calc;
 const n=calc.estimate.preferences.meals_per_day||4;
 if(n===1)return {status:'missing',missing:['meals_per_day'],answer:'В памяти указан один приём пищи. Полный дневной рацион получится слишком объёмным для одной порции. Выбери удобное число от 2 до 8, например: «Я предпочитаю 3 приёма пищи в день».'};
 const preference=norm(data.diet||''),base=[
  [[/люблю греч|предпочитаю греч/iu.test(preference)?'buckwheat':'oats','buckwheat','bread'],60,[['egg','yogurt','tofu','lentils'],100],[['banana','apple'],120]],
  [['rice','buckwheat','pasta','potato','bread'],70,[['chicken','turkey','tofu','lentils','beans','cottage','white_fish'],140],[['vegetables'],150],[['olive_oil','sunflower_oil','seeds'],10]],
  [['potato','buckwheat','rice','pasta','bread'],250,[['white_fish','chicken','turkey','tofu','lentils','beans','cottage'],150],[['vegetables'],150],[['olive_oil','sunflower_oil','seeds'],10]],
  [['apple','banana'],150,[['yogurt','cottage','tofu','lentils','beans'],180],[['almonds','seeds','olive_oil','sunflower_oil'],20]]
 ];
 // Each row begins with a candidate list and amount; remaining pairs follow.
 const raw=base.flatMap((r,mi)=>{const pairs=[[r[0],r[1]],...r.slice(2)];return pairs.map(([choices,q],ii)=>{const id=pick(choices,data),f=FOODS[id];return {...item(id,Math.min(f.max,Math.max(f.min,Math.round(q/f.step)*f.step)),`meal-${mi+1}-food-${ii+1}`),baseMeal:mi};});});
 const target=calc.estimate,score=xs=>{const t=totals(xs);return 5*((t.calories-target.calories)/target.calories)**2+1.5*((t.protein_g-target.protein_g)/target.protein_g)**2+((t.fat_g-target.fat_g)/target.fat_g)**2+((t.carbs_g-target.carbs_g)/target.carbs_g)**2;};
 for(let turn=0;turn<650;turn++){
  const now=score(raw);let best=now,index=-1,replacement;
  for(let i=0;i<raw.length;i++){const x=raw[i],f=FOODS[x.food_id];for(const delta of [-f.step,f.step]){const q=x.quantity_g+delta;if(q<f.min||q>f.max)continue;const next={...item(x.food_id,q,x.id),baseMeal:x.baseMeal},candidate=raw.with(i,next),s=score(candidate);if(s<best-1e-9){best=s;index=i;replacement=next;}}}
  if(index<0)break;raw[index]=replacement;
 }
 const total=totals(raw);if(Math.abs(total.calories-target.calories)>target.calories*.12||Math.abs(total.protein_g-target.protein_g)>target.protein_g*.3)fail('nutrition_preferences_conflict');
 let meals;
 if(n<=4){const names=n===2?['Первый приём пищи','Второй приём пищи']:['Завтрак','Обед','Ужин','Перекус'];meals=Array.from({length:n},(_,i)=>({id:`meal-${i+1}`,name:names[i],items:[]}));for(const x of raw){const mi=n===2?(x.baseMeal===0||x.baseMeal===3?0:1):n===3?(x.baseMeal===3?0:x.baseMeal):x.baseMeal;const {baseMeal,...clean}=x;meals[mi].items.push(clean);}}
 else{
  meals=Array.from({length:n},(_,i)=>({id:`meal-${i+1}`,name:i<3?['Завтрак','Обед','Ужин'][i]:`Перекус ${i-2}`,items:[]}));
  for(const x of raw){const {baseMeal,...clean}=x;meals[baseMeal<3?baseMeal:3].items.push(clean);}
  // Extra snacks use foods that can be eaten on their own. Oil remains with
  // its main meal; moving the last ingredient blindly creates an oil snack.
  const snackRank=x=>FOODS[x.food_id].group==='fruit'?0:['yogurt','cottage','tofu'].includes(x.food_id)?1:x.food_id==='egg'?2:['lentils','beans'].includes(x.food_id)?3:['almonds','seeds'].includes(x.food_id)?4:Infinity;
  for(let i=4;i<n;i++){
   const candidates=meals.slice(0,4).filter(m=>m.items.length>1).flatMap(m=>m.items.map(x=>({m,x,rank:snackRank(x)}))).filter(x=>Number.isFinite(x.rank)).sort((a,b)=>a.rank-b.rank);
   const {m,x}=candidates[0]||fail('nutrition_preferences_conflict');
   m.items=m.items.filter(y=>y.id!==x.id);meals[i].items.push(x);
  }
 }
 return {status:'ready',estimate:target,document:documentFor(meals,target)};
}
export function validateMealPlan(doc,data,checkPreferences=true){
 if(!doc||doc.schema_version!==3||doc.catalog_version!==FOOD_CATALOG_VERSION||JSON.stringify(doc).length>26000||!Array.isArray(doc.meals)||doc.meals.length<2||doc.meals.length>8)fail();
 const keys=new Set(),meals=doc.meals.map(m=>{if(!/^meal-\d$/u.test(m.id)||keys.has(m.id)||!safeText(m.name,80)||!Array.isArray(m.items)||!m.items.length||m.items.length>12)fail();keys.add(m.id);return {id:m.id,name:m.name,items:m.items.map(x=>{if(!/^meal-\d-food-\d$/u.test(x.id)||keys.has(x.id)||checkPreferences&&!allowedFood(x.food_id,data))fail();keys.add(x.id);return item(x.food_id,x.quantity_g,x.id);})};});
 const t=doc.targets;if(!t||!['calories','protein_g','fat_g','carbs_g'].every(k=>Number.isFinite(t[k])&&t[k]>0)||t.calories<1600||t.calories>4500)fail();
 const canonical=documentFor(meals,{...t,calories_low:doc.calories_low,calories_high:doc.calories_high});
 if(stable(canonical)!==stable(doc))fail();
 if(checkPreferences){const calc=personalNutrition(data);if(calc.status!=='ready'||stable(t)!==stable(Object.fromEntries(['calories','protein_g','fat_g','carbs_g'].map(k=>[k,calc.estimate[k]])))||doc.calories_low!==calc.estimate.calories_low||doc.calories_high!==calc.estimate.calories_high||doc.meals.length!==(nutritionPreferences(data).meals_per_day||4))fail('nutrition_plan_changed',409);}
 if(doc.calories<1400||doc.calories>5000)fail();return canonical;
}
export function mealIntent(message){
 const s=norm(message);if(/например|цитат|мой друг|моя подруга|если|«|»|[“”"]/u.test(s))return null;
 if(/^(?:я не ем|я не люблю|мне не нравится)/u.test(s)&&/\?\s*$/u.test(s))return null;
 if(/^(?:сохрани|подтверждаю|принимаю)(?: предложенн(?:ый|ое|ую))? (?:рацион|меню|питание|замену|план питания)[.!]*$/u.test(s))return 'confirm';
 if(/^(?:отмени|отменить|не сохраняй) (?:рацион|меню|замену|черновик)[.!]*$/u.test(s))return 'cancel';
 if(/(?:составь|создай|обнови|сделай|create|build).*(?:меню|питани|рацион|meal plan)/u.test(s)||/^(?:что мне (?:сегодня )?есть|мое питание|покажи (?:мое )?(?:питание|меню|рацион))[?!.]*$/u.test(s))return 'create';
 if(/^(?:замени|заменить|я не люблю|мне не нравится|у меня нет|я не ем|сделай дешевле|сделай быстрее|сделай.*быстрее.*приготов)/u.test(s))return 'replace';
 if(/^(?:я )?хочу (?:похудеть|набрать (?:мышечную )?массу)[.!]*$/u.test(s))return 'create';
 return null;
}
export function activeNutrition(plans=[]){return plans.find(p=>p.kind==='nutrition'&&p.status==='active')||null;}
function swapItem(old,data,temporary,preferred,motive,others=[]){
 const f=FOODS[old.food_id],candidates=(preferred.length?preferred:ids).filter(id=>FOODS[id].group===f.group&&id!==old.food_id&&allowedFood(id,data,temporary)&&(!motive||FOODS[id][motive]<f[motive]));
 let best=null,score=Infinity;
 for(const id of candidates){const g=FOODS[id];for(let q=g.min;q<=g.max;q+=g.step){if(id==='egg'&&q+others.filter(x=>x.food_id==='egg').reduce((s,x)=>s+x.quantity_g,0)>150)continue;const x=item(id,q,old.id),s=((x.calories-old.calories)/Math.max(old.calories,70))**2*3+((x.protein_g-old.protein_g)/Math.max(old.protein_g,12))**2+((x.fat_g-old.fat_g)/Math.max(old.fat_g,8))**2+((x.carbs_g-old.carbs_g)/Math.max(old.carbs_g,15))**2+(id==='lentils'||id==='beans'?0.08:0);if(motive&&(Math.abs(x.calories-old.calories)>Math.max(15,old.calories*.1)||Math.abs(x.protein_g-old.protein_g)>Math.max(5,old.protein_g*.2)||Math.abs(x.fat_g-old.fat_g)>Math.max(5,old.fat_g*.3)||Math.abs(x.carbs_g-old.carbs_g)>Math.max(10,old.carbs_g*.2)))continue;if(s<score){score=s;best=x;}}}
 return best;
}
export function replaceFoods(doc,data,message,target=null){
 const n=norm(message),motive=/дешев/u.test(n)?'cost':/быстр/u.test(n)?'minutes':null;
 const split=n.match(/^(?:замени|заменить) (.+?) на (.+)$/u),requested=foodIDs(split?split[1]:n),preferred=split?foodIDs(split[2]):[];
 if(split&&!preferred.length)return {answer:'Такого продукта пока нет в базовом справочнике. Уточни замену из обычных продуктов, например: индейка, тофу, гречка или фасоль.'};
 const temporary=/у меня нет/u.test(n)?[n.replace(/^у меня нет /u,'')]:[];
 let matches=doc.meals.flatMap(m=>m.items.map(x=>({meal:m,item:x}))).filter(x=>target?x.meal.id===target.meal_id&&x.item.id===target.item_id:motive?true:requested.includes(x.item.food_id));
 if(target&&!matches.length)fail('nutrition_plan_changed',409);
 if(!matches.length)return {answer:'В этом рационе такого продукта нет. Выбери «Заменить» рядом с нужным продуктом; остальные блюда останутся прежними.'};
 const allExcluded=/^я не (?:ем|люблю)/u.test(n);
 if(matches.length>1&&!motive&&!target&&!allExcluded)return {answer:'Этот продукт есть в нескольких приёмах пищи. Выбери конкретную порцию кнопкой «Заменить» в меню; сейчас рацион не меняю.'};
 const replacements=new Map(),changes=[];
 for(const {meal,item:old} of matches){const others=doc.meals.flatMap(m=>m.items).filter(x=>x.id!==old.id).map(x=>replacements.get(x.id)||x),next=swapItem(old,data,temporary,preferred,motive,others);if(!next){if(motive)continue;return {answer:'Не удалось подобрать подходящую замену с этими ограничениями. Текущий рацион не изменён. Уточни доступные продукты.'};}replacements.set(old.id,next);changes.push({meal_id:meal.id,item_id:old.id,from:`${old.name} — ${old.portion}`,to:`${next.name} — ${next.portion}`});}
 if(!changes.length)return {answer:motive==='cost'?'В текущем базовом меню уже используются бюджетные варианты. Точные цены зависят от магазина; рацион не изменён.':'Не нашёл более быстрого варианта с этими ограничениями. Рацион не изменён.'};
 const meals=doc.meals.map(m=>({id:m.id,name:m.name,items:m.items.map(x=>replacements.get(x.id)||x)})),next=documentFor(meals,{...doc.targets,calories_low:doc.calories_low,calories_high:doc.calories_high});
 const delta={calories:next.calories-doc.calories,protein_g:round(next.protein_g-doc.protein_g),fat_g:round(next.fat_g-doc.fat_g),carbs_g:round(next.carbs_g-doc.carbs_g)};
 const significant=Math.abs(delta.calories)>doc.calories*.1||Math.abs(delta.protein_g)>10||Math.abs(delta.fat_g)>10||Math.abs(delta.carbs_g)>20;
 const sign=x=>x>0?'+'+x:String(x);
 return {document:next,changes,answer:changes.map(x=>`${doc.meals.find(m=>m.id===x.meal_id).name}: ${x.from} → ${x.to}.`).join('\n')+`\nРазница за день: ${sign(delta.calories)} ккал; Б ${sign(delta.protein_g)}, Ж ${sign(delta.fat_g)}, У ${sign(delta.carbs_g)} г.`+(significant?' Баланс заметно отличается; проверь новые БЖУ перед принятием.':' Калорийность и БЖУ остаются близкими.')+(motive==='cost'?' Это обычно более бюджетные продукты; местные цены могут отличаться.':motive==='minutes'?' Быстрее при использовании указанных готовых или консервированных продуктов.':'')};
}
export function mealsTurn(data,message,action,module,current,program=null,target=null){
 const intent=action==='nutrition'?'create':action==='chat'?mealIntent(message):null, memory=nutritionMemory(data,message),pending=data.nutrition_plan_pending;
 const continuing=pending?.mode==='request'&&memory.fields.length>0;
 if(module!=='nutrition')return intent?{answer:'Для рациона выбери модуль «Питание».',extra:{}}:null;
 if(!intent&&!continuing)return null;
 const changed=memory.fields.length>0,extra={memory_saved:changed,memory_fields:memory.fields,...(changed?{memory_patch:memory.patch}:{})};
 const source=pending?.mode==='proposal'?pending.document:current?.document;
 if(target&&(target.plan_id!==undefined&&target.plan_id!==(current?.id||null)||target.draft_id!==undefined&&target.draft_id!==(pending?.mode==='proposal'?pending.id:null)))fail('nutrition_plan_changed',409);
 if(intent==='cancel')return {answer:'Черновик отменён. Сохранённый рацион остаётся прежним.',extra:{nutrition_plan_pending:null,nutrition_view:true}};
 if(intent==='confirm'){
  if(!pending||pending.mode!=='proposal')return {answer:'Сейчас нет предложенного рациона для подтверждения. Сначала составь меню или предложи замену.',extra:{nutrition_view:true}};
  if(!UUID.test(pending.id||'')||pending.base_plan_id!==(current?.id||null)||stable(pending.profile_snapshot)!==stable(nutritionFacts(data)))fail('nutrition_plan_changed',409);
  const check=personalNutrition(data,program);if(check.status!=='ready')return {answer:check.answer,extra:{nutrition_view:true}};
  const doc=validateMealPlan(pending.document,data);
  return {answer:'Рацион подтверждён и сохранён. Эта версия будет доступна после повторного входа. Предыдущая версия сохранена в истории.',extra:{kind:'nutrition',plan_id:pending.id,document:doc,nutrition_saved:true,nutrition_previous_id:current?.id||null,profile_snapshot:nutritionFacts(data),nutrition_plan_pending:null,nutrition_view:true}};
 }
 const calc=personalNutrition(memory.data,program,message);
 if(calc.status==='professional')return {answer:calc.answer,extra};
 if(intent==='replace'&&!source)return {answer:(changed?'Пищевые предпочтения сохранены. ':'')+'Сохранённого меню пока нет. Напиши «Составь меню на день» — учту предпочтения.',extra};
 if(intent==='replace'&&source?.schema_version!==3)return {answer:'Это меню создано до функции точечных замен. Составь новый черновик меню; прежний рацион сохранится до твоего подтверждения.',extra:{...extra,nutrition_view:true}};
 if(intent==='replace'&&pending?.mode==='proposal'&&stable(pending.profile_snapshot)!==stable(nutritionFacts(data)))fail('nutrition_plan_changed',409);
 if(intent==='replace'){
  // Validate against the previous facts before applying a newly excluded food.
  validateMealPlan(source,data,false);
  const replacement=replaceFoods(source,memory.data,message,target);
  if(!replacement.document)return {answer:(changed?'Пищевые предпочтения сохранены. ':'')+replacement.answer,extra:{...extra,nutrition_view:true}};
  const proposal={id:crypto.randomUUID(),mode:'proposal',base_plan_id:current?.id||null,profile_snapshot:nutritionFacts(memory.data),document:validateMealPlan(replacement.document,memory.data),changes:replacement.changes};
  return {answer:(changed?'Пищевые предпочтения сохранены. ':'')+replacement.answer+'\n\nЭто черновик. Нажми «Сохранить рацион» или напиши «Сохрани рацион». Сохранённая версия пока не изменена.',extra:{...extra,nutrition_plan_pending:proposal,nutrition_view:true}};
 }
 // “What should I eat today?” shows the accepted plan; a create/update request
 // is explicit and may propose another menu without replacing that plan.
 if(current&&!/составь|создай|обнови|сделай|хочу|create|build/iu.test(message)&&!continuing)return {answer:'Показываю твой сохранённый рацион. Для изменений выбери продукт или попроси новый черновик.',extra:{nutrition_view:true}};
 const result=createMealPlan(memory.data,program,message);
 if(result.status!=='ready')return {answer:result.answer,extra:{...extra,missing_fields:result.missing||[],nutrition_plan_pending:{id:crypto.randomUUID(),mode:'request',base_plan_id:current?.id||null},nutrition_view:false}};
 if(data.nutrition_pending===true)extra.memory_patch={...(extra.memory_patch||{}),nutrition_pending:false};
 const proposal={id:crypto.randomUUID(),mode:'proposal',base_plan_id:current?.id||null,profile_snapshot:nutritionFacts(memory.data),document:validateMealPlan(result.document,memory.data),changes:[]};
 return {answer:`Подготовлен черновик на ${result.document.meals.length} приёма пищи: ≈ ${result.document.calories} ккал; Б ${result.document.protein_g}, Ж ${result.document.fat_g}, У ${result.document.carbs_g} г. Порции и блюда — в карточках «Питание».\n\nПроверь меню, замени продукты при необходимости и нажми «Сохранить рацион». Текущий сохранённый рацион пока не изменён.`,extra:{...extra,nutrition_plan_pending:proposal,nutrition_view:true,nutrition_estimate:result.estimate}};
}
