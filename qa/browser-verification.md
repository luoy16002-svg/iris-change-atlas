# Browser verification — 2026-09-24

Browser: actual Chrome through the supported browser UI tools. Public demo URL: https://luoy16002-svg.github.io/iris-change-atlas/

Observed against the published application through commits `c062477` → `ca8e0c3` → `8966799`/`99de87d` (last two contain static asset versioning, links and the responsive harness).

1. Initial empty state and public/offline explanation shown. Public capture controls are hidden in the latest version; the example and import remain available.
2. **Explore recorded example** loaded the actual controlled local fixture: 3 changed objects, 40 unchanged, 3/3 complete collections, 1 field edit on an existing object. Namespace detail showed `USER` → `%SYS`.
3. Task filter showed no matching changes; it did not leave stale object details. Searching `reports` showed one added object with exact fields and `Not present` values on the before side.
4. Swapping baseline/current changed the same reports object to removed and displayed a reverse-chronology notice. Swapping back restored the original direction.
5. Entered reviewer note: `Controlled local fixture review: 3 expected changes verified. No production changes.` Exported `iris-atlas-review.md` and `iris-atlas-captures.json` using real browser buttons. The browser automation download-event waiter timed out for the Markdown file, but the actual file was present in the normal Downloads directory. Both files were read back from disk; the note and the 3/40/3-of-3 result matched. The downloaded JSON replayed exactly 3 changes in the shared comparison engine.
6. Refreshed the tab and imported the downloaded JSON through the native browser file chooser. The expected comparison returned, including source provenance notice.
7. Imported a **synthetic QA variant** of the recorded example where the after web-app collection was intentionally unavailable. Its reason explicitly said it was a simulated permission denial, not a live failure. UI showed 2/3 coverage, 18 unchanged objects in the available collections, zero confirmed changes, the evidence gap, and a notice that missing collections prevent an all-clear. No false removals were emitted.
8. Desktop screenshot inspected at a 1104 CSS-pixel document width. A browser viewport override request did not actually change document width; it was reset and was not counted as a mobile test. The [reproducible narrow-screen page](../public/responsive-check.html) instead rendered the actual app in a 390 px-wide iframe. Measured iframe document width and scroll width were both **375 px** after the vertical scrollbar, with no horizontal overflow. Two-column metrics became a two-by-two grid; sidebar collapsed; ledger and inspector stacked. The Web apps filter remained functional. A normal screenshot was inspected after the full-page screenshot operation timed out.

Application console errors: none observed during these flows. Browser-extension warnings were present and are not counted as application errors.

Limitations:

- Initial local navigation to `http://127.0.0.1:4177` was blocked by the browser client. No browser protection was disabled or bypassed. Actual local IRIS and local server behavior were checked through the separate CLI/integration tests; browser clicking of the live local capture button is not claimed.
- These are real UI interactions and still screenshots. No silent captioned video has been recorded yet.
- A functional public demo, source repository and passing CI are not contest registration, app moderation, a contest entry, or a prize.
