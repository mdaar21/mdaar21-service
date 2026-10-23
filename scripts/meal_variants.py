"""Curated assembly families for the additional gram-based meal suggestions.

Vary actual ingredient combinations, never just the amount or a numbered name.
Amounts are edible grams in the preparation state in the USDA ingredient file.
"""
from itertools import product, zip_longest

AR = {
    'chicken': 'الدجاج', 'tuna': 'التونة', 'salmon': 'السلمون',
    'egg': 'البيض', 'lentils': 'العدس', 'chickpeas': 'الحمص',
    'beans': 'الفاصوليا السوداء', 'rice': 'الأرز', 'quinoa': 'الكينوا',
    'pasta': 'المكرونة الكاملة', 'potato': 'البطاطس',
    'sweetpotato': 'البطاطا الحلوة', 'bread': 'الخبز الكامل',
    'oats': 'الشوفان', 'yogurt': 'الزبادي', 'cottage': 'القريش',
    'feta': 'الفيتا', 'milk': 'الحليب', 'apple': 'التفاح',
    'banana': 'الموز', 'strawberry': 'الفراولة', 'blueberry': 'التوت الأزرق',
    'date': 'التمر', 'almond': 'اللوز', 'walnut': 'الجوز',
    'peanut': 'زبدة الفول السوداني', 'chia': 'الشيا',
    'cocoa': 'الكاكاو', 'honey': 'العسل', 'broccoli': 'البروكلي',
    'spinach': 'السبانخ', 'carrot': 'الجزر', 'tomato': 'الطماطم',
    'cucumber': 'الخيار', 'avocado': 'الأفوكادو',
}
FRUITS = ['apple', 'banana', 'strawberry', 'blueberry', 'date']
TOPPINGS = ['almond', 'walnut', 'peanut', 'chia', 'cocoa']
PROTEINS = ['chicken', 'tuna', 'salmon', 'egg', 'chickpeas', 'lentils', 'beans']
VEG_PAIRS = [('tomato', 'cucumber'), ('broccoli', 'carrot'),
             ('spinach', 'tomato'), ('cucumber', 'carrot'),
             ('broccoli', 'spinach'), ('tomato', 'carrot')]


def signature(parts):
    return tuple(sorted(key for key, _ in parts))


