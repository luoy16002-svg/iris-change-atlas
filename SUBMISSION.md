# Submission material — draft, not submitted

Target: https://openexchange.intersystems.com/contest/48

Title: **IRIS Change Atlas**

Short description:

> A read-only change review workspace for InterSystems IRIS. Capture before and after a maintenance change, inspect exact configuration differences, and export a handoff that keeps evidence gaps visible.

Full description:

IRIS Change Atlas helps an operator answer a practical question after maintenance: what actually changed, and do we have enough evidence to say so?

The local Node server reads web applications, scheduled tasks, namespace mappings, and runtime context through the IRIS 2026.2 management API. The browser compares stable object identities, shows exact before/after values, and exports a Markdown review with notes plus reusable JSON captures. Credentials remain on the local server, and the app exposes no IRIS write operation.

Evidence quality is part of the workflow. Permission failures, malformed responses, duplicate identities, and row limits are marked unavailable or partial. They cannot silently become an empty collection that falsely reports deletions. Different sources are not compared. Moving task execution timestamps and runtime counters do not pollute configuration differences.

The included example comes from two actual captures of a disposable local IRIS 2026.2 Community Edition instance. A controlled fixture changed one disabled application's namespace, added another disabled application, and removed a third. The tool reported the three expected changes and 40 unchanged objects. Twenty-four automated tests cover comparison and connector boundaries. This demonstrates the stated behavior on a local fixture; it is not a production audit or customer validation.

No paid service or AI API is needed to run the application. Source and UI were developed with AI assistance, and the repository describes exactly what was tested. No other contestant's code was reused.

Repository: https://github.com/luoy16002-svg/iris-change-atlas

Public recorded demo: https://luoy16002-svg.github.io/iris-change-atlas/

Required checks before actual submission:

- Complete browser evidence and final README.
- Recheck contest deadline, entry eligibility and duplicate occupancy.
- Existing InterSystems/Open Exchange account or user-completed account creation; accept binding terms only with required specific user confirmation.
- Submit original app for moderation, verify actual receipt, then apply it to contest 48 and verify the entry listing.
- Do not fill personal identity, tax or payment records automatically.

Submission window: official announcement says September 27, 2026, 23:59 EST. Avoid last-hour ambiguity; target completion before September 28 morning in Beijing. October 4 is voting close, not submission close.
