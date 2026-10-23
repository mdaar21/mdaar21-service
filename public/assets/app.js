const esc=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
import {serviceOrigin,askRemote,clearRemoteSession} from "./remote-service.mjs";
import {normalizeNumber,parseNumber,calculateTarget,safeDiary,safeWeights,safeTarget,finiteNutrient} from "./core.mjs";

const remoteOrigin=serviceOrigin();
const serviceAvailable=Boolean(remoteOrigin)||document.querySelector('meta[name="mdaar-hosting"]')?.content!=="static";
const $=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString("en-US");
$("f").addEventListener("submit",e=>{
e.preventDefault();
let result;
try {result=calculateTarget({male:$("gm").checked,age:parseNumber($("age").value),w:parseNumber($("w").value),h:parseNumber($("h").value),act:parseNumber($("act").value),goal:parseNumber(document.querySelector('input[name=goal]:checked').value)});$("err").textContent="";} catch(error){$("err").textContent=error.message;return;}
const {bmr,tdee,kcal,p,c,f,w,limited:low,review}=result;
$("kcal").textContent=fmt(kcal);$("bmr").textContent=fmt(bmr);$("tdee").textContent=fmt(tdee);
$("pv").textContent=fmt(p)+" جم";$("cv").textContent=fmt(c)+" جم";$("fv").textContent=fmt(f)+" جم";
const tot=p*4+c*4+f*9;
["p","c","f"].forEach((k,i)=>{$(k+"b").style.width=Math.round([p*4,c*4,f*9][i]/tot*100)+"%"});
$("water").textContent="تقدير أولي قابل للمراجعة، وليس وصفة علاجية. احتياج السوائل يختلف مع الجو والنشاط والحالة الصحية."+(review?" نطاق الوزن بالنسبة للطول يستلزم مراجعة مختص قبل اتباع عجز أو فائض.":"")+(low?" تم تطبيق حد عرض محافظ؛ لا يمثل ضماناً للملاءمة الصحية.":"");
window.T={kcal,p,c,f,w};sv("mdaar_t",window.T);window.upd&&window.upd();$("empty").hidden=true;
const o=$("out");o.hidden=false;
const s=o.querySelector(".spin");s.style.animation="none";void s.getBoundingClientRect();s.style.animation="";
});

