#!/usr/bin/env python3
"""Build the editable, source-aligned Arabic guide; no external network required.

Usage: python3 scripts/build-book.py [--html-only]
Requires training data already checked into public/data and Chromium for PDF.
The original PDF is never overwritten. See docs/pdf-review.md for limitations.
"""
import argparse
from functools import partial
import html
import hashlib
import http.server
import json
from pathlib import Path
import shutil
import threading

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / 'docs/book'
ARTIFACTS = ROOT / 'docs/artifacts'
DATA = json.loads((ROOT / 'public/data/training-programs.json').read_text())
FIGURES = json.loads((BOOK / 'figures/manifest.json').read_text())
IDENTITY = json.loads((BOOK / 'identity/manifest.json').read_text())
if hashlib.sha256((ROOT / FIGURES['source']).read_bytes()).hexdigest() != FIGURES['sourceSha256']:
    raise SystemExit('Original PDF changed; review image and exercise-link mapping before rebuilding.')
for asset in [*IDENTITY['covers'].values(), IDENTITY['logo']]:
    if hashlib.sha256((BOOK/asset['path']).read_bytes()).hexdigest() != asset['sha256']:
        raise SystemExit(f"Unexpected original identity asset change: {asset['path']}")
EX = DATA['exercises']
PROGRAMS = DATA['programs']
SITE = 'https://mdaar21-global.netlify.app'
PAGES = []
COVER_PAGES = {1,7,8,10,14,16,21,22,24,27,29}
COVER_NEXT = {1:2,7:8,8:9,10:11,14:15,16:17,21:22,22:23,24:25,27:28,29:30}

def write_site_qr():
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing, Rect
    from reportlab.graphics import renderSVG
    from reportlab.lib.colors import white
    qr = QrCodeWidget(SITE, barLevel='M', barBorder=4)
    x0,y0,x1,y1 = qr.getBounds()
    drawing = Drawing(160,160,transform=[160/(x1-x0),0,0,160/(y1-y0),0,0])
    drawing.add(Rect(x0,y0,x1-x0,y1-y0,fillColor=white,strokeColor=None))
    drawing.add(qr)
    (BOOK/'site-qr.svg').write_text(renderSVG.drawToString(drawing))

write_site_qr()

def esc(s):
    return html.escape(str(s), quote=True)

def page(title, body, category='دليل التدريب', classes='', eyebrow='MDAAR21 · بروتوكول التحول'):
    n = len(PAGES) + 1
    if n in COVER_PAGES:
        next_page=COVER_NEXT[n]
        next_label='ابدأ البروتوكول' if n==1 else ('استكشف البرنامج' if n in {7,21} else 'جدول التمرين')
        PAGES.append(f'''<section class="page source-cover {classes}" id="p{n}" aria-label="غلاف صفحة {n}: {esc(title)}">
        <img class="original-cover" src="identity/cover-{n:02}.svg" alt="غلاف مدار الأصلي: {esc(title)}. هوية سوداء وذهبية وشعار مدار الأصلي، مع الرسوم الأصلية للعضلات في أغلفة التمرين.">
        <div class="cover-copy sr-only"><h1>{title}</h1><p>{esc(category)} · {esc(eyebrow)}</p>{body}</div>
        <nav class="cover-navigation" aria-label="تنقل الغلاف"><a href="#p4">الفهرس ↗</a><a href="#p{next_page}">{next_label} ←</a></nav>
        <footer class="footer sr-only"><a href="#p4">الفهرس</a><span>{n} / 34</span><span>نسخة مراجعة · © 2026 Mdaar21</span></footer></section>''')
        return
    PAGES.append(f'''<section class="page {classes}" id="p{n}" aria-label="صفحة {n}: {esc(title)}">
    <header><span class="brand"><img src="identity/source-07-00.png" alt="شعار مدار الأصلي"> مدار</span><span>{esc(category)}</span></header>
    <p class="eyebrow">{esc(eyebrow)}</p><h1>{title}</h1>{body}
    <footer class="footer"><a href="#p4">الفهرس ↗</a><span class="en">{n} / 34</span><span>نسخة مراجعة · © 2026 Mdaar21</span></footer></section>''')

