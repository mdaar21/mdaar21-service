// Deterministic gram-based nutrition; Mdaar never supplies this catalogue's numbers.
const KEYS = ['kcal', 'p', 'c', 'f', 'fiber'];
export const ALLERGENS = {milk:['حليب','Milk'],egg:['بيض','Egg'],gluten:['قمح/غلوتين','Wheat/gluten'],peanut:['فول سوداني','Peanut'],tree_nut:['مكسرات','Tree nuts'],fish:['سمك','Fish']};
const finite = (value, label, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError(label);
  return value;
};
export function calculateNutrition(recipe, ingredients, servings = 1) {
  finite(servings, 'Invalid servings', 0.01, 100);
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) throw new TypeError('Missing ingredients');
  const totals = Object.fromEntries(KEYS.map(k => [k, 0]));
  for (const part of recipe.ingredients) {
    finite(part.grams, 'Invalid ingredient grams', 0.01, 10000);
    const food = ingredients[part.id];
    if (!food) throw new TypeError(`Unknown ingredient: ${part.id}`);
    for (const key of KEYS) totals[key] += finite(food.per100g[key], 'Invalid nutrient', 0, 1000) * part.grams / 100 * servings;
  }
  return totals;
}
export function substituteIngredients(recipe, replacements, ingredients) {
  if (!replacements || typeof replacements !== 'object' || Array.isArray(replacements)) throw new TypeError('Invalid replacements');
  const result=structuredClone(recipe);
  for (const [index,id] of Object.entries(replacements)) {
    const n=Number(index);
    if (!Number.isInteger(n) || String(n)!==index || n<0 || n>=recipe.ingredients.length) throw new RangeError('Invalid ingredient index');
    const original=recipe.ingredients[n].id;
    if (!Object.hasOwn(ingredients,id) || (id!==original && !ingredients[original].alternatives.includes(id))) throw new RangeError('Unsupported replacement');
    result.ingredients[n].id=id;
  }
  result.allergens=[...new Set(result.ingredients.flatMap(part=>ingredients[part.id].allergens))].sort();
  result.modified=result.ingredients.some((part,i)=>part.id!==recipe.ingredients[i].id);
  result.nutrition=calculateNutrition(result,ingredients);
  return result;
}
export function filterRecipes(recipes, ingredients, filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase();
  const excluded = String(filters.excluded || '').split(/[,،;\n]/).map(x => x.trim().toLocaleLowerCase()).filter(Boolean);
  return recipes.filter(recipe => {
    if (filters.goal && filters.goal !== 'all' && recipe.goal !== filters.goal) return false;
    if (filters.category && filters.category !== 'all' && recipe.category !== filters.category) return false;
    if ((filters.allergens || []).some(a => recipe.allergens.includes(a))) return false;
    if (filters.maxMinutes && recipe.minutes > filters.maxMinutes) return false;
    const text = [recipe.name, recipe.nameEn, ...recipe.ingredients.flatMap(x => [ingredients[x.id].name, ingredients[x.id].nameEn])].join(' ').toLocaleLowerCase();
    if (query && !text.includes(query)) return false;
    if (excluded.some(word => text.includes(word))) return false;
    const n = calculateNutrition(recipe, ingredients);
    if (filters.maxKcal && n.kcal > filters.maxKcal) return false;
    if (filters.minProtein && n.p < filters.minProtein) return false;
    if (filters.favorites && !filters.favorites.includes(recipe.id)) return false;
    return true;
  });
}
export function sumMeals(meals) {
  return meals.reduce((acc, meal) => {
    for (const key of KEYS) acc[key] += finite(meal.nutrition[key], 'Invalid meal totals', 0, 100000);
    return acc;
  }, Object.fromEntries(KEYS.map(k => [k, 0])));
}
const roundedServing = v => Math.round(v * 100) / 100;
export function createPlan(recipes, ingredients, options) {
  const target = options.target;
  finite(target.kcal, 'Calories must be 1200–6000', 1200, 6000);
  for (const k of ['p','c','f']) if (target[k] != null) finite(target[k], 'Invalid macro target', 0, 1000);
  if (![3,4,5].includes(options.meals)) throw new RangeError('Choose 3–5 meals');
  if (![1,7].includes(options.days)) throw new RangeError('Choose 1 or 7 days');
  const eligible = filterRecipes(recipes, ingredients, options);
  const categories = ['فطور','غداء','عشاء', ...Array(Math.max(0,options.meals-3)).fill('سناك')];
  const choices = categories.map(cat => eligible.filter(r => r.category === cat));
  if (choices.some(list => list.length === 0)) throw new RangeError('No meals match all restrictions. Adjust preferences; never ignore an allergy.');
  const days=[];
  for (let d=0; d<options.days; d++) {
    let best=null;
    for (let attempt=0; attempt<180; attempt++) {
      const selected=choices.map((list,j) => list[(attempt*(j*2+3) + d*7 + j*5 + Math.floor(attempt/7)) % list.length]);
      if (new Set(selected.map(r=>r.id)).size !== selected.length) continue;
      const base=selected.map(r=>calculateNutrition(r,ingredients));
      const factor=roundedServing(target.kcal/base.reduce((s,n)=>s+n.kcal,0));
      if (factor<0.5 || factor>3) continue;
      const meals=selected.map((recipe,j)=>({recipeId:recipe.id,category:categories[j],servings:factor,nutrition:calculateNutrition(recipe,ingredients,factor)}));
      const totals=sumMeals(meals);
      const score=['p','c','f'].reduce((s,k)=>s+(target[k]>0 ? ((totals[k]-target[k])/target[k])**2 : 0),0)
        + Math.abs(totals.kcal-target.kcal)/target.kcal
        + days.reduce((s,day)=>s+selected.filter(r=>day.meals.some(m=>m.recipeId===r.id)).length*0.03,0);
      if (!best || score<best.score) best={score,meals,totals};
    }
    if (!best) throw new RangeError('No practical portions match this calorie target with these restrictions.');
    days.push({index:d,meals:best.meals,totals:best.totals});
  }
  return {target:{...target},constraints:{goal:options.goal||'all',allergens:[...(options.allergens||[])],excluded:options.excluded||'',maxMinutes:options.maxMinutes},days};
}
export function swapMeal(plan, dayIndex, mealIndex, recipes, ingredients) {
  const day=plan.days[dayIndex], current=day?.meals[mealIndex];
  if (!current) throw new RangeError('Unknown meal');
  const occupied=new Set(day.meals.filter((_,i)=>i!==mealIndex).map(m=>m.recipeId));
  const pool=filterRecipes(recipes,ingredients,plan.constraints).filter(r=>r.category===current.category && r.id!==current.recipeId && !occupied.has(r.id));
  // Keep the original energy/macro anchor: rounding must not drift after many swaps.
  const target=current.swapTarget || current.nutrition;
  const seen=new Set([...(current.swapHistory||[]),current.recipeId]);
  const currentRecipe=recipes.find(r=>r.id===current.recipeId);
  const currentFoods=new Set(currentRecipe?.ingredients.filter(x=>x.id!=='oil').map(x=>x.id));
  const candidates=[];
  for (const recipe of pool) {
    const base=calculateNutrition(recipe,ingredients);
    const servings=roundedServing(target.kcal/base.kcal);
    if (servings<0.5 || servings>3) continue;
    const nutrition=calculateNutrition(recipe,ingredients,servings);
    const foods=recipe.ingredients.filter(x=>x.id!=='oil');
    const overlap=foods.filter(x=>currentFoods.has(x.id)).length/Math.max(foods.length,currentFoods.size,1);
    const score=Math.abs(nutrition.kcal-target.kcal)/Math.max(target.kcal,1)
      + ['p','c','f'].reduce((s,k)=>s+Math.abs(nutrition[k]-target[k])/Math.max(target[k],10),0)*0.1 + overlap*0.3;
    candidates.push({score,recipeId:recipe.id,category:current.category,servings,nutrition});
  }
  if (!candidates.length) throw new RangeError('No alternative matches the current restrictions.');
  const unseen=candidates.filter(r=>!seen.has(r.recipeId));
  const choices=unseen.length?unseen:candidates;
  const best=choices.reduce((a,b)=>a.score<=b.score?a:b);
  const result=structuredClone(plan);
  const {score,...replacement}=best;
  replacement.swapTarget={...target};
  replacement.swapHistory=[...(unseen.length?seen:[current.recipeId]),replacement.recipeId];
  result.days[dayIndex].meals[mealIndex]=replacement;
  result.days[dayIndex].totals=sumMeals(result.days[dayIndex].meals);
  return result;
}

