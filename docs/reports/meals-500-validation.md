# 500 meals and varied replacements — 2026-10-22

- Catalogue: 500 unique IDs, Arabic names and ingredient sets; 250 cut / 250 bulk. Per goal: 50 breakfasts, 75 lunches, 75 dinners, 50 snacks. All original 100 records are unchanged, including IDs, grams, nutrients and preparation text.
- The additional 400 meals interleave multiple assembly families using the existing 36 attributed USDA SR28 records. Values recalculate from edible gram weights; these suggestions retain the existing pending-review labels and do not claim professional or culinary verification.
- Both the quick four-meal suggestions and the calculated planner use the expanded catalogue. Each slot tracks explored alternatives, starts another cycle only after its allowed practical choices are exhausted, and never immediately returns the current meal. Other meals already selected for that day are excluded.
- Swaps retain category, goal, assembly time, ingredient exclusions and allergens, recalculate portions and totals, and keep a fixed nutrient anchor to prevent cumulative rounding drift. Manual serving changes establish a new anchor. Quick suggestions share the form's restrictions and calculator target; quick and generated plans have independent histories. Tab and language changes preserve quick selections; deleting Mdaar data clears both plans.

Validation:

- `npm run check`: 21 JavaScript files parse; linked assets and unique HTML IDs pass; no Groq credential pattern in source.
- `npm test`: all 62 tests pass, including 15 nutrition tests. Coverage includes 50 successive unrestricted swaps, 20 restricted swaps, an exhausted three-choice pool, two snacks without duplicate selections, serving edits, exact recipe nutrient recalculation and immutable inputs.
- Browser groups `layout,home,privacy,pwa,nutrition,legacy`: 23/23 pass, including 20 consecutive clicks in each meal interface, constraints, diary values, language changes, local deletion and offline reload.
- Axe: zero automated violations in 9 mobile Arabic panels and the assistant dialog. Automation is not a complete accessibility certification.
- Additional mobile browser run: 20 clicks in each of the four quick meal slots plus 20 planner clicks (100 total), with no repeated choice within each tested slot, allergy/ingredient restrictions retained, correct diary calories, no width overflow, 63-page library, both plans reset on deletion, no AI POST and no runtime errors.
- Updated `docs/artifacts/mdaar-site-latest.zip`: 73 files, 4,111,650 bytes, contains the current 500-meal catalogue, client, functions and rebuild scripts; excludes secrets and environment files.

No training/PDF content or AI credentials were changed by this task. Production publication and direct live browser validation are recorded below.

## Published verification

- Authorized existing site: https://mdaar21-global.netlify.app . Deployment `6ada36a6f04fc0503397e1a2` is ready, published at `2026-10-22T16:15:46.322Z`; app source commit `8cf1dcd33fe896eb9e07965a844ff15507d163fd`. Branch pushed to the existing draft PR; main was not merged.
- Live HTTPS responses for the 500-recipe JSON, nutrition module, app module and service worker match repository bytes exactly. Cache version is `mdaar-public-v5`.
- The direct mobile browser repeated all 100 swap clicks on the published site: 20 in each of four quick slots and 20 in the planner, without repetition within each tested slot. It passed restrictions, scaled diary values, width/pagination and deletion checks with no runtime errors and no AI POST. Real responses were relayed through Playwright HTTP with the configured trusted platform CA, with no response mocks and no disabled TLS verification. See [live browser results](meals-500-live-browser.json).
- The GitHub raw download of the updated complete-site ZIP returned HTTP 200 and matched the local SHA-256. This task did not retest Groq completion or alter provider credentials.