const FOODS=`كبسة دجاج|صحن|650|35|80|20
كبسة لحم|صحن|720|38|80|28
مندي دجاج|صحن|700|45|75|22
جريش|صحن|400|15|55|12
مرقوق|صحن|450|25|50|15
هريس|صحن|350|20|45|10
فول|صحن|250|14|30|8
شاورما دجاج|ساندويتش|450|28|38|20
برجر|ساندويتش|540|28|40|30
بيتزا|شريحة|285|12|36|10
سمبوسة|حبة|150|5|13|9
تمر|حبة|23|0.2|6|0
قهوة عربية|فنجان|5|0|1|0
شاهي بحليب|كوب|80|3|10|3
خبز صامولي|حبة|140|5|27|2
خبز عربي|رغيف|165|5.5|33|0.7
خبز تميس|قطعة|280|8|55|2
بيض مسلوق|حبة|78|6|0.6|5
شوفان جاف|50 جم|190|7|33|3.5
صدر دجاج مشوي|100 جم|165|31|0|3.6
سمك مشوي|100 جم|140|25|0|4
تونة معلبة|علبة|120|26|0|1
رز أبيض مطبوخ|كوب|205|4|45|0.4
لبن|كوب|100|6|8|4
حليب|كوب|120|8|12|5
زبادي يوناني|170 جم|100|17|6|0.7
جبنة قريش|100 جم|100|12|3|4
لبنة|ملعقة كبيرة|30|1|1|2.5
حمص|3 ملاعق|100|3|9|6
لوز|حفنة (28 جم)|165|6|6|14
زبدة فول سوداني|ملعقة كبيرة|95|4|3|8
موز|حبة|105|1.3|27|0.4
تفاح|حبة|95|0.5|25|0.3
سلطة خضار|صحن|50|2|9|0.5
بطاطس مقلية|حصة وسط|365|4|48|17
عصير برتقال|كوب|110|2|26|0
مشروب غازي|علبة|140|0|39|0
كنافة|قطعة|350|6|45|17
لقيمات|5 حبات|250|3|38|9
معمول|حبة|120|2|16|5
شوربة عدس|صحن|230|14|36|3
بروتين شيك|سكوب|120|24|3|1.5
كليجا|حبة|90|1.5|13|4
باستا مطبوخة|كوب|220|8|43|1.3
سباغيتي بولونيز|صحن|450|22|55|15
هوت دوج|حبة|290|10|23|17
ناغتس دجاج|6 قطع|280|14|18|17
دجاج مقلي|قطعة|300|20|10|20
ستيك لحم|150 جم|300|40|0|15
سلمون مشوي|100 جم|208|20|0|13
جمبري مسلوق|100 جم|99|24|0.2|0.3
بطاطس مشوية|حبة وسط|160|4|37|0.2
بطاطس مهروسة|كوب|210|4|35|7
بروكلي مسلوق|كوب|55|3.7|11|0.6
أفوكادو|حبة|320|4|18|30
جبنة شيدر|شريحة|110|7|0.4|9
جبنة موزاريلا|30 جم|85|6|1|6.3
زبدة|ملعقة كبيرة|102|0.1|0|11.5
زيت زيتون|ملعقة كبيرة|119|0|0|13.5
عسل|ملعقة كبيرة|64|0.1|17|0
سكر|ملعقة صغيرة|16|0|4|0
خبز توست أبيض|شريحة|75|2.5|14|1
خبز توست أسمر|شريحة|80|4|14|1
كورن فليكس|كوب|100|2|24|0.1
جرانولا|كوب|400|10|64|12
بان كيك|حبة|90|2|11|4
وافل|حبة|220|6|25|11
دونات|حبة|250|3|31|13
كرواسون|حبة|230|5|26|12
كيك شوكولاتة|شريحة|350|4|50|15
آيس كريم|كوب|270|5|31|14
شوكولاتة حليب|قطعة 40 جم|210|3|23|12
شيبس|كيس صغير|150|2|15|10
فشار|3 أكواب|95|3|19|1
عصير تفاح|كوب|115|0.2|28|0.3
لاتيه|كوب وسط|190|10|18|7
كابتشينو|كوب|120|6|10|6
قهوة سوداء|كوب|2|0.3|0|0
شاي أخضر|كوب|2|0|0|0
كولا زيرو|علبة|0|0|0|0
برتقال|حبة|62|1.2|15|0.2
عنب|كوب|105|1|27|0.2
بطيخ|كوب|46|1|11.5|0.2
فراولة|كوب|50|1|12|0.5
عدس مطبوخ|كوب|230|18|40|0.8
حمص مسلوق|كوب|270|14.5|45|4
فاصوليا سوداء|كوب|225|15|41|1
كينوا مطبوخة|كوب|220|8|39|3.5
أرز بني مطبوخ|كوب|215|5|45|1.8
سوشي|8 قطع|300|12|50|5
ساندويتش دجاج مشوي|حبة|380|30|40|10`.split("\n").map(l=>{const a=l.split("|");return{n:a[0],u:a[1],k:+a[2],p:+a[3],c:+a[4],f:+a[5]}});
const GULF=new Set('كبسة دجاج,كبسة لحم,مندي دجاج,جريش,مرقوق,هريس,فول,شاورما دجاج,سمبوسة,تمر,قهوة عربية,شاهي بحليب,خبز صامولي,خبز عربي,خبز تميس,لبن,لبنة,حمص,شوربة عدس,كنافة,لقيمات,معمول,كليجا'.split(','));let ft='all';
const FM={};FOODS.forEach(x=>FM[x.n]=x);
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){announce("تعذر حفظ البيانات. صدّر نسخة وتحقق من مساحة المتصفح.");return false}window.cs&&window.cs();window.dispatchEvent(new CustomEvent("mdaar:change",{detail:{key:k}}));return true};
window.T=safeTarget(ld("mdaar_t",null));
const td=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const r1=n=>Math.round(n*10)/10,nq=v=>String(Math.round(v*4)/4);
let diary=safeDiary(ld("mdaar_d",{})),weights=safeWeights(ld("mdaar_w",[])),fav=ld("mdaar_f",[]);
fav=Array.isArray(fav)?fav.filter(x=>x&&typeof x.n==="string"&&Array.isArray(x.b)&&x.b.length===4&&x.b.every(finiteNutrient)):[];
const today=()=>diary[td()]||(diary[td()]=[]);
const NEED='<div class="msg">احسب سعراتك أولاً من تبويب «الحاسبة» وترجع هنا.</div>';
function show(t){if(!$("t-"+t))return;document.querySelectorAll(".tab").forEach(s=>s.hidden=s.id!=="t-"+t);document.querySelectorAll("#tabs button").forEach(b=>{b.classList.toggle("on",b.dataset.t===t);b.setAttribute("aria-current",b.dataset.t===t?"page":"false")});if(t==="meals")meals();if(t==="diary")rd();if(t==="weight")rw();window.dispatchEvent(new CustomEvent("mdaar:tab",{detail:t}));$("main-content").focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"})}
$("tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.t)});
/* diary */
const MEALS=["فطور","غداء","عشاء","سناك"];
const CATS={"وجبات رئيسية":"كبسة دجاج,كبسة لحم,مندي دجاج,جريش,مرقوق,هريس,فول,شاورما دجاج,برجر,بيتزا,سمبوسة,باستا مطبوخة,سباغيتي بولونيز,هوت دوج,ناغتس دجاج,دجاج مقلي,ساندويتش دجاج مشوي,سوشي,شوربة عدس",
"بروتين":"صدر دجاج مشوي,سمك مشوي,تونة معلبة,بيض مسلوق,ستيك لحم,سلمون مشوي,جمبري مسلوق,بروتين شيك",
"نشويات":"رز أبيض مطبوخ,خبز صامولي,خبز عربي,خبز تميس,شوفان جاف,بطاطس مشوية,بطاطس مهروسة,بطاطس مقلية,خبز توست أبيض,خبز توست أسمر,كورن فليكس,جرانولا,عدس مطبوخ,حمص مسلوق,فاصوليا سوداء,كينوا مطبوخة,أرز بني مطبوخ",
"ألبان ودهون":"لبن,حليب,زبادي يوناني,جبنة قريش,لبنة,جبنة شيدر,جبنة موزاريلا,زبدة,زيت زيتون,زبدة فول سوداني,لوز,حمص,أفوكادو",
"فواكه وخضار":"تمر,موز,تفاح,سلطة خضار,بروكلي مسلوق,برتقال,عنب,بطيخ,فراولة",
"مشروبات":"قهوة عربية,شاهي بحليب,عصير برتقال,مشروب غازي,عصير تفاح,لاتيه,كابتشينو,قهوة سوداء,شاي أخضر,كولا زيرو",
"حلويات وسناك":"كنافة,لقيمات,معمول,كليجا,بان كيك,وافل,دونات,كرواسون,كيك شوكولاتة,آيس كريم,شوكولاتة حليب,شيبس,فشار,عسل,سكر"};
const CM={};Object.keys(CATS).forEach(k=>CATS[k].split(",").forEach(n=>CM[n]=k));
const st=u=>u==="جم"||u==="مل"?10:["صحن","كوب","رغيف"].includes(u)?.5:1;
const QT=(q,u)=>{const m=u.match(/^(\d+)\s+(.*)$/);return m?(Math.round(q*m[1]*10)/10)+" "+m[2]:nq(q)+" "+u};
const MAC=(p,c,f)=>`<span class="mc"><i style="background:#e0c89e"></i>بروتين ${r1(p)} جم</span><span class="mc"><i style="background:#b7c9a0"></i>كارب ${r1(c)} جم</span><span class="mc"><i style="background:#d6a38a"></i>دهون ${r1(f)} جم</span>`;
const row=(n,u,k,p,c,f,at)=>`<div class="fr"><div class="fi"><b>${esc(n)}</b><span>${esc(u)}</span><div class="mcs">${MAC(p,c,f)}</div></div><div class="fk"><strong>${fmt(k)}</strong><small>سعرة</small></div><button class="add" ${at} aria-label="أضف">+</button></div>`;
function addCustom(n,u,b,q,m,cm){if(typeof n!=="string"||!Array.isArray(b)||b.length!==4||!b.every(finiteNutrient)||!Number.isFinite(q)||q<0.001||q>10000||b.some(v=>!finiteNutrient(v*q)))throw new RangeError("قيم الطعام غير صالحة");today().push({n:n,u:u,q:q,m:MEALS.includes(m)?m:"سناك",cm:cm,b:b,k:b[0]*q,p:b[1]*q,c:b[2]*q,f:b[3]*q});return sv("mdaar_d",diary)}
function addItem(n,q,m){const x=FM[n];return addCustom(n,x.u,[x.k,x.p,x.c,x.f],q,m)}
let fcat="all";
function fr(){const s=$("q").value.trim();let h="";
if(fcat==="المفضلة")h=fav.map((x,i)=>[x,i]).filter(([x])=>!s||x.n.includes(s)).map(([x,i])=>favRow(x,i)).join("")||'<div class="msg">ما عندك مفضلة للحين. احفظ أي أكلة بضغطة ⭐.</div>';else if(fcat==="وصفات"){
 const catalogue=window.MdaarNutrition,list=catalogue?.searchRecipes(s)||[];
 const en=document.documentElement.lang==="en",name=x=>en?x.nameEn:x.name;
 h=catalogue?list.slice(0,30).map(x=>row(name(x),en?`One serving · ${x.minutes} min assembly`:`حصة واحدة · ${x.minutes} دقيقة تجميع`,x.nutrition.kcal,x.nutrition.p,x.nutrition.c,x.nutrition.f,'data-nutrition-recipe="'+x.id+'"')).join(""):'<p role="status">جار تحميل الوصفات…</p>';
 if(catalogue){if(!list.length)h=`<p class="msg">${en?'No recipes match this search.':'لا وصفات تطابق هذا البحث.'}</p>`;h+='<button class="mini g" type="button" data-open-recipes>'+(en?'Open recipe library':'افتح مكتبة الوصفات')+' · '+catalogue.recipes.length+'</button>';}
}
else h=FOODS.filter(x=>(fcat==="all"||CM[x.n]===fcat)&&(ft==="all"||(ft==="g")===GULF.has(x.n))&&(!s||x.n.includes(s))).map(x=>row(x.n,"الحصة: "+x.u,x.k,x.p,x.c,x.f,'data-a="'+x.n+'"')).join("");
$("fres").innerHTML=h||'<div class="msg">ما لقيتها بقائمتنا. اضغط «ابحث مع مدار» وبيجيب لك سعراتها وماكروزها بالجرامات.</div>'}
$("q").addEventListener("input",fr);
$("chips").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;fcat=b.dataset.c;document.querySelectorAll("#chips button").forEach(x=>x.classList.toggle("on",x===b));$("orig").hidden=fcat==="وصفات";fr()});
$("orig").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;ft=b.dataset.f;document.querySelectorAll("#orig button").forEach(x=>x.classList.toggle("on",x===b));fr()});
$("fres").addEventListener("click",e=>{const q=parseNumber($("qty").value),a=e.target.closest("[data-a]"),r=e.target.closest("[data-nutrition-recipe]");
if(e.target.closest("[data-open-recipes]")){show("rec");return}if(!Number.isFinite(q)||q<=0||q>100){announce("اكتب كمية أكبر من صفر وحتى 100 حصة.");return}if(a)addItem(a.dataset.a,q,$("ml").value);else if(r){window.MdaarNutrition.addRecipeToDiary(r.dataset.nutritionRecipe,q,$("ml").value)}else return;rd()});
function bar(l,v,t,u){const pc=t?Math.min(100,v/t*100):0;return `<p style="margin:10px 0 3px;display:flex;justify-content:space-between;font-weight:600;font-size:.92rem"><span>${l}</span><span>${fmt(v)}${t?" / "+fmt(t):""} ${u}</span></p><div class="bar"><i style="width:${pc}%"></i></div>`}
function rd(){fr();$("dt").textContent=td();const L=today();L.forEach(x=>{if(!x.b)x.b=[x.k/x.q,x.p/x.q,x.c/x.q,x.f/x.q]});
const s=L.reduce((a,x)=>({k:a.k+x.k,p:a.p+x.p,c:a.c+x.c,f:a.f+x.f}),{k:0,p:0,c:0,f:0}),T=window.T,rem=T?T.kcal-s.k:0,C=2*Math.PI*52,pc=T?Math.min(1,s.k/T.kcal):0;
let h=`<div class="sum"><svg viewBox="0 0 120 120" class="rg" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" stroke="#25252b" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="${rem<0?"#e8a08a":"#e0c89e"}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C*pc} ${C}" transform="rotate(-90 60 60)"/></svg><div class="rc2"><strong>${fmt(T?Math.abs(rem):s.k)}</strong><small>${T?(rem>=0?"سعرة متبقية":"فوق هدفك"):"سعرة"}</small></div></div>`;
h+=bar("بروتين",s.p,T&&T.p,"جم")+bar("كارب",s.c,T&&T.c,"جم")+bar("دهون",s.f,T&&T.f,"جم");if(!T)h+=NEED;
$("dtot").innerHTML=h;
$("dl").innerHTML=MEALS.map(m=>{const g=L.map((x,i)=>[x,i]).filter(([x])=>x.m===m);if(!g.length)return"";
return `<div class="grp"><span>${m}</span><b>${fmt(g.reduce((a,[x])=>a+x.k,0))} سعرة</b></div>`+g.map(([x,i])=>`<div class="fr"><div class="fi"><b>${esc(x.n)}</b><span>${x.cm?(x.q!==1?x.q+"× ":"")+esc(x.cm):esc(QT(x.q,x.u))}</span>${x.u==="جم"?`<label class="gram-control">الوزن بالجرام <input data-gram="${i}" inputmode="decimal" value="${x.q}" aria-label="وزن ${esc(x.n)} بالجرام"></label>`:""}<div class="mcs">${MAC(x.p,x.c,x.f)}</div></div><div class="stp"><button data-s="${i}:-1" aria-label="أنقص">−</button><button data-s="${i}:1" aria-label="زد">+</button></div><div class="fk"><strong>${fmt(x.k)}</strong><small>سعرة</small></div><button class="x" data-fv="${i}" aria-label="للمفضلة">☆</button><button class="x" data-r="${i}" aria-label="حذف">✕</button></div>`).join("")}).join("")||'<div class="msg">ما أضفت شيء اليوم. ابحث عن أكلتك أو وصفة وأضفها.</div>'}
$("dl").addEventListener("click",e=>{const r=e.target.closest("[data-r]"),s=e.target.closest("[data-s]"),L=today();
if(r)L.splice(+r.dataset.r,1);else if(s){const[i,d]=s.dataset.s.split(":"),x=L[+i],p=st(x.u);x.q=Math.max(p,Math.round((x.q+d*p)*2)/2);x.k=x.b[0]*x.q;x.p=x.b[1]*x.q;x.c=x.b[2]*x.q;x.f=x.b[3]*x.q}else return;sv("mdaar_d",diary);rd()});
/* meals */
function meals(){
 if(window.MdaarNutrition?.renderSuggestedMeals){window.MdaarNutrition.renderSuggestedMeals();return}
 $("mealbox").innerHTML='<div class="card">'+(window.T?'<p role="status">جار تحميل اقتراحات الوجبات…</p>':NEED)+'</div>';
}
/* weight */
function rw(){const W=weights.slice().sort((a,b)=>a.d<b.d?-1:1);
$("wl").innerHTML=W.length?W.slice().reverse().slice(0,12).map(x=>`<div class="it"><div class="n">${x.d}</div><b>${x.w} كجم</b><button class="x" data-w="${x.d}" aria-label="حذف">✕</button></div>`).join(""):'<div class="msg">ما سجلت وزنك للحين.</div>';
const sv_=$("wch");if(W.length<2){sv_.innerHTML='<text x="150" y="80" fill="#9a9488" font-size="12" text-anchor="middle">سجّل وزنين على الأقل لرسم الخط</text>';$("wsum").textContent=W.length?"آخر وزن: "+W[0].w+" كجم":"";return}
const ws=W.map(x=>x.w),mn=Math.min(...ws)-1,mx=Math.max(...ws)+1,pts=W.map((x,i)=>[15+i*(270/(W.length-1)),135-(x.w-mn)/(mx-mn)*120]);
sv_.innerHTML='<polyline fill="none" stroke="#e0c89e" stroke-width="2" points="'+pts.map(p=>p.join(",")).join(" ")+'"/>'+pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#e0c89e"/>`).join("");
const a=W[0],b=W[W.length-1],days=Math.max(1,(new Date(b.d)-new Date(a.d))/864e5),ch=b.w-a.w,wk=ch/days*7;
$("wsum").textContent=`التغير: ${ch>0?"+":""}${r1(ch)} كجم منذ أول تسجيل، بمعدل ${wk>0?"+":""}${r1(wk)} كجم بالأسبوع.`+(Math.abs(wk)>b.w*.01?" المعدل سريع نوعاً ما، الأفضل تقريباً أقل من 1% من وزنك بالأسبوع.":"")}
$("wadd").addEventListener("click",()=>{const v=parseNumber($("wv").value);if(!(v>=30&&v<=300)){$("wsum").textContent="اكتب وزنك بالكجم، رقم من 30 إلى 300.";return}weights=weights.filter(x=>x.d!==td());weights.push({d:td(),w:v});sv("mdaar_w",weights);$("wv").value="";rw()});
$("wl").addEventListener("click",e=>{const b=e.target.closest("[data-w]");if(!b)return;weights=weights.filter(x=>x.d!==b.dataset.w);sv("mdaar_w",weights);rw()});
const LD='<div class="ld">مدار يشتغل على طلبك...</div>';
let aiPending=false,aiEpoch=0,aiController=null,aiPublicAccess=false;
function setAISessionMode(enabled){aiPublicAccess=enabled===true;if($("ai-invite-controls"))$("ai-invite-controls").hidden=aiPublicAccess;if($("ai-public-access"))$("ai-public-access").hidden=!aiPublicAccess;}
function setAIBusy(busy){if(busy)document.body.setAttribute("aria-busy","true");else document.body.removeAttribute("aria-busy");document.querySelectorAll(".aib").forEach(b=>{if(b.tagName==="BUTTON")b.disabled=busy})}
async function ask(q){
 if(!serviceAvailable)throw{code:"srv",detail:"الخدمات المتصلة غير متاحة على هذا الرابط حالياً. أدوات الحساب والتسجيل تعمل."};
 if(aiPending)throw{code:"busy",detail:"انتظر انتهاء الطلب الحالي."};
 if(typeof q!=="string"||q.length>8000)throw{code:"input",detail:"الطلب طويل؛ اختصر التفاصيل."};
 const epoch=aiEpoch,controller=new AbortController();aiController=controller;aiPending=true;setAIBusy(true);
 const cancelled=()=>epoch!==aiEpoch;
 let timeout;
 try {
  const body={prompt:q};
  if(cancelled())throw{code:"cancelled"};
  timeout=setTimeout(()=>controller.abort(),45000);
  if(remoteOrigin){
   try{const data=await askRemote(remoteOrigin,q,controller.signal);if(cancelled())throw{code:"cancelled"};return data}
   catch(error){if(controller.signal.aborted)throw{code:cancelled()?"cancelled":"timeout"};throw error}
  }
  const request=async(url,payload)=>{try{return await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),credentials:"same-origin",signal:controller.signal})}catch{throw{code:cancelled()?"cancelled":controller.signal.aborted?"timeout":"net"}}};
  let r=await request("/api/ai",body);
  if(cancelled())throw{code:"cancelled"};
  if(r.status===401){
   void r.body?.cancel().catch(()=>{});
   const started=await request("/api/session",{start:true});
   if(cancelled())throw{code:"cancelled"};
   const status=await started.json().catch(()=>({}));
   if(cancelled())throw{code:"cancelled"};
   if(!started.ok||!status.authenticated)throw{code:started.status===400||started.status===401?"auth":started.status===429?"rate_limited":"srv",detail:status.error};
   setAISessionMode(status.publicAccess);
   r=await request("/api/ai",body);
  }
  if(cancelled())throw{code:"cancelled"};
  const j=await r.json().catch(()=>({}));if(cancelled())throw{code:"cancelled"};
  if(!r.ok)throw{code:r.status===401?"auth":r.status===429?"rate_limited":"srv",detail:j.error};
  if(!j.data||typeof j.data!=="object")throw{code:"srv",detail:"صيغة الاستجابة غير صالحة"};return j.data;
 }finally{clearTimeout(timeout);if(epoch===aiEpoch){aiPending=false;aiController=null;setAIBusy(false)}}
}
function resetAIState(){aiEpoch++;aiController?.abort();aiController=null;aiPending=false;setAIBusy(false);AF=null;for(const id of ["ai","airec","wrp","training-ai-answer"]){$(id)?.replaceChildren()}window.dispatchEvent(new Event("mdaar:ai-reset"))}

