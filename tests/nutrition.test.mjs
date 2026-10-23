import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateNutrition,substituteIngredients,filterRecipes,createPlan,swapMeal,sumMeals} from '../public/assets/nutrition.mjs';
const source=JSON.parse(readFileSync(new URL('../public/data/nutrition-usda-sr28.json',import.meta.url))), ingredients=source.ingredients;
const recipes=JSON.parse(readFileSync(new URL('../public/data/recipes-calculated.json',import.meta.url))).recipes;
const options={target:{kcal:2200,p:150,c:250,f:70},meals:4,days:7,goal:'all',allergens:[],excluded:'',maxMinutes:15};
test('500 uniquely identified and named meals with distinct ingredients and 250 per goal',()=>{
 assert.equal(recipes.length,500);
 assert.equal(new Set(recipes.map(r=>r.id)).size,500);
 assert.equal(new Set(recipes.map(r=>r.name)).size,500);
 assert.equal(new Set(recipes.map(r=>r.ingredients.map(x=>x.id).sort().join(','))).size,500);
 for(const goal of ['cut','bulk']){
  assert.equal(recipes.filter(r=>r.goal===goal).length,250);
  for(const [category,count] of [['فطور',50],['غداء',75],['عشاء',75],['سناك',50]])assert.equal(recipes.filter(r=>r.goal===goal&&r.category===category).length,count);
  for(let i=1;i<=50;i++)assert.ok(recipes.some(r=>r.id===`${goal}-${String(i).padStart(2,'0')}`),'original IDs retained');
 }
});
test('36 USDA SR28 ingredient records have exact reference IDs and bounded per100g values',()=>{
 assert.equal(Object.keys(ingredients).length,36);assert.match(source.source.mirrorIntegrity,/^sha512-/);assert.match(source.source.abbrevSha256,/^[a-f0-9]{64}$/);
 for(const food of Object.values(ingredients)){assert.match(food.ndbId,/^\d{5}$/);assert.ok(food.sourceDescription);assert.ok(food.nameEn);assert.ok(food.stateEn);for(const value of Object.values(food.per100g))assert.ok(Number.isFinite(value)&&value>=0);}
 assert.deepEqual(ingredients.chicken.per100g,{kcal:165,p:31.02,f:3.57,c:0,fiber:0});
});
test('published nutrition recomputes from grams within 0.005 rounding tolerance',()=>{
 for(const recipe of recipes){const actual=calculateNutrition(recipe,ingredients);for(const key of Object.keys(actual))assert.ok(Math.abs(actual[key]-recipe.nutrition[key])<=0.005001,recipe.id+':'+key);assert.equal(recipe.reviewStatus,'calculated-pending-professional-review');assert.equal(recipe.cost,null);assert.equal(recipe.stepsEn.length,recipe.steps.length);for(const step of recipe.stepsEn){assert.ok(step.length>20);assert.ok(!/[\u0600-\u06ff]/.test(step));}assert.equal(recipe.difficultyEn,'Easy');assert.ok(recipe.timeNoteEn);}
});
test('servings scale all nutrients linearly and reject invalid values',()=>{
 const a=calculateNutrition(recipes[0],ingredients,1),b=calculateNutrition(recipes[0],ingredients,2.5);for(const k of Object.keys(a))assert.ok(Math.abs(b[k]-a[k]*2.5)<1e-8);
 for(const n of [0,-1,NaN,Infinity,'2'])assert.throws(()=>calculateNutrition(recipes[0],ingredients,n));
 assert.throws(()=>calculateNutrition({ingredients:[{id:'unknown',grams:10}]},ingredients));
});
test('filters search bilingual names, goals, calories and protein',()=>{
 assert.ok(filterRecipes(recipes,ingredients,{query:'دجاج'}).length>0);assert.ok(filterRecipes(recipes,ingredients,{query:'chicken'}).length>0);
 const cut=filterRecipes(recipes,ingredients,{goal:'cut',maxKcal:500,minProtein:20});assert.ok(cut.length>0);for(const r of cut){const n=calculateNutrition(r,ingredients);assert.equal(r.goal,'cut');assert.ok(n.kcal<=500&&n.p>=20);}
 const breakfasts=filterRecipes(recipes,ingredients,{category:'فطور',goal:'bulk'});assert.equal(breakfasts.length,50);assert.ok(breakfasts.every(r=>r.category==='فطور'&&r.goal==='bulk'));
});
test('allergen and ingredient exclusions apply across English and Arabic',()=>{
 const list=filterRecipes(recipes,ingredients,{allergens:['milk','fish','peanut'],excluded:'دجاج, egg'});assert.ok(list.length>0);
 for(const r of list){assert.ok(!r.allergens.some(a=>['milk','fish','peanut'].includes(a)));assert.ok(!r.ingredients.some(x=>['chicken','egg'].includes(x.id)));}
 assert.deepEqual(filterRecipes(recipes,ingredients,{favorites:[]}),[]);
 assert.deepEqual(filterRecipes(recipes,ingredients,{favorites:['cut-01']}).map(r=>r.id),['cut-01']);
});
test('weekly plan has seven days, four distinct meals, truthful totals and practical portions',()=>{
 const plan=createPlan(recipes,ingredients,options);assert.equal(plan.days.length,7);
 for(const day of plan.days){assert.equal(day.meals.length,4);assert.equal(new Set(day.meals.map(m=>m.recipeId)).size,4);assert.deepEqual(day.totals,sumMeals(day.meals));assert.ok(Math.abs(day.totals.kcal-2200)<25);for(const meal of day.meals){assert.ok(meal.servings>=0.5&&meal.servings<=3);assert.deepEqual(meal.nutrition,calculateNutrition(recipes.find(r=>r.id===meal.recipeId),ingredients,meal.servings));}}
 assert.deepEqual(options.target,{kcal:2200,p:150,c:250,f:70});
});
test('planner restrictions survive generation and swapping; original plan remains unchanged',()=>{
 const plan=createPlan(recipes,ingredients,{...options,days:1,allergens:['milk','fish'],excluded:'فول سوداني'});
 const before=structuredClone(plan),next=swapMeal(plan,0,0,recipes,ingredients);assert.deepEqual(plan,before);assert.notEqual(next.days[0].meals[0].recipeId,plan.days[0].meals[0].recipeId);
 for(const meal of next.days[0].meals){const recipe=recipes.find(r=>r.id===meal.recipeId);assert.ok(!recipe.allergens.some(a=>['milk','fish'].includes(a)));assert.ok(!recipe.ingredients.some(i=>i.id==='peanut'));}
 assert.deepEqual(next.days[0].totals,sumMeals(next.days[0].meals));assert.ok(Math.abs(next.days[0].meals[0].nutrition.kcal-plan.days[0].meals[0].nutrition.kcal)<15);
});
test('unsupported targets, meal counts and impossible restrictions fail rather than ignoring restrictions',()=>{
 for(const kcal of [0,1000,7000,NaN,Infinity])assert.throws(()=>createPlan(recipes,ingredients,{...options,target:{kcal}}));
 assert.throws(()=>createPlan(recipes,ingredients,{...options,meals:2}));assert.throws(()=>createPlan(recipes,ingredients,{...options,days:2}));assert.throws(()=>createPlan(recipes,ingredients,{...options,maxMinutes:1}));
 assert.throws(()=>createPlan(recipes,ingredients,{...options,excluded:Object.values(ingredients).map(x=>x.nameEn).join(',')}));
});

