// A calm overview of the user's actual local data. No synthetic health metrics.
import {cleanState} from './training.mjs';
const M=window.Mdaar;
let trainingData=null;
fetch('/data/training-programs.json').then(response=>{if(!response.ok)throw Error('unavailable');return response.json();}).then(data=>{trainingData=data;renderOverview();}).catch(()=>{});
const $=id=>document.getElementById(id);
const english=()=>M.getLanguage()==='en';
const text=(ar,en)=>english()?en:ar;
const number=(n,d=0)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(Number.isFinite(n)?n:0);
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function renderOverview(){
 const target=M.getTarget(),rows=M.getDiary()?.[today()]||[];
 const totals=rows.reduce((sum,row)=>{for(const key of ['k','p','c','f'])sum[key]+=Number.isFinite(row[key])?row[key]:0;return sum;},{k:0,p:0,c:0,f:0});
 $('home-date').textContent=new Intl.DateTimeFormat(english()?'en-GB':'ar-SA',{day:'numeric',month:'long',calendar:'gregory'}).format(new Date());
 $('home-calories').textContent=number(totals.k);$('home-calories').dataset.value=String(totals.k);
 $('home-target').textContent=target?number(target.kcal):'—';$('home-target').dataset.value=target?String(target.kcal):'';
 $('home-energy-ring').style.setProperty('--energy-progress',`${target?Math.max(0,Math.min(100,totals.k/target.kcal*100)):0}%`);
 $('home-energy-badge').textContent=rows.length?text('من تسجيلاتك اليوم','From today’s logs'):text('بداية جديدة','A fresh start');
 $('home-target-note').textContent=target?text('سعرة يومياً · تقديرك الحالي','kcal / day · current estimate'):text('احسب احتياجك لتظهر الصورة كاملة.','Calculate your needs for the complete picture.');
 for(const [id,k] of [['home-protein','p'],['home-carbs','c'],['home-fat','f']])$(id).textContent=`${number(totals[k],1)} ${text('جم','g')}`;
 $('home-food-state').dataset.value=String(rows.length);
 const training=M.load('mdaar_training_v1',null),logs=trainingData?cleanState(training,trainingData).logs:[];
 $('home-training-count').dataset.value=String(logs.length);$('home-training-count').textContent=logs.length?text(`سجلك التدريبي · ${logs.length} مجموعة محفوظة`, `Your training log · ${logs.length} recorded sets`):text('سجلك التدريبي يبدأ مع أول مجموعة تسجّلها.','Your training log starts with your first recorded set.');
 $('home-goal-state').textContent=target?text('محدد ✓','Set ✓'):text('ابدأ بالحاسبة','Start with the calculator');
 $('home-food-state').textContent=rows.length?text(`${rows.length} تسجيل اليوم`,`${rows.length} entries today`):text('مساحة ليومك','Ready for your day');
 const weights=M.getWeights()||[];
 $('home-weight-state').textContent=weights.length?text(`${weights.length} قياس مسجّل`,`${weights.length} recorded measurements`):text('كل قياس يحكي جزءاً','Each measure tells a part');
 const next=$('home-next-step');next.replaceChildren();
 const title=document.createElement('p');title.className='next-step-title';title.textContent=!target?text('بداية واعية تصنع الفرق.','An intentional start makes a difference.'):!rows.length?text('أول وجبة، أول خطوة.','First meal. First step.'):text('أنت تبني الصورة، وجبة بوجبة.','Your picture is growing, meal by meal.');
 const copy=document.createElement('p');copy.className='next-step-copy';copy.textContent=!target?text('خذ دقيقة لتقدير احتياجك. ثم حوّل الرقم إلى اختيارات تناسب يومك.','Take a minute to estimate your needs. Turn the number into choices that fit your day.'):!rows.length?text('سجّل وجبتك الأولى، وعدّل الكمية كما أكلتها فعلاً.','Log your first meal and adjust the amount to what you actually ate.'):text('راجع مجموعك بهدوء. تسجيلك يوضح ما حدث، ولا يحكم عليك.','Review your totals calmly. A log describes what happened; it does not judge you.');
 next.append(title,copy);
}
function language(){document.querySelectorAll('[data-ex-ar]').forEach(node=>node.textContent=node.dataset[english()?'exEn':'exAr']);renderOverview();}
document.addEventListener('click',event=>{
 const jump=event.target.closest('[data-ex-jump]');
 if(jump){M.show(jump.dataset.exJump);return;}
 const program=event.target.closest('[data-ex-program]');
 if(program){M.show('training');const select=$('training-program');if(select){select.value=program.dataset.exProgram;select.dispatchEvent(new Event('change',{bubbles:true}));}}
});
window.addEventListener('mdaar:change',renderOverview);
window.addEventListener('mdaar:language',language);
window.addEventListener('mdaar:tab',event=>{document.body.dataset.view=event.detail;});
function lineIcon(paths){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');for(const d of paths){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}return svg;}
for(const node of document.querySelectorAll('.hero-actions [aria-hidden],.text-action [aria-hidden],.tool-arrow,.preview-link i,.outline-icon'))node.replaceChildren(lineIcon(['M17 17 7 7M7 17V7h10']));
const navIcons={training:['m5 4-1 1 15 15 1-1M2 8l6-6M16 22l6-6M4 11l7-7M13 20l7-7'],progress:['M4 4v16h17M8 15l4-5 4 2 5-7'],settings:['M9 4h6l1 3 3 1 2 5-2 2-1 4-5 2-2-2-4-1-2-5 2-2 1-4z','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0']};
for(const [tab,paths]of Object.entries(navIcons)){const node=document.querySelector(`#tabs [data-t="${tab}"]>[aria-hidden]`);if(node)node.replaceWith(lineIcon(paths));}
const tools=[['M7 3h10v18H7z','M10 7h4M10 12h1M14 12h1M10 16h1M14 16h1'],['M5 3h14v18H5z','M9 7h6M9 11h6M9 15h4'],['M19 4C8 3 3 9 7 16c6 5 13-2 12-12Z','M6 20l9-10']];
document.querySelectorAll('.tool-icon').forEach((node,index)=>node.replaceChildren(lineIcon(tools[index])));

// Home is a real starting screen, while every existing tool retains its own tab.
document.body.dataset.view='home';
document.querySelectorAll('#tabs button[data-t]').forEach(button=>button.setAttribute('aria-current',button.dataset.t==='home'?'page':'false'));
language();