const aiErrorDetails={generation_too_large:"الطلب يتجاوز سعة التوليد المتاحة. اختصر تفاصيله ثم أعد المحاولة.",service_unconfigured:"خدمة مدار لم تُفعّل بعد.",auth_unconfigured:"خدمة الدخول لم تُفعّل بعد.",auth_required:"تعذر بدء جلسة مدار؛ حاول مجدداً.",rate_limit_unavailable:"الخدمة متوقفة مؤقتاً للحفاظ على حدود الاستخدام؛ حاول لاحقاً.",payload_too_large:"الطلب أكبر من الحجم المسموح.",origin_not_allowed:"تعذر التحقق من مصدر الطلب؛ افتح الموقع مباشرة وحاول مجدداً.",invalid_ai_response:"استجابة مدار غير قابلة للاستخدام؛ أعد المحاولة.",ai_unavailable:"خدمة مدار غير متاحة مؤقتاً. حاول لاحقاً."};
const eM=e=>{const detail=e?.detail?(aiErrorDetails[e.detail]||(/^[a-z_]+$/.test(e.detail)?"تعذر معالجة الطلب حالياً.":e.detail)):"";return '<div class="msg" role="alert">'+(e?.code==="cancelled"?"أُلغي الطلب ولم تُحفظ نتيجته.":e?.code==="auth"?(aiPublicAccess?"تعذر بدء جلسة مدار؛ حاول مجدداً.":"أدخل رمز الدعوة من الإعدادات لاستخدام مدار."):e?.code==="rate_limited"?"وصلت حد الاستخدام المتاح حالياً. انتظر قليلاً ثم أعد المحاولة.":e?.code==="timeout"?"استغرق إعداد الرد وقتاً طويلاً. أعد المحاولة.":e?.code==="net"?"ما فيه اتصال بالإنترنت أو بالخدمة، جرّب مرة ثانية.":"تعذر إكمال الطلب حالياً. حاول مجدداً.")+(detail?" <small>"+esc(detail)+"</small>":"")+"</div>"};

