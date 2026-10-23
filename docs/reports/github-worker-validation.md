# GitHub Pages → Cloudflare service preparation — 2026-10-23

The owner requested connecting the assistant to the GitHub-hosted site without a separate service-consent step and explicitly stopped work on the old hosting platform. The owner confirmed having no Cloudflare account. No Cloudflare credentials are available in this environment. The prepared implementation is independent of the old service; no old-host deployment or secret retrieval was attempted.

## Prepared code

- `cloudflare/worker.mjs` and `wrangler.json`: standalone text-only Groq service. One SQLite Durable Object atomically enforces session and AI quotas across instances, with expiring pseudonymous counters. It generates and retains its own signing secret. `GROQ_API_KEY` is declared as a required server secret; no browser key or platform-management token is published.
- Sessions are signed, origin/IP-derived-client bound and valid for 15 minutes; browser tokens stay in module memory. There are no cross-site cookies, invitation fields or separate consent UI. The exact GitHub origin is CORS-allowed, with bounded request/response JSON and fixed upstream URLs. Failure of durable protection stops provider spend.
- `public/assets/remote-service.mjs` automatically starts the session on the first Send, reuses it, refreshes once after 401 and never silently regenerates provider errors. App cancellation, data deletion and optional target attachment remain effective. No records are sent on page load.
- `scripts/build-github-pages.py --service-origin <public-worker-origin>` sets the service metadata, exact CSP allowlist, project paths and Arabic/English privacy text. With no origin it retains the honest unavailable state. The test origin must never be published as an actual connection.
- `docs/github-ai.md` and the README contain a Cloudflare deployment link for the dedicated `cloudflare-worker` branch and exact owner setup steps. The prepared service can be reviewed before account activation.

## Verification and limits

All 86 unit/integration tests passed. The actual browser adapter, Worker handler and Durable Object class share an integration test with only storage and the provider fixture replaced. Tests cover CORS rejection, signed sessions, expiry/tampering/IP changes, concurrent quotas, global/day limits, persistence across object restart, counter cleanup, failures before upstream spend, output validation and bounded provider retry.

All 18 existing privacy/security/assistant/legacy browser checks passed. Four additional project-prefixed Pages browser checks passed with the actual generated CSP and controlled cross-origin service fixtures: direct first Send, in-memory token reuse and escaped output; cancellation during session creation; one automatic refresh; and a bounded provider failure. No fixture or schema check is evidence of live provider operation.

The Worker config validates against official Wrangler 4.152.0's JSON schema, downloaded from its npm archive with SHA-512 integrity verification. Cloudflare-specific runtime deployment and SQLite behavior have not been exercised against a real Cloudflare account. Both configured and unconfigured static builds pass explicit asset, CSP, privacy and cache checks.

**Not live:** no Cloudflare account or deployment, real provider request, actual Worker URL or live GitHub service connection exists yet. No fake endpoint was published to Pages, no billing changed and main was not merged. Owner account activation and a private Groq secret are required before deployment; afterward the public Worker origin must be inserted in Pages and verified with a real non-personal question. Existing GitHub Pages remains available with its previously published static behavior.