def card(title, text):
    return f'<div class="card"><h2>{title}</h2>{text}</div>'

def note(text, warning=False):
    return f'<aside class="callout {"warning" if warning else ""}">{text}</aside>'

def schedule(key):
    return '<div class="week">' + ''.join(f'<div class="day"><span>اليوم {i+1}</span><b>{esc(d["en"])}</b>{esc(d["name"])}</div>' for i,d in enumerate(PROGRAMS[key]['days'])) + '</div>'

def workout(key, index, title):
    d=PROGRAMS[key]['days'][index]
    source_page={23:15,25:17,28:15,30:17}.get(d['sourcePage'],d['sourcePage'])
    rows=[]
    for i,eid in enumerate(d['exercises']):
        e=EX[eid]
        alternatives=' / '.join(a['name'] for a in e['alternatives']) or 'لا يوجد بديل محدد'
        reps='45–90 s' if eid=='plank' else '8–12'
        fig=FIGURES['pages'][str(source_page)][eid]
        if source_page==11 and eid=='seated-row': fig=FIGURES['exercises'][eid]
        main_url=fig['videoLinks'][0]['url']
        rows.append(f'<tr><td><a href="{esc(main_url)}"><b>{i+1}. {esc(e["name"])}</b><span class="en">{esc(e["en"])}</span></a></td><td class="dose">3</td><td class="dose">{reps}</td><td><span class="en">{esc(alternatives)}</span></td></tr>')
    cards=[]
    for i,eid in enumerate(d['exercises']):
        e=EX[eid]
        # The complete, unchanged source15 rendering of Seated Row avoids a
        # clipped dose box in source11. The source ordinal remains visible.
        fig=FIGURES['pages'][str(source_page)][eid]
        if source_page==11 and eid=='seated-row': fig=FIGURES['exercises'][eid]
        import hashlib
        if hashlib.sha256((BOOK/fig['path']).read_bytes()).hexdigest()!=fig['sha256']:
            raise SystemExit(f'Unexpected source figure change: {fig["path"]}')
        alts=' / '.join(a['name'] for a in e['alternatives']) or 'لا يوجد بديل محدد'
        alt=f'{e["name"]} / {e["en"]}. البديل: {alts}. 3 مجموعات، 90 ثانية راحة. التكرار: '+('45/60/90 ثانية للبلانك' if eid=='plank' else '8/10/12 مع ترتيب غير محسوم')
        hotspots=[]
        captions=[]
        for link_index,link in enumerate(fig['videoLinks']):
            label='شرح التمرين' if link_index==0 else 'شرح البديل'
            left,top,width,height=link['rectPercent']
            hotspots.append(f'<a class="exercise-hotspot" href="{esc(link["url"])}" aria-label="{label}: {esc(e["name"])}" style="left:{left}%;top:{top}%;width:{width}%;height:{height}%"></a>')
            captions.append(f'<a href="{esc(link["url"])}">{label} ↗</a>')
        cards.append(f'<figure><div class="exercise-image"><img src="{esc(fig["path"])}" width="{fig["width"]}" height="{fig["height"]}" alt="{esc(alt)}">{"".join(hotspots)}</div><figcaption>{i+1}. {esc(e["name"])} <span class="en">{esc(e["en"])}</span><span class="exercise-video-links">{"".join(captions)}</span></figcaption></figure>')
    content=f'<p class="exercise-caption">{esc(PROGRAMS[key]["name"])} · اليوم {index+1} · اضغط صورة التمرين أو البديل أو رابط الشرح أسفل البطاقة.</p><div class="figure-grid">{"".join(cards)}</div>'
    content += '<details class="accessible-table"><summary>جدول نصي قابل للقراءة والمراجعة</summary><table class="exercise-table"><thead><tr><th>التمرين</th><th>المجموعات</th><th>التكرار*</th><th>التمرين البديل</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table></details>'
    content += '<p class="small muted figure-note">الراحة: 90 ثانية، وRIR من <bdi dir="ltr">1–3</bdi>. التكرارات المطبوعة <bdi dir="ltr">8 · 10 · 12</bdi>، والمقدمة تعكس ترتيبها؛ لم نحسم الترتيب. البلانك <bdi dir="ltr">45 · 60 · 90</bdi> ثانية. أرقام البطاقات تخص مواضعها الأصلية. البدائل والتقنية تحتاج ملاءمة مع مدرب مؤهل.</p>'
    page(title,content,category=PROGRAMS[key]['name'],classes='workout')

