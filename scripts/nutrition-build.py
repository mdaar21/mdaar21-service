#!/usr/bin/env python3
"""Build a traceable USDA SR28 subset and 500 gram-based meal suggestions.
The package is downloaded as data, its registry integrity is checked, no code is run.
"""
import base64, csv, hashlib, io, json, pathlib, tarfile, urllib.request
from meal_variants import expand
ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = 'https://registry.npmjs.org/fda-nutrient-database/-/fda-nutrient-database-1.0.2.tgz'
INTEGRITY = 'sha512-pUebhBfCDukmJtXdw7IDtEp1idF7zYWymKFw4zVyPXKY/28gy+Ob05eCnJKIlI6mHweiDXBFO1EMrrbW2YZl5A=='
# ID, Arabic label, preparation state, allergens, suggested alternatives (not auto substituted).
ITEMS = {
'chicken':('05064','صدر دجاج مشوي بلا جلد','مطهو','', 'salmon,tuna,chickpeas'),
'rice':('20045','أرز أبيض طويل الحبة','مطهو','', 'quinoa,potato'),
'oats':('08120','شوفان عادي غير مدعم','جاف','gluten', 'rice'),
'yogurt':('01256','زبادي يوناني سادة خالي الدسم','جاهز','milk',''),
'banana':('09040','موز','نيئ، الجزء المأكول','','apple,strawberry'),
'apple':('09003','تفاح بقشره','نيئ، دون قلب','','banana,blueberry'),
'lentils':('16070','عدس مسلوق بلا ملح','مطهو','','chickpeas,beans'),
'chickpeas':('16057','حمص مسلوق بلا ملح','مطهو','','lentils,beans'),
'tuna':('15121','تونة خفيفة معلبة بالماء','مصفاة','fish','chicken,chickpeas'),
'egg':('01129','بيض مسلوق جيداً','مطهو، دون قشر','egg','chickpeas'),
'oil':('04053','زيت زيتون','كما يباع','','avocado'),
'peanut':('16098','زبدة فول سوداني ناعمة مملحة','كما تباع','peanut','almond'),
'almond':('12061','لوز','كما يباع','tree_nut',''),
'broccoli':('11091','بروكلي مسلوق مصفى بلا ملح','مطهو','','spinach,carrot'),
'milk':('01085','حليب سائل خالي الدسم','كما يباع','milk',''),
'potato':('11365','بطاطس مسلوقة','لُب مطهو دون قشر','','sweetpotato,rice'),
'quinoa':('20137','كينوا','مطهوة','','rice,potato'),
'cottage':('01014','جبنة قريش خالية الدسم','كما تباع','milk',''),
'strawberry':('09316','فراولة','نيئة، دون أوراق','','blueberry,apple'),
'blueberry':('09050','توت أزرق','نيئ','','strawberry'),
'carrot':('11124','جزر','نيئ، الجزء المأكول','','cucumber'),
'tomato':('11529','طماطم','نيئة','','cucumber'),
'cucumber':('11205','خيار بقشره','نيئ','','tomato'),
'spinach':('11457','سبانخ','نيئة','','broccoli'),
'salmon':('15086','سلمون سوكاي مطهو بحرارة جافة','مطهو','fish','chicken'),
'pasta':('20125','مكرونة قمح كامل','مطهوة','gluten','quinoa,rice'),
'bread':('18075','خبز قمح كامل تجاري','كما يباع','gluten','rice'),
'beans':('16015','فاصوليا سوداء مسلوقة بلا ملح','مطهوة','','lentils,chickpeas'),
'honey':('19296','عسل','كما يباع','',''),
'walnut':('12155','جوز إنجليزي','كما يباع','tree_nut','almond'),
'date':('09421','تمر مجدول','دون نوى','','banana'),
'sweetpotato':('11508','بطاطا حلوة مخبوزة بلا ملح','لُب مطهو دون قشر','','potato'),
'avocado':('09037','أفوكادو','لُب نيئ','','oil'),
'cocoa':('19165','كاكاو غير محلى','مسحوق','',''),
'chia':('12006','بذور شيا','جافة','',''),
'feta':('01019','جبنة فيتا','كما تباع','milk','cottage'),
}
# Each recipe is a distinct ingredient combination. All amounts are edible grams.
CUT = '''شوفان التفاح والزبادي|فطور|oats:35,yogurt:170,apple:100,chia:5
شوفان الفراولة بالحليب|فطور|oats:40,milk:150,strawberry:120,almond:8
زبادي الموز والكاكاو|فطور|yogurt:200,banana:100,cocoa:5,walnut:8
قريش التوت والشيا|فطور|cottage:150,blueberry:100,chia:10,bread:30
توست البيض والسبانخ|فطور|bread:60,egg:100,spinach:50,tomato:80
توست القريش والخيار|فطور|bread:60,cottage:150,cucumber:100,oil:3
شوفان الكاكاو والفراولة|فطور|oats:35,milk:150,cocoa:5,strawberry:100
زبادي التفاح والجوز|فطور|yogurt:200,apple:150,walnut:12
بطاطس البيض والطماطم|فطور|potato:150,egg:100,tomato:100,oil:3
حمص الإفطار بالخيار|فطور|chickpeas:120,cucumber:100,tomato:100,bread:30,oil:3
دجاج الأرز والبروكلي|غداء|chicken:130,rice:120,broccoli:150,oil:5
سلطة الدجاج والكينوا|غداء|chicken:120,quinoa:130,cucumber:100,tomato:100,oil:5
تونة البطاطس بالخيار|غداء|tuna:150,potato:180,cucumber:100,oil:5
سلمون الكينوا والسبانخ|غداء|salmon:130,quinoa:120,spinach:70,oil:3
عدس الأرز بالجزر|غداء|lentils:180,rice:100,carrot:100,oil:5
سلطة الحمص والقريش|غداء|chickpeas:130,cottage:100,tomato:100,cucumber:100,oil:3
مكرونة التونة والسبانخ|غداء|pasta:140,tuna:120,spinach:60,tomato:100,oil:5
دجاج البطاطا الحلوة|غداء|chicken:120,sweetpotato:180,broccoli:120,oil:5
كينوا الفاصوليا والطماطم|غداء|quinoa:130,beans:150,tomato:100,spinach:50,oil:5
دجاج العدس والخيار|غداء|chicken:100,lentils:140,cucumber:100,carrot:70,oil:5
سلمون البطاطس والبروكلي|غداء|salmon:120,potato:180,broccoli:150,oil:3
أرز التونة والجزر|غداء|rice:130,tuna:140,carrot:100,cucumber:80,oil:3
مكرونة الدجاج والطماطم|غداء|pasta:130,chicken:110,tomato:150,spinach:50,oil:5
سلطة العدس والفيتا|غداء|lentils:180,feta:40,cucumber:100,tomato:100,oil:3
حمص الكينوا والبروكلي|غداء|chickpeas:130,quinoa:100,broccoli:150,oil:5
سلطة التونة والأفوكادو|عشاء|tuna:140,avocado:50,tomato:100,cucumber:100,bread:30
قريش البطاطس والسبانخ|عشاء|cottage:180,potato:170,spinach:60,oil:5
بيض الحمص والطماطم|عشاء|egg:100,chickpeas:100,tomato:120,oil:3
حساء العدس والجزر السريع|عشاء|lentils:200,carrot:120,tomato:100,oil:5
سلطة الدجاج والفيتا|عشاء|chicken:110,feta:30,cucumber:100,tomato:100,bread:30
توست السلمون بالخيار|عشاء|salmon:100,bread:60,cucumber:100,yogurt:50
سلطة الفاصوليا والبيض|عشاء|beans:140,egg:100,tomato:100,spinach:50
بطاطا حلوة بالقريش|عشاء|sweetpotato:200,cottage:150,cucumber:100,oil:3
عدس الكينوا والسبانخ|عشاء|lentils:140,quinoa:100,spinach:100,tomato:100,oil:5
ساندويتش الدجاج والخيار|عشاء|bread:60,chicken:100,cucumber:100,yogurt:50
تونة الحمص والجزر|عشاء|tuna:100,chickpeas:120,carrot:100,oil:5
سلطة السلمون والأرز|عشاء|salmon:100,rice:100,cucumber:100,spinach:60,oil:3
توست البيض والأفوكادو|عشاء|bread:50,egg:100,avocado:40,tomato:100
فاصوليا البطاطس والفيتا|عشاء|beans:120,potato:120,feta:30,tomato:100
زبادي الخيار والحمص|عشاء|yogurt:170,chickpeas:120,cucumber:120,bread:30
قريش الفراولة واللوز|سناك|cottage:150,strawberry:150,almond:10
زبادي التوت والكاكاو|سناك|yogurt:170,blueberry:100,cocoa:5
تفاح وزبدة فول سوداني|سناك|apple:180,peanut:20
تمر بالزبادي والجوز|سناك|date:30,yogurt:170,walnut:8
موز بالحليب والشيا|سناك|banana:100,milk:200,chia:8
توست قريش وطماطم|سناك|bread:40,cottage:100,tomato:100
سلطة جزر وتفاح بالزبادي|سناك|carrot:80,apple:100,yogurt:150
كوب فراولة وحليب بالكاكاو|سناك|strawberry:150,milk:200,cocoa:6
بيض وخيار مع توست|سناك|egg:50,cucumber:150,bread:30
زبادي الموز وزبدة الفول|سناك|yogurt:170,banana:80,peanut:12'''
BULK = '''شوفان الموز وزبدة الفول|فطور|oats:70,milk:250,banana:120,peanut:25
شوفان التمر واللوز|فطور|oats:70,milk:250,date:50,almond:20
زبادي الشوفان والتوت|فطور|yogurt:250,oats:70,blueberry:100,honey:15,walnut:20
توست البيض والفيتا|فطور|bread:100,egg:150,feta:50,tomato:100
شوفان التفاح وزبدة الفول|فطور|oats:70,milk:250,apple:150,peanut:25
قريش الموز والعسل|فطور|cottage:250,banana:150,honey:20,walnut:25,bread:60
شوفان الفراولة والشيا|فطور|oats:70,yogurt:200,strawberry:150,chia:15,honey:15
بيض البطاطس والأفوكادو|فطور|egg:150,potato:250,avocado:80,tomato:100
توست زبدة الفول والتمر|فطور|bread:100,peanut:35,date:50,milk:200
كينوا الحليب والموز|فطور|quinoa:220,milk:250,banana:120,almond:25,honey:10
دجاج الأرز والحمص|غداء|chicken:160,rice:220,chickpeas:100,tomato:100,oil:10
سلمون المكرونة والسبانخ|غداء|salmon:160,pasta:220,spinach:100,oil:10
دجاج الكينوا والأفوكادو|غداء|chicken:150,quinoa:220,avocado:80,cucumber:100
تونة الأرز والفاصوليا|غداء|tuna:180,rice:200,beans:140,tomato:100,oil:10
عدس المكرونة والفيتا|غداء|lentils:200,pasta:180,feta:60,spinach:80,oil:8
دجاج البطاطس والحمص|غداء|chicken:150,potato:250,chickpeas:100,carrot:100,oil:10
سلمون الأرز والأفوكادو|غداء|salmon:150,rice:220,avocado:80,tomato:100
مكرونة الدجاج والبروكلي|غداء|pasta:220,chicken:150,broccoli:150,oil:12
كينوا الحمص والفيتا|غداء|quinoa:200,chickpeas:180,feta:50,tomato:100,oil:8
أرز البيض والفاصوليا|غداء|rice:200,egg:150,beans:130,carrot:80,oil:8
دجاج العدس والأرز|غداء|chicken:130,lentils:160,rice:180,spinach:70,oil:10
تونة المكرونة والأفوكادو|غداء|tuna:170,pasta:220,avocado:70,tomato:100
سلمون البطاطا والحمص|غداء|salmon:150,sweetpotato:250,chickpeas:100,broccoli:120
مكرونة الفاصوليا والفيتا|غداء|pasta:220,beans:180,feta:60,tomato:100,oil:10
دجاج الكينوا والعدس|غداء|chicken:140,quinoa:180,lentils:150,carrot:100,oil:10
ساندويتش دجاج وأفوكادو|عشاء|bread:120,chicken:150,avocado:80,tomato:100,yogurt:50
بطاطس البيض والجبنة|عشاء|potato:250,egg:150,feta:60,spinach:80,oil:8
سلطة السلمون والحمص|عشاء|salmon:150,chickpeas:180,cucumber:100,tomato:100,bread:60
أرز العدس والجوز|عشاء|rice:200,lentils:200,walnut:25,carrot:100,oil:8
توست التونة والفيتا|عشاء|bread:100,tuna:180,feta:50,cucumber:100,oil:5
كينوا البيض والأفوكادو|عشاء|quinoa:200,egg:150,avocado:70,tomato:100
مكرونة الحمص والسبانخ|عشاء|pasta:200,chickpeas:180,spinach:100,oil:12
قريش البطاطا واللوز|عشاء|cottage:250,sweetpotato:280,almond:25,cucumber:100
دجاج الفاصوليا والخبز|عشاء|chicken:140,beans:180,bread:80,tomato:100,oil:8
سلمون الكينوا والفيتا|عشاء|salmon:130,quinoa:200,feta:50,cucumber:100,oil:5
سلطة العدس والأفوكادو|عشاء|lentils:220,avocado:100,tomato:100,bread:80
توست البيض والحمص|عشاء|bread:100,egg:150,chickpeas:120,cucumber:100
أرز القريش والفاصوليا|عشاء|rice:180,cottage:200,beans:150,tomato:100,oil:8
تونة البطاطا والكينوا|عشاء|tuna:170,sweetpotato:200,quinoa:150,oil:10
دجاج المكرونة والفيتا|عشاء|chicken:130,pasta:180,feta:50,spinach:80,oil:8
مخفوق الموز والشوفان بالكاكاو|سناك|banana:150,oats:50,milk:300,peanut:20,cocoa:6
تمر محشو بالجوز مع الحليب|سناك|date:70,walnut:30,milk:250
زبادي الفراولة واللوز والعسل|سناك|yogurt:250,strawberry:150,almond:30,honey:20
توست الموز وزبدة الفول|سناك|bread:80,banana:120,peanut:30
قريش التفاح والتمر|سناك|cottage:200,apple:150,date:50,walnut:15
كوب الشيا بالكاكاو والموز|سناك|chia:25,milk:250,cocoa:8,banana:120,honey:15
مخفوق التوت والشوفان|سناك|blueberry:150,oats:50,milk:300,almond:20
توست القريش والعسل|سناك|bread:80,cottage:200,honey:25,walnut:20
زبادي التمر وزبدة الفول|سناك|yogurt:250,date:50,peanut:30
شوفان الحليب بالجوز والكاكاو|سناك|oats:60,milk:250,walnut:25,cocoa:8,honey:15'''

