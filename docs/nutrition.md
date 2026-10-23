# Nutrition data, recipes and meal planning

The visible recipe section is one unified library of **500 distinct meal suggestions: 250 cutting / 250 bulking**. At the owner's request, the separate 60-recipe legacy section and its client catalogue were removed. The diary's recipe filter now searches this same 500-meal library and adds exact scaled calculated portions; existing saved diary entries and favourites remain intact. Goal labels describe portion examples, not weight-loss promises. Results depend on the whole day's intake and individual needs.

## Provenance and verification limits

- Source: US Department of Agriculture, Agricultural Research Service, Nutrient Data Laboratory, *National Nutrient Database for Standard Reference, Release 28*, September 2015.
- Snapshot: `fda-nutrient-database@1.0.2` on npm, which includes USDA `ABBREV.txt` and attributes that source. Despite the npm package's name, the source is **USDA**, not FDA.
- Exact tarball URL, SHA-512 registry integrity and SHA-256 of `ABBREV.txt` are recorded in [the subset](../public/data/nutrition-usda-sr28.json). The build checks the pinned SHA-512 before reading data. It never executes npm package code or installation hooks.
- The npm mirror's MIT licence is retained as [nutrition-mirror-LICENSE.txt](../public/data/nutrition-mirror-LICENSE.txt).
- 36 source records retain exact five-digit USDA NDB numbers and English source descriptions; Arabic translations and preparation states are supplied for readers.
- **This is a traceable historical snapshot, not a current official-API verification.** Direct retrieval from `api.nal.usda.gov` was attempted and returned proxy tunnel HTTP 403. Current official cross-check and qualified nutrition review remain outstanding. All 500 recipes visibly say that professional review is pending.

Do not describe these recipes as medically approved, independently taste-tested, laboratory analysed, or 500 professionally verified recipes.

## Calculation

For every nutrient, `total = Σ (ingredient grams / 100 × USDA per-100g value) × servings`. Calories, protein, carbohydrate, fat and fibre are calculated independently from source fields. USDA energy may differ from `4P + 4C + 9F` because of specific Atwater factors, fibre and source rounding; the code does not replace source energy with an AI estimate.

Weights refer to the **edible part and exact preparation state**, not automatically raw weights: e.g. chicken is roasted breast without skin; rice, pulses, quinoa and pasta are cooked; tuna is canned in water and drained; oats are dry; fruits exclude inedible pits and peels where applicable. Weighing the wrong preparation state invalidates the estimate. Recipe values are rounded only for storage/display; plans recalculate from ingredient values.

All recipe ingredient combinations, IDs and Arabic names are unique. Each goal has 50 breakfasts, 75 lunches, 75 dinners and 50 snacks. The first 100 recipe records and their IDs are preserved exactly. The additional 400 are built from interleaved assembly families (oat bowls, dairy/fruit cups, toast, breakfast plates, grain bowls, pasta, potato plates, pulse salads, sandwiches, smoothies and savoury snacks) in `scripts/meal_variants.py`. The builder rejects duplicate ingredient sets even when weights or categories differ; changing only quantities never counts as a new recipe. Recipes include grams, one base serving, assembly steps, approximate assembly time, difficulty, declared ingredient allergens and suggested substitutions. Timing excludes advance cooking and overnight soaking. These are practical assembly suggestions, not tested kitchen recipes. Additional sauces, salt, spices and oils are not silently included. The user can select a documented ingredient alternative at the same gram weight. Nutrients and declared allergens recalculate immediately; the original recipe remains unchanged, and edited diary entries are labelled. Preparation may need adjustment to the substitute. Suggested alternatives are not calorie-equivalent by default. Favourites retain the original recipe rather than silently storing an edited variant.

## Images, prices and allergens

The library uses an original **CC0-1.0 vector illustration**, created for this project. It is visibly identified as a general illustration, not a photograph of each recipe. No third-party food photo licences are assumed.

Prices are `null`; the interface explains that reliable local costs and budget filtering are unavailable. No invented costs or budget satisfaction claims are shown.

Allergens are derived from ingredient metadata: milk, egg, wheat/gluten, peanut, tree nuts and fish. Oats are conservatively flagged for gluten exposure. The app cannot certify packaged bread, dairy products or cross-contact as safe; check actual labels and a qualified professional. Filter constraints never silently relax an allergy. Meal generation fails with an explanation when no candidate satisfies all restrictions.

## Features

- Arabic/English labels, ingredient names and preparation states, recipe descriptors and preparation steps for the 500 calculated recipes. Time notes and difficulty also have English data fields.
- Search by Arabic/English recipe or ingredient name, goal, max calories, min protein and saved favourites.
- Eight recipes per page; lazy-loaded original illustration; servings 0.25–4; all ingredient grams and nutrients update together.
- Add a scaled serving to the existing diary. Favourite IDs use local `mdaar_recipe_favorites`, included in the existing export/delete scope.
- Deterministic daily/weekly plans, 3–5 meals per day. Calories are entered or copied from the user's calculator, with optional macro targets, goal, unwanted ingredients, allergen exclusions and assembly-time constraints.
- The planner searches combinations of existing source-calculated recipes, scales practical portions and calculates the result. It displays **actual macro totals and deviations** instead of claiming exact macro matches. Rounding portions can leave a small calorie difference; this is displayed.
- Swap explores unseen allowed recipes in the same meal category before beginning a new cycle. It excludes the other meals already selected for that day, preserves all constraints and practical portion bounds, and favours a change of ingredients while staying close to the slot’s original energy/macros. The calorie anchor is fixed across swaps so rounding cannot accumulate. A manually edited portion establishes a new anchor while retaining that slot’s history. Portions and daily totals recalculate after every swap. If no alternative meets the constraints, the interface explains that without relaxing them.
- The original four-card quick suggestions under “Meals” now use this same 500-meal catalogue and swap function, replacing the three-item hard-coded lists. They use the calculator target and the planner form’s active goal, time, ingredient and allergy exclusions. Their selections and cycle histories survive tab changes during the session; adding to the diary stores the actual scaled nutrients and ingredient grams. The calculated planner and quick suggestions keep independent per-slot histories.
- No Groq call, personal-data upload or AI-generated nutrient value is needed for the calculated library or planner. Settings deletion clears in-memory plan data, unsaved ingredient substitutions and saved favourites; a plan is not automatically retained across reloads.

## Rebuild and validation

```sh
python3 scripts/nutrition-build.py
node --test tests/nutrition.test.mjs
```

The build downloads the pinned data archive over verified HTTPS, checks integrity, selects 36 exact source records and rebuilds 500 meal suggestions. No dependency installation is required. The 15 tests cover source references, recipe uniqueness/counts, ingredient sums, serving validation, bilingual filters, allergy/exclusion/favourite filtering, day/week counts, truthful totals, practical portions, nonmutating swaps, 50 successive unrestricted swaps and 20 restricted swaps without repeats, cycle exhaustion with only three eligible choices, exclusion of the second daily snack, fixed anchors after manual scaling, ingredient substitution/allergen recalculation and invalid/impossible inputs. Browser checks exercise 20 consecutive button clicks in each meal interface, restrictions, selection retention between tabs and diary values. Browser coverage is reported separately by the main QA report; do not infer it from these unit tests.

## Remaining editorial requirements

Current official USDA comparison, professional nutrition review, independent culinary testing, real licensed photos per recipe if desired, brand/country-specific packaged food matching, verified local price integration and individual medical/dietary suitability remain outside the validated data claims. This implementation deliberately reports these limits instead of inventing data or endorsements.