def intro(title, english, groups, source_pages, next_page):
    content=f'<p class="intro">{groups}</p><div class="rule"></div><div class="grid"><div class="card"><div class="stat">03</div><h2>المجموعات</h2><p>سجّل الوزن والتكرارات الفعلية لكل مجموعة، لا أفضل مجموعة فقط.</p></div><div class="card"><div class="stat">1–3</div><h2>تكرارات احتياطية</h2><p>تعني تقدير ما كان ممكناً أداؤه مع بقاء التقنية سليمة، وليست دعوة للوصول إلى الألم.</p></div></div>'
    content+=note('ابدأ بحمل تستطيع التحكم فيه. اطلب من مدرب مؤهل تعليم الحركة الجديدة، خصوصاً السكوات والرفعة الرومانية والضغط الحر. لا تعتمد على اسم التمرين أو الصورة وحدها لتعلم الأداء.')
    content+=f'<p class="small muted">تعرّف على التمارين وبدائلها في الجدول التالي، وتعلّم الأداء الصحيح مع مدرب مؤهل.</p><p><a class="pill" href="#p{next_page}">جدول {esc(english)} ← صفحة {next_page}</a></p>'
    page(title,content,eyebrow=english.upper())

def rest(key,index,next_page,next_name):
    content='<p class="intro">الاستشفاء جزء من التدريب. راقب تعبك وجودة نومك وقدرتك على أداء اليوم التالي.</p>'
    content+=card('01 · حركة خفيفة','<ul><li>يمكنك المشي الخفيف 20–30 دقيقة والتمدد 5–10 دقائق، بما يناسب حالتك.</li><li>يمكن استخدام الفوم رولر عند الراحة معه؛ لا تدلك موضع إصابة أو ألم حاد.</li><li>اجعل الحركة اختيارية وبشدة مناسبة لحالتك. لا نفرض أن التمدد أو التدليك يسرّعان الاستشفاء للجميع.</li></ul>')
    content+=card('02 · نوم منتظم','<p>استهدف 7–9 ساعات من النوم للبالغين. ثبّت موعد النوم والاستيقاظ قدر الإمكان، وقلّل الضوء والشاشات عندما تؤثر في نومك. جودة النوم واحتياجه يختلفان.</p>')
    content+=card('03 · غذاء وماء','<p>أكمل هدفك الغذائي الملائم لحالتك، ووزّع وجباتك بما يناسبك. اشرب بانتظام وفق العطش والجو والنشاط؛ القيود الطبية على السوائل تستلزم توجيه المختص. لا يعني يوم الراحة إلغاء التغذية أو تعويضها بحمية قاسية.</p>')
    content+=f'<p><a class="pill" href="#p{next_page}">التالي: {esc(next_name)} · صفحة {next_page}</a></p><p class="small muted">برنامج {key} أيام · اليوم {index+1}. راعِ الاستشفاء قبل الانتقال إلى الحصة التالية.</p>'
    page('يوم الراحة',content,category=f'برنامج {key} أيام · اليوم {index+1}',eyebrow='RECOVERY · SLEEP · NUTRITION')

