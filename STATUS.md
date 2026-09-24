# IRIS Change Atlas status

Updated 2026-09-24, Beijing. Owned by the xinmi task; independent of the mimimi projects.

- Original implementation: dependency-free Node local collector, browser review, import/export, evidence-aware comparisons for three collections, runtime context.
- `npm test`: 24/24 passed. `node --check` passed for client and server.
- Actual IRIS 2026.2 Community Edition API v2 requests returned HTTP 200. Controlled integration found exactly one addition, one removal, one namespace edit, 40 unchanged objects, 3/3 complete collections. See `qa/live-verification.json`.
- Fixture applications were removed after the test. Original system applications and tasks were not edited.
- Public example is projected from those actual local captures and labeled recorded example.
- Initial 2026.1 spike authenticated but returned 404 for v2 routes. Its stopped container is retained as `xinmi-iris-change-atlas-2026-1`; the active 2026.2 container is `xinmi-iris-change-atlas`.
- Local server listens at `http://localhost:4177`. No public backend or tunnel. The CLI/live integration is verified; browser clicking of the local live-capture control remains unverified because Chrome blocked its loopback navigation. No protection was disabled.
- [Public source](https://github.com/luoy16002-svg/iris-change-atlas) and [recorded demo](https://luoy16002-svg.github.io/iris-change-atlas/) are published. The demo has no live backend.
- Public browser checks passed: recorded data, exact field inspection, filtering/search, reverse chronology, real Markdown/JSON downloads, reading back both downloaded files, JSON reimport, and a clearly labeled simulated evidence gap. Desktop and a real 390 px iframe were inspected; its content width and scroll width were both 375 px after the scrollbar. See `qa/browser-verification.md`.
- GitHub Actions tests and Pages deployment passed at application commit `99de87d32468e1cde45741449034bcbb339b414e`. Later documentation/server-header follow-up commits must be checked separately.
- English README and submission draft are ready. A silent captioned video has **not** been recorded; browser captures so far are still images and must not be called a video. The official entry permits a detailed text description instead of video, but the standing task's recording requirement is still pending.
- The actual official Apply flow requires InterSystems SSO; the existing GitHub account has no browser login session. Its sign-in page is retained for the user. No new credential, account binding, registration or terms acceptance was performed.
- Event registration: **not registered**. Open Exchange app: **not submitted**. Contest entry: **not submitted**. Award/payment: **none**.

Next: complete the remaining actual silent recording with an approved recording capability, verify the local capture UI when browser access permits, and resume the retained official login flow after the existing user login request is answered. Check the exact binding terms before any submission. No speculative features or repeated tests while blocked; preserve the tested app. Do not report a public demo as an event entry.