const N=v=>{const n=parseNumber(v);return Number.isFinite(n)?Math.min(100000,Math.max(0,n)):0},MS=()=>MEALS.map(m=>"<option"+($("ml").value===m?" selected":"")+">"+m+"</option>").join("");
let AF=null;
const FMTF='أرجع JSON فقط: {"name":"اسم الأكلة","note":"جملة قصيرة","components":[{"n":"المكون","a":الكمية رقم,"u":"جم أو مل","k":سعرات هذي الكمية,"p":بروتين جم,"c":كارب جم,"f":دهون جم}]}. قسّم الأكلة لكل مكوناتها الأساسية (مثلاً الكبسة: رز، دجاج، سلطة وصلصة) وكل مكون بكمية واقعية للحصة المعتادة: جم للأكل الصلب ومل للمشروبات والسوائل. القيم تخص الكمية المذكورة لا 100 جم، تقديرية وواقعية.';
const fa=i=>Math.min(5000,N($("ca"+i).value));
function tot(){const t=[0,0,0,0];AF.cs.forEach((c,i)=>{const a=fa(i);t[0]+=c.k*a;t[1]+=c.p*a;t[2]+=c.c*a;t[3]+=c.f*a});return t}
const cmt=()=>AF.cs.map((c,i)=>c.n+" "+Math.round(fa(i))+" "+c.u).join(" + ");
function afUp(){const t=tot();AF.cs.forEach((c,i)=>$("ck"+i).textContent=fmt(c.k*fa(i)));$("akk").textContent=fmt(t[0]);$("amc").innerHTML=MAC(t[1],t[2],t[3])}
function showFood(r,bd){if(!r||!Array.isArray(r.components)||!r.components.length)throw 0;
AF={name:r.name||"أكلة",cs:r.components.map(c=>{const a=N(c.a)||1,pp=N(c.p),cc=N(c.c),ff=N(c.f),ke=4*pp+4*cc+9*ff;let kk=N(c.k);if(ke>5&&(kk<=0||Math.abs(kk-ke)/ke>.2))kk=ke;return{n:c.n||"مكون",u:c.u==="مل"?"مل":"جم",a:a,k:kk/a,p:pp/a,c:cc/a,f:ff/a}})};
$("ai").innerHTML='<div class="aic"><span class="bd">'+bd+'</span>'+'<h4>'+esc(AF.name)+'</h4><p class="unit">'+esc(r.note||"")+'</p>'+AF.cs.map((c,i)=>'<div class="ing"><span style="flex:1">'+esc(c.n)+'</span><input id="ca'+i+'" type="text" inputmode="decimal" min="0" step="5" value="'+Math.round(c.a)+'" aria-label="كمية '+esc(c.n)+'"><b>'+c.u+'</b><span class="unit" style="min-width:70px;text-align:end"><b id="ck'+i+'"></b> سعرة</span></div>').join("")+'<div class="fk" style="text-align:start;margin-top:10px"><strong id="akk" style="display:inline"></strong> <small>سعرة للوجبة كاملة</small></div><div class="mcs" id="amc"></div><p class="unit">تقدير مدار تقريبي وغير مؤكد. صحّح المكونات والأوزان قبل الحفظ.</p><div class="gr"><select id="aml" aria-label="الوجبة">'+MS()+'</select><button class="mini" id="aadd" type="button">أضف لدفتري</button><button class="mini g" id="afav" type="button">⭐ احفظ للمفضلة</button></div></div>';afUp()}
async function aiFood(){const s=$("q").value.trim();if(!s){$("ai").innerHTML='<div class="msg">اكتب اسم الأكلة أول.</div>';return}
$("ai").innerHTML=LD;try{showFood(await ask('أنت خبير تغذية. المستخدم كتب اسم أكلة: "'+s+'" (قد تكون خليجية أو عربية أو عالمية وقد فيها خطأ إملائي). '+FMTF),"✦ نتيجة مدار")}catch(e){$("ai").innerHTML=eM(e)}}
$("aib").addEventListener("click",aiFood);
$("q").addEventListener("keydown",e=>{if(e.key==="Enter"&&!$("fres").querySelector(".fr")){e.preventDefault();aiFood()}});
$("ai").addEventListener("input",e=>{if(AF&&e.target.id&&e.target.id.startsWith("ca"))afUp()});
$("ai").addEventListener("click",e=>{const a=e.target.closest("#aadd"),v=e.target.closest("#afav");if(!AF)return;
if(a){const saved=addCustom(AF.name,"وجبة",tot(),1,$("aml").value,cmt());rd();if(saved)a.textContent="انضافت ✓"}
if(v){fav.push({n:AF.name,cm:cmt(),b:tot()});if(sv("mdaar_f",fav))v.textContent="تحفظت ⭐"}});
document.querySelector(".hint").addEventListener("click",e=>{const b=e.target.closest("[data-ex]");if(b){$("q").value=b.dataset.ex;aiFood()}});
const favRow=(x,i)=>'<div class="fr"><div class="fi"><b>⭐ '+esc(x.n)+'</b><span>'+esc(x.cm)+'</span><div class="mcs">'+MAC(x.b[1],x.b[2],x.b[3])+'</div></div><div class="fk"><strong>'+fmt(x.b[0])+'</strong><small>سعرة</small></div><button class="x" data-fd="'+i+'" aria-label="حذف">✕</button><button class="add" data-af="'+i+'" aria-label="أضف">+</button></div>';
$("fres").addEventListener("click",e=>{const a=e.target.closest("[data-af]"),d=e.target.closest("[data-fd]");
if(a){const x=fav[+a.dataset.af];addCustom(x.n,"وجبة",x.b,1,$("ml").value,x.cm);rd()}else if(d){fav.splice(+d.dataset.fd,1);sv("mdaar_f",fav);fr()}});
$("dl").addEventListener("click",e=>{const b=e.target.closest("[data-fv]");if(!b)return;const x=today()[+b.dataset.fv];fav.push({n:x.n,cm:x.cm||QT(x.q,x.u),b:[x.k,x.p,x.c,x.f]});if(sv("mdaar_f",fav))b.textContent="⭐"});
const ul=a=>"<ul>"+(a||[]).map(t=>"<li>"+esc(t)+"</li>").join("")+"</ul>",dk=i=>{const d=new Date();d.setDate(d.getDate()-i);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
$("wrb").addEventListener("click",async()=>{const D=[];for(let i=0;i<7;i++){const L=diary[dk(i)]||[];if(L.length)D.push({يوم:dk(i),سعرات:Math.round(L.reduce((a,x)=>a+x.k,0)),بروتين:Math.round(L.reduce((a,x)=>a+x.p,0)),كارب:Math.round(L.reduce((a,x)=>a+x.c,0)),دهون:Math.round(L.reduce((a,x)=>a+x.f,0)),أكل:L.slice(0,14).map(x=>x.n)})}
if(!D.length){$("wrp").innerHTML='<div class="msg">سجّل أكلك بالدفتر كم يوم وارجع هنا.</div>';return}
$("wrp").innerHTML=LD;try{const r=await ask('أنت مدرب تغذية ودود يتكلم بالعربي البسيط. هدف المستخدم اليومي: '+JSON.stringify(window.T||"غير محسوب")+'. أكله آخر أيام: '+JSON.stringify(D)+'. أوزانه: '+JSON.stringify(weights.slice().sort((a,b)=>a.d<b.d?-1:1).slice(-6))+'. حلل أسبوعه وأرجع JSON فقط: {"summary":"تقييم عام قصير","good":["نقاط إيجابية"],"improve":["نقاط تحتاج تحسين"],"tips":["نصايح عملية ومحددة"]}. بدون تشخيص طبي.');
$("wrp").innerHTML='<div class="aic" style="margin-top:12px"><span class="bd">✦ تقرير مدار</span><p>'+esc(r.summary||"")+'</p><h4 style="font-size:.95rem">اللي سويته زين</h4>'+ul(r.good)+'<h4 style="font-size:.95rem">يحتاج تحسين</h4>'+ul(r.improve)+'<h4 style="font-size:.95rem">نصايح لك</h4>'+ul(r.tips)+'</div>'}catch(e){$("wrp").innerHTML=eM(e)}});
$("cl").textContent="بياناتك محفوظة بهذا المتصفح فقط، لا تمسح بيانات المتصفح.";
const fixNum=normalizeNumber;
document.addEventListener("input",e=>{const t=e.target,m=t.tagName==="INPUT"&&t.getAttribute("inputmode");if(m==="decimal"||m==="numeric"){const v=fixNum(t.value);if(v!==t.value)t.value=v}},true);
$("wv").addEventListener("keydown",e=>{if(e.key==="Enter")$("wadd").click()});
fr();window.upd=()=>{if(!$("t-diary").hidden)rd();if(!$("t-meals").hidden)meals()};

function announce(message){const box=$("app-status");box.textContent=message;box.hidden=false;clearTimeout(announce.timer);announce.timer=setTimeout(()=>box.hidden=true,4500)}
$("manual-food").addEventListener("submit",e=>{e.preventDefault();const n=$("manual-name").value.trim(),q=parseNumber($("manual-grams").value),b=["k","p","c","f"].map(k=>parseNumber($("manual-"+k).value));if(!n||!Number.isFinite(q)||q<=0||q>5000||!b.every(v=>Number.isFinite(v)&&v>=0&&v<=1000)){$("manual-error").textContent="أدخل اسماً ووزناً من 0 إلى 5000 جم وقيماً غذائية صحيحة لكل 100 جم.";return}const saved=addCustom(n,"جم",b.map(v=>v/100),q,$("ml").value,"إدخال يدوي من الملصق الغذائي");$("manual-error").textContent=saved?"":"تعذر الحفظ؛ الإدخال باقٍ في الذاكرة. صدّر نسخة قبل إغلاق الصفحة.";rd();if(saved)announce("تمت إضافة الطعام إلى الدفتر")});
$("airb").addEventListener("click",async()=>{const name=$("airq").value.trim();if(!name)return;$("airec").innerHTML=LD;try{const result=await ask('اقترح طريقة طبخ بالعربية للوصفة: '+name+'. لا تختلق أرقاماً غذائية ولا تدّع اعتماداً. أرجع JSON {"name":"اسم","ingredients":["المكون والكمية المقترحة"],"steps":["الخطوة"],"allergens":["الحساسية المحتملة"]}.');$("airec").innerHTML='<div class="aic"><h3>'+esc(result.name)+'</h3><p class="notice">اقتراح طبخ مولّد؛ المقادير والحساسية تنتظر المراجعة ولا تتوفر له قيم غذائية موثقة.</p>'+ul(Array.isArray(result.ingredients)?result.ingredients:[])+'<ol>'+((Array.isArray(result.steps)?result.steps:[]).map(x=>'<li>'+esc(x)+'</li>').join(''))+'</ol><p>'+esc((Array.isArray(result.allergens)?result.allergens:[]).join('، '))+'</p></div>'}catch(e){$("airec").innerHTML=eM(e)}});
$("export-data").addEventListener("click",()=>{const data={version:1,exportedAt:new Date().toISOString(),data:{}};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith("mdaar_"))data.data[key]=ld(key,null)}Object.assign(data.data,{mdaar_d:diary,mdaar_w:weights,mdaar_f:fav,mdaar_t:window.T});const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="mdaar-data.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce("تم تجهيز نسخة بياناتك للتنزيل")});
$("delete-data").addEventListener("click",()=>{if(!window.confirm("هل تريد حذف بيانات مدار من هذا المتصفح؟ صدّر نسخة أولاً إن كنت تحتاجها. لا يمكن التراجع."))return;const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith("mdaar_"))keys.push(k)}keys.forEach(k=>localStorage.removeItem(k));diary={};weights=[];fav=[];window.T=null;clearRemoteSession();resetAIState();document.querySelectorAll("form").forEach(form=>form.reset());document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]),textarea').forEach(input=>input.value="");$("qty").value="1";$("manual-grams").value="100";$("out").hidden=true;$("empty").hidden=false;rd();rw();window.dispatchEvent(new CustomEvent("mdaar:change",{detail:{key:"all"}}));announce("حُذفت بيانات مدار من هذا المتصفح")});
const translations={"الحاسبة":"Calculator","دفتر الأكل":"Food diary","الوصفات":"Recipes","وجبات اليوم":"Meal planner","الوزن":"Weight","التمارين":"Training","التقدم":"Progress","الإعدادات":"Settings","كم سعرة تحتاج يومياً؟":"Your daily energy needs","كل خطوة تصنع فارقاً":"Every step makes a difference","الجنس":"Sex for this equation","ذكر":"Male","أنثى":"Female","العمر":"Age","سنة":"years","الطول":"Height","سم":"cm","كجم":"kg","هدفك":"Your goal","تنشيف":"Fat loss","ثبات":"Maintain","زيادة":"Gain","احسب سعراتي":"Calculate my target","مستوى النشاط":"Activity level","بروتين":"Protein","كارب":"Carbohydrate","دهون":"Fat","النتائج تقديرية بمعادلة Mifflin-St Jeor وليست بديلاً عن استشارة مختص، خصوصاً لو عندك حالة صحية.":"Mifflin-St Jeor estimates are not medical advice. Consult a qualified professional, especially with a health condition.","دفتر الأكل اليومي":"Your food diary","أكلت اليوم":"Today's log","أضف أكلة":"Add food","تتبع وزنك":"Track your weight","سجل الوزن":"Weight history","سجّل":"Log weight","الإعدادات والخصوصية":"Settings & privacy","تحكّم في بياناتك وفي ما تختار مشاركته.":"Control your data and what you choose to share.","مدار":"Mdaar","خدمات مدار":"Mdaar services","وصفات مدار":"Mdaar recipes","500 وجبة بمقاديرها وطريقة تحضيرها. ابحث عن وجبتك، عدّل الحصة وأضفها لدفترك.":"500 meals with ingredient weights and preparation. Find a meal, adjust the serving and add it to your diary.","✦ وصفة على ذوقك":"✦ A recipe to your taste","بيانات هذا الجهاز":"Data on this device","تصدير بياناتي JSON":"Export my data (JSON)","حذف بيانات مدار":"Delete Mdaar data","المكونات والطريقة":"Ingredients & method","المكونات":"Ingredients","الطريقة":"Method","أضف لدفتري":"Add to diary","احفظ في الدفتر":"Save to diary","إضافة يدوية من الملصق الغذائي":"Manual entry from a food label","اسم الطعام":"Food name","الوزن بالجرام":"Weight in grams","بروتين / 100 جم":"Protein / 100 g","كارب / 100 جم":"Carbohydrate / 100 g","دهون / 100 جم":"Fat / 100 g","سعرة / 100 جم":"kcal / 100 g","فطور":"Breakfast","غداء":"Lunch","عشاء":"Dinner","سناك":"Snack","الكل":"All","خليجي":"Gulf foods","عالمي":"International","وجبات مقترحة ليومك":"Meal ideas for your day","سجّل وزنك كل أسبوع وشوف تقدمك.":"Log your weight and follow the trend over time."};
Object.assign(translations,{
"الطلب يتجاوز سعة التوليد المتاحة. اختصر تفاصيله ثم أعد المحاولة.":"The request exceeds the available generation capacity. Shorten its details and try again.",
"وصلت الخطة بصيغة غير مكتملة. أعد المحاولة.":"The plan response was incomplete. Please try again.",
"تعذر إنشاء خطة مكتملة.":"Unable to create a complete plan.",
"تعذر إكمال الطلب حالياً. حاول مجدداً.":"Unable to complete the request right now. Please try again.",
"استغرق إعداد الرد وقتاً طويلاً. أعد المحاولة.":"The response took too long. Please try again.",
"وصلت حد الاستخدام المتاح حالياً. انتظر قليلاً ثم أعد المحاولة.":"The current usage limit was reached. Wait a little and try again.",
"خدمة مدار غير متاحة مؤقتاً. حاول لاحقاً.":"Mdaar is temporarily unavailable. Try again later.",
"استجابة مدار غير قابلة للاستخدام؛ أعد المحاولة.":"The response could not be used. Please try again.",
"هذه خطة مثال على 2000 سعرة وليست احتياجك الشخصي. احسب احتياجك من الحاسبة لتخصيصها.":"This is a 2,000 kcal example, not your personal energy requirement. Use the calculator to personalise it.",
"مدار متاح دون رمز دعوة. تبدأ جلسة آمنة تلقائياً عند إرسال طلبك، وتبقى حدود الاستخدام سارية.":"Mdaar is available without an invitation code. A secure session starts automatically when you send a request. Usage limits still apply.",
"تعذر بدء جلسة مدار؛ حاول مجدداً.":"Unable to start a Mdaar session. Please try again.",

"تجاوز إلى المحتوى":"Skip to content",
"أدخل بياناتك واختر هدفك، وتطلع لك السعرات اليومية وتوزيع البروتين والكارب والدهون.":"Enter your details and goal for an estimate of daily calories, protein, carbohydrate and fat.",
"خامل، شغل مكتبي بدون تمرين":"Sedentary: desk work, little exercise",
"خفيف، تمرين 1 إلى 3 أيام بالأسبوع":"Light: exercise 1–3 days per week",
"متوسط، تمرين 3 إلى 5 أيام":"Moderate: exercise 3–5 days per week",
"عالي، تمرين 6 إلى 7 أيام":"Active: exercise 6–7 days per week",
"عالي جداً، تمرين شاق أو عمل بدني":"Very active: demanding exercise or physical work",
"للبالغين 18 سنة فأكثر. للحمل والرضاعة والحالات الصحية واضطرابات الأكل: راجع مختصاً بدلاً من الاعتماد على هذه الأداة.":"For adults aged 18+. If pregnant, breastfeeding, living with a health condition or an eating disorder, consult a professional rather than relying on this tool.",
"عبّ بياناتك واضغط «احسب سعراتي» وتطلع نتيجتك هنا.":"Enter your details and select Calculate my target to see your estimate.",
"سعرة حرارية باليوم":"kcal per day","الحرق الأساسي (BMR)":"Basal metabolic rate (BMR)","إجمالي الحرق مع نشاطك":"Estimated daily energy expenditure",
"دوّن كل اللي تاكله وشوف كم باقي لك من سعراتك وماكروزك.":"Log your food and see your remaining calories and macros.",
"وجبات رئيسية":"Main meals","نشويات":"Starches","ألبان ودهون":"Dairy & fats","فواكه وخضار":"Fruit & vegetables","مشروبات":"Drinks","حلويات وسناك":"Desserts & snacks","وصفات":"Recipes","⭐ المفضلة":"★ Favorites",
"✦ ابحث مع مدار عن أي أكلة":"✦ Estimate a food with Mdaar",
"اكتب اسم الأكلة بالأعلى ثم اضغط الزر، أو جرّب:":"Enter a food above, then select the Mdaar button. Examples:",
"قاعدة الأطعمة الأصلية قيمها تقريبية وتنتظر توثيق المصادر. راجع الملصق الغذائي عند توفره.":"The original food database contains approximate values awaiting source verification. Use the food label when available.",
"أدخل القيم لكل 100 جم من الملصق؛ نحسب حصتك بالجرام.":"Enter label values per 100 g; we calculate your portion in grams.",
"توزيع جاهز على 4 وجبات يقارب سعراتك وهدفك. غيّر أي وجبة، وأضفها لدفترك بضغطة.":"Explore four daily meal ideas. Swap a meal and add it to your diary. Targets and values remain estimates.",
"✦ تقريري الأسبوعي":"✦ My weekly summary","يحلل أكلك ووزنك آخر 7 أيام ويعطيك نصايح مخصصة.":"Review your food and weight entries from the past seven days, with optional Mdaar feedback.","حلّل أسبوعي":"Review my week",
"وصفات بسيطة بسعراتها وماكروزها للحصة. اختر الحصص وأضفها لدفتر أكلك بضغطة.":"Browse original recipe ideas. Nutrition estimates are pending review. Select portions and add them to your diary.",
"حلا صحي":"Dessert","✦ اطلب أي وصفة مع مدار":"✦ Request a Mdaar cooking idea","اقترح وصفة":"Suggest a recipe",
"الوصفات الأصلية محفوظة كما وردت. المقادير والقيم الغذائية تنتظر التحقق؛ اقتراحات Mdaar لا تعني اعتماداً غذائياً.":"Original recipes are preserved. Ingredients and nutrition values await verification; Mdaar suggestions are not nutritional approval.",
"عند إرسال طلبك، تُرسل البيانات اللازمة له إلى مزوّد خدمة خارجي لمعالجتها. لا تُرسل سجلاتك بمجرد فتح الموقع. تفاصيل المعالجة في سياسة الخصوصية.":"When you send a request, the necessary data is sent to an external service provider. Opening the site does not send your records. See the privacy policy for details.",
"رمز دعوة مدار":"Mdaar invitation code","تسجيل الدخول":"Sign in","تسجيل الخروج":"Sign out",
"تحتاج خدمة مدار إلى دعوة. أدوات الحساب والتسجيل تعمل محلياً دون دخول.":"Mdaar requires an invitation. Calculators and local logs work without signing in.",
"تفاصيل سياسة الخصوصية (مسودة للمراجعة القانونية)":"Privacy policy details (draft for legal review)",
"سجل الطعام والوزن والتمارين محفوظ في هذا المتصفح. لا توجد مزامنة بين الأجهزة، ولا نسخة احتياطية على حساب سحابي.":"Food, weight and training logs are stored in this browser. There is no cross-device sync or account backup.",
"احفظ نسخة قبل مسح بيانات المتصفح. الحذف يتطلب تأكيدك ولا يمس بيانات المواقع الأخرى.":"Export a backup before clearing browser data. Deletion requires confirmation and does not affect other sites.",
"© 2026 Mdaar21 · خطوة واعية، كل يوم":"© 2026 Mdaar21 · A mindful step, every day",
"بياناتك محفوظة بهذا المتصفح فقط، لا تمسح بيانات المتصفح.":"Your data is stored only in this browser. Export a backup before clearing browser data.",
"بانتظار المراجعة الغذائية":"Nutrition review pending","مدار يشتغل على طلبك...":"Processing your Mdaar request…",
"ما أضفت شيء اليوم. ابحث عن أكلتك أو وصفة وأضفها.":"Nothing logged today. Search for a food or add an entry manually.",
"ما سجلت وزنك للحين.":"No weight entries yet.","سجّل وزنين على الأقل لرسم الخط":"Log at least two weights to see a chart",
"ما عندك مفضلة للحين. احفظ أي أكلة بضغطة ⭐.":"No favorites yet. Save a food with the star button.",
"ما فيه وصفات بهذا الاسم.":"No recipes match this search.","احسب سعراتك أولاً من تبويب «الحاسبة» وترجع هنا.":"Calculate your target in the Calculator first, then return here.",
"ما لقيتها بقائمتنا. اضغط «ابحث مع مدار» وبيجيب لك سعراتها وماكروزها بالجرامات.":"No match in the original list. You can add label values manually or request an optional Mdaar estimate.",
"الاقتراحات أمثلة تقريبية، عدّل الكميات حسب شبعك.":"These are approximate examples. Adjust portions to your needs and seek advice when appropriate.",
"غيّر الوجبة":"Swap meal","انضافت ✓":"Added ✓","تحفظت ⭐":"Saved ★","المشاركة اختيارية.":"Sharing is optional.","أُلغي الطلب ولم تُحفظ نتيجته.":"The request was cancelled and its result was not saved.",
"أدخل رمز الدعوة من الإعدادات لاستخدام مدار.":"Enter your invitation code in Settings to use Mdaar.",
"وصلت الحد اليومي للبحث الذكي، جرّب بكرة.":"The Mdaar request limit has been reached. Try again later.",
"ما فيه اتصال بالإنترنت أو بالخدمة، جرّب مرة ثانية.":"The service cannot be reached. Check your connection and try again.",
"ما قدرت أحلل الطلب، جرّب كتابة ثانية.":"This request could not be processed. Please try again.",
"العمر يجب أن يكون عدداً صحيحاً من 18 إلى 90 سنة. الحاسبة للبالغين فقط.":"Age must be a whole number from 18 to 90. This calculator is for adults only.",
"الوزن يجب أن يكون من 35 إلى 250 كجم.":"Weight must be between 35 and 250 kg.","الطول يجب أن يكون من 120 إلى 230 سم.":"Height must be between 120 and 230 cm.",
"اختر النشاط والهدف من الخيارات المتاحة.":"Choose one of the available activity levels and goals.",
"اكتب وزنك بالكجم، رقم من 30 إلى 300.":"Enter a weight between 30 and 300 kg.",
"أدخل اسماً ووزناً من 0 إلى 5000 جم وقيماً غذائية صحيحة لكل 100 جم.":"Enter a name, a weight greater than zero and up to 5000 g, and valid nutrition values per 100 g.",
"تمت إضافة الطعام إلى الدفتر":"Food added to your diary","أدخل وزناً أكبر من صفر وحتى 5000 جم.":"Enter a weight greater than zero and up to 5000 g.",
"مخطط تغير الوزن":"Weight trend chart","بحث":"Search","الكمية":"Quantity","الوجبة":"Meal","الوزن":"Weight","أضف":"Add","أنقص":"Decrease","زد":"Increase","حذف":"Delete","للمفضلة":"Save as favorite","اسم الوصفة":"Recipe name","تفضيلاتك":"Food preferences","إدخال يدوي من الملصق الغذائي":"Manual food label entry",
"ابحث عن وصفة أو مكوّن...":"Search for a recipe or ingredient…","ابحث: كبسة، تمر، باستا، ستيك...":"Search foods: rice, chicken, pasta…","وزنك اليوم بالكجم":"Today's weight in kg","مثال: كبسة دجاج، سلطة سيزر، عصيدة...":"Example: chicken rice, Caesar salad, porridge…","أكلات تحبها أو ما تحبها (اختياري): مثلاً ما أحب السمك":"Food likes or dislikes (optional)",
"تقدير أولي قابل للمراجعة، وليس وصفة علاجية. احتياج السوائل يختلف مع الجو والنشاط والحالة الصحية.":"This is a starting estimate, not a prescription. Fluid needs vary with weather, activity and health.",
"خدمة مدار لم تُفعّل بعد.":"Mdaar is not enabled yet.","خدمة الدعوات لم تُفعّل بعد.":"Invitations are not enabled yet.","تعذر معالجة الطلب حالياً.":"This request cannot be processed right now.","تم تسجيل الخروج.":"Signed out.","رمز الدعوة غير صحيح.":"The invitation code is not valid.","تعذر الاتصال بخدمة الدخول.":"Unable to reach the sign-in service.","أدخل رمز دعوة صالحاً من 12 حرفاً على الأقل.":"Enter a valid invitation code of at least 12 characters.",
"تم تسجيل الدخول. أرسل طلبك مباشرة.":"Signed in. Send your request directly.","خدمة الدخول غير متاحة أو لم تُضبط بعد. راجع مسؤول الموقع.":"Sign-in is unavailable or not configured yet. Contact the site administrator."
});
const originalText=new WeakMap(),originalAttributes=new WeakMap();
const t=(ar,en)=>document.documentElement.lang==="en"?en:ar;
function translateText(text){const key=text.trim();if(translations[key])return text.replace(key,translations[key]);return text
 .replace(/^بروتين ([\d.,]+) جم$/,'Protein $1 g').replace(/^كارب ([\d.,]+) جم$/,'Carbohydrate $1 g').replace(/^دهون ([\d.,]+) جم$/,'Fat $1 g')
 .replace(/^([\d.,]+) جم$/,'$1 g').replace(/^([\d.,]+) كجم$/,'$1 kg').replace(/^([\d.,]+) دقيقة$/,'$1 min').replace(/^([\d.,]+) وصفة$/,'$1 recipes')
 .replace(/^سعرة للحصة$/,'kcal per serving').replace(/^سعرة متبقية$/,'kcal remaining').replace(/^فوق هدفك$/,'above your target').replace(/^سعرة$/,'kcal')
 .replace(/^الحصة: /,'Serving: ').replace(/^آخر وزن: ([\d.,]+) كجم$/,'Latest weight: $1 kg');}