def log(key,indices,title):
    rows=[]
    for index in indices:
        d=PROGRAMS[key]['days'][index]
        rows.append(f'<tr class="group"><td colspan="5">اليوم {index+1} · {esc(d["name"])} · <span class="en">{esc(d["en"])}</span></td></tr>')
        for eid in d['exercises']:
            rows.append(f'<tr><td><span class="en">{esc(EX[eid]["en"])}</span></td><td></td><td></td><td></td><td></td></tr>')
    content='<p class="small">اكتب الوزن × التكرارات الفعلية لكل مجموعة، ثم RIR. مثال: 40 كجم × 10، RIR 2. للبلانك اكتب المدة بالثواني. استخدم جدولاً جديداً كل أربعة أسابيع.</p>'
    content+='<table class="log-table"><thead><tr><th>التمرين</th><th>الأسبوع 1</th><th>الأسبوع 2</th><th>الأسبوع 3</th><th>الأسبوع 4</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table>'
    content+='<p class="small muted">التاريخ: __________ &nbsp; ملاحظات الألم/الإجهاد/التعديلات: ____________________</p>'
    page(title,content,category=f'برنامج {key} أيام · سجل قابل للطباعة',classes='logs')

page('بروتوكول التحول','<div class="orbit" aria-hidden="true"></div><div class="brand">مدار</div><p class="intro">تدريب · تغذية · متابعة</p><div class="rule"></div><p>برنامجا 4 و5 أيام<br>جداول واضحة ومصدر قابل للصيانة</p><p><span class="pill">طبعة مراجعة تحريرية — غير معتمدة مهنياً</span></p><p class="small">المحتوى للتوعية العامة للبالغين. لا يقدّم تشخيصاً أو وعداً بنتيجة.</p>',category='MDAAR21',classes='cover',eyebrow='TRAIN · FUEL · TRANSFORM')
page('كيف تستخدم الكتاب','<div class="grid">'+card('1 · احسب نقطة البداية','<p>الحاسبة تقدّر احتياج الطاقة من بياناتك. النتيجة بداية للمراجعة، وليست وصفة طبية أو قياساً فعلياً لحرقك.</p>')+card('2 · اختر برنامجاً واحداً','<p>اختر برنامج 4 أو 5 أيام وفق وقتك وخبرتك وقدرتك على الاستشفاء. لا تجمع البرنامجين.</p>')+card('3 · نفّذ وسجّل','<p>سخّن، تعلّم التقنية، ثم سجّل كل مجموعة والوزن والتكرارات وRIR. لا تزد الحمل على حساب التحكم.</p>')+card('4 · راقب الاتجاه','<p>قارن الوزن والقياسات والأداء في ظروف متقاربة، وراجع الاتجاه عبر أسابيع بدلاً من الحكم على يوم واحد.</p>')+'</div>'+note('هذا الدليل لا يغني عن الطبيب أو المدرب أو اختصاصي التغذية. من هم دون 18 عاماً، والحوامل، ومن لديهم إصابة أو مرض أو أعراض غير معتادة يحتاجون توجيهاً فردياً. توقف عن التمرين واطلب المساعدة المناسبة عند ألم حاد أو دوخة أو أعراض مقلقة.',True)+'<h2>المصطلحات الغذائية</h2><p>السعرات وحدة للطاقة. البروتين والكربوهيدرات والدهون مغذيات كبرى تؤدي وظائف متعددة؛ لا نختزلها إلى «بناء» أو «طاقة سريعة وبطيئة» على نحو قطعي.</p>')
page('أدوات مدار الرقمية',f'<p class="intro">حاسبة السعرات ودفتر الأكل، مع تقديرات قابلة للمراجعة قبل الحفظ.</p><div class="grid">'+card('الحاسبة والماكروز','<p>أدخل بيانات صحيحة، واقرأ حدود المعادلة. تُحسب السعرات والماكروز باستخدام معادلة واضحة.</p>')+card('دفتر الأكل والبحث النصي','<p>اكتب اسم الأكلة أو أدخل بيانات الملصق الغذائي. عدّل وزن الحصة والمكونات قبل الإضافة؛ تقدير الذكاء الاصطناعي من الوصف تقريبي.</p>')+card('وصفات وخطط','<p>ميّز القيم المحسوبة من بيانات موثقة عن الوصفات التي تنتظر المراجعة. راجع المكونات والحساسية بنفسك.</p>')+card('خصوصيتك','<p>راجع الموافقة قبل إرسال طلب نصي إلى خدمة خارجية. التخزين المحلي لا يعني وجود نسخة احتياطية أو مزامنة.</p>')+'</div>'+f'<div class="qr"><a href="{SITE}"><img src="site-qr.svg" alt="رمز QR لموقع مدار"></a><div><h2>موقع مدار</h2><a class="url" href="{SITE}">{SITE}</a><p class="small muted">امسح الرمز أو اضغط الرابط لفتح موقع مدار.</p></div></div>')
toc=[('البدء والسلامة',2),('الأدوات الرقمية والخصوصية',3),('اختيار البرنامج والجدول الأسبوعي',5),('التسخين والتقدم واختيار الأوزان',6),('برنامج 5 أيام',7),('الدفع · Push',9),('السحب · Pull',11),('الأرجل · Legs',12),('الجزء العلوي · Upper',15),('الجزء السفلي · Lower',17),('سجل 5 أيام',19),('برنامج 4 أيام',21),('Upper A / Lower A',23),('Upper B / Lower B',28),('سجل 4 أيام',33)]
page('المحتويات','<nav class="toc" aria-label="فهرس قابل للنقر">'+''.join(f'<a href="#p{n}"><span>{title}</span><b>{n:02}</b></a>' for title,n in toc)+'</nav>'+note('أرقام هذا الفهرس تخص الطبعة الحالية ذات 34 صفحة. كل عنوان قابل للنقر. إحالات الصفحات القديمة داخل النسخة الأصلية لا تُستخدم للتنقل هنا.'))
page('برنامج واحد يناسب وقتك','<p class="intro">اختر جدول التدريب الذي يناسب أيامك وخبرتك وقدرتك على الاستشفاء.</p><div class="grid">'+card('5 أيام تدريب','<p>دفع ← سحب ← أرجل ← راحة ← علوي ← سفلي ← راحة.</p><p>عدد أيام التدريب وحده لا يجعل البرنامج مناسباً لكل مبتدئ. الحجم والاستشفاء والخبرة تحتاج مراجعة.</p><a class="pill" href="#p7">ابدأ من صفحة 7</a>')+card('4 أيام تدريب','<p>علوي A ← سفلي A ← راحة ← علوي B ← سفلي B ← راحة ← راحة.</p><p>يتكرر جدول العلوي والسفلي خلال الأسبوع؛ الحرفان A وB يحددان موعد الحصة وسجلها.</p><a class="pill" href="#p21">ابدأ من صفحة 21</a>')+'</div>'+note('أيام الأسبوع مرنة؛ حافظ على ترتيب أيام التدريب والراحة عندما تنقلها إلى تقويمك. لا تعوّض الحصة الفائتة بدمج حصتين ثقيلتين تلقائياً.')+'<h2>ما الذي يحتاج اعتماداً مهنياً؟</h2><p>اختيار البرنامج للمبتدئ، الحجم الأسبوعي، توازن العضلات، ملاءمة البدائل، التقنية، وأحمال العمل. هذه الطبعة تحريرية وبرمجية؛ ليست توقيعاً من مختص مؤهل.</p>')
page('التسخين والتقدم','<h2>قبل التمرين</h2><p>ابدأ بتسخين يقارب 8 دقائق: 5 دقائق مشي سريع أو دراجة خفيفة، ودوران كتف وذراع 10 مرات، وسكوات بوزن الجسم 10 مرات. اختر الحركات التي تناسب مفاصلك وقدرتك.</p><p>قبل أول تمرين ثقيل، جرّب مجموعة خفيفة بنحو نصف وزن العمل. قد تحتاج إلى تدرّج إضافي يناسب الحركة وخبرتك تحت إشراف مدرب.</p><h2>كيف تختار الوزن؟</h2><p>ابدأ بوزن تتحكم فيه عبر مدى مريح، مع بقاء نحو 1–3 تكرارات احتياطية (RIR). إذا تدهورت التقنية أو ظهر الألم، خفف أو توقف. لا تختبر أقصى وزن لتبدأ.</p><h2>متى تزيده؟</h2><p>عندما تؤدي المجموعات بتقنية مستقرة ضمن النطاق المقرر وتتعافى جيداً، ناقش أصغر زيادة متاحة مع مدربك، وسجّل أثرها. لا نحدد نسبة زيادة موحدة دون معرفة الجهاز والخبرة.</p><h2>بعد التمرين</h2><p>بعد التمرين، يمكنك المشي الخفيف 3 دقائق والتمدد نحو 30 ثانية لكل عضلة. اجعله مريحاً ودون ضغط حتى الألم؛ لا نفرض أن التمدد يمنع الإصابات أو الألم العضلي.</p>'+note('تتضمن البطاقات 8 · 10 · 12 تكراراً. تعرض الجداول المدى 8–12؛ راجع ترتيب المجموعات مع مدربك. لا تُغيّر التقنية للحصول على رقم أكبر.',True))
page('برنامج 5 أيام','<div class="hero-number">5</div><p class="intro">دفع · سحب · أرجل · علوي · سفلي</p>'+schedule('5')+'<p>خمس حصص تدريبية ويومان للراحة. اتبع الجدول كدورة أسبوعية، واختر أيام التقويم بما يناسبك.</p><div class="grid">'+card('المجموعات والتكرارات','<p>3 مجموعات، نطاق 8–12 تكراراً، و90 ثانية راحة بين المجموعات. للبلانك مدد مختلفة موضحة في الجدول.</p>')+card('التسجيل','<p>استخدم سجلي الصفحتين 19 و20 أو سجل التطبيق. قارن كل تمرين بنفسه وبنفس شروط الأداء.</p>')+'</div>'+note('راجع ترتيب المجموعات وملاءمة البرنامج مع مدرب مؤهل قبل اتباعه.'),category='الجزء الأول',classes='chapter',eyebrow='PART 01 · FIVE TRAINING DAYS')
intro('يوم الدفع','Push','الصدر · الكتفين · العضلة ثلاثية الرؤوس (الترايسبس)','8–9',9)
workout('5',0,'جدول الدفع · Push')
intro('يوم السحب','Pull','الظهر · الكتف الخلفي · البايسبس · الساعدين','10–11',11)
workout('5',1,'جدول السحب · Pull')
workout('5',2,'جدول الأرجل · Legs')
rest('5',3,14,'الجزء العلوي')
intro('يوم الجزء العلوي','Upper','الصدر · الظهر · الكتفين · الذراعين','14–15',15)
workout('5',4,'جدول الجزء العلوي')
intro('يوم الجزء السفلي','Lower','الفخذ الأمامي والخلفي · الأرداف · السمانة · الجذع','16–17',17)
workout('5',5,'جدول الجزء السفلي')
rest('5',6,8,'بدء دورة جديدة بالدفع')
log('5',[0,1],'سجل 5 أيام · الدفع والسحب')
log('5',[2,4,5],'سجل 5 أيام · الأرجل والعلوي والسفلي')
page('برنامج 4 أيام','<div class="hero-number">4</div><p class="intro">علوي · سفلي · راحة · علوي · سفلي</p>'+schedule('4')+'<p>أربع حصص تدريبية وثلاثة أيام للراحة. يتكرر جدول الجزء العلوي مرتين خلال الأسبوع، وكذلك جدول الجزء السفلي.</p><div class="grid">'+card('إيقاع أسبوعي','<p>لا يعني يوم الراحة انقطاعاً عن النوم والتغذية. راقب استشفاءك قبل زيادة الحمل أو الحجم.</p>')+card('التسجيل','<p>افصل سجل اليوم الأول عن اليوم الرابع، واليوم الثاني عن اليوم الخامس، حتى تستطيع مقارنة الحصص المتناظرة.</p>')+'</div>'+note('اختر هذا البرنامج أو برنامج 5 أيام؛ لا تجمعهما تلقائياً. التخصيص يحتاج مدرباً مؤهلاً.'),category='الجزء الثاني',classes='chapter',eyebrow='PART 02 · FOUR TRAINING DAYS')
intro('الجزء العلوي الأول','Upper A','الصدر · الظهر · الكتفين · الذراعين','22–23',23)
workout('4',0,'جدول العلوي الأول · A')
intro('الجزء السفلي الأول','Lower A','الفخذ الأمامي والخلفي · الأرداف · السمانة · الجذع','24–25',25)
workout('4',1,'جدول السفلي الأول · A')
rest('4',2,27,'الجزء العلوي الثاني')
intro('الجزء العلوي الثاني','Upper B','نفس قائمة اليوم العلوي الأول. استخدم سجلاً مستقلاً لمقارنة الأداء بمرور الأسابيع.','27–28',28)
workout('4',3,'جدول العلوي الثاني · B')
intro('الجزء السفلي الثاني','Lower B','نفس قائمة اليوم السفلي الأول. راقب التقنية والإجهاد قبل تعديل الأوزان.','29–30',30)
workout('4',4,'جدول السفلي الثاني · B')
rest('4',5,32,'يوم الراحة الثالث')
rest('4',6,22,'بدء دورة جديدة بالعلوي الأول')
log('4',[0,1],'سجل 4 أيام · العلوي والسفلي A')
log('4',[3,4],'سجل 4 أيام · العلوي والسفلي B')
assert len(PAGES)==34, len(PAGES)

