# Direct assistant requests — 2026-10-23

The owner explicitly requested automatic use without a separate service-consent control. The consent checkbox, settings shortcut, local consent gate and obsolete copy are removed. Pressing Send is the action that sends the question. Opening the site does not send diary, weight or training records to the model. The optional assistant target attachment remains off by default and does not include weight or diary entries.

On a 401, the client starts a signed public session using `{start:true}` and retries once. The server retains `{consent:true}` only for compatibility with older published clients. Invitation mode, signed HttpOnly/Secure/SameSite cookies, strict origin handling and atomic Redis quotas remain enforced. Closing the assistant or deleting local data aborts in-flight work and prevents late output. No credential is placed in public files.

Validation: 69 unit/integration tests passed. All 18 targeted browser checks (legacy, privacy, security and assistant) passed. These use controlled provider fixtures; they prove direct first-click requests, public-session creation without consent or invitation, safe cancellation, escaped output and optional target-only attachment. They do not prove live provider operation.

GitHub Pages remains a static deployment. The public interface update can be published there, but connected services remain explicitly unavailable. Live read-only checks of the existing Netlify backend returned session GET 200 with publicAccess=true from its own origin, cross-origin session GET 403 for https://ha084851234-alt.github.io, and cross-origin API OPTIONS 405 without CORS headers. Removing a checkbox cannot fix this hosting boundary. No credentials were read or exposed for these checks.

The backend update has not been deployed: Netlify previously blocked deployment due to exhausted account credits; no new deployment attempt, billing change, CORS/security bypass or unprotected browser API key was used. Enabling real responses on GitHub needs a deployable backend with a reviewed cross-origin session/authentication setup, or a return to a host serving frontend and backend together. The work is not described as a completed live AI activation.

Static UI update pushed to `gh-pages` commit `486e6cb76f3b7067c998e144d0bf164c29853454`, from source `35f0038`. This publication removes the controls; it does not activate a backend on Pages. See direct-assistant-validation.json for safe diagnostic metadata.
