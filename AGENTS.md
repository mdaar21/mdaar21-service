# Codex instructions for Mdaar21
This repository is a migration of an existing Arabic fitness and nutrition site hosted on Netlify. Preserve existing user flows and visual identity (black, warm gold, ivory, RTL). **Do not deploy or merge to main automatically.**

## Project setup
- Static site entry: `public/index.html` (must be imported from original user-provided `mdaar-netlify-final.zip`).
- AI serverless proxy: `netlify/functions/ai.mjs`, exposed as `/api/ai`.
- Secret: `GROQ_API_KEY` in Netlify environment only.
- Nutrition guide PDF is supplied separately. Do not claim to update or review it if it isn't accessible.
- Exclude storefront, checkout, payment and product-delivery work from the scope.

## Safety P0
- The original user-provided ZIP contained a hard-coded Groq API key. Treat it as compromised; owner must revoke/rotate it. Never commit it, including in test fixtures, commits or logs.
- Validate and escape any untrusted strings used with `innerHTML`; use `textContent` for plain text.
- Add distributed rate limiting before public high-volume usage; memory-only maps aren't reliable across Netlify invocations.
- Test nutrition equations and edge-case input values. Meal photo analysis is approximate.
- Never claim medically precise calorie or health outcomes.

## Development plan
1. Import **original** `public/index.html` without altering its behavior, taking care not to import the original unsafe `ai.mjs`.
2. Audit all menus and components, improve typography, responsive layout, keyboard access and RTL support, preserving branding.
3. Separate business logic from markup incrementally. Avoid unnecessary full framework rewrites.
4. Improve real AI features across existing menus: food log, recipe search, meals, daily totals, training alternatives and progress, with user opt-in for sensitive data.
5. Verify recipe data against reliable sources; aim for 50 cutting and 50 bulking recipes, don't fabricate values.
6. Review exercise guide and PDF formatting only after PDF and any editable source files are available, with qualified professional sign-off before marketing claims.
7. Add unit and integration tests, security scans, and documentation.
8. Make focused commits and open draft PRs; no Netlify production deployment without explicit owner approval.

## Acceptance criteria
- All existing functions still work.
- API keys never appear in source or in client bundles.
- `/api/ai` handles malformed JSON, oversized requests, missing secret, and upstream timeouts gracefully.
- Mobile and desktop are usable with clear visual hierarchy.
- Arabic RTL and mixed English terms display correctly.
- Any untested features are reported as untested.