def families(goal, category):
    """Interleave families so a category is not filled by one bowl template."""
    bulk = goal == 'bulk'
    fruit_g = {'apple': 140, 'banana': 110, 'strawberry': 140,
               'blueberry': 100, 'date': 35}
    top_g = {'almond': 22 if bulk else 10, 'walnut': 20 if bulk else 10,
             'peanut': 25 if bulk else 12, 'chia': 15 if bulk else 8,
             'cocoa': 7 if bulk else 5}
    protein_g = {key: (160 if bulk else 110) for key in PROTEINS}
    protein_g.update(egg=150 if bulk else 100,
                     chickpeas=180 if bulk else 130,
                     lentils=200 if bulk else 150,
                     beans=180 if bulk else 130)

    def idea(title, keys, parts):
        return (title + ' ' + ' و'.join(AR[k] for k in keys), category, parts)

    def oats():
        for dairy, fruit, top in product(['yogurt', 'milk'], FRUITS, TOPPINGS):
            yield idea('وعاء شوفان مع', [dairy, fruit, top],
                       [('oats', 65 if bulk else 35), (dairy, 220 if bulk else 170),
                        (fruit, fruit_g[fruit]), (top, top_g[top])])

    def dairy_fruit():
        for dairy, fruit, top in product(['yogurt', 'cottage'], FRUITS, TOPPINGS):
            yield idea('كوب', [dairy, fruit, top],
                       [(dairy, 250 if bulk else 180), (fruit, fruit_g[fruit]),
                        (top, top_g[top])])

    def breakfast_toast():
        for protein, veg, extra in product(['egg', 'cottage', 'chickpeas', 'tuna'],
                                          ['tomato', 'cucumber', 'spinach'],
                                          ['avocado', 'feta']):
            yield idea('توست مع', [protein, veg, extra],
                       [('bread', 100 if bulk else 60),
                        (protein, protein_g.get(protein, 160 if bulk else 110)),
                        (veg, 80), (extra, (60 if extra == 'avocado' else 35) if bulk
                                      else (35 if extra == 'avocado' else 20))])

    def breakfast_plates():
        for base, protein, veg in product(['potato', 'sweetpotato', 'quinoa'],
                                         ['egg', 'cottage', 'beans'],
                                         ['tomato', 'spinach', 'cucumber']):
            yield idea('طبق إفطار من', [base, protein, veg],
                       [(base, 230 if bulk else 150),
                        (protein, protein_g.get(protein, 180 if bulk else 130)),
                        (veg, 100), ('oil', 7 if bulk else 3)])

    def grain_bowls():
        for base, protein, vegetables in product(['rice', 'quinoa'], PROTEINS, VEG_PAIRS):
            yield idea('وعاء', [base, protein, *vegetables],
                       [(base, 210 if bulk else 120), (protein, protein_g[protein]),
                        (vegetables[0], 90), (vegetables[1], 80), ('oil', 8 if bulk else 4)])

    def potato_plates():
        for base, protein, vegetables in product(['potato', 'sweetpotato'], PROTEINS, VEG_PAIRS):
            yield idea('طبق', [base, protein, *vegetables],
                       [(base, 260 if bulk else 180), (protein, protein_g[protein]),
                        (vegetables[0], 90), (vegetables[1], 80), ('oil', 8 if bulk else 4)])

    def pasta_plates():
        for protein, vegetables, extra in product(PROTEINS, VEG_PAIRS[:4], ['feta', 'avocado']):
            yield idea('مكرونة كاملة مع', [protein, *vegetables, extra],
                       [('pasta', 210 if bulk else 130), (protein, protein_g[protein]),
                        (vegetables[0], 90), (vegetables[1], 70),
                        (extra, (50 if extra == 'avocado' else 35) if bulk
                                      else (30 if extra == 'avocado' else 20))])

    def pulse_salads():
        for pulse, protein, vegetables in product(['chickpeas', 'lentils', 'beans'],
                                                 ['chicken', 'tuna', 'egg', 'cottage', 'feta'],
                                                 VEG_PAIRS):
            yield idea('سلطة', [pulse, protein, *vegetables],
                       [(pulse, 200 if bulk else 140),
                        (protein, (60 if bulk else 35) if protein == 'feta'
                         else protein_g.get(protein, 180 if bulk else 130)),
                        (vegetables[0], 100), (vegetables[1], 100), ('oil', 8 if bulk else 4)])

    def sandwiches():
        for protein, vegetables, spread in product(PROTEINS, VEG_PAIRS[:4], ['yogurt', 'avocado']):
            yield idea('ساندويتش', [protein, *vegetables, spread],
                       [('bread', 110 if bulk else 65), (protein, protein_g[protein]),
                        (vegetables[0], 70), (vegetables[1], 60),
                        (spread, 60 if bulk else 35)])

    def fruit_toasts():
        for fruit, spread, top in product(FRUITS, ['cottage', 'peanut'], ['walnut', 'chia']):
            yield idea('توست خفيف مع', [fruit, spread, top],
                       [('bread', 75 if bulk else 40), (fruit, fruit_g[fruit] * 0.7),
                        (spread, (100 if spread == 'cottage' else 25) if bulk
                         else (70 if spread == 'cottage' else 12)), (top, top_g[top])])

    def smoothies():
        for fruit, top in product(FRUITS[:4], ['peanut', 'cocoa', 'chia', 'almond']):
            yield idea('مخفوق الحليب مع', [fruit, top],
                       [('milk', 280 if bulk else 200), (fruit, fruit_g[fruit]),
                        ('yogurt', 150 if bulk else 80), (top, top_g[top])])

    def savory_snacks():
        for protein, veg, extra in product(['egg', 'chickpeas', 'cottage'],
                                          ['cucumber', 'carrot', 'tomato'], ['avocado', 'feta']):
            yield idea('سناك', [protein, veg, extra],
                       [(protein, protein_g.get(protein, 180 if bulk else 120) * 0.7),
                        (veg, 120), (extra, 50 if bulk else 25)])

    if category == 'فطور':
        return [oats(), dairy_fruit(), breakfast_toast(), breakfast_plates()]
    if category == 'غداء':
        return [grain_bowls(), pasta_plates(), potato_plates(), pulse_salads()]
    if category == 'عشاء':
        return [sandwiches(), pulse_salads(), potato_plates(), grain_bowls()]
    return [dairy_fruit(), fruit_toasts(), smoothies(), savory_snacks()]


def expand(blocks):
    result = {}
    for goal, block in blocks.items():
        result[goal] = [(name, cat, [(p.split(':')[0], float(p.split(':')[1]))
                                  for p in parts.split(',')])
                        for name, cat, parts in (line.split('|') for line in block.splitlines())]
    seen = {signature(parts) for rows in result.values() for _, _, parts in rows}
    names = {name for rows in result.values() for name, _, _ in rows}
    for goal, rows in result.items():
        for category, count in [('فطور', 40), ('غداء', 60), ('عشاء', 60), ('سناك', 40)]:
            added = 0
            for batch in zip_longest(*families(goal, category)):
                for item in batch:
                    if item is None:
                        continue
                    name, cat, parts = item
                    key = signature(parts)
                    if key in seen or name in names:
                        continue
                    rows.append(item)
                    seen.add(key)
                    names.add(name)
                    added += 1
                    if added == count:
                        break
                if added == count:
                    break
            assert added == count, f'Not enough distinct meals: {goal}/{category}'
    return result
