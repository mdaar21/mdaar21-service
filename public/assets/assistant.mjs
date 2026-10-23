// An optional general assistant. No personal records are attached automatically.
const M=window.Mdaar;
const en=()=>M.getLanguage()==='en';
const label=(ar,english)=>en()?english:ar;
const trigger=document.createElement('button');
trigger.className='mini g';trigger.id='assistant-open';trigger.type='button';
const dialog=document.createElement('dialog');dialog.id='mdaar-assistant';dialog.className='assistant-dialog';
dialog.setAttribute('aria-labelledby','assistant-title');
const form=document.createElement('form');form.className='assistant-form';
const heading=document.createElement('h2');heading.id='assistant-title';
const close=document.createElement('button');close.type='button';close.className='mini g';close.id='assistant-close';
const intro=document.createElement('p');intro.className='hint';
const promptLabel=document.createElement('label');promptLabel.htmlFor='assistant-prompt';
const prompt=document.createElement('textarea');prompt.id='assistant-prompt';prompt.maxLength=2000;prompt.rows=4;prompt.required=true;
const includeLabel=document.createElement('label');includeLabel.className='consent';
const include=document.createElement('input');include.type='checkbox';include.id='assistant-target';
const includeText=document.createElement('span');includeLabel.append(include,includeText);
const submit=document.createElement('button');submit.type='submit';submit.className='go';submit.id='assistant-send';
const output=document.createElement('div');output.id='assistant-answer';output.setAttribute('role','status');output.setAttribute('aria-live','polite');
form.append(heading,close,intro,promptLabel,prompt,includeLabel,submit,output);dialog.append(form);
document.body.append(dialog);document.querySelector('header').append(trigger);
let generation=0;
function language(){
 trigger.textContent=label('اسأل مدار','Ask Mdaar');heading.textContent=label('مساعد مدار','Mdaar assistant');
 close.textContent=label('إغلاق','Close');promptLabel.textContent=label('كيف أساعدك؟','How can I help?');
 intro.textContent=M.serviceAvailable===false?label('اسأل مدار غير متاح حالياً على هذا الرابط. تقدر تستخدم الحاسبة والوصفات والتمارين.','Ask Mdaar is currently unavailable on this address. You can use the calculator, recipes and training tools.'):label('شرح الأدوات، وتنظيم يومك، وبدائل غذائية وتدريبية عامة. يُرسل سؤالك للمعالجة عند الضغط على إرسال. لا يقدم تشخيصاً أو علاجاً.','Ask about the tools, organising your day, or general food and exercise alternatives. Your question is sent for processing when you press Send. No diagnosis or treatment.');
 includeText.textContent=label('إرفاق هدفي الحالي فقط بهذا السؤال (اختياري)','Include my current target with this question (optional)');
 submit.textContent=label('أرسل سؤالي','Send question');
}
function reset(){generation++;prompt.value='';include.checked=false;output.replaceChildren();submit.disabled=false;}
trigger.addEventListener('click',()=>{dialog.showModal();prompt.focus();});
close.addEventListener('click',()=>{M.cancelRequest();dialog.close();});
dialog.addEventListener('cancel',()=>M.cancelRequest());
form.addEventListener('submit',async event=>{
 event.preventDefault();const text=prompt.value.trim();if(!text)return;const current=++generation;
 submit.disabled=true;output.textContent=label('جارٍ إعداد الإجابة…','Preparing an answer…');
 try{
  const target=include.checked?M.getTarget():null;
  const response=await M.ask('أنت مساعد مدار. الموقع يحتوي حاسبة Mifflin-St Jeor للبالغين، دفتر أكل محلي، وصفات محسوبة وخطط، برنامجي 4 و5 أيام، تقدم وإعدادات خصوصية. اشرح بوضوح واذكر حدود التقدير دون تشخيص أو علاج أو اختلاق أرقام أو بيانات غذائية. أجب بلغة سؤال المستخدم. أرجع JSON فقط {"answer":"نص الإجابة","suggestions":["خطوة عملية اختيارية"]}. سؤال المستخدم: '+text+(target?'\nوافق المستخدم على إرفاق هدفه الحالي فقط: '+JSON.stringify({kcal:target.kcal,p:target.p,c:target.c,f:target.f}):''));
  if(current!==generation)return;
  if(!response||typeof response.answer!=='string'||response.answer.length>12000||!Array.isArray(response.suggestions)||response.suggestions.length>8||response.suggestions.some(x=>typeof x!=='string'||x.length>1000))throw Error('invalid_response');
  const answer=document.createElement('p');answer.textContent=response.answer;const suggestions=document.createElement('ul');
  for(const text of response.suggestions){const li=document.createElement('li');li.textContent=text;suggestions.append(li);}
  output.replaceChildren(answer,suggestions);
 }catch(error){if(current!==generation)return;output.textContent=M.serviceAvailable===false?label('اسأل مدار غير متاح حالياً على هذا الرابط.','Ask Mdaar is currently unavailable on this address.'):error?.code==='auth'?label('تعذر بدء جلسة آمنة؛ حاول مجدداً.','Unable to start a secure session. Please try again.'):label('تعذر إكمال الإجابة. راجع إعداد الخدمة أو جرّب لاحقاً.','Unable to complete the answer. Check service settings or try later.');}
 finally{if(current===generation)submit.disabled=false;}
});
window.addEventListener('mdaar:ai-reset',reset);
window.addEventListener('mdaar:change',event=>{if(event.detail?.key==='all')reset();});
window.addEventListener('mdaar:language',language);
language();
