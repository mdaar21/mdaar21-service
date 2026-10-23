import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSet,programmeDay,dayDistance,validDay,diarySummary,exerciseHistory,adherence,cleanState} from '../public/assets/training.mjs';
const data=JSON.parse(await readFile(new URL('../public/data/training-programs.json',import.meta.url)));
test('programs transcribe actual visible source pages without stale hidden layer exercises',()=>{
 assert.equal(data.programs['4'].days.filter(x=>!x.rest).length,4);
 assert.equal(data.programs['5'].days.filter(x=>!x.rest).length,5);
 assert.deepEqual(data.programs['5'].days[0].exercises,['chest-press','incline-press','butterfly','shoulder-press','lateral-raise','overhead-triceps','triceps-pushdown']);
 assert.equal(data.programs['5'].days[0].sourcePage,9);
 assert.deepEqual(data.programs['4'].days[0].exercises,data.programs['4'].days[3].exercises);
 assert.deepEqual(data.programs['4'].days[1].exercises,data.programs['4'].days[4].exercises);
 for(const p of Object.values(data.programs)) for(const d of p.days) for(const id of d.exercises) assert.ok(data.exercises[id]);
 assert.deepEqual(data.exercises.plank.seconds,[45,60,90]);
 assert.ok(Object.values(data.exercises).every(x=>x.video===null));
});
test('set validation accepts Arabic numerals, zero load and timed sets',()=>{
 assert.deepEqual(validateSet({weight:'٢٠٫٥',reps:'١٢',rir:'٢'}),{weight:20.5,reps:12,rir:2,seconds:0});
 assert.deepEqual(validateSet({weight:0,seconds:45,rir:3},true),{weight:0,reps:0,rir:3,seconds:45});
 for(const changes of [{weight:-1},{weight:'Infinity'},{weight:''},{reps:0},{reps:1.5},{rir:''},{rir:11}])assert.throws(()=>validateSet({weight:20,reps:10,rir:2,...changes}),RangeError);
 assert.throws(()=>validateSet({weight:0,rir:2,seconds:601},true),RangeError);
});
test('calendar scheduling uses real day intervals across months',()=>{
 assert.equal(programmeDay('2026-10-20','2026-10-27'),0);
 assert.equal(programmeDay('2026-10-20','2026-10-19'),6);
 assert.equal(dayDistance('2026-10-31','2026-11-02'),2);
 assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2026-13-01'),false);
 assert.throws(()=>dayDistance('bad','2026-01-01'),RangeError);
});
test('food averages use logged days and never count missing days as zero',()=>{
 const s=diarySummary({'2026-10-19':[{k:1200,p:90,c:120,f:35}],'2026-10-20':[{k:1800,p:110,c:200,f:50},{k:NaN,p:10,c:1,f:1}]},'2026-10-20');
 assert.equal(s.loggedDays,2);assert.equal(s.averageKcal,1500);assert.equal(s.averageProtein,100);
 assert.equal(s.rows.filter(x=>!x.logged).length,5);
 assert.equal(diarySummary({},'2026-10-20').averageKcal,null);
});
const base={date:'2026-10-20',program:'4',dayIndex:0,exercise:'chest-press',setIndex:0,variant:'Chest Press',weight:40,reps:10,rir:2,seconds:0};
test('history preserves different variants and sums actual set load',()=>{
 const h=exerciseHistory([base,{...base,setIndex:1,weight:45,reps:8},{...base,variant:'Bench Press',weight:20}], 'chest-press');
 assert.equal(h.length,2);assert.equal(h[0].volume,760);assert.equal(h[0].maxWeight,45);assert.equal(h[1].variant,'Bench Press');
});
test('adherence distinguishes no logs, partial and full prescribed sessions',()=>{
 const state={program:'4',startDate:'2026-10-20',logs:[]};
 assert.deepEqual(adherence(data,state,'2026-10-20'),{scheduled:1,completed:0,partial:0});
 state.logs=[base];assert.deepEqual(adherence(data,state,'2026-10-20'),{scheduled:1,completed:0,partial:1});
 state.logs=data.programs['4'].days[0].exercises.flatMap(exercise=>[0,1,2].map(setIndex=>({...base,exercise,setIndex})));
 assert.deepEqual(adherence(data,state,'2026-10-20'),{scheduled:1,completed:1,partial:0});
 assert.equal(adherence(data,state,'2026-10-22').scheduled,2);
});
test('untrusted persisted logs and measurements are validated without mutating originals',()=>{
 const raw={program:'5',startDate:'<script>',logs:[base,{...base,reps:-1},{...base,date:'2026-02-30'},{...base,exercise:'xss'}],measurements:[{date:'2026-10-20',waist:80},{date:'bad',waist:90}]};
 const state=cleanState(raw,data,'2026-10-20');assert.equal(state.startDate,'2026-10-20');assert.equal(state.logs.length,1);assert.equal(state.measurements.length,1);assert.equal(raw.logs.length,4);
});
test('all exercise images match exact original visible source cards and native dimensions',async()=>{
 const {createHash}=await import('node:crypto');
 const manifest=JSON.parse(await readFile(new URL('../docs/book/figures/manifest.json',import.meta.url)));
 assert.equal(Object.keys(data.exercises).length,27);
 for(const ex of Object.values(data.exercises)){
  const image=ex.image,source=manifest.exercises[ex.id];
  assert.equal(source.primaryTitle,ex.en);assert.equal(image.sourcePage,source.sourcePage);
  assert.match(image.src,/^\/assets\/exercises\/[a-z0-9-]+\.png$/);
  const bytes=await readFile(new URL('../public'+image.src,import.meta.url));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),image.width);assert.equal(bytes.readUInt32BE(20),image.height);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
  assert.equal(image.sha256,source.sha256);
 }
});