test('successive swaps explore unseen meals, preserve restrictions and keep a fixed calorie anchor',()=>{
 for(const [count,constraints] of [[50,{}],[20,{allergens:['milk','fish'],excluded:'فول سوداني'}]]){
 let plan=createPlan(recipes,ingredients,{...options,days:1,...constraints});
 const anchor=plan.days[0].meals[0].nutrition.kcal,seen=new Set([plan.days[0].meals[0].recipeId]);
 for(let i=0;i<count;i++){
  plan=swapMeal(plan,0,0,recipes,ingredients);
  const meal=plan.days[0].meals[0],recipe=recipes.find(r=>r.id===meal.recipeId);
  assert.ok(!seen.has(recipe.id),`repeat at swap ${i+1}`);seen.add(recipe.id);
  if(constraints.allergens)assert.ok(!recipe.allergens.some(a=>['milk','fish','peanut'].includes(a)));
  assert.equal(recipe.category,'فطور');assert.ok(meal.servings>=0.5&&meal.servings<=3);
  assert.ok(Math.abs(meal.nutrition.kcal-anchor)<6,'no accumulated rounding drift');
  assert.deepEqual(plan.days[0].totals,sumMeals(plan.days[0].meals));
  plan=JSON.parse(JSON.stringify(plan));
 }
 assert.equal(seen.size,count+1);
 }
});

