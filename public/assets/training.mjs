// Original PDF training programmes, browser-local logs and transparent summaries.
export const TRAINING_KEY = 'mdaar_training_v1';
export const REST_KEY = 'mdaar_rest_deadline';
const n = value => value == null || String(value).trim() === '' ? NaN : Number(String(value).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/٫/g,'.'));
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function dayDistance(from, to) {
  if (!validDay(from) || !validDay(to)) throw new RangeError('Invalid calendar date');
  return Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
}
export function programmeDay(start, date) { return ((dayDistance(start,date)%7)+7)%7; }
export function validateSet(input, timed = false) {
  const weight = n(input.weight), reps = n(input.reps), rir = n(input.rir), seconds = n(input.seconds);
  if (!Number.isFinite(weight) || weight < 0 || weight > 500) throw new RangeError('الوزن من 0 إلى 500 كجم.');
  if (!Number.isFinite(rir) || !Number.isInteger(rir) || rir < 0 || rir > 10) throw new RangeError('RIR عدد صحيح من 0 إلى 10.');
  if (timed) {
    if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds < 1 || seconds > 600) throw new RangeError('المدة من 1 إلى 600 ثانية.');
    return {weight, reps:0, rir, seconds};
  }
  if (!Number.isFinite(reps) || !Number.isInteger(reps) || reps < 1 || reps > 100) throw new RangeError('التكرارات عدد صحيح من 1 إلى 100.');
  return {weight,reps,rir,seconds:0};
}
export function diarySummary(diary, end = dayKey(), days = 7) {
  const rows = [];
  for (let ago = days-1; ago >= 0; ago--) {
    const date = new Date(`${end}T12:00:00Z`); date.setUTCDate(date.getUTCDate()-ago);
    const key = date.toISOString().slice(0,10);
    const raw = Array.isArray(diary?.[key]) ? diary[key] : [];
    const entries = raw.filter(x => x && ['k','p','c','f'].every(k=>Number.isFinite(x[k])&&x[k]>=0));
    rows.push({date:key,logged:entries.length>0,kcal:entries.reduce((s,x)=>s+x.k,0),protein:entries.reduce((s,x)=>s+x.p,0)});
  }
  const logged = rows.filter(r=>r.logged);
  return {rows,loggedDays:logged.length,averageKcal:logged.length?logged.reduce((s,r)=>s+r.kcal,0)/logged.length:null,averageProtein:logged.length?logged.reduce((s,r)=>s+r.protein,0)/logged.length:null};
}
export function exerciseHistory(logs, exercise) {
  const grouped = new Map();
  for (const log of logs.filter(x=>x.exercise===exercise)) {
    const key = `${log.date}|${log.variant}`;
    const current = grouped.get(key) || {date:log.date,variant:log.variant,sets:0,volume:0,maxWeight:0,reps:0,seconds:0};
    current.sets++; current.volume+=log.weight*log.reps; current.maxWeight=Math.max(current.maxWeight,log.weight); current.reps+=log.reps; current.seconds+=log.seconds;
    grouped.set(key,current);
  }
  return [...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function adherence(data, state, end = dayKey()) {
  const programme=data.programs[state.program];
  if (!programme || !validDay(state.startDate)) return {scheduled:0,completed:0,partial:0};
  let scheduled=0,completed=0,partial=0;
  for (let ago=6;ago>=0;ago--) {
    const d=new Date(`${end}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-ago);const date=d.toISOString().slice(0,10);
    if (date<state.startDate) continue;
    const index=programmeDay(state.startDate,date),day=programme.days[index];if(day.rest)continue;scheduled++;
    const logs=state.logs.filter(x=>x.date===date&&x.program===state.program&&x.dayIndex===index);
    const complete=day.exercises.every(id=>Array.from({length:data.exercises[id].sets},(_,i)=>i).every(setIndex=>logs.some(x=>x.exercise===id&&x.setIndex===setIndex)));
    if(complete)completed++;else if(logs.length)partial++;
  }
  return {scheduled,completed,partial};
}
export function cleanState(raw, data, today = dayKey()) {
  const safe = {program:'4',startDate:today,logs:[],measurements:[],equipment:'all',experience:'beginner'};
  if (!raw || typeof raw !== 'object') return safe;
  if (['4','5'].includes(raw.program)) safe.program=raw.program;
  if (validDay(raw.startDate)) safe.startDate=raw.startDate;
  if (['all','machine','dumbbell','barbell','cable','bodyweight'].includes(raw.equipment)) safe.equipment=raw.equipment;
  if (['beginner','experienced'].includes(raw.experience)) safe.experience=raw.experience;
  if (Array.isArray(raw.logs)) safe.logs=raw.logs.slice(-10000).filter(x=> {
    if(!x||!validDay(x.date)||!['4','5'].includes(x.program)||!Number.isInteger(x.dayIndex)||x.dayIndex<0||x.dayIndex>6||!data.exercises[x.exercise]||typeof x.variant!=='string'||x.variant.length>100||!Number.isInteger(x.setIndex)||x.setIndex<0||x.setIndex>=data.exercises[x.exercise].sets)return false;
    try {validateSet(x,Boolean(data.exercises[x.exercise].seconds));return true;}catch{return false;}
  }).map(x=>({...x,...validateSet(x,Boolean(data.exercises[x.exercise].seconds))}));
  if (Array.isArray(raw.measurements)) safe.measurements=raw.measurements.slice(-1000).filter(x=>x&&validDay(x.date)&&Number.isFinite(x.waist)&&x.waist>=30&&x.waist<=250).map(x=>({date:x.date,waist:x.waist}));
  return safe;
}
const escape = value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const equipmentNames={all:'كل الأجهزة',machine:'أجهزة مقاومة',dumbbell:'دمبل',barbell:'بار',cable:'كابل',bodyweight:'وزن الجسم'};
const svgIllustration = group=>`<svg viewBox="0 0 160 100" role="img" aria-label="رسم توضيحي رمزي لمجموعة ${escape(group)}، ليس شرحاً للأداء"><rect x="1" y="1" width="158" height="98" rx="16" fill="#18181c"/><circle cx="80" cy="21" r="9" fill="#e0c89e"/><path d="M80 32v29M80 39L55 53M80 39l25 14M80 61L64 87M80 61l16 26" fill="none" stroke="#e0c89e" stroke-width="6" stroke-linecap="round"/><path d="M25 55h23m64 0h23M30 44v22m100-22v22" stroke="#8e8067" stroke-width="5"/></svg>`;

async function mountTraining() {
  const bridge=window.Mdaar,host=document.getElementById('t-training'),progress=document.getElementById('t-progress');
  if(!bridge||!host||!progress||host.dataset.trainingReady)return;
  host.dataset.trainingReady='loading';
  let data;
  try {const response=await fetch('/data/training-programs.json');if(!response.ok)throw new Error();data=await response.json();}
  catch {host.textContent='تعذر تحميل البرنامج. أعد المحاولة بعد التحقق من الاتصال.';delete host.dataset.trainingReady;return;}
  let state=cleanState(bridge.load(TRAINING_KEY,null),data),selectedDay=Math.max(0,programmeDay(state.startDate,dayKey()));
  let pendingDraft=null;
  function save(draft) {
    let saved=false;
    try { saved=bridge.save(TRAINING_KEY,draft)===true; } catch { saved=false; }
    if(saved){state=draft;pendingDraft=null;return true;}
    pendingDraft=draft;storageFailure();return false;
  }
  function storageFailure(element=host.querySelector('#training-status')) {
    if(!element)return;
    element.textContent='لم تُحفظ التغييرات. الحقول باقية للمحاولة مجدداً؛ تحقق من مساحة المتصفح قبل إغلاق الصفحة.';
    element.setAttribute('role','alert');
    const button=document.createElement('button');button.type='button';button.className='mini g';button.dataset.trainingRetry='';button.textContent='إعادة محاولة الحفظ';element.append(' ',button);
  }
  function retryPending() {
    if(!pendingDraft)return;
    if(save(pendingDraft)){selectedDay=programmeDay(state.startDate,dayKey());render();renderProgress();status('حُفظت التغييرات.');}
    else{storageFailure();const measurement=progress.querySelector('#measurement-status');if(measurement)storageFailure(measurement);}
  }
  const originalText=new WeakMap();
  const translations={
    'بروتوكولك، خطوة بخطوة':'Your protocol, step by step',
    'البرنامج':'Programme','بداية الأسبوع':'Week starts','الأجهزة المتاحة':'Available equipment','الخبرة':'Experience',
    '4 أيام · علوي / سفلي':'4 days · Upper / lower','5 أيام · دفع / سحب / أرجل':'5 days · Push / pull / legs',
    'كل الأجهزة':'All equipment','أجهزة مقاومة':'Resistance machines','دمبل':'Dumbbells','بار':'Barbell','كابل':'Cable','وزن الجسم':'Bodyweight',
    'مبتدئ':'Beginner','لدي خبرة':'Experienced','تمرين اليوم حسب البداية':"Today's scheduled session",'تدرّب بوعي':'Train with care',
    'التسخين، RIR والتقدم التدريجي':'Warm-up, RIR and progression','ابدأ راحة 90 ثانية':'Start 90-second rest','إلغاء المؤقت':'Cancel timer',
    'سجّل المجموعات':'Log your sets','الحركة المسجلة':'Logged variation','كجم':'kg','ثانية':'Seconds','تكرار':'Repetitions','حفظ':'Save','تحديث':'Update',
    'محفوظ ✓':'Saved ✓','راحة 90 ثانية':'90-second rest','مساعد بدائل التمارين':'Exercise alternatives assistant','سؤالك':'Your question','اسأل مساعد مدار':'Ask Mdaar',
    'أرقامك، في سياقها':'Your numbers, in context','متوسط السعرات':'Average calories','متوسط البروتين':'Average protein','جلسات مكتملة':'Completed sessions','آخر وزن مسجل':'Latest weight',
    'اتجاه الوزن':'Weight trend','جدول الوزن القابل للقراءة':'Accessible weight table','التاريخ':'Date','الوزن':'Weight',
    'الغذاء خلال الأسبوع':'This week’s food log','الأيام غير المسجلة تظهر —، ولا تُحسب صفراً':'Missing days show — and are not counted as zero',
    'اليوم':'Date','السعرات':'Calories','البروتين، جم':'Protein, g','تاريخ أداء التمرين':'Exercise history','الحركة':'Exercise',
    'المجموعات':'Sets','أعلى كجم':'Maximum kg','التكرارات / ثوانٍ':'Repetitions / seconds','الحجم، كجم×تكرار':'Volume, kg × reps','محيط الخصر':'Waist measurements','الخصر، سم':'Waist, cm','حفظ القياس':'Save measurement',
    'لا توجد قياسات بعد.':'No measurements yet.','لا توجد مجموعات مسجلة لهذه الحركة.':'No logged sets for this exercise.',
    'سجّل وزنين على الأقل لرسم الاتجاه.':'Log at least two weights to show a trend.',
    'قِس في ظروف متشابهة. القياس للمتابعة الشخصية ولا يقدم تقييماً طبياً.':'Measure under similar conditions. These measurements track personal progress, not medical status.',
    'الرسم رمزي للمجموعة العضلية ولا يشرح التقنية. فيديو أداء موثق غير متوفر في الملف الأصلي. تعلّم الحركة مع مدرب مؤهل.':'The illustration is symbolic, not an exercise demonstration. The source has no verified technique video. Learn with a qualified coach.',
    'تاريخ تسجيل المجموعات:':'Logging date:',
  };
  for(const ex of Object.values(data.exercises))translations[ex.name]=ex.en;
  function applyLanguage() {
    const english=bridge.getLanguage?.()==='en';
    for(const root of [host,progress]) {
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
      while((node=walker.nextNode())) {
        if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;
        const original=originalText.get(node)??node.nodeValue;originalText.set(node,original);
        const clean=original.trim();
        let translated=translations[clean];
        if(!translated&&/^مجموعة [123]$/.test(clean))translated=clean.replace('مجموعة','Set');
        if(!translated&&/^[1-7] · /.test(clean)) {
          const index=Number(clean[0])-1,day=data.programs[state.program].days[index];translated=`${index+1} · ${day.en}`;
        }
        node.nodeValue=english&&translated?original.replace(clean,translated):original;
      }
    }
  }
  window.addEventListener('mdaar:language',applyLanguage);
  const status=(text,failed=false)=>{const el=host.querySelector('#training-status');if(el){el.textContent=text;el.setAttribute('role',failed?'alert':'status');}};
  function render() {
    const programme=data.programs[state.program],day=programme.days[selectedDay],date=dayKey();
    host.innerHTML=`<div class="head"><p class="eyebrow">TRAIN · LOG · PROGRESS</p><h2>بروتوكولك، خطوة بخطوة</h2><p>برنامجا الكتاب الأصلي مع تسجيل محلي للمجموعات. ابدأ بما يناسب خبرتك واستشر مدرباً مؤهلاً.</p></div>
      <div class="card"><div class="training-controls"><label>البرنامج<select id="training-program"><option value="4" ${state.program==='4'?'selected':''}>4 أيام · علوي / سفلي</option><option value="5" ${state.program==='5'?'selected':''}>5 أيام · دفع / سحب / أرجل</option></select></label><label>بداية الأسبوع<input type="date" id="training-start" value="${escape(state.startDate)}" max="${date}"></label><label>الأجهزة المتاحة<select id="training-equipment">${Object.entries(equipmentNames).map(([value,name])=>`<option value="${value}" ${state.equipment===value?'selected':''}>${name}</option>`).join('')}</select></label><label>الخبرة<select id="training-experience"><option value="beginner" ${state.experience==='beginner'?'selected':''}>مبتدئ</option><option value="experienced" ${state.experience==='experienced'?'selected':''}>لدي خبرة</option></select></label></div>
      <div class="training-week" role="group" aria-label="أيام البرنامج">${programme.days.map((d,i)=>`<button class="mini ${i===selectedDay?'':'g'}" data-training-day="${i}" aria-pressed="${i===selectedDay}">${i+1} · ${escape(d.name)}</button>`).join('')}</div><button class="mini g" id="training-today" type="button">تمرين اليوم حسب البداية</button><p class="note">تاريخ تسجيل المجموعات: ${date}. اختيار يوم آخر يحدد قالب التمرين فقط؛ لا يغيّر تاريخ السجل.</p></div>
      <div class="card training-safety"><h3>تدرّب بوعي</h3><p>${state.experience==='beginner'?'للمبتدئ: تعلّم الحركة مع مدرب، واختر حملاً يسمح بالتحكم. لا تبدأ بأوزان أو مدد لا تستطيع أداءها بأمان.':'اختر حملاً يسمح بأداء مضبوط دون ألم، ولا تقارن أرقام أجهزة مختلفة مباشرة.'} توقف عند ألم حاد أو دوخة. البرنامج من الكتاب وليس وصفة فردية أو اعتماداً علمياً.</p><details><summary>التسخين، RIR والتقدم التدريجي</summary><p>من صفحة 6: مشي سريع أو دراجة خفيفة 5 دقائق، حركة لطيفة للكتفين، وسكوات بوزن الجسم إن كان مناسباً، ثم مجموعات تسخين تدريجية قبل التمرين الثقيل. لا تُحسب مجموعات التسخين ضمن مجموعات العمل.</p><p>RIR هو عدد التكرارات التي تتوقع بقاءها قبل عدم القدرة على تكرار مضبوط؛ دليل الكتاب 1–3. اختر الوزن حسب أدائك، وزد بأصغر زيادة متاحة بعد إتمام المدى بتحكم وتكرار ذلك دون ألم. راجع مدرباً لتخصيص الراحة والحمل والحجم.</p><p>الأصل يعرض 8·10·12 وصفحة النظرة العامة 12·10·8؛ لذلك نعرض المدى 8–12 دون افتراض ترتيب إلزامي. البلانك 45/60/90 ثانية في الأصل؛ هذه أمثلة تحتاج تكييفاً وليست حداً يجب بلوغه.</p></details></div>
      <p id="training-status" class="note" role="status" aria-live="polite"></p><div class="card"><div class="hd"><h3>${escape(day.name)} <bdi>${escape(day.en)}</bdi></h3><span class="tag">الكتاب · ص ${day.sourcePage}</span></div><p class="note">${day.rest?'يوم تعافٍ. نوم كافٍ وحركة خفيفة اختيارية حسب حالتك.':'الراحة في الكتاب 90 ثانية، وRIR بين 1 و3. أرقام التسجيل اختيارك الفعلي وليست توصية آلية.'}</p><div class="rest-tools"><button class="mini" id="rest-start" type="button">ابدأ راحة 90 ثانية</button><output id="rest-output" aria-label="الوقت المتبقي للراحة" role="timer">00:00</output><button class="mini g" id="rest-stop" type="button">إلغاء المؤقت</button></div></div>
      <div class="training-exercises">${day.exercises.map(id=>exerciseCard(id,date,day)).join('')}</div>
      <div class="card"><h3>مساعد بدائل التمارين</h3><p class="note">اسأل عن بدائل التمارين بعد تفعيل المشاركة من الإعدادات. لا يُرفق سجل أوزانك. راجع البديل مع مدرب.</p><label>سؤالك<input id="training-ai-question" type="text" maxlength="600" placeholder="مثال: أحتاج بديلاً للسحب العلوي مع دمبل"></label><button class="mini" type="button" id="training-ai">اسأل مساعد مدار</button><div id="training-ai-answer" role="status" aria-live="polite"></div></div>`;
    updateTimer();if(pendingDraft)storageFailure();applyLanguage();
  }
  function exerciseCard(id,date,day) {
    const ex=data.exercises[id],variants=[{name:ex.en,equipment:ex.equipment},...ex.alternatives];
    const filtered=state.equipment==='all'?variants:variants.filter(v=>v.equipment===state.equipment);
    const current=state.logs.filter(x=>x.date===date&&x.program===state.program&&x.dayIndex===selectedDay&&x.exercise===id);
    const chosen=current.at(-1)?.variant || filtered[0]?.name || ex.en;
    const prior=exerciseHistory(state.logs.filter(x=>x.date<date),id).at(-1);
    const hasSourceImage=ex.image && typeof ex.image.src==='string' && /^\/assets\/exercises\/[a-z0-9-]+\.png$/.test(ex.image.src);
    const imageMarkup=hasSourceImage?`<figure class="training-source-figure" style="margin:14px 0"><img src="${escape(ex.image.src)}" width="${ex.image.width}" height="${ex.image.height}" loading="lazy" decoding="async" alt="بطاقة ${escape(ex.en)} من الكتاب الأصلي${ex.alternatives.length?'، مع البديل '+ex.alternatives.map(v=>escape(v.name)).join('، '):''}. المجموعات والراحة مكتوبة في محتوى الصفحة أيضاً." style="display:block;width:100%;height:auto;border-radius:12px"><figcaption class="note">صورة البطاقة الأصلية · ص ${ex.image.sourcePage} · ${escape(ex.en)}</figcaption></figure>`:'';
    return `<article class="card training-exercise" data-exercise-card="${id}"><div class="training-exercise-title"><div><span class="tag">${escape(ex.group)}</span><h3>${escape(ex.name)}</h3><bdi>${escape(ex.en)}</bdi></div>${hasSourceImage?'':`<div class="exercise-illustration">${svgIllustration(ex.group)}</div>`}</div>${imageMarkup}<p>3 مجموعات · ${ex.seconds?'بلانك: أمثلة 45 / 60 / 90 ثانية، عدّلها لقدرتك':'8–12 تكراراً'} · RIR 1–3</p><label>الحركة المسجلة<select class="training-variant" data-variant="${id}">${variants.map(v=>`<option value="${escape(v.name)}" ${v.name===chosen?'selected':''}>${escape(v.name)} · ${escape(equipmentNames[v.equipment])}</option>`).join('')}</select></label><p class="note">${filtered.length?`المطابق للجهاز المختار: ${filtered.map(v=>escape(v.name)).join('، ')}`:'لا يوجد بديل موثق في الكتاب يطابق الجهاز المختار؛ استشر مدرباً بدلاً من استبدال الحركة عشوائياً.'}</p><p class="note">${prior?`آخر أداء ${escape(prior.date)} · ${prior.sets} مجموعات · أعلى وزن ${prior.maxWeight} كجم · ${prior.seconds?prior.seconds+' ثانية':prior.reps+' تكراراً'} (${escape(prior.variant)}).`:'لا يوجد أداء سابق مسجل لهذه الحركة.'}</p><details><summary>سجّل المجموعات</summary><div class="training-sets">${Array.from({length:3},(_,index)=> {
      const log=current.find(x=>x.setIndex===index);return `<form class="training-set" data-training-set="${id}" data-index="${index}"><span>مجموعة ${index+1}</span><label>كجم<input name="weight" type="text" inputmode="decimal" value="${log?.weight??''}" placeholder="0" required aria-label="وزن ${escape(ex.name)} مجموعة ${index+1}"></label><label>${ex.seconds?'ثانية':'تكرار'}<input name="${ex.seconds?'seconds':'reps'}" type="text" inputmode="numeric" value="${ex.seconds?log?.seconds??'':log?.reps??''}" required aria-label="${ex.seconds?'مدة':'تكرارات'} ${escape(ex.name)} مجموعة ${index+1}"></label><label>RIR<input name="rir" type="text" inputmode="numeric" value="${log?.rir??''}" placeholder="1–3" required aria-label="RIR ${escape(ex.name)} مجموعة ${index+1}"></label><button class="mini" type="submit">${log?'تحديث':'حفظ'}</button><span class="training-set-status" role="status">${log?'محفوظ ✓':''}</span></form>`;}).join('')}</div></details><p class="note">${hasSourceImage?'البطاقة من الكتاب الأصلي، ولا تغني عن تعلّم الأداء الصحيح مع مدرب مؤهل. فيديو أداء موثق غير متوفر في الأصل.':'الرسم رمزي للمجموعة العضلية ولا يشرح التقنية. فيديو أداء موثق غير متوفر في الملف الأصلي. تعلّم الحركة مع مدرب مؤهل.'}</p><button class="mini g" type="button" data-training-rest="${id}">راحة 90 ثانية</button></article>`;
  }
  function renderProgress() {
    const today=dayKey(),summary=diarySummary(bridge.getDiary(),today),week=adherence(data,state,today);
    const weights=(bridge.getWeights()||[]).filter(x=>x&&validDay(x.d)&&Number.isFinite(x.w)&&x.w>=30&&x.w<=300).sort((a,b)=>a.d.localeCompare(b.d));
    const latest=weights.at(-1),first=weights[0],change=latest&&first&&weights.length>1?latest.w-first.w:null;
    progress.innerHTML=`<div class="head"><p class="eyebrow">YOUR PROGRESS</p><h2>أرقامك، في سياقها</h2><p>ملخص آخر 7 أيام حتى ${today}. سجلك خاص بهذا المتصفح ولا تتم مزامنته سحابياً.</p></div><div class="grid progress-metrics"><div class="card"><span>متوسط السعرات</span><strong class="progress-number">${summary.averageKcal===null?'—':Math.round(summary.averageKcal)}</strong><small>من ${summary.loggedDays} أيام مسجلة / 7، وليست تقديراً للأيام المفقودة</small></div><div class="card"><span>متوسط البروتين</span><strong class="progress-number">${summary.averageProtein===null?'—':Math.round(summary.averageProtein)+' جم'}</strong><small>من الأيام التي سُجّل فيها طعام فقط</small></div><div class="card"><span>جلسات مكتملة</span><strong class="progress-number">${week.completed} / ${week.scheduled}</strong><small>${week.partial} جلسات جزئية · تكتمل الجلسة بتسجيل جميع مجموعاتها في يومها المجدول. غياب السجل لا يثبت عدم التمرين.</small></div><div class="card"><span>آخر وزن مسجل</span><strong class="progress-number">${latest?latest.w+' كجم':'—'}</strong><small>${change===null?'سجّل وزنين لرؤية التغير':`${change>0?'+':''}${Math.round(change*10)/10} كجم من ${escape(first.d)} إلى ${escape(latest.d)}`}</small></div></div>
      <div class="card"><h3>اتجاه الوزن</h3>${weightChart(weights)}<details><summary>جدول الوزن القابل للقراءة</summary>${weights.length?`<div class="table-scroll"><table><caption>قيم الوزن المسجلة، كجم</caption><thead><tr><th scope="col">التاريخ</th><th scope="col">الوزن</th></tr></thead><tbody>${weights.slice(-30).map(x=>`<tr><th scope="row">${escape(x.d)}</th><td>${x.w}</td></tr>`).join('')}</tbody></table></div>`:'<p>لا يوجد وزن مسجل. استخدم تبويب الوزن لإضافة قياس.</p>'}</details><p class="note">التغير اليومي يتأثر بالسوائل والتوقيت. لا تعدّل السعرات تلقائياً بناءً على وزن منفرد.</p></div>
      <div class="card"><h3>الغذاء خلال الأسبوع</h3><div class="table-scroll"><table><caption>الأيام غير المسجلة تظهر —، ولا تُحسب صفراً</caption><thead><tr><th scope="col">اليوم</th><th scope="col">السعرات</th><th scope="col">البروتين، جم</th></tr></thead><tbody>${summary.rows.map(x=>`<tr><th scope="row">${x.date}</th><td>${x.logged?Math.round(x.kcal):'—'}</td><td>${x.logged?Math.round(x.protein):'—'}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h3>تاريخ أداء التمرين</h3><label>الحركة<select id="progress-exercise">${Object.values(data.exercises).map(ex=>`<option value="${ex.id}">${escape(ex.name)} · ${escape(ex.en)}</option>`).join('')}</select></label><div id="progress-strength"></div><p class="note">الحجم = مجموع (الوزن × التكرارات)، ولا يُقارن بين أجهزة أو حركات مختلفة. البلانك يُسجل بالمدة. لا نحسب أقصى تكرار واحد أو نوصي بزيادات آلية.</p></div>
      <div class="card"><h3>محيط الخصر</h3><form id="measurement-form" class="training-controls"><label>التاريخ<input name="date" type="date" value="${today}" max="${today}" required></label><label>الخصر، سم<input name="waist" type="text" inputmode="decimal" required placeholder="مثال: 80"></label><button class="mini" type="submit">حفظ القياس</button><span id="measurement-status" role="status"></span></form><p class="note">قِس في ظروف متشابهة. القياس للمتابعة الشخصية ولا يقدم تقييماً طبياً.</p><ul>${state.measurements.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(x=>`<li>${x.date}: ${x.waist} سم</li>`).join('')||'<li>لا توجد قياسات بعد.</li>'}</ul></div>`;
    renderStrength();applyLanguage();
  }
  function weightChart(weights) {
    const list=weights.slice(-30);if(list.length<2)return '<p class="msg">سجّل وزنين على الأقل لرسم الاتجاه.</p>';
    const lo=Math.floor(Math.min(...list.map(x=>x.w))-1),hi=Math.ceil(Math.max(...list.map(x=>x.w))+1);
    const minDate=list[0].d,maxDate=list.at(-1).d,span=Math.max(1,dayDistance(minDate,maxDate));
    const points=list.map(x=>[58+dayDistance(minDate,x.d)/span*470,180-(x.w-lo)/(hi-lo)*145]);
    return `<svg class="progress-chart" viewBox="0 0 580 225" role="img" aria-label="اتجاه الوزن من ${escape(minDate)} إلى ${escape(maxDate)}، المحور الرأسي من ${lo} إلى ${hi} كجم، البيانات متاحة في الجدول"><path d="M58 30v150h470" stroke="#8e8067" fill="none"/><text x="48" y="38" text-anchor="end" fill="currentColor">${hi}</text><text x="48" y="182" text-anchor="end" fill="currentColor">${lo}</text><text x="58" y="210" text-anchor="start" fill="currentColor">${minDate}</text><text x="528" y="210" text-anchor="end" fill="currentColor">${maxDate}</text><polyline fill="none" stroke="#e0c89e" stroke-width="3" points="${points.map(p=>p.join(',')).join(' ')}"/>${points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#e0c89e"/>`).join('')}</svg>`;
  }
  function renderStrength() {
    const select=progress.querySelector('#progress-exercise'),out=progress.querySelector('#progress-strength');if(!select||!out)return;
    const history=exerciseHistory(state.logs,select.value);
    out.innerHTML=history.length?`<div class="table-scroll"><table><caption>الأداء المسجل لكل حركة؛ البدائل تعرض باسمها</caption><thead><tr><th scope="col">اليوم</th><th scope="col">الحركة</th><th scope="col">المجموعات</th><th scope="col">أعلى كجم</th><th scope="col">التكرارات / ثوانٍ</th><th scope="col">الحجم، كجم×تكرار</th></tr></thead><tbody>${history.slice(-15).map(x=>`<tr><th scope="row">${x.date}</th><td>${escape(x.variant)}</td><td>${x.sets}</td><td>${x.maxWeight}</td><td>${x.seconds?x.seconds+' ث':x.reps}</td><td>${Math.round(x.volume)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="msg">لا توجد مجموعات مسجلة لهذه الحركة.</p>';
  }
  function updateTimer() {
    const output=host.querySelector('#rest-output');if(!output)return;
    const deadline=Number(bridge.load(REST_KEY,0)),remaining=Number.isFinite(deadline)?Math.max(0,Math.ceil((deadline-Date.now())/1000)):0;
    output.textContent=remaining?`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`:'00:00';
  }
  host.addEventListener('change',event=>{
    const fields={'training-program':'program','training-start':'startDate','training-equipment':'equipment','training-experience':'experience'},field=fields[event.target.id];
    if(!field)return;
    if(field==='startDate'&&(!validDay(event.target.value)||event.target.value>dayKey())){status('اختر تاريخ بداية صالحاً لا يتجاوز اليوم.',true);return;}
    const draft={...(pendingDraft||state),[field]:event.target.value};
    if(save(draft)){selectedDay=programmeDay(state.startDate,dayKey());render();renderProgress();}
  });
  host.addEventListener('submit',event=>{
    const form=event.target.closest('[data-training-set]');if(!form)return;event.preventDefault();
    const id=form.dataset.trainingSet,ex=data.exercises[id],out=form.querySelector('.training-set-status');
    try {
      const values=Object.fromEntries(new FormData(form)),parsed=validateSet({...values,weight:values.weight,rir:values.rir},Boolean(ex.seconds));
      const log={...parsed,date:dayKey(),program:state.program,dayIndex:selectedDay,exercise:id,setIndex:Number(form.dataset.index),variant:host.querySelector(`[data-variant="${id}"]`).value};
      const base=pendingDraft||state,draft={...base,logs:[...base.logs.filter(x=>!(x.date===log.date&&x.program===log.program&&x.dayIndex===log.dayIndex&&x.exercise===id&&x.setIndex===log.setIndex)),log]};
      if(save(draft)){out.textContent='محفوظ ✓';out.setAttribute('role','status');form.querySelector('button').textContent='تحديث';renderProgress();}
      else{out.textContent='لم تُحفظ المجموعة. بيانات الإدخال باقية؛ أعد المحاولة.';out.setAttribute('role','alert');}
    }catch(error){out.textContent=error.message;out.setAttribute('role','alert');}
  });
  host.addEventListener('click',async event=>{
    if(event.target.closest('[data-training-retry]')){retryPending();return;}
    const day=event.target.closest('[data-training-day]');if(day){selectedDay=Number(day.dataset.trainingDay);render();}
    if(event.target.id==='training-today'){selectedDay=programmeDay(state.startDate,dayKey());render();}
    if(event.target.id==='rest-start'||event.target.closest('[data-training-rest]')){if(bridge.save(REST_KEY,Date.now()+90000)===true){updateTimer();status('بدأ مؤقت الراحة.');}else status('تعذر حفظ مؤقت الراحة؛ لم يبدأ. تحقق من مساحة المتصفح وحاول مجدداً.',true);}
    if(event.target.id==='rest-stop'){if(bridge.save(REST_KEY,0)===true){updateTimer();status('أُلغي المؤقت.');}else status('تعذر حفظ إلغاء المؤقت؛ لم يتغير الموعد المحفوظ.',true);}
    if(event.target.id==='training-ai') {
      const button=event.target,question=host.querySelector('#training-ai-question').value.trim(),out=host.querySelector('#training-ai-answer');if(!question){out.textContent='اكتب سؤالك أولاً.';return;}
      button.disabled=true;out.textContent='جارٍ إعداد اقتراح عام…';
      try {const result=await bridge.ask(`اقترح بديلاً تدريبياً عاماً فقط، لا تشخيص ولا وعود ولا خطة علاج. خبرة المستخدم: ${state.experience}. الجهاز المتاح: ${state.equipment}. السؤال: ${question}. أرجع JSON {"answer":"شرح مختصر مع حدود السلامة وضرورة التحقق مع مدرب مؤهل"}.`);if(!result||typeof result.answer!=='string'||result.answer.length>5000)throw new Error('استجابة غير صالحة.');out.textContent=result.answer;}
      catch(error){out.textContent='تعذر الحصول على الاقتراح. تحقق من الاتصال والخدمة وحاول لاحقاً.';}finally{button.disabled=false;}
    }
  });
  progress.addEventListener('click',event=>{if(event.target.closest('[data-training-retry]'))retryPending();});
  progress.addEventListener('change',event=>{if(event.target.id==='progress-exercise')renderStrength();});
  progress.addEventListener('submit',event=>{
    if(event.target.id!=='measurement-form')return;event.preventDefault();
    const form=event.target,values=Object.fromEntries(new FormData(form)),waist=n(values.waist);
    if(!validDay(values.date)||values.date>dayKey()||!Number.isFinite(waist)||waist<30||waist>250){progress.querySelector('#measurement-status').textContent='أدخل تاريخاً صالحاً وقياساً من 30 إلى 250 سم.';return;}
    const base=pendingDraft||state,draft={...base,measurements:[...base.measurements.filter(x=>x.date!==values.date),{date:values.date,waist}]};
    if(save(draft)){renderProgress();progress.querySelector('#measurement-status').textContent='حُفظ القياس.';}
    else storageFailure(progress.querySelector('#measurement-status'));
  });
  window.addEventListener('mdaar:change',event=>{state=cleanState(bridge.load(TRAINING_KEY,null),data);if(event.detail?.key==='all'){pendingDraft=null;selectedDay=0;render();}renderProgress();});
  render();renderProgress();host.dataset.trainingReady='true';setInterval(updateTimer,1000);
}
if (typeof document !== 'undefined') {
  if(window.Mdaar)mountTraining();
  else window.addEventListener('mdaar:ready',mountTraining,{once:true});
}
