# Remove generated daily plan — 2026-10-23

The owner requested removing “ولّد خطتي”. The complete generated-plan card, preference input, request handler, generated-result diary action, translations and unused parser have been removed. The calculated 500-meal catalogue, quick daily suggestions, swapping, diary actions, calculated planner and Ask Mdaar remain available.

The service worker cache is now mdaar-public-v9 and no longer precaches the removed parser. Existing browser checks were updated to exercise the remaining flows rather than the removed feature.

Validation: project syntax, document IDs and asset checks passed; all 69 remaining unit/integration tests passed. The legacy, nutrition and PWA browser groups passed all 12 checks, including 20 successive distinct breakfast swaps, calculated diary values and offline calculator/diary reload. The latest-site ZIP was rebuilt from the current files without secrets.

Publication: saved on the existing draft PR branch, not merged to main. Production publication remains blocked by the previously confirmed Netlify account credit limit. No deployment or billing change was attempted for this removal. The production URL may still show the removed card until a new deployment is possible. Prior daily-plan diagnostics describe the historical removed feature and are not evidence that this removal has been published.