test('a restricted three-meal pool exhausts its choices before starting a new cycle',()=>{
 const pool=recipes.filter(r=>['cut-01','cut-02','cut-03'].includes(r.id)),first=pool[0];
 let plan={constraints:{},days:[{meals:[{recipeId:first.id,category:first.category,servings:1,nutrition:calculateNutrition(first,ingredients)}]}]};
 let seen=new Set([first.id]);
 for(let i=0;i<12;i++){
  const previous=plan.days[0].meals[0].recipeId;
  plan=swapMeal(plan,0,0,pool,ingredients);const id=plan.days[0].meals[0].recipeId;
  assert.notEqual(id,previous);
  if(seen.size===3)seen=new Set([previous]);
  assert.ok(!seen.has(id));seen.add(id);
 }
 assert.throws(()=>swapMeal(plan,0,0,pool.filter(r=>r.id===plan.days[0].meals[0].recipeId),ingredients));
});

test('swapping one of two daily snacks never duplicates the other snack',()=>{
 let plan=createPlan(recipes,ingredients,{...options,days:1,meals:5});
 for(let i=0;i<30;i++){
  plan=swapMeal(plan,0,3,recipes,ingredients);
  assert.equal(new Set(plan.days[0].meals.map(m=>m.recipeId)).size,5);
 }
});

test('manual serving changes can establish a new fixed swap target without clearing history',()=>{
 let plan=createPlan(recipes,ingredients,{...options,days:1});plan=swapMeal(plan,0,0,recipes,ingredients);
 const meal=plan.days[0].meals[0],previous=meal.recipeId;
 meal.servings=1.25;meal.nutrition=calculateNutrition(recipes.find(r=>r.id===previous),ingredients,1.25);meal.swapTarget={...meal.nutrition};
 const anchor=meal.nutrition.kcal;
 for(let i=0;i<20;i++){
  plan=swapMeal(plan,0,0,recipes,ingredients);
  assert.ok(Math.abs(plan.days[0].meals[0].nutrition.kcal-anchor)<6);
  assert.notEqual(plan.days[0].meals[0].recipeId,previous);
 }
});
test('three and five meal day plans complete and do not silently invent nutrient targets',()=>{
 for(const meals of [3,5]){const plan=createPlan(recipes,ingredients,{...options,days:1,meals,target:{kcal:2000}});assert.equal(plan.days[0].meals.length,meals);assert.ok(Math.abs(plan.days[0].totals.kcal-2000)<25);assert.equal(plan.target.p,undefined);}
});

test('ingredient substitutions recalculate nutrients and allergens without changing the source',()=>{
 const recipe=recipes.find(r=>r.id==='cut-11'),before=structuredClone(recipe);
 assert.equal(recipe.ingredients[0].id,'chicken');
 const updated=substituteIngredients(recipe,{'0':'salmon'},ingredients);
 assert.deepEqual(recipe,before);assert.equal(updated.ingredients[0].id,'salmon');assert.equal(updated.ingredients[0].grams,recipe.ingredients[0].grams);
 assert.equal(updated.modified,true);assert.ok(updated.allergens.includes('fish'));assert.ok(!recipe.allergens.includes('fish'));
 assert.deepEqual(updated.nutrition,calculateNutrition(updated,ingredients));assert.notEqual(updated.nutrition.kcal,calculateNutrition(recipe,ingredients).kcal);
 assert.equal(substituteIngredients(recipe,{'0':'chicken'},ingredients).modified,false);
 for(const replacements of [{'0':'unknown'},{'0':'milk'},{'100':'salmon'},{'0.5':'salmon'},null,[]])assert.throws(()=>substituteIngredients(recipe,replacements,ingredients));
});
