# IRIS Change Atlas

**Review what changed in an IRIS instance, without changing it.**

IRIS Change Atlas compares two management API captures and turns configuration differences into a reviewable handoff. It covers web applications, scheduled tasks, and namespace mappings. Every difference retains its before and after values. A denied, failed, or truncated collection is an evidence gap, never an empty list that produces false deletions.

Original entry under development for the [InterSystems Build Your Own Management Portal contest](https://openexchange.intersystems.com/contest/48). **Not submitted or accepted yet.** Built with AI assistance; implementation, tests, and observed results are disclosed in this repository. No third-party entry's source code was used.

## Try it

Requires Node.js 22+; no npm dependencies or paid API. The web client also runs as static files, offering the recorded example, JSON import, comparisons, and downloads without a backend. The public/static version never connects to your IRIS server.

```sh
npm start
# Open http://localhost:4177
```

Choose **Explore recorded example** for two actual captures from our disposable IRIS 2026.2 Community Edition container. Between captures the verification script changed one disabled fixture application's namespace, added another disabled application, and removed a third. The expected result is **3 changed objects, 40 unchanged objects, 3/3 collections comparable, 1 changed field on an existing object**. This is a controlled engineering demonstration, not customer data or a production incident.

## Connect a local Community Edition instance

IRIS **2026.2 or later with management API v2** is required. 2026.1 was tested: `/api/admin/info` works but the v2 collection routes return 404. Use the [official container registry](https://containers.intersystems.com/contents/containers) and review the [Community Edition limits](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=ACLOUD). Free Community Edition carries a time-limited license and connection/resource limits; this project does not alter those limits.

The following is our **disposable, loopback-only development setup**, not production deployment advice:

```sh
docker run --name xinmi-iris-change-atlas --label xinmi.project=iris-change-atlas --cpuset-cpus=0-3 --cpus=2 --memory=2g -d -p 127.0.0.1:52774:52773 containers.intersystems.com/intersystems/iris-community:2026.2
npm run setup:local
npm start
```

Choose a valid CPU range if your Docker runtime exposes fewer than four CPUs. The tested image digest is `sha256:87c8b9062530093d30384d66caa9933b8399bfbace7ddb7f1bdb983c0bfdb85b` (IRIS 2026.2 Build 221U). `setup:local` refuses other container labels, replaces the default `_SYSTEM` password with a generated random password using the documented Security.Users API, and writes it only to ignored `.local/iris.json`. It does not disable authentication or password policy. It refuses to replace an existing connection file. `_SYSTEM` is privileged; it is used here solely in the isolated disposable container.

For an already configured instance, provide `IRIS_BASE_URL`, `IRIS_USERNAME`, `IRIS_PASSWORD`, and optionally `IRIS_LABEL` as server environment variables, or create an ignored `.local/iris.json` with those values under keys `baseUrl`, `username`, `password`, `label`. Never commit credentials. Remote connections require HTTPS with valid certificates. The supplied user needs the API's privileges: `%Admin_Secure:U` for web applications, `%Admin_Manage:U` for namespaces, and `%Admin_Operate:U` or `%Admin_Task:U` for task reads (runtime requires `%Admin_Operate:U`). These administrative privileges can allow writes in IRIS itself; the app's read-only route allowlist is **not** a claim that the account has read-only permissions.

The server binds only to `127.0.0.1`, validates the Host and Origin, has no general-purpose proxy, and makes only five named GET requests to the configured IRIS origin. Credentials are never returned to the client or saved in browser storage. Do not expose this local development server to a network or put it behind a public tunnel.

## Review a change

1. Enter a label such as **Before maintenance** and click **Capture now**.
2. Carry out your separately approved change in IRIS, using your normal management process. Atlas has no write controls.
3. Capture again with a meaningful label. The first capture remains the baseline; the newest becomes current.
4. Check **Evidence coverage** first. A partial/unavailable collection cannot establish additions, removals, or an all-clear verdict. Different source IDs and live/example mixtures block comparison.
5. Filter the ledger or find an object. Select it to review exact field values, including the distinction between missing, empty, null, and false.
6. Add a reviewer note and **Export review .md**. Use **Save captures** for a JSON bundle that can be imported on another machine without connecting to IRIS.

Captures remain only in tab memory until downloaded. Refreshing or closing clears them. Imports accept up to 20 captures and an 8 MiB file, validate structure and identities, and strip non-allowlisted fields. Imported files and their labels are untrusted evidence, not digitally authenticated records. Exports contain configuration metadata and should be reviewed before sharing; no authentication credential fields are included. Do not put passwords into labels, free-text IRIS descriptions, or reviewer notes.

## What the comparison means

- **Web applications:** name, namespace, enabled state, type, required resource, authentication method labels, dispatch class, namespace-default and system-app flags.
- **Tasks:** stable numeric ID, name, namespace, type, description, suspended state. Next-run and last-finished times are deliberately omitted because ordinary execution changes them. This is not a complete task scheduling audit.
- **Namespaces:** default global, routine, system, library and temporary database mappings. Subscript mappings are outside this version's scope.
- **Runtime:** uptime, backup label, selected usage/alert/license counters. Shown as context, excluded from configuration changes.

Reads are sequential, not a transactionally consistent snapshot. Do not use captures taken during active reconfiguration as proof of an atomic state. A source ID identifies the configured endpoint, not a cryptographically authenticated physical instance; confirm identity if replacing an instance at the same endpoint. At the 10,000-row limit, coverage is marked partial. Unknown collections, permissions, connectivity and schema errors remain visible. No changes in the covered fields do not prove whole-system health, compliance, security, or absence of other changes.

## Verification

```sh
npm test
npm run verify:live
```

`npm test` covers meaningful diff and connector boundaries, including incomplete evidence, reordered sets, changing task timestamps, duplicate identities, malformed imports, source mismatches, API failures and row limits.

`verify:live` is explicitly restricted to the named, labeled local container and `http://127.0.0.1:52774`. It creates only three named **disabled** `/atlas-fixture-*` test applications, captures actual API results, asserts the expected diff, and cleans up those fixtures. It refuses pre-existing fixture names. It must never be adapted to run against production. The app server itself never performs these fixture mutations.

Observed results and dates are recorded in [qa/live-verification.json](qa/live-verification.json) and [STATUS.md](STATUS.md). The bundled `public/example.json` is projected from these actual captured results and clearly marked as an example. It is not a mocked live response.

## Architecture and references

- `lib/iris-client.mjs`: bounded, authenticated GET collector and explicit collection evidence status.
- `public/atlas-core.mjs`: shared validation, normalization, deterministic identity-based comparison and Markdown output.
- `server.mjs`: local-only static server and narrow capture endpoint; no dependencies.
- `public/app.mjs`: client-side evidence review, filtering, import and exports.
- `scripts/verify-live.mjs`: separate controlled integration harness.

API routes and fields were implemented against the official [System Administration API specification](https://github.com/intersystems-community/sysadmin-api-specification). API reference content was used as documentation; the repository does not copy its specification or another contest application's code. Local setup uses documented [Security.Users](https://docs.intersystems.com/irislatest/csp/documatic/%25CSP.Documatic.cls?CLASSNAME=Security.Users&LIBRARY=%25SYS) and test fixtures use [Security.Applications](https://docs.intersystems.com/irislatest/csp/documatic/%25CSP.Documatic.cls?CLASSNAME=Security.Applications&LIBRARY=%25SYS).

MIT license applies to this project's original code. InterSystems and IRIS are their respective owners' trademarks; no endorsement is claimed.