def restore_native_vector_covers(pdf_path):
    """Paint original PDF cover vectors over SVG preview rendering.

    Chromium exposes hairline boundaries around SVG filter masks. Reusing the
    source page's native PDF operators avoids that renderer artifact without
    modifying the source artwork, rasterising it, or changing link targets.
    The HTML-generated tags, reading metadata and annotations stay in place.
    """
    try:
        from pypdf import PdfReader, PdfWriter
        from pypdf.generic import DictionaryObject, NameObject, NumberObject, ArrayObject, FloatObject, DecodedStreamObject
    except ImportError:
        raise SystemExit('Native vector cover export needs pypdf; see scripts/requirements-book.txt.')
    source=PdfReader(ROOT/'docs/source/protocoltraining-original.pdf')
    rendered=PdfReader(pdf_path)
    writer=PdfWriter()
    writer.clone_document_from_reader(rendered)
    for n in sorted(COVER_PAGES):
        original=source.pages[n-1]
        page_out=writer.pages[n-1]
        form=DecodedStreamObject()
        form.set_data(original.get_contents().get_data())
        form.update({NameObject('/Type'):NameObject('/XObject'), NameObject('/Subtype'):NameObject('/Form'),
                     NameObject('/FormType'):NumberObject(1),
                     NameObject('/BBox'):ArrayObject([FloatObject(v) for v in original.mediabox]),
                     NameObject('/Resources'):original['/Resources'].clone(writer)})
        if '/Group' in original:
            form[NameObject('/Group')]=original['/Group'].clone(writer)
        resource_name=NameObject(f'/MdaarOriginalCover{n}')
        resources=DictionaryObject(page_out['/Resources'].items())
        xobjects=DictionaryObject(resources.get('/XObject',DictionaryObject()).get_object().items())
        xobjects[resource_name]=writer._add_object(form)
        resources[NameObject('/XObject')]=xobjects
        page_out[NameObject('/Resources')]=resources
        sx=float(page_out.mediabox.width)/float(original.mediabox.width)
        sy=float(page_out.mediabox.height)/float(original.mediabox.height)
        native=DecodedStreamObject()
        native.set_data(b'q\n'+page_out.get_contents().get_data()+f'\nQ\nq\n{sx:.10f} 0 0 {sy:.10f} 0 0 cm\n{resource_name} Do\nQ\n'.encode())
        page_out.replace_contents(native)
    temporary=pdf_path.with_suffix('.native.pdf')
    writer.write(temporary)
    temporary.replace(pdf_path)