function applyLanguage(){const en=document.documentElement.lang==="en";languageObserver?.disconnect();
 document.querySelectorAll('option:not([value])').forEach(option=>option.setAttribute('value',option.value));
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){if(["SCRIPT","STYLE"].includes(node.parentElement?.tagName)||node.parentElement?.id==="language-toggle")continue;const before=node.textContent,record=originalText.get(node),base=record&&before===record.translated?record.original:before;const next=en?translateText(base):base;if(next!==base)originalText.set(node,{original:base,translated:next});if(before!==next)node.textContent=next;}
 document.querySelectorAll('[placeholder],[aria-label]').forEach(el=>{let record=originalAttributes.get(el)||{};for(const attr of ['placeholder','aria-label']){if(!el.hasAttribute(attr))continue;const value=el.getAttribute(attr),old=record[attr],base=old&&value===old.translated?old.original:value,next=en?translateText(base):base;if(next!==base)record[attr]={original:base,translated:next};if(value!==next)el.setAttribute(attr,next)}originalAttributes.set(el,record)});
 languageObserver?.observe(document.body,{childList:true,subtree:true,characterData:true});
}
const languageObserver=new MutationObserver(()=>applyLanguage());
function setLanguage(language){document.documentElement.lang=language;document.documentElement.dir=language==="en"?"ltr":"rtl";$("language-toggle").textContent=language==="en"?"العربية":"EN";applyLanguage();sv("mdaar_language",language);window.dispatchEvent(new CustomEvent("mdaar:language",{detail:language}))}
$("language-toggle").addEventListener("click",()=>setLanguage(document.documentElement.lang==="ar"?"en":"ar"));
window.Mdaar={serviceAvailable,cancelRequest:resetAIState,getTarget:()=>window.T,getDiary:()=>diary,getWeights:()=>weights,addCustom,show,ask,esc,fmt,save:sv,load:ld,announce,refresh:()=>{rd();rw()},getLanguage:()=>document.documentElement.lang,t};
window.dispatchEvent(new Event("mdaar:ready"));
setLanguage(ld("mdaar_language","ar")==="en"?"en":"ar");

