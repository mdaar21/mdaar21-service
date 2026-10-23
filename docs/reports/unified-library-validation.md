# Unified recipe library and Mdaar interface — 2026-10-22

The recipe tab now has one 500-meal catalogue. The separate 60-recipe section, its legacy recipe data and its rendering handlers were removed from the client at the owner's request. Recipe suggestions on request remain under the neutral “وصفة على ذوقك” heading. Saved diary entries, favourites and the existing 500 calculated recipe IDs remain intact.

The diary's recipe category searches the same catalogue, displays up to 30 matches with a link to the full library, and adds scaled nutrients and ingredient grams calculated from source records. The library supports goal, meal category, ingredient search, portions, favourites and diary additions; meal planning and non-repeat swaps continue to use the same 500 entries.

Technology labels were replaced with normal Mdaar product copy in Arabic and English: buttons, planning text, settings, consent messages, loading states, errors, training alternatives and the privacy page. “اسأل مدار” remains available. Request routes, consent requirements, secure sessions, external-provider disclosure, quotas and credentials were preserved. The interface does not claim a human is answering. User-generated questions and provider-generated answers are not censored. Cache version is `mdaar-public-v6`.

Validation:

- `npm run check` passes: 21 JavaScript files parse, document assets exist and HTML IDs are unique.
- All 62 unit/integration tests pass; category-and-goal filtering now also checks the expected 50 bulking breakfasts.
- 28 browser checks pass across the updated recipe/legacy workflow, nutrition, four responsive layouts, privacy, security, assistant and offline groups. The final nutrition subset was repeated after the language-refresh adjustment: 5/5 pass.
- A dedicated check visits all nine sections and the assistant in Arabic and English and scans the privacy page for forbidden technology labels. The unified-library check verifies absence of legacy selectors, total/category counts, scaled recipe additions from both gallery and diary, and navigation to the full library.
- Axe reports zero automated violations across nine mobile Arabic sections and the assistant dialog; automated testing is not complete accessibility certification.
- `mdaar-site-latest.zip` updated: 73 files, 4,107,143 bytes, including the unified public interface, functions and source-data rebuild scripts; no environment files or credentials.

Local evidence: [browser results](unified-library-local.json). The authorized production deployment and live verification are recorded below.

## Published result

- Site: https://mdaar21-global.netlify.app . Existing site only; main was not merged.
- Deployment `6ada3b32aabfd898842623f7`, ready and published at `2026-10-22T16:35:09.570Z`; source commit `0ef6d205eaf470ad915abfc29012cd570e0959c8`.
- Live app, nutrition module, training module and service worker match source bytes. The updated raw GitHub ZIP returned HTTP 200 and matches local contents and SHA-256 `e02c0d35892fccf48205eb1bba0822f0bd7ed4e4e1f57c38b055b4a992765008`.
- [Live mobile browser](unified-library-live.json): one 500-entry recipe library and no legacy section, nine panels and the assistant checked in Arabic and English with no technology labels, category/goal/search and scaled diary additions, shared catalogue in the diary, provider disclosure retained in privacy, no mobile width overflow, no runtime errors and no provider POST. Real responses were relayed with the trusted platform CA, without mocks or disabled TLS verification.