parser=argparse.ArgumentParser()
parser.add_argument('--html-only',action='store_true')
args=parser.parse_args()
BOOK.mkdir(parents=True,exist_ok=True)
ARTIFACTS.mkdir(parents=True,exist_ok=True)
out=BOOK/'index.html'
out.write_text('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>بروتوكول التحول — مدار | طبعة مراجعة</title><link rel="stylesheet" href="book.css"></head><body>'+''.join(PAGES)+'</body></html>')
print(f'Wrote {out.relative_to(ROOT)}: {len(PAGES)} editable pages')
if not args.html_only:
    chrome=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
    if not chrome: raise SystemExit('Chromium is required for PDF export; HTML source was built.')
    # Cloud Chromium policy blocks file://. Serve this checkout only on loopback
    # during export; do not weaken that policy or expose a web preview.
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit('PDF export needs Python Playwright and system Chromium. HTML source was built. Install scripts/requirements-book.txt, then retry; no browser download is needed.')
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=chrome,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            try:
                pg=browser.new_page()
                pg.goto(f'http://127.0.0.1:{server.server_port}/docs/book/index.html',wait_until='load',timeout=20000)
                pg.evaluate('document.fonts.ready')
                pg.emulate_media(media='print')
                overflow=pg.evaluate('Array.from(document.querySelectorAll(".page")).map((p,i)=>({page:i+1,scroll:p.scrollHeight,client:p.clientHeight})).filter(x=>x.scroll>x.client+1)')
                if overflow:
                    raise SystemExit(f'Book layout overflows: {overflow}; fix source before PDF export.')
                cover_errors=pg.evaluate('Array.from(document.querySelectorAll(".source-cover")).map(p=>{const im=p.querySelector(".original-cover"),a=p.getBoundingClientRect(),b=im.getBoundingClientRect();return {page:p.id,loaded:im.complete&&im.naturalWidth>0,dx:Math.abs(a.left-b.left),dy:Math.abs(a.top-b.top),dw:Math.abs(a.width-b.width),dh:Math.abs(a.height-b.height)}}).filter(x=>!x.loaded||Math.max(x.dx,x.dy,x.dw,x.dh)>1)')
                if cover_errors:
                    raise SystemExit(f'Original cover assets failed page geometry: {cover_errors}')
                collisions=pg.evaluate('Array.from(document.querySelectorAll(".page:not(.source-cover)")).map((p,i)=>({page:p.id,footer:p.querySelector("footer").getBoundingClientRect().top,last:Math.max(...Array.from(p.children).filter(c=>c.tagName!=="FOOTER").map(c=>c.getBoundingClientRect().bottom))})).filter(x=>x.last>x.footer-6)')
                if collisions:
                    raise SystemExit(f'Book content overlaps footer: {collisions}; fix before export.')
                pg.pdf(path=str(ARTIFACTS/'protocoltraining-review.pdf'),print_background=True,prefer_css_page_size=True,display_header_footer=False,tagged=True,outline=True)
                restore_native_vector_covers(ARTIFACTS/'protocoltraining-review.pdf')
                shutil.copyfile(ARTIFACTS/'protocoltraining-review.pdf',ARTIFACTS/'mdaar-protocol-original-identity-v2.pdf')
                shutil.copyfile(ARTIFACTS/'protocoltraining-review.pdf',ARTIFACTS/'mdaar-protocol-original-identity-v3.pdf')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print('Wrote docs/artifacts/protocoltraining-review.pdf (review edition, not certified)')