if(remoteOrigin)setAISessionMode(true);
else if(serviceAvailable)fetch("/api/session",{credentials:"same-origin",signal:AbortSignal.timeout(10000)}).then(async response=>{if(response.ok)setAISessionMode((await response.json()).publicAccess)}).catch(()=>{});

if(!serviceAvailable){$("ai-invite-controls").hidden=true;$("ai-public-access").hidden=false;$("ai-public-access").textContent="الخدمات المتصلة غير متاحة على هذا الرابط حالياً. أدوات الحساب والتسجيل تعمل.";}

$("ai-login").addEventListener("click",async()=>{const input=$("ai-access-code"),code=input.value;input.value="";if(code.length<12){$("ai-session-status").textContent="أدخل رمز دعوة صالحاً من 12 حرفاً على الأقل.";return}$("ai-login").disabled=true;try{const response=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({code}),signal:AbortSignal.timeout(15000)});$("ai-session-status").textContent=response.ok?"تم تسجيل الدخول. أرسل طلبك مباشرة.":response.status===401?"رمز الدعوة غير صحيح.":"خدمة الدخول غير متاحة أو لم تُضبط بعد. راجع مسؤول الموقع."}catch{$("ai-session-status").textContent="تعذر الاتصال بخدمة الدخول."}finally{$("ai-login").disabled=false}});
$("ai-logout").addEventListener("click",async()=>{try{const response=await fetch("/api/session",{method:"DELETE",credentials:"same-origin",signal:AbortSignal.timeout(15000)});$("ai-session-status").textContent=response.ok?"تم تسجيل الخروج.":"تعذر تسجيل الخروج. حاول مرة أخرى."}catch{$("ai-session-status").textContent="تعذر الاتصال بخدمة الدخول."}});

$("dl").addEventListener("change",e=>{const input=e.target.closest("[data-gram]");if(!input)return;const q=parseNumber(input.value),x=today()[Number(input.dataset.gram)];if(!x||!Number.isFinite(q)||q<=0||q>5000){announce("أدخل وزناً أكبر من صفر وحتى 5000 جم.");rd();return}x.q=q;["k","p","c","f"].forEach((key,i)=>x[key]=x.b[i]*q);sv("mdaar_d",diary);rd()});
