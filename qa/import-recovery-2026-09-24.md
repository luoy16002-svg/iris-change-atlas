# Import recovery and keyboard checks — 2026-09-24

Actual public application in Chrome, operated through the supported browser UI tools. Application fix: `172f9be7f1d8e840c5bb9db832f52730baa874ca`.

## Observations and correction

- A malformed JSON file was rejected with `That file is not valid JSON.` The two existing captures, 3 changed objects, 40 unchanged objects, 3/3 coverage, and the typed reviewer note remained present.
- A JSON file containing only `null` also preserved the existing review, but exposed the internal message `Cannot read properties of null (reading 'schema')`. This was a user-facing validation defect, not data loss.
- Corrected the import envelope check to handle a null root. The matching local capture request guard now returns a normal 400 label-validation response for null JSON, instead of a generic server error. The existing API boundary test includes this case.
- After the fix was deployed, refreshed the actual public page and imported the same null file. The page displayed `Choose an Atlas snapshot or capture bundle.` The example could then be opened normally.
- Imported an empty capture bundle into the populated review. It displayed the same actionable validation message and retained both captures, the 3-change result, and the reviewer note.
- Before the fix, imported a copy of the example with an existing snapshot ID but a different label. It was rejected with `A different snapshot already uses this ID.` Existing labels, capture count, result and note remained unchanged. This path was already correct and was not modified.
- The file input was empty again after rejection, allowing another import without refreshing the workspace.

## Keyboard interaction

Pressed Enter on **Tasks**: the empty filtered state showed **Nothing selected.** Pressed Enter on **All changes**, then on the added reports object: exact field details appeared, the selected row retained keyboard focus, and its `aria-pressed` state was true. After deployment, Enter on **Explore recorded example** loaded the comparison successfully.

## Validation and limits

`npm test`: **24/24 passed**, including the extended malformed-request boundary assertion. `node --check public/app.mjs` and `git diff --check` passed. [Tests and Pages deployment](https://github.com/luoy16002-svg/iris-change-atlas/actions/runs/36011217350) succeeded for the implementation commit above.

These checks extend the earlier browser evidence; they do not constitute a complete accessibility audit. They do not resolve the separate local browser navigation, actual video recording, account login, or contest submission gates. No contest entry, prize, or payment resulted from this patch.