EN = {'chicken':'roasted chicken breast','rice':'cooked white rice','oats':'dry rolled oats','yogurt':'nonfat Greek yogurt','banana':'banana','apple':'apple','lentils':'cooked lentils','chickpeas':'cooked chickpeas','tuna':'drained canned light tuna','egg':'hard-boiled egg','oil':'olive oil','peanut':'peanut butter','almond':'almonds','broccoli':'cooked broccoli','milk':'skim milk','potato':'boiled potato','quinoa':'cooked quinoa','cottage':'nonfat cottage cheese','strawberry':'strawberries','blueberry':'blueberries','carrot':'raw carrot','tomato':'raw tomato','cucumber':'raw cucumber','spinach':'raw spinach','salmon':'cooked sockeye salmon','pasta':'cooked whole-wheat pasta','bread':'whole-wheat bread','beans':'cooked black beans','honey':'honey','walnut':'walnuts','date':'pitted Medjool dates','sweetpotato':'baked sweet potato','avocado':'avocado','cocoa':'unsweetened cocoa','chia':'dried chia seeds','feta':'feta cheese'}


EN_STEPS = {
'زن المكونات بالجرام؛ الشوفان بوزنه الجاف وبقية الأصناف بالحالة الموضحة.': 'Weigh the ingredients in grams. Weigh the oats dry and use the preparation state specified for every other ingredient.',
'اطهِ الشوفان مع الحليب المذكور أو ماء حسب الحاجة، أو انقعه بالزبادي في الثلاجة طوال الليل.': 'Cook the oats with the listed milk or water as needed, or soak them in the yogurt overnight in the refrigerator.',
'اغسل الفاكهة وقطّعها؛ أضف بقية المكونات بالكميات المحددة وقدّم.': 'Wash and cut the fruit. Add the remaining ingredients in the specified amounts and serve.',
'زن المكونات بالجرام حسب الحالة الموضحة؛ أزل النوى والقشور غير المأكولة.': 'Weigh the ingredients in grams in the specified preparation state. Remove pits and any inedible peel.',
'اغسل الفاكهة أو الخضار وقطّعها، ثم رتّب المكونات أو اخلطها حسب اسم الوصفة.': 'Wash and cut the fruit or vegetables, then arrange or mix the ingredients as indicated by the recipe name.',
'قدّم الكمية كاملة كحصة واحدة. التبريد مطلوب للألبان والمكونات سريعة التلف.': 'Serve the full amount as one portion. Keep dairy and other perishable ingredients refrigerated.',
'حضّر الحبوب والبقول والخضار المطهوة والبروتين مسبقاً؛ الأوزان المدرجة بعد الطهو والتصفية ما لم يُذكر غير ذلك.': 'Cook the grains, pulses, cooked vegetables and protein ingredients in advance. Listed weights are after cooking and draining unless otherwise stated.',
'زن المكونات؛ اغسل الخضار النيئة وقطّعها. سخّن المكونات المطهوة عند الحاجة ورتّب الطبق أو الساندويتش.': 'Weigh the ingredients. Wash and cut the raw vegetables. Reheat cooked ingredients if needed, then assemble the plate or sandwich.',
'أضف الزيت أو المكسرات أو الألبان المذكورة فقط بالكميات المحددة. قدّم كحصة واحدة؛ الإضافات غير مدرجة في الحساب.': 'Add only the listed oil, nuts or dairy in the specified amounts. Serve as one portion. Additional ingredients are not included in the calculation.',
'زن المكونات بعد إزالة القشور والنوى، واغسل الفاكهة.': 'Weigh the ingredients after removing peels and pits, and wash the fruit.',
'اخلط المكونات في خلاط نظيف؛ يمكن إضافة ماء حسب القوام دون تغيير المغذيات.': 'Blend the ingredients in a clean blender. Add water to adjust the texture if needed; water does not change the nutrient totals.',
'قدّم مباشرة أو احفظ مبرداً؛ لا تضف سكراً أو زيتاً غير محسوب.': 'Serve immediately or keep refrigerated. Do not add sugar or oil that has not been included in the calculation.',
}
STATE_EN = {'مطهو':'cooked','مطهوة':'cooked','جاف':'dry','جافة':'dry','جاهز':'ready to eat','نيئ، الجزء المأكول':'raw, edible portion','نيئ، دون قلب':'raw, core removed','مصفاة':'drained','مطهو، دون قشر':'cooked, shell removed','كما يباع':'as sold','كما تباع':'as sold','لُب مطهو دون قشر':'cooked flesh, skin removed','نيئة، دون أوراق':'raw, leaves removed','نيئ':'raw','نيئ، الجزء المأكول':'raw, edible portion','نيئة':'raw','دون نوى':'pitted','لُب نيئ':'raw flesh','مسحوق':'powder'}

