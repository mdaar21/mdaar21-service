> Superseded on 2026-10-23: the owner requested removing the generated daily-plan feature. See [removal and current publication status](day-plan-removal.md). The diagnostics below are historical.

# Daily plan response fix — 2026-10-22

The real `/api/ai` endpoint returned HTTP 200 with a four-meal array, while the day-plan client accepted only an object with a `meals` property. The proxy deliberately unwraps legacy single-array objects. The client discarded that valid response, made an unnecessary second request, then threw a generic error telling the user to change their text. The existing mocked browser test used the wrapped object and therefore missed the production contract mismatch.

The new daily-plan parser accepts both the actual array and wrapped-object shapes, requires four distinct meal categories with valid item arrays, normalises numeric strings and units, rejects invalid values and retains the existing energy reconciliation for generated estimates. The client makes one request and reports incomplete output specifically instead of silently requesting the same plan again. The generate button stays disabled while a request is active and is re-enabled after success or failure. Network, timeout, quota and provider errors have appropriate copy without blaming the user's preferences or falsely claiming every quota limit lasts until tomorrow.

Without a calculator target, the interface now explains the 2,000 kcal example before generation and labels the result as an example rather than personal needs. Quick suggestions offer a direct calculator button that focuses the age field. Calculated targets replace the example note and continue to personalise both planning flows. Cache `mdaar-public-v8` includes the new parser for offline reloads. No provider credentials, quota settings or server API compatibility were changed.

Validation:

- The [pre-fix live reproduction](daily-plan-reproduction.json) records successful session setup, a successful real provider response with four meals, and the old client's inability to accept its array shape. It contains response shape metadata only, without cookies, secrets or generated meal contents.
- All 74 unit/integration tests pass, including a test that passes provider-shaped data through the actual backend handler and the new client parser, four parser cases for shapes, validation, immutability and energy handling, and the existing nutrition/security/training tests.
- 26 targeted browser checks pass: 10 legacy/day-plan checks and 16 nutrition/privacy/security/offline checks. New scenarios cover the actual array response, the no-target example, calculator action and personalised target, malformed output with no duplicate requests and manual retry, quota/outage messages and diary additions. The previous wrapped-object response remains covered.
- `npm run check`: all 23 JavaScript files parse, document IDs are unique and referenced assets exist.
- Updated complete-site ZIP: 74 files, 4,109,841 bytes, includes the new parser and current cache shell.

Local evidence: [browser results](daily-plan-local.json). Live publication and UI/provider validation will be recorded below.

## Live reliability follow-up

The first published parser fix rendered and saved a real four-meal example, while a subsequent request with the fictitious calculator target returned a provider failure. A separate valid-JSON example request succeeded. The client prompt previously illustrated its response with non-JSON placeholders; it now supplies a valid four-meal JSON structure and explicitly requests numeric fields. The server also recognises the provider’s `json_validate_failed` classification and makes at most one corrective format retry within the same existing 25-second deadline. It never logs, returns or echoes failed-generation content. Two additional tests cover that retry, common deadline, non-disclosure and stopping after the second rejection. This does not identify the provider’s undisclosed error body from the earlier 502 response; final live results are recorded separately.

Text requests now reserve at most 3,000 output tokens instead of 5,000; a provider capacity rejection (HTTP 413) allows one 1,500-token retry within the same deadline. Any second rejection stops with a specific capacity error. Status-only diagnostic headers distinguish upstream HTTP failures from transport/read/deadline failures without exposing provider bodies, prompts or credentials. Two additional tests cover bounded capacity recovery and stopping after a second rejection.

The classified live failure subsequently established an initial model HTTP 404 followed by a discovered-model HTTP 400 classified as a JSON-mode requirement. Model discovery now requests prompt-directed JSON without assuming native JSON-mode support on a different model; the bounded JSON parser and all output validation remain mandatory. Recognised reasoning models request hidden reasoning for JSON-compatible final content. Additional tests prove compatible recovery and rejection of non-JSON output. The raw provider error contents are never included in client responses or reports. See [classified service rejection](daily-plan-service-rejection.json) for status metadata only.

## Final status: publication blocked by account credits

The last published deployment is `6ada4d77ee8ff03e36409a3b` (2026-10-22 17:53:07 UTC, app/backend commit `97cf8c9`). It includes the client array-response fix and prompt-directed fallback, but its live provider response did not pass JSON validation. The final candidate, commit `96596f8`, prioritises the non-reasoning Llama 8B fallback before reasoning models and uses low reasoning effort on GPT-OSS, while retaining strict output validation. All 74 unit/integration tests pass; this final candidate has **not** been published or validated against the live provider.

Two attempts to create the next deployment were rejected by Netlify HTTP 403 with the exact message: `Account credit usage exceeded - new deploys are blocked until credits are added`. Preparation/integrity verification and authenticated GETs of the account/site still succeeded. Publication stopped after identifying the credit block; no billing plan or credits were purchased or changed. Repeated diagnostic deployments contributed to account credit consumption; fewer production iterations would have been preferable.

The current complete-site ZIP contains the final candidate, including its serverless function; the GitHub branch holds all changes. After the owner restores deployment credits, publish the candidate and repeat both real browser cases in the test script: example plan without calculator, then the plan using a fictitious calculator target. Do not describe provider generation as fully fixed or verified until both pass. The local source-calculated planner remains independent of provider generation.
