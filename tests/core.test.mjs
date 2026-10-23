import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateTarget,parseNumber,safeDiary,safeWeights,safeTarget} from '../public/assets/core.mjs';
const sample={male:true,age:30,w:80,h:180,act:1.55,goal:1};
test('Mifflin-St Jeor reference male and female values',()=>{
 const male=calculateTarget(sample),female=calculateTarget({...sample,male:false});
 assert.equal(male.bmr,1780);assert.equal(female.bmr,1614);
 assert.equal(male.tdee,2759);assert.equal(male.kcal,2759);
});
test('Arabic and Persian digits, decimals and strict malformed-number rejection',()=>{
 assert.equal(parseNumber(' ٧٥٫٥ '),75.5);assert.equal(parseNumber('۸۰,۵'),80.5);
 assert.equal(parseNumber('-5'),-5);
 for(const value of ['','abc75','75kg','1..3','Infinity','NaN','1e4','12/2'])assert.ok(Number.isNaN(parseNumber(value)),value);
});
test('reject minors, noninteger age, infinities, negatives and forged options',()=>{
 for(const change of [{age:17},{age:25.5},{age:NaN},{w:Infinity},{w:-75},{h:0},{h:231},{act:99},{goal:0},{male:'yes'}]) assert.throws(()=>calculateTarget({...sample,...change}),RangeError);
});
test('macro energy exactly matches calories across boundary population and all goals',()=>{
 for(const male of [true,false])for(const age of [18,45,90])for(const w of [35,75,250])for(const h of [120,175,230])for(const act of [1.2,1.375,1.55,1.725,1.9])for(const goal of [.8,1,1.1]){
  const t=calculateTarget({male,age,w,h,act,goal});
  assert.ok(t.p>=0&&t.c>=0&&t.f>=0);assert.ok(Math.abs(4*t.p+4*t.c+9*t.f-t.kcal)<1e-8);
  assert.ok(t.kcal>0&&Number.isFinite(t.kcal));assert.ok(t.p*4<=t.kcal*.35+1e-9);
 }
});
test('corrupt stored records do not crash totals, while valid names remain available to safe rendering',()=>{
 const valid={n:'<img src=x onerror=alert(1)>',u:'جم',m:'فطور',q:100,k:200,p:10,c:20,f:8};
 const data=safeDiary({'2026-10-20':[valid,{...valid,k:null},{...valid,q:0},{...valid,p:'10'}],'not-a-date':[valid]});
 assert.equal(data['2026-10-20'].length,1);assert.equal(data['2026-10-20'][0].n,valid.n);assert.deepEqual(data['2026-10-20'][0].b,[2,.1,.2,.08]);
 assert.deepEqual(safeDiary([]),{});assert.deepEqual(safeDiary(null),{});
 assert.deepEqual(safeWeights([{d:'<b>',w:70},{d:'2026-10-20',w:'70'},{d:'2026-10-20',w:70}]),[{d:'2026-10-20',w:70}]);
 assert.equal(safeTarget({kcal:'2000',p:150,c:220,f:65,w:75}),null);
});
test('stored targets must have finite bounds and calories consistent with their macros',()=>{
 const target=calculateTarget(sample);
 assert.equal(safeTarget(target),target);
 assert.equal(safeTarget({...target,p:900}),null);
 assert.equal(safeTarget({...target,w:0}),null);
 assert.equal(safeTarget({...target,kcal:Infinity}),null);
});
test('subnormal quantities and nonfinite derived densities are rejected from saved diary views',()=>{
 const base={n:'food',u:'g',m:'فطور',q:100,k:200,p:10,c:20,f:8};
 const rows=[base,{...base,q:Number.MIN_VALUE},{...base,q:.0001},{...base,q:.001,k:100000}];
 const data=safeDiary({'2026-10-20':rows});
 assert.equal(data['2026-10-20'].length,1);
 assert.ok(data['2026-10-20'][0].b.every(Number.isFinite));
});