def build():
 with urllib.request.urlopen(URL, timeout=30) as r: archive = r.read()
 assert 'sha512-'+base64.b64encode(hashlib.sha512(archive).digest()).decode() == INTEGRITY, 'Artifact integrity failed'
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
  source = t.extractfile('package/data/ABBREV.txt').read()
  license_text = t.extractfile('package/LICENSE').read().decode()
 rows={r[0]:r for r in csv.reader(io.StringIO(source.decode('latin1')), delimiter='^', quotechar='~')}
 ingredients={}
 for key,(ndb,name,state,allergens,alternatives) in ITEMS.items():
  r=rows[ndb]
  ingredients[key]={'id':key,'ndbId':ndb,'name':name,'nameEn':EN[key],'sourceDescription':r[1],'state':state,'stateEn':STATE_EN[state],'allergens':allergens.split(',') if allergens else [],'alternatives':alternatives.split(',') if alternatives else [], 'per100g':{'kcal':float(r[3]),'p':float(r[4]),'f':float(r[5]),'c':float(r[7]),'fiber':float(r[8])}}
 data={'source':{'title':'USDA National Nutrient Database for Standard Reference, Release 28 (September 2015)','origin':'https://www.ars.usda.gov/nea/bhnrc/ndl','mirror':URL,'mirrorIntegrity':INTEGRITY,'abbrevSha256':hashlib.sha256(source).hexdigest(),'mirrorLicense':'MIT','retrievedOn':'2026-10-20','units':'per 100 grams edible portion in the stated preparation state','status':'source-attributed snapshot; current official cross-check and qualified review pending','officialAccess':'api.nal.usda.gov returned proxy tunnel 403 during implementation'}, 'ingredients':ingredients}
 recipes=[]
 for goal,rows in expand({'cut':CUT,'bulk':BULK}).items():
  for i,(name,cat,parts) in enumerate(rows,1):
   ing=[{'id':key,'grams':grams} for key,grams in parts]
   totals={k:round(sum(ingredients[x['id']]['per100g'][k]*x['grams']/100 for x in ing),2) for k in ['kcal','p','c','f','fiber']}
   allergens=sorted({a for x in ing for a in ingredients[x['id']]['allergens']})
   if any(x['id']=='oats' for x in ing):
    steps=['زن المكونات بالجرام؛ الشوفان بوزنه الجاف وبقية الأصناف بالحالة الموضحة.','اطهِ الشوفان مع الحليب المذكور أو ماء حسب الحاجة، أو انقعه بالزبادي في الثلاجة طوال الليل.','اغسل الفاكهة وقطّعها؛ أضف بقية المكونات بالكميات المحددة وقدّم.']
   elif 'مخفوق' in name:
    steps=['زن المكونات بعد إزالة القشور والنوى، واغسل الفاكهة.','اخلط المكونات في خلاط نظيف؛ يمكن إضافة ماء حسب القوام دون تغيير المغذيات.','قدّم مباشرة أو احفظ مبرداً؛ لا تضف سكراً أو زيتاً غير محسوب.']
   elif cat=='سناك' or all(x['id'] not in ['chicken','salmon','tuna','rice','quinoa','pasta','potato','sweetpotato','beans','lentils','chickpeas','egg'] for x in ing):
    steps=['زن المكونات بالجرام حسب الحالة الموضحة؛ أزل النوى والقشور غير المأكولة.','اغسل الفاكهة أو الخضار وقطّعها، ثم رتّب المكونات أو اخلطها حسب اسم الوصفة.','قدّم الكمية كاملة كحصة واحدة. التبريد مطلوب للألبان والمكونات سريعة التلف.']
   else:
    steps=['حضّر الحبوب والبقول والخضار المطهوة والبروتين مسبقاً؛ الأوزان المدرجة بعد الطهو والتصفية ما لم يُذكر غير ذلك.','زن المكونات؛ اغسل الخضار النيئة وقطّعها. سخّن المكونات المطهوة عند الحاجة ورتّب الطبق أو الساندويتش.','أضف الزيت أو المكسرات أو الألبان المذكورة فقط بالكميات المحددة. قدّم كحصة واحدة؛ الإضافات غير مدرجة في الحساب.']
   recipes.append({'id':f'{goal}-{i:02d}','name':name,'nameEn':', '.join(EN[x['id']] for x in (ing[:3] if i<=50 else ing) if x['id']!='oil').capitalize(),'goal':goal,'category':cat,'servings':1,'minutes':15 if cat in ['غداء','عشاء'] else 10,'timeNote':'وقت تجميع تقريبي؛ لا يشمل طهو وتجهيز المكونات المسبقة','difficulty':'سهل','difficultyEn':'Easy','timeNoteEn':'Approximate assembly time; excludes advance cooking and preparation.','ingredients':ing,'nutrition':totals,'allergens':allergens,'steps':steps,'stepsEn':[EN_STEPS[step] for step in steps],'reviewStatus':'calculated-pending-professional-review','cost':None,'image':'/data/recipes-illustration.svg','imageLicense':'Original Mdaar vector illustration, CC0-1.0','imageNote':'رسم توضيحي عام؛ ليس صورة للطبق','substitutionNote':'البدائل اقتراحات فقط؛ يلزم إعادة الحساب وفحص الحساسية بعد الاستبدال.'})
 assert len(recipes)==500 and len({x['name'] for x in recipes})==500
 assert len({','.join(sorted(x['id'] for x in r['ingredients'])) for r in recipes})==500, 'Duplicate ingredient sets'
 out=ROOT/'public/data'; out.mkdir(parents=True,exist_ok=True)
 (out/'nutrition-usda-sr28.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 (out/'recipes-calculated.json').write_text(json.dumps({'schemaVersion':1,'status':'Calculated meal suggestions, not medically approved or independently taste-tested','recipes':recipes},ensure_ascii=False,indent=2)+'\n')
 (out/'nutrition-mirror-LICENSE.txt').write_text(license_text)
 print(f'Built {len(ingredients)} source-attributed ingredients and {len(recipes)} recipes (250 cut / 250 bulk).')
if __name__=='__main__': build()
