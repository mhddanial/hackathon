# Departure usability protocol v1.0

23 October 2026. D1-06 study plan; no recruitment, participants, timings, scores, consent, or observations have occurred. Ananda owns feature usability work. Functional fixtures are not participant evidence. Collection is scheduled for D6-04 after a tested interface exists.

## Participants, consent, and scope

Plan **5 adult participants**, recruited from logistics/warehouse planning or UMKM export/shipping roles, or people with comparable actual dispatch-planning experience. Record role/experience bands, device familiarity, and recruitment limitations; do not claim professional representativeness for convenience peers. The target is a small formative study, not a statistical population estimate or the PRD's historical success percentage. If suitable participants are unavailable, record the limitation and actual achieved count rather than inventing recruitment.

Before each session explain purpose, voluntary participation, right to skip/stop, non-evaluation of the person, approximate 20–30-minute duration, synthetic planning scenarios, and intended academic report use. Obtain affirmative consent before observation and separate optional permission for any recording/screenshots. Do not solicit shipping credentials or real shipment/customer data. Use IDs `P01`–`P05`; store consent/contact material separately from anonymized task observations. Do not commit participant identities, consent forms, audio/video, or sensitive operational details. Keep only anonymized authorized summaries in report evidence. Planned retention: delete identifiable recruitment/recording material after analysis, no later than 30 days after report submission, subject to institution requirements explained in consent. No participant storage location is created by this plan.

## Procedure and tasks

Use the deterministic fixture environment, display a persistent synthetic label, record app version/fixture case/device/viewport, and reset each scenario. Do not present fixtures as current sailings. Alternate initial desktop/mobile order across participants where practical; record actual order. Read tasks without teaching which controls to use. Encourage think-aloud without supplying the answer. Intervene only after a participant asks or cannot proceed; log intervention and classify assisted completion separately.

| Task | Scenario / participant instruction | Independent success criterion | Functional coverage |
| --- | --- | --- | --- |
| U1 | Plan a supplied road departure and identify the selected ferry and recorded cutoff. | Submits valid inputs and identifies road departure, ETA, ferry departure, and cutoff distinctly. | DEP-01, DEP-05, DEP-11 |
| U2 | Explain SAFE, exact-cutoff RISKY, and a negative-buffer MISSED outcome in supplied scenarios. | Explains threshold comparison, RISKY at zero, and no boarding guarantee without prompting. | DEP-01–DEP-03, DEP-10 |
| U3 | Starting with a missed selected target, find a relevant alternative and use it. | Original target understood; chooses evaluated alternative, retains road plan, explicitly recalculates and identifies new result. | DEP-08, DEP-13 |
| U4 | Revise the road date/time for an overnight/source-zone scenario; change it during a delayed request. | Uses full dates/WIB correctly and recognizes that changed inputs invalidate the old result. | DEP-09, DEP-12 |
| U5 | Explain unavailable data, empty schedules, and service outage; recover where possible. | Does not interpret missing cutoff/zone as zero or SAFE; distinguishes unavailable data from outage; finds revise/retry. | DEP-04, DEP-06, DEP-07 |

DEP-14 is evaluated across all tasks with actual participant evidence. Keyboard-only completion and 390 px mobile layout are observed on U1/U3 where feasible, in addition to automated/browser checks in D5-06. Avoid claiming formal accessibility conformance from this small study.

## Measures and instrument

For each task record: start/finish elapsed seconds from task instruction to declared completion; unassisted success, assisted success, failed, or stopped; input errors/corrections; critical misunderstanding; help requests/interventions; relevant actions; and anonymized comments with permission. A critical misunderstanding includes treating unavailable as SAFE, confusing ferry and road departure, or interpreting the simulation threshold as a verified boarding guarantee. Log these even if the participant eventually finishes.

Use a **custom formative questionnaire**, not SUS, UEQ, or a validated scale. After each task ask Q1: “How easy was this task?” (1 very difficult, 2 difficult, 3 neither, 4 easy, 5 very easy). After all tasks ask Q2: “How clear was the meaning of the recommendation status?”; Q3: “How clear was the difference between road departure, terminal arrival, and ferry cutoff?”; Q4: “How clear were missing data and simulation limitations?” (1 very unclear through 5 very clear, 3 neither). Ask Q5 free text: “What should change before you would use this for planning?” Record skipped answers as missing, never zero. Preserve wording and scale anchors in the session record.

Confirm any supervisor/institution-required instrument and ethics/consent requirements **before collection**. If a standard instrument is required, revise the protocol and use its actual wording/scoring with appropriate sourcing; do not relabel these custom questions or retrospectively claim approval. This confirmation remains a collection prerequisite, not invented evidence.

## Analysis, evidence, and revisions

Report the actual sample/device/experience distribution, counts for each completion category, success denominator and missing observations, per-task median/range of elapsed time with sample size, individual item response distributions and missing answers, and anonymized themes. Do not combine Q1–Q4 into a validated score, fabricate percentages, infer population-level significance, or call fixture functional success a usability finding. Keep assisted results separate.

An observation row will contain `participant_id, task_id, fixture_id, device, order, started_at, elapsed_seconds, outcome, error_count, interventions, critical_misunderstanding, questionnaire_answers, notes`. Store sanitized reports under the Sprint 6 evidence/report paths only after genuine sessions. Connect each proposed revision to actual observation IDs, priority, change, and retest scope. No results table is populated in Sprint 1.

Study-readiness gate: D5-06 browser/accessibility checks, correct fixture setup for each task, consent process and required institutional confirmation, and an observation template ready before recruiting. D6-04/D6-05 collect observations, summarize actual outcomes, and retest evidenced changes. Sprint 1 completes the protocol design only.