const LABELS={
 title:['مكتبة وصفات مدار','Mdaar recipe library'],intro:['500 وجبة: 250 لخفض الوزن و250 لزيادة الوزن، بأوزان محددة. ملاءمة الهدف تعتمد على مجموع يومك. القيم محسوبة من بيانات USDA SR28 وليست تحليلاً مخبرياً؛ مراجعة المختص معلقة.','500 meal suggestions: 250 cutting and 250 bulking with gram amounts. Suitability depends on your whole day. Values use USDA SR28 data, not laboratory testing; professional review is pending.'],
 search:['ابحث بالاسم أو المكوّن','Search by name or ingredient'],goal:['الهدف','Goal'],all:['كل الأهداف','All goals'],cut:['خفض الوزن','Cutting'],bulk:['زيادة الوزن','Bulking'],max:['أقصى سعرات للحصة الأساسية','Max calories per base serving'],protein:['أقل بروتين للحصة الأساسية (جم)','Min protein per base serving (g)'],favorites:['المفضلة فقط','Favorites only'],source:['المصدر وطريقة الحساب','Source and calculation method'],review:['محسوبة · تنتظر مراجعة مختص','Calculated · professional review pending'],servings:['عدد الحصص','Servings'],favorite:['احفظ في المفضلة','Save favorite'],saved:['إزالة من المفضلة','Remove favorite'],add:['أضف لدفتري','Add to diary'],added:['أضيفت للدفتـر','Added to diary'],ingredients:['المكونات بالجرام','Ingredients in grams'],steps:['الطريقة','Preparation'],allergens:['مسببات الحساسية','Allergens'],none:['لا توجد ضمن المكونات المعلنة','None in declared ingredients'],warning:['راجع ملصقات العبوات والتلوث التبادلي. البدائل تحتاج إعادة حساب وفحص الحساسية.','Check product labels and cross-contact. Recalculate and check allergies after substitutions.'],alternative:['بدائل مقترحة','Suggested alternatives'],noalternative:['لا بديل موثق هنا','No documented alternative here'],previous:['السابق','Previous'],next:['التالي','Next'],empty:['لا وصفات تطابق الفلاتر.','No recipes match these filters.'],cost:['الميزانية: لا تتوافر أسعار موثوقة، لذلك لا نعرض تكلفة أو فلتر ميزانية.','Budget: reliable local prices are unavailable; cost estimates and budget filtering are unavailable.'],planner:['خطط يومية وأسبوعية بالحساب','Daily and weekly plans by calculation'],plannerIntro:['اختر وجباتك من مكتبة مدار. تُحسب السعرات والمغذيات من أوزان المكونات. راجع الحساسيات والكميات قبل الاستخدام.','Choose meals from the Mdaar library. Calories and nutrients are calculated from ingredient weights. Review allergies and portions before use.'],kcal:['السعرات اليومية','Daily calories'],p:['البروتين (جم)','Protein (g)'],c:['الكارب (جم)','Carbohydrate (g)'],f:['الدهون (جم)','Fat (g)'],meals:['عدد الوجبات','Meals per day'],days:['المدة','Duration'],day:['يوم واحد','One day'],week:['أسبوع','One week'],exclude:['مكونات لا تريدها، مفصولة بفاصلة','Unwanted ingredients, separated by commas'],minutes:['أقصى وقت تجميع بالدقائق','Max assembly time (minutes)'],generate:['أنشئ خطة محسوبة','Build calculated plan'],restrictions:['استبعاد مسببات الحساسية','Exclude allergens'],planError:['تعذر إنشاء الخطة بهذه القيود. راجع الهدف والوقت والمكونات؛ لا تتجاهل الحساسية.','No plan is available for these constraints. Review targets, time and exclusions; never ignore an allergy.'],swapError:['لا يوجد بديل متاح بهذه القيود.','No alternative matches these constraints.'],swap:['غيّر الوجبة','Swap meal'],planNote:['مجاميع محسوبة من الكميات المعروضة. قد تختلف عن هدف الماكروز؛ الفرق ظاهر أدناه ولا ندعي التطابق.','Totals are calculated from displayed portions. Macro targets may differ; deviations are shown below.'],dayNumber:['اليوم','Day'],difference:['الفرق عن الهدف','Difference from target'],details:['المكونات والطريقة','Ingredients and method'],foodNote:['الطعام المقترح يحتاج مراجعة بشرية ولا يمثل وصفة علاجية.','Meal suggestions require human review and are not medical prescriptions.'],illustration:['رسم توضيحي عام، ليس صورة الطبق','General illustration, not a photograph of this meal'],time:['دقيقة تجميع، لا تشمل الطهو المسبق','minutes assembly; excludes cooking ingredients'],loading:['جار تحميل بيانات الوصفات…','Loading recipe data…'],loadError:['تعذر تحميل مكتبة الوصفات. تحقق من اتصالك وأعد تحميل الصفحة.','Unable to load the recipe library. Check your connection and reload the page.'],calorieUnit:['سعرة','kcal'],gram:['جم','g'],noTarget:['احسب احتياجك أولاً أو أدخل أهدافك للمراجعة.','Calculate your needs first or enter targets for review.'],favoritesError:['تعذر حفظ التفضيل في المتصفح.','This browser could not save your preference.'],storageError:['تعذر الحفظ في المتصفح. صدّر بياناتك وافحص المساحة المتاحة.','This browser could not save the entry. Export your data and check available storage.']
};
let ingredients={},recipes=[],byId={},library,planner,page=0,currentPlan=null,suggestedPlan=null,suggestedSignature='';
const replacementsByRecipe=new Map();
const recipeVersion=id=>substituteIngredients(byId[id],replacementsByRecipe.get(id)||{},ingredients);
const language=()=>globalThis.Mdaar?.getLanguage?.()==='en'?'en':'ar';
const tr=k=>LABELS[k]?.[language()==='en'?1:0] || k;
const e = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textName=x=>language()==='en'?(x.nameEn||x.name):x.name;
const decimal=n=>Number(n.toFixed(1)).toLocaleString(language()==='en'?'en-US':'ar-SA');
const macros=n=>`${decimal(n.kcal)} ${tr('calorieUnit')} · P ${decimal(n.p)} · C ${decimal(n.c)} · F ${decimal(n.f)} ${tr('gram')}`;
const loadFavorites=()=>{try {const a=JSON.parse(localStorage.getItem('mdaar_recipe_favorites')||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string' && byId[x]):[];}catch{return [];}};
function notice(element,message){element.textContent=message;element.setAttribute('role','status');}
function servingDetails(recipe,servings){
  return `<ul>${recipe.ingredients.map(part=>{const food=ingredients[part.id];return `<li>${e(textName(food))}: <b>${decimal(part.grams*servings)} ${tr('gram')}</b> <small>(${e(language()==='en'?food.stateEn:food.state)})</small><small dir="ltr"> · NDB ${food.ndbId}</small></li>`}).join('')}</ul>`;
}
function addRecipeToDiary(id,servings,category){
 const recipe=byId[id],n=calculateNutrition(recipe,ingredients,servings);
 return globalThis.Mdaar.addCustom(textName(recipe),language()==='en'?'portion':'حصة',[n.kcal,n.p,n.c,n.f],1,category||recipe.category,`${servings} × ${textName(recipe)} · ${recipe.ingredients.map(part=>textName(ingredients[part.id])+': '+decimal(part.grams*servings)+' '+tr('gram')).join('، ')} · USDA SR28`);
}
function ingredientSelectors(base,version){
 return `<fieldset><legend>${language()==='en'?'Replace an ingredient at the same gram weight':'استبدل مكوّناً بالوزن نفسه'}</legend><p class="note">${language()==='en'?'Nutrition and allergens change. Favourite saves the original recipe; modified servings can be added to the diary.':'ستتغير المغذيات والحساسية. المفضلة تحفظ الأصل؛ يمكنك إضافة الوصفة المعدلة للدفتر.'}</p>${base.ingredients.map((part,index)=>{
  const food=ingredients[part.id];if(!food.alternatives.length)return '';
  return `<label>${e(textName(food))}<select data-nr-substitute="${index}">${[part.id,...food.alternatives].map(id=>`<option value="${id}" ${version.ingredients[index].id===id?'selected':''}>${e(textName(ingredients[id]))}</option>`).join('')}</select></label>`;
 }).join('')}</fieldset>`;
}
function recipeArtwork(recipe){
 const ids=new Set(recipe.ingredients.map(x=>x.id));
 const name=ids.has('bread')?'toast':ids.has('oats')?'bowl':(ids.has('yogurt')||ids.has('cottage'))&&!ids.has('rice')?'fruit':(ids.has('chicken')||ids.has('tuna')||ids.has('salmon')||ids.has('egg'))?'protein':'salad';
 return '/assets/food/'+name+'.svg';
}
function nutritionFacts(n){
 const labels=language()==='en'?['kcal','Protein · g','Carbs · g','Fat · g']:['سعرة','بروتين · جم','كارب · جم','دهون · جم'];
 return `<dl class="nutrition-facts">${['kcal','p','c','f'].map((key,i)=>`<div><dt>${e(labels[i])}</dt><dd>${e(decimal(n[key]))}</dd></div>`).join('')}</dl>`;
}
function card(baseRecipe){
 const recipe=recipeVersion(baseRecipe.id);
 const n=calculateNutrition(recipe,ingredients),saved=loadFavorites().includes(recipe.id);
 return `<article class="rc calculated-recipe" data-recipe-id="${recipe.id}">
 <div class="recipe-visual"><img src="${recipeArtwork(recipe)}" alt="${e(tr('illustration'))}" loading="lazy" decoding="async" width="800" height="480"><span class="recipe-goal">${tr(recipe.goal)}</span><span class="recipe-art-note">${language()==='en'?'Illustration':'رسم توضيحي'}</span></div>
 <div class="recipe-body"><div class="recipe-meta"><span>${recipe.minutes} ${language()==='en'?'min assembly':'دقيقة تجميع'}</span><span>${language()==='en'?'Source calculated':'محسوبة من المصدر'}</span></div><h3 class="recipe-title">${e(textName(recipe))}</h3>
 <p data-nr-modified class="note">${recipe.modified?(language()==='en'?'Modified ingredients; nutrition and allergens recalculated. Adjust preparation to the substitute.':'مكونات معدلة؛ أُعيد حساب المغذيات والحساسية. عدّل التحضير ليلائم البديل.'):''}</p>
 <div data-nr-totals>${nutritionFacts(n)}</div>
 <div class="recipe-tools"><label>${tr('servings')} <input data-nr-scale type="number" min="0.25" max="4" step="0.25" value="1"></label><button class="recipe-favorite mini g" type="button" data-nr-favorite aria-pressed="${saved}">${saved?tr('saved'):tr('favorite')}</button></div>
 <details class="recipe-detail"><summary>${tr('details')}</summary><div data-nr-ingredients>${servingDetails(recipe,1)}</div>${ingredientSelectors(baseRecipe,recipe)}<h4>${tr('steps')}</h4><ol>${(language()==='en'?recipe.stepsEn:recipe.steps).map(s=>`<li>${e(s)}</li>`).join('')}</ol><p data-nr-allergens><b>${tr('allergens')}:</b> ${recipe.allergens.map(a=>ALLERGENS[a]?.[language()==='en'?1:0]||a).join('، ') || tr('none')}</p><p class="note">${tr('warning')}</p><p class="note">${tr('review')} · ${tr('time')}</p></details>
 <button class="mini recipe-add" type="button" data-nr-add>${tr('add')} <span aria-hidden="true">＋</span></button><p class="note recipe-review">${tr('review')}</p><p data-nr-status class="note" aria-live="polite"></p></div></article>`;
}
function renderLibraryShell(){
 library.innerHTML=`<div class="card recipe-search-panel"><div class="library-heading"><div><p class="eyebrow" lang="en">FUEL YOUR EVERYDAY</p><h2>${tr('title')}</h2></div><span class="library-count">${recipes.length} <small>${language()==='en'?'meal ideas':'فكرة وجبة'}</small></span></div><p>${language()==='en'?'Find a meal for your day. Adjust the portion, change an ingredient, then save it to your diary.':'وجبتك المناسبة تبدأ من هنا. عدّل الحصة، استبدل مكوّناً، ثم أضفها إلى يومك.'}</p><div class="grid recipe-filter-grid"><label>${tr('search')}<input id="nr-query" type="search" maxlength="100" placeholder="${language()==='en'?'Chicken, oats, salad…':'دجاج، شوفان، سلطة…'}"></label><label>${tr('goal')}<select id="nr-goal"><option value="all">${tr('all')}</option><option value="cut">${tr('cut')}</option><option value="bulk">${tr('bulk')}</option></select></label><label>${language()==='en'?'Meal type':'نوع الوجبة'}<select id="nr-category"><option value="all">${language()==='en'?'All meals':'كل الوجبات'}</option>${['فطور','غداء','عشاء','سناك'].map((cat,i)=>`<option value="${cat}">${language()==='en'?['Breakfast','Lunch','Dinner','Snack'][i]:cat}</option>`).join('')}</select></label></div><details class="recipe-advanced-filters"><summary>${language()==='en'?'Calories & protein filters':'تصفية بالسعرات والبروتين'}</summary><div class="grid"><label>${tr('max')}<input id="nr-max-kcal" type="number" min="0" max="3000" step="50" placeholder="—"></label><label>${tr('protein')}<input id="nr-min-protein" type="number" min="0" max="200" placeholder="—"></label></div></details><div class="library-filter-footer"><label><input id="nr-favorites" type="checkbox"> ${tr('favorites')}</label><p id="nr-count" role="status"></p></div><details class="nutrition-source-details"><summary>${language()==='en'?'Nutrition source and review status':'مصدر القيم وحالة المراجعة'}</summary><p class="note">${tr('intro')}</p><p class="note"><a href="/data/nutrition-usda-sr28.json" target="_blank" rel="noopener">${tr('source')}</a></p><p class="note">${tr('cost')}</p></details></div><div id="nr-results" class="grid recipe-grid"></div><div class="gr recipe-pagination"><button id="nr-prev" class="mini g" type="button">${tr('previous')}</button><span id="nr-page" aria-live="polite"></span><button id="nr-next" class="mini g" type="button">${tr('next')}</button></div>`;
 renderRecipes();
}
function renderRecipes(){
 const list=filterRecipes(recipes,ingredients,{query:library.querySelector('#nr-query').value,goal:library.querySelector('#nr-goal').value,category:library.querySelector('#nr-category').value,maxKcal:+library.querySelector('#nr-max-kcal').value,minProtein:+library.querySelector('#nr-min-protein').value,favorites:library.querySelector('#nr-favorites').checked?loadFavorites():undefined});
 const pages=Math.max(1,Math.ceil(list.length/8));page=Math.min(page,pages-1);
 library.querySelector('#nr-results').innerHTML=list.slice(page*8,page*8+8).map(card).join('') || `<p class="msg">${tr('empty')}</p>`;
 notice(library.querySelector('#nr-count'),`${list.length} / ${recipes.length}`);
 library.querySelector('#nr-page').textContent=`${page+1} / ${pages}`;
 library.querySelector('#nr-prev').disabled=page===0;library.querySelector('#nr-next').disabled=page===pages-1;
}
function renderPlannerShell({reset=false}={}){
 const previous=!reset?[...planner.querySelectorAll('input,select')].map(input=>({id:input.id,value:input.value,name:input.name,checked:input.checked})):[];
 planner.innerHTML=`<div class="card"><h2>${tr('planner')}</h2><p>${tr('plannerIntro')}</p><p id="np-target-note" class="note">${tr('noTarget')}</p><div class="grid"><label>${tr('kcal')}<input id="np-kcal" type="number" min="1200" max="6000" step="1" required></label><label>${tr('p')}<input id="np-protein" type="number" min="0" max="1000"></label><label>${tr('c')}<input id="np-carbs" type="number" min="0" max="1000"></label><label>${tr('f')}<input id="np-fat" type="number" min="0" max="1000"></label><label>${tr('meals')}<select id="np-meals"><option>3</option><option selected>4</option><option>5</option></select></label><label>${tr('days')}<select id="np-days"><option value="1">${tr('day')}</option><option value="7">${tr('week')}</option></select></label><label>${tr('goal')}<select id="np-goal"><option value="all">${tr('all')}</option><option value="cut">${tr('cut')}</option><option value="bulk">${tr('bulk')}</option></select></label><label>${tr('minutes')}<input id="np-minutes" type="number" value="15" min="10" max="120"></label></div><label>${tr('exclude')}<input id="np-exclude" type="text" maxlength="400" placeholder="${language()==='en'?'tuna, tomato':'تونة، طماطم'}"></label><fieldset><legend>${tr('restrictions')}</legend><div class="gr">${Object.entries(ALLERGENS).map(([key,names])=>`<label><input name="np-allergen" type="checkbox" value="${key}"> ${e(names[language()==='en'?1:0])}</label>`).join('')}</div></fieldset><p class="note">${tr('warning')}</p><p class="note">${tr('cost')}</p><button id="np-generate" type="button" class="go">${tr('generate')}</button><p id="np-status" role="status" aria-live="polite"></p></div><div id="np-result"></div>`;
 for(const saved of previous){const input=saved.id?planner.querySelector('#'+saved.id):planner.querySelector(`[name="${saved.name}"][value="${saved.value}"]`);if(input){input.value=saved.value;if(input.type==='checkbox')input.checked=saved.checked;}}
 updateTargets();renderPlan();
}
function updateTargets(){
 const t=globalThis.Mdaar?.getTarget?.();
 if(!t)return;
 for(const [id,k] of [['np-kcal','kcal'],['np-protein','p'],['np-carbs','c'],['np-fat','f']]){const input=planner.querySelector('#'+id);if(!input.value)input.value=Math.round(t[k]||0);}
 planner.querySelector('#np-target-note').textContent=language()==='en'?'Targets copied from your calculator. Review and edit as needed.':'نُقلت الأهداف من الحاسبة. راجعها وعدّلها عند الحاجة.';
}
function renderPlan(){
 if(!currentPlan){planner.querySelector('#np-result').replaceChildren();return;}
 planner.querySelector('#np-result').innerHTML=`<p class="note">${tr('planNote')}</p>`+currentPlan.days.map((day,d)=>`<section class="card" style="margin-bottom:20px"><h3>${tr('dayNumber')} ${d+1}</h3><p>${macros(day.totals)}</p><p class="note">${tr('difference')}: ${decimal(day.totals.kcal-currentPlan.target.kcal)} ${tr('calorieUnit')}${['p','c','f'].filter(k=>currentPlan.target[k]!=null).map(k=>` · ${k.toUpperCase()} ${decimal(day.totals[k]-currentPlan.target[k])} ${tr('gram')}`).join('')}</p>${day.meals.map((meal,m)=>{const recipe=byId[meal.recipeId];return `<article class="aic" style="margin-bottom:12px" data-plan-meal="${d}:${m}"><h4>${e(textName(recipe))}</h4><p>${macros(meal.nutrition)}</p><label>${tr('servings')} <input data-np-scale="${d}:${m}" type="number" min="0.25" max="4" step="0.01" value="${meal.servings}" style="width:90px"></label><details><summary>${tr('ingredients')}</summary>${servingDetails(recipe,meal.servings)}</details><div class="gr"><button data-np-swap="${d}:${m}" class="mini g" type="button">${tr('swap')}</button><button data-np-add="${d}:${m}" class="mini" type="button">${tr('add')}</button></div></article>`}).join('')}</section>`).join('');
 globalThis.MdaarNutrition.currentPlan=currentPlan;
}
function preferences(){
 return {goal:planner.querySelector('#np-goal').value,maxMinutes:+planner.querySelector('#np-minutes').value,excluded:planner.querySelector('#np-exclude').value,allergens:[...planner.querySelectorAll('[name=np-allergen]:checked')].map(x=>x.value)};
}
function renderSuggestedMeals(){
 const box=document.querySelector('#mealbox'),target=globalThis.Mdaar?.getTarget?.();
 if(!target){
  suggestedPlan=null;suggestedSignature='';globalThis.MdaarNutrition.suggestedPlan=null;
  box.innerHTML=`<div class="card"><p class="msg">${language()==='en'?'Calculate your needs in the calculator to enable quick meal suggestions.':'احسب احتياجك من الحاسبة لتفعيل اقتراحات الوجبات السريعة.'}</p><button class="mini" type="button" data-suggested-calc>${language()==='en'?'Calculate my needs':'احسب احتياجي'}</button></div>`;return;
 }
 try{
  const constraints=preferences(),signature=JSON.stringify({target,constraints});
  if(!suggestedPlan || suggestedSignature!==signature){
   suggestedPlan=createPlan(recipes,ingredients,{target,meals:4,days:1,...constraints});suggestedSignature=signature;
  }
  const categories=language()==='en'?['Breakfast','Lunch','Dinner','Snack']:['فطور','غداء','عشاء','سناك'];
  box.innerHTML=`<h2>${language()==='en'?`Quick suggestions from ${recipes.length} meals`:`اقتراحات سريعة من ${recipes.length} وجبة`}</h2><p class="note">${language()==='en'?'Based on your calculator and the goal, time and exclusions above. Swaps explore available meals before repeating.':'حسب الحاسبة وتصفية الهدف والوقت والاستبعادات أعلاه. التبديل يستعرض البدائل المناسبة قبل تكرارها.'}</p><div class="grid">${suggestedPlan.days[0].meals.map((meal,m)=>{
   const recipe=byId[meal.recipeId];
   return `<article class="card" data-suggested-meal="${m}" data-recipe-id="${recipe.id}" style="text-align:start"><div class="grp" style="margin-top:0"><span>${categories[m]}</span><b>${decimal(meal.nutrition.kcal)} ${tr('calorieUnit')}</b></div><h3>${e(textName(recipe))}</h3><p>${macros(meal.nutrition)}</p><details><summary>${tr('details')}</summary>${servingDetails(recipe,meal.servings)}<ol>${(language()==='en'?recipe.stepsEn:recipe.steps).map(step=>`<li>${e(step)}</li>`).join('')}</ol></details><div class="gr" style="margin-top:12px"><button class="mini" type="button" data-ad="${meal.category}">${tr('add')}</button><button class="mini g" type="button" data-ch="${meal.category}">${tr('swap')}</button></div></article>`;
  }).join('')}</div><p>${macros(suggestedPlan.days[0].totals)}</p><p class="note">${tr('difference')}: ${decimal(suggestedPlan.days[0].totals.kcal-target.kcal)} ${tr('calorieUnit')}${['p','c','f'].filter(k=>target[k]!=null).map(k=>` · ${k.toUpperCase()} ${decimal(suggestedPlan.days[0].totals[k]-target[k])} ${tr('gram')}`).join('')}</p><p id="suggested-status" role="status" aria-live="polite"></p>`;
  globalThis.MdaarNutrition.suggestedPlan=suggestedPlan;
 }catch{
  suggestedPlan=null;suggestedSignature='';globalThis.MdaarNutrition.suggestedPlan=null;
  box.innerHTML=`<div class="card"><p role="status">${tr('planError')}</p></div>`;
 }
}
async function init(){
 const recTab=document.querySelector('#t-rec'),mealTab=document.querySelector('#t-meals');if(!recTab||!mealTab)return;
 library=document.createElement('section');library.id='recipe-library';recTab.insertBefore(library,recTab.querySelector('#recipe-request'));notice(library,tr('loading'));
 try{
  const [a,b]=await Promise.all([fetch('/data/nutrition-usda-sr28.json'),fetch('/data/recipes-calculated.json')]);if(!a.ok||!b.ok)throw Error('Data unavailable');
  ingredients=(await a.json()).ingredients;recipes=(await b.json()).recipes;byId=Object.fromEntries(recipes.map(r=>[r.id,r]));
  planner=document.createElement('section');planner.id='nutrition-planner';mealTab.prepend(planner);
  globalThis.MdaarNutrition={currentPlan:null,suggestedPlan:null,recipes,ingredients,renderSuggestedMeals,searchRecipes:query=>filterRecipes(recipes,ingredients,{query}),addRecipeToDiary,createPlan:(o)=>createPlan(recipes,ingredients,o)};
  renderLibraryShell();renderPlannerShell();renderSuggestedMeals();
  globalThis.Mdaar.refresh();
  document.querySelector('#mealbox').addEventListener('click',event=>{
   if(event.target.closest('[data-suggested-calc]')){globalThis.Mdaar.show('calc');document.querySelector('#age')?.focus();return;}
   const button=event.target.closest('[data-ch],[data-ad]');if(!button||!suggestedPlan)return;
   const category=button.dataset.ch||button.dataset.ad,m=suggestedPlan.days[0].meals.findIndex(meal=>meal.category===category);
   if(button.hasAttribute('data-ch')){
    try{suggestedPlan=swapMeal(suggestedPlan,0,m,recipes,ingredients);renderSuggestedMeals();document.querySelector(`#mealbox [data-ch="${category}"]`)?.focus({preventScroll:true});}
    catch{notice(document.querySelector('#suggested-status'),tr('swapError'));}
   }else{
    const meal=suggestedPlan.days[0].meals[m],recipe=byId[meal.recipeId],n=meal.nutrition;
    const saved=globalThis.Mdaar.addCustom(textName(recipe),language()==='en'?'portion':'حصة',[n.kcal,n.p,n.c,n.f],1,meal.category,`${meal.servings} × ${textName(recipe)} · ${recipe.ingredients.map(part=>textName(ingredients[part.id])+': '+decimal(part.grams*meal.servings)+' '+tr('gram')).join('، ')} · USDA SR28`);
    if(saved===false)notice(document.querySelector('#suggested-status'),tr('storageError'));else button.textContent=tr('added');
   }
  });
  library.addEventListener('input',event=>{
   if(event.target.matches('[data-nr-scale]')){
    const input=event.target,article=input.closest('[data-recipe-id]');const recipe=recipeVersion(article.dataset.recipeId);
    const servings=+input.value;
    if(!Number.isFinite(servings)||servings<0.25||servings>4){input.setCustomValidity(language()==='en'?'Choose 0.25–4 servings':'اختر من ربع حصة إلى 4 حصص');return;}
    input.setCustomValidity('');article.querySelector('[data-nr-totals]').innerHTML=nutritionFacts(calculateNutrition(recipe,ingredients,servings));article.querySelector('[data-nr-ingredients]').innerHTML=servingDetails(recipe,servings);
   }else if(event.target.closest('.card') && ['nr-query','nr-goal','nr-category','nr-max-kcal','nr-min-protein','nr-favorites'].includes(event.target.id)){page=0;renderRecipes();}
  });
  library.addEventListener('change',event=>{
   const input=event.target;if(!input.matches('[data-nr-substitute]'))return;
   const article=input.closest('[data-recipe-id]'),id=article.dataset.recipeId;
   const replacements={...(replacementsByRecipe.get(id)||{}),[input.dataset.nrSubstitute]:input.value};
   const version=substituteIngredients(byId[id],replacements,ingredients);replacementsByRecipe.set(id,replacements);
   const scale=Number(article.querySelector('[data-nr-scale]').value);
   if(!Number.isFinite(scale)||scale<0.25||scale>4)return;
   article.querySelector('[data-nr-totals]').innerHTML=nutritionFacts(calculateNutrition(version,ingredients,scale));
   article.querySelector('[data-nr-ingredients]').innerHTML=servingDetails(version,scale);
   article.querySelector('[data-nr-allergens]').textContent=tr('allergens')+': '+(version.allergens.map(a=>ALLERGENS[a]?.[language()==='en'?1:0]||a).join('، ')||tr('none'));
   article.querySelector('[data-nr-modified]').textContent=version.modified?(language()==='en'?'Modified ingredients; nutrition and allergens recalculated. Adjust preparation to the substitute.':'مكونات معدلة؛ أُعيد حساب المغذيات والحساسية. عدّل التحضير ليلائم البديل.'):'';
  });
  library.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.id==='nr-prev'){page--;renderRecipes();return;}if(button.id==='nr-next'){page++;renderRecipes();return;}
   const article=button.closest('[data-recipe-id]');if(!article)return;const recipe=recipeVersion(article.dataset.recipeId);
   if(button.hasAttribute('data-nr-favorite')){
    const favs=loadFavorites();const set=new Set(favs);set.has(recipe.id)?set.delete(recipe.id):set.add(recipe.id);
    try{if(globalThis.Mdaar.save('mdaar_recipe_favorites',[...set])===false)throw Error('Storage failed');if(JSON.stringify(loadFavorites())!==JSON.stringify([...set]))throw Error('Storage failed');button.setAttribute('aria-pressed',set.has(recipe.id));button.textContent=set.has(recipe.id)?tr('saved'):tr('favorite');if(library.querySelector('#nr-favorites').checked)renderRecipes();}catch{notice(article.querySelector('[data-nr-status]'),tr('favoritesError'));}
   }
   if(button.hasAttribute('data-nr-add')){
    const input=article.querySelector('[data-nr-scale]');if(!input.checkValidity())return input.reportValidity();
    const n=calculateNutrition(recipe,ingredients,+input.value),meal=['فطور','غداء','عشاء'].includes(recipe.category)?recipe.category:'سناك';
    const saved=globalThis.Mdaar.addCustom(textName(recipe)+(recipe.modified?(language()==='en'?' (modified)':' (معدلة)'):''),language()==='en'?'portion':'حصة',[n.kcal,n.p,n.c,n.f],1,meal,`${input.value} × ${textName(recipe)} · ${recipe.ingredients.map(part=>textName(ingredients[part.id])+': '+decimal(part.grams*Number(input.value))+' '+tr('gram')).join('، ')} · USDA SR28`);
    notice(article.querySelector('[data-nr-status]'),tr(saved===false?'storageError':'added'));
   }
  });
  planner.addEventListener('change',event=>{
   const input=event.target;
   if(input.matches('#np-goal,#np-minutes,#np-exclude,[name=np-allergen]'))renderSuggestedMeals();
   if(!input.matches('[data-np-scale]'))return;
   const servings=Number(input.value);if(!Number.isFinite(servings)||servings<0.25||servings>4){input.setCustomValidity(language()==='en'?'Choose 0.25–4 servings':'اختر من ربع حصة إلى 4 حصص');input.reportValidity();return;}
   input.setCustomValidity('');const[d,m]=input.dataset.npScale.split(':').map(Number),meal=currentPlan.days[d].meals[m];meal.servings=servings;meal.nutrition=calculateNutrition(byId[meal.recipeId],ingredients,servings);meal.swapTarget={...meal.nutrition};currentPlan.days[d].totals=sumMeals(currentPlan.days[d].meals);renderPlan();
  });
  planner.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.id==='np-generate'){
    try{
     const macro=id=>{const s=planner.querySelector('#'+id).value;return s===''?undefined:Number(s);};
     const target={kcal:Number(planner.querySelector('#np-kcal').value),p:macro('np-protein'),c:macro('np-carbs'),f:macro('np-fat')};
     currentPlan=createPlan(recipes,ingredients,{target,meals:+planner.querySelector('#np-meals').value,days:+planner.querySelector('#np-days').value,...preferences()});
     notice(planner.querySelector('#np-status'),'');renderPlan();renderSuggestedMeals();
    }catch{notice(planner.querySelector('#np-status'),tr('planError'));}
   }
   if(button.hasAttribute('data-np-swap')){try{const slot=button.dataset.npSwap,[d,m]=slot.split(':').map(Number);currentPlan=swapMeal(currentPlan,d,m,recipes,ingredients);notice(planner.querySelector('#np-status'),'');renderPlan();planner.querySelector(`[data-np-swap="${slot}"]`)?.focus({preventScroll:true});}catch{notice(planner.querySelector('#np-status'),tr('swapError'));}}
   if(button.hasAttribute('data-np-add')){
    const[d,m]=button.dataset.npAdd.split(':').map(Number),meal=currentPlan.days[d].meals[m],recipe=byId[meal.recipeId],n=meal.nutrition;
    const saved=globalThis.Mdaar.addCustom(textName(recipe),language()==='en'?'portion':'حصة',[n.kcal,n.p,n.c,n.f],1,meal.category,`${meal.servings} × ${textName(recipe)} · USDA SR28`);
    if(saved===false)notice(planner.querySelector('#np-status'),tr('storageError'));else button.textContent=tr('added');
   }
  });
  window.addEventListener('mdaar:change',event=>{if(event.detail?.key==='all'){currentPlan=null;suggestedPlan=null;suggestedSignature='';replacementsByRecipe.clear();globalThis.MdaarNutrition.currentPlan=null;renderLibraryShell();renderPlannerShell({reset:true});renderSuggestedMeals();}else{updateTargets();if(event.detail?.key==='mdaar_t')renderSuggestedMeals();}});
  window.addEventListener('mdaar:language',()=>{renderLibraryShell();renderPlannerShell();renderSuggestedMeals();globalThis.Mdaar.refresh();});
 }catch(error){notice(library,tr('loadError'));notice(document.querySelector('#mealbox'),tr('loadError'));console.error('Calculated recipe catalogue unavailable.');}
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
